import { api } from './api'
import type { Client, Devis, Contrat, Facture, Paiement } from '@/types'

export const commercialService = {
  // Clients
  async getClients(params?: { search?: string }) {
    const res = await api.get<Client[]>('/commercial/clients', { params })
    return res.data
  },

  async createClient(data: Partial<Client>) {
    const res = await api.post<Client>('/commercial/clients', data)
    return res.data
  },

  async updateClient(id: number, data: Partial<Client>) {
    const res = await api.put<Client>(`/commercial/clients/${id}`, data)
    return res.data
  },

  // Devis
  async getDevis(params?: { statut?: string; client_id?: number }) {
    const res = await api.get<Devis[]>('/commercial/devis', { params })
    return res.data
  },

  async createDevis(data: Partial<Devis>) {
    const res = await api.post<Devis>('/commercial/devis', data)
    return res.data
  },

  async updateDevis(id: number, data: Partial<Devis>) {
    const res = await api.put<Devis>(`/commercial/devis/${id}`, data)
    return res.data
  },

  async convertDevisToFacture(devisId: number) {
    const res = await api.post<Facture>(`/commercial/devis/${devisId}/transformer-facture`)
    return res.data
  },

  // Contrats
  async getContrats() {
    const res = await api.get<Contrat[]>('/commercial/contrats')
    return res.data
  },

  // Factures
  async getFactures(params?: { statut?: string; client_id?: number }) {
    const res = await api.get<Facture[]>('/commercial/factures', { params })
    return res.data
  },

  async createFacture(data: Partial<Facture>) {
    const res = await api.post<Facture>('/commercial/factures', data)
    return res.data
  },

  // Paiements
  async getPaiements(params?: { facture_id?: number }) {
    const res = await api.get<Paiement[]>('/commercial/paiements', { params })
    return res.data
  },

  async createPaiement(data: Partial<Paiement>) {
    const res = await api.post<Paiement>('/commercial/paiements', data)
    return res.data
  }
}
