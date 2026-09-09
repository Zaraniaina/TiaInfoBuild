import { useState, useCallback, type FormEvent } from 'react'
import { api } from '@/services/api'

interface PointageEmploye {
  prenom: string
  nom: string
  poste: string
  matricule?: string
}

interface ScanResult {
  message?: string
  employe?: PointageEmploye
  status?: 'entree_enregistree' | 'sortie_enregistree'
}

interface QRScannerModalProps {
  isOpen: boolean
  onClose: () => void
  chantierId?: number
  onPointageSuccess?: (data: ScanResult) => void
}

export function QRScannerModal({
  isOpen,
  onClose,
  chantierId,
  onPointageSuccess,
}: QRScannerModalProps) {
  const [qrCodeInput, setQrCodeInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'danger' | 'info'; text: string } | null>(null)
  const [lastScanned, setLastScanned] = useState<ScanResult | null>(null)

  const showGlobalToast = useCallback((text: string, type: 'success' | 'danger' | 'info' = 'info') => {
    try {
      const id = `tia-toast-${Date.now()}`
      const el = document.createElement('div')
      el.id = id
      el.style.position = 'fixed'
      el.style.right = '20px'
      el.style.top = '20px'
      el.style.zIndex = '2000'
      el.style.padding = '10px 14px'
      el.style.borderRadius = '8px'
      el.style.boxShadow = '0 6px 18px rgba(0,0,0,0.12)'
      el.style.fontSize = '0.95rem'
      el.style.transition = 'opacity 0.3s ease, transform 0.3s ease'
      el.style.opacity = '1'
      el.style.transform = 'translateY(0)'
      if (type === 'success') {
        el.style.background = '#1e7e34'
        el.style.color = '#fff'
      } else if (type === 'danger') {
        el.style.background = '#c82333'
        el.style.color = '#fff'
      } else {
        el.style.background = '#0d6efd'
        el.style.color = '#fff'
      }
      el.textContent = text
      document.body.appendChild(el)
      setTimeout(() => {
        el.style.opacity = '0'
        el.style.transform = 'translateY(-8px)'
        setTimeout(() => el.remove(), 350)
      }, 3500)
    } catch {
      // noop if DOM not available
    }
  }, [])

  const handleClose = useCallback(() => {
    setQrCodeInput('')
    setStatusMessage(null)
    setLastScanned(null)
    onClose()
  }, [onClose])

  if (!isOpen) return null

  const handleScanSubmit = async (e?: FormEvent) => {
    if (e) e.preventDefault()
    if (!qrCodeInput.trim()) return

    setLoading(true)
    setStatusMessage(null)

    try {
      let lat: number | null = null
      let lon: number | null = null
      if (navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 })
          )
          lat = pos.coords.latitude
          lon = pos.coords.longitude
        } catch {
          // Ignorer erreur geoloc si non dispo
        }
      }

      const response = await api.post(
        '/rh/pointages/scan-badge',
        {
          code_qr_badge: qrCodeInput.trim(),
          chantier_id: chantierId ?? null,
          latitude: lat,
          longitude: lon,
          notes: 'Scan direct via Terminal Chef de Chantier',
        }
      )

      const result = response.data as ScanResult
      setLastScanned(result)
      setStatusMessage({
        type: 'success',
        text: result?.message ?? 'Pointage enregistré avec succès !',
      })
      const toastText = result?.message ?? 'Pointage enregistré avec succès !'
      showGlobalToast(toastText, 'success')
      setQrCodeInput('')
      if (onPointageSuccess) onPointageSuccess(result)
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { detail?: string } } }
      console.error(err)
      const detail = errObj.response?.data?.detail ?? 'Erreur lors de la validation du badge QR.'
      setStatusMessage({ type: 'danger', text: detail })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal fade show" tabIndex={-1} aria-hidden={!isOpen} style={{ display: isOpen ? 'flex' : 'none' }}>
      <div className="modal-dialog modal-dialog-centered modal-md">
        <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
          {/* Header */}
          <div className="modal-header border-bottom border-secondary border-opacity-25 px-4 py-3" style={{ background: 'var(--tia-bg-base)', color: 'var(--tia-text-primary)' }}>
            <div className="d-flex align-items-center gap-2">
              <i className="bi bi-qr-code-scan fs-4 text-info"></i>
              <div>
                <h6 className="modal-title fw-bold mb-0">Terminal Scanner Chef de Chantier</h6>
                <small className="text-muted" style={{ fontSize: '0.75rem' }}>Scan express des badges d'ouvriers</small>
              </div>
            </div>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>

          {/* Body */}
          <div className="modal-body p-4" style={{ background: 'var(--tia-bg-raised)', color: 'var(--tia-text-primary)' }}>
            {/* Visual Scanner Camera Frame Simulation */}
            <div className="text-center p-4 rounded-4 mb-4 position-relative" style={{ background: 'var(--tia-bg-base)', border: '2px dashed var(--tia-accent)' }}>
              <div className="py-3">
                <i className="bi bi-camera-fill text-info display-4 d-block mb-2 opacity-75"></i>
                <span className="fw-medium d-block" style={{ fontSize: '0.85rem', color: 'var(--tia-text-secondary)' }}>
                  Prêt à scanner le badge QR de l'ouvrier
                </span>
                <small className="text-muted" style={{ fontSize: '0.72rem' }}>
                  Scannez via douchette/caméra ou saisissez le code ci-dessous
                </small>
              </div>
            </div>

            {statusMessage && (
              <div className={`alert alert-${statusMessage.type} d-flex align-items-center gap-2 rounded-3 shadow-sm py-2 px-3 mb-3`} role="alert">
                <i className={`bi bi-${statusMessage.type === 'success' ? 'check-circle-fill' : 'exclamation-triangle-fill'} fs-5`}></i>
                <div style={{ fontSize: '0.85rem' }}>{statusMessage.text}</div>
              </div>
            )}

            {lastScanned?.employe && (
              <div className="card border-0 shadow-sm p-3 rounded-3 mb-3" style={{ background: 'var(--tia-bg-surface)', color: 'var(--tia-text-primary)' }}>
                <div className="d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center gap-3">
                    <div className="rounded-circle d-flex align-items-center justify-content-center fw-bold" style={{ width: '42px', height: '42px', background: 'var(--tia-accent)', color: 'var(--tia-accent-text)' }}>
                      {lastScanned.employe.prenom.charAt(0) || 'O'}
                    </div>
                    <div>
                      <div className="fw-bold" style={{ color: 'var(--tia-text-primary)' }}>{lastScanned.employe.prenom} {lastScanned.employe.nom}</div>
                      <small className="text-muted" style={{ fontSize: '0.75rem' }}>{lastScanned.employe.poste} - Mat: {lastScanned.employe.matricule || 'N/A'}</small>
                    </div>
                  </div>
                  <span className={`badge ${lastScanned.status === 'entree_enregistree' ? 'bg-success' : 'bg-warning text-dark'}`}>
                    {lastScanned.status === 'entree_enregistree' ? 'ENTRÉE VALIDÉE' : 'SORTIE VALIDÉE'}
                  </span>
                </div>
              </div>
            )}

            {/* Input Form */}
            <form onSubmit={handleScanSubmit}>
              <div className="mb-3">
                <label className="form-label fw-bold small" style={{ color: 'var(--tia-text-primary)' }}>Code QR / Badge Ouvrier :</label>
                <div className="input-group">
                  <span className="input-group-text" style={{ background: 'var(--tia-bg-surface)', color: 'var(--tia-text-primary)' }}><i className="bi bi-qr-code text-primary"></i></span>
                  <input
                    type="text"
                    className="form-control form-control-lg fs-6"
                    placeholder="Ex: TIA-EMP-1-5-ABCD1234"
                    value={qrCodeInput}
                    onChange={(e) => setQrCodeInput(e.target.value)}
                    autoFocus
                  />
                  <button type="submit" className="btn btn-primary fw-bold px-4" disabled={loading || !qrCodeInput.trim()}>
                    {loading ? <span className="spinner-border spinner-border-sm me-1"></span> : <i className="bi bi-check2-circle me-1"></i>}
                    Valider
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Footer */}
          <div className="modal-footer border-top px-4 py-3" style={{ background: 'var(--tia-bg-surface)', borderColor: 'var(--tia-border)', color: 'var(--tia-text-primary)' }}>
            <button type="button" className="btn btn-outline-secondary rounded-pill px-4" onClick={handleClose}>
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
