import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from './stores/auth.store'
import { api } from './services/api'
import App from './App'
import './styles/index.css'
import { useEffect, useState } from 'react'

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
  const token = useAuthStore((s) => s.token)

  useEffect(() => {
    const bootstrap = async () => {
      const { setUser, logout } = useAuthStore.getState()
      if (!token) {
        setReady(true)
        return
      }
      try {
        const { data } = await api.get('/auth/me')
        if (data?.user) setUser(data.user)
      } catch {
        logout()
      } finally {
        setReady(true)
      }
    }
    bootstrap()
  }, [token])

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
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </StrictMode>
  )
}

createRoot(document.getElementById('root')!).render(<Root />)
