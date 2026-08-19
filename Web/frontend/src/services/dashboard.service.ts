import { api } from './api'

export const dashboardService = {
  async getStats() {
    const res = await api.get('/dashboard/stats')
    return res.data
  },

  async getCaEvolution(mois = 6) {
    const res = await api.get('/dashboard/ca-evolution', { params: { mois } })
    return res.data
  },

  async getTopChantiers(limit = 5) {
    const res = await api.get('/dashboard/top-chantiers', { params: { limit } })
    return res.data
  },
}
