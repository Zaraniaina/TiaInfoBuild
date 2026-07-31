/**
 * rh/pointages/index.js — Contrôleur Vue Pointages
 * Chargé dynamiquement par router.js
 */

class PointagesController {
    constructor() {
        this.currentPage = 1;
        this.pageSize = 50; // On affiche beaucoup de pointages d'un coup
        this.filters = {
            employeId: '',
            chantierId: '',
            dateDebut: '',
            dateFin: ''
        };
        this.employes = [];
        this.chantiers = [];
    }

    async init() {
        // Initialiser les dates par défaut (mois en cours)
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        document.getElementById('filterDateDebut').value = firstDay.toISOString().split('T')[0];
        document.getElementById('filterDateFin').value = lastDay.toISOString().split('T')[0];
        this.filters.dateDebut = firstDay.toISOString().split('T')[0];
        this.filters.dateFin = lastDay.toISOString().split('T')[0];
        document.getElementById('pointageDate').value = now.toISOString().split('T')[0];

        await this.loadReferences();
        this.bindEvents();
        await this.loadPointages();
    }

    async loadReferences() {
        const entrepriseId = window.AppState?.entreprise?.id || 1;
        try {
            // Charger les employés pour les select
            const employesResult = await window.api.employes.invoke('list', { entrepriseId, limit: 1000, offset: 0 });
            if (employesResult?.success && employesResult.data?.items) {
                this.employes = employesResult.data.items;
                this.populateSelect('filterEmploye', this.employes, 'id', (e) => `${e.nom} ${e.prenom || ''}`);
                this.populateSelect('pointageEmploye', this.employes, 'id', (e) => `${e.nom} ${e.prenom || ''}`);
            }

            // Charger les chantiers pour les select
            const chantiersResult = await window.api.chantiers.invoke('list', { entrepriseId, limit: 1000, offset: 0 });
            if (chantiersResult?.success && chantiersResult.data?.items) {
                this.chantiers = chantiersResult.data.items;
                this.populateSelect('filterChantier', this.chantiers, 'id', 'nom');
                this.populateSelect('pointageChantier', this.chantiers, 'id', 'nom');
            }
        } catch (error) {
            console.error('Erreur chargement références pointages:', error);
        }
    }

    populateSelect(elementId, items, valueKey, labelFn) {
        const select = document.getElementById(elementId);
        if (!select) return;
        
        // Garder la première option (placeholder)
        const firstOption = select.options[0];
        select.innerHTML = '';
        if (firstOption) select.appendChild(firstOption);

        items.forEach(item => {
            const option = document.createElement('option');
            option.value = item[valueKey];
            option.textContent = typeof labelFn === 'function' ? labelFn(item) : item[labelFn];
            select.appendChild(option);
        });
    }

