import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/services/api'
import type { Plan } from '@/types'
import './landing.css'

/* ============================================================
   Site vitrine TIA INFO BUILD — style convergent.
   Toutes les sections poussent le regard vers la conversion :
   « Créer mon entreprise ». Public, sans authentification.
   ============================================================ */

const STATS = [
  { value: '+120', label: 'Entreprises BTP pilotées' },
  { value: '350+', label: 'Chantiers suivis en temps réel' },
  { value: '99,9 %', label: 'Disponibilité de la plateforme' },
  { value: '30 j', label: 'Essai gratuit sans engagement' },
]

const FEATURES = [
  {
    icon: 'bi-building',
    titre: 'Chantiers & Phases',
    texte: 'Avancement, budgets, affectations et documents centralisés pour chaque chantier, du devis à la réception.',
  },
  {
    icon: 'bi-qr-code-scan',
    titre: 'RH & Pointages QR',
    texte: 'Badges QR pour vos équipes terrain : pointage entrée/sortie en un scan, feuilles d’heures fiables, congés gérés.',
  },
  {
    icon: 'bi-tools',
    titre: 'Matériels & Engins',
    texte: 'Parc, maintenances planifiées, affectations entre chantiers — plus d’engin perdu ni de panne surprise.',
  },
  {
    icon: 'bi-box-seam',
    titre: 'Stocks & Dépôts',
    texte: 'Entrées/sorties, alertes de réapprovisionnement et traçabilité des matériaux par dépôt.',
  },
  {
    icon: 'bi-currency-exchange',
    titre: 'Finances',
    texte: 'Dépenses, situations de travaux, factures et trésorerie consolidées — vos marges sous contrôle.',
  },
  {
    icon: 'bi-people',
    titre: 'Portail Client',
    texte: 'Vos clients suivent leurs projets, devis et factures depuis leur espace dédié. Transparence totale.',
  },
]

const ETAPES = [
  {
    num: '1',
    titre: 'Créez votre entreprise',
    texte: 'Inscription en 2 minutes. Vos rôles, vos équipes et vos paramètres sont prêts immédiatement — avec 30 jours d’essai complet.',
  },
  {
    num: '2',
    titre: 'Invitez vos équipes',
    texte: 'Direction, chantier, RH, magasin, commercial, ouvriers : chacun accède à son espace, sur mesure et sécurisé.',
  },
  {
    num: '3',
    titre: 'Pilotez du bureau au terrain',
    texte: 'Tableaux de bord en temps réel, pointages QR, photos de chantier : tout remonte instantanément.',
  },
]

const TEMOIGNAGES = [
  {
    citation: 'Les pointages QR ont supprimé nos feuilles de présence papier. Les heures sont fiables et la paie se prépare deux fois plus vite.',
    nom: 'Hery R.',
    role: 'Directeur, entreprise BTP — Antananarivo',
  },
  {
    citation: 'Mes clients consultent l’avancement de leur chantier depuis leur portail. Les demandes de renseignement ont chuté, la confiance a grimpé.',
    nom: 'Naivo R.',
    role: 'Gérant, construction — Toamasina',
  },
  {
    citation: 'Stocks et matériels enfin sous contrôle. Les alertes nous évitent les arrêts de chantier pour pièce manquante.',
    nom: 'Miora A.',
    role: 'Responsable matériel, BTP — Fianarantsoa',
  },
]

