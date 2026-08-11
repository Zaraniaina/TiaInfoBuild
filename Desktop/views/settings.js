/**
 * Paramètres / Administration View Controller
 * Gère la configuration de l'entreprise, utilisateurs, préférences, sauvegarde, synchronisation
 */

const UTILISATEUR_ROLE_OPTIONS = [
    { id: 1, code: 'ADMIN', label: "Administrateur d'Entreprise" },
    { id: 2, code: 'COMPTABLE', label: 'Comptable / Responsable Financier' },
    { id: 3, code: 'DIRECTION', label: 'Direction Générale / DAF' },
    { id: 4, code: 'CHEF_CHANTIER', label: 'Chef de Chantier / Conducteur de Travaux' },
    { id: 5, code: 'CHEF_PROJET', label: 'Chef de Projet / Directeur Technique' },
    { id: 6, code: 'RH', label: 'Responsable RH' },
    { id: 7, code: 'MATERIEL', label: 'Responsable Matériel / Logisticien' },
    { id: 8, code: 'MAGASINIER', label: 'Magasinier / Responsable Stock' },
    { id: 9, code: 'COMMERCIAL', label: 'Commercial / Responsable Commercial' }
];

const UTILISATEUR_ROLE_CODE_TO_ID = UTILISATEUR_ROLE_OPTIONS.reduce((map, role) => {
    map[role.code] = role.id;
    return map;
}, {});

const UTILISATEUR_ROLE_LABELS = UTILISATEUR_ROLE_OPTIONS.reduce((map, role) => {
    map[role.code] = role.label;
    return map;
}, {});

const UTILISATEUR_ROLE_BADGES = {
    ADMIN: 'bg-danger',
    COMPTABLE: 'bg-success',
    DIRECTION: 'bg-warning text-dark',
    CHEF_CHANTIER: 'bg-info',
    CHEF_PROJET: 'bg-primary',
    RH: 'bg-secondary',
    MATERIEL: 'bg-secondary',
    MAGASINIER: 'bg-secondary',
    COMMERCIAL: 'bg-primary'
};

const UTILISATEUR_ROLE_ALIASES = {
    ADMIN: ['ADMIN', 'ADMINISTRATEUR', 'ADMINISTRATEUR D\'ENTREPRISE', 'ENTREPRISE'],
    COMPTABLE: ['COMPTABLE', 'RESPONSABLE FINANCIER', 'FINANCIER'],
    DIRECTION: ['DIRECTION', 'DAF', 'DIRECTION GÉNÉRALE', 'DIRECTION GENERALE'],
    RH: ['RH', 'RESPONSABLE RH'],
    MATERIEL: ['MATERIEL', 'LOGISTICIEN', 'RESPONSABLE MATÉRIEL', 'RESPONSABLE MATERIEL'],
    MAGASINIER: ['MAGASINIER', 'RESPONSABLE STOCK', 'STOCK'],
    COMMERCIAL: ['COMMERCIAL', 'RESPONSABLE COMMERCIAL'],
    CHEF_CHANTIER: ['CHEF DE CHANTIER', 'CONDUCTEUR', 'CHEF_CHANTIER'],
    CHEF_PROJET: ['CHEF DE PROJET', 'CHEF_PROJET', 'DIRECTEUR TECHNIQUE']
};

function normalizeString(text) {
    return text
        .toString()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[^A-Z0-9]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
}

function normalizeUtilisateurRoleCode(rawRole) {
    if (!rawRole) return '';
    const normalized = normalizeString(rawRole);

    if (UTILISATEUR_ROLE_CODE_TO_ID[normalized]) return normalized;

    for (const [code, aliases] of Object.entries(UTILISATEUR_ROLE_ALIASES)) {
        if (aliases.some(alias => normalizeString(alias).includes(normalized) || normalized.includes(normalizeString(alias)))) {
            return code;
        }
    }

    const matchByLabel = Object.entries(UTILISATEUR_ROLE_LABELS).find(([, label]) => {
        const normalizedLabel = normalizeString(label);
        return normalizedLabel.includes(normalized) || normalized.includes(normalizedLabel);
    });
    return matchByLabel ? matchByLabel[0] : '';
}

class ParametresController {
    constructor() {
        this.utilisateurs = [];
        this.backups = [];
        this.syncHistory = [];
    }

    /**
     * Initialiser le contrôleur
     */
    async init() {
        this.bindEvents();
        await this.loadEntreprise();
        await this.loadUtilisateurs();
        await this.loadPreferences();
        this.loadCurrentUserProfile();
        this.updateSettingsTabsVisibility();
        await this.loadBackups();
        await this.loadSyncConfig();
        await this.loadSyncHistory();
    }

