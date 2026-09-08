import { espaceClientService } from '@/services/espaceClient.service'
import {
  PageHeader, StatutBadge, DetailModal, useListePage,
  EtatChargement, EtatErreur, Vide, fmtDate, fmtMontant,
} from './shared'
import { useState } from 'react'

export function ClientSituationsPage() {
  const { items, loading, error, recharger } = useListePage<any>(
    () => espaceClientService.getSituations()
  )
  const [selection, setSelection] = useState<any | null>(null)

  const ouvrirDetail = async (situation: any) => {
    try {
      const detail: any = await espaceClientService.getSituation(situation.id)
      setSelection({ ...detail.situation, lignes: detail.lignes || [], total: detail.total })
    } catch {
      setSelection(situation)
    }
  }

  if (loading) return <EtatChargement />
  if (error) return <EtatErreur message={error} onRetry={recharger} />

  return (
    <div className="container-fluid py-4">
      <PageHeader titre="Situations de travaux" icone="bi-clipboard-data" sousTitre="Situations de travaux qui vous sont destinees" />
      {items.length === 0 ? (
        <Vide message="Aucune situation de travaux pour le moment" />
      ) : (
        <div className="card border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>N situation</th>
                  <th>Periode</th>
                  <th>Date</th>
                  <th className="text-end">Avancement</th>
                  <th className="text-end">Montant</th>
                  <th>Statut</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((s: any) => (
                  <tr key={s.id}>
                    <td className="fw-semibold">{s.numero}</td>
                    <td>{s.periode || '-'}</td>
                    <td>{fmtDate(s.date_etablissement)}</td>
                    <td className="text-end">{s.avancement || 0}%</td>
                    <td className="text-end">{fmtMontant(s.montant)}</td>
                    <td><StatutBadge statut={s.statut} /></td>
                    <td>
                      <button className="btn btn-sm btn-outline-primary" onClick={() => ouvrirDetail(s)}>
                        <i className="bi bi-eye"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <DetailModal show={!!selection} onClose={() => setSelection(null)} title={selection ? `Situation ${selection.numero}` : ''}>
        {selection && (
          <>
            <dl className="row mb-3">
              <dt className="col-sm-4">Periode</dt>
              <dd className="col-sm-8">{selection.periode || '-'}</dd>
              <dt className="col-sm-4">Date d'etablissement</dt>
              <dd className="col-sm-8">{fmtDate(selection.date_etablissement)}</dd>
              <dt className="col-sm-4">Avancement</dt>
              <dd className="col-sm-8">{selection.avancement || 0}%</dd>
              <dt className="col-sm-4">Observations</dt>
              <dd className="col-sm-8">{selection.observations || '-'}</dd>
              <dt className="col-sm-4">Statut</dt>
              <dd className="col-sm-8"><StatutBadge statut={selection.statut} /></dd>
            </dl>
            {(selection.lignes || []).length > 0 && (
              <table className="table table-sm table-bordered">
                <thead className="table-light">
                  <tr>
                    <th>Ouvrage</th>
                    <th className="text-end">Qte periode</th>
                    <th className="text-end">Qte cumulee</th>
                    <th>Unite</th>
                    <th className="text-end">Prix unitaire</th>
                    <th className="text-end">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {(selection.lignes || []).map((l: any) => (
                    <tr key={l.id}>
                      <td>{l.ouvrage}</td>
                      <td className="text-end">{l.quantite_periode || 0}</td>
                      <td className="text-end">{l.quantite_cumulee || 0}</td>
                      <td>{l.unite || '-'}</td>
                      <td className="text-end">{fmtMontant(l.prix_unitaire)}</td>
                      <td className="text-end">{fmtMontant(l.montant)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={5} className="text-end fw-bold">Total</td>
                    <td className="text-end fw-bold">{fmtMontant(selection.total ?? selection.montant)}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </>
        )}
      </DetailModal>
    </div>
  )
}
