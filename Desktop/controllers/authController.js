// Desktop/controllers/authController.js
const API_BASE_URL = require('../apiUrl/url');
const db = require('../models/db');
const axios = require('axios');
const bcrypt = require('bcryptjs');

/**
 * Fonction utilitaire de hachage sécurisé des mots de passe (bcrypt)
 */
function hashPassword(password) {
  if (!password) return '';
  return bcrypt.hashSync(password, 10);
}

/**
 * Fonction utilitaire de vérification sécurisée du mot de passe
 */
function verifyPassword(inputPassword, storedHash) {
  if (!inputPassword || !storedHash) return false;

  if (storedHash.length === 64 && !storedHash.startsWith('$2')) {
    const crypto = require('crypto');
    const inputHash = crypto.createHash('sha256').update(inputPassword).digest('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(inputHash), Buffer.from(storedHash));
    } catch (e) {
      return inputHash === storedHash;
    }
  }

  if (storedHash.startsWith('$2')) {
    return bcrypt.compareSync(inputPassword, storedHash);
  }

  return inputPassword === storedHash;
}

/**
 * Enregistrer une entrée dans l'historique des connexions
 */
function logLogin(utilisateurId, entrepriseId, reussi, motifEchec = null) {
  try {
    const adresseIP = null;
    const userAgent = null;
    db.prepare(`
      INSERT INTO LoginHistory (utilisateurId, entrepriseId, dateConnexion, adresseIP, userAgent, reussi, motifEchec)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(utilisateurId, entrepriseId, new Date().toISOString(), adresseIP, userAgent, reussi ? 1 : 0, motifEchec);
  } catch (e) {
    console.error('[Auth] Erreur log login:', e.message);
  }
}

/**
 * Gérer la connexion utilisateur (Local-First avec Master Django distant)
 */
async function handleLogin(event, data) {
  // Support both calling styles: handleLogin(event, email, password) and handleLogin(event, { email, password })
  let email, password;

  if (typeof event === 'string') {
    // Backward compat: handleLogin(email, password)
    email = event;
    password = data;
  } else if (event && typeof event === 'object' && event.email) {
    // New style: handleLogin(event, { email, password })
    email = event.email;
    password = event.password;
  } else {
    // IPC style: handleLogin(event, data) where data = { email, password }
    email = data?.email;
    password = data?.password;
  }

  if (!email || !password) {
    return { success: false, message: 'Email et mot de passe requis.' };
  }

  try {
    // 1. Vérifier si l'utilisateur existe dans la BDD locale SQLite
    // Inclure le rôle via jointure pour avoir roleNom et roleCode
    const stmt = db.prepare(`
      SELECT u.id, u.server_id, u.entrepriseId, u.roleId, u.nom, u.prenom, u.email,
        u.telephone, u.statut, u.dateCreation, u.derniereConnexion, u.is_synced,
        u.motDePasseHash,
        r.nom as roleNom, r.code as roleCode
      FROM Utilisateur u
      LEFT JOIN Role r ON u.roleId = r.id AND r.is_deleted = 0
      WHERE u.email = ? AND u.is_deleted = 0
    `);
    const localUser = stmt.get(email);

    if (localUser) {
      const lockedUntil = localUser.locked_until ? new Date(localUser.locked_until) : null;
      if (lockedUntil && lockedUntil > new Date()) {
        const remaining = Math.ceil((lockedUntil - new Date()) / 60000);
        return { success: false, message: `Compte temporairement verrouillé. Réessayez dans ${remaining} min.` };
      }

      if (verifyPassword(password, localUser.motDePasseHash)) {
        db.prepare('UPDATE Utilisateur SET derniereConnexion = CURRENT_TIMESTAMP, login_attempts = 0, locked_until = NULL WHERE id = ?').run(localUser.id);
        logLogin(localUser.id, localUser.entrepriseId, true);

        const mustChange = localUser.must_change_password === 1 || localUser.must_change_password === '1';
        if (mustChange) {
          return { success: true, user: localUser, must_change_password: true };
        }

        return { success: true, user: localUser };
      } else {
        const attempts = (localUser.login_attempts || 0) + 1;
        let lockedUntil = null;
        if (attempts >= 3) {
          const delayMinutes = attempts === 3 ? 1 : attempts === 4 ? 5 : 15;
          lockedUntil = new Date(Date.now() + delayMinutes * 60000).toISOString();
        }
        db.prepare('UPDATE Utilisateur SET login_attempts = ?, locked_until = ? WHERE id = ?').run(attempts, lockedUntil, localUser.id);
        logLogin(localUser.id, localUser.entrepriseId, false, 'Mot de passe incorrect');

        if (lockedUntil) {
          return { success: false, message: 'Trop de tentatives échouées. Compte verrouillé temporairement.' };
        }
        return { success: false, message: 'Mot de passe incorrect.' };
      }
    } else {
      // 2. Première connexion : authentification auprès du serveur Master Django Web
      try {
        const response = await axios.post(`${API_BASE_URL}/auth/login/`, {
          email,
          password
        }, { timeout: 5000 });

        if (response.data && (response.data.user || response.data.token)) {
          const remoteUser = response.data.user || {
            id: response.data.id || 1,
            nom: response.data.nom || 'Utilisateur',
            prenom: response.data.prenom || 'Web',
            email: email,
            roleId: response.data.roleId || 1,
            entrepriseId: response.data.entrepriseId || 1
          };

          // S'assurer que l'entreprise existe en local
          const checkEnt = db.prepare('SELECT id FROM Entreprise WHERE id = ? OR server_id = ?').get(remoteUser.entrepriseId, remoteUser.entrepriseId);
          if (!checkEnt) {
            db.prepare(`
              INSERT INTO Entreprise (id, server_id, nom, is_synced)
              VALUES (?, ?, ?, 1)
            `).run(remoteUser.entrepriseId, remoteUser.entrepriseId, remoteUser.entrepriseNom || 'Entreprise BTP');
          }

          // Stocker le mot de passe haché de manière sécurisée dans la BDD locale
          const pwdHash = hashPassword(password);
          const insertStmt = db.prepare(`
            INSERT INTO Utilisateur (server_id, nom, prenom, email, motDePasseHash, roleId, entrepriseId, is_synced)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1)
          `);
          const info = insertStmt.run(
            remoteUser.id, remoteUser.nom, remoteUser.prenom || '', remoteUser.email, pwdHash, remoteUser.roleId || 1, remoteUser.entrepriseId || 1
          );

          const newLocalUser = db.prepare('SELECT * FROM Utilisateur WHERE id = ?').get(info.lastInsertRowid);
          logLogin(newLocalUser.id, newLocalUser.entrepriseId, true);

          const mustChange = newLocalUser.must_change_password === 1 || newLocalUser.must_change_password === '1';
          if (mustChange) {
            return { success: true, user: newLocalUser, token: response.data.token, must_change_password: true };
          }

          return { success: true, user: newLocalUser, token: response.data.token };
        } else {
          return { success: false, message: 'Identifiants invalides sur le serveur distant.' };
        }
      } catch (apiError) {
        console.error("Erreur API Django lors du login:", apiError.message);
        return {
          success: false,
          message: 'Première connexion : Impossible de joindre le serveur Django Master. Une connexion réseau est requise lors de la première connexion.'
        };
      }
    }
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, message: 'Erreur interne de la base de données locale.' };
  }
}

/**
 * Gérer l'inscription utilisateur (Nécessite une connexion initiale au serveur Django Master)
 */
async function handleRegister(event, data) {
  const registerData = typeof event === 'object' && event.email ? event : data;

  try {
    const { nom, prenom, email, password, entreprise } = registerData || {};

    if (!email || !password || !entreprise) {
      return { success: false, message: 'Veuillez remplir tous les champs obligatoires (Entreprise, Email, Mot de passe).' };
    }

    const pwdHash = hashPassword(password);

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/register/`, {
        nom: nom || '',
        prenom: prenom || '',
        email,
        password,
        entreprise_nom: entreprise
      }, { timeout: 7000 });

      const remoteData = response.data || {};
      const serverUserId = remoteData.user_id || remoteData.id || Date.now();
      const serverEntId = remoteData.entreprise_id || 1;

      // Créer l'entreprise en local
      const entStmt = db.prepare('INSERT INTO Entreprise (server_id, nom, is_synced) VALUES (?, ?, 1)');
      const entInfo = entStmt.run(serverEntId, entreprise);

      // Créer l'utilisateur avec son mot de passe haché
      const userStmt = db.prepare(`
        INSERT INTO Utilisateur (server_id, nom, prenom, email, motDePasseHash, roleId, entrepriseId, is_synced)
        VALUES (?, ?, ?, ?, ?, 1, ?, 1)
      `);
      const userInfo = userStmt.run(serverUserId, nom || 'Admin', prenom || '', email, pwdHash, entInfo.lastInsertRowid);

      const newUser = db.prepare('SELECT * FROM Utilisateur WHERE id = ?').get(userInfo.lastInsertRowid);

      // Créer une alerte pour inviter à créer un compte RH
      try {
        const alerteStmt = db.prepare(`
          INSERT INTO Alerte (entrepriseId, titre, message, niveauGravite, typeEntite, statut, dateAlerte)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        alerteStmt.run(
          entInfo.lastInsertRowid,
          "Configuration initiale",
          "Veuillez créer un compte pour le responsable RH afin de déléguer la gestion des employés.",
          "info",
          "systeme",
          "non_lue",
          new Date().toISOString()
        );
      } catch(e) { console.error('Erreur alerte RH:', e); }

      return { success: true, user: newUser, message: 'Inscription réussie sur le serveur distant et synchronisée en local !' };
    } catch (apiError) {
      console.error("Erreur API Django Inscription:", apiError.message);

      // Mode création locale avec mot de passe haché
      const entStmt = db.prepare('INSERT INTO Entreprise (nom, is_synced) VALUES (?, 0)');
      const entInfo = entStmt.run(entreprise);

      const userStmt = db.prepare(`
        INSERT INTO Utilisateur (nom, prenom, email, motDePasseHash, roleId, entrepriseId, is_synced)
        VALUES (?, ?, ?, ?, 1, ?, 0)
      `);
      const userInfo = userStmt.run(nom || 'Admin', prenom || '', email, pwdHash, entInfo.lastInsertRowid);

      const newUser = db.prepare('SELECT * FROM Utilisateur WHERE id = ?').get(userInfo.lastInsertRowid);

      // Créer une alerte pour inviter à créer un compte RH
      try {
        const alerteStmt = db.prepare(`
          INSERT INTO Alerte (entrepriseId, titre, message, niveauGravite, typeEntite, statut, dateAlerte)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        alerteStmt.run(
          entInfo.lastInsertRowid,
          "Configuration initiale",
          "Veuillez créer un compte pour le responsable RH afin de déléguer la gestion des employés.",
          "info",
          "systeme",
          "non_lue",
          new Date().toISOString()
        );
      } catch(e) { console.error('Erreur alerte RH:', e); }

      return {
        success: true,
        user: newUser,
        message: 'Compte créé localement (Mode Hors Ligne). Il sera synchronisé avec le serveur Web dès qu\'une connexion sera disponible.'
      };
    }
  } catch (error) {
    console.error('Register error:', error);
    return { success: false, message: 'Erreur lors de la création du compte.' };
  }
}

