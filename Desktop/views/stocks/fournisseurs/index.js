/**
 * stocks/fournisseurs/index.js — Contrôleur Vue Fournisseurs
 * Chargé dynamiquement par router.js
 */

class FournisseursController {
    constructor() {
        this.currentPage = 1;
        this.pageSize = 50;
        this.filters = { search: '' };
    }

    async init() {
        this.bindEvents();
        await this.loadFournisseurs();
    }

    bindEvents() {
        const searchInput = document.getElementById('searchFournisseur');
        const formFournisseur = document.getElementById('formFournisseur');
        const btnNouveau = document.getElementById('btnNouveauFournisseur');

        if (searchInput) {
            let debounceTimer;
            searchInput.addEventListener('input', () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.filters.search = searchInput.value.trim();
                    this.currentPage = 1;
                    this.loadFournisseurs();
                }, 300);
            });
        }

        btnNouveau?.addEventListener('click', () => this.openModal());

        formFournisseur?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveFournisseur();
        });
    }

    async loadFournisseurs() {
        const entrepriseId = window.AppState?.entreprise?.id || 1;
        const grid = document.getElementById('fournisseursGrid');
        const emptyState = document.getElementById('fournisseursEmpty');
        const totalLabel = document.getElementById('totalFournisseurs');

        if (grid) grid.innerHTML = `<div class="col-12 text-center py-5"><div class="spinner-border text-primary"></div></div>`;

        try {
            const result = await window.api.fournisseurs.invoke('list', {
                entrepriseId,
                limit: this.pageSize,
                offset: (this.currentPage - 1) * this.pageSize,
                search: this.filters.search || undefined
            });

            if (!result?.success) throw new Error(result?.error || 'Erreur inconnue');

            const items = result.data?.items || [];
            const total = result.data?.total || 0;

            if (totalLabel) totalLabel.textContent = `${total} fournisseur(s)`;

            if (items.length === 0) {
                if (grid) grid.innerHTML = '';
                if (emptyState) emptyState.classList.remove('d-none');
            } else {
                if (emptyState) emptyState.classList.add('d-none');
                this.renderFournisseurs(items, grid);
            }
        } catch (error) {
            console.error('Erreur chargement fournisseurs:', error);
            if (grid) grid.innerHTML = `<div class="col-12 text-center text-danger">Erreur : ${error.message}</div>`;
        }
    }

    renderFournisseurs(items, container) {
        if (!container) return;

        container.innerHTML = items.map(f => `
            <div class="col-md-6 col-lg-4">
                <div class="card h-100 border-0 shadow-sm supplier-card">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-3">
                            <h5 class="card-title fw-bold text-primary mb-0 text-truncate" title="${this.escHtml(f.nom)}">
                                <i class="bi bi-building me-2"></i>${this.escHtml(f.nom)}
                            </h5>
                            <div class="dropdown">
                                <button class="btn btn-sm btn-link text-secondary p-0" data-bs-toggle="dropdown">
                                    <i class="bi bi-three-dots-vertical"></i>
                                </button>
                                <ul class="dropdown-menu dropdown-menu-end shadow-sm">
                                    <li><a class="dropdown-item" href="#" onclick="window.fournisseursController.openModal(${f.id}, ${this.escHtml(JSON.stringify(f))})"><i class="bi bi-pencil me-2"></i>Modifier</a></li>
                                    <li><hr class="dropdown-divider"></li>
                                    <li><a class="dropdown-item text-danger" href="#" onclick="window.fournisseursController.deleteFournisseur(${f.id})"><i class="bi bi-trash me-2"></i>Supprimer</a></li>
                                </ul>
                            </div>
                        </div>
                        
                        <div class="mb-2">
                            <div class="small text-muted mb-1"><i class="bi bi-person me-2"></i>Contact</div>
                            <div class="fw-medium">${this.escHtml(f.contact || '—')}</div>
                        </div>
                        
                        <div class="mb-2">
                            <div class="small text-muted mb-1"><i class="bi bi-telephone me-2"></i>Téléphone</div>
                            <div>${f.telephone ? `<a href="tel:${f.telephone}" class="text-decoration-none">${this.escHtml(f.telephone)}</a>` : '—'}</div>
                        </div>
                        
                        <div>
                            <div class="small text-muted mb-1"><i class="bi bi-envelope me-2"></i>Email</div>
                            <div class="text-truncate">${f.email ? `<a href="mailto:${f.email}" class="text-decoration-none">${this.escHtml(f.email)}</a>` : '—'}</div>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    openModal(id = null, data = null) {
        const form = document.getElementById('formFournisseur');
        if (!form) return;
        form.reset();
        document.getElementById('fournisseurId').value = '';

        if (id && data) {
            document.getElementById('fournisseurId').value = id;
            document.getElementById('fournisseurNom').value = data.nom || '';
            document.getElementById('fournisseurContact').value = data.contact || '';
            document.getElementById('fournisseurTelephone').value = data.telephone || '';
            document.getElementById('fournisseurEmail').value = data.email || '';
            document.getElementById('fournisseurAdresse').value = data.adresse || '';
            document.getElementById('fournisseurNotes').value = data.notes || '';
        }

        new bootstrap.Modal(document.getElementById('modalFournisseur')).show();
    }

    async saveFournisseur() {
        const entrepriseId = window.AppState?.entreprise?.id || 1;
        const id = document.getElementById('fournisseurId').value;
        const btnSave = document.querySelector('#formFournisseur button[type="submit"]');

        const data = {
            nom: document.getElementById('fournisseurNom').value.trim(),
            contact: document.getElementById('fournisseurContact').value.trim(),
            telephone: document.getElementById('fournisseurTelephone').value.trim(),
            email: document.getElementById('fournisseurEmail').value.trim(),
            adresse: document.getElementById('fournisseurAdresse').value.trim(),
            notes: document.getElementById('fournisseurNotes').value.trim()
        };

        if (btnSave) btnSave.disabled = true;

        try {
            let result;
            if (id) {
                result = await window.api.fournisseurs.invoke('update', parseInt(id), data);
            } else {
                result = await window.api.fournisseurs.invoke('create', data, entrepriseId);
            }

            if (result?.success) {
                const modal = bootstrap.Modal.getInstance(document.getElementById('modalFournisseur'));
                if (modal) modal.hide();
                if (window.showToast) window.showToast('Fournisseur enregistré', 'success');
                await this.loadFournisseurs();
            } else {
                if (window.showToast) window.showToast(result?.error || 'Erreur', 'error');
            }
        } catch (error) {
            console.error('Erreur save fournisseur', error);
        } finally {
            if (btnSave) btnSave.disabled = false;
        }
    }

    async deleteFournisseur(id) {
        if (!confirm('Supprimer ce fournisseur ?')) return;
        try {
            const result = await window.api.fournisseurs.invoke('delete', id);
            if (result?.success) {
                if (window.showToast) window.showToast('Fournisseur supprimé', 'success');
                await this.loadFournisseurs();
            } else {
                if (window.showToast) window.showToast(result?.error || 'Erreur', 'error');
            }
        } catch (e) {
            console.error('Erreur delete fournisseur', e);
        }
    }

    escHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML.replace(/"/g, '&quot;');
    }
}

// Instance globale
window.fournisseursController = new FournisseursController();
