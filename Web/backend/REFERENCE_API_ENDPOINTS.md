# REFERENCE API — TIA INFO BUILD Web
## Endpoints FastAPI complets (équivalence Desktop IPC)

---

## AUTHENTIFICATION

### POST `/api/auth/login`
**Description**: Connexion utilisateur
**Request body**:
```json
{ "email": "user@email.mg", "password": "secret123" }
```
**Response** (200):
```json
{ "access_token": "...", "refresh_token": "...", "token_type": "Bearer", "user": {...} }
```

### POST `/api/auth/refresh`
**Description**: Rafraîchir access token via refresh token
**Request body**: `{ "refresh_token": "..." }`
**Response** (200): `{ "access_token": "...", "refresh_token": "...", "token_type": "Bearer" }`

### POST `/api/auth/logout`
**Description**: Invalider refresh token (logout)
**Request body**: `{ "refresh_token": "..." }`
**Response** (200): `{ "message": "Déconnexion réussie" }`

### POST `/api/auth/register`
**Description**: Inscription (admin ou super_admin)
**Request body**: `{ "email": "...", "password": "...", "nom": "...", "entreprise_id": 1, "role_id": 3 }`
**Response** (201): `{...}`

### POST `/api/auth/change-password`
**Description**: Changer mot de passe
**Request body**: `{ "old_password": "...", "new_password": "...", "confirm_password": "..." }`
**Response** (200): `{ "message": "Mot de passe modifié" }`

### GET `/api/auth/me`
**Description**: Utilisateur courant
**Response** (200): `{ "user": {...} }`

### GET `/api/auth/permissions`
**Description**: Permissions utilisateur courant
**Response** (200): `{ "role": "admin_entreprise", "permissions": {...} }`

---

## SUPER ADMIN (propriétaire SaaS)

### GET `/api/super-admin/stats`
**Description**: Statistiques plateforme
**Response** (200):
```json
{
  "total_entreprises": 15,
  "total_utilisateurs": 127,
  "total_chantiers": 43,
  "ca_total": 1250000000.00,
  "entreprises_actives": 13,
  "abonnements": {"gratuit": 5, "premium": 10}
}
```

### GET `/api/super-admin/entreprises`
**Description**: Liste entreprises (pagination)
**Params**: `?page=1&size=25&actif=true&search=...`
**Response** (200): `{ "items": [...], "total": 15, ... }`

### POST `/api/super-admin/entreprises`
**Description**: Créer entreprise
**Request body**: `{ "nom": "...", "email": "...", ... }`
**Response** (201): `{...}`

### PUT `/api/super-admin/entreprises/{id}`
**Description**: Modifier entreprise
**Response** (200): `{...}`

### POST `/api/super-admin/entreprises/{id}/desactiver`
**Description**: Activer/désactiver entreprise
**Response** (200): `{ "actif": true }`

### GET `/api/super-admin/utilisateurs`
**Description**: Tous utilisateurs de la plateforme
**Response** (200): `{ "items": [...], ... }`

---

## UTILISATEURS (admin entreprise)

### GET `/api/utilisateurs`
**Description**: Liste utilisateurs entreprise
**Params**: `?page=1&size=25&search=...`
**Response** (200): `{ "items": [...], "total": 25, ... }`

### POST `/api/utilisateurs`
**Description**: Créer utilisateur
**Request body**: `{ "email": "...", "nom": "...", "prenom": "...", "role_id": 3, "entreprise_id": 1 }`
**Response** (201): `{...}`

### GET `/api/utilisateurs/{id}`
**Response** (200): `{...}`

### PUT `/api/utilisateurs/{id}`
**Description**: Modifier utilisateur (nom, rôle, statut)
**Response** (200): `{...}`

### PUT `/api/utilisateurs/{id}/role`
**Description**: Changer rôle utilisateur
**Request body**: `{ "role_id": 5 }`
**Response** (200): `{...}`

### DELETE `/api/utilisateurs/{id}`
**Description**: Supprimer utilisateur (soft delete)
**Response** (204):

