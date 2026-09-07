import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { employeTerrainService } from '@/services/employeTerrain.service'
import type { DashboardTerrain } from '@/types'

export function EmployePage() {
  const [dash, setDash] = useState<DashboardTerrain | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    employeTerrainService.getDashboard().then(setDash)
      .catch(() => setErr('Impossible de charger le tableau de bord'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
  if (err) return <div className="alert alert-danger m-3">{err}</div>
  if (!dash) return null

  const nomComplet = [dash.employe.prenom, dash.employe.nom].filter(Boolean).join(' ')
  const p = dash.presence

  return (
    <div className="container-fluid py-3">
      <h4 className="mb-3">Bonjour, {nomComplet || 'Employé'}</h4>

      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          <h6 className="text-muted mb-2"><i className="bi bi-geo-alt"></i> Chantier actuel</h6>
          {dash.chantier_actuel ? (
            <div>
              <strong>{dash.chantier_actuel.nom}</strong>
              <span className={`badge ms-2 ${dash.chantier_actuel.statut === 'en_cours' ? 'bg-success' : 'bg-secondary'}`}>
                {dash.chantier_actuel.statut}
              </span>
              {dash.chantier_actuel.adresse && <div className="text-muted small">{dash.chantier_actuel.adresse}</div>}
            </div>
          ) : <div className="text-muted">Aucun chantier en cours</div>}
        </div>
      </div>

      <div className="row g-2 mb-3">
        <div className="col-6 col-md-3">
          <Link to="/employe/chantiers" className="card text-decoration-none border-0 shadow-sm h-100">
            <div className="card-body text-center">
              <div className="display-6 fw-bold text-primary">{dash.nb_chantiers}</div>
              <small className="text-muted">Mes chantiers</small>
            </div>
          </Link>
        </div>
        <div className="col-6 col-md-3">
          <Link to="/employe/taches" className="card text-decoration-none border-0 shadow-sm h-100">
            <div className="card-body text-center">
              <div className="display-6 fw-bold text-warning">{dash.taches_du_jour.restantes}</div>
              <small className="text-muted">Tâches restantes</small>
            </div>
          </Link>
        </div>
        <div className="col-6 col-md-3">
          <Link to="/employe/travaux" className="card text-decoration-none border-0 shadow-sm h-100">
            <div className="card-body text-center">
              <div className="display-6 fw-bold text-success">{dash.taches_du_jour.terminees}</div>
              <small className="text-muted">Tâches terminées</small>
            </div>
          </Link>
        </div>
        <div className="col-6 col-md-3">
          <Link to="/employe/notifications" className="card text-decoration-none border-0 shadow-sm h-100">
            <div className="card-body text-center">
              <div className="display-6 fw-bold text-danger">{p.heures_total.toFixed(1)}h</div>
              <small className="text-muted">Heures aujourd'hui</small>
            </div>
          </Link>
        </div>
      </div>

      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          <h6 className="mb-2"><i className="bi bi-stopwatch"></i> Mon activité aujourd'hui</h6>
          <div className="row text-center g-2">
            <div className="col"><small className="text-muted d-block">Entrée</small><strong>{p.heure_entree || '--:--'}</strong></div>
            <div className="col"><small className="text-muted d-block">Pause début</small><strong>{p.pause_debut || '--:--'}</strong></div>
            <div className="col"><small className="text-muted d-block">Pause fin</small><strong>{p.pause_fin || '--:--'}</strong></div>
            <div className="col"><small className="text-muted d-block">Sortie</small><strong>{p.heure_sortie || '--:--'}</strong></div>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <h6 className="mb-2">Actions rapides</h6>
          <div className="d-flex flex-wrap gap-2">
            <Link to="/employe/rapports" className="btn btn-primary btn-sm"><i className="bi bi-file-earmark-text"></i> Rapport</Link>
            <Link to="/employe/travaux" className="btn btn-success btn-sm"><i className="bi bi-bar-chart"></i> Travail</Link>
            <Link to="/employe/photos" className="btn btn-info btn-sm text-white"><i className="bi bi-camera"></i> Photo</Link>
            <Link to="/employe/signalements" className="btn btn-warning btn-sm"><i className="bi bi-exclamation-triangle"></i> Signaler</Link>
            <Link to="/employe/profil" className="btn btn-secondary btn-sm"><i className="bi bi-person"></i> Mon profil</Link>
          </div>
        </div>
      </div>
    </div>
  )
}