import { useEffect, useState } from 'react'
import type { Projet, ProjetCreate, StatutProjet, Client, DemandeTravaux } from '@/types'
import { commercialService } from '@/services/commercial.service'
import { useToastStore } from '@/stores/toast.store'
import { useAuthStore } from '@/stores/auth.store'
import { getRolePermissions } from '@/config/roles.config'
import { TableSkeleton } from '@/components/ui/Skeleton'

const EMPTY_FORM: ProjetCreate = {
  nom: '',
  client_id: undefined,
  demande_id: undefined,
  type_projet: 'construction',
  description: '',
  localisation: '',
  adresse: '',
  longueur: undefined,
  largeur: undefined,
  hauteur: undefined,
  surface: undefined,
  volume: undefined,
  nombre_niveaux: undefined,
  plans_documents: '',
  observations: '',
  statut: 'en_etude',
}

const STATUTS: StatutProjet[] = ['en_etude', 'valide', 'en_cours', 'termine', 'annule']

const STATUT_BADGE: Record<StatutProjet, string> = {
  en_etude: 'bg-primary',
  valide: 'bg-success',
  en_cours: 'bg-info text-dark',
  termine: 'bg-secondary',
  annule: 'bg-danger',
}

export function ProjetsTab() {
  const { user } = useAuthStore()
  const perms = getRolePermissions(user?.role_code || '')
  const { addToast } = useToastStore()

  const [projets, setProjets] = useState<Projet[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [demandes, setDemandes] = useState<DemandeTravaux[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statutFilter, setStatutFilter] = useState<string>('tous')

  const [showModal, setShowModal] = useState(false)
  const [selected, setSelected] = useState<Projet | null>(null)
  const [form, setForm] = useState<ProjetCreate>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const [p, c, d] = await Promise.all([
        commercialService.getProjets(),
        commercialService.getClients(),
        commercialService.getDemandes(),
      ])
      const clientMap = new Map(c.map((cli) => [cli.id, cli]))
      setProjets(p.map((item) => ({ ...item, client_nom: item.client_id ? clientMap.get(item.client_id)?.entreprise || `${clientMap.get(item.client_id)?.prenom || ''} ${clientMap.get(item.client_id)?.nom || ''}`.trim() : undefined })))
      setClients(c)
      setDemandes(d)
    } catch (err) {
      console.error('Erreur chargement projets', err)
      addToast({ type: 'error', title: 'Erreur', message: 'Impossible de charger les projets.' })
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

  const openEdit = (p: Projet) => {
    setSelected(p)
    setForm({
      nom: p.nom,
      client_id: p.client_id,
      demande_id: p.demande_id,
      responsable_id: p.responsable_id,
      type_projet: p.type_projet || 'construction',
      description: p.description || '',
      localisation: p.localisation || '',
      adresse: p.adresse || '',
      longueur: p.longueur,
      largeur: p.largeur,
      hauteur: p.hauteur,
      surface: p.surface,
      volume: p.volume,
      nombre_niveaux: p.nombre_niveaux,
      plans_documents: p.plans_documents || '',
      observations: p.observations || '',
      statut: p.statut || 'en_etude',
    })
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nom.trim()) {
      addToast({ type: 'error', title: 'Erreur', message: 'Le nom du projet est obligatoire.' })
      return
    }
    setSaving(true)
    try {
      if (selected) {
        await commercialService.updateProjet(selected.id, form)
        addToast({ type: 'success', title: 'Projet modifié', message: `Le projet ${selected.reference || ''} a été mis à jour.` })
      } else {
        await commercialService.createProjet(form)
        addToast({ type: 'success', title: 'Projet créé', message: 'Le projet a été créé.' })
      }
      setShowModal(false)
      loadData()
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      addToast({ type: 'error', title: 'Erreur', message: typeof detail === 'string' ? detail : "Impossible d'enregistrer le projet." })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (p: Projet) => {
    if (!window.confirm(`Supprimer le projet ${p.reference || ''} ?`)) return
    try {
      await commercialService.deleteProjet(p.id)
      addToast({ type: 'success', title: 'Projet supprimé', message: `Le projet ${p.reference || ''} a été supprimé.` })
      loadData()
    } catch {
      addToast({ type: 'error', title: 'Erreur', message: 'Impossible de supprimer le projet.' })
    }
  }

  const filtered = projets.filter((p) => {
    if (statutFilter !== 'tous' && p.statut !== statutFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        p.nom.toLowerCase().includes(q) ||
        (p.reference || '').toLowerCase().includes(q) ||
        (p.client_nom || '').toLowerCase().includes(q) ||
        (p.localisation || '').toLowerCase().includes(q)
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
        {perms.canCreateProjet && (
          <button id="btn-nouveau-projet" className="d-none" onClick={openCreate}></button>
        )}
      </div>

      {loading ? (
        <TableSkeleton rows={8} columns={6} />
      ) : (
        <div className="card border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Réf.</th>
                  <th>Projet</th>
                  <th>Client</th>
                  <th>Type</th>
                  <th>Surface</th>
                  <th>Localisation</th>
                  <th>Statut</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="text-center text-muted py-4">Aucun projet</td></tr>
                )}
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td className="fw-semibold">{p.reference || `#${p.id}`}</td>
                    <td>{p.nom}</td>
                    <td>{p.client_nom || '-'}</td>
                    <td>
                      <span className="badge bg-light text-dark border">{p.type_projet || '-'}</span>
                    </td>
                    <td>{p.surface ? `${p.surface} m2` : '-'}</td>
                    <td>{p.localisation || '-'}</td>
                    <td>
                      <span className={`badge ${STATUT_BADGE[p.statut || 'en_etude']}`}>
                        {(p.statut || 'en_etude').replace('_', ' ')}
                      </span>
                    </td>
                    <td className="text-end">
                      <button className="btn btn-sm btn-outline-secondary me-1" title="Modifier" onClick={() => openEdit(p)}>
                        <i className="bi bi-pencil"></i>
                      </button>
                      <button className="btn btn-sm btn-outline-danger" title="Supprimer" onClick={() => handleDelete(p)}>
                        <i className="bi bi-trash"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-footer text-muted py-2">
            {filtered.length} projet(s)
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
                  <i className="bi bi-building me-2"></i>
                  {selected ? `Modifier ${selected.reference || 'le projet'}` : 'Nouveau projet'}
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>
              <form onSubmit={handleSave}>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">Client *</label>
                      <select className="form-select" value={form.client_id ?? ''} onChange={(e) => setForm({ ...form, client_id: e.target.value ? Number(e.target.value) : undefined })} required>
                        <option value="">- Sélectionner -</option>
                        {clients.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.entreprise || `${c.prenom || ''} ${c.nom}`.trim()}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Demande liée</label>
                      <select className="form-select" value={form.demande_id ?? ''} onChange={(e) => setForm({ ...form, demande_id: e.target.value ? Number(e.target.value) : undefined })}>
                        <option value="">- Aucune -</option>
                        {demandes.filter((d) => d.statut !== 'annulee').map((d) => (
                          <option key={d.id} value={d.id}>{d.numero || `#${d.id}`} - {d.objet}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-12">
                      <label className="form-label">Nom du projet *</label>
                      <input type="text" className="form-control" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="Ex: Construction Maison R+1 Anosy" required />
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
                    <div className="col-md-6">
                      <label className="form-label">Statut</label>
                      <select className="form-select" value={form.statut || 'en_etude'} onChange={(e) => setForm({ ...form, statut: e.target.value as StatutProjet })}>
                        {STATUTS.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                      </select>
                    </div>
                    <div className="col-12">
                      <label className="form-label">Description</label>
                      <textarea className="form-control" rows={2} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })}></textarea>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Localisation</label>
                      <input type="text" className="form-control" value={form.localisation || ''} onChange={(e) => setForm({ ...form, localisation: e.target.value })} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Adresse</label>
                      <input type="text" className="form-control" value={form.adresse || ''} onChange={(e) => setForm({ ...form, adresse: e.target.value })} />
                    </div>
<div className="col-12">
                      <label className="form-label form-label-sm text-muted">Dimensions (facultatif)</label>
                      <div className="input-group input-group-sm mb-2">
                        <span className="input-group-text">L</span>
                        <input type="number" step="0.01" className="form-control" placeholder="Longueur (m)" value={form.longueur ?? ''} onChange={(e) => setForm({ ...form, longueur: e.target.value ? Number(e.target.value) : undefined })} />
                        <span className="input-group-text">l</span>
                        <input type="number" step="0.01" className="form-control" placeholder="Largeur (m)" value={form.largeur ?? ''} onChange={(e) => setForm({ ...form, largeur: e.target.value ? Number(e.target.value) : undefined })} />
                        <span className="input-group-text">H</span>
                        <input type="number" step="0.01" className="form-control" placeholder="Hauteur (m)" value={form.hauteur ?? ''} onChange={(e) => setForm({ ...form, hauteur: e.target.value ? Number(e.target.value) : undefined })} />
                      </div>
                      <div className="input-group input-group-sm mb-2">
                        <span className="input-group-text">Surface</span>
                        <input type="number" step="0.01" className="form-control" placeholder="m2" value={form.surface ?? ''} onChange={(e) => setForm({ ...form, surface: e.target.value ? Number(e.target.value) : undefined })} />
                        <span className="input-group-text">Volume</span>
                        <input type="number" step="0.01" className="form-control" placeholder="m3" value={form.volume ?? ''} onChange={(e) => setForm({ ...form, volume: e.target.value ? Number(e.target.value) : undefined })} />
                        <span className="input-group-text">Niveaux</span>
                        <input type="number" className="form-control" placeholder="nb" value={form.nombre_niveaux ?? ''} onChange={(e) => setForm({ ...form, nombre_niveaux: e.target.value ? Number(e.target.value) : undefined })} />
                      </div>
                    </div>
                    <div className="col-12">
                      <label className="form-label">Plans / documents</label>
                      <input type="text" className="form-control" value={form.plans_documents || ''} onChange={(e) => setForm({ ...form, plans_documents: e.target.value })} placeholder="Références des plans fournis..." />
                    </div>
                    <div className="col-12">
                      <label className="form-label">Observations</label>
                      <textarea className="form-control" rows={2} value={form.observations || ''} onChange={(e) => setForm({ ...form, observations: e.target.value })}></textarea>
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