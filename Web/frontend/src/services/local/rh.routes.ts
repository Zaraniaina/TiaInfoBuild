/**
 * Routes locales desktop — MODULE RH complet (Phase 4) : employés (CRUD,
 * badge QR, photo, documents, changement de poste), décisions de pointage,
 * équipes, heures supplémentaires, congés (RH + Espace Terrain), paie/CSV.
 *
 * Enregistrement via `registerLocalRoutes` / `registerLocalPattern` (registre
 * partagé `local/registry.ts`) : AUCUN autre fichier n'est modifié ici.
 *
 * Contrat : chaque handler renvoie le MÊME JSON que le endpoint FastAPI
 * correspondant (lecture paginée : `{items, total, page, size}`) ; toute
 * écriture métier passe par UNE SEULE `dbExecBatch` contenant l'écriture ET sa
 * ligne `_sync_outbox` (règle §6.1), `client_ref` UUID + `sync_version = 1`
 * à la création (`COALESCE(sync_version, 1) + 1` en mise à jour).
 * Entités outbox canoniques : `employe`, `conge`, `heure_supplementaire`, et
 * `pointage` pour les décisions de validation (cohérent avec desktopClient).
 * Écritures NON canoniques (documents RH, équipes, historique de postes) :
 * sans outbox — PHASE 4B (commentaire à chaque écriture concernée).
 * Routes NON redéfinies ici (servies par `desktopClient.ts`) : `GET rh/employes`,
 * `GET/POST rh/pointages`, `POST rh/pointages/scan-badge`,
 * `GET employe-terrain/pointages`, `GET employe-terrain/presence`.
 * Chemins exacts : `services/rh.service.ts` + `services/employeTerrain.service.ts`.
 */
import { registerLocalRoutes, registerLocalPattern, type LocalRequest } from './registry'
import {
  boolSql,
  clausesTenant,
  currentEntrepriseId,
  currentUser,
  currentUserId,
  dateLocale,
  dbExecBatch,
  dbQuery,
  dbQueryOptionnel,
  floatOrNull,
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
// Constantes — colonnes, ensembles de validation et messages.
// Les listes de valeurs ci-dessous reproduisent EXACTEMENT les `sorted(...)`
// / `repr(set)` des validateurs pydantic backend (schémas employe/conge/
// equipe + rh.py), pour un message 422 identique FastAPI (détail en chaîne
// française — voir « Écarts » du rapport).
// ---------------------------------------------------------------------------

/** Colonnes business de `employes` (hors colonnes de sync internes client_ref/sync_*). */
const COLS_EMPLOYE_TOUT = [
  'id', 'entreprise_id', 'matricule', 'nom', 'prenom', 'poste', 'photo',
  'date_embauche', 'type_contrat', 'date_debut_contrat', 'date_fin_contrat',
  'salaire_base', 'telephone', 'email', 'adresse', 'mode_remuneration',
  'taux_journalier', 'taux_horaire', 'prix_tache', 'numero_cnaps', 'numero_ostie',
  'statut_declaration', 'solde_conges_annuel', 'statut', 'code_qr_badge',
  'badge_statut', 'badge_date_creation', 'badge_date_desactivation',
  'is_deleted', 'created_at', 'updated_at',
]

/** Champs numériques stockés en TEXT dans le schéma SQLite (cast obligatoire). */
const NOMBRES_EMPLOYE = [
  'salaire_base', 'taux_journalier', 'taux_horaire', 'prix_tache', 'solde_conges_annuel',
]

/** Champs transposables à l'outbox `employe` (sans id ni entreprise_id imposés serveur). */
const COLS_PAYLOAD_EMPLOYE = [
  'matricule', 'nom', 'prenom', 'poste', 'photo', 'date_embauche', 'type_contrat',
  'date_debut_contrat', 'date_fin_contrat', 'salaire_base', 'mode_remuneration',
  'taux_journalier', 'taux_horaire', 'prix_tache', 'numero_cnaps', 'numero_ostie',
  'statut_declaration', 'solde_conges_annuel', 'telephone', 'email', 'adresse',
  'statut', 'code_qr_badge', 'is_deleted', 'created_at', 'updated_at',
  'client_ref', 'sync_version',
]

const COLS_CONGE = [
  'type', 'date_debut', 'date_fin', 'nb_jours', 'statut', 'motif', 'valide_par',
  'date_validation', 'commentaire_refus', 'is_deleted', 'created_at', 'updated_at',
  'employe_id', 'client_ref', 'sync_version',
]

const COLS_HS = [
  'employe_id', 'chantier_id', 'date_hs', 'nb_heures', 'taux_majoration', 'motif',
  'statut', 'type_compensation', 'is_deleted', 'created_at', 'updated_at',
  'client_ref', 'sync_version',
]

const COLS_POINTAGE = [
  'employe_id', 'chantier_id', 'date_jour', 'heure_debut', 'heure_fin',
  'heure_pause_debut', 'heure_pause_fin', 'heures_total', 'type', 'methode_pointage',
  'scanne_par_id', 'latitude', 'longitude', 'statut_validation', 'notes',
  'is_deleted', 'created_at', 'updated_at', 'client_ref', 'sync_version',
]

const TYPES_CONTRAT = ['CDD', 'CDI', 'INTERIM', 'JOURNALIER', 'STAGE', 'TEMPS_PARTIEL']
const MODES_REMUNERATION = ['a_la_tache', 'horaire', 'journalier', 'mensuel']
const STATUTS_DECLARATION = ['cnaps', 'cnaps_ostie', 'non_declare']
const STATUTS_EMPLOYE = ['actif', 'inactif', 'refuse', 'suspendu']
const TYPES_CONGE = ['annuel', 'exceptionnel', 'maladie', 'maternite', 'sans_solde']
const CATEGORIES_DOCUMENTS_RH = [
  'autre', 'certificat', 'cnaps', 'cni', 'contrat_travail', 'cv', 'diplome',
  'lettre_motivation', 'ostie',
]
const STATUTS_EQUIPE = ['active', 'inactive', 'suspendue']

const MSG_TYPE_CONTRAT = `Type de contrat invalide. Valeurs autorisées: [${TYPES_CONTRAT.map((v) => `'${v}'`).join(', ')}]`
const MSG_MODE = `Mode de rémunération invalide. Valeurs autorisées: [${MODES_REMUNERATION.map((v) => `'${v}'`).join(', ')}]`
const MSG_DECLA = `Statut de déclaration invalide. Valeurs autorisées: [${STATUTS_DECLARATION.map((v) => `'${v}'`).join(', ')}]`
const MSG_STATUT_EMPLOYE = `Statut invalide. Valeurs autorisées: {${STATUTS_EMPLOYE.map((v) => `'${v}'`).join(', ')}}`
const MSG_TYPE_CONGE_RH = `Type de congé invalide. Valeurs autorisées: [${TYPES_CONGE.map((v) => `'${v}'`).join(', ')}]`
const MSG_TYPE_CONGE_TERRAIN = `Type invalide: [${TYPES_CONGE.map((v) => `'${v}'`).join(', ')}]`
const MSG_CATEGORIE = `Catégorie invalide. Valeurs autorisées: [${CATEGORIES_DOCUMENTS_RH.map((v) => `'${v}'`).join(', ')}]`
const MSG_STATUT_EQUIPE = `Statut invalide. Valeurs autorisées: {${STATUTS_EQUIPE.map((v) => `'${v}'`).join(', ')}}`

// ---------------------------------------------------------------------------
// Petits utilitaires — corps de requête, validation (FastAPI-style, FR).
// ---------------------------------------------------------------------------

/** Corps JSON de la requête (les endpoints multipart passent par `valeurChamp`). */
function corps(req: LocalRequest): Record<string, unknown> {
  const d: unknown = req.data
  return d && typeof d === 'object' ? (d as Record<string, unknown>) : {}
}

/** Lit un champ d'un corps `multipart/form-data` (FormData) ou JSON. */
function valeurChamp(req: LocalRequest, cle: string): unknown {
  const d: unknown = req.data
  if (typeof FormData !== 'undefined' && d instanceof FormData) {
    const v = d.get(cle)
    return v instanceof File ? v.name : v
  }
  if (d && typeof d === 'object') return (d as Record<string, unknown>)[cle]
  return undefined
}

/** Champ requis manquant/vidé (équivalent pydantic « field required » → 422). */
function requis(v: unknown, message: string): void {
  if (v === null || v === undefined || (typeof v === 'string' && !v.trim())) {
    throw localError(422, message)
  }
}

/** Date obligatoire au format AAAA-MM-JJ (pydantic `date`). */
function dateRequise(v: unknown, champ: string): string {
  const s = strOrNull(v)
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw localError(422, `Le champ ${champ} est requis (format AAAA-MM-JJ)`)
  }
  return s
}

/** Date facultative : `null` si absente/vidée, 422 si format invalide. */
function dateFacultative(v: unknown, champ: string): string | null {
  const s = strOrNull(v)
  if (s === null) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw localError(422, `Le champ ${champ} doit être une date AAAA-MM-JJ`)
  }
  return s
}

/** Email pydantic `EmailStr` → valide ou null. */
function emailValide(v: unknown): string | null {
  const s = strOrNull(v)
  if (s === null) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw localError(422, 'Adresse email invalide')
  return s
}

/** Validateur `type_contrat` (normalisé en MAJUSCULES, comme le backend). */
function validerTypeContrat(v: unknown): string | null {
  const s = strOrNull(v)
  if (s === null) return null
  const haut = s.toUpperCase()
  if (!TYPES_CONTRAT.includes(haut)) throw localError(422, MSG_TYPE_CONTRAT)
  return haut
}

