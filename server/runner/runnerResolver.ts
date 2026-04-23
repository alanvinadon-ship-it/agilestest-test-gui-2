/**
 * runnerResolver.ts — Factory/resolver pour résoudre le runner d'exécution.
 *
 * Logique de résolution :
 *   - LOCAL  → essayer PlaywrightLocalRunner uniquement
 *   - REMOTE → essayer PlaywrightRemoteRunner uniquement
 *   - AUTO   → essayer LOCAL, puis fallback REMOTE si indisponible
 *
 * Retourne un diagnostic complet de la résolution pour le logging.
 */

import type {
  PlaywrightConfig,
  RealExecutionRunner,
  RunnerDiagnostic,
  PlaywrightErrorCode,
} from "./playwrightConfig";
import { PLAYWRIGHT_ERROR_CODES, ERROR_CODE_DESCRIPTIONS } from "./playwrightConfig";
import { PlaywrightLocalRunner } from "./PlaywrightLocalRunner";
import { PlaywrightRemoteRunner } from "./PlaywrightRemoteRunner";

export interface ResolverResult {
  runner: RealExecutionRunner | null;
  diagnostic: RunnerDiagnostic;
  errorCode?: PlaywrightErrorCode;
  errorMessage?: string;
}

/**
 * Résout le runner d'exécution en fonction de la configuration.
 * Retourne le runner à utiliser et un diagnostic complet.
 */
