import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'

// Height (px) left peeking above the bottom edge when collapsed — enough to show
// the grab handle plus the Exercise presets and Squint slider.
export const SHEET_PEEK = 224

// A draggable bottom sheet (iOS-style): collapsed shows a peek, drag the handle
// up to expand. Tapping the handle toggles. Content scrolls when expanded.
export default function BottomSheet({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [drag, setDrag] = useState<{ start: number; base: number; ty: number } | null>(null)

  // Translate that hides everything but the peek.
  const collapsedTranslate = () => (ref.current ? ref.current.offsetHeight - SHEET_PEEK : 0)

  const onDown = (e: ReactPointerEvent) => {
    const base = expanded ? 0 : collapsedTranslate()
    setDrag({ start: e.clientY, base, ty: base })
    try {
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      // ignore — pointer may not be capturable (e.g. synthetic events)
    }
  }
  const onMove = (e: ReactPointerEvent) => {
    if (!drag) return
    const max = collapsedTranslate()
    const ty = Math.max(0, Math.min(max, drag.base + (e.clientY - drag.start)))
    setDrag({ ...drag, ty })
  }
  const onUp = (e: ReactPointerEvent) => {
    if (!drag) return
    const moved = Math.abs(e.clientY - drag.start)
    if (moved < 6) setExpanded((v) => !v) // treat as a tap
    else setExpanded(drag.ty < collapsedTranslate() / 2)
    setDrag(null)
  }

  const transform = drag
    ? `translateY(${drag.ty}px)`
    : expanded
      ? 'translateY(0)'
      : `translateY(calc(100% - ${SHEET_PEEK}px))`

  return (
    <div
      ref={ref}
      style={{ transform, transition: drag ? 'none' : 'transform 320ms cubic-bezier(0.32,0.72,0,1)' }}
      className="fixed inset-x-0 bottom-0 z-30 flex max-h-[88vh] flex-col rounded-t-2xl border-t border-slate-200 bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)]"
    >
      <div
        data-testid="sheet-handle"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="flex shrink-0 cursor-grab touch-none select-none flex-col items-center pb-1 pt-2.5 active:cursor-grabbing"
      >
        <div className="h-1.5 w-10 rounded-full bg-slate-300" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-1">
        {children}
      </div>
    </div>
  )
}
