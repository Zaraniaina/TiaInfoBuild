-- Script SQL sécurisé pour appliquer les changements de la migration 011
-- Vérifie l'existence avant chaque ajout pour éviter les erreurs du type "Duplicate column"

-- 1. Ajouter categorie sur lignes_devis si elle n'existe pas
SET @sql := (
    SELECT IF(
        EXISTS(
            SELECT * FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'lignes_devis'
              AND COLUMN_NAME = 'categorie'
        ),
        'SELECT 1 AS already_exists',
        'ALTER TABLE lignes_devis ADD COLUMN categorie VARCHAR(50) NULL'
    )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Ajouter montant_tva sur factures si elle n'existe pas
SET @sql := (
    SELECT IF(
        EXISTS(
            SELECT * FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'factures'
              AND COLUMN_NAME = 'montant_tva'
        ),
        'SELECT 1 AS already_exists',
        'ALTER TABLE factures ADD COLUMN montant_tva NUMERIC(12,2) NOT NULL DEFAULT 0'
    )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Ajouter montant_acompte_deduit sur factures si elle n'existe pas
SET @sql := (
    SELECT IF(
        EXISTS(
            SELECT * FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'factures'
              AND COLUMN_NAME = 'montant_acompte_deduit'
        ),
        'SELECT 1 AS already_exists',
        'ALTER TABLE factures ADD COLUMN montant_acompte_deduit NUMERIC(12,2) NOT NULL DEFAULT 0'
    )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. Ajouter reste_a_payer sur factures si elle n'existe pas
SET @sql := (
    SELECT IF(
        EXISTS(
            SELECT * FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'factures'
              AND COLUMN_NAME = 'reste_a_payer'
        ),
        'SELECT 1 AS already_exists',
        'ALTER TABLE factures ADD COLUMN reste_a_payer NUMERIC(12,2) NOT NULL DEFAULT 0'
    )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 5. Créer la table lignes_factures si elle n'existe pas
SET @sql := (
    SELECT IF(
        EXISTS(
            SELECT * FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'lignes_factures'
        ),
        'SELECT 1 AS already_exists',
        'CREATE TABLE lignes_factures (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            facture_id BIGINT NOT NULL,
            type VARCHAR(20) DEFAULT ''article'',
            article_id BIGINT NULL,
            description TEXT NOT NULL,
            categorie VARCHAR(50) NULL,
            quantite NUMERIC(10,2) DEFAULT 0,
            unite VARCHAR(20) NULL,
            prix_unitaire NUMERIC(10,2) DEFAULT 0,
            remise NUMERIC(5,2) DEFAULT 0,
            taux_tva NUMERIC(5,2) DEFAULT 20.00,
            total_ht NUMERIC(12,2) DEFAULT 0,
            total_ttc NUMERIC(12,2) DEFAULT 0,
            ordre INTEGER DEFAULT 0,
            is_deleted BOOLEAN DEFAULT FALSE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (facture_id) REFERENCES factures(id) ON DELETE CASCADE,
            FOREIGN KEY (article_id) REFERENCES articles(id),
            INDEX idx_lignes_factures_facture_id (facture_id),
            INDEX idx_lignes_factures_article_id (article_id)
        )'
    )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 6. Créer les index sur lignes_factures si la table existe
SET @sql := (
    SELECT IF(
        EXISTS(
            SELECT * FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'lignes_factures'
        ),
        'SELECT 1 AS already_exists',
        'CREATE INDEX idx_lignes_factures_facture_id ON lignes_factures (facture_id); CREATE INDEX idx_lignes_factures_article_id ON lignes_factures (article_id);'
    )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
