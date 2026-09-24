/**
 * Routes locales desktop — MODULE MATÉRIELS (parc, maintenances, affectations
 * — Phase 4). Voir l'en-tête de `stocks.routes.ts` pour le contrat commun.
 * Chemins exacts : `Web/frontend/src/services/materiels.service.ts`,
 * `aleasClimatiques.service.ts`.
 *
 * Écritures : UNE SEULE `dbExecBatch` par mutation (écriture métier + ligne
 * `_sync_outbox`) pour les entités canoniques `materiel` et `maintenance`.
 * Les mouvements (`mouvements_materiel`) et les périodes de risque sont
 * écrits SANS outbox (PHASE 4B, commentaires dédiés).
 * Laissés en relais réseau (non enregistrés ici) : les uploads/suppressions
 * photo, manuel et VGP (FormData binaires non jouables depuis SQLite).
 */
import { registerLocalPattern, registerLocalRoutes, type LocalRequest } from './registry'
import {
  boolSql,
  clausesTenant,
  currentEntrepriseId,
  dateLocale,
  dbExecBatch,
  dbQuery,
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

/** Statuts matière — `MaterielUpdate.validate_statut` (déjà triés). */
const STATUTS_MATERIEL = ['disponible', 'en_maintenance', 'en_panne', 'en_utilisation', 'hors_service', 'perdu']

/** Types de risque — `PeriodeRisqueRisqueCreate.validate_type_risque` (triés). */
const TYPES_RISQUE = [
  'autre',
  'coupure_electricite',
  'cyclone',
  'inondation',
  'pluies_intenses',
  'route_coupee',
  'secheresse',
]

/** Colonnes texte/numériques acceptées par `PUT materiels/{id}` (MaterielUpdate). */
const COLONNES_MAJ_MATERIEL = new Set([
  'nom',
  'designation',
  'type',
  'marque',
  'modele',
  'numero_serie',
  'date_acquisition',
  'valeur_achat',
  'description',
  'photo_url',
  'manuel_url',
  'normes',
  'statut',
  'categorie_btp',
  'immatriculation',
  'heures_moteur',
  'kilometrage',
  'frequence_entretien_heures',
  'statut_vgp',
  'date_derniere_vgp',
  'date_prochaine_vgp',
  'organisme_vgp',
  'certificat_vgp_url',
  'qr_code_key',
])
const COLONNES_DATE_MAJ = new Set(['date_acquisition', 'date_derniere_vgp', 'date_prochaine_vgp'])
const COLONNES_NOMBRE_MAJ = new Set([
  'valeur_achat',
  'heures_moteur',
  'kilometrage',
  'frequence_entretien_heures',
])

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

/** Validation de champ date (`date` pydantic) → `null` si absent. */
function dateValide(cle: string, valeur: unknown): string | null {
  if (valeur === undefined || valeur === null) return null
  const s = str(valeur)
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) {
    throw localError(422, `${cle} : format AAAA-MM-JJ attendu.`)
  }
  return s.substring(0, 10)
}

/** Validation `ge=0` (float) → `null` si absent ; message métier dédié si fourni. */
function valeurPositive(cle: string, valeur: unknown, messageNegatif?: string): number | null {
  if (valeur === undefined || valeur === null) return null
  const n = floatOrNull(valeur)
  if (n === null) {
    throw localError(422, `${cle} : nombre attendu.`)
  }
  if (n < 0) {
    throw localError(422, messageNegatif ?? `${cle} : la valeur doit être supérieure ou égale à 0.`)
  }
  return n
}

/** Validation du champ `statut` matière (jeté si la valeur est hors liste). */
function validerStatutMateriel(valeur: unknown): string {
  const s = str(valeur)
  if (!STATUTS_MATERIEL.includes(s)) {
    const liste = STATUTS_MATERIEL.map((v) => `'${v}'`).join(', ')
    throw localError(422, `Statut invalide. Valeurs autorisées: {${liste}}`)
  }
  return s
}

/** `MaterielList` — sous-ensemble de champs renvoyé par la liste. */
function materielListe(r: LocalRow): LocalRow {
  return {
    id: int(r.id, 0),
    entreprise_id: intOrNull(r.entreprise_id),
    nom: str(r.nom),
    type: strOrNull(r.type),
    marque: strOrNull(r.marque),
    numero_serie: strOrNull(r.numero_serie),
    date_acquisition: jour(r.date_acquisition),
    valeur_achat: floatOrNull(r.valeur_achat),
    statut: strOrNull(r.statut),
    photo_url: strOrNull(r.photo_url),
    categorie_btp: strOrNull(r.categorie_btp),
    statut_vgp: strOrNull(r.statut_vgp),
    heures_moteur: floatOrNull(r.heures_moteur),
    date_prochaine_vgp: jour(r.date_prochaine_vgp),
    is_deleted: boolSql(r.is_deleted),
    created_at: iso(r.created_at),
  }
}

/** `MaintenanceResponse` (schéma `materiel.py`). */
function maintenanceResponse(r: LocalRow): LocalRow {
  return {
    id: int(r.id, 0),
    entreprise_id: intOrNull(r.entreprise_id),
    materiel_id: intOrNull(r.materiel_id),
    date_maintenance: jour(r.date_maintenance),
    type: strOrNull(r.type),
    cout: floatOrNull(r.cout),
    description: strOrNull(r.description),
    prochaine_date_echeance: jour(r.prochaine_date_echeance),
    technicien: strOrNull(r.technicien),
    is_deleted: boolSql(r.is_deleted),
    created_at: iso(r.created_at),
    updated_at: iso(r.updated_at),
  }
}

