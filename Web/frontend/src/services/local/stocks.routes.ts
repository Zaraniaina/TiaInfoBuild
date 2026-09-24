/**
 * Routes locales desktop — MODULE STOCKS & ACHATS (Phase 4).
 *
 * Enregistrement via `registerLocalRoutes` / `registerLocalPattern` (registre
 * partagé `local/registry.ts`) : AUCUN autre fichier n'est modifié ici.
 *
 * Contrat : chaque handler renvoie le MÊME JSON que le endpoint FastAPI
 * correspondant (lecture : `{items, total, page, size}` si paginé) ; toute
 * écriture passe par UNE SEULE `dbExecBatch` contenant l'écriture métier ET sa
 * ligne `_sync_outbox` (règle §6.1), `client_ref` UUID + `sync_version = 1`.
 * Chemins exacts : voir `Web/frontend/src/services/stocks.service.ts` et
 * `achats.service.ts` (clés `"MÉTHODE chemin sans /api"`).
 *
 * Entités canoniques synchronisées de ce module : `article`, `mouvement_stock`,
 * `achat` (= table `commandes_fournisseur`, cf. `sync::table_pour_entite`).
 * Les sous-entités sans colonnes de sync (fournisseurs, dépôts, réceptions,
 * factures/paiements fournisseurs, lignes) sont écrites LOCALEMENT dans la même
 * transaction, sans outbox → marqueur `PHASE 4B`.
 */
import {
  boolSql,
  clausesTenant,
  currentEntrepriseId,
  currentUserId,
  dateLocale,
  dbExecBatch,
  dbQuery,
  floatOrNull,
  formatMontant,
  horodatageLocal,
  int,
  intOrNull,
  localError,
  pagination,
  str,
  strOrNull,
  uuid,
  type JsonValue,
  type LocalRow,
  type SqlArg,
} from './helpers'
import { registerLocalPattern, registerLocalRoutes, type LocalRequest } from './registry'

// ============================================================================
// Enumérations (mêmes valeurs que backend : stocks.py / achats.py)
// ============================================================================

const TYPES_MOUVEMENT = ['entree', 'sortie', 'inventaire', 'ajustement']
const TYPES_DEPOT = ['magasin_principal', 'depot_chantier', 'zone_exterieure', 'armoire_outillage']
const STATUTS_COMMANDE = ['brouillon', 'envoyee', 'confirmee', 'partiellement_recue', 'recue', 'annulee']
const STATUTS_FACTURE = ['a_payer', 'partiellement_payee', 'payee', 'litige', 'annulee']
const MODES_PAIEMENT = ['virement', 'especes', 'cheque', 'mvola', 'orange_money', 'airtel_money']

/** Précision d'écart (mêmes epsilons que `achats.py`, `1e-9`). */
const EPS = 1e-9

// ============================================================================
// Helpers de lecture / sérialisation (JSON identique aux schémas pydantic)
// ============================================================================

/** Horodatage SQLite `AAAA-MM-JJ HH:MM:SS` → sérialisation pydantic `…THH:MM:SS`. */
function horodatage(v: unknown): string | null {
  const s = strOrNull(v)
  return s ? s.replace(' ', 'T') : null
}

/** Paramètre booléen axios (`true`, `1`, `'1'`, `'true'`). */
function paramBooleen(v: unknown): boolean {
  return v === true || v === 1 || v === '1' || v === 'true'
}

interface FormatColonnes {
  /** Colonnes EXACTES à renvoyer (les colonnes de sync ne doivent pas fuiter). */
  cols: string[]
  /** Colonnes TEXT numériques → `float` JSON. */
  nombres?: string[]
  /** Colonnes entières → `int` JSON. */
  entiers?: string[]
  /** Colonnes 0/1 → `bool` JSON. */
  booleens?: string[]
  /** Colonnes datetime → format `AAAA-MM-JJTHH:MM:SS`. */
  horodatages?: string[]
}

/** Sérialise une ligne SQLite selon le format du schéma de réponse cible. */
function serializerSelon(row: LocalRow, fmt: FormatColonnes): LocalRow {
  const out: LocalRow = {}
  for (const c of fmt.cols) {
    const v = row[c]
    if (fmt.nombres?.includes(c)) out[c] = floatOrNull(v)
    else if (fmt.entiers?.includes(c)) out[c] = intOrNull(v)
    else if (fmt.booleens?.includes(c)) out[c] = boolSql(v)
    else if (fmt.horodatages?.includes(c)) out[c] = horodatage(v)
    else out[c] = v === undefined ? null : v
  }
  return out
}

// --- Article (schemas/article.py) ---

const FMT_ARTICLE_LISTE: FormatColonnes = {
  cols: [
    'id', 'entreprise_id', 'reference', 'nom', 'categorie', 'unite',
    'stock_actuel', 'seuil_alerte', 'prix_achat', 'prix_vente', 'marge',
    'code_barre', 'is_deleted', 'created_at',
  ],
  nombres: ['stock_actuel', 'seuil_alerte', 'prix_achat', 'prix_vente', 'marge'],
  entiers: ['id', 'entreprise_id'],
  booleens: ['is_deleted'],
  horodatages: ['created_at'],
}

const FMT_ARTICLE: FormatColonnes = {
  cols: [
    'id', 'entreprise_id', 'reference', 'nom', 'description', 'categorie', 'unite',
    'stock_actuel', 'seuil_alerte', 'stock_mini', 'prix_achat', 'prix_vente', 'marge',
    'tva', 'poids', 'fournisseur_id', 'code_barre', 'emplacement',
    'is_deleted', 'created_at', 'updated_at',
  ],
  nombres: [
    'stock_actuel', 'seuil_alerte', 'stock_mini', 'prix_achat', 'prix_vente',
    'marge', 'tva', 'poids',
  ],
  entiers: ['id', 'entreprise_id', 'fournisseur_id'],
  booleens: ['is_deleted'],
  horodatages: ['created_at', 'updated_at'],
}

// --- Fournisseur (schemas/fournisseur.py) ---

const FMT_FOURNISSEUR_LISTE: FormatColonnes = {
  cols: [
    'id', 'entreprise_id', 'nom', 'contact', 'email', 'telephone', 'ville',
    'pays', 'is_deleted', 'created_at',
  ],
  entiers: ['id', 'entreprise_id'],
  booleens: ['is_deleted'],
  horodatages: ['created_at'],
}

const FMT_FOURNISSEUR: FormatColonnes = {
  cols: [
    'id', 'entreprise_id', 'nom', 'contact', 'email', 'telephone', 'adresse',
    'code_postal', 'ville', 'pays', 'siret', 'conditions_paiement', 'notes',
    'is_deleted', 'created_at', 'updated_at',
  ],
  entiers: ['id', 'entreprise_id'],
  booleens: ['is_deleted'],
  horodatages: ['created_at', 'updated_at'],
}

// --- Dépôt (schemas/depot.py) ---

const FMT_DEPOT_LISTE: FormatColonnes = {
  cols: [
    'id', 'entreprise_id', 'code', 'nom', 'adresse', 'responsable', 'telephone',
    'capacite_m2', 'type', 'is_deleted', 'created_at',
  ],
  nombres: ['capacite_m2'],
  entiers: ['id', 'entreprise_id'],
  booleens: ['is_deleted'],
  horodatages: ['created_at'],
}

const FMT_DEPOT: FormatColonnes = {
  cols: [
    'id', 'entreprise_id', 'code', 'nom', 'adresse', 'responsable', 'telephone',
    'capacite_m2', 'type', 'is_deleted', 'created_at', 'updated_at',
  ],
  nombres: ['capacite_m2'],
  entiers: ['id', 'entreprise_id'],
  booleens: ['is_deleted'],
  horodatages: ['created_at', 'updated_at'],
}

// --- Mouvement de stock (schemas/mouvement_stock.py) ---

const FMT_MOUVEMENT_LISTE: FormatColonnes = {
  cols: [
    'id', 'entreprise_id', 'article_id', 'type_mouvement', 'date_mouvement',
    'quantite', 'prix_unitaire', 'chantier_id', 'fournisseur_id', 'reference',
    'is_deleted',
  ],
  nombres: ['quantite', 'prix_unitaire'],
  entiers: ['id', 'entreprise_id', 'article_id', 'chantier_id', 'fournisseur_id'],
  booleens: ['is_deleted'],
}

const FMT_MOUVEMENT: FormatColonnes = {
  cols: [
    'id', 'entreprise_id', 'article_id', 'type_mouvement', 'date_mouvement',
    'quantite', 'prix_unitaire', 'chantier_id', 'fournisseur_id', 'reference',
    'notes', 'is_deleted', 'created_at', 'updated_at',
  ],
  nombres: ['quantite', 'prix_unitaire'],
  entiers: ['id', 'entreprise_id', 'article_id', 'chantier_id', 'fournisseur_id'],
  booleens: ['is_deleted'],
  horodatages: ['created_at', 'updated_at'],
}

// --- Achats : dicts « toutes colonnes du modèle » (router achats.py) ---

/** Colonnes du modèle `CommandeFournisseur` (`_commande_dict`). */
const FMT_COMMANDE: FormatColonnes = {
  cols: [
    'id', 'entreprise_id', 'fournisseur_id', 'numero', 'chantier_id',
    'date_commande', 'date_livraison_prevue', 'statut', 'montant_ht', 'taux_tva',
    'montant_tva', 'montant_ttc', 'notes', 'created_by', 'is_deleted',
    'created_at', 'updated_at',
  ],
  nombres: ['montant_ht', 'taux_tva', 'montant_tva', 'montant_ttc'],
  entiers: ['id', 'entreprise_id', 'fournisseur_id', 'chantier_id', 'created_by'],
  booleens: ['is_deleted'],
  horodatages: ['created_at', 'updated_at'],
}

/** Colonnes du modèle `LigneCommandeFournisseur`. */
const FMT_LIGNE_COMMANDE: FormatColonnes = {
  cols: [
    'id', 'commande_id', 'article_id', 'designation', 'quantite',
    'quantite_recue', 'prix_unitaire', 'montant_ht', 'notes',
    'created_at', 'updated_at',
  ],
  nombres: ['quantite', 'quantite_recue', 'prix_unitaire', 'montant_ht'],
  entiers: ['id', 'commande_id', 'article_id'],
  horodatages: ['created_at', 'updated_at'],
}

