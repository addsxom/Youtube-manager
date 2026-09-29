import { ExternalLink, Heart, Play, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { api, formatDate, formatNumber } from '../lib'
import { Channel } from '../types'
import ChannelAvatar from './ChannelAvatar'
import ScoreBadge from './ScoreBadge'

function videoDate(value: string) {
  try {
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
  } catch {
    return 'Date inconnue'
  }
}

function videoAgeDays(value: string) {
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return null
  return Math.max(0, (Date.now() - timestamp) / 86_400_000)
}

function buildRecentActivity(channel: Channel | null, period: 7 | 30) {
  const videos = channel?.recentVideos || []
  const buckets = period === 7
    ? [
        { label: 'J-6', min: 6, max: 7 },
        { label: 'J-5', min: 5, max: 6 },
        { label: 'J-4', min: 4, max: 5 },
        { label: 'J-3', min: 3, max: 4 },
        { label: 'J-2', min: 2, max: 3 },
        { label: 'Hier', min: 1, max: 2 },
        { label: 'Auj.', min: 0, max: 1 },
      ]
    : [
        { label: 'S-4', min: 21, max: 30 },
        { label: 'S-3', min: 14, max: 21 },
        { label: 'S-2', min: 7, max: 14 },
        { label: '7 j', min: 0, max: 7 },
      ]

  return buckets.map((bucket) => ({
    label: bucket.label,
    uploads: videos.filter((video) => {
      const ageDays = videoAgeDays(video.publishedAt)
      if (ageDays === null) return false
      return ageDays >= bucket.min && ageDays < bucket.max
    }).length,
  }))
}

export default function ChannelDrawer({
  channelId,
  onClose,
  onChanged,
}: {
  channelId: string | null
  onClose: () => void
  onChanged?: () => void
}) {
  const [channel, setChannel] = useState<Channel | null>(null)
  const [note, setNote] = useState('')
  const [showFullBio, setShowFullBio] = useState(false)
  const [activityPeriod, setActivityPeriod] = useState<7 | 30>(7)
  const activityData = useMemo(() => buildRecentActivity(channel, activityPeriod), [channel, activityPeriod])
  const activityTotal = activityData.reduce((sum, item) => sum + item.uploads, 0)
  const activityMayBeCapped = useMemo(() => {
    const videos = channel?.recentVideos || []
    if (videos.length < 10) return false
    const oldest = videos[videos.length - 1]
    const ageDays = oldest ? videoAgeDays(oldest.publishedAt) : null
    return ageDays !== null && ageDays < activityPeriod
  }, [channel, activityPeriod])

  useEffect(() => {
    if (!channelId) return
    setChannel(null)
    setShowFullBio(false)
    setActivityPeriod(7)
    api<Channel>(`/api/channels/${channelId}`).then((data) => {
      setChannel(data)
      setNote(data.note || '')
    })
  }, [channelId])

  useEffect(() => {
    if (!channelId) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [channelId])

  if (!channelId) return null

  const patch = async (body: Partial<Pick<Channel, 'favorite' | 'ignored' | 'note'>>) => {
    const updated = await api<Channel>(`/api/channels/${channelId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
    setChannel(updated)
    setNote(updated.note || '')
    onChanged?.()
  }

  const description = channel?.description?.trim() || ''
  const hasLongBio = description.length > 130
  const activityPeriodLabel = activityPeriod === 30 ? '1 mois' : '7 j'

  return createPortal(
    <div className="drawer-backdrop fixed inset-0 z-50 flex justify-end overflow-hidden" onMouseDown={onClose}>
      <aside
        className="liquid-glass relative my-3 mr-3 h-[calc(100%-24px)] w-[560px] overflow-hidden rounded-[28px]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {!channel ? (
          <div className="p-6">
            <div className="animate-pulse space-y-4"><div className="h-28 rounded-2xl bg-white/[.045]" /><div className="h-16 rounded-xl bg-white/[.045]" /><div className="h-36 rounded-xl bg-white/[.045]" /></div>
          </div>
        ) : (
          <>
            <div className="relative h-[118px] overflow-hidden rounded-t-[28px] border-b border-white/[.06] bg-gradient-to-br from-[#252D40] via-[#171B26] to-[#11141B]">
              {channel.bannerUrl && (
                <img src={channel.bannerUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0E1118] via-black/20 to-black/10" />
              <div className="absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
              <div className="absolute left-5 top-4 rounded-xl border border-white/10 bg-black/30 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.18em] text-white/75 backdrop-blur-xl">
                Détails de la chaîne
              </div>
              <button className="icon-btn absolute right-5 top-4 !bg-black/30 backdrop-blur-xl" onClick={onClose}><X size={17} /></button>
            </div>

            <div className="px-6 pb-5">
              <div className="relative -mt-8 flex items-end gap-3.5">
                <div className="rounded-[20px] border-4 border-[#0E1118] bg-[#0E1118] shadow-[0_10px_30px_rgba(0,0,0,.25)]">
                  <ChannelAvatar src={channel.thumbnailUrl} name={channel.name} size="md" className="!h-16 !w-16 !rounded-[15px]" />
                </div>
                <div className="min-w-0 flex-1 pb-0.5">
                  <h2 className="truncate text-[21px] font-extrabold tracking-[-.025em] text-white">{channel.name}</h2>
                  <div className="mt-1.5"><ScoreBadge score={channel.score} /></div>
                </div>
              </div>

              <div className="mt-3">
                <p className="line-clamp-2 text-[11px] leading-5 text-[#8993A4]">
                  {description || 'Aucune description disponible.'}
                </p>
                {hasLongBio && (
                  <button
                    type="button"
                    onClick={() => setShowFullBio(true)}
                    className="mt-1 text-[10px] font-semibold text-[#929DFF] transition hover:text-[#BCC3FF]"
                  >
                    Afficher toute la bio
                  </button>
                )}
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="glass-soft rounded-xl px-3 py-2.5">
                  <div className="text-[9px] font-semibold uppercase tracking-[.11em] text-[#697386]">Abonnés</div>
                  <div className="mt-1 text-[18px] font-extrabold tracking-tight text-white">{formatNumber(channel.subscribers)}</div>
                </div>
                <div className="glass-soft rounded-xl px-3 py-2.5">
                  <div className="text-[9px] font-semibold uppercase tracking-[.11em] text-[#697386]">Vidéos</div>
                  <div className="mt-1 text-[18px] font-extrabold tracking-tight text-white">{formatNumber(channel.videos)}</div>
                </div>
                <div className="glass-soft rounded-xl px-3 py-2.5">
                  <div className="text-[9px] font-semibold uppercase tracking-[.11em] text-[#697386]">Dernière vidéo</div>
                  <div className="mt-1 truncate text-[12px] font-bold text-[#EDF1F7]">{channel.lastVideo}</div>
                </div>
              </div>

              <div className="relative mt-2.5 grid grid-cols-[minmax(0,1fr)_132px] items-stretch gap-2.5 overflow-visible">
                <div className="glass-soft relative z-[60] min-w-0 overflow-visible rounded-xl px-3.5 py-2.5">
                  <div className="grid grid-cols-2 items-end gap-4">
                    <div>
                      <div className="text-[8px] font-semibold uppercase tracking-wider text-[#697386]">Score d'activité</div>
                      <div className="mt-0.5 text-[15px] font-extrabold text-white">{channel.score}%</div>
                    </div>
                    <div>
                      <div className="text-[8px] font-semibold uppercase tracking-wider text-[#697386]">Vidéos publiées · {activityPeriodLabel}</div>
                      <div className="mt-0.5 text-[15px] font-extrabold text-white">{activityTotal}{activityMayBeCapped ? '+' : ''}</div>
                    </div>
                  </div>

                  <div className="relative z-[70] mt-2 h-[58px] overflow-visible px-1 pt-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={activityData} margin={{ top: 3, right: 2, left: 2, bottom: 1 }}>
                        <XAxis
                          dataKey="label"
                          tick={{ fill: '#697386', fontSize: 7 }}
                          axisLine={false}
                          tickLine={false}
                          interval={0}
                          height={13}
                        />
                        <Tooltip
                          allowEscapeViewBox={{ x: true, y: true }}
                          wrapperStyle={{ zIndex: 9999, pointerEvents: 'none' }}
                          cursor={false}
                          content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null
                            const value = Number(payload[0]?.value || 0)
                            return (
                              <div className="min-w-[92px] rounded-lg border border-white/[.10] bg-[#1A1F2A]/95 px-2.5 py-2 text-[9px] text-white shadow-[0_12px_28px_rgba(0,0,0,.35)] backdrop-blur-xl">
                                <div className="font-semibold text-[#DCE2EC]">{label}</div>
                                <div className="mt-1 font-bold text-white">{value} vidéo{value > 1 ? 's' : ''}</div>
                              </div>
                            )
                          }}
                        />
                        <Bar dataKey="uploads" fill="var(--accent)" radius={[3, 3, 1, 1]} maxBarSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="glass-soft relative z-0 flex rounded-xl px-3 py-2.5">
                  <div className="flex h-full w-full flex-col items-center justify-between text-center">
                    <div className="flex min-h-[48px] flex-col items-center justify-center">
                      <div className="text-[8px] font-semibold uppercase tracking-wider text-[#697386]">Abonné depuis</div>
                      <div className="mt-1 text-[10px] font-semibold leading-4 text-[#D7DEE9]">
                        {channel.subscribedAt ? formatDate(channel.subscribedAt).split(' à ')[0] : 'Inconnu'}
                      </div>
                    </div>

                    <div className="mt-2 w-full border-t border-white/[.055] pt-2">
                      <div className="mb-1.5 text-[8px] font-semibold text-[#727D90]">Période</div>
                      <div className="grid grid-cols-2 gap-1">
                        {([7, 30] as const).map((period) => {
                          const active = activityPeriod === period
                          return (
                            <button
                              key={period}
                              type="button"
                              onClick={() => setActivityPeriod(period)}
                              className={`h-7 rounded-md text-[9px] font-bold transition ${active ? 'text-white' : 'text-[#788396] hover:text-white'}`}
                              style={active ? {
                                background: 'color-mix(in srgb, var(--accent) 16%, var(--soft-bg))',
                                boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--accent) 26%, transparent)',
                              } : { background: 'rgba(255,255,255,.025)' }}
                            >
                              {period === 30 ? '1 mois' : '7 j'}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <section className="relative z-0 mt-3">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold">Dernières vidéos</h3>
                    <p className="mt-0.5 text-[10px] text-[#727D90]">Les 3 publications les plus récentes.</p>
                  </div>
                  <a href={`https://www.youtube.com/channel/${channel.id}/videos`} target="_blank" rel="noreferrer" className="text-[11px] font-semibold text-[#929DFF] hover:text-[#BCC3FF]">Voir tout</a>
                </div>

                {channel.recentVideos?.length ? (
                  <div className="space-y-1.5">
                    {channel.recentVideos.slice(0, 3).map((video) => (
                      <a
                        key={video.id}
                        href={`https://www.youtube.com/watch?v=${video.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="glass-soft group flex h-[56px] gap-3 rounded-xl p-2 transition hover:border-white/[.11] hover:bg-white/[.05]"
                      >
                        <div className="relative h-full w-[92px] shrink-0 overflow-hidden rounded-lg bg-white/[.04]">
                          {video.thumbnailUrl ? <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : null}
                          <div className="absolute inset-0 grid place-items-center bg-black/0 transition group-hover:bg-black/25"><Play size={17} className="opacity-0 transition group-hover:opacity-100" fill="currentColor" /></div>
                        </div>
                        <div className="min-w-0 flex-1 py-0.5">
                          <div className="line-clamp-2 text-[11px] font-semibold leading-4 text-[#E8ECF2]">{video.title}</div>
                          <div className="mt-0.5 text-[9px] text-[#6F798C]">{videoDate(video.publishedAt)}</div>
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-white/[.08] bg-white/[.02] px-4 py-4 text-center text-[11px] text-[#747F91]">
                    Synchronise le manager pour récupérer les dernières vidéos de cette chaîne.
                  </div>
                )}
              </section>

              {channel.ignored && (
                <div className="mt-2 rounded-xl border border-[#5B4B73]/40 bg-[#2A2038]/35 px-3.5 py-2 text-[11px] text-[#B5A9CC] backdrop-blur-xl">
                  Cette chaîne est ignorée par l'assistant de nettoyage.
                </div>
              )}

              <a className="btn mt-2.5 h-9 w-full !py-2 text-xs" href={`https://www.youtube.com/channel/${channel.id}`} target="_blank" rel="noreferrer">
                <ExternalLink size={15} /> Ouvrir sur YouTube
              </a>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <button className="btn h-9 !py-2 text-[11px]" onClick={() => void patch({ favorite: !channel.favorite })}>
                  <Heart size={14} fill={channel.favorite ? 'currentColor' : 'none'} />
                  {channel.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                </button>
                <button className="btn h-9 !py-2 text-[11px]" onClick={() => void patch({ ignored: !channel.ignored })}>
                  {channel.ignored ? 'Réactiver nettoyage' : 'Ignorer nettoyage'}
                </button>
              </div>

              <div className="mt-2.5">
                <label className="mb-1 block text-[10px] font-semibold text-[#8D96A8]">Note personnelle</label>
                <div className="flex gap-2">
                  <textarea
                    className="field min-h-11 flex-1 resize-none !py-2.5 text-[11px]"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Pourquoi tu gardes cette chaîne..."
                  />
                  <button className="btn shrink-0 !px-3.5 !py-2 text-[11px]" onClick={() => void patch({ note })}>Enregistrer</button>
                </div>
              </div>
            </div>

            {showFullBio && (
              <div
                className="fixed inset-0 z-[70] grid place-items-center bg-black/45 px-6 backdrop-blur-[3px]"
                onMouseDown={() => setShowFullBio(false)}
              >
                <div
                  className="liquid-glass w-full max-w-[500px] rounded-[24px] p-5"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[.14em] text-[#697386]">Bio complète</div>
                      <div className="mt-1 truncate text-sm font-bold text-white">{channel.name}</div>
                    </div>
                    <button className="icon-btn" onClick={() => setShowFullBio(false)}><X size={16} /></button>
                  </div>
                  <div className="max-h-[55vh] overflow-y-auto whitespace-pre-wrap pr-1 text-xs leading-5 text-[#A3ADBC]">
                    {description || 'Aucune description disponible.'}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </aside>
    </div>,
    document.body,
  )
}