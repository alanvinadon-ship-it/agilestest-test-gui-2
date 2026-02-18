/**
 * LocalStore — Stockage localStorage pour le mode autonome (sans API backend).
 * Chaque collection est stockée sous une clé préfixée "agilestest_".
 * Les méthodes reproduisent le comportement des APIs REST.
 */

import type {
  Project, CreateProjectRequest, UpdateProjectRequest,
  TestProfile, TestScenario, Dataset, DatasetType,
  Execution, ExecutionStatus, Artifact, Incident,
  CaptureJob, CaptureDetail, CreateCaptureRequest,
  Probe, ProbeWithPolicy, ProbeWithScope, CreateProbeRequest, UpdateProbeRequest,
  PaginatedResponse, AuditLogEntry,
  DatasetInstance, TargetEnv, DatasetInstanceStatus,
  DatasetBundle, BundleStatus, BundleItem, DatasetSecretKey,
  BundleValidationResult, ScenarioDatasetValidation,
  RunnerJob, RunnerJobStatus, ArtifactUploadPolicy,
  JobCompletePayload, ArtifactManifestEntry, BundleResolveResult,
  DriveCampaign, CampaignStatus, NetworkType,
  DriveRoute, TestDevice, DriveProbeConfig,
  DriveJob, DriveJobStatus, DriveArtifactEntry,
  KpiSample, DriveKpi, DriveRunSummary, ThresholdViolation,
  DriveImportResult,
} from '../types';
import { DATASET_TYPE_CATALOG } from '../config/datasetTypeCatalog';
import type { CapturePolicy, CaptureSession, CaptureSessionStatus } from '../capture/types';
import { DEFAULT_CAPTURE_POLICY } from '../capture/types';

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

  create(projectId: string, data: {
    profile_id: string;
    scenario_id: string;
    script_id?: string;
    script_version?: number;
    dataset_bundle_id?: string;
    target_env?: TargetEnv;
    runner_id?: string;
    ai_repair_from_execution_id?: string;
  }): Execution {
    const items = getCollection<Execution>('executions');
    const execution: Execution = {
      id: uid(),
      project_id: projectId,
      profile_id: data.profile_id,
      scenario_id: data.scenario_id,
      status: 'PENDING',
      runner_type: 'local',
      script_id: data.script_id,
      script_version: data.script_version,
      dataset_bundle_id: data.dataset_bundle_id,
      target_env: data.target_env,
      runner_id: data.runner_id,
      ai_repair_from_execution_id: data.ai_repair_from_execution_id,
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
            const isFailed = Math.random() > 0.3 ? 'PASSED' : 'FAILED';
            all2[idx2].status = isFailed as ExecutionStatus;
            all2[idx2].finished_at = now();
            all2[idx2].duration_ms = Math.round(duration);
            // Simuler des artefacts et incidents pour les FAILED
            if (isFailed === 'FAILED') {
              all2[idx2].artifacts_count = 2;
              all2[idx2].incidents_count = 1;
              _generateSimulatedArtifacts(execution.id, data.scenario_id);
              _generateSimulatedIncidents(execution.id, projectId, data.scenario_id);
            } else {
              all2[idx2].artifacts_count = 1;
              _generateSimulatedArtifacts(execution.id, data.scenario_id);
            }
            setCollection('executions', all2);
          }
        }, duration);
      }
    }, 1000);

    return execution;
  },

  /** Clone une exécution (rerun) avec les mêmes références */
  rerun(executionId: string): Execution {
    const original = localExecutions.get(executionId);
    return localExecutions.create(original.project_id, {
      profile_id: original.profile_id,
      scenario_id: original.scenario_id,
      script_id: original.script_id,
      script_version: original.script_version,
      dataset_bundle_id: original.dataset_bundle_id,
      target_env: original.target_env,
      runner_id: original.runner_id,
    });
  },
};

/** Génère des artefacts simulés pour une exécution */
function _generateSimulatedArtifacts(executionId: string, scenarioId: string) {
  const artifacts = getCollection<Artifact>('artifacts');
  artifacts.push({
    id: uid(),
    execution_id: executionId,
    type: 'LOG',
    filename: `execution_${executionId.slice(0, 8)}.log`,
    mime_type: 'text/plain',
    size_bytes: 4096 + Math.floor(Math.random() * 8192),
    storage_path: `/logs/${executionId}.log`,
    s3_uri: null,
    checksum: null,
    capture_job_id: null,
    download_url: null,
    created_at: now(),
  });
  artifacts.push({
    id: uid(),
    execution_id: executionId,
    type: 'SCREENSHOT',
    filename: `failure_${scenarioId.slice(0, 8)}.png`,
    mime_type: 'image/png',
    size_bytes: 65536 + Math.floor(Math.random() * 32768),
    storage_path: `/screenshots/${executionId}.png`,
    s3_uri: null,
    checksum: null,
    capture_job_id: null,
    download_url: null,
    created_at: now(),
  });
  setCollection('artifacts', artifacts);
}