/** Colonnes du modèle `ReceptionFournisseur`. */
const FMT_RECEPTION: FormatColonnes = {
  cols: [
    'id', 'entreprise_id', 'commande_id', 'numero', 'date_reception', 'depot_id',
    'chantier_id', 'complete', 'notes', 'received_by', 'is_deleted',
    'created_at', 'updated_at',
  ],
  entiers: ['id', 'entreprise_id', 'commande_id', 'depot_id', 'chantier_id', 'received_by'],
  booleens: ['complete', 'is_deleted'],
  horodatages: ['created_at', 'updated_at'],
}

/** Colonnes du modèle `LigneReceptionFournisseur`. */
const FMT_LIGNE_RECEPTION: FormatColonnes = {
  cols: ['id', 'reception_id', 'ligne_commande_id', 'quantite_recue', 'conforme', 'notes', 'created_at'],
  nombres: ['quantite_recue'],
  entiers: ['id', 'reception_id', 'ligne_commande_id'],
  booleens: ['conforme'],
  horodatages: ['created_at'],
}

/** Colonnes du modèle `FactureFournisseur`. */
const FMT_FACTURE: FormatColonnes = {
  cols: [
    'id', 'entreprise_id', 'fournisseur_id', 'commande_id', 'chantier_id',
    'numero', 'date_facture', 'date_echeance', 'statut', 'montant_ht',
    'taux_tva', 'montant_tva', 'montant_ttc', 'montant_paye', 'notes',
    'is_deleted', 'created_at', 'updated_at',
  ],
  nombres: ['montant_ht', 'taux_tva', 'montant_tva', 'montant_ttc', 'montant_paye'],
  entiers: ['id', 'entreprise_id', 'fournisseur_id', 'commande_id', 'chantier_id'],
  booleens: ['is_deleted'],
  horodatages: ['created_at', 'updated_at'],
}

/** Colonnes du modèle `PaiementFournisseur`. */
const FMT_PAIEMENT: FormatColonnes = {
  cols: [
    'id', 'entreprise_id', 'facture_id', 'montant', 'date_paiement',
    'mode_paiement', 'reference', 'notes', 'created_by', 'is_deleted',
    'created_at', 'updated_at',
  ],
  nombres: ['montant'],
  entiers: ['id', 'entreprise_id', 'facture_id', 'created_by'],
  booleens: ['is_deleted'],
  horodatages: ['created_at', 'updated_at'],
}

// ============================================================================
// Helpers métier (validations façon pydantic, numérotation, lookups)
// ============================================================================

/** `entreprise_id` du contexte obligatoire (réplique `_entreprise`, achats.py). */
function entrepriseCourante(): number {
  const eid = currentEntrepriseId()
  if (eid === null) throw localError(400, 'Entreprise requise')
  return eid
}

/** ID de segment de route (`{id}` → entier). */
function idRoute(req: LocalRequest): number {
  return int(req.pathParams[0], 0)
}

/** `x : champ obligatoire.` */
function champRequis(v: unknown, nom: string): string {
  const s = strOrNull(v)
  if (!s) throw localError(422, `${nom} : champ obligatoire.`)
  return s
}

/** `x : champ obligatoire (valeur ≥ 1 attendue).` */
function idRequis(v: unknown, nom: string): number {
  const n = intOrNull(v)
  if (n === null || n < 1) {
    throw localError(422, `${nom} : champ obligatoire (valeur ≥ 1 attendue).`)
  }
  return n
}

/** `x : valeur strictement positive attendue.` */
function positifRequis(v: unknown, nom: string): number {
  const n = floatOrNull(v)
  if (n === null || !(n > 0)) {
    throw localError(422, `${nom} : valeur strictement positive attendue.`)
  }
  return n
}

/** Rejet négatif (pydantic `ge=0` sur les champs article / montants). */
function refuserNegatif(v: unknown): number | null {
  const n = floatOrNull(v)
  if (n !== null && n < 0) throw localError(422, 'La valeur ne peut pas être négative')
  return n
}

/** Pourcentage pydantic 0..100 (`tva`, `marge`, `taux_tva`). */
function pourcentage(v: unknown, defaut: number): number {
  if (v === null || v === undefined || v === '') return defaut
  const n = floatOrNull(v)
  if (n === null || n < 0 || n > 100) {
    throw localError(422, 'Le pourcentage doit être compris entre 0 et 100')
  }
  return n
}

/** Message d'enum façon `createPointageLocal` : `… Valeurs autorisées : a, b`. */
function validerEnum(v: string, autorises: string[], message: string): string {
  if (!autorises.includes(v)) {
    throw localError(422, `${message} : ${autorises.join(', ')}`)
  }
  return v
}

/** Type de mouvement (corps `StockAdjustmentRequest` / `MouvementStockCreate`). */
function typeMouvementRequis(v: unknown): string {
  const s = strOrNull(v)
  if (!s) throw localError(422, 'type_mouvement : champ obligatoire.')
  return validerEnum(s, TYPES_MOUVEMENT, 'Type de mouvement invalide. Valeurs autorisées')
}

/** Arrondi 2 décimales (Python `round(x, 2)`). */
function arrondi2(x: number): number {
  return Math.round((x + Number.EPSILON) * 100) / 100
}

/**
 * Code séquentiel `PREFIX-NNNN` (réplique `generate_code`, numerotation.py) :
 * MAX existant + 1, padding 4, retry anti-collision (soft-delete compris).
 */
async function genererCode(prefix: string, table: string, colonne: string): Promise<string> {
  const rows = await dbQuery(
    `SELECT MAX(${colonne}) AS dernier FROM ${table} WHERE ${colonne} LIKE ?`,
    [`${prefix}-%`],
  )
  const dernier = strOrNull(rows[0]?.dernier)
  const m = dernier ? /-(\d+)$/.exec(dernier) : null
  let n = m ? int(m[1], 0) : 0
  let candidat = `${prefix}-${String(n + 1).padStart(4, '0')}`
  for (;;) {
    const occ = await dbQuery(`SELECT COUNT(*) AS n FROM ${table} WHERE ${colonne} = ?`, [candidat])
    if (int(occ[0]?.n, 0) === 0) return candidat
    n += 1
    candidat = `${prefix}-${String(n + 1).padStart(4, '0')}`
  }
}

/**
 * Numéro `CMD-F-AAAA-NNNNN` (réplique `generate_numero("CMD-F", …)` :
 * MAX sur `PREFIX-AAAA-%`, incrément de la dernière séquence, padding 5).
 */
async function genererNumeroCommande(): Promise<string> {
  const annee = new Date().getFullYear()
  const rows = await dbQuery(
    'SELECT MAX(numero) AS dernier FROM commandes_fournisseur WHERE numero LIKE ?',
    [`CMD-F-${annee}-%`],
  )
  const dernier = strOrNull(rows[0]?.dernier)
  const m = dernier ? /(\d+)$/.exec(dernier) : null
  const suivant = m ? int(m[1], 0) + 1 : 1
  return `CMD-F-${annee}-${String(suivant).padStart(5, '0')}`
}

/** Charge une ligne non supprimée ou `localError(404, …)`. */
async function chargerEntite(
  table: string,
  id: number,
  message404: string,
): Promise<LocalRow> {
  const rows = await dbQuery(
    `SELECT * FROM ${table} WHERE id = ? AND is_deleted = 0 LIMIT 1`,
    [id],
  )
  if (!rows[0]) throw localError(404, message404)
  return rows[0]
}

/** Contrôle multi-tenant (`Accès refusé`, 403) après lookup. */
function verifierTenant(row: LocalRow, entrepriseId: number | null): void {
  if (entrepriseId !== null && intOrNull(row.entreprise_id) !== entrepriseId) {
    throw localError(403, 'Accès refusé')
  }
}

/** Ligne `_sync_outbox` (toujours dans la MÊME `dbExecBatch` que l'écriture). */
function outbox(
  entity: string,
  entityId: string,
  op: 'create' | 'update' | 'delete',
  payload: unknown,
  clientTs: string,
): { sql: string; args: JsonValue[] } {
  return {
    sql: `INSERT INTO _sync_outbox (entity, entity_id, op, payload, client_ts, pushed)
          VALUES (?, ?, ?, ?, ?, 0)`,
    args: [entity, entityId, op, JSON.stringify(payload), clientTs, 0],
  }
}

/**
 * Résout le `client_ref` d'une existante (réutilisé ou UUID frais) : c'est la
 * clé d'`entity_id` de l'outbox pour op `update`/`delete` (cf. scan-badge).
 */
function clientRefExistant(row: LocalRow): string {
  return strOrNull(row.client_ref) || uuid()
}

/** Re-SELECT après lot (les colonnes de sync ne doivent pas fuiter en JSON). */
async function recharger(table: string, id: number): Promise<LocalRow> {
  const rows = await dbQuery(`SELECT * FROM ${table} WHERE id = ? LIMIT 1`, [id])
  return rows[0] ?? {}
}

// ============================================================================
// STOCKS — Articles
// ============================================================================

/** GET stocks/articles — liste paginée (`ArticleList`, réplique `list_articles`). */
async function listArticles(req: LocalRequest): Promise<unknown> {
  const { clauses, args } = clausesTenant()
  const search = str(req.params.search)
  if (search) {
    clauses.push('(nom LIKE ? OR reference LIKE ?)')
    args.push(`%${search}%`, `%${search}%`)
  }
  const categorie = str(req.params.categorie)
  if (categorie) {
    clauses.push('categorie = ?')
    args.push(categorie)
  }
  const fournisseurId = int(req.params.fournisseur_id, 0)
  if (fournisseurId) {
    clauses.push('fournisseur_id = ?')
    args.push(fournisseurId)
  }
  const { page, size, offset } = pagination(req.params)
  const where = clauses.join(' AND ')
  const totalRows = await dbQuery(`SELECT COUNT(*) AS n FROM articles WHERE ${where}`, args)
  const rows = await dbQuery(
    `SELECT * FROM articles WHERE ${where} ORDER BY id ASC LIMIT ? OFFSET ?`,
    [...args, size, offset],
  )
  return {
    items: rows.map((r) => serializerSelon(r, FMT_ARTICLE_LISTE)),
    total: int(totalRows[0]?.n, 0),
    page,
    size,
  }
}

/**
 * POST stocks/articles (201) — création ; référence auto `ART-NNNN` si absente.
 * ÉCRITURE : article (canonique `article`) + outbox dans UNE transaction.
 */
