import { useEffect, useState } from 'react'
import { subscriptionsService } from '@/services/subscriptions.service'
import { useAuthStore } from '@/stores/auth.store'
import type { Plan } from '@/types'
import { useNavigate } from 'react-router-dom'

const PLANS_DEFAULT: Plan[] = [
  {
    id: 0,
    nom: 'Essai Gratuit',
    code: 'essai',
    description: 'Accès complet pendant 30 jours pour découvrir toutes les fonctionnalités.',
    prix_mensuel: 0,
    prix_annuel: 0,
    utilisateurs_max: 2,
    chantiers_max: 1,
    stockage_go: 1,
    duree_essai_jours: 30,
    actif: true,
  },
  {
    id: 0,
    nom: 'Starter',
    code: 'starter',
    description: 'Pour les petites entreprises qui démarrent.',
    prix_mensuel: 15000,
    prix_annuel: 150000,
    utilisateurs_max: 5,
    chantiers_max: 3,
    stockage_go: 10,
    duree_essai_jours: 30,
    actif: true,
  },
  {
    id: 0,
    nom: 'Pro',
    code: 'pro',
    description: 'Le plus populaire. Pour les équipes en croissance.',
    prix_mensuel: 40000,
    prix_annuel: 400000,
    utilisateurs_max: 20,
    chantiers_max: 10,
    stockage_go: 50,
    duree_essai_jours: 30,
    actif: true,
  },
  {
    id: 0,
    nom: 'Business',
    code: 'business',
    description: 'Pour les entreprises établies avec des besoins avancés.',
    prix_mensuel: 100000,
    prix_annuel: 1000000,
    utilisateurs_max: 50,
    chantiers_max: 25,
    stockage_go: 200,
    duree_essai_jours: 30,
    actif: true,
  },
  {
    id: 0,
    nom: 'Enterprise',
    code: 'enterprise',
    description: 'Fonctionnalités et support personnalisés. Sur devis.',
    prix_mensuel: 0,
    prix_annuel: 0,
    utilisateurs_max: 999,
    chantiers_max: 999,
    stockage_go: 999,
    duree_essai_jours: 30,
    actif: true,
  },
]

export function PricingPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [selecting, setSelecting] = useState(false)
  const { user } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    subscriptionsService.getPlans()
      .then((data) => setPlans(data))
      .catch(() => setPlans(PLANS_DEFAULT))
      .finally(() => setLoading(false))
  }, [])

  const handleSelectPlan = async (planId: number, periode: 'mensuel' | 'annuel') => {
    if (!user?.entreprise_id) {
      navigate('/login')
      return
    }
    setSelecting(true)
    try {
      await subscriptionsService.createAdminSubscription({
        entreprise_id: user.entreprise_id,
        plan_id: planId,
        periode,
      })
      alert('Abonnement choisi avec succès !')
      navigate('/dashboard')
    } catch {
      alert('Erreur lors de la sélection du plan.')
    } finally {
      setSelecting(false)
    }
  }

  const getPrice = (plan: Plan, periode: 'mensuel' | 'annuel') => {
    if (plan.prix_mensuel === 0 && plan.prix_annuel === 0) return 'Sur devis'
    if (periode === 'annuel') {
      if (plan.prix_annuel === 0) return 'Sur devis'
      return `${plan.prix_annuel.toLocaleString()} Ar/an`
    }
    if (plan.prix_mensuel === 0) return 'Sur devis'
    return `${plan.prix_mensuel.toLocaleString()} Ar/mois`
  }

  const getEconomie = (plan: Plan) => {
    if (plan.prix_mensuel === 0 || plan.prix_annuel === 0) return null
    const mensuel = plan.prix_mensuel * 12
    const annuel = plan.prix_annuel
    if (annuel >= mensuel) return null
    const pct = Math.round((1 - annuel / mensuel) * 100)
    return pct
  }

  return (
    <div className="py-5 position-relative">
      <button
        type="button"
        className="btn-close position-absolute top-0 end-0 m-3"
        aria-label="Fermer et revenir a la page precedente"
        title="Retour a la page precedente"
        onClick={() => {
          if (user?.entreprise_id) {
            navigate('/dashboard')
          } else {
            navigate(-1)
          }
        }}
      ></button>
      <div className="text-center mb-5">
        <h1 className="fw-bold mb-2">Nos Formules d'Abonnement</h1>
        <p className="text-muted">Choisissez la formule adaptée à la taille de votre entreprise. Paiement Mobile Money disponible.</p>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-secondary" role="status"></div>
        </div>
      ) : (
        <div className="row g-4">
          {plans.map((plan) => {
            const isPro = plan.code === 'pro'
            const isEnterprise = plan.code === 'enterprise'
            return (
              <div key={plan.code} className="col-md-6 col-lg-4">
                <div className={`card border-0 shadow-sm h-100 position-relative ${isPro ? 'border-primary border-2' : ''}`}>
                  {isPro && (
                    <div className="position-absolute top-0 start-50 translate-middle badge rounded-pill bg-primary">
                      <i className="bi bi-star-fill"></i> Plus populaire
                    </div>
                  )}
                  <div className="card-body d-flex flex-column p-4">
                    <h5 className="fw-bold mb-1">{plan.nom}</h5>
                    <p className="text-muted small mb-3">{plan.description}</p>
                    <div className="mb-3">
                      <span className="display-6 fw-bold">{getPrice(plan, 'mensuel')}</span>
                      {plan.prix_mensuel > 0 && <small className="text-muted">/mois</small>}
                    </div>
                    {getEconomie(plan) && (
                      <div className="mb-3">
                        <span className="badge bg-success bg-opacity-10 text-success border">Économisez {getEconomie(plan)}% avec l'annuel</span>
                      </div>
                    )}
                    <ul className="list-unstyled mb-4">
                      <li className="mb-2"><i className="bi bi-check-circle text-success me-2"></i>Jusqu'à {plan.utilisateurs_max} utilisateurs</li>
                      <li className="mb-2"><i className="bi bi-check-circle text-success me-2"></i>Jusqu'à {plan.chantiers_max} chantiers actifs</li>
                      <li className="mb-2"><i className="bi bi-check-circle text-success me-2"></i>{plan.stockage_go} Go de stockage</li>
                      <li className="mb-2"><i className="bi bi-check-circle text-success me-2"></i>Essai gratuit de {plan.duree_essai_jours} jours</li>
                    </ul>
                    <div className="mt-auto d-grid gap-2">
                      {isEnterprise ? (
                        <button className="btn btn-outline-secondary" onClick={() => alert('Contactez-nous pour une offre sur mesure')}>Contactez-nous</button>
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
