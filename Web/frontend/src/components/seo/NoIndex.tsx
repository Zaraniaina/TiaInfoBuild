import { useEffect } from 'react'
import { applyNoIndex } from '@/utils/seo'

/**
 * Exclut la page courante de l'indexation (pages privées de l'app).
 * À monter une fois dans le layout privé — jamais sur la vitrine publique.
 */
export function NoIndex() {
  useEffect(() => {
    applyNoIndex()
  }, [])
  return null
}
