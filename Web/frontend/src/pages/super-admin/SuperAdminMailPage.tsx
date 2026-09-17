import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  mailSettingsService,
  type MailDiagnostics,
  type MailProviderPresets,
  type MailSettingsPayload,
} from '@/services/mailSettings.service'
import { PageSkeleton } from '@/components/ui/Skeleton'

/** Valeurs du formulaire (mot de passe vide = on conserve celui déjà enregistré). */
interface MailForm {
  provider: string
  smtp_host: string
  smtp_port: number
  smtp_user: string
  smtp_password: string
  smtp_tls: boolean
  smtp_ssl: boolean
  smtp_from_email: string
  smtp_from_name: string
  frontend_url: string
}

const EMPTY_FORM: MailForm = {
  provider: 'custom',
  smtp_host: '',
  smtp_port: 587,
  smtp_user: '',
  smtp_password: '',
  smtp_tls: true,
  smtp_ssl: false,
  smtp_from_email: '',
  smtp_from_name: 'TIA INFO BUILD',
  frontend_url: '',
}

/** Repli si l'API des presets est indisponible (le backend reste la référence). */
const DEFAULT_PRESETS: MailProviderPresets = {
  providers: {
    gmail: { smtp_host: 'smtp.gmail.com', smtp_port: 587, smtp_tls: true, smtp_ssl: false },
    outlook: { smtp_host: 'smtp.office365.com', smtp_port: 587, smtp_tls: true, smtp_ssl: false },
    yahoo: { smtp_host: 'smtp.mail.yahoo.com', smtp_port: 587, smtp_tls: true, smtp_ssl: false },
    mailpit: { smtp_host: 'localhost', smtp_port: 1025, smtp_tls: false, smtp_ssl: false },
    custom: {},
  },
  labels: {
    gmail: 'Gmail / Google Workspace',
    outlook: 'Outlook / Microsoft 365',
    yahoo: 'Yahoo Mail',
    mailpit: 'Mailpit (dev local)',
    custom: 'SMTP personnalisé',
  },
}

const PORTS = [
  { value: 587, label: '587 — STARTTLS (recommandé)' },
  { value: 465, label: '465 — SSL' },
  { value: 25, label: '25 — non chiffré (déconseillé)' },
  { value: 1025, label: '1025 — Mailpit (dev local)' },
  { value: 2525, label: '2525 — alternative' },
]

const GUIDE = [
  {
    icon: 'bi-key',
    titre: 'Créer un mot de passe d’application',
    texte: 'Gmail et Outlook refusent le mot de passe du compte. Google : Sécurité → Validation en deux étapes → Mots de passe des applications.',
  },
  {
    icon: 'bi-shield-check',
    titre: 'Choisir le bon port',
    texte: '587 avec STARTTLS (recommandé) ou 465 avec SSL. Ne cochez jamais les deux : SSL est prioritaire côté serveur.',
  },
  {
    icon: 'bi-link-45deg',
    titre: 'Renseigner l’URL frontend publique',
    texte: 'Les emails de vérification et de réinitialisation s’appuient sur cette URL. En production, mettez le domaine réel (jamais localhost).',
  },
  {
    icon: 'bi-envelope-check',
    titre: 'Autoriser l’adresse expéditrice',
    texte: 'L’adresse expéditrice doit être un alias autorisé par le serveur SMTP (souvent identique à l’utilisateur SMTP).',
  },
  {
    icon: 'bi-patch-check',
    titre: 'Soigner la délivrabilité (SPF / DKIM)',
    texte: 'Ajoutez les enregistrements SPF et DKIM de votre hébergeur dans la zone DNS du domaine pour éviter le classement en spam.',
  },
  {
    icon: 'bi-arrow-counterclockwise',
    titre: 'Mettre en production sans risque',
    texte: 'Testez d’abord les valeurs saisies, puis enregistrez. En cas d’incident, « Revenir au .env » rétablit instantanément le serveur.',
  },
]

/** Message d'erreur lisible renvoyé par l'API (detail FastAPI). */
function extractDetail(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  return typeof detail === 'string' && detail ? detail : fallback
}

