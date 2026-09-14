import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { api } from '@/services/api'
import { useToastStore } from '@/stores/toast.store'
import { formatErrorMessage } from '@/utils/errorMessage'
import { AuthVisualPanel } from '@/components/auth/AuthVisualPanel'

const passwordPolicy = z
  .string()
  .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
  .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins une majuscule')
  .regex(/[a-z]/, 'Le mot de passe doit contenir au moins une minuscule')
  .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre')
  .regex(/[^A-Za-z0-9]/, 'Le mot de passe doit contenir au moins un caractère spécial')

const resetSchema = z
  .object({
    new_password: passwordPolicy,
    confirm_password: z.string(),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: 'Les mots de passe ne correspondent pas.',
    path: ['confirm_password'],
  })

type ResetFormData = z.infer<typeof resetSchema>

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const navigate = useNavigate()

  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
  })

  const onSubmit = async (data: ResetFormData) => {
    if (!token) {
      setServerError('Token de réinitialisation manquant dans l\'URL.')
      return
    }
    setServerError(null)
    setLoading(true)
    try {
      await api.post('/auth/reset-password', {
        token,
        new_password: data.new_password,
        confirm_password: data.confirm_password,
      })
      useToastStore.getState().addToast({
        type: 'success',
        title: 'Mot de passe réinitialisé',
        message: 'Votre mot de passe a été mis à jour avec succès. Connectez-vous avec vos nouveaux identifiants.',
        duration: 5000,
      })
      navigate('/login')
    } catch (err: unknown) {
      const msg = formatErrorMessage(
        err,
        'Impossible de réinitialiser le mot de passe. Le lien a peut-être expiré.'
      )
      setServerError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="auth-shell">
        <AuthVisualPanel
          eyebrow="Sécurité TIA INFO BUILD"
          title="Lien invalide ou expiré."
          subtitle="Veuillez renouveler votre demande de réinitialisation."
          highlightedWord="invalide"
        />
        <div className="auth-form-side">
          <div className="auth-card text-center py-5">
            <i className="bi bi-exclamation-triangle display-3 text-warning mb-3"></i>
            <h3 className="fw-bold mb-2">Lien de réinitialisation manquant</h3>
            <p className="text-muted mb-4">
              Le jeton de sécurité est introuvable. Veuillez vérifier votre e-mail ou faire une nouvelle demande.
            </p>
            <Link to="/forgot-password" className="btn btn-auth-primary py-2.5 px-4 fw-bold">
              Faire une nouvelle demande
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-shell">
      {/* Panneau visuel gauche */}
      <AuthVisualPanel
        eyebrow="Nouveau Mot de Passe"
        title="Choisissez un mot de passe robuste."
        subtitle="Assurez la sécurité de votre compte entreprise et de vos accès de chantier."
        highlightedWord="robuste."
        stats={[
          { value: '8+ char', label: 'Longueur min.', icon: 'bi-key' },
          { value: 'A-Z, a-z', label: 'Casse requise', icon: 'bi-fonts' },
          { value: '0-9, #!$', label: 'Chiffres & symboles', icon: 'bi-shield-lock' },
        ]}
      />

      {/* Formulaire de nouveau mot de passe */}
      <div className="auth-form-side">
        <div className="auth-card">
          <div className="auth-card-header mb-4">
            <div className="eyebrow mb-2">Nouveau mot de passe</div>
            <h1 className="auth-card-title">Réinitialisation</h1>
            <p className="auth-card-subtitle">
              Saisissez et confirmez votre nouveau mot de passe ci-dessous.
            </p>
          </div>

          {serverError && (
            <div className="alert alert-danger auth-alert" role="alert">
              <i className="bi bi-exclamation-circle me-2"></i>
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="auth-form">
            <div className="auth-field mb-3">
              <label htmlFor="new_password" className="auth-label">
                Nouveau mot de passe *
              </label>
              <div className="auth-input-group">
                <span className="auth-input-icon">
                  <i className="bi bi-lock"></i>
                </span>
                <input
                  id="new_password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-control auth-input"
                  placeholder="********"
                  {...register('new_password')}
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle new password"
                >
                  <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                </button>
              </div>
              {errors.new_password && (
                <div className="auth-error">
                  <i className="bi bi-exclamation-triangle me-1"></i>
                  {errors.new_password.message}
                </div>
              )}
            </div>

            <div className="auth-field mb-4">
              <label htmlFor="confirm_password" className="auth-label">
                Confirmer le mot de passe *
              </label>
              <div className="auth-input-group">
                <span className="auth-input-icon">
                  <i className="bi bi-shield-lock"></i>
                </span>
                <input
                  id="confirm_password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="form-control auth-input"
                  placeholder="********"
                  {...register('confirm_password')}
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label="Toggle confirm password"
                >
                  <i className={`bi ${showConfirmPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                </button>
              </div>
              {errors.confirm_password && (
                <div className="auth-error">
                  <i className="bi bi-exclamation-triangle me-1"></i>
                  {errors.confirm_password.message}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-auth-primary w-100 py-2.5 fw-bold mb-3"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Mise à jour en cours...
                </>
              ) : (
                <>
                  <i className="bi bi-check2-circle me-2"></i>Valider le nouveau mot de passe
                </>
              )}
            </button>
          </form>

          <div className="auth-footer mt-4 text-center">
            <p className="auth-footer-text">
              Retourner à l'écran de connexion ?{' '}
              <Link to="/login" className="auth-link">
                Connexion <i className="bi bi-arrow-right-short"></i>
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
