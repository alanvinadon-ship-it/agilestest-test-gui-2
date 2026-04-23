/**
 * executionEngine.ts — Moteur d'exécution AgilesTest
 *
 * Mode SIMULATED: Simulation fonctionnelle (100% succès)
 *   - Transitions automatiques PENDING → RUNNING → PASSED/FAILED
 *   - Logs pas-à-pas avec timestamps
 *   - Durée simulée réaliste basée sur les étapes du scénario
 *
 * Mode REAL: Architecture LOCAL / REMOTE / AUTO
 *   - LOCAL  : Playwright + navigateur Chromium local
 *   - REMOTE : Connexion CDP à Browserless / service distant
 *   - AUTO   : LOCAL avec fallback REMOTE si indisponible
 *   - Résolution des bindings de dataset
 *   - Collecte d'artefacts (screenshots par étape)
 *   - Journalisation détaillée avec codes d'erreur standardisés
 */

import { getDb } from "./db";
import {
  executions,
  executionLogs,
  testScenarios,
  testProfiles,
  artifacts,
  generatedScripts,
} from "../drizzle/schema";
import { eq, or, sql } from "drizzle-orm";
import { notifyOwner } from "./_core/notification";
import { resolveBindings } from "./datasetResolver";
import { storagePut } from "./storage";
import {
  loadPlaywrightConfig,
  loadPlaywrightConfigWithDb,
  PLAYWRIGHT_ERROR_CODES,
  ERROR_CODE_DESCRIPTIONS,
  type PlaywrightConfig,
  type PlaywrightErrorCode,
  type RealExecutionResult,
  type StepExecutionResult,
} from "./runner/playwrightConfig";
import { resolveRunner, formatDiagnosticLogs } from "./runner/runnerResolver";

// ─── Types ───────────────────────────────────────────────────────────────

export type ExecutionMode = "SIMULATED" | "REAL";

export interface ExecutionStep {
  index: number;
  action: string;
  target: string;
  description: string;
  inputBinding?: string;
  locatorStrategy?: string;
}

export interface ExecutionResult {
  status: "PASSED" | "FAILED" | "ERROR";
  durationMs: number;
  stepsTotal: number;
  stepsPassed: number;
  stepsFailed: number;
  /** Mode runner effectivement utilisé (REAL uniquement) */
  resolvedRunnerMode?: "LOCAL" | "REMOTE";
  /** Fallback LOCAL → REMOTE a eu lieu */
  fallbackUsed?: boolean;
  /** Code d'erreur standardisé */
  errorCode?: PlaywrightErrorCode;
  /** Message d'erreur détaillé */
  errorMessage?: string;
}

// ─── Log Helper ──────────────────────────────────────────────────────────

async function insertLog(
  db: any,
  executionId: number,
  stepIndex: number,
  level: "INFO" | "WARN" | "ERROR" | "DEBUG" | "STEP",
  message: string,
  detail?: Record<string, unknown>,
) {
  await db.insert(executionLogs).values({
    uid: crypto.randomUUID(),
    executionId,
    stepIndex,
    level,
    message,
    detail: detail ?? null,
  });
}

// ─── Artifact Helper ────────────────────────────────────────────────────

/**
 * Upload un screenshot vers S3 et enregistre l'artefact en DB.
 */
async function saveScreenshotArtifact(
  db: any,
  executionId: number,
  executionUid: string,
  stepIndex: number,
  screenshotBuffer: Buffer,
  status: "PASSED" | "FAILED" | "SKIPPED",
): Promise<string | null> {
  try {
    const suffix = crypto.randomUUID().slice(0, 8);
    const filename = `exec-${executionUid}/step-${stepIndex}-${status.toLowerCase()}-${suffix}.png`;
    const key = `screenshots/${filename}`;
    const { url } = await storagePut(key, screenshotBuffer, "image/png");

    await db.insert(artifacts).values({
      uid: crypto.randomUUID(),
      executionId: String(executionId),
      type: "screenshot",
      filename: `step-${stepIndex}-${status.toLowerCase()}.png`,
      name: `Étape ${stepIndex} — ${status}`,
      mimeType: "image/png",
      contentType: "image/png",
      sizeBytes: screenshotBuffer.length,
      storagePath: key,
      storageUrl: url,
      downloadUrl: url,
      uploadedAt: new Date(),
    });

    return url;
  } catch (err) {
    // Non bloquant — on continue même si le screenshot échoue
    return null;
  }
}

