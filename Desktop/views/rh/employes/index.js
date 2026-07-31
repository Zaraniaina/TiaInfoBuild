/**
 * Employés View Controller
 * Gère la liste, création, édition, suppression des employés
 * Planning et pointages
 */

class EmployesController {
    constructor() {
        this.currentPage = 1;
        this.pageSize = 20;
        this.totalItems = 0;
        this.filters = {
            search: '',
            statut: '',
            poste: ''
        };
        this.employeEnEdition = null;
        this.equipesCache = [];
        this.postesCache = [];
    }

    /**
     * Initialiser le contrôleur
     */
    async init() {
        await this.loadEquipes();
        await this.loadPostes();
        this.bindEvents();
        await this.loadEmployes();
        await this.loadPlanning();
        await this.loadPointages();
    }

    /**
     * Charger la liste des équipes pour les selects
     */
    async loadEquipes() {
        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;
            const result = await window.api.equipes.invoke('list', entrepriseId);
            this.equipesCache = result || [];
            this.populateEquipeSelects();
        } catch (error) {
            console.error('Erreur chargement équipes:', error);
        }
    }

    /**
     * Charger les postes uniques pour le filtre
     */
    async loadPostes() {
        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;
            const result = await window.api.employes.invoke('list', {
                entrepriseId,
                limit: 1000,
                statut: 'actif'
            });
            const employes = result.items || [];
            const postes = [...new Set(employes.map(e => e.poste).filter(Boolean))].sort();
            this.postesCache = postes;
            this.populatePosteFilter();
        } catch (error) {
            console.error('Erreur chargement postes:', error);
        }
    }

    /**
     * Remplir les selects équipes
     */
    populateEquipeSelects() {
        const selects = document.querySelectorAll('#empEquipe, #aeEquipe');
        selects.forEach(select => {
            const currentValue = select.value;
            select.innerHTML = '<option value="">Aucune / Sélectionner</option>';
            this.equipesCache.forEach(equipe => {
                const option = document.createElement('option');
                option.value = equipe.id;
                option.textContent = equipe.nom + (equipe.chefEquipeId ? ` (Chef: ${equipe.chefEquipeId})` : '');
                select.appendChild(option);
            });
            select.value = currentValue;
        });
    }

    /**
     * Remplir le filtre poste
     */
    populatePosteFilter() {
        const select = document.getElementById('filterPoste');
        if (!select) return;
        const currentValue = select.value;
        select.innerHTML = '<option value="">Tous les postes</option>';
        this.postesCache.forEach(poste => {
            const option = document.createElement('option');
            option.value = poste;
            option.textContent = poste;
            select.appendChild(option);
        });
        select.value = currentValue;
    }

    /**
     * Lier les événements UI
     */
    bindEvents() {
        // Recherche
        const searchInput = document.getElementById('searchEmploye');
        if (searchInput) {
            let debounceTimer;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.filters.search = e.target.value;
                    this.currentPage = 1;
                    this.loadEmployes();
                }, 300);
            });
        }

        // Filtre statut
        const filterStatut = document.getElementById('filterStatutEmploye');
        if (filterStatut) {
            filterStatut.addEventListener('change', (e) => {
                this.filters.statut = e.target.value;
                this.currentPage = 1;
                this.loadEmployes();
            });
        }

        // Filtre poste
        const filterPoste = document.getElementById('filterPoste');
        if (filterPoste) {
            filterPoste.addEventListener('change', (e) => {
                this.filters.poste = e.target.value;
                this.currentPage = 1;
                this.loadEmployes();
            });
        }

        // Boutons
        document.getElementById('btnNouvelEmploye')?.addEventListener('click', () => this.openModalNouveau());
        document.getElementById('btnFirstEmploye')?.addEventListener('click', () => this.openModalNouveau());
        document.getElementById('btnRefreshEmployes')?.addEventListener('click', () => this.loadEmployes());
        document.getElementById('btnExportEmployes')?.addEventListener('click', () => this.exportEmployes());

        // Formulaire employé
        const formEmploye = document.getElementById('formEmploye');
        if (formEmploye) {
            formEmploye.addEventListener('submit', (e) => this.handleSubmitEmploye(e));
        }

        // Bouton supprimer
        document.getElementById('btnDeleteEmploye')?.addEventListener('click', () => this.confirmDeleteEmploye());
        document.getElementById('btnConfirmDeleteEmploye')?.addEventListener('click', () => this.executeDeleteEmploye());

        // Planning
        document.getElementById('btnPlanningToday')?.addEventListener('click', () => {
            document.getElementById('planningDate').value = new Date().toISOString().split('T')[0];
            this.loadPlanning();
        });
        document.getElementById('planningDate')?.addEventListener('change', () => this.loadPlanning());

        // Pointages
        document.getElementById('btnRefreshPointages')?.addEventListener('click', () => this.loadPointages());
        document.getElementById('pointagesDateDebut')?.addEventListener('change', () => this.loadPointages());
        document.getElementById('pointagesDateFin')?.addEventListener('change', () => this.loadPointages());

        // Ajouter à équipe
        document.getElementById('btnAjouterEquipeEmploye')?.addEventListener('click', () => this.openModalAjouterEquipe());
        const formAjouterEquipe = document.getElementById('formAjouterEquipeEmploye');
        if (formAjouterEquipe) {
            formAjouterEquipe.addEventListener('submit', (e) => this.handleSubmitAjouterEquipe(e));
        }

        // Modifier depuis détail
        document.getElementById('btnEditEmployeFromDetail')?.addEventListener('click', () => {
            const modalDetail = bootstrap.Modal.getInstance(document.getElementById('modalEmployeDetail'));
            modalDetail?.hide();
            setTimeout(() => this.openModalEdition(this.employeEnEdition?.id), 300);
        });
    }

    /**
     * Charger la liste des employés
     */
    async loadEmployes() {
        this.showLoader(true);

        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;

            const result = await window.api.employes.invoke('list', {
                entrepriseId,
                limit: this.pageSize,
                offset: (this.currentPage - 1) * this.pageSize,
                statut: this.filters.statut || undefined,
                search: this.filters.search || undefined
            });

            this.totalItems = result.total || 0;
            this.renderEmployesTable(result.items || []);
            this.renderPagination();
            this.toggleEmptyState(result.items?.length === 0);

        } catch (error) {
            console.error('Erreur chargement employés:', error);
            showToast('Erreur lors du chargement des employés', 'error');
        } finally {
            this.showLoader(false);
        }
    }

    /**
     * Afficher les employés dans le tableau
     */
    renderEmployesTable(employes) {
        const tbody = document.getElementById('employesTbody');
        if (!tbody) return;

        if (employes.length === 0) {
            tbody.innerHTML = '';
            return;
        }

        tbody.innerHTML = employes.map((e, index) => {
            const statutClass = {
                'actif': 'bg-success',
                'inactif': 'bg-secondary',
                'conge': 'bg-warning text-dark',
                'suspendu': 'bg-danger'
            }[e.statut] || 'bg-secondary';

            const statutLabel = {
                'actif': 'Actif',
                'inactif': 'Inactif',
                'conge': 'En congé',
                'suspendu': 'Suspendu'
            }[e.statut] || e.statut;

            const equipeNom = e.equipe?.nom || '—';

            return `
                <tr data-id="${e.id}">
                    <td>${(this.currentPage - 1) * this.pageSize + index + 1}</td>
                    <td>
                        <div class="d-flex align-items-center gap-2">
                            ${e.photo ? `<img src="${e.photo}" class="rounded-circle" style="width: 32px; height: 32px; object-fit: cover;">` : '<div class="avatar-badge bg-primary bg-opacity-10 text-primary rounded-circle d-flex align-items-center justify-content-center" style="width: 32px; height: 32px;">' + (e.prenom?.[0] || '') + (e.nom?.[0] || '') + '</div>'}
                            <div>
                                <div class="fw-semibold">${this.escapeHtml(e.prenom)} ${this.escapeHtml(e.nom)}</div>
                                <small class="text-secondary">${this.escapeHtml(e.matricule)}</small>
                            </div>
                        </div>
                    </td>
                    <td>${this.escapeHtml(e.poste || '—')}</td>
                    <td class="d-none d-md-table-cell">${this.escapeHtml(equipeNom)}</td>
                    <td class="d-none d-lg-table-cell">${this.formatCurrency(e.salaireBase || 0)}/mois</td>
                    <td><span class="badge ${statutClass}">${statutLabel}</span></td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-secondary btn-view" data-id="${e.id}" title="Voir">
                                <i class="bi bi-eye"></i>
                            </button>
                            <button class="btn btn-outline-primary btn-edit" data-id="${e.id}" title="Modifier">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-outline-danger btn-delete" data-id="${e.id}" title="Supprimer">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Binder les actions
        tbody.querySelectorAll('.btn-view').forEach(btn => {
            btn.addEventListener('click', (e) => this.viewEmploye(e.currentTarget.dataset.id));
        });
        tbody.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => this.openModalEdition(e.currentTarget.dataset.id));
        });
        tbody.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => this.confirmDeleteEmploye(e.currentTarget.dataset.id));
        });
    }

    /**
     * Afficher la pagination
     */
    renderPagination() {
        const container = document.getElementById('employesPagination');
        if (!container) return;

        const totalPages = Math.ceil(this.totalItems / this.pageSize);
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
                    this.loadEmployes();
                }
            });
        });
    }

    /**
     * Afficher/masquer l'état vide
     */
    toggleEmptyState(isEmpty) {
        document.getElementById('employesEmpty')?.classList.toggle('d-none', !isEmpty);
        document.getElementById('employesTable')?.classList.toggle('d-none', isEmpty);
        document.getElementById('employesPagination')?.classList.toggle('d-none', isEmpty);
    }

    /**
     * Charger le planning du jour
     */
    async loadPlanning() {
        const container = document.getElementById('planningContent');
        if (!container) return;

        const dateStr = document.getElementById('planningDate')?.value || new Date().toISOString().split('T')[0];
        const entrepriseId = window.AppState?.entreprise?.id || 1;

        try {
            const presents = await window.api.employes.invoke('presentsToday', entrepriseId);

            container.innerHTML = `
                <div class="row g-3">
                    <div class="col-12">
                        <h6 class="text-secondary">Présents le ${this.formatDate(dateStr)} (${presents.length})</h6>
                    </div>
                    ${presents.map(p => `
                        <div class="col-md-6 col-lg-4">
                            <div class="card h-100">
                                <div class="card-body">
                                    <div class="d-flex align-items-center gap-3">
                                        <div class="avatar-badge bg-success bg-opacity-10 text-success rounded-circle d-flex align-items-center justify-content-center" style="width: 48px; height: 48px;">
                                            <i class="bi bi-check-circle-fill fs-4"></i>
                                        </div>
                                        <div class="flex-grow-1">
                                            <div class="fw-semibold">${this.escapeHtml(p.prenom)} ${this.escapeHtml(p.nom)}</div>
                                            <small class="text-secondary">${this.escapeHtml(p.poste || '—')}</small>
                                            ${p.chantierId ? `<div class="text-primary small"><i class="bi bi-building me-1"></i>${this.escapeHtml(p.chantier?.nom || 'Chantier')}</div>` : ''}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('') || '<div class="col-12 text-center py-4 text-secondary">Aucun employé présent aujourd\'hui</div>'}
                </div>
            `;
        } catch (error) {
            console.error('Erreur chargement planning:', error);
            container.innerHTML = '<div class="alert alert-danger">Erreur lors du chargement du planning</div>';
        }
    }

    /**
     * Charger les pointages récents
     */
    async loadPointages() {
        const tbody = document.getElementById('pointagesTbody');
        if (!tbody) return;

        const dateDebut = document.getElementById('pointagesDateDebut')?.value;
        const dateFin = document.getElementById('pointagesDateFin')?.value;
        const entrepriseId = window.AppState?.entreprise?.id || 1;

        try {
            // Récupérer les employés pour avoir leurs pointages
            const result = await window.api.employes.invoke('list', {
                entrepriseId,
                limit: 50,
                statut: 'actif'
            });

            // Pour chaque employé, récupérer ses pointages
            let allPointages = [];
            for (const emp of result.items || []) {
                const pointages = await window.api.pointages.invoke('list', {
                    employeId: emp.id,
                    dateDebut,
                    dateFin,
                    limit: 10
                });
                allPointages.push(...pointages.map(p => ({ ...p, employe: emp })));
            }

            // Trier par date décroissante
            allPointages.sort((a, b) => new Date(b.dateJour) - new Date(a.dateJour));
            allPointages = allPointages.slice(0, 100);

            if (allPointages.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-secondary">Aucun pointage</td></tr>';
                return;
            }

            tbody.innerHTML = allPointages.map(p => {
                const heures = p.heureArrivee && p.heureDepart ? this.calculerHeures(p.heureArrivee, p.heureDepart) : '—';
                const statutClass = {
                    'present': 'bg-success',
                    'absent': 'bg-danger',
                    'retard': 'bg-warning text-dark',
                    'conge': 'bg-info'
                }[p.statut] || 'bg-secondary';

                return `
                    <tr>
                        <td>${this.formatDate(p.dateJour)}</td>
                        <td>${this.escapeHtml(p.employe?.prenom)} ${this.escapeHtml(p.employe?.nom)}</td>
                        <td>${p.chantier?.nom ? this.escapeHtml(p.chantier.nom) : '—'}</td>
                        <td>${p.heureArrivee || '—'}</td>
                        <td>${p.heureDepart || '—'}</td>
                        <td><span class="badge ${statutClass}">${p.statut}</span></td>
                        <td>${heures}</td>
                    </tr>
                `;
            }).join('');
        } catch (error) {
            console.error('Erreur chargement pointages:', error);
            tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-danger">Erreur chargement</td></tr>';
        }
    }

    /**
     * Calculer les heures entre arrivée et départ
     */
    calculerHeures(arrivee, depart) {
        const [h1, m1] = arrivee.split(':').map(Number);
        const [h2, m2] = depart.split(':').map(Number);
        const totalMinutes = (h2 * 60 + m2) - (h1 * 60 + m1);
        if (totalMinutes <= 0) return '—';
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        return `${h}h${m.toString().padStart(2, '0')}`;
    }

    /**
     * Ouvrir la modale pour nouvel employé
     */
    openModalNouveau() {
        this.employeEnEdition = null;
        this.resetFormEmploye();
        document.getElementById('modalEmployeLabel').textContent = 'Nouvel employé';
        document.getElementById('btnDeleteEmploye').style.display = 'none';

        // Générer matricule automatique
        this.generateMatricule();

        const modal = new bootstrap.Modal(document.getElementById('modalEmploye'));
        modal.show();
    }

    /**
     * Ouvrir la modale pour éditer un employé
     */
    async openModalEdition(id) {
        try {
            const employe = await window.api.employes.invoke('get', parseInt(id));
            if (!employe) {
                showToast('Employé non trouvé', 'error');
                return;
            }

            this.employeEnEdition = employe;
            this.fillFormEmploye(employe);
            document.getElementById('modalEmployeLabel').textContent = `Modifier: ${employe.prenom} ${employe.nom}`;
            document.getElementById('btnDeleteEmploye').style.display = 'inline-block';
            document.getElementById('btnDeleteEmploye').dataset.id = id;

            const modal = new bootstrap.Modal(document.getElementById('modalEmploye'));
            modal.show();
        } catch (error) {
            console.error('Erreur chargement employé:', error);
            showToast('Erreur lors du chargement de l\'employé', 'error');
        }
    }

    /**
     * Voir le détail d'un employé
     */
    async viewEmploye(id) {
        try {
            const employe = await window.api.employes.invoke('get', parseInt(id));
            if (!employe) {
                showToast('Employé non trouvé', 'error');
                return;
            }

            this.renderEmployeDetail(employe);
            const modal = new bootstrap.Modal(document.getElementById('modalEmployeDetail'));
            modal.show();
        } catch (error) {
            console.error('Erreur chargement détail:', error);
            showToast('Erreur lors du chargement du détail', 'error');
        }
    }

    /**
     * Rendre le détail de l'employé
     */
    renderEmployeDetail(e) {
        const container = document.getElementById('employeDetailContent');
        if (!container) return;

        container.innerHTML = `
            <div class="row g-4">
                <div class="col-md-4 text-center">
                    ${e.photo ? `<img src="${e.photo}" class="rounded-circle mb-3" style="width: 120px; height: 120px; object-fit: cover;">` : '<div class="avatar-badge bg-primary bg-opacity-10 text-primary rounded-circle mx-auto mb-3 d-flex align-items-center justify-content-center" style="width: 120px; height: 120px; font-size: 3rem;">' + (e.prenom?.[0] || '') + (e.nom?.[0] || '') + '</div>'}
                    <h4>${this.escapeHtml(e.prenom)} ${this.escapeHtml(e.nom)}</h4>
                    <span class="badge bg-${e.statut === 'actif' ? 'success' : e.statut === 'conge' ? 'warning' : 'secondary'} fs-6">${e.statut}</span>
                    <p class="text-secondary mt-2">${this.escapeHtml(e.matricule)}</p>
                </div>
                <div class="col-md-8">
                    <div class="card mb-3">
                        <div class="card-header"><h6 class="mb-0"><i class="bi bi-info-circle me-2"></i>Informations personnelles</h6></div>
                        <div class="card-body">
                            <div class="row g-2">
                                <div class="col-md-6"><small class="text-secondary">Email</small><div>${this.escapeHtml(e.email || '—')}</div></div>
                                <div class="col-md-6"><small class="text-secondary">Téléphone</small><div>${this.escapeHtml(e.telephone || '—')}</div></div>
                                <div class="col-md-6"><small class="text-secondary">Né le</small><div>${e.dateNaissance ? this.formatDate(e.dateNaissance) : '—'}</div></div>
                                <div class="col-md-6"><small class="text-secondary">Lieu</small><div>${this.escapeHtml(e.lieuNaissance || '—')}</div></div>
                                <div class="col-md-6"><small class="text-secondary">Nationalité</small><div>${this.escapeHtml(e.nationalite || '—')}</div></div>
                                <div class="col-md-6"><small class="text-secondary">Contact urgence</small><div>${this.escapeHtml(e.contactUrgence || '—')} (${this.escapeHtml(e.telUrgence || '—')})</div></div>
                                <div class="col-12"><small class="text-secondary">Adresse</small><div>${this.escapeHtml(e.adresse || '—')} ${this.escapeHtml(e.codePostal || '')} ${this.escapeHtml(e.ville || '')} ${this.escapeHtml(e.pays || '')}</div></div>
                            </div>
                        </div>
                    </div>
                    <div class="card mb-3">
                        <div class="card-header"><h6 class="mb-0"><i class="bi bi-file-earmark-text me-2"></i>Contrat</h6></div>
                        <div class="card-body">
                            <div class="row g-2">
                                <div class="col-md-4"><small class="text-secondary">Poste</small><div class="fw-semibold">${this.escapeHtml(e.poste || '—')}</div></div>
                                <div class="col-md-4"><small class="text-secondary">Qualification</small><div>${this.escapeHtml(e.qualification || '—')}</div></div>
                                <div class="col-md-4"><small class="text-secondary">Type contrat</small><div>${this.escapeHtml(e.typeContrat || '—')}</div></div>
                                <div class="col-md-4"><small class="text-secondary">Entrée</small><div>${e.dateEntree ? this.formatDate(e.dateEntree) : '—'}</div></div>
                                <div class="col-md-4"><small class="text-secondary">Sortie</small><div>${e.dateSortie ? this.formatDate(e.dateSortie) : '—'}</div></div>
                                <div class="col-md-4"><small class="text-secondary">Période essai</small><div>${e.periodeEssai ? e.periodeEssai + ' mois' : '—'}</div></div>
                                <div class="col-md-4"><small class="text-secondary">Salaire base</small><div class="fw-semibold text-success">${this.formatCurrency(e.salaireBase || 0)}/mois</div></div>
                                <div class="col-md-4"><small class="text-secondary">Taux horaire</small><div>${this.formatCurrency(e.tauxHoraire || 0)}/h</div></div>
                                <div class="col-md-4"><small class="text-secondary">Prime risque</small><div>${this.formatCurrency(e.primeRisque || 0)}/mois</div></div>
                                <div class="col-md-4"><small class="text-secondary">Prime panier</small><div>${this.formatCurrency(e.primePanier || 0)}/jour</div></div>
                                <div class="col-md-4"><small class="text-secondary">Prime transport</small><div>${this.formatCurrency(e.primeTransport || 0)}/mois</div></div>
                                <div class="col-md-4"><small class="text-secondary">Équipe</small><div>${this.escapeHtml(e.equipe?.nom || '—')}</div></div>
                            </div>
                        </div>
                    </div>
                    ${e.notes ? `
                    <div class="card">
                        <div class="card-header"><h6 class="mb-0"><i class="bi bi-sticky me-2"></i>Notes</h6></div>
                        <div class="card-body"><p class="mb-0">${this.escapeHtml(e.notes)}</p></div>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Réinitialiser le formulaire employé
     */
    resetFormEmploye() {
        const form = document.getElementById('formEmploye');
        if (form) form.reset();
        document.getElementById('employeId').value = '';
        document.getElementById('empStatut').value = 'actif';
        document.getElementById('empTypeContrat').value = 'CDI';
        document.getElementById('empPays').value = 'France';
        document.getElementById('empPrimeRisque').value = '0';
        document.getElementById('empPrimePanier').value = '0';
        document.getElementById('empPrimeTransport').value = '0';
        document.getElementById('empPeriodeEssai').value = '';

        // Équipes
        document.getElementById('employeEquipesContainer').innerHTML = '<p class="text-secondary text-center py-3">Aucune équipe</p>';
    }

    /**
     * Générer un matricule automatique
     */
    async generateMatricule() {
        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;
            const result = await window.api.employes.invoke('list', {
                entrepriseId,
                limit: 1
            });
            const nextNum = (result.items?.length || 0) + 1;
            document.getElementById('empMatricule').value = `EMP${String(nextNum).padStart(5, '0')}`;
        } catch (error) {
            document.getElementById('empMatricule').value = `EMP${String(Date.now()).slice(-5)}`;
        }
    }

    /**
     * Remplir le formulaire avec les données de l'employé
     */
    fillFormEmploye(e) {
        document.getElementById('employeId').value = e.id;
        document.getElementById('empMatricule').value = e.matricule || '';
        document.getElementById('empNom').value = e.nom || '';
        document.getElementById('empPrenom').value = e.prenom || '';
        document.getElementById('empEmail').value = e.email || '';
        document.getElementById('empTelephone').value = e.telephone || '';
        document.getElementById('empDateNaissance').value = e.dateNaissance || '';
        document.getElementById('empLieuNaissance').value = e.lieuNaissance || '';
        document.getElementById('empNationalite').value = e.nationalite || '';
        document.getElementById('empAdresse').value = e.adresse || '';
        document.getElementById('empCodePostal').value = e.codePostal || '';
        document.getElementById('empVille').value = e.ville || '';
        document.getElementById('empPays').value = e.pays || 'France';
        document.getElementById('empContactUrgence').value = e.contactUrgence || '';
        document.getElementById('empTelUrgence').value = e.telUrgence || '';

        // Contrat
        document.getElementById('empPoste').value = e.poste || '';
        document.getElementById('empQualification').value = e.qualification || '';
        document.getElementById('empTypeContrat').value = e.typeContrat || 'CDI';
        document.getElementById('empDateEntree').value = e.dateEntree || '';
        document.getElementById('empDateSortie').value = e.dateSortie || '';
        document.getElementById('empPeriodeEssai').value = e.periodeEssai || '';
        document.getElementById('empSalaireBase').value = e.salaireBase || '';
        document.getElementById('empTauxHoraire').value = e.tauxHoraire || '';
        document.getElementById('empPrimeRisque').value = e.primeRisque || '0';
        document.getElementById('empPrimePanier').value = e.primePanier || '0';
        document.getElementById('empPrimeTransport').value = e.primeTransport || '0';
        document.getElementById('empStatut').value = e.statut || 'actif';
        document.getElementById('empEquipe').value = e.equipeId || '';
        document.getElementById('empNotes').value = e.notes || '';

        // Équipes
        this.renderEmployeEquipes(e.membresEquipes || []);
    }

    /**
     * Rendre les équipes de l'employé dans le formulaire
     */
    renderEmployeEquipes(equipes) {
        const container = document.getElementById('employeEquipesContainer');
        if (!container) return;

        if (equipes.length === 0) {
            container.innerHTML = '<p class="text-secondary text-center py-3">Aucune équipe</p>';
            return;
        }

        container.innerHTML = equipes.map(eq => `
            <div class="card mb-2">
                <div class="card-body py-2">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <strong>${this.escapeHtml(eq.equipeNom)}</strong>
                            ${eq.role ? `<br><small class="text-secondary">Rôle: ${this.escapeHtml(eq.role)}</small>` : ''}
                            <br><small class="text-secondary">${eq.dateDebut ? this.formatDate(eq.dateDebut) : ''} ${eq.dateFin ? `→ ${this.formatDate(eq.dateFin)}` : ' (actuelle)'}</small>
                        </div>
                        <button type="button" class="btn btn-sm btn-outline-danger" onclick="window.employesController.removeFromEquipe(${eq.id})">
                            <i class="bi bi-x"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    /**
     * Ouvrir la modale pour ajouter à une équipe
     */
    openModalAjouterEquipe() {
        if (!this.employeEnEdition?.id) {
            showToast('Sélectionnez d\'abord un employé', 'warning');
            return;
        }

        const form = document.getElementById('formAjouterEquipeEmploye');
        if (form) form.reset();

        document.getElementById('aeEmployeId').value = this.employeEnEdition.id;
        document.getElementById('aeDateDebut').value = new Date().toISOString().split('T')[0];

        const modal = new bootstrap.Modal(document.getElementById('modalAjouterEquipeEmploye'));
        modal.show();
    }

    /**
     * Gérer la soumission du formulaire employé
     */
    async handleSubmitEmploye(e) {
        e.preventDefault();

        const form = e.target;
        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            return;
        }

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        // Convertir les nombres
        data.salaireBase = parseFloat(data.salaireBase) || 0;
        data.tauxHoraire = parseFloat(data.tauxHoraire) || 0;
        data.primeRisque = parseFloat(data.primeRisque) || 0;
        data.primePanier = parseFloat(data.primePanier) || 0;
        data.primeTransport = parseFloat(data.primeTransport) || 0;
        data.periodeEssai = parseInt(data.periodeEssai) || 0;
        data.equipeId = parseInt(data.equipeId) || null;

        const entrepriseId = window.AppState?.entreprise?.id || 1;
        const isEdit = !!data.id;
        delete data.id;

        try {
            if (isEdit) {
                await window.api.employes.invoke('update', parseInt(formData.get('id')), data);
                showToast('Employé modifié avec succès', 'success');
            } else {
                await window.api.employes.invoke('create', data, entrepriseId);
                showToast('Employé créé avec succès', 'success');
            }

            bootstrap.Modal.getInstance(document.getElementById('modalEmploye'))?.hide();
            await this.loadEmployes();

        } catch (error) {
            console.error('Erreur sauvegarde employé:', error);
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    /**
     * Gérer l'ajout à une équipe
     */
    async handleSubmitAjouterEquipe(e) {
        e.preventDefault();

        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        data.employeId = parseInt(data.employeId);
        data.equipeId = parseInt(data.equipeId);

        try {
            await window.api.equipes.invoke('ajouterMembre', data.equipeId, data.employeId);
            showToast('Employé ajouté à l\'équipe', 'success');

            bootstrap.Modal.getInstance(document.getElementById('modalAjouterEquipeEmploye'))?.hide();

            // Recharger l'employé pour mettre à jour les équipes
            if (this.employeEnEdition) {
                const updated = await window.api.employes.invoke('get', this.employeEnEdition.id);
                this.employeEnEdition = updated;
                this.renderEmployeEquipes(updated.membresEquipes || []);
            }
        } catch (error) {
            console.error('Erreur ajout équipe:', error);
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    /**
     * Retirer d'une équipe
     */
    async removeFromEquipe(membreId) {
        if (!confirm('Retirer cet employé de l\'équipe ?')) return;

        try {
            // TODO: Implémenter dans MembreEquipeRepository
            showToast('Retrait d\'équipe à implémenter', 'info');
        } catch (error) {
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    /**
     * Confirmer la suppression
     */
    confirmDeleteEmploye(id) {
        const employeId = id || document.getElementById('btnDeleteEmploye')?.dataset.id;
        if (!employeId) return;

        this.employeEnEdition = { id: parseInt(employeId) };
        document.getElementById('deleteEmployeName').textContent = 'cet employé';

        bootstrap.Modal.getInstance(document.getElementById('modalEmploye'))?.hide();

        setTimeout(() => {
            new bootstrap.Modal(document.getElementById('modalConfirmDeleteEmploye')).show();
        }, 300);
    }

    /**
     * Exécuter la suppression
     */
    async executeDeleteEmploye() {
        if (!this.employeEnEdition?.id) return;

        try {
            await window.api.employes.invoke('delete', this.employeEnEdition.id);
            showToast('Employé supprimé', 'success');

            bootstrap.Modal.getInstance(document.getElementById('modalConfirmDeleteEmploye'))?.hide();
            await this.loadEmployes();

        } catch (error) {
            console.error('Erreur suppression:', error);
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    /**
     * Exporter les employés
     */
    async exportEmployes() {
        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;
            const result = await window.api.employes.invoke('list', {
                entrepriseId,
                limit: 10000
            });

            const headers = ['Matricule', 'Nom', 'Prénom', 'Poste', 'Email', 'Téléphone', 'Date entrée', 'Salaire base', 'Statut'];
            const rows = result.items.map(e => [
                e.matricule,
                e.nom,
                e.prenom,
                e.poste || '',
                e.email || '',
                e.telephone || '',
                e.dateEntree || '',
                e.salaireBase || 0,
                e.statut
            ]);

            const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `employes_${new Date().toISOString().split('T')[0]}.csv`;
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
        const table = document.getElementById('employesTable');
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
        return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'EUR',
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
window.employesController = new EmployesController();