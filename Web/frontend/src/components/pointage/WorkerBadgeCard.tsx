import React from 'react'
import { Employe } from '@/types'

interface WorkerBadgeCardProps {
  employe: Partial<Employe> & { code_qr_badge?: string; couleur_role?: string }
  entrepriseLogo?: string
  entrepriseNom?: string
  /** En-tête personnalisé de l'entreprise (charte `entete_badge`), ex. "BADGE OFFICIEL POINTAGE TERRAIN". */
  enteteBadge?: string
  onPrint?: () => void
}

function initials(prenom?: string, nom?: string) {
  const parts = [prenom, nom].filter(Boolean) as string[]
  return parts.map((p) => p[0]?.toUpperCase() || '').join('').slice(0, 2) || '—'
}

/**
 * Badge rectangulaire (paysage, format carte) : photo, nom complet, poste, QR.
 * Responsive par container queries natives : la carte s'adapte à la largeur de
 * son conteneur (modal, planche d'impression, aperçu settings, mobile).
 */
export const WorkerBadgeCard: React.FC<WorkerBadgeCardProps> = ({ employe, entrepriseLogo, entrepriseNom, enteteBadge, onPrint }) => {
  const qrCodeValue = typeof employe.code_qr_badge === 'string' ? employe.code_qr_badge : `TIA-EMP-1-${employe.id || 0}-REF`
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCodeValue)}`

  const firstName = typeof employe.prenom === 'string' ? employe.prenom : ''
  const lastName = typeof employe.nom === 'string' ? employe.nom : ''
  const poste = typeof employe.poste === 'string' && employe.poste ? employe.poste : 'Ouvrier de Chantier'
  const matricule = typeof employe.matricule === 'string' ? employe.matricule : `EMP-${employe.id}`
  const accent = employe.couleur_role || 'var(--tia-accent)'

  return (
    <>
      {/* Container queries natives (CSS seulement, aucun JS) : sous 300px de large
          de conteneur, photo et QR réduisent ; sous 240px, le QR passe sous l'identité. */}
      <style>{`
        .badge-landscape { container-type: inline-size; container-name: badge; }
        @container badge (max-width: 300px) {
          /* !important : override des styles inline React (photo/QR dimensionnés en JSX). */
          .badge-landscape .badge-photo, .badge-landscape .badge-photo-ph { width: 60px !important; height: 78px !important; }
          .badge-landscape .badge-qr img { width: 62px !important; height: 62px !important; }
          .badge-landscape .badge-body { padding: 0.6rem !important; column-gap: 0.4rem !important; }
        }
        @container badge (max-width: 240px) {
          .badge-landscape .badge-body { flex-wrap: wrap !important; row-gap: 0.5rem !important; }
          .badge-landscape .badge-identity { flex: 1 1 100%; }
          .badge-landscape .badge-qr { margin: 0 auto; }
        }
      `}</style>

      <div
        className="badge-landscape shadow"
        style={{
          width: '100%',
          maxWidth: 360,
          borderRadius: 14,
          overflow: 'hidden',
          background: 'var(--tia-bg-surface)',
          border: '1px solid var(--tia-border)',
          color: 'var(--tia-text-primary)',
        }}
        role="img"
        aria-label={`Badge de ${firstName} ${lastName}`}
      >
        {/* Bandeau entreprise */}
        <div
          className="d-flex align-items-center justify-content-between px-3 py-2 gap-2"
          style={{ background: accent, color: '#fff' }}
        >
          {entrepriseLogo ? (
            <img
              src={entrepriseLogo}
              alt="Logo entreprise"
              style={{ height: 22, maxWidth: 90, objectFit: 'contain', background: 'rgba(255,255,255,.9)', borderRadius: 4, padding: 2 }}
            />
          ) : (
            <span className="fw-bold text-uppercase text-truncate" style={{ fontSize: '0.78rem', letterSpacing: '0.04em' }}>
              {entrepriseNom || 'TIA INFO BUILD'}
            </span>
          )}
          <span className="fw-semibold text-uppercase text-end flex-shrink-0" style={{ fontSize: '0.62rem', opacity: 0.85, letterSpacing: '0.08em', maxWidth: 150 }}>
            {enteteBadge || 'Badge Terrain'}
          </span>
        </div>

        {/* Corps : photo + identité à gauche, QR à droite */}
        <div className="badge-body d-flex align-items-center p-3" style={{ columnGap: '0.6rem' }}>
          {/* Photo rectangulaire (format carte d'identité) */}
          <div className="flex-shrink-0">
            {employe.photo ? (
              <img
                src={employe.photo}
                alt={`Photo de ${firstName} ${lastName}`}
                className="badge-photo"
                style={{
                  width: 76,
                  height: 96,
                  objectFit: 'cover',
                  borderRadius: 8,
                  border: '2px solid var(--tia-border-strong)',
                  background: 'var(--tia-bg-raised)',
                  display: 'block',
                }}
              />
            ) : (
              <div
                className="badge-photo-ph d-flex align-items-center justify-content-center fw-bold"
                aria-hidden="true"
                style={{
                  width: 76,
                  height: 96,
                  borderRadius: 8,
                  border: '2px solid var(--tia-border-strong)',
                  background: 'var(--tia-bg-raised)',
                  color: 'var(--tia-text-muted)',
                  fontSize: '1.5rem',
                }}
              >
                {initials(firstName, lastName)}
              </div>
            )}
          </div>

          {/* Identité */}
          <div className="badge-identity flex-grow-1 min-width-0">
            <h5 className="fw-bold mb-1 text-truncate" style={{ fontSize: '1.02rem', lineHeight: 1.25 }} title={`${firstName} ${lastName}`}>
              {firstName} {lastName}
            </h5>
            <div
              className="fw-semibold text-uppercase d-inline-block mb-2 px-2 py-1"
              style={{
                fontSize: '0.66rem',
                letterSpacing: '0.05em',
                borderRadius: 6,
                color: accent,
                background: 'var(--tia-accent-soft)',
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={poste}
            >
              {poste}
            </div>
            <div className="small" style={{ color: 'var(--tia-text-muted)', fontSize: '0.72rem' }}>
              Matricule : <strong style={{ color: 'var(--tia-text-secondary)' }}>{matricule}</strong>
            </div>
          </div>

          {/* QR Code */}
          <div className="badge-qr flex-shrink-0 text-center">
            <img
              src={qrImageUrl}
              alt={`QR code du badge de ${firstName} ${lastName}`}
              width={86}
              height={86}
              style={{ display: 'block', borderRadius: 6, background: '#fff', padding: 4 }}
            />
            <i className="bi bi-qr-code-scan" aria-hidden="true" style={{ fontSize: '0.8rem', color: 'var(--tia-text-muted)', marginTop: 4 }} />
          </div>
        </div>

        {/* Actions */}
        {onPrint && (
          <div className="text-center pb-3 px-3">
            <button className="btn btn-sm btn-outline-primary rounded-pill px-4 fw-semibold" onClick={onPrint}>
              <i className="bi bi-printer me-2" aria-hidden="true"></i>Imprimer le Badge
            </button>
          </div>
        )}
      </div>
    </>
  )
}
