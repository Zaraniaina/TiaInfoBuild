/**
 * Registre des routes locales desktop (plan §2 / §6).
 *
 * Chaque module (`local/<module>.routes.ts`) enregistre SES routes ici au
 * chargement : aucun fichier partagé n'est modifié quand un module est ajouté
 * (zéro conflit entre chantiers parallèles). `desktopClient.handleLocalRequest`
 * consulte ce registre après son propre registre historique.
 */
import { AxiosError } from 'axios'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'

export interface LocalRequest {
  method: string
  /** Chemin sans `/api` ni slash initial, ex. `rh/pointages`. */
  path: string
  params: Record<string, unknown>
  data: Record<string, unknown>
  pathParams: string[]
}

export type LocalHandler = (req: LocalRequest) => Promise<unknown>

/** Une route : handler + statut HTTP de synthèse (FastAPI POST → 201). */
interface RouteLocale {
  handler: LocalHandler
  status: number
}

/** Une route à paramètre (`GET chantiers/42`) : regex sur `"MÉTHODE chemin"`. */
interface PatronLocale {
  pattern: RegExp
  handler: LocalHandler
  status: number
}

const ROUTES = new Map<string, RouteLocale>()
const PATRONS: PatronLocale[] = []

/** Comptes HTTP renvoyés pour les routes locales (FastAPI utilise 201 sur POST). */
export const STATUT_LOCAL_DEFAUT: Record<string, number> = {}

/**
 * Enregistre une route locale.
 * @param cle `"MÉTHODE chemin"` (ex. `GET stocks/articles`)
 * @param handler handler asynchrone renvoyant le MÊME JSON que FastAPI
 * @param status statut HTTP de synthèse (défaut 200, 201 sur POST)
 */
export function registerLocalRoute(cle: string, handler: LocalHandler, status = 200): void {
  ROUTES.set(cle, { handler, status })
}

/**
 * Enregistre plusieurs routes : `registerLocalRoutes({ 'GET x': h, ... })`.
 * @param statuts statuts HTTP par clé (ex. `{ 'POST x': 201 }`)
 */
export function registerLocalRoutes(
  routes: Record<string, LocalHandler>,
  statuts: Record<string, number> = {},
): void {
  for (const [cle, handler] of Object.entries(routes)) {
    registerLocalRoute(cle, handler, statuts[cle] ?? STATUT_LOCAL_DEFAUT[cle] ?? 200)
  }
}

/** Enregistre une route à paramètre (regex sur la clé `"MÉTHODE chemin"`). */
export function registerLocalPattern(
  pattern: RegExp,
  handler: LocalHandler,
  status = 200,
): void {
  PATRONS.push({ pattern, handler, status })
}

/** Recherche une route exacte ; `undefined` si absente. */
export function lookupLocalRoute(cle: string): RouteLocale | undefined {
  return ROUTES.get(cle)
}

/** Teste les routes à paramètre dans l'ordre d'enregistrement. */
export function matchLocalPattern(cle: string): { m: RegExpMatchArray; route: PatronLocale } | undefined {
  for (const route of PATRONS) {
    const m = route.pattern.exec(cle)
    if (m) return { m, route }
  }
  return undefined
}

/** Construit une erreur « forme Axios » pour que les pages existantes l'affichent telle quelle. */
export function localError(
  status: number,
  detail: string,
  config?: InternalAxiosRequestConfig,
): AxiosError {
  const response: AxiosResponse = {
    data: { detail },
    status,
    statusText: 'Erreur locale',
    headers: {},
    config: config ?? ({} as InternalAxiosRequestConfig),
  }
  return new AxiosError(detail, `ERR_${status}`, config, undefined, response)
}
