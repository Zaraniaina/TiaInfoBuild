/**
 * Stocks/Articles View Controller
 * Gère les articles, mouvements de stock et fournisseurs
 */

class StocksController {
    constructor() {
        this.currentPage = 1;
        this.pageSize = 20;
        this.totalItems = 0;
        this.filters = {
            search: '',
            categorie: '',
            stockStatus: ''
        };
        this.currentTab = 'articles';
        this.articleEnEdition = null;
        this.fournisseurEnEdition = null;
        this.fournisseursCache = [];
        this.chantiersCache = [];
        this.categoriesCache = [];
    }

    /**
     * Initialiser le contrôleur
     */
    async init() {
        await this.loadFournisseurs();
        await this.loadChantiers();
        await this.loadCategories();
        this.bindEvents();
        await this.loadArticles();
        await this.loadMouvements();
        await this.loadFournisseursList();
    }

    /**
     * Charger les fournisseurs pour les selects
     */
    async loadFournisseurs() {
        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;
            const result = await window.api.fournisseurs.invoke('list', { entrepriseId, limit: 1000 });
            this.fournisseursCache = result.items || [];
            this.populateFournisseurSelects();
        } catch (error) {
            console.error('Erreur chargement fournisseurs:', error);
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
     * Charger les catégories uniques
     */
    async loadCategories() {
        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;
            const result = await window.api.articles.invoke('list', { entrepriseId, limit: 1000 });
            const articles = result.items || [];
            const categories = [...new Set(articles.map(a => a.categorie).filter(Boolean))].sort();
            this.categoriesCache = categories;
            this.populateCategorieFilter();
        } catch (error) {
            console.error('Erreur chargement catégories:', error);
        }
    }

    /**
     * Remplir les selects fournisseurs
     */
    populateFournisseurSelects() {
        const selects = document.querySelectorAll('#artFournisseur, #mouvFournisseur');
        selects.forEach(select => {
            const currentValue = select.value;
            select.innerHTML = '<option value="">Sélectionner</option>';
            this.fournisseursCache.forEach(f => {
                const option = document.createElement('option');
                option.value = f.id;
                option.textContent = f.nom + (f.contact ? ` (${f.contact})` : '');
                select.appendChild(option);
            });
            select.value = currentValue;
        });
    }

