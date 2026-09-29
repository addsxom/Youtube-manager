import { useEffect, useMemo, useState } from 'react'

type Props = {
  src?: string | null
  name: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: 'h-9 w-9 rounded-xl text-xs',
  md: 'h-12 w-12 rounded-2xl text-sm',
  lg: 'h-20 w-20 rounded-2xl text-xl',
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

export default function ChannelAvatar({ src, name, size = 'sm', className = '' }: Props) {
  const [failed, setFailed] = useState(false)
  const label = useMemo(() => initials(name), [name])

  useEffect(() => setFailed(false), [src])

  if (!src || failed) {
    return (
      <div
        aria-label={`Avatar de ${name}`}
        className={`grid shrink-0 place-items-center border font-extrabold text-[var(--text-secondary)] ${sizes[size]} ${className}`}
        style={{
          borderColor: 'var(--avatar-border)',
          background: 'linear-gradient(135deg, var(--avatar-bg-a), var(--avatar-bg-b))',
        }}
      >
        {label}
      </div>
    )
  }

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={`shrink-0 border object-cover ${sizes[size]} ${className}`}
      style={{ borderColor: 'var(--avatar-border)' }}
    />
  )
}
