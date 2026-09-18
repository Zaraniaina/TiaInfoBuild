import { useEffect, useState } from 'react'
import { subscriptionsService } from '@/services/subscriptions.service'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/stores/toast.store'
import type { Plan } from '@/types'
import { useNavigate } from 'react-router-dom'
import { TableSkeleton } from '@/components/ui/Skeleton'

// Plans système : jamais "sur devis", jamais mis en avant comme payants.
const CODES_SYSTEME = ['essai', 'gratuit']

export function PricingPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [refEnCours, setRefEnCours] = useState<string | null>(null)
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const { showToast } = useToast()

  useEffect(() => {
    subscriptionsService.getPlans()
      .then((data) => setPlans(data))
      // PAS de fallback : ne JAMAIS afficher des plans fictifs aux clients.
      .catch(() => setLoadFailed(true))
      .finally(() => setLoading(false))
  }, [])

  // Récupère l'abonnement local lié à la référence SUB-{id}-{ronde} et redirige
  // vers la page de paiement Papi. Fallback : si la passerelle n'est pas
  // configurée (503 paiement_non_configure), on active directement (comportement
  // historique, sans régression pour les démos).
  const initiatePaiement = async (planId: number, periode: 'mensuel' | 'annuel'): Promise<boolean> => {
    try {
      const res = await api.post('/paiements/abonnement/initier', { plan_id: planId, periode })
      const data = res.data as { payment_link: string; reference: string }
      window.open(data.payment_link, '_blank', 'noopener')
      setRefEnCours(data.reference)
      showToast('info', 'Paiement initié', 'Completez le paiement dans le nouvel onglet. Cette page se met à jour automatiquement dès confirmation.')
      return true
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: { code?: string; message?: string } | string } } })?.response?.data?.detail
      const code = typeof detail === 'object' ? detail?.code : null
      if (code === 'paiement_non_configure') return false // fallback activation directe
      const message = typeof detail === 'object' && detail?.message ? detail.message : 'Paiement indisponible pour le moment.'
      showToast('error', 'Paiement impossible', message)
      return true // erreur réelle : ne pas activer gratuitement
    }
  }

  // Polling léger du statut (toutes les 3 s pendant 2 min) pendant qu'un paiement est en cours
  useEffect(() => {
    if (!refEnCours) return
    let tentatives = 0
    const id = setInterval(async () => {
      tentatives += 1
      if (tentatives > 40) {
        clearInterval(id)
        setRefEnCours(null)
        return
      }
      try {
        const res = await api.get(`/paiements/abonnement/${encodeURIComponent(refEnCours)}/statut`)
        const data = res.data as { link_status?: string; payment_status?: string }
        if (data.link_status === 'PAID' && data.payment_status === 'SUCCESS') {
          clearInterval(id)
          setRefEnCours(null)
          showToast('success', 'Paiement confirmé', 'Votre abonnement est actif. Bonne exploitation !')
          navigate('/app/dashboard')
        }
      } catch {
        /* on retente au prochain tick */
      }
    }, 3000)
    return () => clearInterval(id)
  }, [refEnCours, navigate, showToast])

  const handleSelectPlan = async (planId: number, periode: 'mensuel' | 'annuel') => {
    if (!user?.entreprise_id) {
      navigate('/login')
      return
    }
    const plan = plans.find(p => p.id === planId)
    const estPayant = plan ? (periode === 'annuel' ? plan.prix_annuel > 0 : plan.prix_mensuel > 0) : false
    setSelecting(true)
    try {
      // Plan payant + passerelle configurée : passer par Papi
      if (estPayant && (await initiatePaiement(planId, periode))) {
        return // paiement en cours, polling actif
      }
      // Plan gratuit OU passerelle non configurée : activation directe (fallback historique)
      await subscriptionsService.createSubscription({
        plan_id: planId,
        periode,
      })
      navigate('/app/dashboard', { state: { toast: { type: 'success', title: 'Abonnement activé', message: 'Votre nouvelle formule est active. Bonne exploitation !' } } })
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: { message?: string } | string } } })?.response?.data?.detail
      const message = typeof detail === 'object' && detail?.message ? detail.message : 'Erreur lors de la sélection du plan. Vérifiez votre connexion et réessayez.'
      navigate('/app/dashboard', { state: { toast: { type: 'error', title: 'Sélection impossible', message } } })
    } finally {
      setSelecting(false)
    }
  }

  // "Sur devis" = plan payant sans tarif renseigné (data-driven, plus de code en dur).
  const isSurDevis = (plan: Plan, periode: 'mensuel' | 'annuel') => {
    if (CODES_SYSTEME.includes(plan.code)) return false
    return periode === 'annuel' ? plan.prix_annuel === 0 : plan.prix_mensuel === 0
  }

  const getPrice = (plan: Plan, periode: 'mensuel' | 'annuel') => {
    if (isSurDevis(plan, periode)) return 'Sur devis'
    if (periode === 'annuel') return `${plan.prix_annuel.toLocaleString()} Ar/an`
    return `${plan.prix_mensuel.toLocaleString()} Ar/mois`
  }

  const getEconomie = (plan: Plan) => {
    if (plan.prix_mensuel === 0 || plan.prix_annuel === 0) return null
    const mensuel = plan.prix_mensuel * 12
    const annuel = plan.prix_annuel
    if (annuel >= mensuel) return null
    return Math.round((1 - annuel / mensuel) * 100)
  }

  // Le plan le plus cher actif du catalogue = "populaire" est data-driven :
  // on met en avant le premier plan payant trié par prix (le back-end trie déjà).
  const planPopulaire = plans.find((p) => !CODES_SYSTEME.includes(p.code) && p.prix_mensuel > 0)?.code

  return (
    <div className="py-5 position-relative">
      <button
        type="button"
        className="btn-close position-absolute top-0 end-0 m-3"
        aria-label="Fermer et revenir a la page precedente"
        title="Retour a la page precedente"
        onClick={() => {
          if (user?.entreprise_id) {
            navigate('/app/dashboard')
          } else {
            navigate(-1)
          }
        }}
      ></button>
      <div className="text-center mb-5">
        <h1 className="fw-bold mb-2">Nos Formules d'Abonnement</h1>
        <p className="text-muted">Choisissez la formule adaptée à la taille de votre entreprise. Paiement Mobile Money disponible.<br /><small><i className="bi bi-gift me-1 text-success"></i>Essai gratuit de 30 jours offert à l'inscription de votre entreprise, sans engagement.</small></p>
      </div>

      {refEnCours && (
        <div className="alert alert-info d-flex align-items-center gap-2 mx-auto mb-4" style={{ maxWidth: 720 }} role="status">
          <span className="spinner-border spinner-border-sm" aria-hidden="true"></span>
          <div className="small">
            <strong>Paiement en cours…</strong> Complétez le paiement dans l'onglet ouvert (MVola / Orange Money / Airtel / Visa). Cette page se met à jour automatiquement dès la confirmation.
          </div>
        </div>
      )}

      {loading ? (
        <TableSkeleton rows={3} columns={3} />
      ) : loadFailed ? (
        <div className="text-center py-5" role="status">
          <i className="bi bi-wifi-off text-muted" style={{ fontSize: '2.5rem' }} aria-hidden="true"></i>
          <h3 className="mt-3 fs-5 fw-semibold">Impossible de charger les formules</h3>
          <p className="text-muted mb-4">Vérifiez votre connexion puis réessayez.</p>
          <button className="btn btn-outline-secondary" onClick={() => { setLoading(true); setLoadFailed(false); subscriptionsService.getPlans().then(setPlans).catch(() => setLoadFailed(true)).finally(() => setLoading(false)) }}>
            Réessayer
          </button>
        </div>
      ) : plans.length === 0 ? (
        <div className="text-center py-5" role="status">
          <i className="bi bi-tags text-muted" style={{ fontSize: '2.5rem' }} aria-hidden="true"></i>
          <h3 className="mt-3 fs-5 fw-semibold">Aucune formule publiée pour le moment</h3>
          <p className="text-muted mb-0">Les formules d'abonnement seront bientôt disponibles. Contactez-nous pour être informé.</p>
        </div>
      ) : (
        <div className="row g-4">
          {plans.map((plan) => {
            const isSysteme = CODES_SYSTEME.includes(plan.code)
            const isPopulaire = plan.code === planPopulaire
            return (
              <div key={plan.code} className="col-md-6 col-lg-4">
                <div className={`card border-0 shadow-sm h-100 position-relative ${isPopulaire ? 'border-primary border-2' : ''}`}>
                  {isPopulaire && (
                    <div className="position-absolute top-0 start-50 translate-middle badge rounded-pill bg-primary">
                      <i className="bi bi-star-fill"></i> Plus populaire
                    </div>
                  )}
                  <div className="card-body d-flex flex-column p-4">
                    <div className="d-flex justify-content-between align-items-start mb-1">
                      <h5 className="fw-bold mb-0">{plan.nom}</h5>
                      {isSysteme && <span className="badge bg-secondary bg-opacity-10 text-secondary border">Gratuit</span>}
                    </div>
                    <p className="text-muted small mb-3">{plan.description}</p>
                    <div className="mb-3">
                      <span className="display-6 fw-bold">{getPrice(plan, 'mensuel')}</span>
                      {!isSurDevis(plan, 'mensuel') && plan.prix_mensuel > 0 && <small className="text-muted">/mois</small>}
                    </div>
                    {getEconomie(plan) && (
                      <div className="mb-3">
                        <span className="badge bg-success bg-opacity-10 text-success border">Économisez {getEconomie(plan)}% avec l'annuel</span>
                      </div>
                    )}
                    <ul className="list-unstyled mb-4">
                      <li className="mb-2"><i className="bi bi-check-circle text-success me-2"></i>{plan.utilisateurs_max ?? 'Illimité'} employés</li>
                      <li className="mb-2"><i className="bi bi-check-circle text-success me-2"></i>{plan.chantiers_max ?? 'Illimités'} chantiers actifs</li>
                      <li className="mb-2"><i className="bi bi-check-circle text-success me-2"></i>Clients portail illimités</li>
                      {isSysteme && plan.code === 'essai' && plan.duree_essai_jours > 0 && (
                        <li className="mb-2"><i className="bi bi-gift text-success me-2"></i>{plan.duree_essai_jours} jours d'essai complet</li>
                      )}
                    </ul>
                    <div className="mt-auto d-grid gap-2">
                      {isSurDevis(plan, 'mensuel') ? (
                        <button className="btn btn-outline-secondary" onClick={() => navigate('/app/dashboard', { state: { toast: { type: 'info', title: 'Offre sur mesure', message: 'Contactez notre équipe pour une offre adaptée à votre volume.' } } })}>
                          Contactez-nous
                        </button>
                      ) : isSysteme ? (
                        <button className="btn btn-outline-secondary" disabled={selecting} onClick={() => handleSelectPlan(plan.id, 'mensuel')}>
                          Activer cette formule
                        </button>
                      ) : (
                        <>
                          <button className="btn btn-outline-secondary" disabled={selecting} onClick={() => handleSelectPlan(plan.id, 'mensuel')}>
                            Choisir mensuel
                          </button>
                          <button className="btn btn-outline-secondary" disabled={selecting} onClick={() => handleSelectPlan(plan.id, 'annuel')}>
                            Choisir annuel <small className="text-muted">(2 mois offerts)</small>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
