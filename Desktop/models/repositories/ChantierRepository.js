const BaseRepository = require('./BaseRepository');
const db = require('../db');
const PhaseRepository = require('./PhaseRepository');
const IncidentRepository = require('./IncidentRepository');

const STATUTS_CHANTIER = ['planification', 'en_cours', 'termine', 'arrete'];

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

class ChantierRepository extends BaseRepository {
  constructor() {
    super('Chantier');
    this.phaseRepo = new PhaseRepository();
    this.incidentRepo = new IncidentRepository();
  }

  normalizeStatut(statut) {
    if (!statut) return 'planification';
    if (statut === 'planifie') return 'planification';
    return STATUTS_CHANTIER.includes(statut) ? statut : 'planification';
  }

  getById(id) {
    return db.prepare(`
      SELECT *
      FROM Chantier
      WHERE id = ? AND is_deleted = 0
    `).get(id) || null;
  }

  getWithRelations(id) {
    const chantier = this.getById(id);
    if (!chantier) return null;

    const phases = db.prepare(`
      SELECT *
      FROM Phase
      WHERE chantierId = ? AND is_deleted = 0
      ORDER BY ordre, id
    `).all(id).map(phase => ({
      ...phase,
      avancement: phase.avancementPct ?? 0
    }));

    const incidents = db.prepare(`
      SELECT i.*,
             u.nom AS declareParNom,
             u.prenom AS declareParPrenom
      FROM Incident i
      LEFT JOIN Utilisateur u ON i.declarePar = u.id AND u.is_deleted = 0
      WHERE i.chantierId = ? AND i.is_deleted = 0
      ORDER BY i.dateIncident DESC, i.id DESC
    `).all(id);

    const affectations = db.prepare(`
      SELECT ar.*,
             e.nom AS employeNom,
             e.prenom AS employePrenom,
             m.nom AS materielNom,
             m.type AS materielType
      FROM AffectationRessource ar
      LEFT JOIN Employe e ON ar.typeRessource = 'Employe' AND ar.ressourceId = e.id AND e.is_deleted = 0
      LEFT JOIN Materiel m ON ar.typeRessource = 'Materiel' AND ar.ressourceId = m.id AND m.is_deleted = 0
      WHERE ar.chantierId = ? AND ar.is_deleted = 0
      ORDER BY ar.dateDebut
    `).all(id);

    let client = null;
    if (chantier.clientId) {
      client = db.prepare(`
        SELECT *
        FROM Client
        WHERE id = ? AND is_deleted = 0
      `).get(chantier.clientId) || null;
    }

    let responsable = null;
    if (chantier.chefChantierId) {
      responsable = db.prepare(`
        SELECT id, nom, prenom, email
        FROM Utilisateur
        WHERE id = ? AND is_deleted = 0
      `).get(chantier.chefChantierId) || null;
    }

    const budgetPrevu = chantier.budgetPrevu ?? chantier.budgetPrevisionnel ?? 0;

    return {
      ...chantier,
      statut: this.normalizeStatut(chantier.statut),
      budgetPrevu,
      budgetPrevisionnel: budgetPrevu,
      budgetReel: chantier.budgetReel ?? 0,
      phases,
      incidents,
      affectations,
      client,
      responsable,
      chefChantier: responsable
    };
  }

  _buildOrderBy(tri) {
    switch (tri) {
      case 'dateCreation_asc':
        return 'c.created_at ASC, c.id ASC';
      case 'nom_asc':
        return 'c.nom COLLATE NOCASE ASC, c.id ASC';
      case 'budget_desc':
        return 'COALESCE(c.budgetPrevu, c.budgetPrevisionnel, 0) DESC, c.id DESC';
      case 'dateCreation_desc':
      default:
        return 'c.created_at DESC, c.id DESC';
    }
  }

