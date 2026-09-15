import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/services/api'
import { PageSkeleton } from '@/components/ui/Skeleton'

type Tab = 'general' | 'mail'

interface PlatformSettings {
  nom_plateforme: string
  support_email: string
  mobile_money_enabled: boolean
  devise_defaut: string
  langues: string
  maintenance_mode: boolean
}

export function SuperAdminParametresPage() {
  const [form, setForm] = useState<PlatformSettings>({
    nom_plateforme: 'TIA INFO BUILD',
    support_email: 'support@tiainfo.mg',
    mobile_money_enabled: true,
    devise_defaut: 'MGA',
    langues: 'fr,mg',
    maintenance_mode: false,
  })
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [tab, setTab] = useState<Tab>('general')
  const [srcBadge, setSrcBadge] = useState<string>('env')

  useEffect(() => {
    api.get<PlatformSettings>('/super-admin/settings')
      .then(res => {
        setForm(res.data)
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
    api.get<{ effective_source: string }>('/super-admin/mail-settings/status')
      .then(res => setSrcBadge(res.data.effective_source))
      .catch(() => {})
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.put('/super-admin/settings', form)
      alert('Paramètres plateforme enregistrés.')
    } catch {
      alert('Erreur lors de l\'enregistrement')
    } finally {
      setSaving(false)
    }
  }

  if (!loaded) {
    return (
      <div className="container-fluid py-4">
        <PageSkeleton />
      </div>
    )
  }

  return (
    <div className="container-fluid py-4">
      <div className="mb-4">
        <h2 className="fw-bold mb-1 text-secondary"><i className="bi bi-gear me-2"></i>Paramètres Plateforme</h2>
        <p className="text-secondary mb-0">Configuration globale du SaaS, email transactionnel et fonctionnalités.</p>
      </div>

      <ul className="nav nav-tabs mb-4">
        <li className="nav-item"><button type="button" className={`nav-link ${tab === 'general' ? 'active fw-bold' : ''}`} onClick={() => setTab('general')}><i className="bi bi-sliders me-1"></i>Général</button></li>
        <li className="nav-item"><button type="button" className={`nav-link ${tab === 'mail' ? 'active fw-bold' : ''}`} onClick={() => setTab('mail')}><i className="bi bi-envelope-gear me-1"></i>Email / SMTP<span className={`badge ms-2 ${srcBadge === 'database' ? 'bg-success' : 'bg-warning text-dark'}`}>{srcBadge === 'database' ? 'BDD' : '.env'}</span></button></li>
      </ul>

      {tab === 'general' && (
      <div className="card border-0 shadow-sm">
        <div className="card-body p-4">
          <form onSubmit={handleSave}>
            <div className="row g-3 mb-4">
              <div className="col-md-6">
                <label className="form-label fw-semibold">Nom de la plateforme</label>
                <input className="form-control" value={form.nom_plateforme} onChange={e => setForm({ ...form, nom_plateforme: e.target.value })} />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold">Email support</label>
                <input className="form-control" value={form.support_email} onChange={e => setForm({ ...form, support_email: e.target.value })} />
              </div>
            </div>

            <div className="row g-3 mb-4">
              <div className="col-md-6">
                <label className="form-label fw-semibold">Devise par défaut</label>
                <select className="form-select" value={form.devise_defaut} onChange={e => setForm({ ...form, devise_defaut: e.target.value })}>
                  <option value="MGA">MGA (Ariary)</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold">Langues supportées</label>
                <input className="form-control" value={form.langues} onChange={e => setForm({ ...form, langues: e.target.value })} />
              </div>
            </div>

            <div className="row g-3 mb-4">
              <div className="col-md-6">
                <div className="form-check form-switch">
                  <input className="form-check-input" type="checkbox" id="mobileMoney" checked={form.mobile_money_enabled} onChange={e => setForm({ ...form, mobile_money_enabled: e.target.checked })} />
                  <label className="form-check-label fw-semibold" htmlFor="mobileMoney">Activer Mobile Money (MVola / Orange / Airtel)</label>
                </div>
              </div>
              <div className="col-md-6">
                <div className="form-check form-switch">
                  <input className="form-check-input" type="checkbox" id="maintenance" checked={form.maintenance_mode} onChange={e => setForm({ ...form, maintenance_mode: e.target.checked })} />
                  <label className="form-check-label fw-semibold" htmlFor="maintenance">Mode maintenance</label>
                </div>
              </div>
            </div>

            <button type="submit" className="btn btn-outline-secondary fw-bold" disabled={saving}>
              {saving ? 'Enregistrement...' : 'Enregistrer les paramètres'}
            </button>
          </form>
        </div>
      </div>
      )}
      {tab === 'mail' && (
        <div className="card border-0 shadow-sm">
          <div className="card-body p-4">
            <div className="d-flex align-items-start gap-3 flex-wrap">
              <div className="fs-1 text-secondary"><i className="bi bi-envelope-gear"></i></div>
              <div className="flex-grow-1">
                <h5 className="fw-bold mb-1">Configuration Email / SMTP</h5>
                <p className="text-secondary mb-3">
                  La configuration de l’email transactionnel dispose désormais de son
                  <strong> interface dédiée</strong> : choix du fournisseur (Gmail, Outlook, Yahoo, SMTP
                  personnalisé), test d’envoi réel <em>avant</em> sauvegarde, checklist de mise en
                  production et retour immédiat au <code>.env</code> en cas d’incident.
                </p>
                <ul className="list-unstyled small text-secondary mb-4">
                  <li><i className="bi bi-check2-circle me-2"></i>Application à chaud, sans redéploiement</li>
                  <li><i className="bi bi-check2-circle me-2"></i>Mot de passe SMTP chiffré en base, jamais exposé</li>
                  <li><i className="bi bi-check2-circle me-2"></i>Diagnostic « prêt pour la production » guidé pas à pas</li>
                </ul>
                <Link to="/super-admin/email" className="btn btn-outline-secondary fw-bold">
                  <i className="bi bi-box-arrow-up-right me-2"></i>Ouvrir l’interface Email / SMTP
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
