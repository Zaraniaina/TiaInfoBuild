import { useJsonLd, useSeo } from '@/hooks/useSeo'
import {
  buildFaqJsonLd,
  buildOrganizationJsonLd,
  buildProductJsonLd,
  landingSeo,
  pricingSeo,
  registerSeo,
} from '@/utils/seo'
import type { Plan } from '@/types'

interface SeoHeadProps {
  /** Route vitrine concernée. */
  route: '/' | '/pricing' | '/register-entreprise'
  /** FAQ affichée sur la landing — injectée en JSON-LD FAQPage. */
  faq?: Array<{ q: string; r: string }>
  /** Plans réels chargés de l'API — injectés en JSON-LD Product/Offers (null si aucun : jamais fictifs). */
  plans?: Plan[]
}

/**
 * Tête SEO des pages vitrine publiques. Ne rend rien :
 * applique les métas + JSON-LD (Organization toujours ; FAQPage sur `/` ;
 * Product/Offers sur `/pricing` quand les plans sont chargés).
 */
export function SeoHead({ route, faq, plans }: SeoHeadProps) {
  const meta = route === '/pricing' ? pricingSeo() : route === '/register-entreprise' ? registerSeo() : landingSeo()
  useSeo(meta)
  useJsonLd('org', buildOrganizationJsonLd())
  useJsonLd('faq', route === '/' && faq?.length ? buildFaqJsonLd(faq) : null)
  // `buildProductJsonLd` renvoie null si aucun plan : jamais de tarifs fictifs.
  useJsonLd('plans', route === '/pricing' ? buildProductJsonLd(plans ?? []) : null)
  return null
}