function validerMode(v: unknown): string | null {
  const s = strOrNull(v)
  if (s === null) return null
  if (!MODES_REMUNERATION.includes(s)) throw localError(422, MSG_MODE)
  return s
}

function validerDecla(v: unknown): string | null {
  const s = strOrNull(v)
  if (s === null) return null
  if (!STATUTS_DECLARATION.includes(s)) throw localError(422, MSG_DECLA)
  return s
}

function validerStatutEmploye(v: unknown): string | null {
  const s = strOrNull(v)
  if (s === null) return null
  if (!STATUTS_EMPLOYE.includes(s)) throw localError(422, MSG_STATUT_EMPLOYE)
  return s
}

function validerStatutEquipe(v: unknown): string | null {
  const s = strOrNull(v)
  if (s === null) return null
  if (!STATUTS_EQUIPE.includes(s)) throw localError(422, MSG_STATUT_EQUIPE)
  return s
}

function validerCategorie(v: unknown): string | null {
  const s = strOrNull(v)
  if (s === null) return null
  if (!CATEGORIES_DOCUMENTS_RH.includes(s)) throw localError(422, MSG_CATEGORIE)
  return s
}

/** `salaire_base >= 0` (validateur backend : « Le salaire ne peut pas être négatif »). */
function salaireValide(v: unknown): number | null {
  const n = floatOrNull(v)
  if (n !== null && n < 0) throw localError(422, 'Le salaire ne peut pas être négatif')
  return n
}

/** Champ numérique `ge=0` (taux, solde de congés...). */
function geZero(v: unknown, champ: string): number | null {
  const n = floatOrNull(v)
  if (n !== null && n < 0) throw localError(422, `Le champ ${champ} ne peut pas être négatif`)
  return n
}

/** Nombre strictement positif requis (`gt=0`). */
function strictementPositif(v: unknown, champ: string): number {
  const n = floatOrNull(v)
  if (n === null) throw localError(422, `Le champ ${champ} est requis`)
  if (n <= 0) throw localError(422, `Le champ ${champ} doit être supérieur à 0`)
  return n
}

// ---------------------------------------------------------------------------
// Serialisers — JSON identique aux response_model FastAPI.
// ---------------------------------------------------------------------------

/** `EmployeResponse` (+ `historique_postes` : tableau en GET, null en POST/PUT). */
function serEmploye(row: LocalRow, historique: LocalRow[] | null = null): LocalRow {
  const out: LocalRow = {}
  for (const c of COLS_EMPLOYE_TOUT) {
    if (c === 'badge_statut' || c === 'badge_date_creation' || c === 'badge_date_desactivation') continue
    out[c] = row[c] ?? null
  }
  for (const c of NOMBRES_EMPLOYE) out[c] = floatOrNull(row[c])
  out.historique_postes = historique
  return serializerBooleens(out, ['is_deleted'])
}

/** Fiche employé « brute » (Espace Terrain : modèle sans response_model, badges inclus). */
function serEmployeTerrain(row: LocalRow): LocalRow {
  const out: LocalRow = {}
  for (const c of COLS_EMPLOYE_TOUT) out[c] = row[c] ?? null
  for (const c of NOMBRES_EMPLOYE) out[c] = floatOrNull(row[c])
  return serializerBooleens(out, ['is_deleted'])
}

/** Ligne d'historique de postes (toutes les colonnes de la table, comme backend). */
function serHistorique(row: LocalRow): LocalRow {
  const out: LocalRow = {}
  for (const c of [
    'id', 'entreprise_id', 'employe_id', 'poste', 'type_contrat', 'salaire_base',
    'date_debut', 'date_fin', 'motif_changement', 'is_deleted', 'created_at', 'updated_at',
  ]) {
    out[c] = row[c] ?? null
  }
  out.salaire_base = floatOrNull(row.salaire_base)
  return serializerBooleens(out, ['is_deleted'])
}

/** `CongeResponse` (avec `employe_nom`/`employe_prenom` si jointure effectuée). */
function serConge(row: LocalRow): LocalRow {
  const out: LocalRow = {}
  for (const c of [
    'id', 'entreprise_id', 'employe_id', 'type', 'date_debut', 'date_fin', 'statut',
    'motif', 'valide_par', 'date_validation', 'commentaire_refus', 'created_at',
    'employe_nom', 'employe_prenom',
  ]) {
    out[c] = row[c] ?? null
  }
  out.nb_jours = floatOrNull(row.nb_jours)
  return serializerBooleens(out, ['is_deleted'])
}

/** `HeureSupplementaireResponse` (détail complet, updated_at inclus). */
function serHeureSupDetail(row: LocalRow): LocalRow {
  const out: LocalRow = {}
  for (const c of [
    'id', 'entreprise_id', 'employe_id', 'chantier_id', 'date_hs', 'motif', 'statut',
    'type_compensation', 'created_at', 'updated_at',
  ]) {
    out[c] = row[c] ?? null
  }
  out.nb_heures = floatOrNull(row.nb_heures)
  out.taux_majoration = floatOrNull(row.taux_majoration)
  return serializerBooleens(out, ['is_deleted'])
}

/** `HeureSupplementaireList` (liste paginée, sans motif/updated_at). */
function serHeureSupListe(row: LocalRow): LocalRow {
  const out: LocalRow = {}
  for (const c of ['id', 'employe_id', 'chantier_id', 'date_hs', 'statut', 'type_compensation', 'created_at']) {
    out[c] = row[c] ?? null
  }
  out.nb_heures = floatOrNull(row.nb_heures)
  out.taux_majoration = floatOrNull(row.taux_majoration)
  return serializerBooleens(out, ['is_deleted'])
}

/** `DocumentRHResponse` (liste/détail documents d'un employé). */
function serDocumentRh(row: LocalRow): LocalRow {
  const out: LocalRow = {}
  for (const c of ['id', 'employe_id', 'categorie', 'nom', 'fichier_url', 'description', 'created_at']) {
    out[c] = row[c] ?? null
  }
  return serializerBooleens(out, ['is_deleted'])
}

/** Document « brut » (Espace Terrain renvoie le modèle sans response_model). */
function serDocumentTerrain(row: LocalRow): LocalRow {
  const out: LocalRow = {}
  for (const c of [
    'id', 'entreprise_id', 'client_id', 'chantier_id', 'projet_id', 'employe_id',
    'categorie', 'nom', 'fichier_url', 'mime_type', 'taille_octets', 'description',
    'created_at', 'updated_at',
  ]) {
    out[c] = row[c] ?? null
  }
  out.taille_octets = intOrNull(row.taille_octets)
  return serializerBooleens(out, ['is_deleted'])
}

/** `EquipeList` (liste paginée). */
function serEquipeListe(row: LocalRow): LocalRow {
  const out: LocalRow = {}
  for (const c of ['id', 'entreprise_id', 'chef_equipe_id', 'nom', 'specialite', 'statut', 'created_at']) {
    out[c] = row[c] ?? null
  }
  return serializerBooleens(out, ['is_deleted'])
}

/** `EquipeResponse` (détail : membres + chantiers_assignes vides hors GET détaillé). */
function serEquipeDetail(row: LocalRow): LocalRow {
  const out: LocalRow = {}
  for (const c of [
    'id', 'entreprise_id', 'chef_equipe_id', 'nom', 'description', 'specialite',
    'date_creation', 'statut', 'created_at', 'updated_at',
  ]) {
    out[c] = row[c] ?? null
  }
  out.membres = []
  out.chantiers_assignes = []
  return serializerBooleens(out, ['is_deleted'])
}

/** `PointageResponse` (décisions valider/refuser). */
function serPointage(row: LocalRow): LocalRow {
  const out: LocalRow = {}
  for (const c of [
    'id', 'entreprise_id', 'employe_id', 'chantier_id', 'date_jour', 'heure_debut',
    'heure_fin', 'heure_pause_debut', 'heure_pause_fin', 'type', 'methode_pointage',
    'scanne_par_id', 'statut_validation', 'notes', 'created_at', 'updated_at',
  ]) {
    out[c] = row[c] ?? null
  }
  out.heures_total = floatOrNull(row.heures_total)
  out.latitude = floatOrNull(row.latitude)
  out.longitude = floatOrNull(row.longitude)
  return serializerBooleens(out, ['is_deleted'])
}

// ---------------------------------------------------------------------------
// Sync — outbox et payloads (UNE dbExecBatch : métier + _sync_outbox).
// `client_ts` n'existe que sur `_sync_outbox` : jamais sur les tables métier.
// ---------------------------------------------------------------------------

const SQL_OUTBOX =
  'INSERT INTO _sync_outbox (entity, entity_id, op, payload, client_ts, pushed) VALUES (?, ?, ?, ?, ?, 0)'

function ligneOutbox(
  entity: string,
  entityId: string,
  op: 'create' | 'update' | 'delete',
  payload: Record<string, JsonValue>,
): { sql: string; args: JsonValue[] } {
  return { sql: SQL_OUTBOX, args: [entity, entityId, op, JSON.stringify(payload), horodatageLocal()] }
}

/** Payload de création à partir des paires colonnes/valeurs d'un INSERT. */
function payloadDepuis(cols: string[], vals: JsonValue[]): Record<string, JsonValue> {
  const out: Record<string, JsonValue> = {}
  cols.forEach((c, i) => {
    if (c !== 'entreprise_id') out[c] = vals[i]
  })
  return out
}

