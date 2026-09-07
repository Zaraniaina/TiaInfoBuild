import { api } from './api'

export interface DashboardData {
  client?: { id: number; nom: string; prenom: string }
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
    statut: string
    etapes: Record<string, boolean>
  }[]
}

export interface ProfilData {
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
  nom: string
  adresse?: string
  statut?: string
  [k: string]: any
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
  getDashboard: async (): Promise<DashboardData> => {
    const { data } = await api.get('/espace-client/dashboard')
    // Normalise la structure backend { client, compteurs, projets[] } vers le format frontend
    const c = data.compteurs || {}
    return {
      client: data.client,
      demandes: {
        nouvelles: c.demandes?.nouvelles ?? 0,
        en_cours: c.demandes?.en_cours ?? 0,
        traitees: c.demandes?.traitees ?? 0,
      },
      projets: c.projets ?? 0,
      devis: {
        en_attente: c.devis?.en_attente ?? 0,
        acceptes: c.devis?.acceptes ?? 0,
        refuses: c.devis?.refuses ?? 0,
      },
      contrats: { actifs: c.contrats?.actifs ?? 0, termines: c.contrats?.termines ?? 0 },
      chantiers: { en_cours: c.chantiers?.en_cours ?? 0, termines: c.chantiers?.termines ?? 0 },
      factures: {
        a_payer: c.factures?.a_payer ?? 0,
        partielles: c.factures?.partiellement_payees ?? 0,
        payees: c.factures?.payees ?? 0,
      },
      montant_restant: c.montant_restant_a_payer ?? 0,
      projets_progression: (data.projets || []).map((p: any) => ({
        projet_id: p.id,
        reference: p.reference,
        nom: p.nom,
        statut: p.statut,
        etapes: p.etapes || {},
      })),
    }
  },

  getProfil: async (): Promise<ProfilData> => {
    const { data } = await api.get('/espace-client/profil')
    return data
  },

  updateProfil: async (profil: Partial<ProfilData>): Promise<ProfilData> => {
    const { data } = await api.put('/espace-client/profil', profil)
    return data.client || data
  },

  changePassword: async (oldPassword: string, newPassword: string): Promise<void> => {
    await api.post('/espace-client/mot-de-passe', {
      ancien_mot_de_passe: oldPassword,
      nouveau_mot_de_passe: newPassword,
    })
  },

  getDemandes: async (): Promise<DemandeTravaux[]> => {
    const { data } = await api.get('/espace-client/demandes')
    return data.items || []
  },

  getDemande: async (id: number): Promise<DemandeTravaux> => {
    const { data } = await api.get(`/espace-client/demandes/${id}`)
    return data.demande || data
  },

  getProjets: async (): Promise<Projet[]> => {
    const { data } = await api.get('/espace-client/projets')
    return data.items || []
  },

  getProjet: async (id: number): Promise<Projet> => {
    const { data } = await api.get(`/espace-client/projets/${id}`)
    return data
  },

  getDevis: async (): Promise<Devis[]> => {
    const { data } = await api.get('/espace-client/devis')
    return data.items || []
  },

  getDevisDetail: async (id: number): Promise<{ devis: Devis; lignes: LigneDevis[] }> => {
    const { data } = await api.get(`/espace-client/devis/${id}`)
    return { devis: data.devis || data, lignes: data.lignes || [] }
  },

  repondreDevis: async (id: number, action: 'accepter' | 'refuser', motif?: string): Promise<Devis> => {
    const { data } = await api.post(`/espace-client/devis/${id}/reponse`, {
      action,
      motif_reponse: motif,
    })
    return data.devis || data
  },

  getContrats: async (): Promise<Contrat[]> => {
    const { data } = await api.get('/espace-client/contrats')
    return data.items || []
  },

  getContrat: async (id: number): Promise<Contrat> => {
    const { data } = await api.get(`/espace-client/contrats/${id}`)
    return data.contrat || data
  },

  getAvenants: async (contratId?: number): Promise<Avenant[]> => {
    const url = contratId
      ? `/espace-client/avenants?contrat_id=${contratId}`
      : '/espace-client/avenants'
    const { data } = await api.get(url)
    return data.items || []
  },

  getChantiers: async (): Promise<any[]> => {
    const { data } = await api.get('/espace-client/chantiers')
    return data.items || []
  },

  getChantier: async (id: number): Promise<any> => {
    const { data } = await api.get(`/espace-client/chantiers/${id}`)
    return data
  },

  getAvancements: async (): Promise<any[]> => {
    const { data } = await api.get('/espace-client/avancements')
    return data.items || []
  },

  getSituations: async (): Promise<any[]> => {
    const { data } = await api.get('/espace-client/situations')
    return data.items || []
  },

  getSituation: async (id: number): Promise<any> => {
    const { data } = await api.get(`/espace-client/situations/${id}`)
    return data
  },

  getFactures: async (): Promise<Facture[]> => {
    const { data } = await api.get('/espace-client/factures')
    return data.items || []
  },

  getFacture: async (id: number): Promise<any> => {
    const { data } = await api.get(`/espace-client/factures/${id}`)
    return data
  },

  getPaiements: async (): Promise<any> => {
    const { data } = await api.get('/espace-client/paiements')
    return data
  },

  getDocuments: async (): Promise<Document[]> => {
    const { data } = await api.get('/espace-client/documents')
    return data.items || []
  },

  getNotifications: async (): Promise<Notification[]> => {
    const { data } = await api.get('/espace-client/notifications')
    return data.items || []
  },

  marquerNotificationLue: async (id: number): Promise<void> => {
    await api.post(`/espace-client/notifications/${id}/lu`)
  },

  getPreferences: async (): Promise<Preferences> => {
    const { data } = await api.get('/espace-client/preferences')
    return { notifications_email: data.notif_email, langue: data.langue }
  },

  updatePreferences: async (prefs: Preferences): Promise<Preferences> => {
    const { data } = await api.put('/espace-client/preferences', {
      notif_email: prefs.notifications_email,
      langue: prefs.langue,
    })
    return { notifications_email: data.notif_email, langue: data.langue }
  },
}

