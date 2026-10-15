import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Info } from 'lucide-react'

/** An (i) button that reveals help text on hover, keyboard focus or tap; Escape or tapping elsewhere closes it. */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const id = useId()
  const ref = useRef<HTMLSpanElement>(null)
  const visible = open || hovered

  useEffect(() => {
    if (!open) return
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !ref.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  return (
    <span ref={ref} className="relative inline-flex" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={visible}
        aria-describedby={visible ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      >
        <Info aria-hidden className="size-4" />
      </button>
      {visible && (
        <span
          role="tooltip"
          id={id}
          className="absolute right-0 bottom-full z-20 mb-2 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-popover p-3 text-left text-xs font-normal text-popover-foreground shadow-lg"
        >
          {children}
        </span>
      )}
    </span>
  )
}
