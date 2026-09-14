import { api } from './api'
import type { Materiel, Maintenance, MouvementMateriel } from '@/types'

export const materielsService = {
  async getAll(params?: { statut?: string; search?: string; type?: string; categorie_btp?: string }) {
    const res = await api.get<Materiel[]>('/materiels/', { params })
    return res.data
  },

  async getOne(id: number) {
    const res = await api.get<Materiel>(`/materiels/${id}`)
    return res.data
  },

  async create(data: Partial<Materiel>) {
    const res = await api.post<Materiel>('/materiels/', data)
    return res.data
  },

  async update(id: number, data: Partial<Materiel>) {
    const res = await api.put<Materiel>(`/materiels/${id}`, data)
    return res.data
  },

  async delete(id: number) {
    const res = await api.delete(`/materiels/${id}`)
    return res.data
  },

  async getMaintenances(materielId?: number) {
    const res = await api.get<Maintenance[]>('/materiels/maintenances', { params: { materiel_id: materielId } })
    return res.data
  },

  async addMaintenance(materielId: number, data: Partial<Maintenance>) {
    const res = await api.post<Maintenance>(`/materiels/${materielId}/maintenance`, data)
    return res.data
  },

  async uploadPhoto(materielId: number, file: File) {
    const fd = new FormData()
    fd.append('fichier', file)
    const res = await api.post<{ photo_url: string }>(`/materiels/${materielId}/upload-photo`, fd)
    return res.data
  },

  async uploadManuel(materielId: number, file: File) {
    const fd = new FormData()
    fd.append('fichier', file)
    const res = await api.post<{ manuel_url: string }>(`/materiels/${materielId}/upload-manuel`, fd)
    return res.data
  },

  async deletePhoto(materielId: number) {
    const res = await api.delete<{ photo_url: null }>(`/materiels/${materielId}/photo`)
    return res.data
  },

  async deleteManuel(materielId: number) {
    const res = await api.delete<{ manuel_url: null }>(`/materiels/${materielId}/manuel`)
    return res.data
  },

  async uploadVGP(materielId: number, file: File) {
    const fd = new FormData()
    fd.append('fichier', file)
    const res = await api.post<{ certificat_vgp_url: string }>(`/materiels/${materielId}/upload-vgp`, fd)
    return res.data
  },

  async deleteVGP(materielId: number) {
    const res = await api.delete<{ certificat_vgp_url: null }>(`/materiels/${materielId}/vgp`)
    return res.data
  },

  async updateHorametre(materielId: number, data: { heures_moteur?: number; kilometrage?: number; notes?: string }) {
    const res = await api.post<Materiel>(`/materiels/${materielId}/horametre`, data)
    return res.data
  },

  async getTransferts(materielId?: number) {
    const res = await api.get<MouvementMateriel[]>('/materiels/transferts', { params: { materiel_id: materielId } })
    return res.data
  },

  async createTransfert(data: { materiel_id: number; chantier_origine_id?: number; chantier_destination_id?: number; transporteur?: string; notes?: string }) {
    const res = await api.post<MouvementMateriel>('/materiels/transferts', data)
    return res.data
  },

  async validerTransfert(transfertId: number) {
    const res = await api.put<MouvementMateriel>(`/materiels/transferts/${transfertId}/valider`)
    return res.data
  },

  async getQRCode(materielId: number) {
    const res = await api.get<{ materiel_id: number; nom: string; numero_serie: string; qr_code_key: string; statut_vgp: string; statut: string }>(`/materiels/${materielId}/qr-code`)
    return res.data
  },
}

