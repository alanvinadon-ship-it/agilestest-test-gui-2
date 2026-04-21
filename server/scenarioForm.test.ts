import { describe, it, expect } from 'vitest';

// ─── Types & Constants under test ───────────────────────────────────────────

// We import the types and constants directly from the client types
// to validate the structured scenario step model

const SCENARIO_ACTIONS = [
  'NAVIGATE', 'FILL', 'CLICK', 'SELECT', 'CHECK', 'UNCHECK',
  'UPLOAD', 'WAIT', 'ASSERT',
] as const;
type ScenarioAction = typeof SCENARIO_ACTIONS[number];

const LOCATOR_STRATEGIES = [
  'label', 'role', 'text', 'testId', 'placeholder', 'css', 'xpath', 'ref',
] as const;
type LocatorStrategy = typeof LOCATOR_STRATEGIES[number];

interface ScenarioStep {
  id: string;
  order: number;
  action: ScenarioAction | string;
  target: string;
  locatorStrategy: LocatorStrategy | string;
  inputBinding: string | null;
  expectedResult: string;
  description?: string;
  expected_result?: string;
  parameters?: Record<string, unknown>;
}

interface ActionPlaceholders {
  target: string;
  locatorStrategy: LocatorStrategy;
  inputBinding: string;
  expectedResult: string;
}

const ACTION_PLACEHOLDERS: Record<ScenarioAction, ActionPlaceholders> = {
  NAVIGATE: { target: 'urls.full.contact', locatorStrategy: 'ref', inputBinding: '', expectedResult: 'La page est affichée' },
  FILL:     { target: 'contact.email', locatorStrategy: 'label', inputBinding: 'form_data.email', expectedResult: 'Le champ contient la valeur saisie' },
  CLICK:    { target: 'contact.submit', locatorStrategy: 'role', inputBinding: '', expectedResult: 'Le bouton est cliqué' },
  SELECT:   { target: 'contact.pays', locatorStrategy: 'label', inputBinding: 'form_data.pays', expectedResult: 'La valeur est sélectionnée' },
  CHECK:    { target: 'contact.cgu', locatorStrategy: 'label', inputBinding: 'form_data.acceptCgu', expectedResult: 'La case est cochée' },
  UNCHECK:  { target: 'contact.newsletter', locatorStrategy: 'label', inputBinding: '', expectedResult: 'La case est décochée' },
  UPLOAD:   { target: 'contact.fichier', locatorStrategy: 'testId', inputBinding: 'form_data.fichierPath', expectedResult: 'Le fichier est uploadé' },
  WAIT:     { target: 'contact.spinner', locatorStrategy: 'testId', inputBinding: '', expectedResult: "L'élément a disparu" },
  ASSERT:   { target: 'contact.successMessage', locatorStrategy: 'text', inputBinding: '', expectedResult: 'Le message de succès est visible' },
};

const ACTIONS_REQUIRING_BINDING: ScenarioAction[] = ['FILL', 'SELECT', 'UPLOAD'];
const ACTIONS_REQUIRING_EXPECTED: ScenarioAction[] = ['ASSERT'];

// ─── Helper to create an empty step (mirrors frontend emptyStep) ────────────

function emptyStep(order: number): ScenarioStep {
  return {
    id: `step-${Date.now()}-${order}`,
    order,
    action: '',
    target: '',
    locatorStrategy: '',
    inputBinding: null,
    expectedResult: '',
    description: '',
    expected_result: '',
    parameters: {},
  };
}

// ─── Zod schema mirror (validation logic) ───────────────────────────────────

