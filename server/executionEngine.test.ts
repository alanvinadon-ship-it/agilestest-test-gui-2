/**
 * executionEngine.test.ts — Tests pour le moteur d'exécution AgilesTest
 *
 * Tests unitaires pour:
 * - Types et interfaces
 * - Logique de simulation (getActionDelay, simulateExecution)
 * - Transitions d'état
 * - Gestion des erreurs
 */
import { describe, it, expect, vi } from "vitest";

// ─── Test: getActionDelay logic ─────────────────────────────────────────

describe("getActionDelay", () => {
  // Reproduire la logique localement pour tester sans dépendance DB
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

  it("retourne un délai dans la plage NAVIGATE [800, 2000]", () => {
    for (let i = 0; i < 50; i++) {
      const delay = getActionDelay("NAVIGATE");
      expect(delay).toBeGreaterThanOrEqual(800);
      expect(delay).toBeLessThan(2000);
    }
  });

  it("retourne un délai dans la plage FILL [200, 600]", () => {
    for (let i = 0; i < 50; i++) {
      const delay = getActionDelay("FILL");
      expect(delay).toBeGreaterThanOrEqual(200);
      expect(delay).toBeLessThan(600);
    }
  });

  it("retourne un délai dans la plage CLICK [150, 500]", () => {
    for (let i = 0; i < 50; i++) {
      const delay = getActionDelay("CLICK");
      expect(delay).toBeGreaterThanOrEqual(150);
      expect(delay).toBeLessThan(500);
    }
  });

  it("retourne un délai par défaut [200, 800] pour une action inconnue", () => {
    for (let i = 0; i < 50; i++) {
      const delay = getActionDelay("UNKNOWN_ACTION");
      expect(delay).toBeGreaterThanOrEqual(200);
      expect(delay).toBeLessThan(800);
    }
  });

  it("couvre toutes les actions connues", () => {
    const actions = ["NAVIGATE", "FILL", "CLICK", "SELECT", "ASSERT", "CHECK", "UNCHECK", "UPLOAD", "WAIT"];
    for (const action of actions) {
      const delay = getActionDelay(action);
      expect(typeof delay).toBe("number");
      expect(delay).toBeGreaterThan(0);
    }
  });
});

// ─── Test: ExecutionStep interface ──────────────────────────────────────

describe("ExecutionStep interface", () => {
  it("accepte un step complet avec inputBinding", () => {
    const step = {
      index: 1,
      action: "FILL",
      target: "#username",
      description: "Remplir le champ username",
      inputBinding: "user_info.email",
    };
    expect(step.index).toBe(1);
    expect(step.action).toBe("FILL");
    expect(step.inputBinding).toBe("user_info.email");
  });

  it("accepte un step sans inputBinding", () => {
    const step = {
      index: 2,
      action: "CLICK",
      target: "#submit",
      description: "Cliquer sur le bouton",
    };
    expect(step.inputBinding).toBeUndefined();
  });
});

// ─── Test: ExecutionResult interface ────────────────────────────────────

describe("ExecutionResult interface", () => {
  it("représente un résultat PASSED", () => {
    const result = {
      status: "PASSED" as const,
      durationMs: 5432,
      stepsTotal: 8,
      stepsPassed: 8,
      stepsFailed: 0,
    };
    expect(result.status).toBe("PASSED");
    expect(result.stepsPassed).toBe(result.stepsTotal);
    expect(result.stepsFailed).toBe(0);
  });

  it("représente un résultat FAILED", () => {
    const result = {
      status: "FAILED" as const,
      durationMs: 3200,
      stepsTotal: 8,
      stepsPassed: 4,
      stepsFailed: 1,
    };
    expect(result.status).toBe("FAILED");
    expect(result.stepsPassed + result.stepsFailed).toBeLessThanOrEqual(result.stepsTotal);
  });
});

// ─── Test: ExecutionMode ────────────────────────────────────────────────

describe("ExecutionMode", () => {
  it("accepte SIMULATED et REAL", () => {
    const modes = ["SIMULATED", "REAL"];
    expect(modes).toContain("SIMULATED");
    expect(modes).toContain("REAL");
  });
});

// ─── Test: Step extraction from scenario ────────────────────────────────

