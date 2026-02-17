import apiClient from './client';
import {
  localProjects, localProfiles, localScenarios,
  localDatasets, localExecutions,
} from './localStore';
import type {
  Project, PaginatedResponse, Execution,
  CreateProjectRequest, UpdateProjectRequest,
  TestProfile, TestScenario, Dataset,
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
};
