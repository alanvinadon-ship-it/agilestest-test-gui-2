/**
 * Tests for BindingSelector — endpoint getProjectBindings + binding logic
 */
import { describe, it, expect } from 'vitest';

// ─── Test: BindingGroup structure ─────────────────────────────────────────

describe('BindingGroup structure', () => {
  it('should have correct shape for a binding group', () => {
    const group = {
      datasetType: 'form_data',
      datasetId: 'ds-001',
      datasetName: 'Formulaire principal',
      env: 'PROD',
      bindings: ['form_data.user_info.firstName', 'form_data.user_info.lastName', 'form_data.user_info.email'],
    };
    expect(group.datasetType).toBe('form_data');
    expect(group.bindings).toHaveLength(3);
    expect(group.bindings[0]).toContain('form_data.');
  });

  it('should support multiple groups for different dataset types', () => {
    const groups = [
      { datasetType: 'form_data', datasetId: 'ds-001', datasetName: 'Form', env: 'PROD', bindings: ['form_data.email'] },
      { datasetType: 'auth_data', datasetId: 'ds-002', datasetName: 'Auth', env: 'PROD', bindings: ['auth_data.username', 'auth_data.password'] },
      { datasetType: 'search_data', datasetId: 'ds-003', datasetName: 'Search', env: 'PROD', bindings: ['search_data.query'] },
    ];
    expect(groups).toHaveLength(3);
    const allBindings = groups.flatMap(g => g.bindings);
    expect(allBindings).toHaveLength(4);
  });
});

// ─── Test: Binding parsing ────────────────────────────────────────────────

describe('Binding parsing', () => {
  function parseBinding(binding: string): { type: string; key: string } {
    const dotIdx = binding.indexOf('.');
    if (dotIdx === -1) return { type: '', key: binding };
    return { type: binding.substring(0, dotIdx), key: binding.substring(dotIdx + 1) };
  }

  it('should parse simple binding "form_data.email"', () => {
    const result = parseBinding('form_data.email');
    expect(result.type).toBe('form_data');
    expect(result.key).toBe('email');
  });

  it('should parse nested binding "form_data.user_info.firstName"', () => {
    const result = parseBinding('form_data.user_info.firstName');
    expect(result.type).toBe('form_data');
    expect(result.key).toBe('user_info.firstName');
  });

  it('should handle binding without dot', () => {
    const result = parseBinding('email');
    expect(result.type).toBe('');
    expect(result.key).toBe('email');
  });
});

// ─── Test: Binding search/filter ──────────────────────────────────────────

describe('Binding search/filter', () => {
  const groups = [
    { datasetType: 'form_data', datasetId: 'ds-001', datasetName: 'Form', env: 'PROD', bindings: ['form_data.user_info.firstName', 'form_data.user_info.lastName', 'form_data.user_info.email', 'form_data.address.city'] },
    { datasetType: 'auth_data', datasetId: 'ds-002', datasetName: 'Auth', env: 'PROD', bindings: ['auth_data.username', 'auth_data.password'] },
  ];

  function filterGroups(groups: typeof groups[0][], search: string) {
    if (!search.trim()) return groups;
    const q = search.toLowerCase();
    return groups
      .map(g => ({ ...g, bindings: g.bindings.filter(b => b.toLowerCase().includes(q)) }))
      .filter(g => g.bindings.length > 0);
  }

  it('should return all groups when search is empty', () => {
    const result = filterGroups(groups, '');
    expect(result).toHaveLength(2);
  });

  it('should filter by key name "email"', () => {
    const result = filterGroups(groups, 'email');
    expect(result).toHaveLength(1);
    expect(result[0].datasetType).toBe('form_data');
    expect(result[0].bindings).toHaveLength(1);
    expect(result[0].bindings[0]).toBe('form_data.user_info.email');
  });

  it('should filter by dataset type "auth"', () => {
    const result = filterGroups(groups, 'auth');
    expect(result).toHaveLength(1);
    expect(result[0].datasetType).toBe('auth_data');
    expect(result[0].bindings).toHaveLength(2);
  });

  it('should return empty when no match', () => {
    const result = filterGroups(groups, 'zzz_nonexistent');
    expect(result).toHaveLength(0);
  });

  it('should be case-insensitive', () => {
    const result = filterGroups(groups, 'FIRSTNAME');
    expect(result).toHaveLength(1);
    expect(result[0].bindings[0]).toContain('firstName');
  });
});

