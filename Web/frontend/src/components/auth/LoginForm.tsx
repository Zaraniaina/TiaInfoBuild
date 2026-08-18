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

export function LoginForm() {
  const { loginUser } = useAuth()
  const [serverError, setServerError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

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
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <i className="bi bi-building"></i>
          </div>
          <h1>TIA INFO BUILD</h1>
          <p className="text-muted">Gestion BTP</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          {serverError && (
            <div className="alert alert-danger" role="alert">
              {serverError}
            </div>
          )}

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
                placeholder="••••••••"
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
              © 2026 TIA Info Build
            </small>
          </div>
        </form>
      </div>
    </div>
  )
}
