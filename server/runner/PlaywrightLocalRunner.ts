/**
 * PlaywrightLocalRunner — Exécute les scénarios avec un navigateur Chromium local.
 *
 * Détection Chromium multi-chemins :
 *   1. Variable d'environnement PLAYWRIGHT_CHROMIUM_PATH (override explicite)
 *   2. Chemin par défaut Playwright (pw.chromium.executablePath())
 *   3. Chromium système (/usr/bin/chromium, /usr/bin/chromium-browser, /usr/bin/google-chrome)
 *
 * Auto-installation :
 *   Si aucun binaire n'est trouvé, le runner tente automatiquement
 *   `npx playwright install chromium` pour télécharger Chromium dans le cache Playwright.
 *   Cela permet de fonctionner en production même sans navigateur pré-installé.
 */

import type {
  RealExecutionRunner,
  RealExecutionInput,
  RealExecutionResult,
  StepExecutionResult,
  RunnerAvailability,
} from "./playwrightConfig";
import { PLAYWRIGHT_ERROR_CODES } from "./playwrightConfig";
import { executeAction } from "./playwrightActions";

/** Chemins système courants pour Chromium / Chrome */
const SYSTEM_CHROMIUM_PATHS = [
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/snap/bin/chromium",
];

/**
 * Résout le chemin exécutable de Chromium en essayant plusieurs sources.
 * Retourne le premier chemin valide trouvé, ou null si aucun.
 */
async function resolveChromiumPath(): Promise<{ path: string; source: string } | null> {
  const fs = await import("fs");

  // 1. Variable d'environnement explicite
  const envPath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
  if (envPath && fs.existsSync(envPath)) {
    return { path: envPath, source: "env:PLAYWRIGHT_CHROMIUM_PATH" };
  }

  // 2. Chemin Playwright par défaut
  try {
    const pw = await import("playwright");
    const pwPath = pw.chromium.executablePath();
    if (pwPath && fs.existsSync(pwPath)) {
      return { path: pwPath, source: "playwright-cache" };
    }
  } catch {
    // Playwright non installé, continuer
  }

  // 3. Chemins système
  for (const sysPath of SYSTEM_CHROMIUM_PATHS) {
    if (fs.existsSync(sysPath)) {
      return { path: sysPath, source: `system:${sysPath}` };
    }
  }

  return null;
}

/**
 * Tente d'installer Chromium via `npx playwright install chromium`.
 * Retourne true si l'installation a réussi, false sinon.
 */
