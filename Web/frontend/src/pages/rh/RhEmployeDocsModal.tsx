import { useCallback, useEffect, useState } from 'react'
import type { Employe, Document } from '@/types'
import { rhService } from '@/services/rh.service'

const CAT_LABELS: Record<string, string> = {
  contrat_travail: 'Contrat de travail',
  cnaps: 'CNAPS',
  ostie: 'OSTIE',
  certificat: 'Certificat',
  autre: 'Autre',
}

interface Props {
  employeId: number
  onClose: () => void
}

export function RhEmployeDocsModal({ employeId, onClose }: Props) {
  const [employe, setEmploye] = useState<Employe | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    nom: '',
    categorie: 'contrat_travail',
    fichier_url: '',
    description: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const emp = await rhService.getEmploye(employeId)
      setEmploye(emp)
      setDocuments(await rhService.getEmployeDocuments(employeId))
    } catch {
      /* modal fermée */
    } finally {
      setLoading(false)
    }
  }, [employeId])

  useEffect(() => {
    load()
  }, [load])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await rhService.createEmployeDocument(employeId, {
        nom: form.nom,
        categorie: form.categorie,
        fichier_url: form.fichier_url || undefined,
        description: form.description || undefined,
      })
      setShowForm(false)
      setForm({ nom: '', categorie: 'contrat_travail', fichier_url: '', description: '' })
      load()
    } catch {
      alert("Erreur lors de l'ajout du document.")
    }
  }

  const historique = employe?.historique_postes || []

  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title fw-bold">
              <i className="bi bi-folder2-open me-2"></i>
              Documents & Historique — {employe ? `${employe.prenom || ''} ${employe.nom}`.trim() : `#${employeId}`}
            </h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>
      <!-- SUITE-DOCS-1 -->
          <div className="modal-body">
            {loading ? (
              <div className="text-center text-muted py-4">Chargement...</div>
            ) : (
              <div className="row g-4">
                <div className="col-md-5">
                  <h6 className="fw-bold mb-3"><i className="bi bi-clock-history me-2"></i>Historique de poste</h6>
                  {historique.length === 0 ? (
                    <div className="text-muted small">Aucun changement de poste enregistré.</div>
                  ) : (
                    <ul className="timeline list-unstyled" style={{ borderLeft: '2px solid #dee2e6', paddingLeft: 16 }}>
                      {historique.map((h, i) => (
                        <li key={h.id || i} className="mb-3" style={{ position: 'relative' }}>
                          <span className="position-absolute rounded-circle bg-primary" style={{ width: 10, height: 10, left: -21, top: 6 }} />
                          <div className="fw-semibold">{h.poste}</div>
                          <div className="small text-muted">
                            {h.type_contrat ? `${h.type_contrat} · ` : ''}
                            {h.date_debut ? `depuis ${h.date_debut}` : ''}
                          </div>
                          {h.salaire_base != null && (
                            <div className="small font-monospace">
                              {Number(h.salaire_base).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} Ar
                            </div>
                          )}
                          {h.motif_changement && <div className="small text-muted fst-italic">{h.motif_changement}</div>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="col-md-7">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6 className="fw-bold mb-0"><i className="bi bi-file-earmark me-2"></i>Documents RH</h6>
                    <button className="btn btn-outline-secondary btn-sm fw-bold" onClick={() => setShowForm(!showForm)}>
                      <i className="bi bi-plus-circle me-1"></i>Ajouter
                    </button>
                  </div>
<!-- SUITE-DOCS-2 -->
                  {showForm && (
                    <form onSubmit={handleAdd} className="border rounded-3 p-3 mb-3 bg-light">
                      <div className="row g-2">
                        <div className="col-12">
                          <label className="form-label small fw-semibold">Nom *</label>
                          <input type="text" className="form-control form-control-sm" required value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
                        </div>
                        <div className="col-6">
                          <label className="form-label small fw-semibold">Catégorie</label>
                          <select className="form-select form-select-sm" value={form.categorie} onChange={(e) => setForm({ ...form, categorie: e.target.value })}>
                            {Object.entries(CAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                        </div>
                        <div className="col-6">
                          <label className="form-label small fw-semibold">URL du fichier</label>
                          <input type="url" className="form-control form-control-sm" value={form.fichier_url} onChange={(e) => setForm({ ...form, fichier_url: e.target.value })} placeholder="https://..." />
                        </div>
                        <div className="col-12">
                          <label className="form-label small fw-semibold">Description</label>
                          <input type="text" className="form-control form-control-sm" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                        </div>
                        <div className="col-12 d-flex gap-2 justify-content-end">
                          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setShowForm(false)}>Annuler</button>
                          <button type="submit" className="btn btn-outline-secondary btn-sm fw-bold">Enregistrer</button>
                        </div>
                      </div>
                    </form>
                  )}

                  {documents.length === 0 && !showForm ? (
                    <div className="text-muted small">Aucun document RH.</div>
                  ) : (
                    <ul className="list-group">
                      {documents.map((d) => (
                        <li key={d.id} className="list-group-item d-flex justify-content-between align-items-center">
                          <div>
                            <div className="fw-semibold small">{d.nom || d.titre}</div>
                            <span className="badge bg-light text-dark border me-2">{CAT_LABELS[d.categorie] || d.categorie}</span>
                            <small className="text-muted">{d.description || ''}</small>
                          </div>
                          {d.fichier_url && (
                            <a href={d.fichier_url} target="_blank" rel="noreferrer" className="btn btn-outline-secondary btn-sm">
                              <i className="bi bi-download"></i>
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}