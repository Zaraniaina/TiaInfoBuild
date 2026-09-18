import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'
import { useUIStore } from '@/stores/ui.store'
import { useToastStore } from '@/stores/toast.store'
import { settingsService } from '@/services/settings.service'
import { api } from '@/services/api'
import { ROLE_MODULES } from '@/config/roles.config'
import { formatErrorMessage } from '@/utils/errorMessage'

export function Topbar() {
  const navigate = useNavigate()
  const { user, setUser, logout } = useAuthStore()
  const { toggleSidebar, sidebarOpen, theme, setTheme, hydrateThemeFromBackend } = useUIStore()
  const [notifications, setNotifications] = useState<Array<{ id: number; titre: string }>>([])

  // Dropdowns React (pas de Bootstrap JS)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showNotifMenu, setShowNotifMenu] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const notifMenuRef = useRef<HTMLDivElement>(null)

  // Modales
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)

  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Formulaires
  const [profileForm, setProfileForm] = useState({
    nom: '',
    prenom: '',
    email: '',
    telephone: '',
  })

  const [passwordForm, setPasswordForm] = useState({
    old_password: '',
    new_password: '',
    confirm_password: '',
  })
  const [passwordError, setPasswordError] = useState<string | null>(null)

  // Fermer les menus au clic extérieur
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false)
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(e.target as Node)) {
        setShowNotifMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    hydrateThemeFromBackend()
  }, [hydrateThemeFromBackend])

  // Les alertes internes sont reservees aux roles ayant le module /alertes
  // (le client et admin_entreprise n'y ont pas droit : pas d'appel, pas de 403).
  const canViewAlertes = (ROLE_MODULES[user?.role_code || ''] || []).includes('/alertes')

  useEffect(() => {
    if (!canViewAlertes) return
    api.get('/alertes?non_lues=1&size=5').then(res => {
      setNotifications(res.data.items || [])
    }).catch(() => {})
  }, [canViewAlertes])

  // Synchroniser le formulaire profil et écouter l'événement global pour ouvrir la modale mot de passe
  useEffect(() => {
    if (user) {
      setProfileForm({
        nom: user.nom || '',
        prenom: user.prenom || '',
        email: user.email || '',
        telephone: '',
      })
    }
    const handler = () => {
      handleOpenPassword()
    }
    window.addEventListener('open-change-password-modal', handler)
    return () => window.removeEventListener('open-change-password-modal', handler)
  }, [user])

  const confirmLogout = async () => {
    setIsLoggingOut(true)
    try {
      const refresh = localStorage.getItem('refresh_token')
      if (refresh) await api.post('/auth/logout', { refresh_token: refresh })
    } catch { /* ignore */ }
    logout()
    window.location.href = '/login'
  }

  const handleOpenProfile = () => {
    setProfileForm({
      nom: user?.nom || '',
      prenom: user?.prenom || '',
      email: user?.email || '',
      telephone: '',
    })
    setShowUserMenu(false)
    setShowProfileModal(true)
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      const res = await api.put('/parametres/profile', profileForm)
      const updatedUser = res.data?.utilisateur || res.data
      if (updatedUser && user) {
        setUser({
          ...user,
          nom: updatedUser.nom ?? user.nom,
          prenom: updatedUser.prenom ?? user.prenom,
          email: updatedUser.email ?? user.email,
          telephone: updatedUser.telephone ?? user.telephone,
          must_change_password: updatedUser.must_change_password ?? user.must_change_password,
          statut: updatedUser.statut ?? user.statut,
        })
      }
      useToastStore.getState().addToast({
        type: 'success',
        title: 'Profil mis à jour',
        message: 'Vos informations personnelles ont été enregistrées avec succès.',
        duration: 4000,
      })
      setShowProfileModal(false)
    } catch (err) {
      const msg = formatErrorMessage(err, 'Erreur lors de la mise à jour du profil.')
      useToastStore.getState().addToast({
        type: 'error',
        title: 'Erreur Profil',
        message: msg,
        duration: 5000,
      })
    } finally {
      setIsSaving(false)
    }
  }

  function handleOpenPassword() {
    setPasswordForm((prev) => ({
      ...prev,
      old_password: '',
      new_password: '',
      confirm_password: '',
    }))
    setPasswordError(null)
    setShowUserMenu(false)
    setShowPasswordModal(true)
  }

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError(null)

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordError('Les mots de passe ne correspondent pas.')
      return
    }

    const pw = passwordForm.new_password
    const pwErrors: string[] = []
    if (pw.length < 8) pwErrors.push('au moins 8 caractères')
    if (!/[A-Z]/.test(pw)) pwErrors.push('une majuscule')
    if (!/[a-z]/.test(pw)) pwErrors.push('une minuscule')
    if (!/[0-9]/.test(pw)) pwErrors.push('un chiffre')
    if (!/[^A-Za-z0-9]/.test(pw)) pwErrors.push('un caractère spécial')

    if (pwErrors.length > 0) {
      setPasswordError(`Mot de passe invalide : doit contenir ${pwErrors.join(', ')}.`)
      return
    }

    setIsSaving(true)
    try {
      const res = await api.post('/auth/change-password', {
        old_password: passwordForm.old_password,
        new_password: passwordForm.new_password,
      })
      // Mettre à jour le store avec les données retournées par le backend
      const updatedUser = res.data?.user
      if (user) {
        setUser({
          ...user,
          must_change_password: false,
          ...(updatedUser || {}),
        })
      }
      useToastStore.getState().addToast({
        type: 'success',
        title: 'Mot de passe modifié',
        message: 'Votre mot de passe a été mis à jour avec succès.',
        duration: 4000,
      })
      setShowPasswordModal(false)
    } catch (err) {
      const msg = formatErrorMessage(err, 'Erreur lors du changement de mot de passe.')
      setPasswordError(msg)
    } finally {
      setIsSaving(false)
    }
  }

  const cycleTheme = async () => {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    try {
      await settingsService.updatePreferences({ theme: next })
    } catch {
      // silent fail
    }
  }

  const themeIcon = theme === 'light' ? 'bi-sun' : 'bi-moon'
  const themeLabel = theme === 'light' ? 'Thème clair' : 'Thème sombre'

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          className="btn btn-link sidebar-toggle"
          onClick={toggleSidebar}
          aria-label={sidebarOpen ? 'Masquer le menu' : 'Afficher le menu'}
          title={sidebarOpen ? 'Masquer le menu' : 'Afficher le menu'}
        >
          <i className={`bi ${sidebarOpen ? 'bi-chevron-double-left' : 'bi-list'}`}></i>
        </button>
      </div>

      <div className="topbar-right">
        <button
          className="btn btn-link theme-toggle"
          onClick={cycleTheme}
          aria-label={themeLabel}
          title={themeLabel}
        >
          <i className={`bi ${themeIcon}`}></i>
          <span className="theme-indicator" aria-hidden="true"></span>
        </button>

        {/* Notifications - dropdown React */}
        {canViewAlertes && (
        <div className="topbar-notifications" ref={notifMenuRef} style={{ position: 'relative' }}>
          <button
            className="btn btn-link notification-btn"
            aria-label="Notifications"
            onClick={() => { setShowNotifMenu(v => !v); setShowUserMenu(false) }}
          >
            <i className="bi bi-bell"></i>
            {notifications.length > 0 && (
              <span className="notification-badge">{notifications.length}</span>
            )}
          </button>
          {showNotifMenu && (
            <div
              className="dropdown-menu dropdown-menu-end show shadow"
              style={{ position: 'absolute', right: 0, top: '100%', zIndex: 1050, minWidth: 260 }}
            >
              <div className="dropdown-header">Notifications</div>
              {notifications.length === 0 ? (
                <div className="dropdown-item text-muted">Aucune notification</div>
              ) : (
                notifications.map(n => (
                  <div key={n.id} className="dropdown-item">{n.titre}</div>
                ))
              )}
            </div>
          )}
        </div>
        )}

        {/* Menu utilisateur - dropdown React */}
        <div className="topbar-user" ref={userMenuRef} style={{ position: 'relative' }}>
          <button
            className="btn btn-link user-btn"
            aria-label="Menu utilisateur"
            onClick={() => { setShowUserMenu(v => !v); setShowNotifMenu(false) }}
          >
            {user?.photo ? (
              <img src={user.photo} alt="Avatar" className="rounded-circle border me-1" style={{ width: '32px', height: '32px', objectFit: 'cover' }} />
            ) : (
              <div className="user-avatar">
                <i className="bi bi-person"></i>
              </div>
            )}
            <span className="user-name d-none d-md-inline">
              {user?.prenom} {user?.nom}
            </span>
            <i className={`bi bi-chevron-${showUserMenu ? 'up' : 'down'} ms-1`}></i>
          </button>

          {showUserMenu && (
            <div
              className="dropdown-menu dropdown-menu-end show shadow border-0"
              style={{ position: 'absolute', right: 0, top: '100%', zIndex: 1050, minWidth: 230 }}
            >
              <div className="dropdown-item border-bottom py-2" style={{ pointerEvents: 'none' }}>
                <div className="fw-bold">{user?.prenom} {user?.nom}</div>
                <small className="text-muted">{user?.email}</small>
              </div>
              <button className="dropdown-item py-2" onClick={handleOpenProfile}>
                <i className="bi bi-person me-2 text-primary"></i>Mon Profil
              </button>
              <button className="dropdown-item py-2" onClick={handleOpenPassword}>
                <i className="bi bi-key me-2 text-warning"></i>Changer mon mot de passe
              </button>
              {['admin_entreprise', 'super_admin'].includes(user?.role_code || '') && (
                <button
                  className="dropdown-item py-2"
                  onClick={() => {
                    setShowUserMenu(false)
                    if (user?.role_code === 'super_admin') {
                      navigate('/app/super-admin/parametres')
                    } else {
                      navigate('/app/settings')
                    }
                  }}
                >
                  <i className="bi bi-gear me-2 text-secondary"></i>Paramètres
                </button>
              )}
              <div className="dropdown-divider"></div>
              <button className="dropdown-item text-danger py-2" onClick={() => { setShowUserMenu(false); setShowLogoutModal(true) }}>
                <i className="bi bi-box-arrow-right me-2"></i>Déconnexion
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal Déconnexion */}
      {showLogoutModal && (
        <div className="modal fade show" style={{ display: 'block' }} tabIndex={-1} aria-modal="true" role="dialog">
          <div className="modal-dialog modal-sm modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold"><i className="bi bi-box-arrow-right me-2 text-danger"></i>Déconnexion</h5>
                <button type="button" className="btn-close" onClick={() => setShowLogoutModal(false)} disabled={isLoggingOut}></button>
              </div>
              <div className="modal-body">
                <p className="mb-0">Voulez-vous vraiment vous déconnecter ?</p>
              </div>
              <div className="modal-footer border-0 pt-0">
                <button className="btn btn-secondary" onClick={() => setShowLogoutModal(false)} disabled={isLoggingOut}>Annuler</button>
                <button className="btn btn-danger fw-bold" onClick={confirmLogout} disabled={isLoggingOut}>
                  {isLoggingOut ? 'Déconnexion...' : 'Se déconnecter'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showLogoutModal && <div className="modal-backdrop fade show" onClick={() => setShowLogoutModal(false)}></div>}

      {/* Modal Mon Profil */}
      {showProfileModal && (
        <div className="modal fade show" style={{ display: 'block' }} tabIndex={-1} aria-modal="true" role="dialog">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header border-bottom">
                <h5 className="modal-title fw-bold"><i className="bi bi-person me-2 text-primary"></i>Mon Profil</h5>
                <button type="button" className="btn-close" onClick={() => setShowProfileModal(false)} disabled={isSaving}></button>
              </div>
              <form onSubmit={handleSaveProfile}>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Prénom</label>
                      <input type="text" className="form-control" required value={profileForm.prenom}
                        onChange={(e) => setProfileForm({ ...profileForm, prenom: e.target.value })} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Nom</label>
                      <input type="text" className="form-control" required value={profileForm.nom}
                        onChange={(e) => setProfileForm({ ...profileForm, nom: e.target.value })} />
                    </div>
                    <div className="col-md-12">
                      <label className="form-label fw-semibold">Adresse email</label>
                      <input type="email" className="form-control" required value={profileForm.email}
                        onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} />
                    </div>
                    <div className="col-md-12">
                      <label className="form-label fw-semibold">Téléphone</label>
                      <input type="text" className="form-control" value={profileForm.telephone}
                        onChange={(e) => setProfileForm({ ...profileForm, telephone: e.target.value })} />
                    </div>
                  </div>
                </div>
                <div className="modal-footer border-0 pt-0">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowProfileModal(false)} disabled={isSaving}>Annuler</button>
                  <button type="submit" className="btn btn-primary fw-bold" disabled={isSaving}>
                    {isSaving ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {showProfileModal && <div className="modal-backdrop fade show" onClick={() => setShowProfileModal(false)}></div>}

      {/* Modal Changer Mot de passe */}
      {showPasswordModal && (
        <div className="modal fade show" style={{ display: 'block' }} tabIndex={-1} aria-modal="true" role="dialog">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header border-bottom">
                <h5 className="modal-title fw-bold"><i className="bi bi-key me-2 text-warning"></i>Changer mon mot de passe</h5>
                <button type="button" className="btn-close" onClick={() => setShowPasswordModal(false)} disabled={isSaving}></button>
              </div>
              <form onSubmit={handleSavePassword}>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-md-12">
                      <label className="form-label fw-semibold">Mot de passe actuel / temporaire</label>
                      <input type="password" className="form-control" required
                        value={passwordForm.old_password}
                        autoFocus
                        onChange={(e) => setPasswordForm({ ...passwordForm, old_password: e.target.value })} />
                    </div>
                    <div className="col-md-12">
                      <label className="form-label fw-semibold">Nouveau mot de passe</label>
                      <input type="password" className="form-control" required
                        value={passwordForm.new_password}
                        onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })} />
                      <div className="form-text">8 caractères minimum, 1 majuscule, 1 minuscule, 1 chiffre et 1 caractère spécial.</div>
                    </div>
                    <div className="col-md-12">
                      <label className="form-label fw-semibold">Confirmer le nouveau mot de passe</label>
                      <input type="password" className="form-control" required
                        value={passwordForm.confirm_password}
                        onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })} />
                    </div>
                  </div>
                  {passwordError && (
                    <div className="alert alert-danger py-2 mt-3 mb-0" role="alert">
                      <i className="bi bi-exclamation-triangle me-2"></i>
                      {passwordError}
                    </div>
                  )}
                </div>
                <div className="modal-footer border-0 pt-0">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowPasswordModal(false)} disabled={isSaving}>Annuler</button>
                  <button type="submit" className="btn btn-warning fw-bold text-dark" disabled={isSaving}>
                    {isSaving ? 'Mise à jour...' : 'Changer le mot de passe'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {showPasswordModal && <div className="modal-backdrop fade show" onClick={() => setShowPasswordModal(false)}></div>}
    </header>
  )
}