export function SuperAdminMailPage() {
  const [form, setForm] = useState<MailForm>(EMPTY_FORM)
  const [presets, setPresets] = useState<MailProviderPresets>(DEFAULT_PRESETS)
  const [diagnostics, setDiagnostics] = useState<MailDiagnostics | null>(null)
  const [hasPassword, setHasPassword] = useState(false)
  const [source, setSource] = useState('env')
  const [lastTest, setLastTest] = useState<string | null>(null)
  const [testEmail, setTestEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState<'' | 'active' | 'draft' | 'reset'>('')
  const [alert, setAlert] = useState<{ type: 'success' | 'danger' | 'info' | 'warning'; texte: string } | null>(null)

  const load = async () => {
    try {
      const [settings, diag] = await Promise.all([
        mailSettingsService.get(),
        mailSettingsService.getDiagnostics(),
      ])
      setForm({
        provider: settings.provider || 'custom',
        smtp_host: settings.smtp_host || '',
        smtp_port: settings.smtp_port || 587,
        smtp_user: settings.smtp_user || '',
        smtp_password: '',
        smtp_tls: !!settings.smtp_tls,
        smtp_ssl: !!settings.smtp_ssl,
        smtp_from_email: settings.smtp_from_email || '',
        smtp_from_name: settings.smtp_from_name || 'TIA INFO BUILD',
        frontend_url: settings.frontend_url || '',
      })
      setHasPassword(!!settings.has_password)
      setSource(settings.effective_source)
      setLastTest(settings.last_test_at)
      setDiagnostics(diag)
    } catch (err) {
      setAlert({ type: 'danger', texte: extractDetail(err, 'Impossible de charger la configuration email (accès super admin requis).') })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    mailSettingsService.getProviders()
      .then(res => setPresets(res))
      .catch(() => setPresets(DEFAULT_PRESETS))
    load()
  }, [])

  const refreshDiagnostics = async () => {
    try {
      setDiagnostics(await mailSettingsService.getDiagnostics())
    } catch {
      /* diagnostic non bloquant */
    }
  }

  /** Applique le preset du fournisseur (hôte, port, chiffrement). */
  const applyProvider = (provider: string) => {
    setForm(prev => ({ ...prev, provider, ...(presets.providers[provider] || {}) }))
  }

  const payload = (): MailSettingsPayload => ({
    provider: form.provider,
    smtp_host: form.smtp_host.trim(),
    smtp_port: Number(form.smtp_port),
    smtp_user: form.smtp_user.trim(),
    smtp_from_email: form.smtp_from_email.trim(),
    smtp_from_name: form.smtp_from_name.trim(),
    frontend_url: form.frontend_url.trim(),
    smtp_tls: form.smtp_tls,
    smtp_ssl: form.smtp_ssl,
    // Mot de passe vide = conserver celui déjà enregistré (jamais écrasé).
    ...(form.smtp_password ? { smtp_password: form.smtp_password } : {}),
  })

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setAlert(null)
    try {
      const saved = await mailSettingsService.save({ ...payload(), is_active: true })
      setSource(saved.effective_source)
      setHasPassword(!!saved.has_password)
      setForm(prev => ({ ...prev, smtp_password: '' }))
      await refreshDiagnostics()
      setAlert({ type: 'success', texte: 'Configuration SMTP enregistrée et active : les emails transactionnels l’utilisent immédiatement.' })
    } catch (err) {
      setAlert({ type: 'danger', texte: extractDetail(err, 'Erreur lors de l’enregistrement de la configuration SMTP.') })
    } finally {
      setSaving(false)
    }
  }

  /** `draft` = valeurs saisies non enregistrées ; `active` = config réellement utilisée. */
  const runTest = async (mode: 'active' | 'draft') => {
    if (!testEmail) {
      setAlert({ type: 'warning', texte: 'Renseignez l’adresse de test avant de lancer un envoi.' })
      return
    }
    setBusy(mode)
    setAlert(null)
    try {
      const result = mode === 'draft'
        ? await mailSettingsService.sendTestDraft(testEmail, payload())
        : await mailSettingsService.sendTest(testEmail)
      setAlert({ type: 'success', texte: result.message })
      if (mode === 'active') setLastTest(result.tested_at || new Date().toISOString())
      await refreshDiagnostics()
    } catch (err) {
      setAlert({ type: 'danger', texte: extractDetail(err, 'Échec de l’envoi de l’email de test.') })
    } finally {
      setBusy('')
    }
  }

  const handleReset = async () => {
    if (!confirm('Désactiver la configuration en base et revenir au SMTP du .env ?')) return
    setBusy('reset')
    setAlert(null)
    try {
      await mailSettingsService.reset()
      await load()
      setAlert({ type: 'info', texte: 'Configuration en base désactivée : la plateforme utilise à nouveau le SMTP du .env. Les valeurs restent enregistrées et réactivables.' })
    } catch (err) {
      setAlert({ type: 'danger', texte: extractDetail(err, 'Erreur lors du retour à la configuration .env.') })
    } finally {
      setBusy('')
    }
  }

  if (loading) {
    return (
      <div className="container-fluid py-4">
        <PageSkeleton />
      </div>
    )
  }

  const checks = diagnostics?.checks || []
  const bloqueurs = checks.filter(c => c.required && !c.ok)
  const enAttente = checks.filter(c => !c.required && !c.ok)
  const sourceBdd = source === 'database'

  const portLabel = PORTS.find(p => p.value === Number(form.smtp_port))?.label || `Port ${form.smtp_port}`

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-start mb-4 flex-wrap gap-3">
        <div>
          <h2 className="fw-bold mb-1 text-secondary"><i className="bi bi-envelope-paper me-2"></i>Configuration Email &amp; SMTP</h2>
          <p className="text-secondary mb-0">Interface dédiée de mise en production : testez, activez et dépannez l’envoi des emails transactionnels.</p>
        </div>
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <span className={`badge ${sourceBdd ? 'bg-success' : 'bg-warning text-dark'} border px-3 py-2`}>
            <i className={`bi ${sourceBdd ? 'bi-database-check' : 'bi-file-earmark-code'} me-1`}></i>
            {sourceBdd ? 'Config active en base (BDD)' : 'Config serveur (.env)'}
          </span>
          <span className={`badge ${diagnostics?.ready ? 'bg-success' : 'bg-danger'} border px-3 py-2`}>
            <i className={`bi ${diagnostics?.ready ? 'bi-check-circle' : 'bi-exclamation-triangle'} me-1`}></i>
            {diagnostics?.ready ? 'Prêt pour la production' : 'Configuration incomplète'}
          </span>
          <Link to="/super-admin/parametres" className="btn btn-outline-secondary fw-bold">
            <i className="bi bi-arrow-left me-1"></i>Paramètres plateforme
          </Link>
        </div>
      </div>

      {alert && (
        <div className={`alert alert-${alert.type} d-flex align-items-start gap-2`} role="alert">
          <i className="bi bi-info-circle mt-1"></i>
          <div className="flex-grow-1">{alert.texte}</div>
          <button type="button" className="btn-close" aria-label="Fermer" onClick={() => setAlert(null)}></button>
        </div>
      )}

      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="text-muted small text-uppercase fw-bold mb-1">Source appliquée</div>
              <div className={`fw-bold ${sourceBdd ? 'text-success' : 'text-warning'}`}>
                <i className={`bi ${sourceBdd ? 'bi-database-check' : 'bi-file-earmark-code'} me-1`}></i>
                {sourceBdd ? 'Base de données' : 'Fichier .env'}
              </div>
              <div className="small text-muted mt-1">
                {sourceBdd ? 'Modifiable sans redéploiement.' : 'Repli sur les valeurs serveur.'}
              </div>
            </div>
          </div>
        </div>
        <div className="col-6 col-lg-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="text-muted small text-uppercase fw-bold mb-1">Serveur SMTP</div>
              <div className="fw-bold font-monospace text-secondary">
                {form.smtp_host ? `${form.smtp_host}:${form.smtp_port}` : '—'}
              </div>
              <div className="small text-muted mt-1">
                {form.smtp_ssl ? 'SSL direct' : form.smtp_tls ? 'STARTTLS' : 'Sans chiffrement'} · {portLabel.split(' — ')[0]}
              </div>
            </div>
          </div>
        </div>
        <div className="col-6 col-lg-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="text-muted small text-uppercase fw-bold mb-1">Identifiants</div>
              <div className={`fw-bold ${hasPassword ? 'text-success' : 'text-danger'}`}>
                <i className={`bi ${hasPassword ? 'bi-shield-lock' : 'bi-shield-exclamation'} me-1`}></i>
                {hasPassword ? 'Mot de passe enregistré' : 'Aucun mot de passe'}
              </div>
              <div className="small text-muted mt-1">Chiffré en base, jamais renvoyé au navigateur.</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-lg-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="text-muted small text-uppercase fw-bold mb-1">Dernier test d’envoi</div>
              <div className={`fw-bold ${lastTest ? 'text-success' : 'text-muted'}`}>
                <i className={`bi ${lastTest ? 'bi-envelope-check' : 'bi-envelope-dash'} me-1`}></i>
                {lastTest ? new Date(lastTest).toLocaleString('fr-FR') : 'Jamais testé'}
              </div>
              <div className="small text-muted mt-1">Relancez un test après chaque modification.</div>
            </div>
          </div>
        </div>
      </div>

      {bloqueurs.length > 0 && (
        <div className="alert alert-warning py-2 mb-4">
          <div className="fw-bold mb-1">
            <i className="bi bi-exclamation-triangle me-1"></i>
            {bloqueurs.length} point(s) à corriger avant la mise en production :
          </div>
          <ul className="mb-0 small">
            {bloqueurs.map(c => (
              <li key={c.code}><strong>{c.label}</strong>{c.hint ? ` — ${c.hint}` : ''}</li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleSave} className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-white border-0 pt-4 px-4">
          <h5 className="fw-bold mb-1 text-secondary"><i className="bi bi-sliders2 me-2"></i>Fournisseur &amp; accès SMTP</h5>
          <p className="text-muted small mb-0">Choisissez un fournisseur : l’hôte, le port et le chiffrement sont préremplis automatiquement.</p>
        </div>
        <div className="card-body p-4">
          <div className="mb-4">
            <label className="form-label fw-semibold">Fournisseur d’envoi</label>
            <div className="row g-2">
              {Object.entries(presets.labels).map(([code, label]) => (
                <div className="col-12 col-md-4" key={code}>
                  <button
                    type="button"
                    className={`btn w-100 text-start ${form.provider === code ? 'btn-dark fw-bold' : 'btn-outline-secondary'}`}
                    onClick={() => applyProvider(code)}
                  >
                    <i className={`bi ${code === 'custom' ? 'bi-gear' : code === 'mailpit' ? 'bi-terminal' : 'bi-envelope-at'} me-2`}></i>
                    {label}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="row g-3 mb-4">
            <div className="col-md-6">
              <label className="form-label fw-semibold">Serveur SMTP (hôte) <span className="text-danger">*</span></label>
              <input className="form-control font-monospace" placeholder="smtp.gmail.com" value={form.smtp_host}
                onChange={e => setForm({ ...form, smtp_host: e.target.value })} required />
            </div>
            <div className="col-md-6">
              <label className="form-label fw-semibold">Port &amp; chiffrement <span className="text-danger">*</span></label>
              <select className="form-select" value={form.smtp_port}
                onChange={e => {
                  const port = Number(e.target.value)
                  // Le port pilote automatiquement le mode de chiffrement attendu.
                  setForm({ ...form, smtp_port: port, smtp_ssl: port === 465, smtp_tls: port === 587 || port === 2525 })
                }}>
                {PORTS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="row g-3 mb-4">
            <div className="col-md-6">
              <div className="form-check form-switch">
                <input className="form-check-input" type="checkbox" id="smtpTls" checked={form.smtp_tls}
                  onChange={e => setForm({ ...form, smtp_tls: e.target.checked, smtp_ssl: false })} />
                <label className="form-check-label fw-semibold" htmlFor="smtpTls">STARTTLS (port 587 — recommandé)</label>
              </div>
            </div>
            <div className="col-md-6">
              <div className="form-check form-switch">
                <input className="form-check-input" type="checkbox" id="smtpSsl" checked={form.smtp_ssl}
                  onChange={e => setForm({ ...form, smtp_ssl: e.target.checked, smtp_tls: false })} />
                <label className="form-check-label fw-semibold" htmlFor="smtpSsl">SSL direct (port 465)</label>
              </div>
            </div>
          </div>

          <div className="row g-3 mb-4">
            <div className="col-md-6">
              <label className="form-label fw-semibold">Utilisateur SMTP</label>
              <input className="form-control" placeholder="no-reply@votredomaine.com" value={form.smtp_user}
                onChange={e => setForm({ ...form, smtp_user: e.target.value })} />
              <div className="form-text">Souvent identique à l’adresse expéditrice.</div>
            </div>
            <div className="col-md-6">
              <label className="form-label fw-semibold">Mot de passe SMTP</label>
              <input className="form-control" type="password" autoComplete="new-password"
                placeholder={hasPassword ? '•••••••• (déjà enregistré — laisser vide pour conserver)' : 'Mot de passe d’application'}
                value={form.smtp_password} onChange={e => setForm({ ...form, smtp_password: e.target.value })} />
              <div className="form-text">
                {hasPassword
                  ? 'Chiffré en base : laissez vide pour conserver le mot de passe actuel.'
                  : 'Chiffré avant stockage, jamais renvoyé par l’API.'}
              </div>
            </div>
          </div>

          <div className="row g-3 mb-4">
            <div className="col-md-6">
              <label className="form-label fw-semibold">Adresse expéditrice <span className="text-danger">*</span></label>
              <input className="form-control" type="email" placeholder="no-reply@votredomaine.com" value={form.smtp_from_email}
                onChange={e => setForm({ ...form, smtp_from_email: e.target.value })} required />
            </div>
            <div className="col-md-6">
              <label className="form-label fw-semibold">Nom de l’expéditeur</label>
              <input className="form-control" value={form.smtp_from_name}
                onChange={e => setForm({ ...form, smtp_from_name: e.target.value })} />
            </div>
          </div>

          <div className="mb-4">
            <label className="form-label fw-semibold">URL frontend publique (liens des emails) <span className="text-danger">*</span></label>
            <input className="form-control font-monospace" placeholder="https://app.votredomaine.com" value={form.frontend_url}
              onChange={e => setForm({ ...form, frontend_url: e.target.value })} />
            <div className="form-text">
              Utilisée par la vérification d’email et la réinitialisation de mot de passe. En production, remplacez <code>localhost</code> par le domaine réel.
            </div>
          </div>

          <div className="d-flex flex-wrap gap-2">
            <button type="submit" className="btn btn-outline-primary fw-bold" disabled={saving}>
              {saving ? <span className="spinner-border spinner-border-sm me-2"></span> : <i className="bi bi-save me-2"></i>}
              {saving ? 'Enregistrement...' : 'Enregistrer et activer'}
            </button>
            <button type="button" className="btn btn-outline-secondary fw-bold" disabled={busy === 'draft'} onClick={() => runTest('draft')}>
              {busy === 'draft' ? <span className="spinner-border spinner-border-sm me-2"></span> : <i className="bi bi-plugin me-2"></i>}
              Tester ces valeurs (sans enregistrer)
            </button>
            <button type="button" className="btn btn-outline-danger fw-bold ms-auto" disabled={busy === 'reset' || !sourceBdd} onClick={handleReset}>
              {busy === 'reset' ? <span className="spinner-border spinner-border-sm me-2"></span> : <i className="bi bi-arrow-counterclockwise me-2"></i>}
              Revenir au .env
            </button>
          </div>
        </div>
      </form>

      <div className="row g-4">
        <div className="col-lg-5">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0 pt-4 px-4">
              <h5 className="fw-bold mb-1 text-secondary"><i className="bi bi-send-check me-2"></i>Test d’envoi réel</h5>
              <p className="text-muted small mb-0">Un email de test est envoyé immédiatement à l’adresse indiquée.</p>
            </div>
            <div className="card-body p-4">
              <label className="form-label fw-semibold">Adresse de réception du test</label>
              <input className="form-control mb-2" type="email" placeholder="votre.email@votredomaine.com"
                value={testEmail} onChange={e => setTestEmail(e.target.value)} />
              <div className="form-text mb-3">Utilisez une boîte réelle : le message part réellement sur le réseau.</div>
              <div className="d-flex flex-wrap gap-2">
                <button type="button" className="btn btn-outline-primary fw-bold" disabled={busy === 'active'} onClick={() => runTest('active')}>
                  {busy === 'active' ? <span className="spinner-border spinner-border-sm me-2"></span> : <i className="bi bi-envelope-arrow-up me-2"></i>}
                  Tester la config active
                </button>
                <button type="button" className="btn btn-outline-secondary fw-bold" disabled={busy === 'draft'} onClick={() => runTest('draft')}>
                  {busy === 'draft' ? <span className="spinner-border spinner-border-sm me-2"></span> : <i className="bi bi-plugin me-2"></i>}
                  Tester les valeurs saisies
                </button>
              </div>
              <div className="alert alert-light border mt-3 mb-0 small">
                <i className="bi bi-lightbulb me-1"></i>
                <strong>Mise en production sûre :</strong> « Tester les valeurs saisies » valide un nouveau serveur avant de l’enregistrer,
                puis « Enregistrer et activer » le met en service sans redéploiement.
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-7">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0 pt-4 px-4 d-flex justify-content-between align-items-center">
              <div>
                <h5 className="fw-bold mb-1 text-secondary"><i className="bi bi-clipboard2-check me-2"></i>Diagnostic de mise en production</h5>
                <p className="text-muted small mb-0">Contrôles appliqués à la configuration effective ({sourceBdd ? 'base de données' : '.env'}).</p>
              </div>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={refreshDiagnostics}>
                <i className="bi bi-arrow-clockwise me-1"></i>Actualiser
              </button>
            </div>
            <div className="card-body p-0">
              <div className="list-group list-group-flush">
                {checks.map(c => (
                  <div className="list-group-item d-flex align-items-start gap-2 py-3" key={c.code}>
                    <i className={`bi ${c.ok ? 'bi-check-circle-fill text-success' : c.required ? 'bi-x-circle-fill text-danger' : 'bi-dash-circle text-warning'} mt-1`}></i>
                    <div className="flex-grow-1">
                      <div className="fw-semibold">
                        {c.label}
                        {!c.required && <span className="badge bg-light text-dark border ms-2">recommandé</span>}
                      </div>
                      {c.hint && <div className="small text-muted">{c.hint}</div>}
                    </div>
                  </div>
                ))}
                {checks.length === 0 && (
                  <div className="list-group-item text-center text-muted py-4">Diagnostic indisponible.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {enAttente.length > 0 && (
        <div className="alert alert-info mt-4 mb-0 py-2 small">
          <i className="bi bi-info-circle me-1"></i>
          Recommandations non bloquantes : {enAttente.map(c => c.label).join(' · ')}.
        </div>
      )}

      <div className="card border-0 shadow-sm mt-4">
        <div className="card-header bg-white border-0 pt-4 px-4">
          <h5 className="fw-bold mb-1 text-secondary"><i className="bi bi-journal-code me-2"></i>Guide de mise en production</h5>
          <p className="text-muted small mb-0">Les six points à vérifier avant d’ouvrir la plateforme aux entreprises clientes.</p>
        </div>
        <div className="card-body p-4">
          <div className="row g-3">
            {GUIDE.map(etape => (
              <div className="col-md-6" key={etape.titre}>
                <div className="d-flex gap-3">
                  <div className="flex-shrink-0">
                    <span className="badge bg-dark rounded-circle p-2"><i className={`bi ${etape.icon}`}></i></span>
                  </div>
                  <div>
                    <div className="fw-bold text-secondary">{etape.titre}</div>
                    <div className="small text-muted">{etape.texte}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
