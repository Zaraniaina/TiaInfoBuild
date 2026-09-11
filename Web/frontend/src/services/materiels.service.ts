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
  },

  async uploadPhoto(materielId: number, file: File) {
    const fd = new FormData()
    fd.append('fichier', file)
    const res = await api.post<{ photo_url: string }>(`/materiels/${materielId}/upload-photo`, fd)
    return res.data
  },

  async uploadManuel(materielId: number, file: File) {
    const fd = new FormData()
    fd.append('fichier', file)
    const res = await api.post<{ manuel_url: string }>(`/materiels/${materielId}/upload-manuel`, fd)
    return res.data
  },

  async deletePhoto(materielId: number) {
    const res = await api.delete<{ photo_url: null }>(`/materiels/${materielId}/photo`)
    return res.data
  },

  async deleteManuel(materielId: number) {
    const res = await api.delete<{ manuel_url: null }>(`/materiels/${materielId}/manuel`)
    return res.data
  },
}
