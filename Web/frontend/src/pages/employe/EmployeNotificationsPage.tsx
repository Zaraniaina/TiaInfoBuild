import { useEffect, useState } from 'react'
import { employeTerrainService } from '@/services/employeTerrain.service'
import type { NotificationTerrain } from '@/types'

export function EmployeNotificationsPage() {
  const [items, setItems] = useState<NotificationTerrain[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    employeTerrainService.getNotifications()
          .then((r) => setItems(r.items))
      .catch(() => setErr('Impossible de charger vos notifications'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const marquerLu = async (n: NotificationTerrain) => {
    if (n.lu) return
    try {
      await employeTerrainService.marquerNotificationLue(n.id)
      load()
    } catch { /* silently */ }
  }

  if (loading) return <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
  if (err) return <div className="alert alert-danger m-3">{err}</div>

  const nonLues = items.filter((n) => !n.lu).length

  return (
    <div className="container-fluid py-3">
      <h5 className="mb-3">🔔 Notifications {nonLues > 0 && <span className="badge bg-danger ms-1">{nonLues}</span>}</h5>
      {items.length === 0 ? <div className="text-muted">Aucune notification</div> : (
        <div className="list-group">
          {items.map((n) => (
            <div key={n.id} className={`list-group-item list-group-item-action ${n.lu ? '' : 'list-group-item-warning'}`} onClick={() => marquerLu(n)} style={{ cursor: n.lu ? 'default' : 'pointer' }}>
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <strong>{n.titre}</strong>
                  <div className="text-muted small">{n.created_at?.slice(0, 10)} {n.created_at?.slice(11, 16)}</div>
                  <div className="small mt-1">{n.message}</div>
                </div>
                {!n.lu && <span className="badge bg-danger">Nouveau</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
