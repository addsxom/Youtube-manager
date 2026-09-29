import {
  BarChart3,
  Gauge,
  Heart,
  LayoutDashboard,
  ListVideo,
  LogOut,
  MoreHorizontal,
  RefreshCw,
  Settings,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { api } from '../lib'

const items = [
  { to: '/', label: 'Vue générale', icon: LayoutDashboard },
  { to: '/channels', label: 'Mes chaînes', icon: ListVideo },
  { to: '/cleanup', label: 'Nettoyage', icon: Sparkles },
  { to: '/analytics', label: 'Analyse', icon: BarChart3 },
  { to: '/favorites', label: 'Favoris', icon: Heart },
  { to: '/settings', label: 'Paramètres', icon: Settings },
]

type AccountInfo = {
  connected: boolean
  name?: string | null
  avatarUrl?: string | null
}

type QuotaInfo = {
  date: string
  used: number
  limit: number
  remaining: number
  percentUsed: number
  estimated: boolean
  resetTimezone: string
  note: string
  breakdown: Array<{ operation: string; label: string; calls: number; units: number }>
}

export default function Sidebar() {
  const [account, setAccount] = useState<AccountInfo | null>(null)
  const [avatarFailed, setAvatarFailed] = useState(false)
  const [quota, setQuota] = useState<QuotaInfo | null>(null)
  const [quotaOpen, setQuotaOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [accountBusy, setAccountBusy] = useState(false)

  const loadAccount = () => {
    void api<AccountInfo>('/api/account').then((value) => {
      setAccount(value)
      setAvatarFailed(false)
    }).catch(() => setAccount({ connected: false }))
  }

  const loadQuota = () => {
    void api<QuotaInfo>('/api/quota').then(setQuota).catch(() => setQuota(null))
  }

  useEffect(() => {
    loadAccount()
    loadQuota()
    const load = () => {
      loadAccount()
      loadQuota()
    }
    window.addEventListener('ytm:refresh', load)
    return () => window.removeEventListener('ytm:refresh', load)
  }, [])

  useEffect(() => {
    if (!menuOpen && !quotaOpen) return

    const closeIfOutside = (event: MouseEvent) => {
      const target = event.target as Element | null

      if (quotaOpen && !target?.closest('[data-quota-control="true"]')) {
        setQuotaOpen(false)
      }

      if (menuOpen && !target?.closest('[data-account-control="true"]')) {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', closeIfOutside)
    document.addEventListener('contextmenu', closeIfOutside)
    return () => {
      document.removeEventListener('mousedown', closeIfOutside)
      document.removeEventListener('contextmenu', closeIfOutside)
    }
  }, [menuOpen, quotaOpen])

  const connected = Boolean(account?.connected)

  const changeAccount = async () => {
    setAccountBusy(true)
    try {
      const value = await api<AccountInfo & { ok: boolean }>('/api/auth/switch', { method: 'POST' })
      setAccount(value)
      setAvatarFailed(false)
      setMenuOpen(false)
      window.dispatchEvent(new Event('ytm:refresh'))
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Impossible de changer de compte.')
    } finally {
      setAccountBusy(false)
    }
  }

  const logout = async () => {
    if (!window.confirm('Se déconnecter du compte YouTube actuel ?')) return
    setAccountBusy(true)
    try {
      await api('/api/auth/logout', { method: 'POST' })
      setAccount({ connected: false })
      setAvatarFailed(false)
      setMenuOpen(false)
      window.dispatchEvent(new Event('ytm:refresh'))
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Impossible de se déconnecter.')
    } finally {
      setAccountBusy(false)
    }
  }

  const openQuota = () => {
    loadQuota()
    setMenuOpen(false)
    setQuotaOpen((value) => !value)
  }

  return (
    <aside className="liquid-glass fixed bottom-3 left-3 top-3 z-30 flex w-[194px] flex-col rounded-[26px] px-3 py-4">
      <div className="mb-6 px-1">
        <div className="relative overflow-hidden rounded-[20px] border border-white/[.075] bg-white/[.035] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,.035)]">
          <div className="pointer-events-none absolute -right-5 -top-8 h-20 w-20 rounded-full bg-[#716AFF]/10 blur-2xl" />
          <div className="relative flex items-center gap-3">
            <div className="relative shrink-0">
              {connected && account?.avatarUrl && !avatarFailed ? (
                <img
                  src={account.avatarUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarFailed(true)}
                  className="h-10 w-10 rounded-full border border-white/10 object-cover shadow-[0_8px_22px_rgba(0,0,0,.28)]"
                />
              ) : (
                <div className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[.055] text-[#919BAC]">
                  <UserRound size={19} />
                </div>
              )}
              <span
                className={`absolute bottom-0 right-0 h-3 w-3 animate-pulse rounded-full border-2 border-[#11141A] ${
                  connected
                    ? 'bg-[#55D89F] shadow-[0_0_12px_rgba(85,216,159,.9)]'
                    : 'bg-[#FF5F74] shadow-[0_0_12px_rgba(255,95,116,.8)]'
                }`}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-bold text-[#F1F4F8]">
                {connected ? (account?.name || 'Compte YouTube') : 'Compte YouTube'}
              </div>
              <div className={`mt-0.5 text-[10px] font-semibold ${connected ? 'text-[#75C9A3]' : 'text-[#CF7B8C]'}`}>
                {connected ? 'Connecté' : 'Non connecté'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <nav className="space-y-1">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `nav-tab group relative flex h-10 items-center gap-3 overflow-hidden rounded-xl px-3 text-[12px] font-semibold ${
                isActive
                  ? 'border border-white/[.075] bg-white/[.065] text-white shadow-[0_8px_24px_rgba(0,0,0,.16),inset_0_1px_0_rgba(255,255,255,.035)]'
                  : 'border border-transparent text-[#858FA1] hover:border-white/[.045] hover:bg-white/[.035] hover:text-[#E4E8EF]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <span className="nav-active-indicator absolute bottom-2 left-0 top-2 w-[2px] rounded-full bg-[#FF5868] shadow-[0_0_10px_rgba(255,88,104,.72)]" />}
                <Icon
                  size={16}
                  className={`transform-gpu transition-all duration-200 ease-out group-hover:-translate-y-0.5 group-hover:scale-110 group-active:scale-90 group-active:rotate-[-7deg] ${
                    isActive
                      ? 'text-[#FF6673] group-hover:drop-shadow-[0_0_7px_rgba(255,102,115,.45)]'
                      : 'text-[#657084] group-hover:text-[#9AA5B7]'
                  }`}
                />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="relative mt-auto px-1">
        {quotaOpen && (
          <div data-quota-control="true" className="glass-menu menu-pop absolute bottom-12 left-0 z-50 w-[320px] rounded-[22px] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-bold text-[#F0F3F7]"><Gauge size={15} className="text-[#909CFF]" /> Quota API YouTube</div>
                <div className="mt-1 text-[10px] text-[#6F798C]">Estimation locale pour aujourd'hui</div>
              </div>
              <button className="grid h-7 w-7 place-items-center rounded-lg text-[#657085] transition hover:bg-white/[.05] hover:text-white" onClick={() => setQuotaOpen(false)}><X size={14} /></button>
            </div>

            {quota ? (
              <>
                <div className="mt-4 flex items-end justify-between">
                  <div><span className="text-2xl font-extrabold text-white">{quota.used.toLocaleString('fr-CH')}</span><span className="ml-1 text-xs text-[#707B8E]">/ {quota.limit.toLocaleString('fr-CH')}</span></div>
                  <div className="text-[10px] font-semibold text-[#98A3B4]">{quota.remaining.toLocaleString('fr-CH')} restantes</div>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[.06]">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#7776FF] to-[#FF6472] transition-all" style={{ width: `${Math.min(100, quota.percentUsed)}%` }} />
                </div>
                <div className="mt-1.5 text-right text-[9px] text-[#626D80]">{quota.percentUsed}% utilisé</div>

                <div className="mt-4 border-t border-white/[.06] pt-3">
                  <div className="mb-2 text-[9px] font-bold uppercase tracking-[.12em] text-[#667185]">Détail aujourd'hui</div>
                  {quota.breakdown.length ? (
                    <div className="space-y-1.5">
                      {quota.breakdown.map((item) => (
                        <div key={item.operation} className="flex items-center justify-between gap-3 text-[10px]">
                          <span className="truncate text-[#909AAB]">{item.label} <span className="text-[#566173]">×{item.calls}</span></span>
                          <span className="shrink-0 font-semibold tabular-nums text-[#CBD2DC]">{item.units} u.</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[10px] text-[#667185]">Aucune requête comptabilisée aujourd'hui.</div>
                  )}
                </div>

                <div className="glass-soft mt-3 rounded-xl px-3 py-2 text-[9px] leading-4 text-[#697386]">
                  Réinitialisation à minuit, heure du Pacifique. Cette valeur est une estimation de YTB Manager ; le quota réel reste géré dans Google Cloud.
                </div>
              </>
            ) : (
              <div className="mt-4 text-xs text-[#727D90]">Chargement du quota...</div>
            )}
          </div>
        )}

        {menuOpen && (
          <div data-account-control="true" className="glass-menu menu-pop absolute bottom-12 right-0 z-50 w-[200px] overflow-hidden rounded-2xl p-1.5">
            <button
              disabled={accountBusy}
              onClick={() => void changeAccount()}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[11px] font-semibold text-[#C8D0DC] transition hover:bg-white/[.05] hover:text-white disabled:opacity-50"
            >
              <RefreshCw size={14} /> {connected ? 'Changer de compte' : 'Se connecter'}
            </button>
            <button
              disabled={!connected || accountBusy}
              onClick={() => void logout()}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[11px] font-semibold text-[#FF899A] transition hover:bg-[#30171D]/70 disabled:opacity-35"
            >
              <LogOut size={14} /> Se déconnecter
            </button>
          </div>
        )}

        <div className="glass-soft flex items-center justify-between rounded-xl px-2.5 py-2">
          <button
            data-quota-control="true"
            onClick={openQuota}
            className="inline-flex items-center gap-2 text-[10px] font-semibold text-[#838DA0] transition hover:text-[#E2E6ED]"
          >
            <Gauge size={13} /> Quota API
          </button>
          <button
            data-account-control="true"
            onClick={() => { setQuotaOpen(false); setMenuOpen((value) => !value) }}
            className="grid h-7 w-7 place-items-center rounded-lg text-[#748093] transition hover:bg-white/[.055] hover:text-white"
            aria-label="Menu du compte"
            title="Compte"
          >
            <MoreHorizontal size={16} />
          </button>
        </div>
      </div>
    </aside>
  )
}
