import { useEffect, useState } from 'react'
import { employeTerrainService } from '@/services/employeTerrain.service'
import type { Document } from '@/types'

const categorieLabels: Record<string, string> = {
  demande: 'Demande', plan: 'Plan', devis: 'Devis', contrat: 'Contrat',
  avenant: 'Avenant', situation: 'Situation de travaux', facture: 'Facture',
  recu_paiement: 'Reçu de paiement', rapport: 'Rapport', photo_chantier: 'Photo de chantier', autre: 'Autre',
}

export function EmployeDocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    employeTerrainService.getDocuments()
      .then(setDocuments)
      .catch(() => setErr('Impossible de charger les documents'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
  if (err) return <div className="alert alert-danger m-3">{err}</div>

  return (
    <div className="container-fluid py-3">
      <h5 className="mb-3"><i className="bi bi-folder"></i> Documents</h5>
      {documents.length === 0 ? <div className="text-muted">Aucun document disponible</div> : (
        <div className="list-group">
          {documents.map((d) => (
            <div key={d.id} className="list-group-item d-flex justify-content-between align-items-center">
              <div>
                <strong>{d.nom}</strong>
                <span className="badge bg-secondary ms-2">{categorieLabels[d.categorie] || d.categorie}</span>
                {d.description && <div className="text-muted small">{d.description}</div>}
              </div>
              {d.fichier_url && (
                <a href={d.fichier_url} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-primary">
                  Télécharger
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
