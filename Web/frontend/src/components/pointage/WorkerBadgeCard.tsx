import React from 'react'
import { Employe } from '@/types'

interface WorkerBadgeCardProps {
  employe: Partial<Employe> & { code_qr_badge?: string }
  onPrint?: () => void
}

export const WorkerBadgeCard: React.FC<WorkerBadgeCardProps> = ({ employe, onPrint }) => {
  const qrCodeValue = employe.code_qr_badge || `TIA-EMP-1-${employe.id || 0}-REF`
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCodeValue)}`

  return (
    <div className="card border-0 shadow-sm rounded-4 overflow-hidden" style={{ maxWidth: '380px', margin: '0 auto', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#fff' }}>
      {/* Header Badge */}
      <div className="p-3 text-center border-bottom border-secondary border-opacity-25" style={{ background: 'rgba(255, 255, 255, 0.05)' }}>
        <div className="d-flex align-items-center justify-content-center gap-2">
          <div className="bg-primary text-white rounded-3 fw-bold px-2 py-1" style={{ fontSize: '0.8rem' }}>TIA BUILD</div>
          <span className="fw-bold tracking-wider text-uppercase" style={{ fontSize: '0.85rem', color: '#38bdf8' }}>BADGE OFFICIEL TERRAIN</span>
        </div>
      </div>

      {/* Body Badge */}
      <div className="p-4 text-center">
        {/* Photo / Avatar */}
        <div className="position-relative d-inline-block mb-3">
          {employe.photo ? (
            <img
              src={employe.photo}
              alt={employe.nom}
              className="rounded-circle border border-3 border-primary shadow"
              style={{ width: '88px', height: '88px', objectFit: 'cover' }}
            />
          ) : (
            <div
              className="rounded-circle border border-3 border-primary shadow d-flex align-items-center justify-content-center fw-bold fs-3 text-white bg-dark"
              style={{ width: '88px', height: '88px' }}
            >
              {employe.prenom?.[0] || 'O'}{employe.nom?.[0] || 'U'}
            </div>
          )}
          <span className="position-absolute bottom-0 end-0 bg-success border border-2 border-dark rounded-circle p-2" title="Statut Actif"></span>
        </div>

        {/* Nom & Poste */}
        <h5 className="fw-bold mb-1 text-white">{employe.prenom} {employe.nom}</h5>
        <div className="badge bg-info text-dark fw-semibold mb-3 px-3 py-1 text-uppercase" style={{ fontSize: '0.75rem' }}>
          {employe.poste || 'Ouvrier de Chantier'}
        </div>

        {/* Matricule & ID */}
        <div className="small text-muted mb-3 d-flex justify-content-center gap-3">
          <span>Matricule: <strong className="text-light">{employe.matricule || `EMP-${employe.id}`}</strong></span>
          <span>Contrat: <strong className="text-light">{employe.type_contrat || 'CDI'}</strong></span>
        </div>

        {/* QR Code Container */}
        <div className="bg-white p-3 rounded-3 d-inline-block shadow-sm mb-3">
          <img
            src={qrImageUrl}
            alt={`Badge QR ${employe.nom}`}
            style={{ width: '160px', height: '160px', display: 'block' }}
          />
        </div>

        <div className="text-muted" style={{ fontSize: '0.72rem' }}>
          <i className="bi bi-qr-code-scan me-1 text-info"></i>
          Scannez ce code avec l'application Chef de Chantier pour valider votre entrée / sortie.
        </div>
      </div>

      {/* Footer / Actions */}
      {onPrint && (
        <div className="p-3 bg-dark bg-opacity-50 text-center border-top border-secondary border-opacity-25">
          <button className="btn btn-outline-light btn-sm rounded-pill px-4 fw-semibold" onClick={onPrint}>
            <i className="bi bi-printer me-2"></i>Imprimer le Badge
          </button>
        </div>
      )}
    </div>
  )
}