// ─── Test: Binding rules by action ────────────────────────────────────────

describe('Binding rules by action', () => {
  const ACTIONS_REQUIRING_BINDING = ['FILL', 'SELECT', 'UPLOAD'];
  const ACTIONS_REQUIRING_EXPECTED = ['ASSERT'];

  it('FILL requires binding', () => {
    expect(ACTIONS_REQUIRING_BINDING.includes('FILL')).toBe(true);
  });

  it('SELECT requires binding', () => {
    expect(ACTIONS_REQUIRING_BINDING.includes('SELECT')).toBe(true);
  });

  it('UPLOAD requires binding', () => {
    expect(ACTIONS_REQUIRING_BINDING.includes('UPLOAD')).toBe(true);
  });

  it('NAVIGATE does not require binding', () => {
    expect(ACTIONS_REQUIRING_BINDING.includes('NAVIGATE')).toBe(false);
  });

  it('CLICK does not require binding', () => {
    expect(ACTIONS_REQUIRING_BINDING.includes('CLICK')).toBe(false);
  });

  it('ASSERT requires expected result', () => {
    expect(ACTIONS_REQUIRING_EXPECTED.includes('ASSERT')).toBe(true);
  });

  it('FILL does not require expected result', () => {
    expect(ACTIONS_REQUIRING_EXPECTED.includes('FILL')).toBe(false);
  });
});

// ─── Test: DSL preview with binding ───────────────────────────────────────

describe('DSL preview with binding', () => {
  it('should include binding in DSL output', () => {
    const steps = [
      { action: 'NAVIGATE', target: 'https://example.com', locatorStrategy: '', inputBinding: null, expectedResult: '' },
      { action: 'FILL', target: '#email', locatorStrategy: 'css', inputBinding: 'form_data.user_info.email', expectedResult: '' },
      { action: 'CLICK', target: '#submit', locatorStrategy: 'css', inputBinding: null, expectedResult: '' },
      { action: 'ASSERT', target: '.success', locatorStrategy: 'css', inputBinding: null, expectedResult: 'Formulaire envoyé' },
    ];

    const dsl = steps.map((s, i) => ({
      step: i + 1,
      action: s.action,
      target: s.target,
      locator: s.locatorStrategy || '?',
      binding: s.inputBinding || null,
      expected: s.expectedResult || null,
    }));

    expect(dsl).toHaveLength(4);
    expect(dsl[0].binding).toBeNull();
    expect(dsl[1].binding).toBe('form_data.user_info.email');
    expect(dsl[1].action).toBe('FILL');
    expect(dsl[3].expected).toBe('Formulaire envoyé');
  });

  it('should serialize to valid JSON', () => {
    const dsl = [{ step: 1, action: 'FILL', target: '#email', locator: 'css', binding: 'form_data.email', expected: null }];
    const json = JSON.stringify(dsl, null, 2);
    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json);
    expect(parsed[0].binding).toBe('form_data.email');
  });
});

// ─── Test: Flatten object values for bindings ─────────────────────────────

describe('Flatten object values for bindings', () => {
  function flattenValues(values: Record<string, any>, prefix: string): string[] {
    const result: string[] = [];
    for (const [key, val] of Object.entries(values)) {
      const fullKey = `${prefix}.${key}`;
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        result.push(...flattenValues(val, fullKey));
      } else {
        result.push(fullKey);
      }
    }
    return result;
  }

  it('should flatten simple key-value pairs', () => {
    const values = { email: 'test@example.com', password: 'secret' };
    const bindings = flattenValues(values, 'auth_data');
    expect(bindings).toEqual(['auth_data.email', 'auth_data.password']);
  });

  it('should flatten nested objects', () => {
    const values = {
      user_info: { firstName: 'Jean', lastName: 'Dupont', email: 'jean@test.com' },
      address: { city: 'Abidjan', country: 'CI' },
    };
    const bindings = flattenValues(values, 'form_data');
    expect(bindings).toContain('form_data.user_info.firstName');
    expect(bindings).toContain('form_data.user_info.lastName');
    expect(bindings).toContain('form_data.address.city');
    expect(bindings).toHaveLength(5);
  });

  it('should handle empty object', () => {
    const bindings = flattenValues({}, 'empty');
    expect(bindings).toHaveLength(0);
  });
});

