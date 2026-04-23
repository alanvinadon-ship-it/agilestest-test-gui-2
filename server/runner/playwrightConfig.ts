/**
 * playwrightConfig.ts — Module de configuration centralisé pour le runner Playwright.
 *
 * Variables d'environnement supportées :
 *   PLAYWRIGHT_RUNNER_MODE   = LOCAL | REMOTE | AUTO   (défaut: AUTO)
 *   PLAYWRIGHT_REMOTE_ENDPOINT = ws://... ou wss://...
 *   PLAYWRIGHT_REMOTE_TOKEN  = token d'authentification Browserless
 *   PLAYWRIGHT_HEADLESS      = true | false             (défaut: true)
 *   PLAYWRIGHT_TIMEOUT_MS    = timeout par étape en ms   (défaut: 15000)
 *   PLAYWRIGHT_ENABLE_SCREENSHOTS = true | false        (défaut: true)
 *   PLAYWRIGHT_ENABLE_TRACE  = true | false             (défaut: false)
 *   PLAYWRIGHT_ENABLE_VIDEO  = true | false             (défaut: false)
 */

import type { ExecutionStep } from "../executionEngine";

// ─── Runner Mode ────────────────────────────────────────────────────────

export type RunnerMode = "LOCAL" | "REMOTE" | "AUTO";
export type RunnerType = "PLAYWRIGHT";
export type ExecutionMode = "SIMULATED" | "REAL";

// ─── Error Codes ────────────────────────────────────────────────────────

export const PLAYWRIGHT_ERROR_CODES = {
  PLAYWRIGHT_NOT_INSTALLED: "PLAYWRIGHT_NOT_INSTALLED",
  PLAYWRIGHT_BROWSER_MISSING: "PLAYWRIGHT_BROWSER_MISSING",
  PLAYWRIGHT_LOCAL_LAUNCH_FAILED: "PLAYWRIGHT_LOCAL_LAUNCH_FAILED",
  PLAYWRIGHT_REMOTE_ENDPOINT_MISSING: "PLAYWRIGHT_REMOTE_ENDPOINT_MISSING",
  PLAYWRIGHT_REMOTE_CONNECT_FAILED: "PLAYWRIGHT_REMOTE_CONNECT_FAILED",
  PLAYWRIGHT_SCRIPT_NOT_FOUND: "PLAYWRIGHT_SCRIPT_NOT_FOUND",
  PLAYWRIGHT_SCRIPT_INVALID: "PLAYWRIGHT_SCRIPT_INVALID",
  PLAYWRIGHT_EXECUTION_TIMEOUT: "PLAYWRIGHT_EXECUTION_TIMEOUT",
  PLAYWRIGHT_RUNTIME_ERROR: "PLAYWRIGHT_RUNTIME_ERROR",
  PLAYWRIGHT_NO_RUNNER_AVAILABLE: "PLAYWRIGHT_NO_RUNNER_AVAILABLE",
} as const;

export type PlaywrightErrorCode = (typeof PLAYWRIGHT_ERROR_CODES)[keyof typeof PLAYWRIGHT_ERROR_CODES];

/** Human-readable descriptions for each error code */
export const ERROR_CODE_DESCRIPTIONS: Record<PlaywrightErrorCode, string> = {
  PLAYWRIGHT_NOT_INSTALLED: "Le package Playwright n'est pas installé sur le serveur",
  PLAYWRIGHT_BROWSER_MISSING: "Le binaire Chromium n'est pas disponible localement",
  PLAYWRIGHT_LOCAL_LAUNCH_FAILED: "Échec du lancement du navigateur local",
  PLAYWRIGHT_REMOTE_ENDPOINT_MISSING: "Aucun endpoint distant (Browserless/CDP) n'est configuré",
  PLAYWRIGHT_REMOTE_CONNECT_FAILED: "Impossible de se connecter au navigateur distant",
  PLAYWRIGHT_SCRIPT_NOT_FOUND: "Le script de test est introuvable",
  PLAYWRIGHT_SCRIPT_INVALID: "Le script de test est invalide ou ne peut pas être chargé",
  PLAYWRIGHT_EXECUTION_TIMEOUT: "L'exécution a dépassé le timeout configuré",
  PLAYWRIGHT_RUNTIME_ERROR: "Erreur d'exécution Playwright",
  PLAYWRIGHT_NO_RUNNER_AVAILABLE: "Aucun runner disponible (ni LOCAL ni REMOTE)",
};

