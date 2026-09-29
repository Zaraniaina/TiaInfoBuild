import { useEffect, useMemo, useState } from 'react'
import type { Chantier, PeriodeRisqueClimatique } from '@/types'
import { aleasClimatiquesService } from '@/services/aleasClimatiques.service'
import { chantiersService } from '@/services/chantiers.service'
import { useAuthStore } from '@/stores/auth.store'
import { getRolePermissions } from '@/config/roles.config'
import { TableSkeleton } from '@/components/ui/Skeleton'

const TYPES_RISQUE: Record<string, { label: string; badge: string }> = {
  cyclone: { label: 'Cyclone', badge: 'bg-danger' },
  inondation: { label: 'Inondation', badge: 'bg-primary' },
  pluies_intenses: { label: 'Pluies intenses', badge: 'bg-info' },
  secheresse: { label: 'Sécheresse', badge: 'bg-warning' },
  route_coupee: { label: 'Route coupée', badge: 'bg-secondary' },
  coupure_electricite: { label: 'Coupure électrique', badge: 'bg-dark' },
  autre: { label: 'Autre', badge: 'bg-light text-dark border' },
}

const IMPUTABILITE_META: Record<string, { label: string; badge: string }> = {
  climatique: { label: 'Climatique (négociable)', badge: 'bg-success bg-opacity-10 text-success border' },
  entreprise: { label: 'Imputable entreprise', badge: 'bg-danger bg-opacity-10 text-danger border' },
  client: { label: 'Imputable client', badge: 'bg-warning bg-opacity-10 text-dark border' },
  indetermine: { label: 'Indéterminée', badge: 'bg-light text-dark border' },
}

const dateFR = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR') : '-')

/** Une période chevauche-t-elle la fenêtre [debut, fin] d'un chantier ? */
function chevauche(p: PeriodeRisqueClimatique, debut?: string, fin?: string): boolean {
  if (!debut || !fin) return false
  const pStart = new Date(p.date_debut).getTime()
  const pEnd = new Date(p.date_fin).getTime()
  const cStart = new Date(debut).getTime()
  const cEnd = new Date(fin).getTime()
  return pStart <= cEnd && cStart <= pEnd
}