// ─── Simulation Engine ───────────────────────────────────────────────────

/**
 * Simule l'exécution d'un scénario pas-à-pas.
 * 100% de succès sauf si forceFailAtStep est défini.
 */
async function simulateExecution(
  db: any,
  executionId: number,
  steps: ExecutionStep[],
  options?: { forceFailAtStep?: number },
): Promise<ExecutionResult> {
  const startTime = Date.now();
  let stepsPassed = 0;
  let stepsFailed = 0;
  let finalStatus: "PASSED" | "FAILED" = "PASSED";

  await insertLog(db, executionId, 0, "INFO", "🚀 Démarrage de la simulation", {
    mode: "SIMULATED",
    stepsCount: steps.length,
    timestamp: new Date().toISOString(),
  });

  for (const step of steps) {
    const delay = getActionDelay(step.action);
    await sleep(delay);

    const shouldFail = options?.forceFailAtStep === step.index;
    const stepSuccess = shouldFail ? false : true;

    if (stepSuccess) {
      stepsPassed++;
      await insertLog(db, executionId, step.index, "STEP", `✅ Étape ${step.index}: ${step.action} → ${step.target}`, {
        action: step.action,
        target: step.target,
        description: step.description,
        binding: step.inputBinding || null,
        durationMs: delay,
        result: "PASSED",
      });

      await db.update(executions).set({
        stepsPassed,
        stepsTotal: steps.length,
      }).where(eq(executions.id, executionId));
    } else {
      stepsFailed++;
      finalStatus = "FAILED";
      await insertLog(db, executionId, step.index, "ERROR", `❌ Étape ${step.index}: ${step.action} → ${step.target} — ÉCHEC`, {
        action: step.action,
        target: step.target,
        description: step.description,
        binding: step.inputBinding || null,
        durationMs: delay,
        result: "FAILED",
        error: shouldFail
          ? "Échec forcé pour test"
          : `Element not found: ${step.target} (timeout 5000ms)`,
      });

      await db.update(executions).set({
        stepsFailed,
        stepsTotal: steps.length,
      }).where(eq(executions.id, executionId));

      for (let i = step.index + 1; i <= steps.length; i++) {
        const skippedStep = steps.find(s => s.index === i);
        if (skippedStep) {
          await insertLog(db, executionId, i, "WARN", `⏭️ Étape ${i}: ${skippedStep.action} → ${skippedStep.target} — IGNORÉE (échec précédent)`, {
            action: skippedStep.action,
            target: skippedStep.target,
            result: "SKIPPED",
          });
        }
      }
      break;
    }
  }

  const durationMs = Date.now() - startTime;

  await insertLog(db, executionId, 0, "INFO", `🏁 Simulation terminée — ${finalStatus}`, {
    durationMs,
    stepsTotal: steps.length,
    stepsPassed,
    stepsFailed,
    stepsSkipped: steps.length - stepsPassed - stepsFailed,
    finalStatus,
  });

  return {
    status: finalStatus,
    durationMs,
    stepsTotal: steps.length,
    stepsPassed,
    stepsFailed,
  };
}

// ─── Real Execution Engine (Playwright LOCAL/REMOTE/AUTO) ───────────────

/**
 * Exécute un scénario en mode RÉEL avec Playwright.
 * - Résout le runner (LOCAL/REMOTE/AUTO) via le resolver
 * - Résout les bindings de dataset
 * - Exécute via le runner résolu
 * - Collecte les screenshots et les enregistre comme artefacts
 * - Journalise chaque étape avec diagnostic complet
 */
