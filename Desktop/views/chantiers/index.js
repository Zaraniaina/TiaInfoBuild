/**
 * Chantiers View Controller
 * Gère :
 * - liste / création / édition / suppression des chantiers
 * - phases en mode brouillon puis sauvegarde en lot
 * - incidents
 * - affectations de ressources
 */
class ChantiersController {
  constructor() {
    this.currentPage = 1;
    this.pageSize = 20;
    this.totalItems = 0;

    this.filters = {
      search: '',
      statut: '',
      tri: 'dateCreation_desc'
    };

    this.chantierEnEdition = null;
    this.chantierIdASupprimer = null;

    this.clientsCache = [];
    this.utilisateursCache = [];
    this.employesCache = [];
    this.materielsCache = [];

    this.phasesDraft = [];
    this.currentIncidents = [];
    this.currentAffectations = [];
  }

  async init() {
    await Promise.all([
      this.loadClients(),
      this.loadUtilisateurs(),
      this.loadEmployes(),
      this.loadMateriels()
    ]);

    this.bindEvents();
    await this.loadChantiers();
  }

  /* ============================= */
  /* Helpers                       */
  /* ============================= */

  toast(message, type = 'info') {
    if (window.showToast) {
      window.showToast(message, type);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  extractItems(res) {
    if (!res) return [];

    if (res.success === false) {
      throw new Error(res.error || 'Erreur lors du chargement des données');
    }

    const payload = res.data ?? res;

    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(res.items)) return res.items;

    return [];
  }

  makeUid() {
    return `phase_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  normalizeStatut(statut) {
    if (!statut) return 'planification';
    if (statut === 'planifie') return 'planification';
    return statut;
  }

  getStatutInfo(statut) {
    const normalized = this.normalizeStatut(statut);

    const map = {
      planification: { label: 'Planifié', class: 'bg-secondary' },
      en_cours: { label: 'En cours', class: 'bg-primary' },
      termine: { label: 'Terminé', class: 'bg-success' },
      arrete: { label: 'Arrêté', class: 'bg-danger' }
    };

    return map[normalized] || { label: normalized, class: 'bg-secondary' };
  }

  clientLabel(c) {
    if (c.client) {
      return `${c.client.nom || ''} ${c.client.prenom || ''}`.trim() +
        (c.client.entreprise ? ` (${c.client.entreprise})` : '');
    }

    if (c.clientNom) {
      return `${c.clientNom || ''} ${c.clientPrenom || ''}`.trim() +
        (c.clientEntreprise ? ` (${c.clientEntreprise})` : '');
    }

    return null;
  }

  responsableLabel(c) {
    const responsable = c.responsable || c.chefChantier;

    if (responsable) {
      return `${responsable.prenom || ''} ${responsable.nom || ''}`.trim();
    }

    if (c.chefNom || c.chefPrenom) {
      return `${c.chefPrenom || ''} ${c.chefNom || ''}`.trim();
    }

    return null;
  }

  affectationLabel(a) {
    if (a.ressourceNom) return a.ressourceNom;

    if (a.typeRessource === 'Employe') {
      return `${a.employePrenom || a.prenom || ''} ${a.employeNom || a.nom || ''}`.trim();
    }

    if (a.typeRessource === 'Materiel') {
      return a.materielNom || a.nom || '';
    }

    return `#${a.ressourceId}`;
  }

  getCurrentUserId() {
    return window.AppState?.user?.id
      || window.AppState?.session?.user?.id
      || window.AppState?.currentUser?.id
      || null;
  }

  hideModal(modalId) {
    const el = document.getElementById(modalId);
    if (!el) return;

    const modal = bootstrap.Modal.getInstance(el) || bootstrap.Modal.getOrCreateInstance(el);
    modal.hide();
  }

  /* ============================= */
  /* Chargement des références     */
  /* ============================= */

  async loadClients() {
    try {
      const result = await window.api.clients.invoke('list', {
        entrepriseId: window.AppState?.entreprise?.id || 1,
        limit: 1000
      });

      this.clientsCache = this.extractItems(result);
      this.populateClientSelects();
    } catch (error) {
      console.error('Erreur chargement clients:', error);
      this.clientsCache = [];
    }
  }

  async loadUtilisateurs() {
    try {
      const result = await window.api.utilisateurs.invoke('list', {
        entrepriseId: window.AppState?.entreprise?.id || 1,
        limit: 1000
      });

      this.utilisateursCache = this.extractItems(result);
      this.populateChefChantierSelects();
    } catch (error) {
      console.error('Erreur chargement utilisateurs:', error);
      this.utilisateursCache = [];
    }
  }

  async loadEmployes() {
    try {
      const result = await window.api.employes.invoke('list', {
        entrepriseId: window.AppState?.entreprise?.id || 1,
        limit: 1000
      });

      this.employesCache = this.extractItems(result);
    } catch (error) {
      console.error('Erreur chargement employés:', error);
      this.employesCache = [];
    }
  }

  async loadMateriels() {
    try {
      const result = await window.api.materiels.invoke('list', {
        entrepriseId: window.AppState?.entreprise?.id || 1,
        limit: 1000
      });

      this.materielsCache = this.extractItems(result);
    } catch (error) {
      console.error('Erreur chargement matériels:', error);
      this.materielsCache = [];
    }
  }

  populateClientSelects() {
    const select = document.getElementById('chantierClient');
    if (!select) return;

    const currentValue = select.value;
    select.innerHTML = '<option value="">Sélectionner un client</option>';

    this.clientsCache.forEach(client => {
      const option = document.createElement('option');
      option.value = client.id;
      option.textContent = `${client.nom || ''} ${client.prenom || ''}`.trim() +
        (client.entreprise ? ` (${client.entreprise})` : '');
      select.appendChild(option);
    });

    select.value = currentValue;
  }

  populateChefChantierSelects() {
    const select = document.getElementById('chantierChefChantier');
    if (!select) return;

    const currentValue = select.value;
    select.innerHTML = '<option value="">Sélectionner</option>';

    this.utilisateursCache.forEach(user => {
      const option = document.createElement('option');
      option.value = user.id;
      option.textContent = `${user.prenom || ''} ${user.nom || ''}`.trim();
      select.appendChild(option);
    });

    select.value = currentValue;
  }

  populateRessourceSelect(typeRessource, selectedId = null) {
    const select = document.getElementById('affectationRessourceId');
    if (!select) return;

    select.innerHTML = '<option value="">Sélectionner</option>';

    const items = typeRessource === 'Materiel'
      ? this.materielsCache
      : this.employesCache;

    items.forEach(item => {
      const option = document.createElement('option');
      option.value = item.id;

      if (typeRessource === 'Materiel') {
        option.textContent = `${item.nom || ''}${item.type ? ` (${item.type})` : ''}`.trim();
      } else {
        option.textContent = `${item.prenom || ''} ${item.nom || ''}`.trim() +
          (item.poste ? ` — ${item.poste}` : '');
      }

      select.appendChild(option);
    });

    select.value = selectedId || '';
  }

  /* ============================= */
  /* Événements UI                 */
  /* ============================= */

  bindEvents() {
    const searchInput = document.getElementById('searchChantier');
    if (searchInput) {
      let debounceTimer;

      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);

        debounceTimer = setTimeout(() => {
          this.filters.search = e.target.value;
          this.currentPage = 1;
          this.loadChantiers();
        }, 300);
      });
    }

    const filterStatut = document.getElementById('filterStatut');
    if (filterStatut) {
      filterStatut.addEventListener('change', (e) => {
        this.filters.statut = e.target.value;
        this.currentPage = 1;
        this.loadChantiers();
      });
    }

    const filterTri = document.getElementById('filterTri');
    if (filterTri) {
      filterTri.addEventListener('change', (e) => {
        this.filters.tri = e.target.value;
        this.currentPage = 1;
        this.loadChantiers();
      });
    }

    document.getElementById('btnNouveauChantier')?.addEventListener('click', () => {
      this.openModalNouveau();
    });

    document.getElementById('btnFirstChantier')?.addEventListener('click', () => {
      this.openModalNouveau();
    });

    document.getElementById('btnRefreshChantiers')?.addEventListener('click', () => {
      this.loadChantiers();
    });

    const formChantier = document.getElementById('formChantier');
    if (formChantier) {
      formChantier.addEventListener('submit', (e) => this.handleSubmitChantier(e));
    }

    document.getElementById('btnDeleteChantier')?.addEventListener('click', () => {
      this.confirmDeleteChantier();
    });

    document.getElementById('btnConfirmDelete')?.addEventListener('click', () => {
      this.executeDeleteChantier();
    });

    document.getElementById('btnAjouterPhase')?.addEventListener('click', () => {
      this.openModalPhase();
    });

    const formPhase = document.getElementById('formPhase');
    if (formPhase) {
      formPhase.addEventListener('submit', (e) => this.handleSubmitPhase(e));
    }

    document.getElementById('btnDeletePhaseModal')?.addEventListener('click', async (e) => {
      const uid = e.currentTarget.dataset.uid;
      if (!uid) return;

      const deleted = await this.deletePhaseDraft(uid);
      if (deleted) {
        this.hideModal('modalPhase');
      }
    });

    document.getElementById('btnAjouterIncident')?.addEventListener('click', () => {
      this.openModalIncident();
    });

    const formIncident = document.getElementById('formIncident');
    if (formIncident) {
      formIncident.addEventListener('submit', (e) => this.handleSubmitIncident(e));
    }

    document.getElementById('btnDeleteIncidentModal')?.addEventListener('click', async (e) => {
      const id = parseInt(e.currentTarget.dataset.id, 10);
      if (!id) return;

      await this.deleteIncident(id);
      this.hideModal('modalIncident');
    });

    document.getElementById('btnAjouterAffectation')?.addEventListener('click', () => {
      this.openModalAffectation();
    });

    const formAffectation = document.getElementById('formAffectation');
    if (formAffectation) {
      formAffectation.addEventListener('submit', (e) => this.handleSubmitAffectation(e));
    }

    document.getElementById('btnDeleteAffectationModal')?.addEventListener('click', async (e) => {
      const id = parseInt(e.currentTarget.dataset.id, 10);
      if (!id) return;

      await this.deleteAffectation(id);
      this.hideModal('modalAffectation');
    });

    document.getElementById('affectationTypeRessource')?.addEventListener('change', (e) => {
      this.populateRessourceSelect(e.target.value);
    });

    document.getElementById('btnEditFromDetail')?.addEventListener('click', () => {
      this.hideModal('modalChantierDetail');

      setTimeout(() => {
        if (this.chantierEnEdition?.id) {
          this.openModalEdition(this.chantierEnEdition.id);
        }
      }, 300);
    });

    document.getElementById('btnExportChantiers')?.addEventListener('click', () => {
      this.exportChantiers();
    });
  }

  /* ============================= */
  /* Liste des chantiers           */
  /* ============================= */

  async loadChantiers() {
    this.showLoader(true);

    try {
      const entrepriseId = window.AppState?.entreprise?.id || 1;

      const result = await window.api.chantiers.invoke('list', {
        entrepriseId,
        limit: this.pageSize,
        offset: (this.currentPage - 1) * this.pageSize,
        statut: this.filters.statut || undefined,
        search: this.filters.search || undefined,
        tri: this.filters.tri
      });

      if (result?.success === false) {
        throw new Error(result.error || 'Erreur lors du chargement des chantiers');
      }

      const payload = result?.data ?? result;
      const items = payload?.items ?? result?.items ?? [];
      const total = payload?.total ?? result?.total ?? 0;

      this.totalItems = total;

      this.renderChantiersTable(items);
      this.renderPagination();
      this.toggleEmptyState(items.length === 0);
    } catch (error) {
      console.error('Erreur chargement chantiers:', error);
      this.toast(error.message || 'Erreur lors du chargement des chantiers', 'error');
    } finally {
      this.showLoader(false);
    }
  }

  renderChantiersTable(chantiers) {
    const tbody = document.getElementById('chantiersTbody');
    if (!tbody) return;

    if (!chantiers.length) {
      tbody.innerHTML = '';
      return;
    }

    tbody.innerHTML = chantiers.map((c, index) => {
      const budgetPrevu = c.budgetPrevu ?? c.budgetPrevisionnel ?? 0;
      const budgetReel = c.budgetReel ?? 0;
      const avancement = Math.round(c.avancementGlobal || 0);

      const statutInfo = this.getStatutInfo(c.statut);
      const clientLabel = this.clientLabel(c);

      return `
        <tr data-id="${c.id}">
          <td>${(this.currentPage - 1) * this.pageSize + index + 1}</td>

          <td>
            <div class="fw-semibold">${this.escapeHtml(c.nom)}</div>
            <small class="text-secondary">${this.escapeHtml(c.numero || '')}</small>
          </td>

          <td>
            ${clientLabel ? this.escapeHtml(clientLabel) : '<span class="text-secondary">—</span>'}
          </td>

          <td class="d-none d-md-table-cell">
            <small>
              ${this.formatDate(c.dateDebut)}
              ${c.dateFinPrevue ? ` → ${this.formatDate(c.dateFinPrevue)}` : ''}
            </small>
          </td>

          <td class="d-none d-lg-table-cell">
            <small>${this.formatCurrency(budgetPrevu)}</small>
            ${budgetReel ? `<br><small class="text-${budgetReel > budgetPrevu ? 'danger' : 'success'}">Réel : ${this.formatCurrency(budgetReel)}</small>` : ''}
          </td>

          <td class="d-none d-lg-table-cell">
            <div class="progress" style="height: 6px;">
              <div class="progress-bar bg-primary" style="width: ${avancement}%"></div>
            </div>
            <small>${avancement}%</small>
          </td>

          <td>
            <span class="badge ${statutInfo.class}">${statutInfo.label}</span>
          </td>

          <td>
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-secondary btn-view" data-id="${c.id}" title="Voir">
                <i class="bi bi-eye"></i>
              </button>
              <button class="btn btn-outline-primary btn-edit" data-id="${c.id}" title="Modifier" data-permission="chantiers:update">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-outline-danger btn-delete" data-id="${c.id}" title="Supprimer" data-permission="chantiers:delete">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-view').forEach(btn => {
      btn.addEventListener('click', (e) => this.viewChantier(e.currentTarget.dataset.id));
    });

    tbody.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', (e) => this.openModalEdition(e.currentTarget.dataset.id));
    });

    tbody.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', (e) => this.confirmDeleteChantier(e.currentTarget.dataset.id));
    });
  }

  renderPagination() {
    const container = document.getElementById('chantiersPagination');
    if (!container) return;

    const totalPages = Math.ceil(this.totalItems / this.pageSize);

    if (totalPages <= 1) {
      container.innerHTML = '';
      return;
    }

    let html = '<nav><ul class="pagination pagination-sm mb-0">';

    html += `
      <li class="page-item ${this.currentPage === 1 ? 'disabled' : ''}">
        <a class="page-link" href="#" data-page="${this.currentPage - 1}">
          <i class="bi bi-chevron-left"></i>
        </a>
      </li>
    `;

    const startPage = Math.max(1, this.currentPage - 2);
    const endPage = Math.min(totalPages, this.currentPage + 2);

    for (let i = startPage; i <= endPage; i++) {
      html += `
        <li class="page-item ${i === this.currentPage ? 'active' : ''}">
          <a class="page-link" href="#" data-page="${i}">${i}</a>
        </li>
      `;
    }

    html += `
      <li class="page-item ${this.currentPage === totalPages ? 'disabled' : ''}">
        <a class="page-link" href="#" data-page="${this.currentPage + 1}">
          <i class="bi bi-chevron-right"></i>
        </a>
      </li>
    `;

    html += '</ul></nav>';

    container.innerHTML = html;

    container.querySelectorAll('.page-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();

        const page = parseInt(e.currentTarget.dataset.page, 10);

        if (page && page !== this.currentPage && page >= 1 && page <= totalPages) {
          this.currentPage = page;
          this.loadChantiers();
        }
      });
    });
  }

  toggleEmptyState(isEmpty) {
    document.getElementById('chantiersEmpty')?.classList.toggle('d-none', !isEmpty);
    document.getElementById('chantiersTable')?.classList.toggle('d-none', isEmpty);
    document.getElementById('chantiersPagination')?.classList.toggle('d-none', isEmpty);
  }

  showLoader(show) {
    const table = document.getElementById('chantiersTable');
    if (!table) return;

    table.style.opacity = show ? '0.5' : '1';
    table.style.pointerEvents = show ? 'none' : 'auto';
  }

  /* ============================= */
  /* Modale chantier               */
  /* ============================= */

  openModalNouveau() {
    this.chantierEnEdition = null;
    this.chantierIdASupprimer = null;

    this.phasesDraft = [];
    this.currentIncidents = [];
    this.currentAffectations = [];

    this.resetFormChantier();
    this.renderPhasesDraft();
    this.renderIncidentsTab([]);
    this.renderAffectationsTab([]);

    document.getElementById('modalChantierLabel').innerHTML =
      '<i class="bi bi-building me-2"></i>Nouveau chantier';

    document.getElementById('btnDeleteChantier').style.display = 'none';
    delete document.getElementById('btnDeleteChantier').dataset.id;

    this.generateNumeroChantier();

    const modal = new bootstrap.Modal(document.getElementById('modalChantier'));
    modal.show();
  }

  async openModalEdition(id) {
    try {
      const result = await window.api.chantiers.invoke('get', parseInt(id, 10));

      if (result?.success === false) {
        throw new Error(result.error || 'Chantier non trouvé');
      }

      const chantier = result?.data ?? result;

      if (!chantier?.id) {
        throw new Error('Chantier non trouvé');
      }

      this.chantierEnEdition = chantier;

      this.phasesDraft = (chantier.phases || []).map((phase, index) => {
        return this.normalizePhaseDraft(phase, index);
      });

      this.fillFormChantier(chantier);
      this.renderPhasesDraft();
      this.renderIncidentsTab(chantier.incidents || []);
      this.renderAffectationsTab(chantier.affectations || []);

      document.getElementById('modalChantierLabel').innerHTML =
        `<i class="bi bi-building me-2"></i>Modifier : ${this.escapeHtml(chantier.nom)}`;

      const btnDelete = document.getElementById('btnDeleteChantier');
      btnDelete.style.display = 'inline-block';
      btnDelete.dataset.id = chantier.id;

      const modal = new bootstrap.Modal(document.getElementById('modalChantier'));
      modal.show();
    } catch (error) {
      console.error('Erreur chargement chantier:', error);
      this.toast(error.message || 'Erreur lors du chargement du chantier', 'error');
    }
  }

  resetFormChantier() {
    const form = document.getElementById('formChantier');
    if (form) form.reset();

    document.getElementById('chantierId').value = '';
    document.getElementById('chantierStatut').value = 'planification';
    document.getElementById('chantierTva').value = '20';
  }

  fillFormChantier(c) {
    document.getElementById('chantierId').value = c.id || '';
    document.getElementById('chantierNumero').value = c.numero || '';
    document.getElementById('chantierNom').value = c.nom || '';
    document.getElementById('chantierDescription').value = c.description || '';
    document.getElementById('chantierClient').value = c.clientId || '';
    document.getElementById('chantierDateDebut').value = c.dateDebut || '';
    document.getElementById('chantierDateFinPrevue').value = c.dateFinPrevue || '';
    document.getElementById('chantierDateFinReelle').value = c.dateFinReelle || '';
    document.getElementById('chantierAdresse').value = c.adresse || '';
    document.getElementById('chantierVille').value = c.ville || '';
    document.getElementById('chantierCodePostal').value = c.codePostal || '';
    document.getElementById('chantierChefChantier').value = c.chefChantierId || c.responsableId || '';
    document.getElementById('chantierStatut').value = this.normalizeStatut(c.statut) || 'planification';
    document.getElementById('chantierBudgetPrevu').value = c.budgetPrevu ?? c.budgetPrevisionnel ?? '';
    document.getElementById('chantierMargeCible').value = c.margeCible ?? '';
    document.getElementById('chantierTva').value = c.tva ?? '20';
  }

  async generateNumeroChantier() {
    try {
      const entrepriseId = window.AppState?.entreprise?.id || 1;
      const year = new Date().getFullYear();

      const result = await window.api.chantiers.invoke('list', {
        entrepriseId,
        limit: 1,
        search: `CHT-${year}`
      });

      const payload = result?.data ?? result;
      const total = payload?.total ?? result?.total ?? 0;
      const nextNum = total + 1;

      document.getElementById('chantierNumero').value =
        `CHT-${year}-${String(nextNum).padStart(4, '0')}`;
    } catch (error) {
      document.getElementById('chantierNumero').value =
        `CHT-${new Date().getFullYear()}-0001`;
    }
  }

  async handleSubmitChantier(e) {
    e.preventDefault();

    const form = e.target;

    if (!form.checkValidity()) {
      form.classList.add('was-validated');
      return;
    }

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    const chantierId = parseInt(data.id, 10) || null;
    delete data.id;

    data.chefChantierId = parseInt(data.chefChantierId, 10) || null;
    data.clientId = parseInt(data.clientId, 10) || null;
    data.budgetPrevu = parseFloat(data.budgetPrevu) || 0;
    data.margeCible = parseFloat(data.margeCible) || 0;
    data.tva = parseFloat(data.tva) || 20;
    data.statut = this.normalizeStatut(data.statut);

    const entrepriseId = window.AppState?.entreprise?.id || 1;
    const phases = this.preparePhasesForSave();

    try {
      if (chantierId) {
        const updateResult = await window.api.chantiers.invoke('update', chantierId, data);
        if (updateResult?.success === false) {
          throw new Error(updateResult.error || 'Erreur lors de la modification du chantier');
        }

        const savePhasesResult = await window.api.chantiers.invoke('savePhases', chantierId, phases);
        if (savePhasesResult?.success === false) {
          throw new Error(savePhasesResult.error || 'Erreur lors de la sauvegarde des phases');
        }

        this.toast('Chantier modifié avec succès', 'success');
      } else {
        data.phases = phases;

        const createResult = await window.api.chantiers.invoke('create', data, entrepriseId);
        if (createResult?.success === false) {
          throw new Error(createResult.error || 'Erreur lors de la création du chantier');
        }

        this.toast('Chantier créé avec succès', 'success');
      }

      this.hideModal('modalChantier');
      await this.loadChantiers();
    } catch (error) {
      console.error('Erreur sauvegarde chantier:', error);
      this.toast(error.message || 'Erreur lors de la sauvegarde du chantier', 'error');
    }
  }

  /* ============================= */
  /* Phases dans le formulaire     */
  /* ============================= */

  normalizePhaseDraft(phase, index = 0) {
    return {
      uid: phase.uid || this.makeUid(),
      id: phase.id && phase.id > 0 ? phase.id : null,
      nom: phase.nom || '',
      description: phase.description || '',
      dateDebut: phase.dateDebut || '',
      dateFin: phase.dateFin || '',
      budget: parseFloat(phase.budget) || 0,
      avancementPct: parseInt(phase.avancementPct ?? phase.avancement, 10) || 0,
      ordre: parseInt(phase.ordre, 10) || (index + 1),
      statut: phase.statut || 'non_commencee'
    };
  }

  preparePhasesForSave() {
    return [...this.phasesDraft]
      .sort((a, b) => a.ordre - b.ordre)
      .map((phase, index) => ({
        id: phase.id && phase.id > 0 ? phase.id : null,
        nom: phase.nom,
        description: phase.description,
        dateDebut: phase.dateDebut,
        dateFin: phase.dateFin,
        budget: phase.budget,
        avancementPct: phase.avancementPct,
        ordre: phase.ordre || (index + 1),
        statut: phase.statut || 'non_commencee'
      }));
  }

  renderPhasesDraft() {
    const container = document.getElementById('phasesContainer');
    if (!container) return;

    if (!this.phasesDraft.length) {
      container.innerHTML = `
        <p class="text-secondary text-center py-3 mb-0">
          Aucune phase. Cliquez sur "Ajouter une phase".
        </p>
      `;
      return;
    }

    const sortedPhases = [...this.phasesDraft].sort((a, b) => a.ordre - b.ordre);

    container.innerHTML = sortedPhases.map((p, index) => `
      <div class="card mb-2 phase-item" data-uid="${p.uid}">
        <div class="card-body py-2">
          <div class="row g-2 align-items-center">
            <div class="col-auto">
              <span class="badge bg-secondary">${index + 1}</span>
            </div>

            <div class="col">
              <strong>${this.escapeHtml(p.nom)}</strong>
              ${p.description ? `<br><small class="text-secondary">${this.escapeHtml(p.description)}</small>` : ''}
            </div>

            <div class="col-auto">
              <small class="text-secondary">
                ${p.dateDebut ? this.formatDate(p.dateDebut) : ''}
                ${p.dateFin ? ` → ${this.formatDate(p.dateFin)}` : ''}
              </small>
            </div>

            <div class="col-auto">
              <small class="text-secondary">${this.formatCurrency(p.budget || 0)}</small>
            </div>

            <div class="col-auto">
              <span class="badge bg-primary">${p.avancementPct || 0}%</span>
            </div>

            <div class="col-auto">
              <button type="button" class="btn btn-sm btn-outline-primary btn-edit-phase" data-uid="${p.uid}" data-permission="chantiers:update">
                <i class="bi bi-pencil"></i>
              </button>
              <button type="button" class="btn btn-sm btn-outline-danger btn-delete-phase" data-uid="${p.uid}" data-permission="chantiers:delete">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.btn-edit-phase').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const uid = e.currentTarget.dataset.uid;
        const phase = this.phasesDraft.find(p => p.uid === uid);
        if (phase) this.openModalPhase(phase);
      });
    });

    container.querySelectorAll('.btn-delete-phase').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const uid = e.currentTarget.dataset.uid;
        this.deletePhaseDraft(uid);
      });
    });
  }

  openModalPhase(phase = null) {
    const form = document.getElementById('formPhase');
    if (form) form.reset();

    document.getElementById('phaseId').value = phase?.id && phase.id > 0 ? phase.id : '';
    document.getElementById('phaseLocalId').value = phase?.uid || '';
    document.getElementById('phaseChantierId').value = this.chantierEnEdition?.id || '';

    if (phase) {
      document.getElementById('phaseNom').value = phase.nom || '';
      document.getElementById('phaseDescription').value = phase.description || '';
      document.getElementById('phaseDateDebut').value = phase.dateDebut || '';
      document.getElementById('phaseDateFin').value = phase.dateFin || '';
      document.getElementById('phaseBudget').value = phase.budget || '';
      document.getElementById('phaseAvancement').value = phase.avancementPct ?? phase.avancement ?? 0;
      document.getElementById('phaseOrdre').value = phase.ordre || 1;

      document.getElementById('modalPhaseLabel').innerHTML =
        '<i class="bi bi-list-task me-2"></i>Modifier la phase';

      const btnDelete = document.getElementById('btnDeletePhaseModal');
      btnDelete.style.display = 'inline-block';
      btnDelete.dataset.uid = phase.uid;
    } else {
      document.getElementById('phaseOrdre').value = this.phasesDraft.length + 1;

      document.getElementById('modalPhaseLabel').innerHTML =
        '<i class="bi bi-plus me-2"></i>Nouvelle phase';

      const btnDelete = document.getElementById('btnDeletePhaseModal');
      btnDelete.style.display = 'none';
      delete btnDelete.dataset.uid;
    }

    const modal = new bootstrap.Modal(document.getElementById('modalPhase'));
    modal.show();
  }

  async handleSubmitPhase(e) {
    e.preventDefault();

    const form = e.target;

    if (!form.checkValidity()) {
      form.classList.add('was-validated');
      return;
    }

    const phaseId = parseInt(document.getElementById('phaseId').value, 10) || null;
    const localId = document.getElementById('phaseLocalId').value;

    const phaseData = {
      id: phaseId,
      nom: document.getElementById('phaseNom').value.trim(),
      description: document.getElementById('phaseDescription').value.trim(),
      dateDebut: document.getElementById('phaseDateDebut').value,
      dateFin: document.getElementById('phaseDateFin').value,
      budget: parseFloat(document.getElementById('phaseBudget').value) || 0,
      avancementPct: parseInt(document.getElementById('phaseAvancement').value, 10) || 0,
      ordre: parseInt(document.getElementById('phaseOrdre').value, 10) || 1,
      statut: 'non_commencee'
    };

    if (!phaseData.nom) {
      this.toast('Le nom de la phase est obligatoire', 'error');
      return;
    }

    const existing = this.phasesDraft.find(p => {
      return (localId && p.uid === localId) || (phaseId && p.id === phaseId);
    });

    if (existing) {
      Object.assign(existing, phaseData, { uid: existing.uid });
      this.toast('Phase mise à jour dans le brouillon', 'success');
    } else {
      this.phasesDraft.push(this.normalizePhaseDraft(phaseData, this.phasesDraft.length));
      this.toast('Phase ajoutée au brouillon', 'success');
    }

    this.renderPhasesDraft();
    this.hideModal('modalPhase');
  }

  async deletePhaseDraft(uid) {
    const phase = this.phasesDraft.find(p => p.uid === uid);
    if (!phase) return false;

    const confirmed = confirm(`Supprimer la phase "${phase.nom}" ?`);
    if (!confirmed) return false;

    this.phasesDraft = this.phasesDraft.filter(p => p.uid !== uid);
    this.renderPhasesDraft();

    this.toast('Phase supprimée du brouillon', 'success');
    return true;
  }

  /* ============================= */
  /* Incidents                     */
  /* ============================= */

  renderIncidentsTab(incidents = []) {
    const container = document.getElementById('incidentsContainer');
    const btnAjouter = document.getElementById('btnAjouterIncident');

    if (!container) return;

    const canManage = !!this.chantierEnEdition?.id;

    if (btnAjouter) {
      btnAjouter.disabled = !canManage;
    }

    if (!canManage) {
      container.innerHTML = `
        <p class="text-secondary text-center py-3 mb-0">
          Enregistrez d’abord le chantier pour pouvoir ajouter des incidents.
        </p>
      `;
      return;
    }

    this.currentIncidents = incidents;

    if (!incidents.length) {
      container.innerHTML = `
        <p class="text-secondary text-center py-3 mb-0">
          Aucun incident pour ce chantier.
        </p>
      `;
      return;
    }

    container.innerHTML = incidents.map(incident => {
      const gravite = incident.gravite || 'moyenne';

      const graviteClass = {
        critique: 'danger',
        elevee: 'warning',
        moyenne: 'info',
        faible: 'secondary'
      }[gravite] || 'secondary';

      const statutClass = {
        signale: 'danger',
        en_cours: 'warning',
        resolu: 'success',
        clos: 'secondary'
      }[incident.statut] || 'secondary';

      const statutLabel = {
        signale: 'Signalé',
        en_cours: 'En cours',
        resolu: 'Résolu',
        clos: 'Clos'
      }[incident.statut] || incident.statut;

      return `
        <div class="card mb-2">
          <div class="card-body py-2">
            <div class="row g-2 align-items-center">
              <div class="col">
                <strong>${this.escapeHtml(incident.titre)}</strong>
                ${incident.description ? `<br><small class="text-secondary">${this.escapeHtml(incident.description)}</small>` : ''}
                <br>
                <small class="text-secondary">
                  ${this.formatDate(incident.dateIncident)}
                  ${incident.declareParNom || incident.declareParPrenom
                    ? ` — ${this.escapeHtml(`${incident.declareParPrenom || ''} ${incident.declareParNom || ''}`.trim())}`
                    : ''}
                </small>
              </div>

              <div class="col-auto">
                <span class="badge bg-${graviteClass}">${gravite}</span>
                <span class="badge bg-${statutClass}">${statutLabel}</span>
              </div>

              <div class="col-auto">
                <button type="button" class="btn btn-sm btn-outline-primary btn-edit-incident" data-id="${incident.id}" data-permission="chantiers:update">
                  <i class="bi bi-pencil"></i>
                </button>
                <button type="button" class="btn btn-sm btn-outline-danger btn-delete-incident" data-id="${incident.id}" data-permission="chantiers:delete">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.btn-edit-incident').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = parseInt(e.currentTarget.dataset.id, 10);
        const incident = this.currentIncidents.find(i => i.id === id);
        if (incident) this.openModalIncident(incident);
      });
    });

    container.querySelectorAll('.btn-delete-incident').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = parseInt(e.currentTarget.dataset.id, 10);
        this.deleteIncident(id);
      });
    });
  }

  openModalIncident(incident = null) {
    if (!this.chantierEnEdition?.id) {
      this.toast('Enregistrez d’abord le chantier avant d’ajouter un incident', 'warning');
      return;
    }

    const form = document.getElementById('formIncident');
    if (form) form.reset();

    document.getElementById('incidentId').value = incident?.id || '';
    document.getElementById('incidentChantierId').value = this.chantierEnEdition.id;

    if (incident) {
      document.getElementById('incidentTitre').value = incident.titre || '';
      document.getElementById('incidentDescription').value = incident.description || '';
      document.getElementById('incidentDate').value = incident.dateIncident || '';
      document.getElementById('incidentGravite').value = incident.gravite || 'moyenne';
      document.getElementById('incidentStatut').value = incident.statut || 'signale';

      document.getElementById('modalIncidentLabel').innerHTML =
        '<i class="bi bi-exclamation-triangle me-2"></i>Modifier l’incident';

      const btnDelete = document.getElementById('btnDeleteIncidentModal');
      btnDelete.style.display = 'inline-block';
      btnDelete.dataset.id = incident.id;
    } else {
      document.getElementById('incidentDate').value = new Date().toISOString().split('T')[0];
      document.getElementById('incidentGravite').value = 'moyenne';
      document.getElementById('incidentStatut').value = 'signale';

      document.getElementById('modalIncidentLabel').innerHTML =
        '<i class="bi bi-plus me-2"></i>Nouvel incident';

      const btnDelete = document.getElementById('btnDeleteIncidentModal');
      btnDelete.style.display = 'none';
      delete btnDelete.dataset.id;
    }

    const modal = new bootstrap.Modal(document.getElementById('modalIncident'));
    modal.show();
  }

  async handleSubmitIncident(e) {
    e.preventDefault();

    const form = e.target;

    if (!form.checkValidity()) {
      form.classList.add('was-validated');
      return;
    }

    if (!this.chantierEnEdition?.id) {
      this.toast('Enregistrez d’abord le chantier avant d’ajouter un incident', 'warning');
      return;
    }

    const incidentId = parseInt(document.getElementById('incidentId').value, 10) || null;

    const data = {
      chantierId: this.chantierEnEdition.id,
      titre: document.getElementById('incidentTitre').value.trim(),
      description: document.getElementById('incidentDescription').value.trim(),
      dateIncident: document.getElementById('incidentDate').value,
      gravite: document.getElementById('incidentGravite').value,
      statut: document.getElementById('incidentStatut').value
    };

    if (!data.titre) {
      this.toast('Le titre de l’incident est obligatoire', 'error');
      return;
    }

    try {
      let result;

      if (incidentId) {
        result = await window.api.chantiers.invoke('updateIncident', incidentId, data);
      } else {
        result = await window.api.chantiers.invoke(
          'addIncident',
          data.chantierId,
          data,
          this.getCurrentUserId()
        );
      }

      if (result?.success === false) {
        throw new Error(result.error || 'Erreur lors de la sauvegarde de l’incident');
      }

      this.toast('Incident enregistré avec succès', 'success');
      this.hideModal('modalIncident');

      await this.refreshChantierRelations();
    } catch (error) {
      console.error('Erreur sauvegarde incident:', error);
      this.toast(error.message || 'Erreur lors de la sauvegarde de l’incident', 'error');
    }
  }

  async deleteIncident(id) {
    if (!confirm('Supprimer cet incident ?')) return;

    try {
      const result = await window.api.chantiers.invoke('deleteIncident', id);

      if (result?.success === false) {
        throw new Error(result.error || 'Erreur lors de la suppression de l’incident');
      }

      this.toast('Incident supprimé', 'success');
      await this.refreshChantierRelations();
    } catch (error) {
      console.error('Erreur suppression incident:', error);
      this.toast(error.message || 'Erreur lors de la suppression de l’incident', 'error');
    }
  }

  /* ============================= */
  /* Affectations ressources       */
  /* ============================= */

  renderAffectationsTab(affectations = []) {
    const container = document.getElementById('affectationsContainer');
    const btnAjouter = document.getElementById('btnAjouterAffectation');

    if (!container) return;

    const canManage = !!this.chantierEnEdition?.id;

    if (btnAjouter) {
      btnAjouter.disabled = !canManage;
    }

    if (!canManage) {
      container.innerHTML = `
        <p class="text-secondary text-center py-3 mb-0">
          Enregistrez d’abord le chantier pour pouvoir affecter des ressources.
        </p>
      `;
      return;
    }

    this.currentAffectations = affectations;

    if (!affectations.length) {
      container.innerHTML = `
        <p class="text-secondary text-center py-3 mb-0">
          Aucune ressource affectée pour ce chantier.
        </p>
      `;
      return;
    }

    container.innerHTML = affectations.map(affectation => {
      const typeBadge = affectation.typeRessource === 'Employe'
        ? 'bg-primary'
        : 'bg-warning text-dark';

      const typeLabel = affectation.typeRessource === 'Employe'
        ? 'Employé'
        : 'Matériel';

      const ressourceLabel = this.affectationLabel(affectation);

      return `
        <div class="card mb-2">
          <div class="card-body py-2">
            <div class="row g-2 align-items-center">
              <div class="col-auto">
                <span class="badge ${typeBadge}">${typeLabel}</span>
              </div>

              <div class="col">
                <strong>${this.escapeHtml(ressourceLabel)}</strong>
                ${affectation.role ? `<br><small class="text-secondary">${this.escapeHtml(affectation.role)}</small>` : ''}
              </div>

              <div class="col-auto">
                <small class="text-secondary">
                  ${affectation.dateDebut ? this.formatDate(affectation.dateDebut) : '—'}
                  ${affectation.dateFin ? ` → ${this.formatDate(affectation.dateFin)}` : ''}
                </small>
              </div>

              <div class="col-auto">
                <button type="button" class="btn btn-sm btn-outline-primary btn-edit-affectation" data-id="${affectation.id}" data-permission="chantiers:update">
                  <i class="bi bi-pencil"></i>
                </button>
                <button type="button" class="btn btn-sm btn-outline-danger btn-delete-affectation" data-id="${affectation.id}" data-permission="chantiers:delete">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.btn-edit-affectation').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = parseInt(e.currentTarget.dataset.id, 10);
        const affectation = this.currentAffectations.find(a => a.id === id);
        if (affectation) this.openModalAffectation(affectation);
      });
    });

    container.querySelectorAll('.btn-delete-affectation').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = parseInt(e.currentTarget.dataset.id, 10);
        this.deleteAffectation(id);
      });
    });
  }

  openModalAffectation(affectation = null) {
    if (!this.chantierEnEdition?.id) {
      this.toast('Enregistrez d’abord le chantier avant d’affecter une ressource', 'warning');
      return;
    }

    const form = document.getElementById('formAffectation');
    if (form) form.reset();

    document.getElementById('affectationId').value = affectation?.id || '';
    document.getElementById('affectationChantierId').value = this.chantierEnEdition.id;

    const typeRessource = affectation?.typeRessource || 'Employe';
    document.getElementById('affectationTypeRessource').value = typeRessource;

    this.populateRessourceSelect(typeRessource, affectation?.ressourceId || null);

    if (affectation) {
      document.getElementById('affectationDateDebut').value = affectation.dateDebut || '';
      document.getElementById('affectationDateFin').value = affectation.dateFin || '';
      document.getElementById('affectationRole').value = affectation.role || '';

      document.getElementById('modalAffectationLabel').innerHTML =
        '<i class="bi bi-people me-2"></i>Modifier l’affectation';

      const btnDelete = document.getElementById('btnDeleteAffectationModal');
      btnDelete.style.display = 'inline-block';
      btnDelete.dataset.id = affectation.id;
    } else {
      document.getElementById('modalAffectationLabel').innerHTML =
        '<i class="bi bi-plus me-2"></i>Affecter une ressource';

      const btnDelete = document.getElementById('btnDeleteAffectationModal');
      btnDelete.style.display = 'none';
      delete btnDelete.dataset.id;
    }

    const modal = new bootstrap.Modal(document.getElementById('modalAffectation'));
    modal.show();
  }

  async handleSubmitAffectation(e) {
    e.preventDefault();

    const form = e.target;

    if (!form.checkValidity()) {
      form.classList.add('was-validated');
      return;
    }

    if (!this.chantierEnEdition?.id) {
      this.toast('Enregistrez d’abord le chantier avant d’affecter une ressource', 'warning');
      return;
    }

    const affectationId = parseInt(document.getElementById('affectationId').value, 10) || null;

    const data = {
      chantierId: this.chantierEnEdition.id,
      typeRessource: document.getElementById('affectationTypeRessource').value,
      ressourceId: parseInt(document.getElementById('affectationRessourceId').value, 10) || null,
      dateDebut: document.getElementById('affectationDateDebut').value,
      dateFin: document.getElementById('affectationDateFin').value,
      role: document.getElementById('affectationRole').value.trim()
    };

    if (!data.ressourceId) {
      this.toast('Veuillez sélectionner une ressource', 'error');
      return;
    }

    if (data.dateFin && data.dateDebut && data.dateFin < data.dateDebut) {
      this.toast('La date de fin doit être postérieure à la date de début', 'error');
      return;
    }

    try {
      let result;

      if (affectationId) {
        result = await window.api.chantiers.invoke('updateAffectation', affectationId, data);
      } else {
        result = await window.api.chantiers.invoke('addAffectation', data);
      }

      if (result?.success === false) {
        throw new Error(result.error || 'Erreur lors de la sauvegarde de l’affectation');
      }

      this.toast('Affectation enregistrée avec succès', 'success');
      this.hideModal('modalAffectation');

      await this.refreshChantierRelations();
    } catch (error) {
      console.error('Erreur sauvegarde affectation:', error);
      this.toast(error.message || 'Erreur lors de la sauvegarde de l’affectation', 'error');
    }
  }

  async deleteAffectation(id) {
    if (!confirm('Supprimer cette affectation ?')) return;

    try {
      const result = await window.api.chantiers.invoke('deleteAffectation', id);

      if (result?.success === false) {
        throw new Error(result.error || 'Erreur lors de la suppression de l’affectation');
      }

      this.toast('Affectation supprimée', 'success');
      await this.refreshChantierRelations();
    } catch (error) {
      console.error('Erreur suppression affectation:', error);
      this.toast(error.message || 'Erreur lors de la suppression de l’affectation', 'error');
    }
  }

  async refreshChantierRelations() {
    if (!this.chantierEnEdition?.id) return;

    try {
      const result = await window.api.chantiers.invoke('get', this.chantierEnEdition.id);

      if (result?.success === false) {
        throw new Error(result.error || 'Erreur lors du rafraîchissement du chantier');
      }

      const chantier = result?.data ?? result;

      this.chantierEnEdition = {
        ...this.chantierEnEdition,
        incidents: chantier.incidents || [],
        affectations: chantier.affectations || []
      };

      this.renderIncidentsTab(this.chantierEnEdition.incidents);
      this.renderAffectationsTab(this.chantierEnEdition.affectations);
    } catch (error) {
      console.error('Erreur rafraîchissement relations chantier:', error);
      this.toast(error.message || 'Erreur lors du rafraîchissement du chantier', 'error');
    }
  }

  /* ============================= */
  /* Détail chantier               */
  /* ============================= */

  async viewChantier(id) {
    try {
      const result = await window.api.chantiers.invoke('get', parseInt(id, 10));

      if (result?.success === false) {
        throw new Error(result.error || 'Chantier non trouvé');
      }

      const chantier = result?.data ?? result;

      if (!chantier?.id) {
        throw new Error('Chantier non trouvé');
      }

      this.chantierEnEdition = chantier;
      this.renderChantierDetail(chantier);

      const modal = new bootstrap.Modal(document.getElementById('modalChantierDetail'));
      modal.show();
    } catch (error) {
      console.error('Erreur chargement détail:', error);
      this.toast(error.message || 'Erreur lors du chargement du détail', 'error');
    }
  }

  renderChantierDetail(c) {
    const container = document.getElementById('chantierDetailContent');
    if (!container) return;

    const budgetPrevu = c.budgetPrevu ?? c.budgetPrevisionnel ?? 0;
    const budgetReel = c.budgetReel ?? 0;
    const budgetPct = budgetPrevu > 0 ? Math.round((budgetReel / budgetPrevu) * 100) : 0;
    const statutInfo = this.getStatutInfo(c.statut);

    const clientLabel = this.clientLabel(c);
    const responsableLabel = this.responsableLabel(c);

    container.innerHTML = `
      <div class="row g-4">
        <div class="col-md-8">
          <div class="card">
            <div class="card-header">
              <h6 class="mb-0"><i class="bi bi-info-circle me-2"></i>Informations générales</h6>
            </div>

            <div class="card-body">
              <div class="row g-3">
                <div class="col-md-6">
                  <label class="form-label text-secondary small">Numéro</label>
                  <div class="fw-semibold">${this.escapeHtml(c.numero || '')}</div>
                </div>

                <div class="col-md-6">
                  <label class="form-label text-secondary small">Statut</label>
                  <div><span class="badge ${statutInfo.class}">${statutInfo.label}</span></div>
                </div>

                <div class="col-md-6">
                  <label class="form-label text-secondary small">Client</label>
                  <div>${clientLabel ? this.escapeHtml(clientLabel) : '—'}</div>
                </div>

                <div class="col-md-6">
                  <label class="form-label text-secondary small">Chef de chantier</label>
                  <div>${responsableLabel ? this.escapeHtml(responsableLabel) : '—'}</div>
                </div>

                <div class="col-md-6">
                  <label class="form-label text-secondary small">Date début</label>
                  <div>${this.formatDate(c.dateDebut)}</div>
                </div>

                <div class="col-md-6">
                  <label class="form-label text-secondary small">Date fin prévue</label>
                  <div>${c.dateFinPrevue ? this.formatDate(c.dateFinPrevue) : '—'}</div>
                </div>

                <div class="col-md-6">
                  <label class="form-label text-secondary small">Date fin réelle</label>
                  <div>${c.dateFinReelle ? this.formatDate(c.dateFinReelle) : '—'}</div>
                </div>

                <div class="col-md-6">
                  <label class="form-label text-secondary small">Adresse</label>
                  <div>
                    ${this.escapeHtml(c.adresse || '')}
                    ${this.escapeHtml(c.codePostal || '')}
                    ${this.escapeHtml(c.ville || '')}
                  </div>
                </div>

                <div class="col-12">
                  <label class="form-label text-secondary small">Description</label>
                  <div>${this.escapeHtml(c.description || '—')}</div>
                </div>
              </div>
            </div>
          </div>

          <div class="card mt-3">
            <div class="card-header d-flex justify-content-between align-items-center">
              <h6 class="mb-0"><i class="bi bi-list-task me-2"></i>Phases</h6>
              <span class="badge bg-secondary">${c.phases?.length || 0} phases</span>
            </div>

            <div class="card-body p-0">
              ${c.phases && c.phases.length > 0 ? `
                <div class="table-responsive">
                  <table class="table table-sm mb-0">
                    <thead class="table-light">
                      <tr>
                        <th>#</th>
                        <th>Phase</th>
                        <th>Dates</th>
                        <th>Budget</th>
                        <th>Avancement</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${c.phases.map((p, i) => {
                        const avancement = p.avancementPct ?? p.avancement ?? 0;

                        return `
                          <tr>
                            <td>${i + 1}</td>
                            <td>${this.escapeHtml(p.nom)}</td>
                            <td>
                              <small>
                                ${p.dateDebut ? this.formatDate(p.dateDebut) : '—'}
                                ${p.dateFin ? ` → ${this.formatDate(p.dateFin)}` : ''}
                              </small>
                            </td>
                            <td><small>${this.formatCurrency(p.budget || 0)}</small></td>
                            <td>
                              <div class="progress" style="height: 6px;">
                                <div class="progress-bar" style="width: ${avancement}%"></div>
                              </div>
                              <small>${avancement}%</small>
                            </td>
                          </tr>
                        `;
                      }).join('')}
                    </tbody>
                  </table>
                </div>
              ` : '<div class="text-center py-3 text-secondary">Aucune phase définie</div>'}
            </div>
          </div>
        </div>

        <div class="col-md-4">
          <div class="card">
            <div class="card-header">
              <h6 class="mb-0"><i class="bi bi-currency-exchange me-2"></i>Budget</h6>
            </div>

            <div class="card-body">
              <div class="mb-3">
                <div class="d-flex justify-content-between mb-1">
                  <span class="text-secondary">Prévu</span>
                  <span class="fw-semibold">${this.formatCurrency(budgetPrevu)}</span>
                </div>

                <div class="d-flex justify-content-between mb-1">
                  <span class="text-secondary">Réel</span>
                  <span class="fw-semibold text-${budgetReel > budgetPrevu ? 'danger' : 'success'}">
                    ${this.formatCurrency(budgetReel)}
                  </span>
                </div>

                <div class="d-flex justify-content-between mb-1">
                  <span class="text-secondary">Écart</span>
                  <span class="fw-semibold text-${budgetReel > budgetPrevu ? 'danger' : 'success'}">
                    ${this.formatCurrency(budgetReel - budgetPrevu)}
                  </span>
                </div>

                <div class="progress mt-2" style="height: 8px;">
                  <div class="progress-bar ${budgetPct > 100 ? 'bg-danger' : 'bg-primary'}"
                       style="width: ${Math.min(budgetPct, 100)}%"></div>
                </div>

                <small class="text-secondary">${budgetPct}% du budget utilisé</small>
              </div>
            </div>
          </div>

          <div class="card mt-3">
            <div class="card-header d-flex justify-content-between align-items-center">
              <h6 class="mb-0"><i class="bi bi-exclamation-triangle me-2"></i>Incidents</h6>
              <span class="badge bg-danger">
                ${c.incidents?.filter(i => i.statut !== 'resolu' && i.statut !== 'clos').length || 0} ouverts
              </span>
            </div>

            <div class="card-body p-0">
              ${c.incidents && c.incidents.length > 0 ? `
                <div class="list-group list-group-flush">
                  ${c.incidents.slice(0, 5).map(i => {
                    const gravite = i.gravite || 'moyenne';
                    const graviteClass = {
                      critique: 'danger',
                      elevee: 'warning',
                      moyenne: 'info',
                      faible: 'secondary'
                    }[gravite] || 'secondary';

                    return `
                      <div class="list-group-item px-3 py-2">
                        <div class="d-flex justify-content-between">
                          <span class="fw-semibold small">${this.escapeHtml(i.titre)}</span>
                          <span class="badge bg-${graviteClass}">${gravite}</span>
                        </div>
                        <small class="text-secondary">${this.formatDate(i.dateIncident)}</small>
                      </div>
                    `;
                  }).join('')}

                  ${c.incidents.length > 5 ? `
                    <div class="list-group-item px-3 py-2 text-center text-secondary small">
                      + ${c.incidents.length - 5} autres...
                    </div>
                  ` : ''}
                </div>
              ` : '<div class="text-center py-3 text-secondary">Aucun incident</div>'}
            </div>
          </div>

          <div class="card mt-3">
            <div class="card-header d-flex justify-content-between align-items-center">
              <h6 class="mb-0"><i class="bi bi-people me-2"></i>Ressources</h6>
              <span class="badge bg-secondary">${c.affectations?.length || 0}</span>
            </div>

            <div class="card-body p-0">
              ${c.affectations && c.affectations.length > 0 ? `
                <div class="list-group list-group-flush">
                  ${c.affectations.slice(0, 5).map(a => `
                    <div class="list-group-item px-3 py-2">
                      <div class="d-flex justify-content-between">
                        <span class="fw-semibold small">${this.escapeHtml(this.affectationLabel(a))}</span>
                        <span class="badge ${a.typeRessource === 'Employe' ? 'bg-primary' : 'bg-warning text-dark'}">
                          ${a.typeRessource === 'Employe' ? 'Employé' : 'Matériel'}
                        </span>
                      </div>
                      <small class="text-secondary">
                        ${a.dateDebut ? this.formatDate(a.dateDebut) : '—'}
                        ${a.dateFin ? ` → ${this.formatDate(a.dateFin)}` : ''}
                      </small>
                    </div>
                  `).join('')}

                  ${c.affectations.length > 5 ? `
                    <div class="list-group-item px-3 py-2 text-center text-secondary small">
                      + ${c.affectations.length - 5} autres...
                    </div>
                  ` : ''}
                </div>
              ` : '<div class="text-center py-3 text-secondary">Aucune ressource affectée</div>'}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /* ============================= */
  /* Suppression chantier          */
  /* ============================= */

  confirmDeleteChantier(id) {
    const chantierId = id || document.getElementById('btnDeleteChantier')?.dataset.id;
    if (!chantierId) return;

    this.chantierIdASupprimer = parseInt(chantierId, 10);

    document.getElementById('deleteItemName').textContent = 'ce chantier';

    this.hideModal('modalChantierDetail');
    this.hideModal('modalChantier');

    setTimeout(() => {
      const modal = new bootstrap.Modal(document.getElementById('modalConfirmDelete'));
      modal.show();
    }, 250);
  }

  async executeDeleteChantier() {
    if (!this.chantierIdASupprimer) return;

    try {
      const result = await window.api.chantiers.invoke('delete', this.chantierIdASupprimer);

      if (result?.success === false) {
        throw new Error(result.error || 'Erreur lors de la suppression');
      }

      this.toast('Chantier supprimé', 'success');

      this.hideModal('modalConfirmDelete');

      this.chantierIdASupprimer = null;
      this.chantierEnEdition = null;
      this.phasesDraft = [];
      this.currentIncidents = [];
      this.currentAffectations = [];

      await this.loadChantiers();
    } catch (error) {
      console.error('Erreur suppression:', error);
      this.toast(error.message || 'Erreur lors de la suppression', 'error');
    }
  }

  /* ============================= */
  /* Export                        */
  /* ============================= */

  async exportChantiers() {
    try {
      const entrepriseId = window.AppState?.entreprise?.id || 1;

      const result = await window.api.chantiers.invoke('list', {
        entrepriseId,
        limit: 10000
      });

      if (result?.success === false) {
        throw new Error(result.error || 'Erreur lors de l\'export');
      }

      const items = this.extractItems(result);

      const headers = [
        'Numéro',
        'Nom',
        'Client',
        'Date début',
        'Date fin prévue',
        'Budget prévu',
        'Budget réel',
        'Statut'
      ];

      const rows = items.map(c => [
        c.numero || '',
        c.nom || '',
        this.clientLabel(c) || '',
        c.dateDebut || '',
        c.dateFinPrevue || '',
        c.budgetPrevu ?? c.budgetPrevisionnel ?? 0,
        c.budgetReel ?? 0,
        this.getStatutInfo(c.statut).label
      ]);

      const csv = [headers, ...rows]
        .map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','))
        .join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');

      link.href = URL.createObjectURL(blob);
      link.download = `chantiers_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();

      this.toast('Export terminé', 'success');
    } catch (error) {
      console.error('Erreur export:', error);
      this.toast(error.message || 'Erreur lors de l\'export', 'error');
    }
  }

  /* ============================= */
  /* Utilitaires                   */
  /* ============================= */

  formatDate(dateStr) {
    if (!dateStr) return '—';

    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return '—';

    return date.toLocaleDateString('fr-FR');
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'MGA',
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
window.chantiersController = new ChantiersController();

// Initialisation quand la vue est affichée
document.addEventListener('viewLoaded', (e) => {
  if (e.detail.view === 'chantiers') {
    window.chantiersController.init();
  }
});

// Auto-init si on est déjà sur la vue chantiers
if (document.querySelector('.chantiers-view')) {
  document.addEventListener('DOMContentLoaded', () => {
    window.chantiersController.init();
  });
}