---

## CHANTIERS

### GET `/api/chantiers`
**Params**: `?page=1&size=25&search=&statut=en_cours&client_id=...&chef_id=...`
**Response** (200): `{ "items": [...], "total": N, ... }`

### POST `/api/chantiers`
**Request body**: `{ "nom": "...", "numero": "...", "client_id": 1, ... }`
**Response** (201): `{...}`

### GET `/api/chantiers/{id}`
**Response** (200): `{... phases: [...], incidents: [...], affectations: [...]}`

### PUT `/api/chantiers/{id}`
**Response** (200): `{...}`

### DELETE `/api/chantiers/{id}`
**Response** (204)

### POST `/api/chantiers/{id}/phases`
**Description**: Ajouter phase à chantier
**Request body**: `{ "nom": "...", "date_debut": "...", ... }`

### POST `/api/chantiers/{id}/incidents`
**Description**: Signaler incident

### PUT `/api/chantiers/{id}/statut`
**Request body**: `{ "statut": "en_cours" }`

---

## RH — Employés

### GET `/api/rh/employes`
**Params**: `?page=1&size=25&search=&poste=&statut=`
**Response** (200): `{ "items": [...], "total": N, ... }`

### POST `/api/rh/employes`
**Request body**: `{ "nom": "...", "prenom": "...", "poste": "...", "type_contrat": "CDI", ... }`

### GET `/api/rh/employes/{id}`
**Response** (200): `{... historique_postes: [...]}`

### PUT `/api/rh/employes/{id}`
**Response** (200)

### DELETE `/api/rh/employes/{id}`
**Response** (204)

### POST `/api/rh/employes/{id}/changer-poste`
**Description**: Changer poste + créer historique
**Request body**: `{ "nouveau_poste": "...", "type_contrat": "CDI", "nouveau_salaire": 250000, "date_debut": "...", "motif": "..." }`

---

## RH — Pointages

### GET `/api/rh/pointages`
**Params**: `?date_debut=&date_fin=&employe_id=&chantier_id=`
**Response** (200): `{ "items": [...], ... }`

### POST `/api/rh/pointages`
**Request body**: `{ "employe_id": 1, "chantier_id": 2, "date_jour": "2026-08-18", "heure_debut": "08:00", "heure_fin": "17:00", "type": "present" }`

---

## RH — Équipes

### GET `/api/rh/equipes`
**Params**: `?page=1&size=25&search=&specialite=`

### POST `/api/rh/equipes`
**Request body**: `{ "nom": "...", "chef_equipe_id": 1, "description": "...", "specialite": "..." }`

### GET `/api/rh/equipes/{id}`
**Response**: `{... membres: [...], chantiers_assignes: [...]}`

### POST `/api/rh/equipes/{id}/membres`
**Description**: Ajouter membre à équipe

### DELETE `/api/rh/equipes/{id}/membres/{membre_id}`

### POST `/api/rh/equipes/{id}/chantiers`
**Description**: Assigner chantier à équipe

---

## RH — Heures Supplémentaires

### GET `/api/rh/heures-sup`
**Params**: `?date_debut=&date_fin=&employe_id=&statut=`

### POST `/api/rh/heures-sup`
**Request body**: `{ "employe_id": 1, "date_hs": "...", "nb_heures": 3.5, "taux_majoration": 1.5, ... }`

### PUT `/api/rh/heures-sup/{id}/statut`
**Request body**: `{ "statut": "validee" }`

---

## STOCKS

### GET `/api/stocks/articles`
**Params**: `?page=1&size=25&search=&categorie=&alerte=true`

### POST `/api/stocks/articles`
**Request body**: `{ "nom": "...", "reference": "ART-2026-0001", "categorie": "...", "prix_achat": ..., "prix_vente": ..., "stock_actuel": ... }`

### PUT `/api/stocks/articles/{id}/stock`
**Description**: Ajuster stock (entrée/sortie/inventaire)
**Request body**: `{ "quantite": 50, "type_mouvement": "entree", "prix_unitaire": ..., "fournisseur_id": ... }`

