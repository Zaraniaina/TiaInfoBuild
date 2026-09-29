/**
 * Routes locales desktop — MODULE COMMERCIAL (Phase 4, 100 % hors-ligne).
 *
 * Chemins exacts : `commercial.service.ts`, `espaceClient.service.ts`,
 * `avenants.service.ts` (+ pages associées). Chaque réponse est calée sur le
 * JSON FastAPI (`app/routers/commercial.py`, `app/routers/espace_client.py`)
 * et sur les schémas `app/schemas/*.py` : listes = tableaux simples (list[*List])
 * avec `skip`/`limit` (défaut 0/100), détails = objets `*Response`, POST → 201,
 * DELETE → 204.
 *
 * Écritures : UNE SEULE `dbExecBatch` par mutation (écriture métier + ligne
 * `_sync_outbox` pour les entités CANONIQUES `client`, `devis`, `facture`).
 * Situations, avenants, contrats, paiements, demandes, projets, métrés,
 * notifications et lignes sont écrits LOCALEMENT SANS outbox (PHASE 4B,
 * commentaire dédié sous chaque écriture).
 *
 * Lectures : `is_deleted = 0` + `clausesTenant()` ; montants SQLite (TEXT)
 * convertis en `number` (float Python), booléens 0/1 → `bool`, horodatages
 * `AAAA-MM-JJTHH:MM:SS`, dates `AAAA-MM-JJ`.
 *
 * Relais réseau (non servis hors-ligne → 503) : `GET clients/{id}/fiche-acces`,
 * `GET utilisateurs/{id}/bon-de-creation`, `POST clients/{id}/envoyer-identifiants`
 * (les en-têtes `X-Utilisateur-Cree` / `X-Fiche-Access-Email-Envoye` /
 * `X-Utilisateur-TempPwd` ne sont pas reproductibles localement) et
 * `POST espace-client/mot-de-passe` (hachage serveur). Les vérifications de
 * permission (`espace_client:read|write`, permissions métier) ne sont pas
 * rejouées localement : le compte est déjà authentifié par le desktop.
 */
import { registerLocalPattern, registerLocalRoutes, type LocalRequest } from './registry'
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
  str,
  strOrNull,
  uuid,
  type JsonValue,
  type LocalRow,
} from './helpers'

// ============================================================
// Utilitaires de sérialisation (calés sur pydantic / FastAPI)
// ============================================================

/** Serialisation pydantic `datetime` : espace (CURRENT_TIMESTAMP) → T. */
function iso(v: unknown): string | null {
  const s = strOrNull(v)
  return s ? s.replace(' ', 'T') : null
}

/** Serialisation pydantic `date` : première composante AAAA-MM-JJ. */
function jour(v: unknown): string | null {
  const s = strOrNull(v)
  return s ? s.substring(0, 10) : null
}

/** Colonne monétaire TEXT → `float` FastAPI (0 par défaut). */
function reel(v: unknown): number {
  return floatOrNull(v) ?? 0
}

/** `round(x, 2)` Python (colonnes NUMERIC(12,2) côté MySQL). */
function r2(v: number): number {
  return Math.round(v * 100) / 100
}

/** Message « set trié » des validateurs pydantic (`Statut invalide…`). */
function messageStatuts(cle: string, valeurs: string[]): string {
  return `${cle} invalide. Valeurs autorisées: {${valeurs.map((v) => `'${v}'`).join(', ')}}`
}

/** `sum(...)` des compteurs de statut agrégés (dashboard espace-client). */
function cumul(stats: Record<string, number>, cles: string[]): number {
  return cles.reduce((total, cle) => total + (stats[cle] ?? 0), 0)
}

// ============================================================
// Énumérations (validateurs pydantic des schémas)
// ============================================================

const STATUTS_DEVIS = ['accepte', 'annule', 'brouillon', 'envoye', 'expire', 'refuse']
const STATUTS_FACTURE = ['annulee', 'emis', 'en_retard', 'envoye', 'partiellement_payee', 'payee']
const TYPES_FACTURE = ['acompte', 'avoir', 'pro_forma', 'pro_format', 'solde', 'standard']
const STATUTS_DEMANDE = ['annulee', 'en_etude', 'nouvelle', 'traitee']
const STATUTS_PROJET = ['annule', 'en_cours', 'en_etude', 'termine', 'valide']
const STATUTS_SITUATION = ['brouillon', 'rejetee', 'soumise', 'validee']
const TYPES_CLIENT = [
  'administration_publique',
  'association',
  'entreprise',
  'ong',
  'particulier',
  'promoteur_immobilier',
]
const CIVILITES = ['M', 'Mme', 'Mx']
const CATEGORIES_LIGNE = [
  'autres_frais',
  'main-d_œuvre',
  'materiel_et_engins',
  'materiaux',
  'prestations',
  'sous_traitance',
]

// ============================================================
// Helpers communs (lecture / écriture / numérotation)
// ============================================================

type Serialiseur = (r: LocalRow) => LocalRow

/** Opération de batch : `{sql, args}` (transaction unique `db_exec_batch`). */
type Operation = { sql: string; args: JsonValue[] }

/** Charge une entité non supprimée du tenant courant (404 sinon). */
async function charger(table: string, id: number, message: string): Promise<LocalRow> {
  const { clauses, args } = clausesTenant()
  const rows = await dbQuery(
    `SELECT * FROM ${table} WHERE id = ? AND ${clauses.join(' AND ')}`,
    [id, ...args],
  )
  const row = rows[0]
  if (!row) {
    throw localError(404, message)
  }
  return row
}

/**
 * Liste paginée façon FastAPI : `skip`/`limit` (défaut 0/100), filtres de
 * paramètres de requête, `is_deleted = 0` + tenant.
 */
async function lister(
  req: LocalRequest,
  table: string,
  serialiseur: Serialiseur,
  options: { ordre?: string; filtres?: Array<[string, string]> } = {},
): Promise<unknown> {
  const { clauses, args } = clausesTenant()
  const skip = Math.max(0, int(req.params.skip, 0))
  const limit = Math.max(0, int(req.params.limit, 100))
  const conds = [...clauses]
  const valeurs: JsonValue[] = [...args]
  for (const [param, colonne] of options.filtres ?? []) {
    const v = req.params[param]
    if (v === undefined || v === null || v === '') continue
    conds.push(`${colonne} = ?`)
    valeurs.push(Number(v))
  }
  const rows = await dbQuery(
    `SELECT * FROM ${table} WHERE ${conds.join(' AND ')} ORDER BY ${
      options.ordre ?? 'id ASC'
    } LIMIT ? OFFSET ?`,
    [...valeurs, limit, skip],
  )
  return rows.map(serialiseur)
}

/** Numéro `PREFIX-AAAA-NNNNN` (DEV / FAC / CTR / AV) — `numerotation.py`. */
async function prochainNumeroAnnee(table: string, prefixe: string): Promise<string> {
  const annee = new Date().getFullYear()
  const { clauses, args } = clausesTenant()
  const rows = await dbQuery(
    `SELECT numero FROM ${table} WHERE numero LIKE ? AND ${clauses.join(' AND ')}
     ORDER BY numero DESC LIMIT 1`,
    [`${prefixe}-${annee}-%`, ...args],
  )
  const m = new RegExp(`^${prefixe}-${annee}-(\\d+)$`).exec(str(rows[0]?.numero))
  const n = m ? int(m[1], 0) + 1 : 1
  return `${prefixe}-${annee}-${String(n).padStart(5, '0')}`
}

/** Numéro `PREFIX-NNNNN` (DEM / SIT / PRJ) — dernier identifiant + 1. */
async function prochainNumeroSimple(table: string, colonne: string, prefixe: string): Promise<string> {
  const { clauses, args } = clausesTenant()
  const rows = await dbQuery(
    `SELECT ${colonne} AS numero FROM ${table} WHERE ${colonne} LIKE ? AND ${clauses.join(' AND ')}
     ORDER BY id DESC LIMIT 1`,
    [`${prefixe}-%`, ...args],
  )
  const m = new RegExp(`^${prefixe}-(\\d+)$`).exec(str(rows[0]?.numero))
  const n = m ? int(m[1], 0) + 1 : 1
  return `${prefixe}-${String(n).padStart(5, '0')}`
}

/** Ligne `_sync_outbox` d'une entité canonique (incluse dans la batch). */
function outbox(entity: string, entityRef: string, op: string, payload: unknown): Operation {
  return {
    sql: `INSERT INTO _sync_outbox (entity, entity_id, op, payload, client_ts, pushed) VALUES (?, ?, ?, ?, ?, 0)`,
    args: [entity, entityRef, op, JSON.stringify(payload), horodatageLocal()],
  }
}

/** Ligne `notifications` (table SANS `is_deleted`) — insertée dans la batch. */
function ligneNotification(
  entrepriseId: number | null,
  clientId: number | null,
  typeNotif: string,
  titre: string,
  message: string,
  entiteType: string,
  horodatage: string,
): Operation {
  return {
    sql: `INSERT INTO notifications (entreprise_id, client_id, type, titre, message, entite_type, canal, envoye_email, lu, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 'application', 0, 0, ?)`,
    args: [entrepriseId, clientId, typeNotif, titre, message, entiteType, horodatage],
  }
}

type TypeChamp = 'texte' | 'entier' | 'reel' | 'booleen'

/**
 * Construit la clause `SET` d'un PUT façon `model_dump(exclude_unset=True)` :
 * seuls les champs PRÉSENTS dans le corps sont touchés (null explicite → NULL).
 */
function construireSet(
  data: Record<string, unknown>,
  definition: Record<string, TypeChamp>,
): { affectations: string[]; args: JsonValue[] } {
  const affectations: string[] = []
  const args: JsonValue[] = []
  for (const [cle, type] of Object.entries(definition)) {
    if (!(cle in data)) continue
    const v = data[cle]
    affectations.push(`${cle} = ?`)
    if (v === null || v === undefined) {
      args.push(null)
    } else if (type === 'texte') {
      args.push(str(v))
    } else if (type === 'entier') {
      args.push(intOrNull(v))
    } else if (type === 'booleen') {
      args.push(boolSql(v) ? 1 : 0)
    } else {
      args.push(floatOrNull(v))
    }
  }
  return { affectations, args }
}

/** Payload de mise à jour outbox : id + champs réellement modifiés + client_ref. */
function payloadMaj(
  id: number,
  data: Record<string, unknown>,
  definition: Record<string, TypeChamp>,
  clientRef: string,
): Record<string, unknown> {
  const champs: Record<string, unknown> = { id, client_ref: clientRef }
  for (const cle of Object.keys(definition)) {
    if (cle in data) champs[cle] = data[cle]
  }
  return champs
}

// ============================================================
// Lignes de devis / facture (validation + totaux)
// ============================================================

interface LigneCalculee {
  typeLigne: string
  articleId: number | null
  description: string
  categorie: string | null
  quantite: number
  unite: string | null
  prixUnitaire: number
  remise: number
  tauxTva: number
  totalHt: number
  totalTtc: number
  ordre: number
}

/** Valide une ligne (validateurs `LigneDevisCreate` / `LigneFactureCreate`). */
function validerLigne(data: Record<string, unknown>): LigneCalculee {
  const description = strOrNull(data.description)
  if (description === null) {
    throw localError(422, 'description : champ obligatoire.')
  }
  const quantite = floatOrNull(data.quantite) ?? 0
  if (quantite < 0) {
    throw localError(422, 'La quantité ne peut pas être négative')
  }
  const prixUnitaire = floatOrNull(data.prix_unitaire) ?? 0
  if (prixUnitaire < 0) {
    throw localError(422, 'La valeur ne peut pas être négative')
  }
  const remise = floatOrNull(data.remise) ?? 0
  if (remise < 0) {
    throw localError(422, 'La valeur ne peut pas être négative')
  }
  if (remise > 100) {
    throw localError(422, 'Le pourcentage doit être compris entre 0 et 100')
  }
  const tauxTva = floatOrNull(data.taux_tva) ?? 20
  if (tauxTva < 0 || tauxTva > 100) {
    throw localError(422, 'Le pourcentage doit être compris entre 0 et 100')
  }
  const categorie = strOrNull(data.categorie)
  if (categorie !== null && !CATEGORIES_LIGNE.includes(categorie)) {
    throw localError(422, messageStatuts('categorie', CATEGORIES_LIGNE))
  }
  const totalHtFourni =
    data.total_ht === undefined || data.total_ht === null ? null : floatOrNull(data.total_ht)
  if (totalHtFourni !== null && totalHtFourni < 0) {
    throw localError(422, 'La valeur ne peut pas être négative')
  }
  const totalTtcFourni =
    data.total_ttc === undefined || data.total_ttc === null ? null : floatOrNull(data.total_ttc)
  if (totalTtcFourni !== null && totalTtcFourni < 0) {
    throw localError(422, 'La valeur ne peut pas être négative')
  }
  const ht = totalHtFourni ?? r2(quantite * prixUnitaire * (1 - remise / 100))
  const ttc = totalTtcFourni ?? r2(ht * (1 + tauxTva / 100))
  return {
    typeLigne: str(data.type) || 'article',
    articleId: intOrNull(data.article_id),
    description,
    categorie,
    quantite,
    unite: strOrNull(data.unite),
    prixUnitaire,
    remise,
    tauxTva,
    totalHt: r2(ht),
    totalTtc: r2(ttc),
    ordre: int(data.ordre, 0),
  }
}

/**
 * SQL d'insertion d'une ligne (devis ou facture : mêmes colonnes).
 * `parClientRef` : le parent est résolu par sous-requête sur `client_ref`
 * (utilisé à la création, où l'id métier n'existe pas encore dans la batch).
 */
