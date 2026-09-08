import { espaceClientService, Notification } from '@/services/espaceClient.service'
import {
  PageHeader, useListePage, EtatChargement, EtatErreur, Vide, fmtDate,
} from './shared'

export function ClientNotificationsPage() {
  const { items, loading, error, recharger } = useListePage<Notification>(
    () => espaceClientService.getNotifications()
  )

  const marquerLue = async (id: number) => {
    try {
      await espaceClientService.marquerNotificationLue(id)
      await recharger()
    } catch {
      // silencieux
    }
  }

  if (loading) return <EtatChargement />
  if (error) return <EtatErreur message={error} onRetry={recharger} />

  return (
    <div className="container-fluid py-4">
      <PageHeader titre="Notifications" icone="bi-bell" sousTitre="Notifications concernant vos projets" />
      {items.length === 0 ? (
        <Vide message="Aucune notification" />
      ) : (
        <div className="card border-0 shadow-sm">
          <div className="list-group list-group-flush">
            {items.map((n) => (
              <div key={n.id} className={`list-group-item d-flex align-items-start gap-3 ${n.lu ? '' : 'list-group-item-warning'}`}>
                <i className={`bi ${n.lu ? 'bi-envelope-open' : 'bi-envelope-fill text-primary'} mt-1`}></i>
                <div className="flex-grow-1">
                  <div className="d-flex justify-content-between">
                    <span className="fw-semibold">{n.titre}</span>
                    <small className="text-muted">{fmtDate(n.created_at)}</small>
                  </div>
                  <div className="small">{n.message}</div>
                </div>
                {!n.lu && (
                  <button className="btn btn-sm btn-outline-secondary" onClick={() => marquerLue(n.id)} title="Marquer comme lu">
                    <i className="bi bi-check2"></i>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
