import { useEffect, useState } from 'react'
import type { Article, MouvementStock, Fournisseur } from '@/types'
import { stocksService } from '@/services/stocks.service'
import { useAuthStore } from '@/stores/auth.store'
import { getRolePermissions } from '@/config/roles.config'
import { TableSkeleton } from '@/components/ui/Skeleton'

export function StocksPage() {
  const { user } = useAuthStore()
  const perms = getRolePermissions(user?.role_code || '')

  const [activeTab, setActiveTab] = useState<'articles' | 'mouvements' | 'fournisseurs'>('articles')
  const [articles, setArticles] = useState<Article[]>([])
  const [mouvements, setMouvements] = useState<MouvementStock[]>([])
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [stockAlertFilter, setStockAlertFilter] = useState('')

  // Modals
  const [showArticleModal, setShowArticleModal] = useState(false)
  const [showMouvementModal, setShowMouvementModal] = useState(false)
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)
  const [articleForm, setArticleForm] = useState<Partial<Article>>({})
  const [mouvementForm, setMouvementForm] = useState<{
    article_id: number
    quantite: number
    type_mouvement: 'entree' | 'sortie' | 'inventaire'
    notes: string
  }>({
    article_id: 0,
    quantite: 1,
    type_mouvement: 'entree',
    notes: ''
  })

  const loadData = async () => {
    setLoading(true)
    try {
      if (activeTab === 'articles') {
        const data = await stocksService.getArticles({ search })
        setArticles(data)
      } else if (activeTab === 'mouvements') {
        const data = await stocksService.getMouvements()
        setMouvements(data)
      } else if (activeTab === 'fournisseurs') {
        const data = await stocksService.getFournisseurs()
        setFournisseurs(data)
      }
    } catch {
      setArticles([])
      setMouvements([])
      setFournisseurs([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [activeTab, search])

  const handleSaveArticle = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (selectedArticle) {
        await stocksService.updateArticle(selectedArticle.id, articleForm)
      } else {
        await stocksService.createArticle(articleForm)
      }
      setShowArticleModal(false)
      loadData()
    } catch {
      alert('Erreur lors de la sauvegarde de l\'article.')
    }
  }

  const handleSaveMouvement = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await stocksService.createMouvement({
        article_id: mouvementForm.article_id,
        quantite: mouvementForm.quantite,
        type_mouvement: mouvementForm.type_mouvement as any,
        notes: mouvementForm.notes,
        prix_unitaire: 0,
        date_mouvement: new Date().toISOString().split('T')[0]
      })
      setShowMouvementModal(false)
      loadData()
    } catch {
      alert('Erreur lors de l\'enregistrement du mouvement.')
    }
  }

  const exportArticlesCSV = () => {
    const headers = ['Reference', 'Nom', 'Stock Actuel', 'Stock Mini', 'Prix Vente']
    const rows = articles.map(a => [a.reference, a.nom, a.stock_actuel, a.stock_mini, a.prix_vente])
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', 'articles_stock_export.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const filteredArticles = articles.filter(a => {
    if (stockAlertFilter === 'rupture') return a.stock_actuel === 0
    if (stockAlertFilter === 'bas') return a.stock_actuel <= a.stock_mini && a.stock_actuel > 0
    if (stockAlertFilter === 'ok') return a.stock_actuel > a.stock_mini
    return true
  })

  return (
    <div className="container-fluid py-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
           <h2 className="mb-1 text-secondary"><i className="bi bi-box-seam me-2"></i>Gestion des Stocks</h2>
           <p className="text-secondary mb-0">Articles, matériaux de chantier, mouvements et fournisseurs</p>
        </div>
        {activeTab === 'articles' && perms.canCreateArticle ? (
          <button className="btn btn-outline-secondary fw-bold" onClick={() => { setSelectedArticle(null); setArticleForm({ stock_actuel: 0, stock_mini: 10, prix_vente: 0 }); setShowArticleModal(true); }}>
            <i className="bi bi-plus-lg me-2"></i>Nouvel article
          </button>
        ) : activeTab === 'mouvements' && perms.canAddMouvementStock ? (
          <button className="btn btn-outline-secondary fw-bold" onClick={() => { setMouvementForm({ article_id: articles[0]?.id || 1, quantite: 1, type_mouvement: 'entree', notes: '' }); setShowMouvementModal(true); }}>
            <i className="bi bi-arrow-left-right me-2"></i>Nouveau mouvement
          </button>
        ) : null}
      </div>

      {/* Tabs */}
      <ul className="nav nav-pills mb-4 p-2 rounded shadow-sm">
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'articles' ? 'active' : ''}`} onClick={() => setActiveTab('articles')}>
            <i className="bi bi-box-seam me-2"></i>Articles & Matériaux
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'mouvements' ? 'active' : ''}`} onClick={() => setActiveTab('mouvements')}>
            <i className="bi bi-arrow-left-right me-2"></i>Mouvements de Stock
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'fournisseurs' ? 'active' : ''}`} onClick={() => setActiveTab('fournisseurs')}>
            <i className="bi bi-truck me-2"></i>Fournisseurs
          </button>
        </li>
      </ul>

      {/* Main Content */}
      {loading ? (
        <div className="card border-0 shadow-sm p-3">
          <TableSkeleton rows={8} columns={5} />
        </div>
      ) : activeTab === 'articles' ? (
        <div>
          <div className="card border-0 shadow-sm mb-4">
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-5">
                  <div className="input-group">
                    <span className="input-group-text bg-light"><i className="bi bi-search text-muted"></i></span>
                    <input type="text" className="form-control bg-light" placeholder="Rechercher un article..." value={search} onChange={e => setSearch(e.target.value)} />
                  </div>
                </div>
                <div className="col-md-4">
                  <select className="form-select bg-light" value={stockAlertFilter} onChange={e => setStockAlertFilter(e.target.value)}>
                    <option value="">Tous les niveaux de stock</option>
                    <option value="ok">En Stock (Normal)</option>
                    <option value="bas">Stock Bas (Alerte)</option>
                    <option value="rupture">Rupture de stock</option>
                  </select>
                </div>
                <div className="col-md-3 d-flex gap-2 justify-content-end">
                  <button className="btn btn-outline-secondary" onClick={exportArticlesCSV}>
                    <i className="bi bi-download me-1"></i>Exporter
                  </button>
                  <button className="btn btn-outline-secondary" onClick={loadData}>
                    <i className="bi bi-arrow-clockwise"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="card border-0 shadow-sm">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Référence</th>
                    <th>Désignation / Article</th>
                    <th>Stock Actuel</th>
                    <th>Stock Sécurité</th>
                    <th>Prix Vente U.</th>
                    <th>État du Stock</th>
                    <th style={{ width: '100px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredArticles.map(art => {
                    const isLow = art.stock_actuel <= art.stock_mini
                    const isRupture = art.stock_actuel === 0
                    return (
                      <tr key={art.id}>
                        <td className="font-monospace fw-bold text-dark">{art.reference}</td>
                        <td>
                          <div className="fw-semibold text-dark">{art.nom}</div>
                          <small className="text-muted text-truncate d-block" style={{ maxWidth: '250px' }}>{art.description}</small>
                        </td>
                        <td className="font-monospace fs-6 fw-bold">{art.stock_actuel}</td>
                        <td className="font-monospace text-muted">{art.stock_mini}</td>
                        <td className="fw-bold text-secondary">{art.prix_vente?.toLocaleString()} MGA</td>
                        <td>
                          {isRupture ? (
                            <span className="badge bg-danger bg-opacity-10 text-danger border">Rupture</span>
                          ) : isLow ? (
                            <span className="badge bg-warning bg-opacity-10 text-dark border">Stock Bas</span>
                          ) : (
                            <span className="badge bg-success bg-opacity-10 text-success border">En Stock</span>
                          )}
                        </td>
                        <td>
                          <button className="btn btn-sm btn-outline-secondary" onClick={() => { setSelectedArticle(art); setArticleForm(art); setShowArticleModal(true); }}>
                            <i className="bi bi-pencil"></i>
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'mouvements' ? (
        <div className="card border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Article ID</th>
                  <th>Type Mouvement</th>
                  <th>Quantité</th>
                  <th>Motif / Chantier</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {mouvements.map(m => (
                  <tr key={m.id}>
                    <td className="fw-semibold">Article #{m.article_id}</td>
                      <td>
                        <span className={`badge ${m.type_mouvement === 'entree' ? 'bg-success bg-opacity-10 text-success border' : 'bg-danger bg-opacity-10 text-danger border'}`}>
                          {m.type_mouvement}
                        </span>
                      </td>
                    <td className="font-monospace fw-bold">{m.quantite}</td>
                    <td>{m.notes || '-'}</td>
                    <td className="small text-muted">{m.date_mouvement || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="row g-4">
          {fournisseurs.map(f => (
            <div key={f.id} className="col-md-6">
              <div className="card border-0 shadow-sm h-100 kpi-card">
                <div className="card-body">
                  <h5 className="fw-bold text-dark mb-2">{f.nom}</h5>
                  <p className="text-muted small mb-1"><i className="bi bi-geo-alt me-2"></i>{f.adresse || 'Antananarivo'}</p>
                  <p className="text-muted small mb-1"><i className="bi bi-telephone me-2"></i>{f.telephone || '-'}</p>
                  <p className="text-muted small mb-0"><i className="bi bi-envelope me-2"></i>{f.email || '-'}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Add Article */}
      {showArticleModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">{selectedArticle ? 'Éditer l\'Article' : 'Nouveau Matériau / Article'}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowArticleModal(false)}></button>
              </div>
              <form onSubmit={handleSaveArticle}>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Référence *</label>
                      <input type="text" className="form-control font-monospace" required value={articleForm.reference || ''} onChange={e => setArticleForm({ ...articleForm, reference: e.target.value })} />
                    </div>
                    <div className="col-md-8">
                      <label className="form-label fw-semibold">Désignation *</label>
                      <input type="text" className="form-control" required value={articleForm.nom || ''} onChange={e => setArticleForm({ ...articleForm, nom: e.target.value })} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Stock Actuel</label>
                      <input type="number" className="form-control font-monospace" value={articleForm.stock_actuel || 0} onChange={e => setArticleForm({ ...articleForm, stock_actuel: Number(e.target.value) })} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Stock Sécurité (Mini)</label>
                      <input type="number" className="form-control font-monospace" value={articleForm.stock_mini || 10} onChange={e => setArticleForm({ ...articleForm, stock_mini: Number(e.target.value) })} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Prix Unitaire (MGA)</label>
                      <input type="number" className="form-control font-monospace" value={articleForm.prix_vente || 0} onChange={e => setArticleForm({ ...articleForm, prix_vente: Number(e.target.value) })} />
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-semibold">Description</label>
                      <textarea className="form-control" rows={2} value={articleForm.description || ''} onChange={e => setArticleForm({ ...articleForm, description: e.target.value })}></textarea>
                    </div>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowArticleModal(false)}>Annuler</button>
                  <button type="submit" className="btn btn-outline-secondary fw-bold">Enregistrer</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal Add Mouvement */}
      {showMouvementModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-md modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">Nouveau Mouvement de Stock</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowMouvementModal(false)}></button>
              </div>
              <form onSubmit={handleSaveMouvement}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Article *</label>
                    <select className="form-select" value={mouvementForm.article_id} onChange={e => setMouvementForm({ ...mouvementForm, article_id: Number(e.target.value) })}>
                      {articles.map(a => (
                        <option key={a.id} value={a.id}>{a.reference} - {a.nom}</option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Type de Mouvement *</label>
                    <select className="form-select" value={mouvementForm.type_mouvement} onChange={e => setMouvementForm({ ...mouvementForm, type_mouvement: e.target.value as any })}>
                      <option value="entree">Entrée Stock (Réception)</option>
                      <option value="sortie">Sortie Stock (Affectation Chantier)</option>
                      <option value="inventaire">Ajustement Inventaire</option>
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Quantité *</label>
                    <input type="number" className="form-control font-monospace" required min={1} value={mouvementForm.quantite} onChange={e => setMouvementForm({ ...mouvementForm, quantite: Number(e.target.value) })} />
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Motif / Affectation</label>
                    <input type="text" className="form-control" placeholder="ex: Chantier Anosy" value={mouvementForm.notes} onChange={e => setMouvementForm({ ...mouvementForm, notes: e.target.value })} />
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowMouvementModal(false)}>Annuler</button>
                  <button type="submit" className="btn btn-outline-secondary fw-bold">Enregistrer le mouvement</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