### GET `/api/stocks/articles/en-alerte`
**Description**: Articles avec stock sous seuil

### GET `/api/stocks/fournisseurs`
**Params**: `?page=1&size=25&search=`

### POST `/api/stocks/fournisseurs`

### GET `/api/stocks/mouvements`
**Params**: `?date_debut=&date_fin=&article_id=&type=`

### POST `/api/stocks/mouvements`

---

## COMMERCIAL — Clients

### GET `/api/commercial/clients`
**Params**: `?page=1&size=25&search=&type=particulier`

### POST `/api/commercial/clients`
**Request body**: `{ "nom": "...", "type": "particulier", "email": "...", adresses: [...], ... }`

### GET `/api/commercial/clients/{id}`
**Response**: `{... adresses: [...]}`

### PUT `/api/commercial/clients/{id}`
### DELETE `/api/commercial/clients/{id}`

### POST `/api/commercial/clients/import-csv`
**Description**: Import CSV avec mapping colonnes

### POST `/api/commercial/clients/export-csv`
**Description**: Export CSV

---

## COMMERCIAL — Devis

### GET `/api/commercial/devis`
**Params**: `?page=1&size=25&search=&statut=&client_id=`

### POST `/api/commercial/devis`
**Request body**: `{ "client_id": 1, "objet": "...", "lignes": [{ "description": "...", "quantite": 2, "prix_unitaire": 50000, "taux_tva": 20 }], ... }`
**Note**: Numérotation auto `DEV-YYYY-NNNNN`, calculs auto totaux

### GET `/api/commercial/devis/{id}`
**Response**: `{... lignes: [...]}`

### PUT `/api/commercial/devis/{id}/statut`
**Description**: Changer statut (brouillon → envoyé → accepté)

### POST `/api/commercial/devis/{id}/transformer-contrat`
**Description**: Transformer devis en contrat

---

## COMMERCIAL — Contrats

### GET `/api/commercial/contrats`

### POST `/api/commercial/contrats`

### GET `/api/commercial/contrats/{id}`

### PUT `/api/commercial/contrats/{id}`

### DELETE `/api/commercial/contrats/{id}`

### POST `/api/commercial/contrats/export-csv`

---

## COMMERCIAL — Factures

### GET `/api/commercial/factures`
**Params**: `?page=1&size=25&search=&statut=&client_id=`

### POST `/api/commercial/factures`
**Request body**: `{ "client_id": 1, "contrat_id": 5, "type": "standard", "lignes": [...], ... }`
**Note**: Numérotation auto `FAC-YYYY-NNNNN`, calculs auto

### GET `/api/commercial/factures/{id}`
**Response**: `{... lignes: [...], paiements: [...]}`

### PUT `/api/commercial/factures/{id}`

### POST `/api/commercial/factures/{id}/paiements`
**Description**: Ajouter paiement à facture
**Request body**: `{ "montant": 500000, "date_paiement": "...", "mode_paiement": "virement" }`
**Note**: Met à jour statut facture (emise → partiellement_payee → payee)

### POST `/api/commercial/factures/{id}/dupliquer`
**Description**: Dupliquer facture + lignes

### POST `/api/commercial/factures/export-csv`

---

## COMMERCIAL — Paiements

### GET `/api/commercial/paiements`
**Params**: `?date_debut=&date_fin=&mode_paiement=&facture_id=`

### POST `/api/commercial/paiements`
**Request body**: `{ "facture_id": 1, "montant": ..., "mode_paiement": "espèces", ... }`

### PUT `/api/commercial/paiements/{id}`

### DELETE `/api/commercial/paiements/{id}`

---

## FINANCE — Dépenses

### GET `/api/finance/depenses`
**Params**: `?date_debut=&date_fin=&categorie=&chantier_id=&statut=`

### POST `/api/finance/depenses`
**Request body**: `{ "description": "...", "montant": ..., "date_depense": "...", "categorie": "...", "chantier_id": 1, ... }`

