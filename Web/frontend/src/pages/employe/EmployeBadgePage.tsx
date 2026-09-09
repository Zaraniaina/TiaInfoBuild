import { useEffect, useState } from 'react'
import { employeTerrainService } from '@/services/employeTerrain.service'
import type { Pointage } from '@/types'

export function EmployeBadgePage() {
  const [badge, setBadge] = useState<{ employe: any; code_qr: string } | null>(null)
  const [pointages, setPointages] = useState<Pointage[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      employeTerrainService.getMonBadge(),
      employeTerrainService.getPointages(),
    ])
      .then(([b, p]) => { setBadge(b); setPointages(p) })
      .catch(() => setErr('Impossible de charger le badge'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
  if (err) return <div className="alert alert-danger m-3">{err}</div>
  if (!badge) return null

  const emp = badge.employe

  return (
    <div className="container-fluid py-3">
      <h5 className="mb-3"><i className="bi bi-person-badge"></i> Mon Badge QR</h5>

      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body text-center">
          <div className="bg-white border rounded p-3 d-inline-block mb-3">
            <div style={{ width: 120, height: 120, background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>
              <div className="text-center">
                <div style={{ fontSize: 32 }}><i className="bi bi-qr-code"></i></div>
                <div>QR Code</div>
                <div className="text-muted">{badge.code_qr}</div>
              </div>
            </div>
          </div>
          <h5 className="mb-1">{emp.prenom} {emp.nom}</h5>
          <div className="text-muted">Matricule : {emp.matricule || `EMP-${emp.id}`}</div>
          {emp.poste && <div className="text-muted">Poste : {emp.poste}</div>}
          <div className="mt-2">
            <span className="badge bg-primary">Code : {badge.code_qr}</span>
          </div>
        </div>
      </div>

      <h6 className="mb-2"><i className="bi bi-stopwatch"></i> Historique des pointages</h6>
      {pointages.length === 0 ? <div className="text-muted">Aucun pointage enregistré</div> : (
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
  )
}
