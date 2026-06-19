// Browser-side image loading (HEIC + EXIF), working-size canvas, and export.
import type { Settings } from './image'
import { toLuma, gaussBlur, computeThresholds, evenLevels, process, sigmaFor } from './image'

export interface Source {
  bitmap: ImageBitmap
  width: number
  height: number
}

const MAX_EDGE = 1600

async function decodeBlob(blob: Blob): Promise<ImageBitmap> {
  // imageOrientation 'from-image' respects EXIF so phone photos aren't sideways.
  const opts = { imageOrientation: 'from-image' } as unknown as ImageBitmapOptions
  return await createImageBitmap(blob, opts)
}

async function heicToBlob(file: File): Promise<Blob> {
  const heic2any = (await import('heic2any')).default
  const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 })
  return Array.isArray(out) ? out[0] : out
}

export async function loadImageFile(file: File): Promise<Source> {
  const heicLike = /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name)
  try {
    const blob = heicLike ? await heicToBlob(file) : file
    const bitmap = await decodeBlob(blob)
    return { bitmap, width: bitmap.width, height: bitmap.height }
  } catch {
    // Some HEICs aren't flagged by type/extension — try converting as a fallback.
    try {
      const bitmap = await decodeBlob(await heicToBlob(file))
      return { bitmap, width: bitmap.width, height: bitmap.height }
    } catch {
      throw new Error("Couldn't read that image. Try a JPEG or PNG.")
    }
  }
}

export async function loadImageUrl(url: string): Promise<Source> {
  let res: Response
  try {
    res = await fetch(`/api/fetch-image?url=${encodeURIComponent(url)}`)
  } catch {
    throw new Error("Couldn't reach that link.")
  }
  if (!res.ok) throw new Error("Couldn't load that image. Check the link and try again.")
  const blob = await res.blob()
  try {
    const bitmap = await decodeBlob(blob)
    return { bitmap, width: bitmap.width, height: bitmap.height }
  } catch {
    throw new Error("That link didn't point to a usable image.")
  }
}

export interface Working {
  canvas: HTMLCanvasElement
  w: number
  h: number
}

export function makeWorking(src: Source): Working {
  const scale = Math.min(1, MAX_EDGE / Math.max(src.width, src.height))
  const w = Math.max(1, Math.round(src.width * scale))
  const h = Math.max(1, Math.round(src.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(src.bitmap, 0, 0, w, h)
  return { canvas, w, h }
}

// Re-applies the current settings to the full-resolution original and downloads it.
export async function exportStudy(src: Source, settings: Settings): Promise<void> {
  const canvas = document.createElement('canvas')
  canvas.width = src.width
  canvas.height = src.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(src.bitmap, 0, 0)
  const id = ctx.getImageData(0, 0, src.width, src.height)
  const luma = toLuma(id.data)
  const sigma = sigmaFor(settings.squint, src.width, src.height)
  const blurred = gaussBlur(luma, src.width, src.height, sigma)
  const thresholds = computeThresholds(blurred, settings.tones, settings.mode, settings.balance)
  const levels = evenLevels(settings.tones)
  const { rgba } = process(blurred, thresholds, levels)
  const out = ctx.createImageData(src.width, src.height)
  out.data.set(rgba)
  ctx.putImageData(out, 0, 0)

  await new Promise<void>((resolve) => {
    canvas.toBlob((b) => {
      if (b) {
        const url = URL.createObjectURL(b)
        const a = document.createElement('a')
        a.href = url
        a.download = `value-study-${settings.tones}tone.png`
        a.click()
        URL.revokeObjectURL(url)
      }
      resolve()
    }, 'image/png')
  })
}
