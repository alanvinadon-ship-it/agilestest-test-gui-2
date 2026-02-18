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
  DatasetInstance, TargetEnv, DatasetInstanceStatus,
  DatasetBundle, BundleStatus, BundleItem, DatasetSecretKey,
  BundleValidationResult, ScenarioDatasetValidation,
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

// ─── Dataset Instances (DATASET-1) ────────────────────────────────────────

export const localDatasetInstances = {
  list(projectId: string, params?: {
    env?: TargetEnv; dataset_type_id?: string; status?: DatasetInstanceStatus;
    page?: number; limit?: number;
  }): PaginatedResponse<DatasetInstance> {
    let items = getCollection<DatasetInstance>('dataset_instances').filter(d => d.project_id === projectId);
    if (params?.env) items = items.filter(d => d.env === params.env);
    if (params?.dataset_type_id) items = items.filter(d => d.dataset_type_id === params.dataset_type_id);
    if (params?.status) items = items.filter(d => d.status === params.status);
    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return paginate(items, params?.page, params?.limit);
  },

  get(id: string): DatasetInstance {
    const item = getCollection<DatasetInstance>('dataset_instances').find(d => d.dataset_id === id);
    if (!item) throw new Error('Dataset instance introuvable');
    return item;
  },

  create(projectId: string, data: {
    dataset_type_id: string; env: TargetEnv; values_json?: Record<string, unknown>; notes?: string;
  }): DatasetInstance {
    // Vérifier que le dataset_type_id existe
    const dtItems = getCollection<DatasetType>('dataset_types');
    const dt = dtItems.find(t => t.dataset_type_id === data.dataset_type_id);
    if (!dt) throw new Error(`Dataset type "${data.dataset_type_id}" introuvable.`);

    // Pré-remplir les valeurs depuis les exemples du gabarit
    const defaultValues: Record<string, unknown> = {};
    if (dt.example_placeholders) {
      for (const [key, val] of Object.entries(dt.example_placeholders)) {
        defaultValues[key] = String(val).replace(/\{\{index\}\}/g, '1');
      }
    }

    const items = getCollection<DatasetInstance>('dataset_instances');
    const instance: DatasetInstance = {
      dataset_id: uid(),
      project_id: projectId,
      dataset_type_id: data.dataset_type_id,
      env: data.env,
      version: 1,
      status: 'DRAFT',
      values_json: data.values_json || defaultValues,
      notes: data.notes || '',
      created_by: 'local-admin-001',
      created_at: now(),
      updated_at: now(),
    };
    items.push(instance);
    setCollection('dataset_instances', items);
    return instance;
  },

  update(id: string, data: Partial<Pick<DatasetInstance, 'values_json' | 'status' | 'notes'>>): DatasetInstance {
    const items = getCollection<DatasetInstance>('dataset_instances');
    const idx = items.findIndex(d => d.dataset_id === id);
    if (idx === -1) throw new Error('Dataset instance introuvable');
    if (data.values_json !== undefined) items[idx].values_json = data.values_json;
    if (data.status !== undefined) items[idx].status = data.status;
    if (data.notes !== undefined) items[idx].notes = data.notes;
    items[idx].updated_at = now();
    setCollection('dataset_instances', items);
    return items[idx];
  },

  clone(id: string): DatasetInstance {
    const items = getCollection<DatasetInstance>('dataset_instances');
    const source = items.find(d => d.dataset_id === id);
    if (!source) throw new Error('Dataset instance introuvable');
    // Trouver la version max pour ce (project_id, dataset_type_id, env)
    const sameGroup = items.filter(d =>
      d.project_id === source.project_id &&
      d.dataset_type_id === source.dataset_type_id &&
      d.env === source.env
    );
    const maxVersion = Math.max(...sameGroup.map(d => d.version), 0);
    const clone: DatasetInstance = {
      ...source,
      dataset_id: uid(),
      version: maxVersion + 1,
      status: 'DRAFT',
      created_at: now(),
      updated_at: now(),
    };
    items.push(clone);
    setCollection('dataset_instances', items);
    return clone;
  },

  delete(id: string): void {
    // Vérifier qu'il n'est pas dans un bundle ACTIVE
    const bundleItems = getCollection<BundleItem>('bundle_items');
    const bundles = getCollection<DatasetBundle>('dataset_bundles');
    const linkedBundleIds = bundleItems.filter(bi => bi.dataset_id === id).map(bi => bi.bundle_id);
    const activeBundles = bundles.filter(b => linkedBundleIds.includes(b.bundle_id) && b.status === 'ACTIVE');
    if (activeBundles.length > 0) {
      throw new Error(`Impossible de supprimer : ce dataset est utilisé dans ${activeBundles.length} bundle(s) ACTIVE.`);
    }
    // Supprimer les bundle_items liés
    setCollection('bundle_items', bundleItems.filter(bi => bi.dataset_id !== id));
    // Supprimer les secrets liés
    const secrets = getCollection<DatasetSecretKey>('dataset_secrets').filter(s => s.dataset_id !== id);
    setCollection('dataset_secrets', secrets);
    // Supprimer l'instance
    const items = getCollection<DatasetInstance>('dataset_instances').filter(d => d.dataset_id !== id);
    setCollection('dataset_instances', items);
  },
};

