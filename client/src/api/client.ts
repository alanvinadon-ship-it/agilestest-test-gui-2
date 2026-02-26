/**
 * API Client — Legacy axios client.
 *
 * MIGRATION NOTE:
 * - Auth is now handled by Manus OAuth session cookies (httpOnly).
 * - No more localStorage tokens. The tRPC client in lib/trpc.ts
 *   sends credentials: "include" automatically.
 * - This client is kept for legacy endpoints that haven't been
 *   migrated to tRPC yet. New code should use tRPC hooks.
 */
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 3000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Send session cookies
});

// Interceptor: handle 401 (session expired) → redirect to login
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.code?.includes('ECONNABORTED')) {
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export default apiClient;
