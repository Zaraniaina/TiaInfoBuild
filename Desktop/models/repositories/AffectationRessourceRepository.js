const BaseRepository = require('./BaseRepository');
const db = require('../db');

function emptyToNull(value) {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  return str === '' ? null : str;
}

function toIntOrNull(value) {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

const TYPES_RESSOURCE = ['Employe', 'Materiel'];

class AffectationRessourceRepository extends BaseRepository {
  constructor() {
    super('AffectationRessource');
  }

  getById(id) {
    return db.prepare(`
      SELECT *
      FROM AffectationRessource
      WHERE id = ? AND is_deleted = 0
    `).get(id) || null;
  }

  getByChantier(chantierId) {
    return db.prepare(`
      SELECT ar.*,
             CASE
               WHEN ar.typeRessource = 'Employe'
                 THEN TRIM(COALESCE(e.nom, '') || ' ' || COALESCE(e.prenom, ''))
               WHEN ar.typeRessource = 'Materiel'
                 THEN COALESCE(m.nom, '')
               ELSE ''
             END AS ressourceNom,
             e.poste AS employePoste,
             m.type AS materielType
      FROM AffectationRessource ar
      LEFT JOIN Employe e
        ON ar.typeRessource = 'Employe'
       AND ar.ressourceId = e.id
       AND e.is_deleted = 0
      LEFT JOIN Materiel m
        ON ar.typeRessource = 'Materiel'
       AND ar.ressourceId = m.id
       AND m.is_deleted = 0
      WHERE ar.chantierId = ? AND ar.is_deleted = 0
      ORDER BY ar.dateDebut DESC, ar.id DESC
    `).all(chantierId);
  }

  create(data) {
    const chantierId = toIntOrNull(data?.chantierId);
    if (!chantierId) {
      throw new Error('chantierId est obligatoire pour affecter une ressource');
    }

    const typeRessource = data?.typeRessource;
    if (!TYPES_RESSOURCE.includes(typeRessource)) {
      throw new Error('Type de ressource invalide. Valeurs acceptées : Employe, Materiel');
    }

    const ressourceId = toIntOrNull(data?.ressourceId);
    if (!ressourceId) {
      throw new Error('ressourceId est obligatoire');
    }

    const payload = {
      chantierId,
      typeRessource,
      ressourceId,
      dateDebut: emptyToNull(data.dateDebut),
      dateFin: emptyToNull(data.dateFin),
      role: emptyToNull(data.role),
      is_synced: 0,
      is_deleted: 0
    };

    const info = db.prepare(`
      INSERT INTO AffectationRessource (
        chantierId, typeRessource, ressourceId, dateDebut, dateFin, role,
        is_synced, is_deleted
      ) VALUES (
        @chantierId, @typeRessource, @ressourceId, @dateDebut, @dateFin, @role,
        @is_synced, @is_deleted
      )
    `).run(payload);

    return this.getById(info.lastInsertRowid);
  }

  update(id, data) {
    const existing = this.getById(id);
    if (!existing) {
      throw new Error('Affectation introuvable');
    }

    const payload = {};

    if ('typeRessource' in data) {
      if (!TYPES_RESSOURCE.includes(data.typeRessource)) {
        throw new Error('Type de ressource invalide. Valeurs acceptées : Employe, Materiel');
      }
      payload.typeRessource = data.typeRessource;
    }

    if ('ressourceId' in data) {
      payload.ressourceId = toIntOrNull(data.ressourceId);
      if (!payload.ressourceId) {
        throw new Error('ressourceId est obligatoire');
      }
    }

    if ('dateDebut' in data) payload.dateDebut = emptyToNull(data.dateDebut);
    if ('dateFin' in data) payload.dateFin = emptyToNull(data.dateFin);
    if ('role' in data) payload.role = emptyToNull(data.role);

    const fields = Object.keys(payload);

    if (fields.length > 0) {
      const setClause = fields.map(field => `${field} = @${field}`).join(', ');

      db.prepare(`
        UPDATE AffectationRessource
        SET ${setClause}, updated_at = CURRENT_TIMESTAMP
        WHERE id = @id AND is_deleted = 0
      `).run({
        ...payload,
        id
      });
    }

    return this.getById(id);
  }

  softDelete(id) {
    const existing = this.getById(id);
    if (!existing) {
      throw new Error('Affectation introuvable');
    }

    db.prepare(`
      UPDATE AffectationRessource
      SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);

    return { id };
  }
}

module.exports = AffectationRessourceRepository;