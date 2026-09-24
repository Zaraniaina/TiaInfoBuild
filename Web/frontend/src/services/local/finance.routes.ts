/**
 * Routes locales desktop — MODULE FINANCE (et rapports liés — Phase 4).
 * Voir l'en-tête de `stocks.routes.ts` pour le contrat commun.
 * Chemins exacts : `Web/frontend/src/services/finance.service.ts`,
 * `dashboard.service.ts`.
 *
 * Écritures : UNE SEULE `dbExecBatch` par mutation (écriture métier + ligne
 * `_sync_outbox` pour l'entité canonique `depense`). `rapports_financiers`
 * est écrit SANS outbox (PHASE 4B, commentaire dédié). Lectures calculées
 * (`stats`, `budget-overruns`, `client-outstanding`, `ca-evolution`,
 * `top-chantiers`) recalculées en SQL local pour coller au JSON FastAPI.
 * Laissés en relais réseau (non enregistrés ici) : `payment-delays`
 * (le backend référence `Facture.date_paiement`, colonne inexistante → 500
 * web), `alertes`, `GET/PUT depenses/{id}`, `POST depenses/{id}/valider`,
 * `rapports/mensuel` (non appelés par les pages desktop).
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

/** Mois français — identique à `MONTHS_FR` de `dashboard.py`. */
const MONTHS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Jul', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']

/** Statuts de dépense — `DepenseCreate.validate_statut` (déjà triés). */
const STATUTS_DEPENSE = ['en_attente', 'payee', 'refusee', 'validee']

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

/** Valeur REAL lue depuis une colonne TEXT : CAST(SQLite) ou 0. */
function reel(v: unknown): number {
  return floatOrNull(v) ?? 0
}

/** `round(x, 2)` Python — les colonnes sont NUMERIC(12,2) côté MySQL. */
function r2(v: number): number {
  return Math.round(v * 100) / 100
}

/** `round(x, 1)` Python (taux backend). */
function r1(v: number): number {
  return Math.round(v * 10) / 10
}

/** Message « set trié » des validateurs pydantic (`Statut invalide…`). */
function messageStatuts(cle: string, valeurs: string[]): string {
  return `${cle} invalide. Valeurs autorisées: {${valeurs.map((v) => `'${v}'`).join(', ')}}`
}

/** `DepenseResponse` — détail complet (schéma `depense.py`). */
function depenseComplete(r: LocalRow): LocalRow {
  return {
    id: int(r.id, 0),
    entreprise_id: intOrNull(r.entreprise_id),
    chantier_id: intOrNull(r.chantier_id),
    description: str(r.description),
    montant: reel(r.montant),
    date_depense: jour(r.date_depense),
    categorie: strOrNull(r.categorie),
    statut: strOrNull(r.statut),
    fournisseur: strOrNull(r.fournisseur),
    taux_tva: floatOrNull(r.taux_tva),
    numero_facture: strOrNull(r.numero_facture),
    mode_paiement: strOrNull(r.mode_paiement),
    validee_par: intOrNull(r.validee_par),
    notes: strOrNull(r.notes),
    is_deleted: boolSql(r.is_deleted),
    created_at: iso(r.created_at),
    updated_at: iso(r.updated_at),
  }
}

/** `DepenseList` — sous-ensemble de champs renvoyé par la liste. */
function depenseListe(r: LocalRow): LocalRow {
  return {
    id: int(r.id, 0),
    entreprise_id: intOrNull(r.entreprise_id),
    chantier_id: intOrNull(r.chantier_id),
    description: str(r.description),
    montant: reel(r.montant),
    date_depense: jour(r.date_depense),
    categorie: strOrNull(r.categorie),
    statut: strOrNull(r.statut),
    fournisseur: strOrNull(r.fournisseur),
    mode_paiement: strOrNull(r.mode_paiement),
    is_deleted: boolSql(r.is_deleted),
    created_at: iso(r.created_at),
  }
}

/** Charge une dépense non supprimée du tenant courant (`None` si absente). */
async function chargerDepense(id: number): Promise<LocalRow | undefined> {
  const { clauses, args } = clausesTenant()
  const rows = await dbQuery(
    `SELECT * FROM depenses WHERE id = ? AND ${clauses.join(' AND ')}`,
    [id, ...args],
  )
  return rows[0]
}

