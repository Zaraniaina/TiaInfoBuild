/**
 * Client API « desktop » — adaptateur local SQLite (Tauri), point d'unique de
 * bascule web ⇄ desktop (docs/plan-desktop-tauri.md §2, §5, §6).
 *
 * - Registre `LOCAL_ROUTES` : routes servies 100 % en local via `db_query` /
 *   `db_exec_batch`, avec les MÊMES réponses JSON que l'API FastAPI.
 * - Toute route hors registre : relayée vers axios existant si le réseau est
 *   disponible (mode hybride = comportement web actuel), sinon rejetée avec un
 *   message explicite « Phase 4 » au lieu d'une erreur réseau illisible.
 * - Convention d'erreur : objet de forme Axios (`{response: {status, data: {detail}}}`)
 *   pour que `formatErrorMessage` et les `catch` des pages existent tels quels.
 * - RÈGLE D'OR : toute écriture locale = UNE SEULE `db_exec_batch` contenant
 *   l'écriture métier ET sa ligne `_sync_outbox` (transaction atomique).
 */
import { invoke } from '@tauri-apps/api/core'
import { AxiosError } from 'axios'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/stores/auth.store'

// ---------------------------------------------------------------------------
// Types du contrat Rust (volet desktop/src-tauri)
// ---------------------------------------------------------------------------

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

interface DbExecResult {
  rows_changed: number
  last_id: number | null
}

/** Message affiché aux pages pour toute route non implémentée en local. */
export const MESSAGE_HORS_LIGNE = 'Non disponible hors-ligne (module à venir — Phase 4 du plan)'

// ---------------------------------------------------------------------------
// Invocations Tauri (inertes hors Tauri : isDesktop() les conditionne)
// ---------------------------------------------------------------------------

export async function dbQuery(sql: string, args: JsonValue[] = []): Promise<LocalRow[]> {
  return invoke<LocalRow[]>('db_query', { sql, args })
}

async function dbExecBatch(statements: Array<{ sql: string; args: JsonValue[] }>): Promise<DbExecResult> {
  return invoke<DbExecResult>('db_exec_batch', { statements })
}

/** Amorce la base locale SQLite (schéma + seed) au démarrage de l'app. */
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
async function isOnline(): Promise<boolean> {
  try {
    return await invoke<boolean>('net_online')
  } catch {
    return true
  }
}

// ---------------------------------------------------------------------------
// Erreurs « forme Axios »
// ---------------------------------------------------------------------------

/** Construit une erreur de la forme attendue par `formatErrorMessage` / les pages. */
export function localError(status: number, detail: string, config?: InternalAxiosRequestConfig): AxiosError {
  const response: AxiosResponse = {
    data: { detail },
    status,
    statusText: 'Erreur locale',
    headers: {},
    config: config ?? ({} as InternalAxiosRequestConfig),
  }
  return new AxiosError(detail, `ERR_${status}`, config, undefined, response)
}

// ---------------------------------------------------------------------------
// Petit socle SQLite / dates locales
// ---------------------------------------------------------------------------

type SqlArg = string | number | null

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Date locale AAAA-MM-JJ (identique au format `date` de FastAPI). */
function dateLocale(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Heure locale HH:MM:SS (identique à `datetime.now().strftime('%H:%M:%S')`). */
function heureLocale(d: Date = new Date()): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function heureCourte(d: Date = new Date()): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Horodatage local AAAA-MM-JJTHH:MM:SS (serialisation pydantic, sans timezone). */
function horodatageLocal(d: Date = new Date()): string {
  return `${dateLocale(d)}T${heureLocale(d)}`
}

/** UUID client (client_ref) — `crypto.randomUUID` avec repli sécurisé. */
function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v)
}

function strOrNull(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null
  return str(v)
}

function int(v: unknown, def: number): number {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? Math.trunc(n) : def
}

function intOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  return int(v, 0)
}

function floatOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : null
}

function boolSql(v: unknown): boolean {
  return v === 1 || v === true || v === '1'
}

