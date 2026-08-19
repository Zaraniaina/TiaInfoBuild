import { api } from './api'
import type { Employe, Pointage, Equipe, HeureSupplementaire } from '@/types'

export const rhService = {
  // Employés
  async getEmployes(params?: { search?: string; statut?: string; poste?: string }) {
    const res = await api.get<Employe[]>('/rh/employes', { params })
    return res.data
  },

  async createEmploye(data: Partial<Employe>) {
    const res = await api.post<Employe>('/rh/employes', data)
    return res.data
  },

  async updateEmploye(id: number, data: Partial<Employe>) {
    const res = await api.put<Employe>(`/rh/employes/${id}`, data)
    return res.data
  },

  async changePoste(id: number, data: { nouveau_poste: string; nouveau_salaire?: number; date_effet: string; motif?: string }) {
    const res = await api.post(`/rh/employes/${id}/changement-poste`, data)
    return res.data
  },

  // Pointages
  async getPointages(params?: { date_debut?: string; date_fin?: string; employe_id?: number; chantier_id?: number }) {
    const res = await api.get<Pointage[]>('/rh/pointages', { params })
    return res.data
  },

  async createPointage(data: Partial<Pointage>) {
    const res = await api.post<Pointage>('/rh/pointages', data)
    return res.data
  },

  // Équipes
  async getEquipes() {
    const res = await api.get<Equipe[]>('/rh/equipes')
    return res.data
  },

  async createEquipe(data: Partial<Equipe>) {
    const res = await api.post<Equipe>('/rh/equipes', data)
    return res.data
  },

  // Heures sup
  async getHeuresSup() {
    const res = await api.get<HeureSupplementaire[]>('/rh/heures-sup')
    return res.data
  },

  async validateHeureSup(id: number, statut: 'validee' | 'refusee') {
    const res = await api.put<HeureSupplementaire>(`/rh/heures-sup/${id}/validation`, { statut })
    return res.data
  }
}
