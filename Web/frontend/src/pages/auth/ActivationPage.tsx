import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { AuthVisualPanel } from '@/components/auth/AuthVisualPanel'
import { isDesktopBuild } from '@/utils/buildMode'
import { formatErrorMessage } from '@/utils/errorMessage'
import { bootDesktop } from '@/services/desktopClient'
import {
  activateDesktop,
  DesktopAuthError,
  DESKTOP_ACTIVATED_KEY,
} from '@/services/desktopAuth'

const activationSchema = z.object({
  email: z.string().email('Adresse email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
})

type ActivationFormData = z.infer<typeof activationSchema>

/**
 * Écran d'activation du poste desktop (plan §5.2) — 1ʳᵉ connexion ONLINE requis.
 * Monté uniquement en build desktop (route `/activation`, voir App.tsx).
 * Si le poste est déjà activé → redirige vers `/login`.
 */
export function ActivationPage() {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [verification, setVerification] = useState(true)
  const [dejaActive, setDejaActive] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<ActivationFormData>({
    resolver: zodResolver(activationSchema),
  })

  useEffect(() => {
    let annule = false
    const verifierActivation = async () => {
      let active = localStorage.getItem(DESKTOP_ACTIVATED_KEY) === '1'
      if (!active) {
        try {
          active = (await bootDesktop()).activated
        } catch {
          // Couche Rust pas encore prête : on suppose un poste non activé.
        }
      }
      if (!annule) {
        setDejaActive(active)
        setVerification(false)
      }
    }
    void verifierActivation()
    return () => {
      annule = true
    }
  }, [])

  const onSubmit = async (data: ActivationFormData) => {
    setServerError(null)
    setIsLoading(true)
    try {
      await activateDesktop(data.email, data.password)
      navigate('/app', { replace: true })
    } catch (err) {
      if (err instanceof DesktopAuthError && err.code === 'RESEAU_REQUIS') {
        setServerError('Une connexion Internet est requise pour la première activation.')
      } else if (err instanceof DesktopAuthError && err.code === 'IDENTIFIANTS_INVALIDES') {
        setServerError(err.detail)
      } else {
        setServerError(formatErrorMessage(err, "L'activation a échoué. Vérifiez votre connexion puis réessayez."))
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Route réservée au desktop : jamais montée dans le build web.
  if (!isDesktopBuild()) return <Navigate to="/login" replace />
  if (verification) {
    return (
      <div className="app-boot d-flex justify-content-center align-items-center vh-100 bg-light" role="status" aria-live="polite">
        <div className="spinner-border text-primary" aria-hidden="true"></div>
        <span className="visually-hidden">Vérification de l'activation…</span>
      </div>
    )
  }
  if (dejaActive) return <Navigate to="/login" replace />

  return (
    <div className="auth-shell">
      {/* Panneau visuel gauche */}
      <AuthVisualPanel
        eyebrow="Première connexion"
        title="Activez ce poste pour travailler hors-ligne."
        subtitle="L'activation vérifie vos identifiants auprès du serveur puis prépare la base locale : après cela, l'application fonctionne aussi sans connexion Internet."
        highlightedWord="hors-ligne."
        stats={[
          { value: '1×', label: 'Activation par poste', icon: 'bi-pc-display' },
          { value: '24/7', label: 'Travail hors-ligne', icon: 'bi-cloud-slash' },
          { value: '100%', label: 'Données synchronisées', icon: 'bi-arrow-repeat' },
        ]}
      />

      {/* Formulaire d'activation */}
      <div className="auth-form-side">
        <div className="auth-card">
          <div className="auth-card-header mb-4">
            <div className="eyebrow mb-2">Activation du poste</div>
            <h1 className="auth-card-title">Activer ce poste</h1>
            <p className="auth-card-subtitle">
              Connectez-vous avec vos identifiants TIA INFO BUILD pour initialiser la base locale.
            </p>
          </div>

          {serverError && (
            <div className="alert alert-danger auth-alert" role="alert">
              <i className="bi bi-exclamation-circle me-2"></i>
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="auth-form">
            <div className="auth-field">
              <label htmlFor="activation-email" className="auth-label">Adresse email</label>
              <div className="auth-input-group">
                <span className="auth-input-icon">
                  <i className="bi bi-envelope"></i>
                </span>
                <input
                  id="activation-email"
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
              <label htmlFor="activation-password" className="auth-label">Mot de passe</label>
              <div className="auth-input-group">
                <span className="auth-input-icon">
                  <i className="bi bi-lock"></i>
                </span>
                <input
                  id="activation-password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-control auth-input"
                  placeholder="********"
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

            <div className="auth-field mb-4">
              <div className="alert alert-info auth-alert mb-0 py-2" role="note">
                <i className="bi bi-globe me-2"></i>
                <em>
                  La création de compte entreprise et la réinitialisation de mot de passe
                  restent sur le web.
                </em>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-auth-primary w-100 py-2.5 fw-bold"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Activation...
                </>
              ) : (
                <>
                  <i className="bi bi-power me-2"></i>Activer
                </>
              )}
            </button>
          </form>

          <div className="auth-footer mt-4 text-center">
            <p className="auth-footer-text text-muted small mb-0">
              <i className="bi bi-info-circle me-1"></i>
              L'activation nécessite une connexion Internet. Une fois le poste activé,
              vous pourrez vous connecter hors-ligne.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
