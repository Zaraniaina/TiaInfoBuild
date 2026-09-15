import React from 'react'

export type DocumentType = 'devis' | 'facture' | 'contrat' | 'badge' | 'badge_grid'

export interface PrintableDocumentData {
  id?: number
  numero?: string
  date?: string
  date_echeance?: string
  client_nom?: string
  client_adresse?: string
  client_email?: string
  client_telephone?: string
  chantier_nom?: string
  entreprise_nom?: string
  entreprise_logo?: string
  entreprise_adresse?: string
  entreprise_telephone?: string
  entreprise_email?: string
  entreprise_siret?: string
  entreprise_tva?: string
  entreprise_rib?: string
  devise?: string
  lignes?: Array<{
    designation: string
    quantite: number
    unite?: string
    prix_unitaire: number
    montant_ht: number
    tva?: number
  }>
  total_ht?: number
  tva_montant?: number
  total_ttc?: number
  acompte?: number
  reste_a_payer?: number
  conditions_paiement?: string
  notes?: string
  // For Badges
  employe?: {
    id: number
    nom: string
    prenom?: string
    matricule?: string
    poste?: string
    photo?: string
    code_qr_badge?: string
    role_code?: string
    couleur_role?: string
  }
  employes_list?: Array<{
    id: number
    nom: string
    prenom?: string
    matricule?: string
    poste?: string
    photo?: string
    code_qr_badge?: string
    role_code?: string
    couleur_role?: string
  }>
}

interface PrintableDocumentModalProps {
  show: boolean
  onClose: () => void
  type: DocumentType
  data: PrintableDocumentData
}