/** Normalise un champ horaire vers HH:MM:SS (le backend renvoie toujours `%H:%M:%S`). */
function normaliserHeure(v: unknown): string | null {
  const s = strOrNull(v)
  if (!s) return null
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(s)
  if (!m) return s
  return `${pad(int(m[1], 0))}:${m[2]}:${m[3] ?? '00'}`
}

/** Format Python `str(float)` : 8 → « 8.0 », 7.5 → « 7.5 ». */
function formatHeures(h: number): string {
  return Number.isInteger(h) ? `${h}.0` : String(h)
}

function pagination(params: Record<string, unknown>): { page: number; size: number; offset: number } {
  const page = Math.max(1, int(params.page, 1))
  const size = Math.min(100, Math.max(1, int(params.size, 25)))
  return { page, size, offset: (page - 1) * size }
}

function currentUser() {
  return useAuthStore.getState().user
}

function currentEntrepriseId(): number | null {
  const id = currentUser()?.entreprise_id
  return id === undefined || id === null ? null : int(id, 0)
}

function currentUserId(): number | null {
  const id = currentUser()?.id
  return id === undefined || id === null ? null : int(id, 0)
}

/** Réponses locales : les booléens SQLite (0/1) sont sérialisés comme FastAPI. */
function serializerBooleens(row: LocalRow, colonnes: string[]): LocalRow {
  const out: LocalRow = { ...row }
  for (const c of colonnes) {
    if (c in out) out[c] = boolSql(out[c])
  }
  return out
}

// ---------------------------------------------------------------------------
// Shapes des réponses (calées sur Web/backend/app/schemas/*)
// ---------------------------------------------------------------------------

const POINTAGE_COLUMNS = [
  'id', 'entreprise_id', 'employe_id', 'chantier_id', 'date_jour',
  'heure_debut', 'heure_fin', 'heure_pause_debut', 'heure_pause_fin',
  'heures_total', 'type', 'methode_pointage', 'scanne_par_id',
  'latitude', 'longitude', 'statut_validation', 'notes',
  'is_deleted', 'created_at', 'updated_at',
] as const

/** `PointageResponse` (schéma pointage.py) : row SQLite → JSON FastAPI. */
function serializerPointage(row: LocalRow): LocalRow {
  return serializerBooleens(row, ['is_deleted'])
}

/** `EmployeList` (schéma employe.py). */
const EMPLOYE_LIST_COLUMNS = [
  'id', 'entreprise_id', 'matricule', 'nom', 'prenom', 'poste',
  'date_embauche', 'type_contrat', 'salaire_base', 'telephone', 'email',
  'statut', 'is_deleted', 'created_at',
] as const

/** `ChantierList` (schéma chantier.py). */
const CHANTIER_LIST_COLUMNS = [
  'id', 'entreprise_id', 'client_id', 'chef_chantier_id', 'projet_id',
  'numero', 'nom', 'ville', 'date_debut', 'date_fin_prevue',
  'budget_prevu', 'budget_reel', 'marge_cible', 'statut', 'region',
  'is_deleted', 'created_at',
] as const

/** `ChantierResponse` (schéma chantier.py) — détail complet. */
const CHANTIER_RESPONSE_COLUMNS = [
  'id', 'entreprise_id', 'client_id', 'chef_chantier_id', 'projet_id',
  'numero', 'nom', 'adresse', 'code_postal', 'ville', 'date_debut',
  'date_fin_prevue', 'date_fin_reelle', 'budget_prevu', 'budget_previsionnel',
  'budget_reel', 'marge_cible', 'tva', 'statut', 'description', 'region',
  'is_deleted', 'created_at', 'updated_at',
] as const

const TYPES_POINTAGE = ['present', 'absent', 'retard', 'congé', 'maladie']

// ---------------------------------------------------------------------------
// Registre des routes locales
// ---------------------------------------------------------------------------

export interface LocalRequest {
  method: string
  /** Chemin sans `/api` ni slash initial, ex. `rh/pointages`. */
  path: string
  params: Record<string, unknown>
  data: Record<string, unknown>
  pathParams: string[]
}

