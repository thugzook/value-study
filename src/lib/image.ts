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
  squint: 10,
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

// --- Median filter: edge-preserving "squint" ------------------------------
// A circular (disk) sliding-window median (Huang-style running histogram). The
// disk window is isotropic, so it simplifies into smooth, rounded masses rather
// than the axis-aligned staircase a separable (H-then-V) median produces — while
// still preserving hard edges and small bright accents (eye-whites, speculars)
// instead of averaging them down into a mid-tone the way a Gaussian blur would.
// Radius scales with the Squint amount.
export function medianRadiusFor(squint: number, w: number, h: number): number {
  return Math.min(40, Math.round((squint / 100) * 0.035 * Math.min(w, h)))
}

export function medianBlur(src: Uint8ClampedArray, w: number, h: number, r: number): Uint8ClampedArray {
  if (r < 1) return src.slice()
  const out = new Uint8ClampedArray(src.length)
  // Per-row half-width of the disk; window size is constant (edges replicate),
  // so the median rank is fixed for every pixel.
  const hw = new Int32Array(2 * r + 1)
  let windowSize = 0
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.floor(Math.sqrt(r * r - dy * dy))
    hw[dy + r] = half
    windowSize += 2 * half + 1
  }
  const rank = windowSize >> 1 // 0-indexed median position
  const hist = new Uint32Array(256)

  for (let y = 0; y < h; y++) {
    hist.fill(0)
    // Build the disk window centred at x = 0 (columns clamped at the edge).
    for (let dy = -r; dy <= r; dy++) {
      let yy = y + dy
      yy = yy < 0 ? 0 : yy >= h ? h - 1 : yy
      const row = yy * w
      const half = hw[dy + r]
      for (let dx = -half; dx <= half; dx++) {
        const xx = dx < 0 ? 0 : dx >= w ? w - 1 : dx
        hist[src[row + xx]]++
      }
    }
    // Running median: smallest value `med` at the window rank, with `lt` = count
    // of samples strictly below `med`.
    let med = 0
    let lt = 0
    while (lt + hist[med] <= rank) {
      lt += hist[med]
      med++
    }
    out[y * w] = med
    for (let x = 1; x < w; x++) {
      // Slide the disk one column right: per row, drop the leftmost cell of the
      // previous window and add the new rightmost cell.
      for (let dy = -r; dy <= r; dy++) {
        let yy = y + dy
        yy = yy < 0 ? 0 : yy >= h ? h - 1 : yy
        const row = yy * w
        const half = hw[dy + r]
        let ox = x - 1 - half
        ox = ox < 0 ? 0 : ox >= w ? w - 1 : ox
        const ov = src[row + ox]
        hist[ov]--
        if (ov < med) lt--
        let nx = x + half
        nx = nx < 0 ? 0 : nx >= w ? w - 1 : nx
        const nv = src[row + nx]
        hist[nv]++
        if (nv < med) lt++
      }
      while (lt > rank) {
        med--
        lt -= hist[med]
      }
      while (lt + hist[med] <= rank) {
        lt += hist[med]
        med++
      }
      out[y * w + x] = med
    }
  }
  return out
}

// --- Despeckle: absorb tiny value-islands into their neighbours -----------
// The median pass removes most noise, but a few small disconnected blobs of a
// value can remain. Merging anything below `minArea` px into the dominant
// surrounding value gives the clean, connected masses an artist blocks in.
export function despeckleMinArea(w: number, h: number): number {
  return Math.max(8, Math.round(w * h * 0.00003))
}

function despeckle(idx: Uint8Array, w: number, minArea: number): void {
  const n = idx.length
  const visited = new Uint8Array(n)
  const queue = new Int32Array(n)
  const comp = new Int32Array(n)
  const tally = new Uint32Array(8)
  for (let start = 0; start < n; start++) {
    if (visited[start]) continue
    const lvl = idx[start]
    let qh = 0
    let qt = 0
    let cn = 0
    queue[qt++] = start
    visited[start] = 1
    while (qh < qt) {
      const p = queue[qh++]
      comp[cn++] = p
      const x = p % w
      if (x > 0 && !visited[p - 1] && idx[p - 1] === lvl) (visited[p - 1] = 1), (queue[qt++] = p - 1)
      if (x < w - 1 && !visited[p + 1] && idx[p + 1] === lvl) (visited[p + 1] = 1), (queue[qt++] = p + 1)
      if (p - w >= 0 && !visited[p - w] && idx[p - w] === lvl) (visited[p - w] = 1), (queue[qt++] = p - w)
      if (p + w < n && !visited[p + w] && idx[p + w] === lvl) (visited[p + w] = 1), (queue[qt++] = p + w)
    }
    if (cn >= minArea) continue
    // Reassign this small blob to the value it borders most.
    tally.fill(0)
    for (let i = 0; i < cn; i++) {
      const p = comp[i]
      const x = p % w
      if (x > 0 && idx[p - 1] !== lvl) tally[idx[p - 1]]++
      if (x < w - 1 && idx[p + 1] !== lvl) tally[idx[p + 1]]++
      if (p - w >= 0 && idx[p - w] !== lvl) tally[idx[p - w]]++
      if (p + w < n && idx[p + w] !== lvl) tally[idx[p + w]]++
    }
    let best = lvl
    let bestC = 0
    for (let L = 0; L < tally.length; L++) {
      if (tally[L] > bestC) {
        bestC = tally[L]
        best = L
      }
    }
    if (bestC > 0) for (let i = 0; i < cn; i++) idx[comp[i]] = best
  }
}

// --- Posterize ------------------------------------------------------------
export function process(
  luma: Uint8ClampedArray,
  w: number,
  thresholds: number[],
  levels: number[],
  minArea = 0,
): Processed {
  const band = new Uint8Array(256)
  for (let v = 0; v < 256; v++) {
    let b = 0
    while (b < thresholds.length && v >= thresholds[b]) b++
    band[v] = b
  }
  const total = luma.length
  const idx = new Uint8Array(total)
  for (let i = 0; i < total; i++) idx[i] = band[luma[i]]

  if (minArea > 1) despeckle(idx, w, minArea)

  const n = levels.length
  const counts = new Uint32Array(n)
  const rgba = new Uint8ClampedArray(total * 4)
  for (let i = 0, o = 0; i < total; i++, o += 4) {
    const b = idx[i]
    counts[b]++
    const g = levels[b]
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
