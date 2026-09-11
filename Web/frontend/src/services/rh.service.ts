import { api } from './api'
import type { Employe, Pointage, Equipe, HeureSupplementaire, Conge, CongeListe, SoldeConge, RapportPaie } from '@/types'

export const rhService = {
  // Employés
  async getEmployes(params?: { search?: string; statut?: string; poste?: string }) {
    const res = await api.get('/rh/employes', { params })
    return (res.data as any).items || res.data
  },

  async getEmployeBadgeQR(employeId: number) {
    const res = await api.get(`/rh/employes/${employeId}/badge-qr`)
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
    const res = await api.post(`/rh/employes/${id}/changer-poste`, data)
    return res.data
  },

  // Pointages
  async getPointages(params?: { date_debut?: string; date_fin?: string; employe_id?: number; chantier_id?: number }) {
    const res = await api.get('/rh/pointages', { params })
    return (res.data as any).items || res.data
  },

  async createPointage(data: Partial<Pointage>) {
    const res = await api.post<Pointage>('/rh/pointages', data)
    return res.data
  },

  async qrCheckin(data: { employe_id: number; chantier_id?: number; qr_code_token: string; latitude?: number; longitude?: number; mode?: string }) {
    const res = await api.post<Pointage>('/rh/pointages/qr-checkin', data)
    return res.data
  },

  // Équipes
  async getEquipes() {
    const res = await api.get('/rh/equipes')
    return (res.data as any).items || res.data
  },

  async createEquipe(data: Partial<Equipe>) {
    const res = await api.post<Equipe>('/rh/equipes', data)
    return res.data
  },

  // Heures sup
  async getHeuresSup() {
    const res = await api.get('/rh/heures-sup')
    return (res.data as any).items || res.data
  },

  async validateHeureSup(id: number, statut: 'validee' | 'refusee') {
    const res = await api.put<HeureSupplementaire>(`/rh/heures-sup/${id}/statut`, { statut })
    return res.data
  },

  // Congés (RH)
  async getConges(params?: { statut?: string; employe_id?: number; page?: number; size?: number }) {
    const res = await api.get<CongeListe>('/rh/conges', { params })
    return res.data
  },

  async createConge(data: Partial<Conge>) {
    const res = await api.post<Conge>('/rh/conges', data)
    return res.data
  },

  async validerConge(id: number) {
    const res = await api.post<Conge>(`/rh/conges/${id}/valider`, {})
    return res.data
  },

  async refuserConge(id: number, commentaire?: string) {
    const res = await api.post<Conge>(`/rh/conges/${id}/refuser`, { commentaire })
    return res.data
  },

  async getSoldeConge(employeId: number) {
    const res = await api.get<SoldeConge>(`/rh/conges/${employeId}/solde`)
    return res.data
  },

  // Paie
  async getPaie(mois: number, annee: number) {
    const res = await api.get<RapportPaie>('/rh/paie', { params: { mois, annee } })
    return res.data
  },

  async exportPaie(mois: number, annee: number) {
    const res = await api.get('/rh/paie/export', { params: { mois, annee }, responseType: 'blob' })
    const url = URL.createObjectURL(res.data as Blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `paie_${annee}_${String(mois).padStart(2, '0')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  },
}
