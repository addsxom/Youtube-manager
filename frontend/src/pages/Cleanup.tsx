import { Check, CheckCircle2, ChevronLeft, ChevronRight, ExternalLink, EyeOff, RotateCcw, ShieldCheck, Trash2, X, XCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import ChannelAvatar from '../components/ChannelAvatar'
import ScoreBadge from '../components/ScoreBadge'
import UnsubscribeConfirmModal from '../components/UnsubscribeConfirmModal'
import { api, formatDate, formatNumber } from '../lib'
import { Channel } from '../types'

function getCleanupThreshold() {
  const value = Number(localStorage.getItem('ytm.cleanupThreshold'))
  return [30, 40, 50, 60].includes(value) ? value : 40
}

function cleanupReasons(channel: Channel) {
  const reasons: string[] = []
  if (!channel.videos) reasons.push('Aucune vidéo détectée')
  if (!channel.lastUploadAt) reasons.push('Date de dernière publication inconnue')
  if (channel.score < 20) reasons.push('Activité très faible')
  else if (channel.score < 40) reasons.push('Activité faible')
  if (!channel.favorite) reasons.push('Pas dans tes favoris')
  return reasons.slice(0, 3)
}

type Feedback = { type: 'success' | 'error'; text: string } | null

export default function Cleanup() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [index, setIndex] = useState(0)
  const [marked, setMarked] = useState<Set<string>>(new Set())
  const [reviewed, setReviewed] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [showFullBio, setShowFullBio] = useState(false)
  const [confirmUnsubscribeOpen, setConfirmUnsubscribeOpen] = useState(false)
  const [threshold] = useState(getCleanupThreshold)

  const load = async () => {
    const data = await api<{ items: Channel[] }>('/api/channels?status=all')
    setChannels(data.items.filter((item) => !item.ignored && item.score < threshold))
    setIndex(0)
  }

  useEffect(() => { void load() }, [])
  const current = channels[index]
  const markedList = useMemo(() => channels.filter((channel) => marked.has(channel.id)), [channels, marked])
  const description = current?.description?.trim() || ''
  const hasLongBio = description.length > 130

  useEffect(() => {
    setShowFullBio(false)
  }, [current?.id])

  const next = () => setIndex((value) => Math.min(channels.length, value + 1))

  const mark = () => {
    if (!current) return
    setMarked((prev) => new Set(prev).add(current.id))
    setReviewed((prev) => new Set(prev).add(current.id))
    next()
  }

  const keepForNow = () => {
    if (!current) return
    setReviewed((prev) => new Set(prev).add(current.id))
    next()
  }

  const ignore = async () => {
    if (!current) return
    await api(`/api/channels/${current.id}`, { method: 'PATCH', body: JSON.stringify({ ignored: true }) })
    setChannels((prev) => prev.filter((item) => item.id !== current.id))
    setMarked((prev) => {
      const copy = new Set(prev)
      copy.delete(current.id)
      return copy
    })
    setReviewed((prev) => new Set(prev).add(current.id))
    setIndex((value) => Math.min(value, channels.length - 1))
  }

  const unmark = (id: string) => {
    setMarked((prev) => {
      const copy = new Set(prev)
      copy.delete(id)
      return copy
    })
  }

  const confirmUnsubscribe = async () => {
    if (!markedList.length || busy) return
    setBusy(true)
    setFeedback(null)
    let done = 0
    let failed = 0
    try {
      for (const channel of markedList) {
        try {
          await api(`/api/channels/${channel.id}/subscription`, { method: 'DELETE' })
          done += 1
        } catch {
          failed += 1
        }
      }
      setConfirmUnsubscribeOpen(false)
      setMarked(new Set())
      setReviewed(new Set())
      await load()
      window.dispatchEvent(new Event('ytm:refresh'))
      if (failed === 0) {
        setFeedback({ type: 'success', text: `${done} désabonnement${done > 1 ? 's' : ''} effectué${done > 1 ? 's' : ''} avec succès.` })
      } else {
        setFeedback({ type: 'error', text: `${done} réussi${done > 1 ? 's' : ''}, ${failed} échec${failed > 1 ? 's' : ''}.` })
      }
      window.setTimeout(() => setFeedback(null), 5500)
    } finally {
      setBusy(false)
    }
  }

  const openConfirmUnsubscribe = () => {
    if (!markedList.length || busy) return
    setConfirmUnsubscribeOpen(true)
  }

  return (
    <div className="mx-auto max-w-[1120px]">
      <div className="mb-5">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[.16em] text-[#687386]">Assistant</p>
        <h1 className="page-title">Grand nettoyage</h1>
        <p className="mt-1 text-sm text-[#7F899B]">Examine les chaînes sous {threshold}% d'activité. Aucun désabonnement sans confirmation finale.</p>
      </div>

      {!current ? (
        <div className="panel p-12 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#153B2D] text-[#72E0AF]"><Check size={22} /></div>
          <h2 className="mt-4 text-lg font-bold">Tout est examiné</h2>
          <p className="mt-1 text-sm text-[#788395]">Tu as parcouru toutes les chaînes de cette file.</p>
          {markedList.length > 0 && <button className="btn btn-primary mt-5" onClick={openConfirmUnsubscribe}>Confirmer {markedList.length} désabonnement(s)</button>}
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between gap-4 text-[11px] text-[#6F798C]">
            <span>{index + 1} / {channels.length} · {reviewed.size} déjà examinée{reviewed.size > 1 ? 's' : ''}</span>
            <div className="flex items-center gap-2.5">
              <span className="rounded-lg border border-white/[.07] bg-white/[.025] px-2.5 py-1 text-[10px] text-[#8D97A8]">
                File prête <strong className="ml-1 text-[#E9EDF4]">{marked.size}</strong>
              </span>
              <span>{Math.round(((index + 1) / channels.length) * 100)}%</span>
            </div>
          </div>
          <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-[#1C222B]"><div className="h-full rounded-full bg-[#6C7CFF] transition-all" style={{ width: `${Math.round(((index + 1) / channels.length) * 100)}%` }} /></div>

          <section className="panel w-full max-w-full overflow-hidden">
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_340px]">
              <div className="min-w-0 p-8">
                <div className="flex items-start gap-5">
                  <ChannelAvatar src={current.thumbnailUrl} name={current.name} size="lg" />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-[22px] font-extrabold tracking-tight">{current.name}</h2>
                    <div className="mt-2"><ScoreBadge score={current.score} /></div>
                    <a href={`https://www.youtube.com/channel/${current.id}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#8D9BFF] hover:text-[#B0BAFF]">
                      Ouvrir la chaîne <ExternalLink size={12} />
                    </a>
                  </div>
                </div>

                <div className="mt-7 flex flex-wrap gap-2">
                  {cleanupReasons(current).map((reason) => (
                    <span key={reason} className="rounded-full border border-[#303746] bg-[#11161D] px-2.5 py-1 text-[10px] font-semibold text-[#98A2B4]">{reason}</span>
                  ))}
                </div>

                <div className="mt-6 grid grid-cols-4 gap-3">
                  <div className="metric-box"><div className="metric-label">Abonnés</div><div className="metric-value">{formatNumber(current.subscribers)}</div></div>
                  <div className="metric-box"><div className="metric-label">Vidéos</div><div className="metric-value">{formatNumber(current.videos)}</div></div>
                  <div className="metric-box"><div className="metric-label">Dernière vidéo</div><div className="mt-1 text-xs font-bold text-[#DDE2EA]">{current.lastVideo}</div></div>
                  <div className="metric-box"><div className="metric-label">Abonné depuis</div><div className="mt-1 text-xs font-bold text-[#DDE2EA]">{current.subscribedAt ? formatDate(current.subscribedAt).split(' à ')[0] : 'Inconnu'}</div></div>
                </div>

                <div className="mt-6 min-w-0 overflow-hidden rounded-xl border border-[#232A34] bg-[#0F1319] p-4">
                  <div className="text-[10px] font-bold uppercase tracking-[.12em] text-[#687386]">Description</div>
                  <p className="mt-2 block max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm leading-6 text-[#7C8799]">{description || 'Aucune description disponible.'}</p>
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
              </div>

              <div className="min-w-0 border-l border-[#232A34] bg-[#0F1319] p-6">
                <h3 className="text-sm font-bold">Ta décision</h3>
                <p className="mt-1 text-xs leading-5 text-[#737E90]">Tu peux garder la chaîne, l'ignorer définitivement dans cet assistant, ou la préparer au désabonnement.</p>
                <div className="mt-6 space-y-2.5">
                  <button className="btn w-full justify-start" onClick={keepForNow}><ShieldCheck size={16} /> Garder pour l'instant</button>
                  <button className="btn w-full justify-start" onClick={() => void ignore()}><EyeOff size={16} /> Ignorer les suggestions</button>
                  <button className="btn w-full justify-start border-[#6D2B39] text-[#FF879C] hover:bg-[#28141A]" onClick={mark}><Trash2 size={16} /> Préparer le désabonnement</button>
                </div>

                <div className="mt-7 border-t border-[#242A34] pt-5">
                  <div className="flex items-center justify-between text-xs"><span className="text-[#7A8598]">Liste prête</span><span className="font-bold">{marked.size}</span></div>
                  {markedList.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {markedList.slice(0, 4).map((channel) => (
                        <div key={channel.id} className="flex items-center gap-2 rounded-lg border border-[#242B35] bg-[#131820] px-2.5 py-2">
                          <span className="min-w-0 flex-1 truncate text-[10px] text-[#AAB3C2]">{channel.name}</span>
                          <button onClick={() => unmark(channel.id)} className="text-[#667185] hover:text-white" title="Retirer de la liste"><X size={13} /></button>
                        </div>
                      ))}
                      {markedList.length > 4 && <div className="px-1 text-[10px] text-[#697386]">+ {markedList.length - 4} autre(s)</div>}
                    </div>
                  )}
                  <button className="btn btn-primary mt-3 w-full" disabled={!marked.size || busy} onClick={openConfirmUnsubscribe}>{busy ? 'Traitement...' : `Confirmer (${marked.size})`}</button>
                  {marked.size > 0 && <button className="mt-2 inline-flex w-full items-center justify-center gap-1 text-[10px] text-[#707B8E] hover:text-[#AAB3C2]" onClick={() => setMarked(new Set())}><RotateCcw size={11} /> Vider la liste</button>}
                </div>
              </div>
            </div>
          </section>

          <div className="mt-4 flex justify-center gap-2">
            <button className="icon-btn" disabled={index === 0} onClick={() => setIndex(Math.max(0, index - 1))}><ChevronLeft size={17} /></button>
            <button className="icon-btn" disabled={index >= channels.length} onClick={next}><ChevronRight size={17} /></button>
          </div>
        </>
      )}

      {showFullBio && current && (
        <div
          className="fixed inset-0 z-[80] grid place-items-center bg-black/45 px-6 backdrop-blur-[3px]"
          onMouseDown={() => setShowFullBio(false)}
        >
          <div
            className="liquid-glass w-full max-w-[500px] rounded-[24px] p-5"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[.14em] text-[#697386]">Bio complète</div>
                <div className="mt-1 truncate text-sm font-bold text-white">{current.name}</div>
              </div>
              <button className="icon-btn" onClick={() => setShowFullBio(false)}><X size={16} /></button>
            </div>
            <div className="max-h-[55vh] overflow-y-auto whitespace-pre-wrap break-words [overflow-wrap:anywhere] pr-1 text-xs leading-5 text-[#A3ADBC]">
              {description || 'Aucune description disponible.'}
            </div>
          </div>
        </div>
      )}

      <UnsubscribeConfirmModal
        open={confirmUnsubscribeOpen}
        channels={markedList}
        busy={busy}
        onCancel={() => setConfirmUnsubscribeOpen(false)}
        onConfirm={() => void confirmUnsubscribe()}
      />

      {feedback && (
        <div className={`fixed bottom-6 right-6 z-[70] flex min-w-[340px] items-center gap-3 rounded-xl border px-4 py-3 shadow-2xl ${feedback.type === 'success' ? 'border-[#285A47] bg-[#11261E] text-[#8BE1B9]' : 'border-[#69313C] bg-[#2A151B] text-[#FF91A4]'}`}>
          {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
          <div className="text-xs font-semibold">{feedback.text}</div>
        </div>
      )}
    </div>
  )
}