// ============================================================
// GET /api/finance/stats
// ============================================================

/** `GET finance/stats` — `{ca_total, depenses_total, solde}` (réplique `get_finance_stats`). */
async function statsFinance(_req: LocalRequest): Promise<unknown> {
  const { clauses: clausesFactures, args: argsFactures } = clausesTenant()
  const { clauses: clausesDepenses, args: argsDepenses } = clausesTenant()
  const [recettes, depenses] = await Promise.all([
    dbQuery(
      `SELECT COALESCE(SUM(CAST(montant_paye AS REAL)), 0) AS v FROM factures WHERE ${clausesFactures.join(' AND ')}`,
      argsFactures,
    ),
    dbQuery(
      `SELECT COALESCE(SUM(CAST(montant AS REAL)), 0) AS v FROM depenses WHERE ${clausesDepenses.join(' AND ')}`,
      argsDepenses,
    ),
  ])
  const caTotal = r2(reel(recettes[0]?.v))
  const depensesTotal = r2(reel(depenses[0]?.v))
  return { ca_total: caTotal, depenses_total: depensesTotal, solde: r2(caTotal - depensesTotal) }
}

// ============================================================
// GET / POST /api/finance/depenses
// ============================================================

/** `GET finance/depenses` — liste `DepenseList` (filtres identiques à `list_depenses`). */
async function listDepenses(req: LocalRequest): Promise<unknown> {
  const { clauses, args } = clausesTenant()
  const p = req.params
  const categorie = strOrNull(p.categorie)
  if (categorie) {
    clauses.push('categorie = ?')
    args.push(categorie)
  }
  const statut = strOrNull(p.statut)
  if (statut) {
    clauses.push('statut = ?')
    args.push(statut)
  }
  const chantierId = intOrNull(p.chantier_id)
  if (chantierId) {
    clauses.push('chantier_id = ?')
    args.push(chantierId)
  }
  const dateDebut = strOrNull(p.date_debut)
  if (dateDebut) {
    clauses.push('date_depense >= ?')
    args.push(dateDebut)
  }
  const dateFin = strOrNull(p.date_fin)
  if (dateFin) {
    clauses.push('date_depense <= ?')
    args.push(dateFin)
  }
  const skip = Math.max(0, int(p.skip, 0))
  const limit = Math.max(0, int(p.limit, 100))
  const rows = await dbQuery(
    `SELECT * FROM depenses WHERE ${clauses.join(' AND ')} ORDER BY id LIMIT ? OFFSET ?`,
    [...args, limit, skip],
  )
  return rows.map(depenseListe)
}