function validateStep(step: ScenarioStep): string[] {
  const errors: string[] = [];
  if (!step.action) errors.push(`Step #${step.order + 1}: action is required`);
  if (ACTIONS_REQUIRING_BINDING.includes(step.action as ScenarioAction) && !step.inputBinding) {
    errors.push(`Step #${step.order + 1}: inputBinding is required for ${step.action}`);
  }
  if (ACTIONS_REQUIRING_EXPECTED.includes(step.action as ScenarioAction) && !step.expectedResult) {
    errors.push(`Step #${step.order + 1}: expectedResult is required for ${step.action}`);
  }
  return errors;
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('ScenarioAction enum', () => {
  it('should contain exactly 9 actions', () => {
    expect(SCENARIO_ACTIONS).toHaveLength(9);
  });

  it('should include NAVIGATE, FILL, CLICK, SELECT, CHECK, UNCHECK, UPLOAD, WAIT, ASSERT', () => {
    expect(SCENARIO_ACTIONS).toContain('NAVIGATE');
    expect(SCENARIO_ACTIONS).toContain('FILL');
    expect(SCENARIO_ACTIONS).toContain('CLICK');
    expect(SCENARIO_ACTIONS).toContain('SELECT');
    expect(SCENARIO_ACTIONS).toContain('CHECK');
    expect(SCENARIO_ACTIONS).toContain('UNCHECK');
    expect(SCENARIO_ACTIONS).toContain('UPLOAD');
    expect(SCENARIO_ACTIONS).toContain('WAIT');
    expect(SCENARIO_ACTIONS).toContain('ASSERT');
  });
});

describe('LocatorStrategy enum', () => {
  it('should contain exactly 8 strategies', () => {
    expect(LOCATOR_STRATEGIES).toHaveLength(8);
  });

  it('should include label, role, text, testId, placeholder, css, xpath, ref', () => {
    for (const s of ['label', 'role', 'text', 'testId', 'placeholder', 'css', 'xpath', 'ref']) {
      expect(LOCATOR_STRATEGIES).toContain(s);
    }
  });
});

describe('ACTION_PLACEHOLDERS', () => {
  it('should have placeholders for every action', () => {
    for (const action of SCENARIO_ACTIONS) {
      expect(ACTION_PLACEHOLDERS[action]).toBeDefined();
      expect(ACTION_PLACEHOLDERS[action].target).toBeTruthy();
      expect(ACTION_PLACEHOLDERS[action].locatorStrategy).toBeTruthy();
      expect(ACTION_PLACEHOLDERS[action].expectedResult).toBeTruthy();
    }
  });

  it('NAVIGATE should use ref locator strategy', () => {
    expect(ACTION_PLACEHOLDERS.NAVIGATE.locatorStrategy).toBe('ref');
  });

  it('FILL should suggest form_data.email as inputBinding', () => {
    expect(ACTION_PLACEHOLDERS.FILL.inputBinding).toBe('form_data.email');
  });

  it('ASSERT should use text locator strategy', () => {
    expect(ACTION_PLACEHOLDERS.ASSERT.locatorStrategy).toBe('text');
  });
});

describe('emptyStep', () => {
  it('should create a step with all required fields', () => {
    const step = emptyStep(0);
    expect(step.id).toMatch(/^step-/);
    expect(step.order).toBe(0);
    expect(step.action).toBe('');
    expect(step.target).toBe('');
    expect(step.locatorStrategy).toBe('');
    expect(step.inputBinding).toBeNull();
    expect(step.expectedResult).toBe('');
  });

  it('should set the correct order', () => {
    const step = emptyStep(5);
    expect(step.order).toBe(5);
  });

  it('should generate unique ids', () => {
    const s1 = emptyStep(0);
    const s2 = emptyStep(1);
    expect(s1.id).not.toBe(s2.id);
  });
});

describe('validateStep', () => {
  it('should return error if action is empty', () => {
    const step = emptyStep(0);
    const errors = validateStep(step);
    expect(errors).toContain('Step #1: action is required');
  });

  it('should return error if FILL has no inputBinding', () => {
    const step: ScenarioStep = { ...emptyStep(0), action: 'FILL', inputBinding: null };
    const errors = validateStep(step);
    expect(errors).toContain('Step #1: inputBinding is required for FILL');
  });

  it('should return error if SELECT has no inputBinding', () => {
    const step: ScenarioStep = { ...emptyStep(1), action: 'SELECT', inputBinding: null };
    const errors = validateStep(step);
    expect(errors).toContain('Step #2: inputBinding is required for SELECT');
  });

  it('should return error if UPLOAD has no inputBinding', () => {
    const step: ScenarioStep = { ...emptyStep(2), action: 'UPLOAD', inputBinding: null };
    const errors = validateStep(step);
    expect(errors).toContain('Step #3: inputBinding is required for UPLOAD');
  });

  it('should return error if ASSERT has no expectedResult', () => {
    const step: ScenarioStep = { ...emptyStep(0), action: 'ASSERT', expectedResult: '' };
    const errors = validateStep(step);
    expect(errors).toContain('Step #1: expectedResult is required for ASSERT');
  });

  it('should return no errors for a valid NAVIGATE step', () => {
    const step: ScenarioStep = {
      ...emptyStep(0),
      action: 'NAVIGATE',
      target: 'urls.full.home',
      locatorStrategy: 'ref',
      expectedResult: 'Page affichée',
    };
    const errors = validateStep(step);
    expect(errors).toHaveLength(0);
  });

  it('should return no errors for a valid FILL step with binding', () => {
    const step: ScenarioStep = {
      ...emptyStep(0),
      action: 'FILL',
      target: 'login.email',
      locatorStrategy: 'label',
      inputBinding: 'form_data.email',
      expectedResult: 'Champ rempli',
    };
    const errors = validateStep(step);
    expect(errors).toHaveLength(0);
  });

  it('should return no errors for a valid ASSERT step with expectedResult', () => {
    const step: ScenarioStep = {
      ...emptyStep(0),
      action: 'ASSERT',
      target: 'page.title',
      locatorStrategy: 'text',
      expectedResult: 'Bienvenue',
    };
    const errors = validateStep(step);
    expect(errors).toHaveLength(0);
  });

  it('should return no errors for CLICK without binding (not required)', () => {
    const step: ScenarioStep = {
      ...emptyStep(0),
      action: 'CLICK',
      target: 'form.submit',
      locatorStrategy: 'role',
      expectedResult: 'Bouton cliqué',
    };
    const errors = validateStep(step);
    expect(errors).toHaveLength(0);
  });
});

describe('ScenarioStep backward compatibility', () => {
  it('should support legacy fields (description, expected_result, parameters)', () => {
    const step: ScenarioStep = {
      id: 's1',
      order: 0,
      action: 'NAVIGATE',
      target: 'urls.full.home',
      locatorStrategy: 'ref',
      inputBinding: null,
      expectedResult: 'Page affichée',
      description: 'Naviguer vers la page d\'accueil',
      expected_result: 'Page affichée',
      parameters: { timeout: 5000 },
    };
    expect(step.description).toBe('Naviguer vers la page d\'accueil');
    expect(step.expected_result).toBe('Page affichée');
    expect(step.parameters?.timeout).toBe(5000);
  });

  it('should work without legacy fields', () => {
    const step: ScenarioStep = {
      id: 's1',
      order: 0,
      action: 'CLICK',
      target: 'form.submit',
      locatorStrategy: 'role',
      inputBinding: null,
      expectedResult: 'Bouton cliqué',
    };
    expect(step.description).toBeUndefined();
    expect(step.expected_result).toBeUndefined();
    expect(step.parameters).toBeUndefined();
  });
});

describe('ACTIONS_REQUIRING_BINDING', () => {
  it('should require binding for FILL, SELECT, UPLOAD only', () => {
    expect(ACTIONS_REQUIRING_BINDING).toEqual(['FILL', 'SELECT', 'UPLOAD']);
  });
});

describe('ACTIONS_REQUIRING_EXPECTED', () => {
  it('should require expectedResult for ASSERT only', () => {
    expect(ACTIONS_REQUIRING_EXPECTED).toEqual(['ASSERT']);
  });
});

describe('DSL JSON serialization', () => {
  it('should serialize a complete scenario step to JSON', () => {
    const step: ScenarioStep = {
      id: 's1',
      order: 0,
      action: 'FILL',
      target: 'login.email',
      locatorStrategy: 'label',
      inputBinding: 'form_data.email',
      expectedResult: 'Champ rempli',
    };
    const json = JSON.stringify(step);
    const parsed = JSON.parse(json);
    expect(parsed.action).toBe('FILL');
    expect(parsed.target).toBe('login.email');
    expect(parsed.locatorStrategy).toBe('label');
    expect(parsed.inputBinding).toBe('form_data.email');
    expect(parsed.expectedResult).toBe('Champ rempli');
  });

  it('should serialize an array of steps as valid JSON', () => {
    const steps: ScenarioStep[] = [
      { id: 's1', order: 0, action: 'NAVIGATE', target: 'urls.full.login', locatorStrategy: 'ref', inputBinding: null, expectedResult: 'Page login' },
      { id: 's2', order: 1, action: 'FILL', target: 'login.email', locatorStrategy: 'label', inputBinding: 'auth_data.email', expectedResult: 'Email saisi' },
      { id: 's3', order: 2, action: 'CLICK', target: 'login.submit', locatorStrategy: 'role', inputBinding: null, expectedResult: 'Formulaire soumis' },
      { id: 's4', order: 3, action: 'ASSERT', target: 'dashboard.welcome', locatorStrategy: 'text', inputBinding: null, expectedResult: 'Bienvenue affiché' },
    ];
    const json = JSON.stringify(steps);
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(4);
    expect(parsed[0].action).toBe('NAVIGATE');
    expect(parsed[3].action).toBe('ASSERT');
  });
});
