import { espaceClientService, Avenant } from '@/services/espaceClient.service'
import {
  PageHeader, StatutBadge, useListePage,
  EtatChargement, EtatErreur, Vide, fmtDate, fmtMontant,
} from './shared'

export function ClientAvenantsPage() {
  const { items, loading, error, recharger } = useListePage<Avenant>(
    () => espaceClientService.getAvenants()
  )

  if (loading) return <EtatChargement />
  if (error) return <EtatErreur message={error} onRetry={recharger} />

  return (
    <div className="container-fluid py-4">
      <PageHeader titre="Mes avenants" icone="bi-file-earmark-plus" sousTitre="Modifications apportees aux contrats" />
      {items.length === 0 ? (
        <Vide message="Aucun avenant pour le moment" />
      ) : (
        <div className="card border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>N avenant</th>
                  <th>Objet</th>
                  <th>Date</th>
                  <th className="text-end">Impact financier</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {items.map((a) => (
                  <tr key={a.id}>
                    <td className="fw-semibold">{a.numero}</td>
                    <td>{a.objet || '-'}</td>
                    <td>{fmtDate(a.date)}</td>
                    <td className="text-end">{fmtMontant(a.impact_financier)}</td>
                    <td><StatutBadge statut={a.statut} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
