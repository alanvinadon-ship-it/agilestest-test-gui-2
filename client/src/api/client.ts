import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 3000, // 3s timeout pour basculer rapidement sur le localStore
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor : injecter le token JWT depuis localStorage
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor : gérer les 401 (token expiré)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Ne pas rediriger sur 401 si c'est un timeout ou une erreur réseau
    // (l'API n'est pas disponible, le fallback localStorage prendra le relais)
    if (error.response?.status === 401 && !error.code?.includes('ECONNABORTED')) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export default apiClient;
