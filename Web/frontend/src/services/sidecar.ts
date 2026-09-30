/**
 * Pont UI ↔ sidecar FastAPI local (`tia-api.exe`) — mode « web cerveaux,
 * desktop offline-first ».
 *
 * Le shell Rust lance le backend compilé avec PyInstaller sur la base
 * partagée SQLCipher (`tia.db`) : l'UI pilote donc la VRAIE API FastAPI en
 * local, sur les mêmes données que les hubs Rust (auth/sync). Le cerveau
 * (= serveur web) n'est requis QUE pour :
 *   - la première connexion (activation du poste, via `auth_activate` Rust) ;
 *   - les flux non synchronisables : inscription entreprise, mot de passe
 *     oublié / reset, vérification email, abonnements & paiements.
 *
 * Ce module expose :
 *  - `apiLocaleUrl()` : base absolue (`http://127.0.0.1:<port>`), `null` tant
 *    que le sidecar n'est pas prêt (extraction onefile + démarrage uvicorn) ;
 *  - `versUrlLocale(url)` : contrepartie locale d'une URL axios (`/chantiers`
 *    ou `localhost:8000/api/…` → `127.0.0.1:<port>/api/…` — les routers
 *    FastAPI sont montés sous `/api`) ;
 *  - `estRequeteWebRequise(url)` + `MESSAGE_WEB_REQUIS_HORS_LIGNE` : les
 *    requêtes réservées au cerveau web, rejetées avec un message clair
 *    hors-ligne (jamais une erreur réseau illisible).
 *
 * **Activation** : la redirection est faite dans `services/api.ts` si
 * `VITE_SIDECAR_HTTP=1` ; le contrôle « web requis » s'applique dans tous les
 * cas (mode desktop) pour garantir les règles produit.
 */
import { invoke } from '@tauri-apps/api/core'
import { isDesktop } from '@/utils/buildMode'

/**
 * Redirection vers l'API locale : ACTIVE par défaut en desktop (base partagée
 * prouvée — les écritures passent par la vraie API et nourrissent `_sync_outbox`).
 * Kill switch : `VITE_SIDECAR_HTTP=0` retombe sur le mode hybride historique
 * (registre SQLite + relais web). Inerte hors WebView Tauri.
 */
export const redirectionSidecarActivee = (): boolean =>
  isDesktop() && import.meta.env.VITE_SIDECAR_HTTP !== '0'

let urlEnCache: Promise<string | null> | null = null

/** Base absolue de l'API locale, ou `null` si le sidecar n'est pas prêt. */
export function apiLocaleUrl(): Promise<string | null> {
  if (!isDesktop()) return Promise.resolve(null)
  if (!urlEnCache) {
    urlEnCache = invoke<string>('api_url')
      .then((u) => (typeof u === 'string' && u.startsWith('http') ? u.replace(/\/$/, '') : null))
      .catch(() => {
        // Pas encore prêt (`SIDECAR_INDISPONIBLE`) : on retentera au prochain
        // appel — le démarrage peut prendre plusieurs dizaines de secondes.
        urlEnCache = null
        return null
      })
  }
  return urlEnCache
}

/** Hôte distant par défaut du backend web (baseURL axios, VITE_API_URL). */
const HOTE_SERVEUR_DISTANT = /https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/

/**
 * Chemin normalisé d'une URL axios : sans schéma/hôte, sans `/api` en tête
 * (préfixe de montage des routers FastAPI), sans slashes de bord.
 */
