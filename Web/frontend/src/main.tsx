import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from './stores/auth.store'
import { useToastStore } from '@/stores/toast.store'
import { api } from './services/api'
import App from './App'
import { ToastContainer } from '@/components/ui/ToastContainer'
import { ErrorBoundary } from '@/components/error/ErrorBoundary'
import './styles/index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
    },
  },
})

// Fallback de chargement avec timeout
function LoadingFallback() {
  const [showTimeout, setShowTimeout] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setShowTimeout(true), 10000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="app-boot d-flex justify-content-center align-items-center vh-100" role="status" aria-live="polite" aria-busy="true">
      <div className="text-center">
        <img
          className="loading-logo loading-logo-light"
          src="/logo-loading-light.png"
          alt="TIA INFO BUILD"
          width={88}
          height={88}
        />
        <img
          className="loading-logo loading-logo-dark"
          src="/logo-loading-dark.png"
          alt=""
          aria-hidden="true"
          width={88}
          height={88}
        />
        <div className="loading-bar" aria-hidden="true">
          <div className="loading-bar-fill" />
        </div>
        <p className="loading-msg">Chargement de l'application…</p>
        {showTimeout && (
          <>
            <p className="loading-msg">Le chargement prend plus de temps que prévu.</p>
            <button className="btn btn-primary btn-sm" onClick={() => window.location.reload()}>
              Recharger la page
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function Root() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const bootstrap = async () => {
      const { token, setUser, logout } = useAuthStore.getState()
      if (!token) {
        setReady(true)
        return
      }
      try {
        const { data } = await api.get('/auth/me')
        if (data?.user) setUser(data.user)
      } catch (err) {
        console.error('[Root] /auth/me failed:', err)
        useToastStore.getState().addToast({
          type: 'error',
          title: 'Session expirée',
          message: 'Veuillez vous reconnecter.',
          duration: 5000,
        })
        logout()
      } finally {
        setReady(true)
      }
    }
    bootstrap()
  }, [])

  if (!ready) {
    return <LoadingFallback />
  }

  return (
    <StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <App />
            <ToastContainer />
          </BrowserRouter>
        </QueryClientProvider>
      </ErrorBoundary>
    </StrictMode>
  )
}

createRoot(document.getElementById('root')!).render(<Root />)
