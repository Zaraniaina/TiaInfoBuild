import { useEffect, useState } from 'react'
import type { Materiel } from '@/types'
import { materielsService } from '@/services/materiels.service'
import { useAuthStore } from '@/stores/auth.store'
import { getRolePermissions } from '@/config/roles.config'
import { PageSkeleton } from '@/components/ui/Skeleton'

const PHOTO_ACCEPT = '.jpg,.jpeg,.png'
const MANUEL_ACCEPT = '.pdf'

export function MaterielsPage() {
  const { user } = useAuthStore()
  const perms = getRolePermissions(user?.role_code || 'employe')
  const [materiels, setMateriels] = useState<Materiel[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ nom: '', marque: '', valeur_achat: '', statut: 'disponible' as Materiel['statut'] })
  const [saving, setSaving] = useState(false)
  const [detailMateriel, setDetailMateriel] = useState<Materiel | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [uploadingManuel, setUploadingManuel] = useState(false)
  const [normes, setNormes] = useState('')
  const [savingNormes, setSavingNormes] = useState(false)

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

  useEffect(() => { loadData() }, [])

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

  const openDetail = (m: Materiel) => {
    setDetailMateriel(m)
    setNormes(m.normes || '')
  }

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !detailMateriel) return
    setUploadingPhoto(true)
    try {
      const res = await materielsService.uploadPhoto(detailMateriel.id, file)
      setDetailMateriel({ ...detailMateriel, photo_url: res.photo_url })
      loadData()
    } catch {
      alert('Erreur lors de l’upload de la photo')
    } finally {
      setUploadingPhoto(false)
      e.target.value = ''
    }
  }

  const handleUploadManuel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !detailMateriel) return
    setUploadingManuel(true)
    try {
      const res = await materielsService.uploadManuel(detailMateriel.id, file)
      setDetailMateriel({ ...detailMateriel, manuel_url: res.manuel_url })
      loadData()
    } catch {
      alert('Erreur lors de l’upload du manuel')
    } finally {
      setUploadingManuel(false)
      e.target.value = ''
    }
  }

  const handleSaveNormes = async () => {
    if (!detailMateriel) return
    setSavingNormes(true)
    try {
      await materielsService.update(detailMateriel.id, { normes })
      setDetailMateriel({ ...detailMateriel, normes })
      loadData()
    } catch {
      alert('Erreur lors de la sauvegarde des normes')
    } finally {
      setSavingNormes(false)
    }
  }

  const handleDeletePhoto = async () => {
    if (!detailMateriel) return
    if (!confirm('Supprimer la photo ?')) return
    try {
      await materielsService.deletePhoto(detailMateriel.id)
      setDetailMateriel({ ...detailMateriel, photo_url: undefined })
      loadData()
    } catch {
      alert('Erreur lors de la suppression de la photo')
    }
  }

  const handleDeleteManuel = async () => {
    if (!detailMateriel) return
    if (!confirm('Supprimer le manuel ?')) return
    try {
      await materielsService.deleteManuel(detailMateriel.id)
      setDetailMateriel({ ...detailMateriel, manuel_url: undefined })
      loadData()
    } catch {
      alert('Erreur lors de la suppression du manuel')
    }
  }

  if (loading) return <PageSkeleton />

  return (
    <div className="container-fluid py-3">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h5 className="mb-0"><i className="bi bi-truck me-2"></i>Parc Matériel</h5>
        {perms.canCreateMateriel && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <i className="bi bi-plus-lg me-1"></i>Nouveau Matériel
          </button>
        )}
      </div>

      {materiels.length === 0 ? (
        <div className="text-center py-5 text-muted">
          <i className="bi bi-truck" style={{ fontSize: 48 }}></i>
          <p className="mt-3">Aucun matériel enregistré</p>
        </div>
      ) : (
        <div className="row g-3">
          {materiels.map((m) => (
            <div key={m.id} className="col-12 col-md-6 col-lg-4">
              <div className="card h-100 border-0 shadow-sm">
                <div className="card-body">
                  <div className="d-flex align-items-start mb-2">
                    {m.photo_url ? (
                      <img src={m.photo_url} alt={m.nom} className="rounded me-2" style={{ width: 56, height: 56, objectFit: 'cover' }} />
                    ) : (
                      <div className="bg-light rounded me-2 d-flex align-items-center justify-content-center" style={{ width: 56, height: 56 }}>
                        <i className="bi bi-image text-muted"></i>
                      </div>
                    )}
                    <div className="flex-grow-1">
                      <h6 className="mb-1">{m.nom}</h6>
                      {m.marque && <p className="text-muted small mb-0">{m.marque}</p>}
                    </div>
                    {getStatutBadge(m.statut)}
                  </div>
                  <p className="small mb-0"><strong>Valeur Achat:</strong> {m.valeur_achat?.toLocaleString()} MGA</p>
                  <div className="mt-2 d-flex gap-2">
                    {m.photo_url && <span className="badge bg-info bg-opacity-10 text-info"><i className="bi bi-image"></i> Photo</span>}
                    {m.manuel_url && <span className="badge bg-warning bg-opacity-10 text-warning"><i className="bi bi-file-pdf"></i> Manuel</span>}
                  </div>
                </div>
                <div className="card-footer bg-transparent border-0 pt-0">
                  <button className="btn btn-sm btn-outline-secondary w-100" onClick={() => openDetail(m)}>
                    <i className="bi bi-pencil-square me-1"></i>Détails & Documents
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Détail Matériel */}
      {detailMateriel && (
        <div className="modal fade show" style={{ display: 'block' }} tabIndex={-1}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title"><i className="bi bi-truck me-2"></i>{detailMateriel.nom}</h5>
                <button type="button" className="btn-close" onClick={() => setDetailMateriel(null)}></button>
              </div>
              <div className="modal-body">
                <div className="row">
                  <div className="col-md-6 mb-4">
                    <h6 className="fw-bold"><i className="bi bi-image me-1"></i>Photo du matériel</h6>
                    {detailMateriel.photo_url ? (
                      <div className="mb-2">
                        <img src={detailMateriel.photo_url} alt={detailMateriel.nom} className="img-fluid rounded border" style={{ maxHeight: 180, objectFit: 'cover' }} />
                      </div>
                    ) : (
                      <div className="bg-light rounded d-flex align-items-center justify-content-center mb-2" style={{ height: 120 }}>
                        <span className="text-muted">Aucune photo</span>
                      </div>
                    )}
                    <div className="d-flex gap-2">
                      <label className="btn btn-sm btn-outline-primary mb-0" style={{ pointerEvents: uploadingPhoto ? 'none' : 'auto', opacity: uploadingPhoto ? 0.6 : 1 }}>
                        {uploadingPhoto ? 'Upload...' : <><i className="bi bi-upload me-1"></i>Changer la photo</>}
                        <input type="file" accept={PHOTO_ACCEPT} hidden onChange={handleUploadPhoto} />
                      </label>
                      {detailMateriel.photo_url && (
                        <button className="btn btn-sm btn-outline-danger" onClick={handleDeletePhoto}><i className="bi bi-trash"></i></button>
                      )}
                    </div>
                  </div>

                  <div className="col-md-6 mb-4">
                    <h6 className="fw-bold"><i className="bi bi-file-pdf me-1"></i>Manuel d'utilisation</h6>
                    {detailMateriel.manuel_url ? (
                      <div className="mb-2">
                        <a href={detailMateriel.manuel_url} target="_blank" rel="noreferrer" className="btn btn-sm btn-warning">
                          <i className="bi bi-download me-1"></i>Voir / Télécharger le manuel
                        </a>
                      </div>
                    ) : (
                      <div className="bg-light rounded d-flex align-items-center justify-content-center mb-2" style={{ height: 60 }}>
                        <span className="text-muted">Aucun manuel</span>
                      </div>
                    )}
                    <div className="d-flex gap-2">
                      <label className="btn btn-sm btn-outline-warning mb-0" style={{ pointerEvents: uploadingManuel ? 'none' : 'auto', opacity: uploadingManuel ? 0.6 : 1 }}>
                        {uploadingManuel ? 'Upload...' : <><i className="bi bi-upload me-1"></i>{detailMateriel.manuel_url ? 'Changer le manuel' : 'Ajouter un manuel'}</>}
                        <input type="file" accept={MANUEL_ACCEPT} hidden onChange={handleUploadManuel} />
                      </label>
                      {detailMateriel.manuel_url && (
                        <button className="btn btn-sm btn-outline-danger" onClick={handleDeleteManuel}><i className="bi bi-trash"></i></button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="border-top pt-3">
                  <h6 className="fw-bold"><i className="bi bi-clipboard-check me-1"></i>Normes de gestion du matériel</h6>
                  <p className="text-muted small">
                    Décrivez ici les normes d'entretien, les procédures de sécurité, la fréquence de maintenance préventive, les contrôles obligatoires, etc.
                  </p>
                  <textarea
                    className="form-control"
                    rows={4}
                    placeholder="Ex: Contrôle technique trimestriel, huilage mensuel des parties mobiles, vérification des freins avant chaque utilisation..."
                    value={normes}
                    onChange={(e) => setNormes(e.target.value)}
                  ></textarea>
                  <div className="mt-2">
                    <button className="btn btn-sm btn-success" onClick={handleSaveNormes} disabled={savingNormes || normes === (detailMateriel.normes || '')}>
                      {savingNormes ? 'Sauvegarde...' : <><i className="bi bi-check me-1"></i>Sauvegarder les normes</>}
                    </button>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setDetailMateriel(null)}>Fermer</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {detailMateriel && <div className="modal-backdrop fade show" onClick={() => setDetailMateriel(null)}></div>}

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
                  <button type="submit" className="btn btn-primary" disabled={saving}>
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
