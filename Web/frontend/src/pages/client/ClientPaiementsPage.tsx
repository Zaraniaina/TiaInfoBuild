import { espaceClientService } from '@/services/espaceClient.service'
import {
  PageHeader, StatutBadge, useListePage,
  EtatChargement, EtatErreur, Vide, fmtDate, fmtMontant,
} from './shared'
import { useState } from 'react'

interface Tot {
  total_facture: number
  total_paye: number
  total_restant: number
}

export function ClientPaiementsPage() {
  const [totaux, setTotaux] = useState<Tot | null>(null)
  const { items, loading, error, recharger } = useListePage<any>(async () => {
    // Le backend renvoie { items, totaux }
    const d: any = await espaceClientService.getPaiements()
    setTotaux(d.totaux || null)
    return d.items || []
  })

  if (loading) return <EtatChargement />
  if (error) return <EtatErreur message={error} onRetry={recharger} />

  const paiements = items as any[]

  return (
    <div className="container-fluid py-4">
      <PageHeader titre="Mes paiements" icone="bi-credit-card" sousTitre="Historique de vos paiements" />
      {paiements.length === 0 ? (
        <Vide message="Aucun paiement enregistre" />
      ) : (
        <>
          {totaux && (
            <div className="card border-0 shadow-sm mb-3">
              <div className="card-body">
                <div className="row text-center">
                  <div className="col-4">
                    <div className="text-muted small">Total facture</div>
                    <h5 className="fw-bold text-primary mb-0">{fmtMontant(totaux.total_facture)}</h5>
                  </div>
                  <div className="col-4">
                    <div className="text-muted small">Total paye</div>
                    <h5 className="fw-bold text-success mb-0">{fmtMontant(totaux.total_paye)}</h5>
                  </div>
                  <div className="col-4">
                    <div className="text-muted small">Total restant</div>
                    <h5 className="fw-bold text-danger mb-0">{fmtMontant(totaux.total_restant)}</h5>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="card border-0 shadow-sm">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Date</th>
                    <th>Reference</th>
                    <th>Mode de paiement</th>
                    <th className="text-end">Montant</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {paiements.map((p) => (
                    <tr key={p.id}>
                      <td>{fmtDate(p.date_paiement)}</td>
                      <td className="fw-semibold">{p.reference || '-'}</td>
                      <td>{p.mode_paiement?.replace(/_/g, ' ') || '-'}</td>
                      <td className="text-end fw-semibold">{fmtMontant(p.montant)}</td>
                      <td><StatutBadge statut="paye" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
