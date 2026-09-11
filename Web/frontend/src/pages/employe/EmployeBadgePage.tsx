import { useEffect, useState } from 'react'
import { employeTerrainService } from '@/services/employeTerrain.service'
import type { Employe, Pointage } from '@/types'
import { PageSkeleton } from '@/components/ui/Skeleton'

// Arrière-plan/Branding de la carte badge + règle d'impression (seule la carte s'imprime)
const BADGE_STYLE = `
  @media print {
    body * { visibility: hidden !important; }
    #badge-printable, #badge-printable * { visibility: visible !important; }
    #badge-printable { position: absolute; left: 0; top: 0; width: 85mm !important; }
    .no-print { display: none !important; }
  }
  .badge-card {
    width: 85mm; margin: 0 auto;
    border-radius: 14px; overflow: hidden; color: #fff;
    background: linear-gradient(150deg, #1e3a8a 0%, #2563eb 55%, #38bdf8 100%);
  }
  .badge-card .badge-photo {
    width: 96px; height: 96px; border-radius: 50%;
    object-fit: cover; border: 3px solid rgba(255,255,255,.85);
    background: rgba(255,255,255,.25);
  }
`

function initials(emp: Employe) {
  const parts = [emp.prenom, emp.nom].filter(Boolean) as string[]
  return parts.map((p) => p[0]?.toUpperCase() || '').join('').slice(0, 2) || '—'
}

export function EmployeBadgePage() {
  const [employe, setEmploye] = useState<Employe | null>(null)
  const [codeQr, setCodeQr] = useState('')
  const [pointages, setPointages] = useState<Pointage[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([employeTerrainService.getMonBadge(), employeTerrainService.getPointages()])
      .then(([b, p]) => {
        setEmploye(b.employe)
        setCodeQr(b.code_qr)
        setPointages(p)
      })
      .catch(() => setErr('Impossible de charger le badge'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <PageSkeleton />
  if (err) return <div className="alert alert-danger m-3">{err}</div>
  if (!employe) return null

  return (
    <div className="container-fluid py-3">
      <style>{BADGE_STYLE}</style>
      <div className="no-print d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0"><i className="bi bi-person-badge me-2"></i>Mon Badge QR</h5>
        <button className="btn btn-outline-secondary fw-bold" onClick={() => window.print()}>
          <i className="bi bi-printer me-2"></i>Imprimer le badge
        </button>
      </div>

      {/* Carte badge imprimable */}
      <div id="badge-printable" className="m-3">
        <div className="badge-card shadow">
          {/* En-tête société */}
          <div className="px-3 pt-3 pb-2 d-flex justify-content-between align-items-center">
            <div className="fw-bold small">TIA INFO BUILD</div>
            <i className="bi bi-building fs-5"></i>
          </div>

          {/* Photo + identité */}
          <div className="px-3 pb-3 text-center">
            {employe.photo ? (
              <img src={employe.photo} alt="Photo employé" className="badge-photo mb-2" />
            ) : (
              <div className="badge-photo d-flex align-items-center justify-content-center fs-1 fw-bold mb-2">
                {initials(employe)}
              </div>
            )}
            <h5 className="mb-0 fw-bold text-uppercase">{employe.prenom} {employe.nom}</h5>
            <div className="small opacity-75">{employe.poste || 'Employé'}</div>
            <div className="small opacity-75">
              Matricule : <span className="fw-semibold">{employe.matricule || `EMP-${employe.id}`}</span>
            </div>
          </div>

          {/* QR Code (rendu littéral du code — scannable par le chef de chantier) */}
          <div className="px-3 pb-3">
            <div className="bg-white rounded-3 p-3 mx-auto text-center" style={{ width: 160 }}>
              <div className="font-monospace fw-bold text-dark" style={{ lineHeight: 1.1 }}>
                {codeQr.split('-').join(' - ')}
              </div>
              <div className="text-muted small mt-1" style={{ fontSize: 9 }}>Scannez ce code pour pointer</div>
            </div>
          </div>
        </div>
      </div>

      {/* Historique des pointages (non imprimé) */}
      <div className="no-print">
        <h6 className="mb-2 mt-4"><i className="bi bi-stopwatch"></i> Historique des pointages</h6>
        {pointages.length === 0 ? (
          <div className="text-muted">Aucun pointage enregistré</div>
        ) : (
          <div className="table-responsive">
            <table className="table table-sm">
              <thead><tr><th>Date</th><th>Heure</th><th>Type</th><th>Méthode</th></tr></thead>
              <tbody>
                {pointages.slice(0, 20).map((p) => (
                  <tr key={p.id}>
                    <td>{p.date_jour}</td>
                    <td>{p.heure_debut || p.heure_fin || '-'}</td>
                    <td>{p.type}</td>
                    <td>{p.methode_pointage || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
