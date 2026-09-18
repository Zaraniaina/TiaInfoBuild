import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Article, Chantier, CommandeFournisseur, Depot, FactureFournisseur, Fournisseur } from '@/types'
import { achatsService, type LigneCommandeInput } from '@/services/achats.service'
import { stocksService } from '@/services/stocks.service'
import { chantiersService } from '@/services/chantiers.service'
import { useAuthStore } from '@/stores/auth.store'
import { getRolePermissions } from '@/config/roles.config'
import { TableSkeleton } from '@/components/ui/Skeleton'

const STATUTS_CMD: Record<string, { label: string; badge: string }> = {
  brouillon: { label: 'Brouillon', badge: 'bg-light text-dark border' },
  envoyee: { label: 'Envoyée', badge: 'bg-info bg-opacity-10 text-info border' },
  confirmee: { label: 'Confirmée', badge: 'bg-primary bg-opacity-10 text-primary border' },
  partiellement_recue: { label: 'Partiellement reçue', badge: 'bg-warning bg-opacity-10 text-dark border' },
  recue: { label: 'Reçue', badge: 'bg-success bg-opacity-10 text-success border' },
  annulee: { label: 'Annulée', badge: 'bg-danger bg-opacity-10 text-danger border' },
}

const STATUTS_FAC: Record<string, { label: string; badge: string }> = {
  a_payer: { label: 'À payer', badge: 'bg-warning bg-opacity-10 text-dark border' },
  partiellement_payee: { label: 'Partiellement payée', badge: 'bg-info bg-opacity-10 text-info border' },
  payee: { label: 'Payée', badge: 'bg-success bg-opacity-10 text-success border' },
  litige: { label: 'Litige', badge: 'bg-danger bg-opacity-10 text-danger border' },
  annulee: { label: 'Annulée', badge: 'bg-light text-dark border' },
}

const MODES: Record<string, string> = {
  virement: 'Virement', especes: 'Espèces', cheque: 'Chèque',
  mvola: 'MVola', orange_money: 'Orange Money', airtel_money: 'Airtel Money',
}

const fmtAr = (n?: number | null) => `${(n ?? 0).toLocaleString('fr-FR')} Ar`
const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR') : '-')

interface LigneForm {
  article_id: string
  designation: string
  quantite: string
  prix_unitaire: string
}

const emptyLigne = (): LigneForm => ({ article_id: '', designation: '', quantite: '1', prix_unitaire: '0' })

