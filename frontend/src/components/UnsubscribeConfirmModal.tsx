import { AlertTriangle, Trash2, X } from 'lucide-react'
import { CSSProperties, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Channel } from '../types'
import ChannelAvatar from './ChannelAvatar'

export default function UnsubscribeConfirmModal({
  open,
  channels,
  busy = false,
  onCancel,
  onConfirm,
}: {
  open: boolean
  channels: Channel[]
  busy?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const [rendered, setRendered] = useState(open)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let timer: number | undefined

    if (open) {
      setRendered(true)
      timer = window.setTimeout(() => setVisible(true), 20)
    } else {
      setVisible(false)
      timer = window.setTimeout(() => setRendered(false), 210)
    }

    return () => {
      if (timer) window.clearTimeout(timer)
    }
  }, [open])

  useEffect(() => {
    if (!rendered) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [rendered, busy, onCancel])

  if (!rendered || typeof document === 'undefined' || channels.length === 0) return null

  const count = channels.length
  const single = count === 1 ? channels[0] : null
  const shownChannels = channels.slice(0, 3)

  return createPortal(
    <div
      className={`fixed inset-0 z-[180] grid place-items-center px-5 transition-all duration-200 ${
        visible ? 'bg-black/55 backdrop-blur-[6px]' : 'bg-black/0 backdrop-blur-none'
      }`}
      onMouseDown={() => {
        if (!busy) onCancel()
      }}
      role="presentation"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsubscribe-confirm-title"
        onMouseDown={(event) => event.stopPropagation()}
        className={`relative w-full max-w-[470px] overflow-hidden border shadow-[0_28px_90px_rgba(0,0,0,.55)] transition-all duration-200 ease-out ${
          visible ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-3 scale-[.97] opacity-0'
        }`}
        style={{
          borderColor: 'color-mix(in srgb, var(--glass-border) 86%, var(--accent) 14%)',
          background: 'color-mix(in srgb, var(--glass-bg) 92%, #090B10)',
          borderRadius: 'calc(var(--radius) + 8px)',
          boxShadow: 'var(--panel-shadow), 0 28px 90px rgba(0,0,0,.52)',
        }}
      >
        <div
          className="pointer-events-none absolute inset-x-10 top-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, color-mix(in srgb, var(--accent) 55%, white), transparent)' }}
        />

        <div className="p-5">
          <div className="flex items-start gap-3.5">
            <div
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border"
              style={{
                borderColor: 'color-mix(in srgb, #FF667D 30%, var(--glass-border))',
                background: 'color-mix(in srgb, #FF667D 10%, var(--soft-bg))',
                color: '#FF7C90',
              }}
            >
              <Trash2 size={18} />
            </div>

            <div className="min-w-0 flex-1">
              <h2 id="unsubscribe-confirm-title" className="text-[16px] font-extrabold tracking-[-.02em] text-white">
                Confirmer le désabonnement
              </h2>
              <p className="mt-1 text-[11px] leading-5 text-[#8B96A8]">
                Cette action sera réellement appliquée sur ton compte YouTube.
              </p>
            </div>

            <button
              type="button"
              className="icon-btn !h-8 !w-8 !rounded-lg"
              onClick={onCancel}
              disabled={busy}
              aria-label="Fermer"
              title="Fermer"
            >
              <X size={15} />
            </button>
          </div>

          {single ? (
            <div
              className="mt-5 flex items-center gap-3 rounded-xl border p-3"
              style={{
                borderColor: 'var(--glass-border)',
                background: 'color-mix(in srgb, var(--soft-bg) 88%, var(--accent) 3%)',
              }}
            >
              <ChannelAvatar src={single.thumbnailUrl} name={single.name} size="md" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-[#F1F4F8]">{single.name}</div>
                <div className="mt-0.5 text-[10px] text-[#778294]">1 chaîne sélectionnée</div>
              </div>
            </div>
          ) : (
            <div
              className="mt-5 rounded-xl border p-3.5"
              style={{
                borderColor: 'var(--glass-border)',
                background: 'color-mix(in srgb, var(--soft-bg) 88%, var(--accent) 3%)',
              }}
            >
              <div className="flex items-center gap-3">
                <div className="flex shrink-0 -space-x-2">
                  {shownChannels.map((channel) => (
                    <div key={channel.id} className="rounded-full ring-2" style={{ '--tw-ring-color': 'var(--soft-bg)' } as CSSProperties}>
                      <ChannelAvatar src={channel.thumbnailUrl} name={channel.name} />
                    </div>
                  ))}
                  {count > 3 && (
                    <div
                      className="grid h-9 w-9 place-items-center rounded-full border text-[9px] font-bold text-[#AAB4C3]"
                      style={{ borderColor: 'var(--glass-border)', background: 'var(--soft-bg)' }}
                    >
                      +{count - 3}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-extrabold text-white">{count} chaînes sélectionnées</div>
                  <div className="mt-0.5 truncate text-[10px] text-[#778294]">
                    {shownChannels.map((channel) => channel.name).join(' · ')}{count > 3 ? '…' : ''}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div
            className="mt-4 flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[10px] leading-4"
            style={{
              borderColor: 'color-mix(in srgb, #F3BE5D 22%, var(--glass-border))',
              background: 'color-mix(in srgb, #F3BE5D 6%, var(--soft-bg))',
              color: '#C9B06F',
            }}
          >
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>Tu devras te réabonner manuellement sur YouTube si tu changes d’avis.</span>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2.5">
            <button type="button" className="btn w-full" onClick={onCancel} disabled={busy}>
              Annuler
            </button>
            <button
              type="button"
              className="btn w-full border-[#71313C] bg-[#28151A] text-[#FF879A] hover:bg-[#351920]"
              onClick={onConfirm}
              disabled={busy}
            >
              <Trash2 size={15} />
              {busy ? 'Désabonnement...' : count > 1 ? `Désabonner (${count})` : 'Se désabonner'}
            </button>
          </div>
        </div>
      </section>
    </div>,
    document.body,
  )
}
