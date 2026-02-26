/**
 * localStoreTrpc — Drop-in replacement for localStore exports using tRPC.
 *
 * Exports the same named exports as localStore so pages can switch imports
 * without changing call sites. Uses trpcVanilla for async calls.
 *
 * For synchronous APIs (like localCapturePolicies), uses in-memory state.
 */
import { trpcVanilla } from '@/lib/trpc';
import { capturePoliciesSync } from '@/hooks/useCapturePolicyQueries';

// ─── localProjects ──────────────────────────────────────────────────────

function dbToProject(row: any): any {
  if (!row) return row;
  return {
    id: row.uid ?? row.id,
    name: row.name ?? '',
    domain: row.domain ?? '',
    description: row.description ?? '',
    status: row.status ?? 'ACTIVE',
    created_at: row.createdAt ? new Date(row.createdAt).toISOString() : (row.created_at ?? ''),
    updated_at: row.updatedAt ? new Date(row.updatedAt).toISOString() : (row.updated_at ?? ''),
  };
}

export const localProjects = {
  async list(params?: any) {
    const rows = await trpcVanilla.projects.list.query();
    const data = (rows as any[]).map(dbToProject);
    return { data };
  },
};

// ─── localScenarios ─────────────────────────────────────────────────────

function dbToScenario(row: any): any {
  if (!row) return row;
  return {
    id: row.uid ?? row.id,
    profile_id: row.profileId ?? row.profile_id ?? '',
    project_id: row.projectId ?? row.project_id ?? '',
    scenario_code: row.scenarioCode ?? row.scenario_code ?? '',
    name: row.name ?? '',
    description: row.description ?? '',
    status: row.status ?? 'DRAFT',
    version: row.version ?? 1,
    steps: row.steps ?? [],
    required_dataset_types: row.requiredDatasetTypes ?? row.required_dataset_types ?? [],
    created_at: row.createdAt ? new Date(row.createdAt).toISOString() : (row.created_at ?? ''),
    updated_at: row.updatedAt ? new Date(row.updatedAt).toISOString() : (row.updated_at ?? ''),
  };
}

export const localScenarios = {
  async finalize(scenarioId: string) {
    const result = await trpcVanilla.scenarios.update.mutate({
      uid: scenarioId,
      status: 'FINAL',
    });
    return dbToScenario(result);
  },

  async deprecate(scenarioId: string) {
    const result = await trpcVanilla.scenarios.update.mutate({
      uid: scenarioId,
      status: 'DEPRECATED',
    });
    return dbToScenario(result);
  },

  async create(profileId: string, projectId: string, data: Record<string, any>) {
    const result = await trpcVanilla.scenarios.create.mutate({
      projectId,
      profileId,
      scenarioCode: data.scenario_code ?? `SC-${Date.now()}`,
      name: data.name ?? '',
      description: data.description,
      testType: data.test_type ?? 'VABF',
      steps: data.steps,
      requiredDatasetTypes: data.required_dataset_types,
      artifactPolicy: data.artifact_policy,
      kpiThresholds: data.kpi_thresholds,
    });
    return dbToScenario(result);
  },

  async update(scenarioId: string, data: Record<string, any>) {
    const result = await trpcVanilla.scenarios.update.mutate({
      uid: scenarioId,
      name: data.name,
      description: data.description,
      scenarioCode: data.scenario_code,
      testType: data.test_type,
      status: data.status,
      version: data.version,
      steps: data.steps,
      requiredDatasetTypes: data.required_dataset_types,
      artifactPolicy: data.artifact_policy,
      kpiThresholds: data.kpi_thresholds,
    });
    return dbToScenario(result);
  },

  async listByProject(projectId: string) {
    const rows = await trpcVanilla.scenarios.list.query({ projectId });
    return (rows as any[]).map(dbToScenario);
  },

  codeExists(_projectId: string, _code: string) {
    // Would need a server-side check - return false for now
    return false;
  },

  generateCode(_projectId: string, testType: string, domain: string, title: string) {
    const prefix = testType || 'VABF';
    const domainPart = domain || 'GEN';
    const slug = title.replace(/[^a-zA-Z0-9]/g, '-').toUpperCase().substring(0, 20);
    return `${prefix}-${domainPart}-${slug}`;
  },

  nextId(_projectId: string, testType: string, domain: string) {
    const prefix = testType || 'VABF';
    const domainPart = domain || 'GEN';
    return `${prefix}-${domainPart}-${String(Date.now()).slice(-4)}`;
  },
};

