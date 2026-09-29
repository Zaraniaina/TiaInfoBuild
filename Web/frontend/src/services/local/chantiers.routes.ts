/**
 * Routes locales desktop — MODULE CHANTIERS ÉTENDU (écritures créa/modif/
 * suppression chantier, phases, incidents, affectations, rapports journaliers
 * + module aléas climatiques — Phase 4).
 *
 * ATTENTION : `GET chantiers` et `GET chantiers/{id}` NE SONT PAS redéfinis
 * ici — ils restent servis par le registre historique de `desktopClient.ts`.
 *
 * Contrat commun : voir l'en-tête de `local/stocks.routes.ts` / `local/helpers.ts`.
 * - Chaque handler renvoie le MÊME JSON que le endpoint FastAPI correspondant ;
 *   POST → 201, DELETE → 204 (statuts transmis à `registerLocalRoutes` /
 *   `registerLocalPattern`).
 * - Écritures des entités canoniques `chantier` et `incident` : UNE SEULE
 *   `dbExecBatch` contenant l'écriture métier ET sa ligne `_sync_outbox`
 *   (`entity, entity_id, op, payload, client_ts, pushed=0`), `client_ref` UUID,
 *   `sync_version = 1` à la création (+1 en mise à jour), horodatages
 *   `horodatageLocal()` ; soft-delete → `is_deleted = 1` + `op = 'delete'`.
 * - Phases / affectations / rapports journaliers / aléas climatiques : local
 *   SANS outbox — `// PHASE 4B : sync de cette entité à brancher.`
 * Chemins exacts : `Web/frontend/src/services/chantiers.service.ts`,
 * `aleasClimatiques.service.ts` + appels `api.*` de `src/pages/chantiers/*`.
 */
import { registerLocalPattern, registerLocalRoutes, type LocalRequest } from './registry'
import {
  clausesTenant,
  currentEntrepriseId,
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
  serializerBooleens,
  str,
  strOrNull,
  uuid,
  type JsonValue,
  type LocalRow,
} from './helpers'

// ---------------------------------------------------------------------------
// Constantes métier (calées sur app/routers/chantiers.py + schemas/chantier.py)
// ---------------------------------------------------------------------------

/** `ChantierResponse` (schéma chantier.py) — détail complet. */
const CHANTIER_COLS = [
  'id', 'entreprise_id', 'client_id', 'chef_chantier_id', 'projet_id',
  'numero', 'nom', 'adresse', 'code_postal', 'ville', 'date_debut',
  'date_fin_prevue', 'date_fin_reelle', 'budget_prevu', 'budget_previsionnel',
  'budget_reel', 'marge_cible', 'tva', 'statut', 'description', 'region',
  'is_deleted', 'created_at', 'updated_at',
] as const

const STATUTS_CHANTIER = ['planification', 'en_cours', 'termine', 'annule', 'suspendu']
const TYPES_ALEA = [
  'cyclone', 'inondation', 'pluies_intenses', 'secheresse',
  'route_coupee', 'coupure_electricite', 'autre',
]
const IMPUTABILITES = ['climatique', 'entreprise', 'client', 'indetermine']
const TYPES_RISQUE = TYPES_ALEA // même ensemble que `TYPES_RISQUE` (aleas_climatiques.py)

/** Champs de `ChantierUpdate` : [colonne, conversion]. */
const CHAMPS_MAJ_CHANTIER: Array<[string, 'str' | 'int' | 'float']> = [
  ['numero', 'str'], ['nom', 'str'], ['adresse', 'str'], ['code_postal', 'str'],
  ['ville', 'str'], ['date_debut', 'str'], ['date_fin_prevue', 'str'],
  ['date_fin_reelle', 'str'], ['budget_prevu', 'float'],
  ['budget_previsionnel', 'float'], ['budget_reel', 'float'],
  ['marge_cible', 'float'], ['tva', 'float'], ['statut', 'str'],
  ['description', 'str'], ['region', 'str'], ['client_id', 'int'],
  ['chef_chantier_id', 'int'],
]

/** Colonnes NUMériques NOT NULL : une valeur nulle est ignorée (colonne locale NOT NULL). */
const CHAMPS_NON_NULL_CHANTIER = new Set([
  'budget_prevu', 'budget_previsionnel', 'budget_reel', 'marge_cible', 'tva', 'statut',
])

// ---------------------------------------------------------------------------
// Helpers partagés du module
// ---------------------------------------------------------------------------

/** row → JSON `ChantierResponse` (sous-ressources null, comme FastAPI les renvoie sur create/update). */
function serializerChantier(row: LocalRow): LocalRow {
  const out: LocalRow = {}
  for (const c of CHANTIER_COLS) out[c] = c in row ? row[c] : null
  return {
    ...serializerBooleens(out, ['is_deleted']),
    phases: null,
    incidents: null,
    affectations: null,
    impact_climatique: null,
  }
}