type LocalHandler = (req: LocalRequest) => Promise<unknown>

/** Comptes HTTP renvoyés pour les routes locales (FastAPI utilise 201 sur POST). */
const LOCAL_STATUS: Record<string, number> = {
  'POST rh/pointages': 201,
}

/**
 * GET rh/pointages — réplique `list_pointages` de rh.py :
 * `{items, total, page, size}` avec la shape `PointageList`.
 */
async function listPointagesLocal(req: LocalRequest): Promise<unknown> {
  const clauses = ['is_deleted = 0']
  const args: JsonValue[] = []
  const entrepriseId = currentEntrepriseId()
  if (entrepriseId !== null) {
    clauses.push('entreprise_id = ?')
    args.push(entrepriseId)
  }
  const employeId = int(req.params.employe_id, 0)
  if (employeId > 0) {
    clauses.push('employe_id = ?')
    args.push(employeId)
  }
  const dateDebut = strOrNull(req.params.date_debut)
  if (dateDebut) {
    clauses.push('date_jour >= ?')
    args.push(dateDebut)
  }
  const dateFin = strOrNull(req.params.date_fin)
  if (dateFin) {
    clauses.push('date_jour <= ?')
    args.push(dateFin)
  }
  const typePointage = strOrNull(req.params.type)
  if (typePointage) {
    clauses.push('type = ?')
    args.push(typePointage)
  }

  const { page, size, offset } = pagination(req.params)
  const where = clauses.join(' AND ')
  const total = int((await dbQuery(`SELECT COUNT(*) AS total FROM pointages WHERE ${where}`, args))[0]?.total, 0)
  const rows = await dbQuery(
    `SELECT id, employe_id, chantier_id, date_jour, heures_total, type FROM pointages WHERE ${where} ORDER BY id ASC LIMIT ? OFFSET ?`,
    [...args, size, offset],
  )
  return { items: rows, total, page, size }
}

/** GET rh/employes — réplique `list_employes` : `{items, total, page, size}` (EmployeList). */
async function listEmployesLocal(req: LocalRequest): Promise<unknown> {
  const clauses = ['is_deleted = 0']
  const args: JsonValue[] = []
  const entrepriseId = currentEntrepriseId()
  if (entrepriseId !== null) {
    clauses.push('entreprise_id = ?')
    args.push(entrepriseId)
  }
  const search = str(req.params.search).trim()
  if (search) {
    clauses.push('(nom LIKE ? OR prenom LIKE ?)')
    args.push(`%${search}%`, `%${search}%`)
  }
  const poste = strOrNull(req.params.poste)
  if (poste) {
    clauses.push('poste = ?')
    args.push(poste)
  }
  const statut = strOrNull(req.params.statut)
  if (statut) {
    clauses.push('statut = ?')
    args.push(statut)
  }

  const { page, size, offset } = pagination(req.params)
  const where = clauses.join(' AND ')
  const total = int((await dbQuery(`SELECT COUNT(*) AS total FROM employes WHERE ${where}`, args))[0]?.total, 0)
  const rows = await dbQuery(
    `SELECT ${EMPLOYE_LIST_COLUMNS.join(', ')} FROM employes WHERE ${where} ORDER BY id ASC LIMIT ? OFFSET ?`,
    [...args, size, offset],
  )
  return {
    items: rows.map((r) => serializerBooleens(r, ['is_deleted'])),
    total,
    page,
    size,
  }
}