// ─── Configuration ──────────────────────────────────────────────────────

export interface PlaywrightConfig {
  /** Mode du runner : LOCAL, REMOTE, ou AUTO (défaut: AUTO) */
  runnerMode: RunnerMode;
  /** Endpoint WebSocket pour le navigateur distant (Browserless / CDP) */
  remoteEndpoint: string | null;
  /** Token d'authentification pour le service distant */
  remoteToken: string | null;
  /** Mode headless (défaut: true) */
  headless: boolean;
  /** Timeout par étape en ms (défaut: 15000) */
  timeoutMs: number;
  /** Activer les screenshots par étape (défaut: true) */
  enableScreenshots: boolean;
  /** Activer la trace Playwright (défaut: false) */
  enableTrace: boolean;
  /** Activer l'enregistrement vidéo (défaut: false) */
  enableVideo: boolean;
}

/**
 * Charge la configuration Playwright depuis les variables d'environnement.
 * Peut être overridée par des paramètres passés en argument.
 */
export function loadPlaywrightConfig(overrides?: Partial<PlaywrightConfig>): PlaywrightConfig {
  const envMode = (process.env.PLAYWRIGHT_RUNNER_MODE || "AUTO").toUpperCase();
  const validModes: RunnerMode[] = ["LOCAL", "REMOTE", "AUTO"];
  const runnerMode = validModes.includes(envMode as RunnerMode)
    ? (envMode as RunnerMode)
    : "AUTO";

  const config: PlaywrightConfig = {
    runnerMode,
    remoteEndpoint: process.env.PLAYWRIGHT_REMOTE_ENDPOINT || null,
    remoteToken: process.env.PLAYWRIGHT_REMOTE_TOKEN || null,
    headless: process.env.PLAYWRIGHT_HEADLESS !== "false",
    timeoutMs: parseInt(process.env.PLAYWRIGHT_TIMEOUT_MS || "15000", 10) || 15000,
    enableScreenshots: process.env.PLAYWRIGHT_ENABLE_SCREENSHOTS !== "false",
    enableTrace: process.env.PLAYWRIGHT_ENABLE_TRACE === "true",
    enableVideo: process.env.PLAYWRIGHT_ENABLE_VIDEO === "true",
  };

  if (overrides) {
    return { ...config, ...overrides };
  }

  return config;
}

// ─── DB-Aware Config Loader ─────────────────────────────────────────────

const DB_SETTING_KEYS = {
  runnerMode: "playwright_runner_mode",
  remoteEndpoint: "playwright_remote_endpoint",
  remoteToken: "playwright_remote_token",
  headless: "playwright_headless",
  timeoutMs: "playwright_timeout_ms",
  enableScreenshots: "playwright_enable_screenshots",
  enableTrace: "playwright_enable_trace",
  enableVideo: "playwright_enable_video",
} as const;

/**
 * Charge la configuration Playwright en mergeant env + DB settings.
 * Priorité : DB > env > défaut.
 * Utilisé par le moteur d'exécution pour obtenir la config effective.
 */
