export function formatNumber(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    notation: value >= 100_000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value)
}

export function formatDate(value?: string | null): string {
  if (!value) return 'Jamais'
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function scoreTone(score: number): 'good' | 'mid' | 'bad' {
  if (score >= 70) return 'good'
  if (score >= 40) return 'mid'
  return 'bad'
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  })
  if (!response.ok) {
    let message = `Erreur ${response.status}`
    try {
      const data = await response.json()
      message = data.detail || message
    } catch {
      // no-op
    }
    throw new Error(message)
  }
  return response.json() as Promise<T>
}
