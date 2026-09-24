/**
 * Routes locales desktop — MODULE ALERTES & SETTINGS (alertes, paramètres
 * d'application, préférences, utilisateurs, historique de logins en lecture —
 * Phase 4). Voir l'en-tête de `local/stocks.routes.ts` pour le contrat commun.
 *
 * - Chaque handler renvoie le MÊME JSON que le endpoint FastAPI correspondant ;
 *   POST → 201 (statuts dans le 2e arg de `registerLocalRoutes`).
 * - Aucune écriture de ce module n'utilise `_sync_outbox` : alertes, paramètres,
 *   préférences et utilisateurs sont hors entités canoniques
 *   (`chantier`/`tache`/`incident`) — chaque écriture porte le commentaire
 *   `// PHASE 4B : sync de cette entité à brancher.`
 * Chemins exacts : `Web/frontend/src/services/alertes.service.ts`,
 * `settings.service.ts` + appels `api.*` de `src/pages/settings/*` et
 * `src/pages/historique-logins/*` (audit-logs).
 */
import { registerLocalPattern, registerLocalRoutes, type LocalRequest } from './registry'
import {
  boolSql,
  clausesTenant,
  currentEntrepriseId,
  currentUser,
  currentUserId,
  dbExecBatch,
  dbQuery,
  horodatageLocal,
  int,
  intOrNull,
  localError,
  pagination,
  serializerBooleens,
  str,
  strOrNull,
  uuid,
  type JsonValue,
  type LocalRow,
} from './helpers'

// ---------------------------------------------------------------------------
// Constantes métier (calées sur schemas/{alerte,utilisateur,entreprise}.py)
// ---------------------------------------------------------------------------

/** `AlerteList` (schéma alerte.py) — la liste backend est une liste bare. */
const ALERTE_LIST_COLS =
  'id, entreprise_id, titre, type_entite, entite_id, niveau_gravite, statut, lue, created_at'

const CHAMPS_ENTREPRISE_STR = [
  'nom', 'nom_commercial', 'adresse', 'code_postal', 'ville', 'telephone',
  'email', 'logo', 'abonnement', 'devise', 'siret', 'numero_tva', 'code_ape',
  'site_web', 'prefixe_devis', 'prefixe_facture', 'prefixe_contrat',
  'prefixe_employe', 'prefixe_employe_journalier', 'mentions_legales',
  'couleurs_roles', 'entete_badge',
]
const CHAMPS_ENTREPRISE_NUM = ['tva_defaut', 'delai_paiement_defaut', 'validite_devis']

const CHAMPS_PREFERENCE = [
  'theme', 'langue', 'date_format', 'devise',
  'notif_email', 'notif_push', 'notif_factures_retard', 'notif_stock_bas',
]
const CHAMPS_NOTIF = ['notif_email', 'notif_push', 'notif_factures_retard', 'notif_stock_bas']

const STATUTS_UTILISATEUR = ['actif', 'inactif', 'invite', 'suspendu']

/** Requête utilisateur + rôle (droite `UtilisateurResponse` / `UtilisateurList`). */
const UTILISATEUR_SQL = `SELECT utilisateurs.id, utilisateurs.entreprise_id, utilisateurs.role_id,
  roles.code AS role_code, roles.nom AS role_nom, utilisateurs.nom, utilisateurs.prenom,
  utilisateurs.email, utilisateurs.telephone, utilisateurs.photo, utilisateurs.statut,
  utilisateurs.date_creation, utilisateurs.derniere_connexion,
  utilisateurs.must_change_password, utilisateurs.created_at, utilisateurs.updated_at
  FROM utilisateurs LEFT JOIN roles ON roles.id = utilisateurs.role_id`

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Liste au format `repr` Python des messages pydantic (`{sorted(...)}`). */
function listePython(valeurs: readonly string[]): string {
  return `[${[...valeurs].sort().map((v) => `'${v}'`).join(', ')}]`
}

/** Paramètre booléen d'URL reçu depuis axios (boolean JS ou chaîne). */
function paramBooleen(v: unknown): boolean {
  return v === true || v === 1 || v === '1' || v === 'true'
}

function paramPresents(v: unknown): boolean {
  return v !== undefined && v !== null && v !== ''
}

