import { useState, useEffect, useRef, useCallback } from 'react'
import { BrandLogo } from '@/components/brand/BrandLogo'

interface StatItem {
  value: string
  label: string
  icon: string
}

interface AuthVisualPanelProps {
  title: string
  subtitle: string
  eyebrow?: string
  stats?: StatItem[]
  highlightedWord?: string
  copyright?: string
}

export function AuthVisualPanel({
  title,
  subtitle,
  eyebrow = 'Pilotage BTP',
  stats = [],
  highlightedWord,
  copyright = '(c) 2026 TIA INFO BUILD - Madagascar',
}: AuthVisualPanelProps) {
  const [mousePos, setMousePos] = useState({ x: -500, y: -500 })
  const panelRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!panelRef.current) return
    const rect = panelRef.current.getBoundingClientRect()
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [handleMouseMove])

  const lines = title.split('\n')
  const titleWords: React.ReactNode[] = []
  let globalDelay = 0

  lines.forEach((line, lineIdx) => {
    const words = line.split(' ')
    words.forEach((word, wordIdx) => {
      const isHighlighted = highlightedWord && word === highlightedWord
      titleWords.push(
        <span
          key={`w-${lineIdx}-${wordIdx}`}
          className={`auth-visual-title-word${isHighlighted ? ' gradient-text' : ''}`}
          style={{ animationDelay: `${globalDelay}s` }}
        >
          {word}
        </span>
      )
      if (wordIdx < words.length - 1) {
        titleWords.push(
          <span key={`s-${lineIdx}-${wordIdx}`} className="auth-visual-title-space">
            &nbsp;
          </span>
        )
      }
      globalDelay += 0.07
    })
    if (lineIdx < lines.length - 1) {
      titleWords.push(<br key={`b-${lineIdx}`} />)
      globalDelay += 0.12
    }
  })

  return (
    <div ref={panelRef} className="auth-visual">
      <div className="auth-visual-blob auth-visual-blob-1" />
      <div className="auth-visual-blob auth-visual-blob-2" />

      <div className="auth-visual-grid" />
      <div className="auth-visual-vignette" />

      <div
        className="auth-visual-cursor"
        style={{ left: mousePos.x, top: mousePos.y }}
      />

      <div className="auth-visual-content">
        <div className="auth-visual-logo on-brand-surface">
          <BrandLogo size={44} withName />
        </div>

        <div>
          <div className="eyebrow mb-3">{eyebrow}</div>
          <h2 className="auth-visual-title">{titleWords}</h2>
          <p className="auth-visual-text" style={{ animationDelay: '0.3s' }}>
            {subtitle}
          </p>
        </div>

        {stats.length > 0 && (
          <div className="auth-visual-stats">
            {stats.map((stat, i) => (
              <div
                key={i}
                className="auth-visual-stat-card"
                style={{ animationDelay: `${0.5 + i * 0.1}s` }}
              >
                <div className="auth-visual-stat-icon">
                  <i className={`bi ${stat.icon}`} />
                </div>
                <div className="auth-visual-stat-value">{stat.value}</div>
                <div className="auth-visual-stat-label">{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        <div className="small auth-visual-footer">{copyright}</div>
      </div>
    </div>
  )
}
