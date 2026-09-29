import { useEffect, useState } from 'react'
import { employeTerrainService } from '@/services/employeTerrain.service'
import type { Pointage } from '@/types'
import { PageSkeleton } from '@/components/ui/Skeleton'
import { WorkerBadgeCard } from '@/components/pointage/WorkerBadgeCard'

/**
 * Mon Badge QR (portail employé) — rendu identique aux badges RH / planche /
 * aperçu settings via le composant partagé WorkerBadgeCard. Seule la carte
 * s'imprime (largeur 85mm, format carte).
 */
export function EmployeBadgePage() {
  const [badge, setBadge] = useState<Record<string, any> | null>(null)
  const [pointages, setPointages] = useState<Pointage[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([employeTerrainService.getMonBadge(), employeTerrainService.getPointages()])
      .then(([b, p]) => {
        setBadge(b)
        setPointages(p)
      })
      .catch(() => setErr('Impossible de charger le badge'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <PageSkeleton />
  if (err) return <div className="alert alert-danger m-3">{err}</div>
  if (!badge) return null

  return (
    <div className="container-fluid py-3">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #badge-printable, #badge-printable * { visibility: visible !important; }
          #badge-printable { position: absolute; left: 0; top: 0; width: 85mm !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0"><i className="bi bi-person-badge me-2"></i>Mon Badge QR</h5>
        <button className="btn btn-outline-secondary fw-bold" onClick={() => window.print()}>
          <i className="bi bi-printer me-2"></i>Imprimer le badge
        </button>
      </div>

      {/* Carte badge imprimable — même design que les badges RH (WorkerBadgeCard) */}
      <div id="badge-printable" className="mx-auto" style={{ width: '100%', maxWidth: 360 }}>
        <WorkerBadgeCard
          employe={badge}
          entrepriseLogo={badge.entreprise_logo || undefined}
          entrepriseNom={badge.entreprise_nom || undefined}
          enteteBadge={badge.entete_badge || undefined}
        />
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
