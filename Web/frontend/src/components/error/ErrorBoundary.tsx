import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Erreur capturée:', error)
    console.error('[ErrorBoundary] Stack trace:', errorInfo.componentStack)
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  handleGoHome = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user_info')
    window.location.href = '/login'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
          <div className="text-center p-5 bg-white rounded-3 shadow-sm" style={{ maxWidth: '500px' }}>
            <div className="mb-4">
              <i className="bi bi-exclamation-triangle-fill text-danger" style={{ fontSize: '3rem' }}></i>
            </div>
            <h3 className="mb-3 fw-bold text-secondary">Une erreur est survenue</h3>
            <p className="text-muted mb-4">
              L'application a rencontré un problème inattendu.
              Veuillez recharger la page ou vous reconnecter.
            </p>
            { import.meta.env.DEV && this.state.error && (
              <div className="alert alert-danger text-start small mb-4">
                <strong>Erreur :</strong> {this.state.error.message}
              </div>
            )}
            <div className="d-flex gap-2 justify-content-center">
              <button className="btn btn-primary" onClick={this.handleReload}>
                <i className="bi bi-arrow-clockwise me-2"></i>Recharger
              </button>
              <button className="btn btn-outline-secondary" onClick={this.handleGoHome}>
                <i className="bi bi-box-arrow-right me-2"></i>Se déconnecter
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
