/**
 * executionEngine.ts — Moteur d'exécution AgilesTest
 *
 * Phase 1: Simulation fonctionnelle (SIMULATED mode)
 *   - Transitions automatiques PENDING → RUNNING → PASSED/FAILED
 *   - Logs pas-à-pas avec timestamps
 *   - Durée simulée réaliste basée sur les étapes du scénario
 *
 * Phase 2 (préparé): Worker réel Playwright (REAL mode)
 *   - Interface extensible pour brancher un runner Playwright
 *   - Même API de logs et transitions
 */

import { getDb } from "./db";
import {
  executions,
  executionLogs,
  testScenarios,
  generatedScripts,
} from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { notifyOwner } from "./_core/notification";

// ─── Types ───────────────────────────────────────────────────────────────

export type ExecutionMode = "SIMULATED" | "REAL";

export interface ExecutionStep {
  index: number;
  action: string;
  target: string;
  description: string;
  inputBinding?: string;
}

export interface ExecutionResult {
  status: "PASSED" | "FAILED" | "ERROR";
  durationMs: number;
  stepsTotal: number;
  stepsPassed: number;
  stepsFailed: number;
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

// ─── Simulation Engine ───────────────────────────────────────────────────

/**
 * Simule l'exécution d'un scénario pas-à-pas.
 * Chaque étape prend entre 200ms et 1500ms (aléatoire réaliste).
 * 90% de chance de succès par étape, sauf si forceFailAtStep est défini.
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
    // Simuler un délai réaliste par action
    const delay = getActionDelay(step.action);
    await sleep(delay);

    // Déterminer le résultat de l'étape
    const shouldFail = options?.forceFailAtStep === step.index;
    const stepSuccess = shouldFail ? false : Math.random() > 0.05; // 95% succès

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

      // Mettre à jour le compteur en temps réel
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

      // Mettre à jour le compteur
      await db.update(executions).set({
        stepsFailed,
        stepsTotal: steps.length,
      }).where(eq(executions.id, executionId));

      // En mode simulation, on continue les étapes restantes mais elles sont marquées skipped
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

/** Délai réaliste par type d'action (ms) */
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
 * - Lance la simulation ou le worker réel
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
  if (exec.scenarioId) {
    const [scenario] = await db.select().from(testScenarios).where(eq(testScenarios.uid, exec.scenarioId)).limit(1);
    if (scenario?.steps) {
      const rawSteps = typeof scenario.steps === "string" ? JSON.parse(scenario.steps) : scenario.steps;
      steps = (rawSteps as any[]).map((s: any, i: number) => ({
        index: i + 1,
        action: s.action || "UNKNOWN",
        target: s.target || s.selector || "",
        description: s.description || s.expected_result || "",
        inputBinding: s.inputBinding || s.input_binding || undefined,
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
  }).where(eq(executions.id, executionId));

  try {
    let result: ExecutionResult;

    if (mode === "SIMULATED") {
      result = await simulateExecution(db, executionId, steps);
    } else {
      // Phase 2: Worker réel Playwright
      // Pour l'instant, fallback sur simulation avec un log d'avertissement
      await insertLog(db, executionId, 0, "WARN", "⚠️ Mode REAL non encore implémenté — fallback sur SIMULATED", {
        requestedMode: "REAL",
        actualMode: "SIMULATED",
      });
      result = await simulateExecution(db, executionId, steps);
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
    if (result.status === "FAILED") {
      const scenarioName = exec.scenarioId
        ? (await db.select({ name: testScenarios.name }).from(testScenarios).where(eq(testScenarios.uid, exec.scenarioId)).limit(1))?.[0]?.name ?? "—"
        : "—";
      notifyOwner({
        title: `⚠️ Exécution #${executionId} FAILED`,
        content: `L'exécution #${executionId} (scénario: ${scenarioName}, env: ${exec.targetEnv ?? "—"}, mode: ${mode}) a échoué. ${result.stepsPassed}/${result.stepsTotal} étapes réussies.`,
      }).catch(() => {});
    }

    return result;
  } catch (error: any) {
    // Erreur inattendue → statut ERROR
    await db.update(executions).set({
      status: "ERROR",
      finishedAt: new Date(),
    }).where(eq(executions.id, executionId));

    await insertLog(db, executionId, 0, "ERROR", `💥 Erreur fatale: ${error.message}`, {
      error: error.message,
      stack: error.stack?.slice(0, 500),
    });

    return {
      status: "ERROR",
      durationMs: Date.now() - Date.now(),
      stepsTotal: steps.length,
      stepsPassed: 0,
      stepsFailed: 0,
    };
  }
}