// ─── Dataset Secret Keys ──────────────────────────────────────────────────

export const localDatasetSecrets = {
  list(datasetId: string): DatasetSecretKey[] {
    return getCollection<DatasetSecretKey>('dataset_secrets').filter(s => s.dataset_id === datasetId);
  },

  set(datasetId: string, keyPath: string, isSecret: boolean): DatasetSecretKey {
    const items = getCollection<DatasetSecretKey>('dataset_secrets');
    const idx = items.findIndex(s => s.dataset_id === datasetId && s.key_path === keyPath);
    if (idx !== -1) {
      items[idx].is_secret = isSecret;
    } else {
      items.push({ dataset_id: datasetId, key_path: keyPath, is_secret: isSecret });
    }
    setCollection('dataset_secrets', items);
    return items.find(s => s.dataset_id === datasetId && s.key_path === keyPath)!;
  },

  remove(datasetId: string, keyPath: string): void {
    const items = getCollection<DatasetSecretKey>('dataset_secrets')
      .filter(s => !(s.dataset_id === datasetId && s.key_path === keyPath));
    setCollection('dataset_secrets', items);
  },

  /** Masque les valeurs secrètes dans un values_json */
  maskValues(datasetId: string, valuesJson: Record<string, unknown>): Record<string, unknown> {
    const secrets = this.list(datasetId);
    const secretPaths = new Set(secrets.filter(s => s.is_secret).map(s => s.key_path));
    const masked = { ...valuesJson };
    for (const key of Object.keys(masked)) {
      if (secretPaths.has(key)) {
        masked[key] = '••••••••';
      }
    }
    return masked;
  },
};

// ─── Dataset Bundles ──────────────────────────────────────────────────────

