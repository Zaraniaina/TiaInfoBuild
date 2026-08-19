import { api } from './api'
import type { Depense, RapportFinancier } from '@/types'

export const financeService = {
  async getStats() {
    const res = await api.get('/finance/stats')
    return res.data
  },

  async getDepenses(params?: { categorie?: string; statut?: string }) {
    const res = await api.get<Depense[]>('/finance/depenses', { params })
    return res.data
  },

  async createDepense(data: Partial<Depense>) {
    const res = await api.post<Depense>('/finance/depenses', data)
    return res.data
  },

  async validateDepense(id: number, statut: 'validee' | 'rejetee') {
    const res = await api.put<Depense>(`/finance/depenses/${id}/validation`, { statut })
    return res.data
  },

  async getRapports() {
    const res = await api.get<RapportFinancier[]>('/finance/rapports')
    return res.data
  }
}
