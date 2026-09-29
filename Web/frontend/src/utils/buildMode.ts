/**
 * Mode de build de l'application.
 *
 * - `isDesktopBuild()` : test PUREMENT compile-time (`VITE_BUILD_TARGET`),
 *   sans toucher à `window` → utilisable pour éliminer du code du bundle
 *   (ex. LandingPage absente du build desktop, ActivationPage absente du web).
 * - `isDesktop()` : build desktop + runtime Tauri réellement présent
 *   (`__TAURI_INTERNALS__` injecté par la WebView Tauri) → condition d'appel
 *   aux commandes `invoke`.
 */

/** True si le bundle en cours est un build desktop (VITE_BUILD_TARGET=desktop). */
export const isDesktopBuild = (): boolean => import.meta.env.VITE_BUILD_TARGET === 'desktop'

/** True si l'app tourne réellement dans la WebView Tauri (build desktop + runtime Tauri). */
export const isDesktop = (): boolean =>
  isDesktopBuild() && typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