export const localBundles = {
  list(projectId: string, params?: {
    env?: TargetEnv; status?: BundleStatus; page?: number; limit?: number;
  }): PaginatedResponse<DatasetBundle> {
    let items = getCollection<DatasetBundle>('dataset_bundles').filter(b => b.project_id === projectId);
    if (params?.env) items = items.filter(b => b.env === params.env);
    if (params?.status) items = items.filter(b => b.status === params.status);
    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return paginate(items, params?.page, params?.limit);
  },

  get(id: string): DatasetBundle {
    const item = getCollection<DatasetBundle>('dataset_bundles').find(b => b.bundle_id === id);
    if (!item) throw new Error('Bundle introuvable');
    return item;
  },

  create(projectId: string, data: {
    name: string; env: TargetEnv; tags?: string[];
  }): DatasetBundle {
    const items = getCollection<DatasetBundle>('dataset_bundles');
    const bundle: DatasetBundle = {
      bundle_id: uid(),
      project_id: projectId,
      name: data.name,
      env: data.env,
      version: 1,
      status: 'DRAFT',
      tags: data.tags || [],
      created_by: 'local-admin-001',
      created_at: now(),
      updated_at: now(),
    };
    items.push(bundle);
    setCollection('dataset_bundles', items);
    return bundle;
  },

  update(id: string, data: Partial<Pick<DatasetBundle, 'name' | 'status' | 'tags'>>): DatasetBundle {
    const items = getCollection<DatasetBundle>('dataset_bundles');
    const idx = items.findIndex(b => b.bundle_id === id);
    if (idx === -1) throw new Error('Bundle introuvable');
    if (data.name !== undefined) items[idx].name = data.name;
    if (data.status !== undefined) items[idx].status = data.status;
    if (data.tags !== undefined) items[idx].tags = data.tags;
    items[idx].updated_at = now();
    setCollection('dataset_bundles', items);
    return items[idx];
  },

  clone(id: string): DatasetBundle {
    const items = getCollection<DatasetBundle>('dataset_bundles');
    const source = items.find(b => b.bundle_id === id);
    if (!source) throw new Error('Bundle introuvable');
    const sameGroup = items.filter(b => b.project_id === source.project_id && b.env === source.env);
    const maxVersion = Math.max(...sameGroup.map(b => b.version), 0);
    const clone: DatasetBundle = {
      ...source,
      bundle_id: uid(),
      name: `${source.name}_V${maxVersion + 1}`,
      version: maxVersion + 1,
      status: 'DRAFT',
      created_at: now(),
      updated_at: now(),
    };
    items.push(clone);
    setCollection('dataset_bundles', items);
    // Cloner les bundle_items
    const bundleItems = getCollection<BundleItem>('bundle_items');
    const sourceItems = bundleItems.filter(bi => bi.bundle_id === id);
    for (const si of sourceItems) {
      bundleItems.push({ bundle_id: clone.bundle_id, dataset_id: si.dataset_id });
    }
    setCollection('bundle_items', bundleItems);
    return clone;
  },

  delete(id: string): void {
    const items = getCollection<DatasetBundle>('dataset_bundles').filter(b => b.bundle_id !== id);
    setCollection('dataset_bundles', items);
    // Supprimer les bundle_items liés
    const bundleItems = getCollection<BundleItem>('bundle_items').filter(bi => bi.bundle_id !== id);
    setCollection('bundle_items', bundleItems);
  },
};

// ─── Bundle Items ─────────────────────────────────────────────────────────

export const localBundleItems = {
  list(bundleId: string): BundleItem[] {
    return getCollection<BundleItem>('bundle_items').filter(bi => bi.bundle_id === bundleId);
  },

  add(bundleId: string, datasetId: string): BundleItem {
    const items = getCollection<BundleItem>('bundle_items');
    // Vérifier doublon exact
    if (items.some(bi => bi.bundle_id === bundleId && bi.dataset_id === datasetId)) {
      throw new Error('Ce dataset est déjà dans ce bundle.');
    }
    // Vérifier doublon de dataset_type_id dans le bundle
    const bundle = localBundles.get(bundleId);
    const dataset = localDatasetInstances.get(datasetId);
    // Vérifier même env
    if (dataset.env !== bundle.env) {
      throw new Error(`Environnement incompatible : le dataset est ${dataset.env}, le bundle est ${bundle.env}.`);
    }
    const bundleDatasetIds = items.filter(bi => bi.bundle_id === bundleId).map(bi => bi.dataset_id);
    const allInstances = getCollection<DatasetInstance>('dataset_instances');
    const bundleDatasets = allInstances.filter(d => bundleDatasetIds.includes(d.dataset_id));
    if (bundleDatasets.some(d => d.dataset_type_id === dataset.dataset_type_id)) {
      throw new Error(`Conflit : le bundle contient déjà un dataset de type "${dataset.dataset_type_id}". Un seul par type autorisé.`);
    }
    const bi: BundleItem = { bundle_id: bundleId, dataset_id: datasetId };
    items.push(bi);
    setCollection('bundle_items', items);
    return bi;
  },

  remove(bundleId: string, datasetId: string): void {
    const items = getCollection<BundleItem>('bundle_items')
      .filter(bi => !(bi.bundle_id === bundleId && bi.dataset_id === datasetId));
    setCollection('bundle_items', items);
  },
};

// ─── Validation Bundle ↔ Scénario ─────────────────────────────────────────

