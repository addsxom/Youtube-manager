import { Check, ChevronDown } from 'lucide-react'
import { KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export type ThemedSelectOption = {
  value: string
  label: string
  disabled?: boolean
}

type ThemedSelectProps = {
  value: string
  options: readonly ThemedSelectOption[]
  onChange: (value: string) => void
  className?: string
  menuClassName?: string
  title?: string
  ariaLabel?: string
  disabled?: boolean
}

type MenuPosition = {
  left: number
  top: number
  width: number
  maxHeight: number
  openUpward: boolean
}

export default function ThemedSelect({
  value,
  options,
  onChange,
  className = '',
  menuClassName = '',
  title,
  ariaLabel,
  disabled = false,
}: ThemedSelectProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [position, setPosition] = useState<MenuPosition>({
    left: 0,
    top: 0,
    width: 0,
    maxHeight: 280,
    openUpward: false,
  })

  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value))
  const selected = options[selectedIndex] || options[0]

  const enabledIndexes = useMemo(
    () => options.map((option, index) => ({ option, index })).filter(({ option }) => !option.disabled).map(({ index }) => index),
    [options],
  )

  const updatePosition = () => {
    const trigger = triggerRef.current
    if (!trigger) return

    const rect = trigger.getBoundingClientRect()
    const gap = 7
    const viewportPadding = 12
    const estimatedHeight = Math.min(300, Math.max(54, options.length * 38 + 12))
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding
    const spaceAbove = rect.top - viewportPadding
    const openUpward = spaceBelow < Math.min(estimatedHeight, 180) && spaceAbove > spaceBelow
    const maxHeight = Math.max(96, Math.min(300, openUpward ? spaceAbove - gap : spaceBelow - gap))
    const top = openUpward
      ? Math.max(viewportPadding, rect.top - Math.min(estimatedHeight, maxHeight) - gap)
      : Math.min(window.innerHeight - viewportPadding, rect.bottom + gap)

    setPosition({
      left: Math.min(rect.left, window.innerWidth - rect.width - viewportPadding),
      top,
      width: rect.width,
      maxHeight,
      openUpward,
    })
  }

  useEffect(() => {
    if (!open) return

    setActiveIndex(selectedIndex)
    updatePosition()

    const closeFromOutside = (event: MouseEvent | PointerEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }

    const closeFromContextMenu = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }

    const reposition = () => updatePosition()

    window.addEventListener('pointerdown', closeFromOutside, true)
    window.addEventListener('contextmenu', closeFromContextMenu, true)
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)

    return () => {
      window.removeEventListener('pointerdown', closeFromOutside, true)
      window.removeEventListener('contextmenu', closeFromContextMenu, true)
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [open, selectedIndex])

  useEffect(() => {
    if (!open) return
    const active = menuRef.current?.querySelector<HTMLElement>(`[data-select-index="${activeIndex}"]`)
    active?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])

  const moveActive = (direction: 1 | -1) => {
    if (!enabledIndexes.length) return
    const currentEnabledPosition = enabledIndexes.indexOf(activeIndex)
    const fallbackPosition = enabledIndexes.indexOf(selectedIndex)
    const base = currentEnabledPosition >= 0 ? currentEnabledPosition : Math.max(0, fallbackPosition)
    const next = (base + direction + enabledIndexes.length) % enabledIndexes.length
    setActiveIndex(enabledIndexes[next])
  }

  const choose = (index: number) => {
    const option = options[index]
    if (!option || option.disabled) return
    onChange(option.value)
    setOpen(false)
    window.requestAnimationFrame(() => triggerRef.current?.focus())
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return

    if (!open && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault()
      setOpen(true)
      return
    }

    if (!open) return

    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      moveActive(1)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      moveActive(-1)
      return
    }

    if (event.key === 'Home' && enabledIndexes.length) {
      event.preventDefault()
      setActiveIndex(enabledIndexes[0])
      return
    }

    if (event.key === 'End' && enabledIndexes.length) {
      event.preventDefault()
      setActiveIndex(enabledIndexes[enabledIndexes.length - 1])
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      choose(activeIndex)
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        title={title}
        aria-label={ariaLabel || title}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          if (disabled) return
          setOpen((value) => !value)
        }}
        onKeyDown={handleKeyDown}
        className={`field inline-flex items-center justify-between gap-3 text-left disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      >
        <span className="min-w-0 flex-1 truncate">{selected?.label || value}</span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-[#7D8798] transition-transform duration-200 ${open ? 'rotate-180 text-[var(--accent)]' : ''}`}
        />
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          aria-label={ariaLabel || title}
          className={`glass-menu menu-pop fixed z-[120] overflow-y-auto rounded-[var(--radius-control)] p-1.5 ${menuClassName}`}
          style={{
            left: position.left,
            top: position.top,
            width: position.width,
            maxHeight: position.maxHeight,
            background: 'var(--menu-bg)',
            borderColor: 'var(--glass-border)',
            boxShadow: '0 22px 55px rgba(0,0,0,.42), inset 0 1px 0 rgba(255,255,255,.035)',
            transformOrigin: position.openUpward ? 'bottom center' : 'top center',
          }}
        >
          {options.map((option, index) => {
            const isSelected = option.value === value
            const isActive = index === activeIndex
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={option.disabled}
                data-select-index={index}
                onMouseEnter={() => !option.disabled && setActiveIndex(index)}
                onClick={() => choose(index)}
                className={`flex w-full items-center gap-3 rounded-[calc(var(--radius-control)-4px)] px-3 py-2.5 text-left text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-35 ${
                  isSelected
                    ? 'bg-white/[.075] text-white'
                    : isActive
                      ? 'bg-white/[.05] text-[#F1F3F7]'
                      : 'text-[#AAB3C2] hover:bg-white/[.045] hover:text-white'
                }`}
                style={isSelected ? { boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--accent) 30%, transparent)' } : undefined}
              >
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {isSelected && <Check size={14} strokeWidth={2.5} className="shrink-0 text-[var(--accent)]" />}
              </button>
            )
          })}
        </div>,
        document.body,
      )}
    </>
  )
}