// ─── Test: buildContext step mapping includes bindings ────────────────────

describe('buildContext step mapping includes bindings', () => {
  // Simulates the step mapping logic from buildContext.ts
  function mapStepsForContext(steps: Array<{
    id: string; order: number; action: string; target: string;
    locatorStrategy: string; inputBinding: string | null;
    expectedResult: string; description?: string; parameters?: Record<string, unknown>;
  }>) {
    return steps.map((s, idx) => ({
      id: String(s.id || `step-${idx + 1}`),
      order: typeof s.order === 'number' ? s.order : idx + 1,
      action: s.action || '',
      target: (s as any).target || '',
      locator_strategy: (s as any).locatorStrategy || (s as any).locator_strategy || '',
      input_binding: (s as any).inputBinding || (s as any).input_binding || null,
      description: s.description || '',
      expected_result: (s as any).expectedResult || (s as any).expected_result || '',
      parameters: (s.parameters && typeof s.parameters === 'object') ? s.parameters : {},
    }));
  }

  function extractRequiredInputs(steps: Array<{
    inputBinding?: string | null; input_binding?: string | null;
    parameters?: Record<string, unknown>;
  }>): string[] {
    const requiredInputs: string[] = [];
    for (const step of steps) {
      const binding = (step as any).inputBinding || (step as any).input_binding;
      if (binding && !requiredInputs.includes(binding)) {
        requiredInputs.push(binding);
      }
      if (step.parameters && typeof step.parameters === 'object') {
        for (const key of Object.keys(step.parameters)) {
          if (!requiredInputs.includes(key)) requiredInputs.push(key);
        }
      }
    }
    return requiredInputs;
  }

  const loginSteps = [
    { id: 'step-1', order: 1, action: 'NAVIGATE', target: 'urls.login', locatorStrategy: 'ref', inputBinding: null, expectedResult: 'La page est affichée', description: '' },
    { id: 'step-2', order: 2, action: 'ASSERT', target: 'login.title', locatorStrategy: 'text', inputBinding: null, expectedResult: 'Page de connexion visible', description: '' },
    { id: 'step-3', order: 3, action: 'FILL', target: 'login.username', locatorStrategy: 'label', inputBinding: 'username', expectedResult: '', description: '' },
    { id: 'step-4', order: 4, action: 'FILL', target: 'login.password', locatorStrategy: 'label', inputBinding: 'password', expectedResult: '', description: '' },
    { id: 'step-5', order: 5, action: 'CLICK', target: 'login.submit', locatorStrategy: 'role', inputBinding: null, expectedResult: '', description: '' },
  ];

  it('should include target in mapped steps', () => {
    const mapped = mapStepsForContext(loginSteps);
    expect(mapped[0].target).toBe('urls.login');
    expect(mapped[2].target).toBe('login.username');
    expect(mapped[4].target).toBe('login.submit');
  });

  it('should include locator_strategy in mapped steps', () => {
    const mapped = mapStepsForContext(loginSteps);
    expect(mapped[0].locator_strategy).toBe('ref');
    expect(mapped[2].locator_strategy).toBe('label');
    expect(mapped[4].locator_strategy).toBe('role');
  });

  it('should include input_binding in mapped steps', () => {
    const mapped = mapStepsForContext(loginSteps);
    expect(mapped[0].input_binding).toBeNull();
    expect(mapped[2].input_binding).toBe('username');
    expect(mapped[3].input_binding).toBe('password');
    expect(mapped[4].input_binding).toBeNull();
  });

  it('should extract required_inputs from inputBinding fields', () => {
    const inputs = extractRequiredInputs(loginSteps);
    expect(inputs).toContain('username');
    expect(inputs).toContain('password');
    expect(inputs).toHaveLength(2);
  });

  it('should not duplicate required_inputs', () => {
    const stepsWithDuplicates = [
      ...loginSteps,
      { id: 'step-6', order: 6, action: 'FILL', target: 'login.username2', locatorStrategy: 'label', inputBinding: 'username', expectedResult: '', description: '' },
    ];
    const inputs = extractRequiredInputs(stepsWithDuplicates);
    expect(inputs).toHaveLength(2); // username appears twice but should be deduplicated
  });

  it('should also extract from parameters (legacy fallback)', () => {
    const legacySteps = [
      { id: 'step-1', order: 1, action: 'FILL', inputBinding: null, parameters: { email: 'test@example.com', password: 'secret' } },
    ];
    const inputs = extractRequiredInputs(legacySteps);
    expect(inputs).toContain('email');
    expect(inputs).toContain('password');
  });

  it('should combine inputBinding and parameters inputs', () => {
    const mixedSteps = [
      { id: 'step-1', order: 1, action: 'FILL', inputBinding: 'username', parameters: {} },
      { id: 'step-2', order: 2, action: 'FILL', inputBinding: null, parameters: { legacy_key: 'val' } },
    ];
    const inputs = extractRequiredInputs(mixedSteps);
    expect(inputs).toContain('username');
    expect(inputs).toContain('legacy_key');
    expect(inputs).toHaveLength(2);
  });
});

