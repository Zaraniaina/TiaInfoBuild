const db = require('../models/db');
const axios = require('axios');

const API_BASE_URL = 'http://localhost:8000/api'; // Modifier selon l'URL du serveur Django

async function handleLogin(event, email, password) {
  try {
    // 1. Vérifier si l'utilisateur existe en local
    const stmt = db.prepare('SELECT * FROM Utilisateur WHERE email = ?');
    const localUser = stmt.get(email);

    if (localUser) {
      // Pour l'instant, on fait une simple comparaison (en prod, utiliser bcrypt pour hasher et comparer)
      if (localUser.motDePasseHash === password) { // A sécuriser
        // Mettre à jour la date de dernière connexion
        db.prepare('UPDATE Utilisateur SET derniereConnexion = CURRENT_TIMESTAMP WHERE id = ?').run(localUser.id);
        return { success: true, user: localUser };
      } else {
        return { success: false, message: 'Mot de passe incorrect.' };
      }
    } else {
      // 2. Si non, c'est la première connexion. On doit appeler l'API Django
      try {
        const response = await axios.post(`${API_BASE_URL}/auth/login/`, {
          email,
          password
        });
        
        if (response.data && response.data.user) {
          const remoteUser = response.data.user;
          // Insérer l'utilisateur en local
          const insertStmt = db.prepare(`
            INSERT INTO Utilisateur (server_id, nom, prenom, email, motDePasseHash, roleId, entrepriseId) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `);
          const info = insertStmt.run(
            remoteUser.id, remoteUser.nom, remoteUser.prenom, remoteUser.email, password, remoteUser.roleId, remoteUser.entrepriseId
          );
          
          return { success: true, user: { id: info.lastInsertRowid, ...remoteUser } };
        } else {
            return { success: false, message: 'Identifiants invalides sur le serveur distant.' };
        }
      } catch (apiError) {
        // Erreur réseau ou API
        console.error("Erreur API Django:", apiError.message);
        return { 
          success: false, 
          message: 'Première connexion : impossible de joindre le serveur. Vérifiez votre connexion internet.' 
        };
      }
    }
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, message: 'Erreur interne du serveur local.' };
  }
}

module.exports = {
  handleLogin
};