function sqlInsertLigne(table: string, cleEtrangere: string, parClientRef = false): string {
  const parent = parClientRef ? `(SELECT id FROM ${table === 'lignes_devis' ? 'devis' : 'factures'} WHERE client_ref = ?)` : '?'
  return `INSERT INTO ${table} (
      ${cleEtrangere}, type, article_id, description, categorie, quantite, unite,
      prix_unitaire, remise, taux_tva, total_ht, total_ttc, ordre,
      is_deleted, created_at, updated_at
    ) VALUES (${parent}, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
}

function argsInsertLigne(idParent: number, l: LigneCalculee, horodatage: string): JsonValue[] {
  return [
    idParent,
    l.typeLigne,
    l.articleId,
    l.description,
    l.categorie,
    l.quantite,
    l.unite,
    l.prixUnitaire,
    l.remise,
    l.tauxTva,
    l.totalHt,
    l.totalTtc,
    l.ordre,
    horodatage,
    horodatage,
  ]
}

/** Somme des totaux des lignes actives d'un devis. */
async function totauxLignesDevis(devisId: number): Promise<{ ht: number; ttc: number }> {
  const rows = await dbQuery(
    'SELECT total_ht, total_ttc FROM lignes_devis WHERE devis_id = ? AND is_deleted = 0',
    [devisId],
  )
  let ht = 0
  let ttc = 0
  for (const r of rows) {
    ht += reel(r.total_ht)
    ttc += reel(r.total_ttc)
  }
  return { ht: r2(ht), ttc: r2(ttc) }
}

/** Somme des totaux des lignes actives d'une facture. */
async function totauxLignesFacture(factureId: number): Promise<{ ht: number; ttc: number }> {
  const rows = await dbQuery(
    'SELECT total_ht, total_ttc FROM lignes_factures WHERE facture_id = ? AND is_deleted = 0',
    [factureId],
  )
  let ht = 0
  let ttc = 0
  for (const r of rows) {
    ht += reel(r.total_ht)
    ttc += reel(r.total_ttc)
  }
  return { ht: r2(ht), ttc: r2(ttc) }
}

/** Recalcul des totaux du devis PARENT + outbox `devis` (même batch que la ligne). */
function batchTotauxDevis(
  devisId: number,
  ht: number,
  ttc: number,
  clientRef: string,
  horodatage: string,
): Operation[] {
  const montantHt = r2(ht)
  const montantTtc = r2(ttc)
  return [
    {
      sql: `UPDATE devis SET montant_ht = ?, montant_ttc = ?, updated_at = ?,
            sync_version = COALESCE(sync_version, 0) + 1 WHERE id = ?`,
      args: [montantHt, montantTtc, horodatage, devisId],
    },
    outbox('devis', clientRef, 'update', {
      id: devisId,
      montant_ht: montantHt,
      montant_ttc: montantTtc,
      client_ref: clientRef,
    }),
  ]
}

/**
 * Recalcul des totaux du parent facture (ht / tva / ttc / reste) + outbox
 * `facture` (même batch que la ligne).
 */
function batchTotauxFacture(
  facture: LocalRow,
  ht: number,
  ttc: number,
  clientRef: string,
  horodatage: string,
): Operation[] {
  const factureId = int(facture.id, 0)
  const montantHt = r2(ht)
  const montantTtc = r2(ttc)
  const montantTva = r2(montantTtc - montantHt)
  const paye = reel(facture.montant_paye)
  const reste = r2(Math.max(montantTtc - paye, 0))
  return [
    {
      sql: `UPDATE factures SET montant_ht = ?, montant_tva = ?, montant_ttc = ?, reste_a_payer = ?,
            updated_at = ?, sync_version = COALESCE(sync_version, 0) + 1 WHERE id = ?`,
      args: [montantHt, montantTva, montantTtc, reste, horodatage, factureId],
    },
    outbox('facture', clientRef, 'update', {
      id: factureId,
      montant_ht: montantHt,
      montant_tva: montantTva,
      montant_ttc: montantTtc,
      reste_a_payer: reste,
      client_ref: clientRef,
    }),
  ]
}

// ============================================================
// Serialisations — CLIENTS
// ============================================================

function clientColonnes(r: LocalRow): LocalRow {
  return {
    id: int(r.id, 0),
    entreprise_id: intOrNull(r.entreprise_id),
    type: strOrNull(r.type),
    civilite: strOrNull(r.civilite),
    nom: str(r.nom),
    prenom: strOrNull(r.prenom),
    entreprise: strOrNull(r.entreprise),
    siret: strOrNull(r.siret),
    numero_tva: strOrNull(r.numero_tva),
    email: strOrNull(r.email),
    telephone: strOrNull(r.telephone),
    portable: strOrNull(r.portable),
    site_web: strOrNull(r.site_web),
    adresse: strOrNull(r.adresse),
    adresse_complement: strOrNull(r.adresse_complement),
    code_postal: strOrNull(r.code_postal),
    ville: strOrNull(r.ville),
    pays: strOrNull(r.pays),
    conditions_paiement: strOrNull(r.conditions_paiement),
    mode_paiement: strOrNull(r.mode_paiement),
    encours_max: reel(r.encours_max),
    encours_actuel: reel(r.encours_actuel),
    commercial_id: intOrNull(r.commercial_id),
    origine: strOrNull(r.origine),
    rib: strOrNull(r.rib),
    notes: strOrNull(r.notes),
    ca_total: reel(r.ca_total),
    dernier_contact: iso(r.dernier_contact),
    is_deleted: boolSql(r.is_deleted),
    created_at: iso(r.created_at),
    updated_at: iso(r.updated_at),
  }
}

/** `ClientList` (liste paginée du backend). */
function clientListe(r: LocalRow): LocalRow {
  return {
    id: int(r.id, 0),
    entreprise_id: intOrNull(r.entreprise_id),
    type: strOrNull(r.type),
    nom: str(r.nom),
    prenom: strOrNull(r.prenom),
    entreprise: strOrNull(r.entreprise),
    email: strOrNull(r.email),
    telephone: strOrNull(r.telephone),
    ville: strOrNull(r.ville),
    pays: strOrNull(r.pays),
    ca_total: reel(r.ca_total),
    encours_actuel: reel(r.encours_actuel),
    encours_max: reel(r.encours_max),
    is_deleted: boolSql(r.is_deleted),
    created_at: iso(r.created_at),
  }
}

/** Adresses du client (table `client_adresses`, absente → []). */
async function adressesClient(clientId: number): Promise<LocalRow[]> {
  const rows = await dbQueryOptionnel(
    'SELECT * FROM client_adresses WHERE client_id = ? AND is_deleted = 0 ORDER BY id ASC',
    [clientId],
  )
  return rows.map((r) => ({
    id: int(r.id, 0),
    client_id: intOrNull(r.client_id),
    type: str(r.type),
    defaut: boolSql(r.defaut),
    ligne1: str(r.ligne1),
    ligne2: strOrNull(r.ligne2),
    code_postal: strOrNull(r.code_postal),
    ville: strOrNull(r.ville),
    pays: strOrNull(r.pays),
    is_deleted: boolSql(r.is_deleted),
    created_at: iso(r.created_at),
    updated_at: iso(r.updated_at),
  }))
}

/** `ClientResponse` (détail) avec ses adresses. */
async function clientComplet(r: LocalRow): Promise<LocalRow> {
  return { ...clientColonnes(r), adresses: await adressesClient(int(r.id, 0)) }
}

// ============================================================
// Serialisations — DEVIS / FACTURES / LIGNES / PAIEMENTS
// ============================================================

/** `LigneDevisResponse` / `LigneFactureResponse` (colonnes identiques). */
function ligneDocument(r: LocalRow, cle: 'devis_id' | 'facture_id'): LocalRow {
  return {
    id: int(r.id, 0),
    [cle]: intOrNull(r[cle]),
    type: strOrNull(r.type),
    article_id: intOrNull(r.article_id),
    description: str(r.description),
    categorie: strOrNull(r.categorie),
    quantite: floatOrNull(r.quantite),
    unite: strOrNull(r.unite),
    prix_unitaire: floatOrNull(r.prix_unitaire),
    remise: floatOrNull(r.remise),
    taux_tva: floatOrNull(r.taux_tva),
    total_ht: floatOrNull(r.total_ht),
    total_ttc: floatOrNull(r.total_ttc),
    ordre: intOrNull(r.ordre),
    is_deleted: boolSql(r.is_deleted),
    created_at: iso(r.created_at),
    updated_at: iso(r.updated_at),
  }
}

function ligneDevis(r: LocalRow): LocalRow {
  return ligneDocument(r, 'devis_id')
}

function ligneFacture(r: LocalRow): LocalRow {
  return ligneDocument(r, 'facture_id')
}

/** `DevisList` (liste paginée du backend). */
function devisListe(r: LocalRow): LocalRow {
  return {
    id: int(r.id, 0),
    entreprise_id: intOrNull(r.entreprise_id),
    client_id: intOrNull(r.client_id),
    numero: strOrNull(r.numero),
    montant_ht: floatOrNull(r.montant_ht),
    montant_ttc: floatOrNull(r.montant_ttc),
    date_creation: jour(r.date_creation),
    date_validite: jour(r.date_validite),
    statut: strOrNull(r.statut),
    is_deleted: boolSql(r.is_deleted),
    created_at: iso(r.created_at),
  }
}

/** `DevisResponse` (détail, sans `lignes`). */
function devisColonnes(r: LocalRow): LocalRow {
  return {
    id: int(r.id, 0),
    entreprise_id: intOrNull(r.entreprise_id),
    client_id: intOrNull(r.client_id),
    numero: strOrNull(r.numero),
    objet: strOrNull(r.objet),
    montant_ht: floatOrNull(r.montant_ht),
    tva: floatOrNull(r.tva),
    montant_ttc: floatOrNull(r.montant_ttc),
    date_creation: jour(r.date_creation),
    date_validite: jour(r.date_validite),
    statut: strOrNull(r.statut),
    conditions_paiement: strOrNull(r.conditions_paiement),
    mode_paiement: strOrNull(r.mode_paiement),
    notes: strOrNull(r.notes),
    is_deleted: boolSql(r.is_deleted),
    created_at: iso(r.created_at),
    updated_at: iso(r.updated_at),
  }
}

/** Modèle brut (espace client : pas de `response_model`). */
function devisBrut(r: LocalRow): LocalRow {
  return {
    ...devisColonnes(r),
    projet_id: intOrNull(r.projet_id),
    reponse_le: iso(r.reponse_le),
    reponse_par_id: intOrNull(r.reponse_par_id),
    reponse_motif: strOrNull(r.reponse_motif),
  }
}

/** `FactureList` (liste paginée du backend). */
function factureListe(r: LocalRow): LocalRow {
  return {
    id: int(r.id, 0),
    entreprise_id: intOrNull(r.entreprise_id),
    client_id: intOrNull(r.client_id),
    numero: strOrNull(r.numero),
    type: strOrNull(r.type),
    montant_ttc: floatOrNull(r.montant_ttc),
    montant_paye: floatOrNull(r.montant_paye),
    reste_a_payer: floatOrNull(r.reste_a_payer),
    date_echeance: jour(r.date_echeance),
    statut: strOrNull(r.statut),
    is_deleted: boolSql(r.is_deleted),
    created_at: iso(r.created_at),
  }
}

/** `FactureResponse` (détail, sans `lignes`/`paiements`). */
function factureColonnes(r: LocalRow): LocalRow {
  return {
    id: int(r.id, 0),
    entreprise_id: intOrNull(r.entreprise_id),
    contrat_id: intOrNull(r.contrat_id),
    client_id: intOrNull(r.client_id),
    numero: strOrNull(r.numero),
    type: strOrNull(r.type),
    montant_ht: floatOrNull(r.montant_ht),
    tva: floatOrNull(r.tva),
    montant_tva: floatOrNull(r.montant_tva),
    montant_ttc: floatOrNull(r.montant_ttc),
    montant_acompte_deduit: floatOrNull(r.montant_acompte_deduit),
    montant_paye: floatOrNull(r.montant_paye),
    reste_a_payer: floatOrNull(r.reste_a_payer),
    date_creation: jour(r.date_creation),
    date_emission: jour(r.date_emission),
    date_echeance: jour(r.date_echeance),
    statut: strOrNull(r.statut),
    conditions_paiement: strOrNull(r.conditions_paiement),
    mode_paiement: strOrNull(r.mode_paiement),
    notes: strOrNull(r.notes),
    is_deleted: boolSql(r.is_deleted),
    created_at: iso(r.created_at),
    updated_at: iso(r.updated_at),
  }
}

/** Modèle brut (espace client). */
function factureBrut(r: LocalRow): LocalRow {
  return { ...factureColonnes(r), situation_id: intOrNull(r.situation_id) }
}

/** `PaiementResponse`. */
function paiementResp(r: LocalRow): LocalRow {
  return {
    id: int(r.id, 0),
    entreprise_id: intOrNull(r.entreprise_id),
    facture_id: intOrNull(r.facture_id),
    montant: reel(r.montant),
    date_paiement: jour(r.date_paiement),
    mode_paiement: strOrNull(r.mode_paiement),
    reference: strOrNull(r.reference),
    banque: strOrNull(r.banque),
    notes: strOrNull(r.notes),
    is_deleted: boolSql(r.is_deleted),
    created_at: iso(r.created_at),
    updated_at: iso(r.updated_at),
  }
}

// ============================================================
// Serialisations — CONTRATS / AVENANTS / DEMANDES / PROJETS / MÉTRÉS / SITUATIONS
// ============================================================

function contratColonnes(r: LocalRow): LocalRow {
  return {
    id: int(r.id, 0),
    entreprise_id: intOrNull(r.entreprise_id),
    client_id: intOrNull(r.client_id),
    reference: str(r.reference),
    type_contrat: strOrNull(r.type_contrat),
    montant: reel(r.montant),
    date_debut: jour(r.date_debut),
    date_fin: jour(r.date_fin),
    statut: strOrNull(r.statut),
    chantier_id: intOrNull(r.chantier_id),
    devis_id: intOrNull(r.devis_id),
    objet: strOrNull(r.objet),
    conditions_paiement: strOrNull(r.conditions_paiement),
    date_signature: jour(r.date_signature),
    garantie_mois: int(r.garantie_mois, 12),
    notes: strOrNull(r.notes),
    is_deleted: boolSql(r.is_deleted),
    created_at: iso(r.created_at),
    updated_at: iso(r.updated_at),
  }
}

function contratListe(r: LocalRow): LocalRow {
  const complet = contratColonnes(r)
  return {
    id: complet.id,
    entreprise_id: complet.entreprise_id,
    client_id: complet.client_id,
    reference: complet.reference,
    type_contrat: complet.type_contrat,
    montant: complet.montant,
    date_debut: complet.date_debut,
    date_fin: complet.date_fin,
    statut: complet.statut,
    chantier_id: complet.chantier_id,
    devis_id: complet.devis_id,
    created_at: complet.created_at,
  }
}

function avenantColonnes(r: LocalRow): LocalRow {
  return {
    id: int(r.id, 0),
    entreprise_id: intOrNull(r.entreprise_id),
    contrat_id: intOrNull(r.contrat_id),
    numero: str(r.numero),
    description: strOrNull(r.description),
    impact_montant: reel(r.impact_montant),
    date_signature: jour(r.date_signature),
    statut: strOrNull(r.statut),
    fichier_url: strOrNull(r.fichier_url),
    notes: strOrNull(r.notes),
    is_deleted: boolSql(r.is_deleted),
    created_at: iso(r.created_at),
    updated_at: iso(r.updated_at),
  }
}

function avenantListe(r: LocalRow): LocalRow {
  const complet = avenantColonnes(r)
  return {
    id: complet.id,
    entreprise_id: complet.entreprise_id,
    contrat_id: complet.contrat_id,
    numero: complet.numero,
    description: complet.description,
    impact_montant: complet.impact_montant,
    date_signature: complet.date_signature,
    statut: complet.statut,
    created_at: complet.created_at,
  }
}

/** `DemandeTravauxResponse` (= modèle brut, utilisé aussi par l'espace client). */
function demandeComplet(r: LocalRow): LocalRow {
  return {
    id: int(r.id, 0),
    entreprise_id: intOrNull(r.entreprise_id),
    client_id: intOrNull(r.client_id),
    commercial_id: intOrNull(r.commercial_id),
    numero: strOrNull(r.numero),
    objet: str(r.objet),
    type_projet: strOrNull(r.type_projet),
    description: strOrNull(r.description),
    localisation: strOrNull(r.localisation),
    date_demande: iso(r.date_demande),
    date_souhaitee: iso(r.date_souhaitee),
    documents_fournis: strOrNull(r.documents_fournis),
    plans_disponibles: boolSql(r.plans_disponibles),
    observations: strOrNull(r.observations),
    statut: strOrNull(r.statut),
    is_deleted: boolSql(r.is_deleted),
    created_at: iso(r.created_at),
    updated_at: iso(r.updated_at),
  }
}

function demandeListe(r: LocalRow): LocalRow {
  const complet = demandeComplet(r)
  return {
    id: complet.id,
    entreprise_id: complet.entreprise_id,
    client_id: complet.client_id,
    numero: complet.numero,
    objet: complet.objet,
    type_projet: complet.type_projet,
    localisation: complet.localisation,
    date_demande: complet.date_demande,
    statut: complet.statut,
    is_deleted: complet.is_deleted,
    created_at: complet.created_at,
  }
}

/** `ProjetResponse` (= modèle brut, utilisé aussi par l'espace client). */
function projetComplet(r: LocalRow): LocalRow {
  return {
    id: int(r.id, 0),
    entreprise_id: intOrNull(r.entreprise_id),
    client_id: intOrNull(r.client_id),
    demande_id: intOrNull(r.demande_id),
    responsable_id: intOrNull(r.responsable_id),
    reference: strOrNull(r.reference),
    nom: str(r.nom),
    type_projet: strOrNull(r.type_projet),
    description: strOrNull(r.description),
    localisation: strOrNull(r.localisation),
    adresse: strOrNull(r.adresse),
    longueur: floatOrNull(r.longueur),
    largeur: floatOrNull(r.largeur),
    hauteur: floatOrNull(r.hauteur),
    surface: floatOrNull(r.surface),
    volume: floatOrNull(r.volume),
    nombre_niveaux: intOrNull(r.nombre_niveaux),
    plans_documents: strOrNull(r.plans_documents),
    observations: strOrNull(r.observations),
    statut: strOrNull(r.statut),
    is_deleted: boolSql(r.is_deleted),
    created_at: iso(r.created_at),
    updated_at: iso(r.updated_at),
  }
}

function projetListe(r: LocalRow): LocalRow {
  const complet = projetComplet(r)
  return {
    id: complet.id,
    entreprise_id: complet.entreprise_id,
    client_id: complet.client_id,
    demande_id: complet.demande_id,
    reference: complet.reference,
    nom: complet.nom,
    type_projet: complet.type_projet,
    localisation: complet.localisation,
    surface: complet.surface,
    statut: complet.statut,
    is_deleted: complet.is_deleted,
    created_at: complet.created_at,
  }
}

/** `MetreResponse` (= modèle brut). */
function metreComplet(r: LocalRow): LocalRow {
  return {
    id: int(r.id, 0),
    entreprise_id: intOrNull(r.entreprise_id),
    projet_id: intOrNull(r.projet_id),
    ouvrage: str(r.ouvrage),
    designation: strOrNull(r.designation),
    formule: strOrNull(r.formule),
    dimensions: strOrNull(r.dimensions),
    unite: strOrNull(r.unite),
    quantite: floatOrNull(r.quantite),
    observations: strOrNull(r.observations),
    document_reference: strOrNull(r.document_reference),
    ordre: intOrNull(r.ordre),
    is_deleted: boolSql(r.is_deleted),
    created_at: iso(r.created_at),
    updated_at: iso(r.updated_at),
  }
}

function metreListe(r: LocalRow): LocalRow {
  const complet = metreComplet(r)
  return {
    id: complet.id,
    entreprise_id: complet.entreprise_id,
    projet_id: complet.projet_id,
    ouvrage: complet.ouvrage,
    unite: complet.unite,
    quantite: complet.quantite,
    ordre: complet.ordre,
    is_deleted: complet.is_deleted,
    created_at: complet.created_at,
  }
}

/** `SituationTravauxResponse` (= modèle brut, utilisé aussi par l'espace client). */
function situationComplet(r: LocalRow): LocalRow {
  return {
    id: int(r.id, 0),
    entreprise_id: intOrNull(r.entreprise_id),
    chantier_id: intOrNull(r.chantier_id),
    contrat_id: intOrNull(r.contrat_id),
    numero: strOrNull(r.numero),
    periode: strOrNull(r.periode),
    date_etablissement: iso(r.date_etablissement),
    avancement: floatOrNull(r.avancement),
    montant: floatOrNull(r.montant),
    observations: strOrNull(r.observations),
    statut: strOrNull(r.statut),
    is_deleted: boolSql(r.is_deleted),
    created_at: iso(r.created_at),
    updated_at: iso(r.updated_at),
  }
}

function situationListe(r: LocalRow): LocalRow {
  const complet = situationComplet(r)
  return {
    id: complet.id,
    entreprise_id: complet.entreprise_id,
    chantier_id: complet.chantier_id,
    contrat_id: complet.contrat_id,
    numero: complet.numero,
    periode: complet.periode,
    date_etablissement: complet.date_etablissement,
    avancement: complet.avancement,
    montant: complet.montant,
    statut: complet.statut,
    is_deleted: complet.is_deleted,
    created_at: complet.created_at,
  }
}

// PHASE 4B : sync de cette entité à brancher. (lignes_situation)
/** `LigneSituationResponse`. */
function ligneSituation(r: LocalRow): LocalRow {
  return {
    id: int(r.id, 0),
    situation_id: intOrNull(r.situation_id),
    ouvrage: str(r.ouvrage),
    quantite_periode: floatOrNull(r.quantite_periode),
    quantite_cumulee: floatOrNull(r.quantite_cumulee),
    unite: strOrNull(r.unite),
    prix_unitaire: floatOrNull(r.prix_unitaire),
    montant: floatOrNull(r.montant),
    observations: strOrNull(r.observations),
    is_deleted: boolSql(r.is_deleted),
    created_at: iso(r.created_at),
    updated_at: iso(r.updated_at),
  }
}

// ============================================================
// Serialisations — ESPACE CLIENT (modèles bruts)
// ============================================================

function chantierBrut(r: LocalRow): LocalRow {
  return {
    id: int(r.id, 0),
    entreprise_id: intOrNull(r.entreprise_id),
    client_id: intOrNull(r.client_id),
    chef_chantier_id: intOrNull(r.chef_chantier_id),
    projet_id: intOrNull(r.projet_id),
    numero: strOrNull(r.numero),
    nom: str(r.nom),
    adresse: strOrNull(r.adresse),
    code_postal: strOrNull(r.code_postal),
    ville: strOrNull(r.ville),
    date_debut: jour(r.date_debut),
    date_fin_prevue: jour(r.date_fin_prevue),
    date_fin_reelle: jour(r.date_fin_reelle),
    budget_prevu: reel(r.budget_prevu),
    budget_previsionnel: reel(r.budget_previsionnel),
    budget_reel: reel(r.budget_reel),
    marge_cible: reel(r.marge_cible),
    tva: floatOrNull(r.tva),
    statut: strOrNull(r.statut),
    description: strOrNull(r.description),
    region: strOrNull(r.region),
    is_deleted: boolSql(r.is_deleted),
    created_at: iso(r.created_at),
    updated_at: iso(r.updated_at),
  }
}

function phaseBrut(r: LocalRow): LocalRow {
  return {
    id: int(r.id, 0),
    chantier_id: int(r.chantier_id, 0),
    nom: str(r.nom),
    description: strOrNull(r.description),
    date_debut: jour(r.date_debut),
    date_fin: jour(r.date_fin),
    budget: reel(r.budget),
    avancement_pct: int(r.avancement_pct, 0),
    statut: strOrNull(r.statut),
    ordre: int(r.ordre, 0),
    is_deleted: boolSql(r.is_deleted),
    created_at: iso(r.created_at),
    updated_at: iso(r.updated_at),
  }
}

// PHASE 4B : sync de cette entité à brancher. (notifications)
/** `Notification` — table SANS `is_deleted` ni `updated_at`. */
function notificationBrut(r: LocalRow): LocalRow {
  return {
    id: int(r.id, 0),
    entreprise_id: intOrNull(r.entreprise_id),
    utilisateur_id: intOrNull(r.utilisateur_id),
    client_id: intOrNull(r.client_id),
    type: str(r.type),
    titre: str(r.titre),
    message: strOrNull(r.message),
    entite_type: strOrNull(r.entite_type),
    entite_id: intOrNull(r.entite_id),
    canal: str(r.canal) || 'application',
    envoye_email: boolSql(r.envoye_email),
    lu: boolSql(r.lu),
    created_at: iso(r.created_at),
  }
}

function documentBrut(r: LocalRow): LocalRow {
  return {
    id: int(r.id, 0),
    entreprise_id: intOrNull(r.entreprise_id),
    client_id: intOrNull(r.client_id),
    chantier_id: intOrNull(r.chantier_id),
    projet_id: intOrNull(r.projet_id),
    employe_id: intOrNull(r.employe_id),
    categorie: str(r.categorie) || 'autre',
    nom: str(r.nom),
    fichier_url: strOrNull(r.fichier_url),
    mime_type: strOrNull(r.mime_type),
    taille_octets: intOrNull(r.taille_octets),
    description: strOrNull(r.description),
    is_deleted: boolSql(r.is_deleted),
    created_at: iso(r.created_at),
    updated_at: iso(r.updated_at),
  }
}

// ============================================================
// CLIENTS — GET / POST / PUT
// ============================================================

/** `GET commercial/clients` — `list[ClientList]`, `skip`/`limit` (0/100). */
async function listClients(req: LocalRequest): Promise<unknown> {
  // Le backend ignore le paramètre `search` : local identique.
  return lister(req, 'clients', clientListe)
}

/** `GET commercial/clients/{id}` — `ClientResponse`. */
async function getClient(req: LocalRequest): Promise<unknown> {
  const id = int(req.pathParams[0], 0)
  const client = await charger('clients', id, 'Client non trouvé')
  return clientComplet(client)
}

/** `POST commercial/clients` (201) — INSERT + outbox `client` dans une batch. */
async function createClient(req: LocalRequest): Promise<unknown> {
  const body = req.data
  const nom = strOrNull(body.nom)
  if (nom === null) {
    throw localError(422, 'nom : champ obligatoire.')
  }
  const typeClient =
    body.type === undefined || body.type === null ? 'particulier' : str(body.type)
  if (!TYPES_CLIENT.includes(typeClient)) {
    throw localError(422, messageStatuts('type', TYPES_CLIENT))
  }
  if (body.civilite !== undefined && body.civilite !== null) {
    const civilite = str(body.civilite)
    if (!CIVILITES.includes(civilite)) {
      throw localError(422, "Civilité invalide. Valeurs autorisées: M, Mme, Mx")
    }
  }
  const encoursMax =
    body.encours_max === undefined || body.encours_max === null ? 0 : (floatOrNull(body.encours_max) ?? 0)
  if (encoursMax < 0) {
    throw localError(422, "L'encours maximum ne peut pas être négatif")
  }
  const email = strOrNull(body.email)
  if (email !== null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw localError(422, `email : adresse e-mail invalide (${email})`)
  }

  const maintenant = horodatageLocal()
  const clientRef = uuid()
  const entrepriseId = currentEntrepriseId()
  const valeurs: JsonValue[] = [
    entrepriseId,
    typeClient,
    body.civilite === undefined || body.civilite === null ? null : str(body.civilite),
    nom,
    strOrNull(body.prenom),
    strOrNull(body.entreprise),
    strOrNull(body.siret),
    strOrNull(body.numero_tva),
    email,
    strOrNull(body.telephone),
    strOrNull(body.portable),
    strOrNull(body.site_web),
    strOrNull(body.adresse),
    strOrNull(body.adresse_complement),
    strOrNull(body.code_postal),
    strOrNull(body.ville),
    body.pays === undefined || body.pays === null ? 'Madagascar' : str(body.pays),
    strOrNull(body.conditions_paiement),
    strOrNull(body.mode_paiement),
    encoursMax,
    intOrNull(body.commercial_id),
    strOrNull(body.origine),
    strOrNull(body.rib),
    strOrNull(body.notes),
    maintenant,
    maintenant,
    clientRef,
  ]
  const entree = {
    entreprise_id: entrepriseId,
    type: typeClient,
    nom,
    email,
    encours_max: encoursMax,
    client_ref: clientRef,
  }

  // Transaction unique : écriture métier + outbox (règle du plan §6.1).
  await dbExecBatch([
    {
      sql: `INSERT INTO clients (
        entreprise_id, type, civilite, nom, prenom, entreprise, siret, numero_tva,
        email, telephone, portable, site_web, adresse, adresse_complement,
        code_postal, ville, pays, conditions_paiement, mode_paiement, encours_max,
        encours_actuel, commercial_id, origine, rib, notes, ca_total,
        is_deleted, created_at, updated_at, sync_version, client_ref
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '0', ?, ?, ?, ?, '0', 0, ?, ?, 1, ?)`,
      args: valeurs,
    },
    outbox('client', clientRef, 'create', entree),
  ])
  // `last_id` porte sur le outbox : on retrouve l'id métier via le `client_ref`.
  const rows = await dbQuery('SELECT * FROM clients WHERE client_ref = ? LIMIT 1', [clientRef])
  return clientComplet(rows[0] ?? {})
}

const DEF_CLIENT: Record<string, TypeChamp> = {
  nom: 'texte',
  prenom: 'texte',
  entreprise: 'texte',
  email: 'texte',
  telephone: 'texte',
  portable: 'texte',
  adresse: 'texte',
  adresse_complement: 'texte',
  code_postal: 'texte',
  ville: 'texte',
  pays: 'texte',
  mode_paiement: 'texte',
  siret: 'texte',
  numero_tva: 'texte',
  conditions_paiement: 'texte',
  site_web: 'texte',
  rib: 'texte',
  notes: 'texte',
  civilite: 'texte',
  type: 'texte',
  origine: 'texte',
  encours_max: 'reel',
  commercial_id: 'entier',
}

/** `PUT commercial/clients/{id}` — `exclude_unset` + outbox `client` (update). */
async function updateClient(req: LocalRequest): Promise<unknown> {
  const id = int(req.pathParams[0], 0)
  const existant = await charger('clients', id, 'Client non trouvé')
  const body = req.data

  if ('type' in body && body.type !== null && !TYPES_CLIENT.includes(str(body.type))) {
    throw localError(422, messageStatuts('type', TYPES_CLIENT))
  }
  if ('civilite' in body && body.civilite !== null && !CIVILITES.includes(str(body.civilite))) {
    throw localError(422, "Civilité invalide. Valeurs autorisées: M, Mme, Mx")
  }
  if ('encours_max' in body && body.encours_max !== null) {
    const encours = floatOrNull(body.encours_max) ?? 0
    if (encours < 0) {
      throw localError(422, "L'encours maximum ne peut pas être négatif")
    }
  }
  if ('email' in body && body.email !== null) {
    const email = str(body.email)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw localError(422, `email : adresse e-mail invalide (${email})`)
    }
  }

  const { affectations, args } = construireSet(body, DEF_CLIENT)
  if (affectations.length === 0) {
    return clientComplet(existant)
  }

  const maintenant = horodatageLocal()
  const clientRef = str(existant.client_ref) || String(id)
  await dbExecBatch([
    {
      sql: `UPDATE clients SET ${affectations.join(', ')}, updated_at = ?,
            sync_version = COALESCE(sync_version, 0) + 1 WHERE id = ?`,
      args: [...args, maintenant, id],
    },
    outbox('client', clientRef, 'update', payloadMaj(id, body, DEF_CLIENT, clientRef)),
  ])
  const rows = await dbQuery('SELECT * FROM clients WHERE id = ?', [id])
  return clientComplet(rows[0] ?? {})
}

// ============================================================
// DEVIS — GET / POST / PUT / valider / transformer / lignes
// ============================================================

async function chargerLignesDevis(devisId: number): Promise<LocalRow[]> {
  const rows = await dbQuery(
    'SELECT * FROM lignes_devis WHERE devis_id = ? AND is_deleted = 0 ORDER BY ordre ASC',
    [devisId],
  )
  return rows.map(ligneDevis)
}

/** `GET commercial/devis` — `list[DevisList]` (filtres `statut`, `client_id`). */
async function listDevis(req: LocalRequest): Promise<unknown> {
  return lister(req, 'devis', devisListe, {
    filtres: [
      ['statut', 'statut'],
      ['client_id', 'client_id'],
    ],
  })
}

/** `GET commercial/devis/{id}` — `DevisResponse` + `lignes[]`. */
async function getDevis(req: LocalRequest): Promise<unknown> {
  const id = int(req.pathParams[0], 0)
  const devis = await charger('devis', id, 'Devis non trouvé')
  return { ...devisColonnes(devis), lignes: await chargerLignesDevis(id) }
}

/** `POST commercial/devis` (201) — INSERT + lignes + notif + outbox `devis`. */
async function createDevis(req: LocalRequest): Promise<unknown> {
  const body = req.data
  const clientId = intOrNull(body.client_id) ?? 0
  if (clientId < 1) {
    throw localError(422, 'client_id : champ obligatoire (valeur ≥ 1 attendue).')
  }
  const statut = strOrNull(body.statut) ?? 'brouillon'
  if (!STATUTS_DEVIS.includes(statut)) {
    throw localError(422, messageStatuts('statut', STATUTS_DEVIS))
  }
  const montantHt = floatOrNull(body.montant_ht) ?? 0
  const montantTtc = floatOrNull(body.montant_ttc) ?? 0
  if (montantHt < 0 || montantTtc < 0) {
    throw localError(422, 'Le montant ne peut pas être négatif')
  }
  const tva = floatOrNull(body.tva) ?? 20
  if (tva < 0 || tva > 100) {
    throw localError(422, 'La TVA doit être comprise entre 0 et 100')
  }

  const { clauses, args } = clausesTenant()
  const clients = await dbQuery(
    `SELECT id FROM clients WHERE id = ? AND ${clauses.join(' AND ')}`,
    [clientId, ...args],
  )
  if (!clients[0]) {
    throw localError(404, 'Client non trouvé')
  }

  const numero = strOrNull(body.numero) || (await prochainNumeroAnnee('devis', 'DEV'))
  const maintenant = horodatageLocal()
  const clientRef = uuid()
  const entrepriseId = currentEntrepriseId()

  const lignes = (Array.isArray(body.lignes) ? body.lignes : []).map((l) =>
    validerLigne(l as Record<string, unknown>),
  )
  let htFinal = montantHt
  let ttcFinal = montantTtc
  if (lignes.length > 0) {
    htFinal = r2(lignes.reduce((s, l) => s + l.totalHt, 0))
    ttcFinal = r2(lignes.reduce((s, l) => s + l.totalTtc, 0))
  }

  const payload = {
    entreprise_id: entrepriseId,
    client_id: clientId,
    projet_id: intOrNull(body.projet_id),
    numero,
    objet: strOrNull(body.objet),
    montant_ht: htFinal,
    tva,
    montant_ttc: ttcFinal,
    statut,
    client_ref: clientRef,
  }

  const batch: Operation[] = [
    {
      sql: `INSERT INTO devis (
        entreprise_id, client_id, projet_id, numero, objet, montant_ht, tva, montant_ttc,
        date_creation, date_validite, statut, conditions_paiement, mode_paiement, notes,
        is_deleted, created_at, updated_at, sync_version, client_ref
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 1, ?)`,
      args: [
        entrepriseId,
        clientId,
        intOrNull(body.projet_id),
        numero,
        strOrNull(body.objet),
        htFinal,
        tva,
        ttcFinal,
        dateLocale(),
        strOrNull(body.date_validite),
        statut,
        strOrNull(body.conditions_paiement),
        strOrNull(body.mode_paiement),
        strOrNull(body.notes),
        maintenant,
        maintenant,
        clientRef,
      ],
    },
  ]
  // Lignes : le parent est résolu par sous-requête sur le `client_ref` fraîchement
  // inséré dans la MÊME transaction (aucune écriture hors batch).
  if (lignes.length > 0) {
    batch.push({
      sql: sqlInsertLigne('lignes_devis', 'devis_id', true),
      args: [clientRef, ...argsInsertLigne(0, lignes[0], maintenant).slice(1)],
    })
    for (const l of lignes.slice(1)) {
      batch.push({
        sql: sqlInsertLigne('lignes_devis', 'devis_id', true),
        args: [clientRef, ...argsInsertLigne(0, l, maintenant).slice(1)],
      })
    }
  }

  batch.push(
    ligneNotification(
      entrepriseId,
      clientId,
      'devis_cree',
      `Devis ${numero}`,
      `Le devis ${numero} a été créé.`,
      'devis',
      maintenant,
    ),
    outbox('devis', clientRef, 'create', payload),
  )
  await dbExecBatch(batch)

  const rows = await dbQuery('SELECT * FROM devis WHERE client_ref = ? LIMIT 1', [clientRef])
  const devis = rows[0] ?? {}
  const devisId = int(devis.id, 0)
  return { ...devisColonnes(devis), lignes: await chargerLignesDevis(devisId) }
}

const DEF_DEVIS: Record<string, TypeChamp> = {
  numero: 'texte',
  objet: 'texte',
  montant_ht: 'reel',
  tva: 'reel',
  montant_ttc: 'reel',
  date_validite: 'texte',
  statut: 'texte',
  conditions_paiement: 'texte',
  mode_paiement: 'texte',
  notes: 'texte',
}

/** `PUT commercial/devis/{id}` — `exclude_unset` + outbox `devis` (update). */
async function updateDevis(req: LocalRequest): Promise<unknown> {
  const id = int(req.pathParams[0], 0)
  const existant = await charger('devis', id, 'Devis non trouvé')
  const body = req.data

  if ('statut' in body && body.statut !== null && !STATUTS_DEVIS.includes(str(body.statut))) {
    throw localError(422, messageStatuts('statut', STATUTS_DEVIS))
  }
  if ('tva' in body && body.tva !== null) {
    const tva = floatOrNull(body.tva) ?? 20
    if (tva < 0 || tva > 100) {
      throw localError(422, 'La TVA doit être comprise entre 0 et 100')
    }
  }
  if (('montant_ht' in body && (floatOrNull(body.montant_ht) ?? 0) < 0) ||
      ('montant_ttc' in body && (floatOrNull(body.montant_ttc) ?? 0) < 0)) {
    throw localError(422, 'Le montant ne peut pas être négatif')
  }

  const { affectations, args } = construireSet(body, DEF_DEVIS)
  if (affectations.length === 0) {
    return { ...devisColonnes(existant), lignes: await chargerLignesDevis(id) }
  }

  const maintenant = horodatageLocal()
  const clientRef = str(existant.client_ref) || String(id)
  const batch: Operation[] = [
    {
      sql: `UPDATE devis SET ${affectations.join(', ')}, updated_at = ?,
            sync_version = COALESCE(sync_version, 0) + 1 WHERE id = ?`,
      args: [...args, maintenant, id],
    },
  ]
  // Notification locale sur la transition « envoye » (PHASE 4B, sans outbox).
  if (str(body.statut) === 'envoye' && str(existant.statut) !== 'envoye') {
    batch.push(
      ligneNotification(
        intOrNull(existant.entreprise_id),
        intOrNull(existant.client_id),
        'devis_envoye',
        `Devis ${str(existant.numero)} envoyé`,
        `Le devis ${str(existant.numero)} a été envoyé.`,
        'devis',
        maintenant,
      ),
    )
  }
  batch.push(outbox('devis', clientRef, 'update', payloadMaj(id, body, DEF_DEVIS, clientRef)))
  await dbExecBatch(batch)

  const rows = await dbQuery('SELECT * FROM devis WHERE id = ?', [id])
  return { ...devisColonnes(rows[0] ?? {}), lignes: await chargerLignesDevis(id) }
}

/** `POST commercial/devis/{id}/valider` — transition accepte/refuse + outbox. */
async function validerDevis(req: LocalRequest): Promise<unknown> {
  const id = int(req.pathParams[0], 0)
  const devis = await charger('devis', id, 'Devis non trouvé')
  const approuve = boolSql(req.data.approuve)
  // Écart assumé : le backend exige `avis`, le service n'envoie que
  // `approuve` → `avis` reste optionnel pour garder le flux utilisable.
  const avis = strOrNull(req.data.avis)
  const statut = approuve ? 'accepte' : 'refuse'
  const maintenant = horodatageLocal()
  const clientRef = str(devis.client_ref) || String(id)

  await dbExecBatch([
    {
      sql: `UPDATE devis SET statut = ?, reponse_le = ?, reponse_motif = ?, updated_at = ?,
            sync_version = COALESCE(sync_version, 0) + 1 WHERE id = ?`,
      args: [statut, maintenant, avis, maintenant, id],
    },
    outbox('devis', clientRef, 'update', {
      id,
      statut,
      reponse_le: maintenant,
      reponse_motif: avis,
      client_ref: clientRef,
    }),
  ])
  const rows = await dbQuery('SELECT * FROM devis WHERE id = ?', [id])
  return { ...devisColonnes(rows[0] ?? {}), lignes: await chargerLignesDevis(id) }
}

/**
 * `POST commercial/devis/{id}/transformer-contrat` (201) — création du contrat.
 * PHASE 4B : sync de cette entité à brancher (contrats n'est pas canonique).
 */
async function transformerContrat(req: LocalRequest): Promise<unknown> {
  const id = int(req.pathParams[0], 0)
  const devis = await charger('devis', id, 'Devis non trouvé')
  if (str(devis.statut) !== 'accepte') {
    throw localError(400, 'Seul un devis accepté peut être transformé en contrat')
  }
  const { clauses, args } = clausesTenant()
  const existants = await dbQuery(
    `SELECT id FROM contrats WHERE devis_id = ? AND ${clauses.join(' AND ')}`,
    [id, ...args],
  )
  if (existants[0]) {
    throw localError(400, 'Ce devis est déjà transformé en contrat')
  }

  const reference = await prochainNumeroAnnee('contrats', 'CTR')
  const maintenant = horodatageLocal()
  const resultat = await dbExecBatch([
    {
      sql: `INSERT INTO contrats (
        entreprise_id, client_id, reference, type_contrat, montant, date_debut, date_fin,
        statut, chantier_id, devis_id, objet, conditions_paiement, date_signature,
        garantie_mois, notes, is_deleted, created_at, updated_at
      ) VALUES (?, ?, ?, NULL, ?, ?, NULL, 'en_cours', NULL, ?, ?, ?, NULL, 12, NULL, 0, ?, ?)`,
      args: [
        intOrNull(devis.entreprise_id),
        intOrNull(devis.client_id),
        reference,
        reel(devis.montant_ttc),
        dateLocale(),
        id,
        strOrNull(devis.objet),
        strOrNull(devis.conditions_paiement),
        maintenant,
        maintenant,
      ],
    },
  ])
  const rows = await dbQuery('SELECT * FROM contrats WHERE id = ?', [int(resultat.last_id, 0)])
  return contratColonnes(rows[0] ?? {})
}

// PHASE 4B : sync de cette entité à brancher. (lignes_devis)
/** `POST commercial/devis/{id}/lignes` (201) — ligne + recalcul parent + outbox. */
async function createLigneDevis(req: LocalRequest): Promise<unknown> {
  const devisId = int(req.pathParams[0], 0)
  const devis = await charger('devis', devisId, 'Devis non trouvé')
  const ligne = validerLigne(req.data)
  const maintenant = horodatageLocal()
  const clientRef = str(devis.client_ref) || String(devisId)
  const totaux = await totauxLignesDevis(devisId)

  await dbExecBatch([
    { sql: sqlInsertLigne('lignes_devis', 'devis_id'), args: argsInsertLigne(devisId, ligne, maintenant) },
    ...batchTotauxDevis(devisId, totaux.ht + ligne.totalHt, totaux.ttc + ligne.totalTtc, clientRef, maintenant),
  ])
  const rows = await dbQuery(
    'SELECT * FROM lignes_devis WHERE devis_id = ? ORDER BY id DESC LIMIT 1',
    [devisId],
  )
  return ligneDevis(rows[0] ?? {})
}

/** `PUT commercial/devis/{id}/lignes/{ligneId}` — fusion + recalcul + outbox. */
async function updateLigneDevis(req: LocalRequest): Promise<unknown> {
  const devisId = int(req.pathParams[0], 0)
  const ligneId = int(req.pathParams[1], 0)
  const devis = await charger('devis', devisId, 'Devis non trouvé')
  const { clauses, args } = clausesTenant()
  const rows = await dbQuery(
    `SELECT * FROM lignes_devis WHERE id = ? AND devis_id = ? AND ${clauses.join(' AND ')}`,
    [ligneId, devisId, ...args],
  )
  const existante = rows[0]
  if (!existante) {
    throw localError(404, 'Ligne non trouvée')
  }

  const fusion: Record<string, unknown> = { ...existante, ...req.data }
  if (!('total_ht' in req.data)) delete fusion.total_ht
  if (!('total_ttc' in req.data)) delete fusion.total_ttc
  const ligne = validerLigne(fusion)

  const maintenant = horodatageLocal()
  const clientRef = str(devis.client_ref) || String(devisId)
  const totaux = await totauxLignesDevis(devisId)
  const ht = r2(totaux.ht - reel(existante.total_ht) + ligne.totalHt)
  const ttc = r2(totaux.ttc - reel(existante.total_ttc) + ligne.totalTtc)

  await dbExecBatch([
    {
      sql: `UPDATE lignes_devis SET type = ?, article_id = ?, description = ?, categorie = ?,
            quantite = ?, unite = ?, prix_unitaire = ?, remise = ?, taux_tva = ?,
            total_ht = ?, total_ttc = ?, ordre = ?, updated_at = ? WHERE id = ?`,
      args: [
        ligne.typeLigne,
        ligne.articleId,
        ligne.description,
        ligne.categorie,
        ligne.quantite,
        ligne.unite,
        ligne.prixUnitaire,
        ligne.remise,
        ligne.tauxTva,
        ligne.totalHt,
        ligne.totalTtc,
        ligne.ordre,
        maintenant,
        ligneId,
      ],
    },
    ...batchTotauxDevis(devisId, ht, ttc, clientRef, maintenant),
  ])
  const maj = await dbQuery('SELECT * FROM lignes_devis WHERE id = ?', [ligneId])
  return ligneDevis(maj[0] ?? {})
}

/** `DELETE commercial/devis/{id}/lignes/{ligneId}` (204) — soft-delete + outbox. */
async function deleteLigneDevis(req: LocalRequest): Promise<unknown> {
  const devisId = int(req.pathParams[0], 0)
  const ligneId = int(req.pathParams[1], 0)
  const devis = await charger('devis', devisId, 'Devis non trouvé')
  const { clauses, args } = clausesTenant()
  const rows = await dbQuery(
    `SELECT * FROM lignes_devis WHERE id = ? AND devis_id = ? AND ${clauses.join(' AND ')}`,
    [ligneId, devisId, ...args],
  )
  const existante = rows[0]
  if (!existante) {
    throw localError(404, 'Ligne non trouvée')
  }

  const maintenant = horodatageLocal()
  const clientRef = str(devis.client_ref) || String(devisId)
  const totaux = await totauxLignesDevis(devisId)

  await dbExecBatch([
    {
      sql: 'UPDATE lignes_devis SET is_deleted = 1, updated_at = ? WHERE id = ?',
      args: [maintenant, ligneId],
    },
    ...batchTotauxDevis(
      devisId,
      r2(totaux.ht - reel(existante.total_ht)),
      r2(totaux.ttc - reel(existante.total_ttc)),
      clientRef,
      maintenant,
    ),
  ])
  return null
}

// ============================================================
// CONTRATS (liste) + AVENANTS
// ============================================================

/** `GET commercial/contrats` — `list[ContratList]` (filtre `client_id`). */
async function listContrats(req: LocalRequest): Promise<unknown> {
  return lister(req, 'contrats', contratListe, {
    filtres: [
      ['statut', 'statut'],
      ['client_id', 'client_id'],
    ],
  })
}

/** `GET commercial/avenants` — `list[AvenantList]` (filtre `contrat_id`). */
async function listAvenants(req: LocalRequest): Promise<unknown> {
  return lister(req, 'avenants', avenantListe, {
    filtres: [
      ['contrat_id', 'contrat_id'],
      ['statut', 'statut'],
    ],
  })
}

async function listerAvenantsContrat(contratId: number): Promise<unknown> {
  await charger('contrats', contratId, 'Contrat non trouvé')
  const { clauses, args } = clausesTenant()
  const rows = await dbQuery(
    `SELECT * FROM avenants WHERE contrat_id = ? AND ${clauses.join(' AND ')} ORDER BY id ASC`,
    [contratId, ...args],
  )
  return rows.map(avenantListe)
}

/** `GET commercial/contrats/{id}/avenants` — `list[AvenantList]`. */
async function listAvenantsDuContrat(req: LocalRequest): Promise<unknown> {
  return listerAvenantsContrat(int(req.pathParams[0], 0))
}

/**
 * `POST commercial/contrats/{id}/avenants` (201) — PHASE 4B :
 * sync de cette entité à brancher (pas d'outbox).
 */
async function createAvenant(req: LocalRequest): Promise<unknown> {
  const contratId = int(req.pathParams[0], 0)
  const contrat = await charger('contrats', contratId, 'Contrat non trouvé')
  const maintenant = horodatageLocal()
  const numero = strOrNull(req.data.numero) || (await prochainNumeroAnnee('avenants', 'AV'))

  const resultat = await dbExecBatch([
    {
      sql: `INSERT INTO avenants (
        entreprise_id, contrat_id, numero, description, impact_montant, date_signature,
        statut, fichier_url, notes, is_deleted, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      args: [
        intOrNull(contrat.entreprise_id),
        contratId,
        numero,
        strOrNull(req.data.description),
        floatOrNull(req.data.impact_montant) ?? 0,
        strOrNull(req.data.date_signature),
        strOrNull(req.data.statut) || 'propose',
        strOrNull(req.data.fichier_url),
        strOrNull(req.data.notes),
        maintenant,
        maintenant,
      ],
    },
  ])
  const rows = await dbQuery('SELECT * FROM avenants WHERE id = ?', [int(resultat.last_id, 0)])
  return avenantColonnes(rows[0] ?? {})
}

