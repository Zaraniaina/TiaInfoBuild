import { useEffect, useState } from 'react'
import { employeTerrainService } from '@/services/employeTerrain.service'

const typeLabel: Record<string, string> = {
  entree: 'Entrée', sortie: 'Sortie', debut_pause: 'Début pause', fin_pause: 'Fin pause',
}

export function EmployePresencePage() {
  const [presences, setPresences] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    employeTerrainService.getPresence()
      .then(setPresences)
      .catch(() => setErr('Impossible de charger les présences'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const pointer = async (typePointage: string) => {
    try {
      await employeTerrainService.enregistrerPresence({ type_pointage: typePointage })
      load()
    } catch { alert('Erreur lors du pointage') }
  }

  if (loading) return <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
  if (err) return <div className="alert alert-danger m-3">{err}</div>

  return (
    <div className="container-fluid py-3">
      <h5 className="mb-3"><i className="bi bi-stopwatch"></i> Mon activité</h5>

      <div className="d-flex gap-2 mb-3 flex-wrap">
        <button className="btn btn-success" onClick={() => pointer('entree')}>🟢 Entrée</button>
        <button className="btn btn-warning" onClick={() => pointer('debut_pause')}>☕ Début pause</button>
        <button className="btn btn-info" onClick={() => pointer('fin_pause')}><i className="bi bi-play-fill"></i> Fin pause</button>
        <button className="btn btn-danger" onClick={() => pointer('sortie')}>🔴 Sortie</button>
      </div>

      {presences.length === 0 ? <div className="text-muted">Aucun enregistrement aujourd'hui</div> : (
        <div className="table-responsive">
          <table className="table table-sm">
            <thead><tr><th>Date</th><th>Heure</th><th>Type</th></tr></thead>
            <tbody>
              {presences.slice(0, 20).map((p, i) => (
                <tr key={i}>
                  <td>{p.date}</td>
                  <td>{p.heure}</td>
                  <td>{typeLabel[p.type_pointage] || p.type_pointage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
