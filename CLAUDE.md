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
- `src/lib/image.ts` — **pure** pipeline, no DOM: `toLuma` (Rec.709) → `gaussBlur`
  (fast 3-pass box blur) → `computeThresholds` (Otsu for 2 tones, k-means for 3+,
  with balance shift) → `process` (posterize + coverage). Keep this DOM-free.
- `src/lib/load.ts` — DOM glue: HEIC (lazy `heic2any`) + EXIF decode, working-size
  canvas (capped 1600px), full-res `exportStudy`.
- `src/components/CanvasView.tsx` — owns the canvas; caches luma + blurred result
  (re-blurs only when Squint changes); rAF-coalesced redraw.
- `src/App.tsx` — state + layout; `Controls`, `Legend`, `Dropzone`.

## Conventions
- Build ImageData via `ctx.createImageData(w,h)` + `.data.set(rgba)` (TS6 rejects
  the `new ImageData(buffer, …)` overload with our buffer type).
- Keep the UI **beginner-friendly**: plain-language labels, sensible defaults
  (3 tones), no jargon in the UI.

## Plan
Full roadmap: `~/.claude/plans/value-study-webapp.md`.
