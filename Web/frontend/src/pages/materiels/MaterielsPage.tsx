import { useEffect, useState } from 'react'
import type { Materiel } from '@/types'
import { materielsService } from '@/services/materiels.service'
import { useAuthStore } from '@/stores/auth.store'
import { getRolePermissions } from '@/config/roles.config'
import { PageSkeleton } from '@/components/ui/Skeleton'

export function MaterielsPage() {
  const { user } = useAuthStore()
  const perms = getRolePermissions(user?.role_code || 'employe')
  const [materiels, setMateriels] = useState<Materiel[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ nom: '', marque: '', valeur_achat: '', statut: 'disponible' as Materiel['statut'] })
  const [saving, setSaving] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const data = await materielsService.getAll()
      setMateriels(data)
    } catch {
      setMateriels([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const getStatutBadge = (statut: string) => {
    switch (statut) {
      case 'disponible': return <span className="badge bg-success bg-opacity-10 text-success border">Disponible</span>
      case 'en_utilisation': return <span className="badge bg-secondary bg-opacity-10 text-dark border">En Utilisation</span>
      case 'en_maintenance': return <span className="badge bg-warning bg-opacity-10 text-dark border">Maintenance</span>
      case 'hors_service': return <span className="badge bg-danger bg-opacity-10 text-danger border">Hors Service</span>
      default: return <span className="badge bg-light text-dark border">{statut}</span>
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await materielsService.create({
        nom: form.nom,
        marque: form.marque,
        valeur_achat: parseFloat(form.valeur_achat),
        statut: form.statut,
      })
      setShowModal(false)
      setForm({ nom: '', marque: '', valeur_achat: '', statut: 'disponible' })
      loadData()
    } catch {
      alert('Erreur lors de la création du matériel')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="container-fluid py-4">
      {/* Header */}
        <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
          <div>
            <h2 className="mb-1 text-secondary"><i className="bi bi-tools me-2"></i>Gestion du Parc Matériel</h2>
            <p className="text-secondary mb-0">Engins, véhicules, équipements et suivis d'interventions de maintenance</p>
          </div>
          {perms.canCreateMateriel && (
            <button className="btn btn-outline-secondary fw-bold" onClick={() => setShowModal(true)}>
              <i className="bi bi-plus-circle me-2"></i>Nouveau Matériel
            </button>
          )}
        </div>

      {loading ? (
        <PageSkeleton />
      ) : (
        <div className="row g-4">
          {materiels.map(m => (
            <div key={m.id} className="col-xl-4 col-md-6">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <span className="badge bg-light text-dark font-monospace border">MAT-00{m.id}</span>
                    {getStatutBadge(m.statut)}
                  </div>
                  <h5 className="fw-bold mb-1">{m.nom}</h5>
                  <p className="text-muted small mb-2">{m.marque || 'Marque non spécifiée'}</p>
                  <p className="small mb-0"><strong>Valeur Achat:</strong> {m.valeur_achat?.toLocaleString()} MGA</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Nouveau Matériel */}
      {showModal && (
        <div className="modal fade show" style={{ display: 'block' }} tabIndex={-1}>
          <div className="modal-dialog">
            <div className="modal-content">
              <form onSubmit={handleCreate}>
                <div className="modal-header">
                  <h5 className="modal-title">Nouveau Matériel</h5>
                  <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
                </div>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Nom</label>
                    <input className="form-control" required value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Marque</label>
                    <input className="form-control" value={form.marque} onChange={e => setForm({ ...form, marque: e.target.value })} />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Valeur d'achat (MGA)</label>
                    <input type="number" className="form-control" required min="0" step="0.01" value={form.valeur_achat} onChange={e => setForm({ ...form, valeur_achat: e.target.value })} />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Statut</label>
                    <select className="form-select" value={form.statut} onChange={e => setForm({ ...form, statut: e.target.value as Materiel['statut'] })}>
                      <option value="disponible">Disponible</option>
                      <option value="en_utilisation">En Utilisation</option>
                      <option value="en_maintenance">En Maintenance</option>
                      <option value="hors_service">Hors Service</option>
                    </select>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowModal(false)} disabled={saving}>Annuler</button>
                  <button type="submit" className="btn btn-outline-secondary" disabled={saving}>
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
