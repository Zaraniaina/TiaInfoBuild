/**
 * Contrats View Controller
 * Gère la liste, création, édition et consultation des contrats clients
 */

class ContratsController {
    constructor() {
        this.currentPage = 1;
        this.pageSize = 20;
        this.filters = { search: '', statut: '', type: '' };
        this.contratEnEdition = null;
        this.contratsData = [];
        this.clientsCache = [];
        this.chantiersCache = [];
        this.devisCache = [];
    }

    async init() {
        await Promise.all([this.loadClients(), this.loadChantiers(), this.loadDevis()]);
        this.bindEvents();
        await this.loadContrats();
    }

    async loadClients() {
        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;
            const result = await window.api.clients.invoke('list', { entrepriseId, limit: 1000 });
            this.clientsCache = result.items || result || [];
            this.populateClientSelects();
        } catch (error) { console.error('Erreur clients:', error); }
    }

    async loadChantiers() {
        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;
            const result = await window.api.chantiers.invoke('list', { entrepriseId, limit: 1000 });
            this.chantiersCache = result.items || [];
        } catch (error) { console.error('Erreur chantiers:', error); }
    }

    async loadDevis() {
        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;
            const result = await window.api.devis.invoke('list', { entrepriseId, limit: 1000 });
            this.devisCache = result.items || result || [];
        } catch (error) { console.error('Erreur devis:', error); }
    }

    populateClientSelects() {
        const select = document.getElementById('contratClient');
        if (!select) return;
        const current = select.value;
        select.innerHTML = '<option value="">Sélectionner un client</option>';
        this.clientsCache.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.nom || c.raisonSociale || `Client #${c.id}`;
            select.appendChild(opt);
        });
        select.value = current;
    }

    bindEvents() {
        let debounce;
        document.getElementById('searchContrat')?.addEventListener('input', e => {
            clearTimeout(debounce);
            debounce = setTimeout(() => { this.filters.search = e.target.value; this.currentPage = 1; this.renderFiltered(); }, 300);
        });
        document.getElementById('filterStatutContrat')?.addEventListener('change', e => { this.filters.statut = e.target.value; this.currentPage = 1; this.renderFiltered(); });
        document.getElementById('filterTypeContrat')?.addEventListener('change', e => { this.filters.type = e.target.value; this.currentPage = 1; this.renderFiltered(); });

        document.getElementById('btnNouveauContrat')?.addEventListener('click', () => this.openModalNouveau());
        document.getElementById('btnFirstContrat')?.addEventListener('click', () => this.openModalNouveau());
        document.getElementById('btnRefreshContrats')?.addEventListener('click', () => this.loadContrats());
        document.getElementById('btnExportContrats')?.addEventListener('click', () => this.exportContrats());

        document.getElementById('formContrat')?.addEventListener('submit', e => this.handleSubmit(e));
        document.getElementById('btnDeleteContrat')?.addEventListener('click', () => this.confirmDelete());
        document.getElementById('btnConfirmDeleteContrat')?.addEventListener('click', () => this.executeDelete());
        document.getElementById('btnEditContratFromDetail')?.addEventListener('click', () => {
            bootstrap.Modal.getInstance(document.getElementById('modalContratDetail'))?.hide();
            setTimeout(() => this.openModalEdition(this.contratEnEdition?.id), 300);
        });
    }

    async loadContrats() {
        this.showLoader(true);
        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;
            const result = await window.api.contrats.invoke('list', { entrepriseId, limit: 1000 });
            this.contratsData = Array.isArray(result) ? result : (result.items || []);
            this.updateKPIs();
            this.renderFiltered();
        } catch (error) {
            console.error('Erreur contrats:', error);
            showToast('Erreur lors du chargement des contrats', 'error');
        } finally {
            this.showLoader(false);
        }
    }

    updateKPIs() {
        const actifs = this.contratsData.filter(c => c.statut === 'signe' || c.statut === 'en_cours');
        const enCours = this.contratsData.filter(c => c.statut === 'en_cours');
        const montant = this.contratsData.reduce((s, c) => s + (parseFloat(c.montant) || 0), 0);
        document.getElementById('kpiContratTotal').textContent = this.contratsData.length;
        document.getElementById('kpiContratActif').textContent = actifs.length;
        document.getElementById('kpiContratEnCours').textContent = enCours.length;
        document.getElementById('kpiMontantContrats').textContent = this.formatCurrency(montant);
    }

    renderFiltered() {
        let filtered = this.contratsData;
        if (this.filters.search) {
            const s = this.filters.search.toLowerCase();
            filtered = filtered.filter(c => {
                const client = this.clientsCache.find(cl => cl.id === c.clientId);
                return (c.reference || '').toLowerCase().includes(s) ||
                    (client && (client.nom || client.raisonSociale || '').toLowerCase().includes(s));
            });
        }
        if (this.filters.statut) filtered = filtered.filter(c => c.statut === this.filters.statut);
        if (this.filters.type) filtered = filtered.filter(c => c.typeContrat === this.filters.type);

        const start = (this.currentPage - 1) * this.pageSize;
        const paginated = filtered.slice(start, start + this.pageSize);
        this.renderTable(paginated);
        this.renderPagination(filtered.length);
        this.toggleEmptyState(filtered.length === 0);
    }

    renderTable(items) {
        const tbody = document.getElementById('contratsTbody');
        if (!tbody) return;
        if (items.length === 0) { tbody.innerHTML = ''; return; }

        const statutConfig = {
            'en_cours': { class: 'bg-warning text-dark', label: 'En cours' },
            'signe': { class: 'bg-success', label: 'Signé' },
            'termine': { class: 'bg-secondary', label: 'Terminé' },
            'resilie': { class: 'bg-danger', label: 'Résilié' },
            'suspendu': { class: 'bg-info', label: 'Suspendu' }
        };

        tbody.innerHTML = items.map((c, i) => {
            const client = this.clientsCache.find(cl => cl.id === c.clientId);
            const clientNom = client?.nom || client?.raisonSociale || `Client #${c.clientId}`;
            const st = statutConfig[c.statut] || { class: 'bg-secondary', label: c.statut || '—' };

            return `
                <tr data-id="${c.id}">
                    <td>${(this.currentPage - 1) * this.pageSize + i + 1}</td>
                    <td>
                        <div class="fw-semibold">${this.escapeHtml(c.reference || `CTR-${c.id}`)}</div>
                        <small class="text-secondary">${this.escapeHtml(c.typeContrat || '—')}</small>
                    </td>
                    <td>${this.escapeHtml(clientNom)}</td>
                    <td><span class="badge bg-secondary">${this.escapeHtml(c.typeContrat || '—')}</span></td>
                    <td class="fw-semibold">${this.formatCurrency(c.montant)}</td>
                    <td>${this.formatDate(c.dateDebut)}</td>
                    <td>${this.formatDate(c.dateFin)}</td>
                    <td><span class="badge ${st.class}">${st.label}</span></td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-secondary btn-view" data-id="${c.id}" title="Voir">
                                <i class="bi bi-eye"></i>
                            </button>
                            <button class="btn btn-outline-primary btn-edit" data-id="${c.id}" title="Modifier">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-outline-danger btn-delete" data-id="${c.id}" title="Supprimer">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.querySelectorAll('.btn-view').forEach(btn => btn.addEventListener('click', e => this.viewContrat(e.currentTarget.dataset.id)));
        tbody.querySelectorAll('.btn-edit').forEach(btn => btn.addEventListener('click', e => this.openModalEdition(e.currentTarget.dataset.id)));
        tbody.querySelectorAll('.btn-delete').forEach(btn => btn.addEventListener('click', e => this.confirmDelete(e.currentTarget.dataset.id)));
    }

    renderPagination(total) {
        const container = document.getElementById('contratsPagination');
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
                if (page && page !== this.currentPage && page >= 1 && page <= totalPages) { this.currentPage = page; this.renderFiltered(); }
            });
        });
    }

    toggleEmptyState(isEmpty) {
        document.getElementById('contratsEmpty')?.classList.toggle('d-none', !isEmpty);
        document.getElementById('contratsTable')?.classList.toggle('d-none', isEmpty);
    }

    openModalNouveau() {
        this.contratEnEdition = null;
        document.getElementById('formContrat')?.reset();
        document.getElementById('contratId').value = '';
        document.getElementById('contratDateDebut').value = new Date().toISOString().split('T')[0];
        document.getElementById('contratStatut').value = 'en_cours';
        document.getElementById('modalContratLabel').innerHTML = '<i class="bi bi-file-earmark-text me-2"></i>Nouveau contrat';
        document.getElementById('btnDeleteContrat').style.display = 'none';
        this.generateReference();
        this.populateSelectsInModal();
        new bootstrap.Modal(document.getElementById('modalContrat')).show();
    }

    async generateReference() {
        try {
            const year = new Date().getFullYear();
            const num = String(this.contratsData.length + 1).padStart(3, '0');
            document.getElementById('contratRef').value = `CTR-${year}-${num}`;
        } catch { /* ignore */ }
    }

    populateSelectsInModal() {
        // Clients
        this.populateClientSelects();
        // Chantiers
        const chanSelect = document.getElementById('contratChantier');
        if (chanSelect) {
            const current = chanSelect.value;
            chanSelect.innerHTML = '<option value="">— Aucun —</option>';
            this.chantiersCache.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = c.nom || `Chantier #${c.id}`;
                chanSelect.appendChild(opt);
            });
            chanSelect.value = current;
        }
        // Devis
        const devisSelect = document.getElementById('contratDevis');
        if (devisSelect) {
            const current = devisSelect.value;
            devisSelect.innerHTML = '<option value="">— Aucun —</option>';
            this.devisCache.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d.id;
                opt.textContent = d.reference || d.objet || `Devis #${d.id}`;
                devisSelect.appendChild(opt);
            });
            devisSelect.value = current;
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

    openModalEdition(id) {
        const contrat = this.contratsData.find(c => String(c.id) === String(id));
        if (!contrat) { showToast('Contrat non trouvé', 'error'); return; }

        this.contratEnEdition = contrat;
        document.getElementById('contratId').value = contrat.id;
        document.getElementById('contratRef').value = contrat.reference || '';
        document.getElementById('contratType').value = contrat.typeContrat || 'travaux';
        document.getElementById('contratMontant').value = contrat.montant || '';
        document.getElementById('contratDateDebut').value = contrat.dateDebut || '';
        document.getElementById('contratDateFin').value = contrat.dateFin || '';
        document.getElementById('contratStatut').value = contrat.statut || 'en_cours';
        document.getElementById('contratObjet').value = contrat.objet || '';
        document.getElementById('contratConditionsPaiement').value = contrat.conditionsPaiement || 'comptant';
        document.getElementById('contratDateSignature').value = contrat.dateSignature || '';
        document.getElementById('contratGarantie').value = contrat.garantieMois || '';
        document.getElementById('contratNotes').value = contrat.notes || '';

        document.getElementById('modalContratLabel').innerHTML = `<i class="bi bi-file-earmark-text me-2"></i>Modifier: ${this.escapeHtml(contrat.reference || `CTR-${contrat.id}`)}`;
        document.getElementById('btnDeleteContrat').style.display = 'inline-block';
        document.getElementById('btnDeleteContrat').dataset.id = id;
        document.getElementById('deleteContratRef').textContent = contrat.reference || `Contrat #${contrat.id}`;

        this.populateSelectsInModal();
        document.getElementById('contratClient').value = contrat.clientId || '';
        document.getElementById('contratChantier').value = contrat.chantierId || '';
        document.getElementById('contratDevis').value = contrat.devisId || '';

        new bootstrap.Modal(document.getElementById('modalContrat')).show();
    }

    viewContrat(id) {
        const contrat = this.contratsData.find(c => String(c.id) === String(id));
        if (!contrat) { showToast('Contrat non trouvé', 'error'); return; }

        this.contratEnEdition = contrat;
        const client = this.clientsCache.find(c => c.id === contrat.clientId);
        const clientNom = client?.nom || client?.raisonSociale || '—';
        const chantier = this.chantiersCache.find(c => c.id === contrat.chantierId);

        const container = document.getElementById('contratDetailContent');
        if (!container) return;

        container.innerHTML = `
            <div class="row g-4">
                <div class="col-md-6">
                    <div class="card h-100">
                        <div class="card-header"><h6 class="mb-0"><i class="bi bi-info-circle me-2"></i>Informations générales</h6></div>
                        <div class="card-body">
                            <div class="row g-3">
                                <div class="col-6"><small class="text-secondary">Référence</small><div class="fw-bold">${this.escapeHtml(contrat.reference || `CTR-${contrat.id}`)}</div></div>
                                <div class="col-6"><small class="text-secondary">Type</small><div>${this.escapeHtml(contrat.typeContrat || '—')}</div></div>
                                <div class="col-6"><small class="text-secondary">Client</small><div class="fw-semibold">${this.escapeHtml(clientNom)}</div></div>
                                <div class="col-6"><small class="text-secondary">Chantier lié</small><div>${this.escapeHtml(chantier?.nom || '—')}</div></div>
                                <div class="col-6"><small class="text-secondary">Montant HT</small><div class="fw-bold text-success fs-5">${this.formatCurrency(contrat.montant)}</div></div>
                                <div class="col-6"><small class="text-secondary">Conditions paiement</small><div>${this.escapeHtml(contrat.conditionsPaiement || '—')}</div></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card h-100">
                        <div class="card-header"><h6 class="mb-0"><i class="bi bi-calendar3 me-2"></i>Calendrier</h6></div>
                        <div class="card-body">
                            <div class="row g-3">
                                <div class="col-6"><small class="text-secondary">Date début</small><div>${this.formatDate(contrat.dateDebut)}</div></div>
                                <div class="col-6"><small class="text-secondary">Date fin</small><div>${this.formatDate(contrat.dateFin)}</div></div>
                                <div class="col-6"><small class="text-secondary">Date signature</small><div>${this.formatDate(contrat.dateSignature)}</div></div>
                                <div class="col-6"><small class="text-secondary">Garantie</small><div>${contrat.garantieMois ? contrat.garantieMois + ' mois' : '—'}</div></div>
                            </div>
                        </div>
                    </div>
                </div>
                ${contrat.objet ? `<div class="col-12"><div class="card"><div class="card-header"><h6 class="mb-0">Objet</h6></div><div class="card-body">${this.escapeHtml(contrat.objet)}</div></div></div>` : ''}
                ${contrat.notes ? `<div class="col-12"><div class="card"><div class="card-header"><h6 class="mb-0">Notes</h6></div><div class="card-body">${this.escapeHtml(contrat.notes)}</div></div></div>` : ''}
            </div>
        `;
        new bootstrap.Modal(document.getElementById('modalContratDetail')).show();
    }

    async handleSubmit(e) {
        e.preventDefault();
        const form = e.target;
        if (!form.checkValidity()) { form.classList.add('was-validated'); return; }

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        const id = data.id;
        delete data.id;

        data.clientId = parseInt(data.clientId) || null;
        data.chantierId = parseInt(data.chantierId) || null;
        data.devisId = parseInt(data.devisId) || null;
        data.montant = parseFloat(data.montant) || 0;
        data.garantieMois = parseInt(data.garantieMois) || null;
        const entrepriseId = window.AppState?.entreprise?.id || 1;

        try {
            if (id) {
                await window.api.contrats.invoke('update', parseInt(id), data);
                showToast('Contrat modifié avec succès', 'success');
            } else {
                await window.api.contrats.invoke('create', { ...data, entrepriseId });
                showToast('Contrat créé avec succès', 'success');
            }
            bootstrap.Modal.getInstance(document.getElementById('modalContrat'))?.hide();
            await this.loadContrats();
        } catch (error) {
            console.error('Erreur:', error);
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    confirmDelete(id) {
        const contratId = id || document.getElementById('btnDeleteContrat')?.dataset?.id;
        if (!contratId) return;
        const contrat = this.contratsData.find(c => String(c.id) === String(contratId));
        document.getElementById('deleteContratRef').textContent = contrat?.reference || `Contrat #${contratId}`;
        document.getElementById('btnConfirmDeleteContrat').dataset.id = contratId;
        new bootstrap.Modal(document.getElementById('modalConfirmDeleteContrat')).show();
    }

    async executeDelete() {
        const id = document.getElementById('btnConfirmDeleteContrat').dataset.id;
        if (!id) return;
        try {
            await window.api.contrats.invoke('delete', parseInt(id));
            showToast('Contrat supprimé', 'success');
            bootstrap.Modal.getInstance(document.getElementById('modalConfirmDeleteContrat'))?.hide();
            bootstrap.Modal.getInstance(document.getElementById('modalContrat'))?.hide();
            await this.loadContrats();
        } catch (error) {
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    exportContrats() {
        const rows = [['ID', 'Référence', 'Client', 'Type', 'Montant', 'Date début', 'Date fin', 'Statut']];
        this.contratsData.forEach(c => {
            const client = this.clientsCache.find(cl => cl.id === c.clientId);
            rows.push([c.id, c.reference || '', client?.nom || client?.raisonSociale || '', c.typeContrat || '', c.montant || 0, c.dateDebut || '', c.dateFin || '', c.statut || '']);
        });
        const csv = rows.map(r => r.join(';')).join('\n');
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `contrats_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    showLoader(show) {
        const table = document.getElementById('contratsTable');
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

window.contratsController = new ContratsController();
