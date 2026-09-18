import logoLight from '@/assets/logo-light.png'
import logoDark from '@/assets/logo-dark.png'

/**
 * Logo officiel TIA INFO BUILD, adaptatif au thème.
 *
 * Les deux variantes (fond transparent) sont rendues superposées ; le CSS
 * affiche celle qui correspond au thème courant (`data-theme="dark"` sur
 * <html>, posé par Layout). Avantage : le basculement est instantané au
 * changement de thème, sans re-render React ni observer le store.
 *
 * - `size`    : hauteur du logo en px (défaut 40)
 * - `withName`: affiche le nom « TIA INFO BUILD » à côté du symbole
 * - `variant` : `auto` (thème) | `light` | `dark` pour forcer une variante
 */
export function BrandLogo({
  size = 40,
  withName = false,
  variant = 'auto',
  className = '',
}: {
  size?: number
  withName?: boolean
  variant?: 'auto' | 'light' | 'dark'
  className?: string
}) {
  const style: React.CSSProperties = { height: size, width: 'auto' }
  const swapClass =
    variant === 'light'
      ? 'brand-logo--only-light'
      : variant === 'dark'
        ? 'brand-logo--only-dark'
        : ''

  return (
    <span className={`brand-logo ${swapClass} ${className}`.trim()} style={{ height: size }}>
      <img src={logoLight} alt="TIA INFO BUILD" className="brand-logo-img brand-logo-light" style={style} />
      <img src={logoDark} alt="" aria-hidden="true" className="brand-logo-img brand-logo-dark" style={style} />
      {withName && (
        <span className="brand-logo-name" style={{ fontSize: Math.max(13, size * 0.36) }}>
          TIA INFO BUILD
        </span>
      )}
    </span>
  )
}

export default BrandLogo
