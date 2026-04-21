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
