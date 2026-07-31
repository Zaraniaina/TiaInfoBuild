/**
 * Clients View Controller
 * Gère la liste, création, édition, suppression des clients
 */

class ClientsController {
    constructor() {
        this.currentPage = 1;
        this.pageSize = 20;
        this.totalItems = 0;
        this.filters = {
            search: '',
            type: '',
            tri: 'nom_asc'
        };
        this.clientEnEdition = null;
        this.commerciauxCache = [];
    }

    /**
     * Initialiser le contrôleur
     */
    async init() {
        await this.loadCommerciaux();
        this.bindEvents();
        await this.loadClients();
    }

    /**
     * Charger les commerciaux pour les selects
     */
    async loadCommerciaux() {
        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;
            const result = await window.api.employes.invoke('list', {
                entrepriseId,
                limit: 100,
                statut: 'actif'
            });
            this.commerciauxCache = result.items?.filter(e => e.poste?.includes('Commercial') || e.poste?.includes('Vente')) || result.items || [];
            this.populateCommercialSelect();
        } catch (error) {
            console.error('Erreur chargement commerciaux:', error);
        }
    }

    /**
     * Remplir le select commercial
     */
    populateCommercialSelect() {
        const select = document.getElementById('cliCommercial');
        if (!select) return;
        const currentValue = select.value;
        select.innerHTML = '<option value="">Sélectionner</option>';
        this.commerciauxCache.forEach(c => {
            const option = document.createElement('option');
            option.value = c.id;
            option.textContent = `${c.prenom} ${c.nom}`.trim();
            select.appendChild(option);
        });
        select.value = currentValue;
    }

    /**
     * Lier les événements UI
     */
    bindEvents() {
        // Recherche
        const searchInput = document.getElementById('searchClient');
        if (searchInput) {
            let debounceTimer;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.filters.search = e.target.value;
                    this.currentPage = 1;
                    this.loadClients();
                }, 300);
            });
        }

        // Filtre type
        document.getElementById('filterTypeClient')?.addEventListener('change', (e) => {
            this.filters.type = e.target.value;
            this.currentPage = 1;
            this.loadClients();
        });

        // Filtre tri
        document.getElementById('filterTriClient')?.addEventListener('change', (e) => {
            this.filters.tri = e.target.value;
            this.loadClients();
        });

        // Boutons
        document.getElementById('btnNouveauClient')?.addEventListener('click', () => this.openModalNouveau());
        document.getElementById('btnFirstClient')?.addEventListener('click', () => this.openModalNouveau());
        document.getElementById('btnRefreshClients')?.addEventListener('click', () => this.loadClients());
        document.getElementById('btnExportClients')?.addEventListener('click', () => this.exportClients());

        // Formulaire client
        document.getElementById('formClient')?.addEventListener('submit', (e) => this.handleSubmitClient(e));
        document.getElementById('btnDeleteClient')?.addEventListener('click', () => this.confirmDeleteClient());
        document.getElementById('btnConfirmDeleteClient')?.addEventListener('click', () => this.executeDeleteClient());

        // Adresses
        document.getElementById('btnAjouterAdresseClient')?.addEventListener('click', () => this.openModalAdresse());
        document.getElementById('formAdresseClient')?.addEventListener('submit', (e) => this.handleSubmitAdresse(e));

        // Modifier depuis détail
        document.getElementById('btnEditClientFromDetail')?.addEventListener('click', () => {
            const modalDetail = bootstrap.Modal.getInstance(document.getElementById('modalClientDetail'));
            modalDetail?.hide();
            setTimeout(() => this.openModalEdition(this.clientEnEdition?.id), 300);
        });
    }

    /**
     * Charger la liste des clients
     */
    async loadClients() {
        this.showLoader(true);

        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;

            const result = await window.api.clients.invoke('list', {
                entrepriseId,
                limit: this.pageSize,
                offset: (this.currentPage - 1) * this.pageSize,
                search: this.filters.search || undefined
            });

            this.totalItems = result.total || 0;
            this.renderClientsTable(result.items || []);
            this.renderPagination();
            this.toggleEmptyState(result.items?.length === 0);

        } catch (error) {
            console.error('Erreur chargement clients:', error);
            showToast('Erreur lors du chargement des clients', 'error');
        } finally {
            this.showLoader(false);
        }
    }

    /**
     * Afficher les clients dans le tableau
     */
    renderClientsTable(clients) {
        const tbody = document.getElementById('clientsTbody');
        if (!tbody) return;

        if (clients.length === 0) {
            tbody.innerHTML = '';
            return;
        }

        tbody.innerHTML = clients.map((c, index) => {
            const typeLabel = {
                'particulier': 'Particulier',
                'entreprise': 'Entreprise',
                'public': 'Marché public'
            }[c.type] || c.type;

            const typeBadge = {
                'particulier': 'bg-info',
                'entreprise': 'bg-primary',
                'public': 'bg-success'
            }[c.type] || 'bg-secondary';

            const nomComplet = c.type === 'entreprise'
                ? c.entreprise || `${c.prenom} ${c.nom}`.trim()
                : `${c.civilite || ''} ${c.prenom} ${c.nom}`.trim();

            const ville = c.adresses?.find(a => a.defaut && a.type === 'facturation')?.ville
                || c.adresses?.[0]?.ville
                || '—';

            return `
                <tr data-id="${c.id}">
                    <td>${(this.currentPage - 1) * this.pageSize + index + 1}</td>
                    <td>
                        <div class="fw-semibold">${this.escapeHtml(nomComplet)}</div>
                        <small class="text-secondary">${c.type === 'entreprise' ? this.escapeHtml(c.siret || '') : ''}</small>
                    </td>
                    <td><span class="badge ${typeBadge}">${typeLabel}</span></td>
                    <td class="d-none d-md-table-cell">${this.escapeHtml(c.email || '—')}</td>
                    <td class="d-none d-md-table-cell">${this.escapeHtml(c.telephone || c.portable || '—')}</td>
                    <td class="d-none d-lg-table-cell">${this.escapeHtml(ville)}</td>
                    <td class="d-none d-xl-table-cell">${this.formatCurrency(c.caTotal || 0)}</td>
                    <td class="d-none d-xl-table-cell">
                        <small class="text-secondary">${c.dernierContact ? this.formatDate(c.dernierContact) : '—'}</small>
                    </td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-secondary btn-view" data-id="${c.id}" title="Voir">
                                <i class="bi bi-eye"></i>
                            </button>
                            <button class="btn btn-outline-primary btn-edit" data-id="${c.id}" title="Modifier">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-outline-success btn-devis" data-id="${c.id}" title="Nouveau devis">
                                <i class="bi bi-file-earmark-plus"></i>
                            </button>
                            <button class="btn btn-outline-danger btn-delete" data-id="${c.id}" title="Supprimer">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Binder les actions
        tbody.querySelectorAll('.btn-view').forEach(btn => {
            btn.addEventListener('click', (e) => this.viewClient(e.currentTarget.dataset.id));
        });
        tbody.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => this.openModalEdition(e.currentTarget.dataset.id));
        });
        tbody.querySelectorAll('.btn-devis').forEach(btn => {
            btn.addEventListener('click', (e) => {
                window.router.navigate(`#devis/nouveau?clientId=${e.currentTarget.dataset.id}`);
            });
        });
        tbody.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => this.confirmDeleteClient(e.currentTarget.dataset.id));
        });
    }

    /**
     * Afficher la pagination
     */
    renderPagination() {
        const container = document.getElementById('clientsPagination');
        if (!container) return;

        const totalPages = Math.ceil(this.totalItems / this.pageSize);
        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let html = '<nav><ul class="pagination pagination-sm mb-0">';
        html += `<li class="page-item ${this.currentPage === 1 ? 'disabled' : ''}"><a class="page-link" href="#" data-page="${this.currentPage - 1}"><i class="bi bi-chevron-left"></i></a></li>`;

        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(totalPages, this.currentPage + 2);
        for (let i = startPage; i <= endPage; i++) {
            html += `<li class="page-item ${i === this.currentPage ? 'active' : ''}"><a class="page-link" href="#" data-page="${i}">${i}</a></li>`;
        }

        html += `<li class="page-item ${this.currentPage === totalPages ? 'disabled' : ''}"><a class="page-link" href="#" data-page="${this.currentPage + 1}"><i class="bi bi-chevron-right"></i></a></li>`;
        html += '</ul></nav>';
        container.innerHTML = html;

        container.querySelectorAll('.page-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = parseInt(e.currentTarget.dataset.page);
                if (page && page !== this.currentPage && page >= 1 && page <= totalPages) {
                    this.currentPage = page;
                    this.loadClients();
                }
            });
        });
    }

    /**
     * Afficher/masquer l'état vide
     */
    toggleEmptyState(isEmpty) {
        document.getElementById('clientsEmpty')?.classList.toggle('d-none', !isEmpty);
        document.getElementById('clientsTable')?.classList.toggle('d-none', isEmpty);
        document.getElementById('clientsPagination')?.classList.toggle('d-none', isEmpty);
    }

    /**
     * Ouvrir la modale pour nouveau client
     */
    openModalNouveau() {
        this.clientEnEdition = null;
        this.resetFormClient();
        document.getElementById('modalClientLabel').textContent = 'Nouveau client';
        document.getElementById('btnDeleteClient').style.display = 'none';

        const modal = new bootstrap.Modal(document.getElementById('modalClient'));
        modal.show();
    }

    /**
     * Ouvrir la modale pour éditer un client
     */
    async openModalEdition(id) {
        try {
            const client = await window.api.clients.invoke('get', parseInt(id));
            if (!client) {
                showToast('Client non trouvé', 'error');
                return;
            }

            this.clientEnEdition = client;
            this.fillFormClient(client);
            document.getElementById('modalClientLabel').textContent = `Modifier: ${this.getClientDisplayName(client)}`;
            document.getElementById('btnDeleteClient').style.display = 'inline-block';
            document.getElementById('btnDeleteClient').dataset.id = id;

            // Charger les adresses
            this.renderClientAdresses(client.adresses || []);

            const modal = new bootstrap.Modal(document.getElementById('modalClient'));
            modal.show();
        } catch (error) {
            console.error('Erreur chargement client:', error);
            showToast('Erreur lors du chargement du client', 'error');
        }
    }

    /**
     * Obtenir le nom d'affichage du client
     */
    getClientDisplayName(c) {
        if (c.type === 'entreprise') {
            return c.entreprise || `${c.prenom} ${c.nom}`.trim();
        }
        return `${c.civilite || ''} ${c.prenom} ${c.nom}`.trim();
    }

    /**
     * Voir le détail d'un client
     */
    async viewClient(id) {
        try {
            const client = await window.api.clients.invoke('get', parseInt(id));
            if (!client) {
                showToast('Client non trouvé', 'error');
                return;
            }

            this.renderClientDetail(client);
            const modal = new bootstrap.Modal(document.getElementById('modalClientDetail'));
            modal.show();
        } catch (error) {
            console.error('Erreur chargement détail:', error);
            showToast('Erreur lors du chargement du détail', 'error');
        }
    }

    /**
     * Rendre le détail du client
     */
    renderClientDetail(c) {
        const container = document.getElementById('clientDetailContent');
        if (!container) return;

        const typeLabel = {
            'particulier': 'Particulier',
            'entreprise': 'Entreprise',
            'public': 'Marché public'
        }[c.type] || c.type;

        container.innerHTML = `
            <div class="row g-4">
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-body text-center">
                            <div class="mb-3">
                                <span class="badge bg-${c.type === 'entreprise' ? 'primary' : c.type === 'public' ? 'success' : 'info'} fs-6">${typeLabel}</span>
                            </div>
                            <h4>${this.escapeHtml(this.getClientDisplayName(c))}</h4>
                            ${c.siret ? `<p class="text-secondary small">SIRET: ${this.escapeHtml(c.siret)}</p>` : ''}
                            ${c.numeroTVA ? `<p class="text-secondary small">TVA: ${this.escapeHtml(c.numeroTVA)}</p>` : ''}
                            <hr>
                            <div class="text-start small">
                                <div><strong>Email:</strong> ${this.escapeHtml(c.email || '—')}</div>
                                <div><strong>Tél:</strong> ${this.escapeHtml(c.telephone || '—')}</div>
                                <div><strong>Portable:</strong> ${this.escapeHtml(c.portable || '—')}</div>
                                <div><strong>Site:</strong> ${c.siteWeb ? `<a href="${this.escapeHtml(c.siteWeb)}" target="_blank">${this.escapeHtml(c.siteWeb)}</a>` : '—'}</div>
                                <div class="mt-2"><strong>Origine:</strong> ${this.escapeHtml(c.origine || '—')}</div>
                                <div><strong>Commercial:</strong> ${c.commercial ? this.escapeHtml(`${c.commercial.prenom} ${c.commercial.nom}`.trim()) : '—'}</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-8">
                    <div class="card mb-3">
                        <div class="card-header"><h6 class="mb-0"><i class="bi bi-geo-alt me-2"></i>Adresses</h6></div>
                        <div class="card-body p-0">
                            ${c.adresses && c.adresses.length > 0 ? `
                                <div class="list-group list-group-flush">
                                    ${c.adresses.map(a => `
                                        <div class="list-group-item">
                                            <div class="d-flex justify-content-between">
                                                <span class="badge bg-${a.type === 'facturation' ? 'primary' : a.type === 'livraison' ? 'success' : 'info'}">${a.type}</span>
                                                ${a.defaut ? '<span class="badge bg-secondary">Défaut</span>' : ''}
                                            </div>
                                            <div class="fw-semibold">${this.escapeHtml(a.ligne1)}</div>
                                            ${a.ligne2 ? `<small>${this.escapeHtml(a.ligne2)}</small>` : ''}
                                            <small class="text-secondary">${this.escapeHtml(a.codePostal)} ${this.escapeHtml(a.ville)} ${this.escapeHtml(a.pays)}</small>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : '<div class="text-center py-3 text-secondary">Aucune adresse</div>'}
                        </div>
                    </div>

                    <div class="card mb-3">
                        <div class="card-header"><h6 class="mb-0"><i class="bi bi-briefcase me-2"></i>Informations commerciales</h6></div>
                        <div class="card-body">
                            <div class="row g-3">
                                <div class="col-md-4"><small class="text-secondary">Cond. paiement</small><div>${this.escapeHtml(c.conditionsPaiement || '—')}</div></div>
                                <div class="col-md-4"><small class="text-secondary">Mode paiement</small><div>${this.escapeHtml(c.modePaiement || '—')}</div></div>
                                <div class="col-md-4"><small class="text-secondary">Encours max</small><div class="fw-semibold">${this.formatCurrency(c.encoursMax || 0)}</div></div>
                                <div class="col-md-6"><small class="text-secondary">CA total</small><div class="fw-semibold text-success">${this.formatCurrency(c.caTotal || 0)}</div></div>
                                <div class="col-md-6"><small class="text-secondary">Encours actuel</small><div class="fw-semibold ${(c.encoursActuel || 0) > (c.encoursMax || 1) ? 'text-danger' : 'text-success'}">${this.formatCurrency(c.encoursActuel || 0)}</div></div>
                                <div class="col-md-6"><small class="text-secondary">Nb devis</small><div>${c.nbDevis || 0}</div></div>
                                <div class="col-md-6"><small class="text-secondary">Nb factures</small><div>${c.nbFactures || 0}</div></div>
                            </div>
                            ${c.rib ? `<hr><small class="text-secondary"><strong>IBAN:</strong> ${this.escapeHtml(c.rib)}</small>` : ''}
                        </div>
                    </div>

                    ${c.notes ? `
                    <div class="card">
                        <div class="card-header"><h6 class="mb-0"><i class="bi bi-sticky me-2"></i>Notes</h6></div>
                        <div class="card-body"><p class="mb-0">${this.escapeHtml(c.notes)}</p></div>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Réinitialiser le formulaire client
     */
    resetFormClient() {
        const form = document.getElementById('formClient');
        if (form) form.reset();
        document.getElementById('clientId').value = '';
        document.getElementById('cliType').value = 'particulier';
        document.getElementById('cliCivilite').value = 'M.';
        document.getElementById('cliCondPaiement').value = '30 jours';
        document.getElementById('cliModePaiement').value = 'virement';
        document.getElementById('cliEncoursMax').value = '0';
        document.getElementById('cliOrigine').value = '';

        // Adresses
        document.getElementById('clientAdressesContainer').innerHTML = '<p class="text-secondary text-center py-3">Aucune adresse</p>';
    }

    /**
     * Remplir le formulaire avec les données du client
     */
    fillFormClient(c) {
        document.getElementById('clientId').value = c.id;
        document.getElementById('cliType').value = c.type || 'particulier';
        document.getElementById('cliCivilite').value = c.civilite || 'M.';
        document.getElementById('cliNom').value = c.nom || '';
        document.getElementById('cliPrenom').value = c.prenom || '';
        document.getElementById('cliEntreprise').value = c.entreprise || '';
        document.getElementById('cliSiret').value = c.siret || '';
        document.getElementById('cliTVA').value = c.numeroTVA || '';
        document.getElementById('cliEmail').value = c.email || '';
        document.getElementById('cliTelephone').value = c.telephone || '';
        document.getElementById('cliPortable').value = c.portable || '';
        document.getElementById('cliSiteWeb').value = c.siteWeb || '';
        document.getElementById('cliNotes').value = c.notes || '';

        // Commercial
        document.getElementById('cliCondPaiement').value = c.conditionsPaiement || '30 jours';
        document.getElementById('cliModePaiement').value = c.modePaiement || 'virement';
        document.getElementById('cliEncoursMax').value = c.encoursMax || '0';
        document.getElementById('cliCommercial').value = c.commercialId || '';
        document.getElementById('cliOrigine').value = c.origine || '';
        document.getElementById('cliRib').value = c.rib || '';
    }

    /**
     * Rendre les adresses du client dans le formulaire
     */
    renderClientAdresses(adresses) {
        const container = document.getElementById('clientAdressesContainer');
        if (!container) return;

        if (!adresses || adresses.length === 0) {
            container.innerHTML = '<p class="text-secondary text-center py-3">Aucune adresse</p>';
            return;
        }

        container.innerHTML = adresses.map(a => `
            <div class="card mb-2">
                <div class="card-body py-2">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <span class="badge bg-${a.type === 'facturation' ? 'primary' : a.type === 'livraison' ? 'success' : a.type === 'chantier' ? 'warning' : 'info'}">${a.type}</span>
                            ${a.defaut ? '<span class="badge bg-secondary ms-1">Défaut</span>' : ''}
                            <div class="mt-1 small">${this.escapeHtml(a.ligne1)} ${a.ligne2 ? ', ' + this.escapeHtml(a.ligne2) : ''}</div>
                            <small class="text-secondary">${this.escapeHtml(a.codePostal)} ${this.escapeHtml(a.ville)} ${this.escapeHtml(a.pays)}</small>
                        </div>
                        <button type="button" class="btn btn-sm btn-outline-danger" onclick="window.clientsController.deleteAdresse(${a.id})">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    /**
     * Ouvrir la modale pour ajouter une adresse
     */
    openModalAdresse(adresse = null) {
        if (!this.clientEnEdition?.id) {
            showToast('Sélectionnez d\'abord un client', 'warning');
            return;
        }

        const form = document.getElementById('formAdresseClient');
        if (form) form.reset();

        document.getElementById('adrId').value = adresse?.id || '';
        document.getElementById('adrClientId').value = this.clientEnEdition.id;
        document.getElementById('adrPays').value = 'France';

        if (adresse) {
            document.getElementById('adrType').value = adresse.type || 'facturation';
            document.getElementById('adrDefaut').checked = adresse.defaut || false;
            document.getElementById('adrLigne1').value = adresse.ligne1 || '';
            document.getElementById('adrLigne2').value = adresse.ligne2 || '';
            document.getElementById('adrCodePostal').value = adresse.codePostal || '';
            document.getElementById('adrVille').value = adresse.ville || '';
            document.getElementById('adrPays').value = adresse.pays || 'France';
            document.getElementById('modalAdresseClientLabel').innerHTML = '<i class="bi bi-pencil me-2"></i>Modifier l\'adresse';
        } else {
            document.getElementById('adrType').value = 'facturation';
            document.getElementById('modalAdresseClientLabel').innerHTML = '<i class="bi bi-plus me-2"></i>Nouvelle adresse';
        }

        const modal = new bootstrap.Modal(document.getElementById('modalAdresseClient'));
        modal.show();
    }

    /**
     * Gérer la soumission du formulaire client
     */
    async handleSubmitClient(e) {
        e.preventDefault();

        const form = e.target;
        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            return;
        }

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        data.encoursMax = parseFloat(data.encoursMax) || 0;
        data.commercialId = parseInt(data.commercialId) || null;

        const entrepriseId = window.AppState?.entreprise?.id || 1;
        const isEdit = !!data.id;
        delete data.id;

        try {
            if (isEdit) {
                await window.api.clients.invoke('update', parseInt(formData.get('id')), data);
                showToast('Client modifié avec succès', 'success');
            } else {
                await window.api.clients.invoke('create', data, entrepriseId);
                showToast('Client créé avec succès', 'success');
            }

            bootstrap.Modal.getInstance(document.getElementById('modalClient'))?.hide();
            await this.loadClients();

        } catch (error) {
            console.error('Erreur sauvegarde client:', error);
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    /**
     * Gérer la soumission du formulaire adresse
     */
    async handleSubmitAdresse(e) {
        e.preventDefault();

        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        data.clientId = parseInt(data.clientId) || this.clientEnEdition?.id;
        data.defaut = data.defaut === 'on';

        if (!data.clientId) {
            showToast('Client non sélectionné', 'warning');
            return;
        }

        try {
            // TODO: Implémenter création/adresse via API
            showToast('Gestion des adresses à implémenter côté API', 'info');

            bootstrap.Modal.getInstance(document.getElementById('modalAdresseClient'))?.hide();

            // Recharger le client
            if (this.clientEnEdition) {
                const updated = await window.api.clients.invoke('get', this.clientEnEdition.id);
                this.clientEnEdition = updated;
                this.renderClientAdresses(updated.adresses || []);
            }
        } catch (error) {
            console.error('Erreur sauvegarde adresse:', error);
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    /**
     * Supprimer une adresse
     */
    async deleteAdresse(adresseId) {
        if (!confirm('Supprimer cette adresse ?')) return;

        try {
            // TODO: Implémenter suppression adresse
            showToast('Suppression d\'adresse à implémenter', 'info');
        } catch (error) {
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    /**
     * Confirmer la suppression
     */
    confirmDeleteClient(id) {
        const clientId = id || document.getElementById('btnDeleteClient')?.dataset.id;
        if (!clientId) return;

        this.clientEnEdition = { id: parseInt(clientId) };
        document.getElementById('deleteClientName').textContent = 'ce client';

        bootstrap.Modal.getInstance(document.getElementById('modalClient'))?.hide();

        setTimeout(() => {
            new bootstrap.Modal(document.getElementById('modalConfirmDeleteClient')).show();
        }, 300);
    }

    /**
     * Exécuter la suppression
     */
    async executeDeleteClient() {
        if (!this.clientEnEdition?.id) return;

        try {
            await window.api.clients.invoke('delete', this.clientEnEdition.id);
            showToast('Client supprimé', 'success');

            bootstrap.Modal.getInstance(document.getElementById('modalConfirmDeleteClient'))?.hide();
            await this.loadClients();

        } catch (error) {
            console.error('Erreur suppression:', error);
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    /**
     * Exporter les clients
     */
    async exportClients() {
        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;
            const result = await window.api.clients.invoke('list', {
                entrepriseId,
                limit: 10000
            });

            const headers = ['Type', 'Civilité', 'Nom', 'Prénom', 'Entreprise', 'SIRET', 'TVA', 'Email', 'Téléphone', 'Portable', 'Ville', 'Cond. paiement', 'CA total'];
            const rows = result.items.map(c => [
                c.type,
                c.civilite || '',
                c.nom,
                c.prenom || '',
                c.entreprise || '',
                c.siret || '',
                c.numeroTVA || '',
                c.email || '',
                c.telephone || '',
                c.portable || '',
                c.adresses?.[0]?.ville || '',
                c.conditionsPaiement || '',
                c.caTotal || 0
            ]);

            const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `clients_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();

            showToast('Export terminé', 'success');
        } catch (error) {
            console.error('Erreur export:', error);
            showToast('Erreur lors de l\'export', 'error');
        }
    }

    /**
     * Afficher/masquer le loader
     */
    showLoader(show) {
        const table = document.getElementById('clientsTable');
        if (table) {
            table.style.opacity = show ? '0.5' : '1';
            table.style.pointerEvents = show ? 'none' : 'auto';
        }
    }

    // Utilitaires
    formatDate(dateStr) {
        if (!dateStr) return '—';
        const date = new Date(dateStr);
        return date.toLocaleDateString('fr-FR');
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount || 0);
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Instance globale
window.clientsController = new ClientsController();