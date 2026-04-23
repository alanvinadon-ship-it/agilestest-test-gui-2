/**
 * PlaywrightLocalRunner — Exécute les scénarios avec un navigateur Chromium local.
 *
 * Détection Chromium multi-chemins :
 *   1. Variable d'environnement PLAYWRIGHT_CHROMIUM_PATH (override explicite)
 *   2. Chemin par défaut Playwright (pw.chromium.executablePath())
 *   3. Chromium système (/usr/bin/chromium, /usr/bin/chromium-browser, /usr/bin/google-chrome)
 *
 * En production (Docker/déploiement), le cache Playwright peut ne pas exister
 * sous /root/.cache/ms-playwright/. Le fallback système résout ce problème.
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

export class PlaywrightLocalRunner implements RealExecutionRunner {
  readonly name = "PlaywrightLocalRunner";
  readonly mode = "LOCAL" as const;

  /** Chemin résolu du binaire Chromium (mis en cache après checkAvailability) */
  private resolvedExecutablePath: string | null = null;

  /**
   * Vérifie si Playwright et Chromium sont disponibles localement.
   * Essaie plusieurs sources pour trouver un binaire Chromium valide.
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
    const resolved = await resolveChromiumPath();
    if (!resolved) {
      // Construire un message d'aide avec le chemin Playwright attendu
      let expectedPath = "inconnu";
      try {
        const pw = await import("playwright");
        expectedPath = pw.chromium.executablePath();
      } catch { /* ignore */ }

      return {
        available: false,
        errorCode: PLAYWRIGHT_ERROR_CODES.PLAYWRIGHT_BROWSER_MISSING,
        message: `Aucun binaire Chromium trouvé. Chemin Playwright attendu: ${expectedPath}. `
          + `Chemins système vérifiés: ${SYSTEM_CHROMIUM_PATHS.join(", ")}. `
          + `Solutions: (1) npx playwright install chromium --with-deps, `
          + `(2) apt-get install chromium, `
          + `(3) définir PLAYWRIGHT_CHROMIUM_PATH=/chemin/vers/chrome`,
      };
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
        // Utiliser le chemin résolu s'il diffère du défaut Playwright
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