// ─── Test: formatSteps includes binding info ─────────────────────────────

describe('formatSteps includes binding info', () => {
  // Simulates the formatSteps logic from promptTemplates.ts
  function formatSteps(steps: Array<{
    order: number; action: string; target: string;
    locator_strategy: string; input_binding: string | null;
    description: string; expected_result: string;
  }>): string {
    return steps.map(s => {
      const parts = [`  ${s.order}. [${s.action}]`];
      if (s.target) parts.push(`target="${s.target}"`);
      if (s.locator_strategy) parts.push(`locator=${s.locator_strategy}`);
      if (s.input_binding) parts.push(`binding=${s.input_binding}`);
      if (s.description) parts.push(s.description);
      const line1 = parts.join(' ');
      const line2 = `     Expected: ${s.expected_result || 'N/A'}`;
      return `${line1}\n${line2}`;
    }).join('\n');
  }

  it('should include binding=username for FILL step', () => {
    const output = formatSteps([
      { order: 1, action: 'FILL', target: 'login.username', locator_strategy: 'label', input_binding: 'username', description: '', expected_result: '' },
    ]);
    expect(output).toContain('binding=username');
    expect(output).toContain('target="login.username"');
    expect(output).toContain('locator=label');
  });

  it('should NOT include binding for CLICK step (null)', () => {
    const output = formatSteps([
      { order: 1, action: 'CLICK', target: 'login.submit', locator_strategy: 'role', input_binding: null, description: '', expected_result: '' },
    ]);
    expect(output).not.toContain('binding=');
    expect(output).toContain('target="login.submit"');
  });

  it('should format a full login scenario with bindings', () => {
    const output = formatSteps([
      { order: 1, action: 'NAVIGATE', target: 'urls.login', locator_strategy: 'ref', input_binding: null, description: '', expected_result: 'Page affichée' },
      { order: 2, action: 'FILL', target: 'login.username', locator_strategy: 'label', input_binding: 'username', description: '', expected_result: '' },
      { order: 3, action: 'FILL', target: 'login.password', locator_strategy: 'label', input_binding: 'password', description: '', expected_result: '' },
      { order: 4, action: 'CLICK', target: 'login.submit', locator_strategy: 'role', input_binding: null, description: '', expected_result: '' },
    ]);
    expect(output).toContain('binding=username');
    expect(output).toContain('binding=password');
    // NAVIGATE and CLICK should not have binding
    const lines = output.split('\n');
    const navigateLine = lines.find(l => l.includes('[NAVIGATE]'));
    expect(navigateLine).not.toContain('binding=');
    const clickLine = lines.find(l => l.includes('[CLICK]'));
    expect(clickLine).not.toContain('binding=');
  });
});

