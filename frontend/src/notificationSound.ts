export type NotificationSound = 'soft' | 'chime' | 'success' | 'digital' | 'off'

export const notificationSoundOptions: { value: NotificationSound; label: string }[] = [
  { value: 'soft', label: 'Douce' },
  { value: 'chime', label: 'Cloche' },
  { value: 'success', label: 'Succès' },
  { value: 'digital', label: 'Digital' },
  { value: 'off', label: 'Désactivée' },
]

export const DEFAULT_NOTIFICATION_VOLUME = 50

let audioContext: AudioContext | null = null

function context() {
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextClass) return null
  if (!audioContext) audioContext = new AudioContextClass()
  return audioContext
}

export function getNotificationSound(): NotificationSound {
  const saved = localStorage.getItem('ytm.notificationSound') as NotificationSound | null
  return notificationSoundOptions.some((option) => option.value === saved) ? saved! : 'soft'
}

export function setNotificationSound(value: NotificationSound) {
  localStorage.setItem('ytm.notificationSound', value)
}

export function getNotificationVolume(): number {
  const raw = localStorage.getItem('ytm.notificationVolume')
  if (raw === null) return DEFAULT_NOTIFICATION_VOLUME
  const saved = Number(raw)
  if (!Number.isFinite(saved)) return DEFAULT_NOTIFICATION_VOLUME
  return Math.min(100, Math.max(0, saved))
}

export function setNotificationVolume(value: number) {
  const safeValue = Math.min(100, Math.max(0, Math.round(value)))
  localStorage.setItem('ytm.notificationVolume', String(safeValue))
}

export async function unlockNotificationAudio() {
  const ctx = context()
  if (!ctx) return
  if (ctx.state === 'suspended') {
    try { await ctx.resume() } catch { /* navigateur sans autorisation audio */ }
  }
}

function tone(
  ctx: AudioContext,
  frequency: number,
  start: number,
  duration: number,
  gainValue = 0.055,
  type: OscillatorType = 'sine',
  volume = 1,
) {
  if (volume <= 0) return

  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, start)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(
    Math.max(0.0001, Math.min(0.24, gainValue * volume)),
    start + Math.min(0.018, duration / 4),
  )
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  oscillator.connect(gain)
  gain.connect(ctx.destination)
  oscillator.start(start)
  oscillator.stop(start + duration + 0.02)
}

export async function playNotificationSound(
  sound: NotificationSound = getNotificationSound(),
  volumePercent: number = getNotificationVolume(),
) {
  if (sound === 'off' || volumePercent <= 0) return
  const ctx = context()
  if (!ctx) return
  if (ctx.state === 'suspended') {
    try { await ctx.resume() } catch { return }
  }

  // Courbe perceptuelle + gain général : 50 % est confortable et 100 % est réellement fort.
  const normalizedVolume = Math.min(100, Math.max(0, volumePercent)) / 100
  const volume = Math.pow(normalizedVolume, 0.72) * 3.2
  const now = ctx.currentTime + 0.015

  if (sound === 'soft') {
    tone(ctx, 660, now, 0.12, 0.045, 'sine', volume)
    tone(ctx, 880, now + 0.11, 0.2, 0.04, 'sine', volume)
  } else if (sound === 'chime') {
    tone(ctx, 523.25, now, 0.16, 0.05, 'sine', volume)
    tone(ctx, 659.25, now + 0.1, 0.16, 0.05, 'sine', volume)
    tone(ctx, 783.99, now + 0.2, 0.28, 0.045, 'sine', volume)
  } else if (sound === 'success') {
    tone(ctx, 587.33, now, 0.11, 0.05, 'sine', volume)
    tone(ctx, 739.99, now + 0.09, 0.11, 0.05, 'sine', volume)
    tone(ctx, 987.77, now + 0.18, 0.26, 0.05, 'sine', volume)
  } else if (sound === 'digital') {
    tone(ctx, 880, now, 0.075, 0.038, 'square', volume)
    tone(ctx, 1174.66, now + 0.09, 0.075, 0.035, 'square', volume)
    tone(ctx, 1396.91, now + 0.18, 0.12, 0.032, 'square', volume)
  }
}
