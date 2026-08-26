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
  }
}
