import { espaceClientService, Devis, LigneDevis } from '@/services/espaceClient.service'
import {
  PageHeader, StatutBadge, DetailModal, useListePage,
  EtatChargement, EtatErreur, Vide, fmtDate, fmtMontant,
} from './shared'
import { useState } from 'react'

export function ClientDevisPage() {
  const { items, loading, error, recharger } = useListePage<Devis>(
    () => espaceClientService.getDevis()
  )
  const [selection, setSelection] = useState<Devis | null>(null)
  const [lignes, setLignes] = useState<LigneDevis[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [actionEnCours, setActionEnCours] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const ouvrirDetail = async (devis: Devis) => {
    setSelection(devis)
    setMessage(null)
    try {
      setDetailLoading(true)
      const detail = await espaceClientService.getDevisDetail(devis.id)
      setLignes(detail.lignes || [])
    } catch {
      setLignes([])
    } finally {
      setDetailLoading(false)
    }
  }

  const repondre = async (action: 'accepter' | 'refuser') => {
    if (!selection) return
    try {
      setActionEnCours(true)
      await espaceClientService.repondreDevis(selection.id, action)
      setMessage(action === 'accepter'
        ? 'Devis accepte. Un responsable de l\'entreprise vous contactera prochainement.'
        : 'Devis refuse.')
      await recharger()
      const maj = await espaceClientService.getDevis()
      const nouveau = maj.find((d) => d.id === selection.id)
      if (nouveau) setSelection(nouveau)
    } catch (err: any) {
      setMessage(err?.response?.data?.detail || 'Erreur lors de la reponse au devis')
    } finally {
      setActionEnCours(false)
    }
  }

  if (loading) return <EtatChargement />
  if (error) return <EtatErreur message={error} onRetry={recharger} />

  const repondrePossible = selection && ['envoye', 'brouillon'].includes(selection.statut)

  return (
    <div className="container-fluid py-4">
      <PageHeader titre="Mes devis" icone="bi-file-earmark-text" sousTitre="Devis qui vous sont destines" />
      {items.length === 0 ? (
        <Vide message="Aucun devis pour le moment" />
      ) : (
        <div className="card border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>N devis</th>
                  <th>Date</th>
                  <th>Validite</th>
                  <th className="text-end">Montant HT</th>
                  <th className="text-end">Montant TTC</th>
                  <th>Statut</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((d) => (
                  <tr key={d.id}>
                    <td className="fw-semibold">{d.numero}</td>
                    <td>{fmtDate(d.date_creation)}</td>
                    <td>{fmtDate(d.date_validite)}</td>
                    <td className="text-end">{fmtMontant(d.montant_ht)}</td>
                    <td className="text-end fw-semibold">{fmtMontant(d.montant_ttc)}</td>
                    <td><StatutBadge statut={d.statut} /></td>
                    <td>
                      <button className="btn btn-sm btn-outline-primary" onClick={() => ouvrirDetail(d)}>
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

      <DetailModal
        show={!!selection}
        onClose={() => setSelection(null)}
        title={selection ? `Devis ${selection.numero}` : ''}
        footer={
          repondrePossible ? (
            <>
              <button className="btn btn-outline-danger" disabled={actionEnCours} onClick={() => repondre('refuser')}>
                Refuser
              </button>
              <button className="btn btn-success" disabled={actionEnCours} onClick={() => repondre('accepter')}>
                {actionEnCours ? 'En cours...' : 'Accepter le devis'}
              </button>
            </>
          ) : null
        }
      >
        {selection && (
          <>
            {message && <div className="alert alert-info py-2">{message}</div>}
            <dl className="row mb-3">
              <dt className="col-sm-4">Date de creation</dt>
              <dd className="col-sm-8">{fmtDate(selection.date_creation)}</dd>
              <dt className="col-sm-4">Validite</dt>
              <dd className="col-sm-8">{fmtDate(selection.date_validite)}</dd>
              <dt className="col-sm-4">Conditions de paiement</dt>
              <dd className="col-sm-8">{selection.conditions_paiement || '-'}</dd>
              <dt className="col-sm-4">Statut</dt>
              <dd className="col-sm-8"><StatutBadge statut={selection.statut} /></dd>
            </dl>
            <h6 className="fw-bold mb-2">Detail des ouvrages</h6>
            {detailLoading ? (
              <div className="text-center py-3"><div className="spinner-border spinner-border-sm text-primary"></div></div>
            ) : (
              <table className="table table-sm table-bordered mb-3">
                <thead className="table-light">
                  <tr>
                    <th>Description</th>
                    <th className="text-end">Quantite</th>
                    <th>Unite</th>
                    <th className="text-end">Prix unitaire</th>
                    <th className="text-end">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((l) => (
                    <tr key={l.id}>
                      <td>{l.designation}</td>
                      <td className="text-end">{l.quantite}</td>
                      <td>{l.unite}</td>
                      <td className="text-end">{fmtMontant(l.prix_unitaire)}</td>
                      <td className="text-end">{fmtMontant(l.montant)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4} className="text-end fw-semibold">Total HT</td>
                    <td className="text-end fw-semibold">{fmtMontant(selection.montant_ht)}</td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="text-end">TVA</td>
                    <td className="text-end">{fmtMontant(selection.montant_ttc - selection.montant_ht)}</td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="text-end fw-bold">Total TTC</td>
                    <td className="text-end fw-bold">{fmtMontant(selection.montant_ttc)}</td>
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