  getListWithStats(options = {}) {
    const {
      entrepriseId = null,
      limit = 50,
      offset = 0,
      statut = null,
      search = null,
      tri = 'dateCreation_desc'
    } = options;

    const where = ['c.is_deleted = 0'];
    const params = {};

    if (entrepriseId) {
      where.push('c.entrepriseId = @entrepriseId');
      params.entrepriseId = entrepriseId;
    }

    if (statut) {
      if (statut === 'planification' || statut === 'planifie') {
        where.push('(c.statut = @statut1 OR c.statut = @statut2)');
        params.statut1 = 'planification';
        params.statut2 = 'planifie';
      } else {
        where.push('c.statut = @statut');
        params.statut = statut;
      }
    }

    if (search) {
      where.push(`(
        c.nom LIKE @search
        OR c.numero LIKE @search
        OR c.adresse LIKE @search
        OR c.ville LIKE @search
        OR c.description LIKE @search
        OR cl.nom LIKE @search
        OR cl.prenom LIKE @search
        OR cl.entreprise LIKE @search
      )`);
      params.search = `%${search}%`;
    }

    const sql = `
      SELECT c.*,
             COALESCE(c.budgetPrevu, c.budgetPrevisionnel, 0) AS budgetPrevuCalc,
             COALESCE(c.budgetReel, 0) AS budgetReelCalc,
             cl.nom AS clientNom,
             cl.prenom AS clientPrenom,
             cl.entreprise AS clientEntreprise,
             u.nom AS chefNom,
             u.prenom AS chefPrenom,
             (SELECT COUNT(*) FROM Phase p WHERE p.chantierId = c.id AND p.is_deleted = 0) AS nbPhases,
             (SELECT COUNT(*) FROM Incident i WHERE i.chantierId = c.id AND i.is_deleted = 0) AS nbIncidents,
             (SELECT COUNT(*) FROM AffectationRessource ar WHERE ar.chantierId = c.id AND ar.is_deleted = 0) AS nbRessources,
             (SELECT AVG(p2.avancementPct) FROM Phase p2 WHERE p2.chantierId = c.id AND p2.is_deleted = 0) AS avancementGlobal
      FROM Chantier c
      LEFT JOIN Client cl ON cl.id = c.clientId AND cl.is_deleted = 0
      LEFT JOIN Utilisateur u ON u.id = c.chefChantierId AND u.is_deleted = 0
      WHERE ${where.join(' AND ')}
      ORDER BY ${this._buildOrderBy(tri)}
      LIMIT @limit OFFSET @offset
    `;

    const rows = db.prepare(sql).all({
      ...params,
      limit: Math.max(1, parseInt(limit, 10) || 50),
      offset: Math.max(0, parseInt(offset, 10) || 0)
    });

    return rows.map(row => this._mapListRow(row));
  }

  countWithFilters(options = {}) {
    const {
      entrepriseId = null,
      statut = null,
      search = null
    } = options;

    const where = ['c.is_deleted = 0'];
    const params = {};

    if (entrepriseId) {
      where.push('c.entrepriseId = @entrepriseId');
      params.entrepriseId = entrepriseId;
    }

    if (statut) {
      if (statut === 'planification' || statut === 'planifie') {
        where.push('(c.statut = @statut1 OR c.statut = @statut2)');
        params.statut1 = 'planification';
        params.statut2 = 'planifie';
      } else {
        where.push('c.statut = @statut');
        params.statut = statut;
      }
    }

    if (search) {
      where.push(`(
        c.nom LIKE @search
        OR c.numero LIKE @search
        OR c.adresse LIKE @search
        OR c.ville LIKE @search
        OR c.description LIKE @search
        OR cl.nom LIKE @search
        OR cl.prenom LIKE @search
        OR cl.entreprise LIKE @search
      )`);
      params.search = `%${search}%`;
    }

    const sql = `
      SELECT COUNT(*) AS total
      FROM Chantier c
      LEFT JOIN Client cl ON cl.id = c.clientId AND cl.is_deleted = 0
      WHERE ${where.join(' AND ')}
    `;

    const result = db.prepare(sql).get(params);
    return result?.total || 0;
  }

