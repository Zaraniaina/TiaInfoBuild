import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { isDesktop } from '@/utils/buildMode'
import { checkOnline } from '@/services/desktopClient'

/**
 * Garde-fou « en ligne requis » (plan §5/C4) — build desktop uniquement.
 *
 * Les flux serveur obligatoires (création de compte entreprise, mot de passe
 * oublié / réinitialisation, vérification d'e-mail) ne sont JAMAIS simulés
 * localement : hors connexion, on affiche un écran dédié au lieu d'une requête
 * qui échouerait silencieusement.
 *
 * En build web (hors desktop) le composant est transparent : il rend les
 * enfants tels quels, sans vérification réseau.
 */
export function OnlineRequiredGate({ children }: { children: ReactNode }) {
  const [etat, setEtat] = useState<'controle' | 'en_ligne' | 'hors_ligne'>('controle')

  const verifier = useCallback(async () => {
    const enLigne = await checkOnline()
    setEtat(enLigne ? 'en_ligne' : 'hors_ligne')
  }, [])

  useEffect(() => {
    if (!isDesktop()) {
      setEtat('en_ligne')
      return
    }
    void verifier()
    // Repasse en ligne automatiquement quand la connexion revient.
    const maj = () => void verifier()
    window.addEventListener('online', maj)
    window.addEventListener('offline', maj)
    return () => {
      window.removeEventListener('online', maj)
      window.removeEventListener('offline', maj)
    }
  }, [verifier])

  if (!isDesktop() || etat === 'en_ligne') return <>{children}</>

  if (etat === 'controle') {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Vérification de la connexion…</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light px-3">
      <div className="card shadow-sm" style={{ maxWidth: '28rem', width: '100%' }}>
        <div className="card-body p-4 text-center">
          <i className="bi bi-wifi-off fs-1 text-danger" aria-hidden="true"></i>
          <h1 className="h5 mt-3">Connexion Internet requise</h1>
          <p className="text-muted mb-4">
            Cette étape s'effectue sur le serveur TIA Info Build et nécessite une
            connexion Internet. Le reste de l'application reste utilisable
            hors-ligne, vos données étant conservées localement.
          </p>
          <div className="d-flex gap-2 justify-content-center flex-wrap">
            <button type="button" className="btn btn-primary" onClick={() => void verifier()}>
              <i className="bi bi-arrow-repeat me-1"></i>Réessayer
            </button>
            <Link to="/login" className="btn btn-outline-secondary">
              Retour à la connexion
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