export const PrintableDocumentModal: React.FC<PrintableDocumentModalProps> = ({
  show,
  onClose,
  type,
  data,
}) => {
  if (!show) return null

  const handlePrint = () => {
    window.print()
  }

  const devise = data.devise || 'MGA'
  const logo = data.entreprise_logo
  const roleColorMap: Record<string, string> = {
    super_admin: '#dc2626',
    admin_entreprise: '#2563eb',
    directeur: '#1e3a8a',
    comptable: '#0d9488',
    chef_projet: '#4338ca',
    chef_chantier: '#ea580c',
    rh: '#7e22ce',
    materiel: '#475569',
    magasinier: '#d97706',
    commercial: '#059669',
    employe: '#2563eb',
    client: '#6d28d9',
  }

  return (
    <>
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-document-root, #printable-document-root * {
            visibility: visible !important;
          }
          #printable-document-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 20px !important;
            background: #fff !important;
            color: #000 !important;
          }
          .modal-backdrop, .no-print {
            display: none !important;
          }
          .page-break {
            page-break-after: always;
          }
        }
      `}</style>

      <div className="modal fade show d-block no-print" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1060 }}>
        <div className="modal-dialog modal-xl modal-dialog-scrollable modal-dialog-centered">
          <div className="modal-content border-0 shadow-lg rounded-4">
            <div className="modal-header bg-dark text-white border-0 py-3">
              <h5 className="modal-title fw-bold d-flex align-items-center gap-2">
                <i className="bi bi-printer text-info"></i>
                Aperçu et Impression : {type.toUpperCase()} {data.numero ? `#${data.numero}` : ''}
              </h5>
              <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
            </div>
            
            <div className="modal-body bg-light p-4" style={{ minHeight: '500px' }}>
              <div id="printable-document-root" className="bg-white p-4 p-md-5 rounded-4 shadow-sm mx-auto" style={{ maxWidth: '850px', color: '#1e293b' }}>
                
                {/* 1. DOCUMENT TYPE: DEVIS, FACTURE, CONTRAT */}
                {(type === 'devis' || type === 'facture' || type === 'contrat') && (
                  <div>
                    {/* Header */}
                    <div className="row align-items-center mb-4 pb-4 border-bottom">
                      <div className="col-7">
                        {logo ? (
                          <img src={logo} alt="Logo entreprise" style={{ maxHeight: '64px', maxWidth: '220px', objectFit: 'contain' }} className="mb-2" />
                        ) : (
                          <div className="fw-bold fs-3 text-primary mb-1">{data.entreprise_nom || 'ENTREPRISE BTP'}</div>
                        )}
                        <div className="small text-muted">
                          {data.entreprise_adresse && <div>{data.entreprise_adresse}</div>}
                          {data.entreprise_telephone && <div>Tél: {data.entreprise_telephone}</div>}
                          {data.entreprise_email && <div>Email: {data.entreprise_email}</div>}
                          {data.entreprise_siret && <div className="font-monospace">SIRET/NIF: {data.entreprise_siret}</div>}
                        </div>
                      </div>
                      <div className="col-5 text-end">
                        <span className={`badge fs-6 px-3 py-2 text-uppercase mb-2 ${type === 'facture' ? 'bg-primary' : type === 'devis' ? 'bg-warning text-dark' : 'bg-success'}`}>
                          {type === 'devis' ? 'DEVIS DE TRAVAUX' : type === 'facture' ? 'FACTURE OFFICIELLE' : 'CONTRAT DE CHANTIER'}
                        </span>
                        <h4 className="fw-bold mb-1">N° {data.numero || 'DOC-0000'}</h4>
                        <div className="small text-muted">Date: <strong>{data.date || new Date().toLocaleDateString()}</strong></div>
                        {data.date_echeance && <div className="small text-muted">Échéance: <strong>{data.date_echeance}</strong></div>}
                      </div>
                    </div>

                    {/* Client & Chantier Details */}
                    <div className="row g-3 mb-4">
                      <div className="col-6">
                        <div className="p-3 bg-light rounded-3 border">
                          <div className="text-uppercase small fw-bold text-muted mb-1">Facturé à (Client) :</div>
                          <div className="fw-bold fs-6">{data.client_nom || 'Client Non Spécifié'}</div>
                          {data.client_adresse && <div className="small text-muted">{data.client_adresse}</div>}
                          {data.client_telephone && <div className="small text-muted">Tél: {data.client_telephone}</div>}
                          {data.client_email && <div className="small text-muted">Email: {data.client_email}</div>}
                        </div>
                      </div>
                      <div className="col-6">
                        <div className="p-3 bg-light rounded-3 border">
                          <div className="text-uppercase small fw-bold text-muted mb-1">Chantier / Projet :</div>
                          <div className="fw-bold fs-6">{data.chantier_nom || 'Chantier Général'}</div>
                          <div className="small text-muted">Référence dossier: {data.numero || 'REF-BTP'}</div>
                          <div className="small text-muted">Devise de facturation: <strong>{devise}</strong></div>
                        </div>
                      </div>
                    </div>

                    {/* Table des prestations / Lignes */}
                    <div className="table-responsive mb-4">
                      <table className="table table-bordered align-middle">
                        <thead className="table-dark">
                          <tr>
                            <th style={{ width: '45%' }}>Désignation des travaux & matériaux</th>
                            <th className="text-center">Qté</th>
                            <th className="text-center">Unité</th>
                            <th className="text-end">Prix Unit. ({devise})</th>
                            <th className="text-end">Montant HT ({devise})</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.lignes && data.lignes.length > 0 ? (
                            data.lignes.map((l, idx) => (
                              <tr key={idx}>
                                <td className="fw-semibold">{l.designation}</td>
                                <td className="text-center">{l.quantite}</td>
                                <td className="text-center">{l.unite || 'U'}</td>
                                <td className="text-end font-monospace">{l.prix_unitaire.toLocaleString('fr-FR')}</td>
                                <td className="text-end font-monospace fw-bold">{l.montant_ht.toLocaleString('fr-FR')}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={5} className="text-center text-muted py-3">Aucun détail de prestation</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Totaux & Règlements */}
                    <div className="row mb-4">
                      <div className="col-6">
                        {data.conditions_paiement && (
                          <div className="p-3 bg-light rounded-3 border mb-2">
                            <div className="fw-bold small text-muted">Conditions de règlement :</div>
                            <div className="small">{data.conditions_paiement}</div>
                          </div>
                        )}
                        {data.entreprise_rib && (
                          <div className="p-3 bg-light rounded-3 border">
                            <div className="fw-bold small text-muted">Coordonnées bancaires / Mobile Money :</div>
                            <div className="small font-monospace">{data.entreprise_rib}</div>
                          </div>
                        )}
                      </div>
                      <div className="col-6">
                        <div className="p-3 bg-light rounded-3 border">
                          <div className="d-flex justify-content-between mb-2">
                            <span className="text-muted">Total HT:</span>
                            <span className="fw-bold font-monospace">{(data.total_ht || 0).toLocaleString('fr-FR')} {devise}</span>
                          </div>
                          <div className="d-flex justify-content-between mb-2">
                            <span className="text-muted">TVA ({data.entreprise_tva || '20'}%):</span>
                            <span className="fw-bold font-monospace">{(data.tva_montant || 0).toLocaleString('fr-FR')} {devise}</span>
                          </div>
                          <div className="d-flex justify-content-between border-top pt-2 fs-5">
                            <span className="fw-bold text-dark">Total TTC:</span>
                            <span className="fw-bold font-monospace text-primary">{(data.total_ttc || 0).toLocaleString('fr-FR')} {devise}</span>
                          </div>
                          {data.acompte && data.acompte > 0 && (
                            <div className="d-flex justify-content-between text-success border-top pt-2 small">
                              <span>Acompte perçu:</span>
                              <span className="font-monospace">-{data.acompte.toLocaleString('fr-FR')} {devise}</span>
                            </div>
                          )}
                          {data.reste_a_payer !== undefined && (
                            <div className="d-flex justify-content-between text-danger fw-bold border-top pt-2">
                              <span>Reste à payer:</span>
                              <span className="font-monospace">{data.reste_a_payer.toLocaleString('fr-FR')} {devise}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Signatures */}
                    <div className="row pt-4 mt-4 border-top text-center text-muted small">
                      <div className="col-6 border-end">
                        <div className="fw-bold mb-5">Pour l'entreprise (Bon pour accord & Signature)</div>
                        <div className="border-bottom mx-auto style-signature" style={{ width: '60%' }}></div>
                      </div>
                      <div className="col-6">
                        <div className="fw-bold mb-5">Le Client (Date & Signature précédée de "Bon pour accord")</div>
                        <div className="border-bottom mx-auto style-signature" style={{ width: '60%' }}></div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. DOCUMENT TYPE: BADGE INDIVIDUEL */}
                {type === 'badge' && data.employe && (
                  <div className="text-center py-3">
                    <div
                      className="card border-0 shadow-lg rounded-4 overflow-hidden mx-auto text-white"
                      style={{
                        maxWidth: '380px',
                        background: `linear-gradient(135deg, ${data.employe.couleur_role || roleColorMap[data.employe.role_code || 'employe'] || '#1e293b'} 0%, #0f172a 100%)`,
                      }}
                    >
                      <div className="p-3 text-center border-bottom border-secondary border-opacity-25" style={{ background: 'rgba(255,255,255,0.08)' }}>
                        {logo ? (
                          <img src={logo} alt="Logo" style={{ maxHeight: '36px', maxWidth: '160px', objectFit: 'contain' }} className="mb-1 d-block mx-auto" />
                        ) : (
                          <div className="fw-bold fs-5 text-uppercase">{data.entreprise_nom || 'TIA INFO BUILD'}</div>
                        )}
                        <span className="fw-bold tracking-wider text-uppercase" style={{ fontSize: '0.75rem', color: '#38bdf8' }}>BADGE OFFICIEL POINTAGE TERRAIN</span>
                      </div>

                      <div className="p-4 text-center">
                        <div className="position-relative d-inline-block mb-3">
                          {data.employe.photo ? (
                            <img
                              src={data.employe.photo}
                              alt={data.employe.nom}
                              className="rounded-circle border border-3 border-white shadow"
                              style={{ width: '96px', height: '96px', objectFit: 'cover' }}
                            />
                          ) : (
                            <div className="rounded-circle border border-3 border-white shadow d-flex align-items-center justify-content-center fw-bold fs-2 text-white bg-secondary mx-auto" style={{ width: '96px', height: '96px' }}>
                              {data.employe.prenom?.[0] || 'O'}{data.employe.nom?.[0] || 'U'}
                            </div>
                          )}
                        </div>

                        <h4 className="fw-bold mb-1 text-white">{data.employe.prenom} {data.employe.nom}</h4>
                        <div className="badge bg-light text-dark fw-bold mb-3 px-3 py-1 text-uppercase" style={{ fontSize: '0.8rem' }}>
                          {data.employe.poste || 'Ouvrier'}
                        </div>

                        <div className="small text-light text-opacity-75 mb-3">
                          Matricule: <strong className="text-white">{data.employe.matricule || `EMP-${data.employe.id}`}</strong>
                        </div>

                        <div className="p-3 bg-white rounded-3 d-inline-block shadow-sm mb-2">
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(data.employe.code_qr_badge || `TIA-EMP-${data.employe.id}`)}`}
                            alt="QR Badge"
                            style={{ width: '160px', height: '160px', display: 'block' }}
                          />
                        </div>

                        <div className="small text-light text-opacity-50 mt-2" style={{ fontSize: '0.7rem' }}>
                          Ce badge permet l'émargement et le pointage sur les chantiers.
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. DOCUMENT TYPE: GRILLE DE BADGES (IMPRESSION PAR LOTS) */}
                {type === 'badge_grid' && data.employes_list && (
                  <div>
                    <h5 className="fw-bold mb-3 border-bottom pb-2 no-print">Planche de Badges QR - {data.employes_list.length} Employés</h5>
                    <div className="row g-3">
                      {data.employes_list.map((emp, idx) => (
                        <div className="col-6 col-md-4" key={emp.id || idx}>
                          <div
                            className="card border-0 shadow-sm rounded-3 overflow-hidden text-white p-2 text-center"
                            style={{
                              background: `linear-gradient(135deg, ${emp.couleur_role || roleColorMap[emp.role_code || 'employe'] || '#1e293b'} 0%, #0f172a 100%)`,
                              fontSize: '0.8rem',
                            }}
                          >
                            <div className="fw-bold text-uppercase" style={{ fontSize: '0.7rem', color: '#38bdf8' }}>
                              {data.entreprise_nom || 'TIA BUILD'}
                            </div>
                            <div className="my-1">
                              {emp.photo ? (
                                <img src={emp.photo} alt={emp.nom} className="rounded-circle border border-2 border-white" style={{ width: '48px', height: '48px', objectFit: 'cover' }} />
                              ) : (
                                <div className="rounded-circle border border-2 border-white d-flex align-items-center justify-content-center fw-bold bg-secondary mx-auto" style={{ width: '48px', height: '48px' }}>
                                  {emp.prenom?.[0] || 'E'}{emp.nom?.[0] || ''}
                                </div>
                              )}
                            </div>
                            <div className="fw-bold text-truncate">{emp.prenom} {emp.nom}</div>
                            <div className="text-light text-opacity-75 small text-truncate">{emp.poste || 'Employé'}</div>
                            <div className="bg-white rounded-2 p-1 d-inline-block my-1">
                              <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(emp.code_qr_badge || `TIA-EMP-${emp.id}`)}`}
                                alt="QR"
                                style={{ width: '80px', height: '80px', display: 'block' }}
                              />
                            </div>
                            <div className="font-monospace text-light opacity-75" style={{ fontSize: '0.65rem' }}>
                              {emp.matricule || `EMP-${emp.id}`}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </div>

            <div className="modal-footer bg-dark border-0 py-3 d-flex justify-content-between">
              <button className="btn btn-outline-light" onClick={onClose}>
                Fermer
              </button>
              <button className="btn btn-primary px-4 fw-bold shadow-sm" onClick={handlePrint}>
                <i className="bi bi-printer me-2"></i>Imprimer / Sauvegarder en PDF
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
