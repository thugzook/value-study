// Pure image-processing core. No DOM dependencies — easy to test/reuse.

export type ToneMode = 'auto' | 'even'

export interface Settings {
  tones: number // 2..6 — number of value blocks
  squint: number // 0..100 — blur amount (simplify into big shapes)
  balance: number // -100..100 — shift result darker/lighter
  mode: ToneMode
}

export const DEFAULT_SETTINGS: Settings = {
  tones: 3,
  squint: 35,
  balance: 0,
  mode: 'auto',
}

export interface Coverage {
  level: number
  pct: number
}

export interface Processed {
  rgba: Uint8ClampedArray
  coverage: Coverage[]
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

// --- Grayscale (Rec.709 luma) ---------------------------------------------
export function toLuma(d: Uint8ClampedArray): Uint8ClampedArray {
  const out = new Uint8ClampedArray(d.length / 4)
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    out[j] = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) | 0
  }
  return out
}

// --- Histogram ------------------------------------------------------------
export function histogram(luma: Uint8ClampedArray): Uint32Array {
  const h = new Uint32Array(256)
  for (let i = 0; i < luma.length; i++) h[luma[i]]++
  return h
}

// --- Otsu's method: best single threshold (for 2 tones) -------------------
export function otsu(h: Uint32Array, total: number): number {
  let sum = 0
  for (let t = 0; t < 256; t++) sum += t * h[t]
  let sumB = 0
  let wB = 0
  let max = 0
  let thr = 127
  for (let t = 0; t < 256; t++) {
    wB += h[t]
    if (!wB) continue
    const wF = total - wB
    if (!wF) break
    sumB += t * h[t]
    const diff = sumB / wB - (sum - sumB) / wF
    const between = wB * wF * diff * diff
    if (between > max) {
      max = between
      thr = t
    }
  }
  return thr
}

// --- Threshold strategies -------------------------------------------------
export function evenThresholds(n: number): number[] {
  return Array.from({ length: n - 1 }, (_, i) => Math.round(((i + 1) * 255) / n))
}

// 1-D k-means (Lloyd) over the histogram → natural value groupings.
export function kmeansThresholds(h: Uint32Array, n: number): number[] {
  let centers = Array.from({ length: n }, (_, k) => Math.round(((k + 0.5) * 255) / n))
  for (let iter = 0; iter < 24; iter++) {
    const sum = new Float64Array(n)
    const cnt = new Float64Array(n)
    for (let v = 0; v < 256; v++) {
      if (!h[v]) continue
      let best = 0
      let bd = Infinity
      for (let k = 0; k < n; k++) {
        const dd = Math.abs(v - centers[k])
        if (dd < bd) {
          bd = dd
          best = k
        }
      }
      sum[best] += v * h[v]
      cnt[best] += h[v]
    }
    let moved = false
    for (let k = 0; k < n; k++) {
      if (cnt[k]) {
        const nc = Math.round(sum[k] / cnt[k])
        if (nc !== centers[k]) moved = true
        centers[k] = nc
      }
    }
    if (!moved) break
  }
  centers.sort((a, b) => a - b)
  return centers.slice(0, -1).map((c, i) => Math.round((c + centers[i + 1]) / 2))
}

export function evenLevels(n: number): number[] {
  if (n <= 1) return [0]
  return Array.from({ length: n }, (_, i) => Math.round((i * 255) / (n - 1)))
}

// Picks thresholds for the current settings, applies the balance shift,
// and guarantees a strictly increasing list.
export function computeThresholds(
  blurred: Uint8ClampedArray,
  n: number,
  mode: ToneMode,
  balance: number,
): number[] {
  if (n <= 1) return []
  const h = histogram(blurred)
  let thr: number[]
  if (mode === 'even') thr = evenThresholds(n)
  else if (n === 2) thr = [otsu(h, blurred.length)]
  else thr = kmeansThresholds(h, n)

  const shift = Math.round((balance / 100) * 96) // +balance => lighter
  thr = thr.map((t) => clamp(t - shift, 1, 254))
  thr.sort((a, b) => a - b)
  for (let i = 1; i < thr.length; i++) {
    if (thr[i] <= thr[i - 1]) thr[i] = Math.min(254, thr[i - 1] + 1)
  }
  return thr
}

