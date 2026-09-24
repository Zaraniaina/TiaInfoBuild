/**
 * Invocations Tauri (volet desktop) — séparées des handlers de routes locales
 * pour éviter tout import circulaire : `desktopClient`, `helpers` et les
 * fichiers `local/*.routes.ts` importent tous ce module sans dépendre de l'un
 * de l'autre.
 *
 * Contrat Rust : `desktop/src-tauri/src/{main,db,auth,sync}.rs`.
 */
import { invoke } from '@tauri-apps/api/core'

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

export type LocalRow = Record<string, unknown>

export interface DbBootResult {
  db_path: string
  schema_version: number
  activated: boolean
}

export interface SyncStatusResult {
  online: boolean
  pending: number
  last_sync_at: string | null
  conflicts: number
}

export interface SyncRunResult {
  pushed: number
  pulled: number
  conflicts: number
  cursor?: string | null
  error?: string | null
}

export interface DbExecResult {
  rows_changed: number
  last_id: number | null
}

/** Requête SQLite lecture seule (SELECT), renvoyée en tableau d'objets. */
export async function dbQuery(sql: string, args: JsonValue[] = []): Promise<LocalRow[]> {
  return invoke<LocalRow[]>('db_query', { sql, args })
}

/** Lot transactionnel (écriture métier + outbox dans la même transaction). */
export async function dbExecBatch(
  statements: Array<{ sql: string; args: JsonValue[] }>,
): Promise<DbExecResult> {
  return invoke<DbExecResult>('db_exec_batch', { statements })
}

/** Amorce la base locale SQLite (schéma + migrations) au démarrage de l'app. */
export async function bootDesktop(): Promise<DbBootResult> {
  return invoke<DbBootResult>('db_boot')
}

/** Déclenche un cycle complet de synchronisation (push outbox → pull). */
export async function syncNow(serverUrl: string = defaultServerUrl()): Promise<SyncRunResult> {
  return invoke<SyncRunResult>('sync_run', { serverUrl })
}

/** État courant de la synchronisation (online, en attente, dernier sync, conflits). */
export async function getSyncStatus(): Promise<SyncStatusResult> {
  return invoke<SyncStatusResult>('sync_status')
}

/** URL du serveur transmise aux commandes desktop (activation / sync). */
export function defaultServerUrl(): string {
  return import.meta.env.VITE_API_URL || 'http://localhost:8000/api'
}

/** true/false selon l'état réseau perçu par Tauri ; en cas de doute → en ligne. */
export async function checkOnline(): Promise<boolean> {
  try {
    return await invoke<boolean>('net_online')
  } catch {
    return true
  }
}
