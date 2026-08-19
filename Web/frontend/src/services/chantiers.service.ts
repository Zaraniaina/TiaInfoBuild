import { api } from './api'
import type { Chantier, Phase, Incident } from '@/types'

export const chantiersService = {
  async getAll(params?: { search?: string; statut?: string }) {
    const res = await api.get<Chantier[]>('/chantiers', { params })
    return res.data
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

  async updatePhase(chantierId: number, phaseId: number, data: Partial<Phase>) {
    const res = await api.put<Phase>(`/chantiers/${chantierId}/phases/${phaseId}`, data)
    return res.data
  },

  async addIncident(chantierId: number, data: Partial<Incident>) {
    const res = await api.post<Incident>(`/chantiers/${chantierId}/incidents`, data)
    return res.data
  }
}
