import { espaceClientService, Preferences } from '@/services/espaceClient.service'
import { PageHeader, EtatChargement } from './shared'
import { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/auth.store'

export function ClientParametresPage() {
  const [prefs, setPrefs] = useState<Preferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enregistrement, setEnregistrement] = useState(false)
  const logout = useAuthStore((s) => s.logout)

  useEffect(() => {
    charger()
  }, [])

  const charger = async () => {
    try {
      setLoading(true)
      const data = await espaceClientService.getPreferences()
      setPrefs(data)
    } catch (err: any) {
      setErreur(err?.response?.data?.detail || 'Erreur lors du chargement des parametres')
    } finally {
      setLoading(false)
    }
  }

  const enregistrer = async () => {
    if (!prefs) return
    try {
      setEnregistrement(true)
      setErreur(null)
      const maj = await espaceClientService.updatePreferences(prefs)
      setPrefs(maj)
      setMessage('Parametres enregistres avec succes.')
    } catch (err: any) {
      setErreur(err?.response?.data?.detail || 'Erreur lors de l enregistrement')
    } finally {
      setEnregistrement(false)
    }
  }

  const seDeconnecter = () => {
    logout()
    window.location.href = '/client-login'
  }

  if (loading) return <EtatChargement />

  return (
    <div className="container-fluid py-4">
      <PageHeader titre="Parametres" icone="bi-gear" sousTitre="Gestion de vos preferences" />
      {message && <div className="alert alert-success py-2">{message}</div>}
      {erreur && <div className="alert alert-danger py-2">{erreur}</div>}
      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <h6 className="fw-bold mb-3">Notifications</h6>
          <div className="form-check form-switch mb-3">
            <input
              className="form-check-input"
              type="checkbox"
              id="notifEmail"
              checked={!!prefs?.notifications_email}
              onChange={(e) => setPrefs({ ...prefs, notifications_email: e.target.checked })}
            />
            <label className="form-check-label" htmlFor="notifEmail">
              Recevoir les notifications par email
            </label>
          </div>

          <h6 className="fw-bold mb-3">Langue</h6>
          <div className="mb-4" style={{ maxWidth: 300 }}>
            <select
              className="form-select"
              value={prefs?.langue || 'fr'}
              onChange={(e) => setPrefs({ ...prefs, langue: e.target.value })}
            >
              <option value="fr">Francais</option>
              <option value="mg">Malagasy</option>
              <option value="en">English</option>
            </select>
          </div>

          <button className="btn btn-success" disabled={enregistrement} onClick={enregistrer}>
            {enregistrement ? 'Enregistrement...' : 'Enregistrer les parametres'}
          </button>

          <hr />
          <h6 className="fw-bold mb-3">Session</h6>
          <button className="btn btn-outline-danger" onClick={seDeconnecter}>
            <i className="bi bi-box-arrow-right me-1"></i>Se deconnecter
          </button>
        </div>
      </div>
    </div>
  )
}
