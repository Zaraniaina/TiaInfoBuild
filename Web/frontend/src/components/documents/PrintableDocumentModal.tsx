import React from 'react'
import { WorkerBadgeCard } from '@/components/pointage/WorkerBadgeCard'

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

      <div className="modal fade show d-block no-print" tabIndex={-1} style={{ backgroundColor: 'var(--overlay-strong)', zIndex: 1060 }}>
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

                {/* 2. DOCUMENT TYPE: BADGE INDIVIDUEL — même rendu que le modal RH (WorkerBadgeCard) */}
                {type === 'badge' && data.employe && (
                  <div className="py-3 d-flex justify-content-center">
                    <WorkerBadgeCard
                      employe={data.employe}
                      entrepriseLogo={logo || undefined}
                      entrepriseNom={data.entreprise_nom || undefined}
                    />
                  </div>
                )}

                {/* 3. DOCUMENT TYPE: GRILLE DE BADGES — mêmes cartes que le badge individuel */}
                {type === 'badge_grid' && data.employes_list && (
                  <div>
                    <h5 className="fw-bold mb-3 border-bottom pb-2 no-print">Planche de Badges QR - {data.employes_list.length} Employés</h5>
                    <div className="row g-3">
                      {data.employes_list.map((emp, idx) => (
                        <div className="col-12 col-md-6 col-lg-4" key={emp.id || idx}>
                          <div className="mx-auto" style={{ width: '100%', maxWidth: 360 }}>
                            <WorkerBadgeCard
                              employe={emp}
                              entrepriseLogo={logo || undefined}
                              entrepriseNom={data.entreprise_nom || undefined}
                            />
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
