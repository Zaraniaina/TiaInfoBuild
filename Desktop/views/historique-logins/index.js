/**
 * historique-logins/index.js — Contrôleur Vue Historique des connexions
 * Chargé dynamiquement par router.js dans contentArea
 */

class HistoriqueConnexionsController {
    constructor() {
        this.logs = [];
        this.total = 0;
        this.currentPage = 1;
        this.pageSize = 20;
        this.filters = { utilisateurId: '', statut: '', dateDebut: '' };
        this.utilisateurs = [];
    }

    async init() {
        this.bindEvents();
        await this.loadUtilisateurs();
        await this.loadLogs();
    }

    bindEvents() {
        document.getElementById('btnFiltrer')?.addEventListener('click', () => {
            this.filters.utilisateurId = document.getElementById('filterUtilisateur')?.value || '';
            this.filters.statut = document.getElementById('filterStatut')?.value || '';
            this.filters.dateDebut = document.getElementById('filterDateDebut')?.value || '';
            this.currentPage = 1;
            this.loadLogs();
        });

        document.getElementById('btnExportCsv')?.addEventListener('click', () => this.exportCSV());
        document.getElementById('btnExportPdf')?.addEventListener('click', () => this.exportPDF());
    }

    getEntrepriseId() {
        return window.AppState?.entreprise?.id || window.AppState?.user?.entrepriseId || 1;
    }

    async loadUtilisateurs() {
        try {
            const entrepriseId = this.getEntrepriseId();
            const result = await window.api.utilisateurs.invoke('list', { entrepriseId, limit: 500 });
            this.utilisateurs = result?.items || result?.data?.items || [];
            const select = document.getElementById('filterUtilisateur');
            if (!select) return;

            this.utilisateurs.forEach(u => {
                const option = document.createElement('option');
                option.value = u.id;
                option.textContent = `${u.prenom || ''} ${u.nom || ''} (${u.email})`.trim() || u.email;
                select.appendChild(option);
            });
        } catch (error) {
            console.error('Erreur chargement utilisateurs:', error);
        }
    }

    async loadLogs() {
        try {
            const entrepriseId = this.getEntrepriseId();
            const params = {
                entrepriseId,
                limit: this.pageSize,
                offset: (this.currentPage - 1) * this.pageSize,
                ...(this.filters.utilisateurId ? { utilisateurId: parseInt(this.filters.utilisateurId, 10) } : {}),
                ...(this.filters.statut !== '' ? { statut: parseInt(this.filters.statut, 10) } : {}),
                ...(this.filters.dateDebut ? { dateDebut: this.filters.dateDebut } : {})
            };

            const result = await window.api.loginHistory?.invoke?.('list', params) ||
                           window.ipcRaw?.invoke?.('loginHistory:list', params);

            if (!result) {
                this.showError('API loginHistory non disponible');
                return;
            }

            this.logs = result.items || result.data?.items || [];
            this.total = result.total || this.logs.length;
            this.render(this.logs);
            this.renderPagination();
            this.updateCount();
        } catch (error) {
            console.error('Erreur chargement historique:', error);
            this.showError('Erreur lors du chargement');
        }
    }

    render(logs) {
        const tbody = document.getElementById('historiqueTbody');
        if (!tbody) return;

        if (logs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-secondary">Aucune connexion trouvée</td></tr>`;
            return;
        }

        const statusBadge = (reussi) => {
            const val = parseInt(reussi, 10);
            return val === 1
                ? '<span class="badge bg-success">Réussie</span>'
                : '<span class="badge bg-danger">Échouée</span>';
        };

        tbody.innerHTML = logs.map((l, i) => {
            const user = this.utilisateurs.find(u => u.id === l.utilisateurId);
            const nomComplet = user ? `${user.prenom || ''} ${user.nom || ''}`.trim() : `${l.prenom || ''} ${l.nom || ''}`.trim();
            const email = user ? user.email : l.email;

            return `
                <tr>
                    <td>${(this.currentPage - 1) * this.pageSize + i + 1}</td>
                    <td><small>${this.formatDate(l.dateConnexion)}</small></td>
                    <td>${this.escapeHtml(nomComplet || '-')}</td>
                    <td>${this.escapeHtml(email || '-')}</td>
                    <td>${this.escapeHtml(l.roleNom || l.roleCode || '-')}</td>
                    <td>${statusBadge(l.reussi)}</td>
                    <td><code class="small">${this.escapeHtml(l.adresseIP || '-')}</code></td>
                    <td><small class="text-danger">${this.escapeHtml(l.motifEchec || '-')}</small></td>
                </tr>
            `;
        }).join('');
    }

