import { useCallback, useEffect, useState } from 'react'
import type { Conge, CongeListe, Employe, SoldeConge } from '@/types'
import { rhService } from '@/services/rh.service'
import { TableSkeleton } from '@/components/ui/Skeleton'

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

interface SoldeCache {
  [employeId: number]: SoldeConge
}

export function RhCongesTab() {
  const [conges, setConges] = useState<Conge[]>([])
  const [employes, setEmployes] = useState<Employe[]>([])
  const [soldes, setSoldes] = useState<SoldeCache>({})
  const [loading, setLoading] = useState(true)
  const [statutFilter, setStatutFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    employe_id: 0,
    type: 'annuel',
    date_debut: '',
    date_fin: '',
    nb_jours: 1,
    motif: '',
  })
  const [refusComment, setRefusComment] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data: CongeListe = await rhService.getConges({ statut: statutFilter, size: 100 })
      setConges(data.items)
      const emps = await rhService.getEmployes()
      setEmployes(emps)
      // Soldes pour les employés présents dans la liste
      const ids = [...new Set(data.items.map((c) => c.employe_id))]
      const soldeMap: SoldeCache = {}
      await Promise.all(
        ids.map(async (id) => {
          try {
            const s = await rhService.getSoldeConge(id)
            soldeMap[id] = s
          } catch {
            /* ignoré */
          }
        })
      )
      setSoldes(soldeMap)
    } catch {
      setConges([])
    } finally {
      setLoading(false)
    }
  }, [statutFilter])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await rhService.createConge({
        employe_id: Number(form.employe_id),
        type: form.type,
        date_debut: form.date_debut,
        date_fin: form.date_fin,
        nb_jours: Number(form.nb_jours),
        motif: form.motif || undefined,
      })
      setShowModal(false)
      setForm({ employe_id: 0, type: 'annuel', date_debut: '', date_fin: '', nb_jours: 1, motif: '' })
      load()
    } catch {
      alert('Erreur lors de la création du congé.')
    }
  }

  const handleValider = async (id: number) => {
    try {
      await rhService.validerConge(id)
      load()
    } catch {
      alert('Impossible de valider ce congé.')
    }
  }

  const handleRefuser = async (id: number, commentaire: string) => {
    try {
      await rhService.refuserConge(id, commentaire || 'Refusé par la direction')
      setRefusComment(null)
      load()
    } catch {
      alert('Impossible de refuser ce congé.')
    }
  }

  const nomEmploye = (id: number) => {
    const e = employes.find((x) => x.id === id)
    return e ? `${e.prenom || ''} ${e.nom}`.trim() : `Employé #${id}`
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="d-flex gap-2">
          <select className="form-select bg-light" style={{ width: 200 }} value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)}>
            <option value="">Tous les statuts</option>
            <option value="en_attente">En attente</option>
            <option value="valide">Validés</option>
            <option value="refuse">Refusés</option>
            <option value="annule">Annulés</option>
          </select>
          <button className="btn btn-outline-secondary" onClick={load}><i className="bi bi-arrow-clockwise"></i></button>
        </div>
        <button className="btn btn-outline-secondary fw-bold" onClick={() => setShowModal(true)}>
          <i className="bi bi-plus-circle me-2"></i>Nouvelle demande
        </button>
      </div>

      {loading ? (
        <div className="card border-0 shadow-sm p-3"><TableSkeleton rows={8} columns={7} /></div>
      ) : conges.length === 0 ? (
        <div className="card border-0 shadow-sm p-4 text-center text-muted">Aucune demande de congé</div>
      ) : (
        <div className="card border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Employé</th>
                  <th>Type</th>
                  <th>Du</th>
                  <th>Au</th>
                  <th>Jours</th>
                  <th>Solde restant</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {conges.map((c) => (
                  <tr key={c.id}>
                    <td className="fw-semibold">{c.employe_nom ? `${c.employe_prenom || ''} ${c.employe_nom}`.trim() : nomEmploye(c.employe_id)}</td>
                    <td>{TYPE_LABELS[c.type] || c.type}</td>
                    <td>{c.date_debut}</td>
                    <td>{c.date_fin}</td>
                    <td><span className="badge bg-light text-dark border font-monospace">{c.nb_jours}</span></td>
                    <td className="font-monospace">
                      {soldes[c.employe_id] ? `${soldes[c.employe_id].solde_restant} j` : '-'}
                    </td>
                    <td>
                      <span className={`badge ${STATUT_BADGE[c.statut] || 'bg-light text-dark border'}`}>{c.statut}</span>
                      {c.commentaire_refus && <div className="small text-danger mt-1">{c.commentaire_refus}</div>}
                    </td>
                    <td>
                      {c.statut === 'en_attente' && (
                        <div className="btn-group btn-group-sm">
                          <button className="btn btn-outline-secondary" onClick={() => handleValider(c.id)}>Valider</button>
                          <button className="btn btn-outline-secondary" onClick={() => setRefusComment(c.id)}>Refuser</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal création */}
      {showModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">Nouvelle demande de congé</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowModal(false)}></button>
              </div>
              <form onSubmit={handleCreate}>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Employé *</label>
                      <select className="form-select" required value={form.employe_id} onChange={(e) => setForm({ ...form, employe_id: Number(e.target.value) })}>
                        <option value={0}>Sélectionner...</option>
                        {employes.map((e) => (
                          <option key={e.id} value={e.id}>{e.prenom || ''} {e.nom} — {e.poste || ''}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Type *</label>
                      <select className="form-select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                        {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Date début *</label>
                      <input type="date" className="form-control" required value={form.date_debut} onChange={(e) => setForm({ ...form, date_debut: e.target.value })} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Date fin *</label>
                      <input type="date" className="form-control" required value={form.date_fin} onChange={(e) => setForm({ ...form, date_fin: e.target.value })} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Nb jours *</label>
                      <input type="number" min={0.5} step={0.5} className="form-control" required value={form.nb_jours} onChange={(e) => setForm({ ...form, nb_jours: Number(e.target.value) })} />
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-semibold">Motif</label>
                      <textarea className="form-control" rows={2} value={form.motif} onChange={(e) => setForm({ ...form, motif: e.target.value })}></textarea>
                    </div>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowModal(false)}>Annuler</button>
                  <button type="submit" className="btn btn-outline-secondary fw-bold">Créer la demande</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal refus */}
      {refusComment !== null && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-md modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">Refuser le congé</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setRefusComment(null)}></button>
              </div>
              <div className="modal-body">
                <label className="form-label fw-semibold">Motif du refus</label>
                <textarea id="refus-commentaire" className="form-control" rows={3} placeholder="Motif du refus (facultatif)"></textarea>
              </div>
              <div className="modal-footer bg-light">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setRefusComment(null)}>Annuler</button>
                <button type="button" className="btn btn-outline-secondary fw-bold" onClick={() => {
                  const el = document.getElementById('refus-commentaire') as HTMLTextAreaElement | null
                  handleRefuser(refusComment, el?.value || '')
                }}>Confirmer le refus</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}