/**
 * Dépenses View Controller
 * Gère la liste, saisie et validation des dépenses par chantier/catégorie
 */

class DepensesController {
    constructor() {
        this.currentPage = 1;
        this.pageSize = 20;
        this.filters = { search: '', categorie: '', statut: '', chantierId: '', mois: '' };
        this.depensesData = [];
        this.chantiersCache = [];
        this.depenseEnEdition = null;
    }

    async init() {
        await this.loadChantiers();
        this.setDefaultMois();
        this.bindEvents();
        await this.loadDepenses();
    }

    setDefaultMois() {
        const now = new Date();
        const mois = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const el = document.getElementById('filterMoisDepense');
        if (el) { el.value = mois; this.filters.mois = mois; }
    }

    async loadChantiers() {
        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;
            const result = await window.api.chantiers.invoke('list', { entrepriseId, limit: 1000 });
            this.chantiersCache = result.items || [];
            this.populateChantierSelects();
        } catch (error) { console.error('Erreur chantiers:', error); }
    }
    formatCurrency(amount) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: window.getAppCurrency ? window.getAppCurrency() : 'MGA',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount || 0);
}
    populateChantierSelects() {
        ['filterChantierDepense', 'depenseChantier'].forEach(id => {
            const select = document.getElementById(id);
            if (!select) return;
            const current = select.value;
            select.innerHTML = id === 'filterChantierDepense'
                ? '<option value="">Tous les chantiers</option>'
                : '<option value="">Sélectionner un chantier</option>';
            this.chantiersCache.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = c.nom || `Chantier #${c.id}`;
                select.appendChild(opt);
            });
            select.value = current;
        });
    }

    bindEvents() {
        let debounce;
        document.getElementById('searchDepense')?.addEventListener('input', e => {
            clearTimeout(debounce);
            debounce = setTimeout(() => { this.filters.search = e.target.value; this.currentPage = 1; this.renderFiltered(); }, 300);
        });
        document.getElementById('filterCategorieDepense')?.addEventListener('change', e => { this.filters.categorie = e.target.value; this.currentPage = 1; this.renderFiltered(); });
        document.getElementById('filterStatutDepense')?.addEventListener('change', e => { this.filters.statut = e.target.value; this.currentPage = 1; this.renderFiltered(); });
        document.getElementById('filterChantierDepense')?.addEventListener('change', e => { this.filters.chantierId = e.target.value; this.currentPage = 1; this.renderFiltered(); });
        document.getElementById('filterMoisDepense')?.addEventListener('change', e => { this.filters.mois = e.target.value; this.loadDepenses(); });

        document.getElementById('btnNouvelleDepense')?.addEventListener('click', () => this.openModalNouveau());
        document.getElementById('btnFirstDepense')?.addEventListener('click', () => this.openModalNouveau());
        document.getElementById('btnRefreshDepenses')?.addEventListener('click', () => this.loadDepenses());
        document.getElementById('btnExportDepenses')?.addEventListener('click', () => this.exportDepenses());

        document.getElementById('formDepense')?.addEventListener('submit', e => this.handleSubmit(e));
        document.getElementById('btnDeleteDepense')?.addEventListener('click', () => this.confirmDelete());
        document.getElementById('btnConfirmDeleteDepense')?.addEventListener('click', () => this.executeDelete());
        document.getElementById('btnValiderDepense')?.addEventListener('click', () => this.validerDepense());
    }

    async loadDepenses() {
        this.showLoader(true);
        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;
            let allDepenses = [];

            if (this.filters.chantierId) {
                const result = await window.api.depenses.invoke('byChantier', parseInt(this.filters.chantierId));
                allDepenses = Array.isArray(result) ? result : (result.items || []);
            } else {
                // Charger les dépenses de tous les chantiers
                for (const chantier of this.chantiersCache.slice(0, 30)) {
                    try {
                        const result = await window.api.depenses.invoke('byChantier', chantier.id);
                        const items = Array.isArray(result) ? result : (result.items || []);
                        allDepenses.push(...items.map(d => ({ ...d, chantier })));
                    } catch { /* ignore */ }
                }
                // Charger aussi les dépenses en attente de validation
                try {
                    const enAttente = await window.api.depenses.invoke('enAttenteValidation', entrepriseId);
                    const enAttenteArr = Array.isArray(enAttente) ? enAttente : [];
                    enAttenteArr.forEach(d => {
                        if (!allDepenses.find(ad => ad.id === d.id)) allDepenses.push(d);
                    });
                } catch { /* ignore */ }
            }

            // Dédoublonner
            const seen = new Set();
            this.depensesData = allDepenses.filter(d => { const k = d.id; if (seen.has(k)) return false; seen.add(k); return true; });

            // Filtre mois
            if (this.filters.mois) {
                const [y, m] = this.filters.mois.split('-');
                this.depensesData = this.depensesData.filter(d => {
                    const date = new Date(d.date || d.dateDepense || '');
                    return date.getFullYear() === parseInt(y) && (date.getMonth() + 1) === parseInt(m);
                });
            }

            this.updateKPIs();
            this.renderFiltered();
        } catch (error) {
            console.error('Erreur dépenses:', error);
            showToast('Erreur lors du chargement des dépenses', 'error');
        } finally {
            this.showLoader(false);
        }
    }

    updateKPIs() {
        const total = this.depensesData.reduce((s, d) => s + (parseFloat(d.montant) || 0), 0);
        const enAttente = this.depensesData.filter(d => d.statut === 'en_attente').length;
        const validees = this.depensesData.filter(d => d.statut === 'validee' || d.statut === 'payee').length;
        const chantiersUniques = new Set(this.depensesData.map(d => d.chantierId).filter(Boolean)).size;

        document.getElementById('kpiDepensesTotal').textContent = this.formatCurrency(total);
        document.getElementById('kpiDepensesEnAttente').textContent = enAttente;
        document.getElementById('kpiDepensesValidees').textContent = validees;
        document.getElementById('kpiNbChantiers').textContent = chantiersUniques;
    }

    renderFiltered() {
        let filtered = this.depensesData;
        if (this.filters.search) {
            const s = this.filters.search.toLowerCase();
            filtered = filtered.filter(d => (d.description || d.libelle || '').toLowerCase().includes(s) || (d.fournisseur || '').toLowerCase().includes(s));
        }
        if (this.filters.categorie) filtered = filtered.filter(d => d.categorie === this.filters.categorie);
        if (this.filters.statut) filtered = filtered.filter(d => d.statut === this.filters.statut);
        if (this.filters.chantierId) filtered = filtered.filter(d => String(d.chantierId) === String(this.filters.chantierId));

        const start = (this.currentPage - 1) * this.pageSize;
        this.renderTable(filtered.slice(start, start + this.pageSize));
        this.renderPagination(filtered.length);
        this.toggleEmptyState(filtered.length === 0);
    }

    renderTable(items) {
        const tbody = document.getElementById('depensesTbody');
        if (!tbody) return;
        if (items.length === 0) { tbody.innerHTML = ''; return; }

        const statutConfig = {
            'en_attente': { class: 'bg-warning text-dark', label: 'En attente' },
            'validee': { class: 'bg-success', label: 'Validée' },
            'refusee': { class: 'bg-danger', label: 'Refusée' },
            'payee': { class: 'bg-primary', label: 'Payée' }
        };

        tbody.innerHTML = items.map((d, i) => {
            const chantier = d.chantier || this.chantiersCache.find(c => c.id === d.chantierId);
            const st = statutConfig[d.statut] || { class: 'bg-secondary', label: d.statut || '—' };
            return `
                <tr data-id="${d.id}">
                    <td>${(this.currentPage - 1) * this.pageSize + i + 1}</td>
                    <td>${this.formatDate(d.date || d.dateDepense)}</td>
                    <td>
                        <div class="fw-semibold">${this.escapeHtml(d.description || d.libelle || '—')}</div>
                        ${d.numeroFacture ? `<small class="text-secondary">${this.escapeHtml(d.numeroFacture)}</small>` : ''}
                    </td>
                    <td><span class="badge bg-secondary">${this.escapeHtml(d.categorie || '—')}</span></td>
                    <td class="fw-semibold text-danger">${this.formatCurrency(d.montant)}</td>
                    <td>${this.escapeHtml(chantier?.nom || '—')}</td>
                    <td>${this.escapeHtml(d.fournisseur || '—')}</td>
                    <td><span class="badge ${st.class}">${st.label}</span></td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary btn-edit" data-id="${d.id}" title="Modifier"><i class="bi bi-pencil"></i></button>
                            ${d.statut === 'en_attente' ? `<button class="btn btn-outline-success btn-validate" data-id="${d.id}" title="Valider"><i class="bi bi-check"></i></button>` : ''}
                            <button class="btn btn-outline-danger btn-delete" data-id="${d.id}" title="Supprimer"><i class="bi bi-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.querySelectorAll('.btn-edit').forEach(btn => btn.addEventListener('click', e => this.openModalEdition(e.currentTarget.dataset.id)));
        tbody.querySelectorAll('.btn-validate').forEach(btn => btn.addEventListener('click', e => this.validerDepenseDirecte(e.currentTarget.dataset.id)));
        tbody.querySelectorAll('.btn-delete').forEach(btn => btn.addEventListener('click', e => this.confirmDelete(e.currentTarget.dataset.id)));
    }

    renderPagination(total) {
        const container = document.getElementById('depensesPagination');
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
        document.getElementById('depensesEmpty')?.classList.toggle('d-none', !isEmpty);
        document.getElementById('depensesTable')?.classList.toggle('d-none', isEmpty);
    }

    openModalNouveau() {
        this.depenseEnEdition = null;
        document.getElementById('formDepense')?.reset();
        document.getElementById('depenseId').value = '';
        document.getElementById('depenseDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('depenseStatut').value = 'en_attente';
        document.getElementById('depenseTVA').value = '20';
        document.getElementById('modalDepenseLabel').innerHTML = '<i class="bi bi-cash-stack me-2"></i>Nouvelle dépense';
        document.getElementById('btnDeleteDepense').style.display = 'none';
        document.getElementById('btnValiderDepense').style.display = 'none';
        this.populateChantierSelects();
        new bootstrap.Modal(document.getElementById('modalDepense')).show();
    }

    openModalEdition(id) {
        const d = this.depensesData.find(d => String(d.id) === String(id));
        if (!d) { showToast('Dépense non trouvée', 'error'); return; }
        this.depenseEnEdition = d;
        document.getElementById('depenseId').value = d.id;
        document.getElementById('depenseDescription').value = d.description || d.libelle || '';
        document.getElementById('depenseMontant').value = d.montant || '';
        document.getElementById('depenseDate').value = d.date || d.dateDepense || '';
        document.getElementById('depenseCategorie').value = d.categorie || '';
        document.getElementById('depenseStatut').value = d.statut || 'en_attente';
        document.getElementById('depenseFournisseur').value = d.fournisseur || '';
        document.getElementById('depenseTVA').value = d.tauxTVA || '20';
        document.getElementById('depenseNumFacture').value = d.numeroFacture || '';
        document.getElementById('depenseModePaiement').value = d.modePaiement || '';
        document.getElementById('depenseNotes').value = d.notes || '';
        document.getElementById('modalDepenseLabel').innerHTML = '<i class="bi bi-cash-stack me-2"></i>Modifier la dépense';
        document.getElementById('btnDeleteDepense').style.display = 'inline-block';
        document.getElementById('btnDeleteDepense').dataset.id = id;
        document.getElementById('btnValiderDepense').style.display = d.statut === 'en_attente' ? 'inline-block' : 'none';
        this.populateChantierSelects();
        document.getElementById('depenseChantier').value = d.chantierId || '';
        new bootstrap.Modal(document.getElementById('modalDepense')).show();
    }

    async handleSubmit(e) {
        e.preventDefault();
        const form = e.target;
        if (!form.checkValidity()) { form.classList.add('was-validated'); return; }
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        const id = data.id;
        delete data.id;
        data.chantierId = parseInt(data.chantierId) || null;
        data.montant = parseFloat(data.montant) || 0;
        data.tauxTVA = parseFloat(data.tauxTVA) || 20;
        const entrepriseId = window.AppState?.entreprise?.id || 1;
        try {
            if (id) {
                await window.api.depenses.invoke('update', parseInt(id), data);
                showToast('Dépense modifiée', 'success');
            } else {
                await window.api.depenses.invoke('create', { ...data, entrepriseId });
                showToast('Dépense enregistrée', 'success');
            }
            bootstrap.Modal.getInstance(document.getElementById('modalDepense'))?.hide();
            await this.loadDepenses();
        } catch (error) {
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    async validerDepense() {
        if (!this.depenseEnEdition?.id) return;
        await this.validerDepenseDirecte(this.depenseEnEdition.id);
        bootstrap.Modal.getInstance(document.getElementById('modalDepense'))?.hide();
    }

    async validerDepenseDirecte(id) {
        try {
            await window.api.depenses.invoke('update', parseInt(id), { statut: 'validee' });
            showToast('Dépense validée', 'success');
            await this.loadDepenses();
        } catch (error) {
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    confirmDelete(id) {
        const dId = id || document.getElementById('btnDeleteDepense')?.dataset?.id;
        if (!dId) return;
        document.getElementById('btnConfirmDeleteDepense').dataset.id = dId;
        new bootstrap.Modal(document.getElementById('modalConfirmDeleteDepense')).show();
    }

    async executeDelete() {
        const id = document.getElementById('btnConfirmDeleteDepense').dataset.id;
        if (!id) return;
        try {
            await window.api.depenses.invoke('delete', parseInt(id));
            showToast('Dépense supprimée', 'success');
            bootstrap.Modal.getInstance(document.getElementById('modalConfirmDeleteDepense'))?.hide();
            bootstrap.Modal.getInstance(document.getElementById('modalDepense'))?.hide();
            await this.loadDepenses();
        } catch (error) {
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    exportDepenses() {
        const rows = [['ID', 'Date', 'Description', 'Catégorie', 'Montant', 'Chantier', 'Fournisseur', 'Statut']];
        this.depensesData.forEach(d => {
            const chantier = d.chantier || this.chantiersCache.find(c => c.id === d.chantierId);
            rows.push([d.id, d.date || d.dateDepense || '', d.description || d.libelle || '', d.categorie || '', d.montant || 0, chantier?.nom || '', d.fournisseur || '', d.statut || '']);
        });
        const csv = rows.map(r => r.join(';')).join('\n');
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `depenses_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    showLoader(show) {
        const table = document.getElementById('depensesTable');
        if (table) table.style.opacity = show ? '0.5' : '1';
    }

    formatDate(d) { if (!d) return '—'; try { return new Date(d).toLocaleDateString('fr-FR'); } catch { return d; } }
    formatCurrency(n) { return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0); }
    escapeHtml(str) { if (!str) return ''; return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
}

window.depensesController = new DepensesController();