/** `PUT commercial/avenants/{id}` — PHASE 4B : sync de cette entité à brancher. */
async function updateAvenant(req: LocalRequest): Promise<unknown> {
  const id = int(req.pathParams[0], 0)
  const existant = await charger('avenants', id, 'Avenant non trouvé')
  const definition: Record<string, TypeChamp> = {
    numero: 'texte',
    description: 'texte',
    impact_montant: 'reel',
    date_signature: 'texte',
    statut: 'texte',
    fichier_url: 'texte',
    notes: 'texte',
  }
  const { affectations, args } = construireSet(req.data, definition)
  if (affectations.length === 0) {
    return avenantColonnes(existant)
  }
  await dbExecBatch([
    {
      sql: `UPDATE avenants SET ${affectations.join(', ')}, updated_at = ? WHERE id = ?`,
      args: [...args, horodatageLocal(), id],
    },
  ])
  const rows = await dbQuery('SELECT * FROM avenants WHERE id = ?', [id])
  return avenantColonnes(rows[0] ?? {})
}

/** `DELETE commercial/avenants/{id}` (204) — PHASE 4B : sync à brancher. */
async function deleteAvenant(req: LocalRequest): Promise<unknown> {
  const id = int(req.pathParams[0], 0)
  await charger('avenants', id, 'Avenant non trouvé')
  await dbExecBatch([
    {
      sql: 'UPDATE avenants SET is_deleted = 1, updated_at = ? WHERE id = ?',
      args: [horodatageLocal(), id],
    },
  ])
  return null
}

