import apiClient from './client';
import type {
  Project, PaginatedResponse, Execution,
  CreateProjectRequest, UpdateProjectRequest,
  TestProfile, TestScenario, Dataset,
} from '../types';

const PREFIX = '/api/v1/repository';

export const repositoryApi = {
  // ─── Projects ──────────────────────────────────────────────────────────────

  listProjects: (params?: { page?: number; limit?: number; status?: string; domain?: string }) =>
    apiClient
      .get<PaginatedResponse<Project>>(`${PREFIX}/projects`, { params })
      .then((r) => r.data),

  getProject: (projectId: string) =>
    apiClient.get<{ data: Project }>(`${PREFIX}/projects/${projectId}`).then((r) => r.data.data),

  createProject: (data: CreateProjectRequest) =>
    apiClient.post<{ data: Project }>(`${PREFIX}/projects`, data).then((r) => r.data.data),

  updateProject: (projectId: string, data: UpdateProjectRequest) =>
    apiClient.put<{ data: Project }>(`${PREFIX}/projects/${projectId}`, data).then((r) => r.data.data),

  deleteProject: (projectId: string) =>
    apiClient.delete(`${PREFIX}/projects/${projectId}`).then((r) => r.data),

  // ─── Executions ────────────────────────────────────────────────────────────

  listExecutions: (projectId: string, params?: { page?: number; limit?: number; status?: string }) =>
    apiClient
      .get<PaginatedResponse<Execution>>(`${PREFIX}/projects/${projectId}/executions`, { params })
      .then((r) => r.data),

  getExecution: (executionId: string) =>
    apiClient.get<{ data: Execution }>(`${PREFIX}/executions/${executionId}`).then((r) => r.data.data),

  createExecution: (projectId: string, data: { profile_id: string; scenario_id: string }) =>
    apiClient.post<{ data: Execution }>(`${PREFIX}/projects/${projectId}/executions`, data).then((r) => r.data.data),

  // ─── Profiles ──────────────────────────────────────────────────────────────

  listProfiles: (projectId: string, params?: { page?: number; limit?: number }) =>
    apiClient
      .get<PaginatedResponse<TestProfile>>(`${PREFIX}/projects/${projectId}/profiles`, { params })
      .then((r) => r.data),

  getProfile: (profileId: string) =>
    apiClient.get<{ data: TestProfile }>(`${PREFIX}/profiles/${profileId}`).then((r) => r.data.data),

  createProfile: (projectId: string, data: Partial<TestProfile>) =>
    apiClient.post<{ data: TestProfile }>(`${PREFIX}/projects/${projectId}/profiles`, data).then((r) => r.data.data),

  updateProfile: (profileId: string, data: Partial<TestProfile>) =>
    apiClient.put<{ data: TestProfile }>(`${PREFIX}/profiles/${profileId}`, data).then((r) => r.data.data),

  deleteProfile: (profileId: string) =>
    apiClient.delete(`${PREFIX}/profiles/${profileId}`).then((r) => r.data),

  // ─── Scenarios ─────────────────────────────────────────────────────────────

  listScenarios: (profileId: string, params?: { page?: number; limit?: number }) =>
    apiClient
      .get<PaginatedResponse<TestScenario>>(`${PREFIX}/profiles/${profileId}/scenarios`, { params })
      .then((r) => r.data),

  getScenario: (scenarioId: string) =>
    apiClient.get<{ data: TestScenario }>(`${PREFIX}/scenarios/${scenarioId}`).then((r) => r.data.data),

  createScenario: (profileId: string, data: Partial<TestScenario>) =>
    apiClient.post<{ data: TestScenario }>(`${PREFIX}/profiles/${profileId}/scenarios`, data).then((r) => r.data.data),

  updateScenario: (scenarioId: string, data: Partial<TestScenario>) =>
    apiClient.put<{ data: TestScenario }>(`${PREFIX}/scenarios/${scenarioId}`, data).then((r) => r.data.data),

  deleteScenario: (scenarioId: string) =>
    apiClient.delete(`${PREFIX}/scenarios/${scenarioId}`).then((r) => r.data),

  // ─── Datasets ──────────────────────────────────────────────────────────────

  listDatasets: (projectId: string, params?: { page?: number; limit?: number }) =>
    apiClient
      .get<PaginatedResponse<Dataset>>(`${PREFIX}/projects/${projectId}/datasets`, { params })
      .then((r) => r.data),

  getDataset: (datasetId: string) =>
    apiClient.get<{ data: Dataset }>(`${PREFIX}/datasets/${datasetId}`).then((r) => r.data.data),

  createDataset: (projectId: string, data: FormData) =>
    apiClient.post<{ data: Dataset }>(`${PREFIX}/projects/${projectId}/datasets`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data.data),

  deleteDataset: (datasetId: string) =>
    apiClient.delete(`${PREFIX}/datasets/${datasetId}`).then((r) => r.data),
};
