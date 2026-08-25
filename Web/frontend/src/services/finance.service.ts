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
  },

  async getBudgetOverruns() {
    const res = await api.get('/finance/budget-overruns')
    return res.data
  },

  async getPaymentDelays(clientId?: number) {
    const res = await api.get('/finance/payment-delays', { params: clientId ? { client_id: clientId } : {} })
    return res.data
  },

  async getClientOutstanding() {
    const res = await api.get('/finance/client-outstanding')
    return res.data
  },

  async generateRapport(periode: string) {
    const res = await api.post('/finance/rapports/generate', null, { params: { periode } })
    return res.data
  },
}
