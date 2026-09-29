export type RecentVideo = {
  id: string
  title: string
  thumbnailUrl?: string | null
  publishedAt: string
}

export type Channel = {
  id: string
  subscriptionId?: string | null
  name: string
  description: string
  thumbnailUrl?: string | null
  bannerUrl?: string | null
  recentVideos?: RecentVideo[]
  subscribedAt?: string | null
  subscribers: number
  videos: number
  lastVideo: string
  lastUploadAt?: string | null
  score: number
  favorite: boolean
  ignored: boolean
  note: string
  history?: HistoryPoint[]
}

export type HistoryPoint = {
  capturedAt: string
  subscribers: number
  videos: number
  score: number
}

export type SyncChanges = {
  created: number
  removed: number
  becameActive: number
  becameInactive: number
  subscriberDelta: number
  newVideos: number
}

export type DashboardData = {
  total: number
  active: number
  watch: number
  inactive: number
  favorites: number
  totalSubscribers: number
  lastSync?: string | null
  lastChanges?: SyncChanges | null
  distribution: { label: string; value: number }[]
  attention: Channel[]
}

export type AnalyticsPoint = {
  date: string
  subscribers: number
  channels: number
  averageScore: number
}
