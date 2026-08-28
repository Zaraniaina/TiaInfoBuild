import { useAuthStore } from '@/stores/auth.store';
import { api } from '@/services/api';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/stores/toast.store';
import type { LoginRequest } from '@/types';

interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: {
    id: number;
    nom: string;
    prenom?: string;
    email: string;
    role_code: string;
    entreprise_id?: number;
    statut?: string;
    must_change_password?: boolean;
  };
}

export function useAuth() {
  const { user, token, isAuthenticated, login, logout: storeLogout } = useAuthStore();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const loginUser = async (credentials: LoginRequest) => {
    const { data } = await api.post<AuthResponse>('/auth/login', credentials);
    login(data.access_token, data.refresh_token, data.user);
    navigate('/dashboard', { replace: true });
    return data;
  };

  const logout = () => {
    storeLogout();
    navigate('/login', { replace: true });
  };

  const fetchMe = async () => {
    try {
      const { data } = await api.get('/auth/me');
      useAuthStore.getState().setUser(data.user);
      return data;
    } catch (err) {
      console.error('[useAuth] fetchMe failed:', err);
      showToast('error', 'Session expirée', 'Veuillez vous reconnecter.', 5000);
      logout();
      throw err;
    }
  };

  return { user, token, isAuthenticated, loginUser, logout, fetchMe };
}