export async function resolveRunner(config: PlaywrightConfig): Promise<ResolverResult> {
  const diagnostic: RunnerDiagnostic = {
    configuredMode: config.runnerMode,
    resolvedMode: null,
    fallbackUsed: false,
    localAvailable: false,
    remoteAvailable: false,
  };

  const localRunner = new PlaywrightLocalRunner();
  const remoteRunner = new PlaywrightRemoteRunner(config.remoteEndpoint || "", config.remoteToken);

  // ─── Mode LOCAL ─────────────────────────────────────────────────────
  if (config.runnerMode === "LOCAL") {
    console.log("[RunnerResolver] Mode configuré: LOCAL — vérification du navigateur local...");
    const localCheck = await localRunner.checkAvailability();
    diagnostic.localAvailable = localCheck.available;
    diagnostic.localMessage = localCheck.message;

    if (localCheck.available) {
      console.log("[RunnerResolver] Navigateur local disponible ✓");
      diagnostic.resolvedMode = "LOCAL";
      return { runner: localRunner, diagnostic };
    }

    console.error(`[RunnerResolver] Navigateur local indisponible: ${localCheck.message}`);
    return {
      runner: null,
      diagnostic,
      errorCode: localCheck.errorCode || PLAYWRIGHT_ERROR_CODES.PLAYWRIGHT_BROWSER_MISSING,
      errorMessage: localCheck.message || ERROR_CODE_DESCRIPTIONS.PLAYWRIGHT_BROWSER_MISSING,
    };
  }

  // ─── Mode REMOTE ────────────────────────────────────────────────────
  if (config.runnerMode === "REMOTE") {
    console.log("[RunnerResolver] Mode configuré: REMOTE — vérification de l'endpoint distant...");

    if (!config.remoteEndpoint) {
      console.error("[RunnerResolver] Aucun endpoint distant configuré");
      return {
        runner: null,
        diagnostic,
        errorCode: PLAYWRIGHT_ERROR_CODES.PLAYWRIGHT_REMOTE_ENDPOINT_MISSING,
        errorMessage: "Variable PLAYWRIGHT_REMOTE_ENDPOINT non configurée. Configurez l'endpoint Browserless/CDP dans Paramètres > Runner.",
      };
    }

    diagnostic.remoteEndpoint = config.remoteEndpoint;
    const remoteCheck = await remoteRunner.checkAvailability();
    diagnostic.remoteAvailable = remoteCheck.available;
    diagnostic.remoteMessage = remoteCheck.message;

    if (remoteCheck.available) {
      console.log(`[RunnerResolver] Runner distant disponible ✓ (endpoint: ${config.remoteEndpoint})`);
      diagnostic.resolvedMode = "REMOTE";
      return { runner: remoteRunner, diagnostic };
    }

    console.error(`[RunnerResolver] Runner distant indisponible: ${remoteCheck.message}`);
    return {
      runner: null,
      diagnostic,
      errorCode: remoteCheck.errorCode || PLAYWRIGHT_ERROR_CODES.PLAYWRIGHT_REMOTE_CONNECT_FAILED,
      errorMessage: remoteCheck.message,
    };
  }

  // ─── Mode AUTO ──────────────────────────────────────────────────────
  console.log("[RunnerResolver] Mode configuré: AUTO — tentative LOCAL puis fallback REMOTE...");

  // 1. Essayer LOCAL
  const localCheck = await localRunner.checkAvailability();
  diagnostic.localAvailable = localCheck.available;
  diagnostic.localMessage = localCheck.message;

  if (localCheck.available) {
    console.log("[RunnerResolver] AUTO → Navigateur local disponible ✓ → utilisation LOCAL");
    diagnostic.resolvedMode = "LOCAL";
    return { runner: localRunner, diagnostic };
  }

  console.log(`[RunnerResolver] AUTO → Local indisponible (${localCheck.message}), tentative REMOTE...`);

  // 2. Fallback REMOTE
  if (!config.remoteEndpoint) {
    console.error("[RunnerResolver] AUTO → Aucun endpoint distant configuré → échec");
    return {
      runner: null,
      diagnostic,
      errorCode: PLAYWRIGHT_ERROR_CODES.PLAYWRIGHT_NO_RUNNER_AVAILABLE,
      errorMessage: `Navigateur local indisponible (${localCheck.message}). Aucun endpoint distant configuré. Configurez PLAYWRIGHT_REMOTE_ENDPOINT ou installez Chromium localement.`,
    };
  }

  diagnostic.remoteEndpoint = config.remoteEndpoint;
  const remoteCheck = await remoteRunner.checkAvailability();
  diagnostic.remoteAvailable = remoteCheck.available;
  diagnostic.remoteMessage = remoteCheck.message;

  if (remoteCheck.available) {
    console.log(`[RunnerResolver] AUTO → Fallback REMOTE réussi ✓ (endpoint: ${config.remoteEndpoint})`);
    diagnostic.resolvedMode = "REMOTE";
    diagnostic.fallbackUsed = true;
    return { runner: remoteRunner, diagnostic };
  }

  console.error(`[RunnerResolver] AUTO → REMOTE aussi indisponible: ${remoteCheck.message}`);
  return {
    runner: null,
    diagnostic,
    errorCode: PLAYWRIGHT_ERROR_CODES.PLAYWRIGHT_NO_RUNNER_AVAILABLE,
    errorMessage: `Aucun runner disponible. Local: ${localCheck.message}. Remote: ${remoteCheck.message}`,
  };
}

/**
 * Formate le diagnostic en lignes de log lisibles pour le journal d'exécution.
 */
export function formatDiagnosticLogs(diagnostic: RunnerDiagnostic): string[] {
  const lines: string[] = [];
  lines.push(`Mode configuré: ${diagnostic.configuredMode}`);

  if (diagnostic.localAvailable) {
    lines.push("Navigateur local: ✓ disponible");
  } else if (diagnostic.localMessage) {
    lines.push(`Navigateur local: ✗ ${diagnostic.localMessage}`);
  }

  if (diagnostic.remoteEndpoint) {
    lines.push(`Endpoint distant: ${diagnostic.remoteEndpoint}`);
    if (diagnostic.remoteAvailable) {
      lines.push("Connexion distante: ✓ disponible");
    } else if (diagnostic.remoteMessage) {
      lines.push(`Connexion distante: ✗ ${diagnostic.remoteMessage}`);
    }
  }

  if (diagnostic.resolvedMode) {
    lines.push(`Mode résolu: ${diagnostic.resolvedMode}`);
  }

  if (diagnostic.fallbackUsed) {
    lines.push("⚠ Fallback LOCAL → REMOTE utilisé");
  }

  return lines;
}
