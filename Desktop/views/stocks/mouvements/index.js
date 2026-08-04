/**
 * Mouvements de Stock View Controller
 * Gère l'historique des entrées/sorties de matériaux
 */

class MouvementsController {
    constructor() {
        this.currentPage = 1;
        this.pageSize = 25;
        this.filters = { search: '', type: '', dateDebut: '', dateFin: '' };
        this.mouvementsData = [];
        this.articlesCache = [];
        this.chantiersCache = [];
    }

    async init() {
        await Promise.all([this.loadArticles(), this.loadChantiers()]);
        this.setDefaultDates();
        this.bindEvents();
        await this.loadMouvements();
    }

    setDefaultDates() {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        const dDebut = document.getElementById('filterDateDebutMouvement');
        const dFin = document.getElementById('filterDateFinMouvement');
        if (dDebut) { dDebut.value = firstDay; this.filters.dateDebut = firstDay; }
        if (dFin) { dFin.value = lastDay; this.filters.dateFin = lastDay; }
    }

    async loadArticles() {
        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;
            const result = await window.api.articles.invoke('list', { entrepriseId, limit: 1000 });
            this.articlesCache = Array.isArray(result) ? result : (result.items || []);
            this.populateArticleSelect();
        } catch (error) { console.error('Erreur articles:', error); }
    }
    formatCurrency(amount) {
        return window.formatCurrencyGlobal ? window.formatCurrencyGlobal(amount) : new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'MGA',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount || 0);
    }
    async loadChantiers() {
        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;
            const result = await window.api.chantiers.invoke('list', { entrepriseId, limit: 1000 });
            this.chantiersCache = result.items || [];
            this.populateChantierSelect();
        } catch (error) { console.error('Erreur chantiers:', error); }
    }

    populateArticleSelect() {
        const select = document.getElementById('mouvementArticle');
        if (!select) return;
        const current = select.value;
        select.innerHTML = '<option value="">Sélectionner un article</option>';
        this.articlesCache.forEach(a => {
            const opt = document.createElement('option');
            opt.value = a.id;
            opt.textContent = `${a.code ? a.code + ' — ' : ''}${a.designation || a.nom || `Article #${a.id}`}`;
            select.appendChild(opt);
        });
        select.value = current;
    }

    populateChantierSelect() {
        const select = document.getElementById('mouvementChantier');
        if (!select) return;
        const current = select.value;
        select.innerHTML = '<option value="">— Aucun —</option>';
        this.chantiersCache.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.nom || `Chantier #${c.id}`;
            select.appendChild(opt);
        });
        select.value = current;
    }

    bindEvents() {
        let debounce;
        document.getElementById('searchMouvement')?.addEventListener('input', e => {
            clearTimeout(debounce);
            debounce = setTimeout(() => { this.filters.search = e.target.value; this.currentPage = 1; this.renderFiltered(); }, 300);
        });
        document.getElementById('filterTypeMouvement')?.addEventListener('change', e => { this.filters.type = e.target.value; this.currentPage = 1; this.renderFiltered(); });
        document.getElementById('filterDateDebutMouvement')?.addEventListener('change', e => { this.filters.dateDebut = e.target.value; this.loadMouvements(); });
        document.getElementById('filterDateFinMouvement')?.addEventListener('change', e => { this.filters.dateFin = e.target.value; this.loadMouvements(); });
        document.getElementById('btnNouveauMouvement')?.addEventListener('click', () => this.openModalNouveau());
        document.getElementById('btnRefreshMouvements')?.addEventListener('click', () => this.loadMouvements());
        document.getElementById('btnExportMouvements')?.addEventListener('click', () => this.exportMouvements());
        document.getElementById('formMouvement')?.addEventListener('submit', e => this.handleSubmit(e));
    }

    async loadMouvements() {
        this.showLoader(true);
        try {
            const params = { dateDebut: this.filters.dateDebut, dateFin: this.filters.dateFin, limit: 1000 };
            const result = await window.api.mouvements.invoke('byPeriode', params);
            this.mouvementsData = Array.isArray(result) ? result : (result.items || []);
            this.updateKPIs();
            this.renderFiltered();
        } catch (error) {
            console.error('Erreur mouvements:', error);
            showToast('Erreur lors du chargement des mouvements', 'error');
        } finally {
            this.showLoader(false);
        }
    }

    updateKPIs() {
        const entrees = this.mouvementsData.filter(m => m.type === 'entree');
        const sorties = this.mouvementsData.filter(m => m.type === 'sortie');
        const articlesUniques = new Set(this.mouvementsData.map(m => m.articleId)).size;
        const valeur = this.mouvementsData.reduce((s, m) => {
            const qte = parseFloat(m.quantite) || 0;
            const pu = parseFloat(m.prixUnitaire) || 0;
            return s + (qte * pu);
        }, 0);
        document.getElementById('kpiEntrees').textContent = entrees.length;
        document.getElementById('kpiSorties').textContent = sorties.length;
        document.getElementById('kpiArticlesMouvements').textContent = articlesUniques;
        document.getElementById('kpiValeurMouvements').textContent = this.formatCurrency(valeur);
    }

    renderFiltered() {
        let filtered = this.mouvementsData;
        if (this.filters.search) {
            const s = this.filters.search.toLowerCase();
            filtered = filtered.filter(m => {
                const article = this.articlesCache.find(a => a.id === m.articleId);
                const chantier = this.chantiersCache.find(c => c.id === m.chantierId);
                return (article?.designation || article?.nom || '').toLowerCase().includes(s) ||
                    (chantier?.nom || '').toLowerCase().includes(s) ||
                    (m.motif || '').toLowerCase().includes(s);
            });
        }
        if (this.filters.type) filtered = filtered.filter(m => m.type === this.filters.type);

        const start = (this.currentPage - 1) * this.pageSize;
        this.renderTable(filtered.slice(start, start + this.pageSize));
        this.renderPagination(filtered.length);
        this.toggleEmptyState(filtered.length === 0);
    }

    renderTable(items) {
        const tbody = document.getElementById('mouvementsTbody');
        if (!tbody) return;
        if (items.length === 0) { tbody.innerHTML = ''; return; }

        const typeConfig = {
            'entree': { class: 'bg-success', label: 'Entrée', icon: 'bi-arrow-down-circle' },
            'sortie': { class: 'bg-danger', label: 'Sortie', icon: 'bi-arrow-up-circle' },
            'transfert': { class: 'bg-info', label: 'Transfert', icon: 'bi-arrow-left-right' },
            'ajustement': { class: 'bg-warning text-dark', label: 'Ajustement', icon: 'bi-sliders' },
            'retour': { class: 'bg-secondary', label: 'Retour', icon: 'bi-arrow-return-left' }
        };

        tbody.innerHTML = items.map((m, i) => {
            const article = this.articlesCache.find(a => a.id === m.articleId);
            const articleNom = article?.designation || article?.nom || `Article #${m.articleId}`;
            const chantier = this.chantiersCache.find(c => c.id === m.chantierId);
            const chantierNom = chantier?.nom || '—';
            const tc = typeConfig[m.type] || { class: 'bg-secondary', label: m.type || '—', icon: 'bi-question' };

            return `
                <tr data-id="${m.id}">
                    <td>${(this.currentPage - 1) * this.pageSize + i + 1}</td>
                    <td>${this.formatDate(m.dateMouvement || m.date)}</td>
                    <td><span class="badge ${tc.class}"><i class="bi ${tc.icon} me-1"></i>${tc.label}</span></td>
                    <td>
                        <div class="fw-semibold">${this.escapeHtml(articleNom)}</div>
                        ${article?.code ? `<small class="text-secondary">${this.escapeHtml(article.code)}</small>` : ''}
                    </td>
                    <td><span class="fw-bold">${parseFloat(m.quantite) || 0}</span></td>
                    <td><small class="text-secondary">${this.escapeHtml(m.unite || article?.unite || '—')}</small></td>
                    <td>${this.escapeHtml(chantierNom)}</td>
                    <td><small>${this.escapeHtml(m.motif || '—')}</small></td>
                    <td>
                        <button class="btn btn-sm btn-outline-danger btn-delete" data-id="${m.id}" title="Supprimer">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.querySelectorAll('.btn-delete').forEach(btn => btn.addEventListener('click', e => {
            if (confirm('Supprimer ce mouvement ?')) this.deleteMouvement(e.currentTarget.dataset.id);
        }));
    }

    renderPagination(total) {
        const container = document.getElementById('mouvementsPagination');
        if (!container) return;
        const totalPages = Math.ceil(total / this.pageSize);
        if (totalPages <= 1) { container.innerHTML = ''; return; }
        let html = '<nav><ul class="pagination pagination-sm mb-0">';
        html += `<li class="page-item ${this.currentPage === 1 ? 'disabled' : ''}"><a class="page-link" href="#" data-page="${this.currentPage - 1}"><i class="bi bi-chevron-left"></i></a></li>`;
        for (let i = Math.max(1, this.currentPage - 2); i <= Math.min(totalPages, this.currentPage + 2); i++) {
            html += `<li class="page-item ${i === this.currentPage ? 'active' : ''}"><a class="page-link" href="#" data-page="${i}">${i}</a></li>`;
        }
        html += `<li class="page-item ${this.currentPage === totalPages ? 'disabled' : ''}"><a class="page-link" href="#" data-page="${this.currentPage + 1}"><i class="bi bi-chevron-right"></i></a></li>`;
        html += '</ul></nav>';
        container.innerHTML = html;
        container.querySelectorAll('.page-link').forEach(link => {
            link.addEventListener('click', e => {
                e.preventDefault();
                const page = parseInt(e.currentTarget.dataset.page);
                if (page && page !== this.currentPage) { this.currentPage = page; this.renderFiltered(); }
            });
        });
    }

    toggleEmptyState(isEmpty) {
        document.getElementById('mouvementsEmpty')?.classList.toggle('d-none', !isEmpty);
        document.getElementById('mouvementsTable')?.classList.toggle('d-none', isEmpty);
    }

    openModalNouveau() {
        document.getElementById('formMouvement')?.reset();
        document.getElementById('mouvementId').value = '';
        document.getElementById('mouvementDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('modalMouvementLabel').innerHTML = '<i class="bi bi-arrow-left-right me-2"></i>Nouveau mouvement';
        this.populateArticleSelect();
        this.populateChantierSelect();
        new bootstrap.Modal(document.getElementById('modalMouvement')).show();
    }

    async handleSubmit(e) {
        e.preventDefault();
        const form = e.target;
        if (!form.checkValidity()) { form.classList.add('was-validated'); return; }
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        delete data.id;
        data.articleId = parseInt(data.articleId) || null;
        data.chantierId = parseInt(data.chantierId) || null;
        data.quantite = parseFloat(data.quantite) || 0;
        data.prixUnitaire = parseFloat(data.prixUnitaire) || 0;
        const entrepriseId = window.AppState?.entreprise?.id || 1;
        try {
            await window.api.mouvements.invoke('create', { ...data, entrepriseId });
            showToast('Mouvement enregistré', 'success');
            bootstrap.Modal.getInstance(document.getElementById('modalMouvement'))?.hide();
            await this.loadMouvements();
        } catch (error) {
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    async deleteMouvement(id) {
        try {
            await window.api.mouvements.invoke('delete', parseInt(id));
            showToast('Mouvement supprimé', 'success');
            await this.loadMouvements();
        } catch (error) {
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    exportMouvements() {
        const rows = [['ID', 'Date', 'Type', 'Article', 'Quantité', 'Unité', 'Chantier', 'Prix unitaire', 'Motif']];
        this.mouvementsData.forEach(m => {
            const article = this.articlesCache.find(a => a.id === m.articleId);
            const chantier = this.chantiersCache.find(c => c.id === m.chantierId);
            rows.push([m.id, m.dateMouvement || m.date || '', m.type || '', article?.designation || article?.nom || '', m.quantite || 0, m.unite || '', chantier?.nom || '', m.prixUnitaire || 0, m.motif || '']);
        });
        const csv = rows.map(r => r.join(';')).join('\n');
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mouvements_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    showLoader(show) {
        const table = document.getElementById('mouvementsTable');
        if (table) table.style.opacity = show ? '0.5' : '1';
    }

    formatDate(d) { if (!d) return '—'; try { return new Date(d).toLocaleDateString('fr-FR'); } catch { return d; } }
    formatCurrency(n) { return window.formatCurrencyGlobal ? window.formatCurrencyGlobal(n) : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'MGA', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0); }
    escapeHtml(str) { if (!str) return ''; return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
}

window.mouvementsController = new MouvementsController();
