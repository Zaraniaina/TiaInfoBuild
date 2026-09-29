import { api } from './api'
import type { Employe, Pointage, Equipe, HeureSupplementaire, Conge, CongeListe, SoldeConge, RapportPaie, Document } from '@/types'

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

  async getEmploye(id: number) {
    const res = await api.get<Employe>(`/rh/employes/${id}`)
    return res.data
  },

  async getEmployeDocuments(id: number) {
    const res = await api.get<{ items: Document[] }>(`/rh/employes/${id}/documents`)
    return res.data.items
  },

  async createEmployeDocument(id: number, data: { nom: string; categorie: string; fichier_url?: string; description?: string }) {
    const res = await api.post<Document>(`/rh/employes/${id}/documents`, data)
    return res.data
  },

  async createEmploye(data: Partial<Employe>) {
    const res = await api.post<Employe>('/rh/employes', data)
    return res.data
  },

  /** Upload de la photo de l'employé (badge QR + profil). */
  async uploadEmployePhoto(id: number, file: File) {
    const form = new FormData()
    form.append('fichier', file)
    const res = await api.post<{ photo: string }>(`/rh/employes/${id}/photo`, form)
    return res.data
  },

  /** Upload d'un document administratif (CV, lettre de motivation, diplôme...). */
  async uploadEmployeDocument(
    id: number,
    file: File,
    meta: { categorie: string; nom?: string; description?: string },
  ) {
    const form = new FormData()
    form.append('fichier', file)
    form.append('categorie', meta.categorie)
    if (meta.nom) form.append('nom', meta.nom)
    if (meta.description) form.append('description', meta.description)
    const res = await api.post<Document>(`/rh/employes/${id}/documents/upload`, form)
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

  async validerPointage(id: number) {
    const res = await api.post<Pointage>(`/rh/pointages/${id}/valider`, {})
    return res.data
  },

  async refuserPointage(id: number, commentaire?: string) {
    const res = await api.post<Pointage>(`/rh/pointages/${id}/refuser`, { commentaire })
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
