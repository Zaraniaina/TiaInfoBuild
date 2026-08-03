/**
 * Heures Supplémentaires View Controller
 * Gère la liste, création, édition et validation des heures supplémentaires
 */

class HeuresSupController {
    constructor() {
        this.currentPage = 1;
        this.pageSize = 20;
        this.filters = { search: '', statut: '', mois: '', employeId: '' };
        this.hsEnEdition = null;
        this.hsData = [];
        this.employesCache = [];
        this.chantiersCache = [];
    }

    async init() {
        await this.loadEmployes();
        await this.loadChantiers();
        this.setDefaultMois();
        this.bindEvents();
        await this.loadHeuresSup();
    }

    setDefaultMois() {
        const now = new Date();
        const mois = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const filterMois = document.getElementById('filterMoisHS');
        if (filterMois) {
            filterMois.value = mois;
            this.filters.mois = mois;
        }
    }

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
            this.populateChantierSelects();
        } catch (error) {
            console.error('Erreur chargement chantiers:', error);
        }
    }

    populateEmployeSelects() {
        ['hsEmploye', 'filterEmployeHS'].forEach(id => {
            const select = document.getElementById(id);
            if (!select) return;
            const current = select.value;
            select.innerHTML = id === 'filterEmployeHS'
                ? '<option value="">Tous les employés</option>'
                : '<option value="">Sélectionner un employé</option>';
            this.employesCache.forEach(emp => {
                const opt = document.createElement('option');
                opt.value = emp.id;
                opt.textContent = `${emp.prenom} ${emp.nom}`;
                select.appendChild(opt);
            });
            select.value = current;
        });
    }

    populateChantierSelects() {
        const select = document.getElementById('hsChantier');
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
        // Recherche
        let debounce;
        document.getElementById('searchHS')?.addEventListener('input', e => {
            clearTimeout(debounce);
            debounce = setTimeout(() => { this.filters.search = e.target.value; this.currentPage = 1; this.renderFiltered(); }, 300);
        });
        document.getElementById('filterStatutHS')?.addEventListener('change', e => { this.filters.statut = e.target.value; this.currentPage = 1; this.renderFiltered(); });
        document.getElementById('filterMoisHS')?.addEventListener('change', e => { this.filters.mois = e.target.value; this.loadHeuresSup(); });
        document.getElementById('filterEmployeHS')?.addEventListener('change', e => { this.filters.employeId = e.target.value; this.currentPage = 1; this.renderFiltered(); });

        // Boutons
        document.getElementById('btnNouvelleHS')?.addEventListener('click', () => this.openModalNouveau());
        document.getElementById('btnFirstHS')?.addEventListener('click', () => this.openModalNouveau());
        document.getElementById('btnRefreshHS')?.addEventListener('click', () => this.loadHeuresSup());
        document.getElementById('btnExportHS')?.addEventListener('click', () => this.exportHS());

        // Formulaire
        document.getElementById('formHS')?.addEventListener('submit', e => this.handleSubmit(e));
        document.getElementById('btnDeleteHS')?.addEventListener('click', () => this.confirmDelete());
        document.getElementById('btnConfirmDeleteHS')?.addEventListener('click', () => this.executeDelete());
    }

    async loadHeuresSup() {
        this.showLoader(true);
        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;
            const params = { entrepriseId, limit: 1000 };
            if (this.filters.mois) {
                const [year, month] = this.filters.mois.split('-');
                params.dateDebut = `${year}-${month}-01`;
                const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
                params.dateFin = `${year}-${month}-${lastDay}`;
            }
            const result = await window.api.heuresSup.invoke('list', params);
            this.hsData = Array.isArray(result) ? result : (result.items || []);
            this.updateKPIs();
            this.renderFiltered();
        } catch (error) {
            console.error('Erreur chargement heures sup:', error);
            showToast('Erreur lors du chargement des heures supplémentaires', 'error');
        } finally {
            this.showLoader(false);
        }
    }

    updateKPIs() {
        const validees = this.hsData.filter(h => h.statut === 'validee' || h.statut === 'payee');
        const enAttente = this.hsData.filter(h => h.statut === 'en_attente');
        const totalHeures = this.hsData.reduce((sum, h) => sum + (parseFloat(h.nbHeures) || 0), 0);
        const montantTotal = this.hsData.reduce((sum, h) => {
            const emp = this.employesCache.find(e => e.id === h.employeId);
            const tauxHoraire = emp?.tauxHoraire || 0;
            const majoration = 1 + ((parseFloat(h.tauxMajoration) || 25) / 100);
            return sum + ((parseFloat(h.nbHeures) || 0) * tauxHoraire * majoration);
        }, 0);

        document.getElementById('kpiTotalHeures').textContent = totalHeures.toFixed(1) + 'h';
        document.getElementById('kpiEnAttente').textContent = enAttente.length;
        document.getElementById('kpiValidees').textContent = validees.length;
        document.getElementById('kpiMontantTotal').textContent = this.formatCurrency(montantTotal);
    }

    renderFiltered() {
        let filtered = this.hsData;
        if (this.filters.search) {
            const s = this.filters.search.toLowerCase();
            filtered = filtered.filter(h => {
                const emp = this.employesCache.find(e => e.id === h.employeId);
                return emp && (`${emp.prenom} ${emp.nom}`).toLowerCase().includes(s);
            });
        }
        if (this.filters.statut) filtered = filtered.filter(h => h.statut === this.filters.statut);
        if (this.filters.employeId) filtered = filtered.filter(h => String(h.employeId) === String(this.filters.employeId));

        const start = (this.currentPage - 1) * this.pageSize;
        const paginated = filtered.slice(start, start + this.pageSize);

        this.renderTable(paginated);
        this.renderPagination(filtered.length);
        this.toggleEmptyState(filtered.length === 0);
    }

    renderTable(items) {
        const tbody = document.getElementById('hsTbody');
        if (!tbody) return;
        if (items.length === 0) { tbody.innerHTML = ''; return; }

        const statutConfig = {
            'en_attente': { class: 'bg-warning text-dark', label: 'En attente' },
            'validee': { class: 'bg-success', label: 'Validée' },
            'refusee': { class: 'bg-danger', label: 'Refusée' },
            'payee': { class: 'bg-primary', label: 'Payée' }
        };

        tbody.innerHTML = items.map((h, i) => {
            const emp = this.employesCache.find(e => e.id === h.employeId);
            const empNom = emp ? `${emp.prenom} ${emp.nom}` : `Emp#${h.employeId}`;
            const chantier = this.chantiersCache.find(c => c.id === h.chantierId);
            const chantierNom = chantier?.nom || '—';
            const st = statutConfig[h.statut] || { class: 'bg-secondary', label: h.statut || '—' };

            return `
                <tr data-id="${h.id}">
                    <td>${(this.currentPage - 1) * this.pageSize + i + 1}</td>
                    <td>
                        <div class="fw-semibold">${this.escapeHtml(empNom)}</div>
                        <small class="text-secondary">${emp?.poste || ''}</small>
                    </td>
                    <td>${this.formatDate(h.date || h.dateHS)}</td>
                    <td>
                        <span class="badge bg-warning text-dark">${h.nbHeures}h</span>
                        <small class="text-secondary d-block">+${h.tauxMajoration || 25}%</small>
                    </td>
                    <td>${this.escapeHtml(chantierNom)}</td>
                    <td><small>${this.escapeHtml(h.motif || '—')}</small></td>
                    <td><span class="badge ${st.class}">${st.label}</span></td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary btn-edit" data-id="${h.id}" title="Modifier">
                                <i class="bi bi-pencil"></i>
                            </button>
                            ${h.statut === 'en_attente' ? `
                            <button class="btn btn-outline-success btn-validate" data-id="${h.id}" title="Valider">
                                <i class="bi bi-check"></i>
                            </button>` : ''}
                            <button class="btn btn-outline-danger btn-delete" data-id="${h.id}" title="Supprimer">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.querySelectorAll('.btn-edit').forEach(btn => btn.addEventListener('click', e => this.openModalEdition(e.currentTarget.dataset.id)));
        tbody.querySelectorAll('.btn-validate').forEach(btn => btn.addEventListener('click', e => this.validerHS(e.currentTarget.dataset.id)));
        tbody.querySelectorAll('.btn-delete').forEach(btn => btn.addEventListener('click', e => this.confirmDelete(e.currentTarget.dataset.id)));
    }

    renderPagination(total) {
        const container = document.getElementById('hsPagination');
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
                if (page && page !== this.currentPage && page >= 1 && page <= totalPages) {
                    this.currentPage = page;
                    this.renderFiltered();
                }
            });
        });
    }

    toggleEmptyState(isEmpty) {
        document.getElementById('hsEmpty')?.classList.toggle('d-none', !isEmpty);
        document.getElementById('hsTable')?.classList.toggle('d-none', isEmpty);
    }

    openModalNouveau() {
        this.hsEnEdition = null;
        document.getElementById('formHS')?.reset();
        document.getElementById('hsId').value = '';
        document.getElementById('hsDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('hsStatut').value = 'en_attente';
        document.getElementById('hsTauxMajoration').value = '25';
        document.getElementById('modalHSLabel').innerHTML = '<i class="bi bi-clock-history me-2"></i>Saisir des heures supplémentaires';
        document.getElementById('btnDeleteHS').style.display = 'none';

        this.populateEmployeSelects();
        this.populateChantierSelects();
        new bootstrap.Modal(document.getElementById('modalHS')).show();
    }

    openModalEdition(id) {
        const hs = this.hsData.find(h => String(h.id) === String(id));
        if (!hs) { showToast('Saisie non trouvée', 'error'); return; }

        this.hsEnEdition = hs;
        document.getElementById('hsId').value = hs.id;
        document.getElementById('hsEmploye').value = hs.employeId || '';
        document.getElementById('hsDate').value = hs.date || hs.dateHS || '';
        document.getElementById('hsNbHeures').value = hs.nbHeures || '';
        document.getElementById('hsTauxMajoration').value = hs.tauxMajoration || '25';
        document.getElementById('hsChantier').value = hs.chantierId || '';
        document.getElementById('hsMotif').value = hs.motif || '';
        document.getElementById('hsStatut').value = hs.statut || 'en_attente';
        document.getElementById('hsTypeCompensation').value = hs.typeCompensation || 'paiement';
        document.getElementById('modalHSLabel').innerHTML = '<i class="bi bi-clock-history me-2"></i>Modifier les heures supplémentaires';
        document.getElementById('btnDeleteHS').style.display = 'inline-block';
        document.getElementById('btnDeleteHS').dataset.id = id;

        this.populateEmployeSelects();
        this.populateChantierSelects();
        // Réappliquer les valeurs après repopulation des selects
        document.getElementById('hsEmploye').value = hs.employeId || '';
        document.getElementById('hsChantier').value = hs.chantierId || '';

        new bootstrap.Modal(document.getElementById('modalHS')).show();
    }

    async handleSubmit(e) {
        e.preventDefault();
        const form = e.target;
        if (!form.checkValidity()) { form.classList.add('was-validated'); return; }

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        const id = data.id;
        delete data.id;

        data.employeId = parseInt(data.employeId) || null;
        data.chantierId = parseInt(data.chantierId) || null;
        data.nbHeures = parseFloat(data.nbHeures) || 0;
        data.tauxMajoration = parseInt(data.tauxMajoration) || 25;
        const entrepriseId = window.AppState?.entreprise?.id || 1;

        try {
            if (id) {
                await window.api.heuresSup.invoke('update', parseInt(id), data);
                showToast('Heures supplémentaires modifiées', 'success');
            } else {
                await window.api.heuresSup.invoke('create', { ...data, entrepriseId });
                showToast('Heures supplémentaires enregistrées', 'success');
            }
            bootstrap.Modal.getInstance(document.getElementById('modalHS'))?.hide();
            await this.loadHeuresSup();
        } catch (error) {
            console.error('Erreur:', error);
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    async validerHS(id) {
        try {
            await window.api.heuresSup.invoke('update', parseInt(id), { statut: 'validee' });
            showToast('Heures validées', 'success');
            await this.loadHeuresSup();
        } catch (error) {
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    confirmDelete(id) {
        const hsId = id || document.getElementById('btnDeleteHS')?.dataset?.id;
        if (!hsId) return;
        document.getElementById('btnConfirmDeleteHS').dataset.id = hsId;
        new bootstrap.Modal(document.getElementById('modalConfirmDeleteHS')).show();
    }

    async executeDelete() {
        const id = document.getElementById('btnConfirmDeleteHS').dataset.id;
        if (!id) return;
        try {
            await window.api.heuresSup.invoke('delete', parseInt(id));
            showToast('Saisie supprimée', 'success');
            bootstrap.Modal.getInstance(document.getElementById('modalConfirmDeleteHS'))?.hide();
            bootstrap.Modal.getInstance(document.getElementById('modalHS'))?.hide();
            await this.loadHeuresSup();
        } catch (error) {
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    exportHS() {
        const rows = [['ID', 'Employé', 'Date', 'Heures', 'Majoration %', 'Chantier', 'Motif', 'Statut']];
        this.hsData.forEach(h => {
            const emp = this.employesCache.find(e => e.id === h.employeId);
            const chantier = this.chantiersCache.find(c => c.id === h.chantierId);
            rows.push([h.id, emp ? `${emp.prenom} ${emp.nom}` : '', h.date || h.dateHS || '', h.nbHeures || '', h.tauxMajoration || 25, chantier?.nom || '', h.motif || '', h.statut || '']);
        });
        const csv = rows.map(r => r.join(';')).join('\n');
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `heures_sup_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    showLoader(show) {
        const table = document.getElementById('hsTable');
        if (table) table.style.opacity = show ? '0.5' : '1';
    }

    formatDate(d) {
        if (!d) return '—';
        try { return new Date(d).toLocaleDateString('fr-FR'); } catch { return d; }
    }

    formatCurrency(n) {
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0);
    }

    escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
}

window.heuresSupController = new HeuresSupController();
