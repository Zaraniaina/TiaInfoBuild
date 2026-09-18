import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/stores/toast.store'
import { BrandLogo } from '@/components/brand/BrandLogo'

const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
})

type LoginFormData = z.infer<typeof loginSchema>

export function LoginForm() {
  const { loginUser } = useAuth()
  const { showToast } = useToast()
  const [isLoading, setIsLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true)
    try {
      await loginUser(data)
    } catch (err: unknown) {
      const status = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { status?: number; data?: { detail?: string } } }).response?.status
        : null
      const serverDetail = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
        : null

      if (status === 401) {
        showToast(
          'error',
          'Connexion échouée',
          serverDetail || 'Email ou mot de passe incorrect',
          6000,
        )
      } else if (status === 422) {
        showToast('error', 'Données invalides', 'Veuillez vérifier vos informations.', 6000)
      } else {
        showToast(
          'error',
          'Erreur de connexion',
          'Une erreur est survenue. Veuillez réessayer plus tard.',
          6000,
        )
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <BrandLogo size={72} />
          </div>
          <h1 className="visually-hidden">TIA INFO BUILD</h1>
          <p className="text-muted">Gestion BTP</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="mb-3">
            <label htmlFor="email" className="form-label">Email</label>
            <div className="input-group">
              <span className="input-group-text">
                <i className="bi bi-envelope"></i>
              </span>
              <input
                id="email"
                type="email"
                className="form-control"
                placeholder="votre@email.mg"
                {...register('email')}
              />
            </div>
            {errors.email && (
              <div className="text-danger mt-1 small">{errors.email.message}</div>
            )}
          </div>

          <div className="mb-4">
            <label htmlFor="password" className="form-label">Mot de passe</label>
            <div className="input-group">
              <span className="input-group-text">
                <i className="bi bi-lock"></i>
              </span>
              <input
                id="password"
                type="password"
                className="form-control"
                placeholder="********"
                {...register('password')}
              />
            </div>
            {errors.password && (
              <div className="text-danger mt-1 small">{errors.password.message}</div>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-tia-primary w-100 mb-3"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2"></span>
                Connexion...
              </>
            ) : (
              'Se connecter'
            )}
          </button>

          <div className="text-center">
            <small className="text-muted">
              (c) 2026 TIA Info Build
            </small>
          </div>
        </form>
      </div>
    </div>
  )
}