    /**
     * Remplir les selects chantiers
     */
    populateChantierSelects() {
        const selects = document.querySelectorAll('#mouvChantier');
        selects.forEach(select => {
            const currentValue = select.value;
            select.innerHTML = '<option value="">Sélectionner</option>';
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
     * Remplir le filtre catégorie
     */
    populateCategorieFilter() {
        const select = document.getElementById('filterCategorie');
        if (!select) return;
        const currentValue = select.value;
        select.innerHTML = '<option value="">Toutes les catégories</option>';
        this.categoriesCache.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            select.appendChild(option);
        });
        select.value = currentValue;
    }

    /**
     * Lier les événements UI
     */
    bindEvents() {
        // Onglets
        document.querySelectorAll('#stocksTabs button[data-bs-toggle="tab"]').forEach(btn => {
            btn.addEventListener('shown.bs.tab', (e) => {
                this.currentTab = e.target.id.replace('tab-', '').replace('-tab', '');
                if (this.currentTab === 'articles') this.loadArticles();
                else if (this.currentTab === 'mouvements') this.loadMouvements();
                else if (this.currentTab === 'fournisseurs') this.loadFournisseursList();
            });
        });

        // Recherche articles
        const searchInput = document.getElementById('searchArticle');
        if (searchInput) {
            let debounceTimer;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.filters.search = e.target.value;
                    this.currentPage = 1;
                    this.loadArticles();
                }, 300);
            });
        }

        // Filtres
        document.getElementById('filterCategorie')?.addEventListener('change', (e) => {
            this.filters.categorie = e.target.value;
            this.currentPage = 1;
            this.loadArticles();
        });
        document.getElementById('filterStockStatus')?.addEventListener('change', (e) => {
            this.filters.stockStatus = e.target.value;
            this.currentPage = 1;
            this.loadArticles();
        });

        // Boutons articles
        document.getElementById('btnNouvelArticle')?.addEventListener('click', () => this.openModalNouvelArticle());
        document.getElementById('btnFirstArticle')?.addEventListener('click', () => this.openModalNouvelArticle());
        document.getElementById('btnRefreshArticles')?.addEventListener('click', () => this.loadArticles());
        document.getElementById('btnExportArticles')?.addEventListener('click', () => this.exportArticles());
        document.getElementById('btnVoirAlertesStock')?.addEventListener('click', () => {
            this.filters.stockStatus = 'alerte';
            document.getElementById('filterStockStatus').value = 'alerte';
            this.currentPage = 1;
            this.loadArticles();
        });

        // Formulaire article
        document.getElementById('formArticle')?.addEventListener('submit', (e) => this.handleSubmitArticle(e));
        document.getElementById('btnDeleteArticle')?.addEventListener('click', () => this.confirmDeleteArticle());

        // Calcul marge auto
        document.getElementById('artPrixAchat')?.addEventListener('input', () => this.calculerMarge());
        document.getElementById('artPrixVente')?.addEventListener('input', () => this.calculerMarge());

        // Mouvements
        document.getElementById('btnRefreshMouvements')?.addEventListener('click', () => this.loadMouvements());
        document.getElementById('mouvDateDebut')?.addEventListener('change', () => this.loadMouvements());
        document.getElementById('mouvDateFin')?.addEventListener('change', () => this.loadMouvements());
        document.getElementById('mouvTypeFilter')?.addEventListener('change', () => this.loadMouvements());
        document.getElementById('btnNouveauMouvement')?.addEventListener('click', () => this.openModalNouveauMouvement());
        document.getElementById('formMouvement')?.addEventListener('submit', (e) => this.handleSubmitMouvement(e));

        // Fournisseurs
        document.getElementById('btnNouveauFournisseur')?.addEventListener('click', () => this.openModalNouveauFournisseur());
        document.getElementById('formFournisseur')?.addEventListener('submit', (e) => this.handleSubmitFournisseur(e));
        document.getElementById('btnDeleteFournisseur')?.addEventListener('click', () => this.confirmDeleteFournisseur());
        document.getElementById('btnConfirmDeleteStock')?.addEventListener('click', () => this.executeDeleteStock());

        // Détail article
        document.getElementById('btnEditArticleFromDetail')?.addEventListener('click', () => {
            const modalDetail = bootstrap.Modal.getInstance(document.getElementById('modalArticleDetail'));
            modalDetail?.hide();
            setTimeout(() => this.openModalEditionArticle(this.articleEnEdition?.id), 300);
        });
    }

    /**
     * Calculer la marge automatiquement
     */
    calculerMarge() {
        const prixAchat = parseFloat(document.getElementById('artPrixAchat')?.value) || 0;
        const prixVente = parseFloat(document.getElementById('artPrixVente')?.value) || 0;
        const margeInput = document.getElementById('artMarge');

        if (prixAchat > 0 && prixVente > 0) {
            const marge = ((prixVente - prixAchat) / prixAchat) * 100;
            margeInput.value = marge.toFixed(1);
        } else {
            margeInput.value = '';
        }
    }

    // ==================== ARTICLES ====================

    /**
     * Charger la liste des articles
     */
    async loadArticles() {
        this.showLoader(true);

        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;

            // Construire les filtres pour la recherche
            let searchTerm = this.filters.search;
            if (this.filters.categorie) {
                searchTerm += (searchTerm ? ' ' : '') + `categorie:${this.filters.categorie}`;
            }
            if (this.filters.stockStatus === 'alerte') {
                searchTerm += (searchTerm ? ' ' : '') + 'stock:alerte';
            } else if (this.filters.stockStatus === 'rupture') {
                searchTerm += (searchTerm ? ' ' : '') + 'stock:rupture';
            }

            const result = await window.api.articles.invoke('list', {
                entrepriseId,
                limit: this.pageSize,
                offset: (this.currentPage - 1) * this.pageSize,
                search: searchTerm || undefined
            });

            this.totalItems = result.total || 0;
            this.renderArticlesTable(result.items || []);
            this.renderPagination();
            this.toggleEmptyState(result.items?.length === 0);
            this.updateStockAlerteBanner(result.items || []);

        } catch (error) {
            console.error('Erreur chargement articles:', error);
            showToast('Erreur lors du chargement des articles', 'error');
        } finally {
            this.showLoader(false);
        }
    }

    /**
     * Mettre à jour la bannière d'alerte stock
     */
    updateStockAlerteBanner(articles) {
        const banner = document.getElementById('stockAlerteBanner');
        const countEl = document.getElementById('stockAlerteCount');
        if (!banner || !countEl) return;

        const alertes = articles.filter(a => a.stockActuel <= a.seuilAlerte && a.seuilAlerte > 0).length;
        const ruptures = articles.filter(a => a.stockActuel <= 0).length;
        const total = alertes + ruptures;

        countEl.textContent = total;
        banner.classList.toggle('d-none', total === 0);
    }

    /**
     * Afficher les articles dans le tableau
     */
    renderArticlesTable(articles) {
        const tbody = document.getElementById('articlesTbody');
        if (!tbody) return;

        if (articles.length === 0) {
            tbody.innerHTML = '';
            return;
        }

        tbody.innerHTML = articles.map((a, index) => {
            let stockClass = '';
            let stockBadge = '';
            if (a.stockActuel <= 0) {
                stockClass = 'text-danger fw-bold';
                stockBadge = '<span class="badge bg-danger">Rupture</span>';
            } else if (a.seuilAlerte > 0 && a.stockActuel <= a.seuilAlerte) {
                stockClass = 'text-warning fw-bold';
                stockBadge = '<span class="badge bg-warning text-dark">Alerte</span>';
            } else {
                stockClass = 'text-success';
                stockBadge = '<span class="badge bg-success">OK</span>';
            }

            const marge = a.prixAchat > 0 && a.prixVente > 0
                ? Math.round(((a.prixVente - a.prixAchat) / a.prixAchat) * 100)
                : 0;

            return `
                <tr data-id="${a.id}" class="${a.stockActuel <= 0 ? 'table-danger' : (a.seuilAlerte > 0 && a.stockActuel <= a.seuilAlerte ? 'table-warning' : '')}">
                    <td>${(this.currentPage - 1) * this.pageSize + index + 1}</td>
                    <td>
                        <div class="fw-semibold">${this.escapeHtml(a.nom)}</div>
                        <small class="text-secondary">${this.escapeHtml(a.reference || '')}</small>
                    </td>
                    <td><span class="badge bg-secondary">${this.escapeHtml(a.categorie || '—')}</span></td>
                    <td class="d-none d-md-table-cell">${this.escapeHtml(a.unite || '—')}</td>
                    <td class="d-none d-md-table-cell ${stockClass}">${a.stockActuel} ${this.escapeHtml(a.unite || '')} ${stockBadge}</td>
                    <td class="d-none d-lg-table-cell">${a.seuilAlerte > 0 ? a.seuilAlerte + ' ' + this.escapeHtml(a.unite || '') : '—'}</td>
                    <td class="d-none d-lg-table-cell">${this.formatCurrency(a.prixAchat || 0)}</td>
                    <td class="d-none d-lg-table-cell">${this.formatCurrency(a.prixVente || 0)} <small class="text-secondary">(${marge}%)</small></td>
                    <td>${a.fournisseur ? this.escapeHtml(a.fournisseur.nom) : '—'}</td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-secondary btn-view" data-id="${a.id}" title="Voir">
                                <i class="bi bi-eye"></i>
                            </button>
                            <button class="btn btn-outline-primary btn-edit" data-id="${a.id}" title="Modifier">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-outline-success btn-mouv" data-id="${a.id}" title="Mouvement">
                                <i class="bi bi-arrow-left-right"></i>
                            </button>
                            <button class="btn btn-outline-danger btn-delete" data-id="${a.id}" title="Supprimer">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Binder les actions
        tbody.querySelectorAll('.btn-view').forEach(btn => {
            btn.addEventListener('click', (e) => this.viewArticle(e.currentTarget.dataset.id));
        });
        tbody.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => this.openModalEditionArticle(e.currentTarget.dataset.id));
        });
        tbody.querySelectorAll('.btn-mouv').forEach(btn => {
            btn.addEventListener('click', (e) => this.openModalNouveauMouvement(e.currentTarget.dataset.id));
        });
        tbody.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => this.confirmDeleteArticle(e.currentTarget.dataset.id));
        });
    }

    /**
     * Afficher la pagination
     */
    renderPagination() {
        const container = document.getElementById('articlesPagination');
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
                    this.loadArticles();
                }
            });
        });
    }

    /**
     * Afficher/masquer l'état vide
     */
    toggleEmptyState(isEmpty) {
        document.getElementById('articlesEmpty')?.classList.toggle('d-none', !isEmpty);
        document.getElementById('articlesTable')?.classList.toggle('d-none', isEmpty);
        document.getElementById('articlesPagination')?.classList.toggle('d-none', isEmpty);
    }

    /**
     * Ouvrir la modale pour nouvel article
     */
    openModalNouvelArticle() {
        this.articleEnEdition = null;
        this.resetFormArticle();
        document.getElementById('modalArticleLabel').textContent = 'Nouvel article';
        document.getElementById('btnDeleteArticle').style.display = 'none';

        // Générer référence auto
        this.generateReferenceArticle();

        // Date du jour pour mouvements
        document.getElementById('mouvDate').value = new Date().toISOString().split('T')[0];

        const modal = new bootstrap.Modal(document.getElementById('modalArticle'));
        modal.show();
    }

    /**
     * Ouvrir la modale pour éditer un article
     */
    async openModalEditionArticle(id) {
        try {
            const article = await window.api.articles.invoke('get', parseInt(id));
            if (!article) {
                showToast('Article non trouvé', 'error');
                return;
            }

            this.articleEnEdition = article;
            this.fillFormArticle(article);
            document.getElementById('modalArticleLabel').textContent = `Modifier: ${article.nom}`;
            document.getElementById('btnDeleteArticle').style.display = 'inline-block';
            document.getElementById('btnDeleteArticle').dataset.id = id;

            // Charger les mouvements de l'article
            await this.loadArticleMouvements(article.id);

            const modal = new bootstrap.Modal(document.getElementById('modalArticle'));
            modal.show();
        } catch (error) {
            console.error('Erreur chargement article:', error);
            showToast('Erreur lors du chargement de l\'article', 'error');
        }
    }

    /**
     * Voir le détail d'un article
     */
    async viewArticle(id) {
        try {
            const article = await window.api.articles.invoke('get', parseInt(id));
            if (!article) {
                showToast('Article non trouvé', 'error');
                return;
            }

            this.renderArticleDetail(article);
            const modal = new bootstrap.Modal(document.getElementById('modalArticleDetail'));
            modal.show();
        } catch (error) {
            console.error('Erreur chargement détail:', error);
            showToast('Erreur lors du chargement du détail', 'error');
        }
    }

    /**
     * Rendre le détail de l'article
     */
    renderArticleDetail(a) {
        const container = document.getElementById('articleDetailContent');
        if (!container) return;

        let stockStatus = '';
        if (a.stockActuel <= 0) stockStatus = '<span class="badge bg-danger">Rupture</span>';
        else if (a.seuilAlerte > 0 && a.stockActuel <= a.seuilAlerte) stockStatus = '<span class="badge bg-warning text-dark">Alerte</span>';
        else stockStatus = '<span class="badge bg-success">OK</span>';

        const marge = a.prixAchat > 0 && a.prixVente > 0
            ? Math.round(((a.prixVente - a.prixAchat) / a.prixAchat) * 100)
            : 0;

        container.innerHTML = `
            <div class="row g-4">
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-body text-center">
                            <div class="mb-3">
                                <span class="badge bg-${a.categorie === 'EPI' ? 'danger' : a.categorie === 'Matériaux' ? 'primary' : 'secondary'} fs-6">${this.escapeHtml(a.categorie || '—')}</span>
                            </div>
                            <h4>${this.escapeHtml(a.nom)}</h4>
                            <p class="text-secondary">${this.escapeHtml(a.reference || '')}</p>
                            <p class="text-secondary">${this.escapeHtml(a.description || '—')}</p>
                            <hr>
                            <div class="row g-2 text-start">
                                <div class="col-6"><small class="text-secondary">Unité</small><div>${this.escapeHtml(a.unite || '—')}</div></div>
                                <div class="col-6"><small class="text-secondary">Code-barres</small><div>${this.escapeHtml(a.codeBarre || '—')}</div></div>
                                <div class="col-6"><small class="text-secondary">Emplacement</small><div>${this.escapeHtml(a.emplacement || '—')}</div></div>
                                <div class="col-6"><small class="text-secondary">Poids</small><div>${a.poids ? a.poids + ' kg' : '—'}</div></div>
                                <div class="col-6"><small class="text-secondary">TVA</small><div>${a.tva}%</div></div>
                                <div class="col-6"><small class="text-secondary">Fournisseur</small><div>${a.fournisseur ? this.escapeHtml(a.fournisseur.nom) : '—'}</div></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-8">
                    <div class="card mb-3">
                        <div class="card-header"><h6 class="mb-0"><i class="bi bi-box me-2"></i>Stock & Prix</h6></div>
                        <div class="card-body">
                            <div class="row g-3">
                                <div class="col-md-4">
                                    <div class="text-center p-3 bg-light rounded">
                                        <div class="fs-4 fw-bold ${a.stockActuel <= 0 ? 'text-danger' : (a.seuilAlerte > 0 && a.stockActuel <= a.seuilAlerte ? 'text-warning' : 'text-success')}">${a.stockActuel}</div>
                                        <small class="text-secondary">${this.escapeHtml(a.unite || '')}</small>
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="text-center p-3 bg-light rounded">
                                        <div class="fs-6 text-secondary">Seuil alerte</div>
                                        <div class="fw-bold">${a.seuilAlerte > 0 ? a.seuilAlerte : '—'}</div>
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="text-center p-3 bg-light rounded">
                                        <div class="fs-6 text-secondary">Stock min</div>
                                        <div class="fw-bold">${a.stockMini > 0 ? a.stockMini : '—'}</div>
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <small class="text-secondary">Prix achat</small>
                                    <div class="fw-semibold">${this.formatCurrency(a.prixAchat || 0)}</div>
                                </div>
                                <div class="col-md-4">
                                    <small class="text-secondary">Prix vente</small>
                                    <div class="fw-semibold text-success">${this.formatCurrency(a.prixVente || 0)}</div>
                                </div>
                                <div class="col-md-4">
                                    <small class="text-secondary">Marge</small>
                                    <div class="fw-semibold text-${marge > 30 ? 'success' : marge > 0 ? 'warning' : 'danger'}">${marge}%</div>
                                </div>
                            </div>
                            <hr>
                            <div class="d-flex gap-2">
                                <button class="btn btn-outline-success" onclick="window.stocksController.openModalNouveauMouvement(${a.id}); bootstrap.Modal.getInstance(document.getElementById('modalArticleDetail'))?.hide();">
                                    <i class="bi bi-plus me-1"></i>Nouveau mouvement
                                </button>
                                <button class="btn btn-outline-primary" onclick="window.stocksController.openModalEditionArticle(${a.id}); bootstrap.Modal.getInstance(document.getElementById('modalArticleDetail'))?.hide();">
                                    <i class="bi bi-pencil me-1"></i>Modifier
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Mouvements récents -->
                    <div class="card">
                        <div class="card-header d-flex justify-content-between">
                            <h6 class="mb-0"><i class="bi bi-arrow-left-right me-2"></i>Mouvements récents</h6>
                            <span class="badge bg-secondary">${a.mouvements?.length || 0} mouvements</span>
                        </div>
                        <div class="card-body p-0">
                            ${a.mouvements && a.mouvements.length > 0 ? `
                                <div class="table-responsive">
                                    <table class="table table-sm mb-0">
                                        <thead class="table-light">
                                            <tr><th>Date</th><th>Type</th><th>Qté</th><th>Prix</th><th>Chantier/Fournisseur</th><th>Réf</th></tr>
                                        </thead>
                                        <tbody>
                                            ${a.mouvements.slice(0, 10).map(m => `
                                                <tr>
                                                    <td><small>${this.formatDate(m.dateMouvement)}</small></td>
                                                    <td><span class="badge bg-${m.typeMouvement === 'entree' ? 'success' : m.typeMouvement === 'sortie' ? 'danger' : 'info'}">${m.typeMouvement}</span></td>
                                                    <td><small>${m.quantite} ${this.escapeHtml(a.unite || '')}</small></td>
                                                    <td><small>${m.prixUnitaire ? this.formatCurrency(m.prixUnitaire) : '—'}</small></td>
                                                    <td><small>${m.chantier?.nom || m.fournisseur?.nom || '—'}</small></td>
                                                    <td><small>${this.escapeHtml(m.reference || '—')}</small></td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            ` : '<div class="text-center py-3 text-secondary">Aucun mouvement</div>'}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Réinitialiser le formulaire article
     */
    resetFormArticle() {
        const form = document.getElementById('formArticle');
        if (form) form.reset();
        document.getElementById('articleId').value = '';
        document.getElementById('artUnite').value = 'unité';
        document.getElementById('artTVA').value = '20';
        document.getElementById('artStockActuel').value = '0';
        document.getElementById('artSeuilAlerte').value = '5';
        document.getElementById('artStockMini').value = '0';
        document.getElementById('artPrixAchat').value = '0';
        document.getElementById('artPrixVente').value = '0';
        document.getElementById('artMarge').value = '';

        // Mouvements
        document.getElementById('articleMouvementsContainer').innerHTML = '<p class="text-secondary text-center py-3">Aucun mouvement</p>';
    }

    /**
     * Générer une référence automatique
     */
    async generateReferenceArticle() {
        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;
            const result = await window.api.articles.invoke('list', { entrepriseId, limit: 1 });
            const nextNum = (result.items?.length || 0) + 1;
            document.getElementById('artReference').value = `ART${String(nextNum).padStart(6, '0')}`;
        } catch (error) {
            document.getElementById('artReference').value = `ART${String(Date.now()).slice(-6)}`;
        }
    }

    /**
     * Remplir le formulaire avec les données de l'article
     */
    fillFormArticle(a) {
        document.getElementById('articleId').value = a.id;
        document.getElementById('artReference').value = a.reference || '';
        document.getElementById('artNom').value = a.nom || '';
        document.getElementById('artDescription').value = a.description || '';
        document.getElementById('artCategorie').value = a.categorie || '';
        document.getElementById('artUnite').value = a.unite || 'unité';
        document.getElementById('artFournisseur').value = a.fournisseurId || '';
        document.getElementById('artCodeBarre').value = a.codeBarre || '';
        document.getElementById('artEmplacement').value = a.emplacement || '';

        // Stock & Prix
        document.getElementById('artStockActuel').value = a.stockActuel || '0';
        document.getElementById('artSeuilAlerte').value = a.seuilAlerte || '5';
        document.getElementById('artStockMini').value = a.stockMini || '0';
        document.getElementById('artPrixAchat').value = a.prixAchat || '0';
        document.getElementById('artPrixVente').value = a.prixVente || '0';
        document.getElementById('artTVA').value = a.tva || '20';
        document.getElementById('artPoids').value = a.poids || '';
        this.calculerMarge();
    }

    /**
     * Charger les mouvements d'un article
     */
    async loadArticleMouvements(articleId) {
        const container = document.getElementById('articleMouvementsContainer');
        if (!container) return;

        try {
            const mouvements = await window.api.mouvements.invoke('byArticle', articleId);

            if (!mouvements || mouvements.length === 0) {
                container.innerHTML = '<p class="text-secondary text-center py-3">Aucun mouvement</p>';
                return;
            }

            container.innerHTML = mouvements.slice(0, 10).map(m => `
                <div class="card mb-2">
                    <div class="card-body py-2">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <span class="badge bg-${m.typeMouvement === 'entree' ? 'success' : m.typeMouvement === 'sortie' ? 'danger' : 'info'}">${m.typeMouvement}</span>
                                <strong class="ms-2">${m.quantite} ${this.escapeHtml(m.article?.unite || '')}</strong>
                                ${m.prixUnitaire ? `<span class="text-secondary ms-2">@ ${this.formatCurrency(m.prixUnitaire)}</span>` : ''}
                            </div>
                            <div class="text-end">
                                <small class="text-secondary">${this.formatDate(m.dateMouvement)}</small>
                                ${m.chantier?.nom ? `<br><small class="text-primary">${this.escapeHtml(m.chantier.nom)}</small>` : ''}
                                ${m.fournisseur?.nom ? `<br><small class="text-info">${this.escapeHtml(m.fournisseur.nom)}</small>` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Erreur chargement mouvements article:', error);
            container.innerHTML = '<div class="alert alert-danger">Erreur chargement</div>';
        }
    }

    /**
     * Gérer la soumission du formulaire article
     */
    async handleSubmitArticle(e) {
        e.preventDefault();

        const form = e.target;
        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            return;
        }

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        // Convertir les nombres
        data.stockActuel = parseFloat(data.stockActuel) || 0;
        data.seuilAlerte = parseFloat(data.seuilAlerte) || 0;
        data.stockMini = parseFloat(data.stockMini) || 0;
        data.prixAchat = parseFloat(data.prixAchat) || 0;
        data.prixVente = parseFloat(data.prixVente) || 0;
        data.tva = parseFloat(data.tva) || 20;
        data.poids = parseFloat(data.poids) || 0;
        data.fournisseurId = parseInt(data.fournisseurId) || null;

        const entrepriseId = window.AppState?.entreprise?.id || 1;
        const isEdit = !!data.id;
        delete data.id;

        try {
            if (isEdit) {
                await window.api.articles.invoke('update', parseInt(formData.get('id')), data);
                showToast('Article modifié avec succès', 'success');
            } else {
                await window.api.articles.invoke('create', data, entrepriseId);
                showToast('Article créé avec succès', 'success');
            }

            bootstrap.Modal.getInstance(document.getElementById('modalArticle'))?.hide();
            await this.loadArticles();

        } catch (error) {
            console.error('Erreur sauvegarde article:', error);
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    /**
     * Confirmer la suppression d'un article
     */
    confirmDeleteArticle(id) {
        const articleId = id || document.getElementById('btnDeleteArticle')?.dataset.id;
        if (!articleId) return;

        this.articleEnEdition = { id: parseInt(articleId), type: 'article' };
        document.getElementById('deleteStockItemName').textContent = 'cet article';

        bootstrap.Modal.getInstance(document.getElementById('modalArticle'))?.hide();

        setTimeout(() => {
            new bootstrap.Modal(document.getElementById('modalConfirmDeleteStock')).show();
        }, 300);
    }

    /**
     * Exporter les articles
     */
    async exportArticles() {
        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;
            const result = await window.api.articles.invoke('list', { entrepriseId, limit: 10000 });

            const headers = ['Référence', 'Nom', 'Catégorie', 'Unité', 'Stock', 'Seuil alerte', 'Prix achat', 'Prix vente', 'Marge %', 'Fournisseur'];
            const rows = result.items.map(a => [
                a.reference,
                a.nom,
                a.categorie || '',
                a.unite || '',
                a.stockActuel || 0,
                a.seuilAlerte || 0,
                a.prixAchat || 0,
                a.prixVente || 0,
                a.prixAchat > 0 && a.prixVente > 0 ? Math.round(((a.prixVente - a.prixAchat) / a.prixAchat) * 100) : 0,
                a.fournisseur ? a.fournisseur.nom : ''
            ]);

            const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `articles_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();

            showToast('Export terminé', 'success');
        } catch (error) {
            console.error('Erreur export:', error);
            showToast('Erreur lors de l\'export', 'error');
        }
    }

    // ==================== MOUVEMENTS ====================

    /**
     * Charger les mouvements de stock
     */
    async loadMouvements() {
        const tbody = document.getElementById('mouvementsTbody');
        if (!tbody) return;

        const dateDebut = document.getElementById('mouvDateDebut')?.value;
        const dateFin = document.getElementById('mouvDateFin')?.value;
        const typeFilter = document.getElementById('mouvTypeFilter')?.value;
        const entrepriseId = window.AppState?.entreprise?.id || 1;

        try {
            // Récupérer les articles pour avoir leurs mouvements
            const result = await window.api.articles.invoke('list', { entrepriseId, limit: 100 });

            let allMouvements = [];
            for (const art of result.items || []) {
                const mouvs = await window.api.mouvements.invoke('byArticle', art.id);
                allMouvements.push(...mouvs.map(m => ({ ...m, article: art })));
            }

            // Filtrer
            if (dateDebut) {
                allMouvements = allMouvements.filter(m => m.dateMouvement >= dateDebut);
            }
            if (dateFin) {
                allMouvements = allMouvements.filter(m => m.dateMouvement <= dateFin);
            }
            if (typeFilter) {
                allMouvements = allMouvements.filter(m => m.typeMouvement === typeFilter);
            }

            // Trier par date décroissante
            allMouvements.sort((a, b) => new Date(b.dateMouvement) - new Date(a.dateMouvement));
            allMouvements = allMouvements.slice(0, 200);

            if (allMouvements.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-secondary">Aucun mouvement</td></tr>';
                return;
            }

            tbody.innerHTML = allMouvements.map(m => {
                const typeClass = {
                    'entree': 'bg-success',
                    'sortie': 'bg-danger',
                    'inventaire': 'bg-info',
                    'retour': 'bg-warning text-dark',
                    'perte': 'bg-secondary'
                }[m.typeMouvement] || 'bg-secondary';

                return `
                    <tr>
                        <td>${this.formatDate(m.dateMouvement)}</td>
                        <td><span class="badge ${typeClass}">${m.typeMouvement}</span></td>
                        <td>${this.escapeHtml(m.article?.nom)} <small class="text-secondary">(${this.escapeHtml(m.article?.reference)})</small></td>
                        <td class="${m.typeMouvement === 'entree' ? 'text-success' : 'text-danger'} fw-semibold">
                            ${m.typeMouvement === 'entree' ? '+' : ''}${m.quantite} ${this.escapeHtml(m.article?.unite || '')}
                        </td>
                        <td class="d-none d-md-table-cell">${m.prixUnitaire ? this.formatCurrency(m.prixUnitaire) : '—'}</td>
                        <td class="d-none d-lg-table-cell">
                            ${m.chantier?.nom ? `<span class="text-primary">${this.escapeHtml(m.chantier.nom)}</span>` : ''}
                            ${m.fournisseur?.nom ? `<span class="text-info">${this.escapeHtml(m.fournisseur.nom)}</span>` : ''}
                        </td>
                        <td><small>${this.escapeHtml(m.reference || '—')}</small></td>
                    </tr>
                `;
            }).join('');
        } catch (error) {
            console.error('Erreur chargement mouvements:', error);
            tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-danger">Erreur chargement</td></tr>';
        }
    }

    /**
     * Ouvrir la modale pour nouveau mouvement
     */
    openModalNouveauMouvement(articleId = null) {
        const form = document.getElementById('formMouvement');
        if (form) form.reset();

        document.getElementById('mouvId').value = '';
        document.getElementById('mouvArticleId').value = articleId || '';
        document.getElementById('mouvDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('mouvType').value = articleId ? 'sortie' : 'entree';

        if (articleId) {
            // Pré-sélectionner l'article dans le formulaire (optionnel)
        }

        document.getElementById('modalMouvementLabel').innerHTML = '<i class="bi bi-plus me-2"></i>Nouveau mouvement';

        const modal = new bootstrap.Modal(document.getElementById('modalMouvement'));
        modal.show();
    }

    /**
     * Gérer la soumission du formulaire mouvement
     */
    async handleSubmitMouvement(e) {
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
        data.articleId = parseInt(data.articleId) || this.articleEnEdition?.id;
        data.chantierId = parseInt(data.chantierId) || null;
        data.fournisseurId = parseInt(data.fournisseurId) || null;

        if (!data.articleId) {
            showToast('Veuillez sélectionner un article', 'warning');
            return;
        }

        try {
            // Utiliser la méthode updateStock de l'article pour gérer le mouvement
            await window.api.articles.invoke('updateStock', data.articleId, data.quantite, data.typeMouvement, {
                prixUnitaire: data.prixUnitaire,
                chantierId: data.chantierId,
                fournisseurId: data.fournisseurId,
                reference: data.reference,
                notes: data.notes
            });

            showToast('Mouvement enregistré avec succès', 'success');

            bootstrap.Modal.getInstance(document.getElementById('modalMouvement'))?.hide();

            // Recharger les données
            await this.loadArticles();
            await this.loadMouvements();
            if (this.articleEnEdition) {
                await this.loadArticleMouvements(this.articleEnEdition.id);
            }

        } catch (error) {
            console.error('Erreur sauvegarde mouvement:', error);
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    // ==================== FOURNISSEURS ====================

    /**
     * Charger la liste des fournisseurs
     */
    async loadFournisseursList() {
        this.showLoaderFournisseurs(true);

        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;

            const result = await window.api.fournisseurs.invoke('list', {
                entrepriseId,
                limit: this.pageSize,
                offset: (this.currentPage - 1) * this.pageSize
            });

            this.totalItems = result.total || 0;
            this.renderFournisseursTable(result.items || []);
            this.renderFournisseursPagination();

        } catch (error) {
            console.error('Erreur chargement fournisseurs:', error);
            showToast('Erreur lors du chargement des fournisseurs', 'error');
        } finally {
            this.showLoaderFournisseurs(false);
        }
    }

    /**
     * Afficher les fournisseurs dans le tableau
     */
    renderFournisseursTable(fournisseurs) {
        const tbody = document.getElementById('fournisseursTbody');
        if (!tbody) return;

        if (fournisseurs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-secondary">Aucun fournisseur</td></tr>';
            return;
        }

        tbody.innerHTML = fournisseurs.map((f, index) => `
            <tr data-id="${f.id}">
                <td>${(this.currentPage - 1) * this.pageSize + index + 1}</td>
                <td>
                    <div class="fw-semibold">${this.escapeHtml(f.nom)}</div>
                </td>
                <td>${this.escapeHtml(f.contact || '—')}</td>
                <td class="d-none d-md-table-cell">${this.escapeHtml(f.email || '—')}</td>
                <td class="d-none d-md-table-cell">${this.escapeHtml(f.telephone || '—')}</td>
                <td class="d-none d-lg-table-cell">${this.escapeHtml(f.siret || '—')}</td>
                <td class="d-none d-lg-table-cell">${this.escapeHtml(f.conditionsPaiement || '—')}</td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary btn-edit" data-id="${f.id}" title="Modifier">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-outline-danger btn-delete" data-id="${f.id}" title="Supprimer">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        tbody.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => this.openModalEditionFournisseur(e.currentTarget.dataset.id));
        });
        tbody.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => this.confirmDeleteFournisseur(e.currentTarget.dataset.id));
        });
    }

    /**
     * Pagination fournisseurs
     */
    renderFournisseursPagination() {
        const container = document.getElementById('fournisseursPagination');
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
                    this.loadFournisseursList();
                }
            });
        });
    }

    /**
     * Ouvrir la modale pour nouveau fournisseur
     */
    openModalNouveauFournisseur() {
        this.fournisseurEnEdition = null;
        this.resetFormFournisseur();
        document.getElementById('modalFournisseurLabel').textContent = 'Nouveau fournisseur';
        document.getElementById('btnDeleteFournisseur').style.display = 'none';

        const modal = new bootstrap.Modal(document.getElementById('modalFournisseur'));
        modal.show();
    }

    /**
     * Ouvrir la modale pour éditer un fournisseur
     */
    async openModalEditionFournisseur(id) {
        try {
            const fournisseur = await window.api.fournisseurs.invoke('get', parseInt(id));
            if (!fournisseur) {
                showToast('Fournisseur non trouvé', 'error');
                return;
            }

            this.fournisseurEnEdition = fournisseur;
            this.fillFormFournisseur(fournisseur);
            document.getElementById('modalFournisseurLabel').textContent = `Modifier: ${fournisseur.nom}`;
            document.getElementById('btnDeleteFournisseur').style.display = 'inline-block';
            document.getElementById('btnDeleteFournisseur').dataset.id = id;

            const modal = new bootstrap.Modal(document.getElementById('modalFournisseur'));
            modal.show();
        } catch (error) {
            console.error('Erreur chargement fournisseur:', error);
            showToast('Erreur lors du chargement du fournisseur', 'error');
        }
    }

    /**
     * Réinitialiser le formulaire fournisseur
     */
    resetFormFournisseur() {
        const form = document.getElementById('formFournisseur');
        if (form) form.reset();
        document.getElementById('fournisseurId').value = '';
        document.getElementById('fourPays').value = 'France';
        document.getElementById('fourCondPaiement').value = '30 jours';
    }

    /**
     * Remplir le formulaire fournisseur
     */
    fillFormFournisseur(f) {
        document.getElementById('fournisseurId').value = f.id;
        document.getElementById('fourNom').value = f.nom || '';
        document.getElementById('fourContact').value = f.contact || '';
        document.getElementById('fourEmail').value = f.email || '';
        document.getElementById('fourTelephone').value = f.telephone || '';
        document.getElementById('fourAdresse').value = f.adresse || '';
        document.getElementById('fourCodePostal').value = f.codePostal || '';
        document.getElementById('fourVille').value = f.ville || '';
        document.getElementById('fourPays').value = f.pays || 'France';
        document.getElementById('fourSIRET').value = f.siret || '';
        document.getElementById('fourCondPaiement').value = f.conditionsPaiement || '30 jours';
        document.getElementById('fourNotes').value = f.notes || '';
    }

    /**
     * Gérer la soumission du formulaire fournisseur
     */
    async handleSubmitFournisseur(e) {
        e.preventDefault();

        const form = e.target;
        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            return;
        }

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        const entrepriseId = window.AppState?.entreprise?.id || 1;
        const isEdit = !!data.id;
        delete data.id;

        try {
            if (isEdit) {
                // TODO: Implémenter update fournisseur
                showToast('Modification fournisseur à implémenter', 'info');
            } else {
                await window.api.fournisseurs.invoke('create', data, entrepriseId);
                showToast('Fournisseur créé avec succès', 'success');
            }

            bootstrap.Modal.getInstance(document.getElementById('modalFournisseur'))?.hide();
            await this.loadFournisseursList();
            await this.loadFournisseurs(); // Recharger le cache

        } catch (error) {
            console.error('Erreur sauvegarde fournisseur:', error);
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    /**
     * Confirmer la suppression fournisseur
     */
    confirmDeleteFournisseur(id) {
        const fourId = id || document.getElementById('btnDeleteFournisseur')?.dataset.id;
        if (!fourId) return;

        this.fournisseurEnEdition = { id: parseInt(fourId), type: 'fournisseur' };
        document.getElementById('deleteStockItemName').textContent = 'ce fournisseur';

        bootstrap.Modal.getInstance(document.getElementById('modalFournisseur'))?.hide();

        setTimeout(() => {
            new bootstrap.Modal(document.getElementById('modalConfirmDeleteStock')).show();
        }, 300);
    }

    /**
     * Confirmer la suppression article
     */
    confirmDeleteArticle(id) {
        const articleId = id || document.getElementById('btnDeleteArticle')?.dataset.id;
        if (!articleId) return;

        this.articleEnEdition = { id: parseInt(articleId), type: 'article' };
        document.getElementById('deleteStockItemName').textContent = 'cet article';

        bootstrap.Modal.getInstance(document.getElementById('modalArticle'))?.hide();

        setTimeout(() => {
            new bootstrap.Modal(document.getElementById('modalConfirmDeleteStock')).show();
        }, 300);
    }

    /**
     * Exécuter la suppression (article ou fournisseur)
     */
    async executeDeleteStock() {
        if (!this.articleEnEdition?.id && !this.fournisseurEnEdition?.id) return;

        try {
            if (this.articleEnEdition?.type === 'article') {
                await window.api.articles.invoke('delete', this.articleEnEdition.id);
                showToast('Article supprimé', 'success');
                await this.loadArticles();
            } else if (this.fournisseurEnEdition?.type === 'fournisseur') {
                await window.api.fournisseurs.invoke('delete', this.fournisseurEnEdition.id);
                showToast('Fournisseur supprimé', 'success');
                await this.loadFournisseursList();
                await this.loadFournisseurs();
            }

            bootstrap.Modal.getInstance(document.getElementById('modalConfirmDeleteStock'))?.hide();

        } catch (error) {
            console.error('Erreur suppression:', error);
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    /**
     * Afficher/masquer le loader articles
     */
    showLoader(show) {
        const table = document.getElementById('articlesTable');
        if (table) {
            table.style.opacity = show ? '0.5' : '1';
            table.style.pointerEvents = show ? 'none' : 'auto';
        }
    }

    /**
     * Afficher/masquer le loader fournisseurs
     */
    showLoaderFournisseurs(show) {
        const table = document.getElementById('fournisseursTable');
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
    currency: window.getAppCurrency ? window.getAppCurrency() : 'MGA',
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
window.stocksController = new StocksController();