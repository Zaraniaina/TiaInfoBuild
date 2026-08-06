// Desktop/models/repositories/EmployeRepository.js
const BaseRepository = require('./BaseRepository');
const db = require('../db');

class EmployeRepository extends BaseRepository {
  constructor() {
    super('Employe');
  }

  getWithRelations(id) {
    const employe = this.getById(id);
    if (!employe) return null;

    const equipes = db.prepare(`
      SELECT e.*, me.dateAffectation
      FROM Equipe e
      JOIN MembreEquipe me ON e.id = me.equipeId
      WHERE me.employeId = ? AND e.is_deleted = 0 AND me.is_deleted = 0
    `).all(id);

    const affectations = db.prepare(`
      SELECT ac.*, c.nom as chantierNom, c.statut as chantierStatut
      FROM AffectationChantier ac
      JOIN Chantier c ON ac.chantierId = c.id
      WHERE ac.employeId = ? AND ac.is_deleted = 0 AND c.is_deleted = 0
      ORDER BY ac.dateDebut DESC
    `).all(id);

    const pointages = db.prepare(`
      SELECT p.*, c.nom as chantierNom
      FROM Pointage p
      LEFT JOIN Chantier c ON p.chantierId = c.id AND c.is_deleted = 0
      WHERE p.employeId = ? AND p.is_deleted = 0 AND p.dateJour >= date('now', '-30 days')
      ORDER BY p.dateJour DESC
    `).all(id);

    const heuresSup = db.prepare(`
      SELECT hs.*, c.nom as chantierNom
      FROM HeureSupplementaire hs
      LEFT JOIN Chantier c ON hs.chantierId = c.id AND c.is_deleted = 0
      WHERE hs.employeId = ? AND hs.is_deleted = 0 AND hs.dateJour >= date('now', '-30 days')
      ORDER BY hs.dateJour DESC
    `).all(id);

    return { ...employe, equipes, affectations, pointages, heuresSup };
  }