/** `UtilisateurResponse` : row (avec rôle joint) → JSON FastAPI. */
function serializerUtilisateur(row: LocalRow): LocalRow {
  const roleId = intOrNull(row.role_id)
  const roleCode = strOrNull(row.role_code)
  const roleNom = strOrNull(row.role_nom)
  return {
    id: int(row.id, 0),
    entreprise_id: intOrNull(row.entreprise_id),
    role_id: roleId,
    role_code: roleCode,
    role_nom: roleNom,
    role: roleId !== null ? { id: roleId, code: roleCode, nom: roleNom } : null,
    nom: str(row.nom),
    prenom: strOrNull(row.prenom),
    email: str(row.email),
    telephone: strOrNull(row.telephone),
    photo: strOrNull(row.photo),
    statut: strOrNull(row.statut),
    date_creation: strOrNull(row.date_creation),
    derniere_connexion: strOrNull(row.derniere_connexion),
    must_change_password: boolSql(row.must_change_password),
    created_at: strOrNull(row.created_at),
    updated_at: strOrNull(row.updated_at),
  }
}

/** `UtilisateurList` : sous-ensemble de la shape pour la liste paginée. */
function serializerUtilisateurListe(row: LocalRow): LocalRow {
  const roleId = intOrNull(row.role_id)
  const roleCode = strOrNull(row.role_code)
  const roleNom = strOrNull(row.role_nom)
  return {
    id: int(row.id, 0),
    nom: str(row.nom),
    prenom: strOrNull(row.prenom),
    email: str(row.email),
    telephone: strOrNull(row.telephone),
    role_id: roleId,
    role_code: roleCode,
    role_nom: roleNom,
    role: roleId !== null ? { id: roleId, code: roleCode, nom: roleNom } : null,
    statut: strOrNull(row.statut),
    entreprise_id: intOrNull(row.entreprise_id),
    date_creation: strOrNull(row.date_creation),
  }
}

/** `PreferenceResponse` (preferences.py) : row SQLite → JSON FastAPI. */
function serializerPreference(row: LocalRow): LocalRow {
  const theme = str(row.theme)
  return {
    theme: theme === 'light' || theme === 'dark' ? theme : 'light',
    langue: str(row.langue) || 'fr',
    date_format: str(row.date_format) || 'DD/MM/YYYY',
    devise: str(row.devise) || 'MGA',
    notif_email: boolSql(row.notif_email),
    notif_push: boolSql(row.notif_push),
    notif_factures_retard: boolSql(row.notif_factures_retard),
    notif_stock_bas: boolSql(row.notif_stock_bas),
  }
}

function valeursPreferenceDefaut(horodatage: string): Record<string, JsonValue> {
  return {
    theme: 'light',
    langue: 'fr',
    date_format: 'DD/MM/YYYY',
    devise: 'MGA',
    notif_email: 1,
    notif_push: 1,
    notif_factures_retard: 1,
    notif_stock_bas: 1,
    is_deleted: 0,
    created_at: horodatage,
    updated_at: horodatage,
  }
}

/** Validations `UtilisateurCreate` (mêmes messages FR que les validators pydantic). */
function validerUtilisateurCreate(body: Record<string, unknown>): void {
  const nom = str(body.nom).trim()
  if (!nom) {
    throw localError(422, 'nom : champ obligatoire.')
  }
  validerEmail(str(body.email))
  validerMotDePasse(str(body.password))
}

function validerEmail(email: string): void {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw localError(422, "email : format d'adresse électronique invalide.")
  }
}

function validerMotDePasse(mdp: string): void {
  if (mdp.length < 8) {
    throw localError(422, 'Le mot de passe doit contenir au moins 8 caractères')
  }
  if (!/[A-Z]/.test(mdp)) {
    throw localError(422, 'Le mot de passe doit contenir au moins une majuscule')
  }
  if (!/[a-z]/.test(mdp)) {
    throw localError(422, 'Le mot de passe doit contenir au moins une minuscule')
  }
  if (!/[0-9]/.test(mdp)) {
    throw localError(422, 'Le mot de passe doit contenir au moins un chiffre')
  }
  if (!/[^A-Za-z0-9]/.test(mdp)) {
    throw localError(422, 'Le mot de passe doit contenir au moins un caractère spécial')
  }
}

