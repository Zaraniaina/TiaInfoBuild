import { api } from './api'

export interface ClientDashboard {
  demandes: { nouvelles: number; en_cours: number; traitees: number }
  projets: number
  devis: { en_attente: number; acceptes: number; refuses: number }
  contrats: { actifs: number; termines: number }
  chantiers: { en_cours: number; termines: number }
  factures: { a_payer: number; partielles: number; payees: number }
  montant_restant: number
  projets_progression?: {
    projet_id: number
    reference: string
    nom: string
    etape_courante: string
    etat: string
  }[]
}

export interface ClientProfil {
  id: number
  nom: string
  prenom: string
  email: string
  telephone?: string
  adresse?: string
  ville?: string
  pays?: string
  type_client?: string
  raison_sociale?: string
  infos_facturation?: string
}

export interface DemandeTravaux {
  id: number
  reference: string
  titre: string
  type_travaux?: string
  date_demande?: string
  projet_id?: number
  statut: string
  description?: string
  localisation?: string
  date_souhaitee?: string
  observations?: string
  fichiers?: string[]
}

export interface Projet {
  id: number
  reference: string
  nom: string
  localisation?: string
  type_projet?: string
  date_creation?: string
  statut: string
  description?: string
  adresse?: string
}

export interface Devis {
  id: number
  numero: string
  projet_id?: number
  projet_nom?: string
  date_creation?: string
  date_validite?: string
  montant_ht: number
  tva: number
  montant_ttc: number
  statut: string
  reponse_le?: string
  conditions_paiement?: string
}

export interface LigneDevis {
  id: number
  designation: string
  quantite: number
  unite: string
  prix_unitaire: number
  montant: number
}

export interface Contrat {
  id: number
  numero: string
  projet_id?: number
  projet_nom?: string
  date_signature?: string
  date_debut?: string
  date_fin_prevue?: string
  montant: number
  statut: string
}

export interface Avenant {
  id: number
  numero: string
  contrat_id?: number
  objet?: string
  date?: string
  impact_financier?: number
  statut: string
}

export interface Chantier {
  id: number
  nom: string
  projet_id?: number
  localisation?: string
  date_debut?: string
  date_fin_prevue?: string
  avancement?: number
  statut: string
  responsable?: string
}

export interface Facture {
  id: number
  numero: string
  projet_id?: number
  chantier_id?: number
  projet_nom?: string
  date_creation?: string
  montant_ttc: number
  montant_paye: number
  reste_a_payer: number
  statut: string
  date_echeance?: string
  conditions_paiement?: string
}

export interface Paiement {
  id: number
  date?: string
  reference?: string
  facture_id?: number
  facture_numero?: string
  mode_paiement?: string
  montant: number
  statut: string
}

export interface Document {
  id: number
  categorie: string
  nom: string
  fichier_url?: string
  taille_octets?: number
  mime_type?: string
  description?: string
  created_at?: string
}

export interface Notification {
  id: number
  type: string
  titre: string
  message: string
  entite_type?: string
  entite_id?: number
  lu: boolean
  canal?: string
  created_at?: string
}

export interface Preferences {
  notifications_email?: boolean
  langue?: string
}

export const espaceClientService = {
  getDashboard: async (): Promise<ClientDashboard> => {
    const { data } = await api.get('/espace-client/dashboard')
    return data
  },

  getProfil: async (): Promise<ClientProfil> => {
    const { data } = await api.get('/espace-client/profil')
    return data
  },

  updateProfil: async (profil: Partial<ClientProfil>): Promise<ClientProfil> => {
    const { data } = await api.put('/espace-client/profil', profil)
    return data
  },

  changePassword: async (oldPassword: string, newPassword: string): Promise<void> => {
    await api.post('/espace-client/mot-de-passe', {
      ancien_mot_de_passe: oldPassword,
      nouveau_mot_de_passe: newPassword,
    })
  },

  getDemandes: async (): Promise<DemandeTravaux[]> => {
    const { data } = await api.get('/espace-client/demandes')
    return data
  },

  getDemande: async (id: number): Promise<DemandeTravaux> => {
    const { data } = await api.get(`/espace-client/demandes/${id}`)
    return data
  },

  getProjets: async (): Promise<Projet[]> => {
    const { data } = await api.get('/espace-client/projets')
    return data
  },

  getProjet: async (id: number): Promise<Projet> => {
    const { data } = await api.get(`/espace-client/projets/${id}`)
    return data
  },

  getDevis: async (): Promise<Devis[]> => {
    const { data } = await api.get('/espace-client/devis')
    return data
  },

  getDevisDetail: async (id: number): Promise<{ devis: Devis; lignes: LigneDevis[] }> => {
    const { data } = await api.get(`/espace-client/devis/${id}`)
    return data
  },

  repondreDevis: async (id: number, action: 'accepter' | 'refuser', motif?: string): Promise<Devis> => {
    const { data } = await api.post(`/espace-client/devis/${id}/reponse`, {
      action,
      motif_reponse: motif,
    })
    return data
  },

  getContrats: async (): Promise<Contrat[]> => {
    const { data } = await api.get('/espace-client/contrats')
    return data
  },

  getContrat: async (id: number): Promise<Contrat> => {
    const { data } = await api.get(`/espace-client/contrats/${id}`)
    return data
  },

  getAvenants: async (contratId?: number): Promise<Avenant[]> => {
    const url = contratId
      ? `/espace-client/avenants?contrat_id=${contratId}`
      : '/espace-client/avenants'
    const { data } = await api.get(url)
    return data
  },

  getChantiers: async (): Promise<Chantier[]> => {
    const { data } = await api.get('/espace-client/chantiers')
    return data
  },

  getChantier: async (id: number): Promise<Chantier> => {
    const { data } = await api.get(`/espace-client/chantiers/${id}`)
    return data
  },

  getAvancements: async (): Promise<any[]> => {
    const { data } = await api.get('/espace-client/avancements')
    return data
  },

  getSituations: async (): Promise<any[]> => {
    const { data } = await api.get('/espace-client/situations')
    return data
  },

  getSituation: async (id: number): Promise<any> => {
    const { data } = await api.get(`/espace-client/situations/${id}`)
    return data
  },

  getFactures: async (): Promise<Facture[]> => {
    const { data } = await api.get('/espace-client/factures')
    return data
  },

  getFacture: async (id: number): Promise<Facture> => {
    const { data } = await api.get(`/espace-client/factures/${id}`)
    return data
  },

  getPaiements: async (): Promise<Paiement[]> => {
    const { data } = await api.get('/espace-client/paiements')
    return data
  },

  getDocuments: async (): Promise<Document[]> => {
    const { data } = await api.get('/espace-client/documents')
    return data
  },

  getNotifications: async (): Promise<Notification[]> => {
    const { data } = await api.get('/espace-client/notifications')
    return data
  },

  marquerNotificationLue: async (id: number): Promise<void> => {
    await api.post(`/espace-client/notifications/${id}/lu`)
  },

  getPreferences: async (): Promise<Preferences> => {
    const { data } = await api.get('/espace-client/preferences')
    return data
  },

  updatePreferences: async (prefs: Preferences): Promise<Preferences> => {
    const { data } = await api.put('/espace-client/preferences', prefs)
    return data
  },
}
