import { api } from './api'
import type {
  CommandeFournisseur,
  FactureFournisseur,
  PaiementFournisseur,
  ReceptionFournisseur,
  ImpactAchatsChantier,
} from '@/types'

export interface LigneCommandeInput {
  article_id?: number | null
  designation: string
  quantite: number
  prix_unitaire: number
}

export interface LigneReceptionInput {
  ligne_commande_id: number
  quantite_recue: number
  conforme?: boolean
  notes?: string
}

export const achatsService = {
  // --- Commandes ---
  async listCommandes(params?: {
    statut?: string; fournisseur_id?: number; chantier_id?: number; search?: string
  }) {
    const res = await api.get('/achats/commandes', { params })
    return (res.data as any).items || res.data
  },

  async getCommande(id: number) {
    const res = await api.get<CommandeFournisseur>(`/achats/commandes/${id}`)
    return res.data
  },

  async createCommande(data: {
    fournisseur_id: number
    chantier_id?: number | null
    date_livraison_prevue?: string | null
    taux_tva?: number
    notes?: string
    lignes: LigneCommandeInput[]
  }) {
    const res = await api.post('/achats/commandes', data)
    return res.data
  },

  async updateCommande(id: number, data: Record<string, unknown>) {
    const res = await api.put(`/achats/commandes/${id}`, data)
    return res.data
  },

  async setStatutCommande(id: number, statut: string) {
    const res = await api.post(`/achats/commandes/${id}/statut`, null, { params: { statut } })
    return res.data
  },

  async deleteCommande(id: number) {
    const res = await api.delete(`/achats/commandes/${id}`)
    return res.data
  },

  // --- Réceptions ---
  async listReceptions(commandeId: number) {
    const res = await api.get<ReceptionFournisseur[]>(`/achats/commandes/${commandeId}/receptions`)
    return res.data
  },

  async createReception(commandeId: number, data: {
    date_reception?: string
    depot_id?: number | null
    chantier_id?: number | null
    notes?: string
    lignes: LigneReceptionInput[]
  }) {
    const res = await api.post(`/achats/commandes/${commandeId}/receptions`, data)
    return res.data
  },

  // --- Factures fournisseurs ---
  async listFactures(params?: {
    statut?: string; fournisseur_id?: number; chantier_id?: number; en_retard?: boolean
  }) {
    const res = await api.get('/achats/factures', { params })
    return (res.data as any).items || res.data
  },

  async createFacture(data: {
    fournisseur_id: number
    commande_id?: number | null
    chantier_id?: number | null
    numero: string
    date_echeance?: string | null
    taux_tva?: number
    montant_ht: number
    notes?: string
  }) {
    const res = await api.post('/achats/factures', data)
    return res.data
  },

  async updateFacture(id: number, data: { statut?: string; date_echeance?: string | null; notes?: string }) {
    const res = await api.put(`/achats/factures/${id}`, data)
    return res.data
  },

  // --- Paiements fournisseurs ---
  async listPaiements(factureId: number) {
    const res = await api.get<PaiementFournisseur[]>(`/achats/factures/${factureId}/paiements`)
    return res.data
  },

  async addPaiement(factureId: number, data: {
    montant: number
    date_paiement?: string
    mode_paiement?: string
    reference?: string
    notes?: string
  }) {
    const res = await api.post(`/achats/factures/${factureId}/paiements`, data)
    return res.data
  },

  // --- Impact chantier ---
  async getImpactChantier(chantierId: number) {
    const res = await api.get<ImpactAchatsChantier>(`/achats/impact-chantier/${chantierId}`)
    return res.data
  },
}
