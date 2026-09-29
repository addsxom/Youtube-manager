import { LucideIcon } from 'lucide-react'
import { ReactNode } from 'react'

export default function StatCard({
  label,
  value,
  helper,
  icon: Icon,
  accent = 'text-[#8EA0FF]',
}: {
  label: string
  value: ReactNode
  helper: string
  icon: LucideIcon
  accent?: string
}) {
  return (
    <div className="panel clean-panel group relative overflow-hidden p-4 transition duration-200 hover:-translate-y-0.5 hover:border-white/[.11]">
      <div className="pointer-events-none absolute -right-7 -top-8 h-24 w-24 rounded-full bg-[#716AFF]/[.07] blur-2xl transition group-hover:bg-[#716AFF]/[.1]" />
      <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="relative mb-3 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[.08em] text-[var(--text-muted)]">{label}</span>
        <div className="grid h-8 w-8 place-items-center rounded-xl border border-white/[.075] bg-white/[.04] shadow-[inset_0_1px_0_rgba(255,255,255,.035)]">
          <Icon size={14} className={accent} />
        </div>
      </div>
      <div className="relative text-[26px] font-extrabold leading-none tracking-[-.035em] text-[var(--text-primary)]">{value}</div>
      <div className="relative mt-1.5 truncate text-[10px] text-[var(--text-muted)]">{helper}</div>
    </div>
  )
}
