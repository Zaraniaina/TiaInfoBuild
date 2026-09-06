import { useState, useEffect, ReactNode } from 'react'

/** Badge de statut colore selon la valeur. */
export function StatutBadge({ statut }: { statut?: string }) {
  if (!statut) return null
  const couleurs: Record<string, string> = {
    nouvelle: 'bg-secondary',
    en_etude: 'bg-info',
    en_cours: 'bg-primary',
    traitee: 'bg-success',
    annulee: 'bg-dark',
    brouillon: 'bg-secondary',
    envoye: 'bg-info',
    accepte: 'bg-success',
    acceptee: 'bg-success',
    refuse: 'bg-danger',
    refusee: 'bg-danger',
    expire: 'bg-dark',
    actif: 'bg-success',
    active: 'bg-success',
    prepare: 'bg-secondary',
    termine: 'bg-dark',
    terminee: 'bg-dark',
    resilie: 'bg-danger',
    non_demarre: 'bg-secondary',
    suspendu: 'bg-warning text-dark',
    emise: 'bg-info',
    envoyee: 'bg-info',
    partiellement_payee: 'bg-warning text-dark',
    payee: 'bg-success',
    paye: 'bg-success',
    en_retard: 'bg-danger',
    validee: 'bg-success',
    rejetee: 'bg-danger',
    soumise: 'bg-info',
    signe: 'bg-success',
    lu: 'bg-secondary',
    non_lu: 'bg-primary',
  }
  return (
    <span className={`badge ${couleurs[statut] || 'bg-secondary'}`}>
      {statut.replace(/_/g, ' ')}
    </span>
  )
}

interface DetailModalProps {
  show: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'lg' | 'xl'
}

export function DetailModal({ show, onClose, title, children, footer, size }: DetailModalProps) {
  if (!show) return null
  const sizeClass = size ? `modal-${size}` : ''
  return (
    <>
      <div className="modal fade show d-block" style={{ display: 'block' }} tabIndex={-1} aria-modal="true" role="dialog">
        <div className={`modal-dialog modal-dialog-centered modal-dialog-scrollable ${sizeClass}`}>
          <div className="modal-content border-0 shadow">
            <div className="modal-header">
              <h5 className="modal-title">{title}</h5>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Fermer"></button>
            </div>
            <div className="modal-body">{children}</div>
            {footer && <div className="modal-footer">{footer}</div>}
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" onClick={onClose}></div>
    </>
  )
}

interface PageHeaderProps {
  titre: string
  icone: string
  sousTitre?: string
  actions?: ReactNode
}

export function PageHeader({ titre, icone, sousTitre, actions }: PageHeaderProps) {
  return (
    <div className="d-flex justify-content-between align-items-start mb-4">
      <div>
        <h4 className="fw-bold text-primary mb-0">
          <i className={`bi ${icone} me-2`}></i>{titre}
        </h4>
        {sousTitre && <p className="text-muted mt-1 mb-0">{sousTitre}</p>}
      </div>
      {actions}
    </div>
  )
}

interface ListePageState {
  loading: boolean
  error: string | null
}

export function useListePage<T>(charger: () => Promise<T[]>) {
  const [items, setItems] = useState<T[]>([])
  const [state, setState] = useState<ListePageState>({ loading: true, error: null })

  const recharger = async () => {
    try {
      setState({ loading: true, error: null })
      const result = await charger()
      setItems(result)
    } catch (err: any) {
      setState({ loading: false, error: err?.response?.data?.detail || 'Erreur lors du chargement' })
    } finally {
      setState((s) => ({ ...s, loading: false }))
    }
  }

  useEffect(() => {
    recharger()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { items, ...state, recharger }
}

export function EtatChargement() {
  return (
    <div className="d-flex justify-content-center py-5">
      <div className="spinner-border text-primary" role="status">
        <span className="visually-hidden">Chargement...</span>
      </div>
    </div>
  )
}

export function EtatErreur({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="alert alert-danger d-flex justify-content-between align-items-center">
      <span>{message}</span>
      {onRetry && (
        <button className="btn btn-outline-danger btn-sm" onClick={onRetry}>
          Reessayer
        </button>
      )}
    </div>
  )
}

export function Vide({ message }: { message: string }) {
  return (
    <div className="text-center text-muted py-5">
      <i className="bi bi-inbox display-4 d-block mb-2"></i>
      {message}
    </div>
  )
}

export function fmtMontant(v: any): string {
  const n = Number(v || 0)
  return n.toLocaleString('fr-FR') + ' Ar'
}

export function fmtDate(v: any): string {
  if (!v) return '-'
  try {
    return new Date(v).toLocaleDateString('fr-FR')
  } catch {
    return String(v)
  }
}
