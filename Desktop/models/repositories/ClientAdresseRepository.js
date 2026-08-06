// Desktop/models/repositories/ClientAdresseRepository.js
const db = require('../db');

class ClientAdresseRepository {
  /**
   * Récupérer les adresses d'un client
   */
  getByClientId(clientId) {
    try {
      const stmt = db.prepare(`
        SELECT * FROM ClientAdresse
        WHERE clientId = ? AND is_deleted = 0
        ORDER BY defaut DESC, id ASC
      `);
      return stmt.all(clientId) || [];
    } catch (e) {
      console.error('ClientAdresseRepository.getByClientId error:', e);
      return [];
    }
  }

  /**
   * Récupérer une adresse par ID
   */
  getById(id) {
    try {
      const stmt = db.prepare(`SELECT * FROM ClientAdresse WHERE id = ? AND is_deleted = 0`);
      return stmt.get(id) || null;
    } catch (e) {
      console.error('ClientAdresseRepository.getById error:', e);
      return null;
    }
  }

  /**
   * Créer une adresse pour un client
   */
  createForClient(data, clientId) {
    try {
      if (data.defaut) {
        db.prepare(`UPDATE ClientAdresse SET defaut = 0 WHERE clientId = ?`).run(clientId);
      }

      const payload = {
        clientId,
        type: data.type || 'facturation',
        ligne1: data.ligne1 || data.adresse || '',
        ligne2: data.ligne2 || data.adresseComplement || '',
        codePostal: data.codePostal || '',
        ville: data.ville || '',
        pays: data.pays || 'Madagascar',
        defaut: data.defaut ? 1 : 0
      };

      const stmt = db.prepare(`
        INSERT INTO ClientAdresse (clientId, type, ligne1, ligne2, codePostal, ville, pays, defaut)
        VALUES (@clientId, @type, @ligne1, @ligne2, @codePostal, @ville, @pays, @defaut)
      `);
      const info = stmt.run(payload);
      return this.getById(info.lastInsertRowid);
    } catch (e) {
      console.error('ClientAdresseRepository.createForClient error:', e);
      throw e;
    }
  }

  /**
   * Mettre à jour une adresse
   */
  updateAdresse(id, data) {
    try {
      const current = this.getById(id);
      if (!current) throw new Error('Adresse non trouvée');

      if (data.defaut) {
        db.prepare(`UPDATE ClientAdresse SET defaut = 0 WHERE clientId = ?`).run(current.clientId);
      }

      const payload = {
        id,
        type: data.type || current.type,
        ligne1: data.ligne1 !== undefined ? data.ligne1 : current.ligne1,
        ligne2: data.ligne2 !== undefined ? data.ligne2 : current.ligne2,
        codePostal: data.codePostal !== undefined ? data.codePostal : current.codePostal,
        ville: data.ville !== undefined ? data.ville : current.ville,
        pays: data.pays !== undefined ? data.pays : current.pays,
        defaut: data.defaut !== undefined ? (data.defaut ? 1 : 0) : current.defaut
      };

      const stmt = db.prepare(`
        UPDATE ClientAdresse
        SET type = @type, ligne1 = @ligne1, ligne2 = @ligne2, codePostal = @codePostal,
            ville = @ville, pays = @pays, defaut = @defaut, updated_at = CURRENT_TIMESTAMP
        WHERE id = @id
      `);
      stmt.run(payload);
      return this.getById(id);
    } catch (e) {
      console.error('ClientAdresseRepository.updateAdresse error:', e);
      throw e;
    }
  }

  /**
   * Suppression logique d'une adresse
   */
  softDelete(id) {
    try {
      const stmt = db.prepare(`UPDATE ClientAdresse SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`);
      stmt.run(id);
      return { success: true };
    } catch (e) {
      console.error('ClientAdresseRepository.softDelete error:', e);
      throw e;
    }
  }
}

module.exports = ClientAdresseRepository;