/** Génère des incidents simulés pour une exécution FAILED */
function _generateSimulatedIncidents(executionId: string, projectId: string, scenarioId: string) {
  const incidents = getCollection<Incident>('incidents');
  incidents.push({
    id: uid(),
    execution_id: executionId,
    project_id: projectId,
    title: `Assertion failed in scenario ${scenarioId.slice(0, 8)}`,
    description: 'Expected element to be visible but it was not found within timeout. The selector may have changed or the page did not load correctly.',
    severity: 'MAJOR',
    step_name: 'Step 2 - Vérification',
    expected_result: 'Element visible and interactable',
    actual_result: 'TimeoutError: locator.waitFor: Timeout 30000ms exceeded',
    detected_at: now(),
  });
  setCollection('incidents', incidents);
}

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
      // PROBE-HARDEN-1
      version: '1.0.0',
      uptime_seconds: 0,
      cpu_percent: 0,
      disk_free_mb: 0,
      interfaces: [],
      active_sessions: 0,
      total_captures: 0,
      last_error: null,
      health_status: 'unhealthy',
      heartbeat_interval_sec: 30,
      allowlist_cidrs: ['0.0.0.0/0'],
      tls_enabled: false,
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

  /** Simuler un heartbeat (met à jour last_seen, health, métriques) */
  heartbeat(probeId: string, payload?: {
    status?: 'healthy' | 'degraded' | 'unhealthy';
    version?: string;
    cpu_percent?: number;
    disk_free_mb?: number;
    interfaces?: string[];
    active_sessions?: number;
  }): Probe {
    const items = getCollection<Probe>('probes');
    const idx = items.findIndex(p => p.probe_id === probeId);
    if (idx === -1) throw new Error('Sonde introuvable');
    const healthStatus = payload?.status || 'healthy';
    items[idx] = {
      ...items[idx],
      status: healthStatus === 'unhealthy' ? 'OFFLINE' : healthStatus === 'degraded' ? 'DEGRADED' : 'ONLINE',
      last_seen_at: now(),
      health_status: healthStatus,
      version: payload?.version || items[idx].version || '1.0.0',
      cpu_percent: payload?.cpu_percent ?? items[idx].cpu_percent ?? 0,
      disk_free_mb: payload?.disk_free_mb ?? items[idx].disk_free_mb ?? 0,
      interfaces: payload?.interfaces || items[idx].interfaces || [],
      active_sessions: payload?.active_sessions ?? items[idx].active_sessions ?? 0,
      updated_at: now(),
    };
    setCollection('probes', items);
    return items[idx];
  },

  /** Récupérer le health d'une probe (simulation) */
  getHealth(probeId: string): {
    status: string; version: string; uptime_seconds: number;
    interfaces: Array<{ name: string; up: boolean; speed_mbps: number | null; rx_bytes: number; tx_bytes: number; promisc: boolean }>;
    disk_free_mb: number; cpu_percent: number; last_error: string | null;
    active_sessions: number; total_captures: number;
  } {
    const probe = getCollection<Probe>('probes').find(p => p.probe_id === probeId);
    if (!probe) throw new Error('Sonde introuvable');
    return {
      status: probe.health_status || (probe.status === 'ONLINE' ? 'healthy' : 'unhealthy'),
      version: probe.version || '1.0.0',
      uptime_seconds: probe.uptime_seconds || Math.floor(Math.random() * 86400),
      interfaces: (probe.interfaces || ['eth0', 'mirror0']).map(name => ({
        name, up: true, speed_mbps: 1000, rx_bytes: Math.floor(Math.random() * 1e9),
        tx_bytes: Math.floor(Math.random() * 1e8), promisc: name.includes('mirror'),
      })),
      disk_free_mb: probe.disk_free_mb || Math.floor(Math.random() * 50000) + 10000,
      cpu_percent: probe.cpu_percent || Math.floor(Math.random() * 40) + 5,
      last_error: probe.last_error || null,
      active_sessions: probe.active_sessions || 0,
      total_captures: probe.total_captures || Math.floor(Math.random() * 200),
    };
  },

  /** Lancer un test de capture (30s, dry run) */
  testCapture(probeId: string, iface: string): {
    success: boolean; packets_captured: number; bytes_captured: number;
    duration_sec: number; reason_code?: string; error_message?: string;
  } {
    const probe = getCollection<Probe>('probes').find(p => p.probe_id === probeId);
    if (!probe) return { success: false, packets_captured: 0, bytes_captured: 0, duration_sec: 0, reason_code: 'PROBE_OFFLINE', error_message: 'Sonde introuvable' };
    if (probe.status !== 'ONLINE') return { success: false, packets_captured: 0, bytes_captured: 0, duration_sec: 0, reason_code: 'PROBE_OFFLINE', error_message: 'Sonde hors ligne' };
    const ifaceExists = (probe.interfaces || []).length > 0;
    if (!ifaceExists && iface !== 'eth0' && iface !== 'mirror0') {
      return { success: false, packets_captured: 0, bytes_captured: 0, duration_sec: 0, reason_code: 'IFACE_NOT_FOUND', error_message: `Interface ${iface} introuvable` };
    }
    const packets = Math.floor(Math.random() * 5000) + 100;
    return {
      success: true,
      packets_captured: packets,
      bytes_captured: packets * (Math.floor(Math.random() * 800) + 64),
      duration_sec: 30,
    };
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

// ─── Runner Jobs (Orchestration) ──────────────────────────────────────────

export const localJobs = {
  /** Liste les jobs d'un projet */
  list(projectId: string, params?: { status?: RunnerJobStatus; runner_id?: string }): PaginatedResponse<RunnerJob> {
    let items = getCollection<RunnerJob>('runner_jobs').filter(j => j.project_id === projectId);
    if (params?.status) items = items.filter(j => j.status === params.status);
    if (params?.runner_id) items = items.filter(j => j.runner_id === params.runner_id);
    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return paginate(items);
  },

  /** Récupère un job par ID */
  get(jobId: string): RunnerJob {
    const item = getCollection<RunnerJob>('runner_jobs').find(j => j.job_id === jobId);
    if (!item) throw new Error('Job introuvable');
    return item;
  },

  /** Récupère le job lié à une exécution */
  getByExecution(executionId: string): RunnerJob | null {
    return getCollection<RunnerJob>('runner_jobs').find(j => j.execution_id === executionId) || null;
  },

  /** Crée un job PENDING pour une exécution */
  create(data: {
    execution_id: string;
    project_id: string;
    script_id: string;
    script_version: number;
    dataset_bundle_id?: string;
    target_env: TargetEnv;
    artifact_upload_policy?: ArtifactUploadPolicy[];
  }): RunnerJob {
    const items = getCollection<RunnerJob>('runner_jobs');
    const job: RunnerJob = {
      job_id: 'job_' + uid(),
      execution_id: data.execution_id,
      project_id: data.project_id,
      runner_id: null,
      status: 'PENDING',
      script_id: data.script_id,
      script_version: data.script_version,
      download_url: `/api/scripts/${data.script_id}/download`,
      dataset_bundle_id: data.dataset_bundle_id || null,
      target_env: data.target_env,
      artifact_upload_policy: data.artifact_upload_policy || ['screenshot', 'trace', 'log'],
      metrics: null,
      artifact_manifest: null,
      created_at: now(),
      started_at: null,
      finished_at: null,
    };
    items.push(job);
    setCollection('runner_jobs', items);
    return job;
  },

  /** Récupère le prochain job PENDING (lock pour un runner) */
  claimNext(runnerId: string): RunnerJob | null {
    const items = getCollection<RunnerJob>('runner_jobs');
    const pending = items.find(j => j.status === 'PENDING');
    if (!pending) return null;
    pending.status = 'RUNNING';
    pending.runner_id = runnerId;
    pending.started_at = now();
    setCollection('runner_jobs', items);

    // Mettre à jour l'exécution liée
    const executions = getCollection<Execution>('executions');
    const execIdx = executions.findIndex(e => e.id === pending.execution_id);
    if (execIdx !== -1) {
      executions[execIdx].status = 'RUNNING';
      executions[execIdx].runner_id = runnerId;
      executions[execIdx].started_at = now();
      setCollection('executions', executions);
    }

    return pending;
  },

  /** Heartbeat d'un job (mise à jour du timestamp) */
  heartbeat(jobId: string): void {
    // En local, pas d'action spécifique
  },

  /** Compléter un job (DONE ou FAILED) */
  complete(jobId: string, payload: JobCompletePayload): RunnerJob {
    const items = getCollection<RunnerJob>('runner_jobs');
    const idx = items.findIndex(j => j.job_id === jobId);
    if (idx === -1) throw new Error('Job introuvable');

    items[idx].status = payload.status;
    items[idx].finished_at = now();
    items[idx].metrics = payload.metrics;
    items[idx].artifact_manifest = payload.artifact_manifest;
    setCollection('runner_jobs', items);

    // Mettre à jour l'exécution liée
    const executions = getCollection<Execution>('executions');
    const execIdx = executions.findIndex(e => e.id === items[idx].execution_id);
    if (execIdx !== -1) {
      executions[execIdx].status = payload.status === 'DONE'
        ? (payload.metrics.failed > 0 ? 'FAILED' : 'PASSED')
        : 'ERROR';
      executions[execIdx].finished_at = now();
      executions[execIdx].duration_ms = payload.metrics.duration_ms;
      executions[execIdx].artifacts_count = payload.artifact_manifest.length;
      executions[execIdx].incidents_count = payload.metrics.failed;
      setCollection('executions', executions);

      // Créer les artefacts à partir du manifest
      if (payload.artifact_manifest.length > 0) {
        const artifacts = getCollection<Artifact>('artifacts');
        for (const entry of payload.artifact_manifest) {
          artifacts.push({
            id: uid(),
            execution_id: items[idx].execution_id,
            type: entry.type,
            filename: entry.filename,
            mime_type: entry.mime_type,
            size_bytes: entry.size_bytes,
            storage_path: entry.s3_key,
            s3_uri: entry.s3_uri,
            checksum: entry.checksum,
            capture_job_id: null,
            download_url: entry.download_url,
            created_at: now(),
          });
        }
        setCollection('artifacts', artifacts);
      }
    }

    return items[idx];
  },
};

// ─── Bundle Resolve ──────────────────────────────────────────────────────

export const localBundleResolve = {
  /** Résout un bundle en JSON fusionné (sans secrets en clair) */
  resolve(bundleId: string, env?: TargetEnv): BundleResolveResult {
    const bundle = getCollection<DatasetBundle>('dataset_bundles').find(b => b.bundle_id === bundleId);
    if (!bundle) throw new Error('Bundle introuvable');

    const bundleItems = getCollection<BundleItem>('dataset_bundle_items').filter(bi => bi.bundle_id === bundleId);
    const instances = getCollection<DatasetInstance>('dataset_instances');
    const secrets = getCollection<DatasetSecretKey>('dataset_secret_keys');

    const merged: Record<string, unknown> = {};
    const secretKeys: string[] = [];

    for (const item of bundleItems) {
      const instance = instances.find(d => d.dataset_id === item.dataset_id);
      if (!instance) continue;
      if (env && instance.env !== env) continue;

      // Fusionner les valeurs
      for (const [key, value] of Object.entries(instance.values_json)) {
        const fullKey = `${instance.dataset_type_id}.${key}`;
        // Vérifier si c'est un secret
        const isSecret = secrets.some(s => s.dataset_id === instance.dataset_id && s.key_path === key && s.is_secret);
        if (isSecret) {
          merged[fullKey] = `{{SECRET:${fullKey}}}`;
          secretKeys.push(fullKey);
        } else {
          merged[fullKey] = value;
        }
      }
    }

    return {
      bundle_id: bundleId,
      env: env || bundle.env,
      merged_json: merged,
      secrets_placeholder_keys: secretKeys,
      resolved_at: now(),
    };
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// Drive Test Domain — CRUD
// ═══════════════════════════════════════════════════════════════════════════

// ─── Drive Campaigns ──────────────────────────────────────────────────────

export const localDriveCampaigns = {
  list(projectId: string, params?: { page?: number; limit?: number; status?: CampaignStatus; network_type?: NetworkType; env?: TargetEnv }): PaginatedResponse<DriveCampaign> {
    let items = getCollection<DriveCampaign>('drive_campaigns').filter(c => c.project_id === projectId);
    if (params?.status) items = items.filter(c => c.status === params.status);
    if (params?.network_type) items = items.filter(c => c.network_type === params.network_type);
    if (params?.env) items = items.filter(c => c.target_env === params.env);
    return paginate(items, params?.page, params?.limit);
  },

  get(id: string): DriveCampaign {
    const item = getCollection<DriveCampaign>('drive_campaigns').find(c => c.campaign_id === id);
    if (!item) throw new Error('Campagne introuvable');
    return item;
  },

  create(projectId: string, data: Partial<DriveCampaign>): DriveCampaign {
    const items = getCollection<DriveCampaign>('drive_campaigns');
    const campaign: DriveCampaign = {
      campaign_id: uid(),
      project_id: projectId,
      name: data.name || 'Nouvelle campagne',
      description: data.description || '',
      target_env: data.target_env || 'DEV',
      network_type: data.network_type || '4G',
      area: data.area || '',
      start_date: data.start_date || now().split('T')[0],
      end_date: data.end_date || now().split('T')[0],
      status: 'DRAFT',
      created_by: 'local-admin-001',
      created_at: now(),
      updated_at: now(),
    };
    items.push(campaign);
    setCollection('drive_campaigns', items);
    return campaign;
  },

  update(id: string, data: Partial<DriveCampaign>): DriveCampaign {
    const items = getCollection<DriveCampaign>('drive_campaigns');
    const idx = items.findIndex(c => c.campaign_id === id);
    if (idx === -1) throw new Error('Campagne introuvable');
    items[idx] = { ...items[idx], ...data, updated_at: now() };
    setCollection('drive_campaigns', items);
    return items[idx];
  },

  updateStatus(id: string, status: CampaignStatus): DriveCampaign {
    return this.update(id, { status });
  },

  delete(id: string): void {
    const items = getCollection<DriveCampaign>('drive_campaigns').filter(c => c.campaign_id !== id);
    setCollection('drive_campaigns', items);
    // Cascade: supprimer les routes liées
    const routes = getCollection<DriveRoute>('drive_routes').filter(r => r.campaign_id !== id);
    setCollection('drive_routes', routes);
  },
};

// ─── Drive Routes ─────────────────────────────────────────────────────────

export const localDriveRoutes = {
  list(campaignId: string): DriveRoute[] {
    return getCollection<DriveRoute>('drive_routes').filter(r => r.campaign_id === campaignId);
  },

  get(id: string): DriveRoute {
    const item = getCollection<DriveRoute>('drive_routes').find(r => r.route_id === id);
    if (!item) throw new Error('Route introuvable');
    return item;
  },

  create(campaignId: string, data: Partial<DriveRoute>): DriveRoute {
    const items = getCollection<DriveRoute>('drive_routes');
    const route: DriveRoute = {
      route_id: uid(),
      campaign_id: campaignId,
      name: data.name || 'Nouvelle route',
      route_geojson: data.route_geojson || null,
      checkpoints_geojson: data.checkpoints_geojson || null,
      expected_duration_min: data.expected_duration_min || 30,
      created_at: now(),
      updated_at: now(),
    };
    items.push(route);
    setCollection('drive_routes', items);
    return route;
  },

  update(id: string, data: Partial<DriveRoute>): DriveRoute {
    const items = getCollection<DriveRoute>('drive_routes');
    const idx = items.findIndex(r => r.route_id === id);
    if (idx === -1) throw new Error('Route introuvable');
    items[idx] = { ...items[idx], ...data, updated_at: now() };
    setCollection('drive_routes', items);
    return items[idx];
  },

  delete(id: string): void {
    const items = getCollection<DriveRoute>('drive_routes').filter(r => r.route_id !== id);
    setCollection('drive_routes', items);
  },
};

// ─── Test Devices ─────────────────────────────────────────────────────────

export const localTestDevices = {
  list(projectId: string, params?: { page?: number; limit?: number; type?: string }): PaginatedResponse<TestDevice> {
    let items = getCollection<TestDevice>('test_devices').filter(d => d.project_id === projectId);
    if (params?.type) items = items.filter(d => d.type === params.type);
    return paginate(items, params?.page, params?.limit);
  },

  get(id: string): TestDevice {
    const item = getCollection<TestDevice>('test_devices').find(d => d.device_id === id);
    if (!item) throw new Error('Équipement introuvable');
    return item;
  },

  create(projectId: string, data: Partial<TestDevice>): TestDevice {
    const items = getCollection<TestDevice>('test_devices');
    const device: TestDevice = {
      device_id: uid(),
      project_id: projectId,
      type: data.type || 'ANDROID',
      model: data.model || '',
      os_version: data.os_version || '',
      diag_capable: data.diag_capable ?? false,
      tools_enabled: data.tools_enabled || [],
      notes: data.notes || '',
      created_at: now(),
      updated_at: now(),
    };
    items.push(device);
    setCollection('test_devices', items);
    return device;
  },

  update(id: string, data: Partial<TestDevice>): TestDevice {
    const items = getCollection<TestDevice>('test_devices');
    const idx = items.findIndex(d => d.device_id === id);
    if (idx === -1) throw new Error('Équipement introuvable');
    items[idx] = { ...items[idx], ...data, updated_at: now() };
    setCollection('test_devices', items);
    return items[idx];
  },

  delete(id: string): void {
    const items = getCollection<TestDevice>('test_devices').filter(d => d.device_id !== id);
    setCollection('test_devices', items);
  },
};

// ─── Drive Probe Configs ──────────────────────────────────────────────────

export const localDriveProbeConfigs = {
  list(projectId: string): DriveProbeConfig[] {
    return getCollection<DriveProbeConfig>('drive_probe_configs').filter(p => p.project_id === projectId);
  },

  get(id: string): DriveProbeConfig {
    const item = getCollection<DriveProbeConfig>('drive_probe_configs').find(p => p.probe_id === id);
    if (!item) throw new Error('Configuration sonde introuvable');
    return item;
  },

  create(projectId: string, data: Partial<DriveProbeConfig>): DriveProbeConfig {
    const items = getCollection<DriveProbeConfig>('drive_probe_configs');
    const config: DriveProbeConfig = {
      probe_id: uid(),
      project_id: projectId,
      name: data.name || 'Nouvelle sonde',
      location: data.location || 'RUNNER_HOST',
      capture_type: data.capture_type || 'PCAP',
      retention_days: data.retention_days ?? 30,
      max_size_mb: data.max_size_mb ?? 500,
      rotation: data.rotation ?? true,
      output_target: data.output_target || 'MINIO',
      enabled: data.enabled ?? true,
      created_at: now(),
      updated_at: now(),
    };
    items.push(config);
    setCollection('drive_probe_configs', items);
    return config;
  },

  update(id: string, data: Partial<DriveProbeConfig>): DriveProbeConfig {
    const items = getCollection<DriveProbeConfig>('drive_probe_configs');
    const idx = items.findIndex(p => p.probe_id === id);
    if (idx === -1) throw new Error('Configuration sonde introuvable');
    items[idx] = { ...items[idx], ...data, updated_at: now() };
    setCollection('drive_probe_configs', items);
    return items[idx];
  },

  delete(id: string): void {
    const items = getCollection<DriveProbeConfig>('drive_probe_configs').filter(p => p.probe_id !== id);
    setCollection('drive_probe_configs', items);
  },
};


// ─── Drive Jobs ─────────────────────────────────────────────────────────────

export const localDriveJobs = {
  list(params?: { campaign_id?: string; status?: DriveJobStatus; page?: number; limit?: number }): PaginatedResponse<DriveJob> {
    let items = getCollection<DriveJob>('drive_jobs');
    if (params?.campaign_id) items = items.filter(j => j.campaign_id === params.campaign_id);
    if (params?.status) items = items.filter(j => j.status === params.status);
    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return paginate(items, params?.page, params?.limit);
  },

  get(id: string): DriveJob {
    const item = getCollection<DriveJob>('drive_jobs').find(j => j.drive_job_id === id);
    if (!item) throw new Error('DriveJob introuvable');
    return item;
  },

  create(data: { campaign_id: string; route_id: string; device_id: string; target_env: TargetEnv; runner_id?: string }): DriveJob {
    const items = getCollection<DriveJob>('drive_jobs');
    const job: DriveJob = {
      drive_job_id: uid(),
      campaign_id: data.campaign_id,
      route_id: data.route_id,
      device_id: data.device_id,
      target_env: data.target_env,
      runner_id: data.runner_id || 'runner-local-001',
      status: 'PENDING',
      progress_pct: 0,
      artifacts_manifest: [],
      created_at: now(),
    };
    items.push(job);
    setCollection('drive_jobs', items);

    // Mettre la campagne en RUNNING
    const campaigns = getCollection<DriveCampaign>('drive_campaigns');
    const cIdx = campaigns.findIndex(c => c.campaign_id === data.campaign_id);
    if (cIdx !== -1) {
      campaigns[cIdx] = { ...campaigns[cIdx], status: 'RUNNING' as CampaignStatus, updated_at: now() };
      setCollection('drive_campaigns', campaigns);
    }

    return job;
  },

  updateStatus(id: string, status: DriveJobStatus, extra?: { progress_pct?: number; error_message?: string; artifacts_manifest?: DriveArtifactEntry[] }): DriveJob {
    const items = getCollection<DriveJob>('drive_jobs');
    const idx = items.findIndex(j => j.drive_job_id === id);
    if (idx === -1) throw new Error('DriveJob introuvable');
    items[idx] = {
      ...items[idx],
      status,
      progress_pct: extra?.progress_pct ?? items[idx].progress_pct,
      error_message: extra?.error_message,
      artifacts_manifest: extra?.artifacts_manifest ?? items[idx].artifacts_manifest,
      started_at: status === 'RUNNING' ? (items[idx].started_at || now()) : items[idx].started_at,
      finished_at: (status === 'DONE' || status === 'FAILED') ? now() : items[idx].finished_at,
    };
    setCollection('drive_jobs', items);

    // Si DONE ou FAILED, mettre à jour la campagne
    if (status === 'DONE' || status === 'FAILED') {
      const campaigns = getCollection<DriveCampaign>('drive_campaigns');
      const cIdx = campaigns.findIndex(c => c.campaign_id === items[idx].campaign_id);
      if (cIdx !== -1) {
        // Vérifier si tous les jobs de la campagne sont terminés
        const allJobs = items.filter(j => j.campaign_id === items[idx].campaign_id);
        const allDone = allJobs.every(j => j.status === 'DONE' || j.status === 'FAILED');
        if (allDone) {
          campaigns[cIdx] = { ...campaigns[cIdx], status: 'DONE' as CampaignStatus, updated_at: now() };
          setCollection('drive_campaigns', campaigns);
        }
      }
    }

    return items[idx];
  },

  /** Simuler l'exécution complète d'un job (pour le mode local) */
  simulateExecution(id: string, route: DriveRoute, kpiThresholds: Record<string, number>): DriveJob {
    // Marquer RUNNING
    this.updateStatus(id, 'RUNNING', { progress_pct: 10 });

    // Générer des KPI samples simulés
    const job = this.get(id);
    const numSamples = 50 + Math.floor(Math.random() * 100);
    const kpiNames: DriveKpi[] = ['RSRP', 'RSRQ', 'SINR', 'THROUGHPUT_DL', 'THROUGHPUT_UL', 'LATENCY', 'JITTER', 'PACKET_LOSS'];
    const kpiUnits: Record<string, string> = {
      RSRP: 'dBm', RSRQ: 'dB', SINR: 'dB',
      THROUGHPUT_DL: 'Mbps', THROUGHPUT_UL: 'Mbps',
      LATENCY: 'ms', JITTER: 'ms', PACKET_LOSS: '%',
    };
    const kpiRanges: Record<string, [number, number]> = {
      RSRP: [-120, -60], RSRQ: [-20, -3], SINR: [-5, 30],
      THROUGHPUT_DL: [5, 300], THROUGHPUT_UL: [2, 100],
      LATENCY: [5, 150], JITTER: [0.5, 50], PACKET_LOSS: [0, 5],
    };

    const baseLat = route.route_geojson?.coordinates?.[0]?.[1] ?? 5.35;
    const baseLon = route.route_geojson?.coordinates?.[0]?.[0] ?? -4.0;
    const samples: KpiSample[] = [];

    for (let i = 0; i < numSamples; i++) {
      const t = i / numSamples;
      const lat = baseLat + (Math.random() - 0.5) * 0.02 + t * 0.01;
      const lon = baseLon + (Math.random() - 0.5) * 0.02 + t * 0.01;
      const ts = new Date(Date.now() - (numSamples - i) * 2000).toISOString();

      for (const kpi of kpiNames) {
        const [min, max] = kpiRanges[kpi];
        const value = parseFloat((min + Math.random() * (max - min)).toFixed(2));
        samples.push({
          sample_id: uid(),
          drive_job_id: id,
          campaign_id: job.campaign_id,
          route_id: job.route_id,
          timestamp: ts,
          lat, lon,
          kpi_name: kpi,
          value,
          unit: kpiUnits[kpi],
          cell_id: `CELL-${Math.floor(Math.random() * 50).toString().padStart(3, '0')}`,
          technology: '4G',
        });
      }
    }

    // Stocker les samples
    localKpiSamples.bulkInsert(samples);

    // Générer le summary
    const summary = localDriveRunSummaries.computeAndStore(id, job.campaign_id, kpiThresholds);

    // Générer des artefacts simulés
    const artifacts: DriveArtifactEntry[] = [
      { artifact_type: 'kpi_series', filename: 'kpi_series.json', minio_path: `/${job.campaign_id}/${id}/kpi_series.json`, size_bytes: samples.length * 120, sha256: uid(), content_type: 'application/json' },
      { artifact_type: 'geo', filename: 'geo.geojson', minio_path: `/${job.campaign_id}/${id}/geo.geojson`, size_bytes: 4096, sha256: uid(), content_type: 'application/geo+json' },
      { artifact_type: 'device_logs', filename: 'device_logs.zip', minio_path: `/${job.campaign_id}/${id}/device_logs.zip`, size_bytes: 102400, sha256: uid(), content_type: 'application/zip' },
      { artifact_type: 'summary', filename: 'summary.json', minio_path: `/${job.campaign_id}/${id}/summary.json`, size_bytes: 2048, sha256: uid(), content_type: 'application/json' },
    ];

    // Marquer DONE
    const finalStatus: DriveJobStatus = summary.overall_pass ? 'DONE' : 'FAILED';
    return this.updateStatus(id, finalStatus, { progress_pct: 100, artifacts_manifest: artifacts, error_message: finalStatus === 'FAILED' ? `${summary.threshold_violations.length} violation(s) de seuil KPI` : undefined });
  },

  delete(id: string): void {
    const items = getCollection<DriveJob>('drive_jobs').filter(j => j.drive_job_id !== id);
    setCollection('drive_jobs', items);
    // Nettoyer les samples associés
    localKpiSamples.deleteByJob(id);
  },
};

// ─── KPI Samples ────────────────────────────────────────────────────────────

export const localKpiSamples = {
  list(params: { drive_job_id?: string; campaign_id?: string; kpi_name?: DriveKpi; page?: number; limit?: number }): PaginatedResponse<KpiSample> {
    let items = getCollection<KpiSample>('kpi_samples');
    if (params.drive_job_id) items = items.filter(s => s.drive_job_id === params.drive_job_id);
    if (params.campaign_id) items = items.filter(s => s.campaign_id === params.campaign_id);
    if (params.kpi_name) items = items.filter(s => s.kpi_name === params.kpi_name);
    items.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return paginate(items, params.page, params.limit);
  },

  listAll(params: { drive_job_id?: string; campaign_id?: string }): KpiSample[] {
    let items = getCollection<KpiSample>('kpi_samples');
    if (params.drive_job_id) items = items.filter(s => s.drive_job_id === params.drive_job_id);
    if (params.campaign_id) items = items.filter(s => s.campaign_id === params.campaign_id);
    return items.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  },

  bulkInsert(samples: KpiSample[]): number {
    const items = getCollection<KpiSample>('kpi_samples');
    items.push(...samples);
    setCollection('kpi_samples', items);
    return samples.length;
  },

  deleteByJob(jobId: string): void {
    const items = getCollection<KpiSample>('kpi_samples').filter(s => s.drive_job_id !== jobId);
    setCollection('kpi_samples', items);
  },

  deleteByCampaign(campaignId: string): void {
    const items = getCollection<KpiSample>('kpi_samples').filter(s => s.campaign_id !== campaignId);
    setCollection('kpi_samples', items);
  },

  /** Statistiques agrégées par KPI pour un job ou une campagne */
  aggregate(params: { drive_job_id?: string; campaign_id?: string }): Record<string, { avg: number; min: number; max: number; count: number; unit: string }> {
    const samples = this.listAll(params);
    const agg: Record<string, { sum: number; min: number; max: number; count: number; unit: string }> = {};
    for (const s of samples) {
      if (!agg[s.kpi_name]) {
        agg[s.kpi_name] = { sum: s.value, min: s.value, max: s.value, count: 1, unit: s.unit };
      } else {
        agg[s.kpi_name].sum += s.value;
        agg[s.kpi_name].min = Math.min(agg[s.kpi_name].min, s.value);
        agg[s.kpi_name].max = Math.max(agg[s.kpi_name].max, s.value);
        agg[s.kpi_name].count++;
      }
    }
    const result: Record<string, { avg: number; min: number; max: number; count: number; unit: string }> = {};
    for (const [k, v] of Object.entries(agg)) {
      result[k] = { avg: parseFloat((v.sum / v.count).toFixed(2)), min: v.min, max: v.max, count: v.count, unit: v.unit };
    }
    return result;
  },
};

// ─── Drive Run Summaries ────────────────────────────────────────────────────

export const localDriveRunSummaries = {
  list(campaignId?: string): DriveRunSummary[] {
    let items = getCollection<DriveRunSummary>('drive_run_summaries');
    if (campaignId) items = items.filter(s => s.campaign_id === campaignId);
    return items;
  },

  get(jobId: string): DriveRunSummary | null {
    return getCollection<DriveRunSummary>('drive_run_summaries').find(s => s.drive_job_id === jobId) || null;
  },

  computeAndStore(jobId: string, campaignId: string, thresholds: Record<string, number>): DriveRunSummary {
    const agg = localKpiSamples.aggregate({ drive_job_id: jobId });
    const samples = localKpiSamples.listAll({ drive_job_id: jobId });

    const kpi_averages: Record<string, number> = {};
    const kpi_min: Record<string, number> = {};
    const kpi_max: Record<string, number> = {};
    const violations: ThresholdViolation[] = [];

    for (const [kpi, stats] of Object.entries(agg)) {
      kpi_averages[kpi] = stats.avg;
      kpi_min[kpi] = stats.min;
      kpi_max[kpi] = stats.max;

      if (thresholds[kpi] !== undefined) {
        const threshold = thresholds[kpi];
        // Pour RSRP, RSRQ, SINR, THROUGHPUT : la valeur doit être >= seuil
        // Pour LATENCY, JITTER, PACKET_LOSS : la valeur doit être <= seuil
        const isLowerBetter = ['LATENCY', 'JITTER', 'PACKET_LOSS'].includes(kpi);
        const violated = isLowerBetter ? stats.avg > threshold : stats.avg < threshold;
        if (violated) {
          const violationCount = samples.filter(s => s.kpi_name === kpi && (isLowerBetter ? s.value > threshold : s.value < threshold)).length;
          violations.push({
            kpi_name: kpi as DriveKpi,
            threshold,
            actual_avg: stats.avg,
            direction: isLowerBetter ? 'above' : 'below',
            violation_count: violationCount,
            total_samples: stats.count,
          });
        }
      }
    }

    // Calculer durée et distance approximatives
    const timestamps = samples.map(s => new Date(s.timestamp).getTime());
    const duration_sec = timestamps.length > 1 ? Math.round((Math.max(...timestamps) - Math.min(...timestamps)) / 1000) : 0;

    const summary: DriveRunSummary = {
      drive_job_id: jobId,
      campaign_id: campaignId,
      total_samples: samples.length,
      duration_sec,
      distance_km: parseFloat((duration_sec * 0.012).toFixed(1)), // ~43 km/h approximation
      kpi_averages,
      kpi_min,
      kpi_max,
      threshold_violations: violations,
      overall_pass: violations.length === 0,
    };

    const items = getCollection<DriveRunSummary>('drive_run_summaries');
    const existIdx = items.findIndex(s => s.drive_job_id === jobId);
    if (existIdx !== -1) {
      items[existIdx] = summary;
    } else {
      items.push(summary);
    }
    setCollection('drive_run_summaries', items);
    return summary;
  },

  delete(jobId: string): void {
    const items = getCollection<DriveRunSummary>('drive_run_summaries').filter(s => s.drive_job_id !== jobId);
    setCollection('drive_run_summaries', items);
  },
};

// ─── Drive Import Results ───────────────────────────────────────────────────

export const localDriveImports = {
  list(campaignId?: string): DriveImportResult[] {
    let items = getCollection<DriveImportResult>('drive_imports');
    if (campaignId) items = items.filter(i => i.campaign_id === campaignId);
    return items.sort((a, b) => new Date(b.imported_at).getTime() - new Date(a.imported_at).getTime());
  },

  /** Importer des KPI samples depuis un fichier parsé */
  importSamples(data: {
    campaign_id: string;
    source_filename: string;
    source_format: DriveImportResult['source_format'];
    samples: Omit<KpiSample, 'sample_id'>[];
  }): DriveImportResult {
    const validSamples: KpiSample[] = [];
    const errors: string[] = [];
    let skipped = 0;

    for (let i = 0; i < data.samples.length; i++) {
      const s = data.samples[i];
      // Validation basique
      if (!s.kpi_name || s.value === undefined || isNaN(s.value)) {
        errors.push(`Ligne ${i + 1}: kpi_name ou value manquant/invalide`);
        skipped++;
        continue;
      }
      if (!s.timestamp) {
        errors.push(`Ligne ${i + 1}: timestamp manquant`);
        skipped++;
        continue;
      }
      validSamples.push({ ...s, sample_id: uid() } as KpiSample);
    }

    // Insérer les samples valides
    if (validSamples.length > 0) {
      localKpiSamples.bulkInsert(validSamples);
    }

    const result: DriveImportResult = {
      import_id: uid(),
      campaign_id: data.campaign_id,
      source_filename: data.source_filename,
      source_format: data.source_format,
      samples_imported: validSamples.length,
      samples_skipped: skipped,
      errors: errors.slice(0, 20), // Limiter à 20 erreurs
      imported_at: now(),
    };

    const items = getCollection<DriveImportResult>('drive_imports');
    items.push(result);
    setCollection('drive_imports', items);
    return result;
  },

  delete(id: string): void {
    const items = getCollection<DriveImportResult>('drive_imports').filter(i => i.import_id !== id);
    setCollection('drive_imports', items);
  },
};

// ─── Capture Policies ──────────────────────────────────────────────────────

type CapturePolicyScope = 'project' | 'campaign' | 'scenario';

interface StoredCapturePolicy {
  id: string;
  scope: CapturePolicyScope;
  scope_id: string; // project_id, campaign_id, or scenario_id
  policy: CapturePolicy;
  updated_at: string;
}

export const localCapturePolicies = {
  /** Récupérer la policy pour un scope donné */
  get(scope: CapturePolicyScope, scopeId: string): CapturePolicy | null {
    const items = getCollection<StoredCapturePolicy>('capture_policies');
    const found = items.find(p => p.scope === scope && p.scope_id === scopeId);
    return found ? found.policy : null;
  },

  /** Sauvegarder ou mettre à jour la policy pour un scope */
  upsert(scope: CapturePolicyScope, scopeId: string, policy: CapturePolicy): StoredCapturePolicy {
    const items = getCollection<StoredCapturePolicy>('capture_policies');
    const idx = items.findIndex(p => p.scope === scope && p.scope_id === scopeId);
    if (idx >= 0) {
      items[idx] = { ...items[idx], policy, updated_at: now() };
      setCollection('capture_policies', items);
      return items[idx];
    }
    const entry: StoredCapturePolicy = {
      id: uid(),
      scope,
      scope_id: scopeId,
      policy,
      updated_at: now(),
    };
    items.push(entry);
    setCollection('capture_policies', items);
    return entry;
  },

  /** Supprimer l'override d'un scope (revient au défaut parent) */
  remove(scope: CapturePolicyScope, scopeId: string): void {
    const items = getCollection<StoredCapturePolicy>('capture_policies')
      .filter(p => !(p.scope === scope && p.scope_id === scopeId));
    setCollection('capture_policies', items);
  },

  /** Lister toutes les policies (pour debug/admin) */
  list(): StoredCapturePolicy[] {
    return getCollection<StoredCapturePolicy>('capture_policies');
  },
};

// ─── Capture Sessions (Mode B — Probe SPAN/TAP) ───────────────────────────

export const localCaptureSessions = {
  list(params?: {
    project_id?: string;
    campaign_id?: string;
    drive_job_id?: string;
    status?: CaptureSessionStatus;
    page?: number;
    limit?: number;
  }): PaginatedResponse<CaptureSession> {
    let items = getCollection<CaptureSession>('capture_sessions');
    if (params?.project_id) items = items.filter(s => s.project_id === params.project_id);
    if (params?.campaign_id) items = items.filter(s => s.campaign_id === params.campaign_id);
    if (params?.drive_job_id) items = items.filter(s => s.drive_job_id === params.drive_job_id);
    if (params?.status) items = items.filter(s => s.status === params.status);
    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return paginate(items, params?.page, params?.limit);
  },

  get(sessionId: string): CaptureSession {
    const item = getCollection<CaptureSession>('capture_sessions').find(s => s.session_id === sessionId);
    if (!item) throw new Error('Session de capture introuvable');
    return item;
  },

  /** Créer une session de capture (appelé avant le démarrage de la probe) */
  create(data: {
    project_id: string;
    campaign_id?: string;
    drive_job_id?: string;
    execution_id?: string;
    probe_id: string;
    iface: string;
    bpf_filter: string;
    vlan_filter?: number;
    is_test_capture?: boolean;
  }): CaptureSession {
    const items = getCollection<CaptureSession>('capture_sessions');
    const session: CaptureSession = {
      session_id: uid(),
      project_id: data.project_id,
      campaign_id: data.campaign_id,
      drive_job_id: data.drive_job_id,
      execution_id: data.execution_id,
      probe_id: data.probe_id,
      iface: data.iface,
      bpf_filter: data.bpf_filter,
      vlan_filter: data.vlan_filter,
      status: 'PENDING',
      artifacts: [],
      packets_captured: 0,
      bytes_captured: 0,
      is_test_capture: data.is_test_capture || false,
      created_at: now(),
    };
    items.push(session);
    setCollection('capture_sessions', items);
    return session;
  },

  /** Démarrer la session (PENDING → RUNNING) */
  start(sessionId: string): CaptureSession {
    const items = getCollection<CaptureSession>('capture_sessions');
    const idx = items.findIndex(s => s.session_id === sessionId);
    if (idx === -1) throw new Error('Session introuvable');
    items[idx] = { ...items[idx], status: 'RUNNING', started_at: now() };
    setCollection('capture_sessions', items);
    return items[idx];
  },

  /** Arrêter la session (RUNNING → COMPLETED) */
  stop(sessionId: string): CaptureSession {
    const items = getCollection<CaptureSession>('capture_sessions');
    const idx = items.findIndex(s => s.session_id === sessionId);
    if (idx === -1) throw new Error('Session introuvable');
    items[idx] = { ...items[idx], status: 'COMPLETED', stopped_at: now() };
    setCollection('capture_sessions', items);
    return items[idx];
  },

  /** Marquer en erreur avec reason code */
  fail(sessionId: string, errorMessage: string, reasonCode?: string): CaptureSession {
    const items = getCollection<CaptureSession>('capture_sessions');
    const idx = items.findIndex(s => s.session_id === sessionId);
    if (idx === -1) throw new Error('Session introuvable');
    items[idx] = { ...items[idx], status: 'FAILED', stopped_at: now(), error_message: errorMessage, reason_code: (reasonCode as CaptureSession['reason_code']) || undefined };
    setCollection('capture_sessions', items);
    return items[idx];
  },

  /** Timeout de session */
  timeout(sessionId: string): CaptureSession {
    const items = getCollection<CaptureSession>('capture_sessions');
    const idx = items.findIndex(s => s.session_id === sessionId);
    if (idx === -1) throw new Error('Session introuvable');
    items[idx] = { ...items[idx], status: 'TIMEOUT' as CaptureSessionStatus, stopped_at: now(), reason_code: 'TIMEOUT', error_message: 'Session timeout' };
    setCollection('capture_sessions', items);
    return items[idx];
  },

  /** Annuler la session */
  cancel(sessionId: string): CaptureSession {
    const items = getCollection<CaptureSession>('capture_sessions');
    const idx = items.findIndex(s => s.session_id === sessionId);
    if (idx === -1) throw new Error('Session introuvable');
    items[idx] = { ...items[idx], status: 'CANCELLED', stopped_at: now() };
    setCollection('capture_sessions', items);
    return items[idx];
  },

  /** Ajouter des artefacts à une session */
  addArtifacts(sessionId: string, artifacts: CaptureSession['artifacts']): CaptureSession {
    const items = getCollection<CaptureSession>('capture_sessions');
    const idx = items.findIndex(s => s.session_id === sessionId);
    if (idx === -1) throw new Error('Session introuvable');
    items[idx] = { ...items[idx], artifacts: [...items[idx].artifacts, ...artifacts] };
    setCollection('capture_sessions', items);
    return items[idx];
  },

  /** Lister les sessions par execution_id */
  listByExecution(executionId: string): CaptureSession[] {
    return getCollection<CaptureSession>('capture_sessions').filter(s => s.execution_id === executionId);
  },

  /** Simuler un cycle complet de capture probe (pour le mode local/demo) */
  simulateCapture(data: {
    project_id: string;
    campaign_id?: string;
    drive_job_id?: string;
    execution_id?: string;
    probe_id: string;
    iface: string;
    bpf_filter: string;
    vlan_filter?: number;
    is_test_capture?: boolean;
  }): CaptureSession {
    // Vérifier que la probe est en ligne
    const probes = getCollection<Probe>('probes');
    const probe = probes.find(p => p.probe_id === data.probe_id);
    if (!probe || probe.status !== 'ONLINE') {
      const session = this.create(data);
      return this.fail(session.session_id, 'Sonde hors ligne', 'PROBE_OFFLINE');
    }
    // Créer
    const session = this.create(data);
    // Démarrer
    this.start(session.session_id);
    // Simuler des paquets
    const packets = Math.floor(Math.random() * 10000) + 500;
    const bytes = packets * (Math.floor(Math.random() * 800) + 64);
    // Simuler des artefacts
    const fakeArtifacts = [
      {
        filename: `capture_${session.session_id}.pcapng`,
        minio_path: `artifacts/${data.project_id}/${session.session_id}/capture.pcapng`,
        size_bytes: Math.floor(Math.random() * 50_000_000) + 1_000_000,
        sha256: Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
      },
    ];
    this.addArtifacts(session.session_id, fakeArtifacts);
    // Compléter
    return this.stop(session.session_id);
  },

  delete(sessionId: string): void {
    const items = getCollection<CaptureSession>('capture_sessions').filter(s => s.session_id !== sessionId);
    setCollection('capture_sessions', items);
  },
};
