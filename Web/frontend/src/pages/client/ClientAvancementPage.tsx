import { espaceClientService } from '@/services/espaceClient.service'
import {
  PageHeader, useListePage, EtatChargement, EtatErreur, Vide,
} from './shared'

export function ClientAvancementPage() {
  const { items, loading, error, recharger } = useListePage<any>(
    () => espaceClientService.getAvancements()
  )

  if (loading) return <EtatChargement />
  if (error) return <EtatErreur message={error} onRetry={recharger} />

  return (
    <div className="container-fluid py-4">
      <PageHeader titre="Avancement des travaux" icone="bi-bar-chart" sousTitre="Avancement global et par ouvrage" />
      {items.length === 0 ? (
        <Vide message="Aucune information d'avancement disponible" />
      ) : (
        <div className="row g-3">
          {items.map((ch: any, idx: number) => (
            <div className="col-md-6" key={ch.chantier?.id || idx}>
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-white border-0 d-flex justify-content-between align-items-center">
                  <span className="fw-semibold">{ch.chantier?.nom || 'Chantier'}</span>
                  <span className="badge bg-primary">{ch.avancement_global || 0}%</span>
                </div>
                <div className="card-body">
                  <div className="progress mb-3" style={{ height: '12px' }}>
                    <div className="progress-bar bg-primary" style={{ width: `${ch.avancement_global || 0}%` }}></div>
                  </div>
                  {(ch.phases || []).length > 0 && (
                    <table className="table table-sm">
                      <tbody>
                        {(ch.phases || []).map((ph: any, i: number) => (
                          <tr key={i}>
                            <td>{ph.nom}</td>
                            <td style={{ width: 120 }}>
                              <div className="progress" style={{ height: '8px' }}>
                                <div className="progress-bar bg-success" style={{ width: `${ph.avancement_pct || 0}%` }}></div>
                              </div>
                            </td>
                            <td className="text-end text-muted" style={{ width: 50 }}>{ph.avancement_pct || 0}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