// ============================================================
// FACTURES — GET / POST / PUT / lignes
// ============================================================

async function chargerLignesFacture(factureId: number): Promise<LocalRow[]> {
  const rows = await dbQuery(
    'SELECT * FROM lignes_factures WHERE facture_id = ? AND is_deleted = 0 ORDER BY ordre ASC',
    [factureId],
  )
  return rows.map(ligneFacture)
}

async function chargerPaiementsFacture(factureId: number): Promise<LocalRow[]> {
  const rows = await dbQuery(
    'SELECT * FROM paiements WHERE facture_id = ? AND is_deleted = 0 ORDER BY date_paiement DESC',
    [factureId],
  )
  return rows.map(paiementResp)
}

/** `GET commercial/factures` — `list[FactureList]` (filtres `statut`, `client_id`). */
async function listFactures(req: LocalRequest): Promise<unknown> {
  return lister(req, 'factures', factureListe, {
    filtres: [
      ['statut', 'statut'],
      ['client_id', 'client_id'],
    ],
  })
}

/** `GET commercial/factures/{id}` — `FactureResponse` + `lignes[]` + `paiements[]`. */
async function getFacture(req: LocalRequest): Promise<unknown> {
  const id = int(req.pathParams[0], 0)
  const facture = await charger('factures', id, 'Facture non trouvée')
  return {
    ...factureColonnes(facture),
    lignes: await chargerLignesFacture(id),
    paiements: await chargerPaiementsFacture(id),
  }
}

/** `POST commercial/factures` (201) — INSERT + lignes + notif + outbox `facture`. */
async function createFacture(req: LocalRequest): Promise<unknown> {
  const body = req.data
  const clientId = intOrNull(body.client_id) ?? 0
  if (clientId < 1) {
    throw localError(422, 'client_id : champ obligatoire (valeur ≥ 1 attendue).')
  }
  const typeFacture = strOrNull(body.type) ?? 'standard'
  if (!TYPES_FACTURE.includes(typeFacture)) {
    throw localError(422, messageStatuts('type', TYPES_FACTURE))
  }
  const statut = strOrNull(body.statut) ?? 'emis'
  if (!STATUTS_FACTURE.includes(statut)) {
    throw localError(422, messageStatuts('statut', STATUTS_FACTURE))
  }
  const montantHt = floatOrNull(body.montant_ht) ?? 0
  const montantTtc = floatOrNull(body.montant_ttc) ?? 0
  const montantPaye = floatOrNull(body.montant_paye) ?? 0
  if (montantHt < 0 || montantTtc < 0 || montantPaye < 0) {
    throw localError(422, 'Le montant ne peut pas être négatif')
  }
  const tva = floatOrNull(body.tva) ?? 20
  if (tva < 0 || tva > 100) {
    throw localError(422, 'La TVA doit être comprise entre 0 et 100')
  }

  const { clauses, args } = clausesTenant()
  const clients = await dbQuery(
    `SELECT id FROM clients WHERE id = ? AND ${clauses.join(' AND ')}`,
    [clientId, ...args],
  )
  if (!clients[0]) {
    throw localError(404, 'Client non trouvé')
  }

  const numero = strOrNull(body.numero) || (await prochainNumeroAnnee('factures', 'FAC'))
  const maintenant = horodatageLocal()
  const clientRef = uuid()
  const entrepriseId = currentEntrepriseId()

  const lignes = (Array.isArray(body.lignes) ? body.lignes : []).map((l) =>
    validerLigne(l as Record<string, unknown>),
  )
  let htFinal = montantHt
  let ttcFinal = montantTtc
  if (lignes.length > 0) {
    htFinal = r2(lignes.reduce((s, l) => s + l.totalHt, 0))
    ttcFinal = r2(lignes.reduce((s, l) => s + l.totalTtc, 0))
  }
  const montantTva = r2(ttcFinal - htFinal)
  const reste = r2(Math.max(ttcFinal - montantPaye, 0))

  const payload = {
    entreprise_id: entrepriseId,
    client_id: clientId,
    contrat_id: intOrNull(body.contrat_id),
    numero,
    type: typeFacture,
    montant_ht: htFinal,
    tva,
    montant_tva: montantTva,
    montant_ttc: ttcFinal,
    montant_paye: montantPaye,
    reste_a_payer: reste,
    statut,
    client_ref: clientRef,
  }

  const batch: Operation[] = [
    {
      sql: `INSERT INTO factures (
        entreprise_id, contrat_id, client_id, situation_id, numero, type, montant_ht, tva,
        montant_tva, montant_ttc, montant_acompte_deduit, montant_paye, reste_a_payer,
        date_creation, date_emission, date_echeance, statut, conditions_paiement,
        mode_paiement, notes, is_deleted, created_at, updated_at, sync_version, client_ref
      ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 1, ?)`,
      args: [
        entrepriseId,
        intOrNull(body.contrat_id),
        clientId,
        numero,
        typeFacture,
        htFinal,
        tva,
        montantTva,
        ttcFinal,
        montantPaye,
        reste,
        dateLocale(),
        strOrNull(body.date_emission),
        strOrNull(body.date_echeance),
        statut,
        strOrNull(body.conditions_paiement),
        strOrNull(body.mode_paiement),
        strOrNull(body.notes),
        maintenant,
        maintenant,
        clientRef,
      ],
    },
  ]
  // Lignes rattachées à la facture via sous-requête `client_ref` (même batch).
  for (const l of lignes) {
    batch.push({
      sql: sqlInsertLigne('lignes_factures', 'facture_id', true),
      args: [clientRef, ...argsInsertLigne(0, l, maintenant).slice(1)],
    })
  }
  batch.push(
    ligneNotification(
      entrepriseId,
      clientId,
      'facture_creee',
      `Facture ${numero}`,
      `La facture ${numero} a été créée.`,
      'facture',
      maintenant,
    ),
    outbox('facture', clientRef, 'create', payload),
  )
  await dbExecBatch(batch)

  const rows = await dbQuery('SELECT * FROM factures WHERE client_ref = ? LIMIT 1', [clientRef])
  const facture = rows[0] ?? {}
  const factureId = int(facture.id, 0)
  return {
    ...factureColonnes(facture),
    lignes: await chargerLignesFacture(factureId),
    paiements: [],
  }
}

