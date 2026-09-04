import { useEffect, useState } from 'react'
import type { DemandeTravaux, DemandeTravauxCreate, StatutDemandeTravaux, Client } from '@/types'
import { commercialService } from '@/services/commercial.service'
import { useToastStore } from '@/stores/toast.store'
import { useAuthStore } from '@/stores/auth.store'
import { getRolePermissions } from '@/config/roles.config'

const EMPTY_FORM: DemandeTravauxCreate = {
  objet: '',
  type_projet: 'construction',
  description: '',
  localisation: '',
  date_souhaitee: undefined,
  documents_fournis: '',
  plans_disponibles: false,
  observations: '',
  statut: 'nouvelle',
  client_id: undefined,
}

const STATUTS: StatutDemandeTravaux[] = ['nouvelle', 'en_etude', 'traitee', 'annulee']

const STATUT_BADGE: Record<StatutDemandeTravaux, string> = {
  nouvelle: 'bg-primary',
  en_etude: 'bg-warning text-dark',
  traitee: 'bg-success',
  annulee: 'bg-danger',
}

export function DemandeTravauxTab() {
  const { user } = useAuthStore()
  const perms = getRolePermissions(user?.role_code || '')
  const { addToast } = useToastStore()

  const [demandes, setDemandes] = useState<DemandeTravaux[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statutFilter, setStatutFilter] = useState<string>('tous')

  const [showModal, setShowModal] = useState(false)
  const [selected, setSelected] = useState<DemandeTravaux | null>(null)
  const [form, setForm] = useState<DemandeTravauxCreate>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const [d, c] = await Promise.all([
        commercialService.getDemandes(),
        commercialService.getClients(),
      ])
      const clientMap = new Map(c.map((cli) => [cli.id, cli]))
      setDemandes(d.map((item) => ({ ...item, client_nom: item.client_id ? clientMap.get(item.client_id)?.entreprise || `${clientMap.get(item.client_id)?.prenom || ''} ${clientMap.get(item.client_id)?.nom || ''}`.trim() : undefined })))
      setClients(c)
    } catch (err) {
      console.error('Erreur chargement demandes', err)
      addToast({ type: 'error', title: 'Erreur', message: 'Impossible de charger les demandes de travaux.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openCreate = () => {
    setSelected(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  const openEdit = (d: DemandeTravaux) => {
    setSelected(d)
    setForm({
      objet: d.objet,
      type_projet: d.type_projet || 'construction',
      description: d.description || '',
      localisation: d.localisation || '',
      date_souhaitee: d.date_souhaitee,
      documents_fournis: d.documents_fournis || '',
      plans_disponibles: d.plans_disponibles || false,
      observations: d.observations || '',
      statut: d.statut || 'nouvelle',
      client_id: d.client_id,
      commercial_id: d.commercial_id,
    })
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.objet.trim()) {
      addToast({ type: 'error', title: 'Erreur', message: "L'objet de la demande est obligatoire." })
      return
    }
    setSaving(true)
    try {
      if (selected) {
        await commercialService.updateDemande(selected.id, form)
        addToast({ type: 'success', title: 'Demande modifiée', message: `La demande ${selected.numero || ''} a été mise à jour.` })
      } else {
        await commercialService.createDemande(form)
        addToast({ type: 'success', title: 'Demande créée', message: 'La demande de travaux a été créée.' })
      }
      setShowModal(false)
      loadData()
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      addToast({ type: 'error', title: 'Erreur', message: typeof detail === 'string' ? detail : "Impossible d'enregistrer la demande." })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (d: DemandeTravaux) => {
    if (!window.confirm(`Supprimer la demande ${d.numero || ''} ?`)) return
    try {
      await commercialService.deleteDemande(d.id)
      addToast({ type: 'success', title: 'Demande supprimée', message: `La demande ${d.numero || ''} a été supprimée.` })
      loadData()
    } catch {
      addToast({ type: 'error', title: 'Erreur', message: 'Impossible de supprimer la demande.' })
    }
  }

  const filtered = demandes.filter((d) => {
    if (statutFilter !== 'tous' && d.statut !== statutFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        d.objet.toLowerCase().includes(q) ||
        (d.numero || '').toLowerCase().includes(q) ||
        (d.client_nom || '').toLowerCase().includes(q) ||
        (d.localisation || '').toLowerCase().includes(q)
      )
    }
    return true
  })
return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div className="d-flex gap-2 flex-wrap">
          <input
            type="text"
            className="form-control form-control-sm"
            style={{ width: 240 }}
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="form-select form-select-sm" style={{ width: 160 }} value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)}>
            <option value="tous">Tous statuts</option>
            {STATUTS.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>
        {perms.canCreateDemande && (
          <button id="btn-nouvelle-demande" className="d-none" onClick={openCreate}></button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-secondary" role="status"></div>
        </div>
      ) : (
        <div className="card border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>N°</th>
                  <th>Client</th>
                  <th>Objet</th>
                  <th>Type</th>
                  <th>Localisation</th>
                  <th>Date souhaitée</th>
                  <th>Statut</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="text-center text-muted py-4">Aucune demande de travaux</td></tr>
                )}
                {filtered.map((d) => (
                  <tr key={d.id}>
                    <td className="fw-semibold">{d.numero || `#${d.id}`}</td>
                    <td>{d.client_nom || '—'}</td>
                    <td>{d.objet}</td>
                    <td>
                      <span className="badge bg-light text-dark border">{d.type_projet || '—'}</span>
                    </td>
                    <td>{d.localisation || '—'}</td>
                    <td>{d.date_souhaitee ? new Date(d.date_souhaitee).toLocaleDateString('fr-FR') : '—'}</td>
                    <td>
                      <span className={`badge ${STATUT_BADGE[d.statut || 'nouvelle']}`}>
                        {(d.statut || 'nouvelle').replace('_', ' ')}
                      </span>
                    </td>
                    <td className="text-end">
                      <button className="btn btn-sm btn-outline-secondary me-1" title="Modifier" onClick={() => openEdit(d)}>
                        <i className="bi bi-pencil"></i>
                      </button>
                      <button className="btn btn-sm btn-outline-danger" title="Supprimer" onClick={() => handleDelete(d)}>
                        <i className="bi bi-trash"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-footer text-muted py-2">
            {filtered.length} demande(s)
          </div>
        </div>
      )}
{/* Modal création / édition */}
      {showModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} onClick={() => setShowModal(false)}>
          <div className="modal-dialog modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-journal-text me-2"></i>
                  {selected ? `Modifier ${selected.numero || 'la demande'}` : 'Nouvelle demande de travaux'}
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>
              <form onSubmit={handleSave}>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">Client *</label>
                      <select className="form-select" value={form.client_id ?? ''} onChange={(e) => setForm({ ...form, client_id: e.target.value ? Number(e.target.value) : undefined })} required>
                        <option value="">— Sélectionner —</option>
                        {clients.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.entreprise || `${c.prenom || ''} ${c.nom}`.trim()}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Type de projet</label>
                      <select className="form-select" value={form.type_projet || ''} onChange={(e) => setForm({ ...form, type_projet: e.target.value })}>
                        <option value="construction">Construction</option>
                        <option value="renovation">Rénovation</option>
                        <option value="extension">Extension</option>
                        <option value="terrassement">Terrassement</option>
                        <option value="voirie">Voirie / VRD</option>
                        <option value="autre">Autre</option>
                      </select>
                    </div>
                    <div className="col-12">
                      <label className="form-label">Objet de la demande *</label>
                      <input type="text" className="form-control" value={form.objet} onChange={(e) => setForm({ ...form, objet: e.target.value })} placeholder="Ex: Construction maison R+1" required />
                    </div>
                    <div className="col-12">
                      <label className="form-label">Description</label>
                      <textarea className="form-control" rows={2} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })}></textarea>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Localisation</label>
                      <input type="text" className="form-control" value={form.localisation || ''} onChange={(e) => setForm({ ...form, localisation: e.target.value })} placeholder="Ville, quartier..." />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Date souhaitée</label>
                      <input type="date" className="form-control" value={form.date_souhaitee || ''} onChange={(e) => setForm({ ...form, date_souhaitee: e.target.value || undefined })} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Documents fournis</label>
                      <input type="text" className="form-control" value={form.documents_fournis || ''} onChange={(e) => setForm({ ...form, documents_fournis: e.target.value })} placeholder="Plans, permis..." />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Observations</label>
                      <input type="text" className="form-control" value={form.observations || ''} onChange={(e) => setForm({ ...form, observations: e.target.value })} />
                    </div>
                    <div className="col-md-6 d-flex align-items-end">
                      <div className="form-check form-switch">
                        <input className="form-check-input" type="checkbox" id="plansDispo" checked={!!form.plans_disponibles} onChange={(e) => setForm({ ...form, plans_disponibles: e.target.checked })} />
                        <label className="form-check-label" htmlFor="plansDispo">Plans disponibles</label>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Statut</label>
                      <select className="form-select" value={form.statut || 'nouvelle'} onChange={(e) => setForm({ ...form, statut: e.target.value as StatutDemandeTravaux })}>
                        {STATUTS.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-light" onClick={() => setShowModal(false)}>Annuler</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? <span className="spinner-border spinner-border-sm me-2"></span> : <i className="bi bi-check-lg me-2"></i>}
                    {selected ? 'Enregistrer' : 'Créer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}