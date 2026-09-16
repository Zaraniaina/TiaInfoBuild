import { useEffect, useState } from "react";
import { api } from "@/services/api";
import { SaasTenantsGrowthChart } from "@/components/charts/DashboardCharts";
import type { SuperAdminStats } from "@/types";
import { useNavigate } from "react-router-dom";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { downloadCsv } from "@/utils/csv";

interface Tenant {
  id: number;
  nom: string;
  actif: boolean;
  abonnement?: string;
  date_creation?: string;
}

interface AlertItem {
  id: number;
  type: string;
  titre: string;
  texte: string;
  date: string;
}

export function SuperAdminDashboardPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<SuperAdminStats | null>(null);
  const [recentTenants, setRecentTenants] = useState<Tenant[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [evolution, setEvolution] = useState<{
    labels: string[];
    data: number[];
  }>({ labels: [], data: [] });
  const [croissance, setCroissance] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/super-admin/stats").then((res) => setStats(res.data)).catch(() => setStats(null)),
      api.get("/super-admin/tenants-evolution").then((res) => {
        setEvolution({ labels: res.data.labels ?? [], data: res.data.data ?? [] });
        setCroissance(res.data.croissance ?? 0);
      }).catch(() => {
        setEvolution({ labels: [], data: [] });
        setCroissance(0);
      }),
      api.get("/super-admin/entreprises?size=5").then((res) => setRecentTenants(res.data.items || res.data || [])).catch(() => setRecentTenants([])),
      api.get("/super-admin/alerts").then((res) => setAlerts(res.data.items || res.data || [])).catch(() => setAlerts([])),
    ]).finally(() => setLoading(false));
  }, []);

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h2 className="mb-1 fw-bold text-secondary">
            <i className="bi bi-shield-lock me-2"></i>Supervision Plateforme SaaS
          </h2>
          <p className="text-secondary mb-0">Vue globale sur les tenants, abonnements, santé et revenus de la plateforme TIA INFO BUILD.</p>
        </div>
        <div className="d-flex gap-2">
          <button
            className="btn btn-outline-secondary btn-sm"
            onClick={() => downloadCsv(
              'tenants-plateforme.csv',
              recentTenants.map((t) => ({ id: t.id, nom: t.nom, actif: t.actif, abonnement: t.abonnement, date_creation: t.date_creation })),
              ['id', 'nom', 'actif', 'abonnement', 'date_creation'],
            )}
            disabled={!recentTenants.length}
          >
            <i className="bi bi-download me-1"></i>Exporter
          </button>
          <button className="btn btn-outline-secondary fw-bold" onClick={() => navigate('/super-admin/entreprises')}>
            <i className="bi bi-plus-circle me-1"></i>Nouvelle Entreprise
          </button>
        </div>
      </div>

      {/* KPIs Plateforme */}
      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="kpi-card border-0 shadow-sm">
            <div className="kpi-label text-secondary">Entreprises Actives</div>
            <div className="kpi-value text-secondary">
               {stats?.entreprises_actives || 0}
             </div>
            <div className="kpi-context text-muted">
              / {stats?.total_entreprises || 0} inscrites
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="kpi-card border-0 shadow-sm">
            <div className="kpi-label text-secondary">Utilisateurs Globaux</div>
            <div className="kpi-value text-dark">
              {stats?.total_utilisateurs || 0}
            </div>
            <div className="kpi-context text-muted">
              +{stats?.nouveaux_utilisateurs_mois || 0} ce mois
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="kpi-card border-0 shadow-sm">
            <div className="kpi-label text-secondary">Santé Uptime</div>
            <div className="kpi-value text-success">{stats?.uptime || 0}%</div>
            <div className="kpi-context text-muted">30 derniers jours</div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="kpi-card border-0 shadow-sm">
            <div className="kpi-label text-secondary">Revenu SaaS</div>
            <div className="kpi-value text-success">
              {(stats?.revenu_mensuel || 0).toLocaleString()} MGA
            </div>
            <div className="kpi-context text-muted">Mobile Money + Virement</div>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="kpi-card border-0 shadow-sm">
            <div className="kpi-label text-secondary">Entreprises Inactives</div>
            <div className="kpi-value text-danger">
              {stats?.entreprises_inactives || 0}
            </div>
            <div className="kpi-context text-muted">Suspendues / Impayées</div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="kpi-card border-0 shadow-sm">
            <div className="kpi-label text-secondary">Incidents Critiques</div>
            <div className="kpi-value text-danger">
              {stats?.incidents_critiques || 0}
            </div>
            <div className="kpi-context text-muted">En cours</div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="kpi-card border-0 shadow-sm">
            <div className="kpi-label text-secondary">Demandes Support</div>
            <div className="kpi-value text-warning">
              {stats?.demandes_support || 0}
            </div>
            <div className="kpi-context text-muted">Non traitées</div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="kpi-card border-0 shadow-sm">
            <div className="kpi-label text-secondary">Taux Croissance</div>
            <div className="kpi-value text-secondary">
               {croissance > 0 ? `+${croissance}%` : `${croissance}%`}
             </div>
            <div className="kpi-context text-muted">Nouveaux tenants / mois</div>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="kpi-card border-0 shadow-sm">
            <div className="kpi-label text-secondary">Chantiers Globaux</div>
            <div className="kpi-value text-dark">
              {stats?.total_chantiers || 0}
            </div>
            <div className="kpi-context text-muted">Tous tenants confondus</div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="kpi-card border-0 shadow-sm">
            <div className="kpi-label text-secondary">Factures en Retard</div>
            <div className="kpi-value text-danger">
              {stats?.factures_en_retard || 0}
            </div>
            <div className="kpi-context text-muted">À relancer</div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="kpi-card border-0 shadow-sm">
            <div className="kpi-label text-secondary">Paiements Enregistrés</div>
            <div className="kpi-value text-success">
              {stats?.total_paiements || 0}
            </div>
            <div className="kpi-context text-muted">Ce mois</div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="kpi-card border-0 shadow-sm">
            <div className="kpi-label text-secondary">Abonnements</div>
            <div className="kpi-value text-secondary">
               {stats?.abonnements ? Object.keys(stats.abonnements).length : 0}
             </div>
            <div className="kpi-context text-muted">Formules actives</div>
          </div>
        </div>
      </div>

      {/* Alertes & Notifications */}
      {alerts.length > 0 && (
        <div className="mb-4">
          <div className="dashboard-section-title text-secondary">
            <i className="bi bi-bell me-2"></i>Alertes & Notifications
          </div>
          <div className="row g-3">
            {alerts.map((a) => (
              <div key={a.id} className="col-md-6">
                <div className="card border-0 shadow-sm">
                  <div className="card-body d-flex align-items-start gap-3">
                    <div className="alert-icon text-secondary">
                      <i className="bi bi-exclamation-triangle"></i>
                    </div>
                    <div>
                      <strong className="text-dark">{a.titre}</strong>
                      <div className="small text-muted mb-0">{a.texte}</div>
                    </div>
                    <small className="text-muted ms-auto">{a.date}</small>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Graphiques */}
      <div className="row g-4 mb-4">
        <div className="col-lg-12">
          <div className="chart-card border-0 shadow-sm">
            <SaasTenantsGrowthChart
              labels={evolution.labels}
              data={evolution.data}
            />
          </div>
        </div>
      </div>

      {/* Derniers tenants */}
      <div className="card border-0 shadow-sm">
        <div className="card-header bg-white border-0 py-3 d-flex justify-content-between align-items-center">
          <h5 className="mb-0 text-secondary">
            <i className="bi bi-building me-2"></i>Dernières entreprises inscrites
          </h5>
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={() => navigate('/super-admin/entreprises')}
          >
            Voir tout
          </button>
        </div>
        <div className="table-responsive">
          <table className="table mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>Entreprise</th>
                <th>Plan</th>
                <th>Statut</th>
                <th>Date inscription</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-0 border-0">
                    <TableSkeleton rows={5} columns={4} />
                  </td>
                </tr>
              ) : (
                <>
              {recentTenants.map((t) => (
                <tr key={t.id}>
                  <td className="fw-semibold">{t.nom}</td>
                  <td>
                    <span className="badge bg-light text-dark text-capitalize">
                      {t.abonnement || "pro"}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`badge ${t.actif ? "bg-success bg-opacity-10 text-success border" : "bg-danger bg-opacity-10 text-danger border"}`}
                    >
                      {t.actif ? "Actif" : "Inactif"}
                    </span>
                  </td>
                  <td className="text-muted">{t.date_creation}</td>
                </tr>
              ))}
              {recentTenants.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-4 text-muted">
                    Aucune entreprise inscrite pour le moment.
                  </td>
                </tr>
              )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