const DEF_FACTURE: Record<string, TypeChamp> = {
  client_id: 'entier',
  contrat_id: 'entier',
  numero: 'texte',
  type: 'texte',
  montant_ht: 'reel',
  tva: 'reel',
  montant_ttc: 'reel',
  date_emission: 'texte',
  date_echeance: 'texte',
  statut: 'texte',
  conditions_paiement: 'texte',
  mode_paiement: 'texte',
  notes: 'texte',
  montant_paye: 'reel',
}

/** `PUT commercial/factures/{id}` — `exclude_unset` + outbox `facture` (update). */
async function updateFacture(req: LocalRequest): Promise<unknown> {
  const id = int(req.pathParams[0], 0)
  const existant = await charger('factures', id, 'Facture non trouvée')
  const body = req.data

  if ('statut' in body && body.statut !== null && !STATUTS_FACTURE.includes(str(body.statut))) {
    throw localError(422, messageStatuts('statut', STATUTS_FACTURE))
  }
  if ('type' in body && body.type !== null && !TYPES_FACTURE.includes(str(body.type))) {
    throw localError(422, messageStatuts('type', TYPES_FACTURE))
  }
  if ('tva' in body && body.tva !== null) {
    const tva = floatOrNull(body.tva) ?? 20
    if (tva < 0 || tva > 100) {
      throw localError(422, 'La TVA doit être comprise entre 0 et 100')
    }
  }
  if (
    ('montant_ht' in body && (floatOrNull(body.montant_ht) ?? 0) < 0) ||
    ('montant_ttc' in body && (floatOrNull(body.montant_ttc) ?? 0) < 0) ||
    ('montant_paye' in body && (floatOrNull(body.montant_paye) ?? 0) < 0)
  ) {
    throw localError(422, 'Le montant ne peut pas être négatif')
  }

  const { affectations, args } = construireSet(body, DEF_FACTURE)
  // Cohérence du reste à payer quand le montant TTC bouge.
  if ('montant_ttc' in body && body.montant_ttc !== null && !('montant_paye' in body)) {
    const ttc = floatOrNull(body.montant_ttc) ?? 0
    affectations.push('reste_a_payer = ?')
    args.push(r2(Math.max(ttc - reel(existant.montant_paye), 0)))
  }
  if (affectations.length === 0) {
    return {
      ...factureColonnes(existant),
      lignes: await chargerLignesFacture(id),
      paiements: await chargerPaiementsFacture(id),
    }
  }

  const maintenant = horodatageLocal()
  const clientRef = str(existant.client_ref) || String(id)
  await dbExecBatch([
    {
      sql: `UPDATE factures SET ${affectations.join(', ')}, updated_at = ?,
            sync_version = COALESCE(sync_version, 0) + 1 WHERE id = ?`,
      args: [...args, maintenant, id],
    },
    outbox('facture', clientRef, 'update', payloadMaj(id, body, DEF_FACTURE, clientRef)),
  ])
  const rows = await dbQuery('SELECT * FROM factures WHERE id = ?', [id])
  const facture = rows[0] ?? {}
  return {
    ...factureColonnes(facture),
    lignes: await chargerLignesFacture(id),
    paiements: await chargerPaiementsFacture(id),
  }
}

// PHASE 4B : sync de cette entité à brancher. (lignes_factures)
/** `POST commercial/factures/{id}/lignes` (201) — ligne + recalcul + outbox. */
async function createLigneFacture(req: LocalRequest): Promise<unknown> {
  const factureId = int(req.pathParams[0], 0)
  const facture = await charger('factures', factureId, 'Facture non trouvée')
  const ligne = validerLigne(req.data)
  const maintenant = horodatageLocal()
  const clientRef = str(facture.client_ref) || String(factureId)
  const totaux = await totauxLignesFacture(factureId)

  await dbExecBatch([
    {
      sql: sqlInsertLigne('lignes_factures', 'facture_id'),
      args: argsInsertLigne(factureId, ligne, maintenant),
    },
    ...batchTotauxFacture(
      facture,
      totaux.ht + ligne.totalHt,
      totaux.ttc + ligne.totalTtc,
      clientRef,
      maintenant,
    ),
  ])
  const rows = await dbQuery(
    'SELECT * FROM lignes_factures WHERE facture_id = ? ORDER BY id DESC LIMIT 1',
    [factureId],
  )
  return ligneFacture(rows[0] ?? {})
}

/** `PUT commercial/factures/{id}/lignes/{ligneId}` — fusion + recalcul + outbox. */
async function updateLigneFacture(req: LocalRequest): Promise<unknown> {
  const factureId = int(req.pathParams[0], 0)
  const ligneId = int(req.pathParams[1], 0)
  const facture = await charger('factures', factureId, 'Facture non trouvée')
  const { clauses, args } = clausesTenant()
  const rows = await dbQuery(
    `SELECT * FROM lignes_factures WHERE id = ? AND facture_id = ? AND ${clauses.join(' AND ')}`,
    [ligneId, factureId, ...args],
  )
  const existante = rows[0]
  if (!existante) {
    throw localError(404, 'Ligne non trouvée')
  }

  const fusion: Record<string, unknown> = { ...existante, ...req.data }
  if (!('total_ht' in req.data)) delete fusion.total_ht
  if (!('total_ttc' in req.data)) delete fusion.total_ttc
  const ligne = validerLigne(fusion)

  const maintenant = horodatageLocal()
  const clientRef = str(facture.client_ref) || String(factureId)
  const totaux = await totauxLignesFacture(factureId)
  const ht = r2(totaux.ht - reel(existante.total_ht) + ligne.totalHt)
  const ttc = r2(totaux.ttc - reel(existante.total_ttc) + ligne.totalTtc)

  await dbExecBatch([
    {
      sql: `UPDATE lignes_factures SET type = ?, article_id = ?, description = ?, categorie = ?,
            quantite = ?, unite = ?, prix_unitaire = ?, remise = ?, taux_tva = ?,
            total_ht = ?, total_ttc = ?, ordre = ?, updated_at = ? WHERE id = ?`,
      args: [
        ligne.typeLigne,
        ligne.articleId,
        ligne.description,
        ligne.categorie,
        ligne.quantite,
        ligne.unite,
        ligne.prixUnitaire,
        ligne.remise,
        ligne.tauxTva,
        ligne.totalHt,
        ligne.totalTtc,
        ligne.ordre,
        maintenant,
        ligneId,
      ],
    },
    ...batchTotauxFacture(facture, ht, ttc, clientRef, maintenant),
  ])
  const maj = await dbQuery('SELECT * FROM lignes_factures WHERE id = ?', [ligneId])
  return ligneFacture(maj[0] ?? {})
}

/** `DELETE commercial/factures/{id}/lignes/{ligneId}` (204) — soft-delete + outbox. */
async function deleteLigneFacture(req: LocalRequest): Promise<unknown> {
  const factureId = int(req.pathParams[0], 0)
  const ligneId = int(req.pathParams[1], 0)
  const facture = await charger('factures', factureId, 'Facture non trouvée')
  const { clauses, args } = clausesTenant()
  const rows = await dbQuery(
    `SELECT * FROM lignes_factures WHERE id = ? AND facture_id = ? AND ${clauses.join(' AND ')}`,
    [ligneId, factureId, ...args],
  )
  const existante = rows[0]
  if (!existante) {
    throw localError(404, 'Ligne non trouvée')
  }

  const maintenant = horodatageLocal()
  const clientRef = str(facture.client_ref) || String(factureId)
  const totaux = await totauxLignesFacture(factureId)

  await dbExecBatch([
    {
      sql: 'UPDATE lignes_factures SET is_deleted = 1, updated_at = ? WHERE id = ?',
      args: [maintenant, ligneId],
    },
    ...batchTotauxFacture(
      facture,
      r2(totaux.ht - reel(existante.total_ht)),
      r2(totaux.ttc - reel(existante.total_ttc)),
      clientRef,
      maintenant,
    ),
  ])
  return null
}

// ============================================================
// PAIEMENTS — GET / POST
// ============================================================

/** `GET commercial/paiements` — `list[PaiementResponse]` (filtre `facture_id`). */
async function listPaiements(req: LocalRequest): Promise<unknown> {
  return lister(req, 'paiements', paiementResp, {
    filtres: [['facture_id', 'facture_id']],
  })
}

/**
 * `POST commercial/paiements` (201) — paiement + recalcul de la facture.
 * PHASE 4B : sync de cette entité à brancher (le paiement est local ; seule la
 * facture — canonique — est poussée via son outbox `update`).
 */
