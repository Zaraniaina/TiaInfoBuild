import { useEffect, useState } from 'react'
import type {
  SituationTravaux,
  SituationTravauxCreate,
  StatutSituationTravaux,
  LigneSituation,
  LigneSituationCreate,
  Chantier,
  Contrat,
} from '@/types'
import { commercialService } from '@/services/commercial.service'
import { chantiersService } from '@/services/chantiers.service'
import { useToastStore } from '@/stores/toast.store'
import { useAuthStore } from '@/stores/auth.store'
import { getRolePermissions } from '@/config/roles.config'

const EMPTY_FORM: SituationTravauxCreate = {
  chantier_id: undefined,
  contrat_id: undefined,
  periode: '',
  date_etablissement: undefined,
  avancement: 0,
  montant: 0,
  observations: '',
  statut: 'brouillon',
}

const STATUTS: StatutSituationTravaux[] = ['brouillon', 'soumise', 'validee', 'rejetee']

const STATUT_BADGE: Record<StatutSituationTravaux, string> = {
  brouillon: 'bg-secondary',
  soumise: 'bg-warning text-dark',
  validee: 'bg-success',
  rejetee: 'bg-danger',
}

const EMPTY_LIGNE: LigneSituationCreate = {
  ouvrage: '',
  quantite_periode: 0,
  quantite_cumulee: 0,
  unite: 'ml',
  prix_unitaire: 0,
  montant: 0,
  observations: '',
}

