import { api } from './api'
import type { Alerte } from '@/types'

export const alertesService = {
  async getAll(params?: { lue?: boolean; type_alerte?: string }) {
    const res = await api.get<Alerte[]>('/alertes', { params })
    return res.data
  },

  async markAsRead(id: number) {
    const res = await api.put(`/alertes/${id}/lire`)
    return res.data
  },

  async markAllAsRead() {
    const res = await api.put('/alertes/tout-lire')
    return res.data
  }
}
