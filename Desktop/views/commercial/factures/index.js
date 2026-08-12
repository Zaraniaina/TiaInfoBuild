/**
 * commercial/factures/index.js — Contrôleur Vue Factures
 * Chargé dynamiquement par router.js
 */

class FacturesController {
    constructor() {
        this.currentPage = 1;
        this.pageSize = 20;
        this.filters = { search: '', statut: '' };
        this.contrats = [];
        this.clients = [];
        this.factureEnEdition = null;
    }

    async init() {
        await this.loadReferences();
        this.bindEvents();
        await this.loadFactures();
    }

    async loadReferences() {
        const entrepriseId = window.AppState?.entreprise?.id || 1;
        try {
            // Charger les contrats
            const contratsResult = await window.api.contrats.invoke('list', { entrepriseId, limit: 1000, offset: 0 });
            if (contratsResult?.success && contratsResult.data?.items) {
                this.contrats = contratsResult.data.items;
                this.populateSelect('factureContrat', this.contrats, 'id', c => `Contrat #${c.id} - ${c.titre || c.objet || ''}`);
            }
            
            // Charger les clients
            const clientsResult = await window.api.clients.invoke('list', { entrepriseId, limit: 1000 });
            if (clientsResult?.success && clientsResult.data?.items) {
                this.clients = clientsResult.data.items;
                this.populateSelect('factureClient', this.clients, 'id', c => this.getClientDisplayName(c));
            }
        } catch (error) {
            console.error('Erreur chargement références factures:', error);
        }
    }

    getClientDisplayName(c) {
        if (!c) return '';
        if (c.type === 'entreprise' || c.type === 'public') {
            return `${c.entreprise || c.nom || ''} ${c.prenom || ''}`.trim();
        }
        return `${c.civilite || ''} ${c.prenom || ''} ${c.nom || ''}`.trim();
    }

