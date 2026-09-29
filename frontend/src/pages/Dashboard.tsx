import { Activity, AlertTriangle, CircleOff, ListVideo, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import ChannelAvatar from '../components/ChannelAvatar'
import ScoreBadge from '../components/ScoreBadge'
import StatCard from '../components/StatCard'
import { api, formatNumber } from '../lib'
import { Channel, DashboardData } from '../types'

const tooltipStyle = {
  background: 'rgba(14, 17, 24, .96)',
  border: '1px solid rgba(255,255,255,.09)',
  borderRadius: 12,
  fontSize: 11,
  boxShadow: '0 18px 45px rgba(0,0,0,.36)',
}

const distributionLabels: Record<string, string> = {
  '< 7 jours': '< 7 jours',
  '7 - 30 jours': '7 à 30 jours',
  '1 - 3 mois': '1 à 3 mois',
  '3 - 6 mois': '3 à 6 mois',
  '6 - 12 mois': '6 à 12 mois',
  '> 1 an': 'Plus d’1 an',
  'Aucune vidéo': 'Jamais publié',
}

function displayDistributionLabel(value: string) {
  return distributionLabels[value] || value
}

function reasonFor(channel: Channel) {
  if (!channel.videos) return 'Aucune vidéo détectée — synchronisation recommandée.'
  if (!channel.lastUploadAt) return 'Date de dernière publication inconnue.'
  if (channel.score < 40) return `Activité faible · ${channel.lastVideo}`
  return `Activité à surveiller · ${channel.lastVideo}`
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')

  const load = () => {
    api<DashboardData>('/api/dashboard')
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erreur'))
  }

  useEffect(() => {
    load()
    window.addEventListener('ytm:refresh', load)
    return () => window.removeEventListener('ytm:refresh', load)
  }, [])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  const recent = useMemo(() => {
    if (!data) return { week: 0, month: 0, quarter: 0, year: 0 }
    const values = Object.fromEntries(data.distribution.map((item) => [item.label, item.value]))
    const week = values['< 7 jours'] || 0
    const month = week + (values['7 - 30 jours'] || 0)
    const quarter = month + (values['1 - 3 mois'] || 0)
    const year = quarter + (values['3 - 6 mois'] || 0) + (values['6 - 12 mois'] || 0)
    return { week, month, quarter, year }
  }, [data])

  if (error) return <div className="panel clean-panel p-6 text-sm text-[#FF8BA0]">{error}</div>
  if (!data) return <div className="text-sm text-[#7D8799]">Chargement du dashboard...</div>

  const activePct = data.total ? Math.round((data.active / data.total) * 100) : 0
  const recentItems = [
    ['Derniers 7 jours', recent.week],
    ['Derniers 30 jours', recent.month],
    ['Derniers 3 mois', recent.quarter],
    ['Derniers 12 mois', recent.year],
  ] as const

  return (
    <div className="mx-auto flex h-[calc(100dvh-118px)] w-full max-w-[1380px] flex-col overflow-hidden">
      <div className="mb-3 shrink-0 px-0.5">
        <h1 className="text-[25px] font-extrabold tracking-[-.04em] text-[#F7F8FB]">Ton écosystème YouTube</h1>
        <p className="mt-0.5 text-[11px] text-[#7E899B]">L'état de tes {formatNumber(data.total)} abonnements en un coup d'œil.</p>
      </div>

      <div className="grid shrink-0 grid-cols-[1.08fr_1fr_1fr_1fr_1.12fr] gap-2.5">
        <StatCard label="Chaînes suivies" value={formatNumber(data.total)} helper={`${data.favorites} favorites`} icon={ListVideo} />
        <StatCard label="Actives" value={formatNumber(data.active)} helper={`${activePct}% du total`} icon={Activity} accent="text-[#61D7A5]" />
        <StatCard label="À surveiller" value={formatNumber(data.watch)} helper="score de 40 à 69" icon={AlertTriangle} accent="text-[#F3BE5D]" />
        <StatCard label="Inactives" value={formatNumber(data.inactive)} helper="score inférieur à 40" icon={CircleOff} accent="text-[#FF7D91]" />
        <StatCard label="Audience cumulée" value={formatNumber(data.totalSubscribers)} helper="abonnés des chaînes" icon={Users} accent="text-[#FF7583]" />
      </div>

      <div className="mt-2.5 grid min-h-0 flex-1 grid-cols-[1.42fr_.88fr] gap-2.5">
        <section className="panel clean-panel relative flex min-h-0 flex-col overflow-hidden p-4">
          <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-[color:var(--accent)] opacity-[.05] blur-[70px]" />
          <div className="relative flex shrink-0 items-start justify-between gap-4">
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[.12em] text-[#737E91]">Activité des chaînes</div>
              <div className="mt-1.5 flex items-end gap-2">
                <div className="text-[28px] font-extrabold leading-none tracking-[-.04em] text-white">{formatNumber(recent.month)}</div>
                <div className="mb-0.5 text-[10px] font-semibold text-[#7E899B]">chaînes ont publié ces 30 derniers jours</div>
              </div>
              <p className="mt-1 text-[10px] text-[#747F91]">Nombre de chaînes classées selon leur dernière vidéo publiée.</p>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-white/[.06] bg-white/[.025] px-2.5 py-1.5 text-[9px] text-[#8993A5]">
              <span className="h-2 w-2 rounded-full" style={{ background: 'var(--accent)' }} />
              Total analysé : {data.total}
            </div>
          </div>

          <div className="relative mt-3 min-h-0 flex-1 rounded-[14px] border border-white/[.055] bg-black/[.08] px-2 pb-1 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.distribution} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.34} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#758094', fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  tickFormatter={(value) => displayDistributionLabel(String(value))}
                />
                <YAxis tick={{ fill: '#657084', fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelFormatter={(label) => displayDistributionLabel(String(label))}
                  formatter={(value) => [`${formatNumber(Number(value))} chaînes`, '']}
                />
                <Area type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2.25} fill="url(#activityFill)" activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="relative mt-2 grid shrink-0 grid-cols-4 gap-1.5">
            {recentItems.map(([label, value]) => (
              <div
                key={label}
                className="rounded-lg border px-3 py-2.5"
                style={{ borderColor: 'var(--glass-border)', background: 'var(--soft-bg)' }}
              >
                <div className="text-[9px] font-semibold text-[#727D90]">{label}</div>
                <div className="mt-1 text-base font-extrabold leading-none tracking-tight text-[#F3F5F8]">{formatNumber(Number(value))} chaînes</div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel clean-panel relative flex min-h-0 flex-col overflow-hidden">
          <div className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full bg-[#FF4655]/[.045] blur-[60px]" />
          <div className="relative shrink-0 border-b border-white/[.055] px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[13px] font-bold text-[#F0F3F7]">À examiner</h2>
                <p className="mt-0.5 text-[10px] text-[#747F91]">Les chaînes qui méritent une décision en priorité.</p>
              </div>
              <span className="rounded-md border border-[#FF7080]/15 bg-[#FF5365]/[.07] px-2 py-1 text-[9px] font-bold text-[#D98B97]">PRIORITÉ</span>
            </div>
          </div>
          <div className="relative min-h-0 flex-1 divide-y divide-white/[.045] overflow-hidden">
            {data.attention.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#727D90]">Aucune chaîne à signaler.</div>
            ) : data.attention.map((channel) => (
              <div key={channel.id} className="group flex items-center gap-3 px-4 py-2.5 transition hover:bg-white/[.025]">
                <ChannelAvatar src={channel.thumbnailUrl} name={channel.name} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] font-semibold text-[#E8ECF2]">{channel.name}</div>
                  <div className="mt-0.5 truncate text-[9px] text-[#6F798C]">{reasonFor(channel)}</div>
                </div>
                <ScoreBadge score={channel.score} compact />
              </div>
            ))}
          </div>
          <div className="relative shrink-0 border-t border-white/[.055] bg-white/[.018] px-4 py-2.5 text-[9px] text-[#707B8E]">
            {data.inactive} inactives · {data.watch} à surveiller · {recent.month} ont publié ces 30 derniers jours
          </div>
        </section>
      </div>
    </div>
  )
}
