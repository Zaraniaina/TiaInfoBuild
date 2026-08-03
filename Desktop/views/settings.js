/**
 * Paramètres / Administration View Controller
 * Gère la configuration de l'entreprise, utilisateurs, préférences, sauvegarde, synchronisation
 */

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
            });
        });

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
            const result = await window.api.utilisateurs.invoke('list', { entrepriseId });
            this.utilisateurs = result.items || [];
            this.renderUtilisateursTable();
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

        tbody.innerHTML = this.utilisateurs.map((u, index) => {
            const roleLabels = {
                'admin': 'Administrateur',
                'manager': 'Manager',
                'commercial': 'Commercial',
                'conducteur': 'Conducteur de travaux',
                'employe': 'Employé',
                'comptable': 'Comptable'
            };

            const roleBadges = {
                'admin': 'bg-danger',
                'manager': 'bg-warning text-dark',
                'commercial': 'bg-primary',
                'conducteur': 'bg-info',
                'employe': 'bg-secondary',
                'comptable': 'bg-success'
            };

            return `
                <tr data-id="${u.id}">
                    <td>${index + 1}</td>
                    <td>
                        <div class="fw-semibold">${this.escapeHtml(`${u.prenom} ${u.nom}`.trim())}</div>
                        <small class="text-secondary">${this.escapeHtml(u.telephone || '')}</small>
                    </td>
                    <td>${this.escapeHtml(u.email)}</td>
                    <td><span class="badge ${roleBadges[u.role] || 'bg-secondary'}">${roleLabels[u.role] || u.role}</span></td>
                    <td class="d-none d-md-table-cell"><small>${u.derniereConnexion ? this.formatDateTime(u.derniereConnexion) : 'Jamais'}</small></td>
                    <td>
                        <span class="badge ${u.actif ? 'bg-success' : 'bg-danger'}">
                            ${u.actif ? 'Actif' : 'Inactif'}
                        </span>
                    </td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary btn-edit" data-id="${u.id}" title="Modifier">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-outline-danger btn-delete" data-id="${u.id}" title="Supprimer">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => this.openModalEditionUtilisateur(e.currentTarget.dataset.id));
        });
        tbody.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => this.confirmDeleteUtilisateur(e.currentTarget.dataset.id));
        });
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
            const user = await window.api.utilisateurs.invoke('get', parseInt(id));
            if (!user) {
                showToast('Utilisateur non trouvé', 'error');
                return;
            }

            this.utilisateurEnEdition = user;
            this.fillFormUtilisateur(user);
            document.getElementById('modalUtilisateurLabel').textContent = `Modifier: ${user.prenom} ${user.nom}`;
            document.getElementById('btnDeleteUtilisateur').style.display = 'inline-block';
            document.getElementById('btnDeleteUtilisateur').dataset.id = id;

            // Masquer le champ mot de passe pour l'édition (optionnel)
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
        document.getElementById('userRole').value = 'employe';
        document.getElementById('userActif').checked = true;
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
        document.getElementById('userRole').value = u.role || 'employe';
        document.getElementById('userActif').checked = u.actif !== false;
    }

    /**
     * Soumission formulaire utilisateur
     */
    async handleSubmitUtilisateur(e) {
        e.preventDefault();

        const form = e.target;
        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            return;
        }

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        data.actif = data.actif === 'on';

        // Ne pas envoyer le mot de passe s'il est vide
        if (!data.motDePasse) {
            delete data.motDePasse;
        }

        const entrepriseId = window.AppState?.entreprise?.id || 1;
        const isEdit = !!data.id;
        delete data.id;

        try {
            if (isEdit) {
                await window.api.utilisateurs.invoke('update', parseInt(formData.get('id')), data);
                showToast('Utilisateur modifié avec succès', 'success');
            } else {
                await window.api.utilisateurs.invoke('create', data, entrepriseId);
                showToast('Utilisateur créé avec succès', 'success');
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
        // Persister la devise globalement
        localStorage.setItem('tia_devise', data.devise || 'MGA');

        const userId = window.AppState?.user?.id;
        if (!userId) return;

        try {
            await window.api.preferences.invoke('update', userId, data);
            showToast('Préférences enregistrées', 'success');

            // Appliquer le thème immédiatement
            this.applyTheme(data.theme);
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
            const blob = await window.api.backup.invoke('exportSQLite');
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `tiainfo_backup_${new Date().toISOString().split('T')[0]}.sqlite`;
            link.click();
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
            const blob = await window.api.backup.invoke('exportSQL');
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `tiainfo_backup_${new Date().toISOString().split('T')[0]}.sql`;
            link.click();
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
            await window.api.backup.invoke('import', file);
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
            const blob = await window.api.backup.invoke('download', filename);
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.click();
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
            const config = await window.api.sync.invoke('getConfig');

            if (config) {
                document.getElementById('syncApiUrl').value = config.apiUrl || '';
                document.getElementById('syncApiKey').value = config.apiKey || '';
                document.getElementById('syncEntrepriseId').value = config.entrepriseId || window.AppState?.entreprise?.id || '';
                document.getElementById('autoSync').checked = config.autoSync || false;
                document.getElementById('syncInterval').value = config.interval || 60;
                document.getElementById('syncOnStartup').checked = config.syncOnStartup !== false;
                document.getElementById('syncOnChange').checked = config.syncOnChange || false;
            }

            // Vérifier le statut de connexion
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
            const status = await window.api.sync.invoke('getStatus');
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
    async loadSyncHistory() {
        const tbody = document.getElementById('syncHistoryTbody');
        if (!tbody) return;

        try {
            const history = await window.api.sync.invoke('getHistory');
            this.syncHistory = history || [];

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