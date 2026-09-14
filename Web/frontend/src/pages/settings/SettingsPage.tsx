import { useEffect, useState } from "react";
import { api } from "@/services/api";
import { subscriptionsService } from '@/services/subscriptions.service'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from "@/stores/auth.store";
import { useToastStore } from "@/stores/toast.store";
import { ROLE_NAMES, getRolePermissions } from "@/config/roles.config";
import { formatErrorMessage } from "@/utils/errorMessage";
import { TableSkeleton } from '@/components/ui/Skeleton'

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
  const roleCode = user?.role_code || 'employe'
  const perms = getRolePermissions(roleCode)
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<
    "utilisateurs" | "parametres" | "badges" | "audit" | "profil"
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
    photo: "",
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
    logo: "",
    devise: "MGA",
    tva_defaut: 20,
    delai_paiement_jours: 30,
    prefixe_devis: "DEV",
    prefixe_facture: "FAC",
    prefixe_contrat: "CTR",
    entete_badge: "BADGE OFFICIEL POINTAGE TERRAIN",
    couleurs_roles: JSON.stringify({
      directeur: "#1e3a8a",
      chef_projet: "#4338ca",
      chef_chantier: "#ea580c",
      comptable: "#0d9488",
      rh: "#7e22ce",
      materiel: "#475569",
      magasinier: "#d97706",
      commercial: "#059669",
      employe: "#2563eb",
      client: "#6d28d9",
    }),
  });

  const [roleColors, setRoleColors] = useState<Record<string, string>>({
    directeur: "#1e3a8a",
    chef_projet: "#4338ca",
    chef_chantier: "#ea580c",
    comptable: "#0d9488",
    rh: "#7e22ce",
    materiel: "#475569",
    magasinier: "#d97706",
    commercial: "#059669",
    employe: "#2563eb",
    client: "#6d28d9",
  });

  const [usersLoading, setUsersLoading] = useState(true)
  const [logsLoading, setLogsLoading] = useState(true)
  const [entrepriseLoaded, setEntrepriseLoaded] = useState(false);
  const [subscription, setSubscription] = useState<any | null>(null)
  const [subLoading, setSubLoading] = useState(true)

  const [profilForm, setProfilForm] = useState({
    nom: user?.nom || "",
    prenom: user?.prenom || "",
    email: user?.email || "",
    photo: (user as any)?.photo || "",
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
        const anyE = e as any;
        if (anyE.couleurs_roles) {
          try {
            const parsed = typeof anyE.couleurs_roles === 'string' ? JSON.parse(anyE.couleurs_roles) : anyE.couleurs_roles;
            setRoleColors(prev => ({ ...prev, ...parsed }));
          } catch {
            // fallback
          }
        }
        setEntrepriseForm({
          nom: e.nom || "",
          nom_commercial: e.nom_commercial || "",
          siret: e.siret || "",
          telephone: e.telephone || "",
          email: e.email || "",
          adresse: e.adresse || "",
          ville: e.ville || "",
          code_postal: e.code_postal || "",
          logo: anyE.logo || "",
          devise: e.devise || "MGA",
          tva_defaut: e.tva_defaut ?? 20,
          delai_paiement_jours: e.delai_paiement_defaut ?? 30,
          prefixe_devis: e.prefixe_devis || "DEV",
          prefixe_facture: e.prefixe_facture || "FAC",
          prefixe_contrat: e.prefixe_contrat || "CTR",
          entete_badge: anyE.entete_badge || "BADGE OFFICIEL POINTAGE TERRAIN",
          couleurs_roles: typeof anyE.couleurs_roles === 'string' ? anyE.couleurs_roles : JSON.stringify(roleColors),
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
      .catch(() => setRoles([]));
  };

  const loadUsers = () => {
    setUsersLoading(true)
    api
      .get("/utilisateurs?size=100")
      .then((res) => {
        const items = res.data.items || res.data || [];
        setUsers(
          items.map((u: UtilisateurListItem) => {
            const code = (u.role_code || u.role?.code || "employe") as UserRole;
            const nom = u.role?.nom || u.role_nom || ROLE_NAMES[code] || "Employé";
            return {
              id: u.id,
              prenom: u.prenom || "",
              nom: u.nom || "",
              email: u.email || "",
              role_code: code,
              role_nom: nom,
              statut: u.statut === "inactif" ? "inactif" : "actif",
              telephone: u.telephone || "",
              date_creation: u.date_creation,
              derniere_connexion: u.derniere_connexion,
            };
          }),
        );
      })
      .catch(() => setUsers([]))
      .finally(() => setUsersLoading(false))
  };

  const loadLogs = () => {
    setLogsLoading(true)
    api
      .get("/parametres/audit-logs?size=50")
      .then((res) => setLogs(res.data.items || res.data || []))
      .catch(() => setLogs([]))
      .finally(() => setLogsLoading(false))
  };

  useEffect(() => {
    loadEntrepriseSettings();
    loadRoles();
    subscriptionsService.getMySubscription()
      .then(s => setSubscription(s))
      .catch(() => setSubscription(null))
      .finally(() => setSubLoading(false))
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
      useToastStore.getState().addToast({
        type: "success",
        title: "Paramètres Entreprise",
        message: "Les paramètres d'entreprise ont été enregistrés avec succès !",
        duration: 4000,
      });
    } catch (err) {
      useToastStore.getState().addToast({
        type: "error",
        title: "Erreur",
        message: formatErrorMessage(err, "Erreur lors de la sauvegarde des paramètres."),
        duration: 5000,
      });
    } finally {
      setSaving(false);
    }
  };

  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const isEmploye = user?.role_code === 'employe';

  const handlePhotoUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('fichier', file);
      const res = await api.post<{ photo: string }>('/parametres/profile/photo', formData);
      const newPhoto = res.data.photo;
      setProfilForm(prev => ({ ...prev, photo: newPhoto }));
      if (user) {
        useAuthStore.getState().setUser({ ...user, photo: newPhoto });
      }
      useToastStore.getState().addToast({
        type: 'success',
        title: 'Photo mise à jour',
        message: 'Votre photo de profil a été mise à jour avec succès.',
        duration: 3000,
      });
    } catch (err) {
      useToastStore.getState().addToast({
        type: 'error',
        title: 'Erreur',
        message: formatErrorMessage(err, "Erreur lors de l'envoi de la photo."),
        duration: 5000,
      });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDeletePhoto = async () => {
    if (!confirm('Voulez-vous vraiment supprimer votre photo de profil ?')) return;
    setUploadingPhoto(true);
    try {
      await api.delete('/parametres/profile/photo');
      setProfilForm(prev => ({ ...prev, photo: '' }));
      if (user) {
        useAuthStore.getState().setUser({ ...user, photo: null });
      }
      useToastStore.getState().addToast({
        type: 'success',
        title: 'Photo supprimée',
        message: 'Votre photo de profil a été supprimée.',
        duration: 3000,
      });
    } catch (err) {
      useToastStore.getState().addToast({
        type: 'error',
        title: 'Erreur',
        message: formatErrorMessage(err, 'Erreur lors de la suppression de la photo.'),
        duration: 5000,
      });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const [uploadingLogo, setUploadingLogo] = useState(false);

  const handleLogoUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('fichier', file);
      const res = await api.post<{ logo: string }>('/parametres/entreprise/logo', formData);
      const newLogo = res.data.logo;
      setEntrepriseForm(prev => ({ ...prev, logo: newLogo }));
      useToastStore.getState().addToast({
        type: 'success',
        title: 'Logo mis à jour',
        message: "Le logo de l'entreprise a été téléversé avec succès.",
        duration: 3000,
      });
    } catch (err) {
      useToastStore.getState().addToast({
        type: 'error',
        title: 'Erreur',
        message: formatErrorMessage(err, "Erreur lors du téléversement du logo."),
        duration: 5000,
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleDeleteLogo = async () => {
    if (!confirm("Voulez-vous vraiment supprimer le logo de l'entreprise ?")) return;
    setUploadingLogo(true);
    try {
      await api.delete('/parametres/entreprise/logo');
      setEntrepriseForm(prev => ({ ...prev, logo: '' }));
      useToastStore.getState().addToast({
        type: 'success',
        title: 'Logo supprimé',
        message: "Le logo de l'entreprise a été supprimé.",
        duration: 3000,
      });
    } catch (err) {
      useToastStore.getState().addToast({
        type: 'error',
        title: 'Erreur',
        message: formatErrorMessage(err, "Erreur lors de la suppression du logo."),
        duration: 5000,
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSaveProfil = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put("/parametres/profile", profilForm);
      if (res.data?.utilisateur && user) {
        useAuthStore.getState().setUser({ ...user, ...res.data.utilisateur });
      }
      useToastStore.getState().addToast({
        type: "success",
        title: "Profil mis à jour",
        message: "Vos informations de profil ont été enregistrées avec succès !",
        duration: 4000,
      });
    } catch (err) {
      useToastStore.getState().addToast({
        type: "error",
        title: "Erreur",
        message: formatErrorMessage(err, "Erreur lors de la mise à jour du profil."),
        duration: 5000,
      });
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
      photo: "",
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
      photo: (u as any).photo || "",
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
        useToastStore.getState().addToast({
          type: "success",
          title: "Utilisateur mis à jour",
          message: `L'utilisateur ${userForm.prenom} ${userForm.nom} a été modifié.`,
          duration: 4000,
        });
      } else {
        response = await api.post("/utilisateurs", payload);
        useToastStore.getState().addToast({
          type: "success",
          title: "Utilisateur créé",
          message: `Compte créé pour ${userForm.prenom} ${userForm.nom}. Bon de création généré.`,
          duration: 4000,
        });
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
            useToastStore.getState().addToast({
              type: "warning",
              title: "Bon de création",
              message: "Le compte a été créé, mais le PDF n'a pas pu être téléchargé automatiquement.",
              duration: 5000,
            }),
          );
      }
    } catch (error: unknown) {
      const message = formatErrorMessage(error, "Erreur lors de l'enregistrement de l'utilisateur.");
      setFormError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleUser = async (u: UserRow) => {
    try {
      await api.post(`/utilisateurs/${u.id}/toggle-actif`);
      const newStatus = u.statut === "actif" ? "inactif" : "actif";
      setUsers((prev) =>
        prev.map((x) =>
          x.id === u.id
            ? { ...x, statut: newStatus }
            : x,
        ),
      );
      useToastStore.getState().addToast({
        type: newStatus === "actif" ? "success" : "info",
        title: "Statut mis à jour",
        message: `Compte de ${u.prenom} ${u.nom} est désormais ${newStatus === "actif" ? "actif" : "désactivé"}.`,
        duration: 4000,
      });
    } catch (err) {
      useToastStore.getState().addToast({
        type: "error",
        title: "Erreur Statut",
        message: formatErrorMessage(err, "Erreur lors du changement de statut."),
        duration: 5000,
      });
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
      super_admin: "bg-danger bg-opacity-10 text-danger border",
      admin_entreprise: "bg-primary bg-opacity-10 text-primary border",
      directeur: "bg-success bg-opacity-10 text-success border",
      comptable: "bg-info bg-opacity-10 text-info border",
      chef_chantier: "bg-warning bg-opacity-10 text-dark border",
      chef_projet: "bg-secondary bg-opacity-10 text-dark border",
      rh: "bg-light text-dark border",
      materiel: "bg-light text-dark border",
      magasinier: "bg-light text-dark border",
      commercial: "bg-success bg-opacity-10 text-success border",
      employe: "bg-light text-dark border",
      client: "bg-light text-dark border",
    };
    return map[role] || "bg-light text-dark border";
  };

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h2 className="mb-1 fw-bold text-secondary">
            <i className="bi bi-gear me-2"></i>Administration &
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
            className={`nav-link ${activeTab === "badges" ? "active" : ""}`}
            onClick={() => setActiveTab("badges")}
          >
            <i className="bi bi-palette me-2"></i>Logo & Badges QR
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
               className="btn btn-outline-secondary fw-bold"
               onClick={openCreateUser}
             >
               <i className="bi bi-person-plus me-2"></i>Nouvel Utilisateur
             </button>
           </div>
           {usersLoading ? (
             <TableSkeleton rows={6} columns={7} />
           ) : (
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
                         className={`badge ${u.statut === "actif" ? "bg-success bg-opacity-10 text-success border" : "bg-secondary bg-opacity-10 text-dark border"}`}
                       >
                         {u.statut === "actif" ? "Actif" : "Inactif"}
                       </span>
                     </td>
                     <td className="d-none d-md-table-cell text-muted">
                       {u.telephone || "-"}
                     </td>
                     <td className="text-muted">
                       {u.derniere_connexion || "-"}
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
           )}
         </div>
       )}

      {activeTab === "parametres" &&
        (entrepriseLoaded ? (
          <>
          <div className="card border-0 shadow-sm mb-4 p-3">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <div className="small text-muted">Abonnement</div>
                <div className="fw-semibold">
                  {subLoading ? 'Chargement...' : (subscription ? (subscription.plan?.nom || subscription.plan?.code || 'Formule') : 'Aucun abonnement actif')}
                </div>
                {!subLoading && subscription?.date_fin && (
                  <div className="small text-muted">Valide jusqu'au {new Date(subscription.date_fin).toLocaleDateString()}</div>
                )}
              </div>
              <div>
                {perms.canManageSubscription ? (
                  <button className="btn btn-outline-secondary" onClick={() => navigate('/pricing')}>
                    Gérer l'abonnement
                  </button>
                ) : (
                  <button className="btn btn-outline-secondary" disabled title="Vous n'êtes pas autorisé à gérer l'abonnement">
                    Gérer l'abonnement
                  </button>
                )}
              </div>
            </div>
          </div>
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
                  <option value="EUR">EUR</option>
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
              className="btn btn-outline-secondary fw-bold"
              disabled={saving}
            >
              {saving ? "Enregistrement..." : "Enregistrer les paramètres"}
            </button>
          </form>
          </>
        ) : (
        <TableSkeleton rows={8} columns={6} />
        ))}

       {activeTab === "audit" && (
         <div className="table-card">
           <div className="table-header">
             <h5 className="fw-bold mb-0">
               <i className="bi bi-shield-check me-2"></i>Journal
               d'activité
             </h5>
             <button
               className="btn btn-outline-secondary btn-sm"
               onClick={loadLogs}
             >
               <i className="bi bi-arrow-clockwise me-1"></i>Actualiser
             </button>
           </div>
           {logsLoading ? (
             <TableSkeleton rows={8} columns={5} />
           ) : (
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
                     <td className="small text-muted">{l.user_agent || "-"}</td>
                     <td>
                       <span
                         className={`badge ${l.reussi ? "bg-success bg-opacity-10 text-success border" : "bg-danger bg-opacity-10 text-danger border"}`}
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
           )}
         </div>
       )}

       {activeTab === "badges" && (
         <div className="row g-4">
           <div className="col-lg-7">
             <div className="card border-0 shadow-sm p-4 rounded-4 mb-4">
               <h5 className="fw-bold mb-3 border-bottom pb-2">
                 <i className="bi bi-palette me-2 text-primary"></i>Personnalisation & Logo de l'Entreprise
               </h5>
               
               <div className="mb-4">
                  <label className="form-label fw-semibold d-block">Logo de l'Entreprise</label>
                  <div className="d-flex align-items-center gap-3">
                    {entrepriseForm.logo ? (
                      <img
                        src={entrepriseForm.logo}
                        alt="Logo Entreprise"
                        className="rounded-3 border p-1 bg-white shadow-sm"
                        style={{ width: '80px', height: '80px', objectFit: 'contain' }}
                      />
                    ) : (
                      <div
                        className="rounded-3 bg-light border d-flex align-items-center justify-content-center text-muted"
                        style={{ width: '80px', height: '80px', fontSize: '1.8rem' }}
                      >
                        <i className="bi bi-building"></i>
                      </div>
                    )}
                    <div>
                      <div className="d-flex align-items-center gap-2 mb-1">
                        <label className={`btn btn-sm btn-outline-primary mb-0 ${uploadingLogo ? 'disabled' : ''}`}>
                          <i className="bi bi-upload me-1"></i>{uploadingLogo ? 'Chargement...' : 'Téléverser le logo'}
                          <input type="file" accept="image/jpeg,image/png" hidden onChange={handleLogoUploadFile} disabled={uploadingLogo} />
                        </label>
                        {entrepriseForm.logo && (
                          <button type="button" className="btn btn-sm btn-outline-danger mb-0" onClick={handleDeleteLogo} disabled={uploadingLogo}>
                            <i className="bi bi-trash me-1"></i>Supprimer
                          </button>
                        )}
                      </div>
                      <div className="form-text" style={{ fontSize: '0.78rem' }}>Ce logo apparaîtra sur tous les Badges QR, Devis, Factures et Contrats.</div>
                    </div>
                  </div>
                </div>

               <div className="mb-4">
                 <label className="form-label fw-semibold">En-tête des Badges QR de Pointage</label>
                 <input
                   type="text"
                   className="form-control"
                   value={entrepriseForm.entete_badge}
                   onChange={(e) => setEntrepriseForm({ ...entrepriseForm, entete_badge: e.target.value })}
                 />
                 <div className="form-text">Ex: BADGE OFFICIEL POINTAGE TERRAIN</div>
               </div>

               <h5 className="fw-bold mb-3 border-bottom pb-2 pt-2">
                 <i className="bi bi-paint-bucket me-2 text-primary"></i>Couleurs Thématiques par Rôle
               </h5>
               <p className="small text-muted mb-3">Personnalisez la couleur de la carte badge pour chaque fonction métier :</p>

               <div className="row g-3">
                 {[
                   { code: 'chef_chantier', label: 'Chef de Chantier' },
                   { code: 'chef_projet', label: 'Chef de Projet' },
                   { code: 'directeur', label: 'Direction Générale' },
                   { code: 'comptable', label: 'Comptable / DAF' },
                   { code: 'rh', label: 'Responsable RH' },
                   { code: 'materiel', label: 'Responsable Matériel' },
                   { code: 'magasinier', label: 'Magasinier / Stocks' },
                   { code: 'commercial', label: 'Commercial' },
                   { code: 'employe', label: 'Employé de Terrain / Ouvrier' },
                   { code: 'client', label: 'Client' },
                 ].map((r) => (
                   <div className="col-md-6" key={r.code}>
                     <div className="d-flex align-items-center justify-content-between p-2 bg-light rounded border">
                       <span className="small fw-semibold">{r.label}</span>
                       <div className="d-flex align-items-center gap-2">
                         <input
                           type="color"
                           className="form-control form-control-color"
                           value={roleColors[r.code] || '#2563eb'}
                           onChange={(e) => setRoleColors({ ...roleColors, [r.code]: e.target.value })}
                           title={`Couleur pour ${r.label}`}
                         />
                         <span className="font-monospace small text-muted" style={{ width: '60px' }}>{roleColors[r.code] || '#2563eb'}</span>
                       </div>
                     </div>
                   </div>
                 ))}
               </div>

               <button
                 type="button"
                 className="btn btn-primary fw-bold mt-4 px-4 shadow-sm"
                 disabled={saving}
                 onClick={async () => {
                   setSaving(true);
                   try {
                     const payload = {
                       ...entrepriseForm,
                       couleurs_roles: JSON.stringify(roleColors),
                       delai_paiement_defaut: entrepriseForm.delai_paiement_jours,
                     };
                     await api.put("/parametres/entreprise", payload);
                     useToastStore.getState().addToast({
                       type: "success",
                       title: "Personnalisation enregistrée",
                       message: "Le logo et la charte graphique des badges ont été sauvegardés !",
                       duration: 4000,
                     });
                   } catch (err) {
                     useToastStore.getState().addToast({
                       type: "error",
                       title: "Erreur",
                       message: formatErrorMessage(err, "Erreur lors de l'enregistrement de la charte."),
                       duration: 5000,
                     });
                   } finally {
                     setSaving(false);
                   }
                 }}
               >
                 <i className="bi bi-check-lg me-2"></i>Enregistrer la charte & badges
               </button>
             </div>
           </div>

           <div className="col-lg-5">
             <div className="card border-0 shadow-sm p-4 rounded-4 sticky-top" style={{ top: '90px' }}>
               <h6 className="fw-bold mb-3 text-muted text-uppercase tracking-wider">Aperçu en Direct du Badge QR</h6>
               
               <div
                 className="card border-0 shadow-lg rounded-4 overflow-hidden text-white mx-auto p-3 text-center mb-3"
                 style={{
                   width: '100%',
                   maxWidth: '340px',
                   background: `linear-gradient(135deg, ${roleColors['chef_chantier'] || '#ea580c'} 0%, #0f172a 100%)`,
                 }}
               >
                 <div className="pb-2 border-bottom border-white border-opacity-25 mb-2">
                   {entrepriseForm.logo ? (
                     <img src={entrepriseForm.logo} alt="Logo preview" style={{ maxHeight: '36px', maxWidth: '140px', objectFit: 'contain' }} className="d-block mx-auto mb-1" />
                   ) : (
                     <div className="fw-bold fs-6">{entrepriseForm.nom || 'TIA INFO BUILD'}</div>
                   )}
                   <div className="small font-monospace text-uppercase" style={{ fontSize: '0.68rem', color: '#38bdf8' }}>
                     {entrepriseForm.entete_badge || 'BADGE OFFICIEL POINTAGE TERRAIN'}
                   </div>
                 </div>

                 <div className="py-2">
                   <div className="rounded-circle border border-2 border-white d-flex align-items-center justify-content-center fw-bold fs-3 bg-secondary text-white mx-auto mb-2" style={{ width: '80px', height: '80px' }}>
                     R.O
                   </div>
                   <h5 className="fw-bold mb-0">Rakoto Olona</h5>
                   <div className="badge bg-light text-dark fw-bold my-1 text-uppercase" style={{ fontSize: '0.75rem' }}>
                     Chef de Chantier
                   </div>
                   <div className="small text-light text-opacity-75 mb-2">Matricule: <span className="font-monospace fw-bold">EMP-042</span></div>

                   <div className="p-2 bg-white rounded-3 d-inline-block shadow-sm">
                     <img
                       src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=TIA-EMP-042-SAMPLE"
                       alt="QR Preview"
                       style={{ width: '130px', height: '130px', display: 'block' }}
                     />
                   </div>
                   <div className="small text-light text-opacity-50 mt-2" style={{ fontSize: '0.68rem' }}>
                     Logo & couleur appliqués automatiquement lors de l'impression.
                   </div>
                 </div>
               </div>
             </div>
           </div>
         </div>
       )}

      {activeTab === "profil" && (
        <form onSubmit={handleSaveProfil} className="card border-0 shadow-sm p-4 rounded-4" style={{ maxWidth: '700px' }}>
          <h5 className="fw-bold mb-4 border-bottom pb-2"><i className="bi bi-person-circle me-2 text-primary"></i>Mon Profil Personnel</h5>
          
          <div className="d-flex align-items-center gap-4 mb-4 pb-3 border-bottom">
            <div>
              {profilForm.photo ? (
                <img src={profilForm.photo} alt="Avatar" className="rounded-circle border border-3 border-primary shadow-sm" style={{ width: '96px', height: '96px', objectFit: 'cover' }} />
              ) : (
                <div className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center fw-bold fs-2 shadow-sm" style={{ width: '96px', height: '96px' }}>
                  {profilForm.prenom?.[0] || 'U'}{profilForm.nom?.[0] || ''}
                </div>
              )}
            </div>
            <div className="flex-grow-1">
              <label className="form-label fw-semibold">Photo de profil</label>
              {isEmploye ? (
                <div className="alert alert-info py-2 px-3 small d-flex align-items-center mb-0 border-0 bg-info-subtle text-info-emphasis rounded-3">
                  <i className="bi bi-info-circle-fill me-2 fs-5"></i>
                  <span>Votre photo de profil est gérée exclusivement par le service RH via votre badge professionnel.</span>
                </div>
              ) : (
                <div>
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <label className={`btn btn-sm btn-outline-primary mb-0 ${uploadingPhoto ? 'disabled' : ''}`}>
                      <i className="bi bi-upload me-1"></i>{uploadingPhoto ? 'Chargement...' : 'Téléverser une image'}
                      <input type="file" accept="image/jpeg,image/png" hidden onChange={handlePhotoUploadFile} disabled={uploadingPhoto} />
                    </label>
                    {profilForm.photo && (
                      <button type="button" className="btn btn-sm btn-outline-danger mb-0" onClick={handleDeletePhoto} disabled={uploadingPhoto}>
                        <i className="bi bi-trash me-1"></i>Supprimer
                      </button>
                    )}
                  </div>
                  <div className="form-text mt-1" style={{ fontSize: '0.78rem' }}>Cette photo apparaîtra sur votre profil et l'ensemble de la plateforme.</div>
                </div>
              )}
            </div>
          </div>

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
            className="btn btn-primary fw-bold mt-4 shadow-sm"
            disabled={saving}
          >
            <i className="bi bi-check-lg me-2"></i>Mettre à jour le profil
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
                    className="btn btn-outline-secondary"
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
