/**
 * Paiements View Controller
 * Gère l'enregistrement et le suivi des paiements par facture
 */

class PaiementsController {
    constructor() {
        this.currentPage = 1;
        this.pageSize = 20;
        this.filters = { search: '', mode: '', mois: '' };
        this.paiementsData = [];
        this.facturesCache = [];
        this.clientsCache = [];
    }

    async init() {
        await Promise.all([this.loadFactures(), this.loadClients()]);
        this.setDefaultMois();
        this.bindEvents();
        await this.loadPaiements();
    }

    setDefaultMois() {
        const now = new Date();
        const mois = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const el = document.getElementById('filterMoisPaiement');
        if (el) { el.value = mois; this.filters.mois = mois; }
    }

    async loadFactures() {
        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;
            const result = await window.api.factures.invoke('list', { entrepriseId, limit: 1000 });
            this.facturesCache = Array.isArray(result) ? result : (result.items || []);
            this.populateFactureSelect();
        } catch (error) { console.error('Erreur factures:', error); }
    }

    async loadClients() {
        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;
            const result = await window.api.clients.invoke('list', { entrepriseId, limit: 1000 });
            this.clientsCache = Array.isArray(result) ? result : (result.items || []);
        } catch (error) { console.error('Erreur clients:', error); }
    }

    populateFactureSelect() {
        const select = document.getElementById('paiementFacture');
        if (!select) return;
        const current = select.value;
        select.innerHTML = '<option value="">Sélectionner une facture</option>';
        this.facturesCache.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f.id;
            opt.textContent = `${f.numero || f.reference || `FAC-${f.id}`} — ${this.formatCurrency(f.montantTTC || f.montant || 0)}`;
            select.appendChild(opt);
        });
        select.value = current;
    }

    bindEvents() {
        let debounce;
        document.getElementById('searchPaiement')?.addEventListener('input', e => {
            clearTimeout(debounce);
            debounce = setTimeout(() => { this.filters.search = e.target.value; this.currentPage = 1; this.renderFiltered(); }, 300);
        });
        document.getElementById('filterModePaiement')?.addEventListener('change', e => { this.filters.mode = e.target.value; this.currentPage = 1; this.renderFiltered(); });
        document.getElementById('filterMoisPaiement')?.addEventListener('change', e => { this.filters.mois = e.target.value; this.loadPaiements(); });
        document.getElementById('btnNouveauPaiement')?.addEventListener('click', () => this.openModalNouveau());
        document.getElementById('btnRefreshPaiements')?.addEventListener('click', () => this.loadPaiements());
        document.getElementById('btnExportPaiements')?.addEventListener('click', () => this.exportPaiements());
        document.getElementById('formPaiement')?.addEventListener('submit', e => this.handleSubmit(e));
        document.getElementById('btnDeletePaiement')?.addEventListener('click', () => this.confirmDelete());
    }

    async loadPaiements() {
        this.showLoader(true);
        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;
            // Charger les paiements via les factures (byFacture pour chaque facture connue)
            let allPaiements = [];
            for (const facture of this.facturesCache.slice(0, 50)) {
                try {
                    const result = await window.api.paiements.invoke('byFacture', facture.id);
                    const paiements = Array.isArray(result) ? result : (result.items || []);
                    allPaiements.push(...paiements.map(p => ({ ...p, facture })));
                } catch { /* ignore */ }
            }
            this.paiementsData = allPaiements;

            // Filtre mois
            if (this.filters.mois) {
                const [y, m] = this.filters.mois.split('-');
                this.paiementsData = this.paiementsData.filter(p => {
                    const d = new Date(p.datePaiement || p.date || '');
                    return d.getFullYear() === parseInt(y) && (d.getMonth() + 1) === parseInt(m);
                });
            }

            this.updateKPIs();
            this.renderFiltered();
        } catch (error) {
            console.error('Erreur paiements:', error);
            showToast('Erreur lors du chargement des paiements', 'error');
        } finally {
            this.showLoader(false);
        }
    }

    updateKPIs() {
        const recus = this.paiementsData.filter(p => p.statut !== 'en_attente');
        const enAttente = this.paiementsData.filter(p => p.statut === 'en_attente');
        const montantRecu = recus.reduce((s, p) => s + (parseFloat(p.montant) || 0), 0);
        // Calculer montant dû (factures non payées)
        const montantDu = this.facturesCache
            .filter(f => f.statut === 'en_retard' || f.statut === 'envoyee')
            .reduce((s, f) => s + (parseFloat(f.montantTTC || f.montant || 0) - parseFloat(f.montantPaye || 0)), 0);

        document.getElementById('kpiPaiementsRecus').textContent = recus.length;
        document.getElementById('kpiPaiementsEnAttente').textContent = enAttente.length;
        document.getElementById('kpiMontantRecu').textContent = this.formatCurrency(montantRecu);
        document.getElementById('kpiMontantDu').textContent = this.formatCurrency(Math.max(0, montantDu));
    }

    renderFiltered() {
        let filtered = this.paiementsData;
        if (this.filters.search) {
            const s = this.filters.search.toLowerCase();
            filtered = filtered.filter(p => {
                const facRef = p.facture?.numero || p.facture?.reference || '';
                return facRef.toLowerCase().includes(s);
            });
        }
        if (this.filters.mode) filtered = filtered.filter(p => p.modePaiement === this.filters.mode);

        const start = (this.currentPage - 1) * this.pageSize;
        const paginated = filtered.slice(start, start + this.pageSize);
        this.renderTable(paginated);
        this.renderPagination(filtered.length);
        this.toggleEmptyState(filtered.length === 0);
    }

    renderTable(items) {
        const tbody = document.getElementById('paiementsTbody');
        if (!tbody) return;
        if (items.length === 0) { tbody.innerHTML = ''; return; }

        const modeLabels = {
            'virement': 'Virement', 'cheque': 'Chèque', 'especes': 'Espèces',
            'carte': 'Carte', 'prelevement': 'Prélèvement'
        };

        tbody.innerHTML = items.map((p, i) => {
            const facture = p.facture || this.facturesCache.find(f => f.id === p.factureId);
            const facRef = facture?.numero || facture?.reference || `FAC-${p.factureId}`;
            const client = this.clientsCache.find(c => c.id === facture?.clientId);
            const clientNom = client?.nom || client?.raisonSociale || '—';

            return `
                <tr data-id="${p.id}">
                    <td>${(this.currentPage - 1) * this.pageSize + i + 1}</td>
                    <td><span class="badge bg-primary">${this.escapeHtml(facRef)}</span></td>
                    <td>${this.escapeHtml(clientNom)}</td>
                    <td class="fw-semibold text-success">${this.formatCurrency(p.montant)}</td>
                    <td>${this.formatDate(p.datePaiement || p.date)}</td>
                    <td><span class="badge bg-secondary">${modeLabels[p.modePaiement] || p.modePaiement || '—'}</span></td>
                    <td><small>${this.escapeHtml(p.reference || '—')}</small></td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary btn-edit" data-id="${p.id}" title="Modifier">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-outline-danger btn-delete" data-id="${p.id}" title="Supprimer">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.querySelectorAll('.btn-edit').forEach(btn => btn.addEventListener('click', e => this.openModalEdition(e.currentTarget.dataset.id)));
        tbody.querySelectorAll('.btn-delete').forEach(btn => btn.addEventListener('click', e => this.confirmDelete(e.currentTarget.dataset.id)));
    }

    renderPagination(total) {
        const container = document.getElementById('paiementsPagination');
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
        document.getElementById('paiementsEmpty')?.classList.toggle('d-none', !isEmpty);
        document.getElementById('paiementsTable')?.classList.toggle('d-none', isEmpty);
    }

    openModalNouveau() {
        document.getElementById('formPaiement')?.reset();
        document.getElementById('paiementId').value = '';
        document.getElementById('paiementDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('modalPaiementLabel').innerHTML = '<i class="bi bi-credit-card me-2"></i>Enregistrer un paiement';
        document.getElementById('btnDeletePaiement').style.display = 'none';
        this.populateFactureSelect();
        new bootstrap.Modal(document.getElementById('modalPaiement')).show();
    }

    openModalEdition(id) {
        const p = this.paiementsData.find(p => String(p.id) === String(id));
        if (!p) { showToast('Paiement non trouvé', 'error'); return; }
        document.getElementById('paiementId').value = p.id;
        document.getElementById('paiementFacture').value = p.factureId || '';
        document.getElementById('paiementMontant').value = p.montant || '';
        document.getElementById('paiementDate').value = p.datePaiement || p.date || '';
        document.getElementById('paiementMode').value = p.modePaiement || '';
        document.getElementById('paiementRef').value = p.reference || '';
        document.getElementById('paiementBanque').value = p.banque || '';
        document.getElementById('paiementNotes').value = p.notes || '';
        document.getElementById('modalPaiementLabel').innerHTML = '<i class="bi bi-credit-card me-2"></i>Modifier le paiement';
        document.getElementById('btnDeletePaiement').style.display = 'inline-block';
        document.getElementById('btnDeletePaiement').dataset.id = id;
        this.populateFactureSelect();
        document.getElementById('paiementFacture').value = p.factureId || '';
        new bootstrap.Modal(document.getElementById('modalPaiement')).show();
    }

    async handleSubmit(e) {
        e.preventDefault();
        const form = e.target;
        if (!form.checkValidity()) { form.classList.add('was-validated'); return; }
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        const id = data.id;
        delete data.id;
        data.factureId = parseInt(data.factureId) || null;
        data.montant = parseFloat(data.montant) || 0;
        const entrepriseId = window.AppState?.entreprise?.id || 1;
        try {
            if (id) {
                await window.api.paiements.invoke('update', parseInt(id), data);
                showToast('Paiement modifié', 'success');
            } else {
                await window.api.paiements.invoke('create', { ...data, entrepriseId });
                showToast('Paiement enregistré', 'success');
            }
            bootstrap.Modal.getInstance(document.getElementById('modalPaiement'))?.hide();
            await this.loadPaiements();
        } catch (error) {
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    confirmDelete(id) {
        const pId = id || document.getElementById('btnDeletePaiement')?.dataset?.id;
        if (!pId) return;
        if (confirm('Supprimer ce paiement ?')) this.executeDelete(pId);
    }

    async executeDelete(id) {
        try {
            await window.api.paiements.invoke('delete', parseInt(id));
            showToast('Paiement supprimé', 'success');
            bootstrap.Modal.getInstance(document.getElementById('modalPaiement'))?.hide();
            await this.loadPaiements();
        } catch (error) {
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    exportPaiements() {
        const rows = [['ID', 'Facture', 'Montant', 'Date', 'Mode', 'Référence']];
        this.paiementsData.forEach(p => {
            const facture = p.facture || this.facturesCache.find(f => f.id === p.factureId);
            rows.push([p.id, facture?.numero || facture?.reference || '', p.montant || 0, p.datePaiement || p.date || '', p.modePaiement || '', p.reference || '']);
        });
        const csv = rows.map(r => r.join(';')).join('\n');
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `paiements_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    showLoader(show) {
        const table = document.getElementById('paiementsTable');
        if (table) table.style.opacity = show ? '0.5' : '1';
    }

    formatDate(d) { if (!d) return '—'; try { return new Date(d).toLocaleDateString('fr-FR'); } catch { return d; } }
    formatCurrency(n) { return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0); }
    escapeHtml(str) { if (!str) return ''; return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
}

window.paiementsController = new PaiementsController();
