import { Activity, ChevronLeft, ChevronRight, Clock3, ListVideo, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { CartesianGrid, Cell, Pie, PieChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts'
import ChannelDrawer from '../components/ChannelDrawer'
import { api, formatNumber } from '../lib'
import { Channel, DashboardData } from '../types'

function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string
  value: string
  helper: string
  icon: typeof Activity
}) {
  return (
    <div className="panel clean-panel relative overflow-hidden px-4 py-3.5">
      <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-[color:var(--accent)] opacity-[.06] blur-2xl" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[9px] font-bold uppercase tracking-[.11em] text-[#7A8597]">{label}</div>
          <div className="mt-2 text-[25px] font-extrabold leading-none tracking-[-.04em] text-white">{value}</div>
          <div className="mt-1.5 truncate text-[9px] text-[#697386]">{helper}</div>
        </div>
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/[.07] bg-white/[.035]">
          <Icon size={14} style={{ color: 'var(--accent)' }} />
        </div>
      </div>
    </div>
  )
}

function recentUploads(channel: Channel, days = 30) {
  const cutoff = Date.now() - days * 86_400_000
  return (channel.recentVideos || []).filter((video) => {
    const timestamp = new Date(video.publishedAt).getTime()
    return Number.isFinite(timestamp) && timestamp >= cutoff
  }).length
}

function activityState(score: number) {
  if (score >= 70) return { label: 'Active', color: '#42DEA0' }
  if (score >= 40) return { label: 'À surveiller', color: '#F3BE5D' }
  return { label: 'Inactive', color: '#FF667D' }
}

type MatrixHover = {
  id: string
  clientX: number
  clientY: number
}

