/**
 * Dashboard View Controller
 * Gère le tableau de bord avec KPIs, graphiques, alertes et activité récente
 */

class DashboardController {
    constructor() {
        this.chart = null;
    }

    /**
     * Initialiser le contrôleur
     */
    async init() {
        this.bindEvents();
        await this.loadDashboardData();
        this.updateDashboardVisibility();
    }

    /**
     * Lier les événements UI
     */
    bindEvents() {
        // Actualiser
        document.getElementById('btnRefreshDashboard')?.addEventListener('click', () => this.loadDashboardData());

        // Synchronisation rapide
        document.getElementById('btnQuickSync')?.addEventListener('click', () => {
            if (window.performSync) window.performSync();
        });

        // Voir tout - Activité récente
        document.getElementById('btnVoirToutActivite')?.addEventListener('click', () => {
            const target = document.getElementById('activiteRecenteList');
            if (!target) return;
            const card = target.closest('.card') || target;
            const rect = card.getBoundingClientRect();
            const contentArea = document.getElementById('contentArea');
            if (contentArea) {
                const contentRect = contentArea.getBoundingClientRect();
                const offset = rect.top - contentRect.top + contentArea.scrollTop - 20;
                contentArea.scrollTo({ top: offset, behavior: 'smooth' });
            } else {
                window.scrollTo({ top: rect.top + window.pageYOffset - 20, behavior: 'smooth' });
            }
            setTimeout(() => {
                if (contentArea) {
                    const contentRect = contentArea.getBoundingClientRect();
                    const cardRect = card.getBoundingClientRect();
                    if (Math.abs(cardRect.top - contentRect.top - 20) > 40) {
                        contentArea.scrollTop += cardRect.top - contentRect.top - 20;
                    }
                }
            }, 350);
        });
    }

    /**
     * Charger toutes les données du dashboard selon le rôle
     */
    async loadDashboardData() {
        const entrepriseId = window.AppState?.entreprise?.id || 1;
        const currentRoles = window.AppState?.roles || [window.AppState?.roleCode || 'ADMIN'];

        try {
            // Charger les KPIs de base pour tous les rôles
            await Promise.all([
                this.loadKPIs(entrepriseId),
                this.loadAlertes(entrepriseId)
            ]);

            // Charger les données spécifiques selon le rôle
            const rolePromises = [];

            // Direction/Comptable/Admin - CA, rapports financiers
            if (this.hasRoleAccess(currentRoles, ['ADMIN', 'DIRECTEUR', 'COMPTABLE'])) {
                rolePromises.push(this.loadCAEvolution(entrepriseId));
                rolePromises.push(this.loadFacturesRetard(entrepriseId));
            }

            // Chantiers access - Admin, Direction, Chef Chantier, Chef Projet, Comptable
            if (this.hasRoleAccess(currentRoles, ['ADMIN', 'DIRECTEUR', 'CHEF_CHANTIER', 'CHEF_PROJET', 'COMPTABLE'])) {
                rolePromises.push(this.loadTopChantiers(entrepriseId));
            }

            // RH
            if (this.hasRoleAccess(currentRoles, ['ADMIN', 'RH', 'DIRECTEUR'])) {
                rolePromises.push(this.loadRHStats(entrepriseId));
            }

            // Commercial
            if (this.hasRoleAccess(currentRoles, ['ADMIN', 'COMMERCIAL', 'DIRECTEUR'])) {
                rolePromises.push(this.loadCommercialStats(entrepriseId));
                rolePromises.push(this.loadTopClients(entrepriseId));
                rolePromises.push(this.loadCAByMoisChart(entrepriseId));
            }

            // Logistique
            if (this.hasRoleAccess(currentRoles, ['ADMIN', 'MAGASINIER', 'MATERIEL', 'CHEF_CHANTIER'])) {
                rolePromises.push(this.loadLogistiqueStats(entrepriseId));
            }

            // Tous les rôles - activité récente
            rolePromises.push(this.loadActiviteRecente(entrepriseId));

            await Promise.all(rolePromises);
        } catch (error) {
            console.error('Erreur chargement dashboard:', error);
            showToast('Erreur lors du chargement du tableau de bord', 'error');
        } finally {
            this.updateDashboardVisibility();
        }
    }

