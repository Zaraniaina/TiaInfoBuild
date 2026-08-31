import { useEffect, useState } from "react";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/auth.store";

type UserRole =
  | "admin_entreprise"
  | "directeur"
  | "comptable"
  | "chef_chantier"
  | "chef_projet"
  | "rh"
  | "materiel"
  | "magasinier"
  | "commercial"
  | "employe"
  | "client";

interface UserRow {
  id: number;
  prenom: string;
  nom: string;
  email: string;
  role_code: UserRole;
  role_nom?: string;
  statut: "actif" | "inactif";
  telephone?: string;
  date_creation?: string;
  derniere_connexion?: string;
}

interface EntrepriseSettings {
  nom?: string;
  nom_commercial?: string;
  siret?: string;
  telephone?: string;
  email?: string;
  adresse?: string;
  ville?: string;
  code_postal?: string;
  devise?: string;
  tva_defaut?: number;
  delai_paiement_defaut?: number;
  prefixe_devis?: string;
  prefixe_facture?: string;
  prefixe_contrat?: string;
}

interface RoleOption {
  id: number;
  code: string;
  nom: string;
}

interface UtilisateurListItem {
  id: number;
  nom: string;
  prenom?: string;
  email: string;
  role_code?: string;
  role?: { code?: string; nom?: string };
  role_nom?: string;
  statut?: string;
  telephone?: string;
  date_creation?: string;
  derniere_connexion?: string;
}

interface AlerteLog {
  id: number;
  utilisateur_id?: number;
  ip_address?: string;
  user_agent?: string;
  reussi?: boolean;
  date_connexion?: string;
}

