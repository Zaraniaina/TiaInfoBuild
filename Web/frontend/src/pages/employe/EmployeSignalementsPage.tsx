import { useEffect, useState } from 'react'
import { employeTerrainService } from '@/services/employeTerrain.service'
import type { Signalement, TypeSignalement, PrioriteSignalement } from '@/types'

const TYPES: TypeSignalement[] = ['incident', 'securite', 'materiel', 'materiau', 'travaux', 'plan_document', 'acces_chantier', 'meteo', 'autre']
const TYPES_LABEL: Record<string, React.ReactNode> = {
  incident: (<><i className="bi bi-exclamation-triangle me-1"></i>Incident</>), securite: (<><i className="bi bi-shield-check me-1"></i>Sécurité</>), materiel: (<><i className="bi bi-wrench me-1"></i>Matériel</>), materiau: (<><i className="bi bi-box me-1"></i>Matériau</>),
  travaux: (<><i className="bi bi-building me-1"></i>Travaux</>), plan_document: (<><i className="bi bi-rulers me-1"></i>Plan/document</>), acces_chantier: (<><i className="bi bi-cone-striped me-1"></i>Accès</>), meteo: (<><i className="bi bi-cloud-rain me-1"></i>Météo</>), autre: 'Autre',
}
const prioriteBadge: Record<string, string> = { basse: 'secondary', normale: 'info', haute: 'warning', urgente: 'danger' }
const statutBadge: Record<string, string> = { ouvert: 'warning', en_cours: 'primary', resolu: 'success', ferme: 'dark' }

export function EmployeSignalementsPage() {
  const [items, setItems] = useState<Signalement[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [type, setType] = useState<TypeSignalement>('incident')
  const [description, setDescription] = useState('')
  const [priorite, setPriorite] = useState<PrioriteSignalement>('normale')
  const [zone, setZone] = useState('')

  const load = () => {
    setLoading(true)
    employeTerrainService.getSignalements()
      .then(setItems)
      .catch(() => setErr('Impossible de charger vos signalements'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!description) return
    try {
      await employeTerrainService.creerSignalement({ type, description, priorite, zone })
      setShowForm(false); setType('incident'); setDescription(''); setPriorite('normale'); setZone('')
      load()
    } catch { alert('Erreur lors du signalement') }
  }

  if (loading) return <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
  if (err) return <div className="alert alert-danger m-3">{err}</div>

  return (
    <div className="container-fluid py-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0"><i className="bi bi-exclamation-triangle"></i> Signalements</h5>
        <button className="btn btn-danger btn-sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? (<><i className="bi bi-x me-1"></i>Fermer</>) : '+ Signaler un problème'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={soumettre} className="card border-0 shadow-sm mb-3">
          <div className="card-body">
            <div className="row g-2">
              <div className="col-md-4">
                <select className="form-select form-select-sm" value={type} onChange={(e) => setType(e.target.value as TypeSignalement)}>
                  {TYPES.map((t) => <option key={t} value={t}>{TYPES_LABEL[t] || t}</option>)}
                </select>
              </div>
              <div className="col-md-3">
                <select className="form-select form-select-sm" value={priorite} onChange={(e) => setPriorite(e.target.value as PrioriteSignalement)}>
                  <option value="basse">Basse</option><option value="normale">Normale</option>
                  <option value="haute">Haute</option><option value="urgente">Urgente</option>
                </select>
              </div>
              <div className="col-md-5"><input className="form-control form-control-sm" placeholder="Zone" value={zone} onChange={(e) => setZone(e.target.value)} /></div>
              <div className="col-12"><textarea className="form-control form-control-sm" placeholder="Description du problème *" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} required /></div>
              <div className="col-12"><button type="submit" className="btn btn-primary btn-sm">Envoyer</button></div>
            </div>
          </div>
        </form>
      )}

      {items.length === 0 ? <div className="text-muted">Aucun signalement</div> : (
        <div className="list-group">
          {items.map((s) => (
            <div key={s.id} className="list-group-item">
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <strong>{TYPES_LABEL[s.type] || s.type}</strong>
                  <div className="text-muted small">{s.created_at?.slice(0, 10)} {s.created_at?.slice(11, 16)}</div>
                  <div className="small mt-1">{s.description}</div>
                  {s.zone && <div className="text-muted small"><i className="bi bi-geo-alt"></i> {s.zone}</div>}
                </div>
                <div className="text-end">
                  <span className={`badge ${prioriteBadge[s.priorite] || 'bg-secondary'} d-block mb-1`}>{s.priorite}</span>
                  <span className={`badge ${statutBadge[s.statut] || 'bg-secondary'}`}>{s.statut}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