const FAQ = [
  {
    q: 'Comment fonctionne l’essai gratuit de 30 jours ?',
    r: 'À la création de votre entreprise, vous disposez de 30 jours d’accès complet : toutes les fonctionnalités, jusqu’à 10 employés et des clients illimités. Aucune carte bancaire n’est demandée.',
  },
  {
    q: 'Quels moyens de paiement acceptez-vous ?',
    r: 'MVola, Orange Money, Airtel Money et carte Visa (via la passerelle Papi). Paiement mensuel ou annuel — 2 mois offerts avec l’annuel.',
  },
  {
    q: 'Mes clients doivent-ils payer pour suivre leurs projets ?',
    r: 'Non. Le portail client est toujours illimité et gratuit : vos clients reçoivent leurs identifiants et suivent devis, avancement et factures sans frais.',
  },
  {
    q: 'Mes données sont-elles en sécurité ?',
    r: 'Connexion sécurisée, mots de passe chiffrés, journal d’audit des accès et isolation stricte : chaque entreprise ne voit que ses données. Les notifications de paiement sont signées cryptographiquement.',
  },
  {
    q: 'L’application fonctionne-t-elle sur mobile ?',
    r: 'Oui. L’espace terrain (pointage QR, photos, tâches, rapports) est conçu pour le smartphone, du bureau comme sur le chantier.',
  },
  {
    q: 'Puis-je résilier à tout moment ?',
    r: 'Oui, sans engagement. À l’expiration de votre formule, vos données restent consultables en lecture seule : rien n’est perdu, vous réactivez quand vous voulez.',
  },
]

