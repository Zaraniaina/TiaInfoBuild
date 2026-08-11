/**
 * Devis & Contrats View Controller
 * Gère les devis, lignes de devis, contrats
 */

class DevisController {
    constructor() {
        this.currentPage = 1;
        this.pageSize = 20;
        this.totalItems = 0;
        this.filters = {
            search: '',
            statut: '',
            tri: 'dateCreation_desc'
        };
        this.currentTab = 'devis';
        this.devisEnEdition = null;
        this.clientsCache = [];
        this.chantiersCache = [];
        this.articlesCache = [];
        this.lignesDevis = [];
    }

    /**
     * Initialiser le contrôleur
     */
    async init() {
        await this.loadClients();
        await this.loadChantiers();
        await this.loadArticles();
        this.bindEvents();
        await this.loadDevis();
        await this.loadContrats();
    }

    /**
     * Charger les clients pour les selects
     */
    async loadClients() {
        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;
            const result = await window.api.clients.invoke('list', { entrepriseId, limit: 1000 });
            this.clientsCache = result.items || [];
            this.populateClientSelects();
        } catch (error) {
            console.error('Erreur chargement clients:', error);
        }
    }

    /**
     * Charger les chantiers pour les selects
     */
    async loadChantiers() {
        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;
            const result = await window.api.chantiers.invoke('list', { entrepriseId, limit: 1000, statut: 'en_cours' });
            this.chantiersCache = result.items || [];
            this.populateChantierSelects();
        } catch (error) {
            console.error('Erreur chargement chantiers:', error);
        }
    }

    /**
     * Charger les articles pour les lignes
     */
    async loadArticles() {
        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;
            const result = await window.api.articles.invoke('list', { entrepriseId, limit: 1000 });
            this.articlesCache = result.items || [];
            this.populateArticleSelects();
        } catch (error) {
            console.error('Erreur chargement articles:', error);
        }
    }

    /**
     * Remplir les selects clients
     */
    populateClientSelects() {
        const selects = document.querySelectorAll('#devisClient');
        selects.forEach(select => {
            const currentValue = select.value;
            select.innerHTML = '<option value="">Sélectionner un client</option>';
            this.clientsCache.forEach(c => {
                const option = document.createElement('option');
                option.value = c.id;
                const nom = c.type === 'entreprise' ? c.entreprise : `${c.prenom} ${c.nom}`.trim();
                option.textContent = nom + (c.email ? ` (${c.email})` : '');
                select.appendChild(option);
            });
            select.value = currentValue;
        });
    }

    /**
     * Remplir les selects chantiers
     */
    populateChantierSelects() {
        const selects = document.querySelectorAll('#devisChantier');
        selects.forEach(select => {
            const currentValue = select.value;
            select.innerHTML = '<option value="">Aucun (devis standalone)</option>';
            this.chantiersCache.forEach(c => {
                const option = document.createElement('option');
                option.value = c.id;
                option.textContent = c.nom + (c.numero ? ` (${c.numero})` : '');
                select.appendChild(option);
            });
            select.value = currentValue;
        });
    }

    /**
     * Remplir les selects articles
     */
    populateArticleSelects() {
        const selects = document.querySelectorAll('#ligneArticle');
        selects.forEach(select => {
            const currentValue = select.value;
            select.innerHTML = '<option value="">Sélectionner un article</option>';
            this.articlesCache.forEach(a => {
                const option = document.createElement('option');
                option.value = a.id;
                option.textContent = a.nom + (a.reference ? ` (${a.reference})` : '') + ` - ${a.prixVente ? a.prixVente + ' €' : 'Prix N/A'}`;
                select.appendChild(option);
            });
            select.value = currentValue;
        });
    }

    /**
     * Lier les événements UI
     */
    bindEvents() {
        // Onglets principaux
        document.querySelectorAll('#devisTabs button[data-bs-toggle="tab"]').forEach(btn => {
            btn.addEventListener('shown.bs.tab', (e) => {
                this.currentTab = e.target.id.replace('tab-', '').replace('-tab', '');
                if (this.currentTab === 'devis') this.loadDevis();
                else if (this.currentTab === 'contrats') this.loadContrats();
            });
        });

        // Recherche devis
        const searchInput = document.getElementById('searchDevis');
        if (searchInput) {
            let debounceTimer;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.filters.search = e.target.value;
                    this.currentPage = 1;
                    this.loadDevis();
                }, 300);
            });
        }

        // Filtres
        document.getElementById('filterStatutDevis')?.addEventListener('change', (e) => {
            this.filters.statut = e.target.value;
            this.currentPage = 1;
            this.loadDevis();
        });
        document.getElementById('filterTriDevis')?.addEventListener('change', (e) => {
            this.filters.tri = e.target.value;
            this.loadDevis();
        });

        // Boutons
        document.getElementById('btnNouveauDevis')?.addEventListener('click', () => this.openModalNouveauDevis());
        document.getElementById('btnFirstDevis')?.addEventListener('click', () => this.openModalNouveauDevis());
        document.getElementById('btnRefreshDevis')?.addEventListener('click', () => this.loadDevis());
        document.getElementById('btnExportDevis')?.addEventListener('click', () => this.exportDevis());
        document.getElementById('btnNouveauContrat')?.addEventListener('click', () => this.openModalNouveauContrat());
        document.getElementById('btnContrats')?.addEventListener('click', () => {
            document.getElementById('tab-contrats-tab')?.click();
        });

        // Formulaire devis
        document.getElementById('formDevis')?.addEventListener('submit', (e) => this.handleSubmitDevis(e));
        document.getElementById('btnDeleteDevis')?.addEventListener('click', () => this.confirmDeleteDevis());
        document.getElementById('btnDupliquerDevis')?.addEventListener('click', () => this.dupliquerDevis());
        document.getElementById('btnEnvoyerDevis')?.addEventListener('click', () => this.envoyerDevis());
        document.getElementById('btnTransformerContrat')?.addEventListener('click', () => this.transformerEnContrat());
        document.getElementById('btnConfirmDeleteDevis')?.addEventListener('click', () => this.executeDeleteDevis());

        // Lignes devis
        document.getElementById('btnAjouterLigneDevis')?.addEventListener('click', () => this.openModalLigneDevis());
        document.getElementById('formLigneDevis')?.addEventListener('submit', (e) => this.handleSubmitLigneDevis(e));

        // Calculs auto ligne
        document.getElementById('ligneQuantite')?.addEventListener('input', () => this.calculerLigne());
        document.getElementById('lignePrixUnitaire')?.addEventListener('input', () => this.calculerLigne());
        document.getElementById('ligneRemise')?.addEventListener('input', () => this.calculerLigne());
        document.getElementById('ligneTauxTVA')?.addEventListener('change', () => this.calculerLigne());
        document.getElementById('ligneArticle')?.addEventListener('change', (e) => this.onArticleSelect(e));

        // Formulaire contrat
        document.getElementById('formContrat')?.addEventListener('submit', (e) => this.handleSubmitContrat(e));
        document.getElementById('btnDeleteContrat')?.addEventListener('click', () => this.confirmDeleteContrat());

        // Client depuis devis
        document.getElementById('btnNouveauClientDevis')?.addEventListener('click', () => {
            window.router.navigate('#clients/nouveau');
        });

        // Modifier depuis détail
        document.getElementById('btnEditDevisFromDetail')?.addEventListener('click', () => {
            const modalDetail = bootstrap.Modal.getInstance(document.getElementById('modalDevisDetail'));
            modalDetail?.hide();
            setTimeout(() => this.openModalEditionDevis(this.devisEnEdition?.id), 300);
        });
    }

    /**
     * Calculer les totaux d'une ligne
     */
    calculerLigne() {
        const quantite = parseFloat(document.getElementById('ligneQuantite')?.value) || 0;
        const prixUnitaire = parseFloat(document.getElementById('lignePrixUnitaire')?.value) || 0;
        const remise = parseFloat(document.getElementById('ligneRemise')?.value) || 0;
        const tauxTVA = parseFloat(document.getElementById('ligneTauxTVA')?.value) || 20;

        const totalHT = quantite * prixUnitaire * (1 - remise / 100);
        const totalTVA = totalHT * (tauxTVA / 100);
        const totalTTC = totalHT + totalTVA;

        document.getElementById('ligneTotal').value = totalHT.toFixed(2);
        document.getElementById('ligneTotalTTC').value = totalTTC.toFixed(2);
    }

    /**
     * Quand un article est sélectionné
     */
    onArticleSelect(e) {
        const articleId = parseInt(e.target.value);
        const article = this.articlesCache.find(a => a.id === articleId);
        if (article) {
            document.getElementById('ligneDescription').value = article.nom + (article.description ? '\n' + article.description : '');
            document.getElementById('ligneUnite').value = article.unite || 'unité';
            document.getElementById('lignePrixUnitaire').value = article.prixVente || 0;
            document.getElementById('ligneTauxTVA').value = article.tva || 20;
            this.calculerLigne();
        }
    }

    /**
     * Recalculer les totaux du devis
     */
    calculerTotauxDevis() {
        let totalHT = 0;
        let totalTVA = 0;

        this.lignesDevis.forEach(l => {
            const qte = parseFloat(l.quantite) || 0;
            const px = parseFloat(l.prixUnitaire) || 0;
            const rem = parseFloat(l.remise) || 0;
            const tva = parseFloat(l.tauxTVA) || 20;

            const ligneHT = qte * px * (1 - rem / 100);
            const ligneTVA = ligneHT * (tva / 100);

            totalHT += ligneHT;
            totalTVA += ligneTVA;
        });

        const totalTTC = totalHT + totalTVA;
        const acomptePourcent = parseFloat(document.getElementById('devisAcompte')?.value) || 0;
        const acompteMontant = totalTTC * (acomptePourcent / 100);

        document.getElementById('devisTotalHT').textContent = this.formatCurrency(totalHT);
        document.getElementById('devisTotalTVA').textContent = this.formatCurrency(totalTVA);
        document.getElementById('devisTotalTTC').textContent = this.formatCurrency(totalTTC);
        document.getElementById('devisAcompteMontant').textContent = this.formatCurrency(acompteMontant);
        document.getElementById('devisLignesCount').textContent = this.lignesDevis.length;

        // Stocker les totaux pour la soumission
        this.devisTotaux = { totalHT, totalTVA, totalTTC, acompteMontant };
    }

    // ==================== DEVIS ====================

    /**
     * Charger la liste des devis
     */
    async loadDevis() {
        this.showLoader(true);

        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;

            const result = await window.api.devis.invoke('list', {
                entrepriseId,
                limit: this.pageSize,
                offset: (this.currentPage - 1) * this.pageSize,
                statut: this.filters.statut || undefined,
                search: this.filters.search || undefined
            });

            this.totalItems = result.total || 0;
            this.renderDevisTable(result.items || []);
            this.renderPagination();
            this.toggleEmptyState(result.items?.length === 0);

        } catch (error) {
            console.error('Erreur chargement devis:', error);
            showToast('Erreur lors du chargement des devis', 'error');
        } finally {
            this.showLoader(false);
        }
    }

    /**
     * Afficher les devis dans le tableau
     */
    renderDevisTable(devis) {
        const tbody = document.getElementById('devisTbody');
        if (!tbody) return;

        if (devis.length === 0) {
            tbody.innerHTML = '';
            return;
        }

        tbody.innerHTML = devis.map((d, index) => {
            const statutClass = {
                'brouillon': 'bg-secondary',
                'envoye': 'bg-info',
                'accepte': 'bg-success',
                'refuse': 'bg-danger',
                'expire': 'bg-warning text-dark',
                'transforme': 'bg-primary'
            }[d.statut] || 'bg-secondary';

            const statutLabel = {
                'brouillon': 'Brouillon',
                'envoye': 'Envoyé',
                'accepte': 'Accepté',
                'refuse': 'Refusé',
                'expire': 'Expiré',
                'transforme': 'Transformé'
            }[d.statut] || d.statut;

            const clientNom = d.client ? (d.client.type === 'entreprise' ? d.client.entreprise : `${d.client.prenom} ${d.client.nom}`.trim()) : '—';
            const chantierNom = d.chantier?.nom || '—';

            return `
                <tr data-id="${d.id}">
                    <td>${(this.currentPage - 1) * this.pageSize + index + 1}</td>
                    <td>
                        <div class="fw-semibold">${this.escapeHtml(d.numero)}</div>
                        <small class="text-secondary">${this.escapeHtml(d.objet || '')}</small>
                    </td>
                    <td>${this.escapeHtml(clientNom)}</td>
                    <td class="d-none d-md-table-cell">${this.escapeHtml(chantierNom)}</td>
                    <td class="d-none d-md-table-cell"><small>${this.formatDate(d.dateEmission)}</small></td>
                    <td class="d-none d-lg-table-cell"><small>${d.dateValidite ? this.formatDate(d.dateValidite) : '—'}</small></td>
                    <td>${this.formatCurrency(d.montantHT || 0)}</td>
                    <td class="fw-semibold">${this.formatCurrency(d.montantTTC || 0)}</td>
                    <td><span class="badge ${statutClass}">${statutLabel}</span></td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-secondary btn-view" data-id="${d.id}" title="Voir">
                                <i class="bi bi-eye"></i>
                            </button>
                            <button class="btn btn-outline-primary btn-edit" data-id="${d.id}" title="Modifier" data-permission="devis:update">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-outline-success btn-duplicate" data-id="${d.id}" title="Dupliquer" data-permission="devis:create">
                                <i class="bi bi-files"></i>
                            </button>
                            ${d.statut !== 'transforme' ? `<button class="btn btn-outline-warning btn-transform" data-id="${d.id}" title="Transformer en contrat" data-permission="devis:transformerEnContrat">
                                <i class="bi bi-arrow-right-circle"></i>
                            </button>` : ''}
                            <button class="btn btn-outline-danger btn-delete" data-id="${d.id}" title="Supprimer" data-permission="devis:delete">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Binder les actions
        tbody.querySelectorAll('.btn-view').forEach(btn => {
            btn.addEventListener('click', (e) => this.viewDevis(e.currentTarget.dataset.id));
        });
        tbody.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => this.openModalEditionDevis(e.currentTarget.dataset.id));
        });
        tbody.querySelectorAll('.btn-duplicate').forEach(btn => {
            btn.addEventListener('click', (e) => this.dupliquerDevis(e.currentTarget.dataset.id));
        });
        tbody.querySelectorAll('.btn-transform').forEach(btn => {
            btn.addEventListener('click', (e) => this.transformerEnContrat(e.currentTarget.dataset.id));
        });
        tbody.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => this.confirmDeleteDevis(e.currentTarget.dataset.id));
        });
    }

    /**
     * Afficher la pagination
     */
    renderPagination() {
        const container = document.getElementById('devisPagination');
        if (!container) return;

        const totalPages = Math.ceil(this.totalItems / this.pageSize);
        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let html = '<nav><ul class="pagination pagination-sm mb-0">';
        html += `<li class="page-item ${this.currentPage === 1 ? 'disabled' : ''}"><a class="page-link" href="#" data-page="${this.currentPage - 1}"><i class="bi bi-chevron-left"></i></a></li>`;

        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(totalPages, this.currentPage + 2);
        for (let i = startPage; i <= endPage; i++) {
            html += `<li class="page-item ${i === this.currentPage ? 'active' : ''}"><a class="page-link" href="#" data-page="${i}">${i}</a></li>`;
        }

        html += `<li class="page-item ${this.currentPage === totalPages ? 'disabled' : ''}"><a class="page-link" href="#" data-page="${this.currentPage + 1}"><i class="bi bi-chevron-right"></i></a></li>`;
        html += '</ul></nav>';
        container.innerHTML = html;

        container.querySelectorAll('.page-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = parseInt(e.currentTarget.dataset.page);
                if (page && page !== this.currentPage && page >= 1 && page <= totalPages) {
                    this.currentPage = page;
                    this.loadDevis();
                }
            });
        });
    }

    /**
     * Afficher/masquer l'état vide
     */
    toggleEmptyState(isEmpty) {
        document.getElementById('devisEmpty')?.classList.toggle('d-none', !isEmpty);
        document.getElementById('devisTable')?.classList.toggle('d-none', isEmpty);
        document.getElementById('devisPagination')?.classList.toggle('d-none', isEmpty);
    }

    /**
     * Ouvrir la modale pour nouveau devis
     */
    openModalNouveauDevis() {
        this.devisEnEdition = null;
        this.lignesDevis = [];
        this.resetFormDevis();
        document.getElementById('modalDevisLabel').textContent = 'Nouveau devis';
        document.getElementById('btnDeleteDevis').style.display = 'none';
        document.getElementById('btnDupliquerDevis').style.display = 'none';
        document.getElementById('btnEnvoyerDevis').style.display = 'none';
        document.getElementById('btnTransformerContrat').style.display = 'none';

        // Date du jour
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('devisDateEmission').value = today;
        document.getElementById('devisDateCreation').value = today;
        document.getElementById('devisDateValidite').value = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        // Générer numéro auto
        this.generateNumeroDevis();

        // Réinitialiser les totaux
        this.calculerTotauxDevis();
        this.renderLignesDevis();

        const modal = new bootstrap.Modal(document.getElementById('modalDevis'));
        modal.show();
    }

    /**
     * Ouvrir la modale pour éditer un devis
     */
    async openModalEditionDevis(id) {
        try {
            const devis = await window.api.devis.invoke('get', parseInt(id));
            if (!devis) {
                showToast('Devis non trouvé', 'error');
                return;
            }

            this.devisEnEdition = devis;
            this.lignesDevis = devis.lignes || [];
            this.fillFormDevis(devis);
            document.getElementById('modalDevisLabel').textContent = `Modifier: ${devis.numero}`;
            document.getElementById('btnDeleteDevis').style.display = 'inline-block';
            document.getElementById('btnDeleteDevis').dataset.id = id;
            document.getElementById('btnDupliquerDevis').style.display = 'inline-block';
            document.getElementById('btnEnvoyerDevis').style.display = devis.statut !== 'envoye' ? 'inline-block' : 'none';
            document.getElementById('btnTransformerContrat').style.display = ['brouillon', 'envoye', 'accepte'].includes(devis.statut) ? 'inline-block' : 'none';

            this.renderLignesDevis();
            this.calculerTotauxDevis();

            const modal = new bootstrap.Modal(document.getElementById('modalDevis'));
            modal.show();
        } catch (error) {
            console.error('Erreur chargement devis:', error);
            showToast('Erreur lors du chargement du devis', 'error');
        }
    }

    /**
     * Voir le détail d'un devis
     */
    async viewDevis(id) {
        try {
            const devis = await window.api.devis.invoke('get', parseInt(id));
            if (!devis) {
                showToast('Devis non trouvé', 'error');
                return;
            }

            this.renderDevisDetail(devis);
            const modal = new bootstrap.Modal(document.getElementById('modalDevisDetail'));
            modal.show();
        } catch (error) {
            console.error('Erreur chargement détail:', error);
            showToast('Erreur lors du chargement du détail', 'error');
        }
    }

    /**
     * Rendre le détail du devis
     */
    renderDevisDetail(d) {
        const container = document.getElementById('devisDetailContent');
        if (!container) return;

        const statutClass = {
            'brouillon': 'bg-secondary',
            'envoye': 'bg-info',
            'accepte': 'bg-success',
            'refuse': 'bg-danger',
            'expire': 'bg-warning text-dark',
            'transforme': 'bg-primary'
        }[d.statut] || 'bg-secondary';

        const statutLabel = {
            'brouillon': 'Brouillon',
            'envoye': 'Envoyé',
            'accepte': 'Accepté',
            'refuse': 'Refusé',
            'expire': 'Expiré',
            'transforme': 'Transformé'
        }[d.statut] || d.statut;

        const clientNom = d.client ? (d.client.type === 'entreprise' ? d.client.entreprise : `${d.client.prenom} ${d.client.nom}`.trim()) : '—';

        container.innerHTML = `
            <div class="row g-4">
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-body text-center">
                            <div class="mb-3">
                                <span class="badge ${statutClass} fs-6">${statutLabel}</span>
                            </div>
                            <h4>${this.escapeHtml(d.numero)}</h4>
                            <p class="text-secondary">${this.escapeHtml(d.objet || '—')}</p>
                            <hr>
                            <div class="text-start small">
                                <div><strong>Client:</strong> ${this.escapeHtml(clientNom)}</div>
                                <div><strong>Chantier:</strong> ${this.escapeHtml(d.chantier?.nom || '—')}</div>
                                <div><strong>Date émission:</strong> ${this.formatDate(d.dateEmission)}</div>
                                <div><strong>Validité:</strong> ${d.dateValidite ? this.formatDate(d.dateValidite) : '—'}</div>
                                <div><strong>Cond. paiement:</strong> ${this.escapeHtml(d.conditionsPaiement || '—')}</div>
                                <div><strong>Mode paiement:</strong> ${this.escapeHtml(d.modePaiement || '—')}</div>
                                <div><strong>Acompte:</strong> ${d.acomptePourcent || 0}%</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-8">
                    <div class="card mb-3">
                        <div class="card-header"><h6 class="mb-0"><i class="bi bi-list-ul me-2"></i>Lignes (${d.lignes?.length || 0})</h6></div>
                        <div class="card-body p-0">
                            ${d.lignes && d.lignes.length > 0 ? `
                                <div class="table-responsive">
                                    <table class="table table-sm mb-0">
                                        <thead class="table-light">
                                            <tr><th>Description</th><th class="text-end">Qté</th><th class="text-end">PU HT</th><th class="text-end">Remise</th><th class="text-end">TVA</th><th class="text-end">Total HT</th></tr>
                                        </thead>
                                        <tbody>
                                            ${d.lignes.map(l => `
                                                <tr>
                                                    <td>${this.escapeHtml(l.description)}</td>
                                                    <td class="text-end">${l.quantite} ${this.escapeHtml(l.unite || '')}</td>
                                                    <td class="text-end">${this.formatCurrency(l.prixUnitaire)}</td>
                                                    <td class="text-end">${l.remise || 0}%</td>
                                                    <td class="text-end">${l.tauxTVA || 20}%</td>
                                                    <td class="text-end fw-semibold">${this.formatCurrency(l.totalHT || 0)}</td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            ` : '<div class="text-center py-3 text-secondary">Aucune ligne</div>'}
                        </div>
                    </div>

                    <div class="card mb-3">
                        <div class="card-header"><h6 class="mb-0"><i class="bi bi-calculator me-2"></i>Totaux</h6></div>
                        <div class="card-body">
                            <div class="row g-2">
                                <div class="col-md-3"><small class="text-secondary">Total HT</small><div class="fw-bold text-primary">${this.formatCurrency(d.montantHT || 0)}</div></div>
                                <div class="col-md-3"><small class="text-secondary">TVA</small><div class="fw-bold text-info">${this.formatCurrency(d.montantTVA || 0)}</div></div>
                                <div class="col-md-3"><small class="text-secondary">Total TTC</small><div class="fw-bold text-success fs-5">${this.formatCurrency(d.montantTTC || 0)}</div></div>
                                <div class="col-md-3"><small class="text-secondary">Acompte (${d.acomptePourcent || 0}%)</small><div class="fw-bold text-warning">${this.formatCurrency((d.montantTTC || 0) * (d.acomptePourcent || 0) / 100)}</div></div>
                            </div>
                        </div>
                    </div>

                    ${d.notes ? `
                    <div class="card mb-3">
                        <div class="card-header"><h6 class="mb-0"><i class="bi bi-sticky me-2"></i>Notes</h6></div>
                        <div class="card-body"><p class="mb-0">${this.escapeHtml(d.notes)}</p></div>
                    </div>
                    ` : ''}

                    ${d.conditionsGenerales ? `
                    <div class="card">
                        <div class="card-header"><h6 class="mb-0"><i class="bi bi-file-earmark-text me-2"></i>Conditions générales</h6></div>
                        <div class="card-body"><p class="mb-0 small">${this.escapeHtml(d.conditionsGenerales)}</p></div>
                    </div>
                    ` : ''}

                    <div class="d-flex gap-2">
                        <button class="btn btn-outline-primary" onclick="window.devisController.openModalEditionDevis(${d.id}); bootstrap.Modal.getInstance(document.getElementById('modalDevisDetail'))?.hide();">
                            <i class="bi bi-pencil me-1"></i>Modifier
                        </button>
                        <button class="btn btn-outline-success" onclick="window.devisController.dupliquerDevis(${d.id}); bootstrap.Modal.getInstance(document.getElementById('modalDevisDetail'))?.hide();">
                            <i class="bi bi-files me-1"></i>Dupliquer
                        </button>
                        ${['brouillon', 'envoye', 'accepte'].includes(d.statut) ? `
                        <button class="btn btn-warning" onclick="window.devisController.transformerEnContrat(${d.id}); bootstrap.Modal.getInstance(document.getElementById('modalDevisDetail'))?.hide();">
                            <i class="bi bi-arrow-right-circle me-1"></i>Transformer en contrat
                        </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Réinitialiser le formulaire devis
     */
    resetFormDevis() {
        const form = document.getElementById('formDevis');
        if (form) form.reset();
        document.getElementById('devisId').value = '';
        const entrepriseId = window.AppState?.entreprise?.id || 1;
        document.getElementById('devisEntrepriseId').value = entrepriseId;
        document.getElementById('devisClientId').value = '';
        document.getElementById('devisStatut').value = 'brouillon';
        document.getElementById('devisTVA').value = '20';
        document.getElementById('devisCondPaiement').value = '30 jours';
        document.getElementById('devisModePaiement').value = 'virement';
        document.getElementById('devisAcompte').value = '0';

        // Lignes
        this.lignesDevis = [];
        this.renderLignesDevis();
    }

    /**
     * Générer un numéro de devis automatique
     */
    async generateNumeroDevis() {
        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;
            const year = new Date().getFullYear();
            const result = await window.api.devis.invoke('list', { entrepriseId, limit: 1, search: `DEV-${year}` });
            const nextNum = (result.items?.length || 0) + 1;
            document.getElementById('devisNumero').value = `DEV-${year}-${String(nextNum).padStart(5, '0')}`;
        } catch (error) {
            document.getElementById('devisNumero').value = `DEV-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
        }
    }

    /**
     * Remplir le formulaire avec les données du devis
     */
    fillFormDevis(d) {
        document.getElementById('devisId').value = d.id;
        document.getElementById('devisEntrepriseId').value = d.entrepriseId || window.AppState?.entreprise?.id || 1;
        document.getElementById('devisNumero').value = d.numero || '';
        document.getElementById('devisReference').value = d.reference || '';
        document.getElementById('devisDateCreation').value = d.dateCreation || '';
        document.getElementById('devisClient').value = d.clientId || '';
        document.getElementById('devisChantier').value = d.chantierId || '';
        document.getElementById('devisDateEmission').value = d.dateEmission || '';
        document.getElementById('devisDateValidite').value = d.dateValidite || '';
        document.getElementById('devisStatut').value = d.statut || 'brouillon';
        document.getElementById('devisTVA').value = d.tva || '20';
        document.getElementById('devisCondPaiement').value = d.conditionsPaiement || '30 jours';
        document.getElementById('devisModePaiement').value = d.modePaiement || 'virement';
        document.getElementById('devisAcompte').value = d.acomptePourcent || '0';
        document.getElementById('devisObjet').value = d.objet || '';
        document.getElementById('devisNotes').value = d.notes || '';
        document.getElementById('devisCondGenerales').value = d.conditionsGenerales || '';
        document.getElementById('devisMentionsLegales').value = d.mentionsLegales || '';
    }

    /**
     * Rendre les lignes du devis
     */
    renderLignesDevis() {
        const container = document.getElementById('devisLignesContainer');
        if (!container) return;

        if (this.lignesDevis.length === 0) {
            container.innerHTML = '<p class="text-secondary text-center py-3">Aucune ligne. Cliquez sur "Ajouter une ligne".</p>';
            return;
        }

        container.innerHTML = this.lignesDevis.map((l, index) => `
            <div class="card mb-2 ligne-item" data-index="${index}">
                <div class="card-body py-2">
                    <div class="row g-2 align-items-center">
                        <div class="col-auto">
                            <span class="badge bg-secondary">${index + 1}</span>
                        </div>
                        <div class="col">
                            <strong>${this.escapeHtml(l.description)}</strong>
                        </div>
                        <div class="col-auto">
                            <small class="text-secondary">${l.quantite} ${this.escapeHtml(l.unite || '')} × ${this.formatCurrency(l.prixUnitaire)}</small>
                        </div>
                        <div class="col-auto">
                            <small class="text-secondary">${l.remise || 0}% remise</small>
                        </div>
                        <div class="col-auto">
                            <small class="text-secondary">${l.tauxTVA || 20}% TVA</small>
                        </div>
                        <div class="col-auto">
                            <strong class="text-primary">${this.formatCurrency(l.totalHT || 0)}</strong>
                        </div>
                        <div class="col-auto">
                            <button type="button" class="btn btn-sm btn-outline-primary btn-edit-ligne" data-index="${index}" data-permission="devis:update">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button type="button" class="btn btn-sm btn-outline-danger btn-delete-ligne" data-index="${index}" data-permission="devis:delete">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        // Binder les actions
        container.querySelectorAll('.btn-edit-ligne').forEach(btn => {
            btn.addEventListener('click', (e) => this.editLigneDevis(parseInt(e.currentTarget.dataset.index)));
        });
        container.querySelectorAll('.btn-delete-ligne').forEach(btn => {
            btn.addEventListener('click', (e) => this.deleteLigneDevis(parseInt(e.currentTarget.dataset.index)));
        });
    }

    /**
     * Ouvrir la modale pour ajouter une ligne
     */
    openModalLigneDevis(ligne = null, index = null) {
        const form = document.getElementById('formLigneDevis');
        if (form) form.reset();

        document.getElementById('ligneId').value = ligne?.id || '';
        document.getElementById('ligneDevisId').value = this.devisEnEdition?.id || '';
        document.getElementById('ligneQuantite').value = ligne?.quantite || 1;
        document.getElementById('ligneRemise').value = ligne?.remise || 0;
        document.getElementById('ligneTauxTVA').value = ligne?.tauxTVA || 20;

        if (ligne) {
            document.getElementById('ligneType').value = ligne.type || 'article';
            document.getElementById('ligneArticle').value = ligne.articleId || '';
            document.getElementById('ligneDescription').value = ligne.description || '';
            document.getElementById('ligneUnite').value = ligne.unite || 'unité';
            document.getElementById('lignePrixUnitaire').value = ligne.prixUnitaire || 0;
            document.getElementById('modalLigneDevisLabel').innerHTML = '<i class="bi bi-pencil me-2"></i>Modifier la ligne';
        } else {
            document.getElementById('ligneType').value = 'article';
            document.getElementById('modalLigneDevisLabel').innerHTML = '<i class="bi bi-plus me-2"></i>Nouvelle ligne';
        }

        this.calculerLigne();

        const modal = new bootstrap.Modal(document.getElementById('modalLigneDevis'));
        modal.show();

        // Stocker l'index en cours d'édition
        this.ligneEnEditionIndex = index;
    }

    /**
     * Gérer la soumission du formulaire ligne
     */
    handleSubmitLigneDevis(e) {
        e.preventDefault();

        const form = e.target;
        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            return;
        }

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        data.quantite = parseFloat(data.quantite) || 0;
        data.prixUnitaire = parseFloat(data.prixUnitaire) || 0;
        data.remise = parseFloat(data.remise) || 0;
        data.tauxTVA = parseFloat(data.tauxTVA) || 20;
        data.totalHT = parseFloat(data.totalHT) || 0;
        data.totalTTC = parseFloat(data.totalTTC) || 0;
        data.articleId = parseInt(data.articleId) || null;

        if (this.ligneEnEditionIndex !== null && this.ligneEnEditionIndex >= 0) {
            // Modification
            this.lignesDevis[this.ligneEnEditionIndex] = data;
        } else {
            // Ajout
            this.lignesDevis.push(data);
        }

        this.renderLignesDevis();
        this.calculerTotauxDevis();

        bootstrap.Modal.getInstance(document.getElementById('modalLigneDevis'))?.hide();
        this.ligneEnEditionIndex = null;
    }

    /**
     * Modifier une ligne
     */
    editLigneDevis(index) {
        const ligne = this.lignesDevis[index];
        if (ligne) {
            this.openModalLigneDevis(ligne, index);
        }
    }

    /**
     * Supprimer une ligne
     */
    deleteLigneDevis(index) {
        if (confirm('Supprimer cette ligne ?')) {
            this.lignesDevis.splice(index, 1);
            this.renderLignesDevis();
            this.calculerTotauxDevis();
        }
    }

    /**
     * Gérer la soumission du formulaire devis
     */
    async handleSubmitDevis(e) {
        e.preventDefault();

        const form = e.target;
        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            return;
        }

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        const entrepriseId = window.AppState?.entreprise?.id || 1;

        data.tva = parseFloat(data.tva) || 20;
        data.acomptePourcent = parseFloat(data.acomptePourcent) || 0;
        data.clientId = parseInt(data.clientId) || null;
        data.chantierId = parseInt(data.chantierId) || null;
        data.entrepriseId = entrepriseId;
        data.lignes = this.lignesDevis;

        // Ajouter les totaux calculés
        if (this.devisTotaux) {
            data.montantHT = this.devisTotaux.totalHT;
            data.montantTVA = this.devisTotaux.totalTVA;
            data.montantTTC = this.devisTotaux.totalTTC;
        }

        const entrepriseId = window.AppState?.entreprise?.id || 1;
        const isEdit = !!data.id;
        delete data.id;

        try {
            if (isEdit) {
                await window.api.devis.invoke('update', parseInt(formData.get('id')), data);
                showToast('Devis modifié avec succès', 'success');
            } else {
                await window.api.devis.invoke('create', data, entrepriseId);
                showToast('Devis créé avec succès', 'success');
            }

            bootstrap.Modal.getInstance(document.getElementById('modalDevis'))?.hide();
            await this.loadDevis();

        } catch (error) {
            console.error('Erreur sauvegarde devis:', error);
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    /**
     * Dupliquer un devis
     */
    async dupliquerDevis(id) {
        const devisId = id || this.devisEnEdition?.id;
        if (!devisId) return;

        try {
            const devis = await window.api.devis.invoke('get', parseInt(devisId));
            if (!devis) {
                showToast('Devis non trouvé', 'error');
                return;
            }

            // Créer un nouveau devis basé sur l'existant
            this.devisEnEdition = null;
            this.lignesDevis = (devis.lignes || []).map(l => ({ ...l, id: undefined }));
            this.resetFormDevis();
            document.getElementById('modalDevisLabel').textContent = 'Nouveau devis (copie)';
            document.getElementById('btnDeleteDevis').style.display = 'none';
            document.getElementById('btnDupliquerDevis').style.display = 'none';
            document.getElementById('btnEnvoyerDevis').style.display = 'none';
            document.getElementById('btnTransformerContrat').style.display = 'none';

            // Remplir avec les données du devis source
            this.fillFormDevis(devis);
            document.getElementById('devisId').value = ''; // Réinitialiser pour la duplication
            document.getElementById('devisNumero').value = ''; // Sera généré
            document.getElementById('devisStatut').value = 'brouillon';
            document.getElementById('devisDateEmission').value = new Date().toISOString().split('T')[0];
            document.getElementById('devisDateCreation').value = new Date().toISOString().split('T')[0];
            document.getElementById('devisDateValidite').value = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

            this.renderLignesDevis();
            this.calculerTotauxDevis();

            const modal = new bootstrap.Modal(document.getElementById('modalDevis'));
            modal.show();

        } catch (error) {
            console.error('Erreur duplication:', error);
            showToast('Erreur lors de la duplication', 'error');
        }
    }

    /**
     * Envoyer un devis par email
     */
    async envoyerDevis(id) {
        const devisId = id || this.devisEnEdition?.id;
        if (!devisId) return;

        // TODO: Implémenter envoi email
        showToast('Envoi par email à implémenter', 'info');
    }

    /**
     * Transformer un devis en contrat
     */
    async transformerEnContrat(id) {
        const devisId = id || this.devisEnEdition?.id;
        if (!devisId) return;

        if (!confirm('Transformer ce devis en contrat ?')) return;

        try {
            // Ouvrir la modale contrat avec les données du devis
            const devis = await window.api.devis.invoke('get', parseInt(devisId));
            if (!devis) {
                showToast('Devis non trouvé', 'error');
                return;
            }

            this.openModalNouveauContrat(devis);

            // Fermer la modale devis si ouverte
            bootstrap.Modal.getInstance(document.getElementById('modalDevis'))?.hide();
            bootstrap.Modal.getInstance(document.getElementById('modalDevisDetail'))?.hide();

        } catch (error) {
            console.error('Erreur transformation:', error);
            showToast('Erreur lors de la transformation', 'error');
        }
    }

    /**
     * Confirmer la suppression
     */
    confirmDeleteDevis(id) {
        const devisId = id || document.getElementById('btnDeleteDevis')?.dataset.id;
        if (!devisId) return;

        this.devisEnEdition = { id: parseInt(devisId) };
        document.getElementById('deleteDevisName').textContent = 'ce devis';

        bootstrap.Modal.getInstance(document.getElementById('modalDevis'))?.hide();
        bootstrap.Modal.getInstance(document.getElementById('modalDevisDetail'))?.hide();

        setTimeout(() => {
            new bootstrap.Modal(document.getElementById('modalConfirmDeleteDevis')).show();
        }, 300);
    }

    /**
     * Exécuter la suppression
     */
    async executeDeleteDevis() {
        if (!this.devisEnEdition?.id) return;

        try {
            await window.api.devis.invoke('delete', this.devisEnEdition.id);
            showToast('Devis supprimé', 'success');

            bootstrap.Modal.getInstance(document.getElementById('modalConfirmDeleteDevis'))?.hide();
            await this.loadDevis();

        } catch (error) {
            console.error('Erreur suppression:', error);
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    /**
     * Exporter les devis
     */
    async exportDevis() {
        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;
            const result = await window.api.devis.invoke('list', {
                entrepriseId,
                limit: 10000
            });

            const headers = ['Numéro', 'Client', 'Chantier', 'Date émission', 'Validité', 'Montant HT', 'Montant TTC', 'Statut'];
            const rows = result.items.map(d => [
                d.numero,
                d.client ? (d.client.type === 'entreprise' ? d.client.entreprise : `${d.client.prenom} ${d.client.nom}`.trim()) : '',
                d.chantier?.nom || '',
                d.dateEmission,
                d.dateValidite || '',
                d.montantHT || 0,
                d.montantTTC || 0,
                d.statut
            ]);

            const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `devis_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();

            showToast('Export terminé', 'success');
        } catch (error) {
            console.error('Erreur export:', error);
            showToast('Erreur lors de l\'export', 'error');
        }
    }

    // ==================== CONTRATS ====================

    /**
     * Charger la liste des contrats
     */
    async loadContrats() {
        this.showLoaderContrats(true);

        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;

            const result = await window.api.contrats.invoke('list', {
                entrepriseId, limit: 1000, offset: 0
            });

            const res = result?.success === false ? null : (result?.data || result);
            this.totalItems = res?.total || 0;
            const items = res?.items || [];

            this.renderContratsTable(items);
            this.renderContratsPagination();

        } catch (error) {
            console.error('Erreur chargement contrats:', error);
            showToast('Erreur lors du chargement des contrats', 'error');
        } finally {
            this.showLoaderContrats(false);
        }
    }

    /**
     * Afficher les contrats dans le tableau
     */
    renderContratsTable(contrats) {
        const tbody = document.getElementById('contratsTbody');
        if (!tbody) return;

        if (contrats.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-secondary">Aucun contrat</td></tr>';
            return;
        }

        tbody.innerHTML = contrats.map((c, index) => {
            const statutClass = {
                'signe': 'bg-primary',
                'en_cours': 'bg-info',
                'termine': 'bg-success',
                'resilie': 'bg-danger'
            }[c.statut] || 'bg-secondary';

            const clientNom = c.clientEntreprise
                ? c.clientEntreprise
                : `${(c.clientPrenom || '').trim()} ${this.escapeHtml(c.clientNom || '')}`.trim();

            return `
                <tr data-id="${c.id}">
                    <td>${(this.currentPage - 1) * this.pageSize + index + 1}</td>
                    <td>${this.escapeHtml(c.reference || c.numero || `CTR-${c.id}`)}</td>
                    <td>${c.devisNumero || c.devisReference || '—'}</td>
                    <td>${clientNom || '—'}</td>
                    <td class="d-none d-md-table-cell"><small>${c.dateSignature ? this.formatDate(c.dateSignature) : '—'}</small></td>
                    <td class="d-none d-lg-table-cell">${this.formatCurrency(c.montantTTC || 0)}</td>
                    <td><span class="badge ${statutClass}">${c.statut || '—'}</span></td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-secondary btn-view" data-id="${c.id}" title="Voir">
                                <i class="bi bi-eye"></i>
                            </button>
                            <button class="btn btn-outline-primary btn-edit" data-id="${c.id}" title="Modifier" data-permission="contrats:update">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-outline-danger btn-delete" data-id="${c.id}" title="Supprimer" data-permission="contrats:delete">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => this.openModalEditionContrat(e.currentTarget.dataset.id));
        });
        tbody.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => this.confirmDeleteContrat(e.currentTarget.dataset.id));
        });
    }

    /**
     * Pagination contrats
     */
    renderContratsPagination() {
        const container = document.getElementById('contratsPagination');
        if (!container) return;

        const totalPages = Math.ceil(this.totalItems / this.pageSize);
        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let html = '<nav><ul class="pagination pagination-sm mb-0">';
        html += `<li class="page-item ${this.currentPage === 1 ? 'disabled' : ''}"><a class="page-link" href="#" data-page="${this.currentPage - 1}"><i class="bi bi-chevron-left"></i></a></li>`;

        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(totalPages, this.currentPage + 2);
        for (let i = startPage; i <= endPage; i++) {
            html += `<li class="page-item ${i === this.currentPage ? 'active' : ''}"><a class="page-link" href="#" data-page="${i}">${i}</a></li>`;
        }

        html += `<li class="page-item ${this.currentPage === totalPages ? 'disabled' : ''}"><a class="page-link" href="#" data-page="${this.currentPage + 1}"><i class="bi bi-chevron-right"></i></a></li>`;
        html += '</ul></nav>';
        container.innerHTML = html;

        container.querySelectorAll('.page-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = parseInt(e.currentTarget.dataset.page);
                if (page && page !== this.currentPage && page >= 1 && page <= totalPages) {
                    this.currentPage = page;
                    this.loadContrats();
                }
            });
        });
    }

    /**
     * Ouvrir la modale pour nouveau contrat
     */
    openModalNouveauContrat(devisSource = null) {
        this.devisEnEdition = devisSource || null;
        this.resetFormContrat();
        document.getElementById('modalContratLabel').textContent = devisSource ? 'Nouveau contrat (depuis devis)' : 'Nouveau contrat';
        document.getElementById('btnDeleteContrat').style.display = 'none';

        const entrepriseId = window.AppState?.entreprise?.id || 1;
        document.getElementById('contratEntrepriseId').value = entrepriseId;
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('contratDateSignature').value = today;

        if (devisSource) {
            document.getElementById('contratDevisId').value = devisSource.id;
            document.getElementById('contratMontant').value = devisSource.montantHT || 0;
            document.getElementById('contratTVA').value = devisSource.montantTVA || 0;
            document.getElementById('contratMontantTTC').value = devisSource.montantTTC || 0;
            document.getElementById('contratDateDebut').value = devisSource.dateDebut || '';
            document.getElementById('contratDateFin').value = devisSource.dateFinPrevue || '';
            document.getElementById('contratConditions').value = devisSource.conditionsGenerales || '';

            // Générer numéro contrat
            this.generateNumeroContrat();
        }

        const modal = new bootstrap.Modal(document.getElementById('modalContrat'));
        modal.show();
    }

    /**
     * Ouvrir la modale pour éditer un contrat
     */
    async openModalEditionContrat(id) {
        try {
            const result = await window.api.contrats.invoke('get', parseInt(id));
            if (result?.success === false) {
                throw new Error(result?.error || 'Contrat non trouvé');
            }
            const c = result?.data || result;
            if (!c || !c.id) {
                showToast('Contrat non trouvé', 'error');
                return;
            }

            this.contratEnEdition = c;
            document.getElementById('contratId').value = c.id;
            document.getElementById('contratEntrepriseId').value = c.entrepriseId || window.AppState?.entreprise?.id || 1;
            document.getElementById('contratNumero').value = c.reference || c.numero || '';
            document.getElementById('contratDevisId').value = c.devisId || '';
            document.getElementById('contratMontant').value = c.montantHT || c.montant || '';
            document.getElementById('contratTVA').value = c.tva || '';
            document.getElementById('contratMontantTTC').value = c.montantTTC || c.montant || '';
            document.getElementById('contratDateDebut').value = c.dateDebut ? c.dateDebut.split('T')[0] : '';
            document.getElementById('contratDateFin').value = c.dateFin ? c.dateFin.split('T')[0] : '';
            document.getElementById('contratDateSignature').value = c.dateSignature ? c.dateSignature.split('T')[0] : '';
            document.getElementById('contratStatut').value = c.statut || 'signe';
            document.getElementById('contratAcompte').value = c.acompteVerse || '0';
            document.getElementById('contratConditions').value = c.conditionsPaiement || c.conditions || '';
            document.getElementById('contratObjet').value = c.objet || '';
            document.getElementById('contratNotes').value = c.notes || '';

            document.getElementById('modalContratLabel').textContent = `Modifier: ${c.reference || c.numero || `CTR-${c.id}`}`;
            document.getElementById('btnDeleteContrat').style.display = 'inline-block';

            const elObjet = document.getElementById('contratObjet');
            if (elObjet) elObjet.value = c.objet || '';
            const elNotes = document.getElementById('contratNotes');
            if (elNotes) elNotes.value = c.notes || '';

            new bootstrap.Modal(document.getElementById('modalContrat')).show();
        } catch (error) {
            console.error('Erreur chargement contrat:', error);
            showToast('Erreur lors du chargement du contrat', 'error');
        }
    }

    /**
     * Réinitialiser le formulaire contrat
     */
    resetFormContrat() {
        const form = document.getElementById('formContrat');
        if (form) form.reset();
        document.getElementById('contratId').value = '';
        document.getElementById('contratDevisId').value = '';
        document.getElementById('contratStatut').value = 'signe';
        document.getElementById('contratAcompte').value = '0';
    }

    /**
     * Générer un numéro de contrat automatique
     */
    async generateNumeroContrat() {
        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;
            const year = new Date().getFullYear();
            // TODO: Implémenter liste contrats
            document.getElementById('contratNumero').value = `CTR-${year}-${String(Date.now()).slice(-5)}`;
        } catch (error) {
            document.getElementById('contratNumero').value = `CTR-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
        }
    }

    /**
     * Gérer la soumission du formulaire contrat
     */
    async handleSubmitContrat(e) {
        e.preventDefault();
        const form = e.target;
        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            return;
        }

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        data.montantHT = parseFloat(data.montantHT) || 0;
        data.tva = parseFloat(data.tva) || 0;
        data.montantTTC = parseFloat(data.montantTTC) || 0;
        data.acompteVerse = parseFloat(data.acompteVerse) || 0;
        data.devisId = parseInt(data.devisId) || null;

        data.reference = data.numero || data.reference;
        data.conditionsPaiement = data.conditionsPaiement || data.conditions;

        const entrepriseId = window.AppState?.entreprise?.id || 1;
        const isEdit = !!data.id;
        const contratId = data.id ? parseInt(data.id) : null;
        delete data.id;

        try {
            let result;
            if (isEdit) {
                result = await window.api.contrats.invoke('update', contratId, data);
            } else {
                result = await window.api.contrats.invoke('create', { ...data, entrepriseId }, entrepriseId);
            }

            if (result?.success === false) {
                throw new Error(result?.error || 'Erreur lors de l\'enregistrement du contrat');
            }

            showToast(`Contrat ${isEdit ? 'modifié' : 'créé'} avec succès`, 'success');

            bootstrap.Modal.getInstance(document.getElementById('modalContrat'))?.hide();
            await this.loadContrats();

        } catch (error) {
            console.error('Erreur sauvegarde contrat:', error);
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    /**
     * Confirmer la suppression contrat
     */
    confirmDeleteContrat(id) {
        const contratId = id || document.getElementById('btnDeleteContrat')?.dataset.id;
        if (!contratId) return;

        this.devisEnEdition = { id: parseInt(contratId), type: 'contrat' };
        document.getElementById('deleteDevisName').textContent = 'ce contrat';

        bootstrap.Modal.getInstance(document.getElementById('modalContrat'))?.hide();

        setTimeout(() => {
            new bootstrap.Modal(document.getElementById('modalConfirmDeleteDevis')).show();
        }, 300);
    }

    /**
     * Afficher/masquer le loader devis
     */
    showLoader(show) {
        const table = document.getElementById('devisTable');
        if (table) {
            table.style.opacity = show ? '0.5' : '1';
            table.style.pointerEvents = show ? 'none' : 'auto';
        }
    }

    /**
     * Afficher/masquer le loader contrats
     */
    showLoaderContrats(show) {
        const table = document.getElementById('contratsTable');
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
window.devisController = new DevisController();