    /**
     * Vérifier si l'utilisateur a accès selon ses rôles
     */
    hasRoleAccess(userRoles, allowedRoles) {
        return userRoles.some(role => allowedRoles.includes(role));
    }

    updateDashboardVisibility() {
        const showChantiers = hasAccess('chantiers');
        const showEmployes = hasAccess('employes') || hasPermission('list', 'employes') || hasPermission('list', 'pointages');
        const showStocks = hasAccess('stocks') || hasPermission('articles', 'list') || hasPermission('mouvements', 'list');
        const showFinances = hasAccess('finances') || hasPermission('list', 'factures') || hasPermission('list', 'depenses');
        const showAlertes = hasAccess('alertes') || hasPermission('list', 'alertes');
        const showQuickActions = showChantiers || showEmployes || showStocks || showFinances || showAlertes;

        const canCreateChantier = hasPermission('create', 'chantiers');
        const canCreateDevis = hasPermission('create', 'devis');
        const canCreateEmploye = hasPermission('create', 'employes');
        const canCreateArticle = hasPermission('create', 'articles');
        const canSync = hasPermission('sync', 'sync');

        document.getElementById('kpiChantiersActifs')?.closest('.col-xl-3')?.classList.toggle('d-none', !showChantiers);
        document.getElementById('kpiEmployesPresents')?.closest('.col-xl-3')?.classList.toggle('d-none', !showEmployes);
        document.getElementById('kpiStocksAlerte')?.closest('.col-xl-3')?.classList.toggle('d-none', !showStocks);
        document.getElementById('kpiCAMois')?.closest('.col-xl-3')?.classList.toggle('d-none', !showFinances);
        document.getElementById('alertesCount')?.closest('.card')?.classList.toggle('d-none', !showAlertes);
        document.getElementById('topChantiersList')?.closest('.card')?.classList.toggle('d-none', !showChantiers);
        document.getElementById('topChantiersCard')?.classList.toggle('d-none', !showChantiers);
        document.getElementById('activiteRecenteList')?.closest('.card')?.classList.toggle('d-none', !showQuickActions);
        document.getElementById('quickActionsCard')?.classList.toggle('d-none', !showQuickActions);

        // Factures en retard - visible pour rôles financiers
        const showFacturesRetard = hasAccess('finances') || hasPermission('list', 'factures');
        document.getElementById('facturesRetardCard')?.classList.toggle('d-none', !showFacturesRetard);

        // Graphique CA - visible pour rôles financiers
        document.getElementById('cardCAChart')?.classList.toggle('d-none', !showFinances);

        // Graphiques RH, Commercial, Logistique
        const roles = window.AppState?.roles || [window.AppState?.roleCode || 'ADMIN'];
        document.getElementById('cardRHChart')?.classList.toggle('d-none', !this.hasRoleAccess(roles, ['ADMIN', 'RH', 'DIRECTEUR']));
        document.getElementById('cardCommercialChart')?.classList.toggle('d-none', !this.hasRoleAccess(roles, ['ADMIN', 'COMMERCIAL', 'DIRECTEUR']));
        document.getElementById('cardCAByMoisChart')?.classList.toggle('d-none', !this.hasRoleAccess(roles, ['ADMIN', 'COMMERCIAL', 'DIRECTEUR', 'COMPTABLE']));
        document.getElementById('cardLogistiqueChart')?.classList.toggle('d-none', !this.hasRoleAccess(roles, ['ADMIN', 'MAGASINIER', 'MATERIEL', 'CHEF_CHANTIER']));

        document.querySelector('[data-route="chantiers/nouveau"]')?.classList.toggle('d-none', !canCreateChantier);
        document.querySelector('[data-route="devis/nouveau"]')?.classList.toggle('d-none', !canCreateDevis);
        document.querySelector('[data-route="employes/nouveau"]')?.classList.toggle('d-none', !canCreateEmploye);
        document.querySelector('[data-route="stocks/nouveau"]')?.classList.toggle('d-none', !canCreateArticle);
        document.getElementById('btnQuickSync')?.classList.toggle('d-none', !canSync);

        // Top clients visible pour commercial
        const showTopClients = hasAccess('clients') || hasPermission('list', 'clients');
        document.getElementById('topClientsCard')?.classList.toggle('d-none', !showTopClients);
    }

