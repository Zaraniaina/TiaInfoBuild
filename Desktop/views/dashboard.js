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
        document.getElementById('caChart')?.closest('.card')?.classList.toggle('d-none', !showFinances);
        document.getElementById('caChartEmpty')?.closest('.card')?.classList.toggle('d-none', !showFinances);

        document.querySelector('[data-route="chantiers/nouveau"]')?.classList.toggle('d-none', !showChantiers);
        document.querySelector('[data-route="devis/nouveau"]')?.classList.toggle('d-none', !hasAccess('devis'));
        document.querySelector('[data-route="employes/nouveau"]')?.classList.toggle('d-none', !showEmployes);
        document.querySelector('[data-route="stocks/nouveau"]')?.classList.toggle('d-none', !showStocks);
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
                    label: 'CA (€)',
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