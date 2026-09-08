import { espaceClientService, Facture } from '@/services/espaceClient.service'
import {
  PageHeader, StatutBadge, DetailModal, useListePage,
  EtatChargement, EtatErreur, Vide, fmtDate, fmtMontant,
} from './shared'
import { useState } from 'react'

export function ClientFacturesPage() {
  const { items, loading, error, recharger } = useListePage<Facture>(
    () => espaceClientService.getFactures()
  )
  const [selection, setSelection] = useState<Facture | null>(null)

  if (loading) return <EtatChargement />
  if (error) return <EtatErreur message={error} onRetry={recharger} />

  return (
    <div className="container-fluid py-4">
      <PageHeader titre="Mes factures" icone="bi-receipt" sousTitre="Factures et restes a payer" />
      {items.length === 0 ? (
        <Vide message="Aucune facture pour le moment" />
      ) : (
        <div className="card border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>N facture</th>
                  <th>Projet</th>
                  <th>Date</th>
                  <th>Echeance</th>
                  <th className="text-end">Montant TTC</th>
                  <th className="text-end">Paye</th>
                  <th className="text-end">Reste a payer</th>
                  <th>Statut</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((f) => (
                  <tr key={f.id}>
                    <td className="fw-semibold">{f.numero}</td>
                    <td>{f.projet_nom || '-'}</td>
                    <td>{fmtDate(f.date_creation)}</td>
                    <td>{fmtDate(f.date_echeance)}</td>
                    <td className="text-end fw-semibold">{fmtMontant(f.montant_ttc)}</td>
                    <td className="text-end text-success">{fmtMontant(f.montant_paye)}</td>
                    <td className="text-end text-danger fw-semibold">{fmtMontant(f.reste_a_payer)}</td>
                    <td><StatutBadge statut={f.statut} /></td>
                    <td>
                      <button className="btn btn-sm btn-outline-primary" onClick={() => setSelection(f)}>
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

      <DetailModal show={!!selection} onClose={() => setSelection(null)} title={selection ? `Facture ${selection.numero}` : ''}>
        {selection && (
          <dl className="row mb-0">
            <dt className="col-sm-4">Projet</dt>
            <dd className="col-sm-8">{selection.projet_nom || '-'}</dd>
            <dt className="col-sm-4">Date</dt>
            <dd className="col-sm-8">{fmtDate(selection.date_creation)}</dd>
            <dt className="col-sm-4">Date d'echeance</dt>
            <dd className="col-sm-8">{fmtDate(selection.date_echeance)}</dd>
            <dt className="col-sm-4">Conditions de paiement</dt>
            <dd className="col-sm-8">{selection.conditions_paiement || '-'}</dd>
            <dt className="col-sm-4">Montant TTC</dt>
            <dd className="col-sm-8">{fmtMontant(selection.montant_ttc)}</dd>
            <dt className="col-sm-4">Montant paye</dt>
            <dd className="col-sm-8 text-success">{fmtMontant(selection.montant_paye)}</dd>
            <dt className="col-sm-4">Reste a payer</dt>
            <dd className="col-sm-8 text-danger fw-bold">{fmtMontant(selection.reste_a_payer)}</dd>
            <dt className="col-sm-4">Statut</dt>
            <dd className="col-sm-8"><StatutBadge statut={selection.statut} /></dd>
          </dl>
        )}
      </DetailModal>
    </div>
  )
}