/** GET chantiers — réplique `list_chantiers` : `{items, total, page, size}` (ChantierList). */
async function listChantiersLocal(req: LocalRequest): Promise<unknown> {
  const clauses = ['is_deleted = 0']
  const args: JsonValue[] = []
  const entrepriseId = currentEntrepriseId()
  if (entrepriseId !== null) {
    clauses.push('entreprise_id = ?')
    args.push(entrepriseId)
  }
  const search = str(req.params.search).trim()
  if (search) {
    clauses.push('(nom LIKE ? OR numero LIKE ?)')
    args.push(`%${search}%`, `%${search}%`)
  }
  const statut = strOrNull(req.params.statut)
  if (statut) {
    clauses.push('statut = ?')
    args.push(statut)
  }
  const clientId = int(req.params.client_id, 0)
  if (clientId > 0) {
    clauses.push('client_id = ?')
    args.push(clientId)
  }
  const chefId = int(req.params.chef_id, 0)
  if (chefId > 0) {
    clauses.push('chef_chantier_id = ?')
    args.push(chefId)
  }

  const { page, size, offset } = pagination(req.params)
  const where = clauses.join(' AND ')
  const total = int((await dbQuery(`SELECT COUNT(*) AS total FROM chantiers WHERE ${where}`, args))[0]?.total, 0)
  const rows = await dbQuery(
    `SELECT ${CHANTIER_LIST_COLUMNS.join(', ')} FROM chantiers WHERE ${where} ORDER BY id ASC LIMIT ? OFFSET ?`,
    [...args, size, offset],
  )
  return {
    items: rows.map((r) => serializerBooleens(r, ['is_deleted'])),
    total,
    page,
    size,
  }
}

function joursEntre(debut: string, fin: string): number {
  const d = Date.parse(`${debut}T00:00:00`)
  const f = Date.parse(`${fin}T00:00:00`)
  if (Number.isNaN(d) || Number.isNaN(f)) return 0
  return Math.round((f - d) / 86_400_000)
}

/** Réplique de `calculer_impact_climatique` (aleas_climatiques.py). */
function calculerImpactClimatique(
  incidents: LocalRow[],
  dateFinPrevue: unknown,
  dateFinReelle: unknown,
  aujourdhui: string,
): { jours_arret_climatique: number; retard_brut_jours: number; retard_net_jours: number } {
  let joursArret = 0
  for (const i of incidents) {
    const typeAlea = str(i.type_alea).trim()
    if (typeAlea && str(i.imputabilite) === 'climatique' && !boolSql(i.is_deleted)) {
      joursArret += int(i.impact_arret_jours, 0)
    }
  }
  const finPrevue = strOrNull(dateFinPrevue)
  const finReelle = strOrNull(dateFinReelle)
  const finReference = finReelle ?? aujourdhui
  let retardBrut = 0
  if (finPrevue && finReference > finPrevue) {
    retardBrut = joursEntre(finPrevue, finReference)
  }
  return {
    jours_arret_climatique: joursArret,
    retard_brut_jours: retardBrut,
    retard_net_jours: Math.max(0, retardBrut - joursArret),
  }
}

/** Requête « sûre » : une table absente du schéma local ne casse pas la page. */
async function dbQueryOptionnel(sql: string, args: JsonValue[] = []): Promise<LocalRow[]> {
  try {
    return await dbQuery(sql, args)
  } catch (err) {
    console.warn('[desktop] Requête optionnelle impossible :', err)
    return []
  }
}

/** GET chantiers/{id} — réplique `get_chantier` (chantiers.py), sous-ressources incluses. */
async function getChantierLocal(req: LocalRequest): Promise<unknown> {
  const id = int(req.pathParams[0], 0)
  const rows = await dbQuery(
    `SELECT ${CHANTIER_RESPONSE_COLUMNS.join(', ')} FROM chantiers WHERE id = ? AND is_deleted = 0`,
    [id],
  )
  const chantier = rows[0]
  if (!chantier) {
    throw localError(404, 'Chantier non trouvé')
  }
  const entrepriseId = currentEntrepriseId()
  if (entrepriseId !== null && int(chantier.entreprise_id, -1) !== entrepriseId) {
    throw localError(403, 'Accès refusé')
  }

  const [phases, incidents, affectations] = await Promise.all([
    dbQueryOptionnel('SELECT * FROM phases WHERE chantier_id = ? AND is_deleted = 0 ORDER BY id ASC', [id]),
    dbQueryOptionnel('SELECT * FROM incidents WHERE chantier_id = ? AND is_deleted = 0 ORDER BY id ASC', [id]),
    dbQueryOptionnel('SELECT * FROM affectation_chantiers WHERE chantier_id = ? AND is_deleted = 0 ORDER BY id ASC', [id]),
  ])

  return {
    ...serializerBooleens(chantier, ['is_deleted']),
    phases,
    incidents,
    affectations,
    impact_climatique: calculerImpactClimatique(
      incidents,
      chantier.date_fin_prevue,
      chantier.date_fin_reelle,
      dateLocale(),
    ),
  }
}

