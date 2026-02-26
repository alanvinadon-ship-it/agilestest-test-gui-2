/**
 * API Client — Cookie-based authentication.
 *
 * The session cookie (HTTPOnly) is sent automatically by the browser
 * with every request. No need to inject Bearer tokens from localStorage.
 *
 * This client is kept for backward compatibility with repositoryApi/collectorApi
 * wrappers, but all new code should use tRPC hooks directly.
 */
import axios from 'axios';
import { getLoginUrl } from '@/const';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 3000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Send cookies automatically
});

// Interceptor: handle 401 (session expired) — redirect to OAuth login
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.code?.includes('ECONNABORTED')) {
      // Session expired — redirect to OAuth portal
      if (window.location.pathname !== '/login') {
        window.location.href = getLoginUrl();
      }
    }
    return Promise.reject(error);
  },
);

export default apiClient;
