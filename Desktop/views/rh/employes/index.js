/**
 * Employes View Controller (Module RH)
 */
class EmployesController {
    constructor() {
        this.currentPage = 1;
        this.pageSize = 20;
        this.totalItems = 0;
        this.filters = {
            search: '',
            statut: '',
            typeContrat: ''
        };
        this.employeEnEdition = null;

        this.TYPE_CONTRAT_LABELS = {
            CDI: 'CDI',
            CDD: 'CDD',
            INTERIM: 'Intérim',
            STAGE: 'Stage',
            APPRENTISSAGE: 'Apprentissage / Alternance',
            JOURNALIER: 'Journalier',
            SAISONNIER: 'Saisonnier'
        };

        this.STATUT_BADGES = {
            actif:    { cls: 'bg-success',  label: 'Actif' },
            inactif:  { cls: 'bg-secondary', label: 'Inactif' },
            conge:    { cls: 'bg-warning text-dark', label: 'En congé' },
            suspendu: { cls: 'bg-danger', label: 'Suspendu' }
        };
    }

    async init() {
        this.bindEvents();
        await this.loadEmployes();
    }

    bindEvents() {
        document.getElementById('searchEmploye')?.addEventListener('input', (e) => {
            this.filters.search = e.target.value;
            this.currentPage = 1;
            this.loadEmployes();
        });

        document.getElementById('filterStatutEmploye')?.addEventListener('change', (e) => {
            this.filters.statut = e.target.value;
            this.currentPage = 1;
            this.loadEmployes();
        });

        document.getElementById('filterContrat')?.addEventListener('change', (e) => {
            this.filters.typeContrat = e.target.value;
            this.currentPage = 1;
            this.loadEmployes();
        });

        document.getElementById('btnNouvelEmploye')?.addEventListener('click', () => this.openModalNouveau());
        document.getElementById('btnFirstEmploye')?.addEventListener('click', () => this.openModalNouveau());
        document.getElementById('btnRefreshEmployes')?.addEventListener('click', () => this.loadEmployes());

        const form = document.getElementById('formEmploye');
        if (form) {
            form.addEventListener('submit', (e) => this.handleSubmitEmploye(e));
        }

        const formChangerPoste = document.getElementById('formChangerPoste');
        if (formChangerPoste) {
            formChangerPoste.addEventListener('submit', (e) => this.handleChangerPoste(e));
        }
    }

    async loadEmployes() {
        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;
            const res = await window.api.employes.invoke('list', {
                entrepriseId,
                limit: this.pageSize,
                offset: (this.currentPage - 1) * this.pageSize,
                statut: this.filters.statut || undefined,
                search: this.filters.search || undefined,
                typeContrat: this.filters.typeContrat || undefined
            });

            const data = res.data || res;
            const items = data.items || [];
            this.totalItems = data.total || 0;
            this.renderEmployesTable(items);
            this.toggleEmptyState(items.length === 0);
        } catch (error) {
            console.error('Erreur chargement employés:', error);
            if (typeof window.showToast === 'function') window.showToast('Erreur lors du chargement', 'error');
        }
    }

    renderEmployesTable(employes) {
        const tbody = document.getElementById('employesTbody');
        if (!tbody) return;

        if (!employes || employes.length === 0) {
            tbody.innerHTML = '';
            return;
        }

        tbody.innerHTML = employes.map((emp, idx) => {
            const statut = this.STATUT_BADGES[emp.statut] || { cls: 'bg-secondary', label: emp.statut || '—' };
            const contratLabel = this.TYPE_CONTRAT_LABELS[emp.typeContrat] || emp.typeContrat || 'CDI';
            const dateEmbauche = emp.dateEmbauche
                ? new Date(emp.dateEmbauche).toLocaleDateString('fr-FR')
                : '—';
            return `
            <tr>
                <td>${idx + 1}</td>
                <td class="fw-semibold">${this.escapeHtml(emp.prenom || '')} ${this.escapeHtml(emp.nom || '')}</td>
                <td>${this.escapeHtml(emp.poste || 'Ouvrier')}</td>
                <td class="d-none d-md-table-cell">${this.escapeHtml(contratLabel)}</td>
                <td class="d-none d-lg-table-cell">${window.formatCurrencyGlobal ? window.formatCurrencyGlobal(emp.salaireBase || 0) : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'MGA', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(emp.salaireBase || 0)}</td>
                <td class="d-none d-lg-table-cell small">${dateEmbauche}</td>
                <td><span class="badge ${statut.cls}">${statut.label}</span></td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-success btn-sm" title="Changer de poste" data-permission="employes:update" onclick="window.employesController.openModalChangerPoste(${emp.id})">
                            <i class="bi bi-arrow-up-circle"></i>
                        </button>
                        <button class="btn btn-outline-primary btn-sm" title="Modifier" data-permission="employes:update" onclick="window.employesController.openModalEdit(${emp.id})">
                            <i class="bi bi-pencil"></i>
                        </button>
                    </div>
                </td>
            </tr>`;
        }).join('');
    }

    toggleEmptyState(isEmpty) {
        document.getElementById('employesEmpty')?.classList.toggle('d-none', !isEmpty);
        document.getElementById('employesTable')?.classList.toggle('d-none', isEmpty);
    }

    openModalNouveau() {
        const form = document.getElementById('formEmploye');
        if (form) form.reset();
        this.employeEnEdition = null;

        const title = document.querySelector('#modalEmploye .modal-title');
        if (title) title.innerHTML = '<i class="bi bi-person me-2"></i>Nouvel employé';

        document.getElementById('employeId').value = '';

        const tabCarriereItem = document.getElementById('tabCarriereItem');
        if (tabCarriereItem) tabCarriereItem.classList.add('d-none');

        const modalEl = document.getElementById('modalEmploye');
        if (modalEl) {
            const modal = new bootstrap.Modal(modalEl);
            modal.show();
        }
    }

    async openModalEdit(id) {
        const form = document.getElementById('formEmploye');
        const title = document.querySelector('#modalEmploye .modal-title');
        if (!form || !title) return;

        this.employeEnEdition = null;
        form.reset();
        document.getElementById('employeId').value = '';

        title.innerHTML = '<i class="bi bi-person me-2"></i>Modifier l\'employé';

        try {
            const res = await window.api.employes.invoke('get', id);
            if (res?.success && res.data) {
                const emp = res.data;
                this.employeEnEdition = emp;
                document.getElementById('employeId').value = emp.id;
                document.getElementById('empNom').value = emp.nom || '';
                document.getElementById('empPrenom').value = emp.prenom || '';
                document.getElementById('empMatricule').value = emp.matricule || '';
                document.getElementById('empEmail').value = emp.email || '';
                document.getElementById('empTelephone').value = emp.telephone || '';
                document.getElementById('empAdresse').value = emp.adresse || '';
                document.getElementById('empStatut').value = emp.statut || 'actif';
                document.getElementById('empPoste').value = emp.poste || '';
                document.getElementById('empTypeContrat').value = emp.typeContrat || 'CDI';
                document.getElementById('empSalaireBase').value = emp.salaireBase || 0;
                document.getElementById('empDateEmbauche').value = emp.dateEmbauche || '';
                document.getElementById('empDateDebutContrat').value = emp.dateDebutContrat || '';
                document.getElementById('empDateFinContrat').value = emp.dateFinContrat || '';

                const tabCarriereItem = document.getElementById('tabCarriereItem');
                if (tabCarriereItem) tabCarriereItem.classList.remove('d-none');

                await this.loadHistoriquePoste(emp.id);
            }
        } catch (error) {
            console.error('Erreur chargement employé:', error);
            if (typeof window.showToast === 'function') window.showToast('Erreur lors du chargement', 'error');
        }

        const modalEl = document.getElementById('modalEmploye');
        if (modalEl) {
            const modal = new bootstrap.Modal(modalEl);
            modal.show();
        }
    }

    async handleSubmitEmploye(e) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        const entrepriseId = window.AppState?.entreprise?.id || 1;

        data.dateFinContrat = data.dateFinContrat || null;
        data.dateDebutContrat = data.dateDebutContrat || data.dateEmbauche || null;

        const id = this.employeEnEdition ? this.employeEnEdition.id : null;

        try {
            let res;
            if (id) {
                res = await window.api.employes.invoke('update', id, data);
            } else {
                res = await window.api.employes.invoke('create', data, entrepriseId);
            }

            if (res.success || res.id) {
                if (typeof window.showToast === 'function') window.showToast('Employé enregistré avec succès !', 'success');
                const modalEl = document.getElementById('modalEmploye');
                const modal = bootstrap.Modal.getInstance(modalEl);
                modal?.hide();
                await this.loadEmployes();
            } else if (res.error) {
                if (typeof window.showToast === 'function') window.showToast(res.error, 'error');
            }
        } catch (error) {
            console.error('Erreur enregistrement employé:', error);
            if (typeof window.showToast === 'function') window.showToast('Erreur de communication', 'error');
        }
    }

    async loadHistoriquePoste(employeId) {
        try {
            const res = await window.api.employes.invoke('historiquePoste', employeId);
            const items = (res.data && Array.isArray(res.data)) ? res.data : (res.items || []);
            this.renderHistoriquePoste(items);
        } catch (error) {
            console.error('Erreur chargement historique poste:', error);
            this.renderHistoriquePoste([]);
        }
    }

    renderHistoriquePoste(historique) {
        const container = document.getElementById('historiquePosteContainer');
        if (!container) return;

        if (!historique || historique.length === 0) {
            container.innerHTML = '<p class="text-secondary mb-0">Aucun historique de poste.</p>';
            return;
        }

        const items = historique.map(h => {
            const dateDebut = h.dateDebut ? new Date(h.dateDebut).toLocaleDateString('fr-FR') : '—';
            const dateFin = h.dateFin
                ? new Date(h.dateFin).toLocaleDateString('fr-FR')
                : '<span class="text-success fw-semibold">Actuel</span>';
            const contrat = this.TYPE_CONTRAT_LABELS[h.typeContrat] || h.typeContrat || 'CDI';
            const salaire = window.formatCurrencyGlobal
                ? window.formatCurrencyGlobal(h.salaireBase || 0)
                : (h.salaireBase || 0) + ' Ar';
            const badgeClass = h.dateFin ? 'bg-secondary' : 'bg-success';
            const badgeLabel = h.dateFin ? 'Passé' : 'Actuel';
            const motif = h.motifChangement
                ? `<div class="mt-1"><small class="text-info"><i class="bi bi-info-circle me-1"></i>${this.escapeHtml(h.motifChangement)}</small></div>`
                : '';
            return `
            <div class="timeline-item d-flex pb-3">
                <div class="flex-shrink-0 text-center me-3">
                    <span class="badge ${badgeClass}">${badgeLabel}</span>
                </div>
                <div class="flex-grow-1">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h6 class="mb-1">${this.escapeHtml(h.poste || '')}</h6>
                            <small class="text-secondary">${this.escapeHtml(contrat)}</small>
                            ${motif}
                        </div>
                        <div class="text-end">
                            <small class="text-muted">${dateDebut} → ${dateFin}</small>
                            <div><small class="text-muted">${salaire}</small></div>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');

        container.innerHTML = `<div class="timeline">${items}</div>`;
    }

    async openModalChangerPoste(id) {
        const modalEl = document.getElementById('modalChangerPoste');
        const form = document.getElementById('formChangerPoste');
        if (!modalEl || !form) return;

        form.reset();
        document.getElementById('changerPosteEmployeId').value = '';

        try {
            const res = await window.api.employes.invoke('get', id);
            if (res?.success && res.data) {
                const emp = res.data;
                document.getElementById('changerPosteEmployeId').value = emp.id;
                document.getElementById('changerPosteEmployeNom').textContent = `${emp.prenom || ''} ${emp.nom || ''}`;
                document.getElementById('changerPosteActuel').textContent = emp.poste || '—';
                document.getElementById('changerPosteContratActuel').textContent = emp.typeContrat || 'CDI';

                document.getElementById('cpNouveauPoste').value = emp.poste || '';
                document.getElementById('cpTypeContrat').value = emp.typeContrat || 'CDI';
                document.getElementById('cpNouveauSalaire').value = emp.salaireBase || 0;
                const today = new Date().toISOString().split('T')[0];
                document.getElementById('cpDateDebut').value = today;
            }

            const modal = new bootstrap.Modal(modalEl);
            modal.show();
        } catch (error) {
            console.error('Erreur chargement employé pour changement de poste:', error);
        }
    }

    async handleChangerPoste(e) {
        e.preventDefault();
        const employeId = document.getElementById('changerPosteEmployeId')?.value;
        const entrepriseId = window.AppState?.entreprise?.id || 1;

        const data = {
            poste: document.getElementById('cpNouveauPoste')?.value.trim(),
            typeContrat: document.getElementById('cpTypeContrat')?.value,
            salaireBase: document.getElementById('cpNouveauSalaire')?.value,
            dateDebut: document.getElementById('cpDateDebut')?.value,
            dateFinContrat: document.getElementById('cpDateFin')?.value || null,
            motifChangement: document.getElementById('cpMotif')?.value || null,
            entrepriseId
        };

        if (!data.poste || !data.dateDebut) {
            if (typeof window.showToast === 'function') window.showToast('Le poste et la date de début sont obligatoires.', 'warning');
            return;
        }

        const btn = document.getElementById('btnConfirmerChangementPoste');
        if (btn) btn.disabled = true;

        try {
            const res = await window.api.employes.invoke('changerPoste', parseInt(employeId), data);
            if (res?.success) {
                const modal = bootstrap.Modal.getInstance(document.getElementById('modalChangerPoste'));
                modal?.hide();
                if (typeof window.showToast === 'function') window.showToast('Changement de poste enregistré avec succès !', 'success');
                await this.loadEmployes();
            } else {
                if (typeof window.showToast === 'function') window.showToast(res?.error || 'Erreur lors du changement de poste', 'error');
            }
        } catch (error) {
            console.error('Erreur changement de poste:', error);
            if (typeof window.showToast === 'function') window.showToast('Erreur de communication', 'error');
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    }
}

window.employesController = new EmployesController();