/**
 * POST rh/pointages — réplique `create_pointage` (rh.py), ÉCRITURE LOCALE :
 * INSERT métier + INSERT `_sync_outbox` dans UNE SEULE transaction `db_exec_batch`.
 */
async function createPointageLocal(req: LocalRequest): Promise<unknown> {
  const body = req.data
  const employeId = int(body.employe_id, 0)
  if (employeId < 1) {
    throw localError(422, 'employe_id : champ obligatoire (valeur ≥ 1 attendue).')
  }
  const dateJour = strOrNull(body.date_jour)
  if (!dateJour) {
    throw localError(422, 'date_jour : champ obligatoire.')
  }
  const typePointage = str(body.type) || 'present'
  if (!TYPES_POINTAGE.includes(typePointage)) {
    throw localError(422, `Type invalide. Valeurs autorisées : ${TYPES_POINTAGE.join(', ')}`)
  }
  let heuresTotal = 0
  if ('heures_total' in body) {
    heuresTotal = floatOrNull(body.heures_total) ?? 0
    if (heuresTotal < 0) {
      throw localError(422, 'Les heures ne peuvent pas être négatives')
    }
  }

  const maintenant = new Date()
  const horodatage = horodatageLocal(maintenant)
  const clientRef = uuid()
  const valeurs: SqlArg[] = [
    currentEntrepriseId() ?? intOrNull(body.entreprise_id),
    employeId,
    intOrNull(body.chantier_id),
    dateJour,
    normaliserHeure(body.heure_debut),
    normaliserHeure(body.heure_fin),
    heuresTotal,
    typePointage,
    'manuel',
    null,
    null,
    null,
    'valide',
    strOrNull(body.notes),
    0,
    horodatage,
    horodatage,
  ]

  const payload = JSON.stringify({
    entreprise_id: valeurs[0],
    employe_id: employeId,
    chantier_id: valeurs[2],
    date_jour: dateJour,
    heure_debut: valeurs[4],
    heure_fin: valeurs[5],
    heures_total: heuresTotal,
    type: typePointage,
    notes: valeurs[13],
    client_ref: clientRef,
  })

  // Transaction unique : écriture métier + outbox (règle du plan §6.1).
  const resultat = await dbExecBatch([
    {
      sql: `INSERT INTO pointages (
        entreprise_id, employe_id, chantier_id, date_jour, heure_debut, heure_fin,
        heures_total, type, methode_pointage, scanne_par_id, latitude, longitude,
        statut_validation, notes, is_deleted, created_at, updated_at,
        sync_version, client_ref, client_ts
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      args: [...valeurs, clientRef, horodatage],
    },
    {
      sql: `INSERT INTO _sync_outbox (entity, entity_id, op, payload, client_ts, pushed)
            VALUES (?, ?, ?, ?, ?, 0)`,
      args: ['pointage', clientRef, 'create', payload, horodatage],
    },
  ])

  // `last_id` porte sur la dernière ligne insérée (l'outbox) : on retrouve donc
  // l'id métier via son client_ref (UUID fraîchement généré).
  const idRows = await dbQuery('SELECT id FROM pointages WHERE client_ref = ? LIMIT 1', [clientRef])
  const nouveauId = int(idRows[0]?.id, int(resultat.last_id, 0))

  return {
    id: nouveauId,
    entreprise_id: valeurs[0],
    employe_id: employeId,
    chantier_id: valeurs[2],
    date_jour: dateJour,
    heure_debut: valeurs[4],
    heure_fin: valeurs[5],
    heures_total: heuresTotal,
    type: typePointage,
    methode_pointage: 'manuel',
    scanne_par_id: null,
    latitude: null,
    longitude: null,
    statut_validation: 'valide',
    notes: valeurs[13],
    is_deleted: false,
    created_at: horodatage,
    updated_at: horodatage,
  }
}

/**
 * POST rh/pointages/scan-badge — réplique fidèle de `scan_badge_pointage` (rh.py) :
 * lookup du badge QR, bascule entrée/sortie sur le pointage du jour, écriture
 * locale atomique + outbox.
 */
async function scanBadgeLocal(req: LocalRequest): Promise<unknown> {
  const body = req.data
  const codeQr = str(body.code_qr_badge)
  const entrepriseId = currentEntrepriseId()

  const employeClauses = ['code_qr_badge = ?', 'is_deleted = 0']
  const employeArgs: JsonValue[] = [codeQr || '']
  if (entrepriseId !== null) {
    employeClauses.push('entreprise_id = ?')
    employeArgs.push(entrepriseId)
  }
  const employeRows = await dbQuery(
    `SELECT id, nom, prenom, poste, matricule, entreprise_id FROM employes
     WHERE ${employeClauses.join(' AND ')} LIMIT 1`,
    employeArgs,
  )
  const employe = employeRows[0]
  if (!employe) {
    throw localError(404, 'Badge QR invalide ou employé inconnu')
  }

  const maintenant = new Date()
  const jour = dateLocale(maintenant)
  const heure = heureLocale(maintenant)
  const heureHM = heureCourte(maintenant)
  const horodatage = horodatageLocal(maintenant)

  const employeId = int(employe.id, 0)
  const chantierId = intOrNull(body.chantier_id)
  const latitude = floatOrNull(body.latitude)
  const longitude = floatOrNull(body.longitude)
  const notesSaisies = strOrNull(body.notes)
  const libelle = `${employe.prenom || ''} ${employe.nom}`
  const scanneParId = currentUserId()

  const existants = await dbQuery(
    `SELECT ${POINTAGE_COLUMNS.join(', ')}, client_ref FROM pointages
     WHERE employe_id = ? AND date_jour = ? AND is_deleted = 0 LIMIT 1`,
    [employeId, jour],
  )
  const pointage = existants[0]

  // --- Pas de pointage du jour → ENTRÉE ---
  if (!pointage) {
    const clientRef = uuid()
    const valeurs: SqlArg[] = [
      employe.entreprise_id === undefined || employe.entreprise_id === null
        ? entrepriseId
        : int(employe.entreprise_id, 0),
      employeId,
      chantierId,
      jour,
      heure,
      null,
      0,
      'present',
      'scan_badge_par_chef',
      scanneParId,
      latitude,
      longitude,
      'valide',
      notesSaisies || 'Entrée enregistrée par scan de badge QR',
      0,
      horodatage,
      horodatage,
    ]
    const payload = JSON.stringify({
      employe_id: employeId,
      chantier_id: chantierId,
      date_jour: jour,
      heure_debut: heure,
      type: 'present',
      methode_pointage: 'scan_badge_par_chef',
      statut_validation: 'valide',
      client_ref: clientRef,
    })

    const resultat = await dbExecBatch([
      {
        sql: `INSERT INTO pointages (
          entreprise_id, employe_id, chantier_id, date_jour, heure_debut, heure_fin,
          heures_total, type, methode_pointage, scanne_par_id, latitude, longitude,
          statut_validation, notes, is_deleted, created_at, updated_at,
          sync_version, client_ref, client_ts
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        args: [...valeurs, clientRef, horodatage],
      },
      {
        sql: `INSERT INTO _sync_outbox (entity, entity_id, op, payload, client_ts, pushed)
              VALUES (?, ?, ?, ?, ?, 0)`,
        args: ['pointage', clientRef, 'create', payload, horodatage],
      },
    ])
    const idRows = await dbQuery('SELECT id FROM pointages WHERE client_ref = ? LIMIT 1', [clientRef])
    const nouveauId = int(idRows[0]?.id, int(resultat.last_id, 0))

    return {
      status: 'entree_enregistree',
      message: `Entrée validée à ${heureHM} pour ${libelle}`,
      employe: {
        id: employeId,
        nom: employe.nom,
        prenom: employe.prenom,
        poste: employe.poste,
        matricule: employe.matricule,
      },
      pointage_id: nouveauId,
      heure_debut: heure,
      heure_fin: null,
    }
  }

  // --- Déjà pointé aujourd'hui → SORTIE (calcul des heures) ---
  const pointageId = int(pointage.id, 0)
  const heureDebut = strOrNull(pointage.heure_debut)
  let heuresTotal: number
  if (heureDebut) {
    const [h, m] = heureDebut.split(':')
    const debutHeures = int(h, 0) + int(m, 0) / 60
    const finHeures = maintenant.getHours() + maintenant.getMinutes() / 60
    heuresTotal = Math.max(0, Math.round((finHeures - debutHeures) * 100) / 100)
  } else {
    heuresTotal = 8.0
  }
  const nouvellesNotes = `${str(pointage.notes)} | Sortie enregistrée par scan badge à ${heureHM}`
  const clientRef = str(pointage.client_ref) || uuid()
  const payload = JSON.stringify({
    id: pointageId,
    date_jour: jour,
    heure_fin: heure,
    heures_total: heuresTotal,
    notes: nouvellesNotes,
    client_ref: clientRef,
  })

  await dbExecBatch([
    {
      sql: `UPDATE pointages
            SET heure_fin = ?, heures_total = ?, notes = ?, updated_at = ?,
                client_ts = ?, sync_version = COALESCE(sync_version, 0) + 1, client_ref = ?
            WHERE id = ?`,
      args: [heure, heuresTotal, nouvellesNotes, horodatage, horodatage, clientRef, pointageId],
    },
    {
      sql: `INSERT INTO _sync_outbox (entity, entity_id, op, payload, client_ts, pushed)
            VALUES (?, ?, ?, ?, ?, 0)`,
      args: ['pointage', clientRef, 'update', payload, horodatage],
    },
  ])

  return {
    status: 'sortie_enregistree',
    message: `Sortie validée à ${heureHM} pour ${libelle} (${formatHeures(heuresTotal)}h)`,
    employe: {
      id: employeId,
      nom: employe.nom,
      prenom: employe.prenom,
      poste: employe.poste,
      matricule: employe.matricule,
    },
    pointage_id: pointageId,
    heure_debut: heureDebut,
    heure_fin: heure,
    heures_total: heuresTotal,
  }
}