/** Charge un utilisateur (404 / 403 tenant), réplique des routes PUT utilisateurs. */
async function chargerUtilisateur(id: number): Promise<LocalRow> {
  const rows = await dbQuery(
    'SELECT id, entreprise_id, email, statut FROM utilisateurs WHERE id = ? AND is_deleted = 0',
    [id],
  )
  const user = rows[0]
  if (!user) {
    throw localError(404, 'Utilisateur non trouvé')
  }
  const entrepriseId = currentEntrepriseId()
  if (entrepriseId !== null && intOrNull(user.entreprise_id) !== entrepriseId) {
    throw localError(403, 'Accès refusé')
  }
  return user
}

/** Résout l'id réel d'un rôle depuis son code (`roles`), null si inconnu. */
async function resoudreRoleId(roleCode: string): Promise<number | null> {
  const rows = await dbQuery(
    "SELECT id FROM roles WHERE code = ? AND is_deleted = 0 LIMIT 1",
    [roleCode],
  )
  return rows[0] ? intOrNull(rows[0].id) : null
}

// ---------------------------------------------------------------------------
// ALERTES (alertes.py) — PHASE 4B : sync de cette entité à brancher.
// ---------------------------------------------------------------------------

/** GET alertes — réplique `list_alertes` : liste bare `AlerteList` (paginée 1/25 par défaut). */
async function listAlertesLocal(req: LocalRequest): Promise<unknown> {
  const { clauses, args } = clausesTenant()
  if (paramPresents(req.params.non_lues)) {
    clauses.push('lue = ?')
    args.push(paramBooleen(req.params.non_lues) ? 0 : 1)
  }
  const gravite = strOrNull(req.params.gravite)
  if (gravite) {
    clauses.push('niveau_gravite = ?')
    args.push(gravite)
  }
  const typeEntite = strOrNull(req.params.type_entite)
  if (typeEntite) {
    clauses.push('type_entite = ?')
    args.push(typeEntite)
  }
  const { page, size, offset } = pagination(req.params)
  const rows = await dbQuery(
    `SELECT ${ALERTE_LIST_COLS} FROM alertes WHERE ${clauses.join(' AND ')}
     ORDER BY id ASC LIMIT ? OFFSET ?`,
    [...args, size, offset],
  )
  return rows.map((r) => serializerBooleens(r, ['lue']))
}

/** POST alertes/{id}/lue — réplique `marquer_lue` → `{message}`. */
async function marquerAlerteLueLocal(req: LocalRequest): Promise<unknown> {
  const id = int(req.pathParams[0], 0)
  const rows = await dbQuery('SELECT id FROM alertes WHERE id = ? AND is_deleted = 0', [id])
  if (!rows[0]) {
    throw localError(404, 'Alerte non trouvée')
  }
  const horodatage = horodatageLocal()
  // PHASE 4B : sync de cette entité à brancher.
  await dbExecBatch([
    {
      sql: 'UPDATE alertes SET lue = 1, date_lecture = ?, updated_at = ? WHERE id = ?',
      args: [horodatage, horodatage, id],
    },
  ])
  return { message: 'Alerte marquée comme lue' }
}

/** POST alertes/marquer-toutes-lues — réplique `marquer_toutes_lues` → `{message}`. */
async function marquerToutesLuesLocal(): Promise<unknown> {
  const { clauses, args } = clausesTenant()
  const horodatage = horodatageLocal()
  // PHASE 4B : sync de cette entité à brancher.
  await dbExecBatch([
    {
      sql: `UPDATE alertes SET lue = 1, date_lecture = ?, updated_at = ?
            WHERE ${clauses.join(' AND ')} AND lue = 0`,
      args: [horodatage, horodatage, ...args],
    },
  ])
  return { message: 'Toutes les alertes ont été marquées comme lues' }
}

// ---------------------------------------------------------------------------
// PARAMÈTRES — ENTREPRISE (parametres.py) — PHASE 4B : sync à brancher.
// ---------------------------------------------------------------------------

async function chargerEntreprise(): Promise<LocalRow> {
  const entrepriseId = currentEntrepriseId()
  if (entrepriseId === null) {
    throw localError(400, 'Entreprise ID manquant')
  }
  const rows = await dbQuery('SELECT * FROM entreprises WHERE id = ?', [entrepriseId])
  if (!rows[0]) {
    throw localError(404, 'Entreprise non trouvée')
  }
  return rows[0]
}