    renderPagination() {
        const container = document.getElementById('historiquePagination');
        if (!container) return;

        const totalPages = Math.ceil(this.total / this.pageSize);
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
                    this.loadLogs();
                }
            });
        });
    }

    updateCount() {
        const countEl = document.getElementById('historiqueCount');
        if (countEl) {
            countEl.textContent = `${this.total} résultat${this.total !== 1 ? 's' : ''}`;
        }
    }

    showError(message) {
        const tbody = document.getElementById('historiqueTbody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-danger">${this.escapeHtml(message)}</td></tr>`;
        }
    }

    exportCSV() {
        let logs = this.logs.slice();
        if (this.filters.statut !== '') {
            const status = parseInt(this.filters.statut, 10);
            logs = logs.filter(l => parseInt(l.reussi, 10) === status);
        }
        if (this.filters.dateDebut) {
            const debut = new Date(this.filters.dateDebut);
            logs = logs.filter(l => new Date(l.dateConnexion) >= debut);
        }

        const headers = ['#', 'Date/Heure', 'Utilisateur', 'Email', 'Rôle', 'Statut', 'Adresse IP', 'Motif échec'];
        const rows = logs.map((l, i) => {
            const user = this.utilisateurs.find(u => u.id === l.utilisateurId);
            return [
                (this.currentPage - 1) * this.pageSize + i + 1,
                l.dateConnexion,
                user ? `${user.prenom || ''} ${user.nom || ''}`.trim() : `${l.prenom || ''} ${l.nom || ''}`.trim(),
                user ? user.email : l.email,
                l.roleNom || l.roleCode || '',
                l.reussi ? 'Réussie' : 'Échouée',
                l.adresseIP || '',
                l.motifEchec || ''
            ];
        });

        const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `historique_connexions_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
    }

    exportPDF() {
        const printWindow = window.open('', '_blank', 'width=900,height=700');
        if (!printWindow) {
            showToast('Impossible d\'ouvrir la fenêtre d\'impression.', 'warning');
            return;
        }

        let logs = this.logs.slice();
        if (this.filters.statut !== '') {
            const status = parseInt(this.filters.statut, 10);
            logs = logs.filter(l => parseInt(l.reussi, 10) === status);
        }
        if (this.filters.dateDebut) {
            const debut = new Date(this.filters.dateDebut);
            logs = logs.filter(l => new Date(l.dateConnexion) >= debut);
        }

        const rows = logs.map((l, i) => {
            const user = this.utilisateurs.find(u => u.id === l.utilisateurId);
            return `<tr>
                <td style="border:1px solid #dee2e6;padding:6px;">${(this.currentPage - 1) * this.pageSize + i + 1}</td>
                <td style="border:1px solid #dee2e6;padding:6px;">${this.escapeHtml(this.formatDate(l.dateConnexion))}</td>
                <td style="border:1px solid #dee2e6;padding:6px;">${this.escapeHtml(user ? `${user.prenom || ''} ${user.nom || ''}`.trim() : `${l.prenom || ''} ${l.nom || ''}`.trim() || '-')}</td>
                <td style="border:1px solid #dee2e6;padding:6px;">${this.escapeHtml(user ? user.email : l.email || '-')}</td>
                <td style="border:1px solid #dee2e6;padding:6px;">${this.escapeHtml(l.roleNom || l.roleCode || '-')}</td>
                <td style="border:1px solid #dee2e6;padding:6px;">${parseInt(l.reussi, 10) === 1 ? 'Réussie' : 'Échouée'}</td>
                <td style="border:1px solid #dee2e6;padding:6px;">${this.escapeHtml(l.adresseIP || '-')}</td>
                <td style="border:1px solid #dee2e6;padding:6px;">${this.escapeHtml(l.motifEchec || '-')}</td>
            </tr>`;
        }).join('');

        printWindow.document.write(`<!DOCTYPE html><html><head><title>Historique des connexions</title></head><body>
            <h1>Historique des connexions</h1>
            <p>Exporté le ${new Date().toLocaleString('fr-FR')}</p>
            <table style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:12px;">
                <thead><tr style="background:#f8f9fa;">
                    <th style="border:1px solid #dee2e6;padding:8px;">#</th>
                    <th style="border:1px solid #dee2e6;padding:8px;">Date/Heure</th>
                    <th style="border:1px solid #dee2e6;padding:8px;">Utilisateur</th>
                    <th style="border:1px solid #dee2e6;padding:8px;">Email</th>
                    <th style="border:1px solid #dee2e6;padding:8px;">Rôle</th>
                    <th style="border:1px solid #dee2e6;padding:8px;">Statut</th>
                    <th style="border:1px solid #dee2e6;padding:8px;">Adresse IP</th>
                    <th style="border:1px solid #dee2e6;padding:8px;">Motif échec</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>
            <script>window.onload = () => { window.print(); }<\/script>
        </body></html>`);
        printWindow.document.close();
    }

    formatDate(dateStr) {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleString('fr-FR');
    }

    escapeHtml(text) {
        if (text == null) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }
}

window.historiqueConnexionsController = new HistoriqueConnexionsController();