/** `POST finance/depenses` (201) — écriture locale + outbox `depense` (create). */
async function createDepense(req: LocalRequest): Promise<unknown> {
  const body = req.data
  const description = strOrNull(body.description)
  if (description === null) {
    throw localError(422, 'description : champ obligatoire.')
  }
  if (description.length === 0) {
    throw localError(422, 'description : longueur minimale 1 caractère.')
  }
  if (body.montant === undefined || body.montant === null) {
    throw localError(422, 'montant : champ obligatoire.')
  }
  const montantDepense = floatOrNull(body.montant)
  if (montantDepense === null) {
    throw localError(422, 'montant : nombre attendu.')
  }
  if (montantDepense <= 0) {
    throw localError(422, 'Le montant de la dépense doit être positif')
  }
  let statut = 'en_attente'
  if (body.statut !== undefined && body.statut !== null) {
    statut = str(body.statut)
    if (!STATUTS_DEPENSE.includes(statut)) {
      throw localError(422, messageStatuts('Statut', STATUTS_DEPENSE))
    }
  }
  let tauxTva = 20.0
  if (body.taux_tva !== undefined && body.taux_tva !== null) {
    const tva = floatOrNull(body.taux_tva)
    if (tva === null) {
      throw localError(422, 'taux_tva : nombre attendu.')
    }
    if (tva < 0 || tva > 100) {
      throw localError(422, 'La TVA doit être comprise entre 0 et 100')
    }
    tauxTva = tva
  }
  // Le backend force `date.today()` quand `date_depense` est absente.
  let dateDepense = dateLocale()
  if (body.date_depense !== undefined && body.date_depense !== null) {
    const d = str(body.date_depense)
    if (!/^\d{4}-\d{2}-\d{2}/.test(d)) {
      throw localError(422, 'date_depense : format AAAA-MM-JJ attendu.')
    }
    dateDepense = d.substring(0, 10)
  }
  const entrepriseId = currentEntrepriseId()
  if (entrepriseId === null) {
    throw localError(400, 'Entreprise ID manquant dans le token')
  }

  const chantierId = intOrNull(body.chantier_id)
  const categorie = strOrNull(body.categorie)
  const fournisseur = strOrNull(body.fournisseur)
  const numeroFacture = strOrNull(body.numero_facture)
  const modePaiement = strOrNull(body.mode_paiement)
  const valideePar = intOrNull(body.validee_par)
  const notes = strOrNull(body.notes)
  const maintenant = horodatageLocal()
  const clientRef = uuid()
  const payload = JSON.stringify({
    entreprise_id: entrepriseId,
    chantier_id: chantierId,
    description,
    montant: montantDepense,
    date_depense: dateDepense,
    categorie,
    statut,
    fournisseur,
    taux_tva: tauxTva,
    numero_facture: numeroFacture,
    mode_paiement: modePaiement,
    validee_par: valideePar,
    notes,
    client_ref: clientRef,
  })

  // Transaction unique : écriture métier + outbox (règle du plan §6.1).
  const resultat = await dbExecBatch([
    {
      sql: `INSERT INTO depenses (
        entreprise_id, chantier_id, description, montant, date_depense, categorie,
        statut, fournisseur, taux_tva, numero_facture, mode_paiement, validee_par,
        notes, is_deleted, created_at, updated_at, sync_version, client_ref
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 1, ?)`,
      args: [
        entrepriseId, chantierId, description, montantDepense, dateDepense, categorie,
        statut, fournisseur, tauxTva, numeroFacture, modePaiement, valideePar,
        notes, maintenant, maintenant, clientRef,
      ],
    },
    {
      sql: `INSERT INTO _sync_outbox (entity, entity_id, op, payload, client_ts, pushed)
            VALUES (?, ?, ?, ?, ?, 0)`,
      args: ['depense', clientRef, 'create', payload, maintenant],
    },
  ])
  // `last_id` porte sur la dernière ligne insérée (l'outbox) : on retrouve
  // l'id métier via le `client_ref` fraîchement généré.
  const idRows = await dbQuery('SELECT id FROM depenses WHERE client_ref = ? LIMIT 1', [clientRef])
  const nouveauId = int(idRows[0]?.id, int(resultat.last_id, 0))
  const lignes = await dbQuery('SELECT * FROM depenses WHERE id = ?', [nouveauId])
  return depenseComplete(lignes[0] ?? {})
}

// ============================================================
// PUT /api/finance/depenses/{id}/validation
// ============================================================

/** `PUT finance/depenses/{id}/validation` — changement de statut + outbox `depense` (update). */
async function validerDepense(req: LocalRequest): Promise<unknown> {
  const id = int(req.pathParams[0], 0)
  const existante = await chargerDepense(id)
  if (!existante) {
    throw localError(404, 'Dépense non trouvée')
  }
  const statut = strOrNull(req.data.statut)
  if (statut === null) {
    throw localError(422, 'statut : champ obligatoire.')
  }
  const maintenant = horodatageLocal()
  // Identité de sync : `client_ref` existant ; sinon identifiant numérique
  // (le serveur retombe sur la PK). On ne réécrit JAMAIS un UUID neuf ici.
  const clientRef = str(existante.client_ref) || String(id)
  const payload = JSON.stringify({ id, statut, client_ref: clientRef })
  await dbExecBatch([
    {
      sql: `UPDATE depenses
            SET statut = ?, updated_at = ?, sync_version = COALESCE(sync_version, 0) + 1
            WHERE id = ?`,
      args: [statut, maintenant, id],
    },
    {
      sql: `INSERT INTO _sync_outbox (entity, entity_id, op, payload, client_ts, pushed)
            VALUES (?, ?, ?, ?, ?, 0)`,
      args: ['depense', clientRef, 'update', payload, maintenant],
    },
  ])
  const lignes = await dbQuery('SELECT * FROM depenses WHERE id = ?', [id])
  return depenseComplete(lignes[0] ?? {})
}