export function SituationsTab() {
  const { user } = useAuthStore()
  const perms = getRolePermissions(user?.role_code || '')
  const { addToast } = useToastStore()

  const [situations, setSituations] = useState<SituationTravaux[]>([])
  const [chantiers, setChantiers] = useState<Chantier[]>([])
  const [contrats, setContrats] = useState<Contrat[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statutFilter, setStatutFilter] = useState<string>('tous')

  const [showModal, setShowModal] = useState(false)
  const [selected, setSelected] = useState<SituationTravaux | null>(null)
  const [form, setForm] = useState<SituationTravauxCreate>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // Lignes
  const [showLines, setShowLines] = useState(false)
  const [linesSituation, setLinesSituation] = useState<SituationTravaux | null>(null)
  const [lines, setLines] = useState<LigneSituation[]>([])
  const [linesLoading, setLinesLoading] = useState(false)
  const [ligneForm, setLigneForm] = useState<LigneSituationCreate>(EMPTY_LIGNE)
  const [showLigneModal, setShowLigneModal] = useState(false)
  const [savingLigne, setSavingLigne] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const [s, ch, co] = await Promise.all([
        commercialService.getSituations(),
        chantiersService.getAll(),
        commercialService.getContrats(),
      ])
      const chantierMap = new Map((ch as Chantier[]).map((c) => [c.id, c]))
      const enriched = (s as SituationTravaux[]).map((item) => ({
        ...item,
        chantier_nom: item.chantier_id ? chantierMap.get(item.chantier_id)?.nom : undefined,
      }))
      setSituations(enriched)
      setChantiers(ch as Chantier[])
      setContrats(co)
    } catch (err) {
      console.error('Erreur chargement situations', err)
      addToast({ type: 'error', title: 'Erreur', message: 'Impossible de charger les situations de travaux.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadLignes = async (s: SituationTravaux) => {
    setLinesLoading(true)
    try {
      const data = await commercialService.getLignesSituation(s.id)
      setLines(data)
    } catch {
      addToast({ type: 'error', title: 'Erreur', message: 'Impossible de charger les lignes de situation.' })
    } finally {
      setLinesLoading(false)
    }
  }

  const openLines = (s: SituationTravaux) => {
    setLinesSituation(s)
    setLines([])
    setShowLines(true)
    loadLignes(s)
  }

  const openCreate = () => {
    setSelected(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  const openEdit = (s: SituationTravaux) => {
    setSelected(s)
    setForm({
      chantier_id: s.chantier_id,
      contrat_id: s.contrat_id,
      periode: s.periode || '',
      date_etablissement: s.date_etablissement,
      avancement: s.avancement ?? 0,
      montant: s.montant ?? 0,
      observations: s.observations || '',
      statut: s.statut || 'brouillon',
    })
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (selected) {
        await commercialService.updateSituation(selected.id, form)
        addToast({ type: 'success', title: 'Situation modifiée', message: `La situation ${selected.numero || ''} a été mise à jour.` })
      } else {
        await commercialService.createSituation(form)
        addToast({ type: 'success', title: 'Situation créée', message: 'La situation de travaux a été créée.' })
      }
      setShowModal(false)
      loadData()
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      addToast({ type: 'error', title: 'Erreur', message: typeof detail === 'string' ? detail : "Impossible d'enregistrer la situation." })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (s: SituationTravaux) => {
    if (!window.confirm(`Supprimer la situation ${s.numero || ''} ?`)) return
    try {
      await commercialService.deleteSituation(s.id)
      addToast({ type: 'success', title: 'Situation supprimée', message: `La situation ${s.numero || ''} a été supprimée.` })
      loadData()
    } catch {
      addToast({ type: 'error', title: 'Erreur', message: 'Impossible de supprimer la situation.' })
    }
  }
const handleSaveLigne = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ligneForm.ouvrage.trim() || !linesSituation) {
      addToast({ type: 'error', title: 'Erreur', message: "L'ouvrage est obligatoire." })
      return
    }
    setSavingLigne(true)
    try {
      const montant = Number(ligneForm.montant || 0) || (Number(ligneForm.quantite_periode || 0) * Number(ligneForm.prix_unitaire || 0))
      await commercialService.createLigneSituation(linesSituation.id, { ...ligneForm, montant })
      addToast({ type: 'success', title: 'Ligne ajoutée', message: "La ligne d'ouvrage a été ajoutée." })
      setShowLigneModal(false)
      setLigneForm(EMPTY_LIGNE)
      loadLignes(linesSituation)
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      addToast({ type: 'error', title: 'Erreur', message: typeof detail === 'string' ? detail : "Impossible d'ajouter la ligne." })
    } finally {
      setSavingLigne(false)
    }
  }

  const handleDeleteLigne = async (l: LigneSituation) => {
    if (!linesSituation) return
    if (!window.confirm(`Supprimer la ligne "${l.ouvrage}" ?`)) return
    try {
      await commercialService.deleteLigneSituation(linesSituation.id, l.id)
      addToast({ type: 'success', title: 'Ligne supprimée', message: "La ligne d'ouvrage a été supprimée." })
      loadLignes(linesSituation)
    } catch {
      addToast({ type: 'error', title: 'Erreur', message: "Impossible de supprimer la ligne." })
    }
  }

  const filtered = situations.filter((s) => {
    if (statutFilter !== 'tous' && s.statut !== statutFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        (s.numero || '').toLowerCase().includes(q) ||
        (s.periode || '').toLowerCase().includes(q) ||
        (s.chantier_nom || '').toLowerCase().includes(q)
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
        {perms.canCreateSituation && (
          <button id="btn-nouvelle-situation" className="d-none" onClick={openCreate}></button>
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
                  <th>No </th>
                  <th>Période</th>
                  <th>Chantier</th>
                  <th style={{ width: 180 }}>Avancement</th>
                  <th className="text-end">Montant</th>
                  <th>Statut</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="text-center text-muted py-4">Aucune situation de travaux</td></tr>
                )}
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td className="fw-semibold">{s.numero || `#${s.id}`}</td>
                    <td>{s.periode || '-'}</td>
                    <td>{s.chantier_nom || '-'}</td>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <div className="progress flex-grow-1" style={{ height: 8 }}>
                          <div className="progress-bar" style={{ width: `${s.avancement ?? 0}%` }}></div>
                        </div>
                        <span className="small fw-semibold">{s.avancement ?? 0}%</span>
                      </div>
                    </td>
                    <td className="text-end fw-semibold">{(s.montant ?? 0).toLocaleString('fr-FR')} MGA</td>
                    <td>
                      <span className={`badge ${STATUT_BADGE[s.statut || 'brouillon']}`}>
                        {(s.statut || 'brouillon').replace('_', ' ')}
                      </span>
                    </td>
                    <td className="text-end">
                      <button className="btn btn-sm btn-outline-primary me-1" title="Voir lignes" onClick={() => openLines(s)}>
                        <i className="bi bi-list-ul"></i>
                      </button>
                      <button className="btn btn-sm btn-outline-secondary me-1" title="Modifier" onClick={() => openEdit(s)}>
                        <i className="bi bi-pencil"></i>
                      </button>
                      <button className="btn btn-sm btn-outline-danger" title="Supprimer" onClick={() => handleDelete(s)}>
                        <i className="bi bi-trash"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-footer text-muted py-2">
            {filtered.length} situation(s)
          </div>
        </div>
      )}
{/* Modal création / édition situation */}
      {showModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} onClick={() => setShowModal(false)}>
          <div className="modal-dialog modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-clipboard2-data me-2"></i>
                  {selected ? `Modifier ${selected.numero || 'la situation'}` : 'Nouvelle situation de travaux'}
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>
              <form onSubmit={handleSave}>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">Chantier</label>
                      <select className="form-select" value={form.chantier_id ?? ''} onChange={(e) => setForm({ ...form, chantier_id: e.target.value ? Number(e.target.value) : undefined })}>
                        <option value="">- Aucun -</option>
                        {chantiers.map((c) => (
                          <option key={c.id} value={c.id}>{c.nom}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Contrat associé</label>
                      <select className="form-select" value={form.contrat_id ?? ''} onChange={(e) => setForm({ ...form, contrat_id: e.target.value ? Number(e.target.value) : undefined })}>
                        <option value="">- Aucun -</option>
                        {contrats.map((co) => (
                          <option key={co.id} value={co.id}>{co.reference}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Période / libellé</label>
                      <input type="text" className="form-control" value={form.periode || ''} onChange={(e) => setForm({ ...form, periode: e.target.value })} placeholder="Ex: Janvier 2026, SIT 01..." />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Date d'établissement</label>
                      <input type="date" className="form-control" value={form.date_etablissement || ''} onChange={(e) => setForm({ ...form, date_etablissement: e.target.value || undefined })} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Avancement (%)</label>
                      <input type="number" step="0.01" min={0} max={100} className="form-control" value={form.avancement ?? 0} onChange={(e) => setForm({ ...form, avancement: e.target.value ? Number(e.target.value) : 0 })} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Montant (MGA)</label>
                      <input type="number" step="0.01" min={0} className="form-control" value={form.montant ?? 0} onChange={(e) => setForm({ ...form, montant: e.target.value ? Number(e.target.value) : 0 })} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Statut</label>
                      <select className="form-select" value={form.statut || 'brouillon'} onChange={(e) => setForm({ ...form, statut: e.target.value as StatutSituationTravaux })}>
                        {STATUTS.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                      </select>
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
{/* Modal lignes de situation */}
      {showLines && linesSituation && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} onClick={() => setShowLines(false)}>
          <div className="modal-dialog modal-xl" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-list-check me-2"></i>
                  Détail de la situation {linesSituation.numero || ''}{linesSituation.periode ? ` - ${linesSituation.periode}` : ''}
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowLines(false)}></button>
              </div>
              <div className="modal-body">
                <div className="row g-2 mb-3">
                  <div className="col-auto">
                    <span className="badge bg-light text-dark border">Avancement : {linesSituation.avancement ?? 0}%</span>
                  </div>
                  <div className="col-auto">
                    <span className="badge bg-light text-dark border">Montant : {(linesSituation.montant ?? 0).toLocaleString('fr-FR')} MGA</span>
                  </div>
                  <div className="col-auto">
                    <span className={`badge ${STATUT_BADGE[linesSituation.statut || 'brouillon']}`}>{(linesSituation.statut || 'brouillon').replace('_', ' ')}</span>
                  </div>
                </div>

                {linesLoading ? (
                  <div className="text-center py-4">
                    <div className="spinner-border text-secondary" role="status"></div>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-sm table-hover align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Ouvrage</th>
                          <th className="text-end">Qté période</th>
                          <th className="text-end">Qté cumulée</th>
                          <th className="text-center">Unité</th>
                          <th className="text-end">PU</th>
                          <th className="text-end">Montant</th>
                          <th className="text-end">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.length === 0 && (
                          <tr><td colSpan={7} className="text-center text-muted py-4">Aucune ligne d'ouvrage</td></tr>
                        )}
                        {lines.map((l) => (
                          <tr key={l.id}>
                            <td className="fw-semibold">{l.ouvrage}</td>
                            <td className="text-end">{l.quantite_periode?.toLocaleString('fr-FR') ?? '0'}</td>
                            <td className="text-end">{l.quantite_cumulee?.toLocaleString('fr-FR') ?? '0'}</td>
                            <td className="text-center"><span className="badge bg-secondary">{l.unite || '-'}</span></td>
                            <td className="text-end">{(l.prix_unitaire ?? 0).toLocaleString('fr-FR')}</td>
                            <td className="text-end fw-semibold">{(l.montant ?? 0).toLocaleString('fr-FR')} MGA</td>
                            <td className="text-end">
                              <button className="btn btn-sm btn-outline-danger" title="Supprimer" onClick={() => handleDeleteLigne(l)}>
                                <i className="bi bi-trash"></i>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {perms.canCreateSituation && (
                  <div className="text-end mt-3">
                    <button className="btn btn-outline-secondary fw-bold" onClick={() => { setLigneForm(EMPTY_LIGNE); setShowLigneModal(true); }}>
                      <i className="bi bi-plus-lg me-2"></i>Ajouter une ligne
                    </button>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light" onClick={() => setShowLines(false)}>Fermer</button>
              </div>
            </div>
          </div>
        </div>
      )}
{/* Modal ligne de situation */}
      {showLigneModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} onClick={() => setShowLigneModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-file-earmark-plus me-2"></i>
                  Ajouter une ligne d'ouvrage
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowLigneModal(false)}></button>
              </div>
              <form onSubmit={handleSaveLigne}>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-12">
                      <label className="form-label">Ouvrage *</label>
                      <input type="text" className="form-control" value={ligneForm.ouvrage} onChange={(e) => setLigneForm({ ...ligneForm, ouvrage: e.target.value })} placeholder="Ex: Béton de fondation" required />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Quantité période</label>
                      <input type="number" step="0.001" className="form-control" value={ligneForm.quantite_periode ?? 0} onChange={(e) => setLigneForm({ ...ligneForm, quantite_periode: e.target.value ? Number(e.target.value) : 0 })} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Quantité cumulée</label>
                      <input type="number" step="0.001" className="form-control" value={ligneForm.quantite_cumulee ?? 0} onChange={(e) => setLigneForm({ ...ligneForm, quantite_cumulee: e.target.value ? Number(e.target.value) : 0 })} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Unité</label>
                      <input type="text" className="form-control" value={ligneForm.unite || 'ml'} onChange={(e) => setLigneForm({ ...ligneForm, unite: e.target.value })} placeholder="ml, m2, m3..." />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Prix unitaire</label>
                      <input type="number" step="0.01" className="form-control" value={ligneForm.prix_unitaire ?? 0} onChange={(e) => setLigneForm({ ...ligneForm, prix_unitaire: e.target.value ? Number(e.target.value) : 0 })} />
                    </div>
                    <div className="col-12">
                      <label className="form-label">Montant</label>
                      <input type="number" step="0.01" className="form-control" value={ligneForm.montant ?? 0} onChange={(e) => setLigneForm({ ...ligneForm, montant: e.target.value ? Number(e.target.value) : 0 })} placeholder="Laisser vide pour calcul auto (Qté x PU)" />
                    </div>
                    <div className="col-12">
                      <label className="form-label">Observations</label>
                      <input type="text" className="form-control" value={ligneForm.observations || ''} onChange={(e) => setLigneForm({ ...ligneForm, observations: e.target.value })} />
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-light" onClick={() => setShowLigneModal(false)}>Annuler</button>
                  <button type="submit" className="btn btn-primary" disabled={savingLigne}>
                    {savingLigne ? <span className="spinner-border spinner-border-sm me-2"></span> : <i className="bi bi-check-lg me-2"></i>}
                    Ajouter
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