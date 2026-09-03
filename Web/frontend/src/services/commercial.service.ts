import { api } from './api'
import type { Client, Devis, Contrat, Facture, Paiement, LigneDevis, LigneFacture } from '@/types'

export const commercialService = {
  // Clients
  async getClients(params?: { search?: string }) {
    const res = await api.get<Client[]>('/commercial/clients', { params })
    return res.data
  },

  async createClient(data: Partial<Client>) {
    const res = await api.post<Client>('/commercial/clients', data)
    return { data: res.data, headers: res.headers }
  },

  async downloadUtilisateurBonCreation(utilisateurId: number, tempPassword?: string, loginUrl?: string) {
    const params = new URLSearchParams()
    if (tempPassword) params.set('temp_password', tempPassword)
    if (loginUrl) params.set('login_url', loginUrl)
    const query = params.toString()
    const url = `/utilisateurs/${utilisateurId}/bon-de-creation${query ? `?${query}` : ''}`
    const res = await api.get(url, { responseType: 'blob' })
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

  async createDevis(data: Omit<Partial<Devis>, 'lignes'> & { lignes?: Partial<LigneDevis>[] }) {
    const res = await api.post<Devis>('/commercial/devis', data)
    return res.data
  },

  async getDevisById(id: number) {
    const res = await api.get<Devis>(`/commercial/devis/${id}`)
    return res.data
  },

  // Lignes devis
  async createLigneDevis(devisId: number, data: Partial<LigneDevis>) {
    const res = await api.post<LigneDevis>(`/commercial/devis/${devisId}/lignes`, data)
    return res.data
  },

  async updateLigneDevis(devisId: number, ligneId: number, data: Partial<LigneDevis>) {
    const res = await api.put<LigneDevis>(`/commercial/devis/${devisId}/lignes/${ligneId}`, data)
    return res.data
  },

  async deleteLigneDevis(devisId: number, ligneId: number) {
    const res = await api.delete<void>(`/commercial/devis/${devisId}/lignes/${ligneId}`)
    return res.data
  },

  async updateDevis(id: number, data: Partial<Devis>) {
    const res = await api.put<Devis>(`/commercial/devis/${id}`, data)
    return res.data
  },

  async convertDevisToContrat(devisId: number) {
    const res = await api.post<Contrat>(`/commercial/devis/${devisId}/transformer-contrat`)
    return res.data
  },

  async validerDevis(devisId: number, approuve: boolean) {
    const res = await api.post<Devis>(`/commercial/devis/${devisId}/valider`, { approuve })
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

  async createFacture(data: Omit<Partial<Facture>, 'lignes'> & { lignes?: Partial<LigneFacture>[] }) {
    const res = await api.post<Facture>('/commercial/factures', data)
    return res.data
  },

  async updateFacture(id: number, data: Omit<Partial<Facture>, 'lignes'> & { lignes?: Partial<LigneFacture>[] }) {
    const res = await api.put<Facture>(`/commercial/factures/${id}`, data)
    return res.data
  },

  async getFactureById(id: number) {
    const res = await api.get<Facture>(`/commercial/factures/${id}`)
    return res.data
  },

  // Lignes facture
  async createLigneFacture(factureId: number, data: Partial<LigneFacture>) {
    const res = await api.post<LigneFacture>(`/commercial/factures/${factureId}/lignes`, data)
    return res.data
  },

  async updateLigneFacture(factureId: number, ligneId: number, data: Partial<LigneFacture>) {
    const res = await api.put<LigneFacture>(`/commercial/factures/${factureId}/lignes/${ligneId}`, data)
    return res.data
  },

  async deleteLigneFacture(factureId: number, ligneId: number) {
    const res = await api.delete<void>(`/commercial/factures/${factureId}/lignes/${ligneId}`)
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
