import { espaceClientService } from '@/services/espaceClient.service'
import {
  PageHeader, StatutBadge, DetailModal, useListePage,
  EtatChargement, EtatErreur, Vide, fmtDate,
} from './shared'
import { useState } from 'react'

export function ClientChantiersPage() {
  const { items, loading, error, recharger } = useListePage<any>(
    () => espaceClientService.getChantiers()
  )
  const [selection, setSelection] = useState<any | null>(null)

  if (loading) return <EtatChargement />
  if (error) return <EtatErreur message={error} onRetry={recharger} />

  // Le backend renvoie { chantier, avancement_global }
  const lignes = (items as any[]).map((it: any) => ({
    ...it.chantier,
    avancement_global: it.avancement_global,
  }))

  return (
    <div className="container-fluid py-4">
      <PageHeader titre="Mes chantiers" icone="bi-hammer" sousTitre="Suivi des travaux en cours" />
      {lignes.length === 0 ? (
        <Vide message="Aucun chantier pour le moment" />
      ) : (
        <div className="card border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Chantier</th>
                  <th>Localisation</th>
                  <th>Date de debut</th>
                  <th>Date prevue de fin</th>
                  <th style={{ minWidth: 140 }}>Avancement</th>
                  <th>Statut</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((c: any) => (
                  <tr key={c.id}>
                    <td className="fw-semibold">{c.nom}</td>
                    <td>{c.adresse || c.localisation || '-'}</td>
                    <td>{fmtDate(c.date_debut)}</td>
                    <td>{fmtDate(c.date_fin_prevue)}</td>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <div className="progress flex-grow-1" style={{ height: '8px' }}>
                          <div className="progress-bar bg-primary" style={{ width: `${c.avancement_global || 0}%` }}></div>
                        </div>
                        <small className="text-muted">{c.avancement_global || 0}%</small>
                      </div>
                    </td>
                    <td><StatutBadge statut={c.statut} /></td>
                    <td>
                      <button className="btn btn-sm btn-outline-primary" onClick={() => setSelection(c)}>
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

      <DetailModal show={!!selection} onClose={() => setSelection(null)} title={selection?.nom || ''}>
        {selection && (
          <dl className="row mb-0">
            <dt className="col-sm-4">Localisation</dt>
            <dd className="col-sm-8">{selection.adresse || selection.localisation || '-'}</dd>
            <dt className="col-sm-4">Date de demarrage</dt>
            <dd className="col-sm-8">{fmtDate(selection.date_debut)}</dd>
            <dt className="col-sm-4">Date prevue de fin</dt>
            <dd className="col-sm-8">{fmtDate(selection.date_fin_prevue)}</dd>
            <dt className="col-sm-4">Avancement global</dt>
            <dd className="col-sm-8">
              <div className="progress" style={{ height: '14px' }}>
                <div className="progress-bar bg-primary" style={{ width: `${selection.avancement_global || 0}%` }}>
                  {selection.avancement_global || 0}%
                </div>
              </div>
            </dd>
            <dt className="col-sm-4">Statut</dt>
            <dd className="col-sm-8"><StatutBadge statut={selection.statut} /></dd>
          </dl>
        )}
      </DetailModal>
    </div>
  )
}
