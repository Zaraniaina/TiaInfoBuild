/**
 * Rapports Financiers View Controller
 * Génère et affiche les rapports financiers consolidés
 */

class RapportsController {
    constructor() {
        this.periode = 'annee';
        this.dateDebut = null;
        this.dateFin = null;
        this.chantiersCache = [];
        this.clientsCache = [];
    }

    async init() {
        this.setDefaultPeriode();
        await Promise.all([this.loadChantiers(), this.loadClients()]);
        this.bindEvents();
        await this.genererRapport();
    }

    setDefaultPeriode() {
        const now = new Date();
        const year = now.getFullYear();
        this.dateDebut = `${year}-01-01`;
        this.dateFin = `${year}-12-31`;
        const debut = document.getElementById('rapportDateDebut');
        const fin = document.getElementById('rapportDateFin');
        if (debut) debut.value = this.dateDebut;
        if (fin) fin.value = this.dateFin;
    }
    
    formatCurrency(amount) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: window.getAppCurrency ? window.getAppCurrency() : 'MGA',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount || 0);
}
    async loadChantiers() {
        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;
            const result = await window.api.chantiers.invoke('list', { entrepriseId, limit: 1000 });
            this.chantiersCache = result.items || [];
        } catch (error) { console.error('Erreur chantiers:', error); }
    }

    async loadClients() {
        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;
            const result = await window.api.clients.invoke('list', { entrepriseId, limit: 1000 });
            this.clientsCache = Array.isArray(result) ? result : (result.items || []);
        } catch (error) { console.error('Erreur clients:', error); }
    }

    bindEvents() {
        const periodeSelect = document.getElementById('selectPeriodeRapport');
        if (periodeSelect) {
            periodeSelect.addEventListener('change', e => {
                this.periode = e.target.value;
                const persoPanel = document.getElementById('periodePersonnalisee');
                if (persoPanel) persoPanel.classList.toggle('d-none', this.periode !== 'personnalise');
                this.calculerPeriode();
                if (this.periode !== 'personnalise') this.genererRapport();
            });
        }

        document.getElementById('btnGenererRapport')?.addEventListener('click', () => this.genererRapport());
        document.getElementById('btnExportRapport')?.addEventListener('click', () => this.exportRapport());
        document.getElementById('btnAppliquePeriode')?.addEventListener('click', () => {
            this.dateDebut = document.getElementById('rapportDateDebut')?.value;
            this.dateFin = document.getElementById('rapportDateFin')?.value;
            this.genererRapport();
        });
    }

    calculerPeriode() {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const quarter = Math.floor(month / 3);

        switch (this.periode) {
            case 'mois':
                this.dateDebut = new Date(year, month, 1).toISOString().split('T')[0];
                this.dateFin = new Date(year, month + 1, 0).toISOString().split('T')[0];
                break;
            case 'trimestre':
                this.dateDebut = new Date(year, quarter * 3, 1).toISOString().split('T')[0];
                this.dateFin = new Date(year, (quarter + 1) * 3, 0).toISOString().split('T')[0];
                break;
            case 'annee':
                this.dateDebut = `${year}-01-01`;
                this.dateFin = `${year}-12-31`;
                break;
        }
    }

    async genererRapport() {
        this.showLoaders(true);
        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;

            // Charger les stats du dashboard
            let stats = {};
            try {
                stats = await window.api.dashboard.invoke('stats', entrepriseId) || {};
            } catch { /* ignore */ }

            // Charger les factures
            let factures = [];
            try {
                const resultF = await window.api.factures.invoke('list', { entrepriseId, limit: 1000 });
                factures = Array.isArray(resultF) ? resultF : (resultF.items || []);
            } catch { /* ignore */ }

            // Filtrer par période
            const filtrerParPeriode = (items, dateField) => {
                return items.filter(item => {
                    const d = item[dateField];
                    if (!d) return true;
                    return d >= this.dateDebut && d <= this.dateFin;
                });
            };

            const facturesPeriode = filtrerParPeriode(factures, 'dateFacture');

            // Charger dépenses
            let depenses = [];
            try {
                for (const chantier of this.chantiersCache.slice(0, 20)) {
                    const result = await window.api.depenses.invoke('byChantier', chantier.id);
                    const items = Array.isArray(result) ? result : (result.items || []);
                    depenses.push(...items.map(d => ({ ...d, chantier })));
                }
            } catch { /* ignore */ }
            const depensesPeriode = filtrerParPeriode(depenses, 'date');

            // Calculs KPIs
            const ca = facturesPeriode.reduce((s, f) => s + (parseFloat(f.montantTTC || f.montant || 0)), 0);
            const totalDepenses = depensesPeriode.reduce((s, d) => s + (parseFloat(d.montant) || 0), 0);
            const marge = ca - totalDepenses;
            const tauxMarge = ca > 0 ? ((marge / ca) * 100).toFixed(1) : 0;

            // Afficher KPIs
            document.getElementById('kpiChiffreAffaires').textContent = this.formatCurrency(ca);
            document.getElementById('kpiDepensesTotal').textContent = this.formatCurrency(totalDepenses);
            const margeEl = document.getElementById('kpiMargeBrute');
            if (margeEl) {
                margeEl.textContent = this.formatCurrency(marge);
                margeEl.className = `fs-2 fw-bold ${marge >= 0 ? 'text-success' : 'text-danger'}`;
            }
            const tauxEl = document.getElementById('kpiTauxMarge');
            if (tauxEl) {
                tauxEl.textContent = `${tauxMarge}%`;
                tauxEl.className = `fs-2 fw-bold ${tauxMarge >= 0 ? 'text-success' : 'text-danger'}`;
            }

            // Top chantiers
            this.renderTopChantiers(facturesPeriode, depensesPeriode);

            // Dépenses par catégorie
            this.renderDepensesCategorie(depensesPeriode);

            // Factures en retard
            this.renderFacturesEnRetard(factures);

            // Rapport mensuel
            this.renderRapportMensuel(facturesPeriode, depensesPeriode);

        } catch (error) {
            console.error('Erreur rapport:', error);
            showToast('Erreur lors de la génération du rapport', 'error');
        } finally {
            this.showLoaders(false);
        }
    }

    renderTopChantiers(factures, depenses) {
        const tbody = document.getElementById('topChantiersTable');
        if (!tbody) return;

        // Grouper par chantier
        const chantiersMap = new Map();
        this.chantiersCache.forEach(c => chantiersMap.set(c.id, { nom: c.nom, ca: 0, depenses: 0 }));
        factures.forEach(f => {
            const c = chantiersMap.get(f.chantierId);
            if (c) c.ca += parseFloat(f.montantTTC || f.montant || 0);
        });
        depenses.forEach(d => {
            const c = chantiersMap.get(d.chantierId);
            if (c) c.depenses += parseFloat(d.montant || 0);
        });

        const sorted = Array.from(chantiersMap.values())
            .filter(c => c.ca > 0 || c.depenses > 0)
            .sort((a, b) => b.ca - a.ca)
            .slice(0, 5);

        if (sorted.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-3 text-secondary">Aucune donnée</td></tr>';
            return;
        }

        tbody.innerHTML = sorted.map(c => {
            const marge = c.ca - c.depenses;
            return `
                <tr>
                    <td>${this.escapeHtml(c.nom)}</td>
                    <td class="text-end text-success">${this.formatCurrency(c.ca)}</td>
                    <td class="text-end text-danger">${this.formatCurrency(c.depenses)}</td>
                    <td class="text-end ${marge >= 0 ? 'text-success' : 'text-danger'} fw-bold">${this.formatCurrency(marge)}</td>
                </tr>
            `;
        }).join('');
    }

    renderDepensesCategorie(depenses) {
        const tbody = document.getElementById('depensesCategorieTable');
        if (!tbody) return;

        const total = depenses.reduce((s, d) => s + (parseFloat(d.montant) || 0), 0);
        const byCategorie = {};
        depenses.forEach(d => {
            const cat = d.categorie || 'autre';
            byCategorie[cat] = (byCategorie[cat] || 0) + (parseFloat(d.montant) || 0);
        });

        const sorted = Object.entries(byCategorie).sort(([, a], [, b]) => b - a);

        if (sorted.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center py-3 text-secondary">Aucune dépense</td></tr>';
            return;
        }

        tbody.innerHTML = sorted.map(([cat, montant]) => `
            <tr>
                <td><span class="badge bg-secondary">${this.escapeHtml(cat)}</span></td>
                <td class="text-end text-danger">${this.formatCurrency(montant)}</td>
                <td class="text-end">${total > 0 ? ((montant / total) * 100).toFixed(1) : 0}%</td>
            </tr>
        `).join('');
    }

    renderFacturesEnRetard(factures) {
        const tbody = document.getElementById('facturesEnRetardTable');
        if (!tbody) return;

        const today = new Date().toISOString().split('T')[0];
        const enRetard = factures.filter(f =>
            (f.statut === 'envoyee' || f.statut === 'en_retard') &&
            f.dateEcheance && f.dateEcheance < today
        ).slice(0, 10);

        if (enRetard.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-3 text-success">Aucune facture en retard</td></tr>';
            return;
        }

        tbody.innerHTML = enRetard.map(f => {
            const client = this.clientsCache.find(c => c.id === f.clientId);
            const retard = Math.floor((new Date() - new Date(f.dateEcheance)) / (1000 * 60 * 60 * 24));
            return `
                <tr>
                    <td><span class="badge bg-primary">${this.escapeHtml(f.numero || f.reference || `FAC-${f.id}`)}</span></td>
                    <td>${this.escapeHtml(client?.nom || client?.raisonSociale || '—')}</td>
                    <td class="text-end fw-bold text-danger">${this.formatCurrency(f.montantTTC || f.montant || 0)}</td>
                    <td class="text-end text-danger">${retard}j</td>
                </tr>
            `;
        }).join('');
    }

    renderRapportMensuel(factures, depenses) {
        const tbody = document.getElementById('rapportMensuelTable');
        if (!tbody) return;

        const moisData = {};
        const moisLabels = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

        factures.forEach(f => {
            const d = new Date(f.dateFacture || f.createdAt);
            if (isNaN(d)) return;
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!moisData[key]) moisData[key] = { ca: 0, depenses: 0, mois: d.getMonth(), annee: d.getFullYear() };
            moisData[key].ca += parseFloat(f.montantTTC || f.montant || 0);
        });

        depenses.forEach(d => {
            const date = new Date(d.date || d.dateDepense);
            if (isNaN(date)) return;
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (!moisData[key]) moisData[key] = { ca: 0, depenses: 0, mois: date.getMonth(), annee: date.getFullYear() };
            moisData[key].depenses += parseFloat(d.montant || 0);
        });

        const sorted = Object.entries(moisData).sort(([a], [b]) => a.localeCompare(b));

        if (sorted.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-3 text-secondary">Aucune donnée</td></tr>';
            return;
        }

        tbody.innerHTML = sorted.map(([key, data]) => {
            const marge = data.ca - data.depenses;
            const label = `${moisLabels[data.mois]} ${data.annee}`;
            return `
                <tr>
                    <td>${label}</td>
                    <td class="text-end text-success">${this.formatCurrency(data.ca)}</td>
                    <td class="text-end text-danger">${this.formatCurrency(data.depenses)}</td>
                    <td class="text-end ${marge >= 0 ? 'text-success' : 'text-danger'} fw-bold">${this.formatCurrency(marge)}</td>
                </tr>
            `;
        }).join('');
    }

    exportRapport() {
        const rows = [
            ['RAPPORT FINANCIER'],
            [`Période: ${this.dateDebut} au ${this.dateFin}`],
            [''],
            ['Chiffre d\'affaires', document.getElementById('kpiChiffreAffaires')?.textContent || ''],
            ['Dépenses totales', document.getElementById('kpiDepensesTotal')?.textContent || ''],
            ['Marge brute', document.getElementById('kpiMargeBrute')?.textContent || ''],
            ['Taux de marge', document.getElementById('kpiTauxMarge')?.textContent || '']
        ];

        const csv = rows.map(r => r.join(';')).join('\n');
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rapport_financier_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    showLoaders(show) {
        const loaderText = show ? 'Chargement...' : 'Aucune donnée';
        ['topChantiersTable', 'depensesCategorieTable', 'facturesEnRetardTable', 'rapportMensuelTable'].forEach(id => {
            const tbody = document.getElementById(id);
            if (tbody && show) {
                const cols = id === 'topChantiersTable' ? 4 : id === 'depensesCategorieTable' ? 3 : 4;
                tbody.innerHTML = `<tr><td colspan="${cols}" class="text-center py-3 text-secondary">${loaderText}</td></tr>`;
            }
        });
    }

    formatCurrency(n) { return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0); }
    escapeHtml(str) { if (!str) return ''; return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
}

window.rapportsController = new RapportsController();