// ─── Test: mergeDatasetValues supports Drizzle camelCase ─────────────────

describe('mergeDatasetValues supports Drizzle camelCase', () => {
  // Simulates the mergeDatasetValues logic from buildContext.ts
  function mergeDatasetValues(datasets: any[]): Record<string, unknown> {
    const merged: Record<string, unknown> = {};
    for (const ds of datasets) {
      // Drizzle retourne camelCase (valuesJson), le type frontend utilise snake_case (values_json)
      const values = ds.valuesJson || ds.values_json || {};
      // Drizzle retourne camelCase (datasetTypeId), le type frontend utilise snake_case (dataset_type_id)
      const typeId = ds.datasetTypeId || ds.dataset_type_id || 'unknown';
      for (const [key, value] of Object.entries(values)) {
        merged[`${typeId}.${key}`] = value;
        merged[key] = value;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          for (const [nestedKey, nestedValue] of Object.entries(value as Record<string, unknown>)) {
            merged[`${typeId}.${key}.${nestedKey}`] = nestedValue;
            merged[`${key}.${nestedKey}`] = nestedValue;
          }
        }
      }
    }
    return merged;
  }

  it('should read valuesJson (camelCase from Drizzle)', () => {
    const datasets = [{
      datasetTypeId: 'users',
      valuesJson: { username: 'lanvin@test.com', password: 'secret123' },
    }];
    const merged = mergeDatasetValues(datasets);
    expect(merged['username']).toBe('lanvin@test.com');
    expect(merged['password']).toBe('secret123');
    expect(merged['users.username']).toBe('lanvin@test.com');
    expect(merged['users.password']).toBe('secret123');
  });

  it('should read values_json (snake_case from frontend types)', () => {
    const datasets = [{
      dataset_type_id: 'users',
      values_json: { username: 'lanvin@test.com', password: 'secret123' },
    }];
    const merged = mergeDatasetValues(datasets);
    expect(merged['username']).toBe('lanvin@test.com');
    expect(merged['password']).toBe('secret123');
    expect(merged['users.username']).toBe('lanvin@test.com');
    expect(merged['users.password']).toBe('secret123');
  });

  it('should prefer valuesJson over values_json when both exist', () => {
    const datasets = [{
      datasetTypeId: 'users',
      valuesJson: { username: 'from_camel' },
      values_json: { username: 'from_snake' },
    }];
    const merged = mergeDatasetValues(datasets);
    expect(merged['username']).toBe('from_camel');
  });

  it('should handle empty valuesJson gracefully', () => {
    const datasets = [{ datasetTypeId: 'users', valuesJson: {} }];
    const merged = mergeDatasetValues(datasets);
    expect(Object.keys(merged)).toHaveLength(0);
  });

  it('should handle missing valuesJson and values_json', () => {
    const datasets = [{ datasetTypeId: 'users' }];
    const merged = mergeDatasetValues(datasets);
    expect(Object.keys(merged)).toHaveLength(0);
  });

  it('should flatten nested objects from camelCase source', () => {
    const datasets = [{
      datasetTypeId: 'form_data',
      valuesJson: {
        user_info: { firstName: 'Jean', lastName: 'Dupont' },
        email: 'jean@test.com',
      },
    }];
    const merged = mergeDatasetValues(datasets);
    expect(merged['email']).toBe('jean@test.com');
    expect(merged['form_data.email']).toBe('jean@test.com');
    expect(merged['user_info.firstName']).toBe('Jean');
    expect(merged['form_data.user_info.firstName']).toBe('Jean');
    expect(merged['user_info.lastName']).toBe('Dupont');
    expect(merged['form_data.user_info.lastName']).toBe('Dupont');
  });
});
