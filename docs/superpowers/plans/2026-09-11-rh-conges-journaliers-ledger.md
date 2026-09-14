# Ledger — Exécution plan RH (2026-09-11)

Branche : `testx` · Venv : `Web/backend/env` · Alembic head : `019_add_platform_settings_table`

| Tâche | Statut | Commits | Revue | Notes |
|---|---|---|---|---|
| Mode | — | — | — | Pas d'outil de dispatch de sous-agents dans la session → exécution inline (équivalent executing-plans), discipline TDD + revue spec par tâche conservée. |
| Task 0 | fait | (commit infra) | OK | Infra tests validée : smoke 2/2 PASS. Override sur le VRAI nom `app.security.get_current_user` ; préfixes réels `/api/rh`, `/api/employe-terrain`. |
| Task 1 | fait | 416929a | OK | Migration appliquée sur MySQL (conges + 8 cols employes + documents.employe_id int(11) FK). NB: employes.id = int(11) réel → FK Integer, pas BigInteger (errno 150 corrigé). |
| Task 2 | fait | 416929a | OK | Modele Conge + Employe étendu + Document.employe_id (ForeignKey int). alembic_version=020. |
| Task 3 | fait | f200519 | OK | schemas/conge.py (CongeCreate/Decision/Response/List + TYPES_VALIDES) ; employe.py : +8 champs Create/Update/Response, type_contrat +JOURNALIER (uppercase), validators mode_remuneration/statut_declaration. Import-check OK, smoke 2/2 PASS. |
| Task 4 | fait | 8bc6a64 | OK | CongeCRUD (list scope, solde_restant, decide anti-409). 6/6 PASS. Fix: __init__ modèle + typo db_session + datetime.now(). |
| Task 5 | fait | 298c75c | OK | Endpoints /rh/conges (create/list/valider/refuser/solde). Notification cible utilisateur via email employe. 12/12 PASS. NB: role employe a deja rh:read dans RBAC existant; 403 verifie avec role client. |
| Task 6 | fait | e2e9750 | OK | /rh/paie + /rh/paie/export CSV (journalier/horaire/mensuel). Mensuel plein si 0 pointage. 16/16 PASS. Fix: _heures_du_pointage sync, employe_id=None explicite. |
| Task 7 | fait | 7641307 | OK | /employe-terrain/conges self-only (demande/liste/annulation). employe_id forcé serveur. 20/20 PASS. Prefixe /api/employe-terrain confirmé main.py:186. |
| Task 8 | fait | dd11ef5 | OK | Frontend types (Conge, CongeListe, SoldeConge, LignePaie, RapportPaie) + services rh/terrain (conges + paie + export CSV). tsc --noEmit 0 erreur. |
| Task 9 | fait | 1ed9f34 | OK | Onglets Conges (RhCongesTab) + Paie (RhPaieTab) dans RhPage + formulaire employé étendu (mode rémunération, taux, CNAPS/OSTIE, solde congés). tsc 0 erreur. |
| Task 11 | fait | 1f889e2 | OK | Badge QR imprimable avec photo + CSS print (85mm). |
| Task 12 | fait | eae0b16 | OK | Documents RH par employé (liste + création, catégories). |
| Task 13 | fait | (même commit) | OK | Validation finale : 24/24 tests backend PASS, tsc --noEmit 0 erreur, graphify update OK. Ledger propre. |

