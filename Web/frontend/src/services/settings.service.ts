import { api } from './api'
import type { Entreprise, Utilisateur } from '@/types'

export const settingsService = {
  async getEntreprise() {
    const res = await api.get('/parametres/entreprise')
    return (res.data as any).entreprise || res.data
  },

  async updateEntreprise(data: Partial<Entreprise>) {
    const res = await api.put('/parametres/entreprise', data)
    return (res.data as any).entreprise || res.data
  },

  async getUtilisateurs() {
    const res = await api.get('/utilisateurs')
    return (res.data as any).items || res.data
  },

  async createUtilisateur(data: Partial<Utilisateur>) {
    const res = await api.post<Utilisateur>('/utilisateurs', data)
    return res.data
  },

  async updateUtilisateur(id: number, data: Partial<Utilisateur>) {
    const res = await api.put<Utilisateur>(`/utilisateurs/${id}`, data)
    return res.data
  },

  async exportBackup() {
    const res = await api.post('/parametres/backup', {}, { responseType: 'blob' })
    return res.data
  },

  async getPreferences() {
    const res = await api.get('/preferences/me')
    return res.data
  },

  async updatePreferences(data: Partial<{ theme: string; langue: string; date_format: string; devise: string; notif_email: boolean; notif_push: boolean; notif_factures_retard: boolean; notif_stock_bas: boolean }>) {
    const res = await api.patch('/preferences/me', data)
    return res.data
  },
}