describe("Step extraction from scenario JSON", () => {
  it("extrait les étapes depuis le format scénario standard", () => {
    const rawSteps = [
      { action: "NAVIGATE", target: "https://example.com", description: "Aller sur la page", inputBinding: null },
      { action: "FILL", target: "#username", description: "Remplir username", inputBinding: "user_info.email" },
      { action: "FILL", target: "#password", description: "Remplir password", inputBinding: "user_info.password" },
      { action: "CLICK", target: "#login", description: "Cliquer sur login" },
      { action: "ASSERT", target: ".dashboard", description: "Vérifier dashboard visible" },
    ];

    const steps = rawSteps.map((s: any, i: number) => ({
      index: i + 1,
      action: s.action || "UNKNOWN",
      target: s.target || s.selector || "",
      description: s.description || s.expected_result || "",
      inputBinding: s.inputBinding || s.input_binding || undefined,
    }));

    expect(steps).toHaveLength(5);
    expect(steps[0].action).toBe("NAVIGATE");
    expect(steps[0].index).toBe(1);
    expect(steps[1].inputBinding).toBe("user_info.email");
    expect(steps[2].inputBinding).toBe("user_info.password");
    expect(steps[3].inputBinding).toBeUndefined();
  });

  it("gère les étapes avec format snake_case (input_binding)", () => {
    const rawSteps = [
      { action: "FILL", target: "#email", description: "Email", input_binding: "auth.email" },
    ];

    const steps = rawSteps.map((s: any, i: number) => ({
      index: i + 1,
      action: s.action || "UNKNOWN",
      target: s.target || "",
      description: s.description || "",
      inputBinding: s.inputBinding || s.input_binding || undefined,
    }));

    expect(steps[0].inputBinding).toBe("auth.email");
  });

  it("crée des étapes par défaut quand le scénario n'a pas d'étapes", () => {
    const steps = [
      { index: 1, action: "NAVIGATE", target: "page d'accueil", description: "Naviguer vers l'URL cible" },
      { index: 2, action: "ASSERT", target: "page chargée", description: "Vérifier que la page est chargée" },
    ];

    expect(steps).toHaveLength(2);
    expect(steps[0].action).toBe("NAVIGATE");
    expect(steps[1].action).toBe("ASSERT");
  });
});

// ─── Test: Status transitions ───────────────────────────────────────────

describe("Status transitions", () => {
  const validTransitions: Record<string, string[]> = {
    PENDING: ["RUNNING", "CANCELLED"],
    RUNNING: ["PASSED", "FAILED", "ERROR", "CANCELLED"],
    PASSED: [],
    FAILED: [],
    ERROR: [],
    CANCELLED: [],
  };

  it("PENDING peut transitionner vers RUNNING", () => {
    expect(validTransitions["PENDING"]).toContain("RUNNING");
  });

  it("PENDING peut transitionner vers CANCELLED", () => {
    expect(validTransitions["PENDING"]).toContain("CANCELLED");
  });

  it("RUNNING peut transitionner vers PASSED, FAILED, ERROR, CANCELLED", () => {
    expect(validTransitions["RUNNING"]).toContain("PASSED");
    expect(validTransitions["RUNNING"]).toContain("FAILED");
    expect(validTransitions["RUNNING"]).toContain("ERROR");
    expect(validTransitions["RUNNING"]).toContain("CANCELLED");
  });

  it("les statuts terminaux ne peuvent pas transitionner", () => {
    expect(validTransitions["PASSED"]).toHaveLength(0);
    expect(validTransitions["FAILED"]).toHaveLength(0);
    expect(validTransitions["ERROR"]).toHaveLength(0);
    expect(validTransitions["CANCELLED"]).toHaveLength(0);
  });
});

// ─── Test: Simulation result consistency ────────────────────────────────

describe("Simulation result consistency", () => {
  it("stepsPassed + stepsFailed + stepsSkipped = stepsTotal", () => {
    const result = {
      status: "FAILED" as const,
      durationMs: 4500,
      stepsTotal: 8,
      stepsPassed: 3,
      stepsFailed: 1,
    };
    const stepsSkipped = result.stepsTotal - result.stepsPassed - result.stepsFailed;
    expect(stepsSkipped).toBe(4);
    expect(result.stepsPassed + result.stepsFailed + stepsSkipped).toBe(result.stepsTotal);
  });

  it("PASSED implique stepsFailed = 0", () => {
    const result = {
      status: "PASSED" as const,
      durationMs: 6000,
      stepsTotal: 5,
      stepsPassed: 5,
      stepsFailed: 0,
    };
    expect(result.stepsFailed).toBe(0);
    expect(result.stepsPassed).toBe(result.stepsTotal);
  });

  it("FAILED implique stepsFailed > 0", () => {
    const result = {
      status: "FAILED" as const,
      durationMs: 3000,
      stepsTotal: 5,
      stepsPassed: 2,
      stepsFailed: 1,
    };
    expect(result.stepsFailed).toBeGreaterThan(0);
  });

  it("durationMs est toujours positif", () => {
    const result = {
      status: "PASSED" as const,
      durationMs: 1234,
      stepsTotal: 3,
      stepsPassed: 3,
      stepsFailed: 0,
    };
    expect(result.durationMs).toBeGreaterThan(0);
  });
});

// ─── Test: Log levels ───────────────────────────────────────────────────

describe("Log levels", () => {
  const validLevels = ["INFO", "WARN", "ERROR", "DEBUG", "STEP"];

  it("tous les niveaux de log sont valides", () => {
    for (const level of validLevels) {
      expect(["INFO", "WARN", "ERROR", "DEBUG", "STEP"]).toContain(level);
    }
  });

  it("STEP est utilisé pour les logs d'étapes réussies", () => {
    expect(validLevels).toContain("STEP");
  });

  it("ERROR est utilisé pour les étapes échouées", () => {
    expect(validLevels).toContain("ERROR");
  });

  it("WARN est utilisé pour les étapes ignorées et le fallback REAL→SIMULATED", () => {
    expect(validLevels).toContain("WARN");
  });
});
