import { api } from './api'
import type { PeriodeRisqueClimatique } from '@/types'

/** Impact climatique d'un chantier : jours d'arrêt documentés + retard net */
export interface ImpactClimatiqueResponse extends Record<string, unknown> {
  chantier_id: number
  region: string | null
  jours_arret_climatique: number
  retard_brut_jours: number
  retard_net_jours: number
  aleas: Array<{
    id: number
    titre: string
    type_alea: string | null
    date_incident: string
    date_fin: string | null
    impact_arret_jours: number | null
    imputabilite: string | null
    gravite: string
    statut: string
  }>
  periodes_risque_actives: PeriodeRisqueClimatique[] | null
}

export const aleasClimatiquesService = {
  async listPeriodesRisque(params?: { region?: string; type_risque?: string }) {
    const res = await api.get('/aleas-climatiques/periodes-risque', { params })
    return (res.data as any).items || res.data
  },

  async createPeriodeRisque(data: {
    region: string
    type_risque: string
    date_debut: string
    date_fin: string
    description?: string
  }) {
    const res = await api.post('/aleas-climatiques/periodes-risque', data)
    return res.data
  },

  async updatePeriodeRisque(id: number, data: Partial<PeriodeRisqueClimatique>) {
    const res = await api.put(`/aleas-climatiques/periodes-risque/${id}`, data)
    return res.data
  },

  async deletePeriodeRisque(id: number) {
    const res = await api.delete(`/aleas-climatiques/periodes-risque/${id}`)
    return res.data
  },

  async getImpact(chantierId: number) {
    const res = await api.get<ImpactClimatiqueResponse>('/aleas-climatiques/impact', {
      params: { chantier_id: chantierId },
    })
    return res.data
  },
}
