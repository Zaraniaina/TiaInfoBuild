import { api } from './api'
import type {
  DashboardTerrain,
  ChantierTerrain,
  TacheTerrain,
  TravailRealise,
  RapportJournalier,
  PhotoChantier,
     Signalement,
  NotificationTerrain,
  Document,
  Pointage,
  Conge,
} from '@/types'

const BASE = '/employe-terrain'

export const employeTerrainService = {
  getDashboard: () => api.get<DashboardTerrain>(`${BASE}/dashboard`).then((r) => r.data),

  getChantiers: () => api.get<{ items: ChantierTerrain[] }>(`${BASE}/chantiers`).then((r) => r.data.items),

  getChantier: (id: number) => api.get<{ chantier: any }>(`${BASE}/chantiers/${id}`).then((r) => r.data.chantier),

  getTaches: () => api.get<{ items: TacheTerrain[] }>(`${BASE}/taches`).then((r) => r.data.items),

  updateTacheStatut: (id: number, statut: string) =>
    api.put(`${BASE}/taches/${id}/statut`, { statut }).then((r) => r.data),

  declarerTravail: (data: Partial<TravailRealise>) =>
    api.post(`${BASE}/travaux-realises`, data).then((r) => r.data),

  getTravaux: () => api.get<{ items: TravailRealise[] }>(`${BASE}/travaux-realises`).then((r) => r.data.items),

  creerRapport: (data: Partial<RapportJournalier>) =>
    api.post(`${BASE}/rapports`, data).then((r) => r.data),

  getRapports: () => api.get<{ items: RapportJournalier[] }>(`${BASE}/rapports`).then((r) => r.data.items),

  envoyerPhoto: (data: Partial<PhotoChantier>) =>
    api.post(`${BASE}/photos`, data).then((r) => r.data),

  getPhotos: () => api.get<{ items: PhotoChantier[] }>(`${BASE}/photos`).then((r) => r.data.items),

  creerSignalement: (data: Partial<Signalement>) =>
    api.post(`${BASE}/signalements`, data).then((r) => r.data),

  getSignalements: () => api.get<{ items: Signalement[] }>(`${BASE}/signalements`).then((r) => r.data.items),

  getNotifications: () =>
    api.get<{ items: NotificationTerrain[]; non_lues: number }>(`${BASE}/notifications`).then((r) => r.data),

  marquerNotificationLue: (id: number) =>
    api.post(`${BASE}/notifications/${id}/lu`).then((r) => r.data),

  getProfil: () => api.get<{ employe: any }>(`${BASE}/profil`).then((r) => r.data.employe),

  updateProfil: (data: Record<string, any>) =>
    api.put(`${BASE}/profil`, data).then((r) => r.data),

  getDocuments: () => api.get<{ items: Document[] }>(`${BASE}/documents`).then((r) => r.data.items),

  getMonBadge: () => api.get<{ employe: any; code_qr: string }>(`${BASE}/mon-badge`).then((r) => r.data),

  getPointages: () => api.get<{ items: Pointage[] }>(`${BASE}/pointages`).then((r) => r.data.items),

  getPlanning: () => api.get<{ items: any[] }>(`${BASE}/planning`).then((r) => r.data.items),

  getPresence: () => api.get<{ items: any[] }>(`${BASE}/presence`).then((r) => r.data.items),

  enregistrerPresence: (data: Record<string, any>) =>
    api.post(`${BASE}/presence`, data).then((r) => r.data),

  getCommentaires: (objetType: string, objetId: number) =>
    api.get<{ items: any[] }>(`${BASE}/commentaires/${objetType}/${objetId}`).then((r) => r.data.items),

  ajouterCommentaire: (data: Record<string, any>) =>
    api.post(`${BASE}/commentaires`, data).then((r) => r.data),

  // Congés (self-only)
  demanderConge: (data: { type: string; date_debut: string; date_fin: string; nb_jours: number; motif?: string }) =>
    api.post<Conge>(`${BASE}/conges`, data).then((r) => r.data),

  getMesConges: () =>
    api.get<{ items: Conge[]; total_items: number; solde_restant: number; solde_annuel: number }>(`${BASE}/conges`)
      .then((r) => r.data),

  annulerConge: (id: number) =>
    api.post<Conge>(`${BASE}/conges/${id}/annuler`, {}).then((r) => r.data),
}

