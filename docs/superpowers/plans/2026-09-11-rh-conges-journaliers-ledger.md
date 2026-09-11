# Ledger — Exécution plan RH (2026-09-11)

Branche : `testx` · Venv : `Web/backend/env` · Alembic head : `019_add_platform_settings_table`

| Tâche | Statut | Commits | Revue | Notes |
|---|---|---|---|---|
| Mode | — | — | — | Pas d'outil de dispatch de sous-agents dans la session → exécution inline (équivalent executing-plans), discipline TDD + revue spec par tâche conservée. |
| Task 0 | fait | (commit infra) | OK | Infra tests validée : smoke 2/2 PASS. Override sur le VRAI nom `app.security.get_current_user` ; préfixes réels `/api/rh`, `/api/employe-terrain`. |
| Task 1 | à faire | | | Migration 020 → down_revision `019_add_platform_settings_table` |
| Task 2 | à faire | | | Modèle Conge + Employe étendu |
| Task 3 | à faire | | | Schémas Pydantic |
| Task 4 | à faire | | | CongeCRUD |
| Task 5 | à faire | | | Endpoints /rh/conges |
| Task 6 | à faire | | | /rh/paie + CSV |
| Task 7 | à faire | | | /employe-terrain/conges self-only |
| Task 8 | à faire | | | Frontend types+services |
| Task 9–12 | à faire | | | UI RhPage, EmployeCongesPage, badge, fiche employé |
| Task 13 | à faire | | | Validation finale |

