/**
 * LocalStore — Stockage localStorage pour le mode autonome (sans API backend).
 * Chaque collection est stockée sous une clé préfixée "agilestest_".
 * Les méthodes reproduisent le comportement des APIs REST.
 */

import type {
  Project, CreateProjectRequest, UpdateProjectRequest,
  TestProfile, TestScenario, Dataset, DatasetType,
  Execution, Artifact, Incident,
  CaptureJob, CaptureDetail, CreateCaptureRequest,
  Probe, ProbeWithPolicy, ProbeWithScope, CreateProbeRequest, UpdateProbeRequest,
  PaginatedResponse, AuditLogEntry,
} from '../types';
import { DATASET_TYPE_CATALOG } from '../config/datasetTypeCatalog';

// ─── Helpers ────────────────────────────────────────────────────────────────

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function now(): string {
  return new Date().toISOString();
}

function getCollection<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(`agilestest_${key}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setCollection<T>(key: string, data: T[]): void {
  localStorage.setItem(`agilestest_${key}`, JSON.stringify(data));
}

function paginate<T>(items: T[], page = 1, limit = 50): PaginatedResponse<T> {
  const total = items.length;
  const total_pages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  return {
    data: items.slice(start, start + limit),
    pagination: { page, limit, total, total_pages },
  };
}

// ─── Projects ───────────────────────────────────────────────────────────────

export const localProjects = {
  list(params?: { page?: number; limit?: number; status?: string; domain?: string }): PaginatedResponse<Project> {
    let items = getCollection<Project>('projects');
    if (params?.status) items = items.filter(p => p.status === params.status);
    if (params?.domain) items = items.filter(p => p.domain === params.domain);
    return paginate(items, params?.page, params?.limit);
  },

  get(id: string): Project {
    const item = getCollection<Project>('projects').find(p => p.id === id);
    if (!item) throw new Error('Projet introuvable');
    return item;
  },

  create(data: CreateProjectRequest): Project {
    const items = getCollection<Project>('projects');
    const project: Project = {
      id: uid(),
      name: data.name,
      description: data.description || '',
      domain: data.domain,
      status: 'ACTIVE',
      created_by: 'local-admin-001',
      created_at: now(),
      updated_at: now(),
    };
    items.push(project);
    setCollection('projects', items);
    return project;
  },

  update(id: string, data: UpdateProjectRequest): Project {
    const items = getCollection<Project>('projects');
    const idx = items.findIndex(p => p.id === id);
    if (idx === -1) throw new Error('Projet introuvable');
    items[idx] = { ...items[idx], ...data, updated_at: now() };
    setCollection('projects', items);
    return items[idx];
  },

  delete(id: string): void {
    const items = getCollection<Project>('projects').filter(p => p.id !== id);
    setCollection('projects', items);
  },
};

// ─── Profiles ───────────────────────────────────────────────────────────────

export const localProfiles = {
  list(projectId: string, params?: { page?: number; limit?: number; test_type?: string; domain?: string }): PaginatedResponse<TestProfile> {
    let items = getCollection<TestProfile>('profiles').filter(p => p.project_id === projectId);
    if (params?.test_type) items = items.filter(p => p.test_type === params.test_type);
    if (params?.domain) items = items.filter(p => p.domain === params.domain);
    return paginate(items, params?.page, params?.limit);
  },

  get(id: string): TestProfile {
    const item = getCollection<TestProfile>('profiles').find(p => p.id === id);
    if (!item) throw new Error('Profil introuvable');
    return item;
  },

  create(projectId: string, data: Partial<TestProfile>): TestProfile {
    // Validation : test_type obligatoire
    if (!data.test_type || !['VABF', 'VSR', 'VABE'].includes(data.test_type)) {
      throw new Error('Le champ test_type est obligatoire (VABF, VSR ou VABE).');
    }
    const items = getCollection<TestProfile>('profiles');
    const profile: TestProfile = {
      id: uid(),
      project_id: projectId,
      name: data.name || 'Nouveau profil',
      description: data.description || '',
      protocol: data.protocol || 'CUSTOM',
      test_type: data.test_type,
      domain: data.domain || undefined,
      profile_type: data.profile_type || undefined,
      target_host: data.target_host || '',
      target_port: data.target_port || 0,
      parameters: data.parameters || {},
      config: data.config || {},
      created_at: now(),
      updated_at: now(),
    };
    items.push(profile);
    setCollection('profiles', items);
    return profile;
  },

  update(id: string, data: Partial<TestProfile>): TestProfile {
    const items = getCollection<TestProfile>('profiles');
    const idx = items.findIndex(p => p.id === id);
    if (idx === -1) throw new Error('Profil introuvable');
    // Règle : test_type non modifiable si des scénarios sont attachés
    if (data.test_type && data.test_type !== items[idx].test_type) {
      const scenarios = getCollection<{profile_id: string}>('scenarios');
      const hasScenarios = scenarios.some(s => s.profile_id === id);
      if (hasScenarios) {
        throw new Error('Impossible de modifier test_type : des scénarios sont attachés à ce profil (409).');
      }
    }
    items[idx] = { ...items[idx], ...data, updated_at: now() };
    setCollection('profiles', items);
    return items[idx];
  },

  delete(id: string): void {
    const items = getCollection<TestProfile>('profiles').filter(p => p.id !== id);
    setCollection('profiles', items);
  },
};

// ─── Domain Code Mapping ───────────────────────────────────────────────────

const DOMAIN_CODE_MAP: Record<string, string> = {
  WEB: 'WEB', API: 'API', MOBILE: 'MOB', DESKTOP: 'DESK',
  TELECOM_IMS: 'IMS', TELECOM_RAN: 'RAN', TELECOM_EPC: 'EPC4',
  TELECOM_5GC_SA: '5GSA', TELECOM_5GC_NSA: '5GNSA',
  IOT: 'DRIVE', IMS: 'IMS', RAN: 'RAN', EPC: 'EPC4', '5GC': '5GSA',
};

function getDomainCode(domain: string): string {
  return DOMAIN_CODE_MAP[domain] || domain.slice(0, 4).toUpperCase();
}

function slugify(text: string): string {
  return text
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);
}

// ─── Audit Log ─────────────────────────────────────────────────────────────

export const localAuditLog = {
  list(params?: { project_id?: string; action?: string }): AuditLogEntry[] {
    let items = getCollection<AuditLogEntry>('audit_log');
    if (params?.project_id) items = items.filter(e => e.project_id === params.project_id);
    if (params?.action) items = items.filter(e => e.action === params.action);
    return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },

  add(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): AuditLogEntry {
    const items = getCollection<AuditLogEntry>('audit_log');
    const full: AuditLogEntry = { ...entry, id: uid(), timestamp: now() };
    items.push(full);
    setCollection('audit_log', items);
    return full;
  },
};

// ─── Scenarios ──────────────────────────────────────────────────────────────

export const localScenarios = {
  list(profileId: string, params?: { page?: number; limit?: number; status?: string }): PaginatedResponse<TestScenario> {
    let items = getCollection<TestScenario>('scenarios').filter(s => s.profile_id === profileId);
    if (params?.status) items = items.filter(s => s.status === params.status);
    return paginate(items, params?.page, params?.limit);
  },

  listByProject(projectId: string, params?: { page?: number; limit?: number; status?: string }): PaginatedResponse<TestScenario> {
    let items = getCollection<TestScenario>('scenarios').filter(s => s.project_id === projectId);
    if (params?.status) items = items.filter(s => s.status === params.status);
    return paginate(items, params?.page, params?.limit);
  },

  get(id: string): TestScenario {
    const item = getCollection<TestScenario>('scenarios').find(s => s.id === id);
    if (!item) throw new Error('Scénario introuvable');
    return item;
  },

  /** Réserve le prochain NNN pour un (project_id, test_type, domain_code) — anti-collision */
  nextId(projectId: string, testType: string, domain: string): { nnn: number; code_prefix: string } {
    const domainCode = getDomainCode(domain);
    const prefix = `${testType}-${domainCode}`;
    const items = getCollection<TestScenario>('scenarios').filter(s => s.project_id === projectId);
    // Trouver le plus grand NNN existant pour ce préfixe
    let maxN = 0;
    const regex = new RegExp(`^${prefix}-(\\d{3})`);
    for (const s of items) {
      if (s.scenario_code) {
        const m = s.scenario_code.match(regex);
        if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
      }
    }
    return { nnn: maxN + 1, code_prefix: prefix };
  },

  /** Génère un scenario_code normalisé : TESTTYPE-DOMAINCODE-NNN-SLUG */
  generateCode(projectId: string, testType: string, domain: string, title: string): string {
    const { nnn, code_prefix } = this.nextId(projectId, testType, domain);
    const slug = slugify(title);
    return `${code_prefix}-${nnn.toString().padStart(3, '0')}-${slug}`;
  },

  /** Vérifie si un scenario_code existe déjà */
  codeExists(projectId: string, code: string): boolean {
    return getCollection<TestScenario>('scenarios')
      .some(s => s.project_id === projectId && s.scenario_code === code);
  },

  create(profileId: string, projectId: string, data: Partial<TestScenario>): TestScenario {
    const items = getCollection<TestScenario>('scenarios');
    const scenario: TestScenario = {
      id: uid(),
      profile_id: profileId,
      project_id: projectId,
      scenario_code: data.scenario_code || undefined,
      name: data.name || 'Nouveau scénario',
      description: data.description || '',
      steps: data.steps || [],
      status: data.status || 'DRAFT',
      version: data.version || 1,
      required_dataset_types: data.required_dataset_types || [],
      metadata: data.metadata || undefined,
      created_at: now(),
      updated_at: now(),
    };
    items.push(scenario);
    setCollection('scenarios', items);
    return scenario;
  },

  update(id: string, data: Partial<TestScenario>): TestScenario {
    const items = getCollection<TestScenario>('scenarios');
    const idx = items.findIndex(s => s.id === id);
    if (idx === -1) throw new Error('Scénario introuvable');
    const current = items[idx];
    // Règle : un scénario FINAL ne peut pas être modifié directement (MVP : interdit)
    if (current.status === 'FINAL' && data.status !== 'DEPRECATED') {
      // Fork : incrémenter la version
      const newVersion = (current.version || 1) + 1;
      items[idx] = { ...current, ...data, version: newVersion, status: 'DRAFT', updated_at: now() };
    } else {
      items[idx] = { ...current, ...data, updated_at: now() };
    }
    setCollection('scenarios', items);
    return items[idx];
  },

  /** Finaliser un scénario (DRAFT → FINAL) avec validation bloquante */
  finalize(id: string): { success: boolean; errors: string[] } {
    const items = getCollection<TestScenario>('scenarios');
    const idx = items.findIndex(s => s.id === id);
    if (idx === -1) return { success: false, errors: ['Scénario introuvable'] };
    const s = items[idx];
    const errors: string[] = [];
    if (!s.name || s.name.trim().length === 0) errors.push('Le titre est obligatoire.');
    if (!s.steps || s.steps.length === 0) errors.push('Au moins 1 étape est requise.');
    if (s.steps && !s.steps.some(st => st.expected_result && st.expected_result.trim().length > 0)) {
      errors.push('Au moins 1 résultat attendu est requis.');
    }
    // Vérifier required_inputs pour UI/API
    if (errors.length > 0) return { success: false, errors };
    items[idx] = { ...s, status: 'FINAL', updated_at: now() };
    setCollection('scenarios', items);
    // Audit
    localAuditLog.add({
      actor_user_id: 'local-admin-001',
      project_id: s.project_id,
      profile_id: s.profile_id,
      action: 'FINALIZE',
      imported_ids: [s.id],
    });
    return { success: true, errors: [] };
  },

  /** Déprécier un scénario (FINAL → DEPRECATED) */
  deprecate(id: string): TestScenario {
    const items = getCollection<TestScenario>('scenarios');
    const idx = items.findIndex(s => s.id === id);
    if (idx === -1) throw new Error('Scénario introuvable');
    items[idx] = { ...items[idx], status: 'DEPRECATED', updated_at: now() };
    setCollection('scenarios', items);
    localAuditLog.add({
      actor_user_id: 'local-admin-001',
      project_id: items[idx].project_id,
      profile_id: items[idx].profile_id,
      action: 'DEPRECATE',
      imported_ids: [id],
    });
    return items[idx];
  },

  delete(id: string): void {
    const items = getCollection<TestScenario>('scenarios').filter(s => s.id !== id);
    setCollection('scenarios', items);
  },
};

// ─── Dataset Types (Gabarits) ──────────────────────────────────────────────

function ensureDefaultDatasetTypes(): void {
  const existing = getCollection<DatasetType>('dataset_types');
  if (existing.length === 0) {
    const defaults: DatasetType[] = DATASET_TYPE_CATALOG.map(seed => ({
      id: seed.dataset_type_id,
      dataset_type_id: seed.dataset_type_id,
      domain: seed.domain,
      test_type: seed.test_type,
      name: seed.name,
      description: seed.description,
      schema_fields: seed.schema_fields,
      example_placeholders: seed.example_placeholders,
      tags: seed.tags,
      created_at: now(),
      updated_at: now(),
    }));
    setCollection('dataset_types', defaults);
  }
}

export const localDatasetTypes = {
  list(params?: { domain?: string; test_type?: string; page?: number; limit?: number }): PaginatedResponse<DatasetType> {
    ensureDefaultDatasetTypes();
    let items = getCollection<DatasetType>('dataset_types');
    if (params?.domain) {
      items = items.filter(dt => dt.domain === params.domain || dt.domain === 'API');
    }
    if (params?.test_type) {
      items = items.filter(dt => !dt.test_type || dt.test_type === params.test_type);
    }
    return paginate(items, params?.page, params?.limit);
  },

  get(id: string): DatasetType {
    ensureDefaultDatasetTypes();
    const item = getCollection<DatasetType>('dataset_types').find(dt => dt.id === id || dt.dataset_type_id === id);
    if (!item) throw new Error('Dataset Type introuvable');
    return item;
  },

  create(data: Partial<DatasetType>): DatasetType {
    ensureDefaultDatasetTypes();
    if (!data.dataset_type_id || !data.name || !data.domain) {
      throw new Error('dataset_type_id, name et domain sont obligatoires.');
    }
    const items = getCollection<DatasetType>('dataset_types');
    // Vérifier unicité du slug
    if (items.some(dt => dt.dataset_type_id === data.dataset_type_id)) {
      throw new Error(`Le dataset_type_id "${data.dataset_type_id}" existe déjà (409).`);
    }
    const dt: DatasetType = {
      id: data.dataset_type_id,
      dataset_type_id: data.dataset_type_id,
      domain: data.domain,
      test_type: data.test_type,
      name: data.name,
      description: data.description || '',
      schema_fields: data.schema_fields || [],
      example_placeholders: data.example_placeholders || {},
      tags: data.tags || [],
      created_at: now(),
      updated_at: now(),
    };
    items.push(dt);
    setCollection('dataset_types', items);
    return dt;
  },

  update(id: string, data: Partial<DatasetType>): DatasetType {
    ensureDefaultDatasetTypes();
    const items = getCollection<DatasetType>('dataset_types');
    const idx = items.findIndex(dt => dt.id === id || dt.dataset_type_id === id);
    if (idx === -1) throw new Error('Dataset Type introuvable');
    // Ne pas permettre de changer le slug si des scénarios le référencent
    if (data.dataset_type_id && data.dataset_type_id !== items[idx].dataset_type_id) {
      const scenarios = getCollection<{required_dataset_types?: string[]}>('scenarios');
      const isReferenced = scenarios.some(s => s.required_dataset_types?.includes(items[idx].dataset_type_id));
      if (isReferenced) {
        throw new Error('Impossible de modifier le slug : des scénarios référencent ce dataset type (409).');
      }
    }
    items[idx] = { ...items[idx], ...data, updated_at: now() };
    setCollection('dataset_types', items);
    return items[idx];
  },

  delete(id: string): void {
    ensureDefaultDatasetTypes();
    const items = getCollection<DatasetType>('dataset_types');
    const target = items.find(dt => dt.id === id || dt.dataset_type_id === id);
    if (!target) throw new Error('Dataset Type introuvable');
    // Vérifier qu'aucun scénario ne le référence
    const scenarios = getCollection<{required_dataset_types?: string[]}>('scenarios');
    const isReferenced = scenarios.some(s => s.required_dataset_types?.includes(target.dataset_type_id));
    if (isReferenced) {
      throw new Error('Impossible de supprimer : des scénarios référencent ce dataset type (409).');
    }
    setCollection('dataset_types', items.filter(dt => dt.id !== target.id));
  },

  /** Valider que tous les dataset_type_ids existent */
  validateRefs(datasetTypeIds: string[]): { valid: boolean; missing: string[] } {
    ensureDefaultDatasetTypes();
    const items = getCollection<DatasetType>('dataset_types');
    const knownIds = new Set(items.map(dt => dt.dataset_type_id));
    const missing = datasetTypeIds.filter(id => !knownIds.has(id));
    return { valid: missing.length === 0, missing };
  },
};

// ─── Datasets ───────────────────────────────────────────────────────────────

export const localDatasets = {
  list(projectId: string, params?: { page?: number; limit?: number }): PaginatedResponse<Dataset> {
    const items = getCollection<Dataset>('datasets').filter(d => d.project_id === projectId);
    return paginate(items, params?.page, params?.limit);
  },

  get(id: string): Dataset {
    const item = getCollection<Dataset>('datasets').find(d => d.id === id);
    if (!item) throw new Error('Dataset introuvable');
    return item;
  },

  create(projectId: string, data: { name: string; description?: string; format: 'CSV' | 'JSON' | 'YAML'; row_count?: number; size_bytes?: number }): Dataset {
    const items = getCollection<Dataset>('datasets');
    const dataset: Dataset = {
      id: uid(),
      project_id: projectId,
      name: data.name,
      description: data.description || '',
      format: data.format,
      row_count: data.row_count || 0,
      size_bytes: data.size_bytes || 0,
      storage_url: '',
      created_at: now(),
      updated_at: now(),
    };
    items.push(dataset);
    setCollection('datasets', items);
    return dataset;
  },

  delete(id: string): void {
    const items = getCollection<Dataset>('datasets').filter(d => d.id !== id);
    setCollection('datasets', items);
  },
};

// ─── Executions ─────────────────────────────────────────────────────────────

export const localExecutions = {
  list(projectId: string, params?: { page?: number; limit?: number; status?: string }): PaginatedResponse<Execution> {
    let items = getCollection<Execution>('executions').filter(e => e.project_id === projectId);
    if (params?.status) items = items.filter(e => e.status === params.status);
    // Trier par date de création décroissante
    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return paginate(items, params?.page, params?.limit);
  },

  get(id: string): Execution {
    const item = getCollection<Execution>('executions').find(e => e.id === id);
    if (!item) throw new Error('Exécution introuvable');
    return item;
  },

  create(projectId: string, data: { profile_id: string; scenario_id: string }): Execution {
    const items = getCollection<Execution>('executions');
    const execution: Execution = {
      id: uid(),
      project_id: projectId,
      profile_id: data.profile_id,
      scenario_id: data.scenario_id,
      status: 'PENDING',
      runner_type: 'local',
      started_at: null,
      finished_at: null,
      duration_ms: null,
      artifacts_count: 0,
      incidents_count: 0,
      created_at: now(),
      updated_at: now(),
    };
    items.push(execution);
    setCollection('executions', items);

    // Simuler le démarrage après 1s
    setTimeout(() => {
      const all = getCollection<Execution>('executions');
      const idx = all.findIndex(e => e.id === execution.id);
      if (idx !== -1) {
        all[idx].status = 'RUNNING';
        all[idx].started_at = now();
        setCollection('executions', all);

        // Simuler la fin après 3-8s
        const duration = 3000 + Math.random() * 5000;
        setTimeout(() => {
          const all2 = getCollection<Execution>('executions');
          const idx2 = all2.findIndex(e => e.id === execution.id);
          if (idx2 !== -1) {
            all2[idx2].status = Math.random() > 0.3 ? 'PASSED' : 'FAILED';
            all2[idx2].finished_at = now();
            all2[idx2].duration_ms = Math.round(duration);
            setCollection('executions', all2);
          }
        }, duration);
      }
    }, 1000);

    return execution;
  },
};

// ─── Artifacts (local stubs) ────────────────────────────────────────────────

export const localArtifacts = {
  list(executionId: string): PaginatedResponse<Artifact> {
    const items = getCollection<Artifact>('artifacts').filter(a => a.execution_id === executionId);
    return paginate(items);
  },
};

// ─── Incidents (local stubs) ────────────────────────────────────────────────

export const localIncidents = {
  list(executionId: string): PaginatedResponse<Incident> {
    const items = getCollection<Incident>('incidents').filter(i => i.execution_id === executionId);
    return paginate(items);
  },
};

// ─── Captures ───────────────────────────────────────────────────────────────

export const localCaptures = {
  list(executionId: string): { data: CaptureJob[]; total: number } {
    const items = getCollection<CaptureJob>('captures').filter(c => c.execution_id === executionId);
    return { data: items, total: items.length };
  },

  get(captureId: string): CaptureDetail {
    const item = getCollection<CaptureJob>('captures').find(c => c.capture_id === captureId);
    if (!item) throw new Error('Capture introuvable');
    return { ...item, sources: [], artifacts: [] };
  },

  create(data: CreateCaptureRequest): CaptureDetail {
    const items = getCollection<CaptureJob>('captures');
    const capture: CaptureJob = {
      capture_id: uid(),
      execution_id: data.execution_id,
      incident_id: data.incident_id || null,
      project_id: data.project_id,
      triggered_by: 'local-admin-001',
      status: 'QUEUED',
      capture_type: data.capture_type,
      target_type: data.target_type,
      duration_seconds: data.duration_seconds || 60,
      max_size_mb: data.max_size_mb || 100,
      profile: data.profile || null,
      params: null,
      error_message: null,
      started_at: null,
      completed_at: null,
      created_at: now(),
    };
    items.push(capture);
    setCollection('captures', items);
    return { ...capture, sources: [], artifacts: [] };
  },
};

// ─── Probes ─────────────────────────────────────────────────────────────────

export const localProbes = {
  list(params?: { status?: string; type?: string; site?: string; zone?: string; project_id?: string }): { data: Probe[]; total: number } {
    let items = getCollection<Probe>('probes');
    if (params?.status) items = items.filter(p => p.status === params.status);
    if (params?.type) items = items.filter(p => p.type === params.type);
    if (params?.site) items = items.filter(p => p.site === params.site);
    if (params?.zone) items = items.filter(p => p.zone === params.zone);
    return { data: items, total: items.length };
  },

  get(probeId: string): ProbeWithScope {
    const item = getCollection<Probe>('probes').find(p => p.probe_id === probeId);
    if (!item) throw new Error('Sonde introuvable');
    return { ...item, project_ids: [], policy: null };
  },

  create(data: CreateProbeRequest): ProbeWithPolicy & { auth_token: string } {
    const items = getCollection<Probe>('probes');
    const probe: Probe = {
      probe_id: data.probe_id,
      site: data.site,
      zone: data.zone,
      type: data.type,
      capabilities: data.capabilities,
      status: 'OFFLINE',
      auth_token_hash: null,
      last_seen_at: null,
      metadata: null,
      created_at: now(),
      updated_at: now(),
    };
    items.push(probe);
    setCollection('probes', items);
    const token = `probe-token-${uid()}`;
    return { ...probe, policy: null, auth_token: token };
  },

  update(probeId: string, data: UpdateProbeRequest): ProbeWithPolicy {
    const items = getCollection<Probe>('probes');
    const idx = items.findIndex(p => p.probe_id === probeId);
    if (idx === -1) throw new Error('Sonde introuvable');
    if (data.site) items[idx].site = data.site;
    if (data.zone) items[idx].zone = data.zone;
    if (data.capabilities) items[idx].capabilities = data.capabilities;
    items[idx].updated_at = now();
    setCollection('probes', items);
    return { ...items[idx], policy: null };
  },

  delete(probeId: string): void {
    const items = getCollection<Probe>('probes').filter(p => p.probe_id !== probeId);
    setCollection('probes', items);
  },

  regenerateToken(probeId: string): { token: string } {
    return { token: `probe-token-${uid()}` };
  },
};
