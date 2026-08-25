import axios from 'axios';
import { useAuthStore } from '@/stores/auth.store'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const api = axios.create({ baseURL: API_URL });

let isRefreshing = false;
let pendingRequests: Array<(token: string) => void> = [];

function rejectPendingRequests() {
  pendingRequests.forEach((resolve) => resolve(''));
  pendingRequests = [];
}

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token || localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      if (isRefreshing) {
        await new Promise((resolve) => {
          pendingRequests.push(resolve);
        });
        const token = useAuthStore.getState().token || localStorage.getItem('access_token');
        if (token) {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        }
        return Promise.reject(error);
      }

      isRefreshing = true;
      const refresh = useAuthStore.getState().refreshToken || localStorage.getItem('refresh_token');

      if (refresh) {
        try {
          const { data } = await axios.post(`${API_URL}/auth/refresh`, { refresh_token: refresh });
          const newAccess = data.access_token;
          const newRefresh = data.refresh_token;
          localStorage.setItem('access_token', newAccess);
          if (newRefresh) localStorage.setItem('refresh_token', newRefresh);
          useAuthStore.getState().setTokens(newAccess, newRefresh || '');
          pendingRequests.forEach((resolve) => resolve(newAccess));
          pendingRequests = [];
          original.headers.Authorization = `Bearer ${newAccess}`;
          return api(original);
        } catch {
          rejectPendingRequests();
          useAuthStore.getState().logout();
          window.location.href = '/login';
        } finally {
          isRefreshing = false;
        }
      } else {
        rejectPendingRequests();
        useAuthStore.getState().logout();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === 'access_token' && event.newValue === null) {
      useAuthStore.getState().logout();
    }
  });
}
