// Desktop/controllers/utilisateurController.js
/**
 * Contrôleur Main Process - Module Utilisateurs & Paramètres
 * Fonctionnalités :
 *  - CRUD utilisateurs avec validation
 *  - Auto-création d'un employé lors de l'ajout d'un utilisateur (sauf admin)
 *  - Notification RH via Alerte après création utilisateur
 */
class UtilisateurController {
  constructor(repos) {
    this.repos = repos;
  }

  async getList(event, params) {
    try {
      const options = typeof params === 'object' && params !== null ? params : { entrepriseId: params };
      const items = this.repos.utilisateurs.getListWithRole(options);
      const total = this.repos.utilisateurs.count(options);
      return { success: true, data: { items, total } };
    } catch (error) {
      console.error('UtilisateurController.getList error:', error);
      return { success: false, error: error.message };
    }
  }

  async getById(event, id) {
    try {
      const item = this.repos.utilisateurs.getWithRelations(id);
      return { success: true, data: item };
    } catch (error) {
      console.error('UtilisateurController.getById error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Créer un utilisateur + auto-création dans Employe + notification RH
   */
  async create(event, data, entrepriseId) {
    try {
      // 1. Créer l'utilisateur
      const result = this.repos.utilisateurs.createUser(data, entrepriseId);

      const targetEntrepriseId = parseInt(entrepriseId || data.entrepriseId, 10) || 1;
      const roleId = parseInt(data.roleId, 10) || 0;
      const isAdmin = roleId === 1;

      // 2. Auto-création dans la table Employe (sauf pour l'admin)
      let employeCreated = false;
      if (!isAdmin && this.repos.employes) {
        try {
          // Vérifier si un employé avec cet email existe déjà
          const emailToCheck = (data.email || '').trim();
          let employeExiste = false;
          if (emailToCheck) {
            const db = require('../models/db');
            const existing = db.prepare(
              `SELECT id FROM Employe WHERE email = ? AND entrepriseId = ? AND is_deleted = 0`
            ).get(emailToCheck, targetEntrepriseId);
            employeExiste = !!existing;
          }

          if (!employeExiste) {
            const employeData = {
              nom: (data.nom || '').trim(),
              prenom: (data.prenom || '').trim(),
              email: (data.email || '').trim(),
              telephone: (data.telephone || '').trim(),
              poste: this._getRoleLabel(roleId),
              statut: 'actif',
              dateEmbauche: new Date().toISOString().split('T')[0],
              salaireBase: 0
            };
            this.repos.employes.createWithValidation(employeData, targetEntrepriseId);
            employeCreated = true;
          }
        } catch (empErr) {
          // L'échec de la création d'employé ne doit pas bloquer la création de l'utilisateur
          console.warn('[UtilisateurController] Auto-employe creation failed:', empErr.message);
        }
      }

      // 3. Créer une notification d'alerte pour le RH
      if (!isAdmin && employeCreated && this.repos.alertes) {
        try {
          const prenom = (data.prenom || '').trim();
          const nom = (data.nom || '').trim();
          const roleLabel = this._getRoleLabel(roleId);

          this.repos.alertes.creer({
            entrepriseId: targetEntrepriseId,
            typeEntite: 'Utilisateur',
            entiteId: result.id,
            message: `Nouvel utilisateur créé : ${prenom} ${nom} (${roleLabel}). Veuillez compléter le dossier RH dans le module Employés.`,
            niveauGravite: 'info'
          });
        } catch (alerteErr) {
          console.warn('[UtilisateurController] Alerte creation failed:', alerteErr.message);
        }
      }

      return {
        success: true,
        data: result,
        employeCreated,
        message: employeCreated
          ? 'Utilisateur créé et fiche employé initialisée. Le RH a été notifié pour compléter le dossier.'
          : 'Utilisateur créé avec succès.'
      };
    } catch (error) {
      console.error('UtilisateurController.create error:', error);
      return { success: false, error: error.message };
    }
  }

  async update(event, id, data) {
    try {
      const result = this.repos.utilisateurs.updateUser(id, data);
      return { success: true, data: result };
    } catch (error) {
      console.error('UtilisateurController.update error:', error);
      return { success: false, error: error.message };
    }
  }

  async delete(event, id) {
    try {
      const result = this.repos.utilisateurs.softDelete(id);
      return { success: true, data: result };
    } catch (error) {
      console.error('UtilisateurController.delete error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtenir le libellé d'un rôle à partir de son ID
   * @private
   */
  _getRoleLabel(roleId) {
    const labels = {
      1: 'Administrateur',
      2: 'Comptable',
      3: 'Direction Générale',
      4: 'Chef de Chantier',
      5: 'Chef de Projet',
      6: 'Responsable RH',
      7: 'Responsable Matériel',
      8: 'Magasinier',
      9: 'Commercial'
    };
    return labels[roleId] || 'Collaborateur';
  }
}

module.exports = UtilisateurController;