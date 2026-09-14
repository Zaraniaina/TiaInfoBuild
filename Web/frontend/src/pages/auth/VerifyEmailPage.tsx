import { useEffect, useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { api } from '@/services/api'
import { useToastStore } from '@/stores/toast.store'
import { formatErrorMessage } from '@/utils/errorMessage'
import { AuthVisualPanel } from '@/components/auth/AuthVisualPanel'

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [success, setSuccess] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      setMessage('Lien de confirmation invalide ou jeton manquant dans l\'URL.')
      return
    }

    let isMounted = true
    const verifyToken = async () => {
      try {
        const response = await api.get<{ message: string }>('/auth/verify-email', {
          params: { token },
        })
        if (isMounted) {
          setSuccess(true)
          setMessage(response.data.message || 'Votre email a été confirmé avec succès !')
          useToastStore.getState().addToast({
            type: 'success',
            title: 'Email confirmé',
            message: 'Votre compte est activé. Vous pouvez vous connecter dès maintenant.',
            duration: 6000,
          })
        }
      } catch (err: unknown) {
        if (isMounted) {
          setSuccess(false)
          const errorMsg = formatErrorMessage(
            err,
            'Le lien de confirmation est invalide ou a expiré.'
          )
          setMessage(errorMsg)
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    verifyToken()

    return () => {
      isMounted = false
    }
  }, [token])

  return (
    <div className="auth-shell">
      <AuthVisualPanel
        eyebrow="Confirmation d'Email"
        title="Activez votre compte d'entreprise."
        subtitle="Vérifiez votre adresse email pour débloquer l'accès sécurisé à votre espace d'administration BTP."
        highlightedWord="compte"
      />

      <div className="auth-form-side">
        <div className="auth-card text-center py-5">
          {loading ? (
            <div className="py-4">
              <div className="spinner-border text-primary mb-3" style={{ width: '3rem', height: '3rem' }} role="status">
                <span className="visually-hidden">Chargement...</span>
              </div>
              <h3 className="h4 fw-bold mb-2">Vérification en cours...</h3>
              <p className="text-muted mb-0">Nous validons votre adresse email avec le serveur.</p>
            </div>
          ) : success ? (
            <div className="py-3">
              <div className="mb-4">
                <i className="bi bi-check-circle-fill display-2 text-success"></i>
              </div>
              <h2 className="h3 fw-bold text-gray-900 mb-2">Email confirmé avec succès !</h2>
              <p className="text-muted mb-4 fs-6">
                {message || 'Votre compte d\'entreprise a été activé avec succès. Vous pouvez désormais vous connecter.'}
              </p>
              <div className="d-flex justify-content-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="btn btn-auth-primary py-2.5 px-4 fw-bold"
                >
                  <i className="bi bi-box-arrow-in-right me-2"></i>
                  Se connecter
                </button>
              </div>
            </div>
          ) : (
            <div className="py-3">
              <div className="mb-4">
                <i className="bi bi-exclamation-triangle-fill display-2 text-danger"></i>
              </div>
              <h2 className="h3 fw-bold text-gray-900 mb-2">Validation impossible</h2>
              <p className="text-danger-soft text-danger mb-4 fs-6">
                {message || 'Le lien de confirmation est invalide ou a expiré.'}
              </p>
              <div className="d-flex flex-column flex-sm-row justify-content-center gap-2">
                <Link to="/login" className="btn btn-auth-primary py-2.5 px-4 fw-bold">
                  <i className="bi bi-arrow-left me-2"></i>
                  Retour à la connexion
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