export function SettingsPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<
    "utilisateurs" | "parametres" | "audit" | "profil"
  >("utilisateurs");
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [search, setSearch] = useState("");
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [userForm, setUserForm] = useState({
    prenom: "",
    nom: "",
    email: "",
    role_code: "employe" as UserRole,
    password: "",
    telephone: "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [logs, setLogs] = useState<AlerteLog[]>([]);

  const [entrepriseForm, setEntrepriseForm] = useState({
    nom: "",
    nom_commercial: "",
    siret: "",
    telephone: "",
    email: "",
    adresse: "",
    ville: "",
    code_postal: "",
    devise: "MGA",
    tva_defaut: 20,
    delai_paiement_jours: 30,
    prefixe_devis: "DEV",
    prefixe_facture: "FAC",
    prefixe_contrat: "CTR",
  });
  const [entrepriseLoaded, setEntrepriseLoaded] = useState(false);

  const [profilForm, setProfilForm] = useState({
    nom: user?.nom || "",
    prenom: user?.prenom || "",
    email: user?.email || "",
    password_actuel: "",
    nouveau_password: "",
  });

  const loadEntrepriseSettings = () => {
    api
      .get("/parametres/entreprise")
      .then((res) => {
        const data = res.data as
          { entreprise?: EntrepriseSettings } | EntrepriseSettings;
        const e: EntrepriseSettings =
          (data &&
            typeof data === "object" &&
            "entreprise" in data &&
            data.entreprise) ||
          (data as EntrepriseSettings) ||
          {};
        setEntrepriseForm({
          nom: e.nom || "",
          nom_commercial: e.nom_commercial || "",
          siret: e.siret || "",
          telephone: e.telephone || "",
          email: e.email || "",
          adresse: e.adresse || "",
          ville: e.ville || "",
          code_postal: e.code_postal || "",
          devise: e.devise || "MGA",
          tva_defaut: e.tva_defaut ?? 20,
          delai_paiement_jours: e.delai_paiement_defaut ?? 30,
          prefixe_devis: e.prefixe_devis || "DEV",
          prefixe_facture: e.prefixe_facture || "FAC",
          prefixe_contrat: e.prefixe_contrat || "CTR",
        });
        setEntrepriseLoaded(true);
      })
      .catch(() => setEntrepriseLoaded(true));
  };

  const loadRoles = () => {
    api
      .get("/parametres/roles")
      .then((res) => {
        const items = res.data.items || res.data || [];
        const filtered = items
          .map((r: RoleOption) => ({ id: r.id, code: r.code, nom: r.nom }))
          .filter((r: RoleOption) => r.code !== "super_admin");
        setRoles(filtered);
      })
      // Pas de données factices : on n'affiche que les rôles réellement retournés par le backend.
      .catch(() => setRoles([]));
  };

  const loadUsers = () => {
    api
      .get("/utilisateurs?size=100")
      .then((res) => {
        const items = res.data.items || res.data || [];
        setUsers(
          items.map((u: UtilisateurListItem) => ({
            id: u.id,
            prenom: u.prenom || "",
            nom: u.nom || "",
            email: u.email || "",
            role_code: u.role_code || u.role?.code || "employe",
            role_nom: u.role?.nom || u.role_nom || "Employé",
            statut: u.statut === "inactif" ? "inactif" : "actif",
            telephone: u.telephone || "",
            date_creation: u.date_creation,
            derniere_connexion: u.derniere_connexion,
          })),
        );
      })
      // Pas de données factices : on n'affiche que les utilisateurs réellement retournés par le backend.
      .catch(() => setUsers([]));
  };

  const loadLogs = () => {
    api
      .get("/parametres/audit-logs?size=50")
      .then((res) => setLogs(res.data.items || res.data || []))
      .catch(() => setLogs([]));
  };

  useEffect(() => {
    loadEntrepriseSettings();
    loadRoles();
  }, []);

  useEffect(() => {
    if (activeTab === "utilisateurs") loadUsers();
    if (activeTab === "audit") loadLogs();
  }, [activeTab]);

  const handleSaveEntreprise = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...entrepriseForm,
        delai_paiement_defaut: entrepriseForm.delai_paiement_jours,
      };
      await api.put("/parametres/entreprise", payload);
      alert("Paramètres d'entreprise sauvegardés avec succès !");
    } catch {
      alert("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProfil = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put("/parametres/profile", profilForm);
      alert("Profil utilisateur mis à jour !");
    } catch {
      alert("Erreur lors de la mise à jour");
    } finally {
      setSaving(false);
    }
  };

  const openCreateUser = () => {
    setEditingUser(null);
    setUserForm({
      prenom: "",
      nom: "",
      email: "",
      role_code: "employe",
      password: "",
      telephone: "",
    });
    setFormError(null);
    setShowUserModal(true);
  };

  const openEditUser = (u: UserRow) => {
    setEditingUser(u);
    setUserForm({
      prenom: u.prenom,
      nom: u.nom,
      email: u.email,
      role_code: u.role_code,
      password: "",
      telephone: u.telephone || "",
    });
    setFormError(null);
    setShowUserModal(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (userForm.role_code === "admin_entreprise" && adminLimitReached) {
      setFormError(
        "Limite atteinte : maximum 2 administrateurs par entreprise.",
      );
      return;
    }
    setSaving(true);
    try {
      // Création : le mot de passe est obligatoire et doit respecter la politique du backend
      // (8 caractères + majuscule, minuscule, chiffre et caractère spécial) pour éviter un 422.
      if (!editingUser) {
        const pw = userForm.password || "";
        const pwErrors: string[] = [];
        if (pw.length < 8) pwErrors.push("au moins 8 caractères");
        if (!/[A-Z]/.test(pw)) pwErrors.push("une majuscule");
        if (!/[a-z]/.test(pw)) pwErrors.push("une minuscule");
        if (!/[0-9]/.test(pw)) pwErrors.push("un chiffre");
        if (!/[^A-Za-z0-9]/.test(pw)) pwErrors.push("un caractère spécial");
        if (pwErrors.length > 0) {
          setFormError(
            `Mot de passe invalide : il doit contenir ${pwErrors.join(", ")}.`,
          );
          setSaving(false);
          return;
        }
      }

      const payload: Record<string, unknown> = { ...userForm };
      if (editingUser) {
        delete payload.password;
        if (!payload.telephone) delete payload.telephone;
      }
      let response: { data: { id?: number } } | undefined;
      if (editingUser) {
        await api.put(`/utilisateurs/${editingUser.id}`, payload);
      } else {
        response = await api.post("/utilisateurs", payload);
      }
      setShowUserModal(false);
      loadUsers();
      if (!editingUser && response?.data?.id) {
        const newId = response.data.id;
        const tempPassword = userForm.password;
        api
          .get(`/utilisateurs/${newId}/bon-de-creation?temp_password=${encodeURIComponent(tempPassword)}`, {
            responseType: "blob",
          })
          .then((r) => {
            const blob = new Blob([r.data], { type: "application/pdf" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `bon-creation-${newId}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
          })
          .catch(() =>
            alert(
              "Compte créé, mais le bon de création PDF n'a pas pu être généré.",
            ),
          );
      }
    } catch (error: unknown) {
      let message = "Erreur lors de l'enregistrement de l'utilisateur";
      const err = error as {
        response?: { data?: { detail?: unknown } };
        message?: string;
      };
      const detail = err?.response?.data?.detail;
      if (detail) {
        if (Array.isArray(detail)) {
          message = detail
            .map((e: { msg?: string }) => e.msg || String(e))
            .join(", ");
        } else {
          message = String(detail);
        }
      } else if (err.message) {
        message = err.message;
      }
      setFormError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleUser = async (u: UserRow) => {
    try {
      await api.post(`/utilisateurs/${u.id}/toggle-actif`);
      setUsers((prev) =>
        prev.map((x) =>
          x.id === u.id
            ? { ...x, statut: x.statut === "actif" ? "inactif" : "actif" }
            : x,
        ),
      );
    } catch {
      alert("Erreur lors du changement de statut");
    }
  };

  const adminCount = users.filter(
    (u) => u.role_code === "admin_entreprise" && u.statut === "actif",
  ).length;
  const adminLimitReached = adminCount >= 2;

  const filteredUsers = users.filter(
    (u) =>
      `${u.prenom} ${u.nom}`.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
  );

  const getRoleBadge = (role: string) => {
    const map: Record<string, string> = {
      super_admin: "bg-danger",
      admin_entreprise: "bg-primary",
      directeur: "bg-success",
      comptable: "bg-info",
      chef_chantier: "bg-warning text-dark",
      chef_projet: "bg-dark",
      rh: "bg-purple text-white",
      materiel: "bg-secondary",
      magasinier: "bg-secondary",
      commercial: "bg-success",
      employe: "bg-light text-dark border",
      client: "bg-light text-dark border",
    };
    return map[role] || "bg-secondary";
  };

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h2 className="mb-1 fw-bold">
            <i className="bi bi-gear me-2 text-primary"></i>Administration &
            Paramètres
          </h2>
          <p className="text-secondary mb-0">
            Gestion des comptes, rôles, paramètres entreprise et audit de
            sécurité
          </p>
        </div>
      </div>

      <ul className="nav nav-pills mb-4 p-2 rounded shadow-sm">
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === "utilisateurs" ? "active" : ""}`}
            onClick={() => setActiveTab("utilisateurs")}
          >
            <i className="bi bi-people me-2"></i>Utilisateurs & Rôles
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === "parametres" ? "active" : ""}`}
            onClick={() => setActiveTab("parametres")}
          >
            <i className="bi bi-building me-2"></i>Paramètres Entreprise
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === "audit" ? "active" : ""}`}
            onClick={() => setActiveTab("audit")}
          >
            <i className="bi bi-shield-check me-2"></i>Audit & Logs
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === "profil" ? "active" : ""}`}
            onClick={() => setActiveTab("profil")}
          >
            <i className="bi bi-person me-2"></i>Mon Profil
          </button>
        </li>
      </ul>

      {activeTab === "utilisateurs" && (
        <div className="table-card">
          <div className="table-header">
            <div className="input-group" style={{ maxWidth: "400px" }}>
              <span className="input-group-text bg-light border-end-0">
                <i className="bi bi-search"></i>
              </span>
              <input
                type="text"
                className="form-control border-start-0 bg-light"
                placeholder="Rechercher un utilisateur..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              className="btn btn-primary fw-bold"
              onClick={openCreateUser}
            >
              <i className="bi bi-person-plus me-2"></i>Nouvel Utilisateur
            </button>
          </div>
          <div className="table-responsive">
            <table className="table mb-0">
              <thead>
                <tr>
                  <th>Utilisateur</th>
                  <th>Email</th>
                  <th>Rôle</th>
                  <th>Statut</th>
                  <th className="d-none d-md-table-cell">Téléphone</th>
                  <th>Dernière connexion</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id}>
                    <td className="fw-semibold">
                      {u.prenom} {u.nom}
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`badge ${getRoleBadge(u.role_code)}`}>
                        {u.role_nom || u.role_code}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${u.statut === "actif" ? "bg-success" : "bg-secondary"}`}
                      >
                        {u.statut === "actif" ? "Actif" : "Inactif"}
                      </span>
                    </td>
                    <td className="d-none d-md-table-cell text-muted">
                      {u.telephone || "—"}
                    </td>
                    <td className="text-muted">
                      {u.derniere_connexion || "—"}
                    </td>
                    <td className="text-end">
                      <div className="d-flex gap-1 justify-content-end">
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => openEditUser(u)}
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button
                          className={`btn btn-sm ${u.statut === "actif" ? "btn-outline-danger" : "btn-outline-success"}`}
                          onClick={() => handleToggleUser(u)}
                        >
                          {u.statut === "actif" ? (
                            <i className="bi bi-x-circle"></i>
                          ) : (
                            <i className="bi bi-check-circle"></i>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-4 text-muted">
                      Aucun utilisateur trouvé.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "parametres" &&
        (entrepriseLoaded ? (
          <form onSubmit={handleSaveEntreprise}>
            <div className="row g-3 mb-4">
              <div className="col-md-6">
                <label className="form-label fw-semibold">
                  Raison Sociale *
                </label>
                <input
                  type="text"
                  className="form-control"
                  required
                  value={entrepriseForm.nom}
                  onChange={(e) =>
                    setEntrepriseForm({
                      ...entrepriseForm,
                      nom: e.target.value,
                    })
                  }
                />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold">Nom Commercial</label>
                <input
                  type="text"
                  className="form-control"
                  value={entrepriseForm.nom_commercial}
                  onChange={(e) =>
                    setEntrepriseForm({
                      ...entrepriseForm,
                      nom_commercial: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div className="row g-3 mb-4">
              <div className="col-md-6">
                <label className="form-label fw-semibold">SIRET / NIF</label>
                <input
                  type="text"
                  className="form-control font-monospace"
                  value={entrepriseForm.siret}
                  onChange={(e) =>
                    setEntrepriseForm({
                      ...entrepriseForm,
                      siret: e.target.value,
                    })
                  }
                />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold">Email Contact</label>
                <input
                  type="email"
                  className="form-control"
                  value={entrepriseForm.email}
                  onChange={(e) =>
                    setEntrepriseForm({
                      ...entrepriseForm,
                      email: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div className="row g-3 mb-4">
              <div className="col-md-6">
                <label className="form-label fw-semibold">Téléphone</label>
                <input
                  type="text"
                  className="form-control"
                  value={entrepriseForm.telephone}
                  onChange={(e) =>
                    setEntrepriseForm({
                      ...entrepriseForm,
                      telephone: e.target.value,
                    })
                  }
                />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold">Ville</label>
                <input
                  type="text"
                  className="form-control"
                  value={entrepriseForm.ville}
                  onChange={(e) =>
                    setEntrepriseForm({
                      ...entrepriseForm,
                      ville: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div className="row g-3 mb-4">
              <div className="col-md-8">
                <label className="form-label fw-semibold">Adresse</label>
                <input
                  type="text"
                  className="form-control"
                  value={entrepriseForm.adresse}
                  onChange={(e) =>
                    setEntrepriseForm({
                      ...entrepriseForm,
                      adresse: e.target.value,
                    })
                  }
                />
              </div>
              <div className="col-md-4">
                <label className="form-label fw-semibold">Code Postal</label>
                <input
                  type="text"
                  className="form-control"
                  value={entrepriseForm.code_postal}
                  onChange={(e) =>
                    setEntrepriseForm({
                      ...entrepriseForm,
                      code_postal: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <h5 className="fw-bold mb-3 border-bottom pb-2">
              Paramètres financiers & documents
            </h5>
            <div className="row g-3 mb-4">
              <div className="col-md-4">
                <label className="form-label fw-semibold">Devise</label>
                <select
                  className="form-select"
                  value={entrepriseForm.devise}
                  onChange={(e) =>
                    setEntrepriseForm({
                      ...entrepriseForm,
                      devise: e.target.value,
                    })
                  }
                >
                  <option value="MGA">MGA (Ariary)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label fw-semibold">
                  TVA par défaut (%)
                </label>
                <input
                  type="number"
                  className="form-control font-monospace"
                  value={entrepriseForm.tva_defaut}
                  onChange={(e) =>
                    setEntrepriseForm({
                      ...entrepriseForm,
                      tva_defaut: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="col-md-4">
                <label className="form-label fw-semibold">
                  Délai de paiement (jours)
                </label>
                <input
                  type="number"
                  className="form-control font-monospace"
                  value={entrepriseForm.delai_paiement_jours}
                  onChange={(e) =>
                    setEntrepriseForm({
                      ...entrepriseForm,
                      delai_paiement_jours: Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>

            <h5 className="fw-bold mb-3 border-bottom pb-2">Numérotation</h5>
            <div className="row g-3 mb-4">
              <div className="col-md-4">
                <label className="form-label fw-semibold">Préfixe Devis</label>
                <input
                  type="text"
                  className="form-control font-monospace"
                  value={entrepriseForm.prefixe_devis}
                  onChange={(e) =>
                    setEntrepriseForm({
                      ...entrepriseForm,
                      prefixe_devis: e.target.value,
                    })
                  }
                />
              </div>
              <div className="col-md-4">
                <label className="form-label fw-semibold">
                  Préfixe Facture
                </label>
                <input
                  type="text"
                  className="form-control font-monospace"
                  value={entrepriseForm.prefixe_facture}
                  onChange={(e) =>
                    setEntrepriseForm({
                      ...entrepriseForm,
                      prefixe_facture: e.target.value,
                    })
                  }
                />
              </div>
              <div className="col-md-4">
                <label className="form-label fw-semibold">
                  Préfixe Contrat
                </label>
                <input
                  type="text"
                  className="form-control font-monospace"
                  value={entrepriseForm.prefixe_contrat}
                  onChange={(e) =>
                    setEntrepriseForm({
                      ...entrepriseForm,
                      prefixe_contrat: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary fw-bold"
              disabled={saving}
            >
              {saving ? "Enregistrement..." : "Enregistrer les paramètres"}
            </button>
          </form>
        ) : (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status"></div>
          </div>
        ))}

      {activeTab === "audit" && (
        <div className="table-card">
          <div className="table-header">
            <h5 className="fw-bold mb-0">
              <i className="bi bi-shield-check me-2 text-primary"></i>Journal
              d'activité
            </h5>
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={loadLogs}
            >
              <i className="bi bi-arrow-clockwise me-1"></i>Actualiser
            </button>
          </div>
          <div className="table-responsive">
            <table className="table mb-0">
              <thead>
                <tr>
                  <th>Utilisateur</th>
                  <th>IP</th>
                  <th>Navigateur</th>
                  <th>Statut</th>
                  <th>Date & Heure</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td className="fw-semibold">
                      Utilisateur #{l.utilisateur_id}
                    </td>
                    <td className="font-monospace">
                      {l.ip_address || "127.0.0.1"}
                    </td>
                    <td className="small text-muted">{l.user_agent || "—"}</td>
                    <td>
                      <span
                        className={`badge ${l.reussi ? "bg-success" : "bg-danger"}`}
                      >
                        {l.reussi ? "Succès" : "Échec"}
                      </span>
                    </td>
                    <td className="text-muted font-monospace">
                      {l.date_connexion}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-4 text-muted">
                      Aucune entrée.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "profil" && (
        <form onSubmit={handleSaveProfil}>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label fw-semibold">Prénom</label>
              <input
                type="text"
                className="form-control"
                value={profilForm.prenom}
                onChange={(e) =>
                  setProfilForm({ ...profilForm, prenom: e.target.value })
                }
              />
            </div>
            <div className="col-md-6">
              <label className="form-label fw-semibold">Nom</label>
              <input
                type="text"
                className="form-control"
                value={profilForm.nom}
                onChange={(e) =>
                  setProfilForm({ ...profilForm, nom: e.target.value })
                }
              />
            </div>
            <div className="col-md-12">
              <label className="form-label fw-semibold">Email</label>
              <input
                type="email"
                className="form-control"
                value={profilForm.email}
                onChange={(e) =>
                  setProfilForm({ ...profilForm, email: e.target.value })
                }
              />
            </div>
          </div>
          <button
            type="submit"
            className="btn btn-primary fw-bold mt-4"
            disabled={saving}
          >
            Mettre à jour le profil
          </button>
        </form>
      )}

      {/* Modal Utilisateur */}
      {showUserModal && (
        <div
          className="modal fade show"
          style={{ display: "block" }}
          tabIndex={-1}
          aria-modal="true"
          role="dialog"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">
                  {editingUser
                    ? "Modifier l'utilisateur"
                    : "Nouvel utilisateur"}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowUserModal(false)}
                ></button>
              </div>
              <form onSubmit={handleSaveUser}>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Prénom</label>
                      <input
                        className="form-control"
                        required
                        value={userForm.prenom}
                        onChange={(e) =>
                          setUserForm({ ...userForm, prenom: e.target.value })
                        }
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Nom</label>
                      <input
                        className="form-control"
                        required
                        value={userForm.nom}
                        onChange={(e) =>
                          setUserForm({ ...userForm, nom: e.target.value })
                        }
                      />
                    </div>
                    <div className="col-md-12">
                      <label className="form-label fw-semibold">Email</label>
                      <input
                        type="email"
                        className="form-control"
                        required
                        value={userForm.email}
                        onChange={(e) =>
                          setUserForm({ ...userForm, email: e.target.value })
                        }
                      />
                    </div>
                    <div className="col-md-12">
                      <label className="form-label fw-semibold">
                        Téléphone
                      </label>
                      <input
                        className="form-control"
                        value={userForm.telephone}
                        onChange={(e) =>
                          setUserForm({
                            ...userForm,
                            telephone: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="col-md-12">
                      <label className="form-label fw-semibold">Rôle</label>
                      <select
                        className="form-select"
                        value={userForm.role_code}
                        onChange={(e) =>
                          setUserForm({
                            ...userForm,
                            role_code: e.target.value as UserRole,
                          })
                        }
                      >
                        {roles.map((r) => (
                          <option
                            key={r.code}
                            value={r.code}
                            disabled={
                              r.code === "admin_entreprise" && adminLimitReached
                            }
                          >
                            {r.nom}
                            {r.code === "admin_entreprise" && adminLimitReached
                              ? " (limite atteinte)"
                              : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    {!editingUser && (
                      <div className="col-md-12">
                        <label className="form-label fw-semibold">
                          Mot de passe
                        </label>
                        <input
                          type="password"
                          className="form-control"
                          required
                          value={userForm.password}
                          onChange={(e) =>
                            setUserForm({
                              ...userForm,
                              password: e.target.value,
                            })
                          }
                        />
                        <div className="form-text">
                          8 caractères minimum, 1 majuscule, 1 minuscule, 1
                          chiffre et 1 caractère spécial.
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                {formError && (
                  <div className="alert alert-danger py-2 mb-0" role="alert">
                    <i className="bi bi-exclamation-triangle me-2"></i>
                    {formError}
                  </div>
                )}
                <div className="modal-footer border-0 pt-0">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowUserModal(false)}
                    disabled={saving}
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary fw-bold"
                    disabled={saving}
                  >
                    {saving
                      ? "Enregistrement..."
                      : editingUser
                        ? "Mettre à jour"
                        : "Créer l'utilisateur"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {showUserModal && (
        <div
          className="modal-backdrop fade show"
          onClick={() => setShowUserModal(false)}
        ></div>
      )}
    </div>
  );
}
