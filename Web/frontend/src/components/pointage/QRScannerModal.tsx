import React, { useState } from 'react'
import axios from 'axios'
import { useAuthStore } from '@/stores/auth.store'

interface QRScannerModalProps {
  isOpen: boolean
  onClose: () => void
  chantierId?: number
  onPointageSuccess?: (data: any) => void
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  chantierId,
  onPointageSuccess,
}) => {
  const [qrCodeInput, setQrCodeInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'danger' | 'info'; text: string } | null>(null)
  const [lastScanned, setLastScanned] = useState<any | null>(null)
  const { token } = useAuthStore()

  if (!isOpen) return null

  const handleScanSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!qrCodeInput.trim()) return

    setLoading(true)
    setStatusMessage(null)

    try {
      // Geoloc attempt
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

      const response = await axios.post(
        '/api/v1/rh/pointages/scan-badge',
        {
          code_qr_badge: qrCodeInput.trim(),
          chantier_id: chantierId || null,
          latitude: lat,
          longitude: lon,
          notes: 'Scan direct via Terminal Chef de Chantier',
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      const result = response.data
      setLastScanned(result)
      setStatusMessage({
        type: 'success',
        text: result.message || 'Pointage enregistré avec succès !',
      })
      setQrCodeInput('')
      if (onPointageSuccess) onPointageSuccess(result)
    } catch (err: any) {
      console.error(err)
      const detail = err.response?.data?.detail || 'Erreur lors de la validation du badge QR.'
      setStatusMessage({ type: 'danger', text: detail })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0, 0, 0, 0.7)' }} tabIndex={-1}>
      <div className="modal-dialog modal-dialog-centered modal-md">
        <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
          {/* Header */}
          <div className="modal-header bg-dark text-white border-bottom border-secondary border-opacity-25 px-4 py-3">
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
          <div className="modal-body p-4 bg-light">
            {/* Visual Scanner Camera Frame Simulation */}
            <div className="text-center p-4 rounded-4 mb-4 position-relative" style={{ background: '#0f172a', border: '2px dashed #38bdf8' }}>
              <div className="py-3">
                <i className="bi bi-camera-fill text-info display-4 d-block mb-2 opacity-75"></i>
                <span className="text-light fw-medium d-block" style={{ fontSize: '0.85rem' }}>
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

            {/* Confirmation du dernier pointage */}
            {lastScanned && lastScanned.employe && (
              <div className="card border-0 bg-white shadow-sm p-3 rounded-3 mb-3">
                <div className="d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center gap-3">
                    <div className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center fw-bold" style={{ width: '42px', height: '42px' }}>
                      {lastScanned.employe.prenom?.[0] || 'O'}
                    </div>
                    <div>
                      <div className="fw-bold text-dark">{lastScanned.employe.prenom} {lastScanned.employe.nom}</div>
                      <small className="text-muted" style={{ fontSize: '0.75rem' }}>{lastScanned.employe.poste} — Mat: {lastScanned.employe.matricule || 'N/A'}</small>
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
                <label className="form-label fw-bold small text-secondary">Code QR / Badge Ouvrier :</label>
                <div className="input-group">
                  <span className="input-group-text bg-white"><i className="bi bi-qr-code text-primary"></i></span>
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
          <div className="modal-footer bg-white border-top border-light px-4 py-3">
            <button type="button" className="btn btn-outline-secondary rounded-pill px-4" onClick={onClose}>
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
