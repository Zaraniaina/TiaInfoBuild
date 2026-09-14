import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { api } from '@/services/api'
import { formatErrorMessage } from '@/utils/errorMessage'
import { AuthVisualPanel } from '@/components/auth/AuthVisualPanel'

const forgotSchema = z.object({
  email: z.string().email('Veuillez saisir une adresse email invalide'),
})

type ForgotFormData = z.infer<typeof forgotSchema>

export function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotFormData>({
    resolver: zodResolver(forgotSchema),
  })

  const onSubmit = async (data: ForgotFormData) => {
    setServerError(null)
    setSuccessMessage(null)
    setLoading(true)
    try {
      const res = await api.post<{ message: string }>('/auth/forgot-password', {
        email: data.email,
      })
      setSuccessMessage(
        res.data.message ||
          "Si votre adresse email est enregistrée, un lien de réinitialisation vous a été envoyé."
      )
    } catch (err: unknown) {
      const msg = formatErrorMessage(
        err,
        "Erreur lors de la demande de réinitialisation."
      )
      setServerError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-shell">
      {/* Panneau visuel gauche */}
      <AuthVisualPanel
        eyebrow="Sécurité & Accès"
        title="Récupération sécurisée de votre accès."
        subtitle="Saisissez l'adresse email associée à votre compte d'entreprise pour recevoir un lien de réinitialisation."
        highlightedWord="sécurisée"
        stats={[
          { value: '100%', label: 'Sécurité SSL/TLS', icon: 'bi-shield-check' },
          { value: '30 min', label: 'Validité lien', icon: 'bi-clock-history' },
          { value: 'Mailpit', label: 'Service Mail Local', icon: 'bi-envelope-at' },
          { value: '2FA/JWT', label: 'Protection', icon: 'bi-lock' },
        ]}
      />

      {/* Formulaire de mot de passe oublié */}
      <div className="auth-form-side">
        <div className="auth-card">
          <div className="auth-card-header mb-4">
            <div className="eyebrow mb-2">Mot de passe oublié</div>
            <h1 className="auth-card-title">Réinitialisation</h1>
            <p className="auth-card-subtitle">
              Saisissez votre email professionnel pour recevoir les instructions.
            </p>
          </div>

          {serverError && (
            <div className="alert alert-danger auth-alert" role="alert">
              <i className="bi bi-exclamation-circle me-2"></i>
              {serverError}
            </div>
          )}

          {successMessage ? (
            <div className="text-center py-4">
              <div className="mb-3 text-success">
                <i className="bi bi-check-circle-fill display-4"></i>
              </div>
              <h5 className="fw-bold mb-2">Demande prise en compte !</h5>
              <p className="text-muted small mb-4">{successMessage}</p>
              <div className="alert alert-info py-2 px-3 text-start small mb-4">
                <i className="bi bi-info-circle me-2"></i>
                <strong>Environnement de développement :</strong> Les emails sont interceptés en local via Mailpit.
                Consultez l'interface Web Mailpit sur{' '}
                <a
                  href="http://localhost:8025"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="alert-link text-decoration-underline"
                >
                  http://localhost:8025
                </a>{' '}
                pour cliquer sur le lien de réinitialisation.
              </div>
              <Link to="/login" className="btn btn-auth-primary w-100 py-2.5 fw-bold">
                <i className="bi bi-arrow-left me-2"></i>Retour à la connexion
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="auth-form">
              <div className="auth-field mb-4">
                <label htmlFor="email" className="auth-label">
                  Adresse email
                </label>
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
                  <div className="auth-error">
                    <i className="bi bi-exclamation-triangle me-1"></i>
                    {errors.email.message}
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
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <i className="bi bi-send me-2"></i>Envoyer le lien
                  </>
                )}
              </button>
            </form>
          )}

          {!successMessage && (
            <div className="auth-footer mt-4 text-center">
              <p className="auth-footer-text">
                Vous vous souvenez de votre mot de passe ?{' '}
                <Link to="/login" className="auth-link">
                  Se connecter <i className="bi bi-arrow-right-short"></i>
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
