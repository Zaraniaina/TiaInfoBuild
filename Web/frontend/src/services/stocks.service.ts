import { api } from './api'
import type { Article, MouvementStock, Fournisseur, Depot, EmpruntOutillage, BonReception, BonSortieChantier } from '@/types'

export const stocksService = {
  // Articles
  async getArticles(params?: { search?: string; categorie?: string; stock_bas?: boolean }) {
    try {
      const res = await api.get('/stocks/articles', { params })
      return (res.data as any).items || res.data
    } catch {
      return []
    }
  },

  async createArticle(data: Partial<Article>) {
    try {
      const res = await api.post<Article>('/stocks/articles', data)
      return res.data
    } catch {
      return { id: Date.now(), ...data } as Article
    }
  },

  async updateArticle(id: number, data: Partial<Article>) {
    try {
      const res = await api.put<Article>(`/stocks/articles/${id}`, data)
      return res.data
    } catch {
      return { id, ...data } as Article
    }
  },

  async adjustStock(id: number, data: { quantite: number; type_mouvement: 'entree' | 'sortie' | 'inventaire' | 'ajustement'; chantier_id?: number; notes?: string; prix_unitaire?: number }) {
    try {
      const res = await api.put<Article>(`/stocks/articles/${id}/stock`, data)
      return res.data
    } catch {
      return { id, ...data } as unknown as Article
    }
  },

  // Mouvements
  async getMouvements(params?: { article_id?: number; type_mouvement?: string }) {
    try {
      const res = await api.get('/stocks/mouvements', { params })
      return (res.data as any).items || res.data
    } catch {
      return []
    }
  },

  async createMouvement(data: Partial<MouvementStock>) {
    try {
      const res = await api.post<MouvementStock>('/stocks/mouvements', data)
      return res.data
    } catch {
      return { id: Date.now(), ...data } as MouvementStock
    }
  },

  // Fournisseurs
  async getFournisseurs(params?: { search?: string }) {
    try {
      const res = await api.get('/stocks/fournisseurs', { params })
      return (res.data as any).items || res.data
    } catch {
      return []
    }
  },

  async createFournisseur(data: Partial<Fournisseur>) {
    try {
      const res = await api.post<Fournisseur>('/stocks/fournisseurs', data)
      return res.data
    } catch {
      return { id: Date.now(), ...data } as Fournisseur
    }
  },

  // Dépôts BTP
  async getDepots(params?: { search?: string }) {
    try {
      const res = await api.get('/stocks/depots', { params })
      return (res.data as any).items || res.data
    } catch {
      return []
    }
  },

  async createDepot(data: Partial<Depot>) {
    try {
      const res = await api.post<Depot>('/stocks/depots', data)
      return res.data
    } catch {
      return { id: Date.now(), ...data } as Depot
    }
  },

  async updateDepot(id: number, data: Partial<Depot>) {
    try {
      const res = await api.put<Depot>(`/stocks/depots/${id}`, data)
      return res.data
    } catch {
      return { id, ...data } as Depot
    }
  },

  async deleteDepot(id: number) {
    await api.delete(`/stocks/depots/${id}`)
  },
}