/** GET parametres/entreprise — réplique `get_entreprise` → `{entreprise: model_to_dict}`. */
async function getEntrepriseLocale(): Promise<unknown> {
  const entreprise = await chargerEntreprise()
  return { entreprise: serializerBooleens({ ...entreprise }, ['actif', 'is_deleted']) }
}

/** PUT parametres/entreprise — réplique `update_entreprise` → `{entreprise}`. */
async function updateEntrepriseLocale(req: LocalRequest): Promise<unknown> {
  const entreprise = await chargerEntreprise()
  const body = req.data
  if ('nom' in body && body.nom !== null && body.nom !== undefined && String(body.nom).trim() === '') {
    throw localError(422, 'nom : champ obligatoire.')
  }

  const sets: string[] = []
  const args: JsonValue[] = []
  for (const champ of CHAMPS_ENTREPRISE_STR) {
    if (champ in body) {
      sets.push(`${champ} = ?`)
      args.push(strOrNull(body[champ]))
    }
  }
  for (const champ of CHAMPS_ENTREPRISE_NUM) {
    if (champ in body && body[champ] !== null && body[champ] !== undefined) {
      sets.push(`${champ} = ?`)
      args.push(champ === 'tva_defaut' ? floatLocal(body[champ]) : intOrNull(body[champ]))
    }
  }
  if ('actif' in body) {
    sets.push('actif = ?')
    args.push(paramBooleen(body.actif) ? 1 : 0)
  }

  if (sets.length > 0) {
    const horodatage = horodatageLocal()
    // PHASE 4B : sync de cette entité à brancher. (paramètres = hors entités canoniques)
    await dbExecBatch([
      {
        sql: `UPDATE entreprises SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`,
        args: [...args, horodatage, int(entreprise.id, 0)],
      },
    ])
  }
  const rows = await dbQuery('SELECT * FROM entreprises WHERE id = ?', [int(entreprise.id, 0)])
  return { entreprise: serializerBooleens({ ...rows[0] }, ['actif', 'is_deleted']) }
}

function floatLocal(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : null
}

/** POST parametres/backup — réplique `create_backup` → `{download_url}`. */
async function createBackupLocal(): Promise<unknown> {
  return { download_url: '/downloads/backup-placeholder.zip' }
}

// ---------------------------------------------------------------------------
// PARAMÈTRES — PROFIL COURANT + AUDIT LOGS (lecture seule des connexions)
// ---------------------------------------------------------------------------

/** Charge le compte connecté depuis `utilisateurs` (404 hors local). */
async function chargerUtilisateurCourant(): Promise<LocalRow> {
  const userId = currentUserId()
  if (userId === null) {
    throw localError(404, 'Utilisateur non trouvé')
  }
  const rows = await dbQuery(
    'SELECT id, entreprise_id, email FROM utilisateurs WHERE id = ? AND is_deleted = 0',
    [userId],
  )
  if (!rows[0]) {
    throw localError(404, 'Utilisateur non trouvé')
  }
  return rows[0]
}