    /**
     * Charger les KPIs principaux
     */
    async loadKPIs(entrepriseId) {
        try {
            const stats = await window.api.dashboard.invoke('stats', entrepriseId);

            // Chantiers
            const chantiersActifs = stats.chantiers?.enCours || 0;
            const chantiersTotal = stats.chantiers?.total || 0;
            document.getElementById('kpiChantiersActifs').textContent = chantiersActifs;
            document.getElementById('kpiChantiersTotal').textContent = chantiersTotal;
            const chantiersPct = chantiersTotal > 0 ? Math.round(chantiersActifs / chantiersTotal * 100) : 0;
            document.getElementById('kpiChantiersProgress').style.width = `${Math.min(chantiersPct, 100)}%`;

            // Employés
            const employesPresents = stats.employes?.presentsToday || 0;
            const employesTotal = stats.employes?.actifs || stats.employes?.total || 0;
            document.getElementById('kpiEmployesPresents').textContent = employesPresents;
            document.getElementById('kpiEmployesTotal').textContent = employesTotal;
            const employesPct = employesTotal > 0 ? Math.round(employesPresents / employesTotal * 100) : 0;
            document.getElementById('kpiEmployesProgress').style.width = `${Math.min(employesPct, 100)}%`;

            // Stocks alerte
            document.getElementById('kpiStocksAlerte').textContent = stats.stocksAlerte || 0;
            document.getElementById('kpiStocksValeur').textContent = this.formatCurrency(stats.stocksValeur || 0);

            // Finances
            document.getElementById('kpiCAMois').textContent = this.formatCurrency(stats.caMois || 0);
            const facturesRetardCount = stats.facturesRetard?.count || 0;
            const facturesRetardMontant = stats.facturesRetard?.montantDu || 0;
            document.getElementById('kpiFacturesRetard').textContent = `${facturesRetardCount} (${this.formatCurrency(facturesRetardMontant)})`;
            const facturesPct = stats.facturesRetard?.count > 0 ? 100 : 0; // Simplifié
            document.getElementById('kpiFacturesProgress').style.width = `${facturesPct}%`;

            // Alertes count dans le badge
            document.getElementById('alertesCount').textContent = stats.alertesNonLues || 0;

        } catch (error) {
            console.error('Erreur chargement KPIs:', error);
        }
    }

    /**
     * Charger l'évolution du CA pour le graphique
     */
    async loadCAEvolution(entrepriseId) {
        try {
            const data = await window.api.dashboard.invoke('getCAEvolution', entrepriseId);
            this.renderCAChart(data);
        } catch (error) {
            console.error('Erreur chargement CA évolution:', error);
            document.getElementById('caChartEmpty').style.display = 'block';
            document.getElementById('caChart').style.display = 'none';
        }
    }

    /**
     * Rendre le graphique CA avec Chart.js
     */
    renderCAChart(data) {
        const canvas = document.getElementById('caChart');
        const emptyState = document.getElementById('caChartEmpty');

        if (!canvas) return;

        if (!data || data.length === 0) {
            emptyState.style.display = 'block';
            canvas.style.display = 'none';
            return;
        }

        emptyState.style.display = 'none';
        canvas.style.display = 'block';

        const labels = data.map(d => {
            const [year, month] = d.mois.split('-');
            return new Date(year, month - 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
        });
        const values = data.map(d => d.ca || 0);

        // Détruire l'ancien graphique si existe
        if (this.chart) {
            this.chart.destroy();
        }

        // Vérifier si Chart.js est disponible
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js non chargé, graphique non affiché');
            canvas.style.display = 'none';
            emptyState.innerHTML = '<i class="bi bi-graph-up display-1 text-secondary"></i><p class="text-secondary mt-2">Chart.js non chargé</p>';
            emptyState.style.display = 'block';
            return;
        }

        const ctx = canvas.getContext('2d');
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: `CA (${window.getCurrencySymbol ? window.getCurrencySymbol() : 'Ar'})`,
                    data: values,
                    borderColor: '#0d6efd',
                    backgroundColor: 'rgba(13, 110, 253, 0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => `CA: ${this.formatCurrency(context.raw)}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => this.formatCurrency(value)
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
    }