/** Résout la fiche employé du compte connecté (par email), comme `_get_employe` (employe_terrain.py). */
async function resoudreEmployeLocal(): Promise<LocalRow> {
  const email = str(currentUser()?.email).trim().toLowerCase()
  if (!email) {
    throw localError(404, 'Aucune fiche employe rattachee a votre compte')
  }
  const rows = await dbQuery(
    `SELECT id, nom, prenom, poste, matricule, email, entreprise_id FROM employes
     WHERE lower(email) = ? AND is_deleted = 0 LIMIT 1`,
    [email],
  )
  if (!rows[0]) {
    throw localError(404, 'Aucune fiche employe rattachee a votre compte. Contactez votre administrateur.')
  }
  return rows[0]
}

/** GET employe-terrain/pointages — mes pointages (réplique `get_mes_pointages`). */
async function listMesPointagesLocal(): Promise<unknown> {
  const employe = await resoudreEmployeLocal()
  const rows = await dbQuery(
    `SELECT ${POINTAGE_COLUMNS.join(', ')} FROM pointages
     WHERE employe_id = ? AND is_deleted = 0
     ORDER BY date_jour DESC, heure_debut DESC`,
    [int(employe.id, 0)],
  )
  return { items: rows.map(serializerPointage) }
}

/** GET employe-terrain/presence — pointage du jour du compte connecté (réplique `get_ma_presence`). */
async function maPresenceLocale(): Promise<unknown> {
  const employe = await resoudreEmployeLocal()
  const rows = await dbQuery(
    `SELECT ${POINTAGE_COLUMNS.join(', ')} FROM pointages
     WHERE employe_id = ? AND date_jour = ? AND is_deleted = 0 LIMIT 1`,
    [int(employe.id, 0), dateLocale()],
  )
  return { pointage: rows[0] ? serializerPointage(rows[0]) : null }
}

