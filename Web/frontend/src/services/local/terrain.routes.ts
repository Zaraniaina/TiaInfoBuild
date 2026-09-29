/**
 * Routes locales — Espace terrain employé (hors-ligne, Phase 4).
 *
 * Répliques SQLite des endpoints `app/routers/employe_terrain.py` utiles
 * hors-ligne et porteurs de l'entité canonique `tache` :
 *
 *   - `GET employe-terrain/taches`            → `get_mes_taches`
 *     (`{items: [...]}`, tâches non supprimées de la fiche employé,
 *     ordonnées par `date_prevue`) ;
 *   - `POST employe-terrain/taches/{id}/statut` → `changer_statut_tache` :
 *     écriture ATOMIQUE (métier + ligne `_sync_outbox` dans une seule
 *     `dbExecBatch`, règle plan §6.1) pour l'entité canonique `tache`,
 *     opération `update`, `client_ref` conservé s'il existe déjà (sinon
 *     UUID), `sync_version` incrémentée.
 *
 * Perimètre volontairement étroit : les autres appels de
 * `employeTerrain.service.ts` (dashboard, planning, travaux réalisés,
 * rapports, photos, signalements, notifications, profil, documents,
 * congés terrain…) restent en PHASE 4B — non servis localement,
 * relais online via `handleLocalRequest`.
 *
 * Comme pour les autres modules locaux, aucune permission métier
 * (`employe_terrain:read`, `taches:write`) n'est rejouée côté desktop :
 * la résolution de la fiche employé par l'email du compte connecté suffit
 * à garantir la propriété de la tâche (identique à `_get_employe`).
 */
import { registerLocalPattern, registerLocalRoutes, type LocalRequest } from './registry'
import {
  boolSql,
  currentUser,
  dbExecBatch,
  dbQuery,
  horodatageLocal,
  int,
  localError,
  serializerBooleens,
  str,
  strOrNull,
  uuid,
  type LocalRow,
} from './helpers'

/** Enum `Tache.statut` (identique au contrôle `allowed` de FastAPI). */
const STATUTS_TACHE = ['a_faire', 'en_cours', 'terminee', 'bloquee']

/**
 * Résout la fiche employé du compte connecté (par email) — réplique de
 * `_get_employe` (employe_terrain.py) et de `resoudreEmployeLocal`
 * (desktopClient.ts, routes pointages déjà historiques).
 */
async function resoudreEmploye(): Promise<LocalRow> {
  const email = str(currentUser()?.email).trim().toLowerCase()
  if (!email) {
    throw localError(404, 'Aucune fiche employe rattachee a votre compte')
  }
  const rows = await dbQuery(
    `SELECT id, nom, prenom FROM employes
     WHERE lower(email) = ? AND is_deleted = 0 LIMIT 1`,
    [email],
  )
  if (!rows[0]) {
    throw localError(404, 'Aucune fiche employe rattachee a votre compte. Contactez votre administrateur.')
  }
  return rows[0]
}

/** GET employe-terrain/taches — mes tâches (réplique `get_mes_taches`). */
async function mesTachesLocal(): Promise<unknown> {
  const employe = await resoudreEmploye()
  const rows = await dbQuery(
    `SELECT * FROM taches
     WHERE employe_id = ? AND is_deleted = 0
     ORDER BY date_prevue ASC`,
    [int(employe.id, 0)],
  )
  return { items: rows.map((r) => serializerBooleens(r, ['is_deleted'])) }
}

/**
 * POST employe-terrain/taches/{id}/statut — changement de statut
 * (réplique `changer_statut_tache`). Écriture locale + outbox `tache`
 * dans UNE transaction (`dbExecBatch`), règle plan §6.1.
 */
async function changerStatutTacheLocal(req: LocalRequest): Promise<unknown> {
  const body = req.data
  // 1. Corps (pydantic valide le body AVANT que l'endpoint ne s'exécute).
  if (!('statut' in body) || body.statut === null || body.statut === undefined) {
    throw localError(422, 'statut : champ obligatoire.')
  }
  const statut = str(body.statut)
  // 2. Fiche employé du compte connecté (`_get_employe`).
  const employe = await resoudreEmploye()
  // 3. Lookup + propriété (`not tache or tache.employe_id != employe.id` → 404).
  const id = int(req.pathParams[0], 0)
  const rows = await dbQuery('SELECT * FROM taches WHERE id = ? LIMIT 1', [id])
  const tache = rows[0]
  if (!tache || boolSql(tache.is_deleted) || int(tache.employe_id, 0) !== int(employe.id, 0)) {
    throw localError(404, 'Tache introuvable')
  }
  // 4. Enum (`Statut invalide…` → 400, après lookup comme FastAPI).
  if (!STATUTS_TACHE.includes(statut)) {
    throw localError(400, `Statut invalide. Valeurs autorisées : ${STATUTS_TACHE.join(', ')}.`)
  }
  const maintenant = horodatageLocal()
  const clientRef = strOrNull(tache.client_ref) ?? uuid()
  const payload = JSON.stringify({ id, statut, client_ref: clientRef })

  await dbExecBatch([
    {
      sql: `UPDATE taches
            SET statut = ?, updated_at = ?, client_ref = ?,
                sync_version = COALESCE(sync_version, 0) + 1
            WHERE id = ?`,
      args: [statut, maintenant, clientRef, id],
    },
    {
      sql: `INSERT INTO _sync_outbox (entity, entity_id, op, payload, client_ts, pushed)
            VALUES (?, ?, ?, ?, ?, 0)`,
      args: ['tache', clientRef, 'update', payload, maintenant],
    },
  ])

  const maj = await dbQuery('SELECT * FROM taches WHERE id = ? LIMIT 1', [id])
  return {
    message: `Statut mis a jour: ${statut}`,
    tache: serializerBooleens(maj[0] ?? { ...tache, statut }, ['is_deleted']),
  }
}

registerLocalRoutes({
  'GET employe-terrain/taches': mesTachesLocal,
})

registerLocalPattern(/^POST employe-terrain\/taches\/(\d+)\/statut$/, changerStatutTacheLocal)
