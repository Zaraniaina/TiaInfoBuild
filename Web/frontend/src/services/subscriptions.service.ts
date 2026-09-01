import { api } from './api'
import type { Plan, Subscription, SubscriptionWithPlan } from '@/types'

export const subscriptionsService = {
  async getPlans() {
    const res = await api.get('/subscriptions/public/plans')
    return res.data as Plan[]
  },

  async getAdminPlans() {
    const res = await api.get('/subscriptions/plans')
    return res.data as Plan[]
  },

  async createPlan(plan: Partial<Plan>) {
    const res = await api.post('/subscriptions/plans', plan)
    return res.data as Plan
  },

  async updatePlan(id: number, plan: Partial<Plan>) {
    const res = await api.put(`/subscriptions/plans/${id}`, plan)
    return res.data as Plan
  },

  async togglePlan(id: number) {
    const res = await api.post(`/subscriptions/plans/${id}/toggle`)
    return res.data as Plan
  },

  async deletePlan(id: number) {
    await api.delete(`/subscriptions/plans/${id}`)
  },

  async getSubscriptions(entrepriseId?: number) {
    const res = await api.get('/subscriptions/subscriptions', { params: { entreprise_id: entrepriseId } })
    return res.data as SubscriptionWithPlan[]
  },

  async getMySubscription() {
    const res = await api.get('/subscriptions/entreprise/subscription')
    return res.data as SubscriptionWithPlan | null
  },

  async createSubscription(data: { plan_id: number; periode?: 'mensuel' | 'annuel'; mode_paiement?: string }) {
    const res = await api.post('/subscriptions/entreprise/subscription', {
      plan_id: data.plan_id,
      periode: data.periode || 'mensuel',
      mode_paiement: data.mode_paiement,
      statut: 'actif',
    })
    return res.data as Subscription
  },

  async createAdminSubscription(data: { entreprise_id: number; plan_id: number; periode?: 'mensuel' | 'annuel'; statut?: string }) {
    const res = await api.post('/subscriptions/subscriptions', {
      entreprise_id: data.entreprise_id,
      plan_id: data.plan_id,
      periode: data.periode || 'mensuel',
      statut: data.statut || 'actif',
    })
    return res.data as Subscription
  },

  async updateSubscription(id: number, data: Partial<Subscription>) {
    const res = await api.put(`/subscriptions/subscriptions/${id}`, data)
    return res.data as Subscription
  },

  async cancelSubscription(id: number) {
    const res = await api.post(`/subscriptions/subscriptions/${id}/cancel`)
    return res.data as Subscription
  },
}