function useReveal(dep: unknown) {
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const cibles = root.querySelectorAll('.lp-reveal:not(.lp-visible)')
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('lp-visible')
            io.unobserve(e.target)
          }
        })
      },
      { threshold: 0.12 },
    )
    cibles.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [dep])
  return rootRef
}

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [plans, setPlans] = useState<Plan[]>([])
  const [loadingPlans, setLoadingPlans] = useState(true)
  const rootRef = useReveal(loadingPlans)

  useEffect(() => {
    api.get('/subscriptions/public/plans')
      .then((res) => setPlans((res.data as Plan[]).filter((p) => p.actif)))
      .catch(() => setPlans([]))
      .finally(() => setLoadingPlans(false))
  }, [])

  const planPopulaire = plans.find((p) => p.prix_mensuel > 0)?.code
  const prix = (plan: Plan) =>
    plan.prix_mensuel > 0 ? `${plan.prix_mensuel.toLocaleString()} Ar` : 'Gratuit'

  return (
    <div className="lp-root" ref={rootRef}>
      {/* ============ NAVBAR ============ */}
      <header className="lp-nav">
        <div className="lp-container lp-nav-inner">
          <Link to="/" className="lp-brand" aria-label="TIA INFO BUILD — accueil">
            <span className="lp-brand-badge" aria-hidden="true">TB</span>
            <span className="lp-brand-name">TIA INFO <span>BUILD</span></span>
          </Link>
          <nav className={`lp-links ${menuOpen ? 'lp-open' : ''}`} aria-label="Navigation principale">
            <a href="#fonctionnalites" onClick={() => setMenuOpen(false)}>Fonctionnalités</a>
            <a href="#etapes" onClick={() => setMenuOpen(false)}>Comment ça marche</a>
            <a href="#tarifs" onClick={() => setMenuOpen(false)}>Tarifs</a>
            <a href="#faq" onClick={() => setMenuOpen(false)}>FAQ</a>
            <a href="#contact" onClick={() => setMenuOpen(false)}>Contact</a>
          </nav>
          <div className="lp-nav-cta">
            <Link to="/login" className="lp-btn lp-btn-ghost">Se connecter</Link>
            <Link to="/register-entreprise" className="lp-btn lp-btn-primary">Créer mon entreprise</Link>
          </div>
          <button
            className="lp-burger"
            aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <i className={`bi ${menuOpen ? 'bi-x-lg' : 'bi-list'}`}></i>
          </button>
        </div>
      </header>

      {/* ============ HERO CONVERGENT ============ */}
      <section className="lp-hero">
        <div className="lp-hero-rays" aria-hidden="true"></div>
        <div className="lp-container lp-hero-grid">
          <div className="lp-hero-text">
            <p className="lp-eyebrow">Gestion BTP nouvelle génération</p>
            <h1>
              Tous vos chantiers,
              <br />
              convergent vers <span className="lp-accent">un seul outil.</span>
            </h1>
            <p className="lp-sub">
              Chantiers, pointages QR, RH, matériels, stocks, finances et portail client :
              TIA INFO BUILD réunit toute votre entreprise dans un espace unique — du bureau au terrain.
            </p>
            <div className="lp-hero-cta">
              <Link to="/register-entreprise" className="lp-btn lp-btn-primary lp-btn-lg">
                Créer mon entreprise gratuitement <i className="bi bi-arrow-right" aria-hidden="true"></i>
              </Link>
              <a href="#fonctionnalites" className="lp-btn lp-btn-ghost lp-btn-lg">Découvrir les fonctionnalités</a>
            </div>
            <p className="lp-hero-note">
              <i className="bi bi-check-circle-fill" aria-hidden="true"></i>
              30 jours d’essai complet · Sans carte bancaire · Clients illimités
            </p>
          </div>
          <div className="lp-hero-visual" aria-hidden="true">
            <div className="lp-hero-card lp-hero-card-main">
              <div className="lp-hero-card-head">
                <span className="lp-dot" style={{ background: '#EF4444' }}></span>
                <span className="lp-dot" style={{ background: '#F59E0B' }}></span>
                <span className="lp-dot" style={{ background: '#22C55E' }}></span>
              </div>
              <div className="lp-hero-kpis">
                <div><strong>12</strong><span>chantiers actifs</span></div>
                <div><strong>87 %</strong><span>marge moyenne</span></div>
                <div><strong>240</strong><span>pointages du jour</span></div>
              </div>
              <div className="lp-hero-bars">
                <span style={{ height: '42%' }}></span>
                <span style={{ height: '68%' }}></span>
                <span style={{ height: '55%' }}></span>
                <span style={{ height: '88%' }}></span>
                <span style={{ height: '74%' }}></span>
                <span className="lp-bar-accent" style={{ height: '96%' }}></span>
              </div>
            </div>
            <div className="lp-hero-card lp-hero-card-float lp-hero-card-qr">
              <i className="bi bi-qr-code-scan"></i>
              <div><strong>Badge scanné</strong><span>Rakoto J. — entrée 07:02</span></div>
            </div>
            <div className="lp-hero-card lp-hero-card-float lp-hero-card-alert">
              <i className="bi bi-check-circle-fill"></i>
              <div><strong>Situation validée</strong><span>+42 500 000 Ar</span></div>
            </div>
          </div>
        </div>
        <div className="lp-container">
          <dl className="lp-stats lp-reveal">
            {STATS.map((s) => (
              <div key={s.label} className="lp-stat">
                <dt>{s.label}</dt>
                <dd>{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ============ CONFIANCE ============ */}
      <section className="lp-trust">
        <div className="lp-container">
          <p className="lp-trust-label">Conçu pour les entreprises BTP de Madagascar</p>
          <div className="lp-trust-row lp-reveal" aria-hidden="true">
            <span><i className="bi bi-building"></i> Construction</span>
            <span><i className="bi bi-droplet-half"></i> Travaux publics</span>
            <span><i className="bi bi-house-gear"></i> Bâtiment</span>
            <span><i className="bi bi-lightning-charge"></i> Électricité BTP</span>
            <span><i className="bi bi-tree"></i> Aménagement extérieur</span>
          </div>
        </div>
      </section>

      {/* ============ FONCTIONNALITÉS ============ */}
      <section id="fonctionnalites" className="lp-section">
        <div className="lp-container">
          <div className="lp-section-head lp-reveal">
            <p className="lp-eyebrow">Fonctionnalités</p>
            <h2>Tout votre BTP, <span className="lp-accent">dans une seule plateforme</span></h2>
            <p className="lp-section-sub">
              Six modules interconnectés qui se parlent entre eux : un pointage devient une heure payée,
              une dépense devient une marge analysée.
            </p>
          </div>
          <div className="lp-cards">
            {FEATURES.map((f, i) => (
              <article key={f.titre} className={`lp-card lp-reveal lp-d${(i % 3) + 1}`}>
                <div className="lp-card-icon"><i className={`bi ${f.icon}`}></i></div>
                <h3>{f.titre}</h3>
                <p>{f.texte}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ============ COMMENT ÇA MARCHE ============ */}
      <section id="etapes" className="lp-section lp-section-alt">
        <div className="lp-container">
          <div className="lp-section-head lp-reveal">
            <p className="lp-eyebrow">Comment ça marche</p>
            <h2>Opérationnel en <span className="lp-accent">trois étapes</span></h2>
          </div>
          <ol className="lp-etapes">
            {ETAPES.map((e, i) => (
              <li key={e.num} className={`lp-reveal lp-d${i + 1}`}>
                <span className="lp-etape-num" aria-hidden="true">{e.num}</span>
                <h3>{e.titre}</h3>
                <p>{e.texte}</p>
              </li>
            ))}
          </ol>
          <div className="lp-center lp-reveal">
            <Link to="/register-entreprise" className="lp-btn lp-btn-primary lp-btn-lg">
              Commencer maintenant <i className="bi bi-arrow-right" aria-hidden="true"></i>
            </Link>
          </div>
        </div>
      </section>

      {/* ============ TÉMOIGNAGES ============ */}
      <section className="lp-section">
        <div className="lp-container">
          <div className="lp-section-head lp-reveal">
            <p className="lp-eyebrow">Témoignages</p>
            <h2>Ils pilotent déjà <span className="lp-accent">avec TIA INFO BUILD</span></h2>
          </div>
          <div className="lp-temoignages">
            {TEMOIGNAGES.map((t, i) => (
              <figure key={t.nom} className={`lp-temoin lp-reveal lp-d${i + 1}`}>
                <div className="lp-stars" aria-label="5 étoiles sur 5">
                  {Array.from({ length: 5 }).map((_, k) => (
                    <i key={k} className="bi bi-star-fill" aria-hidden="true"></i>
                  ))}
                </div>
                <blockquote>{t.citation}</blockquote>
                <figcaption>
                  <strong>{t.nom}</strong>
                  <span>{t.role}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ============ TARIFS ============ */}
      <section id="tarifs" className="lp-section lp-section-alt">
        <div className="lp-container">
          <div className="lp-section-head lp-reveal">
            <p className="lp-eyebrow">Tarifs</p>
            <h2>Des formules <span className="lp-accent">pour chaque taille d’entreprise</span></h2>
            <p className="lp-section-sub">
              Essai gratuit de 30 jours à l’inscription · Clients portail toujours illimités · Paiement Mobile Money ou Visa.
            </p>
          </div>
          {loadingPlans ? (
            <p className="lp-center text-muted">Chargement des formules…</p>
          ) : plans.length === 0 ? (
            <div className="lp-reveal lp-tarifs-vide">
              <p>Nos formules arrivent bientôt en ligne. <Link to="/register-entreprise">Créez votre entreprise</Link> : l’essai de 30 jours vous attend.</p>
            </div>
          ) : (
            <div className="lp-tarifs">
              {plans.slice(0, 4).map((p, i) => {
                const populaire = p.code === planPopulaire
                return (
                  <article key={p.code} className={`lp-tarif lp-reveal lp-d${i + 1} ${populaire ? 'lp-tarif-populaire' : ''}`}>
                    {populaire && <span className="lp-badge-pop">Le plus choisi</span>}
                    <h3>{p.nom}</h3>
                    <p className="lp-tarif-prix">
                      {prix(p)}
                      {p.prix_mensuel > 0 && <small>/mois</small>}
                    </p>
                    <p className="lp-tarif-desc">{p.description}</p>
                    <ul>
                      <li><i className="bi bi-check2"></i>{p.utilisateurs_max ?? 'Illimité'} employés</li>
                      <li><i className="bi bi-check2"></i>{p.chantiers_max ?? 'Illimités'} chantiers actifs</li>
                      <li><i className="bi bi-check2"></i>Clients portail illimités</li>
                      <li><i className="bi bi-check2"></i>Support inclus</li>
                    </ul>
                    <Link
                      to="/register-entreprise"
                      className={`lp-btn ${populaire ? 'lp-btn-primary' : 'lp-btn-ghost'} lp-btn-block`}
                    >
                      {p.prix_mensuel > 0 ? 'Commencer l’essai' : 'Activer cette formule'}
                    </Link>
                  </article>
                )
              })}
            </div>
          )}
          <p className="lp-center lp-tarifs-lien lp-reveal">
            Besoin du détail ? <Link to="/pricing">Voir la page tarifs complète →</Link>
          </p>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section id="faq" className="lp-section">
        <div className="lp-container lp-faq-wrap">
          <div className="lp-section-head lp-reveal">
            <p className="lp-eyebrow">FAQ</p>
            <h2>Vos questions, <span className="lp-accent">nos réponses</span></h2>
          </div>
          <div className="lp-faq">
            {FAQ.map((item, i) => (
              <details key={i} className="lp-faq-item lp-reveal" {...(i === 0 ? { open: true } : {})}>
                <summary>
                  {item.q}
                  <i className="bi bi-chevron-down" aria-hidden="true"></i>
                </summary>
                <p>{item.r}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ============ CTA FINAL ============ */}
      <section className="lp-cta-final" id="contact">
        <div className="lp-container lp-cta-inner lp-reveal">
          <div>
            <h2>Prêt à digitaliser vos chantiers ?</h2>
            <p>Créez votre entreprise en 2 minutes et rejoignez les entreprises BTP qui pilotent tout au même endroit.</p>
          </div>
          <div className="lp-cta-actions">
            <Link to="/register-entreprise" className="lp-btn lp-btn-light lp-btn-lg">
              Créer mon entreprise <i className="bi bi-arrow-right" aria-hidden="true"></i>
            </Link>
            <Link to="/client-login" className="lp-cta-lien">Espace client →</Link>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="lp-footer">
        <div className="lp-container lp-footer-grid">
          <div>
            <span className="lp-brand"><span className="lp-brand-badge" aria-hidden="true">TB</span> TIA INFO BUILD</span>
            <p className="lp-footer-desc">
              La plateforme de gestion tout-en-un pour les entreprises BTP de Madagascar :
              chantiers, équipes, matériels, stocks et finances — du bureau au terrain.
            </p>
          </div>
          <nav aria-label="Produit">
            <h3>Produit</h3>
            <a href="#fonctionnalites">Fonctionnalités</a>
            <a href="#tarifs">Tarifs</a>
            <a href="#faq">FAQ</a>
            <Link to="/pricing">Page tarifs</Link>
          </nav>
          <nav aria-label="Accès">
            <h3>Accès</h3>
            <Link to="/login">Connexion entreprise</Link>
            <Link to="/client-login">Portail client</Link>
            <Link to="/register-entreprise">Créer mon entreprise</Link>
          </nav>
          <div>
            <h3>Contact</h3>
            <a href="mailto:contact@tia.mg"><i className="bi bi-envelope"></i> contact@tia.mg</a>
            <a href="tel:+261340000000"><i className="bi bi-telephone"></i> +261 34 00 000 00</a>
            <p className="lp-footer-desc"><i className="bi bi-geo-alt"></i> Antananarivo, Madagascar</p>
          </div>
        </div>
        <div className="lp-container lp-footer-bottom">
          <span>© {new Date().getFullYear()} TIA INFO BUILD — Tous droits réservés.</span>
          <Link to="/login">Espace de gestion →</Link>
        </div>
      </footer>
    </div>
  )
}