/** PUT parametres/profile — réplique `update_profile` → `{utilisateur}` (photo verrouillée pour les employés). */
async function updateProfileLocal(req: LocalRequest): Promise<unknown> {
  const user = await chargerUtilisateurCourant()
  const body = req.data

  const roles = await dbQuery(
    `SELECT roles.code FROM utilisateurs LEFT JOIN roles ON roles.id = utilisateurs.role_id
     WHERE utilisateurs.id = ?`,
    [int(user.id, 0)],
  )
  const roleCode = str(roles[0]?.role_code)
  const estEmploye = roleCode === 'employe'

  const autorises = ['nom', 'prenom', 'telephone', 'email']
  if (!estEmploye) autorises.push('photo')

  const sets: string[] = []
  const args: JsonValue[] = []
  for (const champ of autorises) {
    if (!(champ in body)) continue
    // Réplique : les valeurs `null` sont ignorées (`if value is not None`).
    if (body[champ] === null || body[champ] === undefined) continue
    if (champ === 'email') {
      const email = str(body.email)
      if (email) validerEmail(email)
      args.push(email)
    } else {
      args.push(strOrNull(body[champ]))
    }
    sets.push(`${champ} = ?`)
  }
  if (sets.length > 0) {
    const horodatage = horodatageLocal()
    // PHASE 4B : sync de cette entité à brancher. (utilisateur = hors entités canoniques)
    await dbExecBatch([
      {
        sql: `UPDATE utilisateurs SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`,
        args: [...args, horodatage, int(user.id, 0)],
      },
    ])
  }

  const rows = await dbQuery(
    `SELECT utilisateurs.id, utilisateurs.nom, utilisateurs.prenom, utilisateurs.email,
            utilisateurs.telephone, utilisateurs.photo, roles.code AS role_code,
            utilisateurs.entreprise_id, utilisateurs.must_change_password, utilisateurs.statut
     FROM utilisateurs LEFT JOIN roles ON roles.id = utilisateurs.role_id
     WHERE utilisateurs.id = ?`,
    [int(user.id, 0)],
  )
  const u = rows[0] ?? {}
  const code = str(u.role_code)
  return {
    utilisateur: {
      id: int(u.id, 0),
      nom: str(u.nom),
      prenom: strOrNull(u.prenom),
      email: str(u.email),
      telephone: strOrNull(u.telephone),
      photo: strOrNull(u.photo),
      role_code: code || null,
      entreprise_id: intOrNull(u.entreprise_id),
      must_change_password: boolSql(u.must_change_password),
      statut: strOrNull(u.statut),
      is_employe: code === 'employe',
    },
  }
}

/**
 * GET parametres/audit-logs — réplique `list_audit_logs` → `{items,total,page,size}`
 * (lecture seule de l'historique de connexions ; défaut backend size=50).
 */
async function listAuditLogsLocal(req: LocalRequest): Promise<unknown> {
  const page = Math.max(1, int(req.params.page, 1))
  const size = Math.max(1, int(req.params.size, 50))
  const offset = (page - 1) * size

  const clauses: string[] = ['historique_connexions.is_deleted = 0']
  const args: JsonValue[] = []
  const entrepriseId = currentEntrepriseId()
  if (entrepriseId !== null) {
    clauses.push(
      'EXISTS (SELECT 1 FROM utilisateurs u2 WHERE u2.id = historique_connexions.utilisateur_id AND u2.entreprise_id = ?)',
    )
    args.push(entrepriseId)
  }
  const utilisateurId = intOrNull(req.params.utilisateur_id)
  if (utilisateurId !== null) {
    clauses.push('historique_connexions.utilisateur_id = ?')
    args.push(utilisateurId)
  }
  if (paramPresents(req.params.reussi)) {
    clauses.push('historique_connexions.reussi = ?')
    args.push(paramBooleen(req.params.reussi) ? 1 : 0)
  }
  const where = clauses.join(' AND ')

  const total = int(
    (await dbQuery(`SELECT COUNT(*) AS total FROM historique_connexions WHERE ${where}`, args))[0]
      ?.total,
    0,
  )
  const rows = await dbQuery(
    `SELECT historique_connexions.id, historique_connexions.utilisateur_id,
            utilisateurs.nom, utilisateurs.prenom, utilisateurs.email,
            roles.nom AS role,
            (SELECT poste FROM employes
             WHERE lower(employes.email) = lower(utilisateurs.email) AND employes.is_deleted = 0
             LIMIT 1) AS poste,
            historique_connexions.ip_address, historique_connexions.user_agent,
            historique_connexions.reussi, historique_connexions.date_connexion
     FROM historique_connexions
     LEFT JOIN utilisateurs ON utilisateurs.id = historique_connexions.utilisateur_id
     LEFT JOIN roles ON roles.id = utilisateurs.role_id
     WHERE ${where}
     ORDER BY historique_connexions.date_connexion DESC
     LIMIT ? OFFSET ?`,
    [...args, size, offset],
  )
  const items = rows.map((r) => ({
    id: int(r.id, 0),
    utilisateur_id: intOrNull(r.utilisateur_id),
    nom: strOrNull(r.nom),
    prenom: strOrNull(r.prenom),
    email: strOrNull(r.email),
    role: strOrNull(r.role),
    poste: strOrNull(r.poste),
    ip_address: strOrNull(r.ip_address),
    user_agent: strOrNull(r.user_agent),
    reussi: boolSql(r.reussi),
    date_connexion: strOrNull(r.date_connexion),
  }))
  return { items, total, page, size }
}

