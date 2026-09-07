import { espaceClientService, ProfilData } from '@/services/espaceClient.service'
import { PageHeader, EtatChargement } from './shared'
import { useEffect, useState } from 'react'

export function ClientProfil() {
  const [profil, setProfil] = useState<ProfilData | null>(null)
  const [loading, setLoading] = useState(true)
  const [edition, setEdition] = useState(false)
  const [form, setForm] = useState<Partial<ProfilData>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enregistrement, setEnregistrement] = useState(false)

  const [showMdp, setShowMdp] = useState(false)
  const [ancienMdp, setAncienMdp] = useState('')
  const [nouveauMdp, setNouveauMdp] = useState('')
  const [confirmMdp, setConfirmMdp] = useState('')
  const [mdpMessage, setMdpMessage] = useState<string | null>(null)

  useEffect(() => {
    chargerProfil()
  }, [])

  const chargerProfil = async () => {
    try {
      setLoading(true)
      const data = await espaceClientService.getProfil()
      setProfil(data)
      setForm(data)
    } catch (err: any) {
      setErreur(err?.response?.data?.detail || 'Erreur lors du chargement du profil')
    } finally {
      setLoading(false)
    }
  }

  const enregistrer = async () => {
    try {
      setEnregistrement(true)
      setErreur(null)
      const maj = await espaceClientService.updateProfil(form)
      setProfil(maj)
      setEdition(false)
      setMessage('Informations mises a jour avec succes.')
    } catch (err: any) {
      setErreur(err?.response?.data?.detail || 'Erreur lors de l enregistrement')
    } finally {
      setEnregistrement(false)
    }
  }

  const changerMotDePasse = async () => {
    setMdpMessage(null)
    if (nouveauMdp !== confirmMdp) {
      setMdpMessage('Les mots de passe ne correspondent pas.')
      return
    }
    try {
      await espaceClientService.changePassword(ancienMdp, nouveauMdp)
      setMdpMessage('Mot de passe modifie avec succes.')
      setShowMdp(false)
      setAncienMdp('')
      setNouveauMdp('')
      setConfirmMdp('')
    } catch (err: any) {
      setMdpMessage(err?.response?.data?.detail || 'Erreur lors du changement de mot de passe')
    }
  }

  if (loading) return <EtatChargement />

  const champ = (label: string, cle: keyof ProfilData) => (
    <div className="mb-3">
      <label className="form-label fw-semibold">{label}</label>
      {edition ? (
        <input
          className="form-control"
          value={String(form[cle] || '')}
          onChange={(e) => setForm({ ...form, [cle]: e.target.value })}
        />
      ) : (
        <div>{profil?.[cle] || '-'}</div>
      )}
    </div>
  )

  return (
    <div className="container-fluid py-4">
      <PageHeader titre="Mon profil" icone="bi-person" sousTitre="Consultez et modifiez vos informations personnelles" />
      {message && <div className="alert alert-success py-2">{message}</div>}
      {erreur && <div className="alert alert-danger py-2">{erreur}</div>}
      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <div className="row">
            <div className="col-md-6">
              {champ('Nom / Raison sociale', 'nom')}
              {champ('Prenom', 'prenom')}
              {champ('Type de client', 'type_client')}
              {champ('Email', 'email')}
              {champ('Telephone', 'telephone')}
            </div>
            <div className="col-md-6">
              {champ('Adresse', 'adresse')}
              {champ('Ville', 'ville')}
              {champ('Pays', 'pays')}
              {champ('Informations de facturation', 'infos_facturation')}
            </div>
          </div>
          {edition ? (
            <div className="d-flex gap-2">
              <button className="btn btn-success" disabled={enregistrement} onClick={enregistrer}>
                {enregistrement ? 'Enregistrement...' : 'Enregistrer'}
              </button>
              <button className="btn btn-secondary" onClick={() => { setEdition(false); setForm(profil || {}) }}>
                Annuler
              </button>
            </div>
          ) : (
            <div className="d-flex gap-2">
              <button className="btn btn-primary" onClick={() => { setEdition(true); setErreur(null); setMessage(null) }}>
                <i className="bi bi-pencil me-1"></i>Modifier mes informations
              </button>
              <button className="btn btn-outline-secondary" onClick={() => setShowMdp(!showMdp)}>
                <i className="bi bi-key me-1"></i>Modifier mon mot de passe
              </button>
            </div>
          )}

          {showMdp && (
            <div className="mt-4 p-3 bg-light rounded">
              <h6 className="fw-bold mb-3">Changement de mot de passe</h6>
              {mdpMessage && <div className="alert alert-info py-2">{mdpMessage}</div>}
              <div className="row">
                <div className="col-md-4 mb-2">
                  <label className="form-label">Ancien mot de passe</label>
                  <input type="password" className="form-control" value={ancienMdp} onChange={(e) => setAncienMdp(e.target.value)} />
                </div>
                <div className="col-md-4 mb-2">
                  <label className="form-label">Nouveau mot de passe</label>
                  <input type="password" className="form-control" value={nouveauMdp} onChange={(e) => setNouveauMdp(e.target.value)} />
                </div>
                <div className="col-md-4 mb-2">
                  <label className="form-label">Confirmation</label>
                  <input type="password" className="form-control" value={confirmMdp} onChange={(e) => setConfirmMdp(e.target.value)} />
                </div>
              </div>
              <button className="btn btn-success" onClick={changerMotDePasse}>Valider le changement</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