function cheminSansBase(url: string): string {
  let chemin = url
  if (/^https?:\/\//i.test(chemin)) {
    try {
      chemin = new URL(chemin).pathname
    } catch {
      // URL relative ou malformée : conservée telle quelle
    }
  }
  return chemin.replace(/^\/+/, '').replace(/\/+$/, '').replace(/^api\//, '')
}

/** Chemin local d'une URL de requête axios, ou `null` si non projetable. */
async function cheminLocal(url: string): Promise<string | null> {
  const base = await apiLocaleUrl()
  if (!base) return null
  if (url.startsWith('/')) return `${base}/api/${cheminSansBase(url)}`
  if (HOTE_SERVEUR_DISTANT.test(url)) return `${base}/api/${cheminSansBase(url)}`
  return null
}

/**
 * Contrepartie locale d'une URL de requête axios :
 *  - `/chantiers` (relatif au `baseURL` `…/api`) → `http://127.0.0.1:N/api/chantiers` ;
 *  - `http://localhost:8000/api/chantiers` (absolu même hôte) → idem ;
 *  - tout le reste (hôte externe, relatif sans `/`) → `null` (no-op).
 */
export async function versUrlLocale(url: string | undefined): Promise<string | null> {
  if (!url) return null
  return cheminLocal(url)
}

/* ---------------------------------------------------------------------------
 * Flux « web requis » : le cerveau (serveur) est l'UNIQUE gestionnaire.
 * Ces routes ne sont ni servies ni interceptées en local — hors-ligne, elles
 * sont rejetées avec un message explicite.
 * ------------------------------------------------------------------------- */
const MODELES_WEB_REQUIS: RegExp[] = [
  // Inscription entreprise + mot de passe oublié/réinitialisation + email :
  // envois SMTP et comptes créés sur le cerveau uniquement.
  /^auth\/register-entreprise$/,
  /^auth\/forgot-password$/,
  /^auth\/reset-password$/,
  /^auth\/verify-email$/,
  // Abonnements & paiements : souscriptions, plans, webhooks, transaction
  // d'achat (`paiements/abonnement/initier`…).
  /^paiements\//,
  /^subscriptions\//,
  /^paiement-config/,
]

/** Message produit hors-ligne pour toute route « web requise ». */
export const MESSAGE_WEB_REQUIS_HORS_LIGNE =
  'Cette opération (inscription entreprise, mot de passe oublié ou abonnement) ' +
  'nécessite une connexion Internet : elle est gérée par le serveur web.'

/** true si la requête doit être traitée par le cerveau web (jamais en local). */
export function estRequeteWebRequise(url: string | undefined): boolean {
  if (!url) return false
  const chemin = cheminSansBase(url)
  return MODELES_WEB_REQUIS.some((modele) => modele.test(chemin))
}

/* ---------------------------------------------------------------------------
 * Token LOCAL (`POST /api/auth/local-login` du sidecar) : le JWT web n'est PAS
 * accepté par l'API embarquée offline (clé secrète web ≠ base locale ; le
 * compte peut ne pas exister localement). Ce token, signé par le process
 * sidecar, authente tous les appels UI → API locale. Il est stocké à part
 * (`access_token_local`) pour ne jamais fuiter vers le web.
 * ------------------------------------------------------------------------- */
const CLE_TOKEN_LOCAL = 'access_token_local'

/** Token local courant, ou `null`. */
export function tokenLocal(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(CLE_TOKEN_LOCAL)
}

/** Oublie le token local (logout / compte invalide). */
export function supprimerTokenLocal(): void {
  if (typeof window !== 'undefined') localStorage.removeItem(CLE_TOKEN_LOCAL)
}

/** Nombre de sondes du sidecar avant abandon (démarrage ≈ extraction onefile + uvicorn). */
const TENTATIVES_MAX = 30
const DELAI_ENTRE_TENTATIVES_MS = 5_000

function attendre(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Échange (email, mot de passe) contre un token local du sidecar. Sert
 * systématiquement après un login/activation desktop réussi (hub Rust) : la
 * session UI (web ou offline) obtient ainsi sa contrepartie locale.
 * Retourne le token, ou `null` (sidecar pas prêt, redirection inactive,
 * refus local) — non bloquant dans tous les cas.
 */
export async function ensureTokenLocal(email: string, password: string): Promise<string | null> {
  if (!redirectionSidecarActivee()) return null
  let base: string | null = null
  // Le sidecar démarre lentement (extraction onefile + uvicorn froid) :
  // sondage patient, l'UI n'attend PAS ce résultat pour ouvrir la session.
  for (let tentative = 0; tentative < TENTATIVES_MAX; tentative += 1) {
    base = await apiLocaleUrl()
    if (base) break
    await attendre(DELAI_ENTRE_TENTATIVES_MS)
  }
  if (!base) return null
  try {
    const reponse = await fetch(`${base}/api/auth/local-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!reponse.ok) return null
    const donnees = (await reponse.json()) as { access_token?: string }
    const token = typeof donnees.access_token === 'string' ? donnees.access_token : null
    if (token) {
      localStorage.setItem(CLE_TOKEN_LOCAL, token)
      return token
    }
    return null
  } catch {
    return null
  }
}
