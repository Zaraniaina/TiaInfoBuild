import { useAuthStore } from '@/stores/auth.store'
import { useEffect, useState } from 'react'
import { api } from '@/services/api'
import type { Client, Devis, Facture } from '@/types'

interface ClientData {
  clients: Client[]
  devis: Devis[]
  factures: Facture[]
}

export function ClientPage() {
  const { user } = useAuthStore()
  const [data, setData] = useState<ClientData>({ clients: [], devis: [], factures: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/commercial/clients').catch(() => ({ data: { items: [] } })),
      api.get('/commercial/devis').catch(() => ({ data: { items: [] } })),
      api.get('/commercial/factures').catch(() => ({ data: { items: [] } })),
    ])
      .then(([clientsRes, devisRes, facturesRes]) => {
        setData({
          clients: (clientsRes.data?.items || []) as Client[],
          devis: (devisRes.data?.items || []) as Devis[],
          factures: (facturesRes.data?.items || []) as Facture[],
        })
      })
      .catch(() => setData({ clients: [], devis: [], factures: [] }))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h2 className="mb-1 fw-bold text-secondary"><i className="bi bi-person-badge me-2"></i>Espace Client</h2>
          <p className="text-secondary mb-0">Bienvenue, <strong>{user?.prenom} {user?.nom}</strong> — Suivi de vos projets et factures</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-secondary" role="status"></div>
        </div>
      ) : (
        <div className="row g-4">
          <div className="col-md-4">
            <div className="card border-0 shadow-sm p-3 text-center">
              <small className="text-muted text-uppercase fw-bold">Mes Projets</small>
              <h3 className="fw-bold text-secondary mt-2 mb-0">{data?.clients?.length || 0}</h3>
            </div>
          </div>
          <div className="col-md-4">
            <div className="card border-0 shadow-sm p-3 text-center">
              <small className="text-muted text-uppercase fw-bold">Devis en Cours</small>
              <h3 className="fw-bold text-secondary mt-2 mb-0">{data?.devis?.length || 0}</h3>
            </div>
          </div>
          <div className="col-md-4">
            <div className="card border-0 shadow-sm p-3 text-center">
              <small className="text-muted text-uppercase fw-bold">Factures</small>
              <h3 className="fw-bold text-secondary mt-2 mb-0">{data?.factures?.length || 0}</h3>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
