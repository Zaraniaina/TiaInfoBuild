// Desktop/models/repositories/IncidentRepository.js
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

class IncidentRepository extends BaseRepository {
  constructor() {
    super('Incident');
  }

  getById(id) {
    return db.prepare(`SELECT * FROM Incident WHERE id = ? AND is_deleted = 0`).get(id) || null;
  }

  getByChantier(chantierId) {
    return db.prepare(`
      SELECT i.*, u.nom AS declareParNom, u.prenom AS declareParPrenom
      FROM Incident i
      LEFT JOIN Utilisateur u ON i.declarePar = u.id AND u.is_deleted = 0
      WHERE i.chantierId = ? AND i.is_deleted = 0
      ORDER BY i.dateIncident DESC, i.id DESC
    `).all(chantierId);
  }

  create(data) {
    const chantierId = toIntOrNull(data?.chantierId);
    if (!chantierId) throw new Error('chantierId est obligatoire pour créer un incident');
    const titre = String(data?.titre || '').trim();
    if (!titre) throw new Error("Le titre de l'incident est obligatoire");

    const payload = {
      chantierId,
      declarePar: toIntOrNull(data.declarePar),
      titre,
      description: emptyToNull(data.description),
      dateIncident: data.dateIncident || new Date().toISOString().split('T')[0],
      gravite: data.gravite || 'moyenne',
      statut: data.statut || 'signale',
      is_synced: 0,
      is_deleted: 0
    };

    const info = db.prepare(`
      INSERT INTO Incident (chantierId, declarePar, titre, description, dateIncident, gravite, statut, is_synced, is_deleted)
      VALUES (@chantierId, @declarePar, @titre, @description, @dateIncident, @gravite, @statut, @is_synced, @is_deleted)
    `).run(payload);
    return this.getById(info.lastInsertRowid);
  }

  update(id, data) {
    const existing = this.getById(id);
    if (!existing) throw new Error('Incident introuvable');

    const payload = {};
    if ('titre' in data) {
      const titre = String(data.titre || '').trim();
      if (!titre) throw new Error("Le titre de l'incident est obligatoire");
      payload.titre = titre;
    }
    if ('description' in data) payload.description = emptyToNull(data.description);
    if ('dateIncident' in data) payload.dateIncident = emptyToNull(data.dateIncident);
    if ('gravite' in data) payload.gravite = data.gravite || existing.gravite;
    if ('statut' in data) payload.statut = data.statut || existing.statut;

    const fields = Object.keys(payload);
    if (fields.length > 0) {
      const setClause = fields.map(f => `${f} = @${f}`).join(', ');
      db.prepare(`UPDATE Incident SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = @id AND is_deleted = 0`).run({ ...payload, id });
    }
    return this.getById(id);
  }

  softDelete(id) {
    const existing = this.getById(id);
    if (!existing) throw new Error('Incident introuvable');
    db.prepare(`UPDATE Incident SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(id);
    return { id };
  }

  changerStatut(id, statut) {
    const statutsValides = ['signale', 'en_cours', 'resolu', 'clos'];
    if (!statutsValides.includes(statut)) {
      throw new Error(`Statut invalide. Valeurs acceptées : ${statutsValides.join(', ')}`);
    }
    return this.update(id, { statut });
  }

  getOuvertsByEntreprise(entrepriseId) {
    return db.prepare(`
      SELECT i.*, c.nom AS chantierNom
      FROM Incident i
      JOIN Chantier c ON i.chantierId = c.id
      WHERE c.entrepriseId = ? AND i.is_deleted = 0 AND c.is_deleted = 0
      AND i.statut IN ('signale', 'en_cours')
      ORDER BY CASE i.gravite WHEN 'critique' THEN 1 WHEN 'elevee' THEN 2 WHEN 'moyenne' THEN 3 WHEN 'faible' THEN 4 ELSE 5 END,
        i.dateIncident DESC
    `).all(entrepriseId);
  }
}

module.exports = IncidentRepository;