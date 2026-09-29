import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { api } from '@/services/api'
import { useToastStore } from '@/stores/toast.store'
import { formatErrorMessage } from '@/utils/errorMessage'
import { AuthVisualPanel } from '@/components/auth/AuthVisualPanel'
import { useSeo } from '@/hooks/useSeo'
import { registerSeo } from '@/utils/seo'

const passwordPolicy = z
  .string()
  .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
  .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins une majuscule')
  .regex(/[a-z]/, 'Le mot de passe doit contenir au moins une minuscule')
  .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre')
  .regex(/[^A-Za-z0-9]/, 'Le mot de passe doit contenir au moins un caractère spécial')

const registerSchema = z.object({
  nom_entreprise: z.string().min(2, 'Nom d\'entreprise requis'),
  entreprise_email: z.string().email('Email invalide').optional().or(z.literal('')),
  adresse: z.string().optional().or(z.literal('')),
  telephone: z.string().optional().or(z.literal('')),
  admin_prenom: z.string().min(1, 'Prénom requis'),
  admin_nom: z.string().min(1, 'Nom requis'),
  admin_email: z.string().email('Email invalide'),
  password: passwordPolicy,
  password_confirm: z.string()
}).refine((data) => data.password === data.password_confirm, {
  message: 'Les mots de passe ne correspondent pas.',
  path: ['password_confirm'],
})

type RegisterFormData = z.infer<typeof registerSchema>

function normalizePayload(data: RegisterFormData) {
  const payload: Record<string, unknown> = { ...data }
  for (const key of ['entreprise_email', 'adresse', 'telephone'] as const) {
    if (payload[key] === '') delete payload[key]
  }
  return payload
}

