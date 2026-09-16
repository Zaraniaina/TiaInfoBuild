import { useAuthStore } from "@/stores/auth.store";
import { useNavigate } from "react-router-dom";
import { RoleBadge } from "@/components/layout/RoleBadge";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import {
  SaasTenantsGrowthChart,
  UserActivityLogsChart,
  CaVsDepensesChart,
  DepensesParPosteChart,
  MultiChantiersProgressChart,
  EquipePresenceDailyChart,
  RhEquipesDistributionChart,
  ParcUsageRateChart,
  StockCategoryDistributionChart,
  SalesPipelineChart,
  WorkerPersonalAttendanceChart,
} from "@/components/charts/DashboardCharts";
import { ROLE_DASHBOARD_TITLE } from "@/config/roles.config";
import { QRScannerModal } from "@/components/pointage/QRScannerModal";
import { WorkerBadgeCard } from "@/components/pointage/WorkerBadgeCard";
import { PageSkeleton } from "@/components/ui/Skeleton"
import { employeTerrainService } from "@/services/employeTerrain.service";

const ROLE_META: Record<
  string,
  {
    greeting: string;
    alert?: { type: string; icon: string; title: string; text: string };
  }
> = {
  super_admin: {
    greeting: "Supervision globale de la plateforme SaaS",
    alert: {
      type: "danger",
      icon: "bi-shield-lock-fill",
      title: "Mode Super Admin",
      text: "Gestion des abonnements et de la santé globale de la plateforme SaaS.",
    },
  },
  admin_entreprise: {
    greeting:
      "Administration technique, comptes et sécurité de votre entreprise",
    alert: {
      type: "primary",
      icon: "bi-gear-fill",
      title: "Espace Administrateur",
      text: "Gestion des accès utilisateurs, audit de sécurité et configuration des paramètres.",
    },
  },
  directeur: {
    greeting: "Pilotage stratégique et validation des décisions à fort enjeu",
  },
  comptable: {
    greeting: "Suivi comptable, contrôle des coûts et trésorerie",
  },
  chef_chantier: {
    greeting: "Suivi quotidien de votre chantier et pointage de votre équipe",
    alert: {
      type: "info",
      icon: "bi-building",
      title: "Gestion Terrain",
      text: "Scannez le badge des ouvriers ou validez votre pointage GPS.",
    },
  },
  chef_projet: {
    greeting: "Supervision multi-projets et arbitrage des ressources",
  },
  rh: {
    greeting: "Gestion du personnel, habilitations BTP et pointages",
  },
  materiel: {
    greeting: "Gestion du parc d'engins et planning de maintenance",
  },
  magasinier: {
    greeting: "Gestion des stocks, entrées/sorties et réapprovisionnements",
  },
  commercial: {
    greeting: "Suivi du pipeline commercial, devis et factures clients",
  },
  employe: {
    greeting: "Vos tâches affectées et votre badge officiel de pointage",
    alert: {
      type: "success",
      icon: "bi-qr-code-scan",
      title: "Mon Badge QR",
      text: "Présentez votre badge au Chef de Chantier lors de votre arrivée / départ.",
    },
  },
  client: {
    greeting: "Suivi de vos projets et état de vos devis / factures",
  },
};

