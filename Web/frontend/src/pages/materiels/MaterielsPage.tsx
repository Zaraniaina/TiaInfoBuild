import { useEffect, useState } from 'react'
import type { Materiel } from '@/types'
import { materielsService } from '@/services/materiels.service'

export function MaterielsPage() {
  const [materiels, setMateriels] = useState<Materiel[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    materielsService.getAll()
      .then(setMateriels)
      .catch(() => {
        setMateriels([
          { id: 1, entreprise_id: 1, nom: 'Pelle Hydraulique Caterpillar 320', marque: 'Caterpillar', valeur_achat: 150000000, statut: 'disponible', is_deleted: false, created_at: '', updated_at: '' },
          { id: 2, entreprise_id: 1, nom: 'Bétonnière 350L', marque: 'Imer', valeur_achat: 12000000, statut: 'en_utilisation', is_deleted: false, created_at: '', updated_at: '' },
          { id: 3, entreprise_id: 1, nom: 'Camion Benne 12T', marque: 'Mercedes-Benz', valeur_achat: 95000000, statut: 'en_maintenance', is_deleted: false, created_at: '', updated_at: '' }
        ])
      })
      .finally(() => setLoading(false))
  }, [])

  const getStatutBadge = (statut: string) => {
    switch (statut) {
      case 'disponible': return <span className="badge bg-success">Disponible</span>
      case 'en_utilisation': return <span className="badge bg-primary">En Utilisation</span>
      case 'en_maintenance': return <span className="badge bg-warning text-dark">Maintenance</span>
      case 'hors_service': return <span className="badge bg-danger">Hors Service</span>
      default: return <span className="badge bg-secondary">{statut}</span>
    }
  }

  return (
    <div className="container-fluid py-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h2 className="mb-1"><i className="bi bi-tools me-2 text-info"></i>Gestion du Parc Matériel</h2>
          <p className="text-secondary mb-0">Engins, véhicules, équipements et suivis d'interventions de maintenance</p>
        </div>
        <button className="btn btn-info text-white fw-bold">
          <i className="bi bi-plus-circle me-2"></i>Nouveau Matériel
        </button>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-info" role="status"></div>
        </div>
      ) : (
        <div className="row g-4">
          {materiels.map(m => (
            <div key={m.id} className="col-xl-4 col-md-6">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <span className="badge bg-light text-dark font-monospace border">MAT-00{m.id}</span>
                    {getStatutBadge(m.statut)}
                  </div>
                  <h5 className="fw-bold mb-1">{m.nom}</h5>
                  <p className="text-muted small mb-2">{m.marque || 'Marque non spécifiée'}</p>
                  <p className="small mb-0"><strong>Valeur Achat:</strong> {m.valeur_achat?.toLocaleString()} MGA</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
