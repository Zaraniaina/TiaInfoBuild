/**
 * Équipes View Controller
 * Gère la liste, création, édition, suppression des équipes
 * Gestion des membres et assignation aux chantiers
 */

class EquipesController {
    constructor() {
        this.currentPage = 1;
        this.pageSize = 20;
        this.totalItems = 0;
        this.filters = {
            search: '',
            chefEquipeId: ''
        };
        this.equipeEnEdition = null;
        this.employesCache = [];
        this.chantiersCache = [];
        this.equipesData = [];
    }

    /**
     * Initialiser le contrôleur
     */
    async init() {
        await this.loadEmployes();
        await this.loadChantiers();
        this.bindEvents();
        await this.loadEquipes();
    }

    /**
     * Charger la liste des employés pour les selects
     */
    async loadEmployes() {
        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;
            const result = await window.api.employes.invoke('list', {
                entrepriseId,
                limit: 1000,
                statut: 'actif'
            });
            this.employesCache = result.items || [];
            this.populateEmployeSelects();
            this.populateChefFilter();
        } catch (error) {
            console.error('Erreur chargement employés:', error);
        }
    }

    formatCurrency(amount) {
        return window.formatCurrencyGlobal ? window.formatCurrencyGlobal(amount) : new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'MGA',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount || 0);
    }

    /**
     * Charger la liste des chantiers pour les selects
     */
    async loadChantiers() {
        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;
            const result = await window.api.chantiers.invoke('list', {
                entrepriseId,
                limit: 1000
            });
            this.chantiersCache = result.items || [];
            this.populateChantierSelects();
        } catch (error) {
            console.error('Erreur chargement chantiers:', error);
        }
    }

    /**
     * Remplir les selects employés
     */
    populateEmployeSelects() {
        const selects = document.querySelectorAll('#amEmploye, #eqChef');
        selects.forEach(select => {
            const currentValue = select.value;
            if (select.id === 'eqChef') {
                select.innerHTML = '<option value="">Sélectionner un chef</option>';
            } else {
                select.innerHTML = '<option value="">Sélectionner un employé</option>';
            }
            this.employesCache.forEach(emp => {
                const option = document.createElement('option');
                option.value = emp.id;
                option.textContent = `${emp.prenom} ${emp.nom} (${emp.poste || '—'})`;
                select.appendChild(option);
            });
            select.value = currentValue;
        });
    }

    /**
     * Remplir les selects chantiers
     */
    populateChantierSelects() {
        const selects = document.querySelectorAll('#acChantier');
        selects.forEach(select => {
            const currentValue = select.value;
            select.innerHTML = '<option value="">Sélectionner un chantier</option>';
            this.chantiersCache.forEach(c => {
                const option = document.createElement('option');
                option.value = c.id;
                option.textContent = c.nom || `Chantier #${c.id}`;
                select.appendChild(option);
            });
            select.value = currentValue;
        });
    }

    /**
     * Remplir le filtre chef d'équipe
     */
    populateChefFilter() {
        const select = document.getElementById('filterChefEquipe');
        if (!select) return;
        const currentValue = select.value;
        select.innerHTML = '<option value="">Tous les chefs</option>';
        this.employesCache.forEach(emp => {
            const option = document.createElement('option');
            option.value = emp.id;
            option.textContent = `${emp.prenom} ${emp.nom}`;
            select.appendChild(option);
        });
        select.value = currentValue;
    }

    /**
     * Lier les événements UI
     */
    bindEvents() {
        // Recherche
        const searchInput = document.getElementById('searchEquipe');
        if (searchInput) {
            let debounceTimer;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.filters.search = e.target.value;
                    this.currentPage = 1;
                    this.renderFilteredEquipes();
                }, 300);
            });
        }

        // Filtre chef
        const filterChef = document.getElementById('filterChefEquipe');
        if (filterChef) {
            filterChef.addEventListener('change', (e) => {
                this.filters.chefEquipeId = e.target.value;
                this.currentPage = 1;
                this.renderFilteredEquipes();
            });
        }

        // Boutons
        document.getElementById('btnNouvelleEquipe')?.addEventListener('click', () => this.openModalNouveau());
        document.getElementById('btnFirstEquipe')?.addEventListener('click', () => this.openModalNouveau());
        document.getElementById('btnRefreshEquipes')?.addEventListener('click', () => this.loadEquipes());
        document.getElementById('btnExportEquipes')?.addEventListener('click', () => this.exportEquipes());

        // Formulaire équipe
        const formEquipe = document.getElementById('formEquipe');
        if (formEquipe) {
            formEquipe.addEventListener('submit', (e) => this.handleSubmitEquipe(e));
        }

        // Bouton supprimer
        document.getElementById('btnDeleteEquipe')?.addEventListener('click', () => this.confirmDeleteEquipe());
        document.getElementById('btnConfirmDeleteEquipe')?.addEventListener('click', () => this.executeDeleteEquipe());

        // Formulaire ajout membre
        const formMembre = document.getElementById('formAjouterMembre');
        if (formMembre) {
            formMembre.addEventListener('submit', (e) => this.handleSubmitAjouterMembre(e));
        }

        // Formulaire assigner chantier
        const formChantier = document.getElementById('formAssignerChantier');
        if (formChantier) {
            formChantier.addEventListener('submit', (e) => this.handleSubmitAssignerChantier(e));
        }

        // Modifier depuis détail
        document.getElementById('btnEditEquipeFromDetail')?.addEventListener('click', () => {
            const modalDetail = bootstrap.Modal.getInstance(document.getElementById('modalEquipeDetail'));
            modalDetail?.hide();
            setTimeout(() => this.openModalEdition(this.equipeEnEdition?.id), 300);
        });
    }

    /**
     * Charger la liste des équipes
     */
    async loadEquipes() {
        this.showLoader(true);
        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;
            const result = await window.api.equipes.invoke('list', entrepriseId);
            this.equipesData = Array.isArray(result) ? result : (result.items || []);
            this.totalItems = this.equipesData.length;
            this.renderFilteredEquipes();
        } catch (error) {
            console.error('Erreur chargement équipes:', error);
            window.showToast && showToast('Erreur lors du chargement des équipes', 'error');
        } finally {
            this.showLoader(false);
        }
    }

    /**
     * Filtrer et rendre les équipes
     */
    renderFilteredEquipes() {
        let filtered = this.equipesData;

        // Filtre recherche
        if (this.filters.search) {
            const s = this.filters.search.toLowerCase();
            filtered = filtered.filter(eq =>
                (eq.nom || '').toLowerCase().includes(s) ||
                (eq.specialite || '').toLowerCase().includes(s)
            );
        }

        // Filtre chef
        if (this.filters.chefEquipeId) {
            filtered = filtered.filter(eq => String(eq.chefEquipeId) === String(this.filters.chefEquipeId));
        }

        this.totalItems = filtered.length;

        // Pagination
        const start = (this.currentPage - 1) * this.pageSize;
        const paginated = filtered.slice(start, start + this.pageSize);

        this.renderEquipesTable(paginated);
        this.renderPagination(filtered.length);
        this.toggleEmptyState(filtered.length === 0);
    }

    /**
     * Afficher les équipes dans le tableau
     */
    renderEquipesTable(equipes) {
        const tbody = document.getElementById('equipesTbody');
        if (!tbody) return;

        if (equipes.length === 0) {
            tbody.innerHTML = '';
            return;
        }

        tbody.innerHTML = equipes.map((eq, index) => {
            const chef = this.employesCache.find(e => e.id === eq.chefEquipeId);
            const chefNom = chef ? `${chef.prenom} ${chef.nom}` : '—';
            const membresCount = eq.membres?.length || eq.nbMembres || 0;
            const chantiersCount = eq.chantiers?.length || eq.nbChantiers || 0;

            return `
                <tr data-id="${eq.id}">
                    <td>${(this.currentPage - 1) * this.pageSize + index + 1}</td>
                    <td>
                        <div class="fw-semibold">${this.escapeHtml(eq.nom)}</div>
                        ${eq.specialite ? `<small class="text-secondary">${this.escapeHtml(eq.specialite)}</small>` : ''}
                    </td>
                    <td>${this.escapeHtml(chefNom)}</td>
                    <td><span class="badge bg-primary">${membresCount}</span></td>
                    <td><span class="badge bg-info">${chantiersCount}</span></td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-secondary btn-view" data-id="${eq.id}" title="Voir">
                                <i class="bi bi-eye"></i>
                            </button>
                            <button class="btn btn-outline-primary btn-edit" data-id="${eq.id}" title="Modifier">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-outline-danger btn-delete" data-id="${eq.id}" title="Supprimer">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Binder les actions
        tbody.querySelectorAll('.btn-view').forEach(btn => {
            btn.addEventListener('click', (e) => this.viewEquipe(e.currentTarget.dataset.id));
        });
        tbody.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => this.openModalEdition(e.currentTarget.dataset.id));
        });
        tbody.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => this.confirmDeleteEquipe(e.currentTarget.dataset.id));
        });
    }

    /**
     * Afficher la pagination
     */
    renderPagination(totalItems) {
        const container = document.getElementById('equipesPagination');
        if (!container) return;

        const totalPages = Math.ceil(totalItems / this.pageSize);
        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let html = '<nav><ul class="pagination pagination-sm mb-0">';
        html += `<li class="page-item ${this.currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${this.currentPage - 1}"><i class="bi bi-chevron-left"></i></a>
        </li>`;

        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(totalPages, this.currentPage + 2);
        for (let i = startPage; i <= endPage; i++) {
            html += `<li class="page-item ${i === this.currentPage ? 'active' : ''}">
                <a class="page-link" href="#" data-page="${i}">${i}</a>
            </li>`;
        }

        html += `<li class="page-item ${this.currentPage === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${this.currentPage + 1}"><i class="bi bi-chevron-right"></i></a>
        </li>`;
        html += '</ul></nav>';
        container.innerHTML = html;

        container.querySelectorAll('.page-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = parseInt(e.currentTarget.dataset.page);
                if (page && page !== this.currentPage && page >= 1 && page <= totalPages) {
                    this.currentPage = page;
                    this.renderFilteredEquipes();
                }
            });
        });
    }

    /**
     * Afficher/masquer l'état vide
     */
    toggleEmptyState(isEmpty) {
        document.getElementById('equipesEmpty')?.classList.toggle('d-none', !isEmpty);
        document.getElementById('equipesTable')?.classList.toggle('d-none', isEmpty);
        document.getElementById('equipesPagination')?.classList.toggle('d-none', isEmpty);
    }

    /**
     * Ouvrir la modale pour nouvelle équipe
     */
    openModalNouveau() {
        this.equipeEnEdition = null;
        this.resetFormEquipe();
        document.getElementById('modalEquipeLabel').innerHTML = '<i class="bi bi-people me-2"></i>Nouvelle équipe';
        document.getElementById('btnDeleteEquipe').style.display = 'none';
        document.getElementById('equipeMembresContainer').innerHTML = '<p class="text-secondary text-center py-3">Aucun membre</p>';
        document.getElementById('equipeChantiersContainer').innerHTML = '<p class="text-secondary text-center py-3">Aucun chantier assigné</p>';

        this.populateEmployeSelects();
        const modal = new bootstrap.Modal(document.getElementById('modalEquipe'));
        modal.show();

        // Boutons membres/chantiers
        document.getElementById('btnAjouterMembre')?.addEventListener('click', () => this.openModalAjouterMembre(), { once: true });
        document.getElementById('btnAssignerChantier')?.addEventListener('click', () => this.openModalAssignerChantier(), { once: true });
    }

    /**
     * Ouvrir la modale pour éditer une équipe
     */
    async openModalEdition(id) {
        try {
            const equipe = this.equipesData.find(e => String(e.id) === String(id));
            if (!equipe) {
                showToast('Équipe non trouvée', 'error');
                return;
            }

            this.equipeEnEdition = equipe;
            this.fillFormEquipe(equipe);
            document.getElementById('modalEquipeLabel').innerHTML = `<i class="bi bi-people me-2"></i>Modifier: ${this.escapeHtml(equipe.nom)}`;
            document.getElementById('btnDeleteEquipe').style.display = 'inline-block';
            document.getElementById('btnDeleteEquipe').dataset.id = id;
            document.getElementById('deleteEquipeName').textContent = equipe.nom;

            this.renderEquipeMembres(equipe.membres || []);
            this.renderEquipeChantiers(equipe.chantiers || []);

            this.populateEmployeSelects();
            this.populateChantierSelects();

            const modal = new bootstrap.Modal(document.getElementById('modalEquipe'));
            modal.show();

            document.getElementById('btnAjouterMembre')?.addEventListener('click', () => this.openModalAjouterMembre(), { once: true });
            document.getElementById('btnAssignerChantier')?.addEventListener('click', () => this.openModalAssignerChantier(), { once: true });

        } catch (error) {
            console.error('Erreur ouverture modal édition:', error);
            showToast('Erreur lors du chargement de l\'équipe', 'error');
        }
    }

    /**
     * Voir le détail d'une équipe
     */
    viewEquipe(id) {
        const equipe = this.equipesData.find(e => String(e.id) === String(id));
        if (!equipe) {
            showToast('Équipe non trouvée', 'error');
            return;
        }

        this.equipeEnEdition = equipe;
        const chef = this.employesCache.find(e => e.id === equipe.chefEquipeId);
        const chefNom = chef ? `${chef.prenom} ${chef.nom}` : '—';

        const container = document.getElementById('equipeDetailContent');
        if (!container) return;

        container.innerHTML = `
            <div class="row g-4">
                <div class="col-md-4 text-center">
                    <div class="avatar-badge bg-primary bg-opacity-10 text-primary rounded-circle mx-auto mb-3 d-flex align-items-center justify-content-center" style="width: 100px; height: 100px; font-size: 2rem;">
                        <i class="bi bi-people-fill"></i>
                    </div>
                    <h4>${this.escapeHtml(equipe.nom)}</h4>
                    ${equipe.specialite ? `<span class="badge bg-secondary">${this.escapeHtml(equipe.specialite)}</span>` : ''}
                    ${equipe.statut ? `<br><span class="badge ${equipe.statut === 'active' ? 'bg-success' : 'bg-secondary'} mt-1">${equipe.statut}</span>` : ''}
                </div>
                <div class="col-md-8">
                    <div class="card mb-3">
                        <div class="card-header"><h6 class="mb-0"><i class="bi bi-info-circle me-2"></i>Informations</h6></div>
                        <div class="card-body">
                            <div class="row g-2">
                                <div class="col-md-6"><small class="text-secondary">Chef d'équipe</small><div class="fw-semibold">${this.escapeHtml(chefNom)}</div></div>
                                <div class="col-md-6"><small class="text-secondary">Membres</small><div>${equipe.membres?.length || 0}</div></div>
                                <div class="col-md-6"><small class="text-secondary">Création</small><div>${equipe.dateCreation ? this.formatDate(equipe.dateCreation) : '—'}</div></div>
                                <div class="col-md-6"><small class="text-secondary">Statut</small><div>${equipe.statut || '—'}</div></div>
                                ${equipe.description ? `<div class="col-12"><small class="text-secondary">Description</small><div>${this.escapeHtml(equipe.description)}</div></div>` : ''}
                            </div>
                        </div>
                    </div>
                    ${(equipe.membres?.length > 0) ? `
                    <div class="card">
                        <div class="card-header"><h6 class="mb-0"><i class="bi bi-person-lines-fill me-2"></i>Membres (${equipe.membres.length})</h6></div>
                        <div class="card-body p-0">
                            <ul class="list-group list-group-flush">
                                ${equipe.membres.map(m => {
                                    const emp = this.employesCache.find(e => e.id === m.employeId);
                                    return `<li class="list-group-item"><i class="bi bi-person me-2"></i>${emp ? `${emp.prenom} ${emp.nom}` : `Employé #${m.employeId}`}${m.role ? ` <small class="text-secondary">(${this.escapeHtml(m.role)})</small>` : ''}</li>`;
                                }).join('')}
                            </ul>
                        </div>
                    </div>` : ''}
                </div>
            </div>
        `;

        const modal = new bootstrap.Modal(document.getElementById('modalEquipeDetail'));
        modal.show();
    }

    /**
     * Remplir le formulaire équipe
     */
    fillFormEquipe(eq) {
        document.getElementById('equipeId').value = eq.id || '';
        document.getElementById('eqNom').value = eq.nom || '';
        document.getElementById('eqChef').value = eq.chefEquipeId || '';
        document.getElementById('eqDescription').value = eq.description || '';
        document.getElementById('eqSpecialite').value = eq.specialite || '';
        document.getElementById('eqDateCreation').value = eq.dateCreation || '';
        document.getElementById('eqStatut').value = eq.statut || 'active';
    }

    /**
     * Réinitialiser le formulaire équipe
     */
    resetFormEquipe() {
        const form = document.getElementById('formEquipe');
        if (form) form.reset();
        document.getElementById('equipeId').value = '';
        document.getElementById('eqStatut').value = 'active';
    }

    /**
     * Rendre les membres de l'équipe
     */
    renderEquipeMembres(membres) {
        const container = document.getElementById('equipeMembresContainer');
        if (!container) return;

        if (!membres || membres.length === 0) {
            container.innerHTML = '<p class="text-secondary text-center py-3">Aucun membre</p>';
            return;
        }

        container.innerHTML = membres.map(m => {
            const emp = this.employesCache.find(e => e.id === m.employeId);
            const empNom = emp ? `${emp.prenom} ${emp.nom}` : `Employé #${m.employeId}`;
            return `
                <div class="card mb-2">
                    <div class="card-body py-2">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <strong><i class="bi bi-person me-1"></i>${this.escapeHtml(empNom)}</strong>
                                ${m.role ? `<br><small class="text-secondary">Rôle: ${this.escapeHtml(m.role)}</small>` : ''}
                                <br><small class="text-secondary">${m.dateDebut ? this.formatDate(m.dateDebut) : ''} ${m.dateFin ? `→ ${this.formatDate(m.dateFin)}` : '(actuel)'}</small>
                            </div>
                            <button type="button" class="btn btn-sm btn-outline-danger" onclick="window.equipesController.retirerMembre(${m.id})">
                                <i class="bi bi-x"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Rendre les chantiers de l'équipe
     */
    renderEquipeChantiers(chantiers) {
        const container = document.getElementById('equipeChantiersContainer');
        if (!container) return;

        if (!chantiers || chantiers.length === 0) {
            container.innerHTML = '<p class="text-secondary text-center py-3">Aucun chantier assigné</p>';
            return;
        }

        container.innerHTML = chantiers.map(c => {
            const chantier = this.chantiersCache.find(ch => ch.id === c.chantierId);
            const chantierNom = chantier?.nom || c.chantierNom || `Chantier #${c.chantierId}`;
            return `
                <div class="card mb-2">
                    <div class="card-body py-2">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <strong><i class="bi bi-building me-1"></i>${this.escapeHtml(chantierNom)}</strong>
                                <br><small class="text-secondary">${c.dateDebut ? this.formatDate(c.dateDebut) : ''} ${c.dateFin ? `→ ${this.formatDate(c.dateFin)}` : '(en cours)'}</small>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Ouvrir modale ajout membre
     */
    openModalAjouterMembre() {
        const form = document.getElementById('formAjouterMembre');
        if (form) form.reset();

        if (this.equipeEnEdition?.id) {
            document.getElementById('amEquipeId').value = this.equipeEnEdition.id;
        }

        this.populateEmployeSelects();
        document.getElementById('amDateDebut').value = new Date().toISOString().split('T')[0];

        const modal = new bootstrap.Modal(document.getElementById('modalAjouterMembre'));
        modal.show();
    }

    /**
     * Ouvrir modale assigner chantier
     */
    openModalAssignerChantier() {
        const form = document.getElementById('formAssignerChantier');
        if (form) form.reset();

        if (this.equipeEnEdition?.id) {
            document.getElementById('acEquipeId').value = this.equipeEnEdition.id;
        }

        this.populateChantierSelects();
        document.getElementById('acDateDebut').value = new Date().toISOString().split('T')[0];

        const modal = new bootstrap.Modal(document.getElementById('modalAssignerChantier'));
        modal.show();
    }

    /**
     * Gérer la soumission du formulaire équipe
     */
    async handleSubmitEquipe(e) {
        e.preventDefault();
        const form = e.target;
        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            return;
        }

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        const id = data.id;
        delete data.id;

        data.chefEquipeId = parseInt(data.chefEquipeId) || null;
        const entrepriseId = window.AppState?.entreprise?.id || 1;

        try {
            if (id) {
                await window.api.equipes.invoke('update', parseInt(id), data);
                showToast('Équipe modifiée avec succès', 'success');
            } else {
                await window.api.equipes.invoke('create', { ...data, entrepriseId });
                showToast('Équipe créée avec succès', 'success');
            }
            bootstrap.Modal.getInstance(document.getElementById('modalEquipe'))?.hide();
            await this.loadEquipes();
        } catch (error) {
            console.error('Erreur sauvegarde équipe:', error);
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    /**
     * Gérer l'ajout d'un membre
     */
    async handleSubmitAjouterMembre(e) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        data.equipeId = parseInt(data.equipeId);
        data.employeId = parseInt(data.employeId);

        try {
            await window.api.equipes.invoke('ajouterMembre', data.equipeId, data.employeId);
            showToast('Membre ajouté à l\'équipe', 'success');
            bootstrap.Modal.getInstance(document.getElementById('modalAjouterMembre'))?.hide();
            await this.loadEquipes();
        } catch (error) {
            console.error('Erreur ajout membre:', error);
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    /**
     * Gérer l'assignation d'un chantier
     */
    async handleSubmitAssignerChantier(e) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        data.equipeId = parseInt(data.equipeId);
        data.chantierId = parseInt(data.chantierId);

        try {
            await window.api.equipes.invoke('assignerChantier', data);
            showToast('Chantier assigné à l\'équipe', 'success');
            bootstrap.Modal.getInstance(document.getElementById('modalAssignerChantier'))?.hide();
            await this.loadEquipes();
        } catch (error) {
            console.error('Erreur assignation chantier:', error);
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    /**
     * Confirmer la suppression
     */
    confirmDeleteEquipe(id) {
        const equipeId = id || document.getElementById('btnDeleteEquipe')?.dataset?.id;
        if (!equipeId) return;

        const equipe = this.equipesData.find(e => String(e.id) === String(equipeId));
        document.getElementById('deleteEquipeName').textContent = equipe?.nom || `Équipe #${equipeId}`;
        document.getElementById('btnConfirmDeleteEquipe').dataset.id = equipeId;

        const modal = new bootstrap.Modal(document.getElementById('modalConfirmDeleteEquipe'));
        modal.show();
    }

    /**
     * Exécuter la suppression
     */
    async executeDeleteEquipe() {
        const id = document.getElementById('btnConfirmDeleteEquipe').dataset.id;
        if (!id) return;

        try {
            await window.api.equipes.invoke('delete', parseInt(id));
            showToast('Équipe supprimée', 'success');
            bootstrap.Modal.getInstance(document.getElementById('modalConfirmDeleteEquipe'))?.hide();
            bootstrap.Modal.getInstance(document.getElementById('modalEquipe'))?.hide();
            await this.loadEquipes();
        } catch (error) {
            console.error('Erreur suppression équipe:', error);
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    /**
     * Retirer un membre
     */
    async retirerMembre(membreId) {
        if (!confirm('Retirer ce membre de l\'équipe ?')) return;
        try {
            await window.api.equipes.invoke('retirerMembre', membreId);
            showToast('Membre retiré', 'success');
            await this.loadEquipes();
            if (this.equipeEnEdition) {
                const updated = this.equipesData.find(e => e.id === this.equipeEnEdition.id);
                this.renderEquipeMembres(updated?.membres || []);
            }
        } catch (error) {
            showToast('Fonctionnalité à implémenter', 'info');
        }
    }

    /**
     * Exporter les équipes
     */
    exportEquipes() {
        const rows = [['ID', 'Nom', 'Chef d\'équipe', 'Spécialité', 'Statut', 'Membres']];
        this.equipesData.forEach(eq => {
            const chef = this.employesCache.find(e => e.id === eq.chefEquipeId);
            rows.push([eq.id, eq.nom, chef ? `${chef.prenom} ${chef.nom}` : '', eq.specialite || '', eq.statut || '', eq.membres?.length || 0]);
        });
        const csvContent = rows.map(r => r.join(';')).join('\n');
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `equipes_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Afficher/masquer le loader
     */
    showLoader(show) {
        const table = document.getElementById('equipesTable');
        if (table) table.style.opacity = show ? '0.5' : '1';
    }

    /**
     * Formater une date
     */
    formatDate(dateStr) {
        if (!dateStr) return '—';
        try {
            return new Date(dateStr).toLocaleDateString('fr-FR');
        } catch {
            return dateStr;
        }
    }

    /**
     * Échapper le HTML
     */
    escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}

// Instancier et exposer globalement
window.equipesController = new EquipesController();
