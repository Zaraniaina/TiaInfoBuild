import { useEffect, useState } from 'react'
import { employeTerrainService } from '@/services/employeTerrain.service'
import type { ProfilTerrain } from '@/types'

export function EmployeProfilPage() {
  const [profil, setProfil] = useState<ProfilTerrain | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [edit, setEdit] = useState(false)
  const [telephone, setTelephone] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    employeTerrainService.getProfil()
      .then((p) => {
        setProfil(p)
        setTelephone(p.telephone || '')
        setEmail(p.email || '')
      })
      .catch(() => setErr('Impossible de charger votre profil'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const sauvegarder = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await employeTerrainService.updateProfil({ telephone, email })
      setProfil(updated)
      setEdit(false)
    } catch { alert('Erreur lors de la sauvegarde') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
  if (err) return <div className="alert alert-danger m-3">{err}</div>
  if (!profil) return null

  return (
    <div className="container-fluid py-3">
      <h5 className="mb-3">👤 Mon profil</h5>
      <div className="card border-0 shadow-sm">
        <div className="card-body">
          {!edit ? (
            <div className="row g-3">
              <div className="col-md-6"><label className="text-muted small">Nom</label><div className="fw-semibold">{profil.nom}</div></div>
              <div className="col-md-6"><label className="text-muted small">Prénom</label><div className="fw-semibold">{profil.prenom}</div></div>
              <div className="col-md-6"><label className="text-muted small">Matricule</label><div className="fw-semibold">{profil.matricule || '-'}</div></div>
              <div className="col-md-6"><label className="text-muted small">Poste</label><div className="fw-semibold">{profil.poste || '-'}</div></div>
              <div className="col-md-6"><label className="text-muted small">Email</label><div className="fw-semibold">{profil.email}</div></div>
              <div className="col-md-6"><label className="text-muted small">Téléphone</label><div className="fw-semibold">{profil.telephone || '-'}</div></div>
              {profil.date_embauche && <div className="col-md-6"><label className="text-muted small">Date d'embauche</label><div className="fw-semibold">{profil.date_embauche}</div></div>}
              <div className="col-12"><button className="btn btn-primary btn-sm" onClick={() => setEdit(true)}>✏️ Modifier</button></div>
            </div>
          ) : (
            <form onSubmit={sauvegarder}>
              <div className="row g-3">
                <div className="col-md-6"><label className="form-label small">Nom</label><input className="form-control form-control-sm" value={profil.nom} disabled /></div>
                <div className="col-md-6"><label className="form-label small">Prénom</label><input className="form-control form-control-sm" value={profil.prenom} disabled /></div>
                <div className="col-md-6"><label className="form-label small">Email</label><input type="email" className="form-control form-control-sm" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div className="col-md-6"><label className="form-label small">Téléphone</label><input className="form-control form-control-sm" value={telephone} onChange={(e) => setTelephone(e.target.value)} /></div>
                <div className="col-12 d-flex gap-2">
                  <button type="submit" className="btn btn-success btn-sm" disabled={saving}>{saving ? 'Enregistrement...' : '💾 Enregistrer'}</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEdit(false)}>Annuler</button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Badge QR */}
      <div className="card border-0 shadow-sm mt-3">
        <div className="card-body">
          <h6>🎫 Mon badge QR</h6>
          {profil.badge_qr ? (
            <div className="text-center">
              <div className="border rounded p-3 d-inline-block bg-white">
                <div className="fw-bold small">TIA INFO BUILD</div>
                <div className="fw-semibold">{profil.prenom} {profil.nom}</div>
                <div className="text-muted small">{profil.matricule}</div>
                <div className="text-muted small">{profil.poste}</div>
                <div className="mt-2" style={{ width: 120, height: 120, margin: '0 auto', background: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>
                  📱
                </div>
                <div className="small text-muted mt-1">QR: {profil.badge_qr}</div>
              </div>
            </div>
          ) : (
            <div className="text-muted">Badge non généré. Contactez votre responsable.</div>
          )}
        </div>
      </div>
    </div>
  )
}
