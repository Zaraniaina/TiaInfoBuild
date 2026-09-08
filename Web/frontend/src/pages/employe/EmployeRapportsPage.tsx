import { useEffect, useState } from 'react'
import { employeTerrainService } from '@/services/employeTerrain.service'
import type { RapportJournalier } from '@/types'

export function EmployeRapportsPage() {
  const [rapports, setRapports] = useState<RapportJournalier[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [travauxRealises, setTravauxRealises] = useState('')
  const [quantites, setQuantites] = useState('')
  const [incidents, setIncidents] = useState('')
  const [observations, setObservations] = useState('')

  const load = () => {
    setLoading(true)
    employeTerrainService.getRapports().then(setRapports).catch(() => setErr('Impossible de charger vos rapports')).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!travauxRealises) return
    try {
      await employeTerrainService.creerRapport({ travaux_realises: travauxRealises, quantites_realises: quantites, incidents, observations })
      setShowForm(false); setTravauxRealises(''); setQuantites(''); setIncidents(''); setObservations('')
      load()
    } catch { alert('Erreur lors de la creation du rapport') }
  }

  if (loading) return <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
  if (err) return <div className="alert alert-danger m-3">{err}</div>

  return (
    <div className="container-fluid py-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0"> Rapports journaliers</h5>
        <button className="btn btn-success btn-sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? '<i className="bi bi-x"></i> Fermer' : '+ Nouveau rapport'}
        </button>
      </div>
      {showForm && (
        <form onSubmit={soumettre} className="card border-0 shadow-sm mb-3">
          <div className="card-body">
            <div className="mb-2"><label className="form-label small">Travaux realises *</label><textarea className="form-control form-control-sm" value={travauxRealises} onChange={(e) => setTravauxRealises(e.target.value)} rows={3} required /></div>
            <div className="mb-2"><label className="form-label small">Quantites realisees</label><input className="form-control form-control-sm" value={quantites} onChange={(e) => setQuantites(e.target.value)} /></div>
            <div className="mb-2"><label className="form-label small">Incidents</label><input className="form-control form-control-sm" value={incidents} onChange={(e) => setIncidents(e.target.value)} /></div>
            <div className="mb-2"><label className="form-label small">Observations</label><textarea className="form-control form-control-sm" value={observations} onChange={(e) => setObservations(e.target.value)} rows={2} /></div>
            <button type="submit" className="btn btn-primary btn-sm">Envoyer le rapport</button>
          </div>
        </form>
      )}
      {rapports.length === 0 ? <div className="text-muted">Aucun rapport envoye</div> : (
        <div className="list-group">
          {rapports.map((r) => (
            <div key={r.id} className="list-group-item">
              <div className="d-flex justify-content-between"><strong> {r.date_rapport}</strong><span className="text-muted small">Statut : {r.statut}</span></div>
              {r.travaux_realises && <div className="small mt-1"><strong>Travaux :</strong> {r.travaux_realises}</div>}
              {r.quantites_realises && <div className="small"><strong>Qtes :</strong> {r.quantites_realises}</div>}
              {r.incidents && <div className="small text-danger"><strong>Incidents :</strong> {r.incidents}</div>}
              {r.observations && <div className="small text-secondary">{r.observations}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
