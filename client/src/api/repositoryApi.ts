import apiClient from './client';
import {
  localProjects, localProfiles, localScenarios,
  localDatasets, localExecutions,
  localDatasetInstances, localDatasetSecrets, localBundles,
  localBundleItems, localValidation,
  localJobs, localBundleResolve,
} from './localStore';
import type {
  Project, PaginatedResponse, Execution,
  CreateProjectRequest, UpdateProjectRequest,
  TestProfile, TestScenario, Dataset,
  DatasetInstance, TargetEnv, DatasetInstanceStatus,
  DatasetBundle, BundleStatus, BundleItem, DatasetSecretKey,
  BundleValidationResult, ScenarioDatasetValidation,
  RunnerJob, RunnerJobStatus, JobCompletePayload, BundleResolveResult,
} from '../types';

const PREFIX = '/api/v1/repository';

/**
 * Détecte si une API backend est configurée.
 * Si VITE_API_BASE_URL n'est pas défini, on utilise directement le localStorage.
 */
const API_AVAILABLE = !!import.meta.env.VITE_API_BASE_URL;

/**
 * Wrapper : si l'API est configurée, tente l'appel distant avec fallback local.
 * Sinon, utilise directement le localStore (pas d'attente réseau).
 */
async function withFallback<T>(apiFn: () => Promise<T>, localFn: () => T): Promise<T> {
  if (!API_AVAILABLE) {
    return localFn();
  }
  try {
    return await apiFn();
  } catch {
    return localFn();
  }
}

