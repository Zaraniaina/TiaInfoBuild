import { useCallback, useEffect, useState } from 'react'
import type { Conge } from '@/types'
import { employeTerrainService } from '@/services/employeTerrain.service'
import { PageSkeleton } from '@/components/ui/Skeleton'

const TYPE_LABELS: Record<string, string> = {
  annuel: 'Annuel',
  maladie: 'Maladie',
  maternite: 'Maternité',
  exceptionnel: 'Exceptionnel',
  sans_solde: 'Sans solde',
}

const STATUT_BADGE: Record<string, string> = {
  en_attente: 'bg-warning bg-opacity-10 text-dark border',
  valide: 'bg-success bg-opacity-10 text-success border',
  refuse: 'bg-danger bg-opacity-10 text-danger border',
  annule: 'bg-secondary bg-opacity-10 text-secondary border',
}

export function EmployeCongesPage() {
  const [items, setItems] = useState<Conge[]>([])
  const [soldeRestant, setSoldeRestant] = useState(0)
  const [soldeAnnuel, setSoldeAnnuel] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [form, setForm] = useState({
    type: 'annuel',
    date_debut: '',
    date_fin: '',
    nb_jours: 1,
    motif: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await employeTerrainService.getMesConges()
      setItems(data.items)
      setSoldeRestant(data.solde_restant)
      setSoldeAnnuel(data.solde_annuel)
    } catch {
      setErr('Impossible de charger vos congés.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleDemander = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await employeTerrainService.demanderConge({
        type: form.type,
        date_debut: form.date_debut,
        date_fin: form.date_fin,
        nb_jours: Number(form.nb_jours),
        motif: form.motif || undefined,
      })
      setShowModal(false)
      setForm({ type: 'annuel', date_debut: '', date_fin: '', nb_jours: 1, motif: '' })
      load()
    } catch {
      alert('Erreur lors de l\'envoi de la demande.')
    }
  }

  const handleAnnuler = async (id: number) => {
    try {
      await employeTerrainService.annulerConge(id)
      load()
    } catch {
      alert('Impossible d\'annuler cette demande.')
    }
  }

  if (loading) return <PageSkeleton />
  if (err) return <div className="alert alert-danger m-3">{err}</div>

  const nbEnAttente = items.filter((c) => c.statut === 'en_attente').length

  return (
    <div className="container-fluid py-3">
      <h5 className="mb-3"><i className="bi bi-calendar2-week me-2"></i>Mes Congés & Absences</h5>

      {/* Soldes */}
      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <div className="card border-0 shadow-sm kpi-card">
            <div className="card-body text-center">
              <div className="fs-1 fw-bold text-primary font-monospace">{soldeRestant} j</div>
              <div className="text-muted">Solde congés restant</div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card border-0 shadow-sm kpi-card">
            <div className="card-body text-center">
              <div className="fs-1 fw-bold text-secondary font-monospace">{soldeAnnuel} j</div>
              <div className="text-muted">Droit annuel</div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card border-0 shadow-sm kpi-card">
            <div className="card-body text-center">
              <div className="fs-1 fw-bold text-warning font-monospace">{nbEnAttente}</div>
              <div className="text-muted">Demandes en attente</div>
            </div>
          </div>
        </div>
      </div>

      <div className="d-flex justify-content-end mb-3">
        <button className="btn btn-outline-secondary fw-bold" onClick={() => setShowModal(true)}>
          <i className="bi bi-plus-circle me-2"></i>Demander un congé
        </button>
      </div>

      {/* Historique */}
      <div className="card border-0 shadow-sm">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>Type</th>
                <th>Du</th>
                <th>Au</th>
                <th>Jours</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={6} className="text-center text-muted py-4">Aucune demande de congé</td></tr>}
              {items.map((c) => (
                <tr key={c.id}>
                  <td>{TYPE_LABELS[c.type] || c.type}</td>
                  <td>{c.date_debut}</td>
                  <td>{c.date_fin}</td>
                  <td><span className="badge bg-light text-dark border font-monospace">{c.nb_jours}</span></td>
                  <td>
                    <span className={`badge ${STATUT_BADGE[c.statut] || 'bg-light text-dark border'}`}>{c.statut}</span>
                    {c.commentaire_refus && <div className="small text-danger mt-1">{c.commentaire_refus}</div>}
                  </td>
                  <td>
                    {c.statut === 'en_attente' && (
                      <button className="btn btn-outline-secondary btn-sm" onClick={() => handleAnnuler(c.id)}>
                        Annuler
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal demande */}
      {showModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-md modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">Demander un congé</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowModal(false)}></button>
              </div>
              <form onSubmit={handleDemander}>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Type *</label>
                      <select className="form-select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                        {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Nb jours *</label>
                      <input type="number" min={0.5} step={0.5} className="form-control" required value={form.nb_jours} onChange={(e) => setForm({ ...form, nb_jours: Number(e.target.value) })} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Date début *</label>
                      <input type="date" className="form-control" required value={form.date_debut} onChange={(e) => setForm({ ...form, date_debut: e.target.value })} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Date fin *</label>
                      <input type="date" className="form-control" required value={form.date_fin} onChange={(e) => setForm({ ...form, date_fin: e.target.value })} />
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-semibold">Motif</label>
                      <textarea className="form-control" rows={2} value={form.motif} onChange={(e) => setForm({ ...form, motif: e.target.value })}></textarea>
                    </div>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowModal(false)}>Annuler</button>
                  <button type="submit" className="btn btn-outline-secondary fw-bold">Envoyer la demande</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}