# Value Study — Project Instructions

Client-side webapp for portrait **value practice**. Upload a reference, "squint"
it into N value blocks (2–6). Phase 2 will add a compare tool (own attempt vs.
reference, for values *and* proportions). No backend — all canvas pixel math.

## Stack
Vite 5/8 + React 19 + TypeScript + Tailwind 3. **Node 20** (`.nvmrc`). Deploy: Vercel.

## Run / build
- `npm run dev` — local dev (http://localhost:5173)
- `npm run build` — `tsc -b && vite build` (must pass; strict TS: noUnusedLocals/
  Params, verbatimModuleSyntax, erasableSyntaxOnly — use `import type`, no enums)

## Architecture
- `src/lib/image.ts` — **pure** pipeline, no DOM: `toLuma` (Rec.709) → `medianBlur`
  (edge-preserving "squint" — circular/disk sliding-window median; isotropic, so it
  simplifies into smooth rounded masses instead of the axis-aligned staircase a
  separable median gives, while keeping small bright accents like eye-whites from
  muddying into mid-tones the way a blur would) → `computeThresholds` (Otsu for 2
  tones, k-means for 3+, with balance shift) → `process` (posterize → `despeckle`
  small value-islands into neighbours → coverage). Keep this DOM-free.
  `gaussBlur`/`sigmaFor` remain as available helpers but are no longer in the
  active pipeline. Local accuracy/blockiness harness lives in `tuning/` (gitignored).
- `src/lib/load.ts` — DOM glue: HEIC (lazy `heic2any`) + EXIF decode, working-size
  canvas (`PROC_EDGE` 760px — a value study needs masses, not pixels; keeps the
  median fast on mobile), `exportStudy` (capped `EXPORT_EDGE` 2000px).
- `src/components/CanvasView.tsx` — owns the canvas; caches luma + blurred result.
  The median (expensive) recomputes only when Squint settles (120ms debounce via
  `renderSquint`); tone/balance changes redraw instantly off the cached blur.
  rAF-coalesced redraw.
- `src/App.tsx` — state + layout; `Controls`, `Legend`, `Dropzone`.

## Conventions
- Build ImageData via `ctx.createImageData(w,h)` + `.data.set(rgba)` (TS6 rejects
  the `new ImageData(buffer, …)` overload with our buffer type).
- Keep the UI **beginner-friendly**: plain-language labels, sensible defaults
  (3 tones), no jargon in the UI.

## Plan
Full roadmap: `~/.claude/plans/value-study-webapp.md`.
