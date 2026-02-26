/**
 * repositoryApiTrpc — Drop-in replacement for repositoryApi using tRPC.
 *
 * Exports the same function signatures as repositoryApi so pages can switch
 * imports without changing call sites.
 */
import { trpcVanilla } from '@/lib/trpc';

// ─── Profiles ───────────────────────────────────────────────────────────

function dbToProfile(row: any): any {
  if (!row) return row;
  return {
    id: row.uid ?? row.id,
    project_id: row.projectId ?? row.project_id ?? '',
    name: row.name ?? '',
    domain: row.domain ?? '',
    test_type: row.testType ?? row.test_type ?? 'VABF',
    protocol: row.protocol ?? '',
    description: row.description ?? '',
    profile_type: row.profileType ?? row.profile_type ?? '',
    target_host: row.targetHost ?? row.target_host ?? '',
    target_port: row.targetPort ?? row.target_port ?? 0,
    parameters: row.parameters ?? {},
    config: row.config ?? {},
    created_at: row.createdAt ? new Date(row.createdAt).toISOString() : (row.created_at ?? ''),
    updated_at: row.updatedAt ? new Date(row.updatedAt).toISOString() : (row.updated_at ?? ''),
  };
}

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
    script_version: row.scriptVersion ?? row.script_version ?? null,
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

export const repositoryApi = {
  // ─── Profiles ─────────────────────────────────────────────────────────
  async listProfiles(projectId: string) {
    const rows = await trpcVanilla.profiles.list.query({ projectId });
    return {
      data: (rows as any[]).map(dbToProfile),
      pagination: { page: 1, limit: 50, total: (rows as any[]).length, total_pages: 1 },
    };
  },

  async createProfile(projectId: string, data: Record<string, any>) {
    const result = await trpcVanilla.profiles.create.mutate({
      projectId,
      name: data.name ?? '',
      domain: data.domain,
      testType: data.test_type ?? data.testType ?? 'VABF',
      protocol: data.protocol,
      description: data.description,
      profileType: data.profile_type ?? data.profileType,
      targetHost: data.target_host ?? data.targetHost,
      targetPort: data.target_port ?? data.targetPort,
      parameters: data.parameters,
      config: data.config,
    });
    return dbToProfile(result);
  },

  async updateProfile(profileId: string, data: Record<string, any>) {
    const result = await trpcVanilla.profiles.update.mutate({
      uid: profileId,
      name: data.name,
      domain: data.domain,
      testType: data.test_type ?? data.testType,
      protocol: data.protocol,
      description: data.description,
      profileType: data.profile_type ?? data.profileType,
      targetHost: data.target_host ?? data.targetHost,
      targetPort: data.target_port ?? data.targetPort,
      parameters: data.parameters,
      config: data.config,
    });
    return dbToProfile(result);
  },

  async deleteProfile(profileId: string) {
    await trpcVanilla.profiles.delete.mutate({ uid: profileId });
  },

  // ─── Scenarios ────────────────────────────────────────────────────────
  async listScenarios(profileId: string) {
    const rows = await trpcVanilla.scenarios.list.query({ projectId: profileId });
    return {
      data: (rows as any[]).map(dbToScenario),
      pagination: { page: 1, limit: 50, total: (rows as any[]).length, total_pages: 1 },
    };
  },

  async listScenariosByProject(projectId: string) {
    const rows = await trpcVanilla.scenarios.list.query({ projectId });
    return {
      data: (rows as any[]).map(dbToScenario),
      pagination: { page: 1, limit: 50, total: (rows as any[]).length, total_pages: 1 },
    };
  },

  async createScenario(profileId: string, data: Record<string, any>, projectId?: string) {
    const result = await trpcVanilla.scenarios.create.mutate({
      projectId: projectId ?? data.project_id ?? '',
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

  async updateScenario(scenarioId: string, data: Record<string, any>) {
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

  async deleteScenario(scenarioId: string) {
    await trpcVanilla.scenarios.delete.mutate({ uid: scenarioId });
  },

  // ─── Executions ───────────────────────────────────────────────────────
  async listExecutions(projectId: string, _params?: Record<string, any>) {
    const rows = await trpcVanilla.executions.list.query({ projectId });
    return {
      data: (rows as any[]).map(dbToExecution),
      pagination: { page: 1, limit: 50, total: (rows as any[]).length, total_pages: 1 },
    };
  },

  async getExecution(executionId: string) {
    const row = await trpcVanilla.executions.getByUid.query({ uid: executionId });
    return dbToExecution(row);
  },

  async getJobByExecution(executionId: string) {
    // Map to capture jobs by execution
    try {
      const jobs = await trpcVanilla.captures.listJobs.query({ projectId: executionId });
      return (jobs as any[])[0] ?? null;
    } catch {
      return null;
    }
  },
};