export const repositoryApi = {
  // ─── Projects ──────────────────────────────────────────────────────────────

  listProjects: (params?: { page?: number; limit?: number; status?: string; domain?: string }) =>
    withFallback(
      () => apiClient.get<PaginatedResponse<Project>>(`${PREFIX}/projects`, { params }).then(r => r.data),
      () => localProjects.list(params),
    ),

  getProject: (projectId: string) =>
    withFallback(
      () => apiClient.get<{ data: Project }>(`${PREFIX}/projects/${projectId}`).then(r => r.data.data),
      () => localProjects.get(projectId),
    ),

  createProject: (data: CreateProjectRequest) =>
    withFallback(
      () => apiClient.post<{ data: Project }>(`${PREFIX}/projects`, data).then(r => r.data.data),
      () => localProjects.create(data),
    ),

  updateProject: (projectId: string, data: UpdateProjectRequest) =>
    withFallback(
      () => apiClient.put<{ data: Project }>(`${PREFIX}/projects/${projectId}`, data).then(r => r.data.data),
      () => localProjects.update(projectId, data),
    ),

  deleteProject: (projectId: string) =>
    withFallback(
      () => apiClient.delete(`${PREFIX}/projects/${projectId}`).then(r => r.data),
      () => localProjects.delete(projectId),
    ),

  // ─── Executions ────────────────────────────────────────────────────────────

  listExecutions: (projectId: string, params?: { page?: number; limit?: number; status?: string }) =>
    withFallback(
      () => apiClient.get<PaginatedResponse<Execution>>(`${PREFIX}/projects/${projectId}/executions`, { params }).then(r => r.data),
      () => localExecutions.list(projectId, params),
    ),

  getExecution: (executionId: string) =>
    withFallback(
      () => apiClient.get<{ data: Execution }>(`${PREFIX}/executions/${executionId}`).then(r => r.data.data),
      () => localExecutions.get(executionId),
    ),

  createExecution: (projectId: string, data: { profile_id: string; scenario_id: string }) =>
    withFallback(
      () => apiClient.post<{ data: Execution }>(`${PREFIX}/projects/${projectId}/executions`, data).then(r => r.data.data),
      () => localExecutions.create(projectId, data),
    ),

  // ─── Profiles ──────────────────────────────────────────────────────────────

  listProfiles: (projectId: string, params?: { page?: number; limit?: number; test_type?: string; domain?: string }) =>
    withFallback(
      () => apiClient.get<PaginatedResponse<TestProfile>>(`${PREFIX}/projects/${projectId}/profiles`, { params }).then(r => r.data),
      () => localProfiles.list(projectId, params),
    ),

  getProfile: (profileId: string) =>
    withFallback(
      () => apiClient.get<{ data: TestProfile }>(`${PREFIX}/profiles/${profileId}`).then(r => r.data.data),
      () => localProfiles.get(profileId),
    ),

  createProfile: (projectId: string, data: Partial<TestProfile>) =>
    withFallback(
      () => apiClient.post<{ data: TestProfile }>(`${PREFIX}/projects/${projectId}/profiles`, data).then(r => r.data.data),
      () => localProfiles.create(projectId, data),
    ),

  updateProfile: (profileId: string, data: Partial<TestProfile>) =>
    withFallback(
      () => apiClient.put<{ data: TestProfile }>(`${PREFIX}/profiles/${profileId}`, data).then(r => r.data.data),
      () => localProfiles.update(profileId, data),
    ),

  deleteProfile: (profileId: string) =>
    withFallback(
      () => apiClient.delete(`${PREFIX}/profiles/${profileId}`).then(r => r.data),
      () => localProfiles.delete(profileId),
    ),

  // ─── Scenarios ─────────────────────────────────────────────────────────────

  listScenarios: (profileId: string, params?: { page?: number; limit?: number }) =>
    withFallback(
      () => apiClient.get<PaginatedResponse<TestScenario>>(`${PREFIX}/profiles/${profileId}/scenarios`, { params }).then(r => r.data),
      () => localScenarios.list(profileId, params),
    ),

  listScenariosByProject: (projectId: string, params?: { page?: number; limit?: number }) =>
    withFallback(
      () => apiClient.get<PaginatedResponse<TestScenario>>(`${PREFIX}/projects/${projectId}/scenarios`, { params }).then(r => r.data),
      () => localScenarios.listByProject(projectId, params),
    ),

  getScenario: (scenarioId: string) =>
    withFallback(
      () => apiClient.get<{ data: TestScenario }>(`${PREFIX}/scenarios/${scenarioId}`).then(r => r.data.data),
      () => localScenarios.get(scenarioId),
    ),

  createScenario: (profileId: string, data: Partial<TestScenario>, projectId?: string) =>
    withFallback(
      () => apiClient.post<{ data: TestScenario }>(`${PREFIX}/profiles/${profileId}/scenarios`, data).then(r => r.data.data),
      () => localScenarios.create(profileId, projectId || '', data),
    ),

  updateScenario: (scenarioId: string, data: Partial<TestScenario>) =>
    withFallback(
      () => apiClient.put<{ data: TestScenario }>(`${PREFIX}/scenarios/${scenarioId}`, data).then(r => r.data.data),
      () => localScenarios.update(scenarioId, data),
    ),

  deleteScenario: (scenarioId: string) =>
    withFallback(
      () => apiClient.delete(`${PREFIX}/scenarios/${scenarioId}`).then(r => r.data),
      () => localScenarios.delete(scenarioId),
    ),

  // ─── Datasets ──────────────────────────────────────────────────────────────

  listDatasets: (projectId: string, params?: { page?: number; limit?: number }) =>
    withFallback(
      () => apiClient.get<PaginatedResponse<Dataset>>(`${PREFIX}/projects/${projectId}/datasets`, { params }).then(r => r.data),
      () => localDatasets.list(projectId, params),
    ),

  getDataset: (datasetId: string) =>
    withFallback(
      () => apiClient.get<{ data: Dataset }>(`${PREFIX}/datasets/${datasetId}`).then(r => r.data.data),
      () => localDatasets.get(datasetId),
    ),

  createDataset: (projectId: string, data: FormData | { name: string; description?: string; format: 'CSV' | 'JSON' | 'YAML'; row_count?: number; size_bytes?: number }) =>
    withFallback(
      () => apiClient.post<{ data: Dataset }>(`${PREFIX}/projects/${projectId}/datasets`, data, {
        headers: data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {},
      }).then(r => r.data.data),
      () => {
        if (data instanceof FormData) {
          return localDatasets.create(projectId, {
            name: data.get('name') as string || 'Dataset',
            description: data.get('description') as string || '',
            format: (data.get('format') as 'CSV' | 'JSON' | 'YAML') || 'CSV',
          });
        }
        return localDatasets.create(projectId, data);
      },
    ),

  deleteDataset: (datasetId: string) =>
    withFallback(
      () => apiClient.delete(`${PREFIX}/datasets/${datasetId}`).then(r => r.data),
      () => localDatasets.delete(datasetId),
    ),

  // ─── Dataset Instances (DATASET-1B) ────────────────────────────────────────

  listDatasetInstances: (projectId: string, params?: {
    env?: TargetEnv; dataset_type_id?: string; status?: DatasetInstanceStatus;
    page?: number; limit?: number;
  }) => withFallback(
    () => apiClient.get<PaginatedResponse<DatasetInstance>>(
      `${PREFIX}/projects/${projectId}/dataset-instances`, { params }
    ).then(r => r.data),
    () => localDatasetInstances.list(projectId, params),
  ),

  getDatasetInstance: (id: string) => withFallback(
    () => apiClient.get<{ data: DatasetInstance }>(`${PREFIX}/dataset-instances/${id}`).then(r => r.data.data),
    () => localDatasetInstances.get(id),
  ),

  createDatasetInstance: (projectId: string, data: {
    dataset_type_id: string; env: TargetEnv; values_json?: Record<string, unknown>; notes?: string;
  }) => withFallback(
    () => apiClient.post<{ data: DatasetInstance }>(
      `${PREFIX}/projects/${projectId}/dataset-instances`, data
    ).then(r => r.data.data),
    () => localDatasetInstances.create(projectId, data),
  ),

  updateDatasetInstance: (id: string, data: Partial<Pick<DatasetInstance, 'values_json' | 'status' | 'notes'>>) =>
    withFallback(
      () => apiClient.patch<{ data: DatasetInstance }>(`${PREFIX}/dataset-instances/${id}`, data).then(r => r.data.data),
      () => localDatasetInstances.update(id, data),
    ),

  cloneDatasetInstance: (id: string) => withFallback(
    () => apiClient.post<{ data: DatasetInstance }>(`${PREFIX}/dataset-instances/${id}/clone`).then(r => r.data.data),
    () => localDatasetInstances.clone(id),
  ),

  deleteDatasetInstance: (id: string) => withFallback(
    () => apiClient.delete(`${PREFIX}/dataset-instances/${id}`).then(() => undefined),
    () => localDatasetInstances.delete(id),
  ),

  // ─── Dataset Secrets (DATASET-1B) ──────────────────────────────────────────

  listDatasetSecrets: (datasetId: string) => withFallback(
    () => apiClient.get<{ data: DatasetSecretKey[] }>(
      `${PREFIX}/dataset-instances/${datasetId}/secrets`
    ).then(r => r.data.data),
    () => localDatasetSecrets.list(datasetId),
  ),

  setDatasetSecret: (datasetId: string, keyPath: string, isSecret: boolean) => withFallback(
    () => apiClient.put<{ data: DatasetSecretKey }>(
      `${PREFIX}/dataset-instances/${datasetId}/secrets`, { key_path: keyPath, is_secret: isSecret }
    ).then(r => r.data.data),
    () => localDatasetSecrets.set(datasetId, keyPath, isSecret),
  ),

  removeDatasetSecret: (datasetId: string, keyPath: string) => withFallback(
    () => apiClient.delete(
      `${PREFIX}/dataset-instances/${datasetId}/secrets/${encodeURIComponent(keyPath)}`
    ).then(() => undefined),
    () => localDatasetSecrets.remove(datasetId, keyPath),
  ),

  maskDatasetValues: (datasetId: string, valuesJson: Record<string, unknown>) => withFallback(
    () => apiClient.post<{ data: Record<string, unknown> }>(
      `${PREFIX}/dataset-instances/${datasetId}/mask-values`, { values_json: valuesJson }
    ).then(r => r.data.data),
    () => localDatasetSecrets.maskValues(datasetId, valuesJson),
  ),

  // ─── Dataset Bundles (DATASET-1B) ──────────────────────────────────────────

  listBundles: (projectId: string, params?: {
    env?: TargetEnv; status?: BundleStatus; page?: number; limit?: number;
  }) => withFallback(
    () => apiClient.get<PaginatedResponse<DatasetBundle>>(
      `${PREFIX}/projects/${projectId}/dataset-bundles`, { params }
    ).then(r => r.data),
    () => localBundles.list(projectId, params),
  ),

  getBundle: (id: string) => withFallback(
    () => apiClient.get<{ data: DatasetBundle }>(`${PREFIX}/dataset-bundles/${id}`).then(r => r.data.data),
    () => localBundles.get(id),
  ),

  createBundle: (projectId: string, data: { name: string; env: TargetEnv; tags?: string[] }) =>
    withFallback(
      () => apiClient.post<{ data: DatasetBundle }>(
        `${PREFIX}/projects/${projectId}/dataset-bundles`, data
      ).then(r => r.data.data),
      () => localBundles.create(projectId, data),
    ),

  updateBundle: (id: string, data: Partial<Pick<DatasetBundle, 'name' | 'status' | 'tags'>>) =>
    withFallback(
      () => apiClient.patch<{ data: DatasetBundle }>(`${PREFIX}/dataset-bundles/${id}`, data).then(r => r.data.data),
      () => localBundles.update(id, data),
    ),

  cloneBundle: (id: string) => withFallback(
    () => apiClient.post<{ data: DatasetBundle }>(`${PREFIX}/dataset-bundles/${id}/clone`).then(r => r.data.data),
    () => localBundles.clone(id),
  ),

  deleteBundle: (id: string) => withFallback(
    () => apiClient.delete(`${PREFIX}/dataset-bundles/${id}`).then(() => undefined),
    () => localBundles.delete(id),
  ),

  // ─── Bundle Items (DATASET-1B) ─────────────────────────────────────────────

  listBundleItems: (bundleId: string) => withFallback(
    () => apiClient.get<{ data: BundleItem[] }>(
      `${PREFIX}/dataset-bundles/${bundleId}/items`
    ).then(r => r.data.data),
    () => localBundleItems.list(bundleId),
  ),

  addBundleItem: (bundleId: string, datasetId: string) => withFallback(
    () => apiClient.post<{ data: BundleItem }>(
      `${PREFIX}/dataset-bundles/${bundleId}/items`, { dataset_id: datasetId }
    ).then(r => r.data.data),
    () => localBundleItems.add(bundleId, datasetId),
  ),

  removeBundleItem: (bundleId: string, datasetId: string) => withFallback(
    () => apiClient.delete(
      `${PREFIX}/dataset-bundles/${bundleId}/items/${datasetId}`
    ).then(() => undefined),
    () => localBundleItems.remove(bundleId, datasetId),
  ),

  // ─── Validation (DATASET-1B) ───────────────────────────────────────────────

  validateBundleForScenario: (bundleId: string, scenarioId: string) => withFallback(
    () => apiClient.post<{ data: BundleValidationResult }>(
      `${PREFIX}/dataset-bundles/${bundleId}/validate-for-scenario`, { scenario_id: scenarioId }
    ).then(r => r.data.data),
    () => localValidation.validateBundleForScenario(bundleId, scenarioId),
  ),

  validateScenarioDatasets: (scenarioId: string, env: TargetEnv) => withFallback(
    () => apiClient.post<{ data: ScenarioDatasetValidation }>(
      `${PREFIX}/scenarios/${scenarioId}/validate-datasets`, { env }
    ).then(r => r.data.data),
    () => localValidation.validateScenarioDatasets(scenarioId, env),
  ),

  // ─── Runner Jobs (Orchestration) ────────────────────────────────────────────

  listJobs: (projectId: string, params?: { status?: RunnerJobStatus; runner_id?: string }) => withFallback(
    () => apiClient.get<PaginatedResponse<RunnerJob>>(
      `/api/v1/jobs`, { params: { project_id: projectId, ...params } }
    ).then(r => r.data),
    () => localJobs.list(projectId, params),
  ),

  getJob: (jobId: string) => withFallback(
    () => apiClient.get<{ data: RunnerJob }>(`/api/v1/jobs/${jobId}`).then(r => r.data.data),
    () => localJobs.get(jobId),
  ),

  getJobByExecution: (executionId: string) => withFallback(
    () => apiClient.get<{ data: RunnerJob | null }>(
      `/api/v1/jobs/by-execution/${executionId}`
    ).then(r => r.data.data),
    () => localJobs.getByExecution(executionId),
  ),

  createExecutionWithJob: (projectId: string, data: {
    profile_id: string;
    scenario_id: string;
    script_id: string;
    script_version: number;
    dataset_bundle_id?: string;
    target_env: TargetEnv;
    runner_id?: string;
    artifact_upload_policy?: string[];
  }) => withFallback(
    () => apiClient.post<{ data: { execution: Execution; job: RunnerJob } }>(
      `/api/v1/executions`, { project_id: projectId, ...data }
    ).then(r => r.data.data),
    () => {
      const execution = localExecutions.create(projectId, data);
      const job = localJobs.create({
        execution_id: execution.id,
        project_id: projectId,
        script_id: data.script_id,
        script_version: data.script_version,
        dataset_bundle_id: data.dataset_bundle_id,
        target_env: data.target_env,
      });
      return { execution, job };
    },
  ),

  completeJob: (jobId: string, payload: JobCompletePayload) => withFallback(
    () => apiClient.post<{ data: RunnerJob }>(
      `/api/v1/jobs/${jobId}/complete`, payload
    ).then(r => r.data.data),
    () => localJobs.complete(jobId, payload),
  ),

  // ─── Bundle Resolve ─────────────────────────────────────────────────────────

  resolveBundle: (bundleId: string, env?: TargetEnv) => withFallback(
    () => apiClient.post<{ data: BundleResolveResult }>(
      `${PREFIX}/dataset-bundles/${bundleId}/resolve`, { env }
    ).then(r => r.data.data),
    () => localBundleResolve.resolve(bundleId, env),
  ),
};