// ---------------------------------------------------------------------------
// PRÉFÉRENCES (preferences.py) — PHASE 4B : sync de cette entité à brancher.
// ---------------------------------------------------------------------------

/** GET preferences/me — réplique `get_my_preferences` (crée les valeurs par défaut si absentes). */
async function getPreferencesLocal(): Promise<unknown> {
  const userId = currentUserId()
  if (userId === null) {
    throw localError(400, 'User ID manquant')
  }
  const rows = await dbQuery(
    'SELECT * FROM preferences WHERE user_id = ? AND is_deleted = 0 LIMIT 1',
    [userId],
  )
  if (rows[0]) {
    return serializerPreference(rows[0])
  }
  const horodatage = horodatageLocal()
  const defauts = valeursPreferenceDefaut(horodatage)
  // PHASE 4B : sync de cette entité à brancher.
  await dbExecBatch([
    {
      sql: `INSERT INTO preferences (
        user_id, theme, langue, date_format, devise,
        notif_email, notif_push, notif_factures_retard, notif_stock_bas,
        is_deleted, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        userId,
        defauts.theme,
        defauts.langue,
        defauts.date_format,
        defauts.devise,
        defauts.notif_email,
        defauts.notif_push,
        defauts.notif_factures_retard,
        defauts.notif_stock_bas,
        0,
        horodatage,
        horodatage,
      ],
    },
  ])
  return serializerPreference(defauts)
}

/** PATCH preferences/me — réplique `update_my_preferences` → `PreferenceResponse`. */
async function updatePreferencesLocal(req: LocalRequest): Promise<unknown> {
  const userId = currentUserId()
  if (userId === null) {
    throw localError(400, 'User ID manquant')
  }
  const body = req.data
  if ('theme' in body && !['light', 'dark'].includes(String(body.theme))) {
    throw localError(400, 'Theme invalide')
  }

  const horodatage = horodatageLocal()
  const rows = await dbQuery(
    'SELECT * FROM preferences WHERE user_id = ? AND is_deleted = 0 LIMIT 1',
    [userId],
  )
  const existante = rows[0]

  const sets: string[] = []
  const args: JsonValue[] = []
  const final: LocalRow = existante
    ? { ...existante }
    : { ...valeursPreferenceDefaut(horodatage), user_id: userId }
  for (const champ of CHAMPS_PREFERENCE) {
    if (!(champ in body)) continue
    const valeur: JsonValue = CHAMPS_NOTIF.includes(champ)
      ? paramBooleen(body[champ]) ? 1 : 0
      : str(body[champ])
    sets.push(`${champ} = ?`)
    args.push(valeur)
    final[champ] = valeur
  }

  if (existante) {
    if (sets.length > 0) {
      // PHASE 4B : sync de cette entité à brancher.
      await dbExecBatch([
        {
          sql: `UPDATE preferences SET ${sets.join(', ')}, updated_at = ? WHERE user_id = ?`,
          args: [...args, horodatage, userId],
        },
      ])
    }
  } else {
    // PHASE 4B : sync de cette entité à brancher.
    await dbExecBatch([
      {
        sql: `INSERT INTO preferences (
          user_id, theme, langue, date_format, devise,
          notif_email, notif_push, notif_factures_retard, notif_stock_bas,
          is_deleted, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          userId,
          str(final.theme),
          str(final.langue),
          str(final.date_format),
          str(final.devise),
          int(final.notif_email, 1),
          int(final.notif_push, 1),
          int(final.notif_factures_retard, 1),
          int(final.notif_stock_bas, 1),
          0,
          horodatage,
          horodatage,
        ],
      },
    ])
  }
  return serializerPreference(final)
}

// ---------------------------------------------------------------------------
// UTILISATEURS (utilisateurs.py + pages/settings) — PHASE 4B : sync à brancher.
// ---------------------------------------------------------------------------

