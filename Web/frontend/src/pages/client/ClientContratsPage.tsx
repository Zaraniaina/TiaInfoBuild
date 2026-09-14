import { espaceClientService, Contrat } from '@/services/espaceClient.service'
import {
  PageHeader, StatutBadge, DetailModal, useListePage,
  EtatChargement, EtatErreur, Vide, fmtDate, fmtMontant,
} from './shared'
import { useState } from 'react'
import { PrintableDocumentModal, PrintableDocumentData } from '@/components/documents/PrintableDocumentModal'

export function ClientContratsPage() {
  const { items, loading, error, recharger } = useListePage<Contrat>(
    () => espaceClientService.getContrats()
  )
  const [selection, setSelection] = useState<Contrat | null>(null)
  const [printDoc, setPrintDoc] = useState<{ show: boolean; data: PrintableDocumentData }>({
    show: false,
    data: {},
  })

  const ouvrirPrint = (c: Contrat) => {
    setPrintDoc({
      show: true,
      data: {
        numero: c.numero,
        date: fmtDate(c.date_signature || c.date_debut),
        chantier_nom: c.projet_nom || 'Projet Contractuel',
        total_ht: (c.montant || 0) / 1.2,
        tva_montant: (c.montant || 0) - (c.montant || 0) / 1.2,
        total_ttc: c.montant || 0,
        conditions_paiement: `Début: ${fmtDate(c.date_debut)} - Fin prévue: ${fmtDate(c.date_fin_prevue)}`,
      },
    })
  }

  if (loading) return <EtatChargement />
  if (error) return <EtatErreur message={error} onRetry={recharger} />

  return (
    <div className="container-fluid py-4">
      <PageHeader titre="Mes contrats" icone="bi-file-earmark-check" sousTitre="Contrats lis a vos projets" />
      {items.length === 0 ? (
        <Vide message="Aucun contrat pour le moment" />
      ) : (
        <div className="card border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>N contrat</th>
                  <th>Projet</th>
                  <th>Date de signature</th>
                  <th>Date de debut</th>
                  <th>Date de fin prevue</th>
                  <th className="text-end">Montant</th>
                  <th>Statut</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id}>
                    <td className="fw-semibold">{c.numero}</td>
                    <td>{c.projet_nom || '-'}</td>
                    <td>{fmtDate(c.date_signature)}</td>
                    <td>{fmtDate(c.date_debut)}</td>
                    <td>{fmtDate(c.date_fin_prevue)}</td>
                    <td className="text-end fw-semibold">{fmtMontant(c.montant)}</td>
                    <td><StatutBadge statut={c.statut} /></td>
                    <td className="text-end">
                      <div className="d-flex gap-1 justify-content-end">
                        <button className="btn btn-sm btn-outline-primary" title="Détails" onClick={() => setSelection(c)}>
                          <i className="bi bi-eye"></i>
                        </button>
                        <button className="btn btn-sm btn-outline-secondary" title="Imprimer / PDF" onClick={() => ouvrirPrint(c)}>
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
        title={selection ? `Contrat ${selection.numero}` : ''}
        footer={
          selection ? (
            <button className="btn btn-primary" onClick={() => { setSelection(null); ouvrirPrint(selection); }}>
              <i className="bi bi-printer me-2"></i>Imprimer / PDF
            </button>
          ) : null
        }
      >
        {selection && (
          <dl className="row mb-0">
            <dt className="col-sm-4">Projet</dt>
            <dd className="col-sm-8">{selection.projet_nom || '-'}</dd>
            <dt className="col-sm-4">Montant contractuel</dt>
            <dd className="col-sm-8">{fmtMontant(selection.montant)}</dd>
            <dt className="col-sm-4">Date de signature</dt>
            <dd className="col-sm-8">{fmtDate(selection.date_signature)}</dd>
            <dt className="col-sm-4">Date de debut</dt>
            <dd className="col-sm-8">{fmtDate(selection.date_debut)}</dd>
            <dt className="col-sm-4">Date de fin prevue</dt>
            <dd className="col-sm-8">{fmtDate(selection.date_fin_prevue)}</dd>
            <dt className="col-sm-4">Statut</dt>
            <dd className="col-sm-8"><StatutBadge statut={selection.statut} /></dd>
          </dl>
        )}
      </DetailModal>

      <PrintableDocumentModal
        show={printDoc.show}
        onClose={() => setPrintDoc({ show: false, data: {} })}
        type="contrat"
        data={printDoc.data}
      />
    </div>
  )
}
