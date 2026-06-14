import { useEffect, useRef } from 'react'
import type { Coverage, Settings } from '../lib/image'
import { toLuma, gaussBlur, computeThresholds, evenLevels, process, sigmaFor } from '../lib/image'
import { makeWorking } from '../lib/load'
import type { Source } from '../lib/load'

interface Props {
  source: Source
  settings: Settings
  compare: boolean
  onCoverage: (c: Coverage[]) => void
}

export default function CanvasView({ source, settings, compare, onCoverage }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const lumaRef = useRef<Uint8ClampedArray | null>(null)
  const colorRef = useRef<ImageData | null>(null)
  const dimsRef = useRef({ w: 0, h: 0 })
  const blurRef = useRef<{ squint: number; data: Uint8ClampedArray } | null>(null)
  const rafRef = useRef<number | null>(null)

  // Decode source into a working-size luma buffer (cached).
  useEffect(() => {
    const { canvas: work, w, h } = makeWorking(source)
    const ctx = work.getContext('2d')!
    const id = ctx.getImageData(0, 0, w, h)
    colorRef.current = id
    lumaRef.current = toLuma(id.data)
    dimsRef.current = { w, h }
    blurRef.current = null
    const cv = canvasRef.current
    if (cv) {
      cv.width = w
      cv.height = h
    }
  }, [source])

  // Re-render on any change (rAF-coalesced so dragging stays smooth).
  useEffect(() => {
    const draw = () => {
      const cv = canvasRef.current
      const luma = lumaRef.current
      if (!cv || !luma) return
      const ctx = cv.getContext('2d')!
      const { w, h } = dimsRef.current

      if (compare && colorRef.current) {
        ctx.putImageData(colorRef.current, 0, 0)
        return
      }

      const sigma = sigmaFor(settings.squint, w, h)
      if (!blurRef.current || blurRef.current.squint !== settings.squint) {
        blurRef.current = { squint: settings.squint, data: gaussBlur(luma, w, h, sigma) }
      }
      const blurred = blurRef.current.data
      const thresholds = computeThresholds(blurred, settings.tones, settings.mode, settings.balance)
      const levels = evenLevels(settings.tones)
      const { rgba, coverage } = process(blurred, thresholds, levels)
      const out = ctx.createImageData(w, h)
      out.data.set(rgba)
      ctx.putImageData(out, 0, 0)
      onCoverage(coverage)
    }

    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(draw)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [source, settings, compare, onCoverage])

  return (
    <canvas
      ref={canvasRef}
      className="max-h-full max-w-full rounded-lg object-contain shadow-lg"
    />
  )
}
