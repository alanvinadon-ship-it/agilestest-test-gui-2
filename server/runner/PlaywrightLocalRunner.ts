/**
 * PlaywrightLocalRunner — Exécute les scénarios avec un navigateur Chromium local.
 *
 * Responsabilités :
 *   - Vérifier que Playwright et Chromium sont installés localement
 *   - Lancer le navigateur en mode headless
 *   - Exécuter chaque étape du scénario
 *   - Collecter screenshots, logs, erreurs
 */

import type {
  RealExecutionRunner,
  RealExecutionInput,
  RealExecutionResult,
  StepExecutionResult,
  RunnerAvailability,
  PlaywrightConfig,
} from "./playwrightConfig";
import { PLAYWRIGHT_ERROR_CODES } from "./playwrightConfig";
import { buildLocator, resolveBindingValue, executeAction } from "./playwrightActions";

export class PlaywrightLocalRunner implements RealExecutionRunner {
  readonly name = "PlaywrightLocalRunner";
  readonly mode = "LOCAL" as const;

  /**
   * Vérifie si Playwright et Chromium sont disponibles localement.
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

    // 2. Vérifier que le binaire Chromium existe
    try {
      const pw = await import("playwright");
      const executablePath = pw.chromium.executablePath();
      const fs = await import("fs");
      if (!fs.existsSync(executablePath)) {
        return {
          available: false,
          errorCode: PLAYWRIGHT_ERROR_CODES.PLAYWRIGHT_BROWSER_MISSING,
          message: `Le binaire Chromium n'existe pas à: ${executablePath}. Exécutez: npx playwright install chromium --with-deps`,
        };
      }
    } catch (err: any) {
      return {
        available: false,
        errorCode: PLAYWRIGHT_ERROR_CODES.PLAYWRIGHT_BROWSER_MISSING,
        message: `Impossible de vérifier le binaire Chromium: ${err.message}`,
      };
    }

    return { available: true };
  }

  /**
   * Exécute le scénario avec un navigateur Chromium local.
   */
  async execute(input: RealExecutionInput): Promise<RealExecutionResult> {
    const startTime = Date.now();
    const stepResults: StepExecutionResult[] = [];
    let stepsPassed = 0;
    let stepsFailed = 0;
    let hasFailed = false;

    const { chromium } = await import("playwright");

    let browser = null;
    let context = null;
    let page = null;

    try {
      console.log("[PlaywrightLocalRunner] Lancement du navigateur Chromium local...");
      browser = await chromium.launch({
        headless: input.config.headless !== false,
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