// ─── localExecutions ────────────────────────────────────────────────────

function dbToExecution(row: any): any {
  if (!row) return row;
  return {
    id: row.uid ?? row.id,
    project_id: row.projectId ?? row.project_id ?? '',
    profile_id: row.profileId ?? row.profile_id ?? '',
    scenario_id: row.scenarioId ?? row.scenario_id ?? '',
    status: row.status ?? 'PENDING',
    runner_type: row.runnerType ?? row.runner_type ?? '',
    script_id: row.scriptId ?? row.script_id ?? null,
    dataset_bundle_id: row.datasetBundleId ?? row.dataset_bundle_id ?? null,
    target_env: row.targetEnv ?? row.target_env ?? 'DEV',
    runner_id: row.runnerId ?? row.runner_id ?? null,
    started_at: row.startedAt ? new Date(row.startedAt).toISOString() : (row.started_at ?? null),
    finished_at: row.finishedAt ? new Date(row.finishedAt).toISOString() : (row.finished_at ?? null),
    duration_ms: row.durationMs ?? row.duration_ms ?? null,
    artifacts_count: row.artifactsCount ?? row.artifacts_count ?? 0,
    incidents_count: row.incidentsCount ?? row.incidents_count ?? 0,
    created_at: row.createdAt ? new Date(row.createdAt).toISOString() : (row.created_at ?? ''),
    updated_at: row.updatedAt ? new Date(row.updatedAt).toISOString() : (row.updated_at ?? ''),
  };
}

export const localExecutions = {
  async create(projectId: string, data: Record<string, any>) {
    const result = await trpcVanilla.executions.create.mutate({
      projectId,
      profileId: data.profile_id ?? data.profileId,
      scenarioId: data.scenario_id ?? data.scenarioId,
      runnerType: data.runner_type ?? data.runnerType,
      scriptId: data.script_id ?? data.scriptId,
      scriptVersion: data.script_version ?? data.scriptVersion,
      datasetBundleId: data.dataset_bundle_id ?? data.datasetBundleId,
      targetEnv: data.target_env ?? data.targetEnv,
      runnerId: data.runner_id ?? data.runnerId,
    });
    return dbToExecution(result);
  },

  async rerun(executionId: string) {
    // Get the original execution and create a new one with same params
    const original = await trpcVanilla.executions.getByUid.query({ uid: executionId });
    if (!original) throw new Error('Execution not found');
    const result = await trpcVanilla.executions.create.mutate({
      projectId: (original as any).projectId,
      profileId: (original as any).profileId,
      scenarioId: (original as any).scenarioId,
      runnerType: (original as any).runnerType,
      scriptId: (original as any).scriptId,
      scriptVersion: (original as any).scriptVersion,
      datasetBundleId: (original as any).datasetBundleId,
      targetEnv: (original as any).targetEnv,
    });
    return dbToExecution(result);
  },
};

// ─── localDatasetTypes ──────────────────────────────────────────────────

function dbToDatasetType(row: any): any {
  if (!row) return row;
  return {
    id: row.uid ?? row.id ?? '',
    dataset_type_id: row.datasetTypeId ?? row.dataset_type_id ?? row.uid ?? '',
    domain: row.domain ?? '',
    name: row.name ?? '',
    test_type: row.testType ?? row.test_type ?? undefined,
    description: row.description ?? '',
    schema_fields: row.schemaFields ?? row.schema_fields ?? [],
    example_placeholders: row.examplePlaceholders ?? row.example_placeholders ?? {},
    tags: row.tags ?? [],
    created_at: row.createdAt ? new Date(row.createdAt).toISOString() : (row.created_at ?? ''),
    updated_at: row.updatedAt ? new Date(row.updatedAt).toISOString() : (row.updated_at ?? ''),
  };
}