async function realExecution(
  db: any,
  executionId: number,
  executionUid: string,
  steps: ExecutionStep[],
  profileId?: string,
  datasetBundleId?: string,
  projectId?: string,
): Promise<ExecutionResult> {
  const startTime = Date.now();

  // 1. Charger la configuration Playwright
  const config = await loadPlaywrightConfigWithDb();
  console.log(`[ExecutionEngine] REAL execution #${executionId} — mode configuré: ${config.runnerMode}`);

  await insertLog(db, executionId, 0, "INFO", `⚙️ Configuration runner Playwright`, {
    runnerMode: config.runnerMode,
    remoteEndpoint: config.remoteEndpoint || "(non configuré)",
    headless: config.headless,
    timeoutMs: config.timeoutMs,
    enableScreenshots: config.enableScreenshots,
    enableTrace: config.enableTrace,
    enableVideo: config.enableVideo,
  });

  // 2. Résoudre le runner (LOCAL/REMOTE/AUTO avec fallback)
  await insertLog(db, executionId, 0, "INFO", `🔍 Résolution du runner (mode: ${config.runnerMode})...`);

  const { runner, diagnostic, errorCode, errorMessage } = await resolveRunner(config);

  // Journaliser le diagnostic complet
  const diagLines = formatDiagnosticLogs(diagnostic);
  for (const line of diagLines) {
    await insertLog(db, executionId, 0, "DEBUG", `  📋 ${line}`, { diagnostic: true });
  }

  // Si aucun runner disponible → échec immédiat
  if (!runner) {
    console.error(`[ExecutionEngine] No runner available for execution #${executionId}: ${errorCode} — ${errorMessage}`);

    await insertLog(db, executionId, 0, "ERROR", `💥 Aucun runner disponible — ${errorCode}`, {
      errorCode,
      errorMessage,
      diagnostic,
      hint: getHintForErrorCode(errorCode),
    });

    // Marquer chaque étape comme FAILED
    for (const step of steps) {
      await insertLog(db, executionId, step.index, "ERROR",
        `❌ Étape ${step.index}: ${step.action} → ${step.target} — ÉCHEC (${errorCode})`, {
          action: step.action,
          target: step.target,
          result: "FAILED",
          errorCode,
        });
    }

    // Mettre à jour l'exécution avec le code d'erreur
    await db.update(executions).set({
      runnerMode: diagnostic.resolvedMode || config.runnerMode,
      runnerType: "PLAYWRIGHT",
      errorCode: errorCode || null,
      errorMessage: errorMessage || null,
    }).where(eq(executions.id, executionId));

    return {
      status: "ERROR",
      durationMs: Date.now() - startTime,
      stepsTotal: steps.length,
      stepsPassed: 0,
      stepsFailed: steps.length,
      errorCode,
      errorMessage,
    };
  }

  // Runner résolu avec succès
  const resolvedMode = runner.mode;
  console.log(`[ExecutionEngine] Runner résolu: ${runner.name} (mode: ${resolvedMode}, fallback: ${diagnostic.fallbackUsed})`);

  await insertLog(db, executionId, 0, "INFO",
    `✅ Runner résolu: ${resolvedMode}${diagnostic.fallbackUsed ? " (fallback depuis LOCAL)" : ""}`, {
      runnerName: runner.name,
      resolvedMode,
      fallbackUsed: diagnostic.fallbackUsed,
      remoteEndpoint: diagnostic.remoteEndpoint || null,
    });

  // Mettre à jour l'exécution avec le runner info
  await db.update(executions).set({
    runnerMode: resolvedMode,
    runnerType: "PLAYWRIGHT",
  }).where(eq(executions.id, executionId));

  // 3. Résoudre les bindings de dataset
  await insertLog(db, executionId, 0, "INFO", "🔗 Résolution des bindings de dataset et profil...", {
    profileId: profileId || null,
    datasetBundleId: datasetBundleId || null,
  });

  const { bindings, baseUrl, warnings } = await resolveBindings(profileId, datasetBundleId, projectId);

  if (warnings.length > 0) {
    await insertLog(db, executionId, 0, "WARN", `⚠️ Avertissements de résolution: ${warnings.join("; ")}`, {
      warnings,
    });
  }

  if (!baseUrl) {
    await insertLog(db, executionId, 0, "WARN", "⚠️ Aucune URL de base trouvée dans le profil — les URLs NAVIGATE doivent être absolues", {
      bindings: Object.keys(bindings),
    });
  }

  await insertLog(db, executionId, 0, "INFO", `🚀 Démarrage de l'exécution RÉELLE (${runner.name})`, {
    mode: "REAL",
    runnerMode: resolvedMode,
    runnerName: runner.name,
    stepsCount: steps.length,
    baseUrl: baseUrl || "(non défini)",
    bindingsCount: Object.keys(bindings).length,
    bindingKeys: Object.keys(bindings),
    timestamp: new Date().toISOString(),
  });

  // 4. Exécuter via le runner résolu
  let result: RealExecutionResult;
  try {
    result = await runner.execute({
      steps,
      baseUrl: baseUrl || "",
      bindings,
      config,
    });
  } catch (error: any) {
    console.error(`[ExecutionEngine] ${runner.name} fatal error:`, error.message, error.stack?.slice(0, 500));

    const detectedCode = detectErrorCode(error);
    const userMessage = `💥 Erreur ${runner.name}: ${error.message}`;

    await insertLog(db, executionId, 0, "ERROR", userMessage, {
      errorCode: detectedCode,
      error: error.message,
      stack: error.stack?.slice(0, 500),
      runnerMode: resolvedMode,
      hint: getHintForErrorCode(detectedCode),
    });

    // Marquer chaque étape comme FAILED
    for (const step of steps) {
      await insertLog(db, executionId, step.index, "ERROR",
        `❌ Étape ${step.index}: ${step.action} → ${step.target} — ÉCHEC (${detectedCode})`, {
          action: step.action,
          target: step.target,
          result: "FAILED",
          errorCode: detectedCode,
        });
    }

    await db.update(executions).set({
      errorCode: detectedCode,
      errorMessage: error.message,
    }).where(eq(executions.id, executionId));

    return {
      status: "ERROR",
      durationMs: Date.now() - startTime,
      stepsTotal: steps.length,
      stepsPassed: 0,
      stepsFailed: steps.length,
      resolvedRunnerMode: resolvedMode,
      fallbackUsed: diagnostic.fallbackUsed,
      errorCode: detectedCode,
      errorMessage: error.message,
    };
  }

  // 5. Enregistrer les logs et artefacts pour chaque étape
  let artifactsCount = 0;
  for (const stepResult of result.stepResults) {
    if (stepResult.status === "PASSED") {
      await insertLog(db, executionId, stepResult.index, "STEP",
        `✅ Étape ${stepResult.index}: ${stepResult.action} → ${stepResult.target}`, {
          action: stepResult.action,
          target: stepResult.target,
          durationMs: stepResult.durationMs,
          result: "PASSED",
        });
    } else if (stepResult.status === "FAILED") {
      await insertLog(db, executionId, stepResult.index, "ERROR",
        `❌ Étape ${stepResult.index}: ${stepResult.action} → ${stepResult.target} — ÉCHEC`, {
          action: stepResult.action,
          target: stepResult.target,
          durationMs: stepResult.durationMs,
          result: "FAILED",
          error: stepResult.error,
        });
    } else {
      await insertLog(db, executionId, stepResult.index, "WARN",
        `⏭️ Étape ${stepResult.index}: ${stepResult.action} → ${stepResult.target} — IGNORÉE (échec précédent)`, {
          action: stepResult.action,
          target: stepResult.target,
          result: "SKIPPED",
        });
    }

    // Sauvegarder le screenshot comme artefact
    if (stepResult.screenshotBuffer) {
      const url = await saveScreenshotArtifact(
        db, executionId, executionUid, stepResult.index,
        stepResult.screenshotBuffer, stepResult.status,
      );
      if (url) artifactsCount++;
    }

    // Mettre à jour les compteurs en temps réel
    await db.update(executions).set({
      stepsPassed: result.stepResults.filter(s => s.status === "PASSED" && s.index <= stepResult.index).length,
      stepsFailed: result.stepResults.filter(s => s.status === "FAILED" && s.index <= stepResult.index).length,
      stepsTotal: steps.length,
      artifactsCount,
    }).where(eq(executions.id, executionId));
  }

  const durationMs = Date.now() - startTime;

  // Mettre à jour les infos runner dans l'exécution
  await db.update(executions).set({
    errorCode: result.errorCode || null,
    errorMessage: result.errorMessage || null,
  }).where(eq(executions.id, executionId));

  await insertLog(db, executionId, 0, "INFO", `🏁 Exécution RÉELLE terminée — ${result.status}`, {
    durationMs,
    stepsTotal: steps.length,
    stepsPassed: result.stepsPassed,
    stepsFailed: result.stepsFailed,
    stepsSkipped: steps.length - result.stepsPassed - result.stepsFailed,
    artifactsCount,
    finalStatus: result.status,
    runnerMode: resolvedMode,
    fallbackUsed: diagnostic.fallbackUsed,
    remoteEndpoint: result.remoteEndpointUsed || null,
  });

  return {
    status: result.status,
    durationMs,
    stepsTotal: steps.length,
    stepsPassed: result.stepsPassed,
    stepsFailed: result.stepsFailed,
    resolvedRunnerMode: resolvedMode,
    fallbackUsed: diagnostic.fallbackUsed,
    errorCode: result.errorCode,
    errorMessage: result.errorMessage,
  };
}