export default function Analytics() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [channels, setChannels] = useState<Channel[]>([])
  const [matrixHover, setMatrixHover] = useState<MatrixHover | null>(null)
  const [matrixDetailIds, setMatrixDetailIds] = useState<string[]>([])
  const [matrixDetailIndex, setMatrixDetailIndex] = useState(0)

  useEffect(() => {
    Promise.all([
      api<DashboardData>('/api/dashboard'),
      api<{ items: Channel[] }>('/api/channels?status=all'),
    ]).then(([dash, channelData]) => {
      setDashboard(dash)
      setChannels(channelData.items)
    })
  }, [])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  const instant = useMemo(() => {
    const total = channels.length || 1
    const averageScore = Math.round(channels.reduce((sum, channel) => sum + channel.score, 0) / total)
    const noVideo = channels.filter((channel) => !channel.lastUploadAt).length
    const active = channels.filter((channel) => channel.score >= 70).length
    const activePct = channels.length ? Math.round((active / channels.length) * 100) : 0
    return { averageScore, noVideo, active, activePct }
  }, [channels])

  const allStats = useMemo(() => {
    const averageScore = channels.length
      ? Math.round(channels.reduce((sum, channel) => sum + channel.score, 0) / channels.length)
      : 0
    const active = channels.filter((channel) => channel.score >= 70).length
    const watch = channels.filter((channel) => channel.score >= 40 && channel.score < 70).length
    const inactive = channels.filter((channel) => channel.score < 40).length
    const veryActive = channels.filter((channel) => channel.score >= 85).length
    return { averageScore, active, watch, inactive, veryActive }
  }, [channels])

  const matrixData = useMemo(() => (
    channels.map((channel) => {
      const state = activityState(channel.score)
      return {
        id: channel.id,
        name: channel.name,
        subscribers: Math.max(1, channel.subscribers),
        score: channel.score,
        uploads30: recentUploads(channel, 30),
        lastVideo: channel.lastVideo,
        state: state.label,
        color: state.color,
      }
    })
  ), [channels])

  const matrixAxis = useMemo(() => {
    const values = matrixData.map((item) => item.subscribers).filter((value) => value > 0)
    if (!values.length) return { min: 1, max: 10, ticks: [1, 10] }

    const lowest = Math.min(...values)
    const highest = Math.max(...values)
    const min = Math.max(1, 10 ** Math.floor(Math.log10(lowest)))
    const max = Math.max(min * 10, 10 ** Math.ceil(Math.log10(highest)))
    const ticks: number[] = []
    for (let tick = min; tick <= max; tick *= 10) ticks.push(tick)
    return { min, max, ticks }
  }, [matrixData])

  const matrixGroupFor = (id: string) => {
    const source = matrixData.find((item) => item.id === id)
    if (!source) return []

    const sourceLog = Math.log10(Math.max(1, source.subscribers))
    return matrixData
      .filter((item) => {
        const logDistance = Math.abs(Math.log10(Math.max(1, item.subscribers)) - sourceLog)
        const scoreDistance = Math.abs(item.score - source.score)
        return logDistance <= 0.055 && scoreDistance <= 1.5
      })
      .sort((a, b) => b.subscribers - a.subscribers)
  }

  const hoveredMatrixItems = useMemo(() => {
    if (!matrixHover) return []
    const hovered = matrixData.find((item) => item.id === matrixHover.id)
    if (!hovered) return []

    const hoveredLog = Math.log10(Math.max(1, hovered.subscribers))
    return matrixData
      .filter((item) => {
        const logDistance = Math.abs(Math.log10(Math.max(1, item.subscribers)) - hoveredLog)
        const scoreDistance = Math.abs(item.score - hovered.score)
        return logDistance <= 0.055 && scoreDistance <= 1.5
      })
      .sort((a, b) => b.subscribers - a.subscribers)
  }, [matrixData, matrixHover])

  const matrixTooltipPosition = useMemo(() => {
    if (!matrixHover || typeof window === 'undefined') return null
    const width = hoveredMatrixItems.length > 1 ? 260 : 220
    const visibleRows = Math.min(hoveredMatrixItems.length, 7)
    const estimatedHeight = hoveredMatrixItems.length > 1
      ? 56 + visibleRows * 54 + (hoveredMatrixItems.length > 7 ? 24 : 0)
      : 178
    const margin = 12
    let left = matrixHover.clientX + 16
    let top = matrixHover.clientY - 26

    if (left + width > window.innerWidth - margin) {
      left = matrixHover.clientX - width - 16
    }
    left = Math.max(margin, Math.min(left, window.innerWidth - width - margin))
    top = Math.max(margin, Math.min(top, window.innerHeight - estimatedHeight - margin))

    return { left, top, width }
  }, [matrixHover, hoveredMatrixItems.length])

  const openMatrixDetails = (id: string) => {
    const group = matrixGroupFor(id)
    if (!group.length) return
    const selectedIndex = Math.max(0, group.findIndex((item) => item.id === id))
    setMatrixDetailIds(group.map((item) => item.id))
    setMatrixDetailIndex(selectedIndex)
    setMatrixHover(null)
  }

  const closeMatrixDetails = () => {
    setMatrixDetailIds([])
    setMatrixDetailIndex(0)
  }

  const stepMatrixDetails = (direction: -1 | 1) => {
    if (matrixDetailIds.length < 2) return
    setMatrixDetailIndex((current) => (
      (current + direction + matrixDetailIds.length) % matrixDetailIds.length
    ))
  }

  const selectedMatrixChannelId = matrixDetailIds[matrixDetailIndex] || null

  const healthData = [
    { name: 'Actives', value: allStats.active, color: '#42DEA0' },
    { name: 'À surveiller', value: allStats.watch, color: '#F3BE5D' },
    { name: 'Inactives', value: allStats.inactive, color: '#FF667D' },
  ]

  return (
    <>
      <div className="mx-auto flex h-[calc(100dvh-118px)] w-full max-w-[1380px] flex-col overflow-hidden">
        <div className="mb-3 flex shrink-0 items-end justify-between gap-5">
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[.16em] text-[#687386]">Analyse</p>
            <h1 className="page-title">Analyse</h1>
            <p className="mt-0.5 text-xs text-[#7F899B]">Toutes tes chaînes affichées en une seule vue, sans filtre de période.</p>
          </div>

          <div className="glass-soft rounded-xl px-3.5 py-2 text-[10px] font-semibold text-[#A5AFC0]">
            Toutes les chaînes · {formatNumber(channels.length)}
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-4 gap-2.5">
          <MetricCard label="Score moyen" value={`${instant.averageScore}%`} helper="activité moyenne actuelle" icon={Activity} />
          <MetricCard label="Chaînes actives" value={formatNumber(instant.active)} helper={`${instant.activePct}% du total`} icon={ListVideo} />
          <MetricCard label="Sans date vidéo" value={formatNumber(instant.noVideo)} helper="à enrichir par synchronisation" icon={Clock3} />
          <MetricCard label="Audience cumulée" value={formatNumber(dashboard?.totalSubscribers || 0)} helper="abonnés des chaînes suivies" icon={Users} />
        </div>

        <div className="mt-2.5 grid min-h-0 flex-1 grid-cols-2 gap-2.5">
          <section className="panel clean-panel flex min-h-0 flex-col overflow-hidden p-4">
            <div className="flex shrink-0 items-start justify-between gap-4">
              <div>
                <div className="text-[9px] font-bold uppercase tracking-[.12em] text-[#737E91]">Matrice audience × activité</div>
                <div className="mt-1.5 flex items-end gap-2">
                  <div className="text-[28px] font-extrabold leading-none tracking-[-.04em] text-white">{channels.length}</div>
                  <div className="mb-0.5 text-[10px] font-semibold text-[#7E899B]">chaînes analysées</div>
                </div>
                <p className="mt-1 text-[10px] text-[#6F798C]">Chaque point représente une chaîne : audience horizontale, activité verticale. Clic gauche pour ouvrir ses détails.</p>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-white/[.06] bg-white/[.025] px-2.5 py-1.5 text-[9px] text-[#8993A5]">
                <span className="h-2 w-2 rounded-full" style={{ background: 'var(--accent)' }} />
                Taille = vidéos / 30 j
              </div>
            </div>

            <div className="relative mt-3 min-h-0 flex-1 rounded-[14px] border border-white/[.055] bg-black/[.08] p-3">
              {matrixData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 12, right: 16, left: 4, bottom: 8 }}>
                    <CartesianGrid stroke="rgba(255,255,255,.045)" strokeDasharray="4 5" />
                    <ReferenceArea y1={70} y2={100} fill="#42DEA0" fillOpacity={0.025} />
                    <ReferenceArea y1={40} y2={70} fill="#F3BE5D" fillOpacity={0.022} />
                    <ReferenceArea y1={0} y2={40} fill="#FF667D" fillOpacity={0.02} />
                    <ReferenceLine y={70} stroke="#42DEA0" strokeOpacity={0.5} strokeDasharray="5 5" />
                    <ReferenceLine y={40} stroke="#F3BE5D" strokeOpacity={0.5} strokeDasharray="5 5" />
                    <XAxis
                      type="number"
                      dataKey="subscribers"
                      scale="log"
                      domain={[matrixAxis.min, matrixAxis.max]}
                      ticks={matrixAxis.ticks}
                      tickFormatter={(value) => formatNumber(Number(value))}
                      tick={{ fill: '#748094', fontSize: 9 }}
                      axisLine={false}
                      tickLine={false}
                      allowDataOverflow
                      label={{ value: 'AUDIENCE →', position: 'insideBottomRight', offset: -4, fill: '#657084', fontSize: 8, fontWeight: 700 }}
                    />
                    <YAxis
                      type="number"
                      dataKey="score"
                      domain={[0, 100]}
                      ticks={[0, 20, 40, 60, 80, 100]}
                      tickFormatter={(value) => `${value}%`}
                      tick={{ fill: '#748094', fontSize: 9 }}
                      axisLine={false}
                      tickLine={false}
                      width={36}
                      label={{ value: 'ACTIVITÉ ↑', angle: -90, position: 'insideLeft', fill: '#657084', fontSize: 8, fontWeight: 700 }}
                    />
                    <Scatter
                      data={matrixData}
                      isAnimationActive={false}
                      shape={(props: any) => {
                        const item = props.payload
                        const radius = Math.max(4, Math.min(8, 4 + Math.sqrt(Math.max(0, item.uploads30)) * 1.15))
                        const active = matrixHover?.id === item.id
                        return (
                          <circle
                            cx={props.cx}
                            cy={props.cy}
                            r={active ? radius + 1.5 : radius}
                            fill={item.color}
                            fillOpacity={active ? 1 : 0.9}
                            stroke={active ? '#FFFFFF' : 'rgba(255,255,255,.28)'}
                            strokeWidth={active ? 1.6 : 0.8}
                            style={{ cursor: 'pointer' }}
                            onMouseEnter={(event) => setMatrixHover({ id: item.id, clientX: event.clientX, clientY: event.clientY })}
                            onMouseMove={(event) => setMatrixHover({ id: item.id, clientX: event.clientX, clientY: event.clientY })}
                            onMouseLeave={() => setMatrixHover(null)}
                            onClick={(event) => {
                              event.stopPropagation()
                              openMatrixDetails(item.id)
                            }}
                          />
                        )
                      }}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              ) : (
                <div className="grid h-full place-items-center text-center text-xs text-[#747F91]">
                  Aucune chaîne à analyser.
                </div>
              )}
            </div>

            <div className="mt-2 grid shrink-0 grid-cols-3 gap-2">
              <div className="glass-soft rounded-lg px-3 py-2.5">
                <div className="text-[8px] uppercase tracking-wider text-[#697386]">Chaînes analysées</div>
                <div className="mt-1 text-sm font-extrabold text-white">{channels.length}</div>
              </div>
              <div className="glass-soft rounded-lg px-3 py-2.5">
                <div className="text-[8px] uppercase tracking-wider text-[#697386]">Score moyen</div>
                <div className="mt-1 text-sm font-extrabold text-white">{allStats.averageScore}%</div>
              </div>
              <div className="glass-soft rounded-lg px-3 py-2.5">
                <div className="text-[8px] uppercase tracking-wider text-[#697386]">Très actives · 85%+</div>
                <div className="mt-1 text-sm font-extrabold text-white">{allStats.veryActive}</div>
              </div>
            </div>
          </section>

          <section className="panel clean-panel flex min-h-0 flex-col overflow-hidden p-4">
            <div className="flex shrink-0 items-start justify-between gap-4">
              <div>
                <div className="text-[9px] font-bold uppercase tracking-[.12em] text-[#737E91]">Santé de toutes les chaînes</div>
                <div className="mt-1.5 flex items-end gap-2">
                  <div className="text-[28px] font-extrabold leading-none tracking-[-.04em] text-white">{channels.length}</div>
                  <div className="mb-0.5 text-[10px] font-semibold text-[#7E899B]">chaînes analysées</div>
                </div>
                <p className="mt-1 text-[10px] text-[#6F798C]">Répartition de toutes les chaînes selon leur score d'activité actuel.</p>
              </div>
              <div className="rounded-lg border border-white/[.06] bg-white/[.025] px-2.5 py-1.5 text-[9px] text-[#8993A5]">
                Score moyen · {allStats.averageScore}%
              </div>
            </div>

            <div className="mt-3 grid min-h-0 flex-1 grid-cols-[1.08fr_.92fr] gap-3 rounded-[14px] border border-white/[.055] bg-black/[.08] p-3">
              <div className="relative min-h-0">
                {channels.length ? (
                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Tooltip
                          cursor={false}
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null
                            const item = payload[0]
                            const name = String(item.name || '')
                            const value = Number(item.value || 0)
                            const color = String(item.payload?.color || '#FFFFFF')
                            return (
                              <div className="min-w-[130px] rounded-xl border border-white/[.12] bg-[#1B202B]/95 px-3 py-2.5 text-white shadow-[0_16px_36px_rgba(0,0,0,.30)] backdrop-blur-xl">
                                <div className="flex items-center gap-2 text-[10px] font-semibold text-[#F2F4F8]">
                                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                                  {name}
                                </div>
                                <div className="mt-1.5 text-[15px] font-extrabold text-white">{formatNumber(value)} chaîne{value > 1 ? 's' : ''}</div>
                              </div>
                            )
                          }}
                        />
                        <Pie
                          data={healthData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius="58%"
                          outerRadius="82%"
                          paddingAngle={3}
                          stroke="rgba(255,255,255,.04)"
                          strokeWidth={1}
                        >
                          {healthData.map((item) => <Cell key={item.name} fill={item.color} />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                      <div>
                        <div className="text-[28px] font-extrabold leading-none text-white">{channels.length}</div>
                        <div className="mt-1 text-[9px] text-[#727D90]">chaînes</div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="grid h-full place-items-center text-center text-xs text-[#747F91]">Aucune donnée disponible.</div>
                )}
              </div>

              <div className="flex min-h-0 flex-col justify-center gap-2.5">
                {healthData.map((item) => {
                  const percent = channels.length ? Math.round((item.value / channels.length) * 100) : 0
                  return (
                    <div key={item.name} className="glass-soft rounded-xl px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color }} />
                          <span className="truncate text-[10px] font-semibold text-[#AAB3C2]">{item.name}</span>
                        </div>
                        <span className="text-sm font-extrabold text-white">{item.value}</span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[.05]">
                        <div className="h-full rounded-full" style={{ width: `${percent}%`, background: item.color }} />
                      </div>
                      <div className="mt-1.5 text-right text-[9px] text-[#697386]">{percent}%</div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="mt-2 grid shrink-0 grid-cols-3 gap-2">
              <div className="rounded-lg border border-[#42DEA0]/15 bg-[#42DEA0]/[.045] px-3 py-2.5">
                <div className="text-[8px] uppercase tracking-wider text-[#74CFA9]">Actives</div>
                <div className="mt-1 text-sm font-extrabold text-white">{allStats.active}</div>
              </div>
              <div className="rounded-lg border border-[#F3BE5D]/15 bg-[#F3BE5D]/[.045] px-3 py-2.5">
                <div className="text-[8px] uppercase tracking-wider text-[#CBB26F]">À surveiller</div>
                <div className="mt-1 text-sm font-extrabold text-white">{allStats.watch}</div>
              </div>
              <div className="rounded-lg border border-[#FF667D]/15 bg-[#FF667D]/[.045] px-3 py-2.5">
                <div className="text-[8px] uppercase tracking-wider text-[#D68A98]">Inactives</div>
                <div className="mt-1 text-sm font-extrabold text-white">{allStats.inactive}</div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {matrixHover && matrixTooltipPosition && hoveredMatrixItems.length > 0 && typeof document !== 'undefined' && createPortal(
        <div
          className="pointer-events-none fixed z-[9999] rounded-xl border border-white/[.14] bg-[#1B202B]/98 p-3 text-white shadow-[0_20px_55px_rgba(0,0,0,.48)] backdrop-blur-xl"
          style={{ left: matrixTooltipPosition.left, top: matrixTooltipPosition.top, width: matrixTooltipPosition.width }}
        >
          {hoveredMatrixItems.length === 1 ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="max-w-[165px] truncate text-[11px] font-extrabold text-white">{hoveredMatrixItems[0].name}</div>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: hoveredMatrixItems[0].color }} />
              </div>
              <div className="mt-2 grid gap-1 text-[9px] text-[#D7DEE9]">
                <div className="flex justify-between gap-4"><span className="text-[#9AA5B7]">Abonnés</span><strong className="text-white">{formatNumber(hoveredMatrixItems[0].subscribers)}</strong></div>
                <div className="flex justify-between gap-4"><span className="text-[#9AA5B7]">Score activité</span><strong className="text-white">{hoveredMatrixItems[0].score}%</strong></div>
                <div className="flex justify-between gap-4"><span className="text-[#9AA5B7]">Vidéos / 30 j</span><strong className="text-white">{hoveredMatrixItems[0].uploads30}</strong></div>
                <div className="flex justify-between gap-4"><span className="text-[#9AA5B7]">État</span><strong style={{ color: hoveredMatrixItems[0].color }}>{hoveredMatrixItems[0].state}</strong></div>
              </div>
              <div className="mt-2 border-t border-white/[.08] pt-2 text-[9px] text-[#AEB7C6]">Dernière vidéo : <span className="font-semibold text-white">{hoveredMatrixItems[0].lastVideo}</span></div>
            </>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-extrabold text-white">{hoveredMatrixItems.length} chaînes au même endroit</div>
                  <div className="mt-0.5 text-[8px] text-[#8D98AA]">Points proches regroupés automatiquement</div>
                </div>
                <div className="rounded-md border border-white/[.08] bg-white/[.04] px-2 py-1 text-[8px] font-bold text-[#DCE2EC]">MULTI</div>
              </div>
              <div className="space-y-1.5">
                {hoveredMatrixItems.slice(0, 7).map((item) => (
                  <div key={item.id} className="rounded-lg border border-white/[.07] bg-white/[.035] px-2.5 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 truncate text-[9px] font-bold text-white">{item.name}</div>
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: item.color }} />
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[8px] text-[#9AA5B7]">
                      <span>{formatNumber(item.subscribers)} abonnés</span>
                      <span>•</span>
                      <span>{item.score}%</span>
                      <span>•</span>
                      <span>{item.uploads30} vidéo{item.uploads30 > 1 ? 's' : ''} / 30 j</span>
                    </div>
                  </div>
                ))}
              </div>
              {hoveredMatrixItems.length > 7 && (
                <div className="mt-2 text-center text-[8px] font-semibold text-[#AAB3C2]">+ {hoveredMatrixItems.length - 7} autre{hoveredMatrixItems.length - 7 > 1 ? 's' : ''}</div>
              )}
            </>
          )}
        </div>,
        document.body,
      )}

      <ChannelDrawer
        channelId={selectedMatrixChannelId}
        onClose={closeMatrixDetails}
      />

      {matrixDetailIds.length > 1 && selectedMatrixChannelId && typeof document !== 'undefined' && createPortal(
        <div className="fixed bottom-6 right-[250px] z-[80] flex items-center gap-2">
          <button
            type="button"
            onClick={() => stepMatrixDetails(-1)}
            className="icon-btn !h-9 !w-9 !rounded-full border border-white/[.08] bg-[#141923]/95 shadow-[0_12px_30px_rgba(0,0,0,.35)] backdrop-blur-xl"
            aria-label="Chaîne précédente au même point"
            title="Chaîne précédente"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="rounded-full border border-white/[.08] bg-[#141923]/95 px-2.5 py-1.5 text-[9px] font-bold tabular-nums text-[#AAB3C2] shadow-[0_12px_30px_rgba(0,0,0,.28)] backdrop-blur-xl">
            {matrixDetailIndex + 1} / {matrixDetailIds.length}
          </div>
          <button
            type="button"
            onClick={() => stepMatrixDetails(1)}
            className="icon-btn !h-9 !w-9 !rounded-full border border-white/[.08] bg-[#141923]/95 shadow-[0_12px_30px_rgba(0,0,0,.35)] backdrop-blur-xl"
            aria-label="Chaîne suivante au même point"
            title="Chaîne suivante"
          >
            <ChevronRight size={16} />
          </button>
        </div>,
        document.body,
      )}
    </>
  )
}
