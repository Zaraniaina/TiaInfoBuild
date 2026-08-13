class HistoriqueConnexionsController {
    constructor() {
        this.logs = [];
        this.total = 0;
        this.filters = { utilisateurId: '', statut: '', dateDebut: '' };
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
            this.loadLogs();
        });
        document.getElementById('btnExportCsv')?.addEventListener('click', () => this.exportCSV());
        document.getElementById('btnExportPdf')?.addEventListener('click', () => this.exportPDF());
        document.getElementById('btnLogout')?.addEventListener('click', (e) => {
            e.preventDefault();
            const logoutModalEl = document.getElementById('logoutModal');
            const logoutModal = logoutModalEl ? new bootstrap.Modal(logoutModalEl) : null;
            if (logoutModal) {
              logoutModal.show();
            } else {
              this.executeLogout();
            }
        });
        document.getElementById('confirmLogoutBtn')?.addEventListener('click', async () => {
            const logoutModalEl = document.getElementById('logoutModal');
            const logoutModal = logoutModalEl ? new bootstrap.Modal(logoutModalEl) : null;
            if (logoutModal) logoutModal.hide();
            await this.executeLogout();
        });
    }

    getEntrepriseId() {
        return window.AppState?.entreprise?.id || window.AppState?.user?.entrepriseId || 1;
    }

    async loadUtilisateurs() {
        try {
            const entrepriseId = this.getEntrepriseId();
            const result = await window.api.utilisateurs.invoke('list', { entrepriseId, limit: 500 });
            const utilisateurs = result?.items || result?.data || [];
            const select = document.getElementById('filterUtilisateur');
            if (!select) return;
            utilisateurs.forEach(u => {
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
            const params = { entrepriseId: this.getEntrepriseId(), limit: 500, offset: 0 };
            if (this.filters.utilisateurId) params.utilisateurId = parseInt(this.filters.utilisateurId, 10);
            const result = await window.ipcRaw?.invoke ? window.ipcRaw.invoke('loginHistory:list', params) : null;
            if (!result) {
                const tbody = document.getElementById('historiqueTbody');
                if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-danger">API loginHistory non disponible</td></tr>';
                return;
            }
            this.logs = result.items || [];
            this.total = result.total || 0;
            this.applyFilters();
        } catch (error) {
            console.error('Erreur chargement historique:', error);
            const tbody = document.getElementById('historiqueTbody');
            if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-danger">Erreur lors du chargement</td></tr>';
        }
    }

    applyFilters() {
        let filtered = this.logs;
        if (this.filters.statut !== '') {
            const status = parseInt(this.filters.statut, 10);
            filtered = filtered.filter(l => parseInt(l.reussi, 10) === status);
        }
        if (this.filters.dateDebut) {
            const debut = new Date(this.filters.dateDebut);
            filtered = filtered.filter(l => new Date(l.dateConnexion) >= debut);
        }
        this.render(filtered);
    }

    render(logs) {
        const tbody = document.getElementById('historiqueTbody');
        if (!tbody) return;
        if (!logs.length) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-secondary">Aucune connexion trouvée</td></tr>';
            return;
        }
        const statusBadge = (reussi) => {
            const val = parseInt(reussi, 10);
            return val === 1
                ? '<span class="badge bg-success">Réussie</span>'
                : '<span class="badge bg-danger">Échouée</span>';
        };
        tbody.innerHTML = logs.map((l, i) => `
            <tr>
                <td>${i + 1}</td>
                <td><small>${this.escapeHtml(this.formatDate(l.dateConnexion))}</small></td>
                <td>${this.escapeHtml(`${l.prenom || ''} ${l.nom || ''}`.trim() || '-')}</td>
                <td>${this.escapeHtml(l.email || '-')}</td>
                <td>${this.escapeHtml(l.roleNom || l.roleCode || '-')}</td>
                <td>${statusBadge(l.reussi)}</td>
                <td><code class="small">${this.escapeHtml(l.adresseIP || '-')}</code></td>
                <td><small class="text-danger">${this.escapeHtml(l.motifEchec || '-')}</small></td>
            </tr>
        `).join('');
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
        const rows = logs.map((l, i) => [
            i + 1,
            l.dateConnexion,
            `${l.prenom || ''} ${l.nom || ''}`.trim(),
            l.email,
            l.roleNom || l.roleCode || '',
            l.reussi ? 'Réussie' : 'Échouée',
            l.adresseIP || '',
            l.motifEchec || ''
        ]);
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
        if (!printWindow) { showToast('Impossible d\'ouvrir la fenêtre d\'impression.', 'warning'); return; }
        let logs = this.logs.slice();
        if (this.filters.statut !== '') {
            const status = parseInt(this.filters.statut, 10);
            logs = logs.filter(l => parseInt(l.reussi, 10) === status);
        }
        if (this.filters.dateDebut) {
            const debut = new Date(this.filters.dateDebut);
            logs = logs.filter(l => new Date(l.dateConnexion) >= debut);
        }
        const rows = logs.map((l, i) => `<tr>
            <td style="border:1px solid #dee2e6;padding:6px;">${i + 1}</td>
            <td style="border:1px solid #dee2e6;padding:6px;">${this.escapeHtml(this.formatDate(l.dateConnexion))}</td>
            <td style="border:1px solid #dee2e6;padding:6px;">${this.escapeHtml(`${l.prenom || ''} ${l.nom || ''}`.trim() || '-')}</td>
            <td style="border:1px solid #dee2e6;padding:6px;">${this.escapeHtml(l.email || '-')}</td>
            <td style="border:1px solid #dee2e6;padding:6px;">${this.escapeHtml(l.roleNom || l.roleCode || '-')}</td>
            <td style="border:1px solid #dee2e6;padding:6px;">${parseInt(l.reussi, 10) === 1 ? 'Réussie' : 'Échouée'}</td>
            <td style="border:1px solid #dee2e6;padding:6px;">${this.escapeHtml(l.adresseIP || '-')}</td>
            <td style="border:1px solid #dee2e6;padding:6px;">${this.escapeHtml(l.motifEchec || '-')}</td>
        </tr>`).join('');
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

    async executeLogout() {
        try {
            await window.api?.auth?.invoke('logout');
        } catch (e) { /* silencieux */ }
        localStorage.removeItem('currentUser');
        sessionStorage.clear();
        window.location.href = '../views/index.html';
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
