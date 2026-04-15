'use client'

import { useState } from 'react'
import type { ComparePair, PairStatus } from '@/lib/compare'

interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

interface NodeCoords {
  x: number
  y: number
  width: number
  height: number
}

interface ScreenshotOverlayProps {
  screenshot: string
  alt: string
  bounds: Bounds
  /** pairs whose node coords belong to this side */
  pairs: ComparePair[]
  /** 'source' = use pair.figmaNode, 'target' = use pair.webNode */
  side: 'source' | 'target'
}

const STATUS_COLORS: Record<PairStatus, { border: string; bg: string; text: string }> = {
  pass:       { border: '#22c55e', bg: 'rgba(34,197,94,0.15)',   text: '#15803d' },
  needs_edit: { border: '#f97316', bg: 'rgba(249,115,22,0.15)',  text: '#c2410c' },
  figma_only: { border: '#ef4444', bg: 'rgba(239,68,68,0.15)',   text: '#b91c1c' },
  web_only:   { border: '#3b82f6', bg: 'rgba(59,130,246,0.15)',  text: '#1d4ed8' },
}

const STATUS_LABEL: Record<PairStatus, string> = {
  pass:       '일치',
  needs_edit: '불일치',
  figma_only: 'Figma만',
  web_only:   'Web만',
}

function toPercent(value: number, total: number): string {
  return `${((value / total) * 100).toFixed(4)}%`
}

const ScreenshotOverlay = ({ screenshot, alt, bounds, pairs, side }: ScreenshotOverlayProps) => {
  const [tooltip, setTooltip] = useState<{ pairIndex: number } | null>(null)

  return (
    <div className="relative w-full" style={{ userSelect: 'none' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={screenshot}
        alt={alt}
        className="w-full h-auto block"
        draggable={false}
      />

      {pairs.map((pair, i) => {
        const node: NodeCoords | undefined = side === 'source' ? pair.figmaNode : pair.webNode
        if (!node) return null

        const left   = toPercent(node.x - bounds.x, bounds.width)
        const top    = toPercent(node.y - bounds.y, bounds.height)
        const width  = toPercent(node.width,         bounds.width)
        const height = toPercent(node.height,        bounds.height)

        const colors = STATUS_COLORS[pair.status]
        const isHovered = tooltip?.pairIndex === i
        const labelText = side === 'source' ? pair.figmaText : pair.webText

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left,
              top,
              width,
              height,
              border: `1.5px solid ${colors.border}`,
              backgroundColor: isHovered ? colors.bg : 'transparent',
              boxSizing: 'border-box',
              cursor: 'default',
              transition: 'background-color 80ms',
            }}
            onMouseEnter={() => setTooltip({ pairIndex: i })}
            onMouseLeave={() => setTooltip(null)}
          >
            {/* Tooltip */}
            {isHovered && labelText && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 'calc(100% + 4px)',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  whiteSpace: 'pre-wrap',
                  maxWidth: '220px',
                  backgroundColor: 'rgba(17,24,39,0.92)',
                  color: '#f9fafb',
                  fontSize: '11px',
                  lineHeight: '1.4',
                  padding: '5px 8px',
                  borderRadius: '5px',
                  pointerEvents: 'none',
                  zIndex: 50,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    marginBottom: '3px',
                    fontSize: '10px',
                    fontWeight: 600,
                    color: colors.border,
                    letterSpacing: '0.03em',
                  }}
                >
                  {STATUS_LABEL[pair.status]}
                </span>
                <br />
                {labelText}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default ScreenshotOverlay
