import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/services/api'

export function RegisterPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    nom_entreprise: '',
    entreprise_email: '',
    adresse: '',
    telephone: '',
    admin_prenom: '',
    admin_nom: '',
    admin_email: '',
    password: '',
    password_confirm: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (form.password !== form.password_confirm) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }

    setLoading(true)
    try {
      await api.post('/auth/register-entreprise', form)
      alert('Entreprise créée avec succès ! Connectez-vous.')
      navigate('/login')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erreur lors de la création de l\'entreprise.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-visual blueprint-pattern text-white p-5 d-none d-lg-flex flex-column justify-content-between">
        <div className="d-flex align-items-center gap-2">
          <div
            className="mark"
            style={{
              background: 'var(--tia-accent)',
              color: 'var(--tia-accent-text)',
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-display)',
              fontWeight: 800
            }}
          >
            TB
          </div>
          <div className="font-display fw-bold fs-5">TIA INFO BUILD</div>
        </div>

        <div>
          <div className="eyebrow mb-2" style={{ color: 'var(--tia-accent)' }}>
            Création de compte entreprise
          </div>
          <h2 className="font-display fw-bold mb-3" style={{ fontSize: '2rem', lineHeight: 1.15 }}>
            Créez votre entreprise en 1 minute,<br />
            vous gérez le reste depuis votre espace local.
          </h2>
            <p className="mb-0" style={{ maxWidth: '26rem', opacity: 0.7 }}>
            Inscrivez votre entreprise et devenez administrateur.
            Vous pourrez ensuite ajouter vos employés, créer des chantiers,
            gérer vos matériels et suivre vos finances — le tout depuis un espace sécurisé.
          </p>
        </div>

        <div className="small" style={{ opacity: 0.7 }}>© 2026 TIA INFO BUILD — Madagascar</div>
      </div>

      <div className="auth-form-side d-flex align-items-center justify-content-center p-4 overflow-auto">
        <div className="auth-card w-100 py-3" style={{ maxWidth: '480px' }}>
          <div className="mb-4 text-center text-lg-start">
            <div className="eyebrow mb-1 text-primary">Créer une entreprise</div>
            <h1 className="font-display fw-bold text-dark" style={{ fontSize: '1.6rem' }}>Inscription</h1>
            <p className="text-secondary mb-0">Créez votre compte administrateur en même temps que votre entreprise.</p>
          </div>

          {error && <div className="alert alert-danger" role="alert">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="eyebrow mb-2 text-primary" style={{ fontSize: '0.65rem' }}>ENTREPRISE</div>

            <div className="mb-3">
              <label className="form-label fw-semibold">Nom de l'entreprise *</label>
              <input
                type="text"
                className="form-control"
                required
                value={form.nom_entreprise}
                onChange={e => setForm({ ...form, nom_entreprise: e.target.value })}
              />
            </div>

            <div className="mb-3">
              <label className="form-label fw-semibold">Email de l'entreprise</label>
              <input
                type="email"
                className="form-control"
                value={form.entreprise_email}
                onChange={e => setForm({ ...form, entreprise_email: e.target.value })}
              />
            </div>

            <div className="row g-2 mb-3">
              <div className="col-6">
                <label className="form-label fw-semibold">Adresse</label>
                <input
                  type="text"
                  className="form-control"
                  value={form.adresse}
                  onChange={e => setForm({ ...form, adresse: e.target.value })}
                />
              </div>
              <div className="col-6">
                <label className="form-label fw-semibold">Téléphone</label>
                <input
                  type="text"
                  className="form-control"
                  value={form.telephone}
                  onChange={e => setForm({ ...form, telephone: e.target.value })}
                />
              </div>
            </div>

            <hr style={{ borderColor: 'var(--tia-border)', margin: '1.5rem 0' }} />

            <div className="eyebrow mb-2 text-primary" style={{ fontSize: '0.65rem' }}>RESPONSABLE (ADMINISTRATEUR)</div>

            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label className="form-label fw-semibold">Prénom *</label>
                <input
                  type="text"
                  className="form-control"
                  required
                  value={form.admin_prenom}
                  onChange={e => setForm({ ...form, admin_prenom: e.target.value })}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold">Nom *</label>
                <input
                  type="text"
                  className="form-control"
                  required
                  value={form.admin_nom}
                  onChange={e => setForm({ ...form, admin_nom: e.target.value })}
                />
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label fw-semibold">Email du responsable *</label>
              <input
                type="email"
                className="form-control"
                required
                value={form.admin_email}
                onChange={e => setForm({ ...form, admin_email: e.target.value })}
              />
            </div>

            <div className="row g-2 mb-3">
              <div className="col-6">
                <label className="form-label fw-semibold">Mot de passe *</label>
                <input
                  type="password"
                  className="form-control"
                  required
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                />
              </div>
              <div className="col-6">
                <label className="form-label fw-semibold">Confirmation *</label>
                <input
                  type="password"
                  className="form-control"
                  required
                  value={form.password_confirm}
                  onChange={e => setForm({ ...form, password_confirm: e.target.value })}
                />
              </div>
            </div>

            <button type="submit" className="btn btn-tia-primary w-100 py-2 mt-2 fw-bold" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Création...
                </>
              ) : (
                <>
                  <i className="bi bi-rocket me-2"></i>Créer mon entreprise
                </>
              )}
            </button>
          </form>

          <div className="text-center mt-3 small">
            Vous avez déjà un compte ?{' '}
            <a href="/login" className="text-decoration-none fw-semibold" style={{ color: 'var(--tia-accent)' }}>
              Se connecter
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
