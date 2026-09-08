import { espaceClientService, DemandeTravaux } from '@/services/espaceClient.service'
import {
  PageHeader, StatutBadge, DetailModal, useListePage,
  EtatChargement, EtatErreur, Vide, fmtDate,
} from './shared'
import { useState } from 'react'

export function ClientDemandesPage() {
  const { items, loading, error, recharger } = useListePage<DemandeTravaux>(
    () => espaceClientService.getDemandes()
  )
  const [selection, setSelection] = useState<DemandeTravaux | null>(null)

  if (loading) return <EtatChargement />
  if (error) return <EtatErreur message={error} onRetry={recharger} />

  return (
    <div className="container-fluid py-4">
      <PageHeader titre="Mes demandes" icone="bi-envelope" sousTitre="Suivi de vos demandes de travaux" />
      {items.length === 0 ? (
        <Vide message="Aucune demande pour le moment" />
      ) : (
        <div className="card border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Reference</th>
                  <th>Titre</th>
                  <th>Type de travaux</th>
                  <th>Date</th>
                  <th>Statut</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((d) => (
                  <tr key={d.id}>
                    <td className="fw-semibold">{d.reference}</td>
                    <td>{d.titre}</td>
                    <td>{d.type_travaux || '-'}</td>
                    <td>{fmtDate(d.date_demande)}</td>
                    <td><StatutBadge statut={d.statut} /></td>
                    <td>
                      <button className="btn btn-sm btn-outline-primary" onClick={() => setSelection(d)}>
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

      <DetailModal show={!!selection} onClose={() => setSelection(null)} title={selection ? `${selection.reference} - ${selection.titre}` : ''}>
        {selection && (
          <dl className="row mb-0">
            <dt className="col-sm-4">Type de travaux</dt>
            <dd className="col-sm-8">{selection.type_travaux || '-'}</dd>
            <dt className="col-sm-4">Description</dt>
            <dd className="col-sm-8">{selection.description || '-'}</dd>
            <dt className="col-sm-4">Localisation</dt>
            <dd className="col-sm-8">{selection.localisation || '-'}</dd>
            <dt className="col-sm-4">Date souhaitee</dt>
            <dd className="col-sm-8">{fmtDate(selection.date_souhaitee)}</dd>
            <dt className="col-sm-4">Observations</dt>
            <dd className="col-sm-8">{selection.observations || '-'}</dd>
            <dt className="col-sm-4">Date de creation</dt>
            <dd className="col-sm-8">{fmtDate(selection.date_demande)}</dd>
            <dt className="col-sm-4">Statut</dt>
            <dd className="col-sm-8"><StatutBadge statut={selection.statut} /></dd>
          </dl>
        )}
      </DetailModal>
    </div>
  )
}