/** Routes servies localement en SQLite (clé : `"<MÉTHODE> <chemin sans /api>"`). */
const LOCAL_ROUTES: Record<string, LocalHandler> = {
  'GET rh/pointages': listPointagesLocal,
  'POST rh/pointages': createPointageLocal,
  'POST rh/pointages/scan-badge': scanBadgeLocal,
  'GET chantiers': listChantiersLocal,
  'GET rh/employes': listEmployesLocal,
  'GET employe-terrain/pointages': listMesPointagesLocal,
  'GET employe-terrain/presence': maPresenceLocale,
}

/** Routes locales à paramètre (ex. `GET chantiers/42`). */
const LOCAL_ROUTE_PATTERNS: Array<{ pattern: RegExp; handler: LocalHandler }> = [
  { pattern: /^GET chantiers\/(\d+)$/, handler: getChantierLocal },
]

// ---------------------------------------------------------------------------
// Pont avec l'intercepteur axios (api.ts)
// ---------------------------------------------------------------------------

export interface LocalRouteResult {
  /** true → laisser axios faire la requête réelle (relais online). */
  passThrough: boolean
  data?: unknown
  status?: number
}

function normaliserRequete(config: InternalAxiosRequestConfig): { method: string; path: string } {
  let url = str(config.url)
  const sansQuery = url.split('?')[0]
  if (/^https?:\/\//i.test(sansQuery)) {
    try {
      url = new URL(sansQuery).pathname
    } catch {
      url = sansQuery
    }
  } else {
    url = sansQuery
  }
  url = url.replace(/^\/+/, '').replace(/\/+$/, '')
  if (url.startsWith('api/')) url = url.slice(4)
  return { method: str(config.method).toUpperCase() || 'GET', path: url }
}