  _mapListRow(row) {
    const client = row.clientId && (row.clientNom || row.clientPrenom || row.clientEntreprise)
      ? {
          id: row.clientId,
          nom: row.clientNom || '',
          prenom: row.clientPrenom || '',
          entreprise: row.clientEntreprise || ''
        }
      : null;

    const responsable = row.chefChantierId && (row.chefNom || row.chefPrenom)
      ? {
          id: row.chefChantierId,
          nom: row.chefNom || '',
          prenom: row.chefPrenom || ''
        }
      : null;

    const budgetPrevu = row.budgetPrevuCalc ?? row.budgetPrevu ?? row.budgetPrevisionnel ?? 0;

    return {
      ...row,
      statut: this.normalizeStatut(row.statut),
      budgetPrevu,
      budgetPrevisionnel: budgetPrevu,
      budgetReel: row.budgetReelCalc ?? row.budgetReel ?? 0,
      avancementGlobal: Math.round(row.avancementGlobal || 0),
      client,
      responsable,
      chefChantier: responsable
    };
  }

  getDashboardStats(entrepriseId) {
    const stats = {};

    const parStatut = db.prepare(`
      SELECT statut, COUNT(*) AS count
      FROM Chantier
      WHERE entrepriseId = ? AND is_deleted = 0
      GROUP BY statut
    `).all(entrepriseId);

    stats.parStatut = parStatut.reduce((acc, row) => {
      const statut = this.normalizeStatut(row.statut);
      acc[statut] = (acc[statut] || 0) + row.count;
      return acc;
    }, {});

    const budgets = db.prepare(`
      SELECT
        SUM(COALESCE(budgetPrevu, budgetPrevisionnel, 0)) AS budgetPrevuTotal,
        SUM(COALESCE(budgetReel, 0)) AS budgetReelTotal
      FROM Chantier
      WHERE entrepriseId = ? AND is_deleted = 0
    `).get(entrepriseId);

    stats.budgetPrevuTotal = budgets?.budgetPrevuTotal || 0;
    stats.budgetReelTotal = budgets?.budgetReelTotal || 0;

    const actifs = db.prepare(`
      SELECT COUNT(*) AS count
      FROM Chantier
      WHERE entrepriseId = ? AND is_deleted = 0 AND statut = 'en_cours'
    `).get(entrepriseId);

    stats.chantiersActifs = actifs?.count || 0;

    const phasesRetard = db.prepare(`
      SELECT COUNT(*) AS count
      FROM Phase p
      JOIN Chantier c ON c.id = p.chantierId
      WHERE c.entrepriseId = ?
        AND p.is_deleted = 0
        AND c.is_deleted = 0
        AND p.dateFin IS NOT NULL
        AND p.dateFin < date('now')
        AND p.avancementPct < 100
    `).get(entrepriseId);

    stats.phasesEnRetard = phasesRetard?.count || 0;

    const incidentsOuverts = db.prepare(`
      SELECT COUNT(*) AS count
      FROM Incident i
      JOIN Chantier c ON c.id = i.chantierId
      WHERE c.entrepriseId = ?
        AND i.is_deleted = 0
        AND c.is_deleted = 0
        AND i.statut IN ('signale', 'en_cours')
    `).get(entrepriseId);

    stats.incidentsOuverts = incidentsOuverts?.count || 0;

    return stats;
  }

