import { espaceClientService, Facture } from '@/services/espaceClient.service'
import {
  PageHeader, StatutBadge, DetailModal, useListePage,
  EtatChargement, EtatErreur, Vide, fmtDate, fmtMontant,
} from './shared'
import { useState } from 'react'
import { PrintableDocumentModal, PrintableDocumentData } from '@/components/documents/PrintableDocumentModal'

export function ClientFacturesPage() {
  const { items, loading, error, recharger } = useListePage<Facture>(
    () => espaceClientService.getFactures()
  )
  const [selection, setSelection] = useState<Facture | null>(null)
  const [printDoc, setPrintDoc] = useState<{ show: boolean; data: PrintableDocumentData }>({
    show: false,
    data: {},
  })

  const ouvrirPrint = (f: Facture) => {
    setPrintDoc({
      show: true,
      data: {
        numero: f.numero,
        date: fmtDate(f.date_creation),
        date_echeance: fmtDate(f.date_echeance),
        chantier_nom: f.projet_nom || 'Chantier Client',
        total_ht: (f.montant_ttc || 0) / 1.2,
        tva_montant: (f.montant_ttc || 0) - (f.montant_ttc || 0) / 1.2,
        total_ttc: f.montant_ttc || 0,
        acompte: f.montant_paye || 0,
        reste_a_payer: f.reste_a_payer || 0,
        conditions_paiement: f.conditions_paiement || 'Paiement à réception',
      },
    })
  }

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
                  <th className="text-end">Actions</th>
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
                    <td className="text-end">
                      <div className="d-flex gap-1 justify-content-end">
                        <button className="btn btn-sm btn-outline-primary" title="Détails" onClick={() => setSelection(f)}>
                          <i className="bi bi-eye"></i>
                        </button>
                        <button className="btn btn-sm btn-outline-secondary" title="Imprimer / Télécharger PDF" onClick={() => ouvrirPrint(f)}>
                          <i className="bi bi-printer"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <DetailModal
        show={!!selection}
        onClose={() => setSelection(null)}
        title={selection ? `Facture ${selection.numero}` : ''}
        footer={
          selection ? (
            <button className="btn btn-primary" onClick={() => { setSelection(null); ouvrirPrint(selection); }}>
              <i className="bi bi-printer me-2"></i>Imprimer / Télécharger PDF
            </button>
          ) : null
        }
      >
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

      <PrintableDocumentModal
        show={printDoc.show}
        onClose={() => setPrintDoc({ show: false, data: {} })}
        type="facture"
        data={printDoc.data}
      />
    </div>
  )
}
