import { useState } from 'react'

export function SuperAdminParametresPage() {
  const [form, setForm] = useState({
    nom_plateforme: 'TIA INFO BUILD',
    support_email: 'support@tiainfo.mg',
    mobile_money_enabled: true,
    devise_defaut: 'MGA',
    langues: 'fr,mg',
    maintenance_mode: false,
  })
  const [saving, setSaving] = useState(false)

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setTimeout(() => {
      alert('Paramètres plateforme enregistrés.')
      setSaving(false)
    }, 600)
  }

  return (
    <div className="container-fluid py-4">
      <div className="mb-4">
        <h2 className="fw-bold mb-1"><i className="bi bi-gear me-2 text-danger"></i>Paramètres Plateforme</h2>
        <p className="text-secondary mb-0">Configuration globale du SaaS, intégrations et fonctionnalités.</p>
      </div>

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

            <button type="submit" className="btn btn-danger fw-bold" disabled={saving}>
              {saving ? 'Enregistrement...' : 'Enregistrer les paramètres'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