// ============================================================
// GET / POST /api/finance/rapports
// ============================================================

/** `GET finance/rapports` — réplique de la PREMIÈRE définition (FastAPI : première gagne). */
async function listRapports(req: LocalRequest): Promise<unknown> {
  const { clauses, args } = clausesTenant()
  const skip = Math.max(0, int(req.params.skip, 0))
  const limit = Math.max(0, int(req.params.limit, 100))
  const rows = await dbQuery(
    `SELECT * FROM rapports_financiers WHERE ${clauses.join(' AND ')}
     ORDER BY date_generation DESC LIMIT ? OFFSET ?`,
    [...args, limit, skip],
  )
  return rows.map((r) => ({
    id: int(r.id, 0),
    periode: strOrNull(r.periode),
    chiffre_affaires: reel(r.chiffre_affaires),
    depenses_total: reel(r.depenses_total),
    marge: reel(r.marge),
    date_generation: iso(r.date_generation),
  }))
}

/** `POST finance/rapports/generate` (201) — agrège factures/dépenses de la période. */
async function genererRapport(req: LocalRequest): Promise<unknown> {
  const periode = strOrNull(req.params.periode)
  if (periode === null) {
    throw localError(422, 'periode : paramètre de requête manquant.')
  }
  // Réplique de `map(int, periode.split("-"))` : exactement 2 entiers.
  const morceaux = periode.split('-')
  if (morceaux.length !== 2 || !/^\d+$/.test(morceaux[0]) || !/^\d+$/.test(morceaux[1])) {
    throw localError(400, 'Format de période invalide. Utilisez YYYY-MM')
  }
  const annee = int(morceaux[0], 0)
  const moisStr = String(int(morceaux[1], 0)).padStart(2, '0')
  const entrepriseId = currentEntrepriseId()
  if (entrepriseId === null) {
    throw localError(400, 'Entreprise ID manquant dans le token')
  }

  const { clauses: clausesFactures, args: argsFactures } = clausesTenant()
  const { clauses: clausesDepenses, args: argsDepenses } = clausesTenant()
  const [caRows, depRows] = await Promise.all([
    dbQuery(
      `SELECT COALESCE(SUM(CAST(montant_paye AS REAL)), 0) AS v FROM factures
       WHERE ${clausesFactures.join(' AND ')}
         AND substr(date_emission, 1, 4) = ? AND substr(date_emission, 6, 2) = ?`,
      [...argsFactures, String(annee), moisStr],
    ),
    dbQuery(
      `SELECT COALESCE(SUM(CAST(montant AS REAL)), 0) AS v FROM depenses
       WHERE ${clausesDepenses.join(' AND ')}
         AND substr(date_depense, 1, 4) = ? AND substr(date_depense, 6, 2) = ?`,
      [...argsDepenses, String(annee), moisStr],
    ),
  ])
  const totalRecettes = reel(caRows[0]?.v)
  const totalDepenses = reel(depRows[0]?.v)
  const marge = totalRecettes - totalDepenses
  const maintenant = horodatageLocal()
  // `RapportFinancier.date_generation` est un DateTime renseigné à minuit
  // par `date.today()` côté backend → isoformat « AAAA-MM-JJT00:00:00 ».
  const dateGeneration = `${dateLocale()}T00:00:00`

  // PHASE 4B : sync de cette entité à brancher.
  const resultat = await dbExecBatch([
    {
      sql: `INSERT INTO rapports_financiers (
        entreprise_id, chantier_id, periode, chiffre_affaires, depenses_total, marge,
        date_generation, is_deleted, created_at, updated_at
      ) VALUES (?, NULL, ?, ?, ?, ?, ?, 0, ?, ?)`,
      args: [
        entrepriseId, periode, r2(totalRecettes), r2(totalDepenses), r2(marge),
        dateGeneration, maintenant, maintenant,
      ],
    },
  ])
  let nouveauId = int(resultat.last_id, 0)
  if (!nouveauId) {
    const maxRows = await dbQuery('SELECT COALESCE(MAX(id), 0) AS id FROM rapports_financiers')
    nouveauId = int(maxRows[0]?.id, 0)
  }
  return {
    id: nouveauId,
    periode,
    chiffre_affaires: r2(totalRecettes),
    depenses_total: r2(totalDepenses),
    marge: r2(marge),
    date_generation: dateGeneration,
  }
}

