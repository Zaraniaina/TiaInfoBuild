// Utilitaire SEO central — TIA INFO BUILD.
// Zéro dépendance (aucun react-helmet) : manipulation directe du <head>.
// Convention : les pages vitrine publiques autorisent l'indexation via `useSeo({ index: true })`,
// toutes les pages privées restent couvertes par le `noindex` posé dans index.html.

export interface SeoMeta {
  /** Titre complet affiché dans l'onglet (≤ 60 caractères recommandé). */
  title: string
  /** Meta description (150-160 caractères recommandés). */
  description: string
  /** Autorise index,follow — false par défaut (pages privées). */
  index?: boolean
  /** URL canonique absolue. Défaut : SITE_URL + pathname courant. */
  canonical?: string
  /** Visuel Open Graph / Twitter. Défaut : /og-cover.png */
  image?: string
}

export const SITE_NOM = 'TIA INFO BUILD'

export const SITE_URL = (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, '') || 'https://tia.mg'

export const DEFAULT_TITLE = 'TIA INFO BUILD — Logiciel de gestion BTP à Madagascar'
export const DEFAULT_DESCRIPTION =
  'TIA INFO BUILD : la plateforme SaaS qui pilote vos chantiers BTP de bout en bout — devis, pointages QR, stocks, matériels, factures et portail client. Essai gratuit 30 jours.'

function upsertMeta(attr: 'name' | 'property', key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertLink(rel: string, href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

export function applySeo(meta: SeoMeta): void {
  const canonical = meta.canonical ?? `${SITE_URL}${window.location.pathname}`
  const image = meta.image ?? `${SITE_URL}/og-cover.png`

  document.title = meta.title
  upsertMeta('name', 'description', meta.description)
  upsertMeta('name', 'robots', meta.index ? 'index, follow' : 'noindex, nofollow')
  upsertLink('canonical', canonical)

  // Open Graph
  upsertMeta('property', 'og:type', 'website')
  upsertMeta('property', 'og:site_name', SITE_NOM)
  upsertMeta('property', 'og:title', meta.title)
  upsertMeta('property', 'og:description', meta.description)
  upsertMeta('property', 'og:url', canonical)
  upsertMeta('property', 'og:image', image)
  upsertMeta('property', 'og:locale', 'fr_MG')

  // Twitter Card
  upsertMeta('name', 'twitter:card', 'summary_large_image')
  upsertMeta('name', 'twitter:title', meta.title)
  upsertMeta('name', 'twitter:description', meta.description)
  upsertMeta('name', 'twitter:image', image)
}

export function applyNoIndex(): void {
  upsertMeta('name', 'robots', 'noindex, nofollow')
}

/** Injecte un bloc JSON-LD (données structurées) dans le <head>. Remplace le précédent à id égal. */
export function applyJsonLd(id: string, data: unknown): void {
  let el = document.head.querySelector<HTMLScriptElement>(`script[data-jsonld="${id}"]`)
  if (!el) {
    el = document.createElement('script')
    el.type = 'application/ld+json'
    el.setAttribute('data-jsonld', id)
    document.head.appendChild(el)
  }
  el.textContent = JSON.stringify(data)
}

/** Retire un bloc JSON-LD précédemment injecté. */
export function removeJsonLd(id: string): void {
  document.head.querySelector(`script[data-jsonld="${id}"]`)?.remove()
}

/** Métas de la page d'accueil vitrine (route publique `/`). */
export function landingSeo(): SeoMeta {
  return {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    index: true,
    canonical: `${SITE_URL}/`,
  }
}

/** Métas de la page tarifs (route publique `/pricing`). */
export function pricingSeo(): SeoMeta {
  return {
    title: 'Tarifs — TIA INFO BUILD | Formules SaaS BTP en Ariary',
    description:
      'Découvrez les formules TIA INFO BUILD : essai gratuit 30 jours, gestion chantiers, RH, stocks et finances. Tarifs en Ariary, paiement Mobile Money ou Visa.',
    index: true,
    canonical: `${SITE_URL}/pricing`,
  }
}

/** Métas de la page d'inscription entreprise (route publique `/register-entreprise`). */
export function registerSeo(): SeoMeta {
  return {
    title: 'Créer mon entreprise — Essai gratuit 30 jours | TIA INFO BUILD',
    description:
      'Créez votre entreprise sur TIA INFO BUILD en 2 minutes : 30 jours d’essai complet, sans carte bancaire. Chantiers, équipes, stocks et finances réunis.',
    index: true,
    canonical: `${SITE_URL}/register-entreprise`,
  }
}

/** Données structurées Organization — injectées sur les pages vitrine. */
export function buildOrganizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NOM,
    url: `${SITE_URL}/`,
    logo: `${SITE_URL}/favicon.png`,
    description: DEFAULT_DESCRIPTION,
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Antananarivo',
      addressCountry: 'MG',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'contact@tia.mg',
      telephone: '+261 34 00 000 00',
      contactType: 'sales',
      areaServed: 'MG',
      availableLanguage: 'fr',
    },
  }
}

/** Données structurées FAQPage — construites depuis la FAQ affichée sur la landing. */
export function buildFaqJsonLd(faq: Array<{ q: string; r: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.r },
    })),
  }
}

/** Données structurées Product — construites depuis les plans réels chargés de l'API.
 *  `null` si aucun plan : on ne publie JAMAIS de tarifs fictifs. */
export function buildProductJsonLd(plans: Array<{ nom: string; prix_mensuel: number }>) {
  if (plans.length === 0) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'TIA INFO BUILD — Gestion BTP',
    description:
      'Plateforme SaaS de gestion BTP : chantiers, pointages QR, RH, matériels, stocks, finances et portail client.',
    brand: { '@type': 'Brand', name: 'TIA INFO BUILD' },
    offers: plans.map((p) => ({
      '@type': 'Offer',
      name: p.nom,
      url: `${SITE_URL}/pricing`,
      priceCurrency: 'MGA',
      price: p.prix_mensuel,
      availability: 'https://schema.org/InStock',
    })),
  }
}
