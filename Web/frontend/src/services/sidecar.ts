/**
 * Pont UI ↔ sidecar FastAPI local (`tia-api.exe`).
 *
 * Le shell Rust lance le backend compilé avec PyInstaller et expose son URL
 * via la commande `api_url` (contrat : `desktop/src-tauri/src/sidecar.rs`).
 * Ce module résout cette URL puis expose deux primitives :
 *
 *  - `apiLocaleUrl()` : base absolue (`http://127.0.0.1:<port>`), `null` tant
 *    que le sidecar n'est pas prêt (extraction onefile + démarrage uvicorn) ;
 *  - `versUrlLocale(url)` : contrepartie locale d'une URL axios (`/chantiers`
 *    relatif au `baseURL` web `…/api`, ou absolu vers `localhost:8000`) ;
 *    URL non projetable (hôte externe, relatif sans `/`) → `null`.
 *
 * **Activation (opt-in)** : la redirection est faite dans `services/api.ts`
 * uniquement si `VITE_SIDECAR_HTTP=1` (absent par défaut). Tant que le
 * sidecar garde sa propre base (`local_api.db`) — distincte du magasin
 * SQLCipher `tia.db` utilisé par les hubs Rust (auth/sync) — le drapeau
 * reste OFF : piloter l'UI sur le sidecar sans base partagée créerait deux
 * sources de vérité divergentes (JWT émis par le serveur vs secrets locaux,
 * IDs utilisateurs, outbox en attente). Module donc inerte aujourd'hui,
 * prêt pour la fusion des bases.
 */
import { invoke } from '@tauri-apps/api/core'
import { isDesktop } from '@/utils/buildMode'

/** Opt-in runtime : le drapeau n'est honoré que dans la WebView Tauri. */
export const redirectionSidecarActivee = (): boolean =>
  isDesktop() && import.meta.env.VITE_SIDECAR_HTTP === '1'

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
 * Contrepartie locale d'une URL de requête axios :
 *  - `/chantiers` (relatif au `baseURL` `…/api`) → `http://127.0.0.1:N/chantiers` ;
 *  - `http://localhost:8000/api/chantiers` (absolu même hôte) → idem ;
 *  - tout le reste (hôte externe, relatif sans `/`) → `null` (no-op).
 */
export async function versUrlLocale(url: string | undefined): Promise<string | null> {
  if (!url) return null
  const base = await apiLocaleUrl()
  if (!base) return null
  if (url.startsWith('/')) return base + url
  if (HOTE_SERVEUR_DISTANT.test(url)) {
    const chemin = url.replace(/^https?:\/\/[^/]+\/?/, '').replace(/^api\//, '')
    return base + '/' + chemin
  }
  return null
}
