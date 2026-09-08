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

// eslint-disable-next-line react-refresh/only-export-components
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
    return (
      <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Chargement...</span>
        </div>
      </div>
    )
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