// ─── Error Detection Helpers ────────────────────────────────────────────

function detectErrorCode(error: any): PlaywrightErrorCode {
  const msg = (error.message || "").toLowerCase();
  if (msg.includes("executable doesn't exist") || msg.includes("enoent") || msg.includes("chromium")) {
    return PLAYWRIGHT_ERROR_CODES.PLAYWRIGHT_BROWSER_MISSING;
  }
  if (msg.includes("playwright") && msg.includes("install")) {
    return PLAYWRIGHT_ERROR_CODES.PLAYWRIGHT_NOT_INSTALLED;
  }
  if (msg.includes("connect") || msg.includes("econnrefused") || msg.includes("websocket")) {
    return PLAYWRIGHT_ERROR_CODES.PLAYWRIGHT_REMOTE_CONNECT_FAILED;
  }
  if (msg.includes("timeout")) {
    return PLAYWRIGHT_ERROR_CODES.PLAYWRIGHT_EXECUTION_TIMEOUT;
  }
  return PLAYWRIGHT_ERROR_CODES.PLAYWRIGHT_RUNTIME_ERROR;
}

function getHintForErrorCode(code?: PlaywrightErrorCode): string | undefined {
  if (!code) return undefined;
  const hints: Partial<Record<PlaywrightErrorCode, string>> = {
    PLAYWRIGHT_NOT_INSTALLED: "Installez Playwright: npm install playwright",
    PLAYWRIGHT_BROWSER_MISSING: "Installez Chromium: npx playwright install chromium --with-deps",
    PLAYWRIGHT_LOCAL_LAUNCH_FAILED: "Vérifiez les permissions et les dépendances système de Chromium",
    PLAYWRIGHT_REMOTE_ENDPOINT_MISSING: "Configurez PLAYWRIGHT_REMOTE_ENDPOINT dans Paramètres > Runner (ex: ws://browserless:3000)",
    PLAYWRIGHT_REMOTE_CONNECT_FAILED: "Vérifiez que le service Browserless est démarré et accessible",
    PLAYWRIGHT_NO_RUNNER_AVAILABLE: "Configurez un endpoint distant (PLAYWRIGHT_REMOTE_ENDPOINT) ou installez Chromium localement",
  };
  return hints[code];
}

