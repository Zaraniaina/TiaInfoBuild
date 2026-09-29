import { useEffect, useState } from 'react'
import type { Metre, MetreCreate, Projet } from '@/types'
import { commercialService } from '@/services/commercial.service'
import { useToastStore } from '@/stores/toast.store'
import { useAuthStore } from '@/stores/auth.store'
import { getRolePermissions } from '@/config/roles.config'
import { TableSkeleton } from '@/components/ui/Skeleton'

const EMPTY_FORM: MetreCreate = {
  projet_id: undefined,
  ouvrage: '',
  designation: '',
  formule: '',
  dimensions: '',
  unite: 'ml',
  quantite: 0,
  observations: '',
  document_reference: '',
  ordre: 0,
}

const UNITES = ['ml', 'm2', 'm3', 'kg', 't', 'L', 'u', 'forfait']

export function MetresTab() {
  const { user } = useAuthStore()
  const perms = getRolePermissions(user?.role_code || '')
  const { addToast } = useToastStore()

  const [metres, setMetres] = useState<Metre[]>([])
  const [projets, setProjets] = useState<Projet[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [projetFilter, setProjetFilter] = useState<string>('tous')

  const [showModal, setShowModal] = useState(false)
  const [selected, setSelected] = useState<Metre | null>(null)
  const [form, setForm] = useState<MetreCreate>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const [m, p] = await Promise.all([
        commercialService.getMetres(),
        commercialService.getProjets(),
      ])
      const projetMap = new Map(p.map((pr) => [pr.id, pr]))
      setMetres(m.map((item) => ({ ...item, projet_reference: item.projet_id ? projetMap.get(item.projet_id)?.reference || projetMap.get(item.projet_id)?.nom : undefined })))
      setProjets(p)
    } catch (err) {
      console.error('Erreur chargement métrés', err)
      addToast({ type: 'error', title: 'Erreur', message: 'Impossible de charger les métrés.' })
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
    setForm({ ...EMPTY_FORM, ordre: metres.length + 1 })
    setShowModal(true)
  }

  const openEdit = (m: Metre) => {
    setSelected(m)
    setForm({
      projet_id: m.projet_id,
      ouvrage: m.ouvrage,
      designation: m.designation || '',
      formule: m.formule || '',
      dimensions: m.dimensions || '',
      unite: m.unite || 'ml',
      quantite: m.quantite ?? 0,
      observations: m.observations || '',
      document_reference: m.document_reference || '',
      ordre: m.ordre ?? 0,
    })
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.ouvrage.trim()) {
      addToast({ type: 'error', title: 'Erreur', message: "L'ouvrage est obligatoire." })
      return
    }
    setSaving(true)
    try {
      if (selected) {
        await commercialService.updateMetre(selected.id, form)
        addToast({ type: 'success', title: 'Métré modifié', message: `Le métré ${selected.ouvrage} a été mis à jour.` })
      } else {
        await commercialService.createMetre(form)
        addToast({ type: 'success', title: 'Métré créé', message: 'Le métré a été créé.' })
      }
      setShowModal(false)
      loadData()
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      addToast({ type: 'error', title: 'Erreur', message: typeof detail === 'string' ? detail : "Impossible d'enregistrer le métré." })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (m: Metre) => {
    if (!window.confirm(`Supprimer le métré "${m.ouvrage}" ?`)) return
    try {
      await commercialService.deleteMetre(m.id)
      addToast({ type: 'success', title: 'Métré supprimé', message: `Le métré ${m.ouvrage} a été supprimé.` })
      loadData()
    } catch {
      addToast({ type: 'error', title: 'Erreur', message: 'Impossible de supprimer le métré.' })
    }
  }

  const filtered = metres.filter((m) => {
    if (projetFilter !== 'tous' && String(m.projet_id) !== projetFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        m.ouvrage.toLowerCase().includes(q) ||
        (m.designation || '').toLowerCase().includes(q) ||
        (m.formule || '').toLowerCase().includes(q) ||
        (m.projet_reference || '').toLowerCase().includes(q)
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
            style={{ width: 'min(240px, 100%)' }}
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="form-select form-select-sm" style={{ width: 'min(200px, 100%)' }} value={projetFilter} onChange={(e) => setProjetFilter(e.target.value)}>
            <option value="tous">Tous projets</option>
            {projets.map((p) => <option key={p.id} value={p.id}>{p.reference || p.nom}</option>)}
          </select>
        </div>
        {perms.canCreateMetre && (
          <button id="btn-nouveau-metre" className="d-none" onClick={openCreate}></button>
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
                  <th>Ouvrage</th>
                  <th>Désignation</th>
                  <th>Projet</th>
                  <th>Formule</th>
                  <th className="text-center">Unité</th>
                  <th className="text-end">Quantité</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="text-center text-muted py-4">Aucun métré</td></tr>
                )}
                {filtered.map((m) => (
                  <tr key={m.id}>
                    <td className="fw-semibold">{m.ouvrage}</td>
                    <td>{m.designation || '-'}</td>
                    <td>{m.projet_reference || '-'}</td>
                    <td>
                      <span className="badge bg-light text-dark font-monospace">{m.formule || '-'}</span>
                    </td>
                    <td className="text-center">
                      <span className="badge bg-secondary">{m.unite || '-'}</span>
                    </td>
                    <td className="text-end fw-semibold">{m.quantite?.toLocaleString('fr-FR') ?? '0'}</td>
                    <td className="text-end">
                      <button className="btn btn-sm btn-outline-secondary me-1" title="Modifier" onClick={() => openEdit(m)}>
                        <i className="bi bi-pencil"></i>
                      </button>
                      <button className="btn btn-sm btn-outline-danger" title="Supprimer" onClick={() => handleDelete(m)}>
                        <i className="bi bi-trash"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-footer text-muted py-2">
            {filtered.length} métré(s)
          </div>
        </div>
      )}
{/* Modal création / édition */}
      {showModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'var(--overlay)' }} onClick={() => setShowModal(false)}>
          <div className="modal-dialog modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-rulers me-2"></i>
                  {selected ? 'Modifier le métré' : 'Nouveau métré'}
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>
              <form onSubmit={handleSave}>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">Projet</label>
                      <select className="form-select" value={form.projet_id ?? ''} onChange={(e) => setForm({ ...form, projet_id: e.target.value ? Number(e.target.value) : undefined })}>
                        <option value="">- Aucun -</option>
                        {projets.map((p) => (
                          <option key={p.id} value={p.id}>{p.reference || p.nom}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Unité</label>
                      <select className="form-select" value={form.unite || 'ml'} onChange={(e) => setForm({ ...form, unite: e.target.value })}>
                        {UNITES.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                    <div className="col-12">
                      <label className="form-label">Ouvrage *</label>
                      <input type="text" className="form-control" value={form.ouvrage} onChange={(e) => setForm({ ...form, ouvrage: e.target.value })} placeholder="Ex: Béton de fondation, Élévation des murs..." required />
                    </div>
                    <div className="col-12">
                      <label className="form-label">Désignation</label>
                      <textarea className="form-control" rows={2} value={form.designation || ''} onChange={(e) => setForm({ ...form, designation: e.target.value })}></textarea>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Formule de calcul</label>
                      <input type="text" className="form-control" value={form.formule || ''} onChange={(e) => setForm({ ...form, formule: e.target.value })} placeholder="Ex: L x l x h" />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Dimensions / repères</label>
                      <input type="text" className="form-control" value={form.dimensions || ''} onChange={(e) => setForm({ ...form, dimensions: e.target.value })} placeholder="Ex: poteaux P1-P4" />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Quantité *</label>
                      <input type="number" step="0.001" className="form-control" value={form.quantite ?? 0} onChange={(e) => setForm({ ...form, quantite: e.target.value ? Number(e.target.value) : 0 })} min={0} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Ordre</label>
                      <input type="number" className="form-control" value={form.ordre ?? 0} onChange={(e) => setForm({ ...form, ordre: e.target.value ? Number(e.target.value) : 0 })} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Réf. document</label>
                      <input type="text" className="form-control" value={form.document_reference || ''} onChange={(e) => setForm({ ...form, document_reference: e.target.value })} />
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