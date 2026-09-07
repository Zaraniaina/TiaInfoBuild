import { useEffect, useState } from 'react'
import { employeTerrainService } from '@/services/employeTerrain.service'
import type { PhotoChantier } from '@/types'

export function EmployePhotosPage() {
  const [photos, setPhotos] = useState<PhotoChantier[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [description, setDescription] = useState('')
  const [zone, setZone] = useState('')
  const [fichierUrl, setFichierUrl] = useState("")

  const load = () => {
    setLoading(true)
    employeTerrainService.getPhotos()
      .then(setPhotos)
      .catch(() => setErr('Impossible de charger vos photos'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fichierUrl) return
    try {
      await employeTerrainService.envoyerPhoto({ fichier_url: fichierUrl, description, zone })
      setShowForm(false); setDescription(''); setZone(''); setFichierUrl("")
      load()
    } catch { alert("Erreur lors de l'envoi de la photo") }
  }

  if (loading) return <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
  if (err) return <div className="alert alert-danger m-3">{err}</div>

  return (
    <div className="container-fluid py-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0"> Mes photos</h5>
        <button className="btn btn-success btn-sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Fermer' : '+ Ajouter une photo'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={soumettre} className="card border-0 shadow-sm mb-3">
          <div className="card-body">
            <div className="mb-2">
              <label className="form-label small">Photo *</label>
              <input type="file" accept="image/*" capture="environment" className="form-control form-control-sm" onChange={(e) => setFichierUrl(e.target.files?.[0]?.name || "")} required />
            </div>
            <div className="mb-2">
              <input className="form-control form-control-sm" placeholder="Zone (ex: Zone A)" value={zone} onChange={(e) => setZone(e.target.value)} />
            </div>
            <div className="mb-2">
              <input className="form-control form-control-sm" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary btn-sm">Envoyer</button>
          </div>
        </form>
      )}

      {photos.length === 0 ? <div className="text-muted">Aucune photo envoyée</div> : (
        <div className="row g-2">
          {photos.map((p) => (
            <div key={p.id} className="col-6 col-md-4 col-lg-3">
              <div className="card border-0 shadow-sm">
                {p.fichier_url ? (
                  <img src={p.fichier_url} alt={p.description} className="card-img-top" style={{ height: 120, objectFit: 'cover' }} />
                ) : (
                  <div className="bg-light d-flex align-items-center justify-content-center" style={{ height: 120 }}>
                    <span className="text-muted"><i className="bi bi-camera"></i></span>
                  </div>
                )}
                <div className="card-body p-2">
                  <div className="small">{p.description || 'Sans description'}</div>
                  {p.zone && <div className="text-muted small"><i className="bi bi-geo-alt"></i> {p.zone}</div>}
                  <div className="text-muted small">{p.date_photo || p.created_at?.slice(0, 10)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
