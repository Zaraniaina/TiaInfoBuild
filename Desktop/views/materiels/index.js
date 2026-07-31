/**
 * materiels/index.js — Contrôleur Vue Matériels & Engins
 * Chargé dynamiquement par router.js via loadScript('materiels/index.js')
 */

class MaterielsController {
    constructor() {
        this.currentPage = 1;
        this.pageSize = 20;
        this.totalItems = 0;
        this.filters = { search: '', statut: '' };
        this.materielEnEdition = null;
    }

    async init() {
        this.bindEvents();
        await this.loadMateriels();
    }

    bindEvents() {
        // Recherche
        const searchInput = document.getElementById('searchMateriel');
        if (searchInput) {
            let debounceTimer;
            searchInput.addEventListener('input', () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.filters.search = searchInput.value.trim();
                    this.currentPage = 1;
                    this.loadMateriels();
                }, 350);
            });
        }

        // Filtre état
        const filterEtat = document.getElementById('filterEtatMateriel');
        if (filterEtat) {
            filterEtat.addEventListener('change', () => {
                this.filters.statut = filterEtat.value;
                this.currentPage = 1;
                this.loadMateriels();
            });
        }

        // Actualiser
        document.getElementById('btnRefreshMateriels')?.addEventListener('click', () => this.loadMateriels());

        // Nouveau matériel
        document.getElementById('btnNouveauMateriel')?.addEventListener('click', () => this.openModal());
        document.getElementById('btnFirstMateriel')?.addEventListener('click', () => this.openModal());

        // Soumission formulaire
        const formMateriel = document.getElementById('formMateriel');
        if (formMateriel) {
            formMateriel.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveMateriel();
            });
        }
    }

    async loadMateriels() {
        const entrepriseId = window.AppState?.entreprise?.id || 1;
        const tbody = document.getElementById('materielsTbody');
        const table = document.querySelector('.card:has(#materielsTable)') || document.getElementById('materielsTable')?.closest('.card');
        const emptyState = document.getElementById('materielsEmpty');

        // Afficher loader
        if (tbody) tbody.innerHTML = `
            <tr><td colspan="7" class="text-center py-4">
                <div class="spinner-border spinner-border-sm text-primary me-2"></div>Chargement…
            </td></tr>`;

        try {
            const result = await window.api.materiels.invoke('list', {
                entrepriseId,
                limit: this.pageSize,
                offset: (this.currentPage - 1) * this.pageSize,
                statut: this.filters.statut || undefined,
                search: this.filters.search || undefined
            });

            if (!result || !result.success) throw new Error(result?.error || 'Erreur inconnue');

            const items = result.data?.items || [];
            this.totalItems = result.data?.total || 0;

            if (items.length === 0) {
                if (tbody) tbody.innerHTML = '';
                if (table) table.classList.add('d-none');
                if (emptyState) emptyState.classList.remove('d-none');
            } else {
                if (table) table.classList.remove('d-none');
                if (emptyState) emptyState.classList.add('d-none');
                this.renderMateriels(items, tbody);
            }
        } catch (error) {
            console.error('Erreur chargement matériels:', error);
            if (tbody) tbody.innerHTML = `
                <tr><td colspan="7" class="text-center text-danger py-3">
                    <i class="bi bi-exclamation-triangle me-2"></i>Erreur : ${error.message}
                </td></tr>`;
        }
    }

    renderMateriels(items, tbody) {
        if (!tbody) return;

        const statutBadge = {
            disponible:      { cls: 'badge-actif',    label: 'Disponible' },
            en_utilisation:  { cls: 'badge-en-cours',  label: 'En utilisation' },
            en_maintenance:  { cls: 'badge-warning',   label: 'En maintenance' },
            hors_service:    { cls: 'badge-inactif',   label: 'Hors service' }
        };

        tbody.innerHTML = items.map((m, idx) => {
            const s = statutBadge[m.statut] || { cls: 'badge-secondary', label: m.statut || '—' };
            const prochaine = m.prochaineMaintenance
                ? new Date(m.prochaineMaintenance).toLocaleDateString('fr-FR')
                : '<span class="text-secondary">—</span>';
            return `
            <tr>
                <td class="text-secondary small">${(this.currentPage - 1) * this.pageSize + idx + 1}</td>
                <td class="fw-semibold">${this.escHtml(m.nom || m.designation || '—')}</td>
                <td>${this.escHtml(m.type || '—')}</td>
                <td><code class="small">${this.escHtml(m.numeroSerie || '—')}</code></td>
                <td><span class="badge ${s.cls}">${s.label}</span></td>
                <td class="small">${prochaine}</td>
                <td>
                    <div class="d-flex gap-1">
                        <button class="btn btn-sm btn-outline-primary" title="Modifier"
                            onclick="window.materielsController.openModal(${m.id})">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" title="Supprimer"
                            onclick="window.materielsController.deleteMateriel(${m.id}, '${this.escHtml(m.nom || m.designation || '')}')">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>`;
        }).join('');
    }

    async openModal(id = null) {
        const modal = document.getElementById('modalMateriel');
        const form = document.getElementById('formMateriel');
        const title = modal?.querySelector('.modal-title');

        if (!modal || !form) return;

        form.reset();
        document.getElementById('materielId').value = '';
        this.materielEnEdition = null;

        if (id) {
            title.innerHTML = '<i class="bi bi-tools me-2"></i>Modifier le matériel';
            try {
                const result = await window.api.materiels.invoke('get', id);
                if (result?.success && result.data) {
                    const m = result.data;
                    this.materielEnEdition = m;
                    document.getElementById('materielId').value = m.id;
                    document.getElementById('matDesignation').value = m.nom || m.designation || '';
                    document.getElementById('matType').value = m.type || '';
                    document.getElementById('matNumeroSerie').value = m.numeroSerie || '';
                    document.getElementById('matEtat').value = m.statut || 'disponible';
                    if (document.getElementById('matProchaineMaintenance')) {
                        document.getElementById('matProchaineMaintenance').value = m.prochaineMaintenance || '';
                    }
                }
            } catch (e) {
                console.error('Erreur chargement matériel:', e);
            }
        } else {
            title.innerHTML = '<i class="bi bi-tools me-2"></i>Nouveau matériel';
        }

        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
    }

    async saveMateriel() {
        const entrepriseId = window.AppState?.entreprise?.id || 1;
        const id = document.getElementById('materielId')?.value;
        const btnSave = document.querySelector('#formMateriel button[type="submit"]');

        const data = {
            designation: document.getElementById('matDesignation')?.value.trim(),
            nom:         document.getElementById('matDesignation')?.value.trim(),
            type:        document.getElementById('matType')?.value.trim() || null,
            numeroSerie: document.getElementById('matNumeroSerie')?.value.trim() || null,
            statut:      document.getElementById('matEtat')?.value || 'disponible',
            prochaineMaintenance: document.getElementById('matProchaineMaintenance')?.value || null
        };

        if (!data.designation) {
            if (window.showToast) showToast('La désignation est obligatoire.', 'warning');
            return;
        }

        if (btnSave) btnSave.disabled = true;

        try {
            let result;
            if (id) {
                result = await window.api.materiels.invoke('update', parseInt(id), data);
            } else {
                result = await window.api.materiels.invoke('create', data, entrepriseId);
            }

            if (result?.success) {
                const modal = bootstrap.Modal.getInstance(document.getElementById('modalMateriel'));
                if (modal) modal.hide();
                if (window.showToast) showToast(id ? 'Matériel mis à jour' : 'Matériel ajouté', 'success');
                await this.loadMateriels();
            } else {
                if (window.showToast) showToast(result?.error || 'Erreur lors de l\'enregistrement', 'error');
            }
        } catch (err) {
            console.error('Erreur save matériel:', err);
            if (window.showToast) showToast('Erreur de communication', 'error');
        } finally {
            if (btnSave) btnSave.disabled = false;
        }
    }

    async deleteMateriel(id, nom) {
        if (!confirm(`Supprimer le matériel "${nom}" ? Cette action est irréversible.`)) return;
        try {
            const result = await window.api.materiels.invoke('delete', id);
            if (result?.success) {
                if (window.showToast) showToast('Matériel supprimé', 'success');
                await this.loadMateriels();
            } else {
                if (window.showToast) showToast(result?.error || 'Erreur suppression', 'error');
            }
        } catch (err) {
            console.error('Erreur delete matériel:', err);
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
window.materielsController = new MaterielsController();
