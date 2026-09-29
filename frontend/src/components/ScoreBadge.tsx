import { scoreTone } from '../lib'

export default function ScoreBadge({ score, compact = false }: { score: number; compact?: boolean }) {
  const tone = scoreTone(score)
  const color = {
    good: 'var(--status-good)',
    mid: 'var(--status-mid)',
    bad: 'var(--status-bad)',
  }[tone]
  const label = tone === 'good' ? 'Actif' : tone === 'mid' ? 'À surveiller' : 'Inactif'
  const badgeStyle = {
    color,
    borderColor: `color-mix(in srgb, ${color} 34%, transparent)`,
    background: `color-mix(in srgb, ${color} 12%, transparent)`,
  }

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-bold" style={badgeStyle}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        {label}
        <span className="opacity-70">{score}%</span>
      </span>
    )
  }

  return (
    <div className="inline-flex items-center gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-bold" style={badgeStyle}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        {label}
      </span>
      <span className="text-[11px] font-semibold tabular-nums text-[var(--text-muted)]">{score}%</span>
    </div>
  )
}
