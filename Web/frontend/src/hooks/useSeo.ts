import { useEffect } from 'react'
import { applyJsonLd, applySeo, removeJsonLd, type SeoMeta } from '@/utils/seo'

/**
 * Applique les métas SEO (title, description, robots, canonical, OG/Twitter)
 * au montage et à chaque changement de `meta`.
 */
export function useSeo(meta: SeoMeta): void {
  // Dépendance sérialisée : la méta est en général un objet `useMemo` stable,
  // mais on garantit la ré-application même si l'appelant recrée l'objet.
  const cle = JSON.stringify(meta)
  useEffect(() => {
    applySeo(JSON.parse(cle) as SeoMeta)
  }, [cle])
}

/**
 * Injecte un bloc JSON-LD dans le <head> au montage, retiré au démontage.
 * @param id Identifiant unique du bloc (ex. 'org', 'faq').
 * @param data Objet sérialisé en JSON-LD. Si null, rien n'est injecté.
 */
export function useJsonLd(id: string, data: unknown | null): void {
  useEffect(() => {
    if (data == null) return
    applyJsonLd(id, data)
    return () => removeJsonLd(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, JSON.stringify(data)])
}
