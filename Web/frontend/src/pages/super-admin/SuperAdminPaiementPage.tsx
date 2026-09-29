import { useEffect, useState } from 'react'
import { api } from '@/services/api'
import { useToast } from '@/stores/toast.store'
import { TableSkeleton } from '@/components/ui/Skeleton'

interface PaiementConfig {
  est_configure: boolean
  api_key_masquee: string | null
  webhook_secret_masque: string | null
  environment: 'sandbox' | 'production'
  providers_actifs: string[]
  notification_url: string | null
  success_url: string | null
  failure_url: string | null
  is_test_mode: boolean
  dernier_test_at: string | null
  dernier_test_ok: boolean | null
  dernier_test_message: string | null
}

interface PaiementJournal {
  items: Array<{
    id: number
    entreprise_id: number
    plan: string
    periode: string | null
    statut: string
    prix_paye: number
    date_debut: string | null
    date_fin: string | null
  }>
}

const TOUS_PROVIDERS = [
  { code: 'MVOLA', label: 'MVola', icon: 'bi-phone' },
  { code: 'ORANGE_MONEY', label: 'Orange Money', icon: 'bi-phone-vibrate' },
  { code: 'AIRTEL_MONEY', label: 'Airtel Money', icon: 'bi-broadcast' },
  { code: 'BRED', label: 'BRED (Visa)', icon: 'bi-credit-card-2-front' },
]

