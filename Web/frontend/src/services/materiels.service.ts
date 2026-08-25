import { api } from './api'
import type { Materiel, Maintenance } from '@/types'

export const materielsService = {
  async getAll(params?: { statut?: string; search?: string }) {
    const res = await api.get<Materiel[]>('/materiels/', { params })
    return res.data
  },

  async create(data: Partial<Materiel>) {
    const res = await api.post<Materiel>('/materiels/', data)
    return res.data
  },

  async update(id: number, data: Partial<Materiel>) {
    const res = await api.put<Materiel>(`/materiels/${id}`, data)
    return res.data
  },

  async delete(id: number) {
    const res = await api.delete(`/materiels/${id}`)
    return res.data
  },

  async getMaintenances(materielId?: number) {
    const res = await api.get<Maintenance[]>('/materiels/maintenances', { params: { materiel_id: materielId } })
    return res.data
  },

  async addMaintenance(materielId: number, data: Partial<Maintenance>) {
    const res = await api.post<Maintenance>(`/materiels/${materielId}/maintenance`, data)
    return res.data
  }
}
