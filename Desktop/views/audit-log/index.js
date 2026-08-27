/**
 * Audit Log View Controller
 */

class AuditLogController {
  async init() {
    this.bindEvents();
    await this.loadRecent();
  }

  bindEvents() {
    document.getElementById('btnFilter')?.addEventListener('click', () => this.loadRecent());
  }

  async loadRecent() {
    const module = document.getElementById('filterModule')?.value || '';
    const userQuery = document.getElementById('filterUser')?.value?.trim() || '';
    const listEl = document.getElementById('auditList');
    const emptyEl = document.getElementById('auditEmpty');

    listEl.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary" role="status"></div></div>';
    emptyEl?.classList.add('d-none');

    try {
      const params = { limit: 50, offset: 0 };
      const result = module
        ? await window.api.audit.invoke('byModule', window.AppState.entreprise.id, module, 50, 0)
        : await window.api.audit.invoke('recent', window.AppState.entreprise.id, 50);

      const items = result?.data ?? result;
      const logs = Array.isArray(items) ? items : (items?.items || []);

      if (userQuery && logs.length) {
        const q = userQuery.toLowerCase();
        const filtered = logs.filter(l =>
          (l.nom && l.nom.toLowerCase().includes(q)) ||
          (l.prenom && l.prenom.toLowerCase().includes(q)) ||
          (l.email && l.email.toLowerCase().includes(q))
        );
        logs.length = 0;
        logs.push(...filtered);
      }

      this.render(logs);
    } catch (error) {
      listEl.innerHTML = '<div class="alert alert-danger mb-0">Erreur lors du chargement du journal d\'audit.</div>';
    }
  }

  render(logs) {
    const listEl = document.getElementById('auditList');
    const emptyEl = document.getElementById('auditEmpty');

    if (!logs.length) {
      listEl.innerHTML = '';
      emptyEl?.classList.remove('d-none');
      return;
    }

    emptyEl?.classList.add('d-none');
    listEl.innerHTML = logs.map(log => {
      const date = new Date(log.dateAction).toLocaleString('fr-FR');
      const user = [log.prenom, log.nom].filter(Boolean).join(' ') || log.email || 'Système';
      return `
        <div class="log-entry">
          <div class="d-flex justify-content-between align-items-start">
            <div>
              <div class="log-module badge bg-secondary bg-opacity-10 text-secondary mb-1">${this.escapeHtml(log.module)}</div>
              <div class="log-action text-dark">${this.escapeHtml(log.action)}</div>
              ${log.entityId ? `<div class="small text-secondary">Entité #${log.entityId}</div>` : ''}
            </div>
            <div class="text-end">
              <div class="small fw-semibold">${this.escapeHtml(user)}</div>
              <div class="small text-secondary">${date}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

module.exports = AuditLogController;