export async function loadPlaywrightConfigWithDb(): Promise<PlaywrightConfig> {
  const envConfig = loadPlaywrightConfig();

  try {
    const { getAppSettings } = await import("../db");
    const keys = Object.values(DB_SETTING_KEYS);
    const settings = await getAppSettings(keys);

    const validModes: RunnerMode[] = ["LOCAL", "REMOTE", "AUTO"];
    const dbMode = settings[DB_SETTING_KEYS.runnerMode]?.toUpperCase();

    return {
      runnerMode: dbMode && validModes.includes(dbMode as RunnerMode)
        ? (dbMode as RunnerMode)
        : envConfig.runnerMode,
      remoteEndpoint: settings[DB_SETTING_KEYS.remoteEndpoint] || envConfig.remoteEndpoint,
      remoteToken: settings[DB_SETTING_KEYS.remoteToken] || envConfig.remoteToken,
      headless: settings[DB_SETTING_KEYS.headless] !== undefined
        ? settings[DB_SETTING_KEYS.headless] !== "false"
        : envConfig.headless,
      timeoutMs: settings[DB_SETTING_KEYS.timeoutMs]
        ? parseInt(settings[DB_SETTING_KEYS.timeoutMs]!, 10) || envConfig.timeoutMs
        : envConfig.timeoutMs,
      enableScreenshots: settings[DB_SETTING_KEYS.enableScreenshots] !== undefined
        ? settings[DB_SETTING_KEYS.enableScreenshots] !== "false"
        : envConfig.enableScreenshots,
      enableTrace: settings[DB_SETTING_KEYS.enableTrace] === "true" || envConfig.enableTrace,
      enableVideo: settings[DB_SETTING_KEYS.enableVideo] === "true" || envConfig.enableVideo,
    };
  } catch (err) {
    console.warn("[PlaywrightConfig] Impossible de lire les settings DB, utilisation des env vars uniquement", err);
    return envConfig;
  }
}

// ─── Runner Interface ───────────────────────────────────────────────────

export interface RealExecutionInput {
  /** Étapes du scénario à exécuter */
  steps: (ExecutionStep & { locatorStrategy?: string })[];
  /** URL de base du site cible */
  baseUrl: string;
  /** Bindings résolus (ex: "users.email" → "john@example.com") */
  bindings: Record<string, string>;
  /** Configuration Playwright */
  config: PlaywrightConfig;
}

export interface StepExecutionResult {
  index: number;
  action: string;
  target: string;
  status: "PASSED" | "FAILED" | "SKIPPED";
  durationMs: number;
  error?: string;
  screenshotBuffer?: Buffer;
}

export interface RealExecutionResult {
  status: "PASSED" | "FAILED" | "ERROR";
  durationMs: number;
  stepsTotal: number;
  stepsPassed: number;
  stepsFailed: number;
  stepResults: StepExecutionResult[];
  /** Mode runner effectivement utilisé */
  resolvedRunnerMode: "LOCAL" | "REMOTE";
  /** Indique si un fallback a eu lieu (AUTO: LOCAL → REMOTE) */
  fallbackUsed: boolean;
  /** Endpoint distant utilisé (si REMOTE) */
  remoteEndpointUsed?: string;
  /** Code d'erreur standardisé (si échec) */
  errorCode?: PlaywrightErrorCode;
  /** Message d'erreur détaillé */
  errorMessage?: string;
}

/**
 * Interface abstraite pour les runners d'exécution réelle.
 * Implémentations : PlaywrightLocalRunner, PlaywrightRemoteRunner
 */
export interface RealExecutionRunner {
  /** Nom du runner pour le logging */
  readonly name: string;
  /** Mode du runner */
  readonly mode: "LOCAL" | "REMOTE";
  /**
   * Vérifie si le runner est disponible (navigateur installé, endpoint accessible, etc.)
   * Retourne { available: true } ou { available: false, errorCode, message }
   */
  checkAvailability(): Promise<RunnerAvailability>;
  /**
   * Exécute le scénario et retourne les résultats détaillés.
   */
  execute(input: RealExecutionInput): Promise<RealExecutionResult>;
}

export interface RunnerAvailability {
  available: boolean;
  errorCode?: PlaywrightErrorCode;
  message?: string;
}

// ─── Diagnostic Info ────────────────────────────────────────────────────

export interface RunnerDiagnostic {
  configuredMode: RunnerMode;
  resolvedMode: "LOCAL" | "REMOTE" | null;
  fallbackUsed: boolean;
  localAvailable: boolean;
  localMessage?: string;
  remoteAvailable: boolean;
  remoteMessage?: string;
  remoteEndpoint?: string;
}