    /**
     * Lier les événements UI
     */
    bindEvents() {
        // Onglets
        document.querySelectorAll('#parametresTabs button[data-bs-toggle="tab"]').forEach(btn => {
            btn.addEventListener('shown.bs.tab', (e) => {
                const tab = e.target.id.replace('tab-', '').replace('-tab', '');
                if (tab === 'utilisateurs') this.loadUtilisateurs();
                else if (tab === 'sauvegarde') this.loadBackups();
                else if (tab === 'sync') this.loadSyncHistory();
                else if (tab === 'profil') this.loadCurrentUserProfile();
            });
        });

        // Formulaire profil utilisateur
        document.getElementById('formProfilUtilisateur')?.addEventListener('submit', (e) => this.handleSubmitProfil(e));

        // Formulaire entreprise
        document.getElementById('formEntreprise')?.addEventListener('submit', (e) => this.handleSubmitEntreprise(e));

        // Formulaire facturation
        document.getElementById('formFacturation')?.addEventListener('submit', (e) => this.handleSubmitFacturation(e));

        // Formulaire préférences
        document.getElementById('formPreferences')?.addEventListener('submit', (e) => this.handleSubmitPreferences(e));

        // Formulaire sauvegarde auto
        document.getElementById('formAutoBackup')?.addEventListener('submit', (e) => this.handleSubmitAutoBackup(e));

        // Formulaire sync config
        document.getElementById('formSyncConfig')?.addEventListener('submit', (e) => this.handleSubmitSyncConfig(e));

        // Formulaire auto sync
        document.getElementById('formAutoSync')?.addEventListener('submit', (e) => this.handleSubmitAutoSync(e));

        // Boutons utilisateurs
        document.getElementById('btnNouvelUtilisateur')?.addEventListener('click', () => this.openModalNouvelUtilisateur());
        document.getElementById('formUtilisateur')?.addEventListener('submit', (e) => this.handleSubmitUtilisateur(e));
        document.getElementById('btnDeleteUtilisateur')?.addEventListener('click', () => this.confirmDeleteUtilisateur());
        document.getElementById('btnConfirmDeleteUser')?.addEventListener('click', () => this.executeDeleteUtilisateur());

        // Boutons sauvegarde
        document.getElementById('btnExportDB')?.addEventListener('click', () => this.exportDatabase());
        document.getElementById('btnExportSQL')?.addEventListener('click', () => this.exportSQL());
        document.getElementById('btnImportDB')?.addEventListener('click', () => this.importDatabase());

        // Boutons synchronisation
        document.getElementById('btnTestConnexion')?.addEventListener('click', () => this.testConnexion());
        document.getElementById('btnSyncNow')?.addEventListener('click', () => this.syncNow());
        document.getElementById('btnSyncStatus')?.addEventListener('click', () => this.showSyncStatus());
    }

    // ==================== ENTREPRISE ====================