// ============================================================
// GET /api/finance/budget-overruns · /client-outstanding
// ============================================================

/** `GET finance/budget-overruns` — `{overruns}` (réplique `list_budget_overruns`). */
async function budgetOverruns(req: LocalRequest): Promise<unknown> {
  const limite = int(req.params.limit, 50)
  if (limite > 100) {
    throw localError(422, 'limit : doit être inférieur ou égal à 100')
  }
  const { clauses, args } = clausesTenant()
  const rows = await dbQuery(
    `SELECT * FROM chantiers
     WHERE ${clauses.join(' AND ')}
       AND CAST(budget_reel AS REAL) > CAST(budget_prevu AS REAL)
     ORDER BY (CAST(budget_reel AS REAL) - CAST(budget_prevu AS REAL)) DESC
     LIMIT ?`,
    [...args, Math.max(0, limite)],
  )
  return {
    overruns: rows.map((r) => {
      const prevu = reel(r.budget_prevu)
      const reelChantier = reel(r.budget_reel)
      const depassement = reelChantier - prevu
      return {
        id: int(r.id, 0),
        nom: str(r.nom),
        numero: strOrNull(r.numero),
        budget_prevu: prevu,
        budget_reel: reelChantier,
        depassement,
        taux_depassement: r1(prevu > 0 ? (depassement / prevu) * 100 : 0),
        statut: str(r.statut),
      }
    }),
  }
}

/** `GET finance/client-outstanding` — `{clients}` (réplique 1re définition, jointure interne). */
async function clientOutstanding(_req: LocalRequest): Promise<unknown> {
  const clauses = [
    'c.is_deleted = 0',
    'f.is_deleted = 0',
    `f.statut IN ('emis', 'envoye', 'partiellement_payee', 'en_retard')`,
  ]
  const args: JsonValue[] = []
  const entrepriseId = currentEntrepriseId()
  if (entrepriseId !== null) {
    clauses.push('c.entreprise_id = ?')
    args.push(entrepriseId)
  }
  const rows = await dbQuery(
    `SELECT c.id, c.nom, c.entreprise, c.encours_max,
            SUM(CAST(f.montant_ttc AS REAL) - CAST(f.montant_paye AS REAL)) AS encours_actuel,
            COUNT(f.id) AS nb
     FROM clients c
     JOIN factures f ON f.client_id = c.id
     WHERE ${clauses.join(' AND ')}
     GROUP BY c.id, c.nom, c.entreprise, c.encours_max`,
    args,
  )
  const clients = rows.map((r) => {
    const encoursMax = reel(r.encours_max)
    const encoursActuel = r2(reel(r.encours_actuel))
    const depassement = encoursMax > 0 ? r2(encoursActuel - encoursMax) : 0
    return {
      client_id: int(r.id, 0),
      nom: strOrNull(r.nom),
      entreprise: strOrNull(r.entreprise),
      encours_max: encoursMax,
      encours_actuel: encoursActuel,
      depassement,
      nb_factures_impayees: int(r.nb, 0),
      depasse_limite: depassement > 0,
    }
  })
  clients.sort((a, b) => b.encours_actuel - a.encours_actuel)
  return { clients }
}

// ============================================================
// GET /api/dashboard/ca-evolution · /top-chantiers
// ============================================================

