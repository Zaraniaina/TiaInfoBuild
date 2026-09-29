import { create } from 'zustand';
import { scheduleTokenRefresh, cancelTokenRefresh } from '@/services/api';

export interface User {
  id: number;
  email: string;
  nom: string;
  prenom?: string;
  role_code: string;
  entreprise_id?: number;
  telephone?: string;
  photo?: string | null;
  statut?: string;
  must_change_password?: boolean;
  date_creation?: string;
  derniere_connexion?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  /** Session locale desktop (login offline, pas de JWT serveur) — persistant. */
  offline?: boolean;
  login: (token: string, refreshToken: string, user: User) => void;
  /** Ouvre une session locale desktop hors-ligne (sans token serveur). */
  loginOffline: (user: User) => void;
  logout: () => void;
  setUser: (user: User) => void;
  setTokens: (token: string, refreshToken: string) => void;
}

const OFFLINE_SESSION_KEY = 'offline_session';

const getStoredUser = (): User | null => {
  if (typeof window === 'undefined') return null;
  const userStr = localStorage.getItem('user_info');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
};

export const useAuthStore = create<AuthState>((set) => ({
  user: getStoredUser(),
  token: typeof window !== 'undefined' ? localStorage.getItem('access_token') : null,
  refreshToken: typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null,
  isAuthenticated: typeof window !== 'undefined' ? !!localStorage.getItem('access_token') : false,
  offline: typeof window !== 'undefined' ? localStorage.getItem(OFFLINE_SESSION_KEY) === '1' : false,
  login: (token, refreshToken, user) => {
    localStorage.setItem('access_token', token);
    localStorage.setItem('refresh_token', refreshToken);
    localStorage.setItem('user_info', JSON.stringify(user));
    localStorage.removeItem(OFFLINE_SESSION_KEY);
    set({ token, refreshToken, user, isAuthenticated: true, offline: false });
    scheduleTokenRefresh();
  },
  loginOffline: (user) => {
    // Session locale desktop : pas de JWT serveur, drapeau offline persistant.
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.setItem('user_info', JSON.stringify(user));
    localStorage.setItem(OFFLINE_SESSION_KEY, '1');
    set({ token: null, refreshToken: null, user, isAuthenticated: true, offline: true });
  },
  logout: () => {
    cancelTokenRefresh();
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_info');
    localStorage.removeItem(OFFLINE_SESSION_KEY);
    set({ user: null, token: null, refreshToken: null, isAuthenticated: false, offline: false });
  },
  setUser: (user) => {
    localStorage.setItem('user_info', JSON.stringify(user));
    set({ user, isAuthenticated: true });
  },
   setTokens: (token, refreshToken) => {
    localStorage.setItem('access_token', token);
    if (refreshToken) {
      localStorage.setItem('refresh_token', refreshToken);
    } else {
      localStorage.removeItem('refresh_token');
    }
    set({ token, refreshToken });
    scheduleTokenRefresh();
  },
}));