### PUT `/api/finance/depenses/{id}`

### POST `/api/finance/depenses/{id}/valider`
**Description**: Valider dépense (met validee_par)
**Request body**: `{ "validee_par": 5 }`

---

## FINANCE — Rapports

### GET `/api/finance/rapports/mensuel`
**Params**: `?mois=2026-08&entreprise_id=`
**Response** (200):
```json
{
  "ca": 250000000,
  "depenses": 180000000,
  "marge": 70000000,
  "taux_marge": 28.0,
  "top_chantiers": [...],
  "depenses_par_categorie": [...],
  "factures_en_retard": [...]
}
```

---

## FINANCE — Alertes

### GET `/api/finance/alertes`
**Params**: `?date_debut=&date_fin=&categorie=&chantier_id=&statut=`

### POST `/api/finance/alertes`
**Request body**: `{ "titre": "...", "message": "...", "niveau_gravite": "elevee" }`

---

## MATÉRIELS

### GET `/api/materiels`
**Params**: `?page=1&size=25&search=&statut=disponible`

### POST `/api/materiels`

### GET `/api/materiels/{id}`
**Response**: `{... maintenances: [...]}`

### PUT `/api/materiels/{id}`

### POST `/api/materiels/{id}/maintenance`
**Description**: Ajouter maintenance

### POST `/api/materiels/export-csv`

---

## ALERTES (globales)

### GET `/api/alertes`
**Description**: Liste alertes utilisateur
**Params**: `?non_lues=1&gravite=critique&type_entite=`

### POST `/api/alertes/{id}/lue`
**Description**: Marquer comme lue

### POST `/api/alertes/marquer-toutes-lues`

---

## HISTORIQUE CONNEXIONS

### GET `/api/historique-connexions`
**Params**: `?date_debut=&date_fin=&utilisateur_id=&reussi=`

---

## DASHBOARD

### GET `/api/dashboard/stats`
**Description**: KPIs entreprise
**Response** (200):
```json
{
  "ca_mois": 250000000,
  "depenses_mois": 180000000,
  "factures_en_retard": 3,
  "nb_chantiers_actifs": 7,
  "nb_employes": 25,
  "nb_articles": 156,
  "nb_clients": 43,
  "nb_devis": 12,
  "nb_materiels": 34,
  "top_chantiers": [...],
  "ca_evolution": [...],
  "alertes_recentes": [...]
}
```

### GET `/api/dashboard/ca-evolution`
**Params**: `?mois=6`
**Response** (200): `[{ "mois": "2026-03", "ca": 220000000, "depenses": 160000000 }, ...]`

### GET `/api/dashboard/top-chantiers`
**Params**: `?limit=5`

---

## PARAMÈTRES

### GET `/api/parametres/entreprise`
**Response** (200): `{ "entreprise": {...} }`

### PUT `/api/parametres/entreprise`
**Request body**: `{ "nom": "...", "devise": "MGA", ... }`

### PUT `/api/parametres/facturation`
**Request body**: `{ "prefixe_devis": "DEV", "tva_defaut": 20.00, ... }`

### GET `/api/parametres/profile`
**Response** (200): `{ "utilisateur": {...}, "preferences": {...} }`

### PUT `/api/parametres/profile`
**Request body**: `{ "nom": "...", "theme": "dark", ... }`

### POST `/api/parametres/backup`
**Description**: Export backup (SQL/CSV bundle)
**Response** (200): `{ "download_url": "/downloads/backup-20260818.zip" }`

---

## SYNC (pour migration Desktop)

### POST `/api/sync/import-sqlite`
**Description**: Importer base SQLite Desktop
**Content-Type**: multipart/form-data
**File**: `sqlite_file`
**Response** (200): `{ "imported": 1250, "errors": 0, "tables": [...] }`

---

## MAPPINGS DES ENDPOINTS — Desktop IPC → Web REST API

