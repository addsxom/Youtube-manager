import {
  Check,
  CheckCircle2,
  Database,
  Download,
  KeyRound,
  Palette,
  Play,
  RefreshCcw,
  Server,
  SlidersHorizontal,
  Volume2,
  XCircle,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import ThemedSelect from '../components/ThemedSelect'
import { api } from '../lib'
import {
  appStyleOptions,
  AppStyle,
  getAppStyle,
  setAppStyle as saveAppStyle,
} from '../appStyle'
import {
  getNotificationSound,
  getNotificationVolume,
  notificationSoundOptions,
  NotificationSound,
  playNotificationSound,
  setNotificationSound as saveNotificationSound,
  setNotificationVolume as saveNotificationVolume,
  unlockNotificationAudio,
} from '../notificationSound'
import {
  getStartupAutoSyncEnabled,
  getStartupCheckEnabled,
  resetStartupPreferences,
  setStartupAutoSyncEnabled,
  setStartupCheckEnabled,
} from '../startupPreferences'
import { Channel } from '../types'

type SettingsData = {
  authenticated: boolean
  clientSecretPresent: boolean
  database: string
  apiBase: string
}

const cleanupThresholdOptions = [
  { value: '30', label: '30 % — strict' },
  { value: '40', label: '40 % — recommandé' },
  { value: '50', label: '50 % — large' },
  { value: '60', label: '60 % — très large' },
] as const

function Status({ ok }: { ok: boolean }) {
  return ok ? <CheckCircle2 size={15} className="text-[#62D9A7]" /> : <XCircle size={15} className="text-[#FF7B91]" />
}

function PreferenceSwitch({
  checked,
  onChange,
  disabled = false,
  ariaLabel,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
  ariaLabel: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full border transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-35 ${
        checked
          ? 'border-transparent'
          : 'border-white/[.09] bg-white/[.045]'
      }`}
      style={checked ? { background: 'var(--accent)' } : undefined}
    >
      <span
        className={`absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-white shadow-sm transition-all duration-200 ${
          checked ? 'left-[18px]' : 'left-[3px]'
        }`}
      />
    </button>
  )
}

function escapeHtml(value: string | number | boolean | null | undefined) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export default function Settings() {
  const [data, setData] = useState<SettingsData | null>(null)
  const [appStyle, setAppStyle] = useState<AppStyle>(() => getAppStyle())
  const [cleanupThreshold, setCleanupThreshold] = useState(() => Number(localStorage.getItem('ytm.cleanupThreshold')) || 40)
  const [notificationSound, setNotificationSound] = useState<NotificationSound>(() => getNotificationSound())
  const [notificationVolume, setNotificationVolume] = useState(() => getNotificationVolume())
  const [startupCheck, setStartupCheck] = useState(() => getStartupCheckEnabled())
  const [startupAutoSync, setStartupAutoSync] = useState(() => getStartupAutoSyncEnabled())
  const [message, setMessage] = useState('')

  useEffect(() => { api<SettingsData>('/api/settings').then(setData) }, [])
  useEffect(() => { saveAppStyle(appStyle) }, [appStyle])
  useEffect(() => { localStorage.setItem('ytm.cleanupThreshold', String(cleanupThreshold)) }, [cleanupThreshold])
  useEffect(() => { saveNotificationSound(notificationSound) }, [notificationSound])
  useEffect(() => { saveNotificationVolume(notificationVolume) }, [notificationVolume])
  useEffect(() => { setStartupCheckEnabled(startupCheck) }, [startupCheck])
  useEffect(() => { setStartupAutoSyncEnabled(startupAutoSync) }, [startupAutoSync])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  const testNotification = async () => {
    await unlockNotificationAudio()
    await playNotificationSound(notificationSound, notificationVolume)
  }

  const exportHtml = async () => {
    const result = await api<{ items: Channel[] }>('/api/channels?status=all')
    const channels = [...result.items].sort((a, b) => (
      b.score - a.score || b.subscribers - a.subscribers || a.name.localeCompare(b.name, 'fr')
    ))
    const total = channels.length
    const active = channels.filter((channel) => channel.score >= 70).length
    const watch = channels.filter((channel) => channel.score >= 40 && channel.score < 70).length
    const inactive = channels.filter((channel) => channel.score < 40).length
    const favorites = channels.filter((channel) => channel.favorite).length
    const generatedAt = new Intl.DateTimeFormat('fr-CH', { dateStyle: 'long', timeStyle: 'short' }).format(new Date())
    const number = new Intl.NumberFormat('fr-CH')

    const rows = channels.map((channel) => {
      const state = channel.score >= 70 ? 'Active' : channel.score >= 40 ? 'À surveiller' : 'Inactive'
      const stateClass = channel.score >= 70 ? 'active' : channel.score >= 40 ? 'watch' : 'inactive'
      const avatarUrl = channel.thumbnailUrl ? escapeHtml(channel.thumbnailUrl) : ''
      const initial = escapeHtml(channel.name.trim().charAt(0).toUpperCase() || '?')
      const avatar = avatarUrl
        ? `<div class="avatar"><img src="${avatarUrl}" alt="" referrerpolicy="no-referrer" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'" /><span style="display:none">${initial}</span></div>`
        : `<div class="avatar"><span>${initial}</span></div>`
      return `
        <tr>
          <td>
            <div class="channel-cell">
              ${avatar}
              <div class="channel-copy">
                <div class="channel-name">${escapeHtml(channel.name)}</div>
                ${channel.favorite ? '<span class="mini favorite">★ Favori</span>' : ''}
              </div>
            </div>
          </td>
          <td class="number">${escapeHtml(number.format(channel.subscribers))}</td>
          <td class="number">${escapeHtml(number.format(channel.videos))}</td>
          <td>${escapeHtml(channel.lastVideo)}</td>
          <td><span class="score ${stateClass}">${escapeHtml(channel.score)}% · ${state}</span></td>
          <td>${channel.ignored ? '<span class="mini muted">Ignorée</span>' : '<span class="mini">Normale</span>'}</td>
          <td class="note">${escapeHtml(channel.note || '—')}</td>
        </tr>`
    }).join('')

    const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Rapport YTB Manager</title>
  <style>
    :root { color-scheme: dark; --bg:#09090b; --panel:#111216; --soft:#18191f; --border:#292b33; --text:#f4f4f5; --muted:#9297a5; --accent:#8b8cff; --green:#55d89f; --yellow:#f2b95d; --red:#ff788d; }
    * { box-sizing:border-box; }
    body { margin:0; background:linear-gradient(180deg,#09090b 0%,#0d0e12 100%); color:var(--text); font:14px/1.45 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    .page { width:min(1500px,calc(100% - 40px)); margin:0 auto; padding:42px 0 56px; }
    .header { display:flex; align-items:flex-end; justify-content:space-between; gap:20px; margin-bottom:22px; }
    .eyebrow { color:var(--accent); font-size:11px; font-weight:800; letter-spacing:.16em; text-transform:uppercase; }
    h1 { margin:6px 0 4px; font-size:30px; letter-spacing:-.04em; }
    .subtitle { color:var(--muted); font-size:12px; }
    .date { color:var(--muted); font-size:12px; text-align:right; }
    .stats { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:10px; margin-bottom:18px; }
    .stat { background:var(--panel); border:1px solid var(--border); border-radius:14px; padding:14px 16px; box-shadow:0 12px 35px rgba(0,0,0,.18); }
    .stat-label { color:var(--muted); font-size:10px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; }
    .stat-value { margin-top:6px; font-size:24px; font-weight:850; letter-spacing:-.03em; }
    .table-wrap { overflow:hidden; border:1px solid var(--border); border-radius:16px; background:var(--panel); box-shadow:0 18px 50px rgba(0,0,0,.22); }
    table { width:100%; border-collapse:collapse; }
    thead { background:#15161b; }
    th { padding:13px 14px; color:#a9adba; font-size:10px; text-align:left; text-transform:uppercase; letter-spacing:.07em; border-bottom:1px solid var(--border); }
    td { padding:12px 14px; border-bottom:1px solid #202229; color:#d8dbe3; vertical-align:middle; }
    tbody tr:last-child td { border-bottom:0; }
    tbody tr:hover { background:#15161b; }
    .channel-cell { display:flex; align-items:center; gap:11px; min-width:220px; }
    .channel-copy { min-width:0; }
    .avatar { width:38px; height:38px; flex:0 0 38px; border-radius:50%; overflow:hidden; border:1px solid #343741; background:#202229; box-shadow:0 5px 14px rgba(0,0,0,.22); }
    .avatar img,.avatar span { width:100%; height:100%; }
    .avatar img { display:block; object-fit:cover; }
    .avatar span { display:grid; place-items:center; color:#c9ced8; font-size:12px; font-weight:800; }
    .channel-name { color:#f7f7f8; font-weight:750; }
    .number { font-variant-numeric:tabular-nums; white-space:nowrap; }
    .score,.mini { display:inline-flex; align-items:center; border:1px solid var(--border); border-radius:999px; padding:4px 8px; font-size:10px; font-weight:750; white-space:nowrap; }
    .score.active { color:var(--green); background:rgba(85,216,159,.08); border-color:rgba(85,216,159,.25); }
    .score.watch { color:var(--yellow); background:rgba(242,185,93,.08); border-color:rgba(242,185,93,.25); }
    .score.inactive { color:var(--red); background:rgba(255,120,141,.08); border-color:rgba(255,120,141,.25); }
    .mini { margin-top:5px; color:#a8adbb; padding:2px 6px; font-size:9px; }
    .mini.favorite { color:#f2b95d; }
    .mini.muted { color:#8b91a0; }
    .note { max-width:280px; color:#a8adbb; white-space:pre-wrap; overflow-wrap:anywhere; }
    .sort-note { margin:0 0 10px; color:#7f8593; font-size:10px; text-align:right; }
    .footer { margin-top:14px; color:#6f7482; font-size:10px; text-align:center; }
    @media (max-width:900px) { .stats { grid-template-columns:repeat(2,minmax(0,1fr)); } .table-wrap { overflow:auto; } table { min-width:1040px; } }
    @media print { body { background:#fff; color:#111; } .page { width:100%; padding:0; } .stat,.table-wrap { box-shadow:none; } }
  </style>
</head>
<body>
  <main class="page">
    <header class="header">
      <div>
        <div class="eyebrow">YTB Manager</div>
        <h1>Rapport des abonnements</h1>
        <div class="subtitle">Vue complète de tes chaînes YouTube au moment de l’export.</div>
      </div>
      <div class="date">Généré le<br><strong>${escapeHtml(generatedAt)}</strong></div>
    </header>

    <section class="stats">
      <div class="stat"><div class="stat-label">Chaînes suivies</div><div class="stat-value">${escapeHtml(total)}</div></div>
      <div class="stat"><div class="stat-label">Actives</div><div class="stat-value">${escapeHtml(active)}</div></div>
      <div class="stat"><div class="stat-label">À surveiller</div><div class="stat-value">${escapeHtml(watch)}</div></div>
      <div class="stat"><div class="stat-label">Inactives</div><div class="stat-value">${escapeHtml(inactive)}</div></div>
      <div class="stat"><div class="stat-label">Favoris</div><div class="stat-value">${escapeHtml(favorites)}</div></div>
    </section>

    <div class="sort-note">Trié automatiquement de la chaîne la plus active à la moins active.</div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Chaîne</th><th>Abonnés</th><th>Vidéos</th><th>Dernière vidéo</th><th>Activité</th><th>Nettoyage</th><th>Note</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="footer">Rapport local généré par YTB Manager · aucune donnée n’est envoyée ailleurs.</div>
  </main>
</body>
</html>`

    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `ytb-manager-${new Date().toISOString().slice(0, 10)}.html`
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setMessage('Rapport HTML créé.')
  }

  const resetPreferences = () => {
    localStorage.removeItem('ytm.pageSize')
    localStorage.removeItem('ytm.cleanupThreshold')
    localStorage.removeItem('ytm.notificationSound')
    localStorage.removeItem('ytm.notificationVolume')
    localStorage.removeItem('ytm.appStyle')
    resetStartupPreferences()
    setAppStyle('linear')
    setCleanupThreshold(40)
    setNotificationSound('soft')
    setNotificationVolume(50)
    setStartupCheck(true)
    setStartupAutoSync(true)
    setMessage('Préférences réinitialisées.')
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-122px)] w-full max-w-[1380px] flex-col overflow-hidden">
      <div className="mb-2 shrink-0">
        <h1 className="page-title">Paramètres</h1>
        <p className="mt-0.5 text-xs text-[#7F899B]">Contrôle l'état du manager, son apparence et tes préférences.</p>
      </div>

      {message && (
        <div className="fixed bottom-5 right-6 z-[80] rounded-xl border border-white/[.08] bg-[#131820]/95 px-4 py-3 text-xs text-[#B6C0CF] shadow-2xl backdrop-blur-xl">
          {message}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-[372px_minmax(0,1fr)] gap-4">
        <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
          <section className="panel clean-panel shrink-0 overflow-hidden">
            <div className="border-b border-white/[.06] px-4 py-3.5">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/[.045]"><Server size={16} className="text-[#8EA0FF]" /></div>
                <div>
                  <h2 className="text-[13px] font-bold">État du système</h2>
                  <p className="mt-0.5 text-[10px] text-[#747F91]">Diagnostic des services nécessaires à YTB Manager.</p>
                </div>
              </div>
            </div>

            <div className="divide-y divide-white/[.055]">
              <div className="flex items-center gap-3 px-4 py-2.5">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[.04]"><Server size={14} className="text-[#8EA0FF]" /></div>
                <div className="min-w-0 flex-1"><div className="text-[11px] font-bold">API locale</div><div className="mt-0.5 truncate text-[9px] text-[#747F91]">{data?.apiBase || 'Chargement...'}</div></div>
                <Status ok={Boolean(data)} />
              </div>
              <div className="flex items-center gap-3 px-4 py-2.5">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[.04]"><KeyRound size={14} className="text-[#F1BE61]" /></div>
                <div className="min-w-0 flex-1"><div className="text-[11px] font-bold">Client OAuth</div><div className="mt-0.5 truncate text-[9px] text-[#747F91]">client_secret.json</div></div>
                <Status ok={Boolean(data?.clientSecretPresent)} />
              </div>
              <div className="flex items-center gap-3 px-4 py-2.5">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[.04]"><KeyRound size={14} className="text-[#65DCAA]" /></div>
                <div className="min-w-0 flex-1"><div className="text-[11px] font-bold">Session YouTube</div><div className="mt-0.5 truncate text-[9px] text-[#747F91]">Compte Google connecté</div></div>
                <Status ok={Boolean(data?.authenticated)} />
              </div>
              <div className="flex items-center gap-3 px-4 py-2.5">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[.04]"><Database size={14} className="text-[#FF7D8B]" /></div>
                <div className="min-w-0 flex-1"><div className="text-[11px] font-bold">Base de données</div><div className="mt-0.5 truncate text-[9px] text-[#747F91]">{data?.database || 'data/youtube_manager.db'}</div></div>
                <Status ok={true} />
              </div>
            </div>
          </section>

          <section className="panel clean-panel flex min-h-0 flex-col overflow-hidden p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/[.045]"><SlidersHorizontal size={16} className="text-[#8EA0FF]" /></div>
              <div>
                <h2 className="text-[13px] font-bold">Préférences</h2>
                <p className="mt-0.5 text-[10px] text-[#747F91]">Nettoyage, notifications et démarrage.</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="block">
                <div className="mb-1.5 flex items-center justify-between text-[10px]"><span className="font-semibold text-[#B8C0CE]">Seuil du nettoyage</span><span className="text-[#697386]">score inférieur à</span></div>
                <ThemedSelect
                  value={String(cleanupThreshold)}
                  options={cleanupThresholdOptions}
                  onChange={(value) => setCleanupThreshold(Number(value))}
                  className="h-9 w-full text-xs"
                  ariaLabel="Seuil du nettoyage"
                />
              </div>

              <div className="rounded-lg border border-white/[.065] bg-black/10 p-3">
                <div className="mb-2 flex items-center gap-2.5">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/[.045]"><Volume2 size={14} className="text-[#8EA0FF]" /></div>
                  <div>
                    <div className="text-[10px] font-semibold text-[#B8C0CE]">Notification de synchronisation</div>
                    <div className="mt-0.5 text-[9px] text-[#697386]">Son joué à la fin de l'analyse.</div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <ThemedSelect
                    value={notificationSound}
                    options={notificationSoundOptions}
                    onChange={(value) => setNotificationSound(value as NotificationSound)}
                    className="h-9 min-w-0 flex-1 text-xs"
                    ariaLabel="Son de fin de synchronisation"
                  />
                  <button className="btn h-9 shrink-0 !px-3 text-xs" disabled={notificationSound === 'off' || notificationVolume === 0} onClick={() => void testNotification()}>
                    <Play size={13} /> Tester
                  </button>
                </div>

                <div className="mt-2.5">
                  <div className="mb-1.5 flex items-center justify-between text-[10px]">
                    <span className="font-semibold text-[#AEB7C6]">Volume</span>
                    <span className="font-bold tabular-nums text-[#D9DEE7]">{notificationVolume}%</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Volume2 size={13} className="shrink-0 text-[#697386]" />
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={notificationVolume}
                      onChange={(e) => setNotificationVolume(Number(e.target.value))}
                      className="h-1.5 w-full cursor-pointer accent-[#6C7CFF]"
                      aria-label="Volume des notifications"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-white/[.065] bg-black/10 p-3">
                <div className="mb-2.5 flex items-center gap-2.5">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/[.045]"><RefreshCcw size={14} className="text-[color:var(--accent)]" /></div>
                  <div>
                    <div className="text-[10px] font-semibold text-[#B8C0CE]">Comportement au démarrage</div>
                    <div className="mt-0.5 text-[9px] text-[#697386]">Contrôle la vérification automatique au lancement.</div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-lg bg-white/[.025] px-2.5 py-2">
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold text-[#B8C0CE]">Vérifier les changements au lancement</div>
                    <div className="mt-0.5 text-[9px] leading-3.5 text-[#697386]">Compare rapidement tes abonnements au démarrage.</div>
                  </div>
                  <PreferenceSwitch
                    checked={startupCheck}
                    onChange={setStartupCheck}
                    ariaLabel="Vérifier les changements au lancement"
                  />
                </div>
              </div>
            </div>

            <div className="mt-auto grid grid-cols-2 gap-2 pt-3">
              <button className="btn h-10 !px-2 text-[11px]" onClick={() => void exportHtml()}><Download size={14} /> Export HTML</button>
              <button className="btn h-10 !px-2 text-[11px]" onClick={resetPreferences}><RefreshCcw size={14} /> Réinitialiser</button>
            </div>
          </section>
        </div>

        <section className="panel clean-panel flex h-full min-h-0 flex-col overflow-hidden p-4">
          <div className="mb-3 flex shrink-0 items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/[.045]"><Palette size={16} className="text-[#A39CFF]" /></div>
              <div>
                <h2 className="text-[13px] font-bold">Style de l'application</h2>
                <p className="mt-0.5 text-[10px] text-[#747F91]">Choisis l'apparence de YTB Manager. Le changement est immédiat.</p>
              </div>
            </div>
            <div className="rounded-lg border border-white/[.06] bg-white/[.03] px-3 py-2 text-[9px] text-[#8D97A8]">
              {appStyleOptions.find((option) => option.value === appStyle)?.label}
            </div>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-3 grid-rows-3 gap-2.5">
            {appStyleOptions.map((option) => {
              const selected = option.value === appStyle
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setAppStyle(option.value)}
                  className={`group relative min-h-0 overflow-hidden rounded-xl border p-3 text-left transition duration-200 hover:-translate-y-0.5 ${
                    selected
                      ? 'border-[#8D8CFF]/55 bg-[#7776FF]/[.09] shadow-[0_12px_32px_rgba(0,0,0,.22)]'
                      : 'border-white/[.065] bg-black/10 hover:border-white/[.12] hover:bg-white/[.025]'
                  }`}
                >
                  <div
                    className="relative h-[86px] overflow-hidden rounded-lg border border-white/[.08]"
                    style={{ background: `linear-gradient(135deg, ${option.colors[0]} 0%, ${option.colors[1]} 68%, ${option.colors[2]} 145%)` }}
                  >
                    <div className="absolute bottom-2 left-2 top-2 w-[16px] rounded-md border border-white/10 bg-black/25 backdrop-blur-md" />
                    <div className="absolute left-[33px] right-2 top-2 h-[13px] rounded-md border border-white/10 bg-white/10 backdrop-blur-md" />
                    <div className="absolute bottom-2 left-[33px] right-[45%] top-[31px] rounded-md border border-white/10 bg-white/[.12] backdrop-blur-md" />
                    <div className="absolute bottom-2 left-[62%] right-2 top-[31px] rounded-md border border-white/10 bg-black/20 backdrop-blur-md" />
                    {selected && (
                      <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-white text-[#11131A] shadow-lg">
                        <Check size={11} strokeWidth={3} />
                      </span>
                    )}
                  </div>

                  <div className="mt-2.5 min-w-0">
                    <div className="truncate text-[11px] font-bold text-[#EEF1F6]">{option.shortLabel}</div>
                    <div className="mt-1 line-clamp-2 text-[9px] leading-3.5 text-[#737E91]">{option.description}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}