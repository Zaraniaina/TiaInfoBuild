/**
 * change-password.js - Première connexion : changement obligatoire du mot de passe
 * Page appelée quand must_change_password = 1
 * IPC: window.api.auth.invoke('changePassword', userId, { currentPassword, newPassword })
 */

function showToast(message, type) {
    const warning = document.getElementById('firstLoginWarning');
    if (warning) {
        warning.innerHTML = `<i class="bi bi-${type === 'success' ? 'check-circle' : 'exclamation-triangle'} me-2"></i>${message}`;
        warning.className = `alert alert-${type === 'success' ? 'success' : type === 'danger' ? 'danger' : 'warning'}`;
    }
}

function getUserId() {
    if (window.AppState?.user?.id) return window.AppState.user.id;
    const stored = localStorage.getItem('currentUser');
    if (stored) {
        try { return JSON.parse(stored).id; } catch(e) {}
    }
    return null;
}

function getCurrentUser() {
    if (window.AppState?.user) return window.AppState.user;
    const stored = localStorage.getItem('currentUser');
    if (stored) {
        try { return JSON.parse(stored); } catch(e) {}
    }
    return null;
}

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('formChangePassword');
    const currentPasswordInput = document.getElementById('currentPassword');
    const newPasswordInput = document.getElementById('newPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const btnSubmit = document.getElementById('btnSubmitChangePassword');

    if (!form) return;

    // --- Toggle visibilité mots de passe ---
    document.getElementById('toggleCurrentPassword')?.addEventListener('click', () => toggleVisibility('currentPassword', 'toggleCurrentPasswordIcon'));
    document.getElementById('toggleNewPassword')?.addEventListener('click', () => toggleVisibility('newPassword', 'toggleNewPasswordIcon'));
    document.getElementById('toggleConfirmPassword')?.addEventListener('click', () => toggleVisibility('confirmPassword', 'toggleConfirmPasswordIcon'));

    function toggleVisibility(inputId, iconId) {
        const input = document.getElementById(inputId);
        const icon = document.getElementById(iconId);
        if (!input || !icon) return;
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        icon.classList.toggle('bi-eye', !isPassword);
        icon.classList.toggle('bi-eye-slash', isPassword);
    }

    // --- Validation en temps réel ---
    if (newPasswordInput) {
        newPasswordInput.addEventListener('input', () => {
            const val = newPasswordInput.value;
            updateRequirement('reqLength', val.length >= 6, 'Au moins 6 caractères');
            updateRequirement('reqUpper', /[A-Z]/.test(val), 'Une lettre majuscule');
            updateRequirement('reqLower', /[a-z]/.test(val), 'Une lettre minuscule');
            updateRequirement('reqNumber', /[0-9]/.test(val), 'Un chiffre');
        });
    }

    function updateRequirement(elementId, met, text) {
        const el = document.getElementById(elementId);
        if (!el) return;
        el.className = met ? 'requirement-met' : 'requirement-not-met';
        el.innerHTML = `<i class="bi bi-${met ? 'check-circle' : 'circle'}"></i> ${text}`;
    }

    if (confirmPasswordInput && newPasswordInput) {
        confirmPasswordInput.addEventListener('input', () => {
            if (confirmPasswordInput.value && confirmPasswordInput.value !== newPasswordInput.value) {
                confirmPasswordInput.classList.add('is-invalid');
            } else {
                confirmPasswordInput.classList.remove('is-invalid');
            }
        });
    }

    // --- Soumission ---
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const currentPassword = currentPasswordInput?.value || '';
        const newPassword = newPasswordInput?.value || '';
        const confirmPassword = confirmPasswordInput?.value || '';

        if (!currentPassword || !newPassword || !confirmPassword) {
            showToast('Veuillez remplir tous les champs.', 'warning');
            return;
        }

        if (newPassword !== confirmPassword) {
            showToast('Les mots de passe ne correspondent pas.', 'danger');
            confirmPasswordInput?.classList.add('is-invalid');
            return;
        }

        if (newPassword.length < 6) {
            showToast('Le mot de passe doit contenir au moins 6 caractères.', 'warning');
            return;
        }

        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Modification…';

        try {
            const userId = getUserId();
            if (!userId) {
                throw new Error('Session expirée. Veuillez vous reconnecter.');
            }

            // Utiliser auth:changePassword qui vérifie l'ancien mot de passe,
            // met à jour le hash, et remet must_change_password = 0
            const response = await window.api.auth.invoke('changePassword', userId, {
                currentPassword,
                newPassword
            });

            if (response?.success) {
                // Mettre à jour l'utilisateur en session
                if (response.user) {
                    const currentUser = getCurrentUser() || {};
                    const updatedUser = { ...currentUser, ...response.user };
                    if (window.AppState) window.AppState.user = updatedUser;
                    localStorage.setItem('currentUser', JSON.stringify(updatedUser));
                }

                showToast('Mot de passe modifié avec succès ! Redirection…', 'success');

                setTimeout(() => {
                    window.location.href = 'layout.html';
                }, 800);
            } else {
                showToast(response?.message || 'Erreur lors du changement de mot de passe.', 'danger');
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = '<i class="bi bi-check-lg me-2"></i>Modifier mon mot de passe';
            }
        } catch (error) {
            console.error('Erreur changement mot de passe:', error);
            showToast(`Erreur: ${error.message}`, 'danger');
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = '<i class="bi bi-check-lg me-2"></i>Modifier mon mot de passe';
        }
    });
});
