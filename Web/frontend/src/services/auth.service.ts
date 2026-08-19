import { api } from './api'
import { useAuthStore } from '@/stores/auth.store'

interface LoginPayload {
  email: string
  password: string
}

interface RegisterPayload {
  email: string
  password: string
  nom: string
  prenom?: string
  role_id?: number
  entreprise_id?: number
}

export const authService = {
  async login(payload: LoginPayload) {
    const res = await api.post('/auth/login', payload)
    const { access_token, refresh_token, user } = res.data
    // Sauvegarder dans le store Zustand
    useAuthStore.getState().login(access_token, refresh_token, user)
    return res.data
  },

  async logout() {
    const refreshToken = localStorage.getItem('refresh_token')
    try {
      if (refreshToken) {
        await api.post('/auth/logout', { refresh_token: refreshToken })
      }
    } catch {
      // ignorer les erreurs de logout côté serveur
    } finally {
      useAuthStore.getState().logout()
    }
  },

  async me() {
    const res = await api.get('/auth/me')
    return res.data.user
  },

  async register(payload: RegisterPayload) {
    const res = await api.post('/auth/register', payload)
    return res.data
  },

  async changePassword(oldPassword: string, newPassword: string, confirmPassword: string) {
    const res = await api.post('/auth/change-password', {
      old_password: oldPassword,
      new_password: newPassword,
      confirm_password: confirmPassword,
    })
    return res.data
  },

  async refreshToken() {
    const refreshToken = localStorage.getItem('refresh_token')
    if (!refreshToken) throw new Error('No refresh token')
    const res = await api.post('/auth/refresh', { refresh_token: refreshToken })
    const { access_token, refresh_token } = res.data
    localStorage.setItem('access_token', access_token)
    if (refresh_token) localStorage.setItem('refresh_token', refresh_token)
    return access_token
  },
}