    /**
     * Charger les alertes non lues
     */
    async loadAlertes(entrepriseId) {
        try {
            const alertes = await window.api.alertes.invoke('nonLues', entrepriseId, 10);
            this.renderAlertes(alertes);
        } catch (error) {
            console.error('Erreur chargement alertes:', error);
        }
    }

    /**
     * Charger les factures en retard pour le dashboard financier
     */
    async loadFacturesRetard(entrepriseId) {
        try {
            const factures = await window.api.dashboard.invoke('getFacturesRetard', entrepriseId);
            this.renderFacturesRetard(factures);
        } catch (error) {
            console.error('Erreur chargement factures en retard:', error);
        }
    }

    /**
     * Rendre les factures en retard
     */
    renderFacturesRetard(factures) {
        const container = document.getElementById('facturesRetardList');
        const emptyState = document.getElementById('facturesRetardEmpty');

        if (!container) return;

        if (!factures || factures.length === 0) {
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';

        container.innerHTML = factures.map(f => `
            <div class="list-group-item list-group-item-action px-3 py-2 border-0">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <div class="fw-semibold small">${this.escapeHtml(f.numero || `FAC-${f.id}`)}</div>
                        <small class="text-secondary">${this.escapeHtml(f.clientNom || 'Client inconnu')}</small>
                    </div>
                    <div class="text-end">
                        <div class="fw-semibold text-danger">${this.formatCurrency(f.montantDu || 0)}</div>
                        <small class="text-danger">${this.calculateDaysLate(f.dateEcheance)}j de retard</small>
                    </div>
                </div>
            </div>
        `).join('');
    }

    calculateDaysLate(dateEcheance) {
        if (!dateEcheance) return 0;
        const today = new Date();
        const echeance = new Date(dateEcheance);
        const diffTime = today - echeance;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    /**
     * Rendre la liste des alertes
     */
    renderAlertes(alertes) {
        const container = document.getElementById('alertesList');
        const emptyState = document.getElementById('alertesEmpty');

        if (!container) return;

        if (!alertes || alertes.length === 0) {
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';

        const graviteIcons = {
            critique: 'bi-exclamation-octagon text-danger',
            elevee: 'bi-exclamation-triangle text-warning',
            moyenne: 'bi-info-circle text-info',
            info: 'bi-bell text-primary',
            default: 'bi-bell text-secondary'
        };

        container.innerHTML = alertes.map(alerte => `
            <div class="list-group-item list-group-item-action px-3 py-2 border-0" data-id="${alerte.id}">
                <div class="d-flex gap-2">
                    <i class="bi ${graviteIcons[alerte.niveauGravite] || graviteIcons.default} fs-5 mt-1"></i>
                    <div class="flex-grow-1 min-w-0">
                        <div class="fw-semibold small">${this.escapeHtml(alerte.message)}</div>
                        <small class="text-secondary">${this.formatDateTime(alerte.dateAlerte)}</small>
                    </div>
                </div>
            </div>
        `).join('');

        // Clic sur alerte -> marquer comme lue
        container.querySelectorAll('[data-id]').forEach(item => {
            item.addEventListener('click', async (e) => {
                const id = parseInt(e.currentTarget.dataset.id);
                await window.api.alertes.invoke('marquerLue', id);
                e.currentTarget.remove();
                const count = container.querySelectorAll('[data-id]').length;
                document.getElementById('alertesCount').textContent = count;
                if (count === 0) emptyState.style.display = 'block';
            });
        });
    }

    /**
     * Charger le top 5 chantiers par budget
     */
    async loadTopChantiers(entrepriseId) {
        try {
            const chantiers = await window.api.dashboard.invoke('getTopChantiersBudget', entrepriseId);
            this.renderTopChantiers(chantiers);
        } catch (error) {
            console.error('Erreur chargement top chantiers:', error);
        }
    }

    /**
     * Rendre le top chantiers
     */
    renderTopChantiers(chantiers) {
        const container = document.getElementById('topChantiersList');
        const emptyState = document.getElementById('topChantiersEmpty');

        if (!container) return;

        if (!chantiers || chantiers.length === 0) {
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';

        container.innerHTML = chantiers.map((c, index) => `
            <a href="#chantiers/${c.id}/detail" class="list-group-item list-group-item-action px-3 py-2 border-0" data-route="chantiers/${c.id}/detail">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <span class="badge bg-secondary me-2">#${index + 1}</span>
                        <span class="fw-semibold small">${this.escapeHtml(c.nom)}</span>
                    </div>
                    <div class="text-end">
                        <div class="fw-semibold small">${this.formatCurrency(c.budgetPrevisionnel || 0)}</div>
                        <small class="text-${(c.pctBudget || 0) > 100 ? 'danger' : 'success'}">${c.pctBudget ? Math.round(c.pctBudget) : 0}%</small>
                    </div>
                </div>
            </a>
        `).join('');
    }

    /**
     * Charger l'activité récente
     */
    async loadActiviteRecente(entrepriseId) {
        try {
            const activites = await window.api.dashboard.invoke('getActiviteRecente', entrepriseId, 10);
            this.renderActiviteRecente(activites);
        } catch (error) {
            console.error('Erreur chargement activité:', error);
        }
    }

    /**
     * Rendre l'activité récente
     */
    renderActiviteRecente(activites) {
        const container = document.getElementById('activiteRecenteList');
        const emptyState = document.getElementById('activiteEmpty');

        if (!container) return;

        if (!activites || activites.length === 0) {
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';

        const typeIcons = {
            chantier: 'bi-building text-primary',
            devis: 'bi-file-earmark-text text-info',
            incident: 'bi-exclamation-triangle text-danger',
            facture: 'bi-receipt text-warning'
        };

        container.innerHTML = activites.map(a => `
            <a href="#${a.type}s/${a.id}/detail" class="list-group-item list-group-item-action px-3 py-2 border-0" data-route="${a.type}s/${a.id}/detail">
                <div class="d-flex gap-3">
                    <div class="activity-icon bg-${a.couleur || 'secondary'} bg-opacity-10 text-${a.couleur || 'secondary'} rounded-circle p-2 d-flex align-items-center justify-content-center" style="width: 40px; height: 40px; flex-shrink: 0;">
                        <i class="bi ${typeIcons[a.type] || 'bi-circle'}"></i>
                    </div>
                    <div class="flex-grow-1 min-w-0">
                        <div class="d-flex justify-content-between">
                            <span class="fw-semibold small">${this.escapeHtml(a.titre)}</span>
                            <small class="text-secondary">${this.formatDate(a.date)}</small>
                        </div>
                        <small class="text-secondary">${this.escapeHtml(a.description)}</small>
                    </div>
                </div>
            </a>
        `).join('');
    }

    /**
     * Charger les stats RH
     */
    async loadRHStats(entrepriseId) {
        try {
            const result = await window.api.dashboard.invoke('getRHStats', entrepriseId);
            if (result.success) {
                const data = result.data;
                document.getElementById('kpiCardsRH').classList.remove('d-none');
                
                if (document.getElementById('kpiRHEmployesActifs')) {
                    document.getElementById('kpiRHEmployesActifs').textContent = data.employesActifs || 0;
                }
                if (document.getElementById('kpiRHEquipesActives')) {
                    document.getElementById('kpiRHEquipesActives').textContent = data.equipesActives || 0;
                }
                if (document.getElementById('kpiRHHeuresSup')) {
                    const hsAttente = data.heuresSupAttente ? data.heuresSupAttente.count : 0;
                    document.getElementById('kpiRHHeuresSup').textContent = hsAttente;
                }

                this.renderRHChart(data);
            }
        } catch (error) {
            console.error('Erreur chargement stats RH:', error);
            document.getElementById('rhChartEmpty').style.display = 'block';
            document.getElementById('rhChart').style.display = 'none';
        }
    }

    renderRHChart(data) {
        const canvas = document.getElementById('rhChart');
        const emptyState = document.getElementById('rhChartEmpty');
        if (!canvas) return;

        if (!data || !data.pointagesMois || data.pointagesMois.length === 0) {
            emptyState.style.display = 'block';
            canvas.style.display = 'none';
            return;
        }

        emptyState.style.display = 'none';
        canvas.style.display = 'block';

        const labels = data.pointagesMois.map(d => d.type);
        const values = data.pointagesMois.map(d => d.count);

        if (this.rhChartInstance) this.rhChartInstance.destroy();

        if (typeof Chart === 'undefined') return;

        const ctx = canvas.getContext('2d');
        this.rhChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data: values,
                    backgroundColor: ['#198754', '#ffc107', '#dc3545', '#6c757d']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }

    /**
     * Charger les stats Commercial
     */
    async loadCommercialStats(entrepriseId) {
        try {
            const result = await window.api.dashboard.invoke('getCommercialStats', entrepriseId);
            if (result.success) {
                const data = result.data;
                document.getElementById('kpiCardsCommercial').classList.remove('d-none');

                if (document.getElementById('kpiComNouveauxClients')) {
                    document.getElementById('kpiComNouveauxClients').textContent = data.nouveauxClients || 0;
                }
                if (document.getElementById('kpiComDevisAttente')) {
                    document.getElementById('kpiComDevisAttente').textContent = data.devisEnAttente?.count || 0;
                }
                if (document.getElementById('kpiComFacturesImpayees')) {
                    const totalDu = data.facturesImpayees?.totalDu || 0;
                    document.getElementById('kpiComFacturesImpayees').textContent = this.formatCurrency(totalDu);
                }
                if (document.getElementById('kpiComTauxConversion')) {
                    document.getElementById('kpiComTauxConversion').textContent = (data.tauxConversion || 0) + '%';
                }

                this.renderCommercialChart(data);
            }
        } catch (error) {
            console.error('Erreur chargement stats Commercial:', error);
            document.getElementById('commercialChartEmpty').style.display = 'block';
            document.getElementById('commercialChart').style.display = 'none';
        }
    }

    renderCommercialChart(data) {
        const canvas = document.getElementById('commercialChart');
        const emptyState = document.getElementById('commercialChartEmpty');
        if (!canvas) return;

        if (!data || !data.devisParStatut || data.devisParStatut.length === 0) {
            emptyState.style.display = 'block';
            canvas.style.display = 'none';
            return;
        }

        emptyState.style.display = 'none';
        canvas.style.display = 'block';

        const labels = data.devisParStatut.map(d => d.statut);
        const values = data.devisParStatut.map(d => d.count);

        if (this.commercialChartInstance) this.commercialChartInstance.destroy();

        if (typeof Chart === 'undefined') return;

        const ctx = canvas.getContext('2d');
        this.commercialChartInstance = new Chart(ctx, {
            type: 'pie',
            data: {
                labels,
                datasets: [{
                    data: values,
                    backgroundColor: ['#0d6efd', '#198754', '#dc3545', '#ffc107', '#6c757d']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }

    /**
     * Charger le top 5 clients pour le dashboard commercial
     */
    async loadTopClients(entrepriseId) {
        try {
            const result = await window.api.dashboard.invoke('getTopClients', entrepriseId);
            if (result.success) {
                const data = result.data;
                document.getElementById('topClientsCard').classList.remove('d-none');
                this.renderTopClients(data);
            }
        } catch (error) {
            console.error('Erreur chargement top clients:', error);
        }
    }

    renderTopClients(clients) {
        const container = document.getElementById('topClientsList');
        const emptyState = document.getElementById('topClientsEmpty');
        if (!container) return;

        if (!clients || clients.length === 0) {
            emptyState.style.display = 'block';
            return;
        }
        emptyState.style.display = 'none';

        const maxCA = Math.max(...clients.map(c => c.caTotal || 0));

        container.innerHTML = clients.map((c, i) => {
            const nom = c.entreprise || c.nom || `Client #${c.id}`;
            const pct = maxCA > 0 ? Math.round((c.caTotal / maxCA) * 100) : 0;
            return `
                <div class="list-group-item list-group-item-action px-3 py-2 border-0">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="fw-semibold small text-truncate" style="max-width: 60%;">${this.escapeHtml(nom)}</span>
                        <span class="fw-bold small text-success">${this.formatCurrency(c.caTotal || 0)}</span>
                    </div>
                    <div class="progress" style="height: 4px;">
                        <div class="progress-bar bg-success" style="width: ${pct}%"></div>
                    </div>
                    <small class="text-secondary">${c.nbFactures || 0} facture(s)</small>
                </div>
            `;
        }).join('');
    }

    /**
     * Charger le CA par mois pour le graphique commercial
     */
    async loadCAByMoisChart(entrepriseId) {
        try {
            const result = await window.api.dashboard.invoke('getCAByMois', entrepriseId);
            if (result.success) {
                const data = result.data;
                document.getElementById('cardCAByMoisChart').classList.remove('d-none');
                this.renderCAByMoisChart(data);
            }
        } catch (error) {
            console.error('Erreur chargement CA par mois:', error);
            document.getElementById('caByMoisChartEmpty').style.display = 'block';
            document.getElementById('caByMoisChart').style.display = 'none';
        }
    }

    renderCAByMoisChart(data) {
        const canvas = document.getElementById('caByMoisChart');
        const emptyState = document.getElementById('caByMoisChartEmpty');
        if (!canvas) return;

        if (!data || data.length === 0) {
            emptyState.style.display = 'block';
            canvas.style.display = 'none';
            return;
        }

        emptyState.style.display = 'none';
        canvas.style.display = 'block';

        const labels = data.map(d => {
            const [year, month] = d.mois.split('-');
            return new Date(year, month - 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
        });
        const values = data.map(d => d.ca || 0);

        if (this.caByMoisChartInstance) this.caByMoisChartInstance.destroy();

        if (typeof Chart === 'undefined') return;

        const ctx = canvas.getContext('2d');
        this.caByMoisChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'CA',
                    data: values,
                    backgroundColor: 'rgba(13, 110, 253, 0.7)',
                    borderColor: '#0d6efd',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => `CA: ${this.formatCurrency(context.raw)}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => this.formatCurrency(value)
                        }
                    }
                }
            }
        });
    }

    /**
     * Charger les stats Logistique
     */
    async loadLogistiqueStats(entrepriseId) {
        try {
            const result = await window.api.dashboard.invoke('getLogistiqueStats', entrepriseId);
            if (result.success) {
                const data = result.data;
                document.getElementById('kpiCardsLogistique').classList.remove('d-none');

                if (document.getElementById('kpiLogValeurStock')) {
                    document.getElementById('kpiLogValeurStock').textContent = this.formatCurrency(data.valeurStock || 0);
                }
                if (document.getElementById('kpiLogArticlesAlerte')) {
                    document.getElementById('kpiLogArticlesAlerte').textContent = data.articlesAlerte || 0;
                }
                if (document.getElementById('kpiLogMateriels')) {
                    const totalMats = (data.materielsParEtat || []).reduce((acc, curr) => acc + curr.count, 0);
                    document.getElementById('kpiLogMateriels').textContent = totalMats;
                }

                this.renderLogistiqueChart(data);
            }
        } catch (error) {
            console.error('Erreur chargement stats Logistique:', error);
            document.getElementById('logistiqueChartEmpty').style.display = 'block';
            document.getElementById('logistiqueChart').style.display = 'none';
        }
    }

    renderLogistiqueChart(data) {
        const canvas = document.getElementById('logistiqueChart');
        const emptyState = document.getElementById('logistiqueChartEmpty');
        if (!canvas) return;

        if (!data || !data.topArticlesConsommes || data.topArticlesConsommes.length === 0) {
            emptyState.style.display = 'block';
            canvas.style.display = 'none';
            return;
        }

        emptyState.style.display = 'none';
        canvas.style.display = 'block';

        const labels = data.topArticlesConsommes.map(d => d.designation);
        const values = data.topArticlesConsommes.map(d => d.quantiteSortie);

        if (this.logistiqueChartInstance) this.logistiqueChartInstance.destroy();

        if (typeof Chart === 'undefined') return;

        const ctx = canvas.getContext('2d');
        this.logistiqueChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Quantité consommée',
                    data: values,
                    backgroundColor: '#0dcaf0'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }


    // Utilitaires - utiliser la fonction globale pour la devise dynamique
    formatCurrency(amount) {
        return window.formatCurrencyGlobal ? window.formatCurrencyGlobal(amount) : new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'MGA',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount || 0);
    }

    formatDate(dateStr) {
        if (!dateStr) return '—';
        const date = new Date(dateStr);
        return date.toLocaleDateString('fr-FR');
    }

    formatDateTime(dateStr) {
        if (!dateStr) return '—';
        const date = new Date(dateStr);
        return date.toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Instance globale
window.dashboardController = new DashboardController();