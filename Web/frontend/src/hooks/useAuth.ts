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
    // Mapper tous les champs disponibles dans la réponse vers le store
    const userToStore = {
      id: data.user.id,
      nom: data.user.nom,
      prenom: data.user.prenom,
      email: data.user.email,
      role_code: data.user.role_code,
      entreprise_id: data.user.entreprise_id,
      statut: data.user.statut,
      must_change_password: data.user.must_change_password ?? false,
    }
    login(data.access_token, data.refresh_token, userToStore);
    navigate('/', { replace: true });
    return data;
  };

  const logout = () => {
    storeLogout();
    navigate('/login', { replace: true });
  };

  const fetchMe = async () => {
    try {
      const { data } = await api.get('/auth/me');
      const rawUser = data.user
      if (rawUser) {
        useAuthStore.getState().setUser({
          id: rawUser.id,
          nom: rawUser.nom,
          prenom: rawUser.prenom,
          email: rawUser.email,
          role_code: rawUser.role_code,
          entreprise_id: rawUser.entreprise_id,
          statut: rawUser.statut,
          must_change_password: rawUser.must_change_password ?? false,
          date_creation: rawUser.date_creation,
          derniere_connexion: rawUser.derniere_connexion,
        })
      }
      return data;
    } catch (err) {
      console.error('[useAuth] fetchMe failed:', err)
      showToast('error', 'Session expirée', 'Veuillez vous reconnecter.', 5000)
      logout()
      throw err
    }
  };

  return { user, token, isAuthenticated, loginUser, logout, fetchMe };
}