export function SuperAdminPaiementPage() {
  const [config, setConfig] = useState<PaiementConfig | null>(null)
  const [journal, setJournal] = useState<PaiementJournal['items']>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [showSecret, setShowSecret] = useState(false)
  const [form, setForm] = useState({
    api_key: '',
    webhook_secret: '',
    environment: 'sandbox' as 'sandbox' | 'production',
    providers_actifs: ['MVOLA'] as string[],
    notification_url: '',
    success_url: '',
    failure_url: '',
    is_test_mode: true,
  })
  const { showToast } = useToast()

  const charger = async () => {
    setLoading(true)
    try {
      const [cfg, jrnl] = await Promise.all([
        api.get('/paiement-config').then(r => r.data),
        api.get('/paiement-config/paiements').then(r => r.data).catch(() => ({ items: [] })),
      ])
      setConfig(cfg)
      setJournal(jrnl.items || [])
      setForm(f => ({
        ...f,
        environment: cfg.environment,
        providers_actifs: cfg.providers_actifs?.length ? cfg.providers_actifs : ['MVOLA'],
        notification_url: cfg.notification_url || `${window.location.origin}/api/webhooks/papi`,
        success_url: cfg.success_url || `${window.location.origin}/pricing?paiement=succes`,
        failure_url: cfg.failure_url || `${window.location.origin}/pricing?paiement=echec`,
        is_test_mode: cfg.is_test_mode,
      }))
    } catch {
      showToast('error', 'Chargement impossible', 'Configuration de paiement indisponible.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    charger()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      // Secrets : on n'envoie que si resaisis (sinon on conserve les valeurs existantes)
      const payload: Record<string, unknown> = {
        environment: form.environment,
        providers_actifs: form.providers_actifs,
        notification_url: form.notification_url || null,
        success_url: form.success_url || null,
        failure_url: form.failure_url || null,
        is_test_mode: form.is_test_mode,
      }
      if (form.api_key.trim()) payload.api_key = form.api_key.trim()
      if (form.webhook_secret.trim()) payload.webhook_secret = form.webhook_secret.trim()
      const cfg = await api.put('/paiement-config', payload).then(r => r.data)
      setConfig(cfg)
      setForm(f => ({ ...f, api_key: '', webhook_secret: '' }))
      showToast('success', 'Configuration enregistrée', 'La passerelle Papi est prête.')
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      showToast('error', 'Enregistrement impossible', typeof detail === 'string' ? detail : 'Erreur lors de l\u2019enregistrement.')
    } finally {
      setSaving(false)
    }
  }

  const testerConnexion = async () => {
    setTesting(true)
    try {
      const res = await api.post('/paiement-config/test').then(r => r.data)
      if (res.ok) {
        showToast('success', 'Test réussi', res.message)
      } else {
        showToast('error', 'Test échoué', res.message)
      }
      charger()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      showToast('error', 'Test échoué', typeof detail === 'string' ? detail : 'Papi injoignable.')
      charger()
    } finally {
      setTesting(false)
    }
  }

  const toggleProvider = (code: string) => {
    setForm(f => ({
      ...f,
      providers_actifs: f.providers_actifs.includes(code)
        ? f.providers_actifs.filter(p => p !== code)
        : [...f.providers_actifs, code],
    }))
  }

  if (loading) return <div className="container-fluid py-4"><TableSkeleton rows={8} columns={4} /></div>

  return (
    <div className="container-fluid py-4">
      <div className="mb-4">
        <h2 className="fw-bold mb-1 text-secondary"><i className="bi bi-router me-2"></i>Configuration Paiement — Papi.mg</h2>
        <p className="text-secondary mb-0">Passerelle Mobile Money (MVola, Orange Money, Airtel Money) et carte Visa pour les abonnements de la plateforme.</p>
      </div>

      {/* 1. Statut passerelle */}
      <div className="card border-0 shadow-sm p-4 mb-4">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
          <div>
            <h5 className="fw-bold mb-2"><i className="bi bi-activity me-2"></i>Statut de la passerelle</h5>
            <div className="d-flex flex-wrap gap-2 align-items-center">
              <span className={`badge border ${config?.environment === 'production' ? 'bg-success bg-opacity-10 text-success' : 'bg-warning bg-opacity-10 text-warning-emphasis'}`}>
                {config?.environment === 'production' ? '🟢 Production' : '🟡 Sandbox (aucun argent réel au test)'}
              </span>
              <span className={`badge border ${config?.est_configure ? 'bg-success bg-opacity-10 text-success' : 'bg-secondary bg-opacity-10 text-dark'}`}>
                {config?.est_configure ? 'Clés enregistrées' : 'Non configurée'}
              </span>
              {config?.dernier_test_at && (
                <span className={`badge border ${config.dernier_test_ok ? 'bg-success bg-opacity-10 text-success' : 'bg-danger bg-opacity-10 text-danger'}`}>
                  Test : {config.dernier_test_ok ? 'réussi' : 'échoué'} — {new Date(config.dernier_test_at).toLocaleString('fr-FR')}
                </span>
              )}
            </div>
            {config?.dernier_test_message && <p className="small text-muted mt-2 mb-0">{config.dernier_test_message}</p>}
          </div>
          <button className="btn btn-outline-secondary fw-bold" disabled={testing || !config?.est_configure} onClick={testerConnexion}>
            <i className={`bi ${testing ? 'bi-hourglass-split' : 'bi-plug'} me-2`}></i>
            {testing ? 'Test en cours…' : 'Tester la connexion'}
          </button>
        </div>
      </div>

      {/* 2-4. Formulaire */}
      <form onSubmit={enregistrer}>
        <div className="row g-4 mb-4">
          {/* Clés API */}
          <div className="col-lg-6">
            <div className="card border-0 shadow-sm p-4 h-100">
              <h5 className="fw-bold mb-3"><i className="bi bi-key me-2"></i>Clés API Papi</h5>
              <p className="small text-muted">Récupérées dans le dashboard Papi : <em>Avatar → Boutiques → votre application → onglet Développeur</em>.</p>
              <div className="mb-3">
                <label className="form-label fw-semibold" htmlFor="papi-key">Clé API (header Token)</label>
                <div className="input-group">
                  <input
                    id="papi-key"
                    className="form-control font-monospace"
                    type={showApiKey ? 'text' : 'password'}
                    placeholder={config?.api_key_masquee || 'Collez la clé API…'}
                    value={form.api_key}
                    onChange={e => setForm({ ...form, api_key: e.target.value })}
                    autoComplete="off"
                  />
                  <button type="button" className="btn btn-outline-secondary" aria-label={showApiKey ? 'Masquer la clé' : 'Afficher la clé'} onClick={() => setShowApiKey(v => !v)}>
                    <i className={`bi ${showApiKey ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                  </button>
                </div>
                {config?.api_key_masquee && !form.api_key && <small className="text-muted">Enregistrée : {config.api_key_masquee} (laisser vide pour conserver)</small>}
              </div>
              <div className="mb-2">
                <label className="form-label fw-semibold" htmlFor="papi-secret">Secret de signature notifications (pwhsec_…)</label>
                <div className="input-group">
                  <input
                    id="papi-secret"
                    className="form-control font-monospace"
                    type={showSecret ? 'text' : 'password'}
                    placeholder={config?.webhook_secret_masque || 'pwhsec_…'}
                    value={form.webhook_secret}
                    onChange={e => setForm({ ...form, webhook_secret: e.target.value })}
                    autoComplete="off"
                  />
                  <button type="button" className="btn btn-outline-secondary" aria-label={showSecret ? 'Masquer le secret' : 'Afficher le secret'} onClick={() => setShowSecret(v => !v)}>
                    <i className={`bi ${showSecret ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                  </button>
                </div>
                {config?.webhook_secret_masque && !form.webhook_secret && <small className="text-muted">Enregistré : {config.webhook_secret_masque} (laisser vide pour conserver)</small>}
              </div>
            </div>
          </div>

          {/* Providers + environnement */}
          <div className="col-lg-6">
            <div className="card border-0 shadow-sm p-4 h-100">
              <h5 className="fw-bold mb-3"><i className="bi bi-toggles me-2"></i>Moyens de paiement</h5>
              <div className="d-flex flex-column gap-2 mb-4">
                {TOUS_PROVIDERS.map(p => (
                  <div key={p.code} className="d-flex justify-content-between align-items-center p-2 bg-light rounded">
                    <span className="fw-semibold small"><i className={`bi ${p.icon} me-2`}></i>{p.label}</span>
                    <div className="form-check form-switch mb-0">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        role="switch"
                        id={`prov-${p.code}`}
                        checked={form.providers_actifs.includes(p.code)}
                        onChange={() => toggleProvider(p.code)}
                        aria-label={`Activer ${p.label}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mb-3">
                <label className="form-label fw-semibold" htmlFor="papi-env">Environnement</label>
                <select id="papi-env" className="form-select" value={form.environment} onChange={e => setForm({ ...form, environment: e.target.value as 'sandbox' | 'production' })}>
                  <option value="sandbox">🟡 Sandbox — tests sans argent réel</option>
                  <option value="production">🟢 Production — paiements réels</option>
                </select>
              </div>
              <div className="form-check form-switch">
                <input className="form-check-input" type="checkbox" role="switch" id="papi-testmode" checked={form.is_test_mode} onChange={e => setForm({ ...form, is_test_mode: e.target.checked })} />
                <label className="form-check-label small" htmlFor="papi-testmode">Marquer les liens en mode test (isTestMode)</label>
              </div>
            </div>
          </div>

          {/* URLs */}
          <div className="col-12">
            <div className="card border-0 shadow-sm p-4">
              <h5 className="fw-bold mb-3"><i className="bi bi-link-45deg me-2"></i>URLs de callback</h5>
              <p className="small text-muted">À copier dans le dashboard Papi (paramètres de notification de l'application) si l'URL publique change.</p>
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label fw-semibold small" htmlFor="url-notify">Notification (webhook)</label>
                  <input id="url-notify" className="form-control font-monospace small" value={form.notification_url} onChange={e => setForm({ ...form, notification_url: e.target.value })} placeholder="https://…/api/webhooks/papi" />
                </div>
                <div className="col-md-4">
                  <label className="form-label fw-semibold small" htmlFor="url-success">Retour succès</label>
                  <input id="url-success" className="form-control font-monospace small" value={form.success_url} onChange={e => setForm({ ...form, success_url: e.target.value })} placeholder="https://…/pricing?paiement=succes" />
                </div>
                <div className="col-md-4">
                  <label className="form-label fw-semibold small" htmlFor="url-failure">Retour échec</label>
                  <input id="url-failure" className="form-control font-monospace small" value={form.failure_url} onChange={e => setForm({ ...form, failure_url: e.target.value })} placeholder="https://…/pricing?paiement=echec" />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="d-flex gap-2 mb-5">
          <button type="submit" className="btn btn-outline-secondary fw-bold" disabled={saving}>
            <i className="bi bi-check2 me-2"></i>{saving ? 'Enregistrement…' : 'Enregistrer la configuration'}
          </button>
          <button type="button" className="btn btn-outline-secondary" disabled={testing || !config?.est_configure} onClick={testerConnexion}>
            <i className="bi bi-plug me-2"></i>Tester maintenant
          </button>
        </div>
      </form>

      {/* Journal */}
      <h5 className="fw-bold mb-3 text-secondary"><i className="bi bi-journal-text me-2"></i>Paiements d'abonnements via Papi</h5>
      <div className="card border-0 shadow-sm">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr><th>#</th><th>Entreprise</th><th>Formule</th><th>Période</th><th>Montant</th><th>Statut</th><th>Début</th><th>Fin</th></tr>
            </thead>
            <tbody>
              {journal.map(p => (
                <tr key={p.id}>
                  <td className="font-monospace">{p.id}</td>
                  <td className="fw-semibold">Entreprise #{p.entreprise_id}</td>
                  <td>{p.plan}</td>
                  <td className="text-capitalize">{p.periode || '-'}</td>
                  <td className="font-monospace">{p.prix_paye.toLocaleString()} Ar</td>
                  <td><span className={`badge ${p.statut === 'actif' ? 'bg-success bg-opacity-10 text-success border' : 'bg-secondary bg-opacity-10 text-dark border'}`}>{p.statut}</span></td>
                  <td className="small">{p.date_debut ? new Date(p.date_debut).toLocaleDateString() : '-'}</td>
                  <td className="small">{p.date_fin ? new Date(p.date_fin).toLocaleDateString() : '-'}</td>
                </tr>
              ))}
              {journal.length === 0 && (
                <tr><td colSpan={8} className="text-center py-4 text-muted">Aucun paiement Papi enregistré pour le moment.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
