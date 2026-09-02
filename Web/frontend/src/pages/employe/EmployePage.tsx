import { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { api } from '@/services/api'
import { QRScannerModal } from '@/components/pointage/QRScannerModal'
import { WorkerBadgeCard } from '@/components/pointage/WorkerBadgeCard'
import type { Pointage, Materiel, MouvementStock } from '@/types'

export function EmployePage() {
  const { user } = useAuthStore()
  const [showQRModal, setShowQRModal] = useState(false)
  const [showBadgeModal, setShowBadgeModal] = useState(false)
  const [badgeData, setBadgeData] = useState<any>(null)
  const [badgeLoading, setBadgeLoading] = useState(false)
  const [pointages, setPointages] = useState<Pointage[]>([])
  const [materiels, setMateriels] = useState<Materiel[]>([])
  const [consommations, setConsommations] = useState<MouvementStock[]>([])
  const [loading, setLoading] = useState(true)
  const [taches, setTaches] = useState<any[]>([])

  const loadData = async () => {
    setLoading(true)
    try {
      if (!user?.entreprise_id || !user?.id) return
      const [pointagesRes, materielsRes, consommationsRes] = await Promise.all([
        api.get<Pointage[]>('/rh/pointages', { params: { employe_id: user.id, entreprise_id: user.entreprise_id } }).catch(() => ({ data: [] })),
        api.get<Materiel[]>('/materiels/', { params: { entreprise_id: user.entreprise_id } }).catch(() => ({ data: [] })),
        api.get<MouvementStock[]>('/stocks/mouvements', { params: { entreprise_id: user.entreprise_id } }).catch(() => ({ data: [] })),
      ])
      setPointages(pointagesRes.data || [])
      setMateriels(materielsRes.data || [])
      setConsommations(consommationsRes.data || [])
    } catch {
      // noop
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [user])

  const handleQRScan = async (qrToken: string) => {
    try {
      await api.post('/rh/pointages/qr-checkin', { qr_token: qrToken, mode: 'entree' })
      alert('Pointage d\'entrée enregistré avec succès')
      setShowQRModal(false)
      loadData()
    } catch {
      alert('Erreur lors du pointage. Vérifiez le QR code.')
    }
  }

  const openBadge = async () => {
    if (!user?.id) return
    setShowBadgeModal(true)
    setBadgeLoading(true)
    try {
      const data = await api.get(`/rh/employes/${user.id}/badge-qr`).then(r => r.data)
      setBadgeData(data)
    } catch {
      setBadgeData(null)
    } finally {
      setBadgeLoading(false)
    }
  }

  const printBadge = () => {
    const badgeEl = document.getElementById('employe-badge-print-area')
    if (!badgeEl) return
    const printWindow = window.open('', '_blank', 'width=800,height=600')
    if (!printWindow) return
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Badge - ${badgeData?.nom || ''}</title><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css"><style>body{background:#fff;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0}.card{border:0}.text-muted{color:#6c757d!important}</style></head><body>`)
    printWindow.document.write(badgeEl.innerHTML)
    printWindow.document.write('</body></html>')
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  const downloadBadge = () => {
    const qrUrl = badgeData?.code_qr_badge
      ? `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(badgeData.code_qr_badge)}`
      : null
    if (!qrUrl) return
    const link = document.createElement('a')
    link.href = qrUrl
    link.download = `badge-${badgeData.matricule || badgeData.id}.png`
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="container-fluid py-4">
      <div className="mb-4">
        <h2 className="mb-1 text-secondary"><i className="bi bi-person-badge me-2"></i>Mon Espace Terrain</h2>
        <p className="text-secondary mb-0">Bienvenue, {user?.nom} {user?.prenom}</p>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-secondary" role="status"></div>
        </div>
      ) : (
        <div className="row g-4">
          <div className="col-md-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white border-0 pt-4 px-4">
                <h5 className="fw-bold mb-0"><i className="bi bi-qr-code-scan me-2"></i>Pointage</h5>
              </div>
              <div className="card-body">
                <p className="text-muted small">Scannez le QR code du chantier pour enregistrer votre présence.</p>
                <div className="d-grid gap-2">
                  <button className="btn btn-outline-secondary fw-bold" onClick={() => setShowQRModal(true)}>
                    <i className="bi bi-camera me-2"></i>Scanner QR Code Chantier
                  </button>
                  <button className="btn btn-outline-primary fw-bold" onClick={openBadge}>
                    <i className="bi bi-qr-code me-2"></i>Mon Badge
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="col-md-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white border-0 pt-4 px-4">
                <h5 className="fw-bold mb-0"><i className="bi bi-tools me-2"></i>Mon Matériel Affecté</h5>
              </div>
              <div className="card-body">
                {materiels.length === 0 ? (
                  <p className="text-muted small mb-0">Aucun matériel affecté pour le moment.</p>
                ) : (
                  <ul className="list-group list-group-flush">
                    {materiels.map(m => (
                      <li key={m.id} className="list-group-item px-0">
                        <div className="d-flex justify-content-between">
                          <span className="fw-semibold">{m.nom}</span>
                          <span className="badge bg-light text-dark border">{m.statut}</span>
                        </div>
                        <small className="text-muted">{m.type} — N° {m.numero_serie || m.id}</small>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="col-md-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white border-0 pt-4 px-4">
                <h5 className="fw-bold mb-0"><i className="bi bi-clock-history me-2"></i>Mon Historique de Présence</h5>
              </div>
              <div className="card-body">
                {pointages.length === 0 ? (
                  <p className="text-muted small mb-0">Aucun pointage enregistré.</p>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-sm mb-0">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Entrée</th>
                          <th>Sortie</th>
                          <th>Statut</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pointages.slice(0, 10).map(p => (
                          <tr key={p.id}>
                            <td>{p.date_pointage}</td>
                            <td>{p.heure_entree || '—'}</td>
                            <td>{p.heure_sortie || '—'}</td>
                            <td><span className="badge bg-light text-dark border">{p.statut}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="col-md-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white border-0 pt-4 px-4">
                <h5 className="fw-bold mb-0"><i className="bi bi-box-seam me-2"></i>Mes Consommations</h5>
              </div>
              <div className="card-body">
                {consommations.length === 0 ? (
                  <p className="text-muted small mb-0">Aucune consommation déclarée.</p>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-sm mb-0">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Article</th>
                          <th>Quantité</th>
                          <th>Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {consommations.slice(0, 10).map(c => (
                          <tr key={c.id}>
                            <td>{c.date_mouvement}</td>
                            <td>{c.article_id}</td>
                            <td>{c.quantite}</td>
                            <td><span className="badge bg-light text-dark border">{c.type_mouvement}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <QRScannerModal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        onPointageSuccess={() => { loadData() }}
      />

      {showBadgeModal && (
        <div className="modal show d-block" tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Mon Badge</h5>
                <button type="button" className="btn-close" onClick={() => setShowBadgeModal(false)}></button>
              </div>
              <div className="modal-body">
                {badgeLoading ? (
                  <div className="text-center py-4">
                    <div className="spinner-border text-secondary" role="status"></div>
                  </div>
                ) : badgeData ? (
                  <div id="employe-badge-print-area">
                    <WorkerBadgeCard
                      employe={{
                        ...(user || {}),
                        ...badgeData,
                        code_qr_badge: badgeData.code_qr_badge,
                      }}
                    />
                  </div>
                ) : (
                  <p className="text-muted text-center">Impossible de charger le badge.</p>
                )}
              </div>
              {badgeData && (
                <div className="modal-footer">
                  <button className="btn btn-outline-secondary" onClick={printBadge}>
                    <i className="bi bi-printer me-2"></i>Imprimer
                  </button>
                  <button className="btn btn-primary" onClick={downloadBadge}>
                    <i className="bi bi-download me-2"></i>Télécharger QR
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {showBadgeModal && <div className="modal-backdrop show"></div>}
    </div>
  )
}
