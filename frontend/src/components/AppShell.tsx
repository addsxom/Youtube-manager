import { ReactNode, useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, RefreshCw, Search, ShieldAlert, X, Youtube } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import SyncOverview from './SyncOverview'
import { api } from '../lib'
import { getNotificationSound, playNotificationSound, unlockNotificationAudio } from '../notificationSound'
import { getStartupAutoSyncEnabled, getStartupCheckEnabled } from '../startupPreferences'
import '../workspace.css'

type SystemSettings = {
  authenticated: boolean
  clientSecretPresent: boolean
}

type SyncStatus = {
  running: boolean
  stage: 'idle' | 'auth' | 'subscriptions' | 'details' | 'videos' | 'saving' | 'done' | 'error'
  current: number
  total: number
  channel?: string | null
  error?: string | null
}

type SyncChanges = {
  created: number
  removed: number
  becameActive: number
  becameInactive: number
  subscriberDelta: number
  newVideos: number
}

type SyncResult = {
  total: number
  changes?: SyncChanges
}

type SyncCheckResult = {
  needsSync: boolean
  added: number
  removed: number
  channelsWithVideoChanges: number
  remoteTotal: number
}

type AutoSyncToast = {
  id: number
  type: 'loading' | 'success' | 'error'
  text: string
  visible: boolean
}

function syncStageLabel(status: SyncStatus | null) {
  if (!status) return 'Analyse...'
  if (status.stage === 'auth') return 'Connexion...'
  if (status.stage === 'subscriptions') return 'Abonnements...'
  if (status.stage === 'details') return 'Détails...'
  if (status.stage === 'videos') return 'Vidéos...'
  if (status.stage === 'saving') return 'Enregistrement...'
  return 'Analyse...'
}

function syncSummary(result: SyncResult) {
  const changes = result.changes
  if (!changes) return `${result.total} chaînes synchronisées`

  const details: string[] = []
  if (changes.created) details.push(`+${changes.created} nouvelle${changes.created > 1 ? 's' : ''}`)
  if (changes.removed) details.push(`${changes.removed} retirée${changes.removed > 1 ? 's' : ''}`)
  if (changes.becameActive) details.push(`${changes.becameActive} devenue${changes.becameActive > 1 ? 's' : ''} active${changes.becameActive > 1 ? 's' : ''}`)
  if (changes.becameInactive) details.push(`${changes.becameInactive} devenue${changes.becameInactive > 1 ? 's' : ''} inactive${changes.becameInactive > 1 ? 's' : ''}`)
  if (changes.newVideos) details.push(`${changes.newVideos} nouvelle${changes.newVideos > 1 ? 's' : ''} vidéo${changes.newVideos > 1 ? 's' : ''}`)

  return details.length
    ? `${result.total} synchronisées · ${details.join(' · ')}`
    : `${result.total} chaînes synchronisées · aucun changement notable`
}