/**
 * Changer le mot de passe (first login ou volontaire)
 */
async function changePassword(event, userId, data) {
  try {
    const user = db.prepare('SELECT * FROM Utilisateur WHERE id = ? AND is_deleted = 0').get(userId);
    if (!user) return { success: false, message: 'Utilisateur introuvable.' };

    const currentPassword = data.currentPassword || data.ancienMotDePasse || '';
    const newPassword = data.newPassword || data.motDePasse || '';

    if (!currentPassword || !newPassword) {
      return { success: false, message: 'Mot de passe actuel et nouveau mot de passe requis.' };
    }

    if (!verifyPassword(currentPassword, user.motDePasseHash)) {
      logLogin(userId, user.entrepriseId, false, 'Mot de passe actuel incorrect lors du changement');
      return { success: false, message: 'Mot de passe actuel incorrect.' };
    }

    if (newPassword.length < 6) {
      return { success: false, message: 'Le nouveau mot de passe doit contenir au moins 6 caractères.' };
    }

    const newHash = hashPassword(newPassword);
    db.prepare('UPDATE Utilisateur SET motDePasseHash = ?, plainPassword = NULL, must_change_password = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newHash, userId);

    const updatedUser = db.prepare('SELECT * FROM Utilisateur WHERE id = ?').get(userId);
    logLogin(userId, user.entrepriseId, true);

    return { success: true, user: updatedUser, message: 'Mot de passe modifié avec succès.' };
  } catch (error) {
    console.error('Change password error:', error);
    return { success: false, message: 'Erreur lors du changement de mot de passe.' };
  }
}

module.exports = {
  handleLogin,
  handleRegister,
  changePassword,
  hashPassword,
  verifyPassword
};