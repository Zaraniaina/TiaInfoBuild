import { create } from 'zustand';

interface User {
  id: number;
  email: string;
  nom: string;
  prenom?: string;
  role_code: string;
  entreprise_id?: number;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  login: (token: string, refreshToken: string, user: User) => void;
  logout: () => void;
  setUser: (user: User) => void;
  setTokens: (token: string, refreshToken: string) => void;
}

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
  login: (token, refreshToken, user) => {
    localStorage.setItem('access_token', token);
    localStorage.setItem('refresh_token', refreshToken);
    localStorage.setItem('user_info', JSON.stringify(user));
    set({ token, refreshToken, user, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_info');
    set({ user: null, token: null, refreshToken: null, isAuthenticated: false });
  },
  setUser: (user) => {
    localStorage.setItem('user_info', JSON.stringify(user));
    set({ user });
  },
  setTokens: (token, refreshToken) => {
    localStorage.setItem('access_token', token);
    localStorage.setItem('refresh_token', refreshToken);
    set({ token, refreshToken });
  },
}));
