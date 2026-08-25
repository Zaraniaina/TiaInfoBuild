import { api } from './api'
import type { Alerte } from '@/types'

export const alertesService = {
  async getAll(params?: { non_lues?: boolean; gravite?: string; type_entite?: string }) {
    const res = await api.get<Alerte[]>('/alertes', { params })
    return res.data
  },

  async markAsRead(id: number) {
    const res = await api.post(`/alertes/${id}/lue`)
    return res.data
  },

  async markAllAsRead() {
    const res = await api.post('/alertes/marquer-toutes-lues')
    return res.data
  }
}
