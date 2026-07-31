/**
 * register.js - Logique de la page d'inscription (register.html)
 * Standalone page : views/register.html → register.js
 *
 * IDs du formulaire (register.html) :
 *   #registerForm, #nom (entreprise), #admin_prenom, #admin_nom,
 *   #admin_email, #password, #password_confirm, #statusMessage
 *
 * IPC: window.api.auth.invoke('register', { nom, prenom, email, password, entreprise })
 *      → canal 'auth:register' → authController.handleRegister()
 */
document.addEventListener('DOMContentLoaded', () => {
  const registerForm = document.getElementById('registerForm');
  const statusMessage = document.getElementById('statusMessage');

  if (!registerForm) return;

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Récupération des champs (IDs alignés sur register.html)
    const entreprise = document.getElementById('nom')?.value.trim() || '';           // Nom entreprise
    const prenom     = document.getElementById('admin_prenom')?.value.trim() || '';  // Prénom admin
    const nom        = document.getElementById('admin_nom')?.value.trim() || '';     // Nom admin
    const email      = document.getElementById('admin_email')?.value.trim() || '';   // Email admin
    const password   = document.getElementById('password')?.value || '';
    const passwordConfirm = document.getElementById('password_confirm')?.value || '';

    const btnSubmit = registerForm.querySelector('button[type="submit"]');

    // Validation
    if (!entreprise || !email || !password) {
      showStatus('Veuillez renseigner le nom d\'entreprise, l\'email et le mot de passe.', 'warning');
      return;
    }

    if (password.length < 6) {
      showStatus('Le mot de passe doit contenir au moins 6 caractères.', 'warning');
      return;
    }

    if (password !== passwordConfirm) {
      showStatus('Les mots de passe ne correspondent pas.', 'danger');
      return;
    }

    // UI : état chargement
    showStatus('Inscription et création de l\'entreprise en cours…', 'info');
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Création en cours…';
    }

    try {
      // Appel IPC via le bridge sécurisé
      const response = await window.api.auth.invoke('register', {
        nom,
        prenom,
        email,
        password,
        entreprise
      });

      if (response && response.success) {
        showStatus(response.message || 'Compte créé avec succès ! Connexion en cours…', 'success');

        // Stocker la session (clé unifiée 'currentUser')
        if (response.user) {
          localStorage.setItem('currentUser', JSON.stringify(response.user));
        }

        // Rediriger vers l'App Shell
        setTimeout(() => {
          window.location.href = 'layout.html';
        }, 900);

      } else {
        const msg = (response && response.message)
          ? response.message
          : 'Erreur lors de la création du compte.';
        showStatus(msg, 'danger');
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = '<i class="bi bi-rocket me-2"></i>Créer mon entreprise';
        }
      }

    } catch (error) {
      console.error('Erreur inscription:', error);
      showStatus('Erreur de communication lors de l\'inscription. Veuillez relancer l\'application.', 'danger');
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<i class="bi bi-rocket me-2"></i>Créer mon entreprise';
      }
    }
  });

  /**
   * Afficher un message de statut
   * @param {string} message - Texte
   * @param {string} type - 'info' | 'success' | 'danger' | 'warning'
   */
  function showStatus(message, type) {
    if (!statusMessage) return;
    statusMessage.textContent = message;
    statusMessage.className = `alert alert-${type}`;
    statusMessage.classList.remove('d-none');
  }
});