  createWithValidation(data, entrepriseId) {
    if (!data?.nom || !String(data.nom).trim()) {
      throw new Error('Le nom du chantier est obligatoire');
    }

    const nom = String(data.nom).trim();

    const existing = db.prepare(`
      SELECT id
      FROM Chantier
      WHERE entrepriseId = ? AND nom = ? AND is_deleted = 0
    `).get(entrepriseId, nom);

    if (existing) {
      throw new Error('Un chantier avec ce nom existe déjà pour cette entreprise');
    }

    const budgetPrevu = toFloatOrZero(data.budgetPrevu ?? data.budgetPrevisionnel ?? 0);

    const payload = {
      entrepriseId,
      clientId: toIntOrNull(data.clientId),
      chefChantierId: toIntOrNull(data.chefChantierId ?? data.responsableId),
      numero: emptyToNull(data.numero),
      nom,
      adresse: emptyToNull(data.adresse),
      codePostal: emptyToNull(data.codePostal),
      ville: emptyToNull(data.ville),
      dateDebut: emptyToNull(data.dateDebut),
      dateFinPrevue: emptyToNull(data.dateFinPrevue),
      dateFinReelle: emptyToNull(data.dateFinReelle),
      budgetPrevu,
      budgetPrevisionnel: budgetPrevu,
      budgetReel: toFloatOrZero(data.budgetReel ?? 0),
      margeCible: toFloatOrZero(data.margeCible ?? 0),
      tva: toFloatOrZero(data.tva ?? 20),
      statut: this.normalizeStatut(data.statut),
      description: emptyToNull(data.description),
      is_synced: 0,
      is_deleted: 0
    };

    const transaction = db.transaction(() => {
      const info = db.prepare(`
        INSERT INTO Chantier (
          entrepriseId, clientId, chefChantierId, numero, nom,
          adresse, codePostal, ville, dateDebut, dateFinPrevue, dateFinReelle,
          budgetPrevu, budgetPrevisionnel, budgetReel, margeCible, tva,
          statut, description, is_synced, is_deleted
        ) VALUES (
          @entrepriseId, @clientId, @chefChantierId, @numero, @nom,
          @adresse, @codePostal, @ville, @dateDebut, @dateFinPrevue, @dateFinReelle,
          @budgetPrevu, @budgetPrevisionnel, @budgetReel, @margeCible, @tva,
          @statut, @description, @is_synced, @is_deleted
        )
      `).run(payload);

      const chantierId = info.lastInsertRowid;

      if (Array.isArray(data.phases)) {
        data.phases.forEach((phase, index) => {
          this.phaseRepo.create({
            ...phase,
            chantierId,
            ordre: phase.ordre || (index + 1)
          });
        });
      }

      return chantierId;
    });

    const chantierId = transaction();
    return this.getWithRelations(chantierId);
  }

  update(id, data) {
    const existing = this.getById(id);
    if (!existing) {
      throw new Error('Chantier introuvable');
    }

    const payload = {};

    if (data.nom !== undefined) {
      const nom = String(data.nom || '').trim();
      if (!nom) throw new Error('Le nom du chantier est obligatoire');

      const existingSameName = db.prepare(`
        SELECT id
        FROM Chantier
        WHERE entrepriseId = ? AND nom = ? AND id != ? AND is_deleted = 0
      `).get(existing.entrepriseId, nom, id);

      if (existingSameName) {
        throw new Error('Un chantier avec ce nom existe déjà pour cette entreprise');
      }

      payload.nom = nom;
    }

    if ('clientId' in data) {
      payload.clientId = toIntOrNull(data.clientId);
    }

    if ('chefChantierId' in data || 'responsableId' in data) {
      payload.chefChantierId = toIntOrNull(data.chefChantierId ?? data.responsableId);
    }

    if ('numero' in data) payload.numero = emptyToNull(data.numero);
    if ('adresse' in data) payload.adresse = emptyToNull(data.adresse);
    if ('codePostal' in data) payload.codePostal = emptyToNull(data.codePostal);
    if ('ville' in data) payload.ville = emptyToNull(data.ville);
    if ('dateDebut' in data) payload.dateDebut = emptyToNull(data.dateDebut);
    if ('dateFinPrevue' in data) payload.dateFinPrevue = emptyToNull(data.dateFinPrevue);
    if ('dateFinReelle' in data) payload.dateFinReelle = emptyToNull(data.dateFinReelle);
    if ('description' in data) payload.description = emptyToNull(data.description);

    if ('budgetPrevu' in data || 'budgetPrevisionnel' in data) {
      const budgetPrevu = toFloatOrZero(data.budgetPrevu ?? data.budgetPrevisionnel);
      payload.budgetPrevu = budgetPrevu;
      payload.budgetPrevisionnel = budgetPrevu;
    }

    if ('budgetReel' in data) payload.budgetReel = toFloatOrZero(data.budgetReel);
    if ('margeCible' in data) payload.margeCible = toFloatOrZero(data.margeCible);
    if ('tva' in data) payload.tva = toFloatOrZero(data.tva);
    if ('statut' in data) payload.statut = this.normalizeStatut(data.statut);

    const fields = Object.keys(payload);

    if (fields.length > 0) {
      const setClause = fields.map(field => `${field} = @${field}`).join(', ');

      db.prepare(`
        UPDATE Chantier
        SET ${setClause}, updated_at = CURRENT_TIMESTAMP
        WHERE id = @id
      `).run({
        ...payload,
        id
      });
    }

    return this.getWithRelations(id);
  }

