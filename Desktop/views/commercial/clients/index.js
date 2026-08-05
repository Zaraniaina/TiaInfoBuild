/**
 * Clients View Controller
 * Gère la liste, création, édition, adresses et suppression des clients.
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
        this._importCSVData = null;
    }

    notify(message, type = 'info') {
        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
        } else {
            console.log(`[Toast ${type}]`, message);
        }
    }

    async init() {
        await this.loadCommerciaux();
        this.bindEvents();
        await this.loadClients();
    }

    async loadCommerciaux() {
        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;
            const res = await window.api.employes.invoke('list', {
                entrepriseId,
                limit: 100,
                statut: 'actif'
            });
            const result = res?.data || res || {};
            const items = result.items || (Array.isArray(result) ? result : []);
            this.commerciauxCache = items.filter(e => e.poste?.toLowerCase().includes('commercial') || e.poste?.toLowerCase().includes('vente')) || items;
            this.populateCommercialSelect();
        } catch (error) {
            console.error('Erreur chargement commerciaux:', error);
        }
    }

    populateCommercialSelect() {
        const select = document.getElementById('cliCommercial');
        if (!select) return;
        const currentValue = select.value;
        select.innerHTML = '<option value="">Sélectionner</option>';
        this.commerciauxCache.forEach(c => {
            const option = document.createElement('option');
            option.value = c.id;
            option.textContent = `${c.prenom || ''} ${c.nom || ''}`.trim();
            select.appendChild(option);
        });
        select.value = currentValue;
    }

    bindEvents() {
        document.getElementById('cliType')?.addEventListener('change', (e) => this.toggleClientTypeFields(e.target.value));

        const searchInput = document.getElementById('searchClient');
        if (searchInput) {
            let debounceTimer;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.filters.search = e.target.value.trim();
                    this.currentPage = 1;
                    this.loadClients();
                }, 300);
            });
        }

        document.getElementById('filterTypeClient')?.addEventListener('change', (e) => {
            this.filters.type = e.target.value;
            this.currentPage = 1;
            this.loadClients();
        });

        document.getElementById('filterTriClient')?.addEventListener('change', (e) => {
            this.filters.tri = e.target.value;
            this.loadClients();
        });

        document.getElementById('btnNouveauClient')?.addEventListener('click', () => this.openModalNouveau());
        document.getElementById('btnFirstClient')?.addEventListener('click', () => this.openModalNouveau());
        document.getElementById('btnRefreshClients')?.addEventListener('click', () => this.loadClients());
        document.getElementById('btnExportClients')?.addEventListener('click', () => this.exportClients());
        document.getElementById('btnImportClients')?.addEventListener('click', () => this.openModalImport());

        document.getElementById('btnAjouterAdresse')?.addEventListener('click', () => this.openModalAdresse());
        document.getElementById('btnDupliquerAdresse')?.addEventListener('click', () => this.dupliquerAdresse());

        document.getElementById('formClient')?.addEventListener('submit', (e) => this.handleSubmitClient(e));
        document.getElementById('formAdresseClient')?.addEventListener('submit', (e) => this.handleSubmitAdresse(e));
        
        document.getElementById('btnDeleteClient')?.addEventListener('click', () => this.confirmDeleteClient());
        document.getElementById('btnConfirmDeleteClient')?.addEventListener('click', () => this.executeDeleteClient());

        document.getElementById('btnEditClientFromDetail')?.addEventListener('click', () => {
            const modalDetailEl = document.getElementById('modalClientDetail');
            const modalDetail = bootstrap.Modal.getInstance(modalDetailEl);
            modalDetail?.hide();
            if (this.clientEnEdition?.id) {
                setTimeout(() => this.openModalEdition(this.clientEnEdition.id), 300);
            }
        });
    }

    async loadClients() {
        this.showLoader(true);

        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;

            const res = await window.api.clients.invoke('list', {
                entrepriseId,
                limit: this.pageSize,
                offset: (this.currentPage - 1) * this.pageSize,
                search: this.filters.search || undefined,
                type: this.filters.type || undefined,
                tri: this.filters.tri || undefined
            });

            if (res && res.success === false) {
                throw new Error(res.error || 'Erreur lors du chargement des clients');
            }

            const result = res?.data || res || {};
            const items = result.items || (Array.isArray(result) ? result : []);
            this.totalItems = result.total !== undefined ? result.total : items.length;

            this.renderClientsTable(items);
            this.renderPagination();
            this.toggleEmptyState(items.length === 0);

        } catch (error) {
            console.error('Erreur chargement clients:', error);
            this.notify(`Erreur lors du chargement des clients: ${error.message}`, 'error');
        } finally {
            this.showLoader(false);
        }
    }

    renderClientsTable(clients) {
        const tbody = document.getElementById('clientsTbody');
        if (!tbody) return;

        if (!clients || clients.length === 0) {
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

            const nomComplet = this.getClientDisplayName(c);

            const ville = c.adresses?.find(a => a.defaut && a.type === 'facturation')?.ville
                || c.adresses?.[0]?.ville
                || c.ville
                || '—';

            return `
                <tr data-id="${c.id}">
                    <td>${(this.currentPage - 1) * this.pageSize + index + 1}</td>
                    <td>
                        <div class="fw-semibold">${this.escapeHtml(nomComplet)}</div>
                        <small class="text-secondary">${c.type === 'entreprise' || c.type === 'public' ? this.escapeHtml(c.siret || '') : ''}</small>
                    </td>
                    <td><span class="badge ${typeBadge}">${typeLabel}</span></td>
                    <td class="d-none d-md-table-cell">${this.escapeHtml(c.email || '—')}</td>
                    <td class="d-none d-md-table-cell">${this.escapeHtml(c.telephone || c.portable || '—')}</td>
                    <td class="d-none d-lg-table-cell">${this.escapeHtml(ville)}</td>
                    <td class="d-none d-xl-table-cell fw-bold text-end pe-3">${this.formatCurrency(c.caTotal || 0)}</td>
                    <td class="d-none d-xl-table-cell">
                        <small class="text-secondary">${c.dernierContact ? this.formatDate(c.dernierContact) : '—'}</small>
                    </td>
                    <td class="text-end">
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-secondary btn-view" data-id="${c.id}" title="Consulter">
                                <i class="bi bi-eye"></i>
                            </button>
                            <button class="btn btn-outline-primary btn-edit" data-id="${c.id}" title="Modifier">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-outline-success btn-devis" data-id="${c.id}" title="Créer un devis">
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

        tbody.querySelectorAll('.btn-view').forEach(btn => {
            btn.addEventListener('click', (e) => this.viewClient(e.currentTarget.dataset.id));
        });
        tbody.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => this.openModalEdition(e.currentTarget.dataset.id));
        });
        tbody.querySelectorAll('.btn-devis').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (window.router) {
                    window.router.navigate(`#devis/nouveau?clientId=${e.currentTarget.dataset.id}`);
                } else {
                    window.location.hash = `#devis/nouveau?clientId=${e.currentTarget.dataset.id}`;
                }
            });
        });
        tbody.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => this.confirmDeleteClient(e.currentTarget.dataset.id));
        });
    }

    renderPagination() {
        const container = document.getElementById('clientsPagination');
        if (!container) return;

        const totalPages = Math.ceil(this.totalItems / this.pageSize);
        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let html = '<nav><ul class="pagination pagination-sm mb-0 justify-content-end">';
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

    toggleEmptyState(isEmpty) {
        document.getElementById('clientsEmpty')?.classList.toggle('d-none', !isEmpty);
        document.getElementById('clientsTable')?.classList.toggle('d-none', isEmpty);
        document.getElementById('clientsPagination')?.classList.toggle('d-none', isEmpty);
    }

    openModalNouveau() {
        this.clientEnEdition = null;
        this.resetFormClient();
        this.toggleClientTypeFields('particulier');
        
        document.getElementById('modalClientLabel').textContent = 'Nouveau client';
        const deleteBtn = document.getElementById('btnDeleteClient');
        if (deleteBtn) deleteBtn.style.display = 'none';

        const firstTab = document.querySelector('#clientTabs button[data-bs-target="#tab-cli-infos"]');
        if (firstTab) {
            const tabInstance = bootstrap.Tab.getOrCreateInstance(firstTab);
            tabInstance.show();
        }

        const modal = new bootstrap.Modal(document.getElementById('modalClient'));
        modal.show();
    }

    async openModalEdition(id) {
        try {
            const res = await window.api.clients.invoke('get', parseInt(id));
            if (res && res.success === false) {
                throw new Error(res.error || 'Client introuvable');
            }

            const client = res?.data || res;
            if (!client || !client.id) {
                this.notify('Client introuvable', 'error');
                return;
            }

            this.clientEnEdition = client;
            this.fillFormClient(client);

            document.getElementById('modalClientLabel').textContent = `Modifier : ${this.getClientDisplayName(client)}`;
            const deleteBtn = document.getElementById('btnDeleteClient');
            if (deleteBtn) {
                deleteBtn.style.display = 'inline-block';
                deleteBtn.dataset.id = id;
            }

            this.renderClientAdresses(client.adresses || []);

            const firstTab = document.querySelector('#clientTabs button[data-bs-target="#tab-cli-infos"]');
            if (firstTab) {
                const tabInstance = bootstrap.Tab.getOrCreateInstance(firstTab);
                tabInstance.show();
            }

            const modal = new bootstrap.Modal(document.getElementById('modalClient'));
            modal.show();
        } catch (error) {
            console.error('Erreur chargement client:', error);
            this.notify(`Erreur lors du chargement: ${error.message}`, 'error');
        }
    }

    getClientDisplayName(c) {
        if (!c) return '';
        if (c.type === 'entreprise' || c.type === 'public') {
            return c.entreprise || c.nom || `${c.prenom || ''} ${c.nom || ''}`.trim();
        }
        return `${c.civilite || ''} ${c.prenom || ''} ${c.nom || ''}`.trim();
    }

    async viewClient(id) {
        try {
            const res = await window.api.clients.invoke('get', parseInt(id));
            if (res && res.success === false) {
                throw new Error(res.error || 'Client non trouvé');
            }

            const client = res?.data || res;
            if (!client || !client.id) {
                this.notify('Client non trouvé', 'error');
                return;
            }

            this.clientEnEdition = client;
            this.renderClientDetail(client);

            const modal = new bootstrap.Modal(document.getElementById('modalClientDetail'));
            modal.show();
        } catch (error) {
            console.error('Erreur affichage détail client:', error);
            this.notify(`Erreur: ${error.message}`, 'error');
        }
    }

    renderClientDetail(c) {
        const container = document.getElementById('clientDetailContent');
        if (!container) return;

        const typeLabel = {
            'particulier': 'Particulier',
            'entreprise': 'Entreprise',
            'public': 'Marché public'
        }[c.type] || c.type;

        const badgeClass = c.type === 'entreprise' ? 'primary' : c.type === 'public' ? 'success' : 'info';

        container.innerHTML = `
            <div class="row g-4">
                <div class="col-md-4">
                    <div class="card h-100">
                        <div class="card-body text-center">
                            <div class="mb-3">
                                <span class="badge bg-${badgeClass} fs-6 px-3 py-2">${typeLabel}</span>
                            </div>
                            <h4 class="card-title text-truncate">${this.escapeHtml(this.getClientDisplayName(c))}</h4>
                            ${c.siret ? `<p class="text-secondary small mb-1">SIRET/NIF: ${this.escapeHtml(c.siret)}</p>` : ''}
                            ${c.numeroTVA ? `<p class="text-secondary small mb-1">STAT/TVA: ${this.escapeHtml(c.numeroTVA)}</p>` : ''}
                            <hr>
                            <div class="text-start small space-y-2">
                                <div class="mb-1"><i class="bi bi-envelope me-2 text-secondary"></i><strong>Email:</strong> ${this.escapeHtml(c.email || '—')}</div>
                                <div class="mb-1"><i class="bi bi-telephone me-2 text-secondary"></i><strong>Tél:</strong> ${this.escapeHtml(c.telephone || '—')}</div>
                                <div class="mb-1"><i class="bi bi-phone me-2 text-secondary"></i><strong>Portable:</strong> ${this.escapeHtml(c.portable || '—')}</div>
                                <div class="mb-1"><i class="bi bi-globe me-2 text-secondary"></i><strong>Site Web:</strong> ${c.siteWeb ? `<a href="${this.escapeHtml(c.siteWeb)}" target="_blank" rel="noopener">${this.escapeHtml(c.siteWeb)}</a>` : '—'}</div>
                                <div class="mt-2"><i class="bi bi-box-arrow-in-right me-2 text-secondary"></i><strong>Origine:</strong> ${this.escapeHtml(c.origine || '—')}</div>
                                <div class="mt-1"><i class="bi bi-person-badge me-2 text-secondary"></i><strong>Commercial:</strong> ${c.commercial ? this.escapeHtml(`${c.commercial.prenom || ''} ${c.commercial.nom || ''}`.trim()) : '—'}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="col-md-8">
                    <div class="card mb-3">
                        <div class="card-header bg-light"><h6 class="mb-0"><i class="bi bi-geo-alt me-2"></i>Adresses associées</h6></div>
                        <div class="card-body p-0">
                            ${c.adresses && c.adresses.length > 0 ? `
                                <div class="list-group list-group-flush">
                                    ${c.adresses.map(a => `
                                        <div class="list-group-item">
                                            <div class="d-flex justify-content-between align-items-center mb-1">
                                                <span class="badge bg-${a.type === 'facturation' ? 'primary' : a.type === 'livraison' ? 'success' : 'warning'} text-capitalize">${a.type}</span>
                                                ${a.defaut ? '<span class="badge bg-secondary">Défaut</span>' : ''}
                                            </div>
                                            <div class="fw-semibold">${this.escapeHtml(a.ligne1 || '')}</div>
                                            ${a.ligne2 ? `<small class="text-muted d-block">${this.escapeHtml(a.ligne2)}</small>` : ''}
                                            <small class="text-secondary">${this.escapeHtml(a.codePostal || '')} ${this.escapeHtml(a.ville || '')} - ${this.escapeHtml(a.pays || 'Madagascar')}</small>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : `<div class="p-3 text-secondary text-center small">${c.adresse ? `${this.escapeHtml(c.adresse)} ${this.escapeHtml(c.codePostal || '')} ${this.escapeHtml(c.ville || '')}` : 'Aucune adresse enregistrée'}</div>`}
                        </div>
                    </div>

                    <div class="card mb-3">
                        <div class="card-header bg-light"><h6 class="mb-0"><i class="bi bi-briefcase me-2"></i>Informations commerciales & Financières</h6></div>
                        <div class="card-body">
                            <div class="row g-3">
                                <div class="col-md-4">
                                    <small class="text-secondary d-block">Conditions paiement</small>
                                    <span class="fw-semibold">${this.escapeHtml(c.conditionsPaiement || 'Comptant')}</span>
                                </div>
                                <div class="col-md-4">
                                    <small class="text-secondary d-block">Mode paiement</small>
                                    <span class="fw-semibold text-capitalize">${this.escapeHtml(c.modePaiement || 'Virement')}</span>
                                </div>
                                <div class="col-md-4">
                                    <small class="text-secondary d-block">Encours max autorisé</small>
                                    <span class="fw-semibold">${this.formatCurrency(c.encoursMax || 0)}</span>
                                </div>
                                <div class="col-md-6">
                                    <small class="text-secondary d-block">CA total cumulé</small>
                                    <span class="fw-bold fs-5 text-success">${this.formatCurrency(c.caTotal || 0)}</span>
                                </div>
                                <div class="col-md-6">
                                    <small class="text-secondary d-block">Encours actuel</small>
                                    <span class="fw-bold fs-5 ${(c.encoursActuel || 0) > (c.encoursMax || Infinity) ? 'text-danger' : 'text-primary'}">${this.formatCurrency(c.encoursActuel || 0)}</span>
                                </div>
                            </div>
                            ${c.rib ? `<hr class="my-2"><small class="text-secondary"><strong>Coordonnées bancaires:</strong> ${this.escapeHtml(c.rib)}</small>` : ''}
                        </div>
                    </div>

                    ${c.notes ? `
                    <div class="card">
                        <div class="card-header bg-light"><h6 class="mb-0"><i class="bi bi-sticky me-2"></i>Notes</h6></div>
                        <div class="card-body"><p class="mb-0 small">${this.escapeHtml(c.notes)}</p></div>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    resetFormClient() {
        const form = document.getElementById('formClient');
        if (form) {
            form.reset();
            form.classList.remove('was-validated');
        }
        document.getElementById('clientId').value = '';
        document.getElementById('cliType').value = 'particulier';
        document.getElementById('cliCivilite').value = 'M.';
        document.getElementById('cliCondPaiement').value = 'Comptant';
        document.getElementById('cliModePaiement').value = 'virement';
        document.getElementById('cliEncoursMax').value = '0';
        document.getElementById('cliOrigine').value = '';

        document.getElementById('cliAdresse').value = '';
        document.getElementById('cliAdresseComplement').value = '';
        document.getElementById('cliCodePostal').value = '';
        document.getElementById('cliVille').value = '';
        document.getElementById('cliPays').value = 'Madagascar';

        const container = document.getElementById('clientAdressesContainer');
        if (container) {
            container.innerHTML = '<p class="text-secondary text-center py-3">Enregistrez d\'abord le client pour gérer ses adresses multiples.</p>';
        }
    }

    fillFormClient(c) {
        const form = document.getElementById('formClient');
        if (form) form.classList.remove('was-validated');

        document.getElementById('clientId').value = c.id || '';
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

        const adresseFacturation = c.adresses?.find(a => a.type === 'facturation' && a.defaut) || c.adresses?.[0];
        if (adresseFacturation) {
            document.getElementById('cliAdresse').value = adresseFacturation.ligne1 || c.adresse || '';
            document.getElementById('cliAdresseComplement').value = adresseFacturation.ligne2 || c.adresseComplement || '';
            document.getElementById('cliCodePostal').value = adresseFacturation.codePostal || c.codePostal || '';
            document.getElementById('cliVille').value = adresseFacturation.ville || c.ville || '';
            document.getElementById('cliPays').value = adresseFacturation.pays || c.pays || 'Madagascar';
        } else {
            document.getElementById('cliAdresse').value = c.adresse || '';
            document.getElementById('cliAdresseComplement').value = c.adresseComplement || '';
            document.getElementById('cliCodePostal').value = c.codePostal || '';
            document.getElementById('cliVille').value = c.ville || '';
            document.getElementById('cliPays').value = c.pays || 'Madagascar';
        }

        document.getElementById('cliCondPaiement').value = c.conditionsPaiement || 'Comptant';
        document.getElementById('cliModePaiement').value = c.modePaiement || 'virement';
        document.getElementById('cliEncoursMax').value = c.encoursMax || '0';
        document.getElementById('cliCommercial').value = c.commercialId || '';
        document.getElementById('cliOrigine').value = c.origine || '';
        document.getElementById('cliRib').value = c.rib || '';

        this.toggleClientTypeFields(c.type || 'particulier');
    }

    renderClientAdresses(adresses) {
        const container = document.getElementById('clientAdressesContainer');
        if (!container) return;

        if (!adresses || adresses.length === 0) {
            container.innerHTML = '<p class="text-secondary text-center py-3">Aucune adresse secondaire configurée</p>';
            return;
        }

        container.innerHTML = adresses.map(a => `
            <div class="card mb-2 border-light shadow-sm">
                <div class="card-body py-2 px-3">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <span class="badge bg-${a.type === 'facturation' ? 'primary' : a.type === 'livraison' ? 'success' : a.type === 'chantier' ? 'warning' : 'info'} text-capitalize me-1">${a.type}</span>
                            ${a.defaut ? '<span class="badge bg-secondary ms-1">Par défaut</span>' : ''}
                            <div class="mt-1 fw-semibold small">${this.escapeHtml(a.ligne1)} ${a.ligne2 ? ', ' + this.escapeHtml(a.ligne2) : ''}</div>
                            <small class="text-secondary">${this.escapeHtml(a.codePostal || '')} ${this.escapeHtml(a.ville || '')} (${this.escapeHtml(a.pays || 'Madagascar')})</small>
                        </div>
                        <div class="btn-group btn-group-sm">
                            <button type="button" class="btn btn-outline-primary" onclick="window.clientsController.openModalAdresse(${JSON.stringify(a).replace(/"/g, '&quot;')})">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button type="button" class="btn btn-outline-danger" onclick="window.clientsController.deleteAdresse(${a.id})">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    dupliquerAdresse() {
        document.getElementById('adrId').value = '';
        document.getElementById('adrDefaut').checked = false;
        document.getElementById('modalAdresseClientLabel').innerHTML = '<i class="bi bi-copy me-2"></i>Dupliquer l\'adresse';
        this.notify('Adresse dupliquée : ajustez les champs puis enregistrez', 'info');
    }

    openModalAdresse(adresse = null) {
        if (!this.clientEnEdition?.id) {
            this.notify('Veuillez d\'abord enregistrer le client avant d\'ajouter des adresses', 'warning');
            return;
        }

        const form = document.getElementById('formAdresseClient');
        if (form) {
            form.reset();
            form.classList.remove('was-validated');
        }

        document.getElementById('adrId').value = adresse?.id || '';
        document.getElementById('adrClientId').value = this.clientEnEdition.id;
        document.getElementById('adrPays').value = adresse?.pays || 'Madagascar';

        const btnDupliquer = document.getElementById('btnDupliquerAdresse');
        if (btnDupliquer) {
            btnDupliquer.style.display = adresse ? 'inline-flex' : 'none';
        }

        if (adresse) {
            document.getElementById('adrType').value = adresse.type || 'facturation';
            document.getElementById('adrDefaut').checked = !!adresse.defaut;
            document.getElementById('adrLigne1').value = adresse.ligne1 || '';
            document.getElementById('adrLigne2').value = adresse.ligne2 || '';
            document.getElementById('adrCodePostal').value = adresse.codePostal || '';
            document.getElementById('adrVille').value = adresse.ville || '';
            document.getElementById('modalAdresseClientLabel').innerHTML = '<i class="bi bi-pencil me-2"></i>Modifier l\'adresse';
        } else {
            document.getElementById('adrType').value = 'facturation';
            document.getElementById('modalAdresseClientLabel').innerHTML = '<i class="bi bi-plus me-2"></i>Nouvelle adresse';
        }

        const modal = new bootstrap.Modal(document.getElementById('modalAdresseClient'));
        modal.show();
    }

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

        data.adresse = data.adresse || '';
        data.adresseComplement = data.adresseComplement || '';
        data.codePostal = data.codePostal || '';
        data.ville = data.ville || '';
        data.pays = data.pays || 'Madagascar';

        if (data.adresse || data.ville) {
            data.adresses = [{
                type: 'facturation',
                defaut: true,
                ligne1: data.adresse,
                ligne2: data.adresseComplement,
                codePostal: data.codePostal,
                ville: data.ville,
                pays: data.pays
            }];
        }

        const entrepriseId = window.AppState?.entreprise?.id || 1;
        const clientId = data.id ? parseInt(data.id) : null;
        delete data.id;

        try {
            let res;
            if (clientId) {
                res = await window.api.clients.invoke('update', clientId, data);
            } else {
                res = await window.api.clients.invoke('create', data, entrepriseId);
            }

            if (res && res.success === false) {
                throw new Error(res.error || 'Erreur lors de l\'enregistrement');
            }

            this.notify(`Client ${clientId ? 'modifié' : 'créé'} avec succès`, 'success');

            const modalEl = document.getElementById('modalClient');
            bootstrap.Modal.getInstance(modalEl)?.hide();

            await this.loadClients();

        } catch (error) {
            console.error('Erreur sauvegarde client:', error);
            this.notify(`Erreur: ${error.message}`, 'error');
        }
    }

    async handleSubmitAdresse(e) {
        e.preventDefault();

        const form = e.target;
        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            return;
        }

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        const clientId = parseInt(data.clientId) || this.clientEnEdition?.id;
        data.defaut = data.defaut === 'on' || data.defaut === true;

        if (!clientId) {
            this.notify('Client non identifié', 'warning');
            return;
        }

        const adresseId = data.id ? parseInt(data.id) : null;
        delete data.id;
        delete data.clientId;

        try {
            let res;
            if (adresseId) {
                res = await window.api.clientAdresses.invoke('update', adresseId, data);
            } else {
                res = await window.api.clientAdresses.invoke('create', clientId, data);
            }

            if (res && res.success === false) {
                throw new Error(res.error || 'Erreur lors de la sauvegarde de l\'adresse');
            }

            this.notify('Adresse enregistrée', 'success');
            bootstrap.Modal.getInstance(document.getElementById('modalAdresseClient'))?.hide();

            const resClient = await window.api.clients.invoke('get', clientId);
            const clientMaj = resClient?.data || resClient;
            if (clientMaj) {
                this.clientEnEdition = clientMaj;
                this.renderClientAdresses(clientMaj.adresses || []);
            }
        } catch (error) {
            console.error('Erreur sauvegarde adresse:', error);
            this.notify(`Erreur: ${error.message}`, 'error');
        }
    }

    async deleteAdresse(adresseId) {
        if (!confirm('Voulez-vous vraiment supprimer cette adresse ?')) return;

        try {
            const res = await window.api.clientAdresses.invoke('delete', adresseId);
            if (res && res.success === false) {
                throw new Error(res.error || 'Erreur de suppression');
            }

            this.notify('Adresse supprimée', 'success');

            if (this.clientEnEdition?.id) {
                const resClient = await window.api.clients.invoke('get', this.clientEnEdition.id);
                const clientMaj = resClient?.data || resClient;
                if (clientMaj) {
                    this.clientEnEdition = clientMaj;
                    this.renderClientAdresses(clientMaj.adresses || []);
                }
            }
        } catch (error) {
            console.error('Erreur suppression adresse:', error);
            this.notify(`Erreur: ${error.message}`, 'error');
        }
    }

    confirmDeleteClient(id) {
        const clientId = id || document.getElementById('btnDeleteClient')?.dataset.id || this.clientEnEdition?.id;
        if (!clientId) return;

        this.clientEnEdition = { id: parseInt(clientId) };
        
        const modalClientEl = document.getElementById('modalClient');
        const modalClientInstance = bootstrap.Modal.getInstance(modalClientEl);
        if (modalClientInstance) modalClientInstance.hide();

        setTimeout(() => {
            const modalConfirm = new bootstrap.Modal(document.getElementById('modalConfirmDeleteClient'));
            modalConfirm.show();
        }, 300);
    }

    async executeDeleteClient() {
        if (!this.clientEnEdition?.id) return;

        try {
            const res = await window.api.clients.invoke('delete', this.clientEnEdition.id);
            if (res && res.success === false) {
                throw new Error(res.error || 'Impossible de supprimer le client');
            }

            this.notify('Client supprimé avec succès', 'success');
            bootstrap.Modal.getInstance(document.getElementById('modalConfirmDeleteClient'))?.hide();
            await this.loadClients();

        } catch (error) {
            console.error('Erreur suppression client:', error);
            this.notify(`Erreur: ${error.message}`, 'error');
        }
    }

    async exportClients() {
        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;
            const res = await window.api.clients.invoke('list', { entrepriseId, limit: 10000 });
            const result = res?.data || res || {};
            const items = result.items || (Array.isArray(result) ? result : []);

            if (items.length === 0) {
                this.notify('Aucun client à exporter', 'warning');
                return;
            }

            const headers = ['Type', 'Civilité', 'Nom', 'Prénom', 'Entreprise', 'SIRET', 'TVA', 'Email', 'Téléphone', 'Portable', 'Ville', 'Cond. paiement', 'CA total'];
            const rows = items.map(c => [
                c.type || '',
                c.civilite || '',
                c.nom || '',
                c.prenom || '',
                c.entreprise || '',
                c.siret || '',
                c.numeroTVA || '',
                c.email || '',
                c.telephone || '',
                c.portable || '',
                c.adresses?.[0]?.ville || c.ville || '',
                c.conditionsPaiement || '',
                c.caTotal || 0
            ]);

            const csvContent = [headers, ...rows]
                .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
                .join('\n');

            const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `clients_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();

            this.notify('Exportation effectuée avec succès', 'success');
        } catch (error) {
            console.error('Erreur export clients:', error);
            this.notify('Erreur lors de l\'exportation', 'error');
        }
    }

    toggleClientTypeFields(type) {
        const prenomGroup = document.getElementById('cliPrenomGroup');
        const entrepriseGroup = document.getElementById('cliEntrepriseGroup');
        const siretGroup = document.getElementById('cliSiretGroup');
        const tvaGroup = document.getElementById('cliTVAGroup');
        const nomInput = document.getElementById('cliNom');
        const prenomInput = document.getElementById('cliPrenom');
        const entrepriseInput = document.getElementById('cliEntreprise');

        if (type === 'entreprise' || type === 'public') {
            prenomGroup?.classList.add('d-none');
            entrepriseGroup?.classList.remove('d-none');
            siretGroup?.classList.remove('d-none');
            tvaGroup?.classList.remove('d-none');
            if (nomInput) nomInput.setAttribute('placeholder', 'Nom du contact référent');
            if (prenomInput) prenomInput.removeAttribute('required');
            if (entrepriseInput) entrepriseInput.setAttribute('required', 'required');
        } else {
            prenomGroup?.classList.remove('d-none');
            entrepriseGroup?.classList.add('d-none');
            siretGroup?.classList.add('d-none');
            tvaGroup?.classList.add('d-none');
            if (nomInput) nomInput.setAttribute('placeholder', 'Nom');
            if (prenomInput) prenomInput.setAttribute('required', 'required');
            if (entrepriseInput) entrepriseInput.removeAttribute('required');
        }
    }

    openModalImport() {
        const modal = new bootstrap.Modal(document.getElementById('modalImportClients'));
        modal.show();

        document.getElementById('importClientsFile').value = '';
        document.getElementById('importPreview')?.classList.add('d-none');
        document.getElementById('importSkipHeader').checked = true;

        const fileInput = document.getElementById('importClientsFile');
        if (fileInput) {
            fileInput.onchange = (e) => this.handleImportFileSelect(e);
        }
    }

    handleImportFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const csvText = event.target.result;
                this.previewImportCSV(csvText);
            } catch (err) {
                this.notify('Erreur de lecture du fichier CSV', 'error');
            }
        };
        reader.readAsText(file);
    }

    previewImportCSV(csvText) {
        const lines = csvText.split(/\r\n|\n/).filter(l => l.trim());
        if (lines.length === 0) return;

        const skipHeader = document.getElementById('importSkipHeader').checked;
        const startIdx = skipHeader ? 1 : 0;
        const headers = this.parseCSVLine(lines[0]);
        const previewLines = lines.slice(startIdx, startIdx + 5);

        const headersRow = document.getElementById('importPreviewHeaders');
        if (headersRow) {
            headersRow.innerHTML = headers.map(h => `<th>${this.escapeHtml(h)}</th>`).join('');
        }

        const rowsContainer = document.getElementById('importPreviewRows');
        if (rowsContainer) {
            rowsContainer.innerHTML = previewLines.map(line => {
                const cols = this.parseCSVLine(line);
                return `<tr>${cols.map(c => `<td>${this.escapeHtml(c)}</td>`).join('')}</tr>`;
            }).join('');
        }

        document.getElementById('importPreview')?.classList.remove('d-none');
        this._importCSVData = { headers, lines: lines.slice(startIdx) };

        const btnConfirm = document.getElementById('btnConfirmImportClients');
        if (btnConfirm) {
            btnConfirm.onclick = () => this.executeImportClients();
        }
    }

    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current);
        return result;
    }

    async executeImportClients() {
        if (!this._importCSVData || !this._importCSVData.lines.length) {
            this.notify('Aucun enregistrement trouvé pour l\'import', 'warning');
            return;
        }

        const { headers, lines } = this._importCSVData;
        const entrepriseId = window.AppState?.entreprise?.id || 1;
        let successCount = 0;
        let errorCount = 0;

        const colMap = {};
        headers.forEach((h, i) => {
            const norm = h.toLowerCase().trim();
            if (norm.includes('type')) colMap.type = i;
            else if (norm.includes('civil')) colMap.civilite = i;
            else if (norm === 'nom') colMap.nom = i;
            else if (norm.includes('prenom') || norm.includes('prénom')) colMap.prenom = i;
            else if (norm.includes('entreprise')) colMap.entreprise = i;
            else if (norm.includes('siret')) colMap.siret = i;
            else if (norm.includes('tva')) colMap.numeroTVA = i;
            else if (norm.includes('email') || norm.includes('mail')) colMap.email = i;
            else if (norm.includes('tel') || norm.includes('téléphone')) colMap.telephone = i;
            else if (norm.includes('portable')) colMap.portable = i;
            else if (norm.includes('ville')) colMap.ville = i;
            else if (norm.includes('paiement')) colMap.conditionsPaiement = i;
        });

        for (let i = 0; i < lines.length; i++) {
            try {
                const cols = this.parseCSVLine(lines[i]);
                if (cols.length < 2) continue;

                const clientData = {
                    type: colMap.type !== undefined ? (cols[colMap.type] || 'particulier') : 'particulier',
                    civilite: colMap.civilite !== undefined ? (cols[colMap.civilite] || 'M.') : 'M.',
                    nom: colMap.nom !== undefined ? cols[colMap.nom] : (cols[0] || ''),
                    prenom: colMap.prenom !== undefined ? cols[colMap.prenom] : '',
                    entreprise: colMap.entreprise !== undefined ? cols[colMap.entreprise] : '',
                    siret: colMap.siret !== undefined ? cols[colMap.siret] : '',
                    numeroTVA: colMap.numeroTVA !== undefined ? cols[colMap.numeroTVA] : '',
                    email: colMap.email !== undefined ? cols[colMap.email] : '',
                    telephone: colMap.telephone !== undefined ? cols[colMap.telephone] : '',
                    portable: colMap.portable !== undefined ? cols[colMap.portable] : '',
                    ville: colMap.ville !== undefined ? cols[colMap.ville] : '',
                    conditionsPaiement: colMap.conditionsPaiement !== undefined ? (cols[colMap.conditionsPaiement] || 'Comptant') : 'Comptant',
                    modePaiement: 'virement',
                    encoursMax: 0
                };

                if (!clientData.nom && !clientData.entreprise) {
                    errorCount++;
                    continue;
                }

                const res = await window.api.clients.invoke('create', clientData, entrepriseId);
                if (res && res.success === false) errorCount++;
                else successCount++;

            } catch (err) {
                errorCount++;
            }
        }

        bootstrap.Modal.getInstance(document.getElementById('modalImportClients'))?.hide();
        await this.loadClients();

        this.notify(`Import terminé : ${successCount} réussi(s), ${errorCount} échec(s)`, errorCount > 0 ? 'warning' : 'success');
    }

    showLoader(show) {
        const table = document.getElementById('clientsTable');
        if (table) {
            table.style.opacity = show ? '0.4' : '1';
            table.style.pointerEvents = show ? 'none' : 'auto';
        }
    }

    formatDate(dateStr) {
        if (!dateStr) return '—';
        const date = new Date(dateStr);
        return isNaN(date.getTime()) ? '—' : date.toLocaleDateString('fr-FR');
    }

    formatCurrency(amount) {
        if (typeof window.formatCurrencyGlobal === 'function') {
            return window.formatCurrencyGlobal(amount);
        }
        return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'MGA',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount || 0).replace('MGA', 'Ar');
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialisation globale
window.clientsController = new ClientsController();