// --- Fast 3-pass box blur ≈ Gaussian, single channel, O(n) per pass -------
function boxesForGauss(sigma: number, n: number): number[] {
  const wIdeal = Math.sqrt((12 * sigma * sigma) / n + 1)
  let wl = Math.floor(wIdeal)
  if (wl % 2 === 0) wl--
  const wu = wl + 2
  const mIdeal = (12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4)
  const m = Math.round(mIdeal)
  return Array.from({ length: n }, (_, i) => (i < m ? wl : wu))
}

function boxBlurH(s: Uint8ClampedArray, t: Uint8ClampedArray, w: number, h: number, r: number): void {
  if (r < 1) {
    t.set(s)
    return
  }
  const norm = 1 / (r + r + 1)
  for (let i = 0; i < h; i++) {
    let ti = i * w
    let li = ti
    let ri = ti + r
    const fv = s[ti]
    const lv = s[ti + w - 1]
    let val = (r + 1) * fv
    for (let j = 0; j < r; j++) val += s[ti + j]
    for (let j = 0; j <= r; j++) {
      val += s[ri++] - fv
      t[ti++] = Math.round(val * norm)
    }
    for (let j = r + 1; j < w - r; j++) {
      val += s[ri++] - s[li++]
      t[ti++] = Math.round(val * norm)
    }
    for (let j = w - r; j < w; j++) {
      val += lv - s[li++]
      t[ti++] = Math.round(val * norm)
    }
  }
}

function boxBlurV(s: Uint8ClampedArray, t: Uint8ClampedArray, w: number, h: number, r: number): void {
  if (r < 1) {
    t.set(s)
    return
  }
  const norm = 1 / (r + r + 1)
  for (let i = 0; i < w; i++) {
    let ti = i
    let li = ti
    let ri = ti + r * w
    const fv = s[ti]
    const lv = s[ti + w * (h - 1)]
    let val = (r + 1) * fv
    for (let j = 0; j < r; j++) val += s[ti + j * w]
    for (let j = 0; j <= r; j++) {
      val += s[ri] - fv
      t[ti] = Math.round(val * norm)
      ri += w
      ti += w
    }
    for (let j = r + 1; j < h - r; j++) {
      val += s[ri] - s[li]
      t[ti] = Math.round(val * norm)
      li += w
      ri += w
      ti += w
    }
    for (let j = h - r; j < h; j++) {
      val += lv - s[li]
      t[ti] = Math.round(val * norm)
      li += w
      ti += w
    }
  }
}

export function gaussBlur(src: Uint8ClampedArray, w: number, h: number, sigma: number): Uint8ClampedArray {
  if (sigma <= 0.5) return src.slice()
  let a = src.slice()
  let b = new Uint8ClampedArray(src.length)
  for (const size of boxesForGauss(sigma, 3)) {
    const r = (size - 1) / 2
    boxBlurH(a, b, w, h, r)
    boxBlurV(b, a, w, h, r)
  }
  return a
}

export function sigmaFor(squint: number, w: number, h: number): number {
  return (squint / 100) * 0.04 * Math.min(w, h)
}

// --- Posterize ------------------------------------------------------------
export function process(luma: Uint8ClampedArray, thresholds: number[], levels: number[]): Processed {
  const lut = new Uint8ClampedArray(256)
  for (let v = 0; v < 256; v++) {
    let b = 0
    while (b < thresholds.length && v >= thresholds[b]) b++
    lut[v] = levels[b]
  }
  const n = levels.length
  const counts = new Uint32Array(n)
  const total = luma.length
  const rgba = new Uint8ClampedArray(total * 4)
  for (let i = 0, o = 0; i < total; i++, o += 4) {
    const v = luma[i]
    let b = 0
    while (b < thresholds.length && v >= thresholds[b]) b++
    counts[b]++
    const g = lut[v]
    rgba[o] = g
    rgba[o + 1] = g
    rgba[o + 2] = g
    rgba[o + 3] = 255
  }
  const coverage: Coverage[] = []
  for (let k = 0; k < n; k++) {
    coverage.push({ level: levels[k], pct: total ? counts[k] / total : 0 })
  }
  return { rgba, coverage }
}
