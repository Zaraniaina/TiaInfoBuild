import { api } from './api'
import type { Chantier, Phase, Incident } from '@/types'

export const chantiersService = {
  async getAll(params?: { search?: string; statut?: string }) {
    const res = await api.get('/chantiers', { params })
    return (res.data as any).items || res.data
  },

  async getById(id: number) {
    const res = await api.get<Chantier>(`/chantiers/${id}`)
    return res.data
  },

  async create(data: Partial<Chantier>) {
    const res = await api.post<Chantier>('/chantiers', data)
    return res.data
  },

  async update(id: number, data: Partial<Chantier>) {
    const res = await api.put<Chantier>(`/chantiers/${id}`, data)
    return res.data
  },

  async delete(id: number) {
    const res = await api.delete(`/chantiers/${id}`)
    return res.data
  },

  async addPhase(chantierId: number, data: Partial<Phase>) {
    const res = await api.post<Phase>(`/chantiers/${chantierId}/phases`, data)
    return res.data
  },

  async addIncident(chantierId: number, data: Partial<Incident>) {
    const res = await api.post<Incident>(`/chantiers/${chantierId}/incidents`, data)
    return res.data
  },

  async updateStatut(id: number, statut: string) {
    const res = await api.put<Chantier>(`/chantiers/${id}/statut`, { statut })
    return res.data
  },

  async generateQR(id: number) {
    const res = await api.post(`/chantiers/${id}/qr-pointage`)
    return res.data
  },

  async getQR(id: number) {
    const res = await api.get(`/chantiers/${id}/qr-pointage`)
    return res.data
  },

  async getAffectations(id: number) {
    const res = await api.get(`/chantiers/${id}/affectations`)
    return res.data
  },

  async createAffectation(id: number, data: { employe_id: number; date_debut?: string; date_fin?: string; role?: string }) {
    const res = await api.post(`/chantiers/${id}/affectations`, data)
    return res.data
  },

  async deleteAffectation(id: number, affId: number) {
    const res = await api.delete(`/chantiers/${id}/affectations/${affId}`)
    return res.data
  },

  async getProjetsTransformables() {
    const res = await api.get<{ items: ProjetTransformable[]; total: number }>('/chantiers/projets-transformables')
    return res.data.items
  },

  async transformerProjet(projetId: number) {
    const res = await api.post<Chantier>(`/chantiers/from-projet/${projetId}`)
    return res.data
  }
}

export interface ProjetTransformable {
  projet_id: number
  reference: string | null
  nom: string
  client_id: number | null
  localisation: string | null
  montant_contrat: number
  contrat_reference: string | null
}
