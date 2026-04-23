/**
 * PlaywrightRemoteRunner — Exécute les scénarios via un navigateur distant (Browserless / CDP).
 *
 * Responsabilités :
 *   - Vérifier que l'endpoint distant est configuré et accessible
 *   - Se connecter au navigateur distant via CDP WebSocket
 *   - Exécuter chaque étape du scénario
 *   - Collecter screenshots, logs, erreurs
 *
 * Compatible avec :
 *   - Browserless (ws://host:port?token=xxx)
 *   - Chrome DevTools Protocol (ws://host:port/devtools/browser/xxx)
 *   - Tout service exposant un endpoint CDP WebSocket
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

export class PlaywrightRemoteRunner implements RealExecutionRunner {
  readonly name = "PlaywrightRemoteRunner";
  readonly mode = "REMOTE" as const;

  constructor(private endpoint: string, private token: string | null) {}

  /**
   * Vérifie que l'endpoint distant est configuré et accessible.
   */
  async checkAvailability(): Promise<RunnerAvailability> {
    // 1. Vérifier que le module Playwright est importable (nécessaire même en REMOTE)
    try {
      await import("playwright");
    } catch {
      return {
        available: false,
        errorCode: PLAYWRIGHT_ERROR_CODES.PLAYWRIGHT_NOT_INSTALLED,
        message: "Le package Playwright est nécessaire même en mode REMOTE (pour le client CDP)",
      };
    }

    // 2. Vérifier que l'endpoint est configuré
    if (!this.endpoint || !this.endpoint.trim()) {
      return {
        available: false,
        errorCode: PLAYWRIGHT_ERROR_CODES.PLAYWRIGHT_REMOTE_ENDPOINT_MISSING,
        message: "Aucun endpoint distant configuré (PLAYWRIGHT_REMOTE_ENDPOINT)",
      };
    }

    // 3. Tester la connexion au endpoint distant
    try {
      const { chromium } = await import("playwright");
      const wsUrl = this.buildEndpointUrl(this.endpoint, this.token);
      const browser = await chromium.connectOverCDP(wsUrl, { timeout: 5000 });
      await browser.close();
      return { available: true, message: `Connecté à ${this.endpoint}` };
    } catch (err: any) {
      return {
        available: false,
        errorCode: PLAYWRIGHT_ERROR_CODES.PLAYWRIGHT_REMOTE_CONNECT_FAILED,
        message: `Connexion échouée à ${this.endpoint}: ${err.message || err}`,
      };
    }
  }

  /**
   * Construit l'URL WebSocket complète avec le token si nécessaire.
   */
  private buildEndpointUrl(endpoint: string, token: string | null): string {
    if (!token) return endpoint;

    // Si l'endpoint contient déjà un query param, ajouter avec &
    const separator = endpoint.includes("?") ? "&" : "?";
    return `${endpoint}${separator}token=${encodeURIComponent(token)}`;
  }

  /**
   * Exécute le scénario via un navigateur distant.
   */
  async execute(input: RealExecutionInput): Promise<RealExecutionResult> {
    const startTime = Date.now();
    const stepResults: StepExecutionResult[] = [];
    let stepsPassed = 0;
    let stepsFailed = 0;
    let hasFailed = false;

    const endpoint = input.config.remoteEndpoint;
    if (!endpoint) {
      return {
        status: "ERROR",
        durationMs: Date.now() - startTime,
        stepsTotal: input.steps.length,
        stepsPassed: 0,
        stepsFailed: input.steps.length,
        stepResults: [],
        resolvedRunnerMode: "REMOTE",
        fallbackUsed: false,
        errorCode: PLAYWRIGHT_ERROR_CODES.PLAYWRIGHT_REMOTE_ENDPOINT_MISSING,
        errorMessage: "Aucun endpoint distant configuré (PLAYWRIGHT_REMOTE_ENDPOINT)",
      };
    }

    const wsEndpoint = this.buildEndpointUrl(endpoint, input.config.remoteToken);
    const { chromium } = await import("playwright");

    let browser = null;
    let context = null;
    let page = null;

    try {
      console.log(`[PlaywrightRemoteRunner] Connexion au navigateur distant: ${endpoint}`);
      browser = await chromium.connectOverCDP(wsEndpoint, {
        timeout: 30000,
      });
      console.log("[PlaywrightRemoteRunner] Connexion CDP établie avec succès");

      // Utiliser le contexte par défaut ou en créer un nouveau
      const contexts = browser.contexts();
      context = contexts.length > 0 ? contexts[0] : await browser.newContext({
        viewport: { width: 1280, height: 720 },
        ignoreHTTPSErrors: true,
      });

      page = await context.newPage();
      console.log("[PlaywrightRemoteRunner] Page créée, début de l'exécution des étapes");

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
              // Les screenshots peuvent ne pas être disponibles en REMOTE
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
      console.error("[PlaywrightRemoteRunner] Erreur fatale:", error.message);

      const isConnectionError =
        error.message?.includes("connect") ||
        error.message?.includes("ECONNREFUSED") ||
        error.message?.includes("timeout") ||
        error.message?.includes("WebSocket");

      return {
        status: "ERROR",
        durationMs: Date.now() - startTime,
        stepsTotal: input.steps.length,
        stepsPassed,
        stepsFailed: input.steps.length - stepsPassed,
        stepResults,
        resolvedRunnerMode: "REMOTE",
        fallbackUsed: false,
        remoteEndpointUsed: endpoint,
        errorCode: isConnectionError
          ? PLAYWRIGHT_ERROR_CODES.PLAYWRIGHT_REMOTE_CONNECT_FAILED
          : PLAYWRIGHT_ERROR_CODES.PLAYWRIGHT_RUNTIME_ERROR,
        errorMessage: error.message,
      };
    } finally {
      // En mode REMOTE, on ferme la page et le contexte mais pas le browser (géré par le service distant)
      try { if (page) await page.close(); } catch { /* ignore */ }
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
      resolvedRunnerMode: "REMOTE",
      fallbackUsed: false,
      remoteEndpointUsed: endpoint,
    };
  }
}