export function RegisterPage() {
  // SEO vitrine : page publique indexable (le formulaire reste fonctionnel, inchangé).
  useSeo(useMemo(() => registerSeo(), []))

  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null)

  const { register: registerField, handleSubmit, formState: { errors } } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  })

   const onSubmit = async (data: RegisterFormData) => {
    setError(null)
    setLoading(true)
    try {
      await api.post('/auth/register-entreprise', normalizePayload(data))
      setSubmittedEmail(data.admin_email)
      useToastStore.getState().addToast({
        type: 'success',
        title: 'Entreprise créée',
        message: 'Un email de confirmation a été envoyé à l\'adresse ' + data.admin_email + '.',
        duration: 6000,
      })
    } catch (err: unknown) {
      const msg = formatErrorMessage(err, 'Erreur lors de la création de l\'entreprise.')
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-shell">
      {/* Panneau Visuel Gauche */}
      <AuthVisualPanel
        eyebrow="Inscription Entreprise"
        title="Créez votre entreprise en quelques minutes."
        subtitle="Inscrivez votre entreprise pour piloter vos chantiers, vos équipes RH, vos matériels et vos finances depuis un espace unique et sécurisé."
        highlightedWord="entreprise"
        stats={[
          { value: '100%', label: 'Suivi temps réel', icon: 'bi-activity' },
          { value: '24/7', label: 'Accès sécurisé', icon: 'bi-shield-lock' },
          { value: '+50', label: 'Modules actifs', icon: 'bi-grid-3x3-gap' },
          { value: '99.9%', label: 'Disponibilité', icon: 'bi-speedometer2' },
        ]}
      />

      {/* Formulaire d'inscription */}
      <div className="auth-form-side">
        {submittedEmail ? (
          <div className="auth-card text-center py-4">
            <div className="mb-4">
              <div className="mx-auto rounded-circle bg-primary bg-opacity-10 p-3 d-inline-flex align-items-center justify-content-center" style={{ width: '80px', height: '80px' }}>
                <i className="bi bi-envelope-check-fill display-4 text-primary"></i>
              </div>
            </div>
            <h2 className="h3 fw-bold text-gray-900 mb-2">Vérifiez votre boîte mail !</h2>
            <p className="text-muted mb-4 fs-6">
              Un email de confirmation a été envoyé à <strong className="text-dark">{submittedEmail}</strong>.
              Veuillez cliquer sur le lien dans cet email pour valider votre compte administrateur avant de vous connecter.
            </p>
            <div className="alert alert-info border-0 shadow-sm rounded-3 text-start mb-4">
              <div className="d-flex align-items-center mb-1">
                <i className="bi bi-info-circle-fill text-info me-2 fs-5"></i>
                <strong className="text-gray-900">Email non reçu ?</strong>
              </div>
              <p className="small text-muted mb-0">
                Pensez à vérifier vos courriers indésirables (spams) ou la boîte Mailpit locale si vous êtes en environnement de développement.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="btn btn-auth-primary py-2.5 px-4 fw-bold w-100 mb-2"
            >
              <i className="bi bi-box-arrow-in-right me-2"></i>
              Aller à la page de connexion
            </button>
          </div>
        ) : (
          <div className="auth-card auth-card-wide">
            <div className="auth-card-header mb-4">
              <div className="eyebrow mb-2">Création de compte</div>
              <h1 className="auth-card-title">Inscrire votre entreprise</h1>
              <p className="auth-card-subtitle">Remplissez les informations ci-dessous pour créer votre espace administrateur.</p>
            </div>

            {error && (
              <div className="alert alert-danger auth-alert" role="alert">
                <i className="bi bi-exclamation-circle me-2"></i>
                {error}
              </div>
            )}

          <form onSubmit={handleSubmit(onSubmit)} className="auth-form">
            <div className="auth-section-label mb-2">Informations Entreprise</div>

            <div className="auth-field">
              <label htmlFor="nom_entreprise" className="auth-label">Nom de l'entreprise *</label>
              <div className="auth-input-group">
                <span className="auth-input-icon"><i className="bi bi-building"></i></span>
                <input
                  id="nom_entreprise"
                  type="text"
                  className="form-control auth-input"
                  placeholder="Ex: BTP Océan Indien"
                  {...registerField('nom_entreprise')}
                />
              </div>
              {errors.nom_entreprise && (
                <div className="auth-error"><i className="bi bi-exclamation-triangle me-1"></i>{errors.nom_entreprise.message}</div>
              )}
            </div>

            <div className="auth-field">
              <label htmlFor="entreprise_email" className="auth-label">Email professionnel de l'entreprise</label>
              <div className="auth-input-group">
                <span className="auth-input-icon"><i className="bi bi-envelope"></i></span>
                <input
                  id="entreprise_email"
                  type="email"
                  className="form-control auth-input"
                  placeholder="contact@entreprise.mg"
                  {...registerField('entreprise_email')}
                />
              </div>
            </div>

            <div className="row g-3 mb-3">
              <div className="col-12 col-sm-6">
                <div className="auth-field mb-0">
                  <label htmlFor="adresse" className="auth-label">Adresse siège</label>
                  <div className="auth-input-group">
                    <span className="auth-input-icon"><i className="bi bi-geo-alt"></i></span>
                    <input
                      id="adresse"
                      type="text"
                      className="form-control auth-input"
                      placeholder="Antananarivo"
                      {...registerField('adresse')}
                    />
                  </div>
                </div>
              </div>
              <div className="col-12 col-sm-6">
                <div className="auth-field mb-0">
                  <label htmlFor="telephone" className="auth-label">Téléphone</label>
                  <div className="auth-input-group">
                    <span className="auth-input-icon"><i className="bi bi-telephone"></i></span>
                    <input
                      id="telephone"
                      type="text"
                      className="form-control auth-input"
                      placeholder="+261 34 00 000 00"
                      {...registerField('telephone')}
                    />
                  </div>
                </div>
              </div>
            </div>

            <hr className="auth-divider" />

            <div className="auth-section-label mb-2">Administrateur du compte</div>

            <div className="row g-3 mb-3">
              <div className="col-12 col-sm-6">
                <div className="auth-field mb-0">
                  <label htmlFor="admin_prenom" className="auth-label">Prénom *</label>
                  <div className="auth-input-group">
                    <span className="auth-input-icon"><i className="bi bi-person"></i></span>
                    <input
                      id="admin_prenom"
                      type="text"
                      className="form-control auth-input"
                      placeholder="Jean"
                      {...registerField('admin_prenom')}
                    />
                  </div>
                  {errors.admin_prenom && (
                    <div className="auth-error"><i className="bi bi-exclamation-triangle me-1"></i>{errors.admin_prenom.message}</div>
                  )}
                </div>
              </div>
              <div className="col-12 col-sm-6">
                <div className="auth-field mb-0">
                  <label htmlFor="admin_nom" className="auth-label">Nom *</label>
                  <div className="auth-input-group">
                    <span className="auth-input-icon"><i className="bi bi-person-badge"></i></span>
                    <input
                      id="admin_nom"
                      type="text"
                      className="form-control auth-input"
                      placeholder="Rakoto"
                      {...registerField('admin_nom')}
                    />
                  </div>
                  {errors.admin_nom && (
                    <div className="auth-error"><i className="bi bi-exclamation-triangle me-1"></i>{errors.admin_nom.message}</div>
                  )}
                </div>
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="admin_email" className="auth-label">Email de connexion de l'administrateur *</label>
              <div className="auth-input-group">
                <span className="auth-input-icon"><i className="bi bi-envelope-at"></i></span>
                <input
                  id="admin_email"
                  type="email"
                  className="form-control auth-input"
                  placeholder="admin@entreprise.mg"
                  {...registerField('admin_email')}
                />
              </div>
              {errors.admin_email && (
                <div className="auth-error"><i className="bi bi-exclamation-triangle me-1"></i>{errors.admin_email.message}</div>
              )}
            </div>

            <div className="row g-3 mb-3">
              <div className="col-12 col-sm-6">
                <div className="auth-field mb-0">
                  <label htmlFor="password" className="auth-label">Mot de passe *</label>
                  <div className="auth-input-group">
                    <span className="auth-input-icon"><i className="bi bi-lock"></i></span>
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      className="form-control auth-input"
                      placeholder="********"
                      {...registerField('password')}
                    />
                    <button
                      type="button"
                      className="auth-password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label="Toggle password"
                    >
                      <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                    </button>
                  </div>
                  {errors.password && (
                    <div className="auth-error"><i className="bi bi-exclamation-triangle me-1"></i>{errors.password.message}</div>
                  )}
                </div>
              </div>
              <div className="col-12 col-sm-6">
                <div className="auth-field mb-0">
                  <label htmlFor="password_confirm" className="auth-label">Confirmation *</label>
                  <div className="auth-input-group">
                    <span className="auth-input-icon"><i className="bi bi-shield-lock"></i></span>
                    <input
                      id="password_confirm"
                      type={showConfirmPassword ? 'text' : 'password'}
                      className="form-control auth-input"
                      placeholder="********"
                      {...registerField('password_confirm')}
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
                  {errors.password_confirm && (
                    <div className="auth-error"><i className="bi bi-exclamation-triangle me-1"></i>{errors.password_confirm.message}</div>
                  )}
                </div>
              </div>
            </div>

            <button type="submit" className="btn btn-auth-primary w-100 py-2.5 fw-bold mt-3" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Création de votre entreprise...
                </>
              ) : (
                <>
                  <i className="bi bi-rocket-takeoff me-2"></i>Créer mon entreprise
                </>
              )}
            </button>
          </form>

          <div className="auth-footer mt-4 text-center">
            <p className="auth-footer-text">
              Vous avez déjà un compte ?{' '}
              <Link to="/login" className="auth-link">
                Se connecter <i className="bi bi-arrow-right-short"></i>
              </Link>
            </p>
          </div>
        </div>
      )}
    </div>
  </div>
)
}
