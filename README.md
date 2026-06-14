# Value Study

A browser tool for portrait **value practice**. Upload a reference photo and
"squint" it down into 2–6 clean value blocks to train your observation skills.
Everything runs client-side on a `<canvas>` — your images never leave your device.

## Run it

```bash
npm run dev        # http://localhost:5173
```

(Node 20 — there's an `.nvmrc`; run `nvm use` if needed.)

## Controls

- **Tones** — how many shades (2–6).
- **Squint** — blur detail away into big shapes.
- **Balance** — push the result darker or lighter.
- **Tone grouping** — Auto (natural value groups, k-means / Otsu) or Even.
- **Hold to see original**, **Download** the simplified image.

## How it works

`src/lib/image.ts` is the pure pipeline: grayscale (Rec.709) → fast 3-pass box
blur ≈ Gaussian → posterize to N levels (Otsu for 2 tones, k-means for 3+).
`src/lib/load.ts` handles HEIC (iPhone) + EXIF-correct decoding and full-res export.

## Roadmap

Next: a **compare** tool (overlay your own attempt vs. the reference for values
*and* proportions). See the full plan in `~/.claude/plans/value-study-webapp.md`.
