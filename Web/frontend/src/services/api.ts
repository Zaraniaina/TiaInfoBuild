import axios from 'axios';
import type { AxiosResponse } from 'axios'
import { useAuthStore } from '@/stores/auth.store'
import { isDesktop } from '@/utils/buildMode'
import { checkOnline, handleLocalRequest, localError } from './desktopClient'
import {
  MESSAGE_WEB_REQUIS_HORS_LIGNE,
  estRequeteWebRequise,
  redirectionSidecarActivee,
  versUrlLocale,
} from './sidecar'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const api = axios.create({ baseURL: API_URL });

let isRefreshing = false;
let pendingRequests: Array<(token: string | null) => void> = [];

function resolvePendingRequests(token: string | null) {
  pendingRequests.forEach((resolve) => resolve(token));
  pendingRequests = [];
}

export async function performTokenRefresh(): Promise<string | null> {
  if (isRefreshing) {
    return new Promise<string | null>((resolve) => {
      pendingRequests.push(resolve);
    });
  }

  isRefreshing = true;

  try {
    const refresh = useAuthStore.getState().refreshToken || localStorage.getItem('refresh_token');
    if (!refresh) {
      useAuthStore.getState().logout();
      resolvePendingRequests(null);
      return null;
    }

    const { data } = await axios.post(`${API_URL}/auth/refresh`, { refresh_token: refresh });
    const newAccess = data.access_token;
    const newRefresh = data.refresh_token;

    localStorage.setItem('access_token', newAccess);
    localStorage.setItem('refresh_token', newRefresh);
    useAuthStore.getState().setTokens(newAccess, newRefresh || '');

    resolvePendingRequests(newAccess);
    return newAccess;
  } catch (refreshError) {
    console.error('[api] Token refresh failed:', refreshError);
    resolvePendingRequests(null);
    useAuthStore.getState().logout();
    return null;
  } finally {
    isRefreshing = false;
  }
}

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token || localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (config.method === 'get') {
    config.headers['Cache-Control'] = 'public, max-age=60, stale-while-revalidate=30';
  }
  return config;
});

/* Pont desktop (volet Tauri, plan §2) : UNIQUEMENT si l'app tourne dans la
   WebView Tauri — sans isDesktop(), zéro comportement nouveau pour le web.
   - route locale (registre desktopClient) → réponse SQLite servie directement
     via un adaptateur axios synthétique {data, status, statusText, headers,
     config} : TanStack Query et les services ne voient aucune différence ;
   - route non locale online → on laisse passer (config inchangée = relais axios
     existant, mode hybride) ;
   - route non locale hors-ligne → rejet avec `response.data.detail` explicite
     (les `catch` des pages existantes l'affichent tels quels). */
if (isDesktop()) {
  api.interceptors.request.use(async (config) => {
    // RÈGLE PRODUIT « web cerveaux, desktop offline-first » : inscription
    // entreprise, mot de passe oublié/réinitialisation, vérification email et
    // abonnements/paiements sont gérés UNIQUEMENT par le serveur web. Hors
    // ligne, on rejette AVANT toute autre logique avec un message clair
    // (jamais une erreur réseau illisible).
    if (estRequeteWebRequise(config.url) && !(await checkOnline())) {
      throw localError(503, MESSAGE_WEB_REQUIS_HORS_LIGNE, config);
    }

    // Sidecar (`VITE_SIDECAR_HTTP=1`) : l'UI appelle la vraie API FastAPI
    // locale (tia-api.exe) sur la base partagée SQLCipher — axios fait la
    // requête HTTP vers 127.0.0.1:<port auto> (routers montés sous /api).
    // Le mode est activé par défaut côté desktop : les écritures locales sont
    // journalisées dans `_sync_outbox` par le sidecar lui-même (hooks) et la
    // sync bidirectionnelle Rust entretient la parité avec le web.
    if (redirectionSidecarActivee()) {
      const locale = await versUrlLocale(config.url);
      if (locale) config.url = locale;
      return config;
    }

    const local = await handleLocalRequest(config);
    if (local.passThrough) return config;

    const response: AxiosResponse = {
      data: local.data,
      status: local.status ?? 200,
      statusText: 'OK',
      headers: {},
      config,
    };
    config.adapter = async () => response;
    return config;
  });
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    original._retry = true;

    const newToken = await performTokenRefresh();
    if (newToken) {
      original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);
    }
    return Promise.reject(error);
  }
);

let refreshTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleTokenRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer);
  const token = useAuthStore.getState().token || localStorage.getItem('access_token');
  if (!token) return;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp;
    const now = Math.floor(Date.now() / 1000);
    const timeLeft = exp - now;
    const refreshBefore = 5 * 60;
    const delay = Math.max(0, (timeLeft - refreshBefore) * 1000);

    if (delay <= 0) {
      performTokenRefresh().then((newToken) => {
        if (newToken) scheduleTokenRefresh();
      });
      return;
    }

    refreshTimer = setTimeout(async () => {
      const newToken = await performTokenRefresh();
      if (newToken) {
        scheduleTokenRefresh();
      }
    }, delay);
  } catch {
    // ignore parse errors
  }
}

export function cancelTokenRefresh() {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === 'access_token' && event.newValue === null) {
      cancelTokenRefresh();
      useAuthStore.getState().logout();
    }
  });
}