async function createPaiement(req: LocalRequest): Promise<unknown> {
  const body = req.data
  const factureId = intOrNull(body.facture_id) ?? 0
  if (factureId < 1) {
    throw localError(422, 'facture_id : champ obligatoire (valeur ≥ 1 attendue).')
  }
  const montant = floatOrNull(body.montant) ?? 0
  if (montant <= 0) {
    throw localError(422, 'Le montant du paiement doit être positif')
  }
  const facture = await charger('factures', factureId, 'Facture non trouvée')

  const maintenant = horodatageLocal()
  const clientRef = str(facture.client_ref) || String(factureId)
  const paye = r2(reel(facture.montant_paye) + montant)
  const ttc = reel(facture.montant_ttc)
  const reste = r2(Math.max(ttc - paye, 0))
  let statut = str(facture.statut)
  if (paye > 0) {
    statut = reste <= 0 ? 'payee' : 'partiellement_payee'
  }

  await dbExecBatch([
    {
      sql: `INSERT INTO paiements (
        entreprise_id, facture_id, montant, date_paiement, mode_paiement, reference,
        banque, notes, is_deleted, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      args: [
        currentEntrepriseId(),
        factureId,
        montant,
        strOrNull(body.date_paiement) || dateLocale(),
        strOrNull(body.mode_paiement),
        strOrNull(body.reference),
        strOrNull(body.banque),
        strOrNull(body.notes),
        maintenant,
        maintenant,
      ],
    },
    {
      sql: `UPDATE factures SET montant_paye = ?, reste_a_payer = ?, statut = ?, updated_at = ?,
            sync_version = COALESCE(sync_version, 0) + 1 WHERE id = ?`,
      args: [paye, reste, statut, maintenant, factureId],
    },
    outbox('facture', clientRef, 'update', {
      id: factureId,
      montant_paye: paye,
      reste_a_payer: reste,
      statut,
      client_ref: clientRef,
    }),
  ])
  const rows = await dbQuery(
    'SELECT * FROM paiements WHERE facture_id = ? ORDER BY id DESC LIMIT 1',
    [factureId],
  )
  return paiementResp(rows[0] ?? {})
}

// ============================================================
// DEMANDES DE TRAVAUX — CRUD (PHASE 4B)
// ============================================================

/** `GET commercial/demandes` — `list[DemandeTravauxList]` (`created_at DESC`). */
async function listDemandes(req: LocalRequest): Promise<unknown> {
  return lister(req, 'demandes_travaux', demandeListe, {
    ordre: 'created_at DESC',
    filtres: [
      ['statut', 'statut'],
      ['client_id', 'client_id'],
    ],
  })
}

/** `GET commercial/demandes/{id}` — `DemandeTravauxResponse`. */
async function getDemande(req: LocalRequest): Promise<unknown> {
  const id = int(req.pathParams[0], 0)
  return demandeComplet(await charger('demandes_travaux', id, 'Demande non trouvée'))
}

/** `POST commercial/demandes` (201) — PHASE 4B : sync de cette entité à brancher. */
async function createDemande(req: LocalRequest): Promise<unknown> {
  const body = req.data
  const objet = strOrNull(body.objet)
  if (objet === null) {
    throw localError(422, 'objet : champ obligatoire.')
  }
  const statut = strOrNull(body.statut) ?? 'nouvelle'
  if (!STATUTS_DEMANDE.includes(statut)) {
    throw localError(422, messageStatuts('statut', STATUTS_DEMANDE))
  }
  const maintenant = horodatageLocal()
  const numero = await prochainNumeroSimple('demandes_travaux', 'numero', 'DEM')

  const resultat = await dbExecBatch([
    {
      sql: `INSERT INTO demandes_travaux (
        entreprise_id, client_id, commercial_id, numero, objet, type_projet, description,
        localisation, date_demande, date_souhaitee, documents_fournis, plans_disponibles,
        observations, statut, is_deleted, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      args: [
        currentEntrepriseId(),
        intOrNull(body.client_id),
        intOrNull(body.commercial_id),
        numero,
        objet,
        strOrNull(body.type_projet),
        strOrNull(body.description),
        strOrNull(body.localisation),
        maintenant,
        strOrNull(body.date_souhaitee),
        strOrNull(body.documents_fournis),
        boolSql(body.plans_disponibles) ? 1 : 0,
        strOrNull(body.observations),
        statut,
        maintenant,
        maintenant,
      ],
    },
  ])
  const rows = await dbQuery(
    'SELECT * FROM demandes_travaux WHERE id = ?',
    [int(resultat.last_id, 0)],
  )
  return demandeComplet(rows[0] ?? {})
}

/** `PUT commercial/demandes/{id}` — PHASE 4B : sync de cette entité à brancher. */
async function updateDemande(req: LocalRequest): Promise<unknown> {
  const id = int(req.pathParams[0], 0)
  const existant = await charger('demandes_travaux', id, 'Demande non trouvée')
  const definition: Record<string, TypeChamp> = {
    objet: 'texte',
    type_projet: 'texte',
    description: 'texte',
    localisation: 'texte',
    date_souhaitee: 'texte',
    documents_fournis: 'texte',
    plans_disponibles: 'booleen',
    observations: 'texte',
    statut: 'texte',
    client_id: 'entier',
    commercial_id: 'entier',
  }
  if ('statut' in req.data && req.data.statut !== null && !STATUTS_DEMANDE.includes(str(req.data.statut))) {
    throw localError(422, messageStatuts('statut', STATUTS_DEMANDE))
  }
  const { affectations, args } = construireSet(req.data, definition)
  if (affectations.length === 0) {
    return demandeComplet(existant)
  }
  await dbExecBatch([
    {
      sql: `UPDATE demandes_travaux SET ${affectations.join(', ')}, updated_at = ? WHERE id = ?`,
      args: [...args, horodatageLocal(), id],
    },
  ])
  const rows = await dbQuery('SELECT * FROM demandes_travaux WHERE id = ?', [id])
  return demandeComplet(rows[0] ?? {})
}

/** `DELETE commercial/demandes/{id}` (204) — PHASE 4B : sync à brancher. */
async function deleteDemande(req: LocalRequest): Promise<unknown> {
  const id = int(req.pathParams[0], 0)
  await charger('demandes_travaux', id, 'Demande non trouvée')
  await dbExecBatch([
    {
      sql: 'UPDATE demandes_travaux SET is_deleted = 1, updated_at = ? WHERE id = ?',
      args: [horodatageLocal(), id],
    },
  ])
  return null
}

// ============================================================
// PROJETS — CRUD (PHASE 4B)
// ============================================================

/** `GET commercial/projets` — `list[ProjetList]` (`created_at DESC`). */
async function listProjets(req: LocalRequest): Promise<unknown> {
  return lister(req, 'projets', projetListe, {
    ordre: 'created_at DESC',
    filtres: [
      ['statut', 'statut'],
      ['client_id', 'client_id'],
    ],
  })
}

/** `GET commercial/projets/{id}` — `ProjetResponse`. */
async function getProjet(req: LocalRequest): Promise<unknown> {
  const id = int(req.pathParams[0], 0)
  return projetComplet(await charger('projets', id, 'Projet non trouvé'))
}

/** `POST commercial/projets` (201) — PHASE 4B : sync de cette entité à brancher. */
async function createProjet(req: LocalRequest): Promise<unknown> {
  const body = req.data
  const nom = strOrNull(body.nom)
  if (nom === null) {
    throw localError(422, 'nom : champ obligatoire.')
  }
  const statut = strOrNull(body.statut) ?? 'en_etude'
  if (!STATUTS_PROJET.includes(statut)) {
    throw localError(422, messageStatuts('statut', STATUTS_PROJET))
  }
  const maintenant = horodatageLocal()
  const reference = await prochainNumeroSimple('projets', 'reference', 'PRJ')

  const resultat = await dbExecBatch([
    {
      sql: `INSERT INTO projets (
        entreprise_id, client_id, demande_id, responsable_id, reference, nom, type_projet,
        description, localisation, adresse, longueur, largeur, hauteur, surface, volume,
        nombre_niveaux, plans_documents, observations, statut, is_deleted, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      args: [
        currentEntrepriseId(),
        intOrNull(body.client_id),
        intOrNull(body.demande_id),
        intOrNull(body.responsable_id),
        reference,
        nom,
        strOrNull(body.type_projet),
        strOrNull(body.description),
        strOrNull(body.localisation),
        strOrNull(body.adresse),
        floatOrNull(body.longueur),
        floatOrNull(body.largeur),
        floatOrNull(body.hauteur),
        floatOrNull(body.surface),
        floatOrNull(body.volume),
        intOrNull(body.nombre_niveaux),
        strOrNull(body.plans_documents),
        strOrNull(body.observations),
        statut,
        maintenant,
        maintenant,
      ],
    },
  ])
  const rows = await dbQuery('SELECT * FROM projets WHERE id = ?', [int(resultat.last_id, 0)])
  return projetComplet(rows[0] ?? {})
}

/** `PUT commercial/projets/{id}` — PHASE 4B : sync de cette entité à brancher. */
async function updateProjet(req: LocalRequest): Promise<unknown> {
  const id = int(req.pathParams[0], 0)
  const existant = await charger('projets', id, 'Projet non trouvé')
  const definition: Record<string, TypeChamp> = {
    nom: 'texte',
    type_projet: 'texte',
    description: 'texte',
    localisation: 'texte',
    adresse: 'texte',
    longueur: 'reel',
    largeur: 'reel',
    hauteur: 'reel',
    surface: 'reel',
    volume: 'reel',
    nombre_niveaux: 'entier',
    plans_documents: 'texte',
    observations: 'texte',
    statut: 'texte',
    client_id: 'entier',
    responsable_id: 'entier',
  }
  if ('statut' in req.data && req.data.statut !== null && !STATUTS_PROJET.includes(str(req.data.statut))) {
    throw localError(422, messageStatuts('statut', STATUTS_PROJET))
  }
  const { affectations, args } = construireSet(req.data, definition)
  if (affectations.length === 0) {
    return projetComplet(existant)
  }
  await dbExecBatch([
    {
      sql: `UPDATE projets SET ${affectations.join(', ')}, updated_at = ? WHERE id = ?`,
      args: [...args, horodatageLocal(), id],
    },
  ])
  const rows = await dbQuery('SELECT * FROM projets WHERE id = ?', [id])
  return projetComplet(rows[0] ?? {})
}

/** `DELETE commercial/projets/{id}` (204) — PHASE 4B : sync à brancher. */
async function deleteProjet(req: LocalRequest): Promise<unknown> {
  const id = int(req.pathParams[0], 0)
  await charger('projets', id, 'Projet non trouvé')
  await dbExecBatch([
    {
      sql: 'UPDATE projets SET is_deleted = 1, updated_at = ? WHERE id = ?',
      args: [horodatageLocal(), id],
    },
  ])
  return null
}

// ============================================================
// MÉTRÉS — CRUD (PHASE 4B)
// ============================================================

/** `GET commercial/metres` — `list[MetreList]` (`created_at DESC`). */
async function listMetres(req: LocalRequest): Promise<unknown> {
  return lister(req, 'metres', metreListe, {
    ordre: 'created_at DESC',
    filtres: [['projet_id', 'projet_id']],
  })
}

/** `GET commercial/metres/{id}` — `MetreResponse`. */
async function getMetre(req: LocalRequest): Promise<unknown> {
  const id = int(req.pathParams[0], 0)
  return metreComplet(await charger('metres', id, 'Métré non trouvé'))
}

/** `POST commercial/metres` (201) — PHASE 4B : sync de cette entité à brancher. */
async function createMetre(req: LocalRequest): Promise<unknown> {
  const body = req.data
  const ouvrage = strOrNull(body.ouvrage)
  if (ouvrage === null) {
    throw localError(422, 'ouvrage : champ obligatoire.')
  }
  const quantite = floatOrNull(body.quantite) ?? 0
  if (quantite < 0) {
    throw localError(422, 'La quantité ne peut pas être négative')
  }
  const maintenant = horodatageLocal()
  const resultat = await dbExecBatch([
    {
      sql: `INSERT INTO metres (
        entreprise_id, projet_id, ouvrage, designation, formule, dimensions, unite,
        quantite, observations, document_reference, ordre, is_deleted, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      args: [
        currentEntrepriseId(),
        intOrNull(body.projet_id),
        ouvrage,
        strOrNull(body.designation),
        strOrNull(body.formule),
        strOrNull(body.dimensions),
        strOrNull(body.unite),
        quantite,
        strOrNull(body.observations),
        strOrNull(body.document_reference),
        intOrNull(body.ordre) ?? 0,
        maintenant,
        maintenant,
      ],
    },
  ])
  const rows = await dbQuery('SELECT * FROM metres WHERE id = ?', [int(resultat.last_id, 0)])
  return metreComplet(rows[0] ?? {})
}

/** `PUT commercial/metres/{id}` — PHASE 4B : sync de cette entité à brancher. */
async function updateMetre(req: LocalRequest): Promise<unknown> {
  const id = int(req.pathParams[0], 0)
  const existant = await charger('metres', id, 'Métré non trouvé')
  const definition: Record<string, TypeChamp> = {
    ouvrage: 'texte',
    designation: 'texte',
    formule: 'texte',
    dimensions: 'texte',
    unite: 'texte',
    quantite: 'reel',
    observations: 'texte',
    document_reference: 'texte',
    ordre: 'entier',
  }
  if ('quantite' in req.data && req.data.quantite !== null && (floatOrNull(req.data.quantite) ?? 0) < 0) {
    throw localError(422, 'La quantité ne peut pas être négative')
  }
  const { affectations, args } = construireSet(req.data, definition)
  if (affectations.length === 0) {
    return metreComplet(existant)
  }
  await dbExecBatch([
    {
      sql: `UPDATE metres SET ${affectations.join(', ')}, updated_at = ? WHERE id = ?`,
      args: [...args, horodatageLocal(), id],
    },
  ])
  const rows = await dbQuery('SELECT * FROM metres WHERE id = ?', [id])
  return metreComplet(rows[0] ?? {})
}

/** `DELETE commercial/metres/{id}` (204) — PHASE 4B : sync à brancher. */
async function deleteMetre(req: LocalRequest): Promise<unknown> {
  const id = int(req.pathParams[0], 0)
  await charger('metres', id, 'Métré non trouvé')
  await dbExecBatch([
    {
      sql: 'UPDATE metres SET is_deleted = 1, updated_at = ? WHERE id = ?',
      args: [horodatageLocal(), id],
    },
  ])
  return null
}

// ============================================================
// SITUATIONS DE TRAVAUX — CRUD + LIGNES (PHASE 4B)
// ============================================================

/** `GET commercial/situations` — `list[SituationTravauxList]` (`created_at DESC`). */
async function listSituations(req: LocalRequest): Promise<unknown> {
  return lister(req, 'situations_travaux', situationListe, {
    ordre: 'created_at DESC',
    filtres: [
      ['chantier_id', 'chantier_id'],
      ['contrat_id', 'contrat_id'],
      ['statut', 'statut'],
    ],
  })
}

/** `GET commercial/situations/{id}` — `SituationTravauxResponse`. */
async function getSituation(req: LocalRequest): Promise<unknown> {
  const id = int(req.pathParams[0], 0)
  return situationComplet(await charger('situations_travaux', id, 'Situation non trouvée'))
}

/** `POST commercial/situations` (201) — PHASE 4B : sync de cette entité à brancher. */
async function createSituation(req: LocalRequest): Promise<unknown> {
  const body = req.data
  const avancement = floatOrNull(body.avancement) ?? 0
  if (avancement < 0 || avancement > 100) {
    throw localError(422, "L'avancement doit être compris entre 0 et 100")
  }
  const montant = floatOrNull(body.montant) ?? 0
  if (montant < 0) {
    throw localError(422, 'Le montant ne peut pas être négatif')
  }
  const statut = strOrNull(body.statut) ?? 'brouillon'
  if (!STATUTS_SITUATION.includes(statut)) {
    throw localError(422, messageStatuts('statut', STATUTS_SITUATION))
  }
  const maintenant = horodatageLocal()
  const numero = await prochainNumeroSimple('situations_travaux', 'numero', 'SIT')

  const resultat = await dbExecBatch([
    {
      sql: `INSERT INTO situations_travaux (
        entreprise_id, chantier_id, contrat_id, numero, periode, date_etablissement,
        avancement, montant, observations, statut, is_deleted, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      args: [
        currentEntrepriseId(),
        intOrNull(body.chantier_id),
        intOrNull(body.contrat_id),
        numero,
        strOrNull(body.periode),
        strOrNull(body.date_etablissement) || maintenant,
        avancement,
        montant,
        strOrNull(body.observations),
        statut,
        maintenant,
        maintenant,
      ],
    },
  ])
  const rows = await dbQuery('SELECT * FROM situations_travaux WHERE id = ?', [
    int(resultat.last_id, 0),
  ])
  return situationComplet(rows[0] ?? {})
}

/** `PUT commercial/situations/{id}` — PHASE 4B : sync de cette entité à brancher. */
async function updateSituation(req: LocalRequest): Promise<unknown> {
  const id = int(req.pathParams[0], 0)
  const existant = await charger('situations_travaux', id, 'Situation non trouvée')
  const definition: Record<string, TypeChamp> = {
    periode: 'texte',
    date_etablissement: 'texte',
    avancement: 'reel',
    montant: 'reel',
    observations: 'texte',
    statut: 'texte',
    chantier_id: 'entier',
    contrat_id: 'entier',
  }
  if ('statut' in req.data && req.data.statut !== null && !STATUTS_SITUATION.includes(str(req.data.statut))) {
    throw localError(422, messageStatuts('statut', STATUTS_SITUATION))
  }
  if ('avancement' in req.data && req.data.avancement !== null) {
    const avancement = floatOrNull(req.data.avancement) ?? 0
    if (avancement < 0 || avancement > 100) {
      throw localError(422, "L'avancement doit être compris entre 0 et 100")
    }
  }
  if ('montant' in req.data && req.data.montant !== null && (floatOrNull(req.data.montant) ?? 0) < 0) {
    throw localError(422, 'Le montant ne peut pas être négatif')
  }
  const { affectations, args } = construireSet(req.data, definition)
  if (affectations.length === 0) {
    return situationComplet(existant)
  }
  await dbExecBatch([
    {
      sql: `UPDATE situations_travaux SET ${affectations.join(', ')}, updated_at = ? WHERE id = ?`,
      args: [...args, horodatageLocal(), id],
    },
  ])
  const rows = await dbQuery('SELECT * FROM situations_travaux WHERE id = ?', [id])
  return situationComplet(rows[0] ?? {})
}

/** `DELETE commercial/situations/{id}` (204) — PHASE 4B : sync à brancher. */
async function deleteSituation(req: LocalRequest): Promise<unknown> {
  const id = int(req.pathParams[0], 0)
  await charger('situations_travaux', id, 'Situation non trouvée')
  await dbExecBatch([
    {
      sql: 'UPDATE situations_travaux SET is_deleted = 1, updated_at = ? WHERE id = ?',
      args: [horodatageLocal(), id],
    },
  ])
  return null
}

/** `GET commercial/situations/{id}/lignes` — `list[LigneSituationResponse]`. */
async function listLignesSituation(req: LocalRequest): Promise<unknown> {
  const id = int(req.pathParams[0], 0)
  await charger('situations_travaux', id, 'Situation non trouvée')
  const { clauses, args } = clausesTenant()
  const rows = await dbQuery(
    `SELECT * FROM lignes_situation WHERE situation_id = ? AND ${clauses.join(' AND ')} ORDER BY id ASC`,
    [id, ...args],
  )
  return rows.map(ligneSituation)
}

/** `POST commercial/situations/{id}/lignes` (201) — PHASE 4B : sync à brancher. */
async function createLigneSituation(req: LocalRequest): Promise<unknown> {
  const id = int(req.pathParams[0], 0)
  await charger('situations_travaux', id, 'Situation non trouvée')
  const body = req.data
  const ouvrage = strOrNull(body.ouvrage)
  if (ouvrage === null) {
    throw localError(422, 'ouvrage : champ obligatoire.')
  }
  const quantitePeriode = floatOrNull(body.quantite_periode) ?? 0
  const quantiteCumulee = floatOrNull(body.quantite_cumulee) ?? 0
  const prixUnitaire = floatOrNull(body.prix_unitaire) ?? 0
  const montant = floatOrNull(body.montant) ?? 0
  if (quantitePeriode < 0 || quantiteCumulee < 0 || prixUnitaire < 0 || montant < 0) {
    throw localError(422, 'La valeur ne peut pas être négative')
  }
  const maintenant = horodatageLocal()
  const resultat = await dbExecBatch([
    {
      sql: `INSERT INTO lignes_situation (
        situation_id, ouvrage, quantite_periode, quantite_cumulee, unite, prix_unitaire,
        montant, observations, is_deleted, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      args: [
        id,
        ouvrage,
        quantitePeriode,
        quantiteCumulee,
        strOrNull(body.unite),
        prixUnitaire,
        montant,
        strOrNull(body.observations),
        maintenant,
        maintenant,
      ],
    },
  ])
  const rows = await dbQuery('SELECT * FROM lignes_situation WHERE id = ?', [
    int(resultat.last_id, 0),
  ])
  return ligneSituation(rows[0] ?? {})
}

/** `DELETE commercial/situations/{id}/lignes/{ligneId}` (204) — PHASE 4B. */
async function deleteLigneSituation(req: LocalRequest): Promise<unknown> {
  const id = int(req.pathParams[0], 0)
  const ligneId = int(req.pathParams[1], 0)
  await charger('situations_travaux', id, 'Situation non trouvée')
  const { clauses, args } = clausesTenant()
  const rows = await dbQuery(
    `SELECT id FROM lignes_situation WHERE id = ? AND situation_id = ? AND ${clauses.join(' AND ')}`,
    [ligneId, id, ...args],
  )
  if (!rows[0]) {
    throw localError(404, 'Ligne non trouvée')
  }
  await dbExecBatch([
    {
      sql: 'UPDATE lignes_situation SET is_deleted = 1, updated_at = ? WHERE id = ?',
      args: [horodatageLocal(), ligneId],
    },
  ])
  return null
}

// ============================================================
// ESPACE CLIENT — résolution de la fiche + serializers
// ============================================================

/**
 * Résout la fiche client du compte connecté : `utilisateurs.client_id`, puis
 * repli par correspondance d'email (`clients.email`) — identique au backend.
 */
async function resoudreClient(): Promise<LocalRow> {
  const userId = currentUserId()
  let client: LocalRow | undefined
  if (userId !== null) {
    const users = await dbQueryOptionnel(
      'SELECT id, email, client_id FROM utilisateurs WHERE id = ?',
      [userId],
    )
    const client_id = intOrNull(users[0]?.client_id)
    if (client_id !== null) {
      const rows = await dbQueryOptionnel(
        'SELECT * FROM clients WHERE id = ? AND is_deleted = 0',
        [client_id],
      )
      client = rows[0]
    }
    if (!client && users[0]?.email) {
      const rows = await dbQueryOptionnel(
        'SELECT * FROM clients WHERE email = ? AND is_deleted = 0 LIMIT 1',
        [str(users[0].email)],
      )
      client = rows[0]
    }
  }
  if (!client) {
    const email = strOrNull(currentUser()?.email)
    if (email) {
      const rows = await dbQueryOptionnel(
        'SELECT * FROM clients WHERE email = ? AND is_deleted = 0 LIMIT 1',
        [email],
      )
      client = rows[0]
    }
  }
  if (!client) {
    throw localError(404, 'Fiche client introuvable pour ce compte')
  }
  return client
}

/** Compteurs `GROUP BY statut` d'une table rattachée au client. */
async function compteursParStatut(
  table: string,
  colonneClient: string,
  clientId: number,
): Promise<Record<string, number>> {
  const rows = await dbQuery(
    `SELECT statut, COUNT(*) AS n FROM ${table} WHERE ${colonneClient} = ? AND is_deleted = 0 GROUP BY statut`,
    [clientId],
  )
  const stats: Record<string, number> = {}
  for (const r of rows) {
    stats[str(r.statut)] = int(r.n, 0)
  }
  return stats
}

/** `GET espace-client/dashboard` — `{client, compteurs, projets}`. */
async function dashboardEspace(_req: LocalRequest): Promise<unknown> {
  const client = await resoudreClient()
  const cid = int(client.id, 0)

  const [statsDemandes, statsDevis, statsContrats, statsChantiers, statsFactures, montantRows, projetsRows, devisRows, contratsRows, chantiersRows, facturesRows] =
    await Promise.all([
      compteursParStatut('demandes_travaux', 'client_id', cid),
      compteursParStatut('devis', 'client_id', cid),
      compteursParStatut('contrats', 'client_id', cid),
      compteursParStatut('chantiers', 'client_id', cid),
      compteursParStatut('factures', 'client_id', cid),
      dbQuery(
        'SELECT COALESCE(SUM(CAST(reste_a_payer AS REAL)), 0) AS v FROM factures WHERE client_id = ? AND is_deleted = 0',
        [cid],
      ),
      dbQuery('SELECT * FROM projets WHERE client_id = ? AND is_deleted = 0 ORDER BY created_at DESC', [cid]),
      dbQuery('SELECT * FROM devis WHERE client_id = ? AND is_deleted = 0', [cid]),
      dbQuery('SELECT * FROM contrats WHERE client_id = ? AND is_deleted = 0', [cid]),
      dbQuery('SELECT * FROM chantiers WHERE client_id = ? AND is_deleted = 0', [cid]),
      dbQuery('SELECT * FROM factures WHERE client_id = ? AND is_deleted = 0', [cid]),
    ])

  const chantierIds = chantiersRows.map((c) => int(c.id, 0))
  let situationsRows: LocalRow[] = []
  if (chantierIds.length > 0) {
    situationsRows = await dbQuery(
      `SELECT * FROM situations_travaux WHERE chantier_id IN (${chantierIds
        .map(() => '?')
        .join(', ')}) AND is_deleted = 0`,
      chantierIds,
    )
  }
  const factureIds = facturesRows.map((f) => int(f.id, 0))
  let paiementsRows: LocalRow[] = []
  if (factureIds.length > 0) {
    paiementsRows = await dbQuery(
      `SELECT * FROM paiements WHERE facture_id IN (${factureIds.map(() => '?').join(', ')}) AND is_deleted = 0`,
      factureIds,
    )
  }

  // Étapes de progression — réplique exacte de `_progression` (y compris le
  // champ « Chantier » calculé sur l'ensemble des chantiers du client).
  const etapesDuProjet = (p: LocalRow): Record<string, boolean> => {
    const projetId = int(p.id, 0)
    const devisProjet = devisRows.filter((d) => int(d.projet_id, -1) === projetId)
    const devisIds = devisProjet.map((d) => int(d.id, 0))
    const contratsProjet = contratsRows.filter((c) => devisIds.includes(int(c.devis_id, -1)))
    const contratIds = contratsProjet.map((c) => int(c.id, 0))
    const facturesProjet = facturesRows.filter((f) => contratIds.includes(int(f.contrat_id, -1)))
    const facturesProjetIds = facturesProjet.map((f) => int(f.id, 0))
    return {
      Demande: p.demande_id !== null && p.demande_id !== undefined,
      Projet: true,
      Devis: devisProjet.length > 0,
      Contrat: contratsProjet.length > 0,
      Chantier: chantiersRows.length > 0,
      Avancement: situationsRows.some((s) => reel(s.avancement) > 0),
      Facturation: facturesProjet.length > 0,
      Paiement: paiementsRows.some((pay) => facturesProjetIds.includes(int(pay.facture_id, -1))),
    }
  }

  return {
    client: { id: cid, nom: str(client.nom), prenom: strOrNull(client.prenom) },
    compteurs: {
      projets: projetsRows.length,
      demandes: {
        total: Object.values(statsDemandes).reduce((s, n) => s + n, 0),
        nouvelles: statsDemandes.nouvelle ?? 0,
        en_cours: statsDemandes.en_etude ?? 0,
        traitees: (statsDemandes.traitee ?? 0) + (statsDemandes.annulee ?? 0),
      },
      devis: {
        total: Object.values(statsDevis).reduce((s, n) => s + n, 0),
        en_attente: cumul(statsDevis, ['envoye', 'brouillon']),
        acceptes: statsDevis.accepte ?? 0,
        refuses: statsDevis.refuse ?? 0,
      },
      contrats: {
        total: Object.values(statsContrats).reduce((s, n) => s + n, 0),
        actifs: statsContrats.en_cours ?? 0,
        termines: statsContrats.termine ?? 0,
      },
      chantiers: {
        total: Object.values(statsChantiers).reduce((s, n) => s + n, 0),
        en_cours: statsChantiers.en_cours ?? 0,
        termines: statsChantiers.termine ?? 0,
      },
      factures: {
        total: Object.values(statsFactures).reduce((s, n) => s + n, 0),
        a_payer: cumul(statsFactures, ['emis', 'envoye']),
        partiellement_payees: statsFactures.partiellement_payee ?? 0,
        payees: statsFactures.payee ?? 0,
      },
      montant_restant_a_payer: reel(montantRows[0]?.v),
    },
    projets: projetsRows.map((p) => ({
      id: int(p.id, 0),
      reference: strOrNull(p.reference),
      nom: str(p.nom),
      statut: strOrNull(p.statut),
      etapes: etapesDuProjet(p),
    })),
  }
}

/** `GET espace-client/profil` — `{client, compte}`. */
async function profilEspace(_req: LocalRequest): Promise<unknown> {
  const client = await resoudreClient()
  const user = currentUser()
  return {
    client: clientColonnes(client),
    compte: {
      id: currentUserId(),
      email: strOrNull(user?.email),
      must_change_password: boolSql(user?.must_change_password),
    },
  }
}

// PHASE 4B : sync de cette entité à brancher. (preferences)
const DEF_PROFIL: Record<string, TypeChamp> = {
  nom: 'texte',
  prenom: 'texte',
  telephone: 'texte',
  adresse: 'texte',
  code_postal: 'texte',
  ville: 'texte',
  pays: 'texte',
}

/** `PUT espace-client/profil` — `{message, client}` (valeurs null ignorées). */
async function majProfilEspace(req: LocalRequest): Promise<unknown> {
  const client = await resoudreClient()
  const cid = int(client.id, 0)
  const donnees: Record<string, unknown> = {}
  for (const cle of Object.keys(DEF_PROFIL)) {
    const v = req.data[cle]
    // `if valeur is not None` du backend : les nulls explicites sont ignorés.
    if (v !== undefined && v !== null) donnees[cle] = v
  }
  const { affectations, args } = construireSet(donnees, DEF_PROFIL)
  if (affectations.length > 0) {
    await dbExecBatch([
      {
        sql: `UPDATE clients SET ${affectations.join(', ')}, updated_at = ? WHERE id = ?`,
        args: [...args, horodatageLocal(), cid],
      },
    ])
  }
  const rows = await dbQuery('SELECT * FROM clients WHERE id = ?', [cid])
  return { message: 'Profil mis a jour', client: clientColonnes(rows[0] ?? client) }
}

/** `GET espace-client/preferences` — `{notif_email, langue}` (défauts inclus). */
async function preferencesEspace(_req: LocalRequest): Promise<unknown> {
  const userId = currentUserId()
  if (userId === null) {
    return { notif_email: true, langue: 'fr' }
  }
  const rows = await dbQueryOptionnel('SELECT * FROM preferences WHERE user_id = ?', [userId])
  const pref = rows[0]
  if (!pref) {
    return { notif_email: true, langue: 'fr' }
  }
  return { notif_email: boolSql(pref.notif_email), langue: str(pref.langue) || 'fr' }
}

/** `PUT espace-client/preferences` — `{message, notif_email, langue}`. */
async function majPreferencesEspace(req: LocalRequest): Promise<unknown> {
  const userId = currentUserId()
  if (userId === null) {
    throw localError(404, 'Fiche client introuvable pour ce compte')
  }
  const rows = await dbQueryOptionnel('SELECT * FROM preferences WHERE user_id = ?', [userId])
  const pref = rows[0]
  const notifActuel = pref ? boolSql(pref.notif_email) : true
  const langueActuelle = pref ? str(pref.langue) || 'fr' : 'fr'
  const notif = 'notif_email' in req.data && req.data.notif_email !== null && req.data.notif_email !== undefined
    ? boolSql(req.data.notif_email)
    : notifActuel
  const langue = 'langue' in req.data && req.data.langue !== null && req.data.langue !== undefined
    ? str(req.data.langue)
    : langueActuelle

  const maintenant = horodatageLocal()
  if (pref) {
    await dbExecBatch([
      {
        sql: 'UPDATE preferences SET notif_email = ?, langue = ?, updated_at = ? WHERE user_id = ?',
        args: [notif ? 1 : 0, langue, maintenant, userId],
      },
    ])
  } else {
    await dbExecBatch([
      {
        sql: `INSERT INTO preferences (user_id, theme, langue, date_format, devise, notif_email,
              notif_push, notif_factures_retard, notif_stock_bas, is_deleted, created_at, updated_at)
              VALUES (?, 'light', ?, 'DD/MM/YYYY', 'MGA', ?, 1, 1, 1, 0, ?, ?)`,
        args: [userId, langue, notif ? 1 : 0, maintenant, maintenant],
      },
    ])
  }
  return { message: 'Preferences mises a jour', notif_email: notif, langue }
}

/** `GET espace-client/demandes` — `{items}` (`created_at DESC`). */
async function demandesEspace(_req: LocalRequest): Promise<unknown> {
  const client = await resoudreClient()
  const rows = await dbQuery(
    'SELECT * FROM demandes_travaux WHERE client_id = ? AND is_deleted = 0 ORDER BY created_at DESC',
    [int(client.id, 0)],
  )
  return { items: rows.map(demandeComplet) }
}

/** `GET espace-client/demandes/{id}` — `{demande}`. */
async function demandeEspace(req: LocalRequest): Promise<unknown> {
  const client = await resoudreClient()
  const id = int(req.pathParams[0], 0)
  const rows = await dbQuery(
    'SELECT * FROM demandes_travaux WHERE id = ? AND client_id = ? AND is_deleted = 0',
    [id, int(client.id, 0)],
  )
  if (!rows[0]) {
    throw localError(404, 'Demande introuvable')
  }
  return { demande: demandeComplet(rows[0]) }
}

/** `GET espace-client/projets` — `{items}` (`created_at DESC`). */
async function projetsEspace(_req: LocalRequest): Promise<unknown> {
  const client = await resoudreClient()
  const rows = await dbQuery(
    'SELECT * FROM projets WHERE client_id = ? AND is_deleted = 0 ORDER BY created_at DESC',
    [int(client.id, 0)],
  )
  return { items: rows.map(projetComplet) }
}

/** `GET espace-client/projets/{id}` — `{projet, devis, contrats, chantiers, factures}`. */
async function projetEspace(req: LocalRequest): Promise<unknown> {
  const client = await resoudreClient()
  const cid = int(client.id, 0)
  const id = int(req.pathParams[0], 0)
  const rows = await dbQuery(
    'SELECT * FROM projets WHERE id = ? AND client_id = ? AND is_deleted = 0',
    [id, cid],
  )
  const projet = rows[0]
  if (!projet) {
    throw localError(404, 'Projet introuvable')
  }
  const [devisRows, contratsRows, chantiersRows, facturesRows] = await Promise.all([
    dbQuery('SELECT * FROM devis WHERE projet_id = ? AND client_id = ? AND is_deleted = 0', [id, cid]),
    dbQuery(
      `SELECT c.* FROM contrats c JOIN devis d ON c.devis_id = d.id
       WHERE d.projet_id = ? AND c.client_id = ? AND c.is_deleted = 0`,
      [id, cid],
    ),
    dbQuery('SELECT * FROM chantiers WHERE client_id = ? AND is_deleted = 0', [cid]),
    dbQuery('SELECT * FROM factures WHERE client_id = ? AND is_deleted = 0', [cid]),
  ])
  return {
    projet: projetComplet(projet),
    devis: devisRows.map(devisBrut),
    contrats: contratsRows.map(contratColonnes),
    chantiers: chantiersRows.map(chantierBrut),
    factures: facturesRows.map(factureBrut),
  }
}

/** `GET espace-client/devis` — `{items}` (`created_at DESC`). */
async function devisEspace(_req: LocalRequest): Promise<unknown> {
  const client = await resoudreClient()
  const rows = await dbQuery(
    'SELECT * FROM devis WHERE client_id = ? AND is_deleted = 0 ORDER BY created_at DESC',
    [int(client.id, 0)],
  )
  return { items: rows.map(devisBrut) }
}

/** `GET espace-client/devis/{id}` — `{devis, lignes}` (lignes par `ordre`). */
async function devisDetailEspace(req: LocalRequest): Promise<unknown> {
  const client = await resoudreClient()
  const id = int(req.pathParams[0], 0)
  const rows = await dbQuery(
    'SELECT * FROM devis WHERE id = ? AND client_id = ? AND is_deleted = 0',
    [id, int(client.id, 0)],
  )
  const devis = rows[0]
  if (!devis) {
    throw localError(404, 'Devis introuvable')
  }
  const lignes = await dbQuery(
    'SELECT * FROM lignes_devis WHERE devis_id = ? AND is_deleted = 0 ORDER BY ordre ASC',
    [id],
  )
  return { devis: devisBrut(devis), lignes: lignes.map(ligneDevis) }
}

/**
 * `POST espace-client/devis/{id}/reponse` — `{message, devis}`.
 * Écriture d'une entité CANONIQUE → outbox `devis` dans la même batch ;
 * la notification associée reste locale (PHASE 4B, sans outbox).
 */
async function reponseDevisEspace(req: LocalRequest): Promise<unknown> {
  const client = await resoudreClient()
  const cid = int(client.id, 0)
  const id = int(req.pathParams[0], 0)
  const rows = await dbQuery(
    'SELECT * FROM devis WHERE id = ? AND client_id = ? AND is_deleted = 0',
    [id, cid],
  )
  const devis = rows[0]
  if (!devis) {
    throw localError(404, 'Devis introuvable')
  }
  const statutActuel = str(devis.statut)
  if (statutActuel === 'accepte' || statutActuel === 'refuse') {
    throw localError(400, 'Ce devis a deja ete repondu')
  }
  const action = str(req.data.action)
  if (action !== 'accepter' && action !== 'refuser') {
    throw localError(422, "action invalide. Valeurs autorisées: accepter, refuser")
  }
  // Le service envoie `motif_reponse` là où le backend lit `motif` : on accepte
  // les deux pour ne pas perdre le motif du refus côté desktop.
  const motif = strOrNull(req.data.motif) ?? strOrNull(req.data.motif_reponse)
  const accepte = action === 'accepter'
  const statut = accepte ? 'accepte' : 'refuse'
  const maintenant = horodatageLocal()
  const clientRef = str(devis.client_ref) || String(id)
  const numero = str(devis.numero)
  const userId = currentUserId()
  const messageNotif =
    `Votre devis ${numero} a ete ${statut} le ${maintenant.substring(0, 10).split('-').reverse().join('/')}.` +
    (motif && !accepte ? ` Motif : ${motif}` : '')

  await dbExecBatch([
    {
      sql: `UPDATE devis SET statut = ?, reponse_le = ?, reponse_par_id = ?, reponse_motif = ?,
            updated_at = ?, sync_version = COALESCE(sync_version, 0) + 1 WHERE id = ?`,
      args: [
        statut,
        maintenant,
        userId,
        accepte ? null : motif,
        maintenant,
        id,
      ],
    },
    {
      sql: `INSERT INTO notifications (entreprise_id, utilisateur_id, client_id, type, titre, message,
            entite_type, entite_id, canal, envoye_email, lu, created_at)
            VALUES (?, ?, ?, 'devis_repondu', ?, ?, 'devis', ?, 'application', 0, 0, ?)`,
      args: [
        intOrNull(devis.entreprise_id),
        userId,
        cid,
        `Devis ${numero} ${statut}`,
        messageNotif,
        id,
        maintenant,
      ],
    },
    outbox('devis', clientRef, 'update', {
      id,
      statut,
      reponse_le: maintenant,
      reponse_par_id: userId,
      reponse_motif: accepte ? null : motif,
      client_ref: clientRef,
    }),
  ])
  const maj = await dbQuery('SELECT * FROM devis WHERE id = ?', [id])
  return {
    message: `Devis ${statut} avec succes`,
    devis: devisBrut(maj[0] ?? devis),
  }
}

/** `GET espace-client/contrats` — `{items}` (`created_at DESC`). */
async function contratsEspace(_req: LocalRequest): Promise<unknown> {
  const client = await resoudreClient()
  const rows = await dbQuery(
    'SELECT * FROM contrats WHERE client_id = ? AND is_deleted = 0 ORDER BY created_at DESC',
    [int(client.id, 0)],
  )
  return { items: rows.map(contratColonnes) }
}

/** `GET espace-client/contrats/{id}` — `{contrat, avenants}` (`created_at DESC`). */
async function contratEspace(req: LocalRequest): Promise<unknown> {
  const client = await resoudreClient()
  const id = int(req.pathParams[0], 0)
  const rows = await dbQuery(
    'SELECT * FROM contrats WHERE id = ? AND client_id = ? AND is_deleted = 0',
    [id, int(client.id, 0)],
  )
  const contrat = rows[0]
  if (!contrat) {
    throw localError(404, 'Contrat introuvable')
  }
  const avenants = await dbQuery(
    'SELECT * FROM avenants WHERE contrat_id = ? AND is_deleted = 0 ORDER BY created_at DESC',
    [id],
  )
  return { contrat: contratColonnes(contrat), avenants: avenants.map(avenantColonnes) }
}

/** `GET espace-client/avenants` — `{items}` (avenants des contrats du client). */
async function avenantsEspace(_req: LocalRequest): Promise<unknown> {
  const client = await resoudreClient()
  const rows = await dbQuery(
    `SELECT a.* FROM avenants a JOIN contrats c ON a.contrat_id = c.id
     WHERE c.client_id = ? AND a.is_deleted = 0 ORDER BY a.created_at DESC`,
    [int(client.id, 0)],
  )
  return { items: rows.map(avenantColonnes) }
}

/** Avancement moyen des phases d'un chantier (`round(sum/len)` Python). */
function avancementChantier(phases: LocalRow[]): number {
  if (phases.length === 0) return 0
  const somme = phases.reduce((s, ph) => s + int(ph.avancement_pct, 0), 0)
  return Math.round(somme / phases.length)
}

async function phasesDuChantier(chantierId: number): Promise<LocalRow[]> {
  return dbQueryOptionnel(
    'SELECT * FROM phases WHERE chantier_id = ? AND is_deleted = 0 ORDER BY ordre ASC',
    [chantierId],
  )
}

/** `GET espace-client/chantiers` — `{items: [{chantier, avancement_global}]}`. */
async function chantiersEspace(_req: LocalRequest): Promise<unknown> {
  const client = await resoudreClient()
  const rows = await dbQuery(
    'SELECT * FROM chantiers WHERE client_id = ? AND is_deleted = 0 ORDER BY created_at DESC',
    [int(client.id, 0)],
  )
  const items = []
  for (const ch of rows) {
    const phases = await phasesDuChantier(int(ch.id, 0))
    items.push({ chantier: chantierBrut(ch), avancement_global: avancementChantier(phases) })
  }
  return { items }
}

/** `GET espace-client/chantiers/{id}` — détail + phases + situations. */
async function chantierEspace(req: LocalRequest): Promise<unknown> {
  const client = await resoudreClient()
  const id = int(req.pathParams[0], 0)
  const rows = await dbQuery(
    'SELECT * FROM chantiers WHERE id = ? AND client_id = ? AND is_deleted = 0',
    [id, int(client.id, 0)],
  )
  const chantier = rows[0]
  if (!chantier) {
    throw localError(404, 'Chantier introuvable')
  }
  const phases = await phasesDuChantier(id)
  const situations = await dbQuery(
    'SELECT * FROM situations_travaux WHERE chantier_id = ? AND is_deleted = 0 ORDER BY created_at DESC',
    [id],
  )
  return {
    chantier: chantierBrut(chantier),
    avancement_global: avancementChantier(phases),
    phases: phases.map((ph) => ({
      nom: str(ph.nom),
      avancement_pct: int(ph.avancement_pct, 0),
      statut: strOrNull(ph.statut),
      date_debut: jour(ph.date_debut),
      date_fin: jour(ph.date_fin),
    })),
    situations: situations.map(situationComplet),
  }
}

/** `GET espace-client/avancements` (+ alias `avancement`) — `{items}`. */
async function avancementsEspace(_req: LocalRequest): Promise<unknown> {
  const client = await resoudreClient()
  const cid = int(client.id, 0)
  const chantiers = await dbQuery(
    'SELECT * FROM chantiers WHERE client_id = ? AND is_deleted = 0',
    [cid],
  )
  const items = []
  for (const ch of chantiers) {
    const chantierId = int(ch.id, 0)
    const phases = await phasesDuChantier(chantierId)
    const situations = await dbQuery(
      'SELECT * FROM situations_travaux WHERE chantier_id = ? AND is_deleted = 0',
      [chantierId],
    )
    items.push({
      chantier: {
        id: chantierId,
        nom: str(ch.nom),
        adresse: strOrNull(ch.adresse),
        statut: strOrNull(ch.statut),
      },
      avancement_global: avancementChantier(phases),
      phases: phases.map((ph) => ({
        nom: str(ph.nom),
        avancement_pct: int(ph.avancement_pct, 0),
        statut: strOrNull(ph.statut),
      })),
      situations: situations.map((s) => ({
        id: int(s.id, 0),
        numero: strOrNull(s.numero),
        periode: strOrNull(s.periode),
        avancement: floatOrNull(s.avancement) ?? 0,
        montant: floatOrNull(s.montant) ?? 0,
        statut: strOrNull(s.statut),
      })),
    })
  }
  return { items }
}

/** `GET espace-client/situations` — `{items}` (via les chantiers du client). */
async function situationsEspace(_req: LocalRequest): Promise<unknown> {
  const client = await resoudreClient()
  const rows = await dbQuery(
    `SELECT s.* FROM situations_travaux s JOIN chantiers c ON s.chantier_id = c.id
     WHERE c.client_id = ? AND s.is_deleted = 0 ORDER BY s.created_at DESC`,
    [int(client.id, 0)],
  )
  return { items: rows.map(situationComplet) }
}

/** `GET espace-client/situations/{id}` — `{situation, lignes, total}`. */
async function situationEspace(req: LocalRequest): Promise<unknown> {
  const client = await resoudreClient()
  const id = int(req.pathParams[0], 0)
  const rows = await dbQuery(
    `SELECT s.* FROM situations_travaux s JOIN chantiers c ON s.chantier_id = c.id
     WHERE s.id = ? AND c.client_id = ? AND s.is_deleted = 0`,
    [id, int(client.id, 0)],
  )
  const situation = rows[0]
  if (!situation) {
    throw localError(404, 'Situation introuvable')
  }
  const lignes = await dbQuery(
    'SELECT * FROM lignes_situation WHERE situation_id = ? AND is_deleted = 0',
    [id],
  )
  const total = lignes.reduce((s, l) => s + (floatOrNull(l.montant) ?? 0), 0)
  return {
    situation: situationComplet(situation),
    lignes: lignes.map(ligneSituation),
    total,
  }
}

/** `GET espace-client/factures` — `{items}` (`created_at DESC`). */
async function facturesEspace(_req: LocalRequest): Promise<unknown> {
  const client = await resoudreClient()
  const rows = await dbQuery(
    'SELECT * FROM factures WHERE client_id = ? AND is_deleted = 0 ORDER BY created_at DESC',
    [int(client.id, 0)],
  )
  return { items: rows.map(factureBrut) }
}

/** `GET espace-client/factures/{id}` — `{facture, lignes, paiements}`. */
async function factureEspace(req: LocalRequest): Promise<unknown> {
  const client = await resoudreClient()
  const id = int(req.pathParams[0], 0)
  const rows = await dbQuery(
    'SELECT * FROM factures WHERE id = ? AND client_id = ? AND is_deleted = 0',
    [id, int(client.id, 0)],
  )
  const facture = rows[0]
  if (!facture) {
    throw localError(404, 'Facture introuvable')
  }
  const [lignes, paiements] = await Promise.all([
    dbQuery(
      'SELECT * FROM lignes_factures WHERE facture_id = ? AND is_deleted = 0 ORDER BY ordre ASC',
      [id],
    ),
    dbQuery(
      'SELECT * FROM paiements WHERE facture_id = ? AND is_deleted = 0 ORDER BY date_paiement DESC',
      [id],
    ),
  ])
  return {
    facture: factureBrut(facture),
    lignes: lignes.map(ligneFacture),
    paiements: paiements.map(paiementResp),
  }
}

/** `GET espace-client/paiements` — `{items, totaux}`. */
async function paiementsEspace(_req: LocalRequest): Promise<unknown> {
  const client = await resoudreClient()
  const cid = int(client.id, 0)
  const factures = await dbQuery(
    'SELECT * FROM factures WHERE client_id = ? AND is_deleted = 0',
    [cid],
  )
  const factureIds = factures.map((f) => int(f.id, 0))
  let paiements: LocalRow[] = []
  if (factureIds.length > 0) {
    paiements = await dbQuery(
      `SELECT * FROM paiements WHERE facture_id IN (${factureIds.map(() => '?').join(', ')}) AND is_deleted = 0 ORDER BY date_paiement DESC`,
      factureIds,
    )
  }
  const totalFacture = factures.reduce((s, f) => s + reel(f.montant_ttc), 0)
  const totalPaye = paiements.reduce((s, p) => s + reel(p.montant), 0)
  return {
    items: paiements.map(paiementResp),
    totaux: {
      total_facture: totalFacture,
      total_paye: totalPaye,
      total_restant: Math.max(totalFacture - totalPaye, 0),
    },
  }
}

/** `GET espace-client/documents` — `{items}` (filtre `categorie`). */
async function documentsEspace(req: LocalRequest): Promise<unknown> {
  const client = await resoudreClient()
  const conds = ['client_id = ?', 'is_deleted = 0']
  const args: JsonValue[] = [int(client.id, 0)]
  const categorie = strOrNull(req.params.categorie)
  if (categorie) {
    conds.push('categorie = ?')
    args.push(categorie)
  }
  const rows = await dbQuery(
    `SELECT * FROM documents WHERE ${conds.join(' AND ')} ORDER BY created_at DESC`,
    args,
  )
  return { items: rows.map(documentBrut) }
}

/** `GET espace-client/notifications` — `{items, non_lues}` (50 dernières). */
async function notificationsEspace(_req: LocalRequest): Promise<unknown> {
  const client = await resoudreClient()
  const cid = int(client.id, 0)
  const userId = currentUserId()
  const rows = await dbQuery(
    `SELECT * FROM notifications WHERE (client_id = ? OR utilisateur_id = ?)
     ORDER BY created_at DESC LIMIT 50`,
    [cid, userId ?? -1],
  )
  const items = rows.map(notificationBrut)
  return {
    items,
    non_lues: items.filter((n) => n.lu === false).length,
  }
}

/** `POST espace-client/notifications/{id}/lu` — `{message}`. */
async function marquerNotificationLue(req: LocalRequest): Promise<unknown> {
  const client = await resoudreClient()
  const id = int(req.pathParams[0], 0)
  const cid = int(client.id, 0)
  const userId = currentUserId()
  const rows = await dbQuery(
    'SELECT id FROM notifications WHERE id = ? AND (client_id = ? OR utilisateur_id = ?)',
    [id, cid, userId ?? -1],
  )
  if (!rows[0]) {
    throw localError(404, 'Notification introuvable')
  }
  await dbExecBatch([{ sql: 'UPDATE notifications SET lu = 1 WHERE id = ?', args: [id] }])
  return { message: 'Notification marquee comme lue' }
}

// ============================================================
// Enregistrements — routes exactes
// ============================================================

registerLocalRoutes(
  {
    // ---- Commercial ----
    'GET commercial/clients': listClients,
    'POST commercial/clients': createClient,
    'GET commercial/devis': listDevis,
    'POST commercial/devis': createDevis,
    'GET commercial/contrats': listContrats,
    'GET commercial/avenants': listAvenants,
    'GET commercial/factures': listFactures,
    'POST commercial/factures': createFacture,
    'GET commercial/paiements': listPaiements,
    'POST commercial/paiements': createPaiement,
    'GET commercial/demandes': listDemandes,
    'POST commercial/demandes': createDemande,
    'GET commercial/projets': listProjets,
    'POST commercial/projets': createProjet,
    'GET commercial/metres': listMetres,
    'POST commercial/metres': createMetre,
    'GET commercial/situations': listSituations,
    'POST commercial/situations': createSituation,
    // ---- Espace client ----
    'GET espace-client/dashboard': dashboardEspace,
    'GET espace-client/profil': profilEspace,
    'PUT espace-client/profil': majProfilEspace,
    'GET espace-client/preferences': preferencesEspace,
    'PUT espace-client/preferences': majPreferencesEspace,
    'GET espace-client/demandes': demandesEspace,
    'GET espace-client/projets': projetsEspace,
    'GET espace-client/devis': devisEspace,
    'GET espace-client/contrats': contratsEspace,
    'GET espace-client/avenants': avenantsEspace,
    'GET espace-client/chantiers': chantiersEspace,
    'GET espace-client/avancements': avancementsEspace,
    'GET espace-client/avancement': avancementsEspace,
    'GET espace-client/situations': situationsEspace,
    'GET espace-client/factures': facturesEspace,
    'GET espace-client/paiements': paiementsEspace,
    'GET espace-client/documents': documentsEspace,
    'GET espace-client/notifications': notificationsEspace,
  },
  {
    // FastAPI : POST → 201 (PUT → 200, DELETE → 204 via les patrons).
    'POST commercial/clients': 201,
    'POST commercial/devis': 201,
    'POST commercial/factures': 201,
    'POST commercial/paiements': 201,
    'POST commercial/demandes': 201,
    'POST commercial/projets': 201,
    'POST commercial/metres': 201,
    'POST commercial/situations': 201,
  },
)

// ============================================================
// Enregistrements — routes à paramètre (du plus spécifique au plus général)
// ============================================================

// ---- Clients ----
registerLocalPattern(/^GET commercial\/clients\/(\d+)$/, getClient)
registerLocalPattern(/^PUT commercial\/clients\/(\d+)$/, updateClient)

// ---- Devis (et lignes) ----
registerLocalPattern(/^POST commercial\/devis\/(\d+)\/valider$/, validerDevis)
registerLocalPattern(
  /^POST commercial\/devis\/(\d+)\/transformer-contrat$/,
  transformerContrat,
  201,
)
registerLocalPattern(/^POST commercial\/devis\/(\d+)\/lignes$/, createLigneDevis, 201)
registerLocalPattern(/^PUT commercial\/devis\/(\d+)\/lignes\/(\d+)$/, updateLigneDevis)
registerLocalPattern(/^DELETE commercial\/devis\/(\d+)\/lignes\/(\d+)$/, deleteLigneDevis, 204)
registerLocalPattern(/^GET commercial\/devis\/(\d+)$/, getDevis)
registerLocalPattern(/^PUT commercial\/devis\/(\d+)$/, updateDevis)

// ---- Factures (et lignes) ----
registerLocalPattern(/^POST commercial\/factures\/(\d+)\/lignes$/, createLigneFacture, 201)
registerLocalPattern(/^PUT commercial\/factures\/(\d+)\/lignes\/(\d+)$/, updateLigneFacture)
registerLocalPattern(/^DELETE commercial\/factures\/(\d+)\/lignes\/(\d+)$/, deleteLigneFacture, 204)
registerLocalPattern(/^GET commercial\/factures\/(\d+)$/, getFacture)
registerLocalPattern(/^PUT commercial\/factures\/(\d+)$/, updateFacture)

// ---- Contrats / avenants ----
registerLocalPattern(/^GET commercial\/contrats\/(\d+)\/avenants$/, listAvenantsDuContrat)
registerLocalPattern(/^POST commercial\/contrats\/(\d+)\/avenants$/, createAvenant, 201)
registerLocalPattern(/^PUT commercial\/avenants\/(\d+)$/, updateAvenant)
registerLocalPattern(/^DELETE commercial\/avenants\/(\d+)$/, deleteAvenant, 204)

// ---- Demandes / projets / métrés ----
registerLocalPattern(/^GET commercial\/demandes\/(\d+)$/, getDemande)
registerLocalPattern(/^PUT commercial\/demandes\/(\d+)$/, updateDemande)
registerLocalPattern(/^DELETE commercial\/demandes\/(\d+)$/, deleteDemande, 204)
registerLocalPattern(/^GET commercial\/projets\/(\d+)$/, getProjet)
registerLocalPattern(/^PUT commercial\/projets\/(\d+)$/, updateProjet)
registerLocalPattern(/^DELETE commercial\/projets\/(\d+)$/, deleteProjet, 204)
registerLocalPattern(/^GET commercial\/metres\/(\d+)$/, getMetre)
registerLocalPattern(/^PUT commercial\/metres\/(\d+)$/, updateMetre)
registerLocalPattern(/^DELETE commercial\/metres\/(\d+)$/, deleteMetre, 204)

// ---- Situations (et lignes) ----
registerLocalPattern(/^GET commercial\/situations\/(\d+)\/lignes$/, listLignesSituation)
registerLocalPattern(/^POST commercial\/situations\/(\d+)\/lignes$/, createLigneSituation, 201)
registerLocalPattern(
  /^DELETE commercial\/situations\/(\d+)\/lignes\/(\d+)$/,
  deleteLigneSituation,
  204,
)
registerLocalPattern(/^GET commercial\/situations\/(\d+)$/, getSituation)
registerLocalPattern(/^PUT commercial\/situations\/(\d+)$/, updateSituation)
registerLocalPattern(/^DELETE commercial\/situations\/(\d+)$/, deleteSituation, 204)

// ---- Espace client ----
registerLocalPattern(/^GET espace-client\/demandes\/(\d+)$/, demandeEspace)
registerLocalPattern(/^GET espace-client\/projets\/(\d+)$/, projetEspace)
registerLocalPattern(/^POST espace-client\/devis\/(\d+)\/reponse$/, reponseDevisEspace)
registerLocalPattern(/^GET espace-client\/devis\/(\d+)$/, devisDetailEspace)
registerLocalPattern(/^GET espace-client\/contrats\/(\d+)$/, contratEspace)
registerLocalPattern(/^GET espace-client\/chantiers\/(\d+)$/, chantierEspace)
registerLocalPattern(/^GET espace-client\/avancements\/(\d+)$/, avancementsEspace)
registerLocalPattern(/^GET espace-client\/avancement\/(\d+)$/, avancementsEspace)
registerLocalPattern(/^GET espace-client\/situations\/(\d+)$/, situationEspace)
registerLocalPattern(/^GET espace-client\/factures\/(\d+)$/, factureEspace)
registerLocalPattern(/^POST espace-client\/notifications\/(\d+)\/lu$/, marquerNotificationLue)