// ─── Utility ────────────────────────────────────────────────────────────

/** Délai réaliste par type d'action (ms) — pour simulation */
function getActionDelay(action: string): number {
  const delays: Record<string, [number, number]> = {
    NAVIGATE: [800, 2000],
    FILL: [200, 600],
    CLICK: [150, 500],
    SELECT: [200, 500],
    ASSERT: [100, 400],
    CHECK: [100, 300],
    UNCHECK: [100, 300],
    UPLOAD: [500, 1500],
    WAIT: [500, 2000],
  };
  const [min, max] = delays[action] || [200, 800];
  return Math.floor(Math.random() * (max - min) + min);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Main Entry Point ────────────────────────────────────────────────────

/**
 * Démarre l'exécution d'un test.
 * - Passe le statut en RUNNING
 * - Récupère les étapes du scénario
 * - Lance la simulation ou le worker réel Playwright (LOCAL/REMOTE/AUTO)
 * - Met à jour le statut final (PASSED/FAILED/ERROR)
 */
export async function startExecution(executionId: number): Promise<ExecutionResult> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  // 1. Récupérer l'exécution
  const [exec] = await db.select().from(executions).where(eq(executions.id, executionId)).limit(1);
  if (!exec) throw new Error(`Execution #${executionId} not found`);
  if (exec.status !== "PENDING") throw new Error(`Execution #${executionId} is not PENDING (current: ${exec.status})`);

  // 2. Déterminer le mode d'exécution
  const mode: ExecutionMode = (exec.executionMode as ExecutionMode) || "SIMULATED";

  // 3. Récupérer les étapes du scénario
  let steps: ExecutionStep[] = [];
  if (exec.scenarioId && exec.scenarioId.trim()) {
    const isNumericId = /^\d+$/.test(exec.scenarioId);
    const scenarioCondition = isNumericId
      ? or(eq(testScenarios.uid, exec.scenarioId), eq(testScenarios.id, Number(exec.scenarioId)))
      : eq(testScenarios.uid, exec.scenarioId);
    const [scenario] = await db.select().from(testScenarios).where(scenarioCondition).limit(1);
    if (scenario?.steps) {
      const rawSteps = typeof scenario.steps === "string" ? JSON.parse(scenario.steps) : scenario.steps;
      steps = (rawSteps as any[]).map((s: any, i: number) => ({
        index: i + 1,
        action: s.action || "UNKNOWN",
        target: s.target || s.selector || "",
        description: s.description || s.expected_result || s.expectedResult || "",
        inputBinding: s.inputBinding || s.input_binding || undefined,
        locatorStrategy: s.locatorStrategy || s.locator_strategy || undefined,
      }));
    }
  }

  // Si pas d'étapes, créer des étapes de base
  if (steps.length === 0) {
    steps = [
      { index: 1, action: "NAVIGATE", target: "page d'accueil", description: "Naviguer vers l'URL cible" },
      { index: 2, action: "ASSERT", target: "page chargée", description: "Vérifier que la page est chargée" },
    ];
  }

  // 4. Passer en RUNNING
  await db.update(executions).set({
    status: "RUNNING",
    startedAt: new Date(),
    stepsTotal: steps.length,
    stepsPassed: 0,
    stepsFailed: 0,
    runnerMode: mode === "REAL" ? (await loadPlaywrightConfigWithDb()).runnerMode : null,
    runnerType: mode === "REAL" ? "PLAYWRIGHT" : null,
  }).where(eq(executions.id, executionId));

  try {
    let result: ExecutionResult;

    if (mode === "SIMULATED") {
      result = await simulateExecution(db, executionId, steps);
    } else {
      // Mode RÉEL — Playwright LOCAL/REMOTE/AUTO
      result = await realExecution(
        db,
        executionId,
        exec.uid,
        steps,
        exec.profileId || undefined,
        exec.datasetBundleId || undefined,
        exec.projectId || undefined,
      );
    }

    // 5. Mettre à jour le statut final
    const finishedAt = new Date();
    await db.update(executions).set({
      status: result.status,
      finishedAt,
      durationMs: result.durationMs,
      stepsTotal: result.stepsTotal,
      stepsPassed: result.stepsPassed,
      stepsFailed: result.stepsFailed,
    }).where(eq(executions.id, executionId));

    // 6. Notifications
    if (result.status === "FAILED" || result.status === "ERROR") {
      const scenarioName = exec.scenarioId
        ? (await db.select({ name: testScenarios.name }).from(testScenarios).where(eq(testScenarios.uid, exec.scenarioId)).limit(1))?.[0]?.name ?? "—"
        : "—";
      const errorInfo = result.errorCode ? ` (${result.errorCode})` : "";
      notifyOwner({
        title: `⚠️ Exécution #${executionId} ${result.status}`,
        content: `L'exécution #${executionId} (scénario: ${scenarioName}, env: ${exec.targetEnv ?? "—"}, mode: ${mode}${result.resolvedRunnerMode ? `/${result.resolvedRunnerMode}` : ""}) a échoué${errorInfo}. ${result.stepsPassed}/${result.stepsTotal} étapes réussies.`,
      }).catch(() => {});
    }

    return result;
  } catch (error: any) {
    // Erreur inattendue → statut ERROR
    const detectedCode = detectErrorCode(error);

    await db.update(executions).set({
      status: "ERROR",
      finishedAt: new Date(),
      errorCode: detectedCode,
      errorMessage: error.message,
    }).where(eq(executions.id, executionId));

    await insertLog(db, executionId, 0, "ERROR", `💥 Erreur fatale: ${error.message}`, {
      errorCode: detectedCode,
      error: error.message,
      stack: error.stack?.slice(0, 500),
      hint: getHintForErrorCode(detectedCode),
    });

    return {
      status: "ERROR",
      durationMs: 0,
      stepsTotal: steps.length,
      stepsPassed: 0,
      stepsFailed: 0,
      errorCode: detectedCode,
      errorMessage: error.message,
    };
  }
}
