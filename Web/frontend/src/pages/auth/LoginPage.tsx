import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/hooks/useAuth'

const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
})

type LoginFormData = z.infer<typeof loginSchema>

export function LoginPage() {
  const { loginUser } = useAuth()
  const [serverError, setServerError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    setServerError(null)
    setIsLoading(true)
    try {
      await loginUser(data)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Connexion échouée'
      setServerError(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="auth-shell">
      {/* Panneau visuel gauche */}
      <div className="auth-visual blueprint-pattern text-white p-5 d-none d-lg-flex flex-column justify-content-between">
        <div className="d-flex align-items-center gap-2">
          <div
            className="mark"
            style={{
              background: 'var(--tia-amber)',
              color: 'var(--tia-navy)',
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
          <div className="eyebrow mb-2" style={{ color: 'var(--tia-amber)' }}>Plateforme de gestion BTP</div>
          <h2 className="font-display fw-bold mb-3" style={{ fontSize: '2rem', lineHeight: 1.15 }}>
            Un seul plan de suivi<br />pour tous vos chantiers.
          </h2>
          <p className="mb-0 text-white-50" style={{ maxWidth: '26rem' }}>
            Chantiers, ressources humaines, matériels, stocks et finances —
            pilotés depuis un tableau de bord unique, accessible du bureau au terrain.
          </p>
        </div>

        <div className="small text-white-50">© 2026 TIA INFO BUILD — Madagascar</div>
      </div>

      {/* Formulaire de connexion */}
      <div className="auth-form-side d-flex align-items-center justify-content-center p-4">
        <div className="auth-card w-100" style={{ maxWidth: '420px' }}>
          <div className="mb-4 text-center text-lg-start">
            <div className="eyebrow mb-1 text-primary">Espace de connexion</div>
            <h1 className="font-display fw-bold text-dark" style={{ fontSize: '1.6rem' }}>Bienvenue</h1>
            <p className="text-secondary mb-0">Connectez-vous pour accéder à votre espace local.</p>
          </div>

          {serverError && (
            <div className="alert alert-danger" role="alert">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="mb-3">
              <label htmlFor="email" className="form-label fw-semibold">Adresse email</label>
              <div className="input-group">
                <span className="input-group-text"><i className="bi bi-envelope"></i></span>
                <input
                  id="email"
                  type="email"
                  className="form-control"
                  placeholder="votre@email.com"
                  {...register('email')}
                />
              </div>
              {errors.email && (
                <div className="text-danger mt-1 small">{errors.email.message}</div>
              )}
            </div>

            <div className="mb-3">
              <label htmlFor="password" className="form-label fw-semibold">Mot de passe</label>
              <div className="input-group">
                <span className="input-group-text"><i className="bi bi-lock"></i></span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-control"
                  placeholder="••••••••"
                  {...register('password')}
                />
                <button
                  className="btn btn-outline-secondary"
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Afficher/masquer le mot de passe"
                >
                  <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                </button>
              </div>
              {errors.password && (
                <div className="text-danger mt-1 small">{errors.password.message}</div>
              )}
            </div>

            <div className="mb-3 d-flex align-items-center justify-content-between">
              <div className="form-check">
                <input className="form-check-input" type="checkbox" id="rememberMe" />
                <label className="form-check-label small text-secondary" htmlFor="rememberMe">Se souvenir de moi</label>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-tia-primary w-100 py-2 mt-1 fw-bold"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Connexion...
                </>
              ) : (
                <>
                  <i className="bi bi-box-arrow-in-right me-2"></i>Se connecter
                </>
              )}
            </button>
          </form>

          <div className="text-center mt-4 small">
            Pas encore d'entreprise ?{' '}
            <a href="/register" className="text-decoration-none fw-semibold" style={{ color: 'var(--tia-amber)' }}>
              Créer mon entreprise
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