export default function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const searchVisible = location.pathname === '/channels' || location.pathname === '/favorites'
  const autoSyncStarted = useRef(false)
  const nextAutoToastId = useRef(0)
  const autoToastTimers = useRef<Map<number, number[]>>(new Map())
  const [query, setQuery] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [system, setSystem] = useState<SystemSettings | null>(null)
  const [checkingSystem, setCheckingSystem] = useState(true)
  const [authBusy, setAuthBusy] = useState(false)
  const [authMessage, setAuthMessage] = useState<string | null>(null)
  const [autoSyncToasts, setAutoSyncToasts] = useState<AutoSyncToast[]>([])

  const rememberAutoToastTimer = (id: number, timer: number) => {
    const timers = autoToastTimers.current.get(id) || []
    timers.push(timer)
    autoToastTimers.current.set(id, timers)
  }

  const dismissAutoToast = (id: number, delay = 0) => {
    const beginDismiss = () => {
      setAutoSyncToasts((previous) => previous.map((toast) => (
        toast.id === id ? { ...toast, visible: false } : toast
      )))

      const removeTimer = window.setTimeout(() => {
        setAutoSyncToasts((previous) => previous.filter((toast) => toast.id !== id))
        autoToastTimers.current.delete(id)
      }, 320)
      rememberAutoToastTimer(id, removeTimer)
    }

    if (delay > 0) {
      const timer = window.setTimeout(beginDismiss, delay)
      rememberAutoToastTimer(id, timer)
    } else {
      beginDismiss()
    }
  }

  const showAutoToast = (
    toast: Omit<AutoSyncToast, 'id' | 'visible'>,
    dismissAfter?: number,
  ) => {
    const id = ++nextAutoToastId.current
    setAutoSyncToasts((previous) => [...previous, { ...toast, id, visible: false }])

    const showTimer = window.setTimeout(() => {
      setAutoSyncToasts((previous) => previous.map((item) => (
        item.id === id ? { ...item, visible: true } : item
      )))
    }, 30)
    rememberAutoToastTimer(id, showTimer)

    if (dismissAfter) {
      const dismissTimer = window.setTimeout(() => dismissAutoToast(id), dismissAfter)
      rememberAutoToastTimer(id, dismissTimer)
    }

    return id
  }

  const clearAutoToastTimers = () => {
    for (const timers of autoToastTimers.current.values()) {
      for (const timer of timers) window.clearTimeout(timer)
    }
    autoToastTimers.current.clear()
  }

  const checkSystem = async () => {
    setCheckingSystem(true)
    try {
      const value = await api<SystemSettings>('/api/settings')
      setSystem(value)
      return value
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : 'Impossible de joindre le backend local.')
      return null
    } finally {
      setCheckingSystem(false)
    }
  }

  useEffect(() => { void checkSystem() }, [])

  useEffect(() => {
    return () => clearAutoToastTimers()
  }, [])

  useEffect(() => {
    const refresh = () => { void checkSystem() }
    window.addEventListener('ytm:refresh', refresh)
    return () => window.removeEventListener('ytm:refresh', refresh)
  }, [])

  useEffect(() => {
    if (!searchVisible) return
    const params = new URLSearchParams(location.search)
    setQuery(params.get('q') || '')
  }, [location.pathname, location.search, searchVisible])

  useEffect(() => {
    if (!searchVisible || !system?.authenticated) return

    const timer = window.setTimeout(() => {
      const value = query.trim()
      const current = new URLSearchParams(location.search).get('q') || ''
      if (value === current) return

      const target = location.pathname === '/favorites' ? '/favorites' : '/channels'
      navigate(value ? `${target}?q=${encodeURIComponent(value)}` : target, { replace: true })
    }, 180)

    return () => window.clearTimeout(timer)
  }, [query, searchVisible, location.pathname, location.search, navigate, system?.authenticated])

  useEffect(() => {
    if (!syncing) {
      setSyncStatus(null)
      return
    }

    let active = true
    const poll = async () => {
      try {
        const status = await api<SyncStatus>('/api/sync/status')
        if (active) setSyncStatus(status)
      } catch {
        // La synchronisation principale affichera l'erreur si nécessaire.
      }
    }

    void poll()
    const timer = window.setInterval(() => { void poll() }, 450)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [syncing])

  const connect = async () => {
    if (!system?.clientSecretPresent) return
    setAuthBusy(true)
    setAuthMessage(null)
    try {
      await api('/api/auth/switch', { method: 'POST' })
      const next = await checkSystem()
      if (next?.authenticated) window.dispatchEvent(new Event('ytm:refresh'))
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : 'Connexion Google impossible.')
    } finally {
      setAuthBusy(false)
    }
  }

  const sync = async (automatic = false) => {
    if (!system?.authenticated || syncing) return

    const loadingToastId = automatic
      ? showAutoToast({ type: 'loading', text: 'Changements détectés · synchronisation automatique...' })
      : null

    if (!automatic) {
      await unlockNotificationAudio()
    }

    setSyncing(true)
    setSyncStatus(null)
    setMessage(null)
    try {
      const result = await api<SyncResult>('/api/sync', { method: 'POST' })
      window.dispatchEvent(new Event('ytm:refresh'))

      if (automatic) {
        showAutoToast({
          type: 'success',
          text: `Synchronisation automatique terminée · ${result.total} chaîne${result.total > 1 ? 's' : ''}`,
        }, 4200)
        if (loadingToastId) dismissAutoToast(loadingToastId, 160)
      } else {
        setMessage(syncSummary(result))
        await playNotificationSound(getNotificationSound())
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Échec de la synchronisation'
      if (automatic) {
        showAutoToast({ type: 'error', text: 'Synchronisation automatique impossible' }, 5200)
        if (loadingToastId) dismissAutoToast(loadingToastId, 160)
      } else {
        setMessage(text)
      }
    } finally {
      setSyncing(false)
      if (!automatic) window.setTimeout(() => setMessage(null), 6500)
    }
  }

  useEffect(() => {
    if (!system?.authenticated || !system.clientSecretPresent || autoSyncStarted.current) return
    autoSyncStarted.current = true

    if (!getStartupCheckEnabled()) return

    let cancelled = false
    const timer = window.setTimeout(async () => {
      try {
        const check = await api<SyncCheckResult>('/api/sync/check')
        if (cancelled) return

        if (check.needsSync && getStartupAutoSyncEnabled()) {
          await sync(true)
        }
      } catch {
        if (!cancelled) {
          showAutoToast({ type: 'error', text: 'Vérification automatique impossible' }, 4200)
        }
      }
    }, 450)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [system?.authenticated, system?.clientSecretPresent])

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault()
    const value = query.trim()
    const target = location.pathname === '/favorites' ? '/favorites' : '/channels'
    navigate(value ? `${target}?q=${encodeURIComponent(value)}` : target, { replace: true })
  }

  const clearSearch = () => {
    setQuery('')
    const target = location.pathname === '/favorites' ? '/favorites' : '/channels'
    navigate(target, { replace: true })
  }

  const progressText = syncing && syncStatus?.total
    ? `${syncStageLabel(syncStatus)} ${Math.min(syncStatus.current, syncStatus.total)}/${syncStatus.total}`
    : syncing
      ? syncStageLabel(syncStatus)
      : 'Synchroniser'

  const actions = (
    <div className="flex items-center gap-2.5">
      <SyncOverview />
      <button className="btn btn-primary min-w-[154px] !py-2" onClick={() => void sync()} disabled={syncing} title={syncStatus?.channel || undefined}>
        <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
        {progressText}
      </button>
    </div>
  )

  if (checkingSystem && !system) {
    return (
      <div className="relative grid min-h-screen place-items-center overflow-hidden bg-[#07080C]">
        <div className="absolute left-[18%] top-[18%] h-52 w-52 rounded-full bg-[#6C63FF]/10 blur-[90px]" />
        <div className="absolute bottom-[15%] right-[18%] h-48 w-48 rounded-full bg-[#FF4655]/10 blur-[90px]" />
        <div className="liquid-glass flex items-center gap-3 rounded-2xl px-5 py-4 text-sm font-semibold text-[#A6AFBE]">
          <RefreshCw size={17} className="animate-spin text-[#FF6371]" /> Vérification de la session YouTube...
        </div>
      </div>
    )
  }

  if (!system?.clientSecretPresent || !system?.authenticated) {
    const secretMissing = system?.clientSecretPresent === false

    return (
      <div className="relative grid min-h-screen place-items-center overflow-hidden bg-[#07080C] px-4">
        <div className="absolute left-[18%] top-[10%] h-72 w-72 rounded-full bg-[#7067FF]/12 blur-[110px]" />
        <div className="absolute bottom-[8%] right-[15%] h-72 w-72 rounded-full bg-[#FF4655]/10 blur-[110px]" />
        <div className="liquid-glass relative w-full max-w-[490px] overflow-hidden rounded-[30px] p-8">
          <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-[22px] border border-white/10 bg-white/[.045] shadow-[0_14px_40px_rgba(0,0,0,.24)]">
            {secretMissing ? <ShieldAlert size={27} className="text-[#F1BE61]" /> : <Youtube size={30} className="text-[#FF5C6A]" />}
          </div>

          <div className="mt-6 text-center">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[.2em] text-[#6D7789]">YTB Manager</p>
            <h1 className="text-[22px] font-extrabold tracking-[-.03em] text-white">
              {secretMissing ? 'Configuration OAuth requise' : 'Connexion YouTube requise'}
            </h1>
            <p className="mx-auto mt-2 max-w-[390px] text-xs leading-5 text-[#8993A5]">
              {secretMissing
                ? 'YTB Manager ne peut pas fonctionner sans client_secret.json. Ajoute ce fichier à la racine du projet avant de continuer.'
                : 'Connecte ton compte YouTube pour accéder au dashboard, à tes chaînes, aux favoris, au nettoyage et aux statistiques.'}
            </p>
          </div>

          {secretMissing && (
            <div className="glass-soft mt-5 rounded-xl px-4 py-3 text-center font-mono text-[11px] text-[#C8D0DC]">
              Youtube-manager/client_secret.json
            </div>
          )}

          {authMessage && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#5B2C36]/80 bg-[#24151A]/80 px-3.5 py-3 text-[11px] leading-4 text-[#F39AAF] backdrop-blur-xl">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{authMessage}</span>
            </div>
          )}

          <div className="mt-6">
            {secretMissing ? (
              <button className="btn btn-primary w-full !py-2.5" disabled={checkingSystem} onClick={() => void checkSystem()}>
                <RefreshCw size={15} className={checkingSystem ? 'animate-spin' : ''} />
                {checkingSystem ? 'Vérification...' : 'Vérifier à nouveau'}
              </button>
            ) : (
              <button className="btn btn-primary w-full !py-2.5" disabled={authBusy} onClick={() => void connect()}>
                <Youtube size={16} />
                {authBusy ? 'Connexion en cours...' : 'Se connecter avec Google'}
              </button>
            )}
          </div>

          <p className="mt-4 text-center text-[10px] leading-4 text-[#606B7D]">
            Tant que la session YouTube n'est pas connectée, aucune donnée du manager n'est affichée.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none fixed left-[42%] top-[-120px] z-0 h-[320px] w-[520px] rounded-full bg-[#716AFF]/[.06] blur-[110px]" />
      <div className="pointer-events-none fixed bottom-[-160px] right-[-80px] z-0 h-[420px] w-[420px] rounded-full bg-[#FF4655]/[.045] blur-[120px]" />

      {autoSyncToasts.length > 0 && (
        <div className="pointer-events-none fixed bottom-6 right-6 z-[140] flex w-[min(380px,calc(100vw-3rem))] flex-col gap-2.5">
          {autoSyncToasts.map((toast) => (
            <div
              key={toast.id}
              className={`pointer-events-auto flex w-full items-center gap-2.5 rounded-xl border px-3.5 py-3 shadow-[0_16px_44px_rgba(0,0,0,.38)] transition-all duration-300 ease-out ${
                toast.visible
                  ? 'translate-y-0 scale-100 opacity-100'
                  : 'translate-y-3 scale-[.98] opacity-0'
              } ${
                toast.type === 'success'
                  ? 'border-[#2B6A50] bg-[#10271E] text-[#9BE6C2]'
                  : toast.type === 'error'
                    ? 'border-[#6C3440] bg-[#2B171C] text-[#FF9AAD]'
                    : 'border-white/[.09] bg-[#141923] text-[#DDE3EC]'
              }`}
              role="status"
              aria-live="polite"
            >
              {toast.type === 'success' ? (
                <CheckCircle2 size={17} className="shrink-0" />
              ) : toast.type === 'error' ? (
                <AlertTriangle size={17} className="shrink-0" />
              ) : (
                <RefreshCw size={17} className="shrink-0 animate-spin text-[color:var(--accent)]" />
              )}
              <span className="min-w-0 flex-1 truncate text-[11px] font-semibold leading-4">{toast.text}</span>
            </div>
          ))}
        </div>
      )}

      <Sidebar />
      <main className="relative z-10 ml-[218px] min-h-screen">
        {searchVisible ? (
          <header className="glass-header sticky top-3 z-20 mx-5 flex h-[58px] items-center justify-between rounded-2xl px-5">
            <form onSubmit={submitSearch} className="group/search relative w-[min(520px,43vw)]">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 transition duration-200 group-focus-within/search:scale-105"
                size={17}
                strokeWidth={2.25}
                style={{
                  color: 'var(--accent)',
                  filter: 'drop-shadow(0 0 6px color-mix(in srgb, var(--accent) 34%, transparent))',
                }}
              />
              <span
                className="pointer-events-none absolute left-[36px] top-1/2 h-4 w-px -translate-y-1/2 opacity-35 transition-opacity duration-200 group-focus-within/search:opacity-70"
                style={{ background: 'var(--accent)' }}
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="field h-9 w-full !rounded-xl !border-white/[.07] !bg-black/20 pl-12 pr-11 outline-none transition-[border-color] duration-200 focus:!border-white/[.12] focus:!shadow-none focus-visible:!outline-none focus-visible:!ring-0"
                placeholder={location.pathname === '/favorites' ? 'Rechercher dans tes favoris...' : 'Rechercher dans mes chaînes...'}
                aria-label="Rechercher une chaîne"
              />
              {query && (
                <button
                  type="button"
                  onClick={clearSearch}
                  onMouseDown={(event) => event.preventDefault()}
                  className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg opacity-65 transition-all duration-200 hover:scale-105 hover:bg-white/[.05] hover:opacity-100 focus-visible:outline-none focus-visible:ring-0"
                  style={{
                    color: 'var(--accent)',
                    filter: 'drop-shadow(0 0 5px color-mix(in srgb, var(--accent) 28%, transparent))',
                  }}
                  aria-label="Effacer la recherche"
                  title="Effacer la recherche"
                >
                  <X size={15} strokeWidth={2.25} />
                </button>
              )}
            </form>
            {actions}
          </header>
        ) : (
          <div className="absolute right-5 top-3 z-30">
            {actions}
          </div>
        )}

        <div
          key={location.pathname}
          className={`page-transition ${searchVisible ? 'px-7 pb-10 pt-5' : 'workspace-expanded px-6 pb-4 pt-5'}`}
        >
          {children}
        </div>
      </main>
    </div>
  )
}