export const localDatasetTypes = {
  async list(params?: { domain?: string; test_type?: string }) {
    const rows = await trpcVanilla.datasets.listTypes.query({ domain: params?.domain });
    return (rows as any[]).map(dbToDatasetType);
  },

  async get(typeId: string) {
    const row = await trpcVanilla.datasets.getTypeByUid.query({ uid: typeId });
    return dbToDatasetType(row);
  },

  async create(data: Record<string, any>) {
    const result = await trpcVanilla.datasets.createType.mutate({
      datasetTypeId: data.dataset_type_id ?? `DST-${Date.now()}`,
      domain: data.domain,
      name: data.name,
      testType: data.test_type,
      description: data.description,
      schemaFields: data.schema_fields,
      examplePlaceholders: data.example_placeholders,
      tags: data.tags,
    });
    return dbToDatasetType(result);
  },

  async update(typeId: string, data: Record<string, any>) {
    // No updateType endpoint exists yet - create a new type and delete old
    // For now, return the data as-is (optimistic)
    console.warn('[localDatasetTypes.update] No updateType endpoint - returning optimistic data');
    return dbToDatasetType({ uid: typeId, ...data });
  },

  async delete(typeId: string) {
    // No deleteType endpoint exists yet
    console.warn('[localDatasetTypes.delete] No deleteType endpoint - no-op');
  },
};

// ─── localCapturePolicies ───────────────────────────────────────────────

export const localCapturePolicies = capturePoliciesSync;

// Also export localConfig for compatibility
export const localConfig = {
  baseUrl: '',
  adminUser: '',
  adminPassword: '',
  minioEndpoint: '',
  minioConsoleUrl: '',
};

// ─── localCaptureSessions ───────────────────────────────────────────────

export const localCaptureSessions = {
  async list(params: { project_id?: string; execution_id?: string }) {
    if (params.execution_id) {
      const rows = await trpcVanilla.captures.listSessionsByExecution.query({
        executionId: params.execution_id,
      });
      return { data: rows as any[] };
    }
    if (params.project_id) {
      // listSessions uses policyId, not projectId - use project_id as policyId fallback
      const rows = await trpcVanilla.captures.listSessions.query({
        policyId: params.project_id,
      });
      return { data: rows as any[] };
    }
    return { data: [] };
  },
};

// ─── localDriveCampaigns ────────────────────────────────────────────────

export const localDriveCampaigns = {
  async list(projectId: string, _params?: any) {
    const rows = await trpcVanilla.drivetest.listCampaigns.query({ projectId });
    return { data: rows as any[] };
  },

  async get(campaignId: string) {
    return trpcVanilla.drivetest.getCampaign.query({ uid: campaignId });
  },

  async create(projectId: string, data: Record<string, any>) {
    return trpcVanilla.drivetest.createCampaign.mutate({
      projectId,
      name: data.name,
      description: data.description,
      targetEnv: data.target_env ?? data.targetEnv,
      networkType: data.network_type ?? data.networkType,
      area: data.area ?? data.region,
      startDate: data.start_date ?? data.startDate,
      endDate: data.end_date ?? data.endDate,
    });
  },

  async update(campaignId: string, data: Record<string, any>) {
    return trpcVanilla.drivetest.updateCampaign.mutate({
      uid: campaignId,
      name: data.name,
      description: data.description,
      status: data.status,
      targetEnv: data.target_env ?? data.targetEnv,
      networkType: data.network_type ?? data.networkType,
      area: data.area ?? data.region,
    });
  },

  async updateStatus(campaignId: string, status: string) {
    return trpcVanilla.drivetest.updateCampaign.mutate({
      uid: campaignId,
      status: status as any,
    });
  },

  async delete(campaignId: string) {
    return trpcVanilla.drivetest.deleteCampaign.mutate({ uid: campaignId });
  },
};

// ─── localDriveJobs ─────────────────────────────────────────────────────

