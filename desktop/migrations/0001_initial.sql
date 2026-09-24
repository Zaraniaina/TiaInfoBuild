-- ============================================================================
-- Migration desktop 0001 — colonnes de versioning de synchronisation
--
-- Le schéma embarqué (schema_init.sql) est généré depuis les modèles du
-- backend web, qui ne connaissent PAS les colonnes de sync desktop.
-- Cette migration ajoute `sync_version` sur les tables synchronisées :
--   * poussée (push) : `base_version` = sync_version local au moment de
--     l'écriture dans l'outbox ;
--   * tirage (pull)  : la version serveur est stockée ici à chaque upsert.
--
-- Idempotence : chaque migration n'est exécutée QUUNE fois (suivie dans
-- PRAGMA user_version). Ne pas ajouter de garde « IF NOT EXISTS » (SQLite
-- ne le supporte pas pour ALTER TABLE).
--
-- PHASE 4 : ajouter les entités restantes ici (stocks, achats, finance…).
-- ============================================================================

ALTER TABLE pointages ADD COLUMN sync_version INTEGER;
ALTER TABLE chantiers ADD COLUMN sync_version INTEGER;
ALTER TABLE employes ADD COLUMN sync_version INTEGER;