    /**
     * Charger les infos de l'entreprise
     */
    async loadEntreprise() {
        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;
            const entreprise = await window.api.entreprises.invoke('get', entrepriseId);

            if (entreprise) {
                this.fillFormEntreprise(entreprise);
                this.fillFormFacturation(entreprise);
            }
        } catch (error) {
            console.error('Erreur chargement entreprise:', error);
        }
    }

    /**
     * Remplir formulaire entreprise
     */
    fillFormEntreprise(e) {
        document.getElementById('entNom').value = e.nom || '';
        document.getElementById('entNomCommercial').value = e.nomCommercial || '';
        document.getElementById('entSIRET').value = e.siret || '';
        document.getElementById('entTVA').value = e.numeroTVA || '';
        document.getElementById('entAPE').value = e.codeAPE || '';
        document.getElementById('entAdresse').value = e.adresse || '';
        document.getElementById('entCodePostal').value = e.codePostal || '';
        document.getElementById('entVille').value = e.ville || '';
        document.getElementById('entTelephone').value = e.telephone || '';
        document.getElementById('entEmail').value = e.email || '';
        document.getElementById('entSiteWeb').value = e.siteWeb || '';
    }

    /**
     * Remplir formulaire facturation
     */
    fillFormFacturation(e) {
        document.getElementById('facPrefixeDevis').value = e.prefixeDevis || 'DEV';
        document.getElementById('facPrefixeFacture').value = e.prefixeFacture || 'FAC';
        document.getElementById('facPrefixeContrat').value = e.prefixeContrat || 'CTR';
        document.getElementById('facTVADefaut').value = e.tvaDefaut || '20';
        document.getElementById('facDelaiPaiement').value = e.delaiPaiementDefaut || '30 jours';
        document.getElementById('facValiditeDevis').value = e.validiteDevis || '30';
        document.getElementById('facMentionsLegales').value = e.mentionsLegales || '';
    }

    loadCurrentUserProfile() {
        const user = window.AppState?.user;
        if (!user) return;
        document.getElementById('profilNom').value = user.nom || '';
        document.getElementById('profilPrenom').value = user.prenom || '';
        document.getElementById('profilEmail').value = user.email || '';
        document.getElementById('profilTelephone').value = user.telephone || '';
        document.getElementById('profilMotDePasse').value = '';
    }

    selectTab(tabName) {
        const defaultTab = document.querySelector('#parametresTabs button.active');
        const requestedTab = tabName ? document.getElementById(`tab-${tabName}-tab`) : null;
        const targetTab = requestedTab && requestedTab.parentElement.style.display !== 'none' ? requestedTab : defaultTab;
        if (!targetTab) {
            const firstVisible = Array.from(document.querySelectorAll('#parametresTabs button')).find(btn => btn.parentElement.style.display !== 'none');
            if (!firstVisible) return;
            new bootstrap.Tab(firstVisible).show();
            return;
        }
        const tab = new bootstrap.Tab(targetTab);
        tab.show();
    }

    updateSettingsTabsVisibility() {
        const canUpdateEntreprise = window.hasPermission ? window.hasPermission('update', 'entreprises') : false;
        const canViewUsers = window.hasPermission ? window.hasPermission('list', 'utilisateurs') : false;

        const entrepriseTab = document.getElementById('tab-entreprise-tab');
        const utilisateursTab = document.getElementById('tab-utilisateurs-tab');
        const profilTab = document.getElementById('tab-profil-tab');

        if (entrepriseTab) entrepriseTab.parentElement.style.display = canUpdateEntreprise ? '' : 'none';
        if (utilisateursTab) utilisateursTab.parentElement.style.display = canViewUsers ? '' : 'none';

        const currentActive = document.querySelector('#parametresTabs button.active');
        if (currentActive && currentActive.parentElement.style.display === 'none') {
            const firstVisible = [profilTab, entrepriseTab, utilisateursTab].find(tab => tab && tab.parentElement.style.display !== 'none');
            if (firstVisible) {
                new bootstrap.Tab(firstVisible).show();
            }
        }

        if (!canUpdateEntreprise && !canViewUsers && profilTab) {
            new bootstrap.Tab(profilTab).show();
        }
    }

    async handleSubmitProfil(e) {
        e.preventDefault();

        const form = e.target;
        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            return;
        }

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        if (!data.motDePasse) {
            delete data.motDePasse;
        }

        try {
            const userId = window.AppState?.user?.id;
            if (!userId) {
                throw new Error('Utilisateur introuvable.');
            }

            const response = await window.api.utilisateurs.invoke('update', userId, data);
            if (!response?.success) throw new Error(response?.error || 'Erreur mise à jour du profil.');

            const updatedUser = response.data;
            window.AppState.user = { ...window.AppState.user, ...updatedUser };
            localStorage.setItem('currentUser', JSON.stringify(window.AppState.user));

            showToast('Profil mis à jour', 'success');
            this.loadCurrentUserProfile();
            if (window.updateUserUI) window.updateUserUI(window.AppState.user);
        } catch (error) {
            console.error('Erreur sauvegarde profil:', error);
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    /**
     * Soumission formulaire entreprise
     */
    async handleSubmitEntreprise(e) {
        e.preventDefault();

        const form = e.target;
        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            return;
        }

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        const entrepriseId = window.AppState?.entreprise?.id || 1;

        try {
            await window.api.entreprises.invoke('update', entrepriseId, data);
            showToast('Informations entreprise enregistrées', 'success');

            // Mettre à jour l'état global
            if (window.AppState) {
                window.AppState.entreprise = { ...window.AppState.entreprise, ...data };
            }
        } catch (error) {
            console.error('Erreur sauvegarde entreprise:', error);
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    /**
     * Soumission formulaire facturation
     */
    async handleSubmitFacturation(e) {
        e.preventDefault();

        const form = e.target;
        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            return;
        }

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        data.validiteDevis = parseInt(data.validiteDevis) || 30;

        const entrepriseId = window.AppState?.entreprise?.id || 1;

        try {
            await window.api.entreprises.invoke('update', entrepriseId, data);
            showToast('Paramètres facturation enregistrés', 'success');
        } catch (error) {
            console.error('Erreur sauvegarde facturation:', error);
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    // ==================== UTILISATEURS ====================

    /**
     * Charger la liste des utilisateurs
     */
    async loadUtilisateurs() {
        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;
            const response = await window.api.utilisateurs.invoke('list', { entrepriseId });
            this.utilisateurs = response?.data?.items || [];
            this.renderUtilisateursTable();
            this.updatePermissionsUI();
        } catch (error) {
            console.error('Erreur chargement utilisateurs:', error);
            showToast('Erreur lors du chargement des utilisateurs', 'error');
        }
    }

    /**
     * Afficher les utilisateurs dans le tableau
     */
    renderUtilisateursTable() {
        const tbody = document.getElementById('utilisateursTbody');
        if (!tbody) return;

        if (this.utilisateurs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-secondary">Aucun utilisateur</td></tr>';
            return;
        }

        const canEditUsers = window.hasPermission ? window.hasPermission('update', 'utilisateurs') : false;
        const canDeleteUsers = window.hasPermission ? window.hasPermission('delete', 'utilisateurs') : false;

        tbody.innerHTML = this.utilisateurs.map((u, index) => {
            let roleCode = normalizeUtilisateurRoleCode(u.roleCode || u.roleNom || '');
            const roleLabel = UTILISATEUR_ROLE_LABELS[roleCode] || u.roleNom || u.roleCode || (u.roleId ? (UTILISATEUR_ROLE_OPTIONS.find(r => r.id === parseInt(u.roleId, 10))?.label || '—') : '—');
            const roleBadge = UTILISATEUR_ROLE_BADGES[roleCode] || 'bg-secondary';

            const isActif = u.statut === 'actif' || u.statut === 'Actif';
            const mustChange = u.must_change_password === 1 || u.must_change_password === '1';

            return `
                <tr data-id="${u.id}">
                    <td>${index + 1}</td>
                    <td>
                        <div class="fw-semibold">${this.escapeHtml(`${u.prenom} ${u.nom}`.trim())}</div>
                        <small class="text-secondary">${this.escapeHtml(u.telephone || '')}</small>
                        ${mustChange ? '<br><span class="badge bg-warning text-dark mt-1">Premier login</span>' : ''}
                    </td>
                    <td>${this.escapeHtml(u.email)}</td>
                    <td><span class="badge ${roleBadge}">${this.escapeHtml(roleLabel)}</td>
                    <td class="d-none d-md-table-cell"><small>${u.derniereConnexion ? this.formatDateTime(u.derniereConnexion) : 'Jamais'}</small></td>
                    <td>
                        <span class="badge ${isActif ? 'bg-success' : 'bg-danger'}">
                            ${isActif ? 'Actif' : 'Inactif'}
                        </span>
                        ${mustChange ? '<br><span class="badge bg-warning text-dark mt-1">Changement MDP requis</span>' : ''}
                    </td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary btn-edit" data-id="${u.id}" title="Modifier" ${canEditUsers ? '' : 'disabled'}>
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-outline-info btn-download-pdf" data-id="${u.id}" title="Télécharger accès PDF">
                                <i class="bi bi-file-earmark-pdf"></i>
                            </button>
                            <button class="btn btn-outline-danger btn-delete" data-id="${u.id}" title="Supprimer" ${canDeleteUsers ? '' : 'disabled'}>
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.querySelectorAll('.btn-edit').forEach(btn => {
            if (btn.disabled) return;
            btn.addEventListener('click', (e) => this.openModalEditionUtilisateur(e.currentTarget.dataset.id));
        });
        tbody.querySelectorAll('.btn-download-pdf').forEach(btn => {
            btn.addEventListener('click', (e) => this.downloadUtilisateurPDF(e.currentTarget.dataset.id));
        });
        tbody.querySelectorAll('.btn-delete').forEach(btn => {
            if (btn.disabled) return;
            btn.addEventListener('click', (e) => this.confirmDeleteUtilisateur(e.currentTarget.dataset.id));
        });
    }

    /**
     * Télécharger le PDF d'un utilisateur existant
     */
    async downloadUtilisateurPDF(id) {
        try {
            const user = this.utilisateurs.find(u => u.id === parseInt(id));
            if (!user) return;

            let roleCode = normalizeUtilisateurRoleCode(user.roleCode || user.roleNom || '');
            const roleLabel = UTILISATEUR_ROLE_LABELS[roleCode] || user.roleNom || user.roleCode || '—';
            const entrepriseNom = window.AppState?.entreprise?.nom || 'TIA INFO BUILD';

            const isAdmin = window.AppState?.roles?.includes('ADMIN') || window.AppState?.roleCode === 'ADMIN';
            const mustChange = user.must_change_password === 1 || user.must_change_password === '1';

            if (!isAdmin && !mustChange) {
                showToast('Cet utilisateur a déjà modifié son mot de passe. Seul l\'administrateur peut télécharger les identifiants.', 'warning');
                return;
            }

            const pdfData = {
                nom: user.nom || '',
                prenom: user.prenom || '',
                email: user.email || '',
                plainPassword: mustChange ? '******** (à récupérer avant première connexion)' : '******** (Masqué pour sécurité)',
                roleLabel,
                entrepriseNom
            };

            const pdfResult = await window.ipcRaw.invoke('utilisateurs:generateLoginPDF', pdfData);
            if (pdfResult?.success) {
                showToast('📄 PDF des accès généré et ouvert.', 'info');
            } else {
                throw new Error(pdfResult?.error || 'Erreur inconnue lors de la génération PDF');
            }
        } catch (error) {
            console.error('Erreur téléchargement PDF utilisateur:', error);
            if (window.showToast) window.showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    /**
     * Ouvrir modale nouvel utilisateur
     */
    openModalNouvelUtilisateur() {
        this.utilisateurEnEdition = null;
        this.resetFormUtilisateur();
        document.getElementById('modalUtilisateurLabel').textContent = 'Nouvel utilisateur';
        document.getElementById('btnDeleteUtilisateur').style.display = 'none';

        const modal = new bootstrap.Modal(document.getElementById('modalUtilisateur'));
        modal.show();
    }

    /**
     * Ouvrir modale édition utilisateur
     */
    async openModalEditionUtilisateur(id) {
        try {
            const response = await window.api.utilisateurs.invoke('get', parseInt(id));
            const user = response?.data;
            if (!user) {
                showToast('Utilisateur non trouvé', 'error');
                return;
            }

            this.utilisateurEnEdition = user;
            this.fillFormUtilisateur(user);
            this.updateAdminOptionState(this.utilisateurEnEdition.id);
            document.getElementById('modalUtilisateurLabel').textContent = `Modifier: ${user.prenom} ${user.nom}`;
            document.getElementById('btnDeleteUtilisateur').style.display = 'inline-block';
            document.getElementById('btnDeleteUtilisateur').dataset.id = id;

            document.getElementById('userMotDePasse').placeholder = 'Laisser vide pour ne pas changer';

            const modal = new bootstrap.Modal(document.getElementById('modalUtilisateur'));
            modal.show();
        } catch (error) {
            console.error('Erreur chargement utilisateur:', error);
            showToast('Erreur lors du chargement de l\'utilisateur', 'error');
        }
    }

    /**
     * Réinitialiser formulaire utilisateur
     */
    resetFormUtilisateur() {
        const form = document.getElementById('formUtilisateur');
        if (form) form.reset();
        document.getElementById('userId').value = '';
        document.getElementById('userRole').value = '';
        document.getElementById('userActif').checked = true;
        this.updateAdminOptionState();
    }

    /**
     * Remplir formulaire utilisateur
     */
    fillFormUtilisateur(u) {
        document.getElementById('userId').value = u.id;
        document.getElementById('userNom').value = u.nom || '';
        document.getElementById('userPrenom').value = u.prenom || '';
        document.getElementById('userEmail').value = u.email || '';
        document.getElementById('userTelephone').value = u.telephone || '';

        const roleCode = normalizeUtilisateurRoleCode(u.roleCode || u.roleNom || '');
        document.getElementById('userRole').value = roleCode;

        // Mapper statut ('actif'/'inactif') vers checkbox actif
        const isActif = u.statut === 'actif' || u.statut === 'Actif';
        document.getElementById('userActif').checked = isActif;
    }

    /**
     * Soumission formulaire utilisateur
     */
    getRoleIdFromCode(roleValue) {
        if (!roleValue) return null;
        const normalized = roleValue.toString().trim().toUpperCase();
        return UTILISATEUR_ROLE_CODE_TO_ID[normalized] || null;
    }

    hasAdminUser(excludeUserId = null) {
        return this.utilisateurs.some(u => {
            const roleCode = normalizeUtilisateurRoleCode(u.roleCode || u.roleNom || '');
            if (roleCode !== 'ADMIN') return false;
            return excludeUserId ? u.id !== excludeUserId : true;
        });
    }

    updateAdminOptionState(excludeUserId = null) {
        const roleSelect = document.getElementById('userRole');
        if (!roleSelect) return;
        const adminOption = roleSelect.querySelector('option[value="ADMIN"]');
        if (!adminOption) return;

        const hasOtherAdmin = this.hasAdminUser(excludeUserId);
        adminOption.disabled = hasOtherAdmin;
        adminOption.title = hasOtherAdmin ? 'Un administrateur existe déjà dans cette entreprise' : '';
    }

    updatePermissionsUI() {
        const addUserButton = document.getElementById('btnNouvelUtilisateur');
        const canCreateUsers = window.hasPermission ? window.hasPermission('create', 'utilisateurs') : false;
        if (addUserButton) {
            addUserButton.classList.toggle('d-none', !canCreateUsers);
        }

        const canUpdateEntreprise = window.hasPermission ? window.hasPermission('update', 'entreprises') : false;
        const entrepriseFields = document.querySelectorAll('#formEntreprise input, #formEntreprise select, #formEntreprise button');
        const facturationFields = document.querySelectorAll('#formFacturation input, #formFacturation select, #formFacturation button');

        entrepriseFields.forEach(el => {
            if (el.tagName === 'BUTTON') {
                el.disabled = !canUpdateEntreprise;
            } else {
                el.readOnly = !canUpdateEntreprise;
                el.disabled = !canUpdateEntreprise;
            }
        });
        facturationFields.forEach(el => {
            if (el.tagName === 'BUTTON') {
                el.disabled = !canUpdateEntreprise;
            } else {
                el.readOnly = !canUpdateEntreprise;
                el.disabled = !canUpdateEntreprise;
            }
        });
    }

    async handleSubmitUtilisateur(e) {
        e.preventDefault();

        const form = e.target;
        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            return;
        }

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        const isActif = data.actif === 'on';
        data.statut = isActif ? 'actif' : 'inactif';
        delete data.actif;

        const roleCode = data.role ? data.role.toString().trim().toUpperCase() : '';
        const roleId = this.getRoleIdFromCode(roleCode);
        if (!roleId) {
            showToast('Veuillez choisir un rôle valide.', 'error');
            return;
        }
        data.roleId = roleId;
        delete data.role;

        const entrepriseId = window.AppState?.entreprise?.id || 1;
        const isEdit = !!data.id;
        const editingId = parseInt(data.id, 10);
        delete data.id;

        const hasOtherAdmin = roleId === 1 && this.hasAdminUser(isEdit ? editingId : null);
        if (hasOtherAdmin) {
            showToast('Il ne peut y avoir qu\'un seul administrateur par entreprise.', 'error');
            return;
        }

        if (isEdit) {
            const canUpdate = window.hasPermission ? window.hasPermission('update', 'utilisateurs') : false;
            if (!canUpdate) {
                showToast('Vous n\'avez pas l\'autorisation de modifier cet utilisateur.', 'error');
                return;
            }
        } else {
            const canCreate = window.hasPermission ? window.hasPermission('create', 'utilisateurs') : false;
            if (!canCreate) {
                showToast('Vous n\'avez pas l\'autorisation de créer un utilisateur.', 'error');
                return;
            }
        }

        // Capturer le mot de passe en clair AVANT la soumission (pour le PDF)
        const plainPassword = data.motDePasse || null;

        // Ne pas envoyer le mot de passe s'il est vide
        if (!data.motDePasse) {
            delete data.motDePasse;
        }

        try {
            if (isEdit) {
                await window.api.utilisateurs.invoke('update', editingId, data);
                showToast('Utilisateur modifié avec succès', 'success');
            } else {
                const response = await window.api.utilisateurs.invoke('create', data, entrepriseId);

                // Message de succès personnalisé (avec info employé si créé)
                if (response?.employeCreated) {
                    showToast('✅ Utilisateur créé, fiche employé initialisée, RH notifié.', 'success');
                } else {
                    showToast('Utilisateur créé avec succès', 'success');
                }

                // Générer le PDF des credentials si un mot de passe a été saisi
                if (plainPassword && response?.data) {
                    const roleLabel = UTILISATEUR_ROLE_LABELS[data.role?.toUpperCase()] || data.role || '';
                    const entrepriseNom = window.AppState?.entreprise?.nom || 'TIA INFO BUILD';
                    const pdfData = {
                        nom: data.nom || '',
                        prenom: data.prenom || '',
                        email: data.email || '',
                        plainPassword,
                        roleLabel,
                        entrepriseNom
                    };

                    try {
                        const pdfResult = await window.ipcRaw.invoke('utilisateurs:generateLoginPDF', pdfData);
                        if (pdfResult?.success) {
                            showToast('📄 PDF des informations de connexion généré et ouvert.', 'info');
                        }
                    } catch (pdfErr) {
                        console.warn('PDF generation failed:', pdfErr);
                    }
                }
            }

            bootstrap.Modal.getInstance(document.getElementById('modalUtilisateur'))?.hide();
            await this.loadUtilisateurs();

        } catch (error) {
            console.error('Erreur sauvegarde utilisateur:', error);
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    /**
     * Confirmer suppression utilisateur
     */
    confirmDeleteUtilisateur(id) {
        const userId = id || document.getElementById('btnDeleteUtilisateur')?.dataset.id;
        if (!userId) return;

        this.utilisateurEnEdition = { id: parseInt(userId) };
        const user = this.utilisateurs.find(u => u.id === parseInt(userId));
        document.getElementById('deleteUserName').textContent = user ? `${user.prenom} ${user.nom}` : 'cet utilisateur';

        bootstrap.Modal.getInstance(document.getElementById('modalUtilisateur'))?.hide();

        setTimeout(() => {
            new bootstrap.Modal(document.getElementById('modalConfirmDeleteUser')).show();
        }, 300);
    }

    /**
     * Exécuter suppression utilisateur
     */
    async executeDeleteUtilisateur() {
        if (!this.utilisateurEnEdition?.id) return;

        try {
            await window.api.utilisateurs.invoke('delete', this.utilisateurEnEdition.id);
            showToast('Utilisateur supprimé', 'success');

            bootstrap.Modal.getInstance(document.getElementById('modalConfirmDeleteUser'))?.hide();
            await this.loadUtilisateurs();

        } catch (error) {
            console.error('Erreur suppression:', error);
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    // ==================== PRÉFÉRENCES ====================

    /**
     * Charger les préférences utilisateur
     */
    async loadPreferences() {
        try {
            const userId = window.AppState?.user?.id;
            if (!userId) return;

            const prefs = await window.api.preferences.invoke('get', userId);

            if (prefs) {
                document.getElementById('themeLight').checked = prefs.theme === 'light';
                document.getElementById('themeDark').checked = prefs.theme === 'dark';
                document.getElementById('themeAuto').checked = prefs.theme === 'auto' || !prefs.theme;
                document.getElementById('prefLangue').value = prefs.langue || 'fr';
                document.getElementById('prefDateFormat').value = prefs.dateFormat || 'DD/MM/YYYY';
                document.getElementById('prefDevise').value = prefs.devise || 'MGA';
                document.getElementById('notifEmail').checked = prefs.notifEmail !== false;
                document.getElementById('notifPush').checked = prefs.notifPush !== false;
                document.getElementById('notifFacturesRetard').checked = prefs.notifFacturesRetard !== false;
                document.getElementById('notifStockBas').checked = prefs.notifStockBas !== false;

                // Appliquer le thème
                this.applyTheme(prefs.theme || 'auto');
                // Charger la devise persistée
                const savedDevise = localStorage.getItem('tia_devise');
                if (savedDevise) {
                    document.getElementById('prefDevise').value = savedDevise;
                }
            }
        } catch (error) {
            console.error('Erreur chargement préférences:', error);
        }
    }

    /**
     * Soumission préférences
     */
    async handleSubmitPreferences(e) {
        e.preventDefault();

        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        data.notifEmail = data.notifEmail === 'on';
        data.notifPush = data.notifPush === 'on';
        data.notifFacturesRetard = data.notifFacturesRetard === 'on';
        data.notifStockBas = data.notifStockBas === 'on';

        // Déterminer le thème sélectionné
        if (document.getElementById('themeLight').checked) data.theme = 'light';
        else if (document.getElementById('themeDark').checked) data.theme = 'dark';
        else data.theme = 'auto';
        // Persister la devise globalement et notifier le changement
        const nouvelleDevise = data.devise || 'MGA';
        localStorage.setItem('tia_devise', nouvelleDevise);

        const userId = window.AppState?.user?.id;
        if (!userId) return;

        try {
            await window.api.preferences.invoke('update', userId, data);
            showToast('Préférences enregistrées', 'success');

            // Appliquer le thème immédiatement
            this.applyTheme(data.theme);
            // Appliquer le changement de devise immédiatement dans toute l'interface
            if (typeof window.onCurrencyChanged === 'function') {
                window.onCurrencyChanged(nouvelleDevise);
            }
        } catch (error) {
            console.error('Erreur sauvegarde préférences:', error);
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    /**
     * Appliquer le thème
     */
    applyTheme(theme) {
        const html = document.documentElement;
        if (theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            html.setAttribute('data-bs-theme', 'dark');
        } else {
            html.setAttribute('data-bs-theme', 'light');
        }
    }

    // ==================== SAUVEGARDE ====================

    /**
     * Charger l'historique des sauvegardes
     */
    async loadBackups() {
        const tbody = document.getElementById('backupsTbody');
        if (!tbody) return;

        try {
            const backups = await window.api.backup.invoke('list');
            this.backups = backups || [];

            if (this.backups.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-secondary">Aucune sauvegarde</td></tr>';
                return;
            }

            tbody.innerHTML = this.backups.map(b => `
                <tr>
                    <td>${this.formatDateTime(b.date)}</td>
                    <td><span class="badge bg-${b.type === 'auto' ? 'info' : 'primary'}">${b.type === 'auto' ? 'Automatique' : 'Manuelle'}</span></td>
                    <td>${this.formatFileSize(b.taille)}</td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary" onclick="window.parametresController.downloadBackup('${b.fichier}')" title="Télécharger">
                                <i class="bi bi-download"></i>
                            </button>
                            <button class="btn btn-outline-warning" onclick="window.parametresController.restoreBackup('${b.fichier}')" title="Restaurer">
                                <i class="bi bi-arrow-counterclockwise"></i>
                            </button>
                            <button class="btn btn-outline-danger" onclick="window.parametresController.deleteBackup('${b.fichier}')" title="Supprimer">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');
        } catch (error) {
            console.error('Erreur chargement sauvegardes:', error);
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-danger">Erreur chargement</td></tr>';
        }
    }

    /**
     * Exporter la base de données (SQLite)
     */
    async exportDatabase() {
        try {
            const bytes = await window.api.backup.invoke('exportSQLite');
            const blob = new Blob([bytes], { type: 'application/x-sqlite3' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `tiainfo_backup_${new Date().toISOString().split('T')[0]}.sqlite`;
            link.click();
            URL.revokeObjectURL(url);
            showToast('Export SQLite terminé', 'success');
        } catch (error) {
            console.error('Erreur export SQLite:', error);
            showToast('Erreur lors de l\'export', 'error');
        }
    }
    /**
     * Exporter en SQL
     */
    async exportSQL() {
        try {
            const bytes = await window.api.backup.invoke('exportSQL');
            const blob = new Blob([bytes], { type: 'application/sql' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `tiainfo_backup_${new Date().toISOString().split('T')[0]}.sql`;
            link.click();
            URL.revokeObjectURL(url);
            showToast('Export SQL terminé', 'success');
        } catch (error) {
            console.error('Erreur export SQL:', error);
            showToast('Erreur lors de l\'export', 'error');
        }
    }

    /**
     * Importer une base de données
     */
    async importDatabase() {
        const fileInput = document.getElementById('importFile');
        const file = fileInput?.files[0];

        if (!file) {
            showToast('Sélectionnez un fichier', 'warning');
            return;
        }

        if (!confirm('Attention: Cette action va écraser toutes les données actuelles. Continuer ?')) {
            return;
        }

        try {
            const arrayBuffer = await file.arrayBuffer();
            await window.api.backup.invoke('import', new Uint8Array(arrayBuffer));
            showToast('Import terminé. Redémarrage nécessaire.', 'success');
            setTimeout(() => window.location.reload(), 2000);
        } catch (error) {
            console.error('Erreur import:', error);
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    /**
     * Télécharger une sauvegarde
     */
    async downloadBackup(filename) {
        try {
            const bytes = await window.api.backup.invoke('download', filename);
            const blob = new Blob([bytes]);
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Erreur téléchargement:', error);
            showToast('Erreur lors du téléchargement', 'error');
        }
    }

    /**
     * Restaurer une sauvegarde
     */
    async restoreBackup(filename) {
        if (!confirm('Restaurer cette sauvegarde ? Les données actuelles seront perdues.')) return;

        try {
            await window.api.backup.invoke('restore', filename);
            showToast('Restauration terminée. Redémarrage nécessaire.', 'success');
            setTimeout(() => window.location.reload(), 2000);
        } catch (error) {
            console.error('Erreur restauration:', error);
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    /**
     * Supprimer une sauvegarde
     */
    async deleteBackup(filename) {
        if (!confirm('Supprimer cette sauvegarde ?')) return;

        try {
            await window.api.backup.invoke('delete', filename);
            showToast('Sauvegarde supprimée', 'success');
            await this.loadBackups();
        } catch (error) {
            console.error('Erreur suppression:', error);
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    /**
     * Soumission config sauvegarde auto
     */
    async handleSubmitAutoBackup(e) {
        e.preventDefault();

        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        data.autoBackup = data.autoBackup === 'on';
        data.retention = parseInt(data.retention) || 30;

        try {
            await window.api.backup.invoke('setAutoConfig', data);
            showToast('Configuration sauvegarde auto enregistrée', 'success');
        } catch (error) {
            console.error('Erreur config auto backup:', error);
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    // ==================== SYNCHRONISATION ====================

    /**
     * Charger la config de synchronisation
     */
    async loadSyncConfig() {
        try {
            const response = await window.api.sync.invoke('getConfig');
            const config = response?.data;

            if (config) {
                document.getElementById('syncApiUrl').value = config.apiUrl || '';
                document.getElementById('syncApiKey').value = config.apiKey || '';
                document.getElementById('syncEntrepriseId').value = config.entrepriseId || window.AppState?.entreprise?.id || '';
                document.getElementById('autoSync').checked = config.autoSync || false;
                document.getElementById('syncInterval').value = config.interval || 60;
                document.getElementById('syncOnStartup').checked = config.syncOnStartup !== false;
                document.getElementById('syncOnChange').checked = config.syncOnChange || false;
            }

            await this.checkSyncStatus();
        } catch (error) {
            console.error('Erreur chargement config sync:', error);
        }
    }

    /**
     * Vérifier le statut de connexion
     */
    async checkSyncStatus() {
        const statusEl = document.getElementById('syncStatus');
        if (!statusEl) return;

        try {
            const status = await window.api.sync.invoke('status');
            if (status.connected) {
                statusEl.innerHTML = '<span class="badge bg-success"><i class="bi bi-wifi me-1"></i>Connecté</span>';
            } else {
                statusEl.innerHTML = '<span class="badge bg-danger"><i class="bi bi-wifi-off me-1"></i>Déconnecté</span>';
            }
        } catch (error) {
            statusEl.innerHTML = '<span class="badge bg-secondary"><i class="bi bi-question-circle me-1"></i>Inconnu</span>';
        }
    }

    /**
     * Tester la connexion
     */
    async testConnexion() {
        const btn = document.getElementById('btnTestConnexion');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Test...';
        btn.disabled = true;

        try {
            const result = await window.api.sync.invoke('testConnection');
            if (result.success) {
                showToast('Connexion réussie', 'success');
                await this.checkSyncStatus();
            } else {
                showToast(`Échec: ${result.message}`, 'error');
            }
        } catch (error) {
            console.error('Erreur test connexion:', error);
            showToast(`Erreur: ${error.message}`, 'error');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }

    /**
     * Sauvegarder config synchronisation
     */
    async handleSubmitSyncConfig(e) {
        e.preventDefault();

        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        try {
            await window.api.sync.invoke('setConfig', data);
            showToast('Configuration synchronisation enregistrée', 'success');
            await this.checkSyncStatus();
        } catch (error) {
            console.error('Erreur config sync:', error);
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    /**
     * Sauvegarder config auto sync
     */
    async handleSubmitAutoSync(e) {
        e.preventDefault();

        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        data.autoSync = data.autoSync === 'on';
        data.syncOnStartup = data.syncOnStartup === 'on';
        data.syncOnChange = data.syncOnChange === 'on';
        data.interval = parseInt(data.interval) || 60;

        try {
            await window.api.sync.invoke('setAutoConfig', data);
            showToast('Configuration sync auto enregistrée', 'success');
        } catch (error) {
            console.error('Erreur config auto sync:', error);
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    /**
     * Synchroniser maintenant
     */
    async syncNow() {
        const btn = document.getElementById('btnSyncNow');
        const progress = document.getElementById('syncProgress');
        const log = document.getElementById('syncLog');

        btn.disabled = true;
        btn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Synchronisation...';
        progress.hidden = false;
        progress.querySelector('.progress-bar').style.width = '0%';
        log.innerHTML = '<small class="text-info">Démarrage de la synchronisation...</small>';

        try {
            // Simuler la progression
            let progressValue = 0;
            const progressInterval = setInterval(() => {
                progressValue += Math.random() * 10;
                if (progressValue > 90) progressValue = 90;
                progress.querySelector('.progress-bar').style.width = `${progressValue}%`;
            }, 500);

            const result = await window.api.sync.invoke('syncNow');

            clearInterval(progressInterval);
            progress.querySelector('.progress-bar').style.width = '100%';

            if (result.success) {
                log.innerHTML = `<small class="text-success"><i class="bi bi-check-circle me-1"></i>${result.message || 'Synchronisation terminée avec succès'}</small>`;
                showToast('Synchronisation terminée', 'success');
            } else {
                log.innerHTML = `<small class="text-danger"><i class="bi bi-x-circle me-1"></i>${result.message || 'Erreur lors de la synchronisation'}</small>`;
                showToast(`Erreur: ${result.message}`, 'error');
            }

            await this.loadSyncHistory();
        } catch (error) {
            clearInterval(progressInterval);
            console.error('Erreur sync:', error);
            log.innerHTML = `<small class="text-danger"><i class="bi bi-x-circle me-1"></i>Erreur: ${error.message}</small>`;
            showToast(`Erreur: ${error.message}`, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-cloud-arrow-up me-1"></i>Synchroniser maintenant';
            setTimeout(() => { progress.hidden = true; }, 3000);
        }
    }

    /**
     * Afficher le statut détaillé
     */
    async showSyncStatus() {
        try {
            const response = await window.api.sync.invoke('getStatus');
            const status = response?.data;
            const log = document.getElementById('syncLog');

            if (status) {
                log.innerHTML = `
                    <small class="text-secondary">
                        <strong>Dernière sync:</strong> ${status.derniereSync ? this.formatDateTime(status.derniereSync) : 'Jamais'}<br>
                        <strong>Statut:</strong> ${status.enCours ? 'En cours' : 'Arrêté'}<br>
                        <strong>Éléments en attente:</strong> ${status.enAttente || 0}<br>
                        <strong>Dernière erreur:</strong> ${status.derniereErreur || 'Aucune'}
                    </small>
                `;
            }
        } catch (error) {
            console.error('Erreur statut sync:', error);
        }
    }

    /**
     * Charger l'historique des synchronisations
     */
    /**
     * Charger l'historique des synchronisations
     */
    async loadSyncHistory() {
        const tbody = document.getElementById('syncHistoryTbody');
        if (!tbody) return;

        try {
            const response = await window.api.sync.invoke('getHistory');
            this.syncHistory = response?.data || [];

            if (this.syncHistory.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-secondary">Aucune synchronisation</td></tr>';
                return;
            }

            tbody.innerHTML = this.syncHistory.map(s => {
                const statutClass = s.statut === 'success' ? 'bg-success' : s.statut === 'error' ? 'bg-danger' : 'bg-warning text-dark';
                const statutLabel = s.statut === 'success' ? 'Succès' : s.statut === 'error' ? 'Erreur' : 'Partiel';

                return `
                    <tr>
                        <td>${this.formatDateTime(s.date)}</td>
                        <td><span class="badge bg-${s.type === 'auto' ? 'info' : 'primary'}">${s.type === 'auto' ? 'Automatique' : 'Manuelle'}</span></td>
                        <td><span class="badge ${statutClass}">${statutLabel}</span></td>
                        <td><small class="text-secondary">${this.escapeHtml(s.details || '—')}</small></td>
                    </tr>
                `;
            }).join('');
        } catch (error) {
            console.error('Erreur chargement historique sync:', error);
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-danger">Erreur chargement</td></tr>';
        }
    }

    // Utilitaires
    formatDate(dateStr) {
        if (!dateStr) return '—';
        const date = new Date(dateStr);
        return date.toLocaleDateString('fr-FR');
    }

    formatDateTime(dateStr) {
        if (!dateStr) return '—';
        const date = new Date(dateStr);
        return date.toLocaleString('fr-FR');
    }

    formatFileSize(bytes) {
        if (!bytes) return '—';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Instance globale
window.parametresController = new ParametresController();