export function DashboardPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const roleCode = user?.role_code || "employe";
  const [loading, setLoading] = useState(true);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [gpsState, setGpsState] = useState<"idle" | "locating" | "sending" | "done" | "error">("idle");
  const [gpsMessage, setGpsMessage] = useState<string | null>(null);
  const [showBadgeModal, setShowBadgeModal] = useState(false);
  const [approvingId, setApprovingId] = useState<number | null>(null);

  /** Auto-pointage GPS : enregistre l'entrée via POST /employe-terrain/presence
   *  avec la position du navigateur en traçabilité (notes="GPS: lat, lon"). */
  const handleAutoPointageGps = () => {
    if (!navigator.geolocation) {
      setGpsState("error");
      setGpsMessage("Géolocalisation non disponible sur cet appareil.");
      return;
    }
    setGpsState("locating");
    setGpsMessage(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const notes = `GPS: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
        setGpsState("sending");
        try {
          const res = await employeTerrainService.enregistrerPresence({ action: "entree", notes });
          setGpsState("done");
          setGpsMessage(res?.message || "Pointage d'entrée enregistré.");
        } catch (e: any) {
          setGpsState("error");
          setGpsMessage(e?.response?.data?.detail || "Impossible d'enregistrer le pointage.");
        }
      },
      (err) => {
        setGpsState("error");
        setGpsMessage(err.code === err.PERMISSION_DENIED
          ? "Accès à la position refusé. Autorisez la géolocalisation pour pointer."
          : "Position indisponible. Réessayez.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: () => api.get("/dashboard/stats").then((res) => res.data),
  })
  const { data: charts, isLoading: chartsLoading } = useQuery({
    queryKey: ["dashboard", "charts"],
    queryFn: () => api.get("/dashboard/charts").then((res) => res.data),
  })
  const { data: validationsData, refetch: refetchValidations, isLoading: validationsLoading } = useQuery({
    queryKey: ["dashboard", "validations"],
    queryFn: () => api.get("/dashboard/validations").then((res) => res.data),
    enabled: ["directeur", "admin_entreprise", "super_admin"].includes(roleCode),
  })

  const handleApprove = async (id: number) => {
    setApprovingId(id)
    try {
      await api.post(`/dashboard/validations/${id}/approve`)
      refetchValidations()
    } catch {
      alert("Erreur lors de l'approbation.")
    } finally {
      setApprovingId(null)
    }
  }

  const handleReject = async (id: number) => {
    setApprovingId(id)
    try {
      await api.post(`/dashboard/validations/${id}/reject`)
      refetchValidations()
    } catch {
      alert("Erreur lors du refus.")
    } finally {
      setApprovingId(null)
    }
  }

  useEffect(() => {
    setLoading(statsLoading || chartsLoading)
  }, [statsLoading, chartsLoading])

  const meta = ROLE_META[roleCode] || ROLE_META["employe"];
  const dashboardTitle = ROLE_DASHBOARD_TITLE[roleCode] || "Tableau de bord";

  const renderKpi = (
    label: string,
    value: string | number,
    context?: string,
    colorClass = "text-primary",
  ) => (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      {statsLoading ? (
        <div className="kpi-value placeholder-glow">
          <span className="placeholder col-6 bg-secondary"></span>
        </div>
      ) : (
        <div className={`kpi-value ${colorClass}`}>{value}</div>
      )}
      {context && <div className="kpi-context">{context}</div>}
    </div>
  );

  const renderAlert = () => {
    if (!meta.alert) return null;
    const colors: Record<string, string> = {
      danger: "bg-danger bg-opacity-10 text-danger border",
      primary: "bg-primary bg-opacity-10 text-primary border",
      info: "bg-info bg-opacity-10 text-info border",
      success: "bg-success bg-opacity-10 text-success border",
      warning: "bg-warning bg-opacity-10 text-warning border",
    };
    return (
      <div
        className={`alert-bar mb-4 ${colors[meta.alert.type] || colors.info}`}
      >
        <div className="alert-icon">
          <i className={`bi ${meta.alert.icon}`}></i>
        </div>
        <div>
          <strong>{meta.alert.title}</strong>
          <div className="small mb-0">{meta.alert.text}</div>
        </div>
      </div>
    );
  };

  // 1. SUPER ADMIN SAAS DASHBOARD
  const renderSuperAdmin = () => (
    <div>
      {renderAlert()}
      <div className="row g-3 mb-4">
        {renderKpi(
          "Comptes Utilisateurs",
          String(stats?.nb_utilisateurs ?? 0),
          "Utilisateurs enregistrés",
          "text-primary",
        )}
        {renderKpi(
          "Comptes Désactivés",
          String(stats?.utilisateurs_inactifs ?? 0),
          "Comptes fermés / en attente",
          "text-danger",
        )}
        {renderKpi(
          "Anomalies 24h",
          String(stats?.alertes_critiques ?? 0),
          "Échecs de connexion / alertes",
          "text-warning",
        )}
        {renderKpi(
          "Disponibilité",
          `${stats?.uptime ?? 0}%`,
          "Système entreprise opérationnel",
          "text-success",
        )}
      </div>
      <div className="row g-4 mb-4">
        <div className="col-lg-12">
          <div className="chart-card">
            <SaasTenantsGrowthChart
              labels={charts?.ca_evolution?.labels}
              data={charts?.ca_evolution?.ca}
            />
          </div>
        </div>
      </div>
    </div>
  );

  // 2. ADMIN ENTREPRISE DASHBOARD
  const renderAdminEntreprise = () => {
    const totalUsers = stats?.nb_utilisateurs ?? 0;
    const activeUsers = Math.max(
      0,
      totalUsers - (stats?.utilisateurs_inactifs ?? 0),
    );
    const inactiveUsers = stats?.utilisateurs_inactifs ?? 0;
    const anomalies = stats?.alertes_critiques ?? 0;
    const disponibilite = stats?.uptime ?? 0;

    return (
      <div>
        {renderAlert()}
        <div className="row g-3 mb-4">
          {renderKpi(
            "Comptes Actifs",
            String(activeUsers),
            `Sur ${totalUsers} utilisateurs`,
            "text-primary",
          )}
          {renderKpi(
            "Comptes Désactivés",
            String(inactiveUsers),
            "Comptes fermés / en attente",
            "text-danger",
          )}
          {renderKpi(
            "Anomalies 24h",
            String(anomalies),
            "Échecs de connexion / alertes",
            "text-warning",
          )}
          {renderKpi(
            "Disponibilité",
            `${disponibilite}%`,
            "Système entreprise opérationnel",
            "text-success",
          )}
        </div>
        <div className="row g-4 mb-4">
          <div className="col-lg-8">
            <div className="chart-card">
              <UserActivityLogsChart
                labels={charts?.connexions_par_jour?.labels}
                data={charts?.connexions_par_jour?.data}
              />
            </div>
          </div>
          <div className="col-lg-4">
            <div className="chart-card">
              <h5 className="fw-bold mb-3">
                <i className="bi bi-sliders me-2 text-primary"></i>Conformité
                Paramétrage
              </h5>
                <div className="d-flex flex-column gap-2">
                <div className="d-flex justify-content-between align-items-center p-2 bg-light rounded">
                  <span className="small fw-semibold">
                    Rôles & Permissions RBAC
                  </span>
                  <span className="badge bg-success bg-opacity-10 text-success border">Conforme</span>
                </div>
                <div className="d-flex justify-content-between align-items-center p-2 bg-light rounded">
                  <span className="small fw-semibold">
                    Format Numérotation Devis
                  </span>
                  <span className="badge bg-success bg-opacity-10 text-success border">Actif</span>
                </div>
                <div className="d-flex justify-content-between align-items-center p-2 bg-light rounded">
                  <span className="small fw-semibold">
                    Seuils Alertes Budgétaires
                  </span>
                  <span className="badge bg-success bg-opacity-10 text-success border">Configuré</span>
                </div>
                <div className="d-flex justify-content-between align-items-center p-2 bg-light rounded">
                  <span className="small fw-semibold">
                    Politique Pointage Bureau
                  </span>
                  <span className="badge bg-light text-dark border">QR Fixe</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="card border-0 shadow-sm p-4 mb-4">
          <h5 className="fw-bold mb-3 text-secondary">
            <i className="bi bi-gear-fill me-2"></i>Actions rapides
            administration
          </h5>
          <div className="d-flex gap-2 flex-wrap">
            <button
              className="btn btn-outline-secondary fw-bold"
              onClick={() => navigate("/settings")}
            >
              <i className="bi bi-person-gear me-2"></i>Gérer Comptes &
              Permissions
            </button>
            <button
              className="btn btn-outline-secondary fw-bold"
              onClick={() => navigate("/historique-logins")}
            >
              <i className="bi bi-shield-check me-2"></i>Audit Logs Connexions
            </button>
            <button
              className="btn btn-outline-secondary"
              onClick={() => navigate("/settings")}
            >
              <i className="bi bi-sliders me-2"></i>Paramètres Entreprise
            </button>
          </div>
        </div>
      </div>
    );
  };

  // 3. DIRECTION GENERALE / DAF DASHBOARD
  const renderDirecteur = () => {
    const caTotal = stats?.ca_total || 0;
    const margeBrute = stats?.marge_brute ?? caTotal - (stats?.depenses_mois || 0);
    const margeNette = stats?.marge_nette ?? margeBrute * 0.9;
    const tauxMarge = caTotal > 0 ? ((margeNette / caTotal) * 100).toFixed(1) : "0.0";
    const alertesCritiques = stats?.alertes_critiques || 0;
    const validationsCount = stats?.devis_pending_dg || 0;

    const validations: Array<{
      id: number;
      type: string;
      reference: string;
      chantier: string;
      montant: number;
      soumis_par: string;
      date_soumission: string;
    }> = validationsData?.items || [];

    const risques: Array<{
      niveau: string;
      chantier: string;
      description: string;
      derive_pct: number;
    }> = stats?.risques || [];

    const budgetDerive: Array<{
      chantier: string;
      budget_initial: number;
      consomme: number;
      pct: number;
    }> = stats?.budget_derive || [];

    return (
      <div>
        {/* Alert si validations urgentes */}
        {validationsCount > 0 && (
          <div className="alert-bar mb-4 bg-warning bg-opacity-10 text-dark border d-flex align-items-start gap-3">
            <div className="alert-icon text-warning">
              <i className="bi bi-hourglass-split"></i>
            </div>
            <div>
              <strong>
                {validationsCount} décision{validationsCount > 1 ? "s" : ""} en attente de validation DG
              </strong>
              <div className="small mb-0">
                Des devis ou budgets soumis par vos équipes nécessitent votre arbitrage.
              </div>
            </div>
          </div>
        )}

        {/* KPIs Stratégiques */}
        <div className="row g-3 mb-4">
          {renderKpi(
            "Chiffre d'Affaires Brut",
            `${caTotal.toLocaleString()} MGA`,
            "Consolidé tous chantiers",
            "text-primary",
          )}
          {renderKpi(
            "Marge Nette Consolidée",
            `${margeNette.toLocaleString()} MGA`,
            `Taux net: ${tauxMarge}%`,
            "text-success",
          )}
          {renderKpi(
            "Devis / Budgets à Valider",
            String(validationsCount),
            "Soumis à validation DG",
            validationsCount > 0 ? "text-warning" : "text-secondary",
          )}
          {renderKpi(
            "Alertes Critiques",
            String(alertesCritiques),
            "Retards & dérives budgétaires",
            alertesCritiques > 0 ? "text-danger" : "text-secondary",
          )}
        </div>

        {/* === CENTRE DE VALIDATION DG === */}
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-header bg-white border-bottom d-flex align-items-center justify-content-between py-3">
            <div className="d-flex align-items-center gap-2">
              <i className="bi bi-patch-check-fill text-warning fs-5"></i>
              <h6 className="fw-bold mb-0">Centre d'Approbations Exécutives</h6>
              {validationsCount > 0 && (
                <span className="badge bg-warning text-dark">{validationsCount}</span>
              )}
            </div>
            <span className="small text-muted">Devis &amp; Budgets Chantiers</span>
          </div>
          <div className="card-body p-0">
            {validationsLoading ? (
              <div className="text-center py-4 text-muted">
                <div className="spinner-border spinner-border-sm me-2"></div>
                Chargement des validations…
              </div>
            ) : validations.length === 0 ? (
              <div className="text-center py-5 text-muted">
                <i className="bi bi-check2-circle fs-2 d-block mb-2 text-success"></i>
                <strong>Aucune validation en attente</strong>
                <div className="small">Toutes les soumissions ont été traitées.</div>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th className="ps-3">Référence</th>
                      <th>Type</th>
                      <th>Chantier</th>
                      <th>Montant</th>
                      <th>Soumis par</th>
                      <th>Date</th>
                      <th className="text-center">Décision</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validations.map((v) => (
                      <tr key={v.id}>
                        <td className="ps-3">
                          <span className="fw-semibold text-primary">{v.reference}</span>
                        </td>
                        <td>
                          <span className={`badge ${v.type === "devis" ? "bg-primary bg-opacity-10 text-primary" : "bg-info bg-opacity-10 text-info"} border`}>
                            <i className={`bi ${v.type === "devis" ? "bi-file-earmark-text" : "bi-calculator"} me-1`}></i>
                            {v.type === "devis" ? "Devis Client" : "Budget Chantier"}
                          </span>
                        </td>
                        <td>
                          <span className="small fw-semibold">{v.chantier}</span>
                        </td>
                        <td>
                          <span className="fw-bold text-dark">
                            {v.montant.toLocaleString()} MGA
                          </span>
                        </td>
                        <td>
                          <span className="small text-muted">{v.soumis_par}</span>
                        </td>
                        <td>
                          <span className="small text-muted">{v.date_soumission}</span>
                        </td>
                        <td className="text-center">
                          <div className="d-flex gap-1 justify-content-center">
                            <button
                              className="btn btn-success btn-sm fw-semibold"
                              disabled={approvingId === v.id}
                              onClick={() => handleApprove(v.id)}
                              title="Approuver"
                            >
                              {approvingId === v.id ? (
                                <span className="spinner-border spinner-border-sm"></span>
                              ) : (
                                <><i className="bi bi-check-lg me-1"></i>Approuver</>
                              )}
                            </button>
                            <button
                              className="btn btn-outline-danger btn-sm"
                              disabled={approvingId === v.id}
                              onClick={() => handleReject(v.id)}
                              title="Refuser"
                            >
                              <i className="bi bi-x-lg"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* === AVANCEMENT PHYSIQUE vs FINANCIER === */}
        <div className="row g-4 mb-4">
          <div className="col-lg-8">
            <div className="chart-card">
              <CaVsDepensesChart
                labels={charts?.ca_evolution?.labels}
                ca={charts?.ca_evolution?.ca}
                depenses={charts?.ca_evolution?.depenses}
              />
            </div>
          </div>
          <div className="col-lg-4">
            <div className="chart-card h-100">
              <MultiChantiersProgressChart
                labels={charts?.top_chantiers?.labels}
                avancement={charts?.top_chantiers?.avancement}
                consommation={charts?.top_chantiers?.budget}
              />
            </div>
          </div>
        </div>

        {/* === SYNTHESE RISQUES & DERIVES === */}
        <div className="row g-4 mb-4">
          {/* Dérives Budgétaires */}
          <div className="col-lg-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white border-bottom py-3 d-flex align-items-center gap-2">
                <i className="bi bi-graph-up-arrow text-danger"></i>
                <h6 className="fw-bold mb-0">Dérives Budgétaires Chantiers</h6>
              </div>
              <div className="card-body p-0">
                {budgetDerive.length === 0 ? (
                  <div className="text-center py-4 text-muted small">
                    <i className="bi bi-shield-check fs-3 d-block mb-2 text-success"></i>
                    Aucune dérive détectée
                  </div>
                ) : (
                  <div className="list-group list-group-flush">
                    {budgetDerive.map((b, i) => (
                      <div key={i} className="list-group-item d-flex align-items-center gap-3 py-3">
                        <div className="flex-grow-1">
                          <div className="fw-semibold small">{b.chantier}</div>
                          <div className="progress mt-1" style={{ height: 6 }}>
                            <div
                              className={`progress-bar ${b.pct > 100 ? "bg-danger" : b.pct > 85 ? "bg-warning" : "bg-success"}`}
                              style={{ width: `${Math.min(b.pct, 100)}%` }}
                            ></div>
                          </div>
                          <div className="d-flex justify-content-between mt-1">
                            <span className="x-small text-muted">
                              {b.consomme.toLocaleString()} / {b.budget_initial.toLocaleString()} MGA
                            </span>
                            <span className={`x-small fw-bold ${b.pct > 100 ? "text-danger" : b.pct > 85 ? "text-warning" : "text-success"}`}>
                              {b.pct.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                        {b.pct > 100 && (
                          <i className="bi bi-exclamation-triangle-fill text-danger" title="Dépassement budgétaire"></i>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Risques Opérationnels */}
          <div className="col-lg-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white border-bottom py-3 d-flex align-items-center gap-2">
                <i className="bi bi-shield-exclamation text-warning"></i>
                <h6 className="fw-bold mb-0">Risques Opérationnels Actifs</h6>
              </div>
              <div className="card-body p-0">
                {risques.length === 0 ? (
                  <div className="text-center py-4 text-muted small">
                    <i className="bi bi-check-circle fs-3 d-block mb-2 text-success"></i>
                    Aucun risque majeur signalé
                  </div>
                ) : (
                  <div className="list-group list-group-flush">
                    {risques.map((r, i) => {
                      const color = r.niveau === "critique"
                        ? "danger"
                        : r.niveau === "élevé"
                        ? "warning"
                        : "info";
                      return (
                        <div key={i} className="list-group-item py-3">
                          <div className="d-flex align-items-start gap-2">
                            <span className={`badge bg-${color} bg-opacity-10 text-${color} border`}>
                              {r.niveau.toUpperCase()}
                            </span>
                            <div>
                              <div className="fw-semibold small">{r.chantier}</div>
                              <div className="small text-muted">{r.description}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* === ACTIONS RAPIDES DG === */}
        <div className="card border-0 shadow-sm p-4 mb-4">
          <h6 className="fw-bold mb-3 text-secondary">
            <i className="bi bi-lightning-fill me-2"></i>Actions Stratégiques
          </h6>
          <div className="d-flex gap-2 flex-wrap">
            <button
              className="btn btn-outline-primary fw-semibold"
              onClick={() => navigate("/chantiers")}
            >
              <i className="bi bi-buildings me-2"></i>Tableau Multi-Chantiers
            </button>
            <button
              className="btn btn-outline-success fw-semibold"
              onClick={() => navigate("/finance")}
            >
              <i className="bi bi-bar-chart-line me-2"></i>Rapport Financier Global
            </button>
            <button
              className="btn btn-outline-secondary fw-semibold"
              onClick={() => navigate("/rh")}
            >
              <i className="bi bi-people me-2"></i>Effectifs &amp; Présences
            </button>
            <button
              className="btn btn-outline-warning fw-semibold"
              onClick={() => navigate("/materiel")}
            >
              <i className="bi bi-truck me-2"></i>Parc Engins &amp; Matériel
            </button>
          </div>
        </div>
      </div>
    );
  };


  // 4. COMPTABLE / RESPONSABLE FINANCIER DASHBOARD
  const renderComptable = () => {
    const caTotal = stats?.ca_total || 0;
    const depensesMois = stats?.depenses_mois || 0;
    const depassements = stats?.depassements_budgetaires || 0;
    const facturesRetard = stats?.factures_en_retard || 0;

    return (
      <div>
        {renderAlert()}
        <div className="row g-3 mb-4">
          {renderKpi(
            "Chiffre d'Affaires",
            `${caTotal.toLocaleString()} MGA`,
            "Consolidé entreprise",
            "text-primary",
          )}
          {renderKpi(
            "Dépenses du Mois",
            `${depensesMois.toLocaleString()} MGA`,
            "Matériaux, main d'oeuvre, engins",
            "text-danger",
          )}
          {renderKpi(
            "Factures Clients en Retard",
            String(facturesRetard),
            "À relancer rapidement",
            "text-warning",
          )}
          {renderKpi(
            "Dépassements Budgétaires",
            String(depassements),
            "Chantiers en surcoût",
            "text-danger",
          )}
        </div>
        <div className="row g-4 mb-4">
          <div className="col-lg-12">
            <div className="chart-card">
              <DepensesParPosteChart
                labels={charts?.depenses_par_poste?.labels}
                data={charts?.depenses_par_poste?.data}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 5. CHEF DE PROJET / DIRECTEUR TECHNIQUE DASHBOARD
  const renderChefProjet = () => {
    const avancement = stats?.taux_avancement_physique ?? 0;
    return (
      <div>
        {renderAlert()}
        <div className="row g-3 mb-4">
          {renderKpi(
            "Chantiers sous Supervision",
            String(stats?.nb_chantiers_actifs ?? 0),
            "Dans votre périmètre",
            "text-primary",
          )}
          {renderKpi(
            "Conflits d'Affectation",
            String(stats?.depassements_budgetaires ?? 0),
            "Ressources / engins en double",
            "text-success",
          )}
          {renderKpi(
            "Avancement Moyen",
            `${avancement.toFixed(1)}%`,
            "Physique vs prévu",
            "text-info",
          )}
          {renderKpi(
            "Chantiers en Retard",
            String(stats?.nb_incidents ?? 0),
            "Nécessitant un arbitrage",
            "text-warning",
          )}
        </div>
        <div className="row g-4 mb-4">
          <div className="col-lg-12">
            <div className="chart-card">
              <MultiChantiersProgressChart
                labels={charts?.top_chantiers?.labels}
                avancement={charts?.top_chantiers?.avancement}
                consommation={charts?.top_chantiers?.budget}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 6. CHEF DE CHANTIER DASHBOARD
  const renderChefChantier = () => {
    const avancementPhysique = stats?.taux_avancement_physique ?? 0;
    const nbIncidents = stats?.incidents_non_resolus ?? 0;
    const chantierPrincipal = stats?.rentabilite_chantiers?.[0]?.nom ?? "-";
    const nbEmployes = stats?.nb_employes ?? 0;
    const presencePct = stats?.attendance_rate ?? 0;
    const consommation = stats?.consommation_stock ?? 0;
    const ecart = stats?.ecart_stock ?? 0;
    const retardJours = stats?.retard_jours ?? 0;

    return (
      <div>
        {renderAlert()}
        <div className="alert-bar mb-4 bg-secondary bg-opacity-10 text-dark border-0 d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div>
            <strong>Mon Chantier : {chantierPrincipal}</strong>
            <div className="small mb-0">
              Avancement physique: {avancementPhysique.toFixed(1)}% - Retard: +
              {retardJours.toFixed(1)} jour(s)
            </div>
          </div>
          <div className="d-flex gap-2">
            <button
              className="btn btn-outline-secondary fw-bold"
              onClick={() => setShowScannerModal(true)}
            >
              <i className="bi bi-qr-code-scan me-2"></i>Scanner Badges Ouvriers
            </button>
            <button
              className="btn btn-outline-secondary fw-bold"
              onClick={handleAutoPointageGps}
              disabled={gpsState === "locating" || gpsState === "sending"}
            >
              <i className="bi bi-geo-alt-fill me-2"></i>
              {gpsState === "locating" ? "Localisation…" : gpsState === "sending" ? "Enregistrement…" : "Mon Auto-Pointage GPS"}
            </button>
          </div>
        </div>
        {gpsMessage && (
          <div
            role="status"
            className={`alert-bar mb-4 border-0 small fw-semibold ${gpsState === "error" ? "bg-danger bg-opacity-10 text-danger" : "bg-success bg-opacity-10 text-success"}`}
          >
            <i className={`bi me-2 ${gpsState === "error" ? "bi-exclamation-triangle" : "bi-check-circle"}`}></i>
            {gpsMessage}
          </div>
        )}

        <div className="row g-3 mb-4">
          {renderKpi(
            "Avancement Physique",
            `${avancementPhysique.toFixed(1)}%`,
            "Phase actuelle",
            "text-primary",
          )}
          {renderKpi(
            "Présence Équipe",
            `${presencePct.toFixed(1)}%`,
            `${nbEmployes} employés au total`,
            "text-success",
          )}
          {renderKpi(
            "Incidents Terrain",
            String(nbIncidents),
            "Incident sécurité à traiter",
            "text-warning",
          )}
          {renderKpi(
            "Consommation Stock",
            `${consommation.toLocaleString()}`,
            `Écart prévu: ${ecart.toLocaleString()}`,
            "text-info",
          )}
        </div>

        <div className="row g-4 mb-4">
          <div className="col-lg-12">
            <div className="chart-card">
              <EquipePresenceDailyChart
                labels={charts?.presence_hebdo?.labels}
                data={charts?.presence_hebdo?.data}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 7. RESPONSABLE RH DASHBOARD
  const renderRH = () => (
    <div>
      {renderAlert()}
      <div className="row g-3 mb-4">
        {renderKpi(
          "Effectif Total",
          String(stats?.nb_employes ?? 0),
          "Employés enregistrés",
          "text-primary",
        )}
        {renderKpi(
          "Taux de Présence Global",
          `${(stats?.attendance_rate ?? 0).toFixed(1)}%`,
          "Présence quotidienne moyenne",
          "text-success",
        )}
        {renderKpi(
          "Heures Supp. à Valider",
          "0",
          "En attente d'approbation",
          "text-warning",
        )}
        {renderKpi(
          "Habilitations Expirantes",
          "0",
          "Renouvellement sécurité 30j",
          "text-danger",
        )}
      </div>
      <div className="row g-4 mb-4">
        <div className="col-lg-12">
          <div className="chart-card">
            <RhEquipesDistributionChart
              labels={charts?.effectif_par_poste?.labels}
              data={charts?.effectif_par_poste?.data}
            />
          </div>
        </div>
      </div>
    </div>
  );

  // 8. RESPONSABLE MATERIEL DASHBOARD
  const renderMateriel = () => (
    <div>
      {renderAlert()}
      <div className="row g-3 mb-4">
        {renderKpi(
          "Parc d'Engins Total",
          String(stats?.nb_materiels ?? 0),
          "Machines & véhicules",
          "text-primary",
        )}
        {renderKpi(
          "Engins Disponibles",
          String(stats?.nb_materiels ?? 0),
          "Prêts pour affectation",
          "text-success",
        )}
        {renderKpi(
          "Engins Affectés",
          "0",
          "En service sur chantiers",
          "text-info",
        )}
        {renderKpi(
          "Maintenance due",
          String(stats?.maintenance_due ?? 0),
          "Vidanges & révisions 7j",
          "text-warning",
        )}
      </div>
      <div className="row g-4 mb-4">
        <div className="col-lg-12">
          <div className="chart-card">
            <ParcUsageRateChart
              labels={charts?.parc_utilisation?.labels}
              data={charts?.parc_utilisation?.data}
            />
          </div>
        </div>
      </div>
    </div>
  );

  // 9. MAGASINIER / STOCKS DASHBOARD
  const renderMagasinier = () => (
    <div>
      {renderAlert()}
      <div className="row g-3 mb-4">
        {renderKpi(
          "Références en Stock",
          String(stats?.nb_articles ?? 0),
          "Articles référencés au dépôt",
          "text-primary",
        )}
        {renderKpi(
          "Alertes Stock Minimum",
          String(stats?.stocks_alerte ?? 0),
          "Réapprovisionnement requis",
          "text-warning",
        )}
        {renderKpi(
          "Mouvements 24h",
          "0",
          "Bons de sortie & réceptions",
          "text-success",
        )}
        {renderKpi(
          "Ruptures de Stock",
          "0",
          "Aucune rupture sur chantier",
          "text-success",
        )}
      </div>
      <div className="row g-4 mb-4">
        <div className="col-lg-12">
          <div className="chart-card">
            <StockCategoryDistributionChart
              labels={charts?.stock_par_categorie?.labels}
              data={charts?.stock_par_categorie?.data}
            />
          </div>
        </div>
      </div>
    </div>
  );

  // 10. RESPONSABLE COMMERCIAL DASHBOARD
  const renderCommercial = () => {
    const pipelineTotal = (charts?.pipeline_commercial?.data ?? []).reduce(
      (a: number, b: number) => a + b,
      0,
    );
    const tauxConv = stats?.nb_devis
      ? Math.min(
          100,
          ((stats.nb_devis - (stats?.devis_pending_dg ?? 0)) / stats.nb_devis) *
            100,
        ).toFixed(1)
      : "0.0";
    return (
      <div>
        {renderAlert()}
        <div className="row g-3 mb-4">
          {renderKpi(
            "Portefeuille Clients",
            String(stats?.nb_clients ?? 0),
            "Comptes clients BTP",
            "text-primary",
          )}
          {renderKpi(
            "Devis en Cours",
            String(stats?.devis_pending_dg ?? 0),
            "À relancer / négocier",
            "text-warning",
          )}
          {renderKpi(
            "Taux de Conversion",
            `${tauxConv}%`,
            "Devis convertis en contrat",
            "text-success",
          )}
          {renderKpi(
            "Pipeline Commercial",
            `${pipelineTotal.toLocaleString()} MGA`,
            "Valeur totale négociations",
            "text-primary",
          )}
        </div>
        <div className="row g-4 mb-4">
          <div className="col-lg-12">
            <div className="chart-card">
              <SalesPipelineChart
                labels={charts?.pipeline_commercial?.labels}
                data={charts?.pipeline_commercial?.data}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 11. OUVRIER / EMPLOYE TERRAIN DASHBOARD
  const renderEmploye = () => {
    const taches: {
      id: number;
      nom: string;
      chantier: string;
      statut: string;
    }[] = [];
    const tauxPresence = stats?.attendance_rate ?? 0;
    return (
      <div>
        {renderAlert()}
        <div className="row g-3 mb-4">
          {renderKpi(
            "Mes Tâches",
            String(taches.length),
            "Assignées aujourd'hui",
            "text-primary",
          )}
          {renderKpi(
            "Taux de Réalisation",
            "0%",
            "Tâches terminées dans les délais",
            "text-success",
          )}
          {renderKpi(
            "Mes Heures Supp.",
            "0h",
            "Validées cette semaine",
            "text-warning",
          )}
          {renderKpi(
            "Mon Taux Présence",
            `${tauxPresence.toFixed(1)}%`,
            "Assiduité ce mois",
            "text-success",
          )}
        </div>

        <div className="card border-0 shadow-sm p-4 mb-4 bg-gradient text-white">
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
            <div>
              <h5 className="fw-bold mb-1">
                <i className="bi bi-qr-code-scan me-2 text-info"></i>Mon Badge
                Officiel de Pointage
              </h5>
              <p className="text-secondary small mb-0">
                Présentez ce QR Code au Chef de Chantier lors de votre arrivée /
                départ.
              </p>
            </div>
            <button
              className="btn btn-info font-semibold fw-bold rounded-pill px-4"
              onClick={() => setShowBadgeModal(true)}
            >
              <i className="bi bi-qr-code me-2"></i>Afficher Mon Badge QR
            </button>
          </div>
        </div>

        <div className="row g-4 mb-4">
          <div className="col-lg-8">
            <div className="card border-0 shadow-sm p-4">
              <h5 className="fw-bold mb-3">
                <i className="bi bi-list-check me-2 text-primary"></i>Mes Tâches
                Assignées
              </h5>
              {taches.length === 0 ? (
                <p className="text-muted mb-0 fst-italic">
                  Aucune tâche assignée pour aujourd'hui.
                </p>
              ) : (
                <div className="list-group list-group-flush">
                  {taches.map((t) => (
                    <div
                      key={t.id}
                      className="list-group-item px-0 py-3 d-flex justify-content-between align-items-center"
                    >
                      <div>
                        <h6 className="mb-1 fw-bold">{t.nom}</h6>
                        <small className="text-muted">{t.chantier}</small>
                      </div>
                      <span
                        className={`badge ${t.statut === "En cours" ? "bg-warning bg-opacity-10 text-dark border" : "bg-secondary bg-opacity-10 text-dark border"}`}
                      >
                        {t.statut}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="col-lg-4">
            <div className="chart-card">
              <WorkerPersonalAttendanceChart />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (statsLoading || chartsLoading) {
      return (
        <div className="d-flex justify-content-center align-items-center py-5">
          <div className="spinner-border text-secondary" role="status"></div>
        </div>
      )
    }

    switch (roleCode) {
      case "super_admin":
        return renderSuperAdmin()
      case "admin_entreprise":
        return renderAdminEntreprise()
      case "directeur":
        return renderDirecteur()
      case "comptable":
        return renderComptable()
      case "chef_chantier":
        return renderChefChantier()
      case "chef_projet":
        return renderChefProjet()
      case "rh":
        return renderRH()
      case "materiel":
        return renderMateriel()
      case "magasinier":
        return renderMagasinier()
      case "commercial":
        return renderCommercial()
      case "employe":
        return renderEmploye()
      default:
        return renderEmploye()
    }
  };

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h2 className="mb-1 fw-bold text-secondary">
            <i className="bi bi-speedometer2 me-2"></i>
            {dashboardTitle}
          </h2>
          <p className="text-secondary mb-0">
            Bienvenue,{" "}
            <strong>
              {user?.prenom} {user?.nom}
            </strong>{" "}
            - {meta.greeting}
          </p>
        </div>
        <div className="d-flex align-items-center gap-2">
          <RoleBadge roleCode={roleCode} />
          <button
            className="btn btn-outline-secondary btn-sm"
            onClick={() => window.location.reload()}
          >
            <i className="bi bi-arrow-clockwise me-1"></i> Actualiser
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-secondary" role="status"></div>
        </div>
      ) : (
        renderContent()
      )}

      {/* Modal Scanner QR Code pour Chef de Chantier */}
      <QRScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        onPointageSuccess={() => alert("Pointage enregistré avec succès !")}
      />

      {/* Modal Badge QR Code pour l'Employé */}
      {showBadgeModal && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: "var(--overlay-strong)" }}
          tabIndex={-1}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 bg-transparent shadow-none">
              <div className="d-flex justify-content-end mb-2">
                <button
                  type="button"
                  className="btn-close btn-close-white fs-4"
                  onClick={() => setShowBadgeModal(false)}
                ></button>
              </div>
              <WorkerBadgeCard
                employe={{
                  id: user?.id ?? 0,
                  nom: user?.nom ?? "",
                  prenom: user?.prenom ?? "",
                  poste: "-",
                  code_qr_badge: `TIA-EMP-${user?.id ?? 0}-OFFICIEL`,
                  type_contrat: undefined,
                  matricule: `EMP-${user?.id ?? 0}`,
                }}
                onPrint={() => window.print()}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