  getListWithStats(options = {}) {
    const { entrepriseId, limit = 50, offset = 0, statut, search } = options;
    let whereClause = '';
    const params = [];

    if (statut) {
      whereClause += ' AND e.statut = ?';
      params.push(statut);
    }
    if (search) {
      whereClause += ' AND (e.nom LIKE ? OR e.prenom LIKE ? OR e.matricule LIKE ? OR e.poste LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    let tenantWhere = this._entrepriseWhere(entrepriseId, 'e');
    if (whereClause) tenantWhere += whereClause;

    const sql = `
      SELECT e.*,
        (SELECT COUNT(*) FROM Pointage WHERE employeId = e.id AND is_deleted = 0 AND dateJour >= date('now', '-30 days')) as nbPointagesMois,
        (SELECT COUNT(*) FROM HeureSupplementaire WHERE employeId = e.id AND is_deleted = 0 AND dateJour >= date('now', '-30 days')) as nbHeuresSupMois
      FROM Employe e
      ${tenantWhere}
      ORDER BY e.nom, e.prenom
      LIMIT ? OFFSET ?
    `;
    const stmt = db.prepare(sql);
    return stmt.all(...params, limit, offset);
  }

  getPresentsToday(entrepriseId) {
    const today = new Date().toISOString().split('T')[0];
    const sql = `
      SELECT e.*, p.heureArrivee, p.heureDepart, p.statut as pointageStatut, c.nom as chantierNom
      FROM Employe e
      LEFT JOIN Pointage p ON e.id = p.employeId AND p.dateJour = ? AND p.is_deleted = 0
      LEFT JOIN Chantier c ON p.chantierId = c.id AND c.is_deleted = 0
      ${this._entrepriseWhere(entrepriseId, 'e')}
      AND e.statut = 'actif'
      ORDER BY e.nom, e.prenom
    `;
    return db.prepare(sql).all(today);
  }

  pointer(data) {
    const { employeId, chantierId, heureArrivee, heureDepart, statut } = data;
    const today = new Date().toISOString().split('T')[0];

    const existing = db.prepare(`
      SELECT * FROM Pointage WHERE employeId = ? AND dateJour = ? AND is_deleted = 0
    `).get(employeId, today);

    if (existing) {
      db.prepare(`
        UPDATE Pointage
        SET chantierId = COALESCE(?, chantierId), heureArrivee = COALESCE(?, heureArrivee),
            heureDepart = COALESCE(?, heureDepart), statut = COALESCE(?, statut),
            is_synced = 0, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(chantierId, heureArrivee, heureDepart, statut, existing.id);
      return db.prepare('SELECT * FROM Pointage WHERE id = ?').get(existing.id);
    } else {
      const PointageRepository = require('./PointageRepository');
      return new PointageRepository().create({
        employeId,
        chantierId,
        dateJour: today,
        heureArrivee,
        heureDepart,
        statut: statut || 'present'
      });
    }
  }

  getDashboardStats(entrepriseId) {
    const stats = {};

    const total = db.prepare(`SELECT COUNT(*) as count FROM Employe WHERE entrepriseId = ? AND is_deleted = 0`).get(entrepriseId);
    stats.effectifTotal = total.count;

    const parStatut = db.prepare(`
      SELECT statut, COUNT(*) as count FROM Employe
      WHERE entrepriseId = ? AND is_deleted = 0 GROUP BY statut
    `).all(entrepriseId);
    stats.parStatut = parStatut.reduce((acc, row) => { acc[row.statut] = row.count; return acc; }, {});

    const today = new Date().toISOString().split('T')[0];
    const presents = db.prepare(`
      SELECT COUNT(DISTINCT e.id) as count
      FROM Employe e
      JOIN Pointage p ON e.id = p.employeId
      WHERE e.entrepriseId = ? AND e.is_deleted = 0 AND p.is_deleted = 0
      AND p.dateJour = ? AND p.statut IN ('present', 'retard')
    `).get(entrepriseId, today);
    stats.presentsAujourdhui = presents.count;

    const debutMois = new Date();
    debutMois.setDate(1);
    const debutMoisStr = debutMois.toISOString().split('T')[0];
    const hs = db.prepare(`
      SELECT SUM(nombreHeures) as total
      FROM HeureSupplementaire hs
      JOIN Employe e ON hs.employeId = e.id
      WHERE e.entrepriseId = ? AND hs.is_deleted = 0 AND e.is_deleted = 0 AND hs.dateJour >= ?
    `).get(entrepriseId, debutMoisStr);
    stats.heuresSupMois = hs.total || 0;

    const enAlerte = db.prepare(`
      SELECT COUNT(*) as count FROM Employe e
      WHERE e.entrepriseId = ? AND e.is_deleted = 0 AND e.statut = 'actif'
      AND NOT EXISTS (SELECT 1 FROM Pointage p WHERE p.employeId = e.id AND p.is_deleted = 0 AND p.dateJour >= date('now', '-3 days'))
    `).get(entrepriseId);
    stats.employesEnAlerte = enAlerte.count;

    return stats;
  }

  createWithValidation(data, entrepriseId) {
    if (!data.nom || !data.nom.trim()) throw new Error('Le nom est obligatoire');
    if (!data.prenom || !data.prenom.trim()) throw new Error('Le prénom est obligatoire');

    if (data.matricule) {
      const existing = db.prepare(`SELECT id FROM Employe WHERE entrepriseId = ? AND matricule = ? AND is_deleted = 0`).get(entrepriseId, data.matricule);
      if (existing) throw new Error('Ce matricule existe déjà');
    }

    return this.create({
      ...data,
      nom: data.nom.trim(),
      prenom: data.prenom.trim(),
      entrepriseId,
      statut: data.statut || 'actif',
      salaireBase: data.salaireBase || 0
    }, entrepriseId);
  }
}

module.exports = EmployeRepository;