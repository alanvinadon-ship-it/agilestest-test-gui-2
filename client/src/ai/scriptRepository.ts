/**
 * ScriptRepository — CRUD pour les scripts générés par l'IA.
 *
 * Stockage memoryStore (in-memory) avec les mêmes patterns que localStore.
 * Les endpoints API sont définis pour le mode production.
 */
import type { GeneratedScript, ScriptFramework, ScriptStatus, CodeLanguage } from './types';
import type { TargetEnv, PaginatedResponse } from '../types';
import { memoryStore } from '../api/memoryStore';

const STORAGE_KEY = 'agilestest_generated_scripts';

// ─── Helpers ──────────────────────────────────────────────────────────────

function readAll(): GeneratedScript[] {
  try {
    const raw = memoryStore.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function writeAll(scripts: GeneratedScript[]): void {
  memoryStore.setItem(STORAGE_KEY, JSON.stringify(scripts));
}

function generateId(): string {
  return 'scr_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

// ─── CRUD ─────────────────────────────────────────────────────────────────

export const localScriptRepository = {

  /** Liste les scripts avec filtres optionnels */
  list(projectId: string, params?: {
    scenario_id?: string;
    framework?: ScriptFramework;
    status?: ScriptStatus;
    env?: TargetEnv;
    page?: number;
    limit?: number;
  }): PaginatedResponse<GeneratedScript> {
    let scripts = readAll().filter(s => s.project_id === projectId);

    if (params?.scenario_id) scripts = scripts.filter(s => s.scenario_id === params.scenario_id);
    if (params?.framework) scripts = scripts.filter(s => s.framework === params.framework);
    if (params?.status) scripts = scripts.filter(s => s.status === params.status);
    if (params?.env) scripts = scripts.filter(s => s.env === params.env);

    // Tri par date décroissante
    scripts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const page = params?.page || 1;
    const limit = params?.limit || 50;
    const total = scripts.length;
    const start = (page - 1) * limit;
    const data = scripts.slice(start, start + limit);

    return {
      data,
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    };
  },

  /** Récupère un script par ID */
  get(scriptId: string): GeneratedScript | null {
    return readAll().find(s => s.script_id === scriptId) || null;
  },

  /** Crée un nouveau script */
  create(data: {
    project_id: string;
    scenario_id: string;
    bundle_id: string;
    env: TargetEnv;
    framework: ScriptFramework;
    code_language: CodeLanguage;
    files: Array<{ path: string; content: string; language?: string }>;
    plan?: any;
    notes?: string;
    warnings?: string[];
  }): GeneratedScript {
    const scripts = readAll();
    const now = new Date().toISOString();

    // Calculer la version (max + 1 pour le même scenario + framework)
    const existing = scripts.filter(s =>
      s.scenario_id === data.scenario_id && s.framework === data.framework
    );
    const maxVersion = existing.reduce((max, s) => Math.max(max, s.version), 0);

    const script: GeneratedScript = {
      script_id: generateId(),
      project_id: data.project_id,
      scenario_id: data.scenario_id,
      bundle_id: data.bundle_id,
      env: data.env,
      framework: data.framework,
      code_language: data.code_language,
      version: maxVersion + 1,
      status: 'DRAFT',
      files: data.files,
      plan: data.plan,
      notes: data.notes,
      warnings: data.warnings,
      created_by: 'current_user',
      created_at: now,
      updated_at: now,
    };

    scripts.push(script);
    writeAll(scripts);
    return script;
  },

  /** Met à jour un script (status, notes) */
  update(scriptId: string, data: Partial<Pick<GeneratedScript, 'status' | 'notes' | 'files'>>): GeneratedScript {
    const scripts = readAll();
    const idx = scripts.findIndex(s => s.script_id === scriptId);
    if (idx === -1) throw new Error(`Script ${scriptId} not found`);

    scripts[idx] = {
      ...scripts[idx],
      ...data,
      updated_at: new Date().toISOString(),
    };
    writeAll(scripts);
    return scripts[idx];
  },

  /** Active une version (désactive les autres du même scenario+framework) */
  activate(scriptId: string): GeneratedScript {
    const scripts = readAll();
    const target = scripts.find(s => s.script_id === scriptId);
    if (!target) throw new Error(`Script ${scriptId} not found`);

    // Désactiver les autres versions du même scenario+framework
    for (const s of scripts) {
      if (s.scenario_id === target.scenario_id &&
          s.framework === target.framework &&
          s.script_id !== scriptId &&
          s.status === 'ACTIVE') {
        s.status = 'DEPRECATED';
        s.updated_at = new Date().toISOString();
      }
    }

    target.status = 'ACTIVE';
    target.updated_at = new Date().toISOString();
    writeAll(scripts);
    return target;
  },

  /** Supprime un script */
  delete(scriptId: string): void {
    const scripts = readAll().filter(s => s.script_id !== scriptId);
    writeAll(scripts);
  },

  /** Exporte un script en format zip-like (retourne les fichiers) */
  exportFiles(scriptId: string): Array<{ path: string; content: string }> | null {
    const script = readAll().find(s => s.script_id === scriptId);
    return script?.files || null;
  },

  /** Compte les scripts par scénario */
  countByScenario(projectId: string, scenarioId: string): number {
    return readAll().filter(s => s.project_id === projectId && s.scenario_id === scenarioId).length;
  },

  /** Récupère le script ACTIVE pour un scénario donné (le plus récent si plusieurs) */
  getActive(projectId: string, scenarioId: string): GeneratedScript | null {
    const scripts = readAll().filter(s =>
      s.project_id === projectId && s.scenario_id === scenarioId && s.status === 'ACTIVE'
    );
    if (scripts.length === 0) return null;
    scripts.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    return scripts[0];
  },

  /** Liste toutes les versions d'un scénario+framework */
  listVersions(projectId: string, scenarioId: string, framework?: ScriptFramework): GeneratedScript[] {
    let scripts = readAll().filter(s =>
      s.project_id === projectId && s.scenario_id === scenarioId
    );
    if (framework) scripts = scripts.filter(s => s.framework === framework);
    scripts.sort((a, b) => b.version - a.version);
    return scripts;
  },
};