export const localValidation = {
  /** Valider un bundle pour un scénario donné */
  validateBundleForScenario(bundleId: string, scenarioId: string): BundleValidationResult {
    const scenario = localScenarios.get(scenarioId);
    const requiredTypes = scenario.required_dataset_types || [];
    const bundleItemsList = localBundleItems.list(bundleId);
    const allInstances = getCollection<DatasetInstance>('dataset_instances');
    const bundleDatasets = allInstances.filter(d =>
      bundleItemsList.some(bi => bi.dataset_id === d.dataset_id)
    );

    // Types couverts par le bundle
    const coveredTypes = new Set(bundleDatasets.map(d => d.dataset_type_id));
    const missingTypes = requiredTypes.filter(t => !coveredTypes.has(t));

    // Vérifier les conflits (>1 dataset par type)
    const typeCount: Record<string, string[]> = {};
    for (const d of bundleDatasets) {
      if (!typeCount[d.dataset_type_id]) typeCount[d.dataset_type_id] = [];
      typeCount[d.dataset_type_id].push(d.dataset_id);
    }
    const conflicts = Object.entries(typeCount)
      .filter(([, ids]) => ids.length > 1)
      .map(([dataset_type_id, dataset_ids]) => ({ dataset_type_id, dataset_ids }));

    // Validation schema (vérifier champs requis)
    const schemaErrors: Record<string, string[]> = {};
    const dtItems = getCollection<DatasetType>('dataset_types');
    for (const d of bundleDatasets) {
      const dt = dtItems.find(t => t.dataset_type_id === d.dataset_type_id);
      if (!dt) continue;
      const requiredFields = dt.schema_fields.filter(f => f.required);
      const errors: string[] = [];
      for (const field of requiredFields) {
        const val = d.values_json[field.name];
        if (val === undefined || val === null || val === '') {
          errors.push(`Champ requis "${field.name}" manquant ou vide.`);
        }
      }
      if (errors.length > 0) schemaErrors[d.dataset_type_id] = errors;
    }

    const warnings: string[] = [];
    const draftDatasets = bundleDatasets.filter(d => d.status === 'DRAFT');
    if (draftDatasets.length > 0) {
      warnings.push(`${draftDatasets.length} dataset(s) encore en DRAFT dans ce bundle.`);
    }

    return {
      ok: missingTypes.length === 0 && conflicts.length === 0,
      missing_types: missingTypes,
      conflicts,
      schema_errors_by_type: schemaErrors,
      warnings,
    };
  },

  /** Valider les datasets disponibles pour un scénario dans un env donné */
  validateScenarioDatasets(scenarioId: string, env: TargetEnv): ScenarioDatasetValidation {
    const scenario = localScenarios.get(scenarioId);
    const requiredTypes = scenario.required_dataset_types || [];
    const projectId = scenario.project_id;

    // Trouver tous les bundles pour cet env et ce projet
    const allBundles = getCollection<DatasetBundle>('dataset_bundles')
      .filter(b => b.project_id === projectId && b.env === env);
    const allBundleItems = getCollection<BundleItem>('bundle_items');
    const allInstances = getCollection<DatasetInstance>('dataset_instances');

    const compatibleBundles: ScenarioDatasetValidation['compatible_bundles'] = [];

    for (const bundle of allBundles) {
      const itemIds = allBundleItems.filter(bi => bi.bundle_id === bundle.bundle_id).map(bi => bi.dataset_id);
      const datasets = allInstances.filter(d => itemIds.includes(d.dataset_id));
      const coveredTypes = new Set(datasets.map(d => d.dataset_type_id));
      const allCovered = requiredTypes.every(t => coveredTypes.has(t));
      if (allCovered) {
        compatibleBundles.push({
          bundle_id: bundle.bundle_id,
          name: bundle.name,
          status: bundle.status,
          version: bundle.version,
        });
      }
    }

    // Trier : ACTIVE en premier
    compatibleBundles.sort((a, b) => {
      if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
      if (b.status === 'ACTIVE' && a.status !== 'ACTIVE') return 1;
      return 0;
    });

    // Types manquants globalement dans cet env
    const allEnvDatasets = allInstances.filter(d => d.project_id === projectId && d.env === env);
    const allEnvTypes = new Set(allEnvDatasets.map(d => d.dataset_type_id));
    const missingTypesGlobal = requiredTypes.filter(t => !allEnvTypes.has(t));

    return {
      compatible_bundles: compatibleBundles,
      missing_types_global: missingTypesGlobal,
      ok_for_env: compatibleBundles.length > 0,
    };
  },
};