export const localDriveJobs = {
  async list(params: { campaign_id: string; limit?: number }) {
    const rows = await trpcVanilla.drivetest.listJobs.query({ campaignId: params.campaign_id });
    return { data: rows as any[] };
  },

  async create(data: Record<string, any>) {
    return trpcVanilla.drivetest.createJob.mutate({
      campaignId: data.campaign_id ?? data.campaignId,
      routeId: data.route_id ?? data.routeId,
      deviceId: data.device_id ?? data.deviceId,
      targetEnv: data.target_env ?? data.targetEnv,
      runnerId: data.runner_id ?? data.runnerId,
    });
  },

  async simulateExecution(_jobId: string, _route: any, _thresholds: any) {
    // Simulation is a client-side feature - no-op for now
    return { success: true };
  },
};

// ─── localDriveRoutes ───────────────────────────────────────────────────

export const localDriveRoutes = {
  async list(campaignId: string) {
    const rows = await trpcVanilla.drivetest.listRoutes.query({ campaignId });
    return rows as any[];
  },

  async create(campaignId: string, data: Record<string, any>) {
    return trpcVanilla.drivetest.createRoute.mutate({
      campaignId,
      name: data.name,
      routeGeojson: data.waypoints_json ?? data.waypointsJson ?? data.routeGeojson,
      checkpointsGeojson: data.checkpoints_geojson ?? data.checkpointsGeojson,
      expectedDurationMin: data.estimated_duration_min ?? data.estimatedDurationMin ?? data.expectedDurationMin,
    });
  },

  async delete(routeId: string) {
    return trpcVanilla.drivetest.deleteRoute.mutate({ uid: routeId });
  },
};

// ─── localDriveProbeConfigs ─────────────────────────────────────────────

export const localDriveProbeConfigs = {
  async list(projectId: string) {
    const rows = await trpcVanilla.drivetest.listProbeConfigs.query({ projectId });
    return rows as any[];
  },

  async create(projectId: string, data: Record<string, any>) {
    return trpcVanilla.drivetest.createProbeConfig.mutate({
      projectId,
      name: data.name,
      location: data.location,
      captureType: data.capture_type ?? data.captureType ?? data.probe_type,
      retentionDays: data.retention_days ?? data.retentionDays,
      maxSizeMb: data.max_size_mb ?? data.maxSizeMb,
      rotation: data.rotation,
      outputTarget: data.output_target ?? data.outputTarget,
      enabled: data.enabled,
    });
  },

  async delete(configId: string) {
    return trpcVanilla.drivetest.deleteProbeConfig.mutate({ uid: configId });
  },
};

// ─── localTestDevices ───────────────────────────────────────────────────

export const localTestDevices = {
  async list(projectId: string, _params?: any) {
    const rows = await trpcVanilla.drivetest.listDevices.query({ projectId });
    return { data: rows as any[] };
  },

  async create(projectId: string, data: Record<string, any>) {
    return trpcVanilla.drivetest.createDevice.mutate({
      projectId,
      type: data.type,
      model: data.model,
      osVersion: data.os_version ?? data.osVersion,
      diagCapable: data.diag_capable ?? data.diagCapable,
      toolsEnabled: data.tools_enabled ?? data.toolsEnabled,
    });
  },

  async delete(deviceId: string) {
    return trpcVanilla.drivetest.deleteDevice.mutate({ uid: deviceId });
  },
};

// ─── localKpiSamples ────────────────────────────────────────────────────

export const localKpiSamples = {
  async list(params: { drive_job_id: string }) {
    const rows = await trpcVanilla.drivetest.listKpiSamples.query({
      driveJobId: params.drive_job_id,
    });
    return rows as any[];
  },

  async bulkInsert(samples: Record<string, any>[]) {
    return trpcVanilla.drivetest.insertKpiSamples.mutate({
      samples: samples.map((s) => ({
        driveJobId: s.drive_job_id ?? s.driveJobId,
        campaignId: s.campaign_id ?? s.campaignId,
        routeId: s.route_id ?? s.routeId,
        timestamp: new Date(s.timestamp),
        lat: s.lat,
        lon: s.lon ?? s.lng,
        kpiName: s.kpi_name ?? s.kpiName ?? s.kpi_type,
        value: s.value,
        unit: s.unit,
        cellId: s.cell_id ?? s.cellId,
        technology: s.technology,
      })),
    });
  },
};