/** GET utilisateurs — réplique `list_utilisateurs` → `{items,total,page,size}` (UtilisateurList). */
async function listUtilisateursLocal(req: LocalRequest): Promise<unknown> {
  // Clauses qualifiées (LEFT JOIN roles : `is_deleted` serait ambigu sans préfixe).
  const clauses: string[] = ['utilisateurs.is_deleted = 0']
  const args: JsonValue[] = []
  const entrepriseId = currentEntrepriseId()
  if (entrepriseId !== null) {
    clauses.push('utilisateurs.entreprise_id = ?')
    args.push(entrepriseId)
  }
  const search = str(req.params.search).trim()
  if (search) {
    clauses.push('(utilisateurs.nom LIKE ? OR utilisateurs.email LIKE ?)')
    args.push(`%${search}%`, `%${search}%`)
  }
  const where = clauses.join(' AND ')
  const { page, size, offset } = pagination(req.params)
  const total = int(
    (await dbQuery(`SELECT COUNT(*) AS total FROM utilisateurs WHERE ${where}`, args))[0]?.total,
    0,
  )
  const rows = await dbQuery(
    `${UTILISATEUR_SQL} WHERE ${where} ORDER BY utilisateurs.id ASC LIMIT ? OFFSET ?`,
    [...args, size, offset],
  )
  return { items: rows.map(serializerUtilisateurListe), total, page, size }
}

/** POST utilisateurs — réplique `create_utilisateur` (201) → `UtilisateurResponse`. */
async function createUtilisateurLocal(req: LocalRequest): Promise<unknown> {
  const body = req.data
  validerUtilisateurCreate(body)

  const email = str(body.email).trim()
  const existants = await dbQuery(
    'SELECT id FROM utilisateurs WHERE email = ? AND is_deleted = 0 LIMIT 1',
    [email],
  )
  if (existants[0]) {
    throw localError(409, 'Un utilisateur avec cet email existe déjà')
  }

  let roleId = intOrNull(body.role_id)
  const roleCode = strOrNull(body.role_code)
  if (roleCode !== null) {
    if (roleCode === 'super_admin' && roleCourant() !== 'super_admin') {
      throw localError(403, 'Vous ne pouvez pas créer un utilisateur avec le rôle Super Administrateur.')
    }
    const resolu = await resoudreRoleId(roleCode)
    if (resolu === null) {
      throw localError(400, `Rôle invalide: ${roleCode}`)
    }
    roleId = resolu
  }

  const horodatage = horodatageLocal()
  const clientRef = uuid()
  // PHASE 4B : sync de cette entité à brancher.
  const resultat = await dbExecBatch([
    {
      sql: `INSERT INTO utilisateurs (
        entreprise_id, role_id, nom, prenom, email, telephone, mot_de_passe_hash,
        statut, must_change_password, is_deleted, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'actif', 1, 0, ?, ?)`,
      args: [
        intOrNull(body.entreprise_id) ?? currentEntrepriseId(),
        roleId,
        str(body.nom).trim(),
        strOrNull(body.prenom),
        email,
        strOrNull(body.telephone),
        // Hors-ligne : Argon2id indisponible sans dépendance npm → empreinte
        // jetable ; la connexion du compte nouvellement créé passe par le
        // serveur (auth_login online). Voir rapport d'écarts.
        `local:${clientRef}`,
        horodatage,
        horodatage,
      ],
    },
  ])
  const id = int(resultat.last_id, 0)
  const rows = await dbQuery(`${UTILISATEUR_SQL} WHERE utilisateurs.id = ?`, [id])
  return serializerUtilisateur(rows[0] ?? { id, nom: body.nom, email })
}

/** Code du rôle du compte connecté (store d'authentification), '' si inconnu. */
function roleCourant(): string {
  const profil = currentUser() as Record<string, unknown> | null
  if (!profil) return ''
  if (typeof profil.role_code === 'string') return profil.role_code
  const role = profil.role as Record<string, unknown> | undefined
  if (role && typeof role.code === 'string') return role.code
  return typeof profil.role === 'string' ? profil.role : ''
}