/** Charge un chantier (404 inconnu / 403 hors tenant), comme `get_chantier` (chantiers.py). */
async function chargerChantier(id: number): Promise<LocalRow> {
  if (id < 1) {
    throw localError(404, 'Chantier non trouvé')
  }
  const rows = await dbQuery(
    `SELECT ${CHANTIER_COLS.join(', ')}, client_ref FROM chantiers WHERE id = ? AND is_deleted = 0`,
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
  return chantier
}

/** Liste au format `repr` Python des messages pydantic (`{sorted(...)}`). */
function listePython(valeurs: readonly string[]): string {
  return `[${[...valeurs].sort().map((v) => `'${v}'`).join(', ')}]`
}

/**
 * Valide les champs communs `ChantierCreate`/`ChantierUpdate` présents dans le corps.
 * @param nomObligatoire true sur POST (`nom` requis, min_length=1), false sur PUT.
 */
function validerChampsChantier(body: Record<string, unknown>, nomObligatoire: boolean): void {
  const nomFourni = 'nom' in body ? body.nom : undefined
  const nomVide = nomFourni === undefined || nomFourni === null || String(nomFourni).trim() === ''
  if (nomObligatoire && nomVide) {
    throw localError(422, 'nom : champ obligatoire.')
  }
  if (!nomObligatoire && 'nom' in body && nomVide) {
    throw localError(422, 'nom : champ obligatoire.')
  }
  if ('statut' in body && body.statut !== null && body.statut !== undefined) {
    const statut = str(body.statut)
    if (!STATUTS_CHANTIER.includes(statut)) {
      throw localError(422, `Statut invalide. Valeurs autorisées : ${STATUTS_CHANTIER.join(', ')}`)
    }
  }
  for (const cle of ['budget_prevu', 'budget_previsionnel', 'budget_reel', 'marge_cible']) {
    if (cle in body && body[cle] !== null && body[cle] !== undefined) {
      const v = floatOrNull(body[cle])
      if (v !== null && v < 0) {
        throw localError(422, 'La valeur budgétaire ne peut pas être négative')
      }
    }
  }
  if ('tva' in body && body.tva !== null && body.tva !== undefined) {
    const tva = floatOrNull(body.tva)
    if (tva !== null && (tva < 0 || tva > 100)) {
      throw localError(422, 'La TVA doit être comprise entre 0 et 100')
    }
  }
}

function joursEntre(debut: string, fin: string): number {
  const d = Date.parse(`${debut}T00:00:00`)
  const f = Date.parse(`${fin}T00:00:00`)
  if (Number.isNaN(d) || Number.isNaN(f)) return 0
  return Math.round((f - d) / 86_400_000)
}

/** Réplique de `calculer_impact_climatique` (aleas_climatiques.py). */
function calculerImpact(
  incidents: LocalRow[],
  dateFinPrevue: unknown,
  dateFinReelle: unknown,
  aujourdhui: string,
): { jours_arret_climatique: number; retard_brut_jours: number; retard_net_jours: number } {
  let joursArret = 0
  for (const i of incidents) {
    if (str(i.type_alea).trim() && str(i.imputabilite) === 'climatique' && !int(i.is_deleted, 0)) {
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

/** `AffectationChantierList` (chantiers.py). */
function serializerAffectation(row: LocalRow): LocalRow {
  return {
    id: int(row.id, 0),
    employe_id: int(row.employe_id, 0),
    chantier_id: int(row.chantier_id, 0),
    date_debut: strOrNull(row.date_debut),
    date_fin: strOrNull(row.date_fin),
    role: strOrNull(row.role),
    is_deleted: boolLocal(row.is_deleted),
    created_at: strOrNull(row.created_at),
    updated_at: strOrNull(row.updated_at),
  }
}

function boolLocal(v: unknown): boolean {
  return v === 1 || v === true || v === '1'
}

/** Ligne `periodes_risque_climatique` → JSON FastAPI (colonnes brutes, is_deleted bool). */
function serializerPeriode(row: LocalRow): LocalRow {
  return serializerBooleens({ ...row }, ['is_deleted'])
}

/** Transaction unique : écriture métier + ligne `_sync_outbox` (règle plan §6.1). */
function ligneOutbox(
  entity: string,
  entityId: string,
  op: 'create' | 'update' | 'delete',
  payload: string,
  clientTs: string,
): { sql: string; args: JsonValue[] } {
  return {
    sql: `INSERT INTO _sync_outbox (entity, entity_id, op, payload, client_ts, pushed)
          VALUES (?, ?, ?, ?, ?, 0)`,
    args: [entity, entityId, op, payload, clientTs],
  }
}

// ---------------------------------------------------------------------------
// CHANTIER — créa / modif / suppression / statut (entité canonique outbox)
// ---------------------------------------------------------------------------

/** POST chantiers — réplique `create_chantier` (201) : INSERT + outbox `chantier` dans UNE batch. */
async function createChantierLocal(req: LocalRequest): Promise<unknown> {
  const body = req.data
  validerChampsChantier(body, true)

  const maintenant = new Date()
  const horodatage = horodatageLocal(maintenant)
  const clientRef = uuid()
  const entrepriseId = currentEntrepriseId() ?? intOrNull(body.entreprise_id)
  const chefId = intOrNull(body.chef_chantier_id) ?? currentUserId()
  const nom = str(body.nom).trim()
  const valeurs: JsonValue[] = [
    entrepriseId,
    intOrNull(body.client_id),
    chefId,
    null, // projet_id : absent du schéma ChantierCreate
    strOrNull(body.numero),
    nom,
    strOrNull(body.adresse),
    strOrNull(body.code_postal),
    strOrNull(body.ville),
    strOrNull(body.date_debut),
    strOrNull(body.date_fin_prevue),
    strOrNull(body.date_fin_reelle),
    floatOrNull(body.budget_prevu) ?? 0,
    floatOrNull(body.budget_previsionnel) ?? 0,
    floatOrNull(body.budget_reel) ?? 0,
    floatOrNull(body.marge_cible) ?? 0,
    floatOrNull(body.tva) ?? 20,
    strOrNull(body.statut) ?? 'planification',
    strOrNull(body.description),
    strOrNull(body.region),
    0,
    horodatage,
    horodatage,
  ]
  const payload = JSON.stringify({
    entreprise_id: valeurs[0],
    client_id: valeurs[1],
    chef_chantier_id: valeurs[2],
    numero: valeurs[4],
    nom,
    ville: valeurs[8],
    statut: valeurs[17],
    client_ref: clientRef,
  })

  await dbExecBatch([
    {
      sql: `INSERT INTO chantiers (
        entreprise_id, client_id, chef_chantier_id, projet_id, numero, nom,
        adresse, code_postal, ville, date_debut, date_fin_prevue, date_fin_reelle,
        budget_prevu, budget_previsionnel, budget_reel, marge_cible, tva,
        statut, description, region, is_deleted, created_at, updated_at,
        sync_version, client_ref, client_ts
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      args: [...valeurs, clientRef, horodatage],
    },
    ligneOutbox('chantier', clientRef, 'create', payload, horodatage),
  ])

  const idRows = await dbQuery('SELECT id FROM chantiers WHERE client_ref = ? LIMIT 1', [clientRef])
  const id = int(idRows[0]?.id, 0)
  const rows = await dbQuery(
    `SELECT ${CHANTIER_COLS.join(', ')} FROM chantiers WHERE id = ?`,
    [id],
  )
  return serializerChantier(rows[0] ?? { id })
}

/** PUT chantiers/{id} — réplique `update_chantier` : UPDATE + outbox `chantier` (update). */
async function updateChantierLocal(req: LocalRequest): Promise<unknown> {
  const id = int(req.pathParams[0], 0)
  const chantier = await chargerChantier(id)
  const body = req.data
  validerChampsChantier(body, false)

  const sets: string[] = []
  const args: JsonValue[] = []
  const modifies: Record<string, unknown> = {}
  for (const [col, type] of CHAMPS_MAJ_CHANTIER) {
    if (!(col in body)) continue
    const brut = body[col]
    let valeur: JsonValue
    if (type === 'str') valeur = strOrNull(brut)
    else if (type === 'int') valeur = intOrNull(brut)
    else valeur = floatOrNull(brut)
    // Colonnes locales NOT NULL : une valeur nulle est ignorée (conserve l'existant).
    if (valeur === null && CHAMPS_NON_NULL_CHANTIER.has(col)) continue
    sets.push(`${col} = ?`)
    args.push(valeur)
    modifies[col] = valeur
  }

  const maintenant = new Date()
  const horodatage = horodatageLocal(maintenant)
  const clientRef = str(chantier.client_ref) || uuid()
  const payload = JSON.stringify({ id, ...modifies, client_ref: clientRef })

  if (sets.length > 0) {
    // Transaction unique : écriture métier + outbox (règle du plan §6.1).
    await dbExecBatch([
      {
        sql: `UPDATE chantiers SET ${sets.join(', ')}, updated_at = ?, client_ts = ?,
              sync_version = COALESCE(sync_version, 0) + 1, client_ref = ?
              WHERE id = ?`,
        args: [...args, horodatage, horodatage, clientRef, id],
      },
      ligneOutbox('chantier', clientRef, 'update', payload, horodatage),
    ])
  }

  const rows = await dbQuery(
    `SELECT ${CHANTIER_COLS.join(', ')} FROM chantiers WHERE id = ? AND is_deleted = 0`,
    [id],
  )
  return serializerChantier(rows[0] ?? chantier)
}

/** DELETE chantiers/{id} — réplique `delete_chantier` (204) : soft-delete + outbox `chantier` (delete). */
async function deleteChantierLocal(req: LocalRequest): Promise<unknown> {
  const id = int(req.pathParams[0], 0)
  const chantier = await chargerChantier(id)

  const maintenant = new Date()
  const horodatage = horodatageLocal(maintenant)
  const clientRef = str(chantier.client_ref) || uuid()
  const payload = JSON.stringify({ id, is_deleted: 1, client_ref: clientRef })

  await dbExecBatch([
    {
      sql: `UPDATE chantiers SET is_deleted = 1, updated_at = ?, client_ts = ?,
            sync_version = COALESCE(sync_version, 0) + 1, client_ref = ?
            WHERE id = ?`,
      args: [horodatage, horodatage, clientRef, id],
    },
    ligneOutbox('chantier', clientRef, 'delete', payload, horodatage),
  ])
  return null // 204 No Content
}

/** PUT chantiers/{id}/statut — réplique `update_chantier_statut` : outbox `chantier` (update). */
async function updateChantierStatutLocal(req: LocalRequest): Promise<unknown> {
  const id = int(req.pathParams[0], 0)
  const chantier = await chargerChantier(id)
  const statut = str(req.data.statut).trim()
  if (!statut) {
    throw localError(422, 'statut : champ obligatoire.')
  }
  if (!STATUTS_CHANTIER.includes(statut)) {
    throw localError(422, `Statut invalide. Valeurs autorisées : ${STATUTS_CHANTIER.join(', ')}`)
  }

  const maintenant = new Date()
  const horodatage = horodatageLocal(maintenant)
  const clientRef = str(chantier.client_ref) || uuid()
  const payload = JSON.stringify({ id, statut, client_ref: clientRef })

  await dbExecBatch([
    {
      sql: `UPDATE chantiers SET statut = ?, updated_at = ?, client_ts = ?,
            sync_version = COALESCE(sync_version, 0) + 1, client_ref = ?
            WHERE id = ?`,
      args: [statut, horodatage, horodatage, clientRef, id],
    },
    ligneOutbox('chantier', clientRef, 'update', payload, horodatage),
  ])

  const rows = await dbQuery(
    `SELECT ${CHANTIER_COLS.join(', ')} FROM chantiers WHERE id = ? AND is_deleted = 0`,
    [id],
  )
  return serializerChantier(rows[0] ?? chantier)
}

// ---------------------------------------------------------------------------
// Sous-ressources du chantier
// ---------------------------------------------------------------------------

/** POST chantiers/{id}/phases — réplique `add_phase` (201). */
async function addPhaseLocal(req: LocalRequest): Promise<unknown> {
  const chantierId = int(req.pathParams[0], 0)
  await chargerChantier(chantierId)
  const body = req.data

  const nom = str(body.nom).trim()
  if (!nom) {
    throw localError(422, 'nom : champ obligatoire.')
  }
  const avancement = int(body.avancement_pct, 0)
  if (avancement < 0 || avancement > 100) {
    throw localError(422, 'avancement_pct : valeur attendue entre 0 et 100.')
  }
  const budget = floatOrNull(body.budget) ?? 0
  if (budget < 0) {
    throw localError(422, 'La valeur budgétaire ne peut pas être négative')
  }
  const ordre = int(body.ordre, 0)
  if (ordre < 0) {
    throw localError(422, 'ordre : la valeur ne peut pas être négative.')
  }

  const horodatage = horodatageLocal()
  // PHASE 4B : sync de cette entité à brancher. (phase = hors entités canoniques)
  const resultat = await dbExecBatch([
    {
      sql: `INSERT INTO phases (
        chantier_id, nom, description, date_debut, date_fin, budget,
        avancement_pct, statut, ordre, is_deleted, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      args: [
        chantierId,
        nom,
        strOrNull(body.description),
        strOrNull(body.date_debut),
        strOrNull(body.date_fin),
        budget,
        avancement,
        strOrNull(body.statut) ?? 'non_commencee',
        ordre,
        horodatage,
        horodatage,
      ],
    },
  ])
  return { id: int(resultat.last_id, 0), message: 'Phase ajoutée' }
}

/** POST chantiers/{id}/incidents — réplique `add_incident` (201), outbox `incident`. */
async function addIncidentLocal(req: LocalRequest): Promise<unknown> {
  const chantierId = int(req.pathParams[0], 0)
  await chargerChantier(chantierId)
  const body = req.data

  const titre = str(body.titre).trim()
  if (!titre) {
    throw localError(422, 'titre : champ obligatoire.')
  }
  const typeAlea = strOrNull(body.type_alea)
  if (typeAlea !== null && !TYPES_ALEA.includes(typeAlea)) {
    throw localError(422, `Type d'aléa invalide. Valeurs autorisées: ${listePython(TYPES_ALEA)}`)
  }
  const imputabilite = strOrNull(body.imputabilite)
  if (imputabilite !== null && !IMPUTABILITES.includes(imputabilite)) {
    throw localError(422, `Imputabilité invalide. Valeurs autorisées: ${listePython(IMPUTABILITES)}`)
  }
  const impact = intOrNull(body.impact_arret_jours)
  if (impact !== null && impact < 0) {
    throw localError(422, 'impact_arret_jours : la valeur ne peut pas être négative.')
  }

  const maintenant = new Date()
  const horodatage = horodatageLocal(maintenant)
  const clientRef = uuid()
  const gravite = strOrNull(body.gravite) ?? 'moyenne'
  const statut = strOrNull(body.statut) ?? 'signale'
  const payload = JSON.stringify({
    chantier_id: chantierId,
    titre,
    gravite,
    statut,
    type_alea: typeAlea,
    date_fin: strOrNull(body.date_fin),
    impact_arret_jours: impact,
    imputabilite,
    client_ref: clientRef,
  })

  // Transaction unique : écriture métier + outbox (règle du plan §6.1).
  await dbExecBatch([
    {
      sql: `INSERT INTO incidents (
        chantier_id, declare_par, titre, description, type_alea, date_fin,
        gravite, statut, impact_arret_jours, imputabilite,
        is_deleted, created_at, updated_at,
        sync_version, client_ref, client_ts
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 1, ?, ?)`,
      args: [
        chantierId,
        currentUserId(),
        titre,
        strOrNull(body.description),
        typeAlea,
        strOrNull(body.date_fin),
        gravite,
        statut,
        impact,
        imputabilite,
        horodatage,
        horodatage,
        clientRef,
        horodatage,
      ],
    },
    ligneOutbox('incident', clientRef, 'create', payload, horodatage),
  ])
  // NB : l'alerte automatique « aléa critique » du backend est best-effort et
  // nécessite l'id post-insert ; non créée ici — PHASE 4B (voir rapport).
  const idRows = await dbQuery('SELECT id FROM incidents WHERE client_ref = ? LIMIT 1', [clientRef])
  return { id: int(idRows[0]?.id, 0), message: 'Incident ajouté' }
}

/** GET chantiers/{id}/affectations — réplique `list_affectations_chantier` (liste bare). */
async function listAffectationsLocal(req: LocalRequest): Promise<unknown> {
  const chantierId = int(req.pathParams[0], 0)
  await chargerChantier(chantierId)
  const rows = await dbQuery(
    `SELECT id, employe_id, chantier_id, date_debut, date_fin, role, is_deleted, created_at, updated_at
     FROM affectation_chantiers WHERE chantier_id = ? AND is_deleted = 0 ORDER BY id ASC`,
    [chantierId],
  )
  return rows.map(serializerAffectation)
}

/** POST chantiers/{id}/affectations — réplique `create_affectation_chantier` (201). */
async function createAffectationLocal(req: LocalRequest): Promise<unknown> {
  const chantierId = int(req.pathParams[0], 0)
  await chargerChantier(chantierId)
  const body = req.data
  const employeId = intOrNull(body.employe_id)
  if (employeId === null || employeId < 1) {
    throw localError(422, 'employe_id : champ obligatoire (valeur ≥ 1 attendue).')
  }

  const horodatage = horodatageLocal()
  // PHASE 4B : sync de cette entité à brancher. (affectation = hors entités canoniques)
  const resultat = await dbExecBatch([
    {
      sql: `INSERT INTO affectation_chantiers (
        employe_id, chantier_id, date_debut, date_fin, role,
        is_deleted, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
      args: [
        employeId,
        chantierId,
        strOrNull(body.date_debut),
        strOrNull(body.date_fin),
        strOrNull(body.role),
        horodatage,
        horodatage,
      ],
    },
  ])
  const id = int(resultat.last_id, 0)
  return serializerAffectation({
    id,
    employe_id: employeId,
    chantier_id: chantierId,
    date_debut: strOrNull(body.date_debut),
    date_fin: strOrNull(body.date_fin),
    role: strOrNull(body.role),
    is_deleted: 0,
    created_at: horodatage,
    updated_at: horodatage,
  })
}

/** DELETE chantiers/{id}/affectations/{affId} — réplique `delete_affectation_chantier` (204). */
async function deleteAffectationLocal(req: LocalRequest): Promise<unknown> {
  const chantierId = int(req.pathParams[0], 0)
  const affId = int(req.pathParams[1], 0)
  await chargerChantier(chantierId)

  const rows = await dbQuery(
    `SELECT id FROM affectation_chantiers WHERE id = ? AND chantier_id = ? AND is_deleted = 0`,
    [affId, chantierId],
  )
  if (!rows[0]) {
    throw localError(404, 'Affectation non trouvée')
  }

  const horodatage = horodatageLocal()
  // PHASE 4B : sync de cette entité à brancher. (affectation = hors entités canoniques)
  await dbExecBatch([
    {
      sql: 'UPDATE affectation_chantiers SET is_deleted = 1, updated_at = ? WHERE id = ?',
      args: [horodatage, affId],
    },
  ])
  return null // 204 No Content
}

/** GET chantiers/{id}/rapports — réplique `list_rapports_chantier` → `{items}`. */
async function listRapportsLocal(req: LocalRequest): Promise<unknown> {
  const chantierId = int(req.pathParams[0], 0)
  await chargerChantier(chantierId)
  const rows = await dbQuery(
    `SELECT * FROM rapports_journaliers WHERE chantier_id = ? AND is_deleted = 0
     ORDER BY date_rapport DESC`,
    [chantierId],
  )
  return { items: rows.map((r) => serializerBooleens(r, ['is_deleted'])) }
}

/** POST chantiers/{id}/rapports — réplique `create_rapport_chantier` (201). */
async function createRapportLocal(req: LocalRequest): Promise<unknown> {
  const chantierId = int(req.pathParams[0], 0)
  const chantier = await chargerChantier(chantierId)
  const body = req.data

  const horodatage = horodatageLocal()
  const dateRapport = strOrNull(body.date_rapport) ?? dateLocale()
  // PHASE 4B : sync de cette entité à brancher. (rapport journalier = hors entités canoniques)
  const resultat = await dbExecBatch([
    {
      sql: `INSERT INTO rapports_journaliers (
        entreprise_id, chantier_id, employe_id, date_rapport, travaux_realises,
        quantites, personnel_present, materiel_utilise, materiaux_utilises,
        incidents, difficultes, observations, is_deleted, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      args: [
        intOrNull(chantier.entreprise_id),
        chantierId,
        currentUserId(),
        dateRapport,
        strOrNull(body.travaux_realises),
        strOrNull(body.quantites),
        strOrNull(body.personnel_present),
        strOrNull(body.materiel_utilise),
        strOrNull(body.materiaux_utilises),
        strOrNull(body.incidents),
        strOrNull(body.difficultes),
        strOrNull(body.observations),
        horodatage,
        horodatage,
      ],
    },
  ])
  const id = int(resultat.last_id, 0)
  const rows = await dbQuery('SELECT * FROM rapports_journaliers WHERE id = ?', [id])
  return {
    id,
    message: 'Rapport journalier enregistré',
    rapport: rows[0] ? serializerBooleens(rows[0], ['is_deleted']) : null,
  }
}

// ---------------------------------------------------------------------------
// Transformation de projet + aléas climatiques (chants / RisquesClimatiques)
// ---------------------------------------------------------------------------

/** GET chantiers/projets-transformables — réplique `list_projets_transformables` → `{items, total}`. */
async function listProjetsTransformablesLocal(): Promise<unknown> {
  const clauses: string[] = ['projets.is_deleted = 0', 'contrats.is_deleted = 0']
  const args: JsonValue[] = []
  const entrepriseId = currentEntrepriseId()
  if (entrepriseId !== null) {
    clauses.push('projets.entreprise_id = ?')
    args.push(entrepriseId)
  }
  const lignes = await dbQueryOptionnel(
    `SELECT projets.id AS projet_id, projets.reference, projets.nom, projets.client_id,
            projets.localisation, contrats.montant, contrats.reference AS contrat_reference
     FROM projets
     JOIN devis ON devis.projet_id = projets.id
     JOIN contrats ON contrats.devis_id = devis.id
     WHERE ${clauses.join(' AND ')}
       AND contrats.statut NOT IN ('annule', 'resilie')
     ORDER BY projets.id DESC`,
    args,
  )
  const liees = await dbQuery(
    'SELECT projet_id FROM chantiers WHERE projet_id IS NOT NULL AND is_deleted = 0',
  )
  const exclus = new Set(liees.map((r) => int(r.projet_id, 0)))

  const items = lignes
    .filter((l) => !exclus.has(int(l.projet_id, 0)))
    .map((l) => {
      const brut = floatOrNull(l.montant)
      return {
        projet_id: int(l.projet_id, 0),
        reference: strOrNull(l.reference),
        nom: str(l.nom),
        client_id: intOrNull(l.client_id),
        localisation: strOrNull(l.localisation),
        montant_contrat: brut ?? 0,
        contrat_reference: strOrNull(l.contrat_reference),
      }
    })
  return { items, total: items.length }
}

/** POST chantiers/from-projet/{projet_id} — réplique `create_chantier_from_projet` (201), outbox `chantier`. */
async function createChantierFromProjetLocal(req: LocalRequest): Promise<unknown> {
  const projetId = int(req.pathParams[0], 0)
  const entrepriseId = currentEntrepriseId()

  const projets = await dbQueryOptionnel(
    `SELECT id, reference, nom, client_id, localisation, adresse, entreprise_id
     FROM projets WHERE id = ? AND is_deleted = 0`,
    [projetId],
  )
  const projet = projets[0]
  if (!projet) {
    throw localError(404, 'Projet non trouvé')
  }
  if (entrepriseId !== null && int(projet.entreprise_id, -1) !== entrepriseId) {
    throw localError(403, 'Accès refusé')
  }

  const contrats = await dbQueryOptionnel(
    `SELECT contrats.montant, contrats.reference
     FROM devis
     JOIN contrats ON contrats.devis_id = devis.id
     WHERE devis.projet_id = ? AND contrats.is_deleted = 0
       AND contrats.statut NOT IN ('annule', 'resilie')
     ORDER BY contrats.id DESC LIMIT 1`,
    [projetId],
  )
  const contrat = contrats[0]
  if (!contrat) {
    throw localError(400, "Aucun contrat actif lie a ce projet. Le devis doit d'abord etre accepte puis transforme en contrat.")
  }

  const existants = await dbQuery(
    'SELECT numero, nom FROM chantiers WHERE projet_id = ? AND is_deleted = 0 LIMIT 1',
    [projetId],
  )
  if (existants[0]) {
    throw localError(409, `Un chantier (${str(existants[0].numero) || str(existants[0].nom)}) est deja lie a ce projet`)
  }

  // Numero auto : CHANT-<annee>-<seq> unique
  const annee = new Date().getFullYear()
  let numero = ''
  for (let seq = 1; seq <= 9999; seq += 1) {
    const candidat = `CHANT-${annee}-${String(seq).padStart(4, '0')}`
    const prises = await dbQuery('SELECT id FROM chantiers WHERE numero = ? LIMIT 1', [candidat])
    if (!prises[0]) {
      numero = candidat
      break
    }
  }
  if (!numero) {
    throw localError(500, 'Impossible de generer un numero de chantier')
  }

  const montant = floatOrNull(contrat.montant) ?? 0
  const maintenant = new Date()
  const horodatage = horodatageLocal(maintenant)
  const clientRef = uuid()
  const description = `Chantier issu du projet ${strOrNull(projet.reference) ?? projet.id} (contrat ${str(contrat.reference)})`
  const valeurs: JsonValue[] = [
    intOrNull(projet.entreprise_id) ?? entrepriseId,
    intOrNull(projet.client_id),
    null,
    intOrNull(projet.id),
    numero,
    str(projet.nom),
    strOrNull(projet.adresse),
    null, // code_postal
    null, // ville
    null, // date_debut
    null, // date_fin_prevue
    null, // date_fin_reelle
    montant,
    montant,
    0,
    0,
    20,
    'planification',
    description,
    null, // region
    0,
    horodatage,
    horodatage,
  ]
  const payload = JSON.stringify({
    entreprise_id: valeurs[0],
    projet_id: valeurs[3],
    numero,
    nom: str(projet.nom),
    statut: 'planification',
    client_ref: clientRef,
  })

  await dbExecBatch([
    {
      sql: `INSERT INTO chantiers (
        entreprise_id, client_id, chef_chantier_id, projet_id, numero, nom,
        adresse, code_postal, ville, date_debut, date_fin_prevue, date_fin_reelle,
        budget_prevu, budget_previsionnel, budget_reel, marge_cible, tva,
        statut, description, region, is_deleted, created_at, updated_at,
        sync_version, client_ref, client_ts
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      args: [...valeurs, clientRef, horodatage],
    },
    ligneOutbox('chantier', clientRef, 'create', payload, horodatage),
  ])

  const idRows = await dbQuery('SELECT id FROM chantiers WHERE client_ref = ? LIMIT 1', [clientRef])
  const rows = await dbQuery(
    `SELECT ${CHANTIER_COLS.join(', ')} FROM chantiers WHERE id = ?`,
    [int(idRows[0]?.id, 0)],
  )
  return serializerChantier(rows[0] ?? { id: idRows[0]?.id ?? 0 })
}

/** GET aleas-climatiques/periodes-risque — réplique `list_periodes_risque` (liste bare). */
async function listPeriodesRisqueLocal(req: LocalRequest): Promise<unknown> {
  const { clauses, args } = clausesTenant()
  const region = strOrNull(req.params.region)
  if (region) {
    clauses.push('region = ?')
    args.push(region)
  }
  const typeRisque = strOrNull(req.params.type_risque)
  if (typeRisque) {
    clauses.push('type_risque = ?')
    args.push(typeRisque)
  }
  const rows = await dbQuery(
    `SELECT * FROM periodes_risque_climatique WHERE ${clauses.join(' AND ')}
     ORDER BY date_debut ASC`,
    args,
  )
  return rows.map(serializerPeriode)
}

/** Validation commune create/update d'une période à risque (schémas Pydantic). */
function validerPeriodeRisque(
  body: Record<string, unknown>,
  existante?: LocalRow,
): { dateDebut: string; dateFin: string } {
  const dateDebut = 'date_debut' in body ? strOrNull(body.date_debut) : strOrNull(existante?.date_debut)
  const dateFin = 'date_fin' in body ? strOrNull(body.date_fin) : strOrNull(existante?.date_fin)
  if (!('date_debut' in body) && !existante) {
    if (!dateDebut) throw localError(422, 'date_debut : champ obligatoire.')
  }
  if (!dateDebut) {
    throw localError(422, 'date_debut : champ obligatoire.')
  }
  if (!dateFin) {
    throw localError(422, 'date_fin : champ obligatoire.')
  }
  if (dateFin < dateDebut) {
    throw localError(422, 'La date de fin doit être postérieure ou égale à la date de début')
  }
  return { dateDebut, dateFin }
}

/** POST aleas-climatiques/periodes-risque — réplique `create_periode_risque` (201). */
async function createPeriodeRisqueLocal(req: LocalRequest): Promise<unknown> {
  const body = req.data
  const entrepriseId = currentEntrepriseId()
  if (entrepriseId === null) {
    throw localError(400, 'Entreprise introuvable')
  }
  const region = str(body.region).trim()
  if (!region) {
    throw localError(422, 'region : champ obligatoire.')
  }
  const typeRisque = str(body.type_risque)
  if (!TYPES_RISQUE.includes(typeRisque)) {
    throw localError(422, `Type de risque invalide. Valeurs autorisées: ${listePython(TYPES_RISQUE)}`)
  }
  const { dateDebut, dateFin } = validerPeriodeRisque(body)

  const horodatage = horodatageLocal()
  // PHASE 4B : sync de cette entité à brancher. (période de risque = hors entités canoniques)
  const resultat = await dbExecBatch([
    {
      sql: `INSERT INTO periodes_risque_climatique (
        entreprise_id, region, type_risque, date_debut, date_fin, description,
        is_deleted, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      args: [
        entrepriseId,
        region,
        typeRisque,
        dateDebut,
        dateFin,
        strOrNull(body.description),
        horodatage,
        horodatage,
      ],
    },
  ])
  return { id: int(resultat.last_id, 0), message: 'Période à risque créée' }
}

/** Charge une période à risque (404 / 403 tenant), réplique des route PUT/DELETE. */
async function chargerPeriodeRisque(id: number): Promise<LocalRow> {
  const rows = await dbQuery(
    'SELECT * FROM periodes_risque_climatique WHERE id = ? AND is_deleted = 0',
    [id],
  )
  const periode = rows[0]
  if (!periode) {
    throw localError(404, 'Période à risque non trouvée')
  }
  const entrepriseId = currentEntrepriseId()
  if (entrepriseId !== null && int(periode.entreprise_id, -1) !== entrepriseId) {
    throw localError(403, 'Accès refusé')
  }
  return periode
}

/** PUT aleas-climatiques/periodes-risque/{id} — réplique `update_periode_risque`. */
async function updatePeriodeRisqueLocal(req: LocalRequest): Promise<unknown> {
  const id = int(req.pathParams[0], 0)
  const periode = await chargerPeriodeRisque(id)
  const body = req.data

  const typeRisque = 'type_risque' in body ? strOrNull(body.type_risque) : null
  if (typeRisque !== null && !TYPES_RISQUE.includes(typeRisque)) {
    throw localError(422, `Type de risque invalide. Valeurs autorisées: ${listePython(TYPES_RISQUE)}`)
  }
  if ('region' in body && body.region !== null && String(body.region).trim() === '') {
    throw localError(422, 'region : champ obligatoire.')
  }
  const { dateDebut, dateFin } = validerPeriodeRisque(body, periode)

  const sets: string[] = []
  const args: JsonValue[] = []
  if ('region' in body) {
    sets.push('region = ?')
    args.push(str(body.region))
  }
  if (typeRisque !== null) {
    sets.push('type_risque = ?')
    args.push(typeRisque)
  }
  if ('date_debut' in body) {
    sets.push('date_debut = ?')
    args.push(dateDebut)
  }
  if ('date_fin' in body) {
    sets.push('date_fin = ?')
    args.push(dateFin)
  }
  if ('description' in body) {
    sets.push('description = ?')
    args.push(strOrNull(body.description))
  }

  if (sets.length > 0) {
    const horodatage = horodatageLocal()
    // PHASE 4B : sync de cette entité à brancher. (période de risque = hors entités canoniques)
    await dbExecBatch([
      {
        sql: `UPDATE periodes_risque_climatique SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`,
        args: [...args, horodatage, id],
      },
    ])
  }
  return { id, message: 'Période à risque mise à jour' }
}

/** DELETE aleas-climatiques/periodes-risque/{id} — réplique `delete_periode_risque` (204). */
async function deletePeriodeRisqueLocal(req: LocalRequest): Promise<unknown> {
  const id = int(req.pathParams[0], 0)
  await chargerPeriodeRisque(id)
  const horodatage = horodatageLocal()
  // PHASE 4B : sync de cette entité à brancher. (période de risque = hors entités canoniques)
  await dbExecBatch([
    {
      sql: 'UPDATE periodes_risque_climatique SET is_deleted = 1, updated_at = ? WHERE id = ?',
      args: [horodatage, id],
    },
  ])
  return null // 204 No Content
}

/** GET aleas-climatiques/impact — réplique `get_impact_climatique` (ImpactClimatiqueResponse). */
async function getImpactClimatiqueLocal(req: LocalRequest): Promise<unknown> {
  const chantierId = int(req.params.chantier_id, 0)
  if (chantierId < 1) {
    throw localError(422, 'chantier_id : paramètre obligatoire.')
  }
  const chantier = await chargerChantier(chantierId)

  const aleasRows = await dbQueryOptionnel(
    `SELECT id, titre, type_alea, date_incident, date_fin, impact_arret_jours,
            imputabilite, gravite, statut, is_deleted
     FROM incidents
     WHERE chantier_id = ? AND type_alea IS NOT NULL AND is_deleted = 0
     ORDER BY date_incident ASC`,
    [chantierId],
  )
  const aujourdhui = dateLocale()
  const impact = calculerImpact(
    aleasRows,
    chantier.date_fin_prevue,
    chantier.date_fin_reelle,
    aujourdhui,
  )

  let periodes: LocalRow[] | null = null
  const region = strOrNull(chantier.region)
  if (region) {
    const rows = await dbQueryOptionnel(
      `SELECT * FROM periodes_risque_climatique
       WHERE entreprise_id = ? AND region = ? AND is_deleted = 0 AND date_fin >= ?`,
      [intOrNull(chantier.entreprise_id), region, aujourdhui],
    )
    periodes = rows.map(serializerPeriode)
  }

  return {
    chantier_id: chantierId,
    region,
    ...impact,
    aleas: aleasRows.map((a) => ({
      id: int(a.id, 0),
      titre: str(a.titre),
      type_alea: strOrNull(a.type_alea),
      date_incident: str(a.date_incident),
      date_fin: strOrNull(a.date_fin),
      impact_arret_jours: intOrNull(a.impact_arret_jours),
      imputabilite: strOrNull(a.imputabilite),
      gravite: str(a.gravite),
      statut: str(a.statut),
    })),
    periodes_risque_actives: periodes,
  }
}

// ---------------------------------------------------------------------------
// Enregistrement des routes (registre partagé `local/registry.ts`)
// ---------------------------------------------------------------------------

registerLocalRoutes(
  {
    // NB : `GET chantiers` et `GET chantiers/{id}` sont servis par desktopClient.ts.
    'POST chantiers': createChantierLocal,
    'GET chantiers/projets-transformables': listProjetsTransformablesLocal,
    'GET aleas-climatiques/periodes-risque': listPeriodesRisqueLocal,
    'POST aleas-climatiques/periodes-risque': createPeriodeRisqueLocal,
    'GET aleas-climatiques/impact': getImpactClimatiqueLocal,
  },
  {
    'POST chantiers': 201,
    'POST aleas-climatiques/periodes-risque': 201,
  },
)

registerLocalPattern(/^PUT chantiers\/(\d+)$/, updateChantierLocal)
registerLocalPattern(/^DELETE chantiers\/(\d+)$/, deleteChantierLocal, 204)
registerLocalPattern(/^PUT chantiers\/(\d+)\/statut$/, updateChantierStatutLocal)
registerLocalPattern(/^POST chantiers\/(\d+)\/phases$/, addPhaseLocal, 201)
registerLocalPattern(/^POST chantiers\/(\d+)\/incidents$/, addIncidentLocal, 201)
registerLocalPattern(/^GET chantiers\/(\d+)\/affectations$/, listAffectationsLocal)
registerLocalPattern(/^POST chantiers\/(\d+)\/affectations$/, createAffectationLocal, 201)
registerLocalPattern(/^DELETE chantiers\/(\d+)\/affectations\/(\d+)$/, deleteAffectationLocal, 204)
registerLocalPattern(/^GET chantiers\/(\d+)\/rapports$/, listRapportsLocal)
registerLocalPattern(/^POST chantiers\/(\d+)\/rapports$/, createRapportLocal, 201)
registerLocalPattern(/^POST chantiers\/from-projet\/(\d+)$/, createChantierFromProjetLocal, 201)
registerLocalPattern(/^PUT aleas-climatiques\/periodes-risque\/(\d+)$/, updatePeriodeRisqueLocal)
registerLocalPattern(/^DELETE aleas-climatiques\/periodes-risque\/(\d+)$/, deletePeriodeRisqueLocal, 204)