/** `GET dashboard/ca-evolution` — `{evolution:{labels, ca, depenses}}` (réplique `ca_evolution_series`). */
async function caEvolution(req: LocalRequest): Promise<unknown> {
  const mois = int(req.params.mois, 6)
  if (mois < 1 || mois > 24) {
    throw localError(422, 'mois : doit être compris entre 1 et 24')
  }
  // Réplique de `_last_periods` : les n derniers mois, du plus ancien au plus récent.
  const periodes: Array<[number, number]> = []
  const maintenant = new Date()
  let annee = maintenant.getFullYear()
  let moisCourant = maintenant.getMonth() + 1
  for (let i = 0; i < mois; i++) {
    periodes.push([annee, moisCourant])
    moisCourant -= 1
    if (moisCourant === 0) {
      moisCourant = 12
      annee -= 1
    }
  }
  periodes.reverse()

  const { clauses: clausesFactures, args: argsFactures } = clausesTenant()
  const { clauses: clausesDepenses, args: argsDepenses } = clausesTenant()
  const [caRows, depRows] = await Promise.all([
    dbQuery(
      `SELECT substr(date_creation, 1, 4) AS an, substr(date_creation, 6, 2) AS mo,
              COALESCE(SUM(CAST(montant_ttc AS REAL)), 0) AS v
       FROM factures WHERE ${clausesFactures.join(' AND ')}
       GROUP BY substr(date_creation, 1, 4), substr(date_creation, 6, 2)`,
      argsFactures,
    ),
    dbQuery(
      `SELECT substr(date_depense, 1, 4) AS an, substr(date_depense, 6, 2) AS mo,
              COALESCE(SUM(CAST(montant AS REAL)), 0) AS v
       FROM depenses WHERE ${clausesDepenses.join(' AND ')}
       GROUP BY substr(date_depense, 1, 4), substr(date_depense, 6, 2)`,
      argsDepenses,
    ),
  ])
  const caMap = new Map<string, number>()
  for (const r of caRows) {
    caMap.set(`${int(r.an, 0)}-${int(r.mo, 0)}`, reel(r.v))
  }
  const depMap = new Map<string, number>()
  for (const r of depRows) {
    depMap.set(`${int(r.an, 0)}-${int(r.mo, 0)}`, reel(r.v))
  }
  return {
    evolution: {
      labels: periodes.map(([, m]) => MONTHS_FR[m - 1]),
      ca: periodes.map(([a, m]) => r2(caMap.get(`${a}-${m}`) ?? 0)),
      depenses: periodes.map(([a, m]) => r2(depMap.get(`${a}-${m}`) ?? 0)),
    },
  }
}

/** `GET dashboard/top-chantiers` — `{top_chantiers:{labels, avancement, budget}}` (réplique `top_chantiers_series`). */
async function topChantiers(req: LocalRequest): Promise<unknown> {
  const limite = int(req.params.limit, 5)
  if (limite < 1 || limite > 20) {
    throw localError(422, 'limit : doit être compris entre 1 et 20')
  }
  const { clauses, args } = clausesTenant()
  const rows = await dbQuery(
    `SELECT id, nom, budget_prevu, budget_reel FROM chantiers WHERE ${clauses.join(' AND ')}`,
    args,
  )
  const chantiers = rows.map((r) => {
    const prevu = reel(r.budget_prevu)
    const reelChantier = reel(r.budget_reel)
    return {
      nom: str(r.nom) || `Chantier #${int(r.id, 0)}`,
      ratio: prevu > 0 ? reelChantier / prevu : 0,
    }
  })
  chantiers.sort((a, b) => b.ratio - a.ratio)
  const top = chantiers.slice(0, Math.max(0, limite))
  const avancement = top.map((c) => r1(c.ratio * 100))
  return {
    top_chantiers: {
      labels: top.map((c) => c.nom),
      avancement,
      // Reproduit fidèlement le backend : `budget` reprend le taux
      // d'avancement (les deux tableaux sont identiques, bug connu).
      budget: [...avancement],
    },
  }
}

// ============================================================
// Enregistrements
// ============================================================

registerLocalRoutes(
  {
    'GET finance/stats': statsFinance,
    'GET finance/depenses': listDepenses,
    'POST finance/depenses': createDepense,
    'GET finance/rapports': listRapports,
    'POST finance/rapports/generate': genererRapport,
    'GET finance/budget-overruns': budgetOverruns,
    'GET finance/client-outstanding': clientOutstanding,
    'GET dashboard/ca-evolution': caEvolution,
    'GET dashboard/top-chantiers': topChantiers,
  },
  {
    'POST finance/depenses': 201,
    'POST finance/rapports/generate': 201,
  },
)

registerLocalPattern(/^PUT finance\/depenses\/(\d+)\/validation$/, validerDepense)
