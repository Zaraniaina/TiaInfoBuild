import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { api } from '@/services/api'

// Politique de mot de passe alignée sur le backend (RegisterEntrepriseRequest) :
// 8 caractères minimum + au moins une majuscule, une minuscule, un chiffre et un caractère spécial.
const passwordPolicy = z
  .string()
  .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
  .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins une majuscule')
  .regex(/[a-z]/, 'Le mot de passe doit contenir au moins une minuscule')
  .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre')
  .regex(/[^A-Za-z0-9]/, 'Le mot de passe doit contenir au moins un caractère spécial')

const registerSchema = z.object({
  nom_entreprise: z.string().min(2, 'Nom d\'entreprise requis'),
  // Email entreprise optionnel : on accepte une chaîne vide (sera normalisée en undefined avant l'envoi)
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

// Normalise les champs optionnels : une chaîne vide est transformée en `undefined`
// pour que le backend (EmailStr | None) ne rejette pas la requête avec une erreur 422.
function normalizePayload(data: RegisterFormData) {
  const payload: Record<string, unknown> = { ...data }
  for (const key of ['entreprise_email', 'adresse', 'telephone'] as const) {
    if (payload[key] === '') delete payload[key]
  }
  return payload
}

export function RegisterPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { register: registerField, handleSubmit, formState: { errors } } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  })

  const onSubmit = async (data: RegisterFormData) => {
    setError(null)
    setLoading(true)
    try {
      // On envoie un payload normalisé (pas de chaînes vides) pour éviter les erreurs 422 du backend
      await api.post('/auth/register-entreprise', normalizePayload(data))
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
      <div className="auth-visual d-none d-lg-flex flex-column justify-content-between">
        <div className="d-flex align-items-center gap-3">
          <div className="mark">
            <i className="bi bi-building"></i>
          </div>
          <div>
            <div className="brand-name">TIA INFO BUILD</div>
            <div className="brand-sub">Création de compte</div>
          </div>
        </div>

        <div className="auth-visual-content">
          <div className="eyebrow mb-3">Inscription</div>
          <h2 className="auth-visual-title">
            Créez votre entreprise<br />
            en quelques minutes.
          </h2>
          <p className="auth-visual-text">
            Inscrivez votre entreprise et devenez administrateur.
            Ajoutez vos employés, créez vos chantiers et gérez vos matériels
            depuis un espace sécurisé.
          </p>
        </div>

        <div className="small auth-visual-footer">© 2026 TIA INFO BUILD — Madagascar</div>
      </div>

      <div className="auth-form-side">
        <div className="auth-card">
          <div className="auth-card-header mb-4">
            <div className="eyebrow mb-2">Inscription</div>
            <h1 className="auth-card-title">Créer une entreprise</h1>
            <p className="auth-card-subtitle">Remplissez les informations pour créer votre compte administrateur.</p>
          </div>

          {error && (
            <div className="alert alert-danger auth-alert" role="alert">
              <i className="bi bi-exclamation-circle me-2"></i>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="auth-form">
            <div className="auth-section-label mb-2">Entreprise</div>

            <div className="auth-field">
              <label htmlFor="nom_entreprise" className="auth-label">Nom de l'entreprise *</label>
              <div className="auth-input-group">
                <span className="auth-input-icon"><i className="bi bi-building"></i></span>
                <input id="nom_entreprise" type="text" className="form-control auth-input" placeholder="Nom de votre entreprise" {...registerField('nom_entreprise')} />
              </div>
              {errors.nom_entreprise && (
                <div className="auth-error"><i className="bi bi-exclamation-triangle me-1"></i>{errors.nom_entreprise.message}</div>
              )}
            </div>

            <div className="auth-field">
              <label htmlFor="entreprise_email" className="auth-label">Email de l'entreprise</label>
              <div className="auth-input-group">
                <span className="auth-input-icon"><i className="bi bi-envelope"></i></span>
                <input id="entreprise_email" type="email" className="form-control auth-input" placeholder="contact@entreprise.mg" {...registerField('entreprise_email')} />
              </div>
            </div>

            <div className="row g-2 mb-3">
              <div className="col-6">
                <div className="auth-field">
                  <label htmlFor="adresse" className="auth-label">Adresse</label>
                  <div className="auth-input-group">
                    <span className="auth-input-icon"><i className="bi bi-geo-alt"></i></span>
                    <input id="adresse" type="text" className="form-control auth-input" placeholder="Antananarivo" {...registerField('adresse')} />
                  </div>
                </div>
              </div>
              <div className="col-6">
                <div className="auth-field">
                  <label htmlFor="telephone" className="auth-label">Téléphone</label>
                  <div className="auth-input-group">
                    <span className="auth-input-icon"><i className="bi bi-telephone"></i></span>
                    <input id="telephone" type="text" className="form-control auth-input" placeholder="+261 34 00 000 00" {...registerField('telephone')} />
                  </div>
                </div>
              </div>
            </div>

            <hr className="auth-divider" />

            <div className="auth-section-label mb-2">Responsable (Administrateur)</div>

            <div className="row g-2 mb-3">
              <div className="col-6">
                <div className="auth-field">
                  <label htmlFor="admin_prenom" className="auth-label">Prénom *</label>
                  <div className="auth-input-group">
                    <span className="auth-input-icon"><i className="bi bi-person"></i></span>
                    <input id="admin_prenom" type="text" className="form-control auth-input" placeholder="Jean" {...registerField('admin_prenom')} />
                  </div>
                  {errors.admin_prenom && (
                    <div className="auth-error"><i className="bi bi-exclamation-triangle me-1"></i>{errors.admin_prenom.message}</div>
                  )}
                </div>
              </div>
              <div className="col-6">
                <div className="auth-field">
                  <label htmlFor="admin_nom" className="auth-label">Nom *</label>
                  <div className="auth-input-group">
                    <span className="auth-input-icon"><i className="bi bi-person-badge"></i></span>
                    <input id="admin_nom" type="text" className="form-control auth-input" placeholder="Rakoto" {...registerField('admin_nom')} />
                  </div>
                  {errors.admin_nom && (
                    <div className="auth-error"><i className="bi bi-exclamation-triangle me-1"></i>{errors.admin_nom.message}</div>
                  )}
                </div>
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="admin_email" className="auth-label">Email du responsable *</label>
              <div className="auth-input-group">
                <span className="auth-input-icon"><i className="bi bi-envelope-at"></i></span>
                <input id="admin_email" type="email" className="form-control auth-input" placeholder="admin@entreprise.mg" {...registerField('admin_email')} />
              </div>
              {errors.admin_email && (
                <div className="auth-error"><i className="bi bi-exclamation-triangle me-1"></i>{errors.admin_email.message}</div>
              )}
            </div>

            <div className="row g-2 mb-3">
              <div className="col-6">
                <div className="auth-field">
                  <label htmlFor="password" className="auth-label">Mot de passe *</label>
                  <div className="auth-input-group">
                    <span className="auth-input-icon"><i className="bi bi-lock"></i></span>
                    <input id="password" type="password" className="form-control auth-input" placeholder="••••••••" {...registerField('password')} />
                  </div>
                  {errors.password && (
                    <div className="auth-error"><i className="bi bi-exclamation-triangle me-1"></i>{errors.password.message}</div>
                  )}
                </div>
              </div>
              <div className="col-6">
                <div className="auth-field">
                  <label htmlFor="password_confirm" className="auth-label">Confirmation *</label>
                  <div className="auth-input-group">
                    <span className="auth-input-icon"><i className="bi bi-lock-fill"></i></span>
                    <input id="password_confirm" type="password" className="form-control auth-input" placeholder="••••••••" {...registerField('password_confirm')} />
                  </div>
                  {errors.password_confirm && (
                    <div className="auth-error"><i className="bi bi-exclamation-triangle me-1"></i>{errors.password_confirm.message}</div>
                  )}
                </div>
              </div>
            </div>

            <button type="submit" className="btn btn-auth-primary w-100 py-2.5 fw-bold mt-2" disabled={loading}>
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

          <div className="auth-footer mt-4 text-center">
            <p className="auth-footer-text">
              Vous avez déjà un compte ?{' '}
              <Link to="/login" className="auth-link">
                Se connecter <i className="bi bi-arrow-right-short"></i>
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