/** Payload de mise à jour à partir d'une ligne sérialisée (id/entreprise_id exclus). */
function payloadLigne(row: LocalRow, colonnes: string[]): Record<string, JsonValue> {
  const out: Record<string, JsonValue> = {}
  for (const c of colonnes) {
    if (c === 'id' || c === 'entreprise_id') continue
    const v = row[c]
    out[c] = (v === undefined ? null : v) as JsonValue
  }
  return out
}

/** `entity_id` d'une écriture : client_ref existante, sinon l'id sous forme de texte. */
function refDeLigne(row: LocalRow): string {
  return strOrNull(row.client_ref) ?? str(row.id)
}

// ---------------------------------------------------------------------------
// Accès aux lignes — 404/403 FastAPI-style.
// ---------------------------------------------------------------------------

/** Détail employé côté RH : 404 « Employé non trouvé », 403 « Accès refusé » si tenant. */
async function chargerEmploye(id: number): Promise<LocalRow> {
  const rows = await dbQuery('SELECT * FROM employes WHERE id = ?', [id])
  const row = rows[0]
  if (!row || boolSql(row.is_deleted)) throw localError(404, 'Employé non trouvé')
  const eid = currentEntrepriseId()
  if (eid !== null && intOrNull(row.entreprise_id) !== eid) throw localError(403, 'Accès refusé')
  return row
}

/** `_get_employe_rh` backend : toute anomalie (dont tenant) est un 404. */
async function chargerEmployeStrict(id: number): Promise<LocalRow> {
  const rows = await dbQuery('SELECT * FROM employes WHERE id = ?', [id])
  const row = rows[0]
  const eid = currentEntrepriseId()
  if (!row || boolSql(row.is_deleted) || (eid !== null && intOrNull(row.entreprise_id) !== eid)) {
    throw localError(404, 'Employé non trouvé')
  }
  return row
}

async function chargerConge(id: number): Promise<LocalRow> {
  const rows = await dbQuery('SELECT * FROM conges WHERE id = ?', [id])
  const row = rows[0]
  const eid = currentEntrepriseId()
  if (!row || boolSql(row.is_deleted) || (eid !== null && intOrNull(row.entreprise_id) !== eid)) {
    throw localError(404, 'Congé non trouvé')
  }
  return row
}

async function chargerHeureSup(id: number): Promise<LocalRow> {
  const rows = await dbQuery('SELECT * FROM heures_supplementaires WHERE id = ?', [id])
  const row = rows[0]
  if (!row || boolSql(row.is_deleted)) throw localError(404, 'Heure supplémentaire non trouvée')
  const eid = currentEntrepriseId()
  if (eid !== null && intOrNull(row.entreprise_id) !== eid) throw localError(403, 'Accès refusé')
  return row
}

async function chargerPointage(id: number): Promise<LocalRow> {
  const rows = await dbQuery('SELECT * FROM pointages WHERE id = ?', [id])
  const row = rows[0]
  const eid = currentEntrepriseId()
  if (!row || boolSql(row.is_deleted) || (eid !== null && intOrNull(row.entreprise_id) !== eid)) {
    throw localError(404, 'Pointage non trouvé')
  }
  return row
}

/** Résolution de la fiche terrain par l'email du compte connecté (self-only). */
async function chargerEmployeTerrain(): Promise<LocalRow> {
  const email = str(currentUser()?.email).trim().toLowerCase()
  if (!email) throw localError(404, 'Aucune fiche employe rattachee a votre compte')
  const rows = await dbQuery(
    'SELECT * FROM employes WHERE is_deleted = 0 AND lower(email) = ? ORDER BY id ASC',
    [email],
  )
  const row = rows[0]
  if (!row) {
    throw localError(404, 'Aucune fiche employe rattachee a votre compte. Contactez votre administrateur.')
  }
  return row
}

/** Solde : `float(solde_conges_annuel or 30) - congés annuels validés de l'année. */
async function calculerSolde(employe: LocalRow): Promise<{ solde_restant: number; solde_annuel: number }> {
  const brut = floatOrNull(employe.solde_conges_annuel)
  const soldeAnnuel = brut === null || brut === 0 ? 30 : brut
  const annee = new Date().getFullYear()
  const rows = await dbQuery(
    "SELECT COALESCE(SUM(CAST(nb_jours AS REAL)), 0) AS total FROM conges WHERE employe_id = ? AND type = 'annuel' AND statut = 'valide' AND is_deleted = 0 AND strftime('%Y', date_debut) = ?",
    [int(employe.id, 0), String(annee)],
  )
  const total = floatOrNull(rows[0]?.total) ?? 0
  return { solde_restant: soldeAnnuel - total, solde_annuel: soldeAnnuel }
}

/** Matricule auto-généré : PREFIXE-ANNEE-NNN (50 retries, repli HHMMSS). */
async function genererMatricule(entrepriseId: number | null, typeContrat: string | null): Promise<string> {
  let prefixe = 'EMP'
  if (entrepriseId !== null) {
    const rows = await dbQuery(
      'SELECT prefixe_employe, prefixe_employe_journalier FROM entreprises WHERE id = ?',
      [entrepriseId],
    )
    const ent = rows[0]
    if (ent) {
      prefixe =
        ((typeContrat || '').toUpperCase() === 'JOURNALIER'
          ? str(ent.prefixe_employe_journalier)
          : str(ent.prefixe_employe)) || 'EMP'
    }
  }
  prefixe = (prefixe || 'EMP').toUpperCase().slice(0, 10)
  const annee = new Date().getFullYear()
  const existants = await dbQuery(
    'SELECT matricule FROM employes WHERE matricule LIKE ? AND is_deleted = 0',
    [`${prefixe}-${annee}-%`],
  )
  let dernier = 0
  for (const r of existants) {
    dernier = Math.max(dernier, int(str(r.matricule).split('-').pop(), 0))
  }
  for (let n = dernier + 1; n <= dernier + 50; n++) {
    const candidat = `${prefixe}-${annee}-${String(n).padStart(3, '0')}`
    const rows = await dbQuery('SELECT id FROM employes WHERE matricule = ? AND is_deleted = 0', [candidat])
    if (rows.length === 0) return candidat
  }
  const d = new Date()
  const hhmmss = `${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`
  return `${prefixe}-${annee}-${hhmmss}`
}

// ---------------------------------------------------------------------------
// Paie — réplication exacte de `rapport_paie` / `export_paie_csv` (rh.py).
// ---------------------------------------------------------------------------

/** Heures décimales d'une plage HH:MM[:SS] (séances/3600 incluses). */
function versHeures(h: string | null): number | null {
  if (!h) return null
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(h)
  if (!m) return null
  return int(m[1], 0) + int(m[2], 0) / 60 + int(m[3] ?? '0', 0) / 3600
}

/** `fin - début - pause`, borné à 0 (backend `_heures_du_pointage`). */
function heuresDuPointage(row: LocalRow): number {
  const debut = versHeures(strOrNull(row.heure_debut))
  const fin = versHeures(strOrNull(row.heure_fin))
  if (debut === null || fin === null) return 0
  let pauses = 0
  const pd = versHeures(strOrNull(row.heure_pause_debut))
  const pf = versHeures(strOrNull(row.heure_pause_fin))
  if (pd !== null && pf !== null) pauses = Math.max(pf - pd, 0)
  return Math.max(fin - debut - pauses, 0)
}

/** `str(float)` Python : 8 → « 8.0 », 7.5 → « 7.5 » (repr CSV identique). */
function pyFloat(n: number): string {
  return Number.isInteger(n) ? `${n}.0` : String(n)
}

function csvNombre(n: number): string {
  return pyFloat(n).replace('.', ',')
}