| Namespace Desktop | Méthode Desktop IPC | Endpoint Web |
|-------------------|---------------------|--------------|
| auth | login | POST `/api/auth/login` |
| auth | register | POST `/api/auth/register` |
| auth | logout | POST `/api/auth/logout` |
| auth | me | GET `/api/auth/me` |
| utilisateurs | list | GET `/api/utilisateurs` |
| utilisateurs | create | POST `/api/utilisateurs` |
| utilisateurs | update | PUT `/api/utilisateurs/{id}` |
| utilisateurs | delete | DELETE `/api/utilisateurs/{id}` |
| utilisateurs | updateRole | PUT `/api/utilisateurs/{id}/role` |
| chantiers | list | GET `/api/chantiers` |
| chantiers | create | POST `/api/chantiers` |
| chantiers | update | PUT `/api/chantiers/{id}` |
| chantiers | delete | DELETE `/api/chantiers/{id}` |
| chantiers | addPhase | POST `/api/chantiers/{id}/phases` |
| chantiers | updateStatut | PUT `/api/chantiers/{id}/statut` |
| employes | list | GET `/api/rh/employes` |
| employes | create | POST `/api/rh/employes` |
| employes | update | PUT `/api/rh/employes/{id}` |
| employes | delete | DELETE `/api/rh/employes/{id}` |
| pointages | list | GET `/api/rh/pointages` |
| pointages | create | POST `/api/rh/pointages` |
| heuresSup | list | GET `/api/rh/heures-sup` |
| heuresSup | create | POST `/api/rh/heures-sup` |
| equipes | list | GET `/api/rh/equipes` |
| equipes | create | POST `/api/rh/equipes` |
| equipes | ajouterMembre | POST `/api/rh/equipes/{id}/membres` |
| articles | list | GET `/api/stocks/articles` |
| articles | create | POST `/api/stocks/articles` |
| articles | updateStock | PUT `/api/stocks/articles/{id}/stock` |
| mouvements | list | GET `/api/stocks/mouvements` |
| mouvements | create | POST `/api/stocks/mouvements` |
| fournisseurs | list | GET `/api/stocks/fournisseurs` |
| fournisseurs | create | POST `/api/stocks/fournisseurs` |
| clients | list | GET `/api/commercial/clients` |
| clients | create | POST `/api/commercial/clients` |
| devis | list | GET `/api/commercial/devis` |
| devis | create | POST `/api/commercial/devis` |
| contrats | list | GET `/api/commercial/contrats` |
| contrats | create | POST `/api/commercial/contrats` |
| factures | list | GET `/api/commercial/factures` |
| factures | create | POST `/api/commercial/factures` |
| factures | ajouterPaiement | POST `/api/commercial/factures/{id}/paiements` |
| paiements | list | GET `/api/commercial/paiements` |
| paiements | create | POST `/api/commercial/paiements` |
| depenses | list | GET `/api/finance/depenses` |
| depenses | create | POST `/api/finance/depenses` |
| depenses | valider | POST `/api/finance/depenses/{id}/valider` |
| alertes | list | GET `/api/alertes` |
| alertes | marquerLue | POST `/api/alertes/{id}/lue` |
| materiels | list | GET `/api/materiels` |
| materiels | create | POST `/api/materiels` |
| dashboard | stats | GET `/api/dashboard/stats` |
| dashboard | topChantiers | GET `/api/dashboard/top-chantiers` |
| dashboard | depensesParCategorie | GET `/api/finance/rapports/mensuel` |

---

## 11. CODES STATUS HTTP

| Code | Usage |
|------|-------|
| 200 | Succès (GET, PUT) |
| 201 | Créé (POST) |
| 204 | Supprimé / aucun contenu |
| 400 | Mauvaise requête (validation) |
| 401 | Non authentifié (token manquant/invalide) |
| 403 | Accès refusé (permissions insuffisantes) |
| 404 | Ressource non trouvée |
| 409 | Conflit (email doublon, etc.) |
| 422 | Erreur de validation (Pydantic) |
| 429 | Trop de requêtes (rate limit) |

---

*Document généré le 2026-08-18 — Équivalence complète Desktop IPC ↔ Web REST API*