    populateSelect(elementId, items, valueKey, labelFn) {
        const select = document.getElementById(elementId);
        if (!select) return;
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
        const searchInput = document.getElementById('searchFacture');
        const filterStatut = document.getElementById('filterStatutFacture');
        const formFacture = document.getElementById('formFacture');
        const formPaiement = document.getElementById('formPaiement');

        if (searchInput) {
            let debounceTimer;
            searchInput.addEventListener('input', () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.filters.search = searchInput.value.trim();
                    this.currentPage = 1;
                    this.loadFactures();
                }, 350);
            });
        }

        filterStatut?.addEventListener('change', () => {
            this.filters.statut = filterStatut.value;
            this.currentPage = 1;
            this.loadFactures();
        });

        document.getElementById('btnNouvelleFacture')?.addEventListener('click', () => this.openModalFacture());

        formFacture?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveFacture();
        });

        formPaiement?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.savePaiement();
        });

        // Calcul automatique TTC depuis HT avec TVA sélectionnée
        const htInput = document.getElementById('factureMontantHT');
        const tvaSelect = document.getElementById('factureTVA');
        const ttcInput = document.getElementById('factureMontantTTC');
        
        const calculateTTC = () => {
            const ht = parseFloat(htInput?.value) || 0;
            const tva = parseFloat(tvaSelect?.value) || 20;
            const ttc = ht * (1 + tva / 100);
            if (ttcInput) ttcInput.value = ttc.toFixed(2);
        };
        
        htInput?.addEventListener('input', calculateTTC);
        tvaSelect?.addEventListener('change', calculateTTC);
    }

    formatCurrency(amount) {
        return window.formatCurrencyGlobal ? window.formatCurrencyGlobal(amount) : new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'MGA',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount || 0);
    }
    async loadFactures() {
        const entrepriseId = window.AppState?.entreprise?.id || 1;
        const tbody = document.getElementById('facturesTbody');
        const emptyState = document.getElementById('facturesEmpty');
        const table = document.getElementById('facturesTable');

        if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary me-2"></div>Chargement...</td></tr>`;

        try {
            const result = await window.api.factures.invoke('list', {
                entrepriseId,
                limit: this.pageSize,
                offset: (this.currentPage - 1) * this.pageSize,
                statut: this.filters.statut || undefined
            });

            if (result?.success === false) {
                throw new Error(result?.error || 'Erreur lors du chargement des factures');
            }

            let items = result?.data?.items || result?.items || [];
            if (this.filters.search) {
                const s = this.filters.search.toLowerCase();
                items = items.filter(f => (f.numero && f.numero.toLowerCase().includes(s)));
            }

            if (items.length === 0) {
                if (tbody) tbody.innerHTML = '';
                if (table) table.parentElement.classList.add('d-none');
                if (emptyState) emptyState.classList.remove('d-none');
            } else {
                if (table) table.parentElement.classList.remove('d-none');
                if (emptyState) emptyState.classList.add('d-none');
                this.renderFactures(items, tbody);
            }
        } catch (error) {
            console.error('Erreur chargement factures:', error);
            if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-3">Erreur : ${error.message}</td></tr>`;
        }
    }

    renderFactures(items, tbody) {
        if (!tbody) return;

        const getStatutBadge = (statut) => {
            switch(statut) {
                case 'paye': return '<span class="badge bg-success">Payée</span>';
                case 'partiel': return '<span class="badge bg-warning text-dark">Partielle</span>';
                case 'emise': return '<span class="badge bg-primary">Émise</span>';
                case 'annulee': return '<span class="badge bg-secondary">Annulée</span>';
                case 'brouillon':
                default: return '<span class="badge bg-light text-dark border">Brouillon</span>';
            }
        };

        const formatDate = (dateStr) => {
            if (!dateStr) return '';
            return new Date(dateStr).toLocaleDateString('fr-FR');
        };

       const formatMoney = (amount) => {
        return window.formatCurrencyGlobal ? window.formatCurrencyGlobal(amount) : new Intl.NumberFormat('fr-FR', { 
            style: 'currency', 
            currency: 'MGA' 
        }).format(amount || 0);
        };

        tbody.innerHTML = items.map(f => {
            // Un petit hack pour avoir client/reste à payer car list ne ramène pas tout
            // Normalement list devrait le ramener, ou on fera des getters.
            const reste = f.resteAPayer !== undefined ? f.resteAPayer : (f.montant || 0);
            const clientName = f.client ? this.getClientDisplayName(f.client) : (f.clientId ? `Client #${f.clientId}` : '—');
            
            return `
            <tr>
                <td class="fw-bold text-primary">${this.escHtml(f.numero || 'Brouillon')}</td>
                <td>${this.escHtml(clientName)}</td>
                <td>${formatDate(f.dateEmission)}</td>
                <td class="${new Date(f.dateEcheance) < new Date() && f.statut !== 'paye' ? 'text-danger fw-bold' : ''}">${formatDate(f.dateEcheance)}</td>
                <td class="text-end fw-semibold">${formatMoney(f.montant)}</td>
                <td class="text-end ${reste > 0 ? 'text-danger fw-bold' : 'text-success fw-bold'}">${formatMoney(reste)}</td>
                <td>${getStatutBadge(f.statut)}</td>
                <td class="text-end">
                    <div class="dropdown">
                        <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown">
                            Actions
                        </button>
                        <ul class="dropdown-menu dropdown-menu-end shadow-sm">
                            <li><a class="dropdown-item" href="#" data-permission="factures:update" onclick="window.facturesController.openModalFacture(${f.id})"><i class="bi bi-pencil me-2"></i>Modifier</a></li>
                            ${f.statut !== 'paye' && f.statut !== 'annulee' ? 
                                `<li><a class="dropdown-item text-success" href="#" data-permission="factures:ajouterPaiement" onclick="window.facturesController.openModalPaiement(${f.id}, ${reste})"><i class="bi bi-cash me-2"></i>Paiement</a></li>` 
                                : ''}
                            <li><hr class="dropdown-divider"></li>
                            <li><a class="dropdown-item text-danger" href="#" data-permission="factures:delete" onclick="window.facturesController.deleteFacture(${f.id})"><i class="bi bi-trash me-2"></i>Supprimer</a></li>
                        </ul>
                    </div>
                </td>
            </tr>
        `}).join('');
    }

    async openModalFacture(id = null) {
        const form = document.getElementById('formFacture');
        if (!form) return;
        form.reset();
        document.getElementById('factureId').value = '';
        document.getElementById('factureEntrepriseId').value = window.AppState?.entreprise?.id || 1;
        this.factureEnEdition = null;

        if (id) {
            try {
                const result = await window.api.factures.invoke('get', id);
                if (result?.success && result.data) {
                    const f = result.data;
                    this.factureEnEdition = f;
                    document.getElementById('factureId').value = f.id;
                    document.getElementById('factureNumero').value = f.numero || '';
                    document.getElementById('factureClient').value = f.clientId || '';
                    document.getElementById('factureContrat').value = f.contratId || '';
                    document.getElementById('factureDateEmission').value = f.dateEmission ? f.dateEmission.split('T')[0] : '';
                    document.getElementById('factureDateEcheance').value = f.dateEcheance ? f.dateEcheance.split('T')[0] : '';
                    document.getElementById('factureMontantHT').value = f.montantHT || f.montant || 0;
                    document.getElementById('factureMontantTTC').value = f.montantTTC || f.montant || 0;
                    document.getElementById('factureTVA').value = f.tva ? f.tva.toString() : '20';
                    document.getElementById('factureStatut').value = f.statut || 'brouillon';
                    document.getElementById('factureNotes').value = f.notes || '';
                }
            } catch (e) {
                console.error('Erreur chargement facture', e);
            }
        } else {
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('factureDateEmission').value = today;
            
            const echeance = new Date();
            echeance.setDate(echeance.getDate() + 30);
            document.getElementById('factureDateEcheance').value = echeance.toISOString().split('T')[0];
            
            document.getElementById('factureTVA').value = '20';
        }

        new bootstrap.Modal(document.getElementById('modalFacture')).show();
    }

    async saveFacture() {
        const entrepriseId = window.AppState?.entreprise?.id || 1;
        const id = document.getElementById('factureId').value;
        const btnSave = document.querySelector('#formFacture button[type="submit"]');

        const ht = parseFloat(document.getElementById('factureMontantHT').value) || 0;
        const tva = parseFloat(document.getElementById('factureTVA').value) || 20;
        const ttc = parseFloat(document.getElementById('factureMontantTTC').value) || 0;

        const data = {
            numero: document.getElementById('factureNumero').value,
            clientId: document.getElementById('factureClient').value ? parseInt(document.getElementById('factureClient').value) : null,
            contratId: document.getElementById('factureContrat').value ? parseInt(document.getElementById('factureContrat').value) : null,
            entrepriseId: entrepriseId,
            dateEmission: document.getElementById('factureDateEmission').value,
            dateEcheance: document.getElementById('factureDateEcheance').value,
            montantHT: ht,
            montant: ttc,
            montantTTC: ttc,
            tva: tva,
            statut: document.getElementById('factureStatut').value,
            notes: document.getElementById('factureNotes').value
        };

        if (btnSave) btnSave.disabled = true;

        try {
            let result;
            if (id) {
                result = await window.api.factures.invoke('update', parseInt(id), data);
            } else {
                result = await window.api.factures.invoke('create', data, entrepriseId);
            }

            if (result?.success) {
                const modal = bootstrap.Modal.getInstance(document.getElementById('modalFacture'));
                if (modal) modal.hide();
                if (window.showToast) window.showToast('Facture enregistrée', 'success');
                await this.loadFactures();
            } else {
                if (window.showToast) window.showToast(result?.error || 'Erreur', 'error');
            }
        } catch (e) {
            console.error('Erreur save facture', e);
        } finally {
            if (btnSave) btnSave.disabled = false;
        }
    }

    async deleteFacture(id) {
        if (!confirm('Supprimer cette facture ?')) return;
        try {
            const result = await window.api.factures.invoke('delete', id);
            if (result?.success) {
                if (window.showToast) window.showToast('Facture supprimée', 'success');
                await this.loadFactures();
            } else {
                if (window.showToast) window.showToast(result?.error || 'Erreur', 'error');
            }
        } catch (e) {
            console.error('Erreur delete facture', e);
        }
    }

    openModalPaiement(factureId, resteAPayer) {
        const form = document.getElementById('formPaiement');
        if (!form) return;
        form.reset();
        
        const entrepriseId = window.AppState?.entreprise?.id || 1;
        document.getElementById('paiementFactureId').value = factureId;
        document.getElementById('paiementEntrepriseId').value = entrepriseId;
        document.getElementById('paiementDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('paiementMontant').value = resteAPayer;
        
        const resteLabel = document.getElementById('paiementResteLabel');
        if (resteLabel) {
            resteLabel.textContent = window.formatCurrencyGlobal ? window.formatCurrencyGlobal(resteAPayer) : new Intl.NumberFormat('fr-FR', { 
            style: 'currency', 
            currency: 'MGA' 
        }).format(resteAPayer);
        }

        new bootstrap.Modal(document.getElementById('modalPaiement')).show();
    }

    async savePaiement() {
        const factureId = document.getElementById('paiementFactureId').value;
        const btnSave = document.querySelector('#formPaiement button[type="submit"]');

        const data = {
            datePaiement: document.getElementById('paiementDate').value,
            montant: parseFloat(document.getElementById('paiementMontant').value),
            modePaiement: document.getElementById('paiementMode').value
        };

        if (btnSave) btnSave.disabled = true;

        try {
            const result = await window.api.factures.invoke('ajouterPaiement', parseInt(factureId), data);
            if (result?.success) {
                const modal = bootstrap.Modal.getInstance(document.getElementById('modalPaiement'));
                if (modal) modal.hide();
                if (window.showToast) window.showToast('Paiement enregistré', 'success');
                await this.loadFactures();
            } else {
                if (window.showToast) window.showToast(result?.error || 'Erreur', 'error');
            }
        } catch (e) {
            console.error('Erreur paiement', e);
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
window.facturesController = new FacturesController();
