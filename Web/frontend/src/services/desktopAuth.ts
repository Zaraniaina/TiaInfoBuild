/**
 * Session desktop : activation du poste (1ʳᵉ connexion, ONLINE requis) et
 * login desktop (online d'abord, fallback offline via la session locale).
 *
 * Contrat Rust (desktop/src-tauri) :
 * - `auth_activate({serverUrl, email, password, deviceId})`
 *   erreurs : `RESEAU_REQUIS:` / `IDENTIFIANTS_INVALIDES:`
 * - `auth_login({serverUrl, email, password})`
 *   erreurs : `IDENTIFIANTS_INVALIDES:` / `ACTIVATION_REQUISE:`
 *
 * Les résultats sont mappés dans le store d'auth existant (`auth.store`) :
 * session en ligne = JWT classiques ; session hors-ligne = user local,
 * pas de token, drapeau `offline` persistant.
 */
import { invoke } from '@tauri-apps/api/core'
import { useAuthStore, type User } from '@/stores/auth.store'
import { defaultServerUrl } from './desktopClient'
import { ensureTokenLocal, supprimerTokenLocal } from './sidecar'

/** Clé localStorage marquant une activation déjà effectuée sur ce poste. */
export const DESKTOP_ACTIVATED_KEY = 'desktop_activated'

const DEVICE_ID_KEY = 'device_id'

/** Identifiant stable de ce poste (généré une fois, persisté). */
export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'desktop'
  let id = localStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = randomUuid()
    localStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}

function randomUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/** Utilisateur renvoyé par les commandes Rust (shape défensive). */
export interface DesktopUserPayload {
  id?: number | string
  nom?: string
  prenom?: string | null
  email?: string
  role_code?: string
  entreprise_id?: number | null
  statut?: string
  must_change_password?: boolean
}

export interface DesktopAuthResult {
  access_token: string | null
  refresh_token: string | null
  entreprise_id: number | null
  user: DesktopUserPayload
  offline: boolean
}

export type DesktopAuthErrorCode = 'RESEAU_REQUIS' | 'IDENTIFIANTS_INVALIDES' | 'ACTIVATION_REQUISE' | 'ERREUR_INCONNUE'

/**
 * Erreur d'auth desktop : message FR + code métier + forme Axios
 * (`response.data.detail`) pour `formatErrorMessage`.
 */
export class DesktopAuthError extends Error {
  readonly code: DesktopAuthErrorCode
  readonly detail: string
  readonly response: { status: number; data: { detail: string } }

  constructor(code: DesktopAuthErrorCode, detail: string, status: number) {
    super(detail)
    this.name = 'DesktopAuthError'
    this.code = code
    this.detail = detail
    this.response = { status, data: { detail } }
  }
}

/** Traduit le message brut d'une commande Rust en `DesktopAuthError`. */
function versErreurAuth(err: unknown): DesktopAuthError {
  const brut = err instanceof Error ? err.message : typeof err === 'string' ? err : String(err)
  if (brut.includes('RESEAU_REQUIS')) {
    return new DesktopAuthError(
      'RESEAU_REQUIS',
      'Une connexion Internet est requise pour la première activation.',
      503,
    )
  }
  if (brut.includes('IDENTIFIANTS_INVALIDES')) {
    const detail = brut.split('IDENTIFIANTS_INVALIDES:')[1]?.trim()
    return new DesktopAuthError('IDENTIFIANTS_INVALIDES', detail || 'Email ou mot de passe incorrect.', 401)
  }
  if (brut.includes('ACTIVATION_REQUISE')) {
    const detail = brut.split('ACTIVATION_REQUISE:')[1]?.trim()
    return new DesktopAuthError(
      'ACTIVATION_REQUISE',
      detail || "Ce poste n'a pas encore été activé. Une connexion Internet est requise pour la première activation.",
      403,
    )
  }
  return new DesktopAuthError('ERREUR_INCONNUE', brut || "L'opération d'authentification a échoué.", 500)
}

/** Mappe l'utilisateur Rust vers l'interface `User` du store. */
function mapperUser(u: DesktopUserPayload): User {
  const id = Number(u.id)
  return {
    id: Number.isFinite(id) ? id : 0,
    nom: u.nom || '',
    prenom: u.prenom ?? undefined,
    email: u.email || '',
    role_code: u.role_code || 'employe',
    entreprise_id: u.entreprise_id ?? undefined,
    statut: u.statut,
    must_change_password: u.must_change_password ?? false,
  }
}

/**
 * Activation du poste (ONLINE requis) : vérifie les identifiants côté serveur,
 * crée le device_id puis ouvre la session locale. Ouvre aussi la session
 * auprès de l'API embarquée (token local, non bloquant).
 */
export async function activateDesktop(email: string, password: string): Promise<DesktopAuthResult> {
  try {
    const resultat = await invoke<DesktopAuthResult>('auth_activate', {
      serverUrl: defaultServerUrl(),
      email,
      password,
      deviceId: getDeviceId(),
    })
    localStorage.setItem(DESKTOP_ACTIVATED_KEY, '1')

    const store = useAuthStore.getState()
    if (resultat.access_token) {
      store.login(resultat.access_token, resultat.refresh_token || '', mapperUser(resultat.user))
    } else {
      store.loginOffline(mapperUser(resultat.user))
    }

    // Session locale pour l'API embarquée (non bloquant) : le JWT web n'est
    // pas accepté par le sidecar offline — on échange les mêmes identifiants
    // contre un token local signé par le process (sondage patient inclus).
    void ensureTokenLocal(email, password).then((token) => {
      if (!token) console.warn('[auth] API locale : session locale indisponible pour le moment.')
    })

    return resultat
  } catch (err) {
    throw versErreurAuth(err)
  }
}

/**
 * Login desktop : online d'abord (JWT serveur), fallback offline via la session
 * locale (store marqué `offline`, sans token). Ouvre aussi la session auprès
 * de l'API embarquée (token local, non bloquant).
 */
export async function loginDesktop(email: string, password: string): Promise<DesktopAuthResult> {
  try {
    const resultat = await invoke<DesktopAuthResult>('auth_login', {
      serverUrl: defaultServerUrl(),
      email,
      password,
    })
    const store = useAuthStore.getState()
    if (resultat.offline || !resultat.access_token) {
      store.loginOffline(mapperUser(resultat.user))
    } else {
      store.login(resultat.access_token, resultat.refresh_token || '', mapperUser(resultat.user))
    }

    // Contrepartie locale (voir activateDesktop) — online comme offline.
    void ensureTokenLocal(email, password).then((token) => {
      if (!token) console.warn('[auth] API locale : session locale indisponible pour le moment.')
    })

    return resultat
  } catch (err) {
    throw versErreurAuth(err)
  }
}