export function AchatsPage() {
  const { user } = useAuthStore()
  const perms = getRolePermissions(user?.role_code || 'employe')
  const canWrite = perms.canAddMouvementStock || perms.canCreateArticle

  const [tab, setTab] = useState<'commandes' | 'factures' | 'echeances'>('commandes')
  const [commandes, setCommandes] = useState<CommandeFournisseur[]>([])
  const [factures, setFactures] = useState<FactureFournisseur[]>([])
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [chantiers, setChantiers] = useState<Chantier[]>([])
  const [depots, setDepots] = useState<Depot[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  // Modale création commande
  const [showCmdModal, setShowCmdModal] = useState(false)
  const [lignesForm, setLignesForm] = useState<LigneForm[]>([emptyLigne()])
  const [saving, setSaving] = useState(false)

  // Modale réception
  const [receptCmd, setReceptCmd] = useState<CommandeFournisseur | null>(null)
  const [receptQtys, setReceptQtys] = useState<Record<number, string>>({})

  // Modale facture + paiement
  const [showFacModal, setShowFacModal] = useState(false)
  const [facFromCmd, setFacFromCmd] = useState<number | ''>('')
  const [payFac, setPayFac] = useState<FactureFournisseur | null>(null)
  const [payMontant, setPayMontant] = useState('')
  const [payMode, setPayMode] = useState('virement')
  const [payRef, setPayRef] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const [cmds, facs, frs, arts, chts, dps] = await Promise.all([
        achatsService.listCommandes(),
        achatsService.listFactures(),
        stocksService.getFournisseurs(),
        stocksService.getArticles(),
        chantiersService.getAll().catch(() => []),
        stocksService.getDepots().catch(() => []),
      ])
      setCommandes(cmds)
      setFactures(facs)
      setFournisseurs(frs)
      setArticles(arts)
      setChantiers(chts)
      setDepots(dps)
    } catch {
      setErr('Impossible de charger les achats.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const retards = useMemo(
    () => factures.filter(
      (f) => ['a_payer', 'partiellement_payee'].includes(f.statut)
        && f.date_echeance && new Date(f.date_echeance) < new Date(),
    ),
    [factures],
  )
  const aPayer = useMemo(
    () => factures.filter((f) => ['a_payer', 'partiellement_payee'].includes(f.statut)),
    [factures],
  )
  const totalEnAttente = aPayer.reduce((s, f) => s + (f.restant_a_payer ?? (f.montant_ttc - f.montant_paye)), 0)

  // ===== Actions =====
  const openCreateCmd = () => {
    setLignesForm([emptyLigne()])
    setShowCmdModal(true)
  }

  const addLigne = () => setLignesForm((l) => [...l, emptyLigne()])
  const removeLigne = (i: number) => setLignesForm((l) => (l.length > 1 ? l.filter((_, idx) => idx !== i) : l))
  const changeLigne = (i: number, patch: Partial<LigneForm>) =>
    setLignesForm((l) => l.map((x, idx) => (idx === i ? { ...x, ...patch } : x)))

  const pickArticle = (i: number, articleId: string) => {
    const a = articles.find((x) => String(x.id) === articleId)
    changeLigne(i, {
      article_id: articleId,
      designation: a?.nom || '',
      prix_unitaire: a?.prix_achat ? String(a.prix_achat) : '',
    })
  }

  const handleSaveCommande = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const lignes: LigneCommandeInput[] = lignesForm
      .filter((l) => l.designation.trim() && Number(l.quantite) > 0)
      .map((l) => ({
        article_id: l.article_id ? Number(l.article_id) : null,
        designation: l.designation.trim(),
        quantite: Number(l.quantite),
        prix_unitaire: Number(l.prix_unitaire || 0),
      }))
    if (lignes.length === 0) {
      alert('Ajoutez au moins une ligne avec désignation et quantité.')
      return
    }
    setSaving(true)
    try {
      await achatsService.createCommande({
        fournisseur_id: Number(form.get('fournisseur_id')),
        chantier_id: form.get('chantier_id') ? Number(form.get('chantier_id')) : null,
        date_livraison_prevue: (form.get('date_livraison_prevue') as string) || null,
        taux_tva: Number(form.get('taux_tva') || 20),
        notes: (form.get('notes') as string) || undefined,
        lignes,
      })
      setShowCmdModal(false)
      await load()
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Erreur lors de la création de la commande.')
    } finally {
      setSaving(false)
    }
  }

  const openReception = async (cmd: CommandeFournisseur) => {
    const full = await achatsService.getCommande(cmd.id)
    setReceptCmd(full)
    setReceptQtys(
      Object.fromEntries(full.lignes.map((l) => [l.id, String(Math.max(0, l.quantite - l.quantite_recue))])),
    )
  }

  const handleSaveReception = async () => {
    if (!receptCmd) return
    const lignes = receptCmd.lignes
      .map((l) => ({ ligne_commande_id: l.id, quantite_recue: Number(receptQtys[l.id] || 0) }))
      .filter((l) => l.quantite_recue > 0)
    if (lignes.length === 0) {
      alert('Saisissez au moins une quantité à recevoir.')
      return
    }
    setSaving(true)
    try {
      await achatsService.createReception(receptCmd.id, { lignes })
      setReceptCmd(null)
      await load()
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Erreur lors de la réception.')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveFacture = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const cmdId = facFromCmd ? Number(facFromCmd) : null
    const cmd = commandes.find((c) => c.id === cmdId)
    const montantHt = Number(form.get('montant_ht') || 0)
    if (!form.get('numero') || !form.get('fournisseur_id')) {
      alert('Numéro et fournisseur obligatoires.')
      return
    }
    setSaving(true)
    try {
      await achatsService.createFacture({
        fournisseur_id: Number(form.get('fournisseur_id')),
        commande_id: cmdId,
        chantier_id: cmd?.chantier_id ?? (form.get('chantier_id') ? Number(form.get('chantier_id')) : null),
        numero: String(form.get('numero')).trim(),
        date_echeance: (form.get('date_echeance') as string) || null,
        taux_tva: Number(form.get('taux_tva') || 20),
        montant_ht: montantHt,
      })
      setShowFacModal(false)
      setFacFromCmd('')
      setTab('factures')
      await load()
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Erreur lors de la création de la facture.')
    } finally {
      setSaving(false)
    }
  }

  const handleAddPaiement = async () => {
    if (!payFac) return
    const montant = Number(payMontant)
    if (!montant || montant <= 0) {
      alert('Montant invalide.')
      return
    }
    setSaving(true)
    try {
      await achatsService.addPaiement(payFac.id, {
        montant,
        mode_paiement: payMode,
        reference: payRef || undefined,
      })
      setPayFac(null)
      setPayMontant('')
      setPayRef('')
      await load()
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Erreur lors du paiement.')
    } finally {
      setSaving(false)
    }
  }

  // ===== Rendu =====
  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h2 className="mb-1 text-secondary"><i className="bi bi-cart-check me-2"></i>Achats fournisseurs</h2>
          <p className="text-secondary mb-0">Commandes, réceptions et factures fournisseurs — alimente le stock et le coût réel des chantiers.</p>
        </div>
        {canWrite && (
          <div className="d-flex gap-2">
            <button className="btn btn-outline-secondary fw-bold" onClick={openCreateCmd}>
              <i className="bi bi-plus-lg me-1"></i>Nouvelle commande
            </button>
            <button className="btn btn-outline-primary fw-bold" onClick={() => setShowFacModal(true)}>
              <i className="bi bi-file-earmark-plus me-1"></i>Facture fournisseur
            </button>
          </div>
        )}
      </div>

      {/* Bandeau échéances */}
      {aPayer.length > 0 && (
        <div className={`alert ${retards.length ? 'alert-danger' : 'alert-info'} d-flex justify-content-between align-items-center`} role="alert">
          <span>
            <i className="bi bi-clock-history me-2"></i>
            <strong>{aPayer.length}</strong> facture(s) en attente — {fmtAr(totalEnAttente)}
            {retards.length > 0 && <> · <strong className="text-danger">{retards.length} en retard</strong></>}
          </span>
          <button className="btn btn-sm btn-outline-dark" onClick={() => setTab('echeances')}>Voir les échéances</button>
        </div>
      )}

      {err && <div className="alert alert-danger">{err}</div>}

      <ul className="nav nav-tabs mb-3">
        {(['commandes', 'factures', 'echeances'] as const).map((t) => (
          <li className="nav-item" key={t}>
            <button className={`nav-link ${tab === t ? 'active fw-bold' : ''}`} onClick={() => setTab(t)}>
              {t === 'commandes' && <>Commandes ({commandes.length})</>}
              {t === 'factures' && <>Factures ({factures.length})</>}
              {t === 'echeances' && <>Échéances {retards.length > 0 && <span className="badge bg-danger ms-1">{retards.length}</span>}</>}
            </button>
          </li>
        ))}
      </ul>

      {loading ? (
        <TableSkeleton rows={5} columns={6} />
      ) : tab === 'commandes' && (
        <div className="card border-0 shadow-sm"><div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead><tr>
              <th>Numéro</th><th>Fournisseur</th><th>Chantier</th><th>Statut</th>
              <th className="text-end">Montant TTC</th><th>Prévue le</th><th></th>
            </tr></thead>
            <tbody>
              {commandes.length === 0 && (
                <tr><td colSpan={7} className="text-center text-muted py-4">Aucune commande. Créez la première.</td></tr>
              )}
              {commandes.map((c) => {
                const st = STATUTS_CMD[c.statut] || STATUTS_CMD.brouillon
                return (
                  <tr key={c.id}>
                    <td className="font-monospace small fw-bold">{c.numero}</td>
                    <td>{c.fournisseur_nom}</td>
                    <td className="small text-muted">{c.chantier_nom || '-'}</td>
                    <td><span className={`badge ${st.badge}`}>{st.label}</span></td>
                    <td className="text-end fw-bold">{fmtAr(c.montant_ttc)}</td>
                    <td className="small">{fmtDate(c.date_livraison_prevue)}</td>
                    <td className="text-end">
                      {canWrite && ['confirmee', 'partiellement_recue'].includes(c.statut) && (
                        <button className="btn btn-sm btn-outline-success me-1" onClick={() => openReception(c)} title="Réceptionner">
                          <i className="bi bi-box-seam"></i>
                        </button>
                      )}
                      {canWrite && c.statut === 'brouillon' && (
                        <button className="btn btn-sm btn-outline-primary me-1" onClick={() => achatsService.setStatutCommande(c.id, 'confirmee').then(load)} title="Confirmer">
                          <i className="bi bi-check2-circle"></i>
                        </button>
                      )}
                      {canWrite && ['recue', 'confirmee', 'partiellement_recue'].includes(c.statut) && (
                        <button className="btn btn-sm btn-outline-secondary" title="Créer la facture" onClick={() => { setFacFromCmd(c.id); setShowFacModal(true); }}>
                          <i className="bi bi-file-earmark-plus"></i>
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div></div>
      )}

      {tab === 'factures' && (
        <div className="card border-0 shadow-sm"><div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead><tr>
              <th>Numéro</th><th>Fournisseur</th><th>Chantier</th><th>Échéance</th>
              <th className="text-end">TTC</th><th className="text-end">Restant</th><th>Statut</th><th></th>
            </tr></thead>
            <tbody>
              {factures.length === 0 && (
                <tr><td colSpan={8} className="text-center text-muted py-4">Aucune facture fournisseur.</td></tr>
              )}
              {factures.map((f) => {
                const st = STATUTS_FAC[f.statut] || STATUTS_FAC.a_payer
                const restant = f.restant_a_payer ?? (f.montant_ttc - f.montant_paye)
                const enRetard = ['a_payer', 'partiellement_payee'].includes(f.statut) && f.date_echeance && new Date(f.date_echeance) < new Date()
                return (
                  <tr key={f.id}>
                    <td className="font-monospace small fw-bold">{f.numero}</td>
                    <td>{f.fournisseur_nom}</td>
                    <td className="small text-muted">{f.chantier_nom || '-'}</td>
                    <td className={`small ${enRetard ? 'text-danger fw-bold' : ''}`}>{fmtDate(f.date_echeance)}</td>
                    <td className="text-end">{fmtAr(f.montant_ttc)}</td>
                    <td className="text-end fw-bold">{fmtAr(restant)}</td>
                    <td><span className={`badge ${st.badge}`}>{st.label}</span></td>
                    <td className="text-end">
                      {canWrite && ['a_payer', 'partiellement_payee'].includes(f.statut) && (
                        <button className="btn btn-sm btn-outline-success" onClick={() => setPayFac(f)} title="Enregistrer un paiement">
                          <i className="bi bi-cash-coin"></i>
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div></div>
      )}

      {tab === 'echeances' && (
        <div className="card border-0 shadow-sm"><div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead><tr>
              <th>Facture</th><th>Fournisseur</th><th>Échéance</th><th className="text-end">Restant à payer</th><th></th>
            </tr></thead>
            <tbody>
              {aPayer.length === 0 && (
                <tr><td colSpan={5} className="text-center text-success py-4"><i className="bi bi-check-circle me-2"></i>Aucune facture en attente.</td></tr>
              )}
              {[...aPayer].sort((a, b) => (a.date_echeance || '').localeCompare(b.date_echeance || '')).map((f) => {
                const restant = f.restant_a_payer ?? (f.montant_ttc - f.montant_paye)
                const enRetard = f.date_echeance && new Date(f.date_echeance) < new Date()
                return (
                  <tr key={f.id}>
                    <td className="font-monospace small fw-bold">{f.numero}</td>
                    <td>{f.fournisseur_nom}</td>
                    <td className={enRetard ? 'text-danger fw-bold' : ''}>{fmtDate(f.date_echeance)} {enRetard && <span className="badge bg-danger ms-1">Retard</span>}</td>
                    <td className="text-end fw-bold">{fmtAr(restant)}</td>
                    <td className="text-end">
                      {canWrite && (
                        <button className="btn btn-sm btn-outline-success" onClick={() => setPayFac(f)}>
                          <i className="bi bi-cash-coin me-1"></i>Payer
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div></div>
      )}

      {/* ===== Modale création commande ===== */}
      {showCmdModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'var(--overlay)' }}>
          <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content">
              <form onSubmit={handleSaveCommande}>
                <div className="modal-header">
                  <h5 className="modal-title fw-bold"><i className="bi bi-cart-plus me-2"></i>Nouvelle commande fournisseur</h5>
                  <button type="button" className="btn-close" onClick={() => setShowCmdModal(false)}></button>
                </div>
                <div className="modal-body">
                  <div className="row g-3 mb-2">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Fournisseur *</label>
                      <select className="form-select" name="fournisseur_id" required>
                        <option value="">— Choisir —</option>
                        {fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label small fw-semibold">Chantier</label>
                      <select className="form-select" name="chantier_id" defaultValue="">
                        <option value="">— Aucun —</option>
                        {chantiers.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label small fw-semibold">Livraison prévue</label>
                      <input type="date" className="form-control" name="date_livraison_prevue" />
                    </div>
                  </div>

                  <h6 className="fw-bold mt-3 mb-2">Lignes de commande</h6>
                  {lignesForm.map((l, i) => (
                    <div className="row g-2 mb-2" key={i}>
                      <div className="col-md-4">
                        <select className="form-select form-select-sm" value={l.article_id} onChange={(e) => pickArticle(i, e.target.value)}>
                          <option value="">— Article du catalogue (optionnel) —</option>
                          {articles.map((a) => <option key={a.id} value={a.id}>{a.reference ? `${a.reference} — ` : ''}{a.nom}</option>)}
                        </select>
                      </div>
                      <div className="col-md-3">
                        <input className="form-control form-control-sm" placeholder="Désignation *" value={l.designation}
                          onChange={(e) => changeLigne(i, { designation: e.target.value })} />
                      </div>
                      <div className="col-md-2">
                        <input type="number" min={0} step="any" className="form-control form-control-sm" placeholder="Qté *" value={l.quantite}
                          onChange={(e) => changeLigne(i, { quantite: e.target.value })} />
                      </div>
                      <div className="col-md-2">
                        <input type="number" min={0} step="any" className="form-control form-control-sm" placeholder="P.U." value={l.prix_unitaire}
                          onChange={(e) => changeLigne(i, { prix_unitaire: e.target.value })} />
                      </div>
                      <div className="col-md-1">
                        <button type="button" className="btn btn-sm btn-outline-danger w-100" onClick={() => removeLigne(i)} disabled={lignesForm.length === 1}>
                          <i className="bi bi-x"></i>
                        </button>
                      </div>
                    </div>
                  ))}
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={addLigne}>
                    <i className="bi bi-plus-lg me-1"></i>Ajouter une ligne
                  </button>

                  <div className="row g-3 mt-3">
                    <div className="col-md-3">
                      <label className="form-label small fw-semibold">TVA %</label>
                      <input type="number" name="taux_tva" className="form-control form-control-sm" defaultValue={20} min={0} max={100} />
                    </div>
                    <div className="col-md-9">
                      <label className="form-label small fw-semibold">Notes</label>
                      <input type="text" className="form-control form-control-sm" name="notes" placeholder="Conditions, référence marché..." />
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowCmdModal(false)}>Annuler</button>
                  <button type="submit" className="btn btn-primary fw-bold" disabled={saving}>
                    {saving ? 'Création...' : 'Créer la commande'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ===== Modale réception ===== */}
      {receptCmd && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'var(--overlay)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title fw-bold"><i className="bi bi-box-seam me-2"></i>Réception — {receptCmd.numero}</h5>
                <button type="button" className="btn-close" onClick={() => setReceptCmd(null)}></button>
              </div>
              <div className="modal-body">
                <p className="text-muted small">Les quantités reçues conformes sont ajoutées automatiquement au stock (entrée + mouvement).</p>
                <table className="table table-sm align-middle">
                  <thead><tr><th>Désignation</th><th className="text-end">Commandé</th><th className="text-end">Déjà reçu</th><th className="text-end">Restant</th><th style={{ width: 130 }}>Recevoir</th></tr></thead>
                  <tbody>
                    {receptCmd.lignes.map((l) => {
                      const restant = Math.max(0, l.quantite - l.quantite_recue)
                      return (
                        <tr key={l.id}>
                          <td className="small">{l.designation}</td>
                          <td className="text-end small">{l.quantite}</td>
                          <td className="text-end small">{l.quantite_recue}</td>
                          <td className="text-end small fw-bold">{restant}</td>
                          <td>
                            <input type="number" min={0} max={restant} step="any" className="form-control form-control-sm"
                              value={receptQtys[l.id] ?? '0'} disabled={restant === 0}
                              onChange={(e) => setReceptQtys((s) => ({ ...s, [l.id]: e.target.value }))} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <div className="mb-2">
                  <label className="form-label small fw-semibold">Dépôt de réception</label>
                  <select className="form-select form-select-sm" style={{ maxWidth: 300 }} id="recept-depot">
                    <option value="">— Aucun —</option>
                    {depots.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline-secondary" onClick={() => setReceptCmd(null)}>Annuler</button>
                <button className="btn btn-success fw-bold" disabled={saving} onClick={() => {
                  const depotSel = document.getElementById('recept-depot') as HTMLSelectElement | null
                  if (receptCmd && depotSel?.value) {
                    achatsService.createReception(receptCmd.id, {
                      depot_id: Number(depotSel.value),
                      lignes: receptCmd.lignes.map((l) => ({ ligne_commande_id: l.id, quantite_recue: Number(receptQtys[l.id] || 0) })).filter((l) => l.quantite_recue > 0),
                    }).then(() => { setReceptCmd(null); load() }).catch((e) => alert(e?.response?.data?.detail || 'Erreur'))
                  } else {
                    handleSaveReception()
                  }
                }}>
                  {saving ? 'Validation...' : 'Valider la réception'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Modale facture ===== */}
      {showFacModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'var(--overlay)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <form onSubmit={handleSaveFacture}>
                <div className="modal-header">
                  <h5 className="modal-title fw-bold"><i className="bi bi-file-earmark-text me-2"></i>Facture fournisseur</h5>
                  <button type="button" className="btn-close" onClick={() => setShowFacModal(false)}></button>
                </div>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Fournisseur *</label>
                      <select className="form-select" name="fournisseur_id" required defaultValue={facFromCmd ? String(commandes.find((c) => c.id === Number(facFromCmd))?.fournisseur_id ?? '') : ''}>
                        <option value="">— Choisir —</option>
                        {fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">N° facture fournisseur *</label>
                      <input type="text" className="form-control" name="numero" required />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Commande liée</label>
                      <select className="form-select" value={facFromCmd} onChange={(e) => setFacFromCmd(e.target.value ? Number(e.target.value) : '')}>
                        <option value="">— Aucune —</option>
                        {commandes.filter((c) => !['brouillon', 'annulee'].includes(c.statut)).map((c) => (
                          <option key={c.id} value={c.id}>{c.numero} ({fmtAr(c.montant_ht)} HT)</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Chantier</label>
                      <select className="form-select" name="chantier_id" defaultValue="">
                        <option value="">— Aucun —</option>
                        {chantiers.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">Montant HT *</label>
                      <input type="number" min={0} step="any" className="form-control" name="montant_ht" required
                        defaultValue={facFromCmd ? String(commandes.find((c) => c.id === Number(facFromCmd))?.montant_ht ?? '') : ''} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">TVA %</label>
                      <input type="number" className="form-control" name="taux_tva" defaultValue={20} min={0} max={100} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">Échéance</label>
                      <input type="date" className="form-control" name="date_echeance" />
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowFacModal(false)}>Annuler</button>
                  <button type="submit" className="btn btn-primary fw-bold" disabled={saving}>
                    {saving ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ===== Modale paiement ===== */}
      {payFac && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'var(--overlay)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title fw-bold"><i className="bi bi-cash-coin me-2"></i>Paiement — {payFac.numero}</h5>
                <button type="button" className="btn-close" onClick={() => setPayFac(null)}></button>
              </div>
              <div className="modal-body">
                <p className="text-muted small">
                  Restant à payer : <strong className="text-dark">{fmtAr(payFac.montant_ttc - payFac.montant_paye)}</strong> sur {fmtAr(payFac.montant_ttc)}
                </p>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold">Montant *</label>
                    <input type="number" min={0} step="any" className="form-control" value={payMontant}
                      onChange={(e) => setPayMontant(e.target.value)} placeholder={String(payFac.montant_ttc - payFac.montant_paye)} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold">Mode *</label>
                    <select className="form-select" value={payMode} onChange={(e) => setPayMode(e.target.value)}>
                      {Object.entries(MODES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div className="col-12">
                    <label className="form-label small fw-semibold">Référence</label>
                    <input type="text" className="form-control" value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="N° transaction / chèque..." />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline-secondary" onClick={() => setPayFac(null)}>Annuler</button>
                <button className="btn btn-success fw-bold" disabled={saving} onClick={handleAddPaiement}>
                  {saving ? 'Enregistrement...' : 'Enregistrer le paiement'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AchatsPage
