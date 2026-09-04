import { api } from './api'
import type {
  Client,
  Devis,
  Contrat,
  Facture,
  Paiement,
  LigneDevis,
  LigneFacture,
  DemandeTravaux,
  DemandeTravauxCreate,
  DemandeTravauxUpdate,
  Projet,
  ProjetCreate,
  ProjetUpdate,
  Metre,
  MetreCreate,
  MetreUpdate,
  SituationTravaux,
  SituationTravauxCreate,
  SituationTravauxUpdate,
  LigneSituation,
  LigneSituationCreate,
} from '@/types'

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
  },

  // ============================================================
  // DEMANDES DE TRAVAUX
  // ============================================================
  async getDemandes(params?: { skip?: number; limit?: number }) {
    const res = await api.get<DemandeTravaux[]>('/commercial/demandes', { params })
    return res.data
  },

  async getDemandeById(id: number) {
    const res = await api.get<DemandeTravaux>(`/commercial/demandes/${id}`)
    return res.data
  },

  async createDemande(data: DemandeTravauxCreate) {
    const res = await api.post<DemandeTravaux>('/commercial/demandes', data)
    return res.data
  },

  async updateDemande(id: number, data: DemandeTravauxUpdate) {
    const res = await api.put<DemandeTravaux>(`/commercial/demandes/${id}`, data)
    return res.data
  },

  async deleteDemande(id: number) {
    const res = await api.delete<void>(`/commercial/demandes/${id}`)
    return res.data
  },

  // ============================================================
  // PROJETS
  // ============================================================
  async getProjets(params?: { skip?: number; limit?: number }) {
    const res = await api.get<Projet[]>('/commercial/projets', { params })
    return res.data
  },

  async getProjetById(id: number) {
    const res = await api.get<Projet>(`/commercial/projets/${id}`)
    return res.data
  },

  async createProjet(data: ProjetCreate) {
    const res = await api.post<Projet>('/commercial/projets', data)
    return res.data
  },

  async updateProjet(id: number, data: ProjetUpdate) {
    const res = await api.put<Projet>(`/commercial/projets/${id}`, data)
    return res.data
  },

  async deleteProjet(id: number) {
    const res = await api.delete<void>(`/commercial/projets/${id}`)
    return res.data
  },

  // ============================================================
  // MÉTRÉS
  // ============================================================
  async getMetres(params?: { skip?: number; limit?: number }) {
    const res = await api.get<Metre[]>('/commercial/metres', { params })
    return res.data
  },

  async getMetreById(id: number) {
    const res = await api.get<Metre>(`/commercial/metres/${id}`)
    return res.data
  },

  async createMetre(data: MetreCreate) {
    const res = await api.post<Metre>('/commercial/metres', data)
    return res.data
  },

  async updateMetre(id: number, data: MetreUpdate) {
    const res = await api.put<Metre>(`/commercial/metres/${id}`, data)
    return res.data
  },

  async deleteMetre(id: number) {
    const res = await api.delete<void>(`/commercial/metres/${id}`)
    return res.data
  },

  // ============================================================
  // SITUATIONS DE TRAVAUX
  // ============================================================
  async getSituations(params?: { skip?: number; limit?: number }) {
    const res = await api.get<SituationTravaux[]>('/commercial/situations', { params })
    return res.data
  },

  async getSituationById(id: number) {
    const res = await api.get<SituationTravaux>(`/commercial/situations/${id}`)
    return res.data
  },

  async createSituation(data: SituationTravauxCreate) {
    const res = await api.post<SituationTravaux>('/commercial/situations', data)
    return res.data
  },

  async updateSituation(id: number, data: SituationTravauxUpdate) {
    const res = await api.put<SituationTravaux>(`/commercial/situations/${id}`, data)
    return res.data
  },

  async deleteSituation(id: number) {
    const res = await api.delete<void>(`/commercial/situations/${id}`)
    return res.data
  },

  // ============================================================
  // LIGNES DE SITUATION
  // ============================================================
  async getLignesSituation(situationId: number) {
    const res = await api.get<LigneSituation[]>(`/commercial/situations/${situationId}/lignes`)
    return res.data
  },

  async createLigneSituation(situationId: number, data: LigneSituationCreate) {
    const res = await api.post<LigneSituation>(`/commercial/situations/${situationId}/lignes`, data)
    return res.data
  },

  async deleteLigneSituation(situationId: number, ligneId: number) {
    const res = await api.delete<void>(`/commercial/situations/${situationId}/lignes/${ligneId}`)
    return res.data
  },
}
