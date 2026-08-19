/**
 * Finances / Factures View Controller
 * Gère les factures, paiements, dépenses
 */

class FinancesController {
    constructor() {
        this.currentPage = 1;
        this.pageSize = 20;
        this.totalItems = 0;
        this.currentTab = 'factures';
        this.factureEnEdition = null;
        this.filters = {
            search: '',
            statut: '',
            tri: 'dateEmission_desc'
        };
        this.clientsCache = [];
        this.chantiersCache = [];
        this.devisCache = [];
        this.articlesCache = [];
        this.fournisseursCache = [];
        this.employesCache = [];
        this.lignesFacture = [];
        this.paiementsFacture = [];
    }

    /**
     * Initialiser le contrôleur
     */
    async init() {
        await this.loadClients();
        await this.loadChantiers();
        await this.loadDevis();
        await this.loadArticles();
        await this.loadFournisseurs();
        await this.loadEmployes();
        this.bindEvents();
        await this.loadFactures();
        await this.loadPaiements();
        await this.loadDepenses();
        await this.loadKPIs();
    }

    /**
     * Charger les KPIs finances
     */
    async loadKPIs() {
        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;
            const stats = await window.api.dashboard.invoke('stats', entrepriseId);

            document.getElementById('kpiFacturesAttente').textContent = stats.facturesRetard?.count || 0;
            document.getElementById('kpiFacturesRetard').textContent = stats.facturesRetard?.count || 0;
            document.getElementById('kpiCAMois').textContent = this.formatCurrency(stats.caMois || 0);
            document.getElementById('kpiDepensesMois').textContent = this.formatCurrency(stats.depensesMois || 0);
        } catch (error) {
            console.error('Erreur chargement KPIs finances:', error);
        }
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
     * Charger les devis pour les selects
     */
    async loadDevis() {
        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;
            const result = await window.api.devis.invoke('list', { entrepriseId, limit: 1000, statut: 'accepte' });
            this.devisCache = result.items || [];
            this.populateDevisSelects();
        } catch (error) {
            console.error('Erreur chargement devis:', error);
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
     * Charger les fournisseurs pour les dépenses
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
     * Charger les employés pour validation dépenses
     */
    async loadEmployes() {
        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;
            const result = await window.api.employes.invoke('list', { entrepriseId, limit: 1000, statut: 'actif' });
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
        const selects = document.querySelectorAll('#factureClient');
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
        const selects = document.querySelectorAll('#factureChantier, #depenseChantier');
        selects.forEach(select => {
            const currentValue = select.value;
            select.innerHTML = '<option value="">Aucun / Sélectionner</option>';
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
     * Remplir les selects devis
     */
    populateDevisSelects() {
        const selects = document.querySelectorAll('#factureDevis');
        selects.forEach(select => {
            const currentValue = select.value;
            select.innerHTML = '<option value="">Aucun</option>';
            this.devisCache.forEach(d => {
                const option = document.createElement('option');
                option.value = d.id;
                option.textContent = d.numero + (d.client ? ` - ${d.client.type === 'entreprise' ? d.client.entreprise : `${d.client.prenom} ${d.client.nom}`.trim()}` : '');
                select.appendChild(option);
            });
            select.value = currentValue;
        });
    }

    /**
     * Remplir les selects articles
     */
    populateArticleSelects() {
        const selects = document.querySelectorAll('#ligneFactureArticle');
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
     * Remplir les selects fournisseurs
     */
    populateFournisseurSelects() {
        const selects = document.querySelectorAll('#depenseFournisseur');
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
     * Remplir les selects employés
     */
    populateEmployeSelects() {
        const selects = document.querySelectorAll('#depenseValideePar');
        selects.forEach(select => {
            const currentValue = select.value;
            select.innerHTML = '<option value="">En attente</option>';
            this.employesCache.forEach(e => {
                const option = document.createElement('option');
                option.value = e.id;
                option.textContent = `${e.prenom} ${e.nom}`.trim() + (e.poste ? ` - ${e.poste}` : '');
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
        document.querySelectorAll('#financesTabs button[data-bs-toggle="tab"]').forEach(btn => {
            btn.addEventListener('shown.bs.tab', (e) => {
                this.currentTab = e.target.id.replace('tab-', '').replace('-tab', '');
                if (this.currentTab === 'factures') this.loadFactures();
                else if (this.currentTab === 'paiements') this.loadPaiements();
                else if (this.currentTab === 'depenses') this.loadDepenses();
            });
        });

        // Recherche factures
        const searchInput = document.getElementById('searchFacture');
        if (searchInput) {
            let debounceTimer;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.filters.search = e.target.value;
                    this.currentPage = 1;
                    this.loadFactures();
                }, 300);
            });
        }

        // Filtres factures
        document.getElementById('filterStatutFacture')?.addEventListener('change', (e) => {
            this.filters.statut = e.target.value;
            this.currentPage = 1;
            this.loadFactures();
        });
        document.getElementById('filterTriFacture')?.addEventListener('change', (e) => {
            this.filters.tri = e.target.value;
            this.loadFactures();
        });

        // Boutons factures
        document.getElementById('btnNouvelleFacture')?.addEventListener('click', () => this.openModalNouvelleFacture());
        document.getElementById('btnFirstFacture')?.addEventListener('click', () => this.openModalNouvelleFacture());
        document.getElementById('btnRefreshFactures')?.addEventListener('click', () => this.loadFactures());
        document.getElementById('btnExportFactures')?.addEventListener('click', () => this.exportFactures());

        // Boutons header orphelins
        document.getElementById('btnPaiements')?.addEventListener('click', () => {
          if (window.router) window.router.navigate('#paiements');
        });
        document.getElementById('btnDepenses')?.addEventListener('click', () => {
          if (window.router) window.router.navigate('#depenses');
        });

        // Formulaire facture
        document.getElementById('formFacture')?.addEventListener('submit', (e) => this.handleSubmitFacture(e));
        document.getElementById('btnDeleteFacture')?.addEventListener('click', () => this.confirmDeleteFacture());
        document.getElementById('btnDupliquerFacture')?.addEventListener('click', () => this.dupliquerFacture());
        document.getElementById('btnEnvoyerFacture')?.addEventListener('click', () => this.envoyerFacture());
        document.getElementById('btnConfirmDeleteFinance')?.addEventListener('click', () => this.executeDeleteFinance());

        // Lignes facture
        document.getElementById('btnAjouterLigneFacture')?.addEventListener('click', () => this.openModalLigneFacture());
        document.getElementById('formLigneFacture')?.addEventListener('submit', (e) => this.handleSubmitLigneFacture(e));

        // Calculs auto ligne facture
        document.getElementById('ligneFactureQuantite')?.addEventListener('input', () => this.calculerLigneFacture());
        document.getElementById('ligneFacturePrixUnitaire')?.addEventListener('input', () => this.calculerLigneFacture());
        document.getElementById('ligneFactureRemise')?.addEventListener('input', () => this.calculerLigneFacture());
        document.getElementById('ligneFactureTauxTVA')?.addEventListener('change', () => this.calculerLigneFacture());
        document.getElementById('ligneFactureArticle')?.addEventListener('change', (e) => this.onArticleSelectFacture(e));

        // Paiements facture
        document.getElementById('btnAjouterPaiementFacture')?.addEventListener('click', () => this.openModalPaiement());
        document.getElementById('formPaiement')?.addEventListener('submit', (e) => this.handleSubmitPaiement(e));

        // Paiements globaux
        document.getElementById('btnNouveauPaiement')?.addEventListener('click', () => this.openModalPaiementGlobal());
        document.getElementById('btnRefreshPaiements')?.addEventListener('click', () => this.loadPaiements());
        document.getElementById('paiementDateDebut')?.addEventListener('change', () => this.loadPaiements());
        document.getElementById('paiementDateFin')?.addEventListener('change', () => this.loadPaiements());
        document.getElementById('paiementModeFilter')?.addEventListener('change', () => this.loadPaiements());

        // Dépenses
        document.getElementById('btnNouvelleDepense')?.addEventListener('click', () => this.openModalNouvelleDepense());
        document.getElementById('formDepense')?.addEventListener('submit', (e) => this.handleSubmitDepense(e));
        document.getElementById('btnDeleteDepense')?.addEventListener('click', () => this.confirmDeleteDepense());
        document.getElementById('btnRefreshDepenses')?.addEventListener('click', () => this.loadDepenses());
        document.getElementById('depenseDateDebut')?.addEventListener('change', () => this.loadDepenses());
        document.getElementById('depenseDateFin')?.addEventListener('change', () => this.loadDepenses());
        document.getElementById('depenseCategorieFilter')?.addEventListener('change', () => this.loadDepenses());

        // Client depuis facture
        document.getElementById('btnNouveauClientFacture')?.addEventListener('click', () => {
            window.router.navigate('#clients/nouveau');
        });

        // Modifier depuis détail
        document.getElementById('btnEditFactureFromDetail')?.addEventListener('click', () => {
            const modalDetail = bootstrap.Modal.getInstance(document.getElementById('modalFactureDetail'));
            modalDetail?.hide();
            setTimeout(() => this.openModalEditionFacture(this.factureEnEdition?.id), 300);
        });
    }

    /**
     * Calculer les totaux d'une ligne facture
     */
    calculerLigneFacture() {
        const quantite = parseFloat(document.getElementById('ligneFactureQuantite')?.value) || 0;
        const prixUnitaire = parseFloat(document.getElementById('ligneFacturePrixUnitaire')?.value) || 0;
        const remise = parseFloat(document.getElementById('ligneFactureRemise')?.value) || 0;
        const tauxTVA = parseFloat(document.getElementById('ligneFactureTauxTVA')?.value) || 20;

        const totalHT = quantite * prixUnitaire * (1 - remise / 100);
        const totalTVA = totalHT * (tauxTVA / 100);
        const totalTTC = totalHT + totalTVA;

        document.getElementById('ligneFactureTotal').value = totalHT.toFixed(2);
        document.getElementById('ligneFactureTotalTTC').value = totalTTC.toFixed(2);
    }

    /**
     * Quand un article est sélectionné pour facture
     */
    onArticleSelectFacture(e) {
        const articleId = parseInt(e.target.value);
        const article = this.articlesCache.find(a => a.id === articleId);
        if (article) {
            document.getElementById('ligneFactureDescription').value = article.nom + (article.description ? '\n' + article.description : '');
            document.getElementById('ligneFactureUnite').value = article.unite || 'unité';
            document.getElementById('ligneFacturePrixUnitaire').value = article.prixVente || 0;
            document.getElementById('ligneFactureTauxTVA').value = article.tva || 20;
            this.calculerLigneFacture();
        }
    }

    /**
     * Recalculer les totaux de la facture
     */
    calculerTotauxFacture() {
        let totalHT = 0;
        let totalTVA = 0;

        this.lignesFacture.forEach(l => {
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
        const montantPaye = this.paiementsFacture.reduce((sum, p) => sum + (parseFloat(p.montant) || 0), 0);
        const reste = totalTTC - montantPaye;

        document.getElementById('factureTotalHT').textContent = this.formatCurrency(totalHT);
        document.getElementById('factureTotalTVA').textContent = this.formatCurrency(totalTVA);
        document.getElementById('factureTotalTTC').textContent = this.formatCurrency(totalTTC);
        document.getElementById('factureMontantPaye').textContent = this.formatCurrency(montantPaye);
        document.getElementById('factureLignesCount').textContent = this.lignesFacture.length;

        this.factureTotaux = { totalHT, totalTVA, totalTTC, montantPaye, reste };
    }

    // ==================== FACTURES ====================

    /**
     * Charger la liste des factures
     */
    async loadFactures() {
        this.showLoaderFactures(true);

        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;

            const result = await window.api.factures.invoke('list', {
                entrepriseId,
                limit: this.pageSize,
                offset: (this.currentPage - 1) * this.pageSize,
                statut: this.filters.statut || undefined,
                search: this.filters.search || undefined
            });

            this.totalItems = result.total || 0;
            this.renderFacturesTable(result.items || []);
            this.renderFacturesPagination();
            this.toggleEmptyStateFactures(result.items?.length === 0);

        } catch (error) {
            console.error('Erreur chargement factures:', error);
            showToast('Erreur lors du chargement des factures', 'error');
        } finally {
            this.showLoaderFactures(false);
        }
    }

    /**
     * Afficher les factures dans le tableau
     */
    renderFacturesTable(factures) {
        const tbody = document.getElementById('facturesTbody');
        if (!tbody) return;

        if (factures.length === 0) {
            tbody.innerHTML = '';
            return;
        }

        tbody.innerHTML = factures.map((f, index) => {
            const statutClass = {
                'brouillon': 'bg-secondary',
                'emise': 'bg-info',
                'envoyee': 'bg-primary',
                'partiellement_payee': 'bg-warning text-dark',
                'payee': 'bg-success',
                'annulee': 'bg-danger'
            }[f.statut] || 'bg-secondary';

            const statutLabel = {
                'brouillon': 'Brouillon',
                'emise': 'Émise',
                'envoyee': 'Envoyée',
                'partiellement_payee': 'Partiellement payée',
                'payee': 'Payée',
                'annulee': 'Annulée'
            }[f.statut] || f.statut;

            const clientNom = this.getClientDisplayName(f.client);
            const chantierNom = f.chantier?.nom || f.devis?.numero || '—';
            const montantPaye = f.montantPaye || 0;
            const reste = (f.montantTTC || 0) - montantPaye;
            const estEnRetard = f.dateEcheance && new Date(f.dateEcheance) < new Date() && f.statut !== 'payee' && f.statut !== 'annulee';

            return `
                <tr data-id="${f.id}" class="${estEnRetard ? 'table-danger' : ''}">
                    <td>${(this.currentPage - 1) * this.pageSize + index + 1}</td>
                    <td>
                        <div class="fw-semibold">${this.escapeHtml(f.numero)}</div>
                        <small class="text-secondary">${f.type === 'acompte' ? 'Acompte' : f.type === 'solde' ? 'Solde' : f.type === 'avoir' ? 'Avoir' : 'Standard'}</small>
                    </td>
                    <td>${this.escapeHtml(clientNom)}</td>
                    <td class="d-none d-md-table-cell">${this.escapeHtml(chantierNom)}</td>
                    <td class="d-none d-md-table-cell"><small>${this.formatDate(f.dateEmission)}</small></td>
                    <td class="d-none d-lg-table-cell"><small class="${estEnRetard ? 'text-danger fw-bold' : ''}">${f.dateEcheance ? this.formatDate(f.dateEcheance) : '—'}</small></td>
                    <td>${this.formatCurrency(f.montantHT || 0)}</td>
                    <td class="fw-semibold">${this.formatCurrency(f.montantTTC || 0)}</td>
                    <td class="text-success">${this.formatCurrency(montantPaye)}</td>
                    <td class="text-${reste > 0 ? 'danger' : 'success'} fw-semibold">${this.formatCurrency(reste)}</td>
                    <td><span class="badge ${statutClass}">${statutLabel}</span></td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-secondary btn-view" data-id="${f.id}" title="Voir" data-permission="factures:list">
                                <i class="bi bi-eye"></i>
                            </button>
                            <button class="btn btn-outline-primary btn-edit" data-id="${f.id}" title="Modifier" data-permission="factures:update">
                                <i class="bi bi-pencil"></i>
                            </button>
                            ${f.statut !== 'payee' && f.statut !== 'annulee' ? `<button class="btn btn-outline-success btn-paiement" data-id="${f.id}" title="Enregistrer paiement" data-permission="factures:ajouterPaiement">
                                <i class="bi bi-cash-stack"></i>
                            </button>` : ''}
                            <button class="btn btn-outline-danger btn-delete" data-id="${f.id}" title="Supprimer" data-permission="factures:delete">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.querySelectorAll('.btn-view').forEach(btn => {
            btn.addEventListener('click', (e) => this.viewFacture(e.currentTarget.dataset.id));
        });
        tbody.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => this.openModalEditionFacture(e.currentTarget.dataset.id));
        });
        tbody.querySelectorAll('.btn-paiement').forEach(btn => {
            btn.addEventListener('click', (e) => this.openModalPaiement(e.currentTarget.dataset.id));
        });
        tbody.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => this.confirmDeleteFacture(e.currentTarget.dataset.id));
        });
    }

    /**
     * Pagination factures
     */
    renderFacturesPagination() {
        const container = document.getElementById('facturesPagination');
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
                    this.loadFactures();
                }
            });
        });
    }

    /**
     * État vide factures
     */
    toggleEmptyStateFactures(isEmpty) {
        document.getElementById('facturesEmpty')?.classList.toggle('d-none', !isEmpty);
        document.getElementById('facturesTable')?.classList.toggle('d-none', isEmpty);
        document.getElementById('facturesPagination')?.classList.toggle('d-none', isEmpty);
    }

    /**
     * Ouvrir modale nouvelle facture
     */
    openModalNouvelleFacture() {
        this.factureEnEdition = null;
        this.lignesFacture = [];
        this.paiementsFacture = [];
        this.resetFormFacture();
        document.getElementById('modalFactureLabel').textContent = 'Nouvelle facture';
        document.getElementById('btnDeleteFacture').style.display = 'none';
        document.getElementById('btnDupliquerFacture').style.display = 'none';
        document.getElementById('btnEnvoyerFacture').style.display = 'none';

        const today = new Date().toISOString().split('T')[0];
        document.getElementById('factureDateEmission').value = today;
        document.getElementById('factureDateCreation').value = today;
        document.getElementById('factureDateEcheance').value = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        this.generateNumeroFacture();
        this.calculerTotauxFacture();
        this.renderLignesFacture();
        this.renderPaiementsFacture();

        const modal = new bootstrap.Modal(document.getElementById('modalFacture'));
        modal.show();
    }

    /**
     * Ouvrir modale édition facture
     */
    async openModalEditionFacture(id) {
        try {
            const facture = await window.api.factures.invoke('get', parseInt(id));
            if (!facture) {
                showToast('Facture non trouvée', 'error');
                return;
            }

            this.factureEnEdition = facture;
            this.lignesFacture = facture.lignes || [];
            this.paiementsFacture = facture.paiements || [];
            this.fillFormFacture(facture);
            document.getElementById('modalFactureLabel').textContent = `Modifier: ${facture.numero}`;
            document.getElementById('btnDeleteFacture').style.display = 'inline-block';
            document.getElementById('btnDeleteFacture').dataset.id = id;
            document.getElementById('btnDupliquerFacture').style.display = 'inline-block';
            document.getElementById('btnEnvoyerFacture').style.display = facture.statut !== 'envoyee' ? 'inline-block' : 'none';

            this.renderLignesFacture();
            this.renderPaiementsFacture();
            this.calculerTotauxFacture();

            const modal = new bootstrap.Modal(document.getElementById('modalFacture'));
            modal.show();
        } catch (error) {
            console.error('Erreur chargement facture:', error);
            showToast('Erreur lors du chargement de la facture', 'error');
        }
    }

    /**
     * Voir détail facture
     */
    async viewFacture(id) {
        try {
            const facture = await window.api.factures.invoke('get', parseInt(id));
            if (!facture) {
                showToast('Facture non trouvée', 'error');
                return;
            }

            this.renderFactureDetail(facture);
            const modal = new bootstrap.Modal(document.getElementById('modalFactureDetail'));
            modal.show();
        } catch (error) {
            console.error('Erreur chargement détail:', error);
            showToast('Erreur lors du chargement du détail', 'error');
        }
    }

    /**
     * Rendre le détail de la facture
     */
    renderFactureDetail(f) {
        const container = document.getElementById('factureDetailContent');
        if (!container) return;

        const statutClass = {
            'brouillon': 'bg-secondary',
            'emise': 'bg-info',
            'envoyee': 'bg-primary',
            'partiellement_payee': 'bg-warning text-dark',
            'payee': 'bg-success',
            'annulee': 'bg-danger'
        }[f.statut] || 'bg-secondary';

        const clientNom = this.getClientDisplayName(f.client);
        const montantPaye = f.montantPaye || 0;
        const reste = (f.montantTTC || 0) - montantPaye;
        const estEnRetard = f.dateEcheance && new Date(f.dateEcheance) < new Date() && f.statut !== 'payee' && f.statut !== 'annulee';

        container.innerHTML = `
            <div class="row g-4">
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-body text-center">
                            <div class="mb-3">
                                <span class="badge ${statutClass} fs-6">${f.statut}</span>
                                ${estEnRetard ? '<span class="badge bg-danger ms-1">EN RETARD</span>' : ''}
                            </div>
                            <h4>${this.escapeHtml(f.numero)}</h4>
                            <p class="text-secondary">${f.type === 'acompte' ? 'Facture d\'acompte' : f.type === 'solde' ? 'Facture de solde' : f.type === 'avoir' ? 'Avoir' : 'Facture standard'}</p>
                            <hr>
                            <div class="text-start small">
                                <div><strong>Client:</strong> ${this.escapeHtml(clientNom)}</div>
                                <div><strong>Chantier/Devis:</strong> ${this.escapeHtml(f.chantier?.nom || f.devis?.numero || '—')}</div>
                                <div><strong>Émission:</strong> ${this.formatDate(f.dateEmission)}</div>
                                <div><strong>Échéance:</strong> ${f.dateEcheance ? this.formatDate(f.dateEcheance) : '—'} ${estEnRetard ? '<span class="text-danger"> (EN RETARD)</span>' : ''}</div>
                                <div><strong>Cond. paiement:</strong> ${this.escapeHtml(f.conditionsPaiement || '—')}</div>
                                <div><strong>Mode paiement:</strong> ${this.escapeHtml(f.modePaiement || '—')}</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-8">
                    <div class="card mb-3">
                        <div class="card-header"><h6 class="mb-0"><i class="bi bi-list-ul me-2"></i>Lignes (${f.lignes?.length || 0})</h6></div>
                        <div class="card-body p-0">
                            ${f.lignes && f.lignes.length > 0 ? `
                                <div class="table-responsive">
                                    <table class="table table-sm mb-0">
                                        <thead class="table-light">
                                            <tr><th>Description</th><th class="text-end">Qté</th><th class="text-end">PU HT</th><th class="text-end">Remise</th><th class="text-end">TVA</th><th class="text-end">Total HT</th></tr>
                                        </thead>
                                        <tbody>
                                            ${f.lignes.map(l => `
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
                                <div class="col-md-3"><small class="text-secondary">Total HT</small><div class="fw-bold text-primary">${this.formatCurrency(f.montantHT || 0)}</div></div>
                                <div class="col-md-3"><small class="text-secondary">TVA</small><div class="fw-bold text-info">${this.formatCurrency(f.montantTVA || 0)}</div></div>
                                <div class="col-md-3"><small class="text-secondary">Total TTC</small><div class="fw-bold text-success fs-5">${this.formatCurrency(f.montantTTC || 0)}</div></div>
                                <div class="col-md-3"><small class="text-secondary">Payé</small><div class="fw-bold text-success">${this.formatCurrency(montantPaye)}</div></div>
                                <div class="col-md-6"><small class="text-secondary">Reste à payer</small><div class="fw-bold text-${reste > 0 ? 'danger' : 'success'} fs-5">${this.formatCurrency(reste)}</div></div>
                            </div>
                        </div>
                    </div>

                    <div class="card mb-3">
                        <div class="card-header d-flex justify-content-between">
                            <h6 class="mb-0"><i class="bi bi-cash-stack me-2"></i>Paiements (${f.paiements?.length || 0})</h6>
                            <button class="btn btn-sm btn-success" data-permission="factures:ajouterPaiement" onclick="window.financesController.openModalPaiement(${f.id}); bootstrap.Modal.getInstance(document.getElementById('modalFactureDetail'))?.hide();">
                                <i class="bi bi-plus me-1"></i>Ajouter
                            </button>
                        </div>
                        <div class="card-body p-0">
                            ${f.paiements && f.paiements.length > 0 ? `
                                <div class="table-responsive">
                                    <table class="table table-sm mb-0">
                                        <thead class="table-light">
                                            <tr><th>Date</th><th>Montant</th><th>Mode</th><th>Référence</th></tr>
                                        </thead>
                                        <tbody>
                                            ${f.paiements.map(p => `
                                                <tr>
                                                    <td><small>${this.formatDate(p.datePaiement)}</small></td>
                                                    <td><strong class="text-success">${this.formatCurrency(p.montant)}</strong></td>
                                                    <td><span class="badge bg-info">${p.modePaiement}</span></td>
                                                    <td><small>${this.escapeHtml(p.reference || '—')}</small></td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            ` : '<div class="text-center py-3 text-secondary">Aucun paiement</div>'}
                        </div>
                    </div>

                    ${f.notes ? `
                    <div class="card">
                        <div class="card-header"><h6 class="mb-0"><i class="bi bi-sticky me-2"></i>Notes</h6></div>
                        <div class="card-body"><p class="mb-0">${this.escapeHtml(f.notes)}</p></div>
                    </div>
                    ` : ''}

                    <div class="d-flex gap-2">
                        <button class="btn btn-outline-primary" data-permission="factures:update" onclick="window.financesController.openModalEditionFacture(${f.id}); bootstrap.Modal.getInstance(document.getElementById('modalFactureDetail'))?.hide();">
                            <i class="bi bi-pencil me-1"></i>Modifier
                        </button>
                        <button class="btn btn-outline-success" data-permission="factures:dupliquer" onclick="window.financesController.dupliquerFacture(${f.id}); bootstrap.Modal.getInstance(document.getElementById('modalFactureDetail'))?.hide();">
                            <i class="bi bi-files me-1"></i>Dupliquer
                        </button>
                        <button class="btn btn-success" data-permission="factures:ajouterPaiement" onclick="window.financesController.openModalPaiement(${f.id}); bootstrap.Modal.getInstance(document.getElementById('modalFactureDetail'))?.hide();">
                            <i class="bi bi-cash-stack me-1"></i>Enregistrer paiement
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Réinitialiser formulaire facture
     */
    resetFormFacture() {
        const form = document.getElementById('formFacture');
        if (form) form.reset();
        document.getElementById('factureId').value = '';
        document.getElementById('factureType').value = 'standard';
        document.getElementById('factureStatut').value = 'brouillon';
        document.getElementById('factureTVA').value = '20';
        document.getElementById('factureCondPaiement').value = '30 jours';
        document.getElementById('factureModePaiement').value = 'virement';

        this.lignesFacture = [];
        this.paiementsFacture = [];
        this.renderLignesFacture();
        this.renderPaiementsFacture();
    }

    /**
     * Générer numéro facture
     */
    async generateNumeroFacture() {
        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;
            const year = new Date().getFullYear();
            const result = await window.api.factures.invoke('list', { entrepriseId, limit: 1, search: `FAC-${year}` });
            const nextNum = (result.items?.length || 0) + 1;
            document.getElementById('factureNumero').value = `FAC-${year}-${String(nextNum).padStart(5, '0')}`;
        } catch (error) {
            document.getElementById('factureNumero').value = `FAC-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
        }
    }

    /**
     * Remplir formulaire facture
     */
    fillFormFacture(f) {
        document.getElementById('factureId').value = f.id;
        document.getElementById('factureNumero').value = f.numero || '';
        document.getElementById('factureDateCreation').value = f.dateCreation || '';
        document.getElementById('factureType').value = f.type || 'standard';
        document.getElementById('factureClient').value = f.clientId || '';
        document.getElementById('factureDevis').value = f.devisId || '';
        document.getElementById('factureChantier').value = f.chantierId || '';
        document.getElementById('factureDateEmission').value = f.dateEmission || '';
        document.getElementById('factureDateEcheance').value = f.dateEcheance || '';
        document.getElementById('factureStatut').value = f.statut || 'brouillon';
        document.getElementById('factureTVA').value = f.tva || '20';
        document.getElementById('factureCondPaiement').value = f.conditionsPaiement || '30 jours';
        document.getElementById('factureModePaiement').value = f.modePaiement || 'virement';
        document.getElementById('factureNotes').value = f.notes || '';
    }

    /**
     * Rendre les lignes de facture
     */
    renderLignesFacture() {
        const container = document.getElementById('factureLignesContainer');
        if (!container) return;

        if (this.lignesFacture.length === 0) {
            container.innerHTML = '<p class="text-secondary text-center py-3">Aucune ligne. Cliquez sur "Ajouter une ligne".</p>';
            return;
        }

        container.innerHTML = this.lignesFacture.map((l, index) => `
            <div class="card mb-2" data-index="${index}">
                <div class="card-body py-2">
                    <div class="row g-2 align-items-center">
                        <div class="col-auto"><span class="badge bg-secondary">${index + 1}</span></div>
                        <div class="col"><strong>${this.escapeHtml(l.description)}</strong></div>
                        <div class="col-auto"><small class="text-secondary">${l.quantite} ${this.escapeHtml(l.unite || '')} × ${this.formatCurrency(l.prixUnitaire)}</small></div>
                        <div class="col-auto"><small class="text-secondary">${l.remise || 0}% remise</small></div>
                        <div class="col-auto"><small class="text-secondary">${l.tauxTVA || 20}% TVA</small></div>
                        <div class="col-auto"><strong class="text-primary">${this.formatCurrency(l.totalHT || 0)}</strong></div>
                        <div class="col-auto">
                            <button class="btn btn-sm btn-outline-primary" data-permission="factures:update" onclick="window.financesController.editLigneFacture(${index})"><i class="bi bi-pencil"></i></button>
                            <button class="btn btn-sm btn-outline-danger" data-permission="factures:update" onclick="window.financesController.deleteLigneFacture(${index})"><i class="bi bi-trash"></i></button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    /**
     * Rendre les paiements de la facture
     */
    renderPaiementsFacture() {
        const container = document.getElementById('facturePaiementsContainer');
        if (!container) return;

        if (!this.paiementsFacture || this.paiementsFacture.length === 0) {
            container.innerHTML = '<p class="text-secondary text-center py-3">Aucun paiement enregistré</p>';
            return;
        }

        container.innerHTML = this.paiementsFacture.map((p, index) => `
            <div class="card mb-2">
                <div class="card-body py-2">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <strong class="text-success">${this.formatCurrency(p.montant)}</strong>
                            <span class="badge bg-info ms-2">${p.modePaiement}</span>
                            ${p.reference ? `<small class="text-secondary ms-2">(${this.escapeHtml(p.reference)})</small>` : ''}
                        </div>
                        <div>
                            <small class="text-secondary">${this.formatDate(p.datePaiement)}</small>
                            <button class="btn btn-sm btn-outline-danger ms-2" data-permission="factures:update" onclick="window.financesController.deletePaiementFacture(${index})"><i class="bi bi-trash"></i></button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    /**
     * Ouvrir modale ligne facture
     */
    openModalLigneFacture(ligne = null, index = null) {
        const form = document.getElementById('formLigneFacture');
        if (form) form.reset();

        document.getElementById('ligneFactureId').value = ligne?.id || '';
        document.getElementById('ligneFactureFactureId').value = this.factureEnEdition?.id || '';
        document.getElementById('ligneFactureQuantite').value = ligne?.quantite || 1;
        document.getElementById('ligneFactureRemise').value = ligne?.remise || 0;
        document.getElementById('ligneFactureTauxTVA').value = ligne?.tauxTVA || 20;

        if (ligne) {
            document.getElementById('ligneFactureType').value = ligne.type || 'article';
            document.getElementById('ligneFactureArticle').value = ligne.articleId || '';
            document.getElementById('ligneFactureDescription').value = ligne.description || '';
            document.getElementById('ligneFactureUnite').value = ligne.unite || 'unité';
            document.getElementById('ligneFacturePrixUnitaire').value = ligne.prixUnitaire || 0;
            document.getElementById('modalLigneFactureLabel').innerHTML = '<i class="bi bi-pencil me-2"></i>Modifier la ligne';
        } else {
            document.getElementById('ligneFactureType').value = 'article';
            document.getElementById('modalLigneFactureLabel').innerHTML = '<i class="bi bi-plus me-2"></i>Nouvelle ligne';
        }

        this.calculerLigneFacture();

        const modal = new bootstrap.Modal(document.getElementById('modalLigneFacture'));
        modal.show();

        this.ligneFactureEnEditionIndex = index;
    }

    /**
     * Soumission ligne facture
     */
    handleSubmitLigneFacture(e) {
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

        if (this.ligneFactureEnEditionIndex !== null && this.ligneFactureEnEditionIndex >= 0) {
            this.lignesFacture[this.ligneFactureEnEditionIndex] = data;
        } else {
            this.lignesFacture.push(data);
        }

        this.renderLignesFacture();
        this.calculerTotauxFacture();

        bootstrap.Modal.getInstance(document.getElementById('modalLigneFacture'))?.hide();
        this.ligneFactureEnEditionIndex = null;
    }

    /**
     * Modifier ligne facture
     */
    editLigneFacture(index) {
        this.openModalLigneFacture(this.lignesFacture[index], index);
    }

    /**
     * Supprimer ligne facture
     */
    deleteLigneFacture(index) {
        if (confirm('Supprimer cette ligne ?')) {
            this.lignesFacture.splice(index, 1);
            this.renderLignesFacture();
            this.calculerTotauxFacture();
        }
    }

    /**
     * Supprimer paiement facture
     */
    deletePaiementFacture(index) {
        if (confirm('Supprimer ce paiement ?')) {
            this.paiementsFacture.splice(index, 1);
            this.renderPaiementsFacture();
            this.calculerTotauxFacture();
        }
    }

    /**
     * Ouvrir modale paiement (pour une facture spécifique)
     */
    openModalPaiement(factureId = null) {
        const form = document.getElementById('formPaiement');
        if (form) form.reset();

        document.getElementById('paiementId').value = '';
        document.getElementById('paiementFactureId').value = factureId || this.factureEnEdition?.id || '';
        document.getElementById('paiementDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('modalPaiementLabel').innerHTML = '<i class="bi bi-plus me-2"></i>Enregistrer paiement';

        const modal = new bootstrap.Modal(document.getElementById('modalPaiement'));
        modal.show();
    }

    /**
     * Soumission paiement
     */
    async handleSubmitPaiement(e) {
        e.preventDefault();

        const form = e.target;
        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            return;
        }

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        data.montant = parseFloat(data.montant) || 0;
        data.factureId = parseInt(data.factureId) || this.factureEnEdition?.id;

        if (!data.factureId) {
            showToast('Facture non sélectionnée', 'warning');
            return;
        }

        try {
            await window.api.factures.invoke('ajouterPaiement', data.factureId, data);
            showToast('Paiement enregistré avec succès', 'success');

            bootstrap.Modal.getInstance(document.getElementById('modalPaiement'))?.hide();

            // Recharger la facture
            if (this.factureEnEdition) {
                const updated = await window.api.factures.invoke('get', this.factureEnEdition.id);
                this.factureEnEdition = updated;
                this.paiementsFacture = updated.paiements || [];
                this.renderPaiementsFacture();
                this.calculerTotauxFacture();
            }
            await this.loadFactures();
            await this.loadPaiements();

        } catch (error) {
            console.error('Erreur paiement:', error);
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    /**
     * Ouvrir modale paiement global
     */
    openModalPaiementGlobal() {
        // Rediriger vers factures avec filtre
        showToast('Sélectionnez une facture puis cliquez sur "Enregistrer paiement"', 'info');
    }

    // ==================== PAIEMENTS GLOBAUX ====================

    /**
     * Charger les paiements
     */
    async loadPaiements() {
        const tbody = document.getElementById('paiementsTbody');
        if (!tbody) return;

        const dateDebut = document.getElementById('paiementDateDebut')?.value;
        const dateFin = document.getElementById('paiementDateFin')?.value;
        const modeFilter = document.getElementById('paiementModeFilter')?.value;
        const entrepriseId = window.AppState?.entreprise?.id || 1;

        try {
            const result = await window.api.paiements.invoke('list', { entrepriseId, limit: 1000 });
            let paiements = result?.items || result?.data?.items || [];

            if (dateDebut) paiements = paiements.filter(p => p.datePaiement >= dateDebut);
            if (dateFin) paiements = paiements.filter(p => p.datePaiement <= dateFin);
            if (modeFilter) paiements = paiements.filter(p => p.modePaiement === modeFilter);

            const factureIds = [...new Set(paiements.map(p => p.factureId).filter(Boolean))];
            const factures = {};
            for (const fid of factureIds) {
                try {
                    const f = await window.api.factures.invoke('get', fid);
                    if (f) factures[fid] = f;
                } catch (e) { /* silencieux */ }
            }

            if (paiements.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-secondary">Aucun paiement</td></tr>';
                return;
            }

            tbody.innerHTML = paiements.map(p => {
                const facture = factures[p.factureId];
                const clientNom = facture ? this.getClientDisplayName(facture.client) : `Facture #${p.factureId}`;
                return `
                    <tr>
                        <td><small>${this.formatDate(p.datePaiement)}</small></td>
                        <td>${facture ? this.escapeHtml(facture.numero) : '#' + p.factureId}</td>
                        <td>${this.escapeHtml(clientNom)}</td>
                        <td><strong class="text-success">${this.formatCurrency(p.montant)}</strong></td>
                        <td><span class="badge bg-info">${p.modePaiement}</span></td>
                        <td><small>${this.escapeHtml(p.reference || '—')}</small></td>
                    </tr>
                `;
            }).join('');
        } catch (error) {
            console.error('Erreur chargement paiements:', error);
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-danger">Erreur chargement</td></tr>';
        }
    }

    // ==================== DÉPENSES ====================

    /**
     * Charger les dépenses
     */
    async loadDepenses() {
        const tbody = document.getElementById('depensesTbody');
        if (!tbody) return;

        const dateDebut = document.getElementById('depenseDateDebut')?.value;
        const dateFin = document.getElementById('depenseDateFin')?.value;
        const categorieFilter = document.getElementById('depenseCategorieFilter')?.value;
        const entrepriseId = window.AppState?.entreprise?.id || 1;

        try {
            const result = await window.api.chantiers.invoke('list', { entrepriseId, limit: 100 });
            const chantiers = result?.items || result?.data?.items || [];

            let allDepenses = [];
            for (const c of chantiers) {
                try {
                    const depenses = await window.api.depenses.invoke('byChantier', c.id);
                    allDepenses.push(...depenses.map(d => ({ ...d, chantier: c })));
                } catch (e) { /* silencieux */ }
            }

            if (dateDebut) allDepenses = allDepenses.filter(d => d.dateDepense >= dateDebut);
            if (dateFin) allDepenses = allDepenses.filter(d => d.dateDepense <= dateFin);
            if (categorieFilter) allDepenses = allDepenses.filter(d => d.categorie === categorieFilter);

            allDepenses.sort((a, b) => new Date(b.dateDepense) - new Date(a.dateDepense));
            allDepenses = allDepenses.slice(0, 200);

            if (allDepenses.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-secondary">Aucune dépense</td></tr>';
                return;
            }

            tbody.innerHTML = allDepenses.map(d => {
                const valide = d.valideePar ? 'Validée' : 'En attente';
                const valideClass = d.valideePar ? 'bg-success' : 'bg-warning text-dark';

                return `
                    <tr>
                        <td>${this.formatDate(d.dateDepense)}</td>
                        <td>${this.escapeHtml(d.chantier?.nom || '—')}</td>
                        <td><span class="badge bg-secondary">${d.categorie}</span></td>
                        <td>${this.escapeHtml(d.description || '—')}</td>
                        <td class="fw-semibold">${this.formatCurrency(d.montant || 0)}</td>
                        <td><span class="badge ${valideClass}">${valide}</span></td>
                        <td>${d.valideePar ? this.escapeHtml(`${d.valideePar?.prenom || ''} ${d.valideePar?.nom || ''}`.trim()) : '—'}</td>
                    </tr>
                `;
            }).join('');
        } catch (error) {
            console.error('Erreur chargement dépenses:', error);
            tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-danger">Erreur chargement</td></tr>';
        }
    }

    /**
     * Ouvrir modale nouvelle dépense
     */
    openModalNouvelleDepense() {
        this.factureEnEdition = { type: 'depense' };
        this.resetFormDepense();
        document.getElementById('modalDepenseLabel').textContent = 'Nouvelle dépense';
        document.getElementById('btnDeleteDepense').style.display = 'none';

        document.getElementById('depenseDate').value = new Date().toISOString().split('T')[0];

        const modal = new bootstrap.Modal(document.getElementById('modalDepense'));
        modal.show();
    }

    /**
     * Réinitialiser formulaire dépense
     */
    resetFormDepense() {
        const form = document.getElementById('formDepense');
        if (form) form.reset();
        document.getElementById('depenseId').value = '';
        document.getElementById('depenseModePaiement').value = 'virement';
    }

    /**
     * Soumission dépense
     */
    async handleSubmitDepense(e) {
        e.preventDefault();

        const form = e.target;
        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            return;
        }

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        data.montant = parseFloat(data.montant) || 0;
        data.chantierId = parseInt(data.chantierId) || null;
        data.fournisseurId = parseInt(data.fournisseurId) || null;
        data.valideePar = parseInt(data.valideePar) || null;

        const entrepriseId = window.AppState?.entreprise?.id || 1;
        const isEdit = !!data.id;
        const depenseId = data.id ? parseInt(data.id) : null;
        delete data.id;

        try {
            if (isEdit && depenseId) {
                await window.api.depenses.invoke('update', depenseId, data);
                showToast('Dépense modifiée avec succès', 'success');
            } else {
                await window.api.depenses.invoke('create', data, entrepriseId);
                showToast('Dépense créée avec succès', 'success');
            }

            bootstrap.Modal.getInstance(document.getElementById('modalDepense'))?.hide();
            await this.loadDepenses();

        } catch (error) {
            console.error('Erreur sauvegarde dépense:', error);
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    /**
     * Confirmer suppression facture
     */
    confirmDeleteFacture(id) {
        const factureId = id || document.getElementById('btnDeleteFacture')?.dataset.id;
        if (!factureId) return;

        this.factureEnEdition = { id: parseInt(factureId), type: 'facture' };
        document.getElementById('deleteFinanceName').textContent = 'cette facture';

        bootstrap.Modal.getInstance(document.getElementById('modalFacture'))?.hide();
        bootstrap.Modal.getInstance(document.getElementById('modalFactureDetail'))?.hide();

        setTimeout(() => {
            new bootstrap.Modal(document.getElementById('modalConfirmDeleteFinance')).show();
        }, 300);
    }

    /**
     * Confirmer suppression dépense
     */
    confirmDeleteDepense(id) {
        const depenseId = id || document.getElementById('btnDeleteDepense')?.dataset.id;
        if (!depenseId) return;

        this.factureEnEdition = { id: parseInt(depenseId), type: 'depense' };
        document.getElementById('deleteFinanceName').textContent = 'cette dépense';

        bootstrap.Modal.getInstance(document.getElementById('modalDepense'))?.hide();

        setTimeout(() => {
            new bootstrap.Modal(document.getElementById('modalConfirmDeleteFinance')).show();
        }, 300);
    }

    /**
     * Exécuter suppression (facture ou dépense)
     */
    async executeDeleteFinance() {
        if (!this.factureEnEdition?.id) return;

        try {
            if (this.factureEnEdition.type === 'facture') {
                await window.api.factures.invoke('delete', this.factureEnEdition.id);
                showToast('Facture supprimée', 'success');
                await this.loadFactures();
            } else if (this.factureEnEdition.type === 'depense') {
                await window.api.depenses.invoke('delete', this.factureEnEdition.id);
                showToast('Dépense supprimée', 'success');
                await this.loadDepenses();
            }

            bootstrap.Modal.getInstance(document.getElementById('modalConfirmDeleteFinance'))?.hide();

        } catch (error) {
            console.error('Erreur suppression:', error);
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    /**
     * Soumission formulaire facture
     */
    async handleSubmitFacture(e) {
        e.preventDefault();

        const form = e.target;
        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            return;
        }

        const entrepriseId = window.AppState?.entreprise?.id || 1;
        const id = document.getElementById('factureId').value;
        const btnSave = document.querySelector('#formFacture button[type="submit"]');

        const data = {
            numero: document.getElementById('factureNumero').value,
            type: document.getElementById('factureType').value,
            clientId: document.getElementById('factureClient').value ? parseInt(document.getElementById('factureClient').value) : null,
            devisId: document.getElementById('factureDevis').value ? parseInt(document.getElementById('factureDevis').value) : null,
            chantierId: document.getElementById('factureChantier').value ? parseInt(document.getElementById('factureChantier').value) : null,
            dateCreation: document.getElementById('factureDateCreation').value,
            dateEmission: document.getElementById('factureDateEmission').value,
            dateEcheance: document.getElementById('factureDateEcheance').value,
            statut: document.getElementById('factureStatut').value,
            tva: parseFloat(document.getElementById('factureTVA').value) || 20,
            conditionsPaiement: document.getElementById('factureCondPaiement').value,
            modePaiement: document.getElementById('factureModePaiement').value,
            notes: document.getElementById('factureNotes').value,
            entrepriseId: entrepriseId,
            lignes: this.lignesFacture.map(l => ({
                ...l,
                quantite: parseFloat(l.quantite) || 0,
                prixUnitaire: parseFloat(l.prixUnitaire) || 0,
                remise: parseFloat(l.remise) || 0,
                tauxTVA: parseFloat(l.tauxTVA) || 20
            })),
            paiements: this.paiementsFacture.map(p => ({
                ...p,
                montant: parseFloat(p.montant) || 0
            }))
        };

        this.calculerTotauxFacture();
        data.montantHT = this.factureTotaux?.totalHT || 0;
        data.montantTTC = this.factureTotaux?.totalTTC || 0;
        data.montant = data.montantTTC;
        data.montantPaye = this.factureTotaux?.montantPaye || 0;

        if (btnSave) btnSave.disabled = true;

        try {
            let result;
            if (id) {
                result = await window.api.factures.invoke('update', parseInt(id), data);
            } else {
                result = await window.api.factures.invoke('create', data, entrepriseId);
            }

            if (result?.success) {
                const modal = bootstrap.Modal.getInstance(document.getElementById('modalFacture'));
                if (modal) modal.hide();
                showToast('Facture enregistrée', 'success');
                await this.loadFactures();
            } else {
                showToast(result?.error || 'Erreur', 'error');
            }
        } catch (e) {
            console.error('Erreur save facture', e);
            showToast('Erreur lors de l\'enregistrement', 'error');
        } finally {
            if (btnSave) btnSave.disabled = false;
        }
    }

    /**
     * Dupliquer facture
     */
    async dupliquerFacture(id) {
        const factureId = id || this.factureEnEdition?.id;
        if (!factureId) return;

        try {
            const result = await window.api.factures.invoke('dupliquer', parseInt(factureId));
            if (!result?.success) {
                showToast(result?.error || 'Erreur lors de la duplication', 'error');
                return;
            }

            const nouvelleFacture = result.data;
            this.factureEnEdition = null;
            this.lignesFacture = [];
            this.paiementsFacture = [];
            this.resetFormFacture();
            document.getElementById('modalFactureLabel').textContent = 'Nouvelle facture (copie)';
            document.getElementById('btnDeleteFacture').style.display = 'none';
            document.getElementById('btnDupliquerFacture').style.display = 'none';
            document.getElementById('btnEnvoyerFacture').style.display = 'none';

            const today = new Date().toISOString().split('T')[0];
            document.getElementById('factureNumero').value = nouvelleFacture.numero || '';
            document.getElementById('factureDateCreation').value = today;
            document.getElementById('factureDateEmission').value = today;
            document.getElementById('factureDateEcheance').value = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            document.getElementById('factureStatut').value = 'brouillon';

            this.renderLignesFacture();
            this.calculerTotauxFacture();

            const modal = new bootstrap.Modal(document.getElementById('modalFacture'));
            modal.show();
            showToast('Facture dupliquée avec succès', 'success');

        } catch (error) {
            console.error('Erreur duplication:', error);
            showToast('Erreur lors de la duplication', 'error');
        }
    }

    /**
     * Envoyer facture
     */
    async envoyerFacture(id) {
        const factureId = id || this.factureEnEdition?.id;
        if (!factureId) return;

        try {
            const result = await window.api.factures.invoke('envoyer', parseInt(factureId));
            if (result?.success) {
                showToast('Facture envoyée par email avec succès', 'success');
                await this.loadFactures();
            } else {
                showToast(result?.error || 'Erreur lors de l\'envoi', 'error');
            }
        } catch (error) {
            console.error('Erreur envoi facture:', error);
            showToast('Erreur lors de l\'envoi par email', 'error');
        }
    }

    /**
     * Exporter factures
     */
    async exportFactures() {
        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;
            const result = await window.api.factures.invoke('list', { entrepriseId, limit: 10000 });

            const headers = ['Numéro', 'Type', 'Client', 'Chantier/Devis', 'Émission', 'Échéance', 'Montant HT', 'Montant TTC', 'Payé', 'Reste', 'Statut'];
            const rows = result.items.map(f => [
                f.numero,
                f.type === 'acompte' ? 'Acompte' : f.type === 'solde' ? 'Solde' : f.type === 'avoir' ? 'Avoir' : 'Standard',
                this.getClientDisplayName(f.client),
                f.chantier?.nom || f.devis?.numero || '',
                f.dateEmission,
                f.dateEcheance || '',
                f.montantHT || 0,
                f.montantTTC || 0,
                f.montantPaye || 0,
                (f.montantTTC || 0) - (f.montantPaye || 0),
                f.statut
            ]);

            const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `factures_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();

            showToast('Export terminé', 'success');
        } catch (error) {
            console.error('Erreur export:', error);
            showToast('Erreur lors de l\'export', 'error');
        }
    }

    /**
     * Loader factures
     */
    showLoaderFactures(show) {
        const table = document.getElementById('facturesTable');
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

    getClientDisplayName(c) {
        if (!c) return '—';
        if (c.type === 'entreprise' || c.type === 'public') {
            return `${c.entreprise || c.nom || ''} ${c.prenom || ''}`.trim() || '—';
        }
        return `${c.civilite || ''} ${c.prenom || ''} ${c.nom || ''}`.trim() || '—';
    }
}

// Instance globale
window.financesController = new FinancesController();