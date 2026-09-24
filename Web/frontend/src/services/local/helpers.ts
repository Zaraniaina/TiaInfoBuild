/**
 * Helpers partagés des routes locales desktop : conversion JSON ↔ SQLite,
 * dates/heures au format FastAPI, pagination, contexte utilisateur.
 *
 * Importés par `desktopClient` (routes historiques) et par chaque fichier
 * `local/<module>.routes.ts` (nouveaux modules hors-ligne, Phase 4).
 */
import type { InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/stores/auth.store'
import { dbExecBatch, dbQuery, type JsonValue, type LocalRow } from './ipc'
import { localError } from './registry'

export { localError }
export type { JsonValue, LocalRow }
export { dbQuery, dbExecBatch }

export type SqlArg = string | number | null

export function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Date locale AAAA-MM-JJ (identique au format `date` de FastAPI). */
export function dateLocale(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Heure locale HH:MM:SS (identique à `datetime.now().strftime('%H:%M:%S')`). */
export function heureLocale(d: Date = new Date()): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function heureCourte(d: Date = new Date()): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Horodatage local AAAA-MM-JJTHH:MM:SS (serialisation pydantic, sans timezone). */
export function horodatageLocal(d: Date = new Date()): string {
  return `${dateLocale(d)}T${heureLocale(d)}`
}

/** UUID client (client_ref) — `crypto.randomUUID` avec repli sécurisé. */
export function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function str(v: unknown): string {
  return typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v)
}

export function strOrNull(v: unknown): string | null {
  return v === null || v === undefined || v === '' ? null : str(v)
}

export function int(v: unknown, def: number): number {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? Math.trunc(n) : def
}

export function intOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  return int(v, 0)
}

export function floatOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : null
}

export function boolSql(v: unknown): boolean {
  return v === 1 || v === true || v === '1'
}

/** Normalise un champ horaire vers HH:MM:SS (le backend renvoie toujours `%H:%M:%S`). */
export function normaliserHeure(v: unknown): string | null {
  const s = strOrNull(v)
  if (!s) return null
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(s)
  if (!m) return s
  return `${pad(int(m[1], 0))}:${m[2]}:${m[3] ?? '00'}`
}

/** Format Python `str(float)` : 8 → « 8.0 », 7.5 → « 7.5 ». */
export function formatHeures(h: number): string {
  return Number.isInteger(h) ? `${h}.0` : String(h)
}

/** Montant formaté comme `str(float)` Python (finances/commercial). */
export function formatMontant(h: number): string {
  return formatHeures(h)
}

export function pagination(params: Record<string, unknown>): { page: number; size: number; offset: number } {
  const page = Math.max(1, int(params.page, 1))
  const size = Math.min(100, Math.max(1, int(params.size, 25)))
  return { page, size, offset: (page - 1) * size }
}

export function currentUser() {
  return useAuthStore.getState().user
}

export function currentEntrepriseId(): number | null {
  const id = currentUser()?.entreprise_id
  return id === undefined || id === null ? null : int(id, 0)
}

export function currentUserId(): number | null {
  const id = currentUser()?.id
  return id === undefined || id === null ? null : int(id, 0)
}

/** Réponses locales : les booléens SQLite (0/1) sont sérialisés comme FastAPI. */
export function serializerBooleens(row: LocalRow, colonnes: string[]): LocalRow {
  const out: LocalRow = { ...row }
  for (const c of colonnes) {
    if (c in out) out[c] = boolSql(out[c])
  }
  return out
}

/** Clauses WHERE communes : `is_deleted = 0` + `entreprise_id` du contexte. */
export function clausesTenant(): { clauses: string[]; args: JsonValue[] } {
  const clauses = ['is_deleted = 0']
  const args: JsonValue[] = []
  const entrepriseId = currentEntrepriseId()
  if (entrepriseId !== null) {
    clauses.push('entreprise_id = ?')
    args.push(entrepriseId)
  }
  return { clauses, args }
}

/** Requête « sûre » : une table absente du schéma local ne casse pas la page. */
export async function dbQueryOptionnel(sql: string, args: JsonValue[] = []): Promise<LocalRow[]> {
  try {
    return await dbQuery(sql, args)
  } catch (err) {
    console.warn('[desktop] Requête optionnelle impossible :', err)
    return []
  }
}

/** `config.params` d'une requête axios plats en `Record<string, unknown>`. */
export function paramsRequete(config: InternalAxiosRequestConfig): Record<string, unknown> {
  return (config.params ?? {}) as Record<string, unknown>
}
