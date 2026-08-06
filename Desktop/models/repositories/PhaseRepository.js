// Desktop/models/repositories/PhaseRepository.js
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
function toFloatOrZero(value) {
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}
function normalizeAvancement(value) {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) return 0;
  return Math.max(0, Math.min(100, parsed));
}

class PhaseRepository extends BaseRepository {
  constructor() {
    super('Phase');
  }

  getById(id) {
    const row = db.prepare(`SELECT * FROM Phase WHERE id = ? AND is_deleted = 0`).get(id);
    if (!row) return null;
    return { ...row, avancement: row.avancementPct ?? 0 };
  }

  getByChantier(chantierId) {
    return db.prepare(`
      SELECT * FROM Phase WHERE chantierId = ? AND is_deleted = 0 ORDER BY ordre, id
    `).all(chantierId).map(row => ({ ...row, avancement: row.avancementPct ?? 0 }));
  }

  create(data) {
    const chantierId = toIntOrNull(data?.chantierId);
    if (!chantierId) throw new Error('chantierId est obligatoire pour créer une phase');
    const nom = String(data?.nom || '').trim();
    if (!nom) throw new Error('Le nom de la phase est obligatoire');

    const payload = {
      chantierId,
      nom,
      description: emptyToNull(data.description),
      dateDebut: emptyToNull(data.dateDebut),
      dateFin: emptyToNull(data.dateFin),
      budget: toFloatOrZero(data.budget),
      avancementPct: normalizeAvancement(data.avancementPct ?? data.avancement),
      statut: data.statut || 'non_commencee',
      ordre: parseInt(data.ordre, 10) || 1,
      is_synced: 0,
      is_deleted: 0
    };

    const info = db.prepare(`
      INSERT INTO Phase (chantierId, nom, description, dateDebut, dateFin, budget, avancementPct, statut, ordre, is_synced, is_deleted)
      VALUES (@chantierId, @nom, @description, @dateDebut, @dateFin, @budget, @avancementPct, @statut, @ordre, @is_synced, @is_deleted)
    `).run(payload);
    return this.getById(info.lastInsertRowid);
  }

  update(id, data) {
    const existing = this.getById(id);
    if (!existing) throw new Error('Phase introuvable');

    const payload = {};
    if ('nom' in data) {
      const nom = String(data.nom || '').trim();
      if (!nom) throw new Error('Le nom de la phase est obligatoire');
      payload.nom = nom;
    }
    if ('description' in data) payload.description = emptyToNull(data.description);
    if ('dateDebut' in data) payload.dateDebut = emptyToNull(data.dateDebut);
    if ('dateFin' in data) payload.dateFin = emptyToNull(data.dateFin);
    if ('budget' in data) payload.budget = toFloatOrZero(data.budget);
    if ('statut' in data) payload.statut = data.statut || 'non_commencee';
    if ('ordre' in data) payload.ordre = parseInt(data.ordre, 10) || existing.ordre;
    if ('avancementPct' in data || 'avancement' in data) {
      payload.avancementPct = normalizeAvancement(data.avancementPct ?? data.avancement);
    }

    const fields = Object.keys(payload);
    if (fields.length > 0) {
      const setClause = fields.map(f => `${f} = @${f}`).join(', ');
      db.prepare(`UPDATE Phase SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = @id AND is_deleted = 0`).run({ ...payload, id });
    }
    return this.getById(id);
  }

  softDelete(id) {
    const existing = this.getById(id);
    if (!existing) throw new Error('Phase introuvable');
    db.prepare(`UPDATE Phase SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(id);
    return { id };
  }

  updateAvancement(id, pct) {
    const existing = this.getById(id);
    if (!existing) throw new Error('Phase introuvable');
    const avancementPct = normalizeAvancement(pct);
    db.prepare(`UPDATE Phase SET avancementPct = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND is_deleted = 0`).run(avancementPct, id);
    return this.getById(id);
  }

  reorder(chantierId, ids) {
    if (!Array.isArray(ids)) throw new Error('ids doit être un tableau');
    const stmt = db.prepare(`
      UPDATE Phase SET ordre = ?, updated_at = CURRENT_TIMESTAMP
      WHERE chantierId = ? AND id = ? AND is_deleted = 0
    `);
    const transaction = db.transaction(() => {
      ids.forEach((id, index) => stmt.run(index + 1, chantierId, id));
    });
    transaction();
    return this.getByChantier(chantierId);
  }

  getAvancementGlobal(chantierId) {
    const row = db.prepare(`SELECT AVG(avancementPct) AS avg FROM Phase WHERE chantierId = ? AND is_deleted = 0`).get(chantierId);
    return Math.round(row?.avg || 0);
  }
}

module.exports = PhaseRepository;