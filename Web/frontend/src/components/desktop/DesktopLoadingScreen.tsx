import React from 'react'

interface DesktopLoadingScreenProps {
  message?: string
  subtext?: string
}

export const DesktopLoadingScreen: React.FC<DesktopLoadingScreenProps> = ({
  message = "Chargement de TIA INFO BUILD...",
  subtext = "Initialisation de l'environnement desktop offline-first"
}) => {
  return (
    <div 
      className="d-flex flex-column justify-content-center align-items-center vh-100 text-white select-none"
      style={{
        background: 'linear-[#0f172a], linear-gradient(135deg, #0b1329 0%, #1e293b 50%, #0f172a 100%)',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
      }}
    >
      <div 
        className="d-flex flex-column align-items-center p-5 rounded-4 shadow-lg border border-secondary border-opacity-25"
        style={{
          background: 'rgba(30, 41, 59, 0.75)',
          backdropFilter: 'blur(16px)',
          maxWidth: '440px',
          width: '90%'
        }}
      >
        {/* Logo de l'application */}
        <div className="mb-4 position-relative">
          <img 
            src="/logo-loading-dark.png" 
            alt="TIA INFO BUILD" 
            style={{ height: '72px', width: 'auto', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.4))' }}
            onError={(e) => {
              // Repli si l'image SVG/PNG alternative est utilisée
              (e.target as HTMLImageElement).src = '/favicon-32.png'
            }}
          />
        </div>

        {/* Indicateur de chargement stylisé */}
        <div className="my-3 position-relative d-flex justify-content-center align-items-center" style={{ width: '48px', height: '48px' }}>
          <div 
            className="spinner-border text-primary" 
            role="status"
            style={{ width: '44px', height: '44px', borderWidth: '3px', color: '#3b82f6' }}
          >
            <span className="visually-hidden">Chargement...</span>
          </div>
        </div>

        {/* Textes de statut */}
        <h5 className="fw-semibold mt-3 mb-1 text-center text-light fs-6 tracking-wide">
          {message}
        </h5>
        <p className="text-secondary small text-center mb-0 opacity-75 fs-7">
          {subtext}
        </p>

        {/* Badge mode hors-ligne */}
        <div className="mt-4 pt-2 border-top border-secondary border-opacity-25 w-100 text-center">
          <span className="badge bg-primary bg-opacity-10 text-info border border-info border-opacity-25 px-3 py-2 rounded-pill small fw-normal">
            <i className="bi bi-shield-check me-1"></i> Mode Desktop (SQLite Chiffré)
          </span>
        </div>
      </div>
    </div>
  )
}
