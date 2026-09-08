import { espaceClientService, Projet } from '@/services/espaceClient.service'
import {
  PageHeader, StatutBadge, DetailModal, useListePage,
  EtatChargement, EtatErreur, Vide, fmtDate,
} from './shared'
import { useState } from 'react'

export function ClientProjetsPage() {
  const { items, loading, error, recharger } = useListePage<Projet>(
    () => espaceClientService.getProjets()
  )
  const [selection, setSelection] = useState<Projet | null>(null)

  if (loading) return <EtatChargement />
  if (error) return <EtatErreur message={error} onRetry={recharger} />

  return (
    <div className="container-fluid py-4">
      <PageHeader titre="Mes projets" icone="bi-building" sousTitre="Projets de travaux en cours" />
      {items.length === 0 ? (
        <Vide message="Aucun projet pour le moment" />
      ) : (
        <div className="card border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Reference</th>
                  <th>Nom du projet</th>
                  <th>Localisation</th>
                  <th>Type</th>
                  <th>Date de creation</th>
                  <th>Statut</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id}>
                    <td className="fw-semibold">{p.reference}</td>
                    <td>{p.nom}</td>
                    <td>{p.localisation || '-'}</td>
                    <td>{p.type_projet || '-'}</td>
                    <td>{fmtDate(p.date_creation)}</td>
                    <td><StatutBadge statut={p.statut} /></td>
                    <td>
                      <button className="btn btn-sm btn-outline-primary" onClick={() => setSelection(p)}>
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

      <DetailModal show={!!selection} onClose={() => setSelection(null)} title={selection ? `${selection.reference} - ${selection.nom}` : ''}>
        {selection && (
          <dl className="row mb-0">
            <dt className="col-sm-4">Type de projet</dt>
            <dd className="col-sm-8">{selection.type_projet || '-'}</dd>
            <dt className="col-sm-4">Description</dt>
            <dd className="col-sm-8">{selection.description || '-'}</dd>
            <dt className="col-sm-4">Localisation</dt>
            <dd className="col-sm-8">{selection.localisation || '-'}</dd>
            <dt className="col-sm-4">Adresse</dt>
            <dd className="col-sm-8">{selection.adresse || '-'}</dd>
            <dt className="col-sm-4">Date de creation</dt>
            <dd className="col-sm-8">{fmtDate(selection.date_creation)}</dd>
            <dt className="col-sm-4">Statut</dt>
            <dd className="col-sm-8"><StatutBadge statut={selection.statut} /></dd>
          </dl>
        )}
      </DetailModal>
    </div>
  )
}
