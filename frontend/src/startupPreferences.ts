const STARTUP_CHECK_KEY = 'ytm.startupCheck'
const STARTUP_AUTO_SYNC_KEY = 'ytm.startupAutoSync'

function readBoolean(key: string, fallback: boolean) {
  const value = localStorage.getItem(key)
  if (value === null) return fallback
  return value === '1'
}

function writeBoolean(key: string, value: boolean) {
  localStorage.setItem(key, value ? '1' : '0')
}

export function getStartupCheckEnabled() {
  return readBoolean(STARTUP_CHECK_KEY, true)
}

export function setStartupCheckEnabled(value: boolean) {
  writeBoolean(STARTUP_CHECK_KEY, value)
}

export function getStartupAutoSyncEnabled() {
  return readBoolean(STARTUP_AUTO_SYNC_KEY, true)
}

export function setStartupAutoSyncEnabled(value: boolean) {
  writeBoolean(STARTUP_AUTO_SYNC_KEY, value)
}

export function resetStartupPreferences() {
  localStorage.removeItem(STARTUP_CHECK_KEY)
  localStorage.removeItem(STARTUP_AUTO_SYNC_KEY)
}