function corps(config: InternalAxiosRequestConfig): Record<string, unknown> {
  const data = config.data
  if (data === null || data === undefined) return {}
  if (typeof data === 'string') {
    try {
      const parsed: unknown = JSON.parse(data)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {}
    } catch {
      return {}
    }
  }
  return typeof data === 'object' ? (data as Record<string, unknown>) : {}
}

/**
 * Point d'entrée du pont : tente d'abord le handler local, relaie ensuite vers
 * axios (online) ou rejette proprement hors-ligne.
 */
export async function handleLocalRequest(config: InternalAxiosRequestConfig): Promise<LocalRouteResult> {
  const { method, path } = normaliserRequete(config)
  const cle = `${method} ${path}`
  const req: LocalRequest = {
    method,
    path,
    params: (config.params ?? {}) as Record<string, unknown>,
    data: corps(config),
    pathParams: [],
  }

  const handler = LOCAL_ROUTES[cle]
  if (handler) {
    return { passThrough: false, data: await handler(req), status: LOCAL_STATUS[cle] ?? 200 }
  }
  for (const route of LOCAL_ROUTE_PATTERNS) {
    const m = route.pattern.exec(cle)
    if (m) {
      req.pathParams = m.slice(1)
      return { passThrough: false, data: await route.handler(req), status: LOCAL_STATUS[cle] ?? 200 }
    }
  }

  // Route non locale : relais online (comportement web actuel), sinon message clair.
  if (!(await isOnline())) {
    throw localError(503, MESSAGE_HORS_LIGNE, config)
  }
  return { passThrough: true }
}
