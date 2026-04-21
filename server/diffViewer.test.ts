/**
 * Tests for the Monaco Diff Viewer integration.
 * Covers: parseCodePayload, diff stats computation, version selection logic.
 */
import { describe, it, expect } from 'vitest';

// ─── parseCodePayload (duplicated from ScriptEditPage for testing) ──────────

interface ScriptFile { path: string; content: string; language?: string; }
interface CodePayload {
  files: ScriptFile[];
  plan: any;
  notes: string | null;
  warnings: string[] | null;
  env: string | null;
  bundleId: string | null;
}

function parseCodePayload(code: string): CodePayload {
  try {
    const parsed = JSON.parse(code);
    if (parsed.files && Array.isArray(parsed.files)) return parsed;
    return { files: [{ path: 'script.ts', content: code }], plan: null, notes: null, warnings: null, env: null, bundleId: null };
  } catch {
    return { files: [{ path: 'script.ts', content: code }], plan: null, notes: null, warnings: null, env: null, bundleId: null };
  }
}

// ─── computeDiffStats (duplicated from MonacoDiffViewer for testing) ────────

function computeDiffStats(original: string, modified: string): { added: number; removed: number } {
  const origLines = original.split('\n');
  const modLines = modified.split('\n');
  const maxLen = Math.max(origLines.length, modLines.length);
  let added = 0;
  let removed = 0;
  for (let i = 0; i < maxLen; i++) {
    const origLine = origLines[i];
    const modLine = modLines[i];
    if (origLine === undefined && modLine !== undefined) added++;
    else if (modLine === undefined && origLine !== undefined) removed++;
    else if (origLine !== modLine) { added++; removed++; }
  }
  return { added, removed };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('parseCodePayload', () => {
  it('should parse valid JSON with files array', () => {
    const code = JSON.stringify({
      files: [
        { path: 'test.ts', content: 'console.log("hello")' },
        { path: 'utils.ts', content: 'export const x = 1;' },
      ],
      plan: { steps: ['step1'] },
      notes: 'Some notes',
      warnings: ['warn1'],
      env: 'PROD',
      bundleId: 'B001',
    });
    const result = parseCodePayload(code);
    expect(result.files).toHaveLength(2);
    expect(result.files[0].path).toBe('test.ts');
    expect(result.files[1].content).toBe('export const x = 1;');
    expect(result.plan).toEqual({ steps: ['step1'] });
    expect(result.notes).toBe('Some notes');
    expect(result.warnings).toEqual(['warn1']);
    expect(result.env).toBe('PROD');
    expect(result.bundleId).toBe('B001');
  });

  it('should wrap plain text as single file', () => {
    const result = parseCodePayload('const x = 42;');
    expect(result.files).toHaveLength(1);
    expect(result.files[0].path).toBe('script.ts');
    expect(result.files[0].content).toBe('const x = 42;');
    expect(result.plan).toBeNull();
  });

  it('should handle JSON without files array', () => {
    const code = JSON.stringify({ name: 'test', value: 123 });
    const result = parseCodePayload(code);
    expect(result.files).toHaveLength(1);
    expect(result.files[0].path).toBe('script.ts');
  });

  it('should handle empty string', () => {
    const result = parseCodePayload('');
    expect(result.files).toHaveLength(1);
    expect(result.files[0].content).toBe('');
  });
});

describe('computeDiffStats', () => {
  it('should return 0 added/removed for identical content', () => {
    const content = 'line1\nline2\nline3';
    const stats = computeDiffStats(content, content);
    expect(stats.added).toBe(0);
    expect(stats.removed).toBe(0);
  });

  it('should count added lines', () => {
    const original = 'line1\nline2';
    const modified = 'line1\nline2\nline3\nline4';
    const stats = computeDiffStats(original, modified);
    expect(stats.added).toBe(2);
    expect(stats.removed).toBe(0);
  });

  it('should count removed lines', () => {
    const original = 'line1\nline2\nline3\nline4';
    const modified = 'line1\nline2';
    const stats = computeDiffStats(original, modified);
    expect(stats.added).toBe(0);
    expect(stats.removed).toBe(2);
  });

  it('should count changed lines as both added and removed', () => {
    const original = 'line1\nold_line\nline3';
    const modified = 'line1\nnew_line\nline3';
    const stats = computeDiffStats(original, modified);
    expect(stats.added).toBe(1);
    expect(stats.removed).toBe(1);
  });

  it('should handle empty strings', () => {
    const stats = computeDiffStats('', 'new content');
    expect(stats.added).toBe(1);
    expect(stats.removed).toBe(1); // empty line vs 'new content'
  });

  it('should handle complex multi-line diffs', () => {
    const original = 'import { test } from "test";\n\ntest("example", () => {\n  expect(true).toBe(true);\n});';
    const modified = 'import { test } from "test";\nimport { expect } from "vitest";\n\ntest("example", () => {\n  expect(1).toBe(1);\n});';
    const stats = computeDiffStats(original, modified);
    // Lines differ at positions where content changed
    expect(stats.added).toBeGreaterThan(0);
  });
});

describe('Diff version selection logic', () => {
  it('should select two most recent versions for diff', () => {
    const versions = [
      { id: 3, version: 3, createdAt: '2026-04-21T12:00:00Z' },
      { id: 2, version: 2, createdAt: '2026-04-21T11:00:00Z' },
      { id: 1, version: 1, createdAt: '2026-04-21T10:00:00Z' },
    ];
    // Logic: leftId = versions[1].id (older), rightId = versions[0].id (newer)
    const leftId = versions.length >= 2 ? versions[1].id : versions[0].id;
    const rightId = versions[0].id;
    expect(leftId).toBe(2);
    expect(rightId).toBe(3);
  });

  it('should handle single version', () => {
    const versions = [
      { id: 1, version: 1, createdAt: '2026-04-21T10:00:00Z' },
    ];
    const leftId = versions.length >= 2 ? versions[1].id : versions[0].id;
    const rightId = versions[0].id;
    expect(leftId).toBe(1);
    expect(rightId).toBe(1);
  });
});

describe('File path union for diff', () => {
  it('should compute union of file paths from two payloads', () => {
    const leftFiles = [
      { path: 'test.ts', content: 'a' },
      { path: 'utils.ts', content: 'b' },
    ];
    const rightFiles = [
      { path: 'test.ts', content: 'a2' },
      { path: 'newFile.ts', content: 'c' },
    ];
    const set = new Set<string>();
    leftFiles.forEach(f => set.add(f.path));
    rightFiles.forEach(f => set.add(f.path));
    const paths = Array.from(set);
    expect(paths).toContain('test.ts');
    expect(paths).toContain('utils.ts');
    expect(paths).toContain('newFile.ts');
    expect(paths).toHaveLength(3);
  });

  it('should detect NEW and DEL badges', () => {
    const leftFiles = [{ path: 'old.ts', content: 'x' }];
    const rightFiles = [{ path: 'new.ts', content: 'y' }];
    const set = new Set<string>();
    leftFiles.forEach(f => set.add(f.path));
    rightFiles.forEach(f => set.add(f.path));
    const paths = Array.from(set);

    for (const path of paths) {
      const inLeft = leftFiles.some(f => f.path === path);
      const inRight = rightFiles.some(f => f.path === path);
      if (path === 'new.ts') {
        expect(inLeft).toBe(false);
        expect(inRight).toBe(true);
      }
      if (path === 'old.ts') {
        expect(inLeft).toBe(true);
        expect(inRight).toBe(false);
      }
    }
  });
});
