import { useEffect, useRef, useState } from 'react'
import {
  Activity,
  CalendarClock,
  ChevronDown,
  CircleMinus,
  CirclePlus,
  TrendingDown,
  TrendingUp,
  Video,
} from 'lucide-react'
import { api, formatDate, formatNumber } from '../lib'
import { DashboardData } from '../types'

export default function SyncOverview() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  const load = () => {
    api<DashboardData>('/api/dashboard')
      .then(setData)
      .catch(() => setData(null))
  }

  useEffect(() => {
    load()
    window.addEventListener('ytm:refresh', load)
    return () => window.removeEventListener('ytm:refresh', load)
  }, [])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const changes = data?.lastChanges
  const hasChanges = Boolean(
    changes && (
      changes.created ||
      changes.removed ||
      changes.becameActive ||
      changes.becameInactive ||
      changes.newVideos
    ),
  )

  const details = [
    {
      title: 'Ajoutées',
      helper: 'Nouveaux abonnements',
      value: changes?.created ?? 0,
      icon: CirclePlus,
      tone: 'text-[#55D89F]',
      iconBg: 'rgba(85,216,159,.10)',
      iconBorder: 'rgba(85,216,159,.28)',
    },
    {
      title: 'Retirées',
      helper: 'Abonnements supprimés',
      value: changes?.removed ?? 0,
      icon: CircleMinus,
      tone: 'text-[#FF788D]',
      iconBg: 'rgba(255,120,141,.10)',
      iconBorder: 'rgba(255,120,141,.28)',
    },
    {
      title: 'Redevenues actives',
      helper: 'Score repassé à 70%+',
      value: changes?.becameActive ?? 0,
      icon: TrendingUp,
      tone: 'text-[#55D89F]',
      iconBg: 'rgba(85,216,159,.10)',
      iconBorder: 'rgba(85,216,159,.28)',
    },
    {
      title: 'Devenues inactives',
      helper: 'Score passé sous 40%',
      value: changes?.becameInactive ?? 0,
      icon: TrendingDown,
      tone: 'text-[#F2B95D]',
      iconBg: 'rgba(242,185,93,.10)',
      iconBorder: 'rgba(242,185,93,.28)',
    },
  ] as const

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="icon-btn group relative h-9 w-11"
        aria-label="Détails de la dernière synchronisation"
        aria-expanded={open}
        title="Détails de la dernière synchronisation"
      >
        <CalendarClock size={16} className="transition-transform duration-200 group-hover:scale-105" />
        <span
          className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full"
          style={{
            background: hasChanges ? 'var(--accent)' : '#596274',
            boxShadow: hasChanges ? '0 0 8px color-mix(in srgb, var(--accent) 78%, transparent)' : 'none',
          }}
        />
      </button>

      {open && (
        <div
          className="glass-menu absolute right-0 top-[46px] z-[100] w-[360px] isolate overflow-hidden"
          style={{ borderRadius: 'var(--radius-panel)' }}
        >
          <div
            className="flex items-start justify-between gap-4 border-b px-4 py-3.5"
            style={{ borderColor: 'var(--glass-border)', background: 'var(--header-bg)' }}
          >
            <div className="flex min-w-0 items-start gap-3">
              <div
                className="grid h-9 w-9 shrink-0 place-items-center border"
                style={{
                  borderRadius: 'var(--radius-control)',
                  borderColor: 'color-mix(in srgb, var(--accent) 28%, var(--glass-border))',
                  background: 'color-mix(in srgb, var(--accent) 10%, var(--soft-bg))',
                  color: 'var(--accent)',
                }}
              >
                <CalendarClock size={17} />
              </div>
              <div className="min-w-0">
                <div className="text-[12px] font-bold text-white">Dernière synchronisation</div>
                <div className="mt-0.5 text-[10px] text-[#8590A3]">{formatDate(data?.lastSync)}</div>
              </div>
            </div>
            <ChevronDown size={15} className="mt-1 rotate-180 text-[#788397]" />
          </div>

          <div className="grid grid-cols-2 gap-2 p-3">
            {details.map(({ title, helper, value, icon: Icon, tone, iconBg, iconBorder }) => (
              <div
                key={title}
                className="border p-3"
                style={{
                  borderRadius: 'var(--radius-control)',
                  borderColor: 'var(--glass-border)',
                  background: 'color-mix(in srgb, var(--glass-bg) 82%, black 8%)',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div
                    className="grid h-7 w-7 place-items-center border"
                    style={{
                      borderRadius: 'calc(var(--radius-control) - 2px)',
                      borderColor: iconBorder,
                      background: iconBg,
                    }}
                  >
                    <Icon size={14} className={tone} />
                  </div>
                  <div className={`text-[16px] font-extrabold ${tone}`}>{formatNumber(Number(value))}</div>
                </div>
                <div className="mt-2 text-[10px] font-bold text-[#D9DFE9]">{title}</div>
                <div className="mt-0.5 text-[8px] leading-3 text-[#737F92]">{helper}</div>
              </div>
            ))}
          </div>

          <div
            className="mx-3 mb-3 flex items-center justify-between gap-3 border px-3 py-2.5"
            style={{
              borderRadius: 'var(--radius-control)',
              borderColor: 'var(--glass-border)',
              background: 'color-mix(in srgb, var(--glass-bg) 82%, black 8%)',
            }}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <div
                className="grid h-7 w-7 shrink-0 place-items-center border"
                style={{
                  borderRadius: 'calc(var(--radius-control) - 2px)',
                  borderColor: 'color-mix(in srgb, var(--accent) 32%, var(--glass-border))',
                  background: 'color-mix(in srgb, var(--accent) 11%, var(--soft-bg))',
                  color: 'var(--accent)',
                }}
              >
                <Video size={14} />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-[#D9DFE9]">Nouvelles vidéos détectées</div>
                <div className="mt-0.5 text-[8px] text-[#737F92]">Publiées depuis la synchronisation précédente</div>
              </div>
            </div>
            <div className="shrink-0 text-[14px] font-extrabold" style={{ color: 'var(--accent)' }}>
              {formatNumber(changes?.newVideos ?? 0)}
            </div>
          </div>

          <div
            className="flex items-center justify-between border-t px-4 py-2.5 text-[9px] text-[#758094]"
            style={{ borderColor: 'var(--glass-border)', background: 'var(--header-bg)' }}
          >
            <span className="flex items-center gap-1.5"><Activity size={12} /> Total après la synchro</span>
            <span className="font-bold text-[#D8DEE8]">{formatNumber(data?.total ?? 0)} chaînes</span>
          </div>
        </div>
      )}
    </div>
  )
}