async function autoInstallChromium(): Promise<{ success: boolean; message: string }> {
  const { execSync } = await import("child_process");

  console.log("[PlaywrightLocalRunner] Aucun Chromium trouvé — tentative d'auto-installation...");
  console.log("[PlaywrightLocalRunner] Exécution: npx playwright install chromium");

  try {
    const output = execSync("npx playwright install chromium", {
      timeout: 120_000, // 2 minutes max
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        // S'assurer que le cache est dans un dossier accessible en écriture
        PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || undefined,
      },
    });

    console.log("[PlaywrightLocalRunner] Sortie installation:", output.trim());

    // Vérifier que le binaire est maintenant disponible
    const resolved = await resolveChromiumPath();
    if (resolved) {
      console.log(`[PlaywrightLocalRunner] Auto-installation réussie! Chromium trouvé via ${resolved.source}: ${resolved.path}`);
      return { success: true, message: `Chromium auto-installé via ${resolved.source}` };
    }

    return { success: false, message: "Installation terminée mais binaire introuvable après installation" };
  } catch (err: any) {
    const stderr = err.stderr?.toString() || "";
    const stdout = err.stdout?.toString() || "";
    console.error("[PlaywrightLocalRunner] Échec auto-installation:", err.message);
    if (stderr) console.error("[PlaywrightLocalRunner] stderr:", stderr.substring(0, 500));
    if (stdout) console.error("[PlaywrightLocalRunner] stdout:", stdout.substring(0, 500));

    // Essayer aussi avec --with-deps si la première tentative échoue (dépendances système manquantes)
    try {
      console.log("[PlaywrightLocalRunner] Tentative avec --with-deps (nécessite sudo)...");
      const output2 = execSync("npx playwright install --with-deps chromium", {
        timeout: 180_000, // 3 minutes max
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      console.log("[PlaywrightLocalRunner] Sortie install --with-deps:", output2.trim());

      const resolved = await resolveChromiumPath();
      if (resolved) {
        console.log(`[PlaywrightLocalRunner] Auto-installation (with-deps) réussie! Chromium via ${resolved.source}`);
        return { success: true, message: `Chromium auto-installé (with-deps) via ${resolved.source}` };
      }
    } catch (err2: any) {
      console.error("[PlaywrightLocalRunner] Échec install --with-deps:", err2.message);
    }

    return {
      success: false,
      message: `Échec auto-installation: ${err.message}. ${stderr ? "stderr: " + stderr.substring(0, 200) : ""}`,
    };
  }
}

export class PlaywrightLocalRunner implements RealExecutionRunner {
  readonly name = "PlaywrightLocalRunner";
  readonly mode = "LOCAL" as const;

  /** Chemin résolu du binaire Chromium (mis en cache après checkAvailability) */
  private resolvedExecutablePath: string | null = null;

  /**
   * Vérifie si Playwright et Chromium sont disponibles localement.
   * Si Chromium n'est pas trouvé, tente une auto-installation.
   */
  async checkAvailability(): Promise<RunnerAvailability> {
    // 1. Vérifier que le module Playwright est importable
    try {
      const pw = await import("playwright");
      if (!pw.chromium) {
        return {
          available: false,
          errorCode: PLAYWRIGHT_ERROR_CODES.PLAYWRIGHT_NOT_INSTALLED,
          message: "Le module Playwright est importé mais chromium n'est pas disponible",
        };
      }
    } catch {
      return {
        available: false,
        errorCode: PLAYWRIGHT_ERROR_CODES.PLAYWRIGHT_NOT_INSTALLED,
        message: "Le package Playwright n'est pas installé (npm install playwright)",
      };
    }

    // 2. Résoudre le chemin Chromium (multi-sources)
    let resolved = await resolveChromiumPath();

    // 3. Si aucun binaire trouvé, tenter l'auto-installation
    if (!resolved) {
      console.log("[PlaywrightLocalRunner] Chromium non trouvé, lancement de l'auto-installation...");
      const installResult = await autoInstallChromium();

      if (installResult.success) {
        // Re-résoudre après installation
        resolved = await resolveChromiumPath();
      }

      if (!resolved) {
        // Construire un message d'aide détaillé
        let expectedPath = "inconnu";
        try {
          const pw = await import("playwright");
          expectedPath = pw.chromium.executablePath();
        } catch { /* ignore */ }

        return {
          available: false,
          errorCode: PLAYWRIGHT_ERROR_CODES.PLAYWRIGHT_BROWSER_MISSING,
          message: `Chromium introuvable et auto-installation échouée. `
            + `Chemin Playwright attendu: ${expectedPath}. `
            + `${installResult.message}. `
            + `Solutions manuelles: (1) npx playwright install chromium --with-deps, `
            + `(2) apt-get install chromium, `
            + `(3) définir PLAYWRIGHT_CHROMIUM_PATH=/chemin/vers/chrome, `
            + `(4) utiliser le mode REMOTE avec un endpoint Browserless`,
        };
      }
    }

    this.resolvedExecutablePath = resolved.path;
    console.log(`[PlaywrightLocalRunner] Chromium trouvé via ${resolved.source}: ${resolved.path}`);
    return { available: true, message: `Chromium via ${resolved.source}` };
  }

  /**
   * Exécute le scénario avec un navigateur Chromium local.
   * Utilise le chemin résolu par checkAvailability, ou le résout à nouveau si nécessaire.
   */
  async execute(input: RealExecutionInput): Promise<RealExecutionResult> {
    const startTime = Date.now();
    const stepResults: StepExecutionResult[] = [];
    let stepsPassed = 0;
    let stepsFailed = 0;
    let hasFailed = false;

    // Résoudre le chemin si pas encore fait
    if (!this.resolvedExecutablePath) {
      const resolved = await resolveChromiumPath();
      if (resolved) {
        this.resolvedExecutablePath = resolved.path;
      }
    }

    const { chromium } = await import("playwright");

    let browser = null;
    let context = null;
    let page = null;

    try {
      console.log("[PlaywrightLocalRunner] Lancement du navigateur Chromium local...");
      if (this.resolvedExecutablePath) {
        console.log(`[PlaywrightLocalRunner] Chemin exécutable: ${this.resolvedExecutablePath}`);
      }

      browser = await chromium.launch({
        headless: input.config.headless !== false,
        // Utiliser le chemin résolu s'il est disponible
        ...(this.resolvedExecutablePath ? { executablePath: this.resolvedExecutablePath } : {}),
      });
      console.log("[PlaywrightLocalRunner] Navigateur lancé avec succès");

      context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        ignoreHTTPSErrors: true,
        ...(input.config.enableVideo ? { recordVideo: { dir: "/tmp/pw-videos" } } : {}),
      });

      page = await context.newPage();
      console.log("[PlaywrightLocalRunner] Page créée, début de l'exécution des étapes");

      // Exécuter chaque étape
      for (const step of input.steps) {
        if (hasFailed) {
          stepResults.push({
            index: step.index,
            action: step.action,
            target: step.target,
            status: "SKIPPED",
            durationMs: 0,
          });
          continue;
        }

        const stepStart = Date.now();
        try {
          await executeAction(page, step, {
            baseUrl: input.baseUrl,
            bindings: input.bindings,
            stepTimeout: input.config.timeoutMs,
          });
          const durationMs = Date.now() - stepStart;
          stepsPassed++;

          // Screenshot après l'étape
          let screenshotBuffer: Buffer | undefined;
          if (input.config.enableScreenshots !== false) {
            try {
              screenshotBuffer = (await page.screenshot({ type: "png", fullPage: false })) as Buffer;
            } catch {
              // Ignorer les erreurs de screenshot
            }
          }

          stepResults.push({
            index: step.index,
            action: step.action,
            target: step.target,
            status: "PASSED",
            durationMs,
            screenshotBuffer,
          });
        } catch (error: any) {
          const durationMs = Date.now() - stepStart;
          stepsFailed++;
          hasFailed = true;

          // Screenshot d'erreur
          let screenshotBuffer: Buffer | undefined;
          try {
            screenshotBuffer = (await page.screenshot({ type: "png", fullPage: false })) as Buffer;
          } catch {
            // Ignorer
          }

          stepResults.push({
            index: step.index,
            action: step.action,
            target: step.target,
            status: "FAILED",
            durationMs,
            error: error.message || String(error),
            screenshotBuffer,
          });
        }
      }
    } catch (error: any) {
      console.error("[PlaywrightLocalRunner] Erreur fatale:", error.message);
      return {
        status: "ERROR",
        durationMs: Date.now() - startTime,
        stepsTotal: input.steps.length,
        stepsPassed,
        stepsFailed: input.steps.length - stepsPassed,
        stepResults,
        resolvedRunnerMode: "LOCAL",
        fallbackUsed: false,
        errorCode: PLAYWRIGHT_ERROR_CODES.PLAYWRIGHT_LOCAL_LAUNCH_FAILED,
        errorMessage: error.message,
      };
    } finally {
      try { if (context) await context.close(); } catch { /* ignore */ }
      try { if (browser) await browser.close(); } catch { /* ignore */ }
    }

    const durationMs = Date.now() - startTime;
    const finalStatus = stepsFailed > 0 ? "FAILED" : "PASSED";

    return {
      status: finalStatus,
      durationMs,
      stepsTotal: input.steps.length,
      stepsPassed,
      stepsFailed,
      stepResults,
      resolvedRunnerMode: "LOCAL",
      fallbackUsed: false,
    };
  }
}