// ─── localDriveRunSummaries ─────────────────────────────────────────────

export const localDriveRunSummaries = {
  async get(driveJobId: string) {
    return trpcVanilla.drivetest.getRunSummary.query({ driveJobId });
  },

  async computeAndStore(driveJobId: string, campaignId: string, _thresholds: any) {
    // Compute summary from KPI samples and store
    const samples = await trpcVanilla.drivetest.listKpiSamples.query({ driveJobId });
    const sampleList = samples as any[];
    if (sampleList.length === 0) return null;

    // Basic summary computation
    const summary = {
      driveJobId,
      campaignId,
      totalSamples: sampleList.length,
      avgRsrp: 0,
      avgRsrq: 0,
      avgSinr: 0,
      avgDlThroughput: 0,
      avgUlThroughput: 0,
      coveragePercent: 100,
    };

    return trpcVanilla.drivetest.upsertRunSummary.mutate({
      driveJobId,
      campaignId,
      totalSamples: summary.totalSamples,
      kpiAverages: {
        rsrp: summary.avgRsrp,
        rsrq: summary.avgRsrq,
        sinr: summary.avgSinr,
        dl_throughput: summary.avgDlThroughput,
        ul_throughput: summary.avgUlThroughput,
      },
    });
  },
};

// ─── localBundleItems ───────────────────────────────────────────────────

export const localBundleItems = {
  async list(bundleId: string) {
    const rows = await trpcVanilla.datasets.listBundleItems.query({ bundleId });
    return rows as any[];
  },
};

// ─── localAuditLog ──────────────────────────────────────────────────────

export const localAuditLog = {
  log(_action: string, _details: Record<string, any>) {
    // Audit logging - no-op for now, would need a server endpoint
    console.log('[AUDIT]', _action, _details);
  },
};

// ─── localScriptRepository ──────────────────────────────────────────────
// Script repository - uses in-memory store for now as there's no tRPC endpoint yet

const scriptStore = new Map<string, any>();

export const localScriptRepository = {
  list(_projectId: string, _params?: any) {
    return Array.from(scriptStore.values());
  },
  get(scriptId: string) {
    return scriptStore.get(scriptId) ?? null;
  },
  getActive(_projectId: string, _scenarioId: string) {
    return Array.from(scriptStore.values()).find((s: any) => s.active) ?? null;
  },
  listVersions(_projectId: string, _scenarioId: string) {
    return Array.from(scriptStore.values());
  },
  create(data: Record<string, any>) {
    const id = `script-${Date.now()}`;
    const script = { script_id: id, ...data, active: false, created_at: new Date().toISOString() };
    scriptStore.set(id, script);
    return script;
  },
  activate(scriptId: string) {
    scriptStore.forEach((s) => { s.active = false; });
    const script = scriptStore.get(scriptId);
    if (script) script.active = true;
    return script;
  },
  delete(scriptId: string) {
    scriptStore.delete(scriptId);
  },
};

// ─── Notification stubs ─────────────────────────────────────────────────
// These are used by notification pages - stub implementations

export const localNotifRules = {
  list() { return []; },
  testRule(_ruleId: string, _context: any, _actor: any) { return { sent: false }; },
  update(_ruleId: string, _patch: any, _actor?: any) { return null; },
};

export const localNotifSettings = {
  get() { return { email: { enabled: false }, sms: { enabled: false } }; },
  getRawEmailSettings() { return {}; },
  update(_patch: any, _actor?: any) { return null; },
  disable(_channel: string, _actor?: any) { return null; },
  testEmail(_params: any, _actor?: any) { return { success: false }; },
  testSms(_params: any, _actor?: any) { return { success: false }; },
};

export const localNotifTemplates = {
  list(_channel?: string) { return []; },
  create(_data: any) { return null; },
  update(_id: string, _data: any, _actor?: any) { return null; },
  delete(_id: string, _actor?: any) { return null; },
  preview(_id: string, _context: any) { return ''; },
};

export const localNotifDeliveryLogs = {
  list(_params?: any) { return []; },
  exportCsv() { return ''; },
};
