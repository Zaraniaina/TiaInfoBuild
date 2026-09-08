import { api } from './api'
import type { Avenant } from '@/types'

export const avenantsService = {
  async getAll() {
    const res = await api.get<Avenant[]>('/commercial/avenants')
    return res.data
  },

  async getByContrat(contratId: number) {
    const res = await api.get<Avenant[]>(`/commercial/contrats/${contratId}/avenants`)
    return res.data
  },

  async create(contratId: number, data: Partial<Avenant>) {
    const res = await api.post<Avenant>(`/commercial/contrats/${contratId}/avenants`, data)
    return res.data
  },

  async update(id: number, data: Partial<Avenant>) {
    const res = await api.put<Avenant>(`/commercial/avenants/${id}`, data)
    return res.data
  },

  async delete(id: number) {
    const res = await api.delete(`/commercial/avenants/${id}`)
    return res.data
  },
}
