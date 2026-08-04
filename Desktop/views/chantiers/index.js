/**
 * Chantiers View Controller
 * Gère la liste, création, édition, suppression des chantiers
 */

class ChantiersController {
    constructor() {
        this.currentPage = 1;
        this.pageSize = 20;
        this.totalItems = 0;
        this.filters = {
            search: '',
            statut: '',
            tri: 'dateCreation_desc'
        };
        this.chantierEnEdition = null;
        this.clientsCache = [];
        this.employesCache = [];
    }

    /**
     * Initialiser le contrôleur
     */
    async init() {
        await this.loadClients();
        await this.loadEmployes();
        this.bindEvents();
        await this.loadChantiers();
    }

    /**
     * Charger la liste des clients pour les selects
     */
    async loadClients() {
        try {
            const result = await window.api.clients.invoke('list', {
                entrepriseId: window.AppState?.entreprise?.id || 1,
                limit: 1000
            });
            this.clientsCache = result.items || [];
            this.populateClientSelects();
        } catch (error) {
            console.error('Erreur chargement clients:', error);
        }
    }

    /**
     * Charger la liste des employés pour les selects
     */
    async loadEmployes() {
        try {
            const result = await window.api.employes.invoke('list', {
                entrepriseId: window.AppState?.entreprise?.id || 1,
                limit: 1000,
                statut: 'actif'
            });
            this.employesCache = result.items || [];
            this.populateEmployeSelects();
        } catch (error) {
            console.error('Erreur chargement employés:', error);
        }
    }

    /**
     * Remplir les selects clients
     */
    populateClientSelects() {
        const selects = document.querySelectorAll('#chantierClient');
        selects.forEach(select => {
            const currentValue = select.value;
            select.innerHTML = '<option value="">Sélectionner un client</option>';
            this.clientsCache.forEach(client => {
                const option = document.createElement('option');
                option.value = client.id;
                option.textContent = `${client.nom} ${client.prenom || ''}`.trim() + (client.entreprise ? ` (${client.entreprise})` : '');
                select.appendChild(option);
            });
            select.value = currentValue;
        });
    }

    /**
     * Remplir les selects employés
     */
    populateEmployeSelects() {
        const selects = document.querySelectorAll('#chantierResponsable');
        selects.forEach(select => {
            const currentValue = select.value;
            select.innerHTML = '<option value="">Sélectionner</option>';
            this.employesCache.forEach(emp => {
                const option = document.createElement('option');
                option.value = emp.id;
                option.textContent = `${emp.prenom} ${emp.nom}`.trim() + (emp.poste ? ` - ${emp.poste}` : '');
                select.appendChild(option);
            });
            select.value = currentValue;
        });
    }