/** `MouvementMaterielResponse` (schéma `materiel.py`). */
function mouvementResponse(r: LocalRow): LocalRow {
  return {
    id: int(r.id, 0),
    entreprise_id: intOrNull(r.entreprise_id),
    materiel_id: intOrNull(r.materiel_id),
    chantier_origine_id: intOrNull(r.chantier_origine_id),
    chantier_destination_id: intOrNull(r.chantier_destination_id),
    date_depart: iso(r.date_depart),
    date_reception: iso(r.date_reception),
    transporteur: strOrNull(r.transporteur),
    statut: str(r.statut),
    notes: strOrNull(r.notes),
    created_at: iso(r.created_at),
  }
}

/** Charge la ligne brute matière (tenant + `is_deleted = 0` via `clausesTenant`). */
async function chargerMateriel(id: number): Promise<LocalRow | undefined> {
  const { clauses, args } = clausesTenant()
  const rows = await dbQuery(
    `SELECT * FROM materiaux WHERE id = ? AND ${clauses.join(' AND ')}`,
    [id, ...args],
  )
  return rows[0]
}

/** Relations `maintenances` / `mouvements` — comme le backend, non filtrées côté `is_deleted`. */
async function relationsMateriel(id: number): Promise<{ maintenances: LocalRow[]; mouvements: LocalRow[] }> {
  const [maintenances, mouvements] = await Promise.all([
    dbQuery('SELECT * FROM maintenances WHERE materiel_id = ? ORDER BY id', [id]),
    dbQuery('SELECT * FROM mouvements_materiel WHERE materiel_id = ? ORDER BY id', [id]),
  ])
  return { maintenances, mouvements }
}

/** `MaterielResponse` complet (+ relations). */
async function materielComplet(id: number): Promise<LocalRow | null> {
  const ligne = await chargerMateriel(id)
  if (!ligne) return null
  const { maintenances, mouvements } = await relationsMateriel(id)
  return {
    id: int(ligne.id, 0),
    entreprise_id: intOrNull(ligne.entreprise_id),
    nom: str(ligne.nom),
    designation: strOrNull(ligne.designation),
    type: strOrNull(ligne.type),
    marque: strOrNull(ligne.marque),
    modele: strOrNull(ligne.modele),
    numero_serie: strOrNull(ligne.numero_serie),
    date_acquisition: jour(ligne.date_acquisition),
    valeur_achat: floatOrNull(ligne.valeur_achat),
    description: strOrNull(ligne.description),
    photo_url: strOrNull(ligne.photo_url),
    manuel_url: strOrNull(ligne.manuel_url),
    normes: strOrNull(ligne.normes),
    statut: strOrNull(ligne.statut),
    categorie_btp: strOrNull(ligne.categorie_btp),
    immatriculation: strOrNull(ligne.immatriculation),
    heures_moteur: floatOrNull(ligne.heures_moteur),
    kilometrage: floatOrNull(ligne.kilometrage),
    frequence_entretien_heures: floatOrNull(ligne.frequence_entretien_heures),
    statut_vgp: strOrNull(ligne.statut_vgp),
    date_derniere_vgp: jour(ligne.date_derniere_vgp),
    date_prochaine_vgp: jour(ligne.date_prochaine_vgp),
    organisme_vgp: strOrNull(ligne.organisme_vgp),
    certificat_vgp_url: strOrNull(ligne.certificat_vgp_url),
    qr_code_key: strOrNull(ligne.qr_code_key),
    is_deleted: boolSql(ligne.is_deleted),
    created_at: iso(ligne.created_at),
    updated_at: iso(ligne.updated_at),
    maintenances: maintenances.map(maintenanceResponse),
    mouvements: mouvements.map(mouvementResponse),
  }
}

/** `PeriodeRisqueResponse` (schéma `aleas_climatiques.py`). */
function periodeResponse(r: LocalRow): LocalRow {
  return {
    id: int(r.id, 0),
    entreprise_id: intOrNull(r.entreprise_id),
    region: str(r.region),
    type_risque: str(r.type_risque),
    date_debut: jour(r.date_debut),
    date_fin: jour(r.date_fin),
    description: strOrNull(r.description),
    is_deleted: boolSql(r.is_deleted),
    created_at: iso(r.created_at),
    updated_at: iso(r.updated_at),
  }
}

/** Différence en jours entiers entre deux dates ISO (comme `(fin - debut).days`). */
function joursEntre(debut: string, fin: string): number {
  const d = Date.parse(`${debut.substring(0, 10)}T00:00:00Z`)
  const f = Date.parse(`${fin.substring(0, 10)}T00:00:00Z`)
  if (!Number.isFinite(d) || !Number.isFinite(f)) return 0
  return Math.round((f - d) / 86400000)
}

// ============================================================
// GET / POST /api/materiels
// ============================================================

/** `GET materiels` — liste `MaterielList` (le backend n'honore que type/statut/marque). */
async function listMateriels(req: LocalRequest): Promise<unknown> {
  const { clauses, args } = clausesTenant()
  const p = req.params
  const type = strOrNull(p.type)
  if (type) {
    clauses.push('type = ?')
    args.push(type)
  }
  const statut = strOrNull(p.statut)
  if (statut) {
    clauses.push('statut = ?')
    args.push(statut)
  }
  const marque = strOrNull(p.marque)
  if (marque) {
    clauses.push('marque = ?')
    args.push(marque)
  }
  const skip = Math.max(0, int(p.skip, 0))
  const limit = Math.max(0, int(p.limit, 100))
  const rows = await dbQuery(
    `SELECT * FROM materiaux WHERE ${clauses.join(' AND ')} ORDER BY id LIMIT ? OFFSET ?`,
    [...args, limit, skip],
  )
  return rows.map(materielListe)
}

/** `POST materiels` (201) — écriture locale + outbox `materiel` (create). */
async function createMateriel(req: LocalRequest): Promise<unknown> {
  const body = req.data
  const nom = strOrNull(body.nom)
  if (nom === null) {
    throw localError(422, 'nom : champ obligatoire.')
  }
  if (nom.length === 0) {
    throw localError(422, 'nom : longueur minimale 1 caractère.')
  }
  const statut =
    body.statut === undefined || body.statut === null ? 'disponible' : validerStatutMateriel(body.statut)
  const valeurAchat = valeurPositive('valeur_achat', body.valeur_achat, "La valeur d'achat ne peut pas être négative") ?? 0
  const entrepriseId = currentEntrepriseId()
  if (entrepriseId === null) {
    throw localError(400, 'Entreprise ID manquant dans le token')
  }

  const designation = strOrNull(body.designation)
  const type = strOrNull(body.type)
  const marque = strOrNull(body.marque)
  const modele = strOrNull(body.modele)
  const numeroSerie = strOrNull(body.numero_serie)
  const dateAcquisition = dateValide('date_acquisition', body.date_acquisition)
  const description = strOrNull(body.description)
  const photoUrl = strOrNull(body.photo_url)
  const manuelUrl = strOrNull(body.manuel_url)
  const normes = strOrNull(body.normes)
  const categorieBtp = body.categorie_btp === undefined ? 'engin_lourd' : strOrNull(body.categorie_btp)
  const immatriculation = strOrNull(body.immatriculation)
  const heuresMoteur = valeurPositive('heures_moteur', body.heures_moteur) ?? 0
  const kilometrage = valeurPositive('kilometrage', body.kilometrage) ?? 0
  const frequence = valeurPositive('frequence_entretien_heures', body.frequence_entretien_heures)
  const statutVgp = strOrNull(body.statut_vgp) ?? 'conforme'
  const dateDerniereVgp = dateValide('date_derniere_vgp', body.date_derniere_vgp)
  const dateProchaineVgp = dateValide('date_prochaine_vgp', body.date_prochaine_vgp)
  const organismeVgp = strOrNull(body.organisme_vgp)
  const certificatVgpUrl = strOrNull(body.certificat_vgp_url)
  const qrCodeKey = strOrNull(body.qr_code_key)

  const maintenant = horodatageLocal()
  const clientRef = uuid()
  const payload = JSON.stringify({
    entreprise_id: entrepriseId,
    nom,
    designation,
    type,
    marque,
    modele,
    numero_serie: numeroSerie,
    date_acquisition: dateAcquisition,
    valeur_achat: valeurAchat,
    description,
    statut,
    photo_url: photoUrl,
    manuel_url: manuelUrl,
    normes,
    categorie_btp: categorieBtp,
    immatriculation,
    heures_moteur: heuresMoteur,
    kilometrage,
    frequence_entretien_heures: frequence,
    statut_vgp: statutVgp,
    date_derniere_vgp: dateDerniereVgp,
    date_prochaine_vgp: dateProchaineVgp,
    organisme_vgp: organismeVgp,
    certificat_vgp_url: certificatVgpUrl,
    qr_code_key: qrCodeKey,
    client_ref: clientRef,
  })

  // Transaction unique : écriture métier + outbox (règle du plan §6.1).
  const resultat = await dbExecBatch([
    {
      sql: `INSERT INTO materiaux (
        entreprise_id, nom, designation, type, marque, modele, numero_serie,
        date_acquisition, valeur_achat, description, statut, is_deleted,
        created_at, updated_at, photo_url, manuel_url, normes, categorie_btp,
        immatriculation, heures_moteur, kilometrage, frequence_entretien_heures,
        statut_vgp, date_derniere_vgp, date_prochaine_vgp, organisme_vgp,
        certificat_vgp_url, qr_code_key, sync_version, client_ref
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      args: [
        entrepriseId, nom, designation, type, marque, modele, numeroSerie,
        dateAcquisition, valeurAchat, description, statut, maintenant, maintenant,
        photoUrl, manuelUrl, normes, categorieBtp, immatriculation, heuresMoteur,
        kilometrage, frequence, statutVgp, dateDerniereVgp, dateProchaineVgp,
        organismeVgp, certificatVgpUrl, qrCodeKey, clientRef,
      ],
    },
    {
      sql: `INSERT INTO _sync_outbox (entity, entity_id, op, payload, client_ts, pushed)
            VALUES (?, ?, ?, ?, ?, 0)`,
      args: ['materiel', clientRef, 'create', payload, maintenant],
    },
  ])
  // `last_id` porte sur la dernière ligne insérée (l'outbox) : on retrouve
  // l'id métier via le `client_ref` fraîchement généré.
  const idRows = await dbQuery('SELECT id FROM materiaux WHERE client_ref = ? LIMIT 1', [clientRef])
  const nouveauId = int(idRows[0]?.id, int(resultat.last_id, 0))
  return materielComplet(nouveauId)
}

// ============================================================
// GET / PUT / DELETE /api/materiels/{id}
// ============================================================

/** `GET materiels/{id}` — détail complet avec maintenances et mouvements. */
async function getMateriel(req: LocalRequest): Promise<unknown> {
  const id = int(req.pathParams[0], 0)
  const detail = await materielComplet(id)
  if (!detail) {
    throw localError(404, 'Matériel non trouvé')
  }
  return detail
}

/** `PUT materiels/{id}` — Mise à jour partielle + outbox `materiel` (update). */
async function updateMateriel(req: LocalRequest): Promise<unknown> {
  const id = int(req.pathParams[0], 0)
  const ligne = await chargerMateriel(id)
  if (!ligne) {
    throw localError(404, 'Matériel non trouvé')
  }

  const sets: string[] = []
  const argsSql: JsonValue[] = []
  const payload: Record<string, unknown> = { id }
  for (const [cle, valeur] of Object.entries(req.data)) {
    if (!COLONNES_MAJ_MATERIEL.has(cle)) continue
    if (cle === 'nom') {
      // colonne NOT NULL : une valeur nulle est ignorée (le web ferait un 500).
      if (valeur === null || valeur === undefined) continue
      const nom = str(valeur)
      if (nom.length === 0) {
        throw localError(422, 'nom : longueur minimale 1 caractère.')
      }
      sets.push('nom = ?')
      argsSql.push(nom)
      payload.nom = nom
      continue
    }
    if (cle === 'statut') {
      if (valeur === null || valeur === undefined) continue
      const s = validerStatutMateriel(valeur)
      sets.push('statut = ?')
      argsSql.push(s)
      payload.statut = s
      continue
    }
    if (COLONNES_DATE_MAJ.has(cle)) {
      if (valeur === null) {
        sets.push(`${cle} = NULL`)
        payload[cle] = null
        continue
      }
      const d = dateValide(cle, valeur)
      sets.push(`${cle} = ?`)
      argsSql.push(d)
      payload[cle] = d
      continue
    }
    if (COLONNES_NOMBRE_MAJ.has(cle)) {
      const message = cle === 'valeur_achat' ? "La valeur d'achat ne peut pas être négative" : undefined
      const n = valeurPositive(cle, valeur, message)
      // colonnes NOT NULL : `null` explicite → on conserve la valeur courante.
      if (n === null) continue
      sets.push(`${cle} = ?`)
      argsSql.push(n)
      payload[cle] = n
      continue
    }
    // Champs texte.
    if (valeur === null) {
      sets.push(`${cle} = NULL`)
      payload[cle] = null
      continue
    }
    const s = str(valeur)
    sets.push(`${cle} = ?`)
    argsSql.push(s)
    payload[cle] = s
  }

  if (sets.length > 0) {
    const maintenant = horodatageLocal()
    // Identité de sync : `client_ref` existant ; sinon identifiant numérique.
    // On ne réécrit JAMAIS un UUID neuf dans une ligne existante.
    const clientRef = str(ligne.client_ref) || String(id)
    payload.client_ref = clientRef
    sets.push('updated_at = ?', 'sync_version = COALESCE(sync_version, 0) + 1')
    argsSql.push(maintenant)
    await dbExecBatch([
      {
        sql: `UPDATE materiaux SET ${sets.join(', ')} WHERE id = ?`,
        args: [...argsSql, id],
      },
      {
        sql: `INSERT INTO _sync_outbox (entity, entity_id, op, payload, client_ts, pushed)
              VALUES (?, ?, ?, ?, ?, 0)`,
        args: ['materiel', clientRef, 'update', JSON.stringify(payload), maintenant],
      },
    ])
  }
  return materielComplet(id)
}

/** `DELETE materiels/{id}` (204) — suppression douce + outbox `materiel` (delete). */
async function deleteMateriel(req: LocalRequest): Promise<unknown> {
  const id = int(req.pathParams[0], 0)
  const ligne = await chargerMateriel(id)
  if (!ligne) {
    throw localError(404, 'Matériel non trouvé')
  }
  const maintenant = horodatageLocal()
  const clientRef = str(ligne.client_ref) || String(id)
  const payload = JSON.stringify({ id, is_deleted: true, client_ref: clientRef })
  await dbExecBatch([
    {
      sql: `UPDATE materiaux
            SET is_deleted = 1, updated_at = ?, sync_version = COALESCE(sync_version, 0) + 1
            WHERE id = ?`,
      args: [maintenant, id],
    },
    {
      sql: `INSERT INTO _sync_outbox (entity, entity_id, op, payload, client_ts, pushed)
            VALUES (?, ?, ?, ?, ?, 0)`,
      args: ['materiel', clientRef, 'delete', payload, maintenant],
    },
  ])
  return null
}

// ============================================================
// Maintenances · horamètre · QR code
// ============================================================

/** `GET materiels/maintenances` — historique trié `created_at DESC`. */
async function listMaintenances(req: LocalRequest): Promise<unknown> {
  const { clauses, args } = clausesTenant()
  const materielId = intOrNull(req.params.materiel_id)
  if (materielId) {
    clauses.push('materiel_id = ?')
    args.push(materielId)
  }
  const rows = await dbQuery(
    `SELECT * FROM maintenances WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC`,
    args,
  )
  return rows.map(maintenanceResponse)
}

/** `POST materiels/{id}/maintenance` (201) — maintenance + passage en maintenance (2 écritures, 1 batch). */
async function addMaintenance(req: LocalRequest): Promise<unknown> {
  const id = int(req.pathParams[0], 0)
  const ligneMateriel = await chargerMateriel(id)
  if (!ligneMateriel) {
    throw localError(404, 'Matériel non trouvé')
  }
  const body = req.data
  const dateMaintenance = dateValide('date_maintenance', body.date_maintenance)
  if (dateMaintenance === null) {
    throw localError(422, 'date_maintenance : champ obligatoire (format AAAA-MM-JJ).')
  }
  const cout = valeurPositive('cout', body.cout, 'Le coût ne peut pas être négatif') ?? 0
  const entrepriseId = currentEntrepriseId()
  if (entrepriseId === null) {
    throw localError(400, 'Entreprise ID manquant dans le token')
  }
  const type = strOrNull(body.type)
  const description = strOrNull(body.description)
  const prochaine = dateValide('prochaine_date_echeance', body.prochaine_date_echeance)
  const technicien = strOrNull(body.technicien)

  const maintenant = horodatageLocal()
  const clientRef = uuid()
  const payloadMaintenance = JSON.stringify({
    entreprise_id: entrepriseId,
    materiel_id: id,
    date_maintenance: dateMaintenance,
    type,
    cout,
    description,
    prochaine_date_echeance: prochaine,
    technicien,
    client_ref: clientRef,
  })
  const clientRefMateriel = str(ligneMateriel.client_ref) || String(id)
  const payloadMateriel = JSON.stringify({ id, statut: 'en_maintenance', client_ref: clientRefMateriel })

  // Transaction unique : 4 écritures (maintenance + outbox + UPDATE matière + outbox).
  await dbExecBatch([
    {
      sql: `INSERT INTO maintenances (
        entreprise_id, materiel_id, date_maintenance, type, cout, description,
        prochaine_date_echeance, technicien, is_deleted, created_at, updated_at,
        sync_version, client_ref
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 1, ?)`,
      args: [
        entrepriseId, id, dateMaintenance, type, cout, description,
        prochaine, technicien, maintenant, maintenant, clientRef,
      ],
    },
    {
      sql: `INSERT INTO _sync_outbox (entity, entity_id, op, payload, client_ts, pushed)
            VALUES (?, ?, ?, ?, ?, 0)`,
      args: ['maintenance', clientRef, 'create', payloadMaintenance, maintenant],
    },
    {
      sql: `UPDATE materiaux
            SET statut = 'en_maintenance', updated_at = ?, sync_version = COALESCE(sync_version, 0) + 1
            WHERE id = ?`,
      args: [maintenant, id],
    },
    {
      sql: `INSERT INTO _sync_outbox (entity, entity_id, op, payload, client_ts, pushed)
            VALUES (?, ?, ?, ?, ?, 0)`,
      args: ['materiel', clientRefMateriel, 'update', payloadMateriel, maintenant],
    },
  ])
  const rows = await dbQuery('SELECT * FROM maintenances WHERE client_ref = ? LIMIT 1', [clientRef])
  return maintenanceResponse(rows[0] ?? {})
}

/** `POST materiels/{id}/horametre` — mise à jour compteur + outbox `materiel` (update). */
async function updateHorametre(req: LocalRequest): Promise<unknown> {
  const id = int(req.pathParams[0], 0)
  const ligne = await chargerMateriel(id)
  if (!ligne) {
    throw localError(404, 'Matériel non trouvé')
  }
  const body = req.data
  const heures = valeurPositive('heures_moteur', body.heures_moteur)
  const km = valeurPositive('kilometrage', body.kilometrage)
  // `notes` : ignoré (le journal carnet de bord est web-only), comme le backend.

  const maintenant = horodatageLocal()
  const clientRef = str(ligne.client_ref) || String(id)
  const sets: string[] = []
  const argsSql: JsonValue[] = []
  const payload: Record<string, unknown> = { id, client_ref: clientRef }
  if (heures !== null) {
    sets.push('heures_moteur = ?')
    argsSql.push(heures)
    payload.heures_moteur = heures
  }
  if (km !== null) {
    sets.push('kilometrage = ?')
    argsSql.push(km)
    payload.kilometrage = km
  }
  // Le backend flushe toujours (updated_at bouge même sans champ fourni).
  sets.push('updated_at = ?', 'sync_version = COALESCE(sync_version, 0) + 1')
  argsSql.push(maintenant)
  await dbExecBatch([
    {
      sql: `UPDATE materiaux SET ${sets.join(', ')} WHERE id = ?`,
      args: [...argsSql, id],
    },
    {
      sql: `INSERT INTO _sync_outbox (entity, entity_id, op, payload, client_ts, pushed)
            VALUES (?, ?, ?, ?, ?, 0)`,
      args: ['materiel', clientRef, 'update', JSON.stringify(payload), maintenant],
    },
  ])
  return materielComplet(id)
}

/** `GET materiels/{id}/qr-code` — génère la clé manquante (outbox `materiel`), sinon la renvoie. */
async function getQrCode(req: LocalRequest): Promise<unknown> {
  const id = int(req.pathParams[0], 0)
  const ligne = await chargerMateriel(id)
  if (!ligne) {
    throw localError(404, 'Matériel non trouvé')
  }
  let qr = strOrNull(ligne.qr_code_key)
  if (!qr) {
    // Format identique au backend : `MAT-{id}-{uuid4 hex sur 8}.upper()`.
    qr = `MAT-${id}-${uuid().replace(/-/g, '').substring(0, 8).toUpperCase()}`
    const maintenant = horodatageLocal()
    const clientRef = str(ligne.client_ref) || String(id)
    const payload = JSON.stringify({ id, qr_code_key: qr, client_ref: clientRef })
    await dbExecBatch([
      {
        sql: `UPDATE materiaux
              SET qr_code_key = ?, updated_at = ?, sync_version = COALESCE(sync_version, 0) + 1
              WHERE id = ?`,
        args: [qr, maintenant, id],
      },
      {
        sql: `INSERT INTO _sync_outbox (entity, entity_id, op, payload, client_ts, pushed)
              VALUES (?, ?, ?, ?, ?, 0)`,
        args: ['materiel', clientRef, 'update', payload, maintenant],
      },
    ])
  }
  return {
    materiel_id: int(ligne.id, 0),
    nom: str(ligne.nom),
    numero_serie: strOrNull(ligne.numero_serie),
    qr_code_key: qr,
    statut_vgp: strOrNull(ligne.statut_vgp),
    statut: strOrNull(ligne.statut),
  }
}

// ============================================================
// Transferts entre chantiers
// ============================================================

/** `GET materiels/transferts` — historique trié `created_at DESC`. */
async function listTransferts(req: LocalRequest): Promise<unknown> {
  const { clauses, args } = clausesTenant()
  const materielId = intOrNull(req.params.materiel_id)
  if (materielId) {
    clauses.push('materiel_id = ?')
    args.push(materielId)
  }
  const rows = await dbQuery(
    `SELECT * FROM mouvements_materiel WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC`,
    args,
  )
  return rows.map(mouvementResponse)
}

/** `POST materiels/transferts` (201) — mouvement + passage en `en_utilisation` (1 batch). */
async function createTransfert(req: LocalRequest): Promise<unknown> {
  const body = req.data
  const materielId = intOrNull(body.materiel_id)
  if (materielId === null || materielId < 1) {
    throw localError(422, 'materiel_id : champ obligatoire (valeur ≥ 1 attendue).')
  }
  const ligne = await chargerMateriel(materielId)
  if (!ligne) {
    throw localError(404, 'Matériel non trouvé')
  }
  const entrepriseId = currentEntrepriseId() ?? int(ligne.entreprise_id, 0)
  const chantierOrigine = intOrNull(body.chantier_origine_id)
  const chantierDest = intOrNull(body.chantier_destination_id)
  const transporteur = strOrNull(body.transporteur)
  const notes = strOrNull(body.notes)

  const maintenant = horodatageLocal()
  const clientRefMateriel = str(ligne.client_ref) || String(materielId)
  const payloadMateriel = JSON.stringify({ id: materielId, statut: 'en_utilisation', client_ref: clientRefMateriel })

  // PHASE 4B : sync de cette entité à brancher.
  await dbExecBatch([
    {
      sql: `INSERT INTO mouvements_materiel (
        entreprise_id, materiel_id, chantier_origine_id, chantier_destination_id,
        date_depart, date_reception, transporteur, statut, notes, is_deleted,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, NULL, ?, 'en_transit', ?, 0, ?, ?)`,
      args: [
        entrepriseId, materielId, chantierOrigine, chantierDest,
        maintenant, transporteur, notes, maintenant, maintenant,
      ],
    },
    {
      sql: `UPDATE materiaux
            SET statut = 'en_utilisation', updated_at = ?, sync_version = COALESCE(sync_version, 0) + 1
            WHERE id = ?`,
      args: [maintenant, materielId],
    },
    {
      sql: `INSERT INTO _sync_outbox (entity, entity_id, op, payload, client_ts, pushed)
            VALUES (?, ?, ?, ?, ?, 0)`,
      args: ['materiel', clientRefMateriel, 'update', payloadMateriel, maintenant],
    },
  ])
  // `last_id` porte sur l'outbox : on retrouve le mouvement par la matière (dernier inséré).
  const rows = await dbQuery(
    'SELECT * FROM mouvements_materiel WHERE materiel_id = ? ORDER BY id DESC LIMIT 1',
    [materielId],
  )
  return mouvementResponse(rows[0] ?? {})
}

/** `PUT materiels/transferts/{id}/valider` — réception (`livre`), sans outbox. */
async function validerTransfert(req: LocalRequest): Promise<unknown> {
  const id = int(req.pathParams[0], 0)
  const { clauses, args } = clausesTenant()
  const rows = await dbQuery(
    `SELECT * FROM mouvements_materiel WHERE id = ? AND ${clauses.join(' AND ')}`,
    [id, ...args],
  )
  const mouvement = rows[0]
  if (!mouvement) {
    throw localError(404, 'Transfert non trouvé')
  }
  const maintenant = horodatageLocal()
  // PHASE 4B : sync de cette entité à brancher.
  await dbExecBatch([
    {
      sql: `UPDATE mouvements_materiel SET statut = 'livre', date_reception = ?, updated_at = ? WHERE id = ?`,
      args: [maintenant, maintenant, id],
    },
  ])
  return mouvementResponse({ ...mouvement, statut: 'livre', date_reception: maintenant })
}

// ============================================================
// Aleas climatiques — périodes de risque
// ============================================================

/** `GET aleas-climatiques/periodes-risque` — liste des périodes du tenant. */
async function listPeriodesRisque(req: LocalRequest): Promise<unknown> {
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
    `SELECT * FROM periodes_risque_climatique WHERE ${clauses.join(' AND ')} ORDER BY date_debut`,
    args,
  )
  return rows.map(periodeResponse)
}

/** `POST aleas-climatiques/periodes-risque` (201) — `{id, message}` (sans outbox, PHASE 4B). */
async function createPeriodeRisque(req: LocalRequest): Promise<unknown> {
  const body = req.data
  const region = strOrNull(body.region)
  if (region === null) {
    throw localError(422, 'region : champ obligatoire.')
  }
  if (region.length === 0) {
    throw localError(422, 'region : longueur minimale 1 caractère.')
  }
  if (region.length > 80) {
    throw localError(422, 'region : 80 caractères maximum.')
  }
  const typeRisque = strOrNull(body.type_risque)
  if (typeRisque === null) {
    throw localError(422, 'type_risque : champ obligatoire.')
  }
  if (!TYPES_RISQUE.includes(typeRisque)) {
    const liste = TYPES_RISQUE.map((t) => `'${t}'`).join(', ')
    throw localError(422, `Type de risque invalide. Valeurs autorisées: [${liste}]`)
  }
  const dateDebut = dateValide('date_debut', body.date_debut)
  if (dateDebut === null) {
    throw localError(422, 'date_debut : champ obligatoire (format AAAA-MM-JJ).')
  }
  const dateFin = dateValide('date_fin', body.date_fin)
  if (dateFin === null) {
    throw localError(422, 'date_fin : champ obligatoire (format AAAA-MM-JJ).')
  }
  if (dateFin < dateDebut) {
    throw localError(422, 'La date de fin doit être postérieure ou égale à la date de début')
  }
  const entrepriseId = currentEntrepriseId()
  if (entrepriseId === null) {
    throw localError(400, 'Entreprise introuvable')
  }
  const description = strOrNull(body.description)
  const maintenant = horodatageLocal()

  // PHASE 4B : sync de cette entité à brancher.
  const resultat = await dbExecBatch([
    {
      sql: `INSERT INTO periodes_risque_climatique (
        entreprise_id, region, type_risque, date_debut, date_fin, description,
        is_deleted, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      args: [entrepriseId, region, typeRisque, dateDebut, dateFin, description, maintenant, maintenant],
    },
  ])
  let nouveauId = int(resultat.last_id, 0)
  if (!nouveauId) {
    const maxRows = await dbQuery('SELECT COALESCE(MAX(id), 0) AS id FROM periodes_risque_climatique')
    nouveauId = int(maxRows[0]?.id, 0)
  }
  return { id: nouveauId, message: 'Période à risque créée' }
}

/** `PUT aleas-climatiques/periodes-risque/{id}` — mise à jour partielle (sans outbox, PHASE 4B). */
async function updatePeriodeRisque(req: LocalRequest): Promise<unknown> {
  const id = int(req.pathParams[0], 0)
  const rows = await dbQuery(
    'SELECT * FROM periodes_risque_climatique WHERE id = ? AND is_deleted = 0',
    [id],
  )
  const periode = rows[0]
  if (!periode) {
    throw localError(404, 'Période à risque non trouvée')
  }
  const entrepriseId = currentEntrepriseId()
  if (entrepriseId !== null && int(periode.entreprise_id, 0) !== entrepriseId) {
    throw localError(403, 'Accès refusé')
  }

  const body = req.data
  const sets: string[] = []
  const argsSql: JsonValue[] = []
  // Les colonnes NOT NULL (`region`, `type_risque`, dates) ignorent un `null`
  // explicite ; le backend le transmettrait tel quel et échouerait en base.
  if (body.region !== undefined && body.region !== null) {
    const region = str(body.region)
    if (region.length === 0) {
      throw localError(422, 'region : longueur minimale 1 caractère.')
    }
    if (region.length > 80) {
      throw localError(422, 'region : 80 caractères maximum.')
    }
    sets.push('region = ?')
    argsSql.push(region)
  }
  if (body.type_risque !== undefined && body.type_risque !== null) {
    const t = str(body.type_risque)
    if (!TYPES_RISQUE.includes(t)) {
      const liste = TYPES_RISQUE.map((x) => `'${x}'`).join(', ')
      throw localError(422, `Type de risque invalide. Valeurs autorisées: [${liste}]`)
    }
    sets.push('type_risque = ?')
    argsSql.push(t)
  }
  let nouvelleDebut = jour(periode.date_debut)
  let nouvelleFin = jour(periode.date_fin)
  if (body.date_debut !== undefined && body.date_debut !== null) {
    const d = dateValide('date_debut', body.date_debut)
    sets.push('date_debut = ?')
    argsSql.push(d)
    nouvelleDebut = d ?? nouvelleDebut
  }
  if (body.date_fin !== undefined && body.date_fin !== null) {
    const d = dateValide('date_fin', body.date_fin)
    sets.push('date_fin = ?')
    argsSql.push(d)
    nouvelleFin = d ?? nouvelleFin
  }
  if (body.description !== undefined) {
    sets.push('description = ?')
    argsSql.push(strOrNull(body.description))
  }
  if (nouvelleDebut !== null && nouvelleFin !== null && nouvelleFin < nouvelleDebut) {
    throw localError(422, 'La date de fin doit être postérieure ou égale à la date de début')
  }

  if (sets.length > 0) {
    // PHASE 4B : sync de cette entité à brancher.
    const maintenant = horodatageLocal()
    sets.push('updated_at = ?')
    argsSql.push(maintenant)
    await dbExecBatch([
      {
        sql: `UPDATE periodes_risque_climatique SET ${sets.join(', ')} WHERE id = ?`,
        args: [...argsSql, id],
      },
    ])
  }
  return { id, message: 'Période à risque mise à jour' }
}

/** `DELETE aleas-climatiques/periodes-risque/{id}` (204) — suppression douce (sans outbox, PHASE 4B). */
async function deletePeriodeRisque(req: LocalRequest): Promise<unknown> {
  const id = int(req.pathParams[0], 0)
  const rows = await dbQuery(
    'SELECT * FROM periodes_risque_climatique WHERE id = ? AND is_deleted = 0',
    [id],
  )
  const periode = rows[0]
  if (!periode) {
    throw localError(404, 'Période à risque non trouvée')
  }
  const entrepriseId = currentEntrepriseId()
  if (entrepriseId !== null && int(periode.entreprise_id, 0) !== entrepriseId) {
    throw localError(403, 'Accès refusé')
  }
  const maintenant = horodatageLocal()
  // PHASE 4B : sync de cette entité à brancher.
  await dbExecBatch([
    {
      sql: `UPDATE periodes_risque_climatique SET is_deleted = 1, updated_at = ? WHERE id = ?`,
      args: [maintenant, id],
    },
  ])
  return null
}

// ============================================================
// GET /api/aleas-climatiques/impact
// ============================================================

/** `GET aleas-climatiques/impact` — retards climat recalculés localement (réplique `impact_climatique`). */
async function impactClimatique(req: LocalRequest): Promise<unknown> {
  const chantierId = intOrNull(req.params.chantier_id)
  if (chantierId === null) {
    throw localError(422, 'chantier_id : paramètre de requête manquant.')
  }
  const chantierRows = await dbQuery(
    'SELECT * FROM chantiers WHERE id = ? AND is_deleted = 0',
    [chantierId],
  )
  const chantier = chantierRows[0]
  if (!chantier) {
    throw localError(404, 'Chantier non trouvé')
  }
  const entrepriseId = currentEntrepriseId()
  if (entrepriseId !== null && int(chantier.entreprise_id, 0) !== entrepriseId) {
    throw localError(403, 'Accès refusé')
  }

  const aleasRows = await dbQuery(
    `SELECT * FROM incidents
     WHERE chantier_id = ? AND is_deleted = 0 AND type_alea IS NOT NULL
     ORDER BY date_incident, id`,
    [chantierId],
  )
  const aujourdhui = dateLocale()
  let joursArret = 0
  for (const a of aleasRows) {
    // Filtre exact du backend : `type_alea` non vide après strip,
    // `imputabilite == 'climatique'`, non supprimé.
    const typeAlea = str(a.type_alea).trim()
    if (typeAlea && str(a.imputabilite) === 'climatique' && !boolSql(a.is_deleted)) {
      joursArret += intOrNull(a.impact_arret_jours) ?? 0
    }
  }

  const dateFinReelle = jour(chantier.date_fin_reelle)
  const dateFinPrevue = jour(chantier.date_fin_prevue)
  const reference = dateFinReelle ?? aujourdhui
  let retardBrut = 0
  if (dateFinPrevue !== null && reference > dateFinPrevue) {
    retardBrut = joursEntre(dateFinPrevue, reference)
  }
  const retardNet = Math.max(0, retardBrut - joursArret)

  // Périodes actives uniquement si la chantier porte une région.
  let periodes: LocalRow[] | null = null
  const region = strOrNull(chantier.region)
  if (region !== null && region !== '') {
    const prRows = await dbQuery(
      `SELECT * FROM periodes_risque_climatique
       WHERE entreprise_id = ? AND region = ? AND is_deleted = 0 AND date_fin >= ?
       ORDER BY id`,
      [int(chantier.entreprise_id, 0), region, aujourdhui],
    )
    periodes = prRows.map(periodeResponse)
  }

  return {
    chantier_id: chantierId,
    region,
    jours_arret_climatique: joursArret,
    retard_brut_jours: retardBrut,
    retard_net_jours: retardNet,
    aleas: aleasRows.map((a) => ({
      id: int(a.id, 0),
      titre: str(a.titre),
      type_alea: strOrNull(a.type_alea),
      date_incident: jour(a.date_incident),
      date_fin: jour(a.date_fin),
      impact_arret_jours: intOrNull(a.impact_arret_jours),
      imputabilite: strOrNull(a.imputabilite),
      gravite: str(a.gravite),
      statut: str(a.statut),
    })),
    periodes_risque_actives: periodes,
  }
}

// ============================================================
// Enregistrements
// ============================================================

registerLocalRoutes(
  {
    'GET materiels': listMateriels,
    'POST materiels': createMateriel,
    'GET materiels/maintenances': listMaintenances,
    'GET materiels/transferts': listTransferts,
    'POST materiels/transferts': createTransfert,
    'GET aleas-climatiques/periodes-risque': listPeriodesRisque,
    'POST aleas-climatiques/periodes-risque': createPeriodeRisque,
    'GET aleas-climatiques/impact': impactClimatique,
  },
  {
    'POST materiels': 201,
    'POST materiels/transferts': 201,
    'POST aleas-climatiques/periodes-risque': 201,
  },
)

registerLocalPattern(/^GET materiels\/(\d+)$/, getMateriel)
registerLocalPattern(/^PUT materiels\/(\d+)$/, updateMateriel)
registerLocalPattern(/^DELETE materiels\/(\d+)$/, deleteMateriel, 204)
registerLocalPattern(/^POST materiels\/(\d+)\/maintenance$/, addMaintenance, 201)
registerLocalPattern(/^POST materiels\/(\d+)\/horametre$/, updateHorametre)
registerLocalPattern(/^GET materiels\/(\d+)\/qr-code$/, getQrCode)
registerLocalPattern(/^PUT materiels\/transferts\/(\d+)\/valider$/, validerTransfert)
registerLocalPattern(/^PUT aleas-climatiques\/periodes-risque\/(\d+)$/, updatePeriodeRisque)
registerLocalPattern(/^DELETE aleas-climatiques\/periodes-risque\/(\d+)$/, deletePeriodeRisque, 204)
