import { espaceClientService, Document } from '@/services/espaceClient.service'
import {
  PageHeader, useListePage, EtatChargement, EtatErreur, Vide, fmtDate,
} from './shared'
import { useMemo } from 'react'

const CATEGORIES = [
  ['demande', 'Demandes'],
  ['plan', 'Plans'],
  ['devis', 'Devis'],
  ['contrat', 'Contrats'],
  ['avenant', 'Avenants'],
  ['situation', 'Situations de travaux'],
  ['facture', 'Factures'],
  ['recu_paiement', 'Recus / justificatifs'],
  ['rapport', 'Rapports'],
  ['photo_chantier', 'Photos de chantier'],
  ['autre', 'Autres documents'],
]

export function ClientDocumentsPage() {
  const { items, loading, error, recharger } = useListePage<Document>(
    () => espaceClientService.getDocuments()
  )

  const parCategorie = useMemo(() => {
    const map: Record<string, Document[]> = {}
    for (const d of items) {
      const cat = d.categorie || 'autre'
      if (!map[cat]) map[cat] = []
      map[cat].push(d)
    }
    return map
  }, [items])

  if (loading) return <EtatChargement />
  if (error) return <EtatErreur message={error} onRetry={recharger} />

  return (
    <div className="container-fluid py-4">
      <PageHeader titre="Mes documents" icone="bi-folder" sousTitre="Centralisation des documents accessibles" />
      {items.length === 0 ? (
        <Vide message="Aucun document disponible" />
      ) : (
        <div className="row g-3">
          {CATEGORIES.filter(([cle]) => parCategorie[cle]).map(([cle, label]) => (
            <div className="col-md-6" key={cle}>
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-white border-0">
                  <span className="fw-semibold"><i className="bi bi-folder2 me-2 text-primary"></i>{label}</span>
                </div>
                <div className="card-body pt-0">
                  {parCategorie[cle].map((d) => (
                    <div key={d.id} className="d-flex align-items-center gap-2 py-1 border-bottom">
                      <i className={`bi ${d.mime_type?.includes('image') ? 'bi-file-image' : 'bi-file-earmark-pdf text-danger'}`}></i>
                      <div className="flex-grow-1">
                        <div className="fw-semibold small">{d.nom}</div>
                        <small className="text-muted">{fmtDate(d.created_at)}</small>
                      </div>
                      {d.fichier_url && (
                        <a href={d.fichier_url} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-primary">
                          <i className="bi bi-download"></i>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