/** PUT utilisateurs/{id} — réplique `update_utilisateur` → `UtilisateurResponse`. */
async function updateUtilisateurLocal(req: LocalRequest): Promise<unknown> {
  const id = int(req.pathParams[0], 0)
  await chargerUtilisateur(id)
  const body = req.data

  const sets: string[] = []
  const args: JsonValue[] = []
  for (const champ of ['nom', 'prenom', 'email', 'telephone', 'photo', 'entreprise_id'] as const) {
    if (!(champ in body)) continue
    const valeur: JsonValue = champ === 'entreprise_id' ? intOrNull(body[champ]) : strOrNull(body[champ])
    if (champ === 'nom' && (valeur === null || valeur === '')) {
      throw localError(422, 'nom : champ obligatoire.')
    }
    if (champ === 'email' && valeur !== null) {
      validerEmail(str(valeur))
      const existants = await dbQuery(
        'SELECT id FROM utilisateurs WHERE email = ? AND is_deleted = 0 AND id != ? LIMIT 1',
        [str(valeur), id],
      )
      if (existants[0]) {
        throw localError(409, 'Un utilisateur avec cet email existe déjà')
      }
    }
    sets.push(`${champ} = ?`)
    args.push(valeur)
  }
  if ('statut' in body && body.statut !== null) {
    const statut = str(body.statut)
    if (!STATUTS_UTILISATEUR.includes(statut)) {
      throw localError(422, `Statut invalide. Valeurs autorisées: ${listePython(STATUTS_UTILISATEUR)}`)
    }
    sets.push('statut = ?')
    args.push(statut)
  }
  if ('role_code' in body && body.role_code !== null) {
    const roleCode = str(body.role_code)
    const resolu = await resoudreRoleId(roleCode)
    if (resolu === null) {
      throw localError(400, `Rôle invalide: ${roleCode}`)
    }
    sets.push('role_id = ?')
    args.push(resolu)
  } else if ('role_id' in body && body.role_id !== null) {
    sets.push('role_id = ?')
    args.push(intOrNull(body.role_id))
  }

  if (sets.length > 0) {
    const horodatage = horodatageLocal()
    // PHASE 4B : sync de cette entité à brancher.
    await dbExecBatch([
      {
        sql: `UPDATE utilisateurs SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`,
        args: [...args, horodatage, id],
      },
    ])
  }
  const rows = await dbQuery(`${UTILISATEUR_SQL} WHERE utilisateurs.id = ?`, [id])
  return serializerUtilisateur(rows[0] ?? { id })
}

/** POST utilisateurs/{id}/toggle-actif — réplique `toggle_utilisateur` → `{statut}`. */
async function toggleUtilisateurLocal(req: LocalRequest): Promise<unknown> {
  const id = int(req.pathParams[0], 0)
  const user = await chargerUtilisateur(id)
  const actuel = strOrNull(user.statut) || 'actif'
  const nouveau = actuel === 'actif' ? 'inactif' : 'actif'
  const horodatage = horodatageLocal()
  // PHASE 4B : sync de cette entité à brancher.
  await dbExecBatch([
    {
      sql: 'UPDATE utilisateurs SET statut = ?, updated_at = ? WHERE id = ?',
      args: [nouveau, horodatage, id],
    },
  ])
  return { statut: nouveau }
}

// ---------------------------------------------------------------------------
// Enregistrement des routes (registre partagé `local/registry.ts`)
// ---------------------------------------------------------------------------

registerLocalRoutes(
  {
    'GET alertes': listAlertesLocal,
    'POST alertes/marquer-toutes-lues': marquerToutesLuesLocal,
    'GET parametres/entreprise': getEntrepriseLocale,
    'PUT parametres/entreprise': updateEntrepriseLocale,
    'POST parametres/backup': createBackupLocal,
    'PUT parametres/profile': updateProfileLocal,
    'GET parametres/audit-logs': listAuditLogsLocal,
    'GET preferences/me': getPreferencesLocal,
    'PATCH preferences/me': updatePreferencesLocal,
    'GET utilisateurs': listUtilisateursLocal,
    'POST utilisateurs': createUtilisateurLocal,
  },
  {
    'POST utilisateurs': 201,
  },
)

registerLocalPattern(/^POST alertes\/(\d+)\/lue$/, marquerAlerteLueLocal)
registerLocalPattern(/^PUT utilisateurs\/(\d+)$/, updateUtilisateurLocal)
registerLocalPattern(/^POST utilisateurs\/(\d+)\/toggle-actif$/, toggleUtilisateurLocal)