function champCsv(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v)
  return /[;\n\r"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

interface LignePaieLocale {
  employe_id: number
  nom: string
  prenom: string | null
  mode_remuneration: string
  jours_valides: number
  heures_sup: number
  brut: number
}

async function construireRapportPaie(
  mois: number,
  annee: number,
  employeId: number | null,
): Promise<{ mois: number; annee: number; lignes: LignePaieLocale[]; total: number }> {
  const eid = currentEntrepriseId()
  if (eid === null) throw localError(403, 'Entreprise requise')
  const debut = `${annee}-${String(mois).padStart(2, '0')}-01`
  const finExclu = mois === 12 ? `${annee + 1}-01-01` : `${annee}-${String(mois + 1).padStart(2, '0')}-01`
  const { clauses, args } = clausesTenant()
  const whereTenant = clauses.join(' AND ')
  const employes = await dbQuery(
    `SELECT * FROM employes WHERE ${whereTenant}${employeId ? ' AND id = ?' : ''} ORDER BY id ASC`,
    employeId ? [...args, employeId] : [...args],
  )
  const pointages = await dbQuery(
    `SELECT * FROM pointages WHERE ${whereTenant} AND date_jour >= ? AND date_jour < ?`,
    [...args, debut, finExclu],
  )
  // PHASE 4B : le backend ne filtre pas les HS par entreprise ; le filtre tenant
  // local est ajouté volontairement (sécurité) — écart documenté au rapport.
  const heuresSup = await dbQuery(
    `SELECT * FROM heures_supplementaires WHERE ${whereTenant} AND statut = 'validee' AND date_hs >= ? AND date_hs < ?`,
    [...args, debut, finExclu],
  )

  const jours = new Map<number, Set<string>>()
  const heures = new Map<number, number>()
  for (const pt of pointages) {
    if (str(pt.statut_validation) === 'refuse') continue
    const ptEmp = int(pt.employe_id, 0)
    if (pt.date_jour !== null && pt.date_jour !== undefined) {
      if (!jours.has(ptEmp)) jours.set(ptEmp, new Set())
      jours.get(ptEmp)?.add(str(pt.date_jour))
    }
    heures.set(ptEmp, (heures.get(ptEmp) ?? 0) + heuresDuPointage(pt))
  }
  const hsParEmp = new Map<number, number>()
  for (const h of heuresSup) {
    const hEmp = intOrNull(h.employe_id)
    if (hEmp) {
      const majoration = floatOrNull(h.taux_majoration)
      const cumul =
        (hsParEmp.get(hEmp) ?? 0) + (floatOrNull(h.nb_heures) ?? 0) * (majoration === null ? 1.5 : majoration)
      hsParEmp.set(hEmp, cumul)
    }
  }

  const lignes: LignePaieLocale[] = []
  let total = 0
  for (const emp of employes) {
    const mode = str(emp.mode_remuneration) || 'mensuel'
    const empId = int(emp.id, 0)
    const joursValides = jours.get(empId)?.size ?? 0
    const hSup = hsParEmp.get(empId) ?? 0
    let brut: number
    if (mode === 'journalier') {
      brut = joursValides * (floatOrNull(emp.taux_journalier) ?? 0)
    } else if (mode === 'horaire') {
      brut = (heures.get(empId) ?? 0) * (floatOrNull(emp.taux_horaire) ?? 0)
    } else if (mode === 'a_la_tache') {
      brut = 0 // v1 : calcul par tâche reporté en v2
    } else {
      const base = floatOrNull(emp.salaire_base) ?? 0
      brut = base
      if (joursValides !== 0 && joursValides < 26) {
        brut = Math.round((base * joursValides) / 26 * 100) / 100
      }
      brut += hSup
    }
    lignes.push({
      employe_id: empId,
      nom: str(emp.nom),
      prenom: strOrNull(emp.prenom),
      mode_remuneration: mode,
      jours_valides: joursValides,
      heures_sup: Math.round(hSup * 100) / 100,
      brut: Math.round(brut * 100) / 100,
    })
    total += brut
  }
  return { mois, annee, lignes, total: Math.round(total * 100) / 100 }
}

/** CSV backend : BOM, séparateur `;`, décimales `,`, ligne TOTAL finale. */
function construireCsvPaie(rapport: { lignes: LignePaieLocale[]; total: number }): string {
  const lignes: string[] = []
  lignes.push(
    ['Employe ID', 'Nom', 'Prenom', 'Mode', 'Jours valides', 'Heures sup', 'Brut (Ar)']
      .map(champCsv)
      .join(';'),
  )
  for (const l of rapport.lignes) {
    lignes.push(
      [
        String(l.employe_id),
        champCsv(l.nom),
        champCsv(l.prenom),
        champCsv(l.mode_remuneration),
        csvNombre(l.jours_valides),
        csvNombre(l.heures_sup),
        csvNombre(l.brut),
      ].join(';'),
    )
  }
  lignes.push(['', '', '', '', '', 'TOTAL', csvNombre(rapport.total)].join(';'))
  return '﻿' + lignes.join('\r\n') + '\r\n'
}

// ---------------------------------------------------------------------------
// Génération du badge QR (réutilisée par `rh/employes/{id}/badge-qr`).
// ---------------------------------------------------------------------------

function nouveauCodeBadge(entrepriseId: number | null, id: number): string {
  const hex = uuid().replace(/-/g, '').slice(0, 8).toUpperCase()
  return `TIA-EMP-${entrepriseId ?? 1}-${id}-${hex}`
}

/** Infos entreprise (nom, logo, en-tête, couleur du rôle) pour les badges. */
async function infosBadge(employe: LocalRow): Promise<{
  entreprise_nom: string | null
  entreprise_logo: string | null
  entete_badge: string | null
  couleur_role: string | null
}> {
  const eid = intOrNull(employe.entreprise_id)
  let ent: LocalRow | undefined
  if (eid !== null) {
    ent = (await dbQuery('SELECT nom, logo, entete_badge, couleurs_roles FROM entreprises WHERE id = ?', [eid]))[0]
  }
  let couleurRole: string | null = null
  const email = strOrNull(employe.email)
  if (ent && strOrNull(ent.couleurs_roles) && email) {
    try {
      const charte = JSON.parse(str(ent.couleurs_roles)) as Record<string, unknown>
      const u = await dbQueryOptionnel(
        "SELECT r.code AS code FROM utilisateurs u JOIN roles r ON r.id = u.role_id WHERE lower(u.email) = ? AND u.is_deleted = 0 LIMIT 1",
        [email.trim().toLowerCase()],
      )
      const codeRole = strOrNull(u[0]?.code)
      if (codeRole && typeof charte === 'object' && charte !== null) {
        couleurRole = strOrNull(charte[codeRole])
      }
    } catch {
      couleurRole = null
    }
  }
  return {
    entreprise_nom: ent ? strOrNull(ent.nom) : null,
    entreprise_logo: ent ? strOrNull(ent.logo) : null,
    entete_badge: ent ? strOrNull(ent.entete_badge) : null,
    couleur_role: couleurRole,
  }
}

// ---------------------------------------------------------------------------
// Routes exactes (`registerLocalRoutes`) — statuts : POST → 201.
// ---------------------------------------------------------------------------

registerLocalRoutes(
  {
    // --- Employés (la liste GET reste servie par desktopClient) ---
    'POST rh/employes': async (req) => {
      const c = corps(req)
      requis(c.nom, 'Le nom est requis')
      const entrepriseId = intOrNull(c.entreprise_id) ?? currentEntrepriseId()
      if (entrepriseId === null) throw localError(422, 'Entreprise requise')

      const typeContrat = 'type_contrat' in c ? validerTypeContrat(c.type_contrat) : null
      const matricule = await genererMatricule(entrepriseId, typeContrat)
      const clientRef = uuid()
      const ts = horodatageLocal()

      const cols: string[] = [
        'entreprise_id', 'matricule', 'client_ref', 'sync_version', 'nom', 'prenom',
        'poste', 'photo', 'date_embauche', 'date_debut_contrat', 'date_fin_contrat',
        'telephone', 'email', 'adresse', 'taux_journalier', 'taux_horaire', 'prix_tache',
        'numero_cnaps', 'numero_ostie', 'is_deleted', 'created_at', 'updated_at',
      ]
      const vals: JsonValue[] = [
        entrepriseId, matricule, clientRef, 1, str(c.nom), strOrNull(c.prenom),
        strOrNull(c.poste), strOrNull(c.photo), dateFacultative(c.date_embauche, 'date_embauche'),
        dateFacultative(c.date_debut_contrat, 'date_debut_contrat'),
        dateFacultative(c.date_fin_contrat, 'date_fin_contrat'),
        strOrNull(c.telephone), emailValide(c.email), strOrNull(c.adresse),
        geZero(c.taux_journalier, 'taux_journalier'), geZero(c.taux_horaire, 'taux_horaire'),
        geZero(c.prix_tache, 'prix_tache'), strOrNull(c.numero_cnaps), strOrNull(c.numero_ostie),
        0, ts, ts,
      ]
      if (typeContrat !== null) { cols.push('type_contrat'); vals.push(typeContrat) }
      if ('mode_remuneration' in c) {
        const mode = validerMode(c.mode_remuneration)
        if (mode !== null) { cols.push('mode_remuneration'); vals.push(mode) }
      }
      if ('statut_declaration' in c) {
        const decla = validerDecla(c.statut_declaration)
        if (decla !== null) { cols.push('statut_declaration'); vals.push(decla) }
      }
      if ('statut' in c) {
        const statut = validerStatutEmploye(c.statut)
        if (statut !== null) { cols.push('statut'); vals.push(statut) }
      }
      const salaire = salaireValide(c.salaire_base)
      if (salaire !== null) { cols.push('salaire_base'); vals.push(salaire) }
      const solde = geZero(c.solde_conges_annuel, 'solde_conges_annuel')
      if (solde !== null) { cols.push('solde_conges_annuel'); vals.push(solde) }

      const sqlInsert = `INSERT INTO employes (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`
      const res = await dbExecBatch([
        { sql: sqlInsert, args: vals },
        ligneOutbox('employe', clientRef, 'create', payloadDepuis(cols, vals)),
      ])
      const rows = await dbQuery('SELECT * FROM employes WHERE client_ref = ?', [clientRef])
      const row = rows[0] ?? (res.last_id !== null
        ? (await dbQuery('SELECT * FROM employes WHERE id = ?', [res.last_id]))[0]
        : undefined)
      if (!row) throw localError(500, 'Échec de la création de employé')
      return serEmploye(row, null)
    },

    // --- Équipes ---
    'GET rh/equipes': async (req) => {
      const { page, size, offset } = pagination(req.params)
      const { clauses, args } = clausesTenant()
      const cond = [...clauses]
      const a: JsonValue[] = [...args]
      const search = strOrNull(req.params.search)
      if (search) { cond.push('nom LIKE ?'); a.push(`%${search}%`) }
      const statut = strOrNull(req.params.statut)
      if (statut) { cond.push('statut = ?'); a.push(statut) }
      const where = cond.join(' AND ')
      const tot = await dbQuery(`SELECT COUNT(*) AS n FROM equipes WHERE ${where}`, a)
      const rows = await dbQuery(
        `SELECT * FROM equipes WHERE ${where} ORDER BY id ASC LIMIT ? OFFSET ?`,
        [...a, size, offset],
      )
      return { items: rows.map(serEquipeListe), total: int(tot[0]?.n, 0), page, size }
    },

    'POST rh/equipes': async (req) => {
      const c = corps(req)
      requis(c.nom, 'Le nom est requis')
      const entrepriseId = intOrNull(c.entreprise_id) ?? currentEntrepriseId()
      if (entrepriseId === null) throw localError(422, 'Entreprise requise')
      const statut = 'statut' in c ? validerStatutEquipe(c.statut) : null
      const ts = horodatageLocal()

      const cols = [
        'entreprise_id', 'chef_equipe_id', 'nom', 'description', 'specialite', 'statut',
        'is_deleted', 'created_at', 'updated_at',
      ]
      const vals: JsonValue[] = [
        entrepriseId, intOrNull(c.chef_equipe_id), str(c.nom), strOrNull(c.description),
        strOrNull(c.specialite), statut ?? 'active', 0, ts, ts,
      ]
      const dateCreation = dateFacultative(c.date_creation, 'date_creation')
      if (dateCreation !== null) { cols.push('date_creation'); vals.push(dateCreation) }

      // PHASE 4B : sync de cette entité à brancher (équipe hors entités canoniques).
      const res = await dbExecBatch([
        {
          sql: `INSERT INTO equipes (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
          args: vals,
        },
      ])
      if (res.last_id === null) throw localError(500, "Échec de la création de l'équipe")
      const row = (await dbQuery('SELECT * FROM equipes WHERE id = ?', [res.last_id]))[0]
      if (!row) throw localError(500, "Échec de la création de l'équipe")
      return serEquipeDetail(row)
    },

    // --- Heures supplémentaires ---
    'GET rh/heures-sup': async (req) => {
      const { page, size, offset } = pagination(req.params)
      const { clauses, args } = clausesTenant()
      const cond = [...clauses]
      const a: JsonValue[] = [...args]
      const employeId = intOrNull(req.params.employe_id)
      if (employeId) { cond.push('employe_id = ?'); a.push(employeId) }
      const chantierId = intOrNull(req.params.chantier_id)
      if (chantierId) { cond.push('chantier_id = ?'); a.push(chantierId) }
      const dateDebut = strOrNull(req.params.date_debut)
      if (dateDebut) { cond.push('date_hs >= ?'); a.push(dateDebut) }
      const dateFin = strOrNull(req.params.date_fin)
      if (dateFin) { cond.push('date_hs <= ?'); a.push(dateFin) }
      const statut = strOrNull(req.params.statut)
      if (statut) { cond.push('statut = ?'); a.push(statut) }
      const where = cond.join(' AND ')
      const tot = await dbQuery(`SELECT COUNT(*) AS n FROM heures_supplementaires WHERE ${where}`, a)
      const rows = await dbQuery(
        `SELECT * FROM heures_supplementaires WHERE ${where} ORDER BY id ASC LIMIT ? OFFSET ?`,
        [...a, size, offset],
      )
      return { items: rows.map(serHeureSupListe), total: int(tot[0]?.n, 0), page, size }
    },

    'POST rh/heures-sup': async (req) => {
      const c = corps(req)
      const employeId = intOrNull(c.employe_id)
      if (employeId === null || employeId < 1) throw localError(422, 'Le champ employe_id est requis')
      await chargerEmployeStrict(employeId)
      const dateHs = dateRequise(c.date_hs, 'date_hs')
      const nbHeures = strictementPositif(c.nb_heures, 'nb_heures')
      let taux = 1.5
      if ('taux_majoration' in c) {
        const tauxSaisi = floatOrNull(c.taux_majoration)
        if (tauxSaisi === null || tauxSaisi <= 0) throw localError(422, 'Le champ taux_majoration doit être supérieur à 0')
        taux = tauxSaisi
      }
      const entrepriseId = currentEntrepriseId()
      if (entrepriseId === null) throw localError(422, 'Entreprise requise')
      const clientRef = uuid()
      const ts = horodatageLocal()

      const cols = [
        'entreprise_id', 'employe_id', 'chantier_id', 'date_hs', 'nb_heures', 'taux_majoration',
        'motif', 'statut', 'type_compensation', 'client_ref', 'sync_version', 'is_deleted',
        'created_at', 'updated_at',
      ]
      const vals: JsonValue[] = [
        entrepriseId, employeId, intOrNull(c.chantier_id), dateHs, nbHeures, taux,
        strOrNull(c.motif), strOrNull(c.statut) ?? 'en_attente',
        strOrNull(c.type_compensation) ?? 'paiement', clientRef, 1, 0, ts, ts,
      ]
      const res = await dbExecBatch([
        {
          sql: `INSERT INTO heures_supplementaires (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
          args: vals,
        },
        ligneOutbox('heure_supplementaire', clientRef, 'create', payloadDepuis(cols, vals)),
      ])
      const rows = await dbQuery('SELECT * FROM heures_supplementaires WHERE client_ref = ?', [clientRef])
      const row = rows[0] ?? (res.last_id !== null
        ? (await dbQuery('SELECT * FROM heures_supplementaires WHERE id = ?', [res.last_id]))[0]
        : undefined)
      if (!row) throw localError(500, 'Échec de la création des heures supplémentaires')
      return serHeureSupDetail(row)
    },

    // --- Congés (RH) ---
    'GET rh/conges': async (req) => {
      const eid = currentEntrepriseId()
      if (eid === null) throw localError(403, 'Entreprise requise')
      const { page, size, offset } = pagination(req.params)
      const { clauses, args } = clausesTenant()
      // Préfixe `c.` obligatoire : la jointure employes expose aussi is_deleted/entreprise_id.
      const cond = clauses.map((cl) => cl.replace(/^(\w+)/, 'c.$1'))
      const a: JsonValue[] = [...args]
      const statut = strOrNull(req.params.statut)
      if (statut) { cond.push('c.statut = ?'); a.push(statut) }
      const employeId = intOrNull(req.params.employe_id)
      if (employeId) { cond.push('c.employe_id = ?'); a.push(employeId) }
      const where = cond.join(' AND ')
      const tot = await dbQuery(`SELECT COUNT(*) AS n FROM conges c WHERE ${where}`, a)
      const rows = await dbQuery(
        `SELECT c.*, e.nom AS employe_nom, e.prenom AS employe_prenom FROM conges c
         LEFT JOIN employes e ON e.id = c.employe_id
         WHERE ${where} ORDER BY c.created_at DESC, c.id DESC LIMIT ? OFFSET ?`,
        [...a, size, offset],
      )
      return { items: rows.map(serConge), total: int(tot[0]?.n, 0), page, size }
    },

    'POST rh/conges': async (req) => {
      const c = corps(req)
      const employeId = intOrNull(c.employe_id)
      if (employeId === null || employeId < 1) throw localError(422, 'Le champ employe_id est requis')
      const employe = await chargerEmployeStrict(employeId)
      const type = 'type' in c && c.type !== null && c.type !== undefined ? str(c.type) : 'annuel'
      if (!TYPES_CONGE.includes(type)) throw localError(422, MSG_TYPE_CONGE_RH)
      const dateDebut = dateRequise(c.date_debut, 'date_debut')
      const dateFin = dateRequise(c.date_fin, 'date_fin')
      if (dateFin < dateDebut) {
        throw localError(422, 'date_fin doit être postérieure ou égale à date_debut')
      }
      const nbJours = strictementPositif(c.nb_jours, 'nb_jours')
      const clientRef = uuid()
      const ts = horodatageLocal()

      const cols = [
        'entreprise_id', 'employe_id', 'type', 'date_debut', 'date_fin', 'nb_jours', 'motif',
        'statut', 'client_ref', 'sync_version', 'is_deleted', 'created_at', 'updated_at',
      ]
      const vals: JsonValue[] = [
        currentEntrepriseId(), employeId, type, dateDebut, dateFin, nbJours, strOrNull(c.motif),
        'en_attente', clientRef, 1, 0, ts, ts,
      ]
      const res = await dbExecBatch([
        {
          sql: `INSERT INTO conges (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
          args: vals,
        },
        ligneOutbox('conge', clientRef, 'create', payloadDepuis(cols, vals)),
      ])
      const rows = await dbQuery(
        'SELECT c.*, e.nom AS employe_nom, e.prenom AS employe_prenom FROM conges c LEFT JOIN employes e ON e.id = c.employe_id WHERE c.client_ref = ?',
        [clientRef],
      )
      const row = rows[0] ?? (res.last_id !== null
        ? (await dbQuery('SELECT * FROM conges WHERE id = ?', [res.last_id]))[0]
        : undefined)
      if (!row) throw localError(500, 'Échec de la création du congé')
      return serConge(row)
    },

    // --- Paie ---
    'GET rh/paie': async (req) => {
      const mois = int(req.params.mois, 0)
      const annee = int(req.params.annee, 0)
      if (mois < 1 || mois > 12) throw localError(422, 'Le mois doit être compris entre 1 et 12')
      if (annee < 2000 || annee > 2100) throw localError(422, "L'année doit être comprise entre 2000 et 2100")
      const employeId = intOrNull(req.params.employe_id)
      return construireRapportPaie(mois, annee, employeId)
    },

    'GET rh/paie/export': async (req) => {
      const mois = int(req.params.mois, 0)
      const annee = int(req.params.annee, 0)
      if (mois < 1 || mois > 12) throw localError(422, 'Le mois doit être compris entre 1 et 12')
      if (annee < 2000 || annee > 2100) throw localError(422, "L'année doit être comprise entre 2000 et 2100")
      const rapport = await construireRapportPaie(mois, annee, null)
      return new Blob([construireCsvPaie(rapport)], { type: 'text/csv;charset=utf-8' })
    },

    // --- Espace Employé Terrain : profil, documents, congés, badge ---
    'GET employe-terrain/profil': async () => {
      const employe = await chargerEmployeTerrain()
      return { employe: serEmployeTerrain(employe) }
    },

    'PUT employe-terrain/profil': async (req) => {
      const c = corps(req)
      const employe = await chargerEmployeTerrain()
      const autorises = ['telephone', 'email', 'photo', 'adresse']
      const cols: string[] = []
      const vals: JsonValue[] = []
      for (const cle of autorises) {
        const v = c[cle]
        if (v !== null && v !== undefined) { cols.push(cle); vals.push(v as JsonValue) }
      }
      if (cols.length > 0) {
        const ts = horodatageLocal()
        const version = int(employe.sync_version, 1) + 1
        cols.push('updated_at', 'sync_version')
        vals.push(ts, version)
        const ref = refDeLigne(employe)
        const payload = payloadLigne(serEmployeTerrain(employe), COLS_PAYLOAD_EMPLOYE)
        cols.forEach((c2, i) => { payload[c2] = vals[i] })
        payload.client_ref = ref
        await dbExecBatch([
          {
            sql: `UPDATE employes SET ${cols.map((c2) => `${c2} = ?`).join(', ')} WHERE id = ?`,
            args: [...vals, int(employe.id, 0)],
          },
          ligneOutbox('employe', ref, 'update', payload),
        ])
      }
      const row = (await dbQuery('SELECT * FROM employes WHERE id = ?', [int(employe.id, 0)]))[0]
      if (!row) throw localError(404, 'Aucune fiche employe rattachee a votre compte')
      return { message: 'Profil mis a jour', employe: serEmployeTerrain(row) }
    },

    'GET employe-terrain/documents': async () => {
      const employe = await chargerEmployeTerrain()
      const eid = int(employe.id, 0)
      const affectations = await dbQueryOptionnel(
        'SELECT chantier_id FROM affectation_chantiers WHERE employe_id = ? AND is_deleted = 0',
        [eid],
      )
      const chantierIds = affectations
        .map((a) => intOrNull(a.chantier_id))
        .filter((x): x is number => x !== null)
      let sql = 'SELECT * FROM documents WHERE is_deleted = 0'
      const args: JsonValue[] = []
      if (chantierIds.length > 0) {
        sql += ` AND (chantier_id IN (${chantierIds.map(() => '?').join(', ')}) OR client_id IS NULL)`
        args.push(...chantierIds)
      }
      sql += ' ORDER BY created_at DESC'
      const rows = await dbQuery(sql, args)
      return { items: rows.map(serDocumentTerrain) }
    },

    'GET employe-terrain/conges': async () => {
      const employe = await chargerEmployeTerrain()
      const eid = int(employe.id, 0)
      const tot = await dbQuery('SELECT COUNT(*) AS n FROM conges WHERE employe_id = ? AND is_deleted = 0', [eid])
      const rows = await dbQuery(
        'SELECT * FROM conges WHERE employe_id = ? AND is_deleted = 0 ORDER BY created_at DESC, id DESC LIMIT 100 OFFSET 0',
        [eid],
      )
      const solde = await calculerSolde(employe)
      return {
        items: rows.map(serConge),
        total_items: int(tot[0]?.n, 0),
        solde_restant: solde.solde_restant,
        solde_annuel: solde.solde_annuel,
      }
    },

    'POST employe-terrain/conges': async (req) => {
      const c = corps(req)
      const employe = await chargerEmployeTerrain()
      const type = 'type' in c && c.type !== null && c.type !== undefined ? str(c.type) : 'annuel'
      if (!TYPES_CONGE.includes(type)) throw localError(422, MSG_TYPE_CONGE_TERRAIN)
      const dateDebut = dateRequise(c.date_debut, 'date_debut')
      const dateFin = dateRequise(c.date_fin, 'date_fin')
      if (dateFin < dateDebut) {
        throw localError(422, 'date_fin doit être postérieure ou égale à date_debut')
      }
      const nbJours = strictementPositif(c.nb_jours, 'nb_jours')
      const clientRef = uuid()
      const ts = horodatageLocal()

      const cols = [
        'entreprise_id', 'employe_id', 'type', 'date_debut', 'date_fin', 'nb_jours', 'motif',
        'statut', 'client_ref', 'sync_version', 'is_deleted', 'created_at', 'updated_at',
      ]
      const vals: JsonValue[] = [
        intOrNull(employe.entreprise_id), int(employe.id, 0), type, dateDebut, dateFin, nbJours,
        strOrNull(c.motif), 'en_attente', clientRef, 1, 0, ts, ts,
      ]
      const res = await dbExecBatch([
        {
          sql: `INSERT INTO conges (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
          args: vals,
        },
        ligneOutbox('conge', clientRef, 'create', payloadDepuis(cols, vals)),
      ])
      const rows = await dbQuery('SELECT * FROM conges WHERE client_ref = ?', [clientRef])
      const row = rows[0] ?? (res.last_id !== null
        ? (await dbQuery('SELECT * FROM conges WHERE id = ?', [res.last_id]))[0]
        : undefined)
      if (!row) throw localError(500, 'Échec de la création du congé')
      return serConge(row)
    },

    'GET employe-terrain/mon-badge': async () => badgeTerrain(),
    'GET employe-terrain/badge': async () => badgeTerrain(),
  },
  {
    'POST rh/employes': 201,
    'POST rh/equipes': 201,
    'POST rh/heures-sup': 201,
    'POST rh/conges': 201,
    'POST employe-terrain/conges': 201,
  },
)

/** Badge terrain : fiche brute + `code_qr` repli + branding entreprise (sans écriture). */
async function badgeTerrain(): Promise<unknown> {
  const employe = await chargerEmployeTerrain()
  const eid = intOrNull(employe.entreprise_id)
  let ent: LocalRow | undefined
  if (eid !== null) {
    ent = (await dbQuery('SELECT nom, logo FROM entreprises WHERE id = ?', [eid]))[0]
  }
  return {
    employe: serEmployeTerrain(employe),
    code_qr: strOrNull(employe.code_qr_badge) ?? `TIA-EMP-${int(employe.id, 0)}-1-0`,
    entreprise_nom: ent ? strOrNull(ent.nom) : null,
    entreprise_logo: ent ? strOrNull(ent.logo) : null,
  }
}

// ---------------------------------------------------------------------------
// Routes à paramètre (`registerLocalPattern`) — captures via `req.pathParams`.
// ---------------------------------------------------------------------------

// GET rh/employes/{id} — détail + historique de postes.
registerLocalPattern(/^GET rh\/employes\/(\d+)$/, async (req) => {
  const id = int(req.pathParams[0], 0)
  const employe = await chargerEmploye(id)
  const historique = await dbQuery(
    'SELECT * FROM historique_postes WHERE employe_id = ? AND is_deleted = 0 ORDER BY id ASC',
    [id],
  )
  return serEmploye(employe, historique.map(serHistorique))
}, 200)

// PUT rh/employes/{id} — matricule verrouillé (ignoré, comme backend).
registerLocalPattern(/^PUT rh\/employes\/(\d+)$/, async (req) => {
  const id = int(req.pathParams[0], 0)
  const employe = await chargerEmploye(id)
  const c = corps(req)
  const cols: string[] = []
  const vals: JsonValue[] = []
  const ajouter = (col: string, val: JsonValue): void => { cols.push(col); vals.push(val) }

  if ('nom' in c) { requis(c.nom, 'Le nom est requis'); ajouter('nom', str(c.nom)) }
  if ('prenom' in c) ajouter('prenom', strOrNull(c.prenom))
  if ('poste' in c) ajouter('poste', strOrNull(c.poste))
  if ('photo' in c) ajouter('photo', strOrNull(c.photo))
  if ('date_embauche' in c) ajouter('date_embauche', dateFacultative(c.date_embauche, 'date_embauche'))
  if ('type_contrat' in c) ajouter('type_contrat', validerTypeContrat(c.type_contrat))
  if ('date_debut_contrat' in c) ajouter('date_debut_contrat', dateFacultative(c.date_debut_contrat, 'date_debut_contrat'))
  if ('date_fin_contrat' in c) ajouter('date_fin_contrat', dateFacultative(c.date_fin_contrat, 'date_fin_contrat'))
  if ('salaire_base' in c) ajouter('salaire_base', salaireValide(c.salaire_base))
  if ('mode_remuneration' in c) ajouter('mode_remuneration', validerMode(c.mode_remuneration))
  if ('taux_journalier' in c) ajouter('taux_journalier', geZero(c.taux_journalier, 'taux_journalier'))
  if ('taux_horaire' in c) ajouter('taux_horaire', geZero(c.taux_horaire, 'taux_horaire'))
  if ('prix_tache' in c) ajouter('prix_tache', geZero(c.prix_tache, 'prix_tache'))
  if ('numero_cnaps' in c) ajouter('numero_cnaps', strOrNull(c.numero_cnaps))
  if ('numero_ostie' in c) ajouter('numero_ostie', strOrNull(c.numero_ostie))
  if ('statut_declaration' in c) ajouter('statut_declaration', validerDecla(c.statut_declaration))
  if ('solde_conges_annuel' in c) ajouter('solde_conges_annuel', geZero(c.solde_conges_annuel, 'solde_conges_annuel'))
  if ('telephone' in c) ajouter('telephone', strOrNull(c.telephone))
  if ('email' in c) ajouter('email', emailValide(c.email))
  if ('adresse' in c) ajouter('adresse', strOrNull(c.adresse))
  if ('statut' in c) ajouter('statut', validerStatutEmploye(c.statut))
  // `matricule` : identifiant auto-généré, jamais modifiable (pop backend).

  const ts = horodatageLocal()
  const version = int(employe.sync_version, 1) + 1
  cols.push('updated_at', 'sync_version')
  vals.push(ts, version)
  await dbExecBatch([
    {
      sql: `UPDATE employes SET ${cols.map((c2) => `${c2} = ?`).join(', ')} WHERE id = ?`,
      args: [...vals, id],
    },
    ligneOutbox('employe', refDeLigne(employe), 'update', {
      ...payloadLigne(serEmploye(employe, null), COLS_PAYLOAD_EMPLOYE),
      ...Object.fromEntries(cols.map((c2, i) => [c2, vals[i]])),
      client_ref: refDeLigne(employe),
    }),
  ])
  const row = (await dbQuery('SELECT * FROM employes WHERE id = ?', [id]))[0]
  if (!row) throw localError(404, 'Employé non trouvé')
  return serEmploye(row, null)
}, 200)

// DELETE rh/employes/{id} — suppression logique + outbox delete → 204.
registerLocalPattern(/^DELETE rh\/employes\/(\d+)$/, async (req) => {
  const id = int(req.pathParams[0], 0)
  const employe = await chargerEmploye(id)
  const ts = horodatageLocal()
  const version = int(employe.sync_version, 1) + 1
  await dbExecBatch([
    {
      sql: 'UPDATE employes SET is_deleted = 1, updated_at = ?, sync_version = COALESCE(sync_version, 1) + 1 WHERE id = ?',
      args: [ts, id],
    },
    ligneOutbox('employe', refDeLigne(employe), 'delete', {
      ...payloadLigne(serEmploye(employe, null), COLS_PAYLOAD_EMPLOYE),
      is_deleted: true,
      updated_at: ts,
      sync_version: version,
      client_ref: refDeLigne(employe),
    }),
  ])
  return null
}, 204)

// GET rh/employes/{id}/badge-qr — génère le code s'il manque (écriture + outbox).
registerLocalPattern(/^GET rh\/employes\/(\d+)\/badge-qr$/, async (req) => {
  const id = int(req.pathParams[0], 0)
  let employe = await chargerEmploye(id)
  let code = strOrNull(employe.code_qr_badge)
  if (!code) {
    code = nouveauCodeBadge(intOrNull(employe.entreprise_id), id)
    const ts = horodatageLocal()
    const version = int(employe.sync_version, 1) + 1
    await dbExecBatch([
      {
        sql: 'UPDATE employes SET code_qr_badge = ?, updated_at = ?, sync_version = COALESCE(sync_version, 1) + 1 WHERE id = ?',
        args: [code, ts, id],
      },
      ligneOutbox('employe', refDeLigne(employe), 'update', {
        ...payloadLigne(serEmploye(employe, null), COLS_PAYLOAD_EMPLOYE),
        code_qr_badge: code,
        updated_at: ts,
        sync_version: version,
        client_ref: refDeLigne(employe),
      }),
    ])
    employe = (await dbQuery('SELECT * FROM employes WHERE id = ?', [id]))[0] ?? employe
  }
  const infos = await infosBadge(employe)
  return {
    id,
    matricule: strOrNull(employe.matricule) ?? `EMP-${String(id).padStart(4, '0')}`,
    nom: employe.nom ?? null,
    prenom: employe.prenom ?? null,
    poste: employe.poste ?? null,
    photo: employe.photo ?? null,
    code_qr_badge: code,
    couleur_role: infos.couleur_role,
    entete_badge: infos.entete_badge,
    entreprise_nom: infos.entreprise_nom,
    entreprise_logo: infos.entreprise_logo,
    date_generation: horodatageLocal(),
  }
}, 200)

// GET rh/employes/{id}/documents — métadonnées, tri created_at DESC.
registerLocalPattern(/^GET rh\/employes\/(\d+)\/documents$/, async (req) => {
  const id = int(req.pathParams[0], 0)
  await chargerEmployeStrict(id)
  const rows = await dbQuery(
    'SELECT * FROM documents WHERE employe_id = ? AND is_deleted = 0 ORDER BY created_at DESC',
    [id],
  )
  return { items: rows.map(serDocumentRh) }
}, 200)

// POST rh/employes/{id}/documents — métadonnées JSON (sans fichier binaire).
registerLocalPattern(/^POST rh\/employes\/(\d+)\/documents$/, async (req) => {
  const id = int(req.pathParams[0], 0)
  const employe = await chargerEmployeStrict(id)
  const c = corps(req)
  requis(c.nom, 'Le nom est requis')
  const categorie = 'categorie' in c ? validerCategorie(c.categorie) : null
  const ts = horodatageLocal()

  // PHASE 4B : sync de cette entité à brancher (documents hors entités canoniques).
  const cols = [
    'entreprise_id', 'employe_id', 'nom', 'categorie', 'fichier_url', 'description',
    'is_deleted', 'created_at', 'updated_at',
  ]
  const vals: JsonValue[] = [
    intOrNull(employe.entreprise_id), id, str(c.nom), categorie ?? 'autre',
    strOrNull(c.fichier_url), strOrNull(c.description), 0, ts, ts,
  ]
  const res = await dbExecBatch([
    {
      sql: `INSERT INTO documents (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
      args: vals,
    },
  ])
  if (res.last_id === null) throw localError(500, 'Échec de la création du document')
  const row = (await dbQuery('SELECT * FROM documents WHERE id = ?', [res.last_id]))[0]
  if (!row) throw localError(500, 'Échec de la création du document')
  return serDocumentRh(row)
}, 201)

// POST rh/employes/{id}/documents/upload — multipart : métadonnées seules.
registerLocalPattern(/^POST rh\/employes\/(\d+)\/documents\/upload$/, async (req) => {
  const id = int(req.pathParams[0], 0)
  const employe = await chargerEmployeStrict(id)
  const categorieDemandee = valeurChamp(req, 'categorie')
  const categorie =
    categorieDemandee === null || categorieDemandee === undefined || categorieDemandee === ''
      ? 'autre'
      : validerCategorie(categorieDemandee)
  const nomFormulaire = strOrNull(valeurChamp(req, 'nom'))
  const nomFichier = strOrNull(valeurChamp(req, 'fichier'))
  const nom = nomFormulaire || nomFichier || `Document ${categorie ?? 'autre'}`
  const ts = horodatageLocal()

  // PHASE 4B : binaire non stocké hors-ligne (aucun octet envoyé) → `fichier_url`
  // reste null ; brancher le stockage fichier + la sync de l'entité `document`.
  const cols = [
    'entreprise_id', 'employe_id', 'nom', 'categorie', 'fichier_url', 'description',
    'is_deleted', 'created_at', 'updated_at',
  ]
  const vals: JsonValue[] = [
    intOrNull(employe.entreprise_id), id, nom, categorie ?? 'autre', null,
    strOrNull(valeurChamp(req, 'description')), 0, ts, ts,
  ]
  const res = await dbExecBatch([
    {
      sql: `INSERT INTO documents (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
      args: vals,
    },
  ])
  if (res.last_id === null) throw localError(500, 'Échec de la création du document')
  const row = (await dbQuery('SELECT * FROM documents WHERE id = ?', [res.last_id]))[0]
  if (!row) throw localError(500, 'Échec de la création du document')
  return serDocumentRh(row)
}, 201)

// POST rh/employes/{id}/photo — PHASE 4B : binaire non stocké hors-ligne.
registerLocalPattern(/^POST rh\/employes\/(\d+)\/photo$/, async (req) => {
  const id = int(req.pathParams[0], 0)
  const employe = await chargerEmploye(id)
  // PHASE 4B : aucun octet transmis hors-ligne — on renvoie la photo actuelle
  // (aucune écriture) ; brancher `file_storage` + sync de l'entité `employe`.
  return { photo: strOrNull(employe.photo) }
}, 200)

// POST rh/employes/{id}/changer-poste — maj employé + historique, UNE dbExecBatch.
registerLocalPattern(/^POST rh\/employes\/(\d+)\/changer-poste$/, async (req) => {
  const id = int(req.pathParams[0], 0)
  const employe = await chargerEmploye(id)
  const c = corps(req)
  requis(c.nouveau_poste, 'Le nouveau poste est requis')
  const nouveauPoste = str(c.nouveau_poste)
  const typeContrat = 'type_contrat' in c ? validerTypeContrat(c.type_contrat) : null
  const nouveauSalaire = 'nouveau_salaire' in c && c.nouveau_salaire !== null && c.nouveau_salaire !== undefined
    ? salaireValide(c.nouveau_salaire)
    : null
  const dateEffet =
    dateFacultative(c.date_debut, 'date_debut') ??
    dateFacultative(c.date_effet, 'date_effet') ??
    dateLocale()
  const motif = strOrNull(c.motif)
  const ts = horodatageLocal()
  const version = int(employe.sync_version, 1) + 1

  const majCols = ['poste', 'updated_at', 'sync_version']
  const majVals: JsonValue[] = [nouveauPoste, ts, version]
  if (typeContrat) { majCols.push('type_contrat'); majVals.push(typeContrat) }
  if (nouveauSalaire !== null) { majCols.push('salaire_base'); majVals.push(nouveauSalaire) }

  // PHASE 4B : `historique_postes` n'a pas d'entité de sync dédiée (sans outbox).
  const histCols = [
    'entreprise_id', 'employe_id', 'poste', 'type_contrat', 'salaire_base', 'date_debut',
    'date_fin', 'motif_changement', 'is_deleted', 'created_at', 'updated_at',
  ]
  const histVals: JsonValue[] = [
    currentEntrepriseId() ?? intOrNull(employe.entreprise_id) ?? 0,
    id,
    nouveauPoste,
    typeContrat ?? strOrNull(employe.type_contrat),
    nouveauSalaire ?? floatOrNull(employe.salaire_base) ?? 0,
    dateEffet,
    null,
    motif,
    0,
    ts,
    ts,
  ]

  await dbExecBatch([
    {
      sql: `UPDATE employes SET ${majCols.map((c2) => `${c2} = ?`).join(', ')} WHERE id = ?`,
      args: [...majVals, id],
    },
    {
      sql: `INSERT INTO historique_postes (${histCols.join(', ')}) VALUES (${histCols.map(() => '?').join(', ')})`,
      args: histVals,
    },
    ligneOutbox('employe', refDeLigne(employe), 'update', {
      ...payloadLigne(serEmploye(employe, null), COLS_PAYLOAD_EMPLOYE),
      ...Object.fromEntries(majCols.map((c2, i) => [c2, majVals[i]])),
      client_ref: refDeLigne(employe),
    }),
  ])
  const row = (await dbQuery('SELECT * FROM employes WHERE id = ?', [id]))[0]
  if (!row) throw localError(404, 'Employé non trouvé')
  return serEmploye(row, null)
}, 200)

// POST rh/pointages/{id}/valider — décision RH (entité outbox `pointage`).
registerLocalPattern(/^POST rh\/pointages\/(\d+)\/valider$/, async (req) => {
  return deciderPointage(req, 'valide')
}, 200)

// POST rh/pointages/{id}/refuser — décision RH (entité outbox `pointage`).
registerLocalPattern(/^POST rh\/pointages\/(\d+)\/refuser$/, async (req) => {
  return deciderPointage(req, 'refuse')
}, 200)

async function deciderPointage(req: LocalRequest, statut: 'valide' | 'refuse'): Promise<LocalRow> {
  const id = int(req.pathParams[0], 0)
  const pt = await chargerPointage(id)
  if (str(pt.statut_validation) === statut) throw localError(409, `Pointage déjà ${statut}`)
  const commentaire = strOrNull(corps(req).commentaire)
  const ts = horodatageLocal()
  const version = int(pt.sync_version, 1) + 1
  const notes = commentaire !== null ? commentaire : (strOrNull(pt.notes) ?? null)
  const scannePar = currentUserId()

  await dbExecBatch([
    {
      sql: 'UPDATE pointages SET statut_validation = ?, notes = ?, scanne_par_id = ?, updated_at = ?, sync_version = COALESCE(sync_version, 1) + 1 WHERE id = ?',
      args: [statut, notes, scannePar, ts, id],
    },
    ligneOutbox('pointage', refDeLigne(pt), 'update', {
      ...payloadLigne(serPointage(pt), COLS_POINTAGE),
      statut_validation: statut,
      notes,
      scanne_par_id: scannePar,
      updated_at: ts,
      sync_version: version,
      client_ref: refDeLigne(pt),
    }),
  ])
  const row = (await dbQuery('SELECT * FROM pointages WHERE id = ?', [id]))[0]
  if (!row) throw localError(404, 'Pointage non trouvé')
  return serPointage(row)
}

// PUT rh/heures-sup/{id}/statut — décision (entité outbox `heure_supplementaire`).
registerLocalPattern(/^PUT rh\/heures-sup\/(\d+)\/statut$/, async (req) => {
  const id = int(req.pathParams[0], 0)
  const hs = await chargerHeureSup(id)
  const c = corps(req)
  const cols: string[] = []
  const vals: JsonValue[] = []
  if ('nb_heures' in c && c.nb_heures !== null && c.nb_heures !== undefined) {
    cols.push('nb_heures'); vals.push(floatOrNull(c.nb_heures))
  }
  if ('taux_majoration' in c && c.taux_majoration !== null && c.taux_majoration !== undefined) {
    cols.push('taux_majoration'); vals.push(floatOrNull(c.taux_majoration))
  }
  if ('motif' in c) { cols.push('motif'); vals.push(strOrNull(c.motif)) }
  if ('statut' in c && c.statut !== null && c.statut !== undefined) {
    cols.push('statut'); vals.push(str(c.statut))
  }
  if ('type_compensation' in c && c.type_compensation !== null && c.type_compensation !== undefined) {
    cols.push('type_compensation'); vals.push(str(c.type_compensation))
  }
  const ts = horodatageLocal()
  const version = int(hs.sync_version, 1) + 1
  cols.push('updated_at', 'sync_version')
  vals.push(ts, version)

  const payload = payloadLigne(serHeureSupDetail(hs), COLS_HS)
  cols.forEach((c2, i) => { payload[c2] = vals[i] })
  payload.client_ref = refDeLigne(hs)
  await dbExecBatch([
    {
      sql: `UPDATE heures_supplementaires SET ${cols.map((c2) => `${c2} = ?`).join(', ')} WHERE id = ?`,
      args: [...vals, id],
    },
    ligneOutbox('heure_supplementaire', refDeLigne(hs), 'update', payload),
  ])
  const row = (await dbQuery('SELECT * FROM heures_supplementaires WHERE id = ?', [id]))[0]
  if (!row) throw localError(404, 'Heure supplémentaire non trouvée')
  return serHeureSupDetail(row)
}, 200)

// POST rh/conges/{id}/valider — workflow RH (entité outbox `conge`).
registerLocalPattern(/^POST rh\/conges\/(\d+)\/valider$/, async (req) => {
  return deciderConge(req, 'valide')
}, 200)

// POST rh/conges/{id}/refuser — workflow RH (entité outbox `conge`).
registerLocalPattern(/^POST rh\/conges\/(\d+)\/refuser$/, async (req) => {
  return deciderConge(req, 'refuse')
}, 200)

async function deciderConge(req: LocalRequest, statut: 'valide' | 'refuse'): Promise<LocalRow> {
  const id = int(req.pathParams[0], 0)
  const conge = await chargerConge(id)
  const actuel = str(conge.statut)
  if (actuel !== 'en_attente') {
    throw localError(409, `Ce congé a déjà été traité (statut: ${actuel})`)
  }
  const commentaire = strOrNull(corps(req).commentaire)
  const ts = horodatageLocal()
  const version = int(conge.sync_version, 1) + 1
  const commentaireRefus = statut === 'refuse' && commentaire !== null ? commentaire : strOrNull(conge.commentaire_refus)

  const cols = ['statut', 'valide_par', 'date_validation', 'commentaire_refus', 'updated_at', 'sync_version']
  const vals: JsonValue[] = [statut, currentUserId(), ts, commentaireRefus, ts, version]
  const payload = payloadLigne(serConge(conge), COLS_CONGE)
  cols.forEach((c2, i) => { payload[c2] = vals[i] })
  payload.client_ref = refDeLigne(conge)

  await dbExecBatch([
    {
      sql: `UPDATE conges SET ${cols.map((c2) => `${c2} = ?`).join(', ')} WHERE id = ?`,
      args: [...vals, id],
    },
    ligneOutbox('conge', refDeLigne(conge), 'update', payload),
  ])
  const rows = await dbQuery(
    'SELECT c.*, e.nom AS employe_nom, e.prenom AS employe_prenom FROM conges c LEFT JOIN employes e ON e.id = c.employe_id WHERE c.id = ?',
    [id],
  )
  const row = rows[0]
  if (!row) throw localError(404, 'Congé non trouvé')
  return serConge(row)
}

// GET rh/conges/{id}/solde — solde calculé (jours annuels validés de l'année).
registerLocalPattern(/^GET rh\/conges\/(\d+)\/solde$/, async (req) => {
  const id = int(req.pathParams[0], 0)
  const employe = await chargerEmployeStrict(id)
  return calculerSolde(employe)
}, 200)

// POST employe-terrain/conges/{id}/annuler — self-only, en_attente uniquement.
registerLocalPattern(/^POST employe-terrain\/conges\/(\d+)\/annuler$/, async (req) => {
  const id = int(req.pathParams[0], 0)
  const employe = await chargerEmployeTerrain()
  const rows = await dbQuery('SELECT * FROM conges WHERE id = ?', [id])
  const conge = rows[0]
  if (!conge || boolSql(conge.is_deleted) || int(conge.employe_id, 0) !== int(employe.id, 0)) {
    throw localError(404, 'Congé non trouvé')
  }
  if (str(conge.statut) !== 'en_attente') {
    throw localError(409, 'Seule une demande en attente peut être annulée')
  }
  const ts = horodatageLocal()
  const version = int(conge.sync_version, 1) + 1
  const payload = payloadLigne(serConge(conge), COLS_CONGE)
  payload.statut = 'annule'
  payload.updated_at = ts
  payload.sync_version = version
  payload.client_ref = refDeLigne(conge)
  await dbExecBatch([
    {
      sql: 'UPDATE conges SET statut = ?, updated_at = ?, sync_version = COALESCE(sync_version, 1) + 1 WHERE id = ?',
      args: ['annule', ts, id],
    },
    ligneOutbox('conge', refDeLigne(conge), 'update', payload),
  ])
  const row = (await dbQuery('SELECT * FROM conges WHERE id = ?', [id]))[0]
  if (!row) throw localError(404, 'Congé non trouvé')
  return serConge(row)
}, 200)