  softDelete(id) {
    const existing = this.getById(id);
    if (!existing) {
      throw new Error('Chantier introuvable');
    }

    db.prepare(`
      UPDATE Chantier
      SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);

    return { id };
  }

  savePhases(chantierId, phases = []) {
    const chantier = this.getById(chantierId);
    if (!chantier) {
      throw new Error('Chantier introuvable');
    }

    const incomingPhases = Array.isArray(phases) ? phases : [];

    const existingPhases = db.prepare(`
      SELECT id
      FROM Phase
      WHERE chantierId = ? AND is_deleted = 0
    `).all(chantierId).map(row => row.id);

    const keptIds = [];

    const transaction = db.transaction(() => {
      incomingPhases.forEach((phase, index) => {
        const parsedId = parseInt(phase.id, 10);
        const phaseId = Number.isNaN(parsedId) || parsedId <= 0 ? null : parsedId;
        const ordre = parseInt(phase.ordre, 10) || (index + 1);

        if (phaseId && existingPhases.includes(phaseId)) {
          this.phaseRepo.update(phaseId, {
            ...phase,
            chantierId,
            ordre
          });

          keptIds.push(phaseId);
        } else {
          this.phaseRepo.create({
            ...phase,
            id: undefined,
            chantierId,
            ordre
          });
        }
      });

      existingPhases
        .filter(existingId => !keptIds.includes(existingId))
        .forEach(existingId => this.phaseRepo.softDelete(existingId));
    });

    transaction();

    return this.phaseRepo.getByChantier(chantierId);
  }

  recalculerBudgetReel(chantierId) {
    const chantier = this.getById(chantierId);
    if (!chantier) {
      throw new Error('Chantier introuvable');
    }

    const depenses = db.prepare(`
      SELECT SUM(montant) AS total
      FROM Depense
      WHERE chantierId = ? AND is_deleted = 0
    `).get(chantierId);

    const budgetReel = depenses?.total || 0;

    db.prepare(`
      UPDATE Chantier
      SET budgetReel = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(budgetReel, chantierId);

    return this.getWithRelations(chantierId);
  }

  addPhase(chantierId, phaseData) {
    const chantier = this.getById(chantierId);
    if (!chantier) {
      throw new Error('Chantier introuvable');
    }

    const lastPhase = db.prepare(`
      SELECT MAX(ordre) AS maxOrdre
      FROM Phase
      WHERE chantierId = ? AND is_deleted = 0
    `).get(chantierId);

    const ordre = parseInt(phaseData?.ordre, 10) || ((lastPhase?.maxOrdre || 0) + 1);

    return this.phaseRepo.create({
      ...phaseData,
      chantierId,
      ordre
    });
  }

  addIncident(chantierId, incidentData, userId) {
    const chantier = this.getById(chantierId);
    if (!chantier) {
      throw new Error('Chantier introuvable');
    }

    return this.incidentRepo.create({
      ...incidentData,
      chantierId,
      declarePar: userId || null,
      dateIncident: incidentData.dateIncident || new Date().toISOString().split('T')[0],
      gravite: incidentData.gravite || 'moyenne',
      statut: incidentData.statut || 'signale'
    });
  }
}

module.exports = ChantierRepository;