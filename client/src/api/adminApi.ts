import apiClient from './client';
import type { LoginRequest, LoginResponse, User } from '../types';

const PREFIX = '/api/v1/admin';

export const adminApi = {
  login: (data: LoginRequest) =>
    apiClient.post<LoginResponse>(`${PREFIX}/auth/login`, data).then((r) => r.data),

  getMe: () =>
    apiClient.get<{ data: User }>(`${PREFIX}/users/me`).then((r) => r.data.data),

  listUsers: (params?: { page?: number; limit?: number; role?: string }) =>
    apiClient
      .get<{ data: User[]; pagination: { page: number; limit: number; total: number; total_pages: number } }>(`${PREFIX}/users`, { params })
      .then((r) => r.data),
};
