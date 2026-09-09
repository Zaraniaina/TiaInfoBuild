import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { espaceClientService, DashboardData } from '@/services/espaceClient.service'

export function ClientDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadDashboard() {
    try {
      setLoading(true)
      const result = await espaceClientService.getDashboard()
      setData(result)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Erreur lors du chargement du tableau de bord')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Chargement...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container py-4">
        <div className="alert alert-danger">{error}</div>
      </div>
    )
  }

  if (!data) return null

  const etatsCycle = ['Demande', 'Projet', 'Devis', 'Contrat', 'Chantier', 'Avancement', 'Facturation', 'Paiement']

  return (
    <div className="container-fluid py-4">
      <div className="row mb-4">
        <div className="col">
          <h4 className="fw-bold text-primary mb-0">
            <i className="bi bi-speedometer2 me-2"></i>
            Bonjour, {data.client?.prenom || ''} {data.client?.nom || ''}
          </h4>
          <p className="text-muted mt-1 mb-0">Vue d'ensemble de vos projets et demandes</p>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <Link to="/client/demandes" className="text-decoration-none">
            <div className="card h-100 border-0 shadow-sm">
              <div className="card-body text-center">
                <div className="text-muted small mb-1">Mes demandes</div>
                <h3 className="fw-bold text-primary mb-1">{data.demandes.nouvelles + data.demandes.en_cours + data.demandes.traitees}</h3>
                <small className="text-muted">
                  {data.demandes.nouvelles} nouvelles, {data.demandes.en_cours} en cours, {data.demandes.traitees} traitées
                </small>
              </div>
            </div>
          </Link>
        </div>
        <div className="col-md-3">
          <Link to="/client/projets" className="text-decoration-none">
            <div className="card h-100 border-0 shadow-sm">
              <div className="card-body text-center">
                <div className="text-muted small mb-1">Mes projets</div>
                <h3 className="fw-bold text-primary mb-1">{data.projets}</h3>
                <small className="text-muted">projets en cours</small>
              </div>
            </div>
          </Link>
        </div>
        <div className="col-md-3">
          <Link to="/client/devis" className="text-decoration-none">
            <div className="card h-100 border-0 shadow-sm">
              <div className="card-body text-center">
                <div className="text-muted small mb-1">Mes devis</div>
                <h3 className="fw-bold text-warning mb-1">{data.devis.en_attente}</h3>
                <small className="text-muted">
                  {data.devis.acceptes} acceptés, {data.devis.refuses} refusés
                </small>
              </div>
            </div>
          </Link>
        </div>
        <div className="col-md-3">
          <Link to="/client/factures" className="text-decoration-none">
            <div className="card h-100 border-0 shadow-sm">
              <div className="card-body text-center">
                <div className="text-muted small mb-1">Factures à payer</div>
                <h3 className="fw-bold text-danger mb-1">{data.factures.a_payer}</h3>
                <small className="text-muted">
                  Reste à payer : <span className="fw-bold">{data.montant_restant?.toLocaleString('fr-FR') || 0} Ar</span>
                </small>
              </div>
            </div>
          </Link>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-6">
          <Link to="/client/contrats" className="text-decoration-none">
            <div className="card h-100 border-0 shadow-sm">
              <div className="card-body text-center">
                <div className="text-muted small mb-1">Mes contrats</div>
                <h3 className="fw-bold text-success mb-1">{data.contrats.actifs}</h3>
                <small className="text-muted">{data.contrats.termines} terminés</small>
              </div>
            </div>
          </Link>
        </div>
        <div className="col-md-6">
          <Link to="/client/chantiers" className="text-decoration-none">
            <div className="card h-100 border-0 shadow-sm">
              <div className="card-body text-center">
                <div className="text-muted small mb-1">Mes chantiers</div>
                <h3 className="fw-bold text-info mb-1">{data.chantiers.en_cours}</h3>
                <small className="text-muted">{data.chantiers.termines} terminés</small>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {data.projets_progression && data.projets_progression.length > 0 && (
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-white border-0">
            <h5 className="mb-0">
              <i className="bi bi-bar-chart-line me-2"></i>Progression de vos projets
            </h5>
          </div>
          <div className="card-body">
            {data.projets_progression.map((projet: any) => (
              <div key={projet.projet_id} className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <div>
                    <span className="fw-semibold">{projet.reference}</span>
                    <span className="text-muted ms-2">{projet.nom}</span>
                  </div>
                  <span className="badge bg-primary">{(projet.statut || '').replace(/_/g, ' ')}</span>
                </div>
                <div className="progress" style={{ height: '24px' }}>
                  {etatsCycle.map((etape: string) => {
                    const atteinte = !!projet.etapes[etape]
                    return (
                      <div
                        key={etape}
                        className={`progress-bar ${atteinte ? 'bg-success' : 'bg-secondary bg-opacity-25'}`}
                        role="progressbar"
                        style={{ width: `${100 / etatsCycle.length}%` }}
                        title={`${etape} : ${atteinte ? 'atteinte' : 'a venir'}`}
                      >
                        {atteinte && <i className="bi bi-check"></i>}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
