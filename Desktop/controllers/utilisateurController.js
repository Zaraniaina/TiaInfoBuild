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

  async downloadCredentials(event, id) {
    try {
      const user = this.repos.utilisateurs.getWithRelations(id);
      if (!user) return { success: false, error: 'Utilisateur non trouvé' };

      const currentUser = event?.user || window.AppState?.user;
      const currentRoles = currentUser?.roles || [currentUser?.roleCode || 'ADMIN'];
      const isAdmin = currentRoles.includes('ADMIN');

      if (!isAdmin) {
        const mustChange = user.must_change_password === 1 || user.must_change_password === '1';
        if (!mustChange) {
          return { success: false, error: 'Cet utilisateur a déjà modifié son mot de passe. Seul l\'administrateur peut télécharger les identifiants.' };
        }
      }

      return { success: true, data: user };
    } catch (error) {
      console.error('UtilisateurController.downloadCredentials error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Créer un utilisateur + auto-création dans Employe + notification RH
   */
  async create(event, data, entrepriseId) {
    try {
      const createData = { ...data };
      createData.must_change_password = 1;

      const result = this.repos.utilisateurs.createUser(createData, entrepriseId);

      const targetEntrepriseId = parseInt(entrepriseId || data.entrepriseId, 10) || 1;
      const roleId = parseInt(data.roleId, 10) || 0;
      const isAdmin = roleId === 1;

      // 2. Auto-création dans la table Employe (sauf pour l'admin)
      let employeCreated = false;
      let employeId = null;
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
            const employe = this.repos.employes.createWithValidation(employeData, targetEntrepriseId);
            employeCreated = true;
            employeId = employe?.id || null;
          }
        } catch (empErr) {
          // L'échec de la création d'employé ne doit pas bloquer la création de l'utilisateur
          console.warn('[UtilisateurController] Auto-employe creation failed:', empErr.message);
        }
      }

      // 3. Créer une notification d'alerte pour le RH (uniquement si employe créé)
      if (!isAdmin && employeCreated && employeId && this.repos.alertes) {
        try {
          const prenom = (data.prenom || '').trim();
          const nom = (data.nom || '').trim();
          const roleLabel = this._getRoleLabel(roleId);
          const nomComplet = [prenom, nom].filter(Boolean).join(' ') || 'Nouvel utilisateur';

          this.repos.alertes.creer({
            entrepriseId: targetEntrepriseId,
            titre: 'Nouveau collaborateur à enregistrer',
            typeEntite: 'Employe',
            entiteId: employeId,
            message: `${nomComplet} (${roleLabel}) vient d'intégrer l'entreprise. Veuillez compléter son dossier RH dans le module Employés.`,
            niveauGravite: 'info',
            roleDestinataire: 'RH'
          });
        } catch (alerteErr) {
          console.warn('[UtilisateurController] Alerte creation failed:', alerteErr.message);
        }
      }

      return {
        success: true,
        data: result,
        employeCreated,
        employeId,
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

  /**
   * Mettre à jour son propre profil (nom, prenom, email, telephone)
   * Sans restriction RBAC, juste vérification ownership
   */
  async updateOwnProfile(event, id, data) {
    try {
      // Vérifier que l'utilisateur modifie son propre profil
      const currentUser = event?.user;
      if (!currentUser || currentUser.id !== parseInt(id, 10)) {
        return { success: false, error: 'Non autorisé à modifier ce profil' };
      }

      // Filtrer les champs autorisés pour l'auto-modification
      const allowedFields = ['nom', 'prenom', 'email', 'telephone', 'statut'];
      const filteredData = {};
      for (const key of allowedFields) {
        if (data[key] !== undefined) filteredData[key] = data[key];
      }

      if (Object.keys(filteredData).length === 0) {
        return { success: false, error: 'Aucun champ valide à mettre à jour' };
      }

      const result = this.repos.utilisateurs.updateUser(id, filteredData);
      return { success: true, data: result };
    } catch (error) {
      console.error('UtilisateurController.updateOwnProfile error:', error);
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