    bindEvents() {
        const filterEmploye = document.getElementById('filterEmploye');
        const filterChantier = document.getElementById('filterChantier');
        const filterDateDebut = document.getElementById('filterDateDebut');
        const filterDateFin = document.getElementById('filterDateFin');
        const btnResetFilters = document.getElementById('btnResetFilters');
        const formPointage = document.getElementById('formPointage');
        
        const triggerLoad = () => {
            this.filters.employeId = filterEmploye.value;
            this.filters.chantierId = filterChantier.value;
            this.filters.dateDebut = filterDateDebut.value;
            this.filters.dateFin = filterDateFin.value;
            this.loadPointages();
        };

        filterEmploye?.addEventListener('change', triggerLoad);
        filterChantier?.addEventListener('change', triggerLoad);
        filterDateDebut?.addEventListener('change', triggerLoad);
        filterDateFin?.addEventListener('change', triggerLoad);

        btnResetFilters?.addEventListener('click', () => {
            filterEmploye.value = '';
            filterChantier.value = '';
            
            const now = new Date();
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            
            filterDateDebut.value = firstDay.toISOString().split('T')[0];
            filterDateFin.value = lastDay.toISOString().split('T')[0];
            
            triggerLoad();
        });

        document.getElementById('btnNouveauPointage')?.addEventListener('click', () => {
            formPointage?.reset();
            document.getElementById('pointageDate').value = new Date().toISOString().split('T')[0];
            document.getElementById('pointageHeureDebut').value = '08:00';
            document.getElementById('pointageHeureFin').value = '17:00';
            document.getElementById('pointageType').value = 'present';
            
            const modal = new bootstrap.Modal(document.getElementById('modalPointage'));
            modal.show();
        });

        // Gérer le type d'absence pour griser/dégriser les heures
        document.getElementById('pointageType')?.addEventListener('change', (e) => {
            const hDebut = document.getElementById('pointageHeureDebut');
            const hFin = document.getElementById('pointageHeureFin');
            if (e.target.value !== 'present') {
                hDebut.value = '';
                hFin.value = '';
                hDebut.disabled = true;
                hFin.disabled = true;
            } else {
                hDebut.disabled = false;
                hFin.disabled = false;
                if (!hDebut.value) hDebut.value = '08:00';
                if (!hFin.value) hFin.value = '17:00';
            }
        });

        formPointage?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.savePointage();
        });
    }

    async loadPointages() {
        const tbody = document.getElementById('pointagesTbody');
        const emptyState = document.getElementById('pointagesEmpty');
        const table = document.getElementById('pointagesTable');

        if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary me-2"></div>Chargement...</td></tr>`;

        try {
            const result = await window.api.pointages.invoke('list', {
                employeId: this.filters.employeId || undefined,
                chantierId: this.filters.chantierId || undefined,
                dateDebut: this.filters.dateDebut || undefined,
                dateFin: this.filters.dateFin || undefined
            });

            if (!result?.success) throw new Error(result?.error || 'Erreur inconnue');

            const items = result.data || [];

            if (items.length === 0) {
                if (tbody) tbody.innerHTML = '';
                if (table) table.parentElement.classList.add('d-none');
                if (emptyState) emptyState.classList.remove('d-none');
            } else {
                if (table) table.parentElement.classList.remove('d-none');
                if (emptyState) emptyState.classList.add('d-none');
                this.renderPointages(items, tbody);
            }
        } catch (error) {
            console.error('Erreur chargement pointages:', error);
            if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-3">Erreur : ${error.message}</td></tr>`;
        }
    }

    renderPointages(items, tbody) {
        if (!tbody) return;

        const getTypeBadge = (type) => {
            switch(type) {
                case 'present': return '<span class="badge badge-actif">Présent</span>';
                case 'absence_justifiee': return '<span class="badge badge-warning">Abs. justifiée</span>';
                case 'absence_injustifiee': return '<span class="badge badge-inactif">Abs. injustifiée</span>';
                case 'maladie': return '<span class="badge badge-en-cours">Maladie</span>';
                case 'conge': return '<span class="badge badge-secondary">Congé</span>';
                default: return `<span class="badge badge-secondary">${type}</span>`;
            }
        };

        const getEmployeName = (id) => {
            const emp = this.employes.find(e => e.id === id);
            return emp ? `${emp.nom} ${emp.prenom || ''}` : `Employé #${id}`;
        };

        const getChantierName = (id) => {
            if (!id) return '<span class="text-muted small">Aucun (Dépôt)</span>';
            const c = this.chantiers.find(c => c.id === id);
            return c ? c.nom : `Chantier #${id}`;
        };

        const formatDate = (dateStr) => {
            if (!dateStr) return '';
            return new Date(dateStr).toLocaleDateString('fr-FR');
        };

        tbody.innerHTML = items.map(p => `
            <tr>
                <td class="fw-medium">${formatDate(p.dateJour)}</td>
                <td class="fw-semibold">${this.escHtml(getEmployeName(p.employeId))}</td>
                <td>${getChantierName(p.chantierId)}</td>
                <td>${p.heureDebut || '--:--'}</td>
                <td>${p.heureFin || '--:--'}</td>
                <td class="fw-bold text-primary">${p.heuresTotal != null ? p.heuresTotal + ' h' : '-'}</td>
                <td>${getTypeBadge(p.type)}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-secondary" onclick="alert('Modification à venir')">
                        <i class="bi bi-pencil"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    async savePointage() {
        const btnSave = document.querySelector('#formPointage button[type="submit"]');
        const data = {
            employeId: parseInt(document.getElementById('pointageEmploye').value),
            chantierId: document.getElementById('pointageChantier').value ? parseInt(document.getElementById('pointageChantier').value) : null,
            dateJour: document.getElementById('pointageDate').value,
            heureDebut: document.getElementById('pointageHeureDebut').value || null,
            heureFin: document.getElementById('pointageHeureFin').value || null,
            type: document.getElementById('pointageType').value,
            notes: document.getElementById('pointageNotes').value
        };

        if (btnSave) btnSave.disabled = true;

        try {
            const result = await window.api.pointages.invoke('create', data);
            
            if (result?.success) {
                const modal = bootstrap.Modal.getInstance(document.getElementById('modalPointage'));
                if (modal) modal.hide();
                if (window.showToast) window.showToast('Pointage enregistré avec succès', 'success');
                await this.loadPointages();
            } else {
                if (window.showToast) window.showToast(result?.error || 'Erreur lors de la sauvegarde', 'error');
            }
        } catch (error) {
            console.error('Erreur save pointage:', error);
            if (window.showToast) window.showToast('Erreur de communication', 'error');
        } finally {
            if (btnSave) btnSave.disabled = false;
        }
    }

    escHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }
}

// Instance globale pour le router
window.pointagesController = new PointagesController();
