import type { PairStatus } from '@/lib/compare'

interface StatusBadgeProps {
  status: PairStatus
  mode?: 'A' | 'B'
}

const CONFIG: Record<PairStatus, { label: string; labelModeA?: string; className: string }> = {
  pass:       { label: '일치',    className: 'bg-green-50  border-green-200  text-green-700'  },
  needs_edit: { label: '불일치',  className: 'bg-orange-50 border-orange-200 text-orange-700' },
  figma_only: { label: 'Figma1만', className: 'bg-red-50    border-red-200    text-red-700'    },
  web_only:   { label: 'Web만',   labelModeA: 'Figma2만', className: 'bg-blue-50   border-blue-200   text-blue-700'   },
}

const StatusBadge = ({ status, mode }: StatusBadgeProps) => {
  const config = CONFIG[status]
  const label = mode === 'A' && config.labelModeA ? config.labelModeA : config.label
  const { className } = config
  return (
    <span
      className={[
        'inline-flex items-center justify-center',
        'font-mono text-xs font-semibold tracking-wide',
        'px-2.5 py-1 rounded border',
        className,
      ].join(' ')}
    >
      {label}
    </span>
  )
}


export default StatusBadge