async function createArticle(req: LocalRequest): Promise<unknown> {
  const body = req.data
  // 1. Validations du corps (pydantic AVANT l'endpoint).
  champRequis(body.nom, 'nom')
  const stockActuel = refuserNegatif(body.stock_actuel) ?? 0
  const seuilAlerte = refuserNegatif(body.seuil_alerte) ?? 0
  const stockMini = refuserNegatif(body.stock_mini) ?? 0
  const prixAchat = refuserNegatif(body.prix_achat) ?? 0
  const prixVente = refuserNegatif(body.prix_vente) ?? 0
  const poids = refuserNegatif(body.poids)
  const marge = pourcentage(body.marge, 0)
  const tva = pourcentage(body.tva, 20)
  // 2. Endpoint : référence auto puis INSERT + outbox.
  const reference = strOrNull(body.reference) || (await genererCode('ART', 'articles', 'reference'))
  const maintenant = horodatageLocal()
  const clientRef = uuid()
  const entrepriseId = currentEntrepriseId() ?? intOrNull(body.entreprise_id)

  const valeurs: SqlArg[] = [
    entrepriseId,
    reference,
    str(body.nom),
    strOrNull(body.description),
    strOrNull(body.categorie),
    strOrNull(body.unite) || 'unite',
    stockActuel,
    seuilAlerte,
    stockMini,
    prixAchat,
    prixVente,
    marge,
    tva,
    poids,
    intOrNull(body.fournisseur_id),
    strOrNull(body.code_barre),
    strOrNull(body.emplacement),
    0,
    maintenant,
    maintenant,
  ]
  const payload = {
    entreprise_id: entrepriseId,
    reference,
    nom: str(body.nom),
    categorie: valeurs[4],
    unite: valeurs[5],
    stock_actuel: stockActuel,
    seuil_alerte: seuilAlerte,
    prix_achat: prixAchat,
    prix_vente: prixVente,
    marge,
    client_ref: clientRef,
  }

  await dbExecBatch([
    {
      sql: `INSERT INTO articles (
        entreprise_id, reference, nom, description, categorie, unite,
        stock_actuel, seuil_alerte, stock_mini, prix_achat, prix_vente, marge,
        tva, poids, fournisseur_id, code_barre, emplacement,
        is_deleted, created_at, updated_at, client_ref, sync_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      args: [...valeurs, clientRef],
    },
    outbox('article', clientRef, 'create', payload, maintenant),
  ])

  const rows = await dbQuery('SELECT * FROM articles WHERE client_ref = ? LIMIT 1', [clientRef])
  return serializerSelon(rows[0] ?? {}, FMT_ARTICLE)
}

/** GET stocks/articles/en-alerte — `stock_actuel <= seuil_alerte` (réplique `get_en_alerte`). */
async function listArticlesEnAlerte(req: LocalRequest): Promise<unknown> {
  void req
  const entrepriseId = currentEntrepriseId()
  if (entrepriseId === null) throw localError(403, 'Entreprise requise')
  // Colonnes TEXT : CAST obligatoire (sinon comparaison lexicographique).
  const rows = await dbQuery(
    `SELECT * FROM articles
     WHERE entreprise_id = ? AND is_deleted = 0
       AND CAST(stock_actuel AS REAL) <= CAST(seuil_alerte AS REAL)
     ORDER BY id ASC`,
    [entrepriseId],
  )
  return rows.map((r) => serializerSelon(r, FMT_ARTICLE))
}

/** PUT stocks/articles/{id} — mise à jour (canonique `article` : + outbox update). */
async function updateArticle(req: LocalRequest): Promise<unknown> {
  const body = req.data
  // 1. Corps (pydantic AVANT le lookup 404).
  if ('nom' in body) champRequis(body.nom, 'nom')
  refuserNegatif(body.stock_actuel)
  refuserNegatif(body.seuil_alerte)
  refuserNegatif(body.stock_mini)
  refuserNegatif(body.prix_achat)
  refuserNegatif(body.prix_vente)
  refuserNegatif(body.poids)
  if ('marge' in body) pourcentage(body.marge, 0)
  if ('tva' in body) pourcentage(body.tva, 20)
  // 2. Lookup + tenant.
  const article = await chargerEntite('articles', idRoute(req), 'Article non trouvé')
  const entrepriseId = currentEntrepriseId()
  verifierTenant(article, entrepriseId)
  // 3. Champs modifiables (`ArticleUpdate.model_dump(exclude_unset=True)`).
  const champs: Record<string, unknown> = {}
  const NUMERIQUES = [
    'stock_actuel', 'seuil_alerte', 'stock_mini', 'prix_achat', 'prix_vente',
    'marge', 'tva', 'poids',
  ]
  const TEXTE = ['reference', 'nom', 'description', 'categorie', 'unite', 'code_barre', 'emplacement']
  for (const c of TEXTE) if (c in body) champs[c] = strOrNull(body[c])
  for (const c of NUMERIQUES) if (c in body) champs[c] = floatOrNull(body[c])
  if ('fournisseur_id' in body) champs.fournisseur_id = intOrNull(body.fournisseur_id)

  const maintenant = horodatageLocal()
  const clientRef = clientRefExistant(article)
  const assigns = Object.keys(champs).map((c) => `${c} = ?`)
  assigns.push('updated_at = ?', 'client_ref = ?', 'sync_version = COALESCE(sync_version, 0) + 1')

  await dbExecBatch([
    {
      sql: `UPDATE articles SET ${assigns.join(', ')} WHERE id = ?`,
      args: [...(Object.values(champs) as SqlArg[]), maintenant, clientRef, idRoute(req)],
    },
    outbox('article', clientRef, 'update', { id: idRoute(req), ...champs, client_ref: clientRef }, maintenant),
  ])

  return serializerSelon(await recharger('articles', idRoute(req)), FMT_ARTICLE)
}

/**
 * PUT stocks/articles/{id}/stock — ajustement de stock (réplique `adjust_stock`).
 * `sortie` soustrait (400 si stock insuffisant), sinon ajout ; mouvement créé.
 * Entités canoniques `article` (maj stock) + `mouvement_stock` (création).
 */
async function ajusterStock(req: LocalRequest): Promise<unknown> {
  const body = req.data
  // 1. Corps.
  const quantite = positifRequis(body.quantite, 'quantite')
  const typeMouvement = typeMouvementRequis(body.type_mouvement)
  const prixUnitaire = refuserNegatif(body.prix_unitaire) ?? 0
  // 2. Lookup + tenant.
  const article = await chargerEntite('articles', idRoute(req), 'Article non trouvé')
  const entrepriseId = currentEntrepriseId()
  verifierTenant(article, entrepriseId)

  const stockAvant = floatOrNull(article.stock_actuel) ?? 0
  if (typeMouvement === 'sortie' && stockAvant < quantite) {
    throw localError(400, 'Stock insuffisant pour cette sortie')
  }
  const stockApres = typeMouvement === 'sortie' ? stockAvant - quantite : stockAvant + quantite

  const maintenant = horodatageLocal()
  const clientRefArticle = clientRefExistant(article)
  const clientRefMouvement = uuid()

  await dbExecBatch([
    {
      sql: `UPDATE articles
            SET stock_actuel = ?, updated_at = ?, client_ref = ?,
                sync_version = COALESCE(sync_version, 0) + 1
            WHERE id = ?`,
      args: [stockApres, maintenant, clientRefArticle, idRoute(req)],
    },
    outbox(
      'article',
      clientRefArticle,
      'update',
      { id: idRoute(req), stock_actuel: stockApres, client_ref: clientRefArticle },
      maintenant,
    ),
    {
      sql: `INSERT INTO mouvements_stock (
        entreprise_id, article_id, type_mouvement, date_mouvement, quantite,
        prix_unitaire, chantier_id, fournisseur_id, reference, notes,
        is_deleted, created_at, updated_at, client_ref, sync_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 1)`,
      args: [
        entrepriseId ?? intOrNull(article.entreprise_id) ?? 0,
        idRoute(req),
        typeMouvement,
        maintenant,
        quantite,
        prixUnitaire,
        intOrNull(body.chantier_id),
        intOrNull(body.fournisseur_id),
        strOrNull(body.reference),
        strOrNull(body.notes),
        maintenant,
        maintenant,
        clientRefMouvement,
      ],
    },
    outbox(
      'mouvement_stock',
      clientRefMouvement,
      'create',
      {
        entreprise_id: entrepriseId ?? intOrNull(article.entreprise_id) ?? 0,
        article_id: idRoute(req),
        type_mouvement: typeMouvement,
        quantite,
        prix_unitaire: prixUnitaire,
        client_ref: clientRefMouvement,
      },
      maintenant,
    ),
  ])

  return serializerSelon(await recharger('articles', idRoute(req)), FMT_ARTICLE)
}

// ============================================================================
// STOCKS — Mouvements de stock
// ============================================================================

/** GET stocks/mouvements — liste paginée (`MouvementStockList`). */
async function listMouvements(req: LocalRequest): Promise<unknown> {
  const { clauses, args } = clausesTenant()
  const articleId = int(req.params.article_id, 0)
  if (articleId) {
    clauses.push('article_id = ?')
    args.push(articleId)
  }
  const dateDebut = str(req.params.date_debut)
  if (dateDebut) {
    clauses.push('date_mouvement >= ?')
    args.push(dateDebut)
  }
  const dateFin = str(req.params.date_fin)
  if (dateFin) {
    clauses.push('date_mouvement <= ?')
    // Comparaison datetime <= date : bornon à la fin de journée.
    args.push(dateFin.length === 10 ? `${dateFin} 23:59:59` : dateFin)
  }
  const typeMouvement = str(req.params.type_mouvement)
  if (typeMouvement) {
    clauses.push('type_mouvement = ?')
    args.push(typeMouvement)
  }
  const { page, size, offset } = pagination(req.params)
  const where = clauses.join(' AND ')
  const totalRows = await dbQuery(`SELECT COUNT(*) AS n FROM mouvements_stock WHERE ${where}`, args)
  const rows = await dbQuery(
    `SELECT * FROM mouvements_stock WHERE ${where} ORDER BY id ASC LIMIT ? OFFSET ?`,
    [...args, size, offset],
  )
  return {
    items: rows.map((r) => serializerSelon(r, FMT_MOUVEMENT_LISTE)),
    total: int(totalRows[0]?.n, 0),
    page,
    size,
  }
}

/**
 * POST stocks/mouvements (201) — création seule (le stock n'est PAS modifié,
 * comme `MouvementStockCRUD.create`). Entité canonique `mouvement_stock`.
 */
async function createMouvement(req: LocalRequest): Promise<unknown> {
  const body = req.data
  // 1. Corps.
  const articleId = idRequis(body.article_id, 'article_id')
  const typeMouvement = typeMouvementRequis(body.type_mouvement)
  const quantite = positifRequis(body.quantite, 'quantite')
  const prixUnitaire = refuserNegatif(body.prix_unitaire) ?? 0
  // 2. Lookup article (deviation : le backend laisserait échouer la FK).
  const article = await chargerEntite('articles', articleId, 'Article non trouvé')

  const maintenant = horodatageLocal()
  const clientRef = uuid()
  const entrepriseId = currentEntrepriseId() ?? intOrNull(body.entreprise_id) ??
    intOrNull(article.entreprise_id)

  await dbExecBatch([
    {
      sql: `INSERT INTO mouvements_stock (
        entreprise_id, article_id, type_mouvement, date_mouvement, quantite,
        prix_unitaire, chantier_id, fournisseur_id, reference, notes,
        is_deleted, created_at, updated_at, client_ref, sync_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 1)`,
      args: [
        entrepriseId,
        articleId,
        typeMouvement,
        maintenant,
        quantite,
        prixUnitaire,
        intOrNull(body.chantier_id),
        intOrNull(body.fournisseur_id),
        strOrNull(body.reference),
        strOrNull(body.notes),
        maintenant,
        maintenant,
        clientRef,
      ],
    },
    outbox(
      'mouvement_stock',
      clientRef,
      'create',
      {
        entreprise_id: entrepriseId,
        article_id: articleId,
        type_mouvement: typeMouvement,
        quantite,
        prix_unitaire: prixUnitaire,
        client_ref: clientRef,
      },
      maintenant,
    ),
  ])

  const rows = await dbQuery('SELECT * FROM mouvements_stock WHERE client_ref = ? LIMIT 1', [clientRef])
  return serializerSelon(rows[0] ?? {}, FMT_MOUVEMENT)
}

// ============================================================================
// STOCKS — Fournisseurs (sous-entité : PHASE 4B, pas de colonnes de sync)
// ============================================================================

/** GET stocks/fournisseurs — liste paginée (`FournisseurList`). */
async function listFournisseurs(req: LocalRequest): Promise<unknown> {
  const { clauses, args } = clausesTenant()
  const search = str(req.params.search)
  if (search) {
    clauses.push('nom LIKE ?')
    args.push(`%${search}%`)
  }
  const { page, size, offset } = pagination(req.params)
  const where = clauses.join(' AND ')
  const totalRows = await dbQuery(`SELECT COUNT(*) AS n FROM fournisseurs WHERE ${where}`, args)
  const rows = await dbQuery(
    `SELECT * FROM fournisseurs WHERE ${where} ORDER BY id ASC LIMIT ? OFFSET ?`,
    [...args, size, offset],
  )
  return {
    items: rows.map((r) => serializerSelon(r, FMT_FOURNISSEUR_LISTE)),
    total: int(totalRows[0]?.n, 0),
    page,
    size,
  }
}

/** POST stocks/fournisseurs (201) — création locale (`FournisseurResponse`). */
async function createFournisseur(req: LocalRequest): Promise<unknown> {
  const body = req.data
  champRequis(body.nom, 'nom')
  const maintenant = horodatageLocal()

  // PHASE 4B : sync des sous-entités à brancher.
  const resultat = await dbExecBatch([
    {
      sql: `INSERT INTO fournisseurs (
        entreprise_id, nom, contact, email, telephone, adresse, code_postal,
        ville, pays, siret, conditions_paiement, notes,
        is_deleted, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      args: [
        currentEntrepriseId() ?? intOrNull(body.entreprise_id),
        str(body.nom),
        strOrNull(body.contact),
        strOrNull(body.email),
        strOrNull(body.telephone),
        strOrNull(body.adresse),
        strOrNull(body.code_postal),
        strOrNull(body.ville),
        strOrNull(body.pays) || 'Madagascar',
        strOrNull(body.siret),
        strOrNull(body.conditions_paiement),
        strOrNull(body.notes),
        maintenant,
        maintenant,
      ],
    },
  ])
  return serializerSelon(await recharger('fournisseurs', int(resultat.last_id, 0)), FMT_FOURNISSEUR)
}

/** PUT stocks/fournisseurs/{id} — mise à jour locale (sous-entité). */
async function updateFournisseur(req: LocalRequest): Promise<unknown> {
  const body = req.data
  if ('nom' in body) champRequis(body.nom, 'nom')
  const fournisseur = await chargerEntite('fournisseurs', idRoute(req), 'Fournisseur non trouvé')
  verifierTenant(fournisseur, currentEntrepriseId())

  const champs: Record<string, unknown> = {}
  for (const c of [
    'nom', 'contact', 'email', 'telephone', 'adresse', 'code_postal',
    'ville', 'pays', 'siret', 'conditions_paiement', 'notes',
  ]) {
    if (c in body) champs[c] = strOrNull(body[c])
  }
  const maintenant = horodatageLocal()
  const assigns = Object.keys(champs).map((c) => `${c} = ?`)
  assigns.push('updated_at = ?')

  // PHASE 4B : sync des sous-entités à brancher.
  await dbExecBatch([
    {
      sql: `UPDATE fournisseurs SET ${assigns.join(', ')} WHERE id = ?`,
      args: [...(Object.values(champs) as SqlArg[]), maintenant, idRoute(req)],
    },
  ])
  return serializerSelon(await recharger('fournisseurs', idRoute(req)), FMT_FOURNISSEUR)
}

// ============================================================================
// STOCKS — Dépôts BTP (sous-entité : PHASE 4B, pas de colonnes de sync)
// ============================================================================

/** GET stocks/depots — liste paginée (`DepotList`, size par défaut 50). */
async function listDepots(req: LocalRequest): Promise<unknown> {
  const { clauses, args } = clausesTenant()
  const search = str(req.params.search)
  if (search) {
    clauses.push('(nom LIKE ? OR code LIKE ?)')
    args.push(`%${search}%`, `%${search}%`)
  }
  const type = str(req.params.type)
  if (type) {
    clauses.push('type = ?')
    args.push(type)
  }
  const { page, size, offset } = pagination({ size: 50, ...req.params })
  const where = clauses.join(' AND ')
  const totalRows = await dbQuery(`SELECT COUNT(*) AS n FROM depots WHERE ${where}`, args)
  const rows = await dbQuery(
    `SELECT * FROM depots WHERE ${where} ORDER BY id ASC LIMIT ? OFFSET ?`,
    [...args, size, offset],
  )
  return {
    items: rows.map((r) => serializerSelon(r, FMT_DEPOT_LISTE)),
    total: int(totalRows[0]?.n, 0),
    page,
    size,
  }
}

/** GET stocks/depots/{id} — détail (`DepotResponse`). */
async function getDepot(req: LocalRequest): Promise<unknown> {
  const depot = await chargerEntite('depots', idRoute(req), 'Dépôt non trouvé')
  verifierTenant(depot, currentEntrepriseId())
  return serializerSelon(depot, FMT_DEPOT)
}

/** Valide les champs d'un dépôt (corps `DepotCreate`/`DepotUpdate`). */
function validerDepot(body: Record<string, unknown>, creation: boolean): void {
  if (creation) champRequis(body.nom, 'nom')
  else if ('nom' in body) champRequis(body.nom, 'nom')
  if ('type' in body && strOrNull(body.type)) {
    validerEnum(str(body.type), TYPES_DEPOT, 'Type de dépôt invalide. Valeurs autorisées')
  }
  if ('capacite_m2' in body) refuserNegatif(body.capacite_m2)
}

/** POST stocks/depots (201) — code auto `DEP-NNNN` si absent. */
async function createDepot(req: LocalRequest): Promise<unknown> {
  const body = req.data
  validerDepot(body, true)
  const code = strOrNull(body.code) || (await genererCode('DEP', 'depots', 'code'))
  const maintenant = horodatageLocal()

  // PHASE 4B : sync des sous-entités à brancher.
  const resultat = await dbExecBatch([
    {
      sql: `INSERT INTO depots (
        entreprise_id, code, nom, adresse, responsable, telephone,
        capacite_m2, type, is_deleted, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      args: [
        currentEntrepriseId() ?? intOrNull(body.entreprise_id),
        code,
        str(body.nom),
        strOrNull(body.adresse),
        strOrNull(body.responsable),
        strOrNull(body.telephone),
        floatOrNull(body.capacite_m2),
        strOrNull(body.type) || 'magasin_principal',
        maintenant,
        maintenant,
      ],
    },
  ])
  return serializerSelon(await recharger('depots', int(resultat.last_id, 0)), FMT_DEPOT)
}

/** PUT stocks/depots/{id} — mise à jour locale (sous-entité). */
async function updateDepot(req: LocalRequest): Promise<unknown> {
  const body = req.data
  validerDepot(body, false)
  const depot = await chargerEntite('depots', idRoute(req), 'Dépôt non trouvé')
  verifierTenant(depot, currentEntrepriseId())

  const champs: Record<string, unknown> = {}
  for (const c of ['code', 'nom', 'adresse', 'responsable', 'telephone', 'type']) {
    if (c in body) champs[c] = strOrNull(body[c])
  }
  if ('capacite_m2' in body) champs.capacite_m2 = floatOrNull(body.capacite_m2)
  const maintenant = horodatageLocal()
  const assigns = Object.keys(champs).map((c) => `${c} = ?`)
  assigns.push('updated_at = ?')

  // PHASE 4B : sync des sous-entités à brancher.
  await dbExecBatch([
    {
      sql: `UPDATE depots SET ${assigns.join(', ')} WHERE id = ?`,
      args: [...(Object.values(champs) as SqlArg[]), maintenant, idRoute(req)],
    },
  ])
  return serializerSelon(await recharger('depots', idRoute(req)), FMT_DEPOT)
}

/** DELETE stocks/depots/{id} (204) — soft-delete local. */
async function deleteDepot(req: LocalRequest): Promise<unknown> {
  const depot = await chargerEntite('depots', idRoute(req), 'Dépôt non trouvé')
  verifierTenant(depot, currentEntrepriseId())

  // PHASE 4B : sync des sous-entités à brancher.
  await dbExecBatch([
    {
      sql: 'UPDATE depots SET is_deleted = 1, updated_at = ? WHERE id = ?',
      args: [horodatageLocal(), idRoute(req)],
    },
  ])
  return null
}

// ============================================================================
// ACHATS — Commandes fournisseurs (entité canonique `achat`)
// ============================================================================

/** `CommandeFournisseur` + `fournisseur_nom`/`chantier_nom` + `lignes`. */
async function commandeAvecLignes(cmd: LocalRow): Promise<unknown> {
  const [fournisseurs, chantiers, lignes] = await Promise.all([
    dbQuery('SELECT nom FROM fournisseurs WHERE id = ?', [intOrNull(cmd.fournisseur_id) ?? 0]),
    intOrNull(cmd.chantier_id)
      ? dbQuery('SELECT nom FROM chantiers WHERE id = ?', [intOrNull(cmd.chantier_id)])
      : Promise.resolve([] as LocalRow[]),
    dbQuery(
      'SELECT * FROM lignes_commande_fournisseur WHERE commande_id = ? ORDER BY id ASC',
      [int(cmd.id, 0)],
    ),
  ])
  return {
    ...serializerSelon(cmd, FMT_COMMANDE),
    fournisseur_nom: fournisseurs[0]?.nom ?? null,
    chantier_nom: chantiers[0]?.nom ?? null,
    lignes: lignes.map((l) => serializerSelon(l, FMT_LIGNE_COMMANDE)),
  }
}

/** Lookup commande (`_get_commande`) : 404 puis contrôle tenant 403. */
async function chargerCommande(id: number): Promise<LocalRow> {
  const entrepriseId = entrepriseCourante()
  const cmd = await chargerEntite('commandes_fournisseur', id, 'Commande non trouvée')
  if (intOrNull(cmd.entreprise_id) !== entrepriseId) {
    throw localError(403, 'Accès refusé')
  }
  return cmd
}

/** GET achats/commandes — liste paginée, ordre `id DESC` (réplique `list_commandes`). */
async function listCommandes(req: LocalRequest): Promise<unknown> {
  const entrepriseId = entrepriseCourante()
  const clauses = ['cf.is_deleted = 0', 'cf.entreprise_id = ?']
  const args: JsonValue[] = [entrepriseId]
  const statut = str(req.params.statut)
  if (statut) {
    clauses.push('cf.statut = ?')
    args.push(statut)
  }
  const fournisseurId = int(req.params.fournisseur_id, 0)
  if (fournisseurId) {
    clauses.push('cf.fournisseur_id = ?')
    args.push(fournisseurId)
  }
  const chantierId = int(req.params.chantier_id, 0)
  if (chantierId) {
    clauses.push('cf.chantier_id = ?')
    args.push(chantierId)
  }
  const search = str(req.params.search)
  if (search) {
    clauses.push('cf.numero LIKE ?')
    args.push(`%${search}%`)
  }
  const { page, size, offset } = pagination(req.params)
  const where = clauses.join(' AND ')
  const totalRows = await dbQuery(
    `SELECT COUNT(*) AS n FROM commandes_fournisseur cf WHERE ${where}`,
    args,
  )
  const rows = await dbQuery(
    `SELECT cf.*, f.nom AS fournisseur_nom, ch.nom AS chantier_nom
     FROM commandes_fournisseur cf
     LEFT JOIN fournisseurs f ON f.id = cf.fournisseur_id
     LEFT JOIN chantiers ch ON ch.id = cf.chantier_id
     WHERE ${where}
     ORDER BY cf.id DESC LIMIT ? OFFSET ?`,
    [...args, size, offset],
  )
  const items = rows.map((r) => ({
    ...serializerSelon(r, { ...FMT_COMMANDE, cols: [...FMT_COMMANDE.cols, 'fournisseur_nom', 'chantier_nom'] }),
  }))
  // Lignes de la page en UNE requête (pas de N+1).
  let lignesParCommande: Map<number, LocalRow[]> = new Map()
  if (rows.length > 0) {
    const ids = rows.map((r) => int(r.id, 0))
    const placeholders = ids.map(() => '?').join(', ')
    const lignes = await dbQuery(
      `SELECT * FROM lignes_commande_fournisseur WHERE commande_id IN (${placeholders}) ORDER BY id ASC`,
      ids,
    )
    lignesParCommande = new Map()
    for (const l of lignes) {
      const cle = int(l.commande_id, 0)
      const liste = lignesParCommande.get(cle) ?? []
      liste.push(l)
      lignesParCommande.set(cle, liste)
    }
  }
  for (const item of items) {
    const liste = lignesParCommande.get(int(item.id, 0)) ?? []
    ;(item as LocalRow).lignes = liste.map((l) => serializerSelon(l, FMT_LIGNE_COMMANDE))
  }
  return { items, total: int(totalRows[0]?.n, 0), page, size }
}

/** GET achats/commandes/{id} — détail avec lignes. */
async function getCommande(req: LocalRequest): Promise<unknown> {
  const cmd = await chargerCommande(idRoute(req))
  return commandeAvecLignes(cmd)
}

/**
 * POST achats/commandes (201) — corps d'abord (lignes), puis lookups
 * fournisseur/chantier, puis numéro `CMD-F-AAAA-NNNNN` + montants recalculés.
 * ÉCRITURE : commande + lignes + outbox `achat` dans UNE transaction.
 */
async function createCommande(req: LocalRequest): Promise<unknown> {
  const body = req.data
  const entrepriseId = entrepriseCourante()
  // 1. Corps : lignes obligatoires (pydantic `min_length=1`).
  const lignes = Array.isArray(body.lignes) ? body.lignes : []
  if (lignes.length === 0) throw localError(422, 'Au moins une ligne est requise')
  const lignesValidees = lignes.map((l, index) => {
    const ligne = (l ?? {}) as Record<string, unknown>
    const designation = champRequis(ligne.designation, `lignes[${index}].designation`)
    const quantite = positifRequis(ligne.quantite, `lignes[${index}].quantite`)
    const prixUnitaire = refuserNegatif(ligne.prix_unitaire) ?? 0
    if (prixUnitaire < 0) throw localError(422, 'La valeur ne peut pas être négative')
    return {
      article_id: intOrNull(ligne.article_id),
      designation,
      quantite,
      prix_unitaire: prixUnitaire,
    }
  })
  const fournisseurId = idRequis(body.fournisseur_id, 'fournisseur_id')
  const tauxTva = pourcentage(body.taux_tva, 20)
  const notes = strOrNull(body.notes)
  const dateLivraison = strOrNull(body.date_livraison_prevue)
  const dateCommande = strOrNull(body.date_commande) || dateLocale()
  // 2. Lookups (404 avant toute écriture).
  const fournisseur = await chargerEntite('fournisseurs', fournisseurId, 'Fournisseur non trouvé')
  if (intOrNull(fournisseur.entreprise_id) !== entrepriseId) {
    throw localError(404, 'Fournisseur non trouvé')
  }
  const chantierId = intOrNull(body.chantier_id)
  if (chantierId) {
    const chantiers = await dbQuery('SELECT entreprise_id FROM chantiers WHERE id = ?', [chantierId])
    if (!chantiers[0] || intOrNull(chantiers[0].entreprise_id) !== entrepriseId) {
      throw localError(404, 'Chantier non trouvé')
    }
  }
  // 3. Montants (`_recalculer_commande`) + numéro.
  const ht = lignesValidees.reduce((somme, l) => somme + l.quantite * l.prix_unitaire, 0)
  const montantTva = arrondi2((ht * tauxTva) / 100)
  const numero = await genererNumeroCommande()
  const maintenant = horodatageLocal()
  const clientRef = uuid()

  const declarations: string[] = []
  for (let i = 0; i < lignesValidees.length; i += 1) {
    declarations.push(
      `(SELECT id FROM commandes_fournisseur WHERE client_ref = ?), ?, ?, ?, ?, ?`,
    )
  }
  void declarations

  const argsCommande: SqlArg[] = [
    entrepriseId,
    fournisseurId,
    numero,
    chantierId,
    dateCommande,
    dateLivraison,
    'brouillon',
    arrondi2(ht),
    tauxTva,
    montantTva,
    arrondi2(ht + montantTva),
    notes,
    currentUserId(),
    0,
    maintenant,
    maintenant,
    clientRef,
  ]

  const statements: Array<{ sql: string; args: JsonValue[] }> = [
    {
      sql: `INSERT INTO commandes_fournisseur (
        entreprise_id, fournisseur_id, numero, chantier_id, date_commande,
        date_livraison_prevue, statut, montant_ht, taux_tva, montant_tva,
        montant_ttc, notes, created_by, is_deleted, created_at, updated_at,
        client_ref, sync_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      args: argsCommande,
    },
  ]
  // PHASE 4B : sync des sous-entités à brancher.
  for (const l of lignesValidees) {
    statements.push({
      sql: `INSERT INTO lignes_commande_fournisseur (
        commande_id, article_id, designation, quantite, quantite_recue,
        prix_unitaire, montant_ht, created_at, updated_at
      ) VALUES ((SELECT id FROM commandes_fournisseur WHERE client_ref = ?), ?, ?, ?, 0, ?, ?, ?, ?)`,
      args: [
        clientRef,
        l.article_id,
        l.designation,
        l.quantite,
        l.prix_unitaire,
        arrondi2(l.quantite * l.prix_unitaire),
        maintenant,
        maintenant,
      ],
    })
  }
  statements.push(
    outbox(
      'achat',
      clientRef,
      'create',
      {
        entreprise_id: entrepriseId,
        fournisseur_id: fournisseurId,
        numero,
        chantier_id: chantierId,
        statut: 'brouillon',
        montant_ht: arrondi2(ht),
        montant_ttc: arrondi2(ht + montantTva),
        client_ref: clientRef,
      },
      maintenant,
    ),
  )
  await dbExecBatch(statements)

  const rows = await dbQuery(
    'SELECT id, numero FROM commandes_fournisseur WHERE client_ref = ? LIMIT 1',
    [clientRef],
  )
  return { id: int(rows[0]?.id, 0), numero: rows[0]?.numero ?? numero, message: 'Commande créée' }
}

/**
 * PUT achats/commandes/{id} — mise à jour ; remplacement éventuel des lignes
 * puis recalcul des montants (`_recalculer_commande`).
 */
async function updateCommande(req: LocalRequest): Promise<unknown> {
  const body = req.data
  const entrepriseId = entrepriseCourante()
  // 1. Corps.
  let tauxTva: number | null = null
  if ('taux_tva' in body) tauxTva = pourcentage(body.taux_tva, 20)
  let statutFourni: string | null = null
  if ('statut' in body && strOrNull(body.statut) !== null) {
    statutFourni = validerEnum(str(body.statut), STATUTS_COMMANDE, 'Statut invalide. Valeurs autorisées')
  }
  let lignesValidees: Array<{ article_id: number | null; designation: string; quantite: number; prix_unitaire: number }> | null = null
  if (body.lignes !== undefined && body.lignes !== null) {
    const lignes = Array.isArray(body.lignes) ? body.lignes : []
    if (lignes.length === 0) throw localError(422, 'Au moins une ligne est requise')
    lignesValidees = lignes.map((l, index) => {
      const ligne = (l ?? {}) as Record<string, unknown>
      const quantite = positifRequis(ligne.quantite, `lignes[${index}].quantite`)
      const prixUnitaire = refuserNegatif(ligne.prix_unitaire) ?? 0
      return {
        article_id: intOrNull(ligne.article_id),
        designation: 'designation' in ligne && strOrNull(ligne.designation) !== null
          ? str(ligne.designation)
          : '',
        quantite,
        prix_unitaire: prixUnitaire,
      }
    })
  }
  // 2. Lookup + tenant + conflits de statut.
  const cmd = await chargerCommande(idRoute(req))
  if (intOrNull(cmd.entreprise_id) !== entrepriseId) {
    throw localError(403, 'Accès refusé')
  }
  const statutActuel = str(cmd.statut)
  if (statutActuel === 'recue' || statutActuel === 'annulee') {
    throw localError(409, 'Commande déjà reçue ou annulée')
  }

  const maintenant = horodatageLocal()
  const clientRef = clientRefExistant(cmd)
  const statements: Array<{ sql: string; args: JsonValue[] }> = []

  // 3. Champs hors lignes (`model_dump(exclude_unset=True, exclude={"lignes"})`).
  const champs: Record<string, unknown> = {}
  if ('date_livraison_prevue' in body) champs.date_livraison_prevue = strOrNull(body.date_livraison_prevue)
  if (tauxTva !== null) champs.taux_tva = tauxTva
  if ('notes' in body) champs.notes = strOrNull(body.notes)
  if (statutFourni !== null && lignesValidees === null) champs.statut = statutFourni

  if (lignesValidees !== null) {
    // Remplacement intégral des lignes (quantite_recue réinitialisée).
    statements.push({
      sql: 'DELETE FROM lignes_commande_fournisseur WHERE commande_id = ?',
      args: [idRoute(req)],
    })
    // PHASE 4B : sync des sous-entités à brancher.
    for (const l of lignesValidees) {
      statements.push({
        sql: `INSERT INTO lignes_commande_fournisseur (
          commande_id, article_id, designation, quantite, quantite_recue,
          prix_unitaire, montant_ht, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?)`,
        args: [
          idRoute(req),
          l.article_id,
          l.designation,
          l.quantite,
          l.prix_unitaire,
          arrondi2(l.quantite * l.prix_unitaire),
          maintenant,
          maintenant,
        ],
      })
    }
    // Statut repassé en brouillon sauf envoyée/confirmée.
    if (statutActuel !== 'envoyee' && statutActuel !== 'confirmee') {
      champs.statut = 'brouillon'
    }
  }

  // 4. Recalcul des montants sur les lignes FINALES.
  const lignesFinales = lignesValidees ??
    (await dbQuery(
      'SELECT quantite, prix_unitaire FROM lignes_commande_fournisseur WHERE commande_id = ? ORDER BY id ASC',
      [idRoute(req)],
    )).map((l) => ({
      quantite: floatOrNull(l.quantite) ?? 0,
      prix_unitaire: floatOrNull(l.prix_unitaire) ?? 0,
    }))
  const ht = lignesFinales.reduce(
    (somme, l) => somme + (floatOrNull((l as LocalRow).quantite) ?? 0) * (floatOrNull((l as LocalRow).prix_unitaire) ?? 0),
    0,
  )
  const tvaFinale = tauxTva ?? pourcentage(cmd.taux_tva, 20)
  const montantTva = arrondi2((ht * tvaFinale) / 100)
  champs.montant_ht = arrondi2(ht)
  champs.montant_tva = montantTva
  champs.montant_ttc = arrondi2(ht + montantTva)
  if (tauxTva !== null) champs.taux_tva = tauxTva

  const assigns = Object.keys(champs).map((c) => `${c} = ?`)
  assigns.push(
    'updated_at = ?',
    'client_ref = ?',
    'sync_version = COALESCE(sync_version, 0) + 1',
  )
  statements.push({
    sql: `UPDATE commandes_fournisseur SET ${assigns.join(', ')} WHERE id = ?`,
    args: [
      ...(Object.values(champs) as SqlArg[]),
      maintenant,
      clientRef,
      idRoute(req),
    ],
  })
  statements.push(
    outbox(
      'achat',
      clientRef,
      'update',
      { id: idRoute(req), ...champs, client_ref: clientRef },
      maintenant,
    ),
  )
  await dbExecBatch(statements)
  return { id: idRoute(req), message: 'Commande mise à jour' }
}

/** POST achats/commandes/{id}/statut — changement de statut (200). */
async function changerStatutCommande(req: LocalRequest): Promise<unknown> {
  const statut = champRequis(req.params.statut, 'statut')
  const cmd = await chargerCommande(idRoute(req))
  validerEnum(statut, STATUTS_COMMANDE, 'Statut invalide. Valeurs autorisées')

  const maintenant = horodatageLocal()
  const clientRef = clientRefExistant(cmd)
  await dbExecBatch([
    {
      sql: `UPDATE commandes_fournisseur
            SET statut = ?, updated_at = ?, client_ref = ?,
                sync_version = COALESCE(sync_version, 0) + 1
            WHERE id = ?`,
      args: [statut, maintenant, clientRef, idRoute(req)],
    },
    outbox(
      'achat',
      clientRef,
      'update',
      { id: idRoute(req), statut, client_ref: clientRef },
      maintenant,
    ),
  ])
  return { id: idRoute(req), statut }
}

/** DELETE achats/commandes/{id} (204) — soft-delete + outbox `achat`. */
async function deleteCommande(req: LocalRequest): Promise<unknown> {
  const cmd = await chargerCommande(idRoute(req))
  const maintenant = horodatageLocal()
  const clientRef = clientRefExistant(cmd)
  await dbExecBatch([
    {
      sql: `UPDATE commandes_fournisseur
            SET is_deleted = 1, updated_at = ?, client_ref = ?,
                sync_version = COALESCE(sync_version, 0) + 1
            WHERE id = ?`,
      args: [maintenant, clientRef, idRoute(req)],
    },
    outbox(
      'achat',
      clientRef,
      'delete',
      { id: idRoute(req), is_deleted: true, client_ref: clientRef },
      maintenant,
    ),
  ])
  return null
}

// ============================================================================
// ACHATS — Réceptions (sous-entité ; entrées de stock → `article`/`mouvement_stock`)
// ============================================================================

/** GET achats/commandes/{id}/receptions — liste (dernières d'abord) + lignes. */
async function listReceptions(req: LocalRequest): Promise<unknown> {
  await chargerCommande(idRoute(req))
  const receptions = await dbQuery(
    `SELECT * FROM receptions_fournisseur
     WHERE commande_id = ? AND is_deleted = 0
     ORDER BY id DESC`,
    [idRoute(req)],
  )
  if (receptions.length === 0) return []
  const ids = receptions.map((r) => int(r.id, 0))
  const placeholders = ids.map(() => '?').join(', ')
  const toutesLignes = await dbQuery(
    `SELECT * FROM lignes_reception_fournisseur WHERE reception_id IN (${placeholders}) ORDER BY id ASC`,
    ids,
  )
  const parReception = new Map<number, LocalRow[]>()
  for (const l of toutesLignes) {
    const cle = int(l.reception_id, 0)
    const liste = parReception.get(cle) ?? []
    liste.push(l)
    parReception.set(cle, liste)
  }
  return receptions.map((r) => ({
    ...serializerSelon(r, FMT_RECEPTION),
    lignes: (parReception.get(int(r.id, 0)) ?? []).map((l) => serializerSelon(l, FMT_LIGNE_RECEPTION)),
  }))
}

/**
 * POST achats/commandes/{id}/receptions (201) — contrôle des restants, entrées
 * en stock (article + mouvement `entree` si conforme), maj `quantite_recue` et
 * statut de la commande. TOUT dans UNE `dbExecBatch`.
 */
async function creerReception(req: LocalRequest): Promise<unknown> {
  const body = req.data
  const entrepriseId = entrepriseCourante()
  // 1. Corps.
  const lignes = Array.isArray(body.lignes) ? body.lignes : []
  if (lignes.length === 0) throw localError(422, 'Au moins une ligne est requise')
  const lignesValidees = lignes.map((l, index) => {
    const ligne = (l ?? {}) as Record<string, unknown>
    return {
      ligne_commande_id: idRequis(ligne.ligne_commande_id, `lignes[${index}].ligne_commande_id`),
      quantite_recue: positifRequis(ligne.quantite_recue, `lignes[${index}].quantite_recue`),
      conforme: ligne.conforme === undefined || ligne.conforme === null
        ? true
        : boolSql(ligne.conforme),
      notes: strOrNull(ligne.notes),
    }
  })
  const depotId = intOrNull(body.depot_id)
  const chantierId = intOrNull(body.chantier_id)
  const notes = strOrNull(body.notes)
  const dateReception = strOrNull(body.date_reception) || dateLocale()
  // 2. Commande + statuts.
  const cmd = await chargerCommande(idRoute(req))
  const statutCmd = str(cmd.statut)
  if (statutCmd === 'annulee') throw localError(409, 'Commande annulée')
  if (statutCmd === 'brouillon') throw localError(409, "Confirmez d'abord la commande")
  // 3. Dépôt.
  if (depotId) {
    const depots = await dbQuery('SELECT entreprise_id FROM depots WHERE id = ?', [depotId])
    if (!depots[0] || intOrNull(depots[0].entreprise_id) !== entrepriseId) {
      throw localError(404, 'Dépôt non trouvé')
    }
  }
  // 4. Lignes de commande + contrôle des restants (AVANT toute écriture).
  const lignesCmd = await dbQuery(
    'SELECT * FROM lignes_commande_fournisseur WHERE commande_id = ? ORDER BY id ASC',
    [idRoute(req)],
  )
  const mapLignes = new Map<number, LocalRow>()
  for (const l of lignesCmd) mapLignes.set(int(l.id, 0), l)
  const increment: Array<{ id: number; quantite: number }> = []
  for (const l of lignesValidees) {
    const ligne = mapLignes.get(l.ligne_commande_id)
    if (!ligne) {
      throw localError(404, `Ligne de commande ${l.ligne_commande_id} inconnue`)
    }
    const restant = (floatOrNull(ligne.quantite) ?? 0) - (floatOrNull(ligne.quantite_recue) ?? 0)
    if (l.quantite_recue > restant + EPS) {
      throw localError(
        400,
        `Quantité supérieure au restant à recevoir pour « ${str(ligne.designation)} » (restant ${formatMontant(restant)})`,
      )
    }
    increment.push({ id: l.ligne_commande_id, quantite: l.quantite_recue })
  }

  // 5. Articles rattachés (conformes) pour entrée en stock.
  const articleIds = [...new Set(
    lignesValidees
      .filter((l) => l.conforme)
      .map((l) => intOrNull(mapLignes.get(l.ligne_commande_id)?.article_id ?? null))
      .filter((id): id is number => id !== null && id > 0),
  )]
  const articles = articleIds.length > 0
    ? await dbQuery(
      `SELECT id, stock_actuel, client_ref, sync_version FROM articles
       WHERE id IN (${articleIds.map(() => '?').join(', ')}) AND is_deleted = 0`,
      articleIds,
    )
    : []
  const mapArticles = new Map<number, LocalRow>()
  for (const a of articles) {
    if (intOrNull(a.entreprise_id ?? entrepriseId) === entrepriseId || intOrNull(a.entreprise_id) === entrepriseId) {
      mapArticles.set(int(a.id, 0), a)
    }
  }

  // 6. Statut final de la commande (complétude) + numéro de réception.
  const complet = lignesCmd.every((l) => {
    const dejaRecue = floatOrNull(l.quantite_recue) ?? 0
    const ajout = increment.find((i) => i.id === int(l.id, 0))?.quantite ?? 0
    return dejaRecue + ajout >= (floatOrNull(l.quantite) ?? 0) - EPS
  })
  const numeroReception = `REC-${str(cmd.numero)}`
  const maintenant = horodatageLocal()
  const clientRefCmd = clientRefExistant(cmd)
  const statutFinal = complet ? 'recue' : 'partiellement_recue'

  const statements: Array<{ sql: string; args: JsonValue[] }> = []
  // PHASE 4B : sync des sous-entités à brancher.
  statements.push({
    sql: `INSERT INTO receptions_fournisseur (
      entreprise_id, commande_id, numero, date_reception, depot_id, chantier_id,
      complete, notes, received_by, is_deleted, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    args: [
      entrepriseId,
      idRoute(req),
      numeroReception,
      dateReception,
      depotId,
      chantierId,
      complet ? 1 : 0,
      notes,
      currentUserId(),
      maintenant,
      maintenant,
    ],
  })
  for (const l of lignesValidees) {
    statements.push({
      sql: `INSERT INTO lignes_reception_fournisseur (
        reception_id, ligne_commande_id, quantite_recue, conforme, notes, created_at
      ) VALUES (
        (SELECT id FROM receptions_fournisseur WHERE commande_id = ? AND numero = ? ORDER BY id DESC LIMIT 1),
        ?, ?, ?, ?, ?
      )`,
      args: [
        idRoute(req),
        numeroReception,
        l.ligne_commande_id,
        l.quantite_recue,
        l.conforme ? 1 : 0,
        l.notes,
        maintenant,
      ],
    })
  }
  for (const inc of increment) {
    statements.push({
      sql: 'UPDATE lignes_commande_fournisseur SET quantite_recue = quantite_recue + ?, updated_at = ? WHERE id = ?',
      args: [inc.quantite, maintenant, inc.id],
    })
  }
  // Entrées en stock : article (canonique) + mouvement `entree` (canonique).
  for (const l of lignesValidees) {
    const ligneCmd = mapLignes.get(l.ligne_commande_id)
    const articleId = intOrNull(ligneCmd?.article_id ?? null)
    if (!l.conforme || !articleId) continue
    const article = mapArticles.get(articleId)
    if (!article) continue
    const stockApres = (floatOrNull(article.stock_actuel) ?? 0) + l.quantite_recue
    const refArticle = strOrNull(article.client_ref) || uuid()
    const clientRefMouvement = uuid()
    statements.push(
      {
        sql: `UPDATE articles
              SET stock_actuel = ?, updated_at = ?, client_ref = ?,
                  sync_version = COALESCE(sync_version, 0) + 1
              WHERE id = ?`,
        args: [stockApres, maintenant, refArticle, articleId],
      },
      outbox(
        'article',
        refArticle,
        'update',
        { id: articleId, stock_actuel: stockApres, client_ref: refArticle },
        maintenant,
      ),
      {
        sql: `INSERT INTO mouvements_stock (
          entreprise_id, article_id, type_mouvement, date_mouvement, quantite,
          prix_unitaire, chantier_id, fournisseur_id, reference, notes,
          is_deleted, created_at, updated_at, client_ref, sync_version
        ) VALUES (?, ?, 'entree', ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 1)`,
        args: [
          entrepriseId,
          articleId,
          maintenant,
          l.quantite_recue,
          floatOrNull(ligneCmd?.prix_unitaire) ?? 0,
          chantierId,
          intOrNull(cmd.fournisseur_id),
          numeroReception,
          `Réception commande ${str(cmd.numero)}`,
          maintenant,
          maintenant,
          clientRefMouvement,
        ],
      },
      outbox(
        'mouvement_stock',
        clientRefMouvement,
        'create',
        {
          entreprise_id: entrepriseId,
          article_id: articleId,
          type_mouvement: 'entree',
          quantite: l.quantite_recue,
          client_ref: clientRefMouvement,
        },
        maintenant,
      ),
    )
  }
  // Statut de la commande.
  statements.push(
    {
      sql: `UPDATE commandes_fournisseur
            SET statut = ?, updated_at = ?, client_ref = ?,
                sync_version = COALESCE(sync_version, 0) + 1
            WHERE id = ?`,
      args: [statutFinal, maintenant, clientRefCmd, idRoute(req)],
    },
    outbox(
      'achat',
      clientRefCmd,
      'update',
      { id: idRoute(req), statut: statutFinal, client_ref: clientRefCmd },
      maintenant,
    ),
  )
  await dbExecBatch(statements)

  const rows = await dbQuery(
    'SELECT id FROM receptions_fournisseur WHERE commande_id = ? AND numero = ? ORDER BY id DESC LIMIT 1',
    [idRoute(req), numeroReception],
  )
  return {
    id: int(rows[0]?.id, 0),
    numero: numeroReception,
    commande_statut: statutFinal,
  }
}

// ============================================================================
// ACHATS — Factures fournisseurs (sous-entité : PHASE 4B)
// ============================================================================

/** GET achats/factures — liste paginée + `restant_a_payer` + filtre `en_retard`. */
async function listFactures(req: LocalRequest): Promise<unknown> {
  const entrepriseId = entrepriseCourante()
  const clauses = ['f.is_deleted = 0', 'f.entreprise_id = ?']
  const args: JsonValue[] = [entrepriseId]
  const statut = str(req.params.statut)
  if (statut) {
    clauses.push('f.statut = ?')
    args.push(statut)
  }
  const fournisseurId = int(req.params.fournisseur_id, 0)
  if (fournisseurId) {
    clauses.push('f.fournisseur_id = ?')
    args.push(fournisseurId)
  }
  const chantierId = int(req.params.chantier_id, 0)
  if (chantierId) {
    clauses.push('f.chantier_id = ?')
    args.push(chantierId)
  }
  if (paramBooleen(req.params.en_retard)) {
    clauses.push(
      "f.statut IN ('a_payer', 'partiellement_payee') AND f.date_echeance IS NOT NULL AND f.date_echeance < ?",
    )
    args.push(dateLocale())
  }
  const { page, size, offset } = pagination(req.params)
  const where = clauses.join(' AND ')
  const totalRows = await dbQuery(`SELECT COUNT(*) AS n FROM factures_fournisseur f WHERE ${where}`, args)
  const rows = await dbQuery(
    `SELECT f.*, fo.nom AS fournisseur_nom, ch.nom AS chantier_nom
     FROM factures_fournisseur f
     LEFT JOIN fournisseurs fo ON fo.id = f.fournisseur_id
     LEFT JOIN chantiers ch ON ch.id = f.chantier_id
     WHERE ${where}
     ORDER BY f.id DESC LIMIT ? OFFSET ?`,
    [...args, size, offset],
  )
  const items = rows.map((r) => {
    const facture = serializerSelon(r, {
      ...FMT_FACTURE,
      cols: [...FMT_FACTURE.cols, 'fournisseur_nom', 'chantier_nom'],
    })
    facture.restant_a_payer = arrondi2(
      (floatOrNull(r.montant_ttc) ?? 0) - (floatOrNull(r.montant_paye) ?? 0),
    )
    return facture
  })
  return { items, total: int(totalRows[0]?.n, 0), page, size }
}

/** POST achats/factures (201) — TVA/TTC calculés (réplique `create_facture`). */
async function createFacture(req: LocalRequest): Promise<unknown> {
  const body = req.data
  const entrepriseId = entrepriseCourante()
  // 1. Corps.
  const numero = champRequis(body.numero, 'numero').trim()
  const montantHt = refuserNegatif(body.montant_ht) ?? 0
  const tauxTva = pourcentage(body.taux_tva, 20)
  const fournisseurId = idRequis(body.fournisseur_id, 'fournisseur_id')
  // 2. Lookup fournisseur.
  const fournisseur = await chargerEntite('fournisseurs', fournisseurId, 'Fournisseur non trouvé')
  if (intOrNull(fournisseur.entreprise_id) !== entrepriseId) {
    throw localError(404, 'Fournisseur non trouvé')
  }
  const tva = arrondi2((montantHt * tauxTva) / 100)
  const maintenant = horodatageLocal()

  // PHASE 4B : sync des sous-entités à brancher.
  const resultat = await dbExecBatch([
    {
      sql: `INSERT INTO factures_fournisseur (
        entreprise_id, fournisseur_id, commande_id, chantier_id, numero,
        date_facture, date_echeance, statut, montant_ht, taux_tva,
        montant_tva, montant_ttc, montant_paye, notes,
        is_deleted, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'a_payer', ?, ?, ?, ?, 0, ?, 0, ?, ?)`,
      args: [
        entrepriseId,
        fournisseurId,
        intOrNull(body.commande_id),
        intOrNull(body.chantier_id),
        numero,
        strOrNull(body.date_facture) || dateLocale(),
        strOrNull(body.date_echeance),
        montantHt,
        tauxTva,
        tva,
        arrondi2(montantHt + tva),
        strOrNull(body.notes),
        maintenant,
        maintenant,
      ],
    },
  ])
  return {
    id: int(resultat.last_id, 0),
    message: 'Facture fournisseur créée',
  }
}

/** PUT achats/factures/{id} — mise à jour (statut/échéance/notes) (200). */
async function updateFacture(req: LocalRequest): Promise<unknown> {
  const body = req.data
  const entrepriseId = entrepriseCourante()
  // 1. Corps.
  let statut: string | null = null
  if ('statut' in body && strOrNull(body.statut) !== null) {
    statut = validerEnum(str(body.statut), STATUTS_FACTURE, 'Statut invalide. Valeurs autorisées')
  }
  // 2. Lookup (404 si absente OU hors tenant, comme le backend).
  const facture = await chargerEntite('factures_fournisseur', idRoute(req), 'Facture non trouvée')
  if (intOrNull(facture.entreprise_id) !== entrepriseId) {
    throw localError(404, 'Facture non trouvée')
  }
  const champs: Record<string, unknown> = {}
  if (statut !== null) champs.statut = statut
  if ('date_echeance' in body) champs.date_echeance = strOrNull(body.date_echeance)
  if ('notes' in body) champs.notes = strOrNull(body.notes)
  const maintenant = horodatageLocal()
  const assigns = Object.keys(champs).map((c) => `${c} = ?`)
  assigns.push('updated_at = ?')

  // PHASE 4B : sync des sous-entités à brancher.
  await dbExecBatch([
    {
      sql: `UPDATE factures_fournisseur SET ${assigns.join(', ')} WHERE id = ?`,
      args: [...(Object.values(champs) as SqlArg[]), maintenant, idRoute(req)],
    },
  ])
  const statutFinal = statut ?? str(facture.statut)
  return { id: idRoute(req), statut: statutFinal }
}

/** GET achats/factures/{id}/paiements — liste (derniers d'abord). */
async function listPaiements(req: LocalRequest): Promise<unknown> {
  const entrepriseId = entrepriseCourante()
  const facture = await chargerEntite('factures_fournisseur', idRoute(req), 'Facture non trouvée')
  if (intOrNull(facture.entreprise_id) !== entrepriseId) {
    throw localError(404, 'Facture non trouvée')
  }
  const rows = await dbQuery(
    `SELECT * FROM paiements_fournisseur
     WHERE facture_id = ? AND is_deleted = 0
     ORDER BY id DESC`,
    [idRoute(req)],
  )
  return rows.map((r) => serializerSelon(r, FMT_PAIEMENT))
}

/**
 * POST achats/factures/{id}/paiements (201) — contrôle du restant puis maj
 * `montant_paye` + statut (`payee`/`partiellement_payee`).
 */
async function creerPaiement(req: LocalRequest): Promise<unknown> {
  const body = req.data
  const entrepriseId = entrepriseCourante()
  // 1. Corps.
  const montant = positifRequis(body.montant, 'montant')
  const modePaiement = body.mode_paiement === undefined || body.mode_paiement === null || body.mode_paiement === ''
    ? 'virement'
    : validerEnum(str(body.mode_paiement), MODES_PAIEMENT, 'Mode de paiement invalide. Valeurs autorisées')
  const datePaiement = strOrNull(body.date_paiement) || dateLocale()
  // 2. Facture (404 si absente ou hors tenant).
  const facture = await chargerEntite('factures_fournisseur', idRoute(req), 'Facture non trouvée')
  if (intOrNull(facture.entreprise_id) !== entrepriseId) {
    throw localError(404, 'Facture non trouvée')
  }
  const statutFacture = str(facture.statut)
  if (statutFacture === 'payee' || statutFacture === 'annulee') {
    throw localError(409, 'Facture déjà soldée ou annulée')
  }
  const ttc = floatOrNull(facture.montant_ttc) ?? 0
  const dejaPaye = floatOrNull(facture.montant_paye) ?? 0
  const restant = ttc - dejaPaye
  if (montant > restant + EPS) {
    throw localError(400, `Montant supérieur au restant à payer (${formatMontant(restant)})`)
  }
  const payeApres = arrondi2(dejaPaye + montant)
  const statutApres = payeApres >= ttc - EPS ? 'payee' : 'partiellement_payee'
  const maintenant = horodatageLocal()

  // PHASE 4B : sync des sous-entités à brancher (facture ET paiement).
  await dbExecBatch([
    {
      sql: `UPDATE factures_fournisseur
            SET montant_paye = ?, statut = ?, updated_at = ?
            WHERE id = ?`,
      args: [payeApres, statutApres, maintenant, idRoute(req)],
    },
    {
      sql: `INSERT INTO paiements_fournisseur (
        entreprise_id, facture_id, montant, date_paiement, mode_paiement,
        reference, notes, created_by, is_deleted, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      args: [
        entrepriseId,
        idRoute(req),
        montant,
        datePaiement,
        modePaiement,
        strOrNull(body.reference),
        strOrNull(body.notes),
        currentUserId(),
        maintenant,
        maintenant,
      ],
    },
  ])
  const rows = await dbQuery(
    'SELECT id FROM paiements_fournisseur WHERE facture_id = ? ORDER BY id DESC LIMIT 1',
    [idRoute(req)],
  )
  return { id: int(rows[0]?.id, 0), facture_statut: statutApres }
}

// ============================================================================
// ACHATS — Impact chantier (achats vs budget)
// ============================================================================

/** GET achats/impact-chantier/{id} — agrégats achats/budget (réplique `impact_chantier`). */
async function impactChantier(req: LocalRequest): Promise<unknown> {
  const entrepriseId = entrepriseCourante()
  const chantierId = idRoute(req)
  const chantiers = await dbQuery(
    'SELECT budget_prevu, entreprise_id FROM chantiers WHERE id = ? AND is_deleted = 0',
    [chantierId],
  )
  if (!chantiers[0]) throw localError(404, 'Chantier non trouvé')
  if (intOrNull(chantiers[0].entreprise_id) !== entrepriseId) {
    throw localError(403, 'Accès refusé')
  }
  const [commandes, factures, payes] = await Promise.all([
    dbQuery(
      `SELECT COALESCE(SUM(CAST(montant_ttc AS REAL)), 0) AS total
       FROM commandes_fournisseur
       WHERE chantier_id = ? AND is_deleted = 0 AND statut != 'annulee'`,
      [chantierId],
    ),
    dbQuery(
      `SELECT COALESCE(SUM(CAST(montant_ttc AS REAL)), 0) AS total
       FROM factures_fournisseur
       WHERE chantier_id = ? AND is_deleted = 0 AND statut != 'annulee'`,
      [chantierId],
    ),
    dbQuery(
      `SELECT COALESCE(SUM(CAST(p.montant AS REAL)), 0) AS total
       FROM paiements_fournisseur p
       WHERE p.is_deleted = 0
         AND p.facture_id IN (
           SELECT id FROM factures_fournisseur WHERE chantier_id = ? AND is_deleted = 0
         )`,
      [chantierId],
    ),
  ])
  const achatsCommandes = arrondi2(floatOrNull(commandes[0]?.total) ?? 0)
  const achatsFactures = arrondi2(floatOrNull(factures[0]?.total) ?? 0)
  const achatsPayes = arrondi2(floatOrNull(payes[0]?.total) ?? 0)
  const budget = floatOrNull(chantiers[0].budget_prevu) ?? 0
  return {
    chantier_id: chantierId,
    budget_prevu: budget,
    achats_commandes: achatsCommandes,
    achats_factures: achatsFactures,
    achats_payes: achatsPayes,
    budget_restant: arrondi2(budget - achatsFactures),
    taux_consommation: budget > 0 ? Math.round((achatsFactures / budget) * 100 * 10) / 10 : null,
    depassement: achatsFactures > budget && budget > 0,
  }
}

// ============================================================================
// Enregistrement des routes (clés `"MÉTHODE chemin"`, POST → 201)
// ============================================================================

registerLocalRoutes(
  {
    // --- Stocks ---
    'GET stocks/articles': listArticles,
    'POST stocks/articles': createArticle,
    'GET stocks/articles/en-alerte': listArticlesEnAlerte,
    'GET stocks/mouvements': listMouvements,
    'POST stocks/mouvements': createMouvement,
    'GET stocks/fournisseurs': listFournisseurs,
    'POST stocks/fournisseurs': createFournisseur,
    'GET stocks/depots': listDepots,
    'POST stocks/depots': createDepot,
    // --- Achats ---
    'GET achats/commandes': listCommandes,
    'POST achats/commandes': createCommande,
    'GET achats/factures': listFactures,
    'POST achats/factures': createFacture,
  },
  {
    'POST stocks/articles': 201,
    'POST stocks/mouvements': 201,
    'POST stocks/fournisseurs': 201,
    'POST stocks/depots': 201,
    'POST achats/commandes': 201,
    'POST achats/factures': 201,
  },
)

// --- Routes à paramètre (patterns testés dans l'ordre d'enregistrement) ---

// Stocks — articles
registerLocalPattern(/^PUT stocks\/articles\/(\d+)\/stock$/, ajusterStock)
registerLocalPattern(/^PUT stocks\/articles\/(\d+)$/, updateArticle)
// Stocks — fournisseurs
registerLocalPattern(/^PUT stocks\/fournisseurs\/(\d+)$/, updateFournisseur)
// Stocks — dépôts
registerLocalPattern(/^GET stocks\/depots\/(\d+)$/, getDepot)
registerLocalPattern(/^PUT stocks\/depots\/(\d+)$/, updateDepot)
registerLocalPattern(/^DELETE stocks\/depots\/(\d+)$/, deleteDepot, 204)
// Achats — commandes
registerLocalPattern(/^GET achats\/commandes\/(\d+)$/, getCommande)
registerLocalPattern(/^PUT achats\/commandes\/(\d+)$/, updateCommande)
registerLocalPattern(/^DELETE achats\/commandes\/(\d+)$/, deleteCommande, 204)
registerLocalPattern(/^POST achats\/commandes\/(\d+)\/statut$/, changerStatutCommande)
registerLocalPattern(/^GET achats\/commandes\/(\d+)\/receptions$/, listReceptions)
registerLocalPattern(/^POST achats\/commandes\/(\d+)\/receptions$/, creerReception, 201)
// Achats — factures
registerLocalPattern(/^PUT achats\/factures\/(\d+)$/, updateFacture)
registerLocalPattern(/^GET achats\/factures\/(\d+)\/paiements$/, listPaiements)
registerLocalPattern(/^POST achats\/factures\/(\d+)\/paiements$/, creerPaiement, 201)
// Achats — impact chantier
registerLocalPattern(/^GET achats\/impact-chantier\/(\d+)$/, impactChantier)
