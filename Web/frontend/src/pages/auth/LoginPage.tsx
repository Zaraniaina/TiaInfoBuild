import { useState } from 'react'
import { Link } from 'react-router-dom'
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
      <div className="auth-visual d-none d-lg-flex flex-column justify-content-between">
        <div className="d-flex align-items-center gap-3">
          <div className="mark">
            <i className="bi bi-building"></i>
          </div>
          <div>
            <div className="brand-name">TIA INFO BUILD</div>
            <div className="brand-sub">Plateforme BTP</div>
          </div>
        </div>

        <div className="auth-visual-content">
          <div className="eyebrow mb-3">Pilotage BTP</div>
          <h2 className="auth-visual-title">
            Un seul tableau de bord<br />
            pour tous vos chantiers.
          </h2>
          <p className="auth-visual-text">
            Chantiers, ressources humaines, matériels, stocks et finances —
            pilotés depuis un espace unique, accessible du bureau au terrain.
          </p>
          <div className="auth-visual-stats mt-4">
            <div className="auth-stat">
              <div className="auth-stat-value">100%</div>
              <div className="auth-stat-label">Suivi temps réel</div>
            </div>
            <div className="auth-stat">
              <div className="auth-stat-value">24/7</div>
              <div className="auth-stat-label">Accès sécurisé</div>
            </div>
            <div className="auth-stat">
              <div className="auth-stat-value">+50</div>
              <div className="auth-stat-label">Modules actifs</div>
            </div>
          </div>
        </div>

        <div className="small auth-visual-footer">© 2026 TIA INFO BUILD — Madagascar</div>
      </div>

      {/* Formulaire de connexion */}
      <div className="auth-form-side">
        <div className="auth-card">
          <div className="auth-card-header mb-4">
            <div className="eyebrow mb-2">Espace de connexion</div>
            <h1 className="auth-card-title">Bienvenue</h1>
            <p className="auth-card-subtitle">Connectez-vous pour accéder à votre espace de gestion BTP.</p>
          </div>

          {serverError && (
            <div className="alert alert-danger auth-alert" role="alert">
              <i className="bi bi-exclamation-circle me-2"></i>
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="auth-form">
            <div className="auth-field">
              <label htmlFor="email" className="auth-label">Adresse email</label>
              <div className="auth-input-group">
                <span className="auth-input-icon">
                  <i className="bi bi-envelope"></i>
                </span>
                <input
                  id="email"
                  type="email"
                  className="form-control auth-input"
                  placeholder="votre@email.com"
                  {...register('email')}
                />
              </div>
              {errors.email && (
                <div className="auth-error"><i className="bi bi-exclamation-triangle me-1"></i>{errors.email.message}</div>
              )}
            </div>

            <div className="auth-field">
              <label htmlFor="password" className="auth-label">Mot de passe</label>
              <div className="auth-input-group">
                <span className="auth-input-icon">
                  <i className="bi bi-lock"></i>
                </span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-control auth-input"
                  placeholder="••••••••"
                  {...register('password')}
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                </button>
              </div>
              {errors.password && (
                <div className="auth-error"><i className="bi bi-exclamation-triangle me-1"></i>{errors.password.message}</div>
              )}
            </div>

            <div className="auth-field d-flex align-items-center justify-content-between">
              <div className="form-check">
                <input className="form-check-input auth-checkbox" type="checkbox" id="rememberMe" />
                <label className="form-check-label auth-checkbox-label" htmlFor="rememberMe">
                  Se souvenir de moi
                </label>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-auth-primary w-100 py-2.5 fw-bold mt-1"
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

          <div className="auth-footer mt-4 text-center">
            <p className="auth-footer-text">
              Pas encore d’entreprise ?{' '}
              <Link to="/register" className="auth-link">
                Créer mon entreprise <i className="bi bi-arrow-right-short"></i>
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