    /**
     * Lier les événements UI
     */
    bindEvents() {
        // Recherche
        const searchInput = document.getElementById('searchChantier');
        if (searchInput) {
            let debounceTimer;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.filters.search = e.target.value;
                    this.currentPage = 1;
                    this.loadChantiers();
                }, 300);
            });
        }

        // Filtre statut
        const filterStatut = document.getElementById('filterStatut');
        if (filterStatut) {
            filterStatut.addEventListener('change', (e) => {
                this.filters.statut = e.target.value;
                this.currentPage = 1;
                this.loadChantiers();
            });
        }

        // Filtre tri
        const filterTri = document.getElementById('filterTri');
        if (filterTri) {
            filterTri.addEventListener('change', (e) => {
                this.filters.tri = e.target.value;
                this.loadChantiers();
            });
        }

        // Bouton nouveau chantier
        document.getElementById('btnNouveauChantier')?.addEventListener('click', () => this.openModalNouveau());
        document.getElementById('btnFirstChantier')?.addEventListener('click', () => this.openModalNouveau());

        // Bouton refresh
        document.getElementById('btnRefreshChantiers')?.addEventListener('click', () => this.loadChantiers());

        // Formulaire chantier
        const formChantier = document.getElementById('formChantier');
        if (formChantier) {
            formChantier.addEventListener('submit', (e) => this.handleSubmitChantier(e));
        }

        // Bouton supprimer dans la modale
        document.getElementById('btnDeleteChantier')?.addEventListener('click', () => this.confirmDeleteChantier());

        // Confirmation suppression
        document.getElementById('btnConfirmDelete')?.addEventListener('click', () => this.executeDeleteChantier());

        // Bouton ajouter phase
        document.getElementById('btnAjouterPhase')?.addEventListener('click', () => this.openModalPhase());

        // Formulaire phase
        const formPhase = document.getElementById('formPhase');
        if (formPhase) {
            formPhase.addEventListener('submit', (e) => this.handleSubmitPhase(e));
        }

        // Bouton modifier depuis détail
        document.getElementById('btnEditFromDetail')?.addEventListener('click', () => {
            const modalDetail = bootstrap.Modal.getInstance(document.getElementById('modalChantierDetail'));
            modalDetail?.hide();
            setTimeout(() => this.openModalEdition(this.chantierEnEdition), 300);
        });

        // Export
        document.getElementById('btnExportChantiers')?.addEventListener('click', () => this.exportChantiers());
    }

    /**
     * Charger la liste des chantiers
     */
    async loadChantiers() {
        this.showLoader(true);

        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;

            const result = await window.api.chantiers.invoke('list', {
                entrepriseId,
                limit: this.pageSize,
                offset: (this.currentPage - 1) * this.pageSize,
                statut: this.filters.statut || undefined,
                search: this.filters.search || undefined
            });

            this.totalItems = result.total || 0;
            this.renderChantiersTable(result.items || []);
            this.renderPagination();
            this.toggleEmptyState(result.items?.length === 0);

        } catch (error) {
            console.error('Erreur chargement chantiers:', error);
            showToast('Erreur lors du chargement des chantiers', 'error');
        } finally {
            this.showLoader(false);
        }
    }

    /**
     * Afficher les chantiers dans le tableau
     */
    renderChantiersTable(chantiers) {
        const tbody = document.getElementById('chantiersTbody');
        if (!tbody) return;

        if (chantiers.length === 0) {
            tbody.innerHTML = '';
            return;
        }

        tbody.innerHTML = chantiers.map((c, index) => {
            const budgetPct = c.budgetPrevisionnel > 0
                ? Math.round((c.budgetReel || 0) / c.budgetPrevisionnel * 100)
                : 0;

            const statutClass = {
                'planifie': 'bg-secondary',
                'en_cours': 'bg-primary',
                'termine': 'bg-success',
                'arrete': 'bg-danger'
            }[c.statut] || 'bg-secondary';

            const statutLabel = {
                'planifie': 'Planifié',
                'en_cours': 'En cours',
                'termine': 'Terminé',
                'arrete': 'Arrêté'
            }[c.statut] || c.statut;

            return `
                <tr data-id="${c.id}">
                    <td>${(this.currentPage - 1) * this.pageSize + index + 1}</td>
                    <td>
                        <div class="fw-semibold">${this.escapeHtml(c.nom)}</div>
                        <small class="text-secondary">${this.escapeHtml(c.numero)}</small>
                    </td>
                    <td>
                        ${c.client ? this.escapeHtml(`${c.client.nom} ${c.client.prenom || ''}`.trim()) : '<span class="text-secondary">—</span>'}
                    </td>
                    <td class="d-none d-md-table-cell">
                        <small>
                            ${this.formatDate(c.dateDebut)} ${c.dateFinPrevue ? `→ ${this.formatDate(c.dateFinPrevue)}` : ''}
                        </small>
                    </td>
                    <td class="d-none d-lg-table-cell">
                        <small>${this.formatCurrency(c.budgetPrevisionnel || 0)}</small>
                        ${c.budgetReel ? `<br><small class="text-${c.budgetReel > c.budgetPrevisionnel ? 'danger' : 'success'}">Réel: ${this.formatCurrency(c.budgetReel)}</small>` : ''}
                    </td>
                    <td class="d-none d-lg-table-cell">
                        <div class="progress" style="height: 6px;">
                            <div class="progress-bar ${budgetPct > 100 ? 'bg-danger' : 'bg-primary'}" 
                                 style="width: ${Math.min(budgetPct, 100)}%"></div>
                        </div>
                        <small>${budgetPct}%</small>
                    </td>
                    <td>
                        <span class="badge ${statutClass}">${statutLabel}</span>
                    </td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-secondary btn-view" data-id="${c.id}" title="Voir">
                                <i class="bi bi-eye"></i>
                            </button>
                            <button class="btn btn-outline-primary btn-edit" data-id="${c.id}" title="Modifier">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-outline-danger btn-delete" data-id="${c.id}" title="Supprimer">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Binder les actions sur les boutons
        tbody.querySelectorAll('.btn-view').forEach(btn => {
            btn.addEventListener('click', (e) => this.viewChantier(e.currentTarget.dataset.id));
        });
        tbody.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => this.openModalEdition(e.currentTarget.dataset.id));
        });
        tbody.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => this.confirmDeleteChantier(e.currentTarget.dataset.id));
        });
    }

    /**
     * Afficher la pagination
     */
    renderPagination() {
        const container = document.getElementById('chantiersPagination');
        if (!container) return;

        const totalPages = Math.ceil(this.totalItems / this.pageSize);
        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let html = '<nav><ul class="pagination pagination-sm mb-0">';

        // Précédent
        html += `<li class="page-item ${this.currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${this.currentPage - 1}"><i class="bi bi-chevron-left"></i></a>
        </li>`;

        // Pages
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(totalPages, this.currentPage + 2);

        for (let i = startPage; i <= endPage; i++) {
            html += `<li class="page-item ${i === this.currentPage ? 'active' : ''}">
                <a class="page-link" href="#" data-page="${i}">${i}</a>
            </li>`;
        }

        // Suivant
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
                    this.loadChantiers();
                }
            });
        });
    }

    /**
     * Afficher/masquer l'état vide
     */
    toggleEmptyState(isEmpty) {
        document.getElementById('chantiersEmpty')?.classList.toggle('d-none', !isEmpty);
        document.getElementById('chantiersTable')?.classList.toggle('d-none', isEmpty);
        document.getElementById('chantiersPagination')?.classList.toggle('d-none', isEmpty);
    }

    /**
     * Ouvrir la modale pour nouveau chantier
     */
    openModalNouveau() {
        this.chantierEnEdition = null;
        this.resetFormChantier();
        document.getElementById('modalChantierLabel').textContent = 'Nouveau chantier';
        document.getElementById('btnDeleteChantier').style.display = 'none';

        // Générer un numéro automatique
        this.generateNumeroChantier();

        const modal = new bootstrap.Modal(document.getElementById('modalChantier'));
        modal.show();
    }

    /**
     * Ouvrir la modale pour éditer un chantier
     */
    async openModalEdition(id) {
        try {
            const chantier = await window.api.chantiers.invoke('get', parseInt(id));
            if (!chantier) {
                showToast('Chantier non trouvé', 'error');
                return;
            }

            this.chantierEnEdition = chantier;
            this.fillFormChantier(chantier);
            document.getElementById('modalChantierLabel').textContent = `Modifier: ${chantier.nom}`;
            document.getElementById('btnDeleteChantier').style.display = 'inline-block';
            document.getElementById('btnDeleteChantier').dataset.id = id;

            const modal = new bootstrap.Modal(document.getElementById('modalChantier'));
            modal.show();
        } catch (error) {
            console.error('Erreur chargement chantier:', error);
            showToast('Erreur lors du chargement du chantier', 'error');
        }
    }

    /**
     * Voir le détail d'un chantier
     */
    async viewChantier(id) {
        try {
            const chantier = await window.api.chantiers.invoke('get', parseInt(id));
            if (!chantier) {
                showToast('Chantier non trouvé', 'error');
                return;
            }

            this.renderChantierDetail(chantier);
            const modal = new bootstrap.Modal(document.getElementById('modalChantierDetail'));
            modal.show();
        } catch (error) {
            console.error('Erreur chargement détail:', error);
            showToast('Erreur lors du chargement du détail', 'error');
        }
    }

    /**
     * Rendre le détail du chantier
     */
    renderChantierDetail(c) {
        const container = document.getElementById('chantierDetailContent');
        if (!container) return;

        const budgetPct = c.budgetPrevisionnel > 0
            ? Math.round((c.budgetReel || 0) / c.budgetPrevisionnel * 100)
            : 0;

        container.innerHTML = `
            <div class="row g-4">
                <!-- Infos principales -->
                <div class="col-md-8">
                    <div class="card">
                        <div class="card-header">
                            <h6 class="mb-0"><i class="bi bi-info-circle me-2"></i>Informations générales</h6>
                        </div>
                        <div class="card-body">
                            <div class="row g-3">
                                <div class="col-md-6">
                                    <label class="form-label text-secondary small">Numéro</label>
                                    <div class="fw-semibold">${this.escapeHtml(c.numero)}</div>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label text-secondary small">Statut</label>
                                    <span class="badge bg-${c.statut === 'en_cours' ? 'primary' : c.statut === 'termine' ? 'success' : c.statut === 'arrete' ? 'danger' : 'secondary'}">
                                        ${c.statut}
                                    </span>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label text-secondary small">Client</label>
                                    <div>${c.client ? this.escapeHtml(`${c.client.nom} ${c.client.prenom || ''}`.trim()) : '—'}</div>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label text-secondary small">Responsable</label>
                                    <div>${c.responsable ? this.escapeHtml(`${c.responsable.prenom} ${c.responsable.nom}`.trim()) : '—'}</div>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label text-secondary small">Date début</label>
                                    <div>${this.formatDate(c.dateDebut)}</div>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label text-secondary small">Date fin prévue</label>
                                    <div>${c.dateFinPrevue ? this.formatDate(c.dateFinPrevue) : '—'}</div>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label text-secondary small">Adresse</label>
                                    <div>${this.escapeHtml(c.adresse || '')} ${this.escapeHtml(c.codePostal || '')} ${this.escapeHtml(c.ville || '')}</div>
                                </div>
                                <div class="col-12">
                                    <label class="form-label text-secondary small">Description</label>
                                    <div>${this.escapeHtml(c.description || '—')}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Phases -->
                    <div class="card mt-3">
                        <div class="card-header d-flex justify-content-between">
                            <h6 class="mb-0"><i class="bi bi-list-task me-2"></i>Phases</h6>
                            <span class="badge bg-secondary">${c.phases?.length || 0} phases</span>
                        </div>
                        <div class="card-body p-0">
                            ${c.phases && c.phases.length > 0 ? `
                                <div class="table-responsive">
                                    <table class="table table-sm mb-0">
                                        <thead class="table-light">
                                            <tr>
                                                <th>#</th>
                                                <th>Phase</th>
                                                <th>Dates</th>
                                                <th>Budget</th>
                                                <th>Avancement</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${c.phases.map((p, i) => `
                                                <tr>
                                                    <td>${i + 1}</td>
                                                    <td>${this.escapeHtml(p.nom)}</td>
                                                    <td><small>${p.dateDebut ? this.formatDate(p.dateDebut) : '—'} ${p.dateFin ? `→ ${this.formatDate(p.dateFin)}` : ''}</small></td>
                                                    <td><small>${this.formatCurrency(p.budget || 0)}</small></td>
                                                    <td>
                                                        <div class="progress" style="height: 6px;">
                                                            <div class="progress-bar" style="width: ${p.avancement || 0}%"></div>
                                                        </div>
                                                        <small>${p.avancement || 0}%</small>
                                                    </td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            ` : '<div class="text-center py-3 text-secondary">Aucune phase définie</div>'}
                        </div>
                    </div>
                </div>

                <!-- Budget & KPIs -->
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-header">
                            <h6 class="mb-0"><i class="bi bi-currency-exchange me-2"></i>Budget</h6>
                        </div>
                        <div class="card-body">
                            <div class="mb-3">
                                <div class="d-flex justify-content-between mb-1">
                                    <span class="text-secondary">Prévisionnel</span>
                                    <span class="fw-semibold">${this.formatCurrency(c.budgetPrevisionnel || 0)}</span>
                                </div>
                                <div class="d-flex justify-content-between mb-1">
                                    <span class="text-secondary">Réel</span>
                                    <span class="fw-semibold text-${(c.budgetReel || 0) > (c.budgetPrevisionnel || 1) ? 'danger' : 'success'}">${this.formatCurrency(c.budgetReel || 0)}</span>
                                </div>
                                <div class="d-flex justify-content-between mb-1">
                                    <span class="text-secondary">Écart</span>
                                    <span class="fw-semibold text-${(c.budgetReel || 0) > (c.budgetPrevisionnel || 1) ? 'danger' : 'success'}">
                                        ${this.formatCurrency((c.budgetReel || 0) - (c.budgetPrevisionnel || 0))}
                                    </span>
                                </div>
                                <div class="progress mt-2" style="height: 8px;">
                                    <div class="progress-bar ${budgetPct > 100 ? 'bg-danger' : 'bg-primary'}" style="width: ${Math.min(budgetPct, 100)}%"></div>
                                </div>
                                <small class="text-secondary">${budgetPct}% du budget utilisé</small>
                            </div>
                        </div>
                    </div>

                    <!-- Incidents -->
                    <div class="card mt-3">
                        <div class="card-header d-flex justify-content-between">
                            <h6 class="mb-0"><i class="bi bi-exclamation-triangle me-2"></i>Incidents</h6>
                            <span class="badge bg-danger">${c.incidents?.filter(i => i.statut !== 'resolu').length || 0} ouverts</span>
                        </div>
                        <div class="card-body p-0">
                            ${c.incidents && c.incidents.length > 0 ? `
                                <div class="list-group list-group-flush">
                                    ${c.incidents.slice(0, 5).map(i => `
                                        <div class="list-group-item px-3 py-2">
                                            <div class="d-flex justify-content-between">
                                                <span class="fw-semibold small">${this.escapeHtml(i.titre)}</span>
                                                <span class="badge bg-${i.statut === 'critique' ? 'danger' : i.statut === 'elevee' ? 'warning' : 'info'}">${i.statut}</span>
                                            </div>
                                            <small class="text-secondary">${this.formatDate(i.dateIncident)}</small>
                                        </div>
                                    `).join('')}
                                    ${c.incidents.length > 5 ? `<div class="list-group-item px-3 py-2 text-center text-secondary small">+ ${c.incidents.length - 5} autres...</div>` : ''}
                                </div>
                            ` : '<div class="text-center py-3 text-secondary">Aucun incident</div>'}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Réinitialiser le formulaire chantier
     */
    resetFormChantier() {
        const form = document.getElementById('formChantier');
        if (form) form.reset();
        document.getElementById('chantierId').value = '';
        document.getElementById('chantierStatut').value = 'planifie';
        document.getElementById('chantierTva').value = '20';

        // Réinitialiser les phases
        document.getElementById('phasesContainer').innerHTML = '';
    }

    /**
     * Générer un numéro de chantier automatique
     */
    async generateNumeroChantier() {
        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;
            const year = new Date().getFullYear();
            const result = await window.api.chantiers.invoke('list', {
                entrepriseId,
                limit: 1,
                search: `CHT-${year}`
            });
            const nextNum = (result.items?.length || 0) + 1;
            document.getElementById('chantierNumero').value = `CHT-${year}-${String(nextNum).padStart(4, '0')}`;
        } catch (error) {
            document.getElementById('chantierNumero').value = `CHT-${new Date().getFullYear()}-0001`;
        }
    }

    /**
     * Remplir le formulaire avec les données du chantier
     */
    fillFormChantier(c) {
        document.getElementById('chantierId').value = c.id;
        document.getElementById('chantierNumero').value = c.numero || '';
        document.getElementById('chantierNom').value = c.nom || '';
        document.getElementById('chantierDescription').value = c.description || '';
        document.getElementById('chantierClient').value = c.clientId || '';
        document.getElementById('chantierDateDebut').value = c.dateDebut || '';
        document.getElementById('chantierDateFinPrevue').value = c.dateFinPrevue || '';
        document.getElementById('chantierAdresse').value = c.adresse || '';
        document.getElementById('chantierVille').value = c.ville || '';
        document.getElementById('chantierCodePostal').value = c.codePostal || '';
        document.getElementById('chantierResponsable').value = c.responsableId || '';
        document.getElementById('chantierStatut').value = c.statut || 'planifie';
        document.getElementById('chantierBudgetPrevisionnel').value = c.budgetPrevisionnel || '';
        document.getElementById('chantierMargeCible').value = c.margeCible || '';
        document.getElementById('chantierTva').value = c.tva || '20';

        // Phases
        this.renderPhasesInForm(c.phases || []);
    }

    /**
     * Rendre les phases dans le formulaire
     */
    renderPhasesInForm(phases) {
        const container = document.getElementById('phasesContainer');
        if (!container) return;

        if (phases.length === 0) {
            container.innerHTML = '<p class="text-secondary text-center py-3">Aucune phase. Cliquez sur "Ajouter une phase".</p>';
            return;
        }

        container.innerHTML = phases.map((p, index) => `
            <div class="card mb-2 phase-item" data-phase-id="${p.id}">
                <div class="card-body py-2">
                    <div class="row g-2 align-items-center">
                        <div class="col-auto">
                            <span class="badge bg-secondary">${index + 1}</span>
                        </div>
                        <div class="col">
                            <strong>${this.escapeHtml(p.nom)}</strong>
                            ${p.description ? `<br><small class="text-secondary">${this.escapeHtml(p.description)}</small>` : ''}
                        </div>
                        <div class="col-auto">
                            <small class="text-secondary">${p.dateDebut ? this.formatDate(p.dateDebut) : ''} ${p.dateFin ? `→ ${this.formatDate(p.dateFin)}` : ''}</small>
                        </div>
                        <div class="col-auto">
                            <small class="text-secondary">${this.formatCurrency(p.budget || 0)}</small>
                        </div>
                        <div class="col-auto">
                            <span class="badge bg-primary">${p.avancement || 0}%</span>
                        </div>
                        <div class="col-auto">
                            <button type="button" class="btn btn-sm btn-outline-danger btn-delete-phase" data-id="${p.id}">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        // Binder suppression phase
        container.querySelectorAll('.btn-delete-phase').forEach(btn => {
            btn.addEventListener('click', (e) => this.deletePhase(e.currentTarget.dataset.id));
        });
    }

    /**
     * Ouvrir la modale pour ajouter une phase
     */
    openModalPhase(phase = null) {
        const form = document.getElementById('formPhase');
        if (form) form.reset();

        document.getElementById('phaseId').value = phase?.id || '';
        document.getElementById('phaseChantierId').value = this.chantierEnEdition?.id || '';
        document.getElementById('phaseOrdre').value = phase?.ordre || (document.querySelectorAll('.phase-item').length + 1);

        if (phase) {
            document.getElementById('phaseNom').value = phase.nom || '';
            document.getElementById('phaseDescription').value = phase.description || '';
            document.getElementById('phaseDateDebut').value = phase.dateDebut || '';
            document.getElementById('phaseDateFin').value = phase.dateFin || '';
            document.getElementById('phaseBudget').value = phase.budget || '';
            document.getElementById('phaseAvancement').value = phase.avancement || 0;
            document.getElementById('modalPhaseLabel').innerHTML = '<i class="bi bi-list-task me-2"></i>Modifier la phase';
        } else {
            document.getElementById('modalPhaseLabel').innerHTML = '<i class="bi bi-plus me-2"></i>Nouvelle phase';
        }

        const modal = new bootstrap.Modal(document.getElementById('modalPhase'));
        modal.show();
    }

    /**
     * Gérer la soumission du formulaire chantier
     */
    async handleSubmitChantier(e) {
        e.preventDefault();

        const form = e.target;
        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            return;
        }

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        // Convertir les nombres
        data.budgetPrevisionnel = parseFloat(data.budgetPrevisionnel) || 0;
        data.margeCible = parseFloat(data.margeCible) || 0;
        data.tva = parseFloat(data.tva) || 20;
        data.clientId = parseInt(data.clientId) || null;
        data.responsableId = parseInt(data.responsableId) || null;

        const entrepriseId = window.AppState?.entreprise?.id || 1;
        const isEdit = !!data.id;
        delete data.id;

        try {
            let result;
            if (isEdit) {
                result = await window.api.chantiers.invoke('update', parseInt(formData.get('id')), data);
                showToast('Chantier modifié avec succès', 'success');
            } else {
                result = await window.api.chantiers.invoke('create', data, entrepriseId);
                showToast('Chantier créé avec succès', 'success');
            }

            // Fermer la modale
            bootstrap.Modal.getInstance(document.getElementById('modalChantier'))?.hide();

            // Recharger la liste
            await this.loadChantiers();

        } catch (error) {
            console.error('Erreur sauvegarde chantier:', error);
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    /**
     * Gérer la soumission du formulaire phase
     */
    async handleSubmitPhase(e) {
        e.preventDefault();

        const form = e.target;
        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            return;
        }

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        data.budget = parseFloat(data.budget) || 0;
        data.avancement = parseInt(data.avancement) || 0;
        data.ordre = parseInt(data.ordre) || 1;
        data.chantierId = parseInt(data.chantierId) || this.chantierEnEdition?.id;

        const isEdit = !!data.id;
        const phaseId = parseInt(data.id);
        delete data.id;

        try {
            if (isEdit) {
                // Pour l'édition, on met à jour via le repository directement
                // TODO: Ajouter méthode update dans PhaseRepository
                showToast('Modification de phase à implémenter', 'info');
            } else {
                await window.api.chantiers.invoke('addPhase', data.chantierId, data);
                showToast('Phase ajoutée avec succès', 'success');
            }

            bootstrap.Modal.getInstance(document.getElementById('modalPhase'))?.hide();

            // Recharger le chantier pour mettre à jour les phases
            if (this.chantierEnEdition) {
                const updated = await window.api.chantiers.invoke('get', this.chantierEnEdition.id);
                this.chantierEnEdition = updated;
                this.renderPhasesInForm(updated.phases || []);
            }

        } catch (error) {
            console.error('Erreur sauvegarde phase:', error);
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    /**
     * Supprimer une phase
     */
    async deletePhase(phaseId) {
        if (!confirm('Supprimer cette phase ?')) return;

        try {
            // TODO: Implémenter suppression phase
            showToast('Suppression de phase à implémenter', 'info');
        } catch (error) {
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    /**
     * Confirmer la suppression d'un chantier
     */
    confirmDeleteChantier(id) {
        const chantierId = id || document.getElementById('btnDeleteChantier')?.dataset.id;
        if (!chantierId) return;

        this.chantierEnEdition = { id: parseInt(chantierId) };
        document.getElementById('deleteItemName').textContent = 'ce chantier';

        // Fermer la modale d'édition si ouverte
        bootstrap.Modal.getInstance(document.getElementById('modalChantier'))?.hide();

        // Ouvrir la modale de confirmation
        setTimeout(() => {
            new bootstrap.Modal(document.getElementById('modalConfirmDelete')).show();
        }, 300);
    }

    /**
     * Exécuter la suppression
     */
    async executeDeleteChantier() {
        if (!this.chantierEnEdition?.id) return;

        try {
            await window.api.chantiers.invoke('delete', this.chantierEnEdition.id);
            showToast('Chantier supprimé', 'success');

            bootstrap.Modal.getInstance(document.getElementById('modalConfirmDelete'))?.hide();
            await this.loadChantiers();

        } catch (error) {
            console.error('Erreur suppression:', error);
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    /**
     * Exporter les chantiers
     */
    async exportChantiers() {
        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;
            const result = await window.api.chantiers.invoke('list', {
                entrepriseId,
                limit: 10000
            });

            // Créer CSV
            const headers = ['Numéro', 'Nom', 'Client', 'Date début', 'Date fin prévue', 'Budget', 'Statut'];
            const rows = result.items.map(c => [
                c.numero,
                c.nom,
                c.client ? `${c.client.nom} ${c.client.prenom || ''}`.trim() : '',
                c.dateDebut,
                c.dateFinPrevue || '',
                c.budgetPrevisionnel || 0,
                c.statut
            ]);

            const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');

            // Télécharger
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `chantiers_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();

            showToast('Export terminé', 'success');
        } catch (error) {
            console.error('Erreur export:', error);
            showToast('Erreur lors de l\'export', 'error');
        }
    }

    /**
     * Afficher/masquer le loader
     */
    showLoader(show) {
        const table = document.getElementById('chantiersTable');
        if (table) {
            table.style.opacity = show ? '0.5' : '1';
            table.style.pointerEvents = show ? 'none' : 'auto';
        }
    }

    // Utilitaires
    formatDate(dateStr) {
        if (!dateStr) return '—';
        const date = new Date(dateStr);
        return date.toLocaleDateString('fr-FR');
    }

    formatCurrency(amount) {
        return window.formatCurrencyGlobal ? window.formatCurrencyGlobal(amount) : new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'MGA',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount || 0);
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Instance globale
window.chantiersController = new ChantiersController();

// Initialisation quand la vue est affichée
document.addEventListener('viewLoaded', (e) => {
    if (e.detail.view === 'chantiers') {
        window.chantiersController.init();
    }
});

// Auto-init si on est déjà sur la vue chantiers
if (document.querySelector('.chantiers-view')) {
    document.addEventListener('DOMContentLoaded', () => {
        window.chantiersController.init();
    });
}