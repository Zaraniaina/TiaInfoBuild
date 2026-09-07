import { useEffect, useState } from 'react'
import { employeTerrainService } from '@/services/employeTerrain.service'
import type { TravailRealise } from '@/types'

export function EmployeTravauxPage() {
  const [travaux, setTravaux] = useState<TravailRealise[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [ouvrage, setOuvrage] = useState('')
  const [travail, setTravail] = useState('')
  const [quantite, setQuantite] = useState(0)
  const [unite, setUnite] = useState('')
  const [duree, setDuree] = useState(0)
  const [observations, setObservations] = useState('')

  const load = () => {
    setLoading(true)
    employeTerrainService.getTravaux()
      .then(setTravaux)
      .catch(() => setErr('Impossible de charger vos travaux'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!travail) return
    try {
      await employeTerrainService.declarerTravail({ ouvrage, travail, quantite, unite, duree_heures: duree, observations })
      setShowForm(false); setOuvrage(''); setTravail(''); setQuantite(0); setUnite(''); setDuree(0); setObservations('')
      load()
    } catch { alert('Erreur lors de la déclaration') }
  }

  if (loading) return <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
  if (err) return <div className="alert alert-danger m-3">{err}</div>

  return (
    <div className="container-fluid py-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0"><i className="bi bi-bar-chart"></i> Travaux réalisés</h5>
        <button className="btn btn-success btn-sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? '<i className="bi bi-x"></i> Fermer' : '+ Déclarer un travail'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={soumettre} className="card border-0 shadow-sm mb-3">
          <div className="card-body">
            <div className="row g-2">
              <div className="col-md-3"><input className="form-control form-control-sm" placeholder="Ouvrage" value={ouvrage} onChange={(e) => setOuvrage(e.target.value)} /></div>
              <div className="col-md-3"><input className="form-control form-control-sm" placeholder="Travail réalisé" value={travail} onChange={(e) => setTravail(e.target.value)} required /></div>
              <div className="col-md-2"><input type="number" className="form-control form-control-sm" placeholder="Quantité" value={quantite || ''} onChange={(e) => setQuantite(+e.target.value)} /></div>
              <div className="col-md-2"><input className="form-control form-control-sm" placeholder="Unité (m³, h, ...)" value={unite} onChange={(e) => setUnite(e.target.value)} /></div>
              <div className="col-md-2"><input type="number" step="0.5" className="form-control form-control-sm" placeholder="Durée (h)" value={duree || ''} onChange={(e) => setDuree(+e.target.value)} /></div>
              <div className="col-12"><textarea className="form-control form-control-sm" placeholder="Observations" value={observations} onChange={(e) => setObservations(e.target.value)} rows={2} /></div>
              <div className="col-12"><button type="submit" className="btn btn-primary btn-sm">Enregistrer</button></div>
            </div>
          </div>
        </form>
      )}

      {travaux.length === 0 ? <div className="text-muted">Aucun travail déclaré</div> : (
        <div className="table-responsive">
          <table className="table table-sm">
            <thead><tr><th>Date</th><th>Ouvrage</th><th>Travail</th><th>Qté</th><th>Durée</th></tr></thead>
            <tbody>
              {travaux.slice(0, 20).map((t) => (
                <tr key={t.id}>
                  <td>{t.date_travail || t.created_at?.slice(0, 10)}</td>
                  <td>{t.ouvrage}</td>
                  <td>{t.travail}</td>
                  <td>{t.quantite} {t.unite}</td>
                  <td>{t.duree_heures}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