export function RisquesClimatiquesPage() {
  const { user } = useAuthStore()
  const perms = getRolePermissions(user?.role_code || 'employe')
  // Gestion des périodes : rôles de direction (le backend autorise ce module
  // spécifiquement pour directeur/admin_entreprise via _require_permission_alea).
  const canEdit =
    perms.canEditChantier ||
    perms.canReportTask ||
    user?.role_code === 'directeur' ||
    user?.role_code === 'admin_entreprise'

  const [periodes, setPeriodes] = useState<PeriodeRisqueClimatique[]>([])
  const [chantiers, setChantiers] = useState<Chantier[]>([])
  const [loading, setLoading] = useState(true)
  const [regionFilter, setRegionFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editPeriode, setEditPeriode] = useState<PeriodeRisqueClimatique | null>(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [p, c] = await Promise.all([
        aleasClimatiquesService.listPeriodesRisque(),
        // La liste des chantiers sert au croisement « chantiers concernés » :
        // un rôle sans chantiers:read (ex. admin_entreprise) ne doit pas perdre
        // l'affichage des périodes pour autant.
        chantiersService.getAll().catch(() => []),
      ])
      setPeriodes(p)
      setChantiers(c)
    } catch {
      setPeriodes([])
      setChantiers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const regions = useMemo(
    () => Array.from(new Set(periodes.map((p) => p.region))).sort(),
    [periodes],
  )

  const filtered = useMemo(
    () => periodes.filter((p) => !regionFilter || p.region === regionFilter),
    [periodes, regionFilter],
  )

  const chantiersConcernes = (p: PeriodeRisqueClimatique) =>
    chantiers.filter(
      (c) =>
        !c.is_deleted &&
        (c.region === p.region || c.ville === p.region || c.adresse?.includes(p.region)) &&
        chevauche(p, c.date_debut, c.date_fin_prevue),
    )

  const openCreate = () => {
    setEditPeriode(null)
    setShowModal(true)
  }

  const openEdit = (p: PeriodeRisqueClimatique) => {
    setEditPeriode(p)
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const payload = {
      region: (form.elements.namedItem('region') as HTMLInputElement).value.trim(),
      type_risque: (form.elements.namedItem('type_risque') as HTMLSelectElement).value,
      date_debut: (form.elements.namedItem('date_debut') as HTMLInputElement).value,
      date_fin: (form.elements.namedItem('date_fin') as HTMLInputElement).value,
      description: (form.elements.namedItem('description') as HTMLInputElement).value || undefined,
    }
    setSaving(true)
    try {
      if (editPeriode) {
        await aleasClimatiquesService.updatePeriodeRisque(editPeriode.id, payload)
      } else {
        await aleasClimatiquesService.createPeriodeRisque(payload)
      }
      setShowModal(false)
      load()
    } catch {
      alert("Erreur lors de l'enregistrement de la période à risque.")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (p: PeriodeRisqueClimatique) => {
    if (!confirm(`Supprimer la période à risque « ${p.region} » (${dateFR(p.date_debut)} → ${dateFR(p.date_fin)}) ?`)) return
    try {
      await aleasClimatiquesService.deletePeriodeRisque(p.id)
      load()
    } catch {
      alert('Erreur lors de la suppression.')
    }
  }

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h2 className="mb-1 text-secondary"><i className="bi bi-cloud-lightning-rain me-2"></i>Risques climatiques</h2>
          <p className="text-secondary mb-0">
            Périodes à risque par région (cyclones déc.-mars, pluies nov.-mars) — distinguer retard négociable et retard imputable.
          </p>
        </div>
        <div className="d-flex gap-2">
          <select
            className="form-select bg-light"
            style={{ maxWidth: 220 }}
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
          >
            <option value="">Toutes les régions</option>
            {regions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          {canEdit && (
            <button className="btn btn-outline-secondary fw-bold" onClick={openCreate}>
              <i className="bi bi-plus-lg me-1"></i>Nouvelle période
            </button>
          )}
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-body">
          {loading ? (
            <TableSkeleton rows={4} columns={6} />
          ) : filtered.length === 0 ? (
            <div className="text-center py-5">
              <i className="bi bi-cloud-sun display-4 text-muted"></i>
              <p className="text-muted mt-3 mb-0">
                Aucune période à risque définie. Pré-marquez la saison cyclonique (déc.-mars) ou la saison des pluies (nov.-mars) de vos régions.
              </p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle">
                <thead>
                  <tr>
                    <th>Région</th>
                    <th>Type de risque</th>
                    <th>Période</th>
                    <th>Description</th>
                    <th>Chantiers concernés</th>
                    {canEdit && <th className="text-end">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const meta = TYPES_RISQUE[p.type_risque] || TYPES_RISQUE.autre
                    const concernes = chantiersConcernes(p)
                    return (
                      <tr key={p.id}>
                        <td className="fw-semibold">{p.region}</td>
                        <td><span className={`badge ${meta.badge}`}>{meta.label}</span></td>
                        <td className="font-monospace small">
                          {dateFR(p.date_debut)} → {dateFR(p.date_fin)}
                        </td>
                        <td className="small text-muted">{p.description || '-'}</td>
                        <td>
                          {concernes.length === 0 ? (
                            <span className="text-muted small">—</span>
                          ) : (
                            <span className="badge bg-warning bg-opacity-10 text-dark border" title={concernes.map((c) => c.nom).join(', ')}>
                              <i className="bi bi-hammer me-1"></i>{concernes.length}
                            </span>
                          )}
                        </td>
                        {canEdit && (
                          <td className="text-end">
                            <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => openEdit(p)}>
                              <i className="bi bi-pencil"></i>
                            </button>
                            <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(p)}>
                              <i className="bi bi-trash"></i>
                            </button>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'var(--overlay)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <form onSubmit={handleSave}>
                <div className="modal-header">
                  <h5 className="modal-title fw-bold">
                    <i className="bi bi-cloud-lightning-rain me-2"></i>
                    {editPeriode ? 'Modifier la période à risque' : 'Nouvelle période à risque'}
                  </h5>
                  <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
                </div>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Région *</label>
                      <input
                        type="text"
                        className="form-control"
                        name="region"
                        required
                        maxLength={80}
                        defaultValue={editPeriode?.region || ''}
                        placeholder="Ex: Côte Est, Antananarivo, Sud..."
                        list="regions-existantes"
                      />
                      <datalist id="regions-existantes">
                        {regions.map((r) => <option key={r} value={r} />)}
                      </datalist>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Type de risque *</label>
                      <select className="form-select" name="type_risque" required defaultValue={editPeriode?.type_risque || 'cyclone'}>
                        {Object.entries(TYPES_RISQUE).map(([value, m]) => (
                          <option key={value} value={value}>{m.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Date de début *</label>
                      <input type="date" className="form-control" name="date_debut" required defaultValue={editPeriode?.date_debut?.slice(0, 10) || ''} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Date de fin *</label>
                      <input type="date" className="form-control" name="date_fin" required defaultValue={editPeriode?.date_fin?.slice(0, 10) || ''} />
                    </div>
                    <div className="col-12">
                      <label className="form-label small fw-semibold">Description</label>
                      <input
                        type="text"
                        className="form-control"
                        name="description"
                        maxLength={255}
                        defaultValue={editPeriode?.description || ''}
                        placeholder="Ex: Saison cyclonique 2026-2027, axe RN2 à surveiller..."
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowModal(false)}>Annuler</button>
                  <button type="submit" className="btn btn-primary fw-bold" disabled={saving}>
                    {saving ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {showModal && <div className="modal-backdrop fade show" onClick={() => setShowModal(false)}></div>}
    </div>
  )
}

export default RisquesClimatiquesPage
