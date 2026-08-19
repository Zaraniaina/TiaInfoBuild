import { api } from './api'
import type { Entreprise, Utilisateur } from '@/types'

export const settingsService = {
  async getEntreprise() {
    const res = await api.get<Entreprise>('/parametres/entreprise')
    return res.data
  },

  async updateEntreprise(data: Partial<Entreprise>) {
    const res = await api.put<Entreprise>('/parametres/entreprise', data)
    return res.data
  },

  async getUtilisateurs() {
    const res = await api.get<Utilisateur[]>('/utilisateurs')
    return res.data
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
