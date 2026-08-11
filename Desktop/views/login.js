/**
 * login.js - Logique de la page de connexion (index.html)
 * Standalone page : views/index.html → login.js
 *
 * IDs du formulaire (index.html) :
 *   #loginForm, #email, #password, #rememberMe, #togglePassword, #togglePasswordIcon, #statusMessage, #btnLogin
 *
 * IPC: window.api.auth.invoke('login', { email, password })
 *      → canal 'auth:login' → authController.handleLogin()
 */
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const statusMessage = document.getElementById('statusMessage');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const togglePasswordBtn = document.getElementById('togglePassword');
    const togglePasswordIcon = document.getElementById('togglePasswordIcon');
    const rememberMeCheckbox = document.getElementById('rememberMe');
    const btnLogin = document.getElementById('btnLogin');

    if (!loginForm) return;

    // --- Afficher/Masquer le mot de passe ---
    if (togglePasswordBtn && passwordInput && togglePasswordIcon) {
        togglePasswordBtn.addEventListener('click', () => {
            const isPassword = passwordInput.type === 'password';
            passwordInput.type = isPassword ? 'text' : 'password';
            togglePasswordIcon.classList.toggle('bi-eye', !isPassword);
            togglePasswordIcon.classList.toggle('bi-eye-slash', isPassword);
        });
    }

    // --- Restaurer l'email si "Se souvenir de moi" ---
    if (rememberMeCheckbox) {
        const savedEmail = localStorage.getItem('rememberedEmail');
        if (savedEmail) {
            emailInput.value = savedEmail;
            rememberMeCheckbox.checked = true;
        }
    }

    // --- Soumission du formulaire ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = emailInput?.value.trim() || '';
        const password = passwordInput?.value || '';
        const rememberMe = rememberMeCheckbox?.checked || false;

        // Validation basique
        if (!email || !password) {
            showStatus('Veuillez renseigner votre email et votre mot de passe.', 'warning');
            return;
        }

        if (!email.includes('@')) {
            showStatus('Veuillez entrer une adresse email valide.', 'warning');
            return;
        }

        // UI : état chargement
        showStatus('Connexion en cours…', 'info');
        setLoadingState(true);

        try {
            // Appel IPC via le bridge sécurisé (preload.js)
            const response = await window.api.auth.invoke('login', {
                email,
                password
            });

            if (response && response.success) {
                if (response.must_change_password) {
                    showStatus('Première connexion : vous devez modifier votre mot de passe.', 'warning');
                    setTimeout(() => {
                        window.location.href = 'change-password.html?firstLogin=1';
                    }, 1500);
                    return;
                }

                if (rememberMe) {
                    localStorage.setItem('rememberedEmail', email);
                } else {
                    localStorage.removeItem('rememberedEmail');
                }

                if (response.user) {
                    localStorage.setItem('currentUser', JSON.stringify(response.user));
                }
                if (response.token) {
                    localStorage.setItem('authToken', response.token);
                }

                showStatus(response.message || 'Connexion réussie ! Redirection…', 'success');

                setTimeout(() => {
                    window.location.href = 'layout.html';
                }, 800);

            } else {
                const msg = (response && response.message)
                    ? response.message
                    : 'Identifiants invalides ou erreur de connexion.';
                showStatus(msg, 'danger');
                setLoadingState(false);
            }

        } catch (error) {
            console.error('Erreur connexion:', error);
            showStatus('Erreur de communication avec l\'application. Veuillez relancer l\'application.', 'danger');
            setLoadingState(false);
        }
    });

    /**
     * Afficher un message de statut dans #statusMessage
     * @param {string} message - Texte à afficher
     * @param {string} type - 'info' | 'success' | 'danger' | 'warning'
     */
    function showStatus(message, type) {
        if (!statusMessage) return;
        statusMessage.textContent = message;
        statusMessage.className = `alert alert-${type}`;
        statusMessage.classList.remove('d-none');
    }

    /**
     * Gérer l'état de chargement du bouton
     * @param {boolean} loading - true = chargement, false = normal
     */
    function setLoadingState(loading) {
        if (!btnLogin) return;
        if (loading) {
            btnLogin.disabled = true;
            btnLogin.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Connexion…';
        } else {
            btnLogin.disabled = false;
            btnLogin.innerHTML = '<i class="bi bi-box-arrow-in-right me-2"></i>Se connecter';
        }
    }
});