import { api } from './api'
import type { Article, MouvementStock, Fournisseur } from '@/types'

export const stocksService = {
  // Articles
  async getArticles(params?: { search?: string; categorie?: string; stock_bas?: boolean }) {
    const res = await api.get<Article[]>('/stocks/articles', { params })
    return res.data
  },

  async createArticle(data: Partial<Article>) {
    const res = await api.post<Article>('/stocks/articles', data)
    return res.data
  },

  async updateArticle(id: number, data: Partial<Article>) {
    const res = await api.put<Article>(`/stocks/articles/${id}`, data)
    return res.data
  },

  // Mouvements
  async getMouvements(params?: { article_id?: number; type_mouvement?: string }) {
    const res = await api.get<MouvementStock[]>('/stocks/mouvements', { params })
    return res.data
  },

  async createMouvement(data: Partial<MouvementStock>) {
    const res = await api.post<MouvementStock>('/stocks/mouvements', data)
    return res.data
  },

  // Fournisseurs
  async getFournisseurs(params?: { search?: string }) {
    const res = await api.get<Fournisseur[]>('/stocks/fournisseurs', { params })
    return res.data
  },

  async createFournisseur(data: Partial<Fournisseur>) {
    const res = await api.post<Fournisseur>('/stocks/fournisseurs', data)
    return res.data
  }
}
