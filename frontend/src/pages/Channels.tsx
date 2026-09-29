import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table'
import { CheckCircle2, ChevronDown, Heart, MoreHorizontal, Rows3, Trash2, XCircle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ChannelAvatar from '../components/ChannelAvatar'
import ChannelDrawer from '../components/ChannelDrawer'
import ScoreBadge from '../components/ScoreBadge'
import ThemedSelect from '../components/ThemedSelect'
import UnsubscribeConfirmModal from '../components/UnsubscribeConfirmModal'
import { api, formatNumber } from '../lib'
import { Channel } from '../types'

const filters = [
  ['all', 'Toutes'],
  ['active', 'Actives'],
  ['watch', 'À surveiller'],
  ['inactive', 'Inactives'],
  ['favorite', 'Favoris'],
] as const

const sortOptions = [
  ['score-asc', 'Moins actives d’abord'],
  ['score-desc', 'Plus actives d’abord'],
  ['subscribers-desc', 'Plus d’abonnés'],
  ['subscribers-asc', 'Moins d’abonnés'],
  ['name-asc', 'Nom A → Z'],
] as const

const sortSelectOptions = sortOptions.map(([value, label]) => ({ value, label }))
const INITIAL_RENDER_COUNT = 40
const RENDER_BATCH_SIZE = 40

type BulkMessage = { type: 'success' | 'error'; text: string } | null

export default function Channels({ forcedStatus }: { forcedStatus?: 'favorite' }) {
  const [searchParams] = useSearchParams()
  const [channels, setChannels] = useState<Channel[]>([])
  const [status, setStatus] = useState<string>(forcedStatus || 'all')
  const query = searchParams.get('q') || ''
  const [sorting, setSorting] = useState<SortingState>([{ id: 'score', desc: false }])
  const [selected, setSelected] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [favoriteAnimating, setFavoriteAnimating] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkMessage, setBulkMessage] = useState<BulkMessage>(null)
  const [confirmUnsubscribeOpen, setConfirmUnsubscribeOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [compact, setCompact] = useState(() => localStorage.getItem('ytm.compactRows') === '1')
  const [renderCount, setRenderCount] = useState(INITIAL_RENDER_COUNT)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ status: forcedStatus || status })
      if (query.trim()) qs.set('search', query.trim())
      const data = await api<{ items: Channel[] }>(`/api/channels?${qs.toString()}`)
      setChannels(data.items)
    } finally {
      setLoading(false)
    }
  }, [forcedStatus, query, status])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const refresh = () => void load()
    window.addEventListener('ytm:refresh', refresh)
    return () => window.removeEventListener('ytm:refresh', refresh)
  }, [load])
  useEffect(() => { localStorage.setItem('ytm.compactRows', compact ? '1' : '0') }, [compact])
  useEffect(() => {
    setSelectedIds(new Set())
    setConfirmUnsubscribeOpen(false)
  }, [status, query, forcedStatus])
  useEffect(() => { setRenderCount(INITIAL_RENDER_COUNT) }, [status, query, forcedStatus, sorting])

  const toggleFavorite = useCallback(async (channel: Channel) => {
    const nextFavorite = !channel.favorite

    setFavoriteAnimating((previous) => {
      const next = new Set(previous)
      next.add(channel.id)
      return next
    })
    window.setTimeout(() => {
      setFavoriteAnimating((previous) => {
        const next = new Set(previous)
        next.delete(channel.id)
        return next
      })
    }, 360)

    setChannels((previous) => previous.map((item) => (
      item.id === channel.id ? { ...item, favorite: nextFavorite } : item
    )))

    try {
      await api(`/api/channels/${channel.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ favorite: nextFavorite }),
      })
    } finally {
      await load()
    }
  }, [load])

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const columns = useMemo<ColumnDef<Channel>[]>(() => [
    {
      id: 'select',
      enableSorting: false,
      header: '',
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={selectedIds.has(row.original.id)}
          onClick={(event) => event.stopPropagation()}
          onChange={() => toggleSelection(row.original.id)}
          aria-label={`Sélectionner ${row.original.name}`}
          className="h-4 w-4 cursor-pointer"
          style={{ accentColor: 'var(--accent)' }}
        />
      ),
    },
    {
      id: 'name',
      accessorKey: 'name',
      header: 'Chaîne',
      cell: ({ row }) => (
        <div className="flex max-w-[480px] items-center gap-3 text-left">
          <ChannelAvatar src={row.original.thumbnailUrl} name={row.original.name} />
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-[#EDF0F5]">{row.original.name}</div>
            <div className="mt-0.5 truncate text-[10px] text-[#697386]">{row.original.lastVideo}</div>
          </div>
        </div>
      ),
    },
    {
      id: 'subscribers',
      accessorKey: 'subscribers',
      header: 'Abonnés',
      cell: ({ getValue }) => <span className="text-xs font-semibold text-[#CAD0DB]">{formatNumber(getValue<number>())}</span>,
    },
    {
      id: 'videos', accessorKey: 'videos', header: 'Vidéos',
      cell: ({ getValue }) => <span className="text-xs text-[#9AA4B6]">{formatNumber(getValue<number>())}</span>,
    },
    {
      id: 'score', accessorKey: 'score', header: 'Activité',
      cell: ({ getValue }) => <ScoreBadge score={getValue<number>()} />,
    },
    {
      id: 'actions',
      enableSorting: false,
      header: '',
      cell: ({ row }) => {
        const animating = favoriteAnimating.has(row.original.id)
        return (
          <div className="flex justify-end gap-1.5">
            <button
              className="icon-btn group/like flex h-9 w-9 shrink-0 items-center justify-center !p-0 transition-transform duration-150 active:scale-90"
              title={row.original.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              onClick={(event) => { event.stopPropagation(); void toggleFavorite(row.original) }}
            >
              <Heart
                size={16}
                fill={row.original.favorite ? 'currentColor' : 'none'}
                style={row.original.favorite ? { color: 'var(--accent)' } : undefined}
                className={`block transform-gpu transition-all duration-200 ease-out ${
                  row.original.favorite
                    ? 'drop-shadow-[0_0_6px_rgba(255,109,123,.35)]'
                    : 'text-[#7A8597] group-hover/like:text-white'
                } ${animating ? 'scale-[1.35] -rotate-6 drop-shadow-[0_0_10px_rgba(255,109,123,.7)]' : 'scale-100 rotate-0'}`}
              />
            </button>
            <button
              className="icon-btn flex h-9 w-9 shrink-0 items-center justify-center !p-0"
              title="Plus d’options"
              onClick={(event) => { event.stopPropagation(); setSelected(row.original.id) }}
            >
              <MoreHorizontal size={16} />
            </button>
          </div>
        )
      },
    },
  ], [favoriteAnimating, selectedIds, toggleFavorite, toggleSelection])

  const table = useReactTable({
    data: channels,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const rows = table.getRowModel().rows
  const renderedRows = rows.slice(0, renderCount)
  const hasMoreRows = renderCount < rows.length
  const visibleIds = rows.map((row) => row.original.id)
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id))
  const selectedChannels = channels.filter((channel) => selectedIds.has(channel.id))

  useEffect(() => {
    if (!hasMoreRows || forcedStatus) return
    const target = loadMoreRef.current
    if (!target) return

    const observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) return
      setRenderCount((current) => Math.min(current + RENDER_BATCH_SIZE, rows.length))
    }, { rootMargin: '600px 0px' })

    observer.observe(target)
    return () => observer.disconnect()
  }, [hasMoreRows, rows.length, forcedStatus])

  const applySort = (value: string) => {
    if (value === 'score-asc') setSorting([{ id: 'score', desc: false }])
    if (value === 'score-desc') setSorting([{ id: 'score', desc: true }])
    if (value === 'subscribers-desc') setSorting([{ id: 'subscribers', desc: true }])
    if (value === 'subscribers-asc') setSorting([{ id: 'subscribers', desc: false }])
    if (value === 'name-asc') setSorting([{ id: 'name', desc: false }])
  }

  const toggleVisiblePage = () => {
    setSelectedIds((previous) => {
      const next = new Set(previous)
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id))
      else visibleIds.forEach((id) => next.add(id))
      return next
    })
  }

  const unsubscribeSelected = async () => {
    if (!selectedChannels.length || bulkBusy) return

    setBulkBusy(true)
    setBulkMessage(null)
    let done = 0
    let failed = 0

    for (const channel of selectedChannels) {
      try {
        await api(`/api/channels/${channel.id}/subscription`, { method: 'DELETE' })
        done += 1
      } catch {
        failed += 1
      }
    }

    setConfirmUnsubscribeOpen(false)
    setSelectedIds(new Set())
    await load()
    window.dispatchEvent(new Event('ytm:refresh'))
    setBulkBusy(false)

    if (failed === 0) {
      setBulkMessage({ type: 'success', text: `${done} désabonnement${done > 1 ? 's' : ''} effectué${done > 1 ? 's' : ''} avec succès.` })
    } else {
      setBulkMessage({ type: 'error', text: `${done} désabonnement${done > 1 ? 's' : ''} réussi${done > 1 ? 's' : ''}, ${failed} échec${failed > 1 ? 's' : ''}.` })
    }
    window.setTimeout(() => setBulkMessage(null), 5500)
  }

  const currentSort = sorting[0] || { id: 'score', desc: false }
  const sortValue = currentSort.id === 'score'
    ? (currentSort.desc ? 'score-desc' : 'score-asc')
    : currentSort.id === 'subscribers'
      ? (currentSort.desc ? 'subscribers-desc' : 'subscribers-asc')
      : 'name-asc'

  if (forcedStatus) {
    return (
      <div>
        <div className="mb-6">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[.16em] text-[#687386]">Bibliothèque</p>
          <h1 className="page-title">Tes favoris</h1>
          <p className="mt-1 text-sm text-[#7F899B]">{channels.length} chaîne{channels.length > 1 ? 's' : ''} favorite{channels.length > 1 ? 's' : ''}{query ? ` pour « ${query} »` : ''}.</p>
        </div>

        {channels.length === 0 ? (
          <div className="panel p-12 text-center text-sm text-[#7A8597]">Aucun favori ne correspond à cette recherche.</div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {channels.map((channel) => (
              <button
                key={channel.id}
                onClick={() => setSelected(channel.id)}
                className="panel group p-5 text-left transition hover:-translate-y-0.5 hover:bg-white/[.025]"
              >
                <div className="flex items-center gap-4">
                  <ChannelAvatar src={channel.thumbnailUrl} name={channel.name} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-[#EEF1F6]">{channel.name}</div>
                    <div className="mt-1 text-xs text-[#727D90]">{formatNumber(channel.subscribers)} abonnés</div>
                  </div>
                  <Heart size={17} fill="currentColor" style={{ color: 'var(--accent)' }} />
                </div>
                <div className="mt-5 flex items-end justify-between gap-3 border-t pt-4" style={{ borderColor: 'var(--glass-border)' }}>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-[#687386]">Dernière vidéo</div>
                    <div className="mt-1 text-xs font-semibold text-[#B6BECC]">{channel.lastVideo}</div>
                  </div>
                  <ScoreBadge score={channel.score} compact />
                </div>
              </button>
            ))}
          </div>
        )}
        <ChannelDrawer channelId={selected} onClose={() => setSelected(null)} onChanged={load} />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[.16em] text-[#687386]">Bibliothèque</p>
        <h1 className="page-title">Mes chaînes</h1>
        <p className="mt-1 text-sm text-[#7F899B]">{channels.length} chaînes dans cette vue{query ? ` pour « ${query} »` : ''}.</p>
      </div>

      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4" style={{ borderColor: 'var(--glass-border)' }}>
          <div className="flex items-center gap-1.5">
            {filters.map(([key, label]) => {
              const active = status === key
              return (
                <button
                  key={key}
                  onClick={() => setStatus(key)}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${active ? 'text-white' : 'border-transparent text-[#7F899B] hover:bg-white/[.035] hover:text-[#D9DEE7]'}`}
                  style={active ? {
                    borderColor: 'color-mix(in srgb, var(--accent) 22%, transparent)',
                    background: 'color-mix(in srgb, var(--accent) 10%, var(--soft-bg))',
                  } : undefined}
                >
                  {label}
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-2">
            <ThemedSelect
              value={sortValue}
              options={sortSelectOptions}
              onChange={applySort}
              className="h-10 min-w-[205px] text-sm"
              ariaLabel="Trier les chaînes"
            />
            <button className={`icon-btn ${compact ? 'text-white' : ''}`} onClick={() => setCompact((value) => !value)} title="Vue compacte">
              <Rows3 size={16} />
            </button>
          </div>
        </div>

        <div
          className="flex min-h-[50px] items-center justify-between gap-3 border-b px-5 py-2.5"
          style={{
            borderColor: 'var(--glass-border)',
            background: 'color-mix(in srgb, var(--glass-bg) 72%, var(--soft-bg))',
          }}
        >
          <div className="flex items-center gap-3">
            <button className="text-xs font-semibold text-[#AEB7C6] transition hover:text-white" onClick={toggleVisiblePage}>
              {allVisibleSelected ? 'Désélectionner toutes' : 'Sélectionner toutes'}
            </button>
            {selectedIds.size > 0 && (
              <>
                <span className="h-4 w-px" style={{ background: 'var(--glass-border)' }} />
                <span className="text-xs font-semibold text-[#E4E8EF]">{selectedIds.size} sélectionnée{selectedIds.size > 1 ? 's' : ''}</span>
              </>
            )}
          </div>
          {selectedIds.size > 0 && (
            <button
              className="btn border-[#71313C] bg-[#28151A] text-[#FF879A] hover:bg-[#351920]"
              disabled={bulkBusy}
              onClick={() => setConfirmUnsubscribeOpen(true)}
            >
              <Trash2 size={15} />
              {bulkBusy ? 'Désabonnement...' : `Se désabonner (${selectedIds.size})`}
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              {table.getHeaderGroups().map((group) => (
                <tr
                  key={group.id}
                  className="border-b"
                  style={{
                    borderColor: 'var(--glass-border)',
                    background: 'color-mix(in srgb, var(--glass-bg) 84%, var(--soft-bg))',
                  }}
                >
                  {group.headers.map((header) => (
                    <th key={header.id} className={`${header.column.id === 'select' ? 'w-12' : ''} px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[.1em] text-[#697386] first:pl-5 last:pr-5`}>
                      {header.isPlaceholder ? null : (
                        <button className="inline-flex items-center gap-1" onClick={header.column.getToggleSortingHandler()}>
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getCanSort() && <ChevronDown size={12} className={header.column.getIsSorted() ? 'text-[#AEB7C6]' : 'opacity-30'} />}
                        </button>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className={loading ? 'opacity-50' : ''}>
              {renderedRows.map((row) => {
                const selectedRow = selectedIds.has(row.original.id)
                return (
                  <tr
                    key={row.id}
                    onClick={() => setSelected(row.original.id)}
                    className="cursor-pointer border-b transition hover:bg-white/[.025] last:border-0"
                    style={{
                      borderColor: 'var(--glass-border)',
                      background: selectedRow ? 'color-mix(in srgb, var(--accent) 7%, var(--soft-bg))' : undefined,
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className={`${compact ? 'py-2' : 'py-3.5'} px-4 first:pl-5 last:pr-5`}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                )
              })}
              {!loading && channels.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-14 text-center text-xs text-[#6F798C]">Aucune chaîne ne correspond à ce filtre.</td></tr>
              )}
            </tbody>
          </table>
          {hasMoreRows && (
            <div ref={loadMoreRef} className="flex h-12 items-center justify-center border-t text-[10px] text-[#657084]" style={{ borderColor: 'var(--glass-border)' }}>
              Défile pour charger la suite…
            </div>
          )}
        </div>
      </section>

      {bulkMessage && (
        <div className={`fixed bottom-6 right-6 z-[70] flex min-w-[340px] items-center gap-3 rounded-xl border px-4 py-3 shadow-2xl ${bulkMessage.type === 'success' ? 'border-[#285A47] bg-[#11261E] text-[#8BE1B9]' : 'border-[#69313C] bg-[#2A151B] text-[#FF91A4]'}`}>
          {bulkMessage.type === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
          <div className="text-xs font-semibold">{bulkMessage.text}</div>
        </div>
      )}

      <UnsubscribeConfirmModal
        open={confirmUnsubscribeOpen}
        channels={selectedChannels}
        busy={bulkBusy}
        onCancel={() => setConfirmUnsubscribeOpen(false)}
        onConfirm={() => void unsubscribeSelected()}
      />

      <ChannelDrawer channelId={selected} onClose={() => setSelected(null)} onChanged={load} />
    </div>
  )
}
