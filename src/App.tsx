import { useCallback, useEffect, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import Dropzone from './components/Dropzone'
import CanvasView from './components/CanvasView'
import Controls from './components/Controls'
import Legend from './components/Legend'
import BottomSheet, { SHEET_PEEK } from './components/BottomSheet'
import { useMediaQuery } from './useMediaQuery'
import { DEFAULT_SETTINGS } from './lib/image'
import type { Coverage, Settings } from './lib/image'
import { loadImageFile, loadImageUrl, exportStudy } from './lib/load'
import type { Source } from './lib/load'

export default function App() {
  const [source, setSource] = useState<Source | null>(null)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [coverage, setCoverage] = useState<Coverage[]>([])
  const [compare, setCompare] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = useCallback(async (file: File) => {
    setLoading(true)
    setError(null)
    try {
      const src = await loadImageFile(file)
      setSource(src)
      setCompare(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load that image.')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleUrl = useCallback(async (url: string) => {
    setLoading(true)
    setError(null)
    try {
      const src = await loadImageUrl(url)
      setSource(src)
      setCompare(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load that image.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Paste an image (or an image link) from the clipboard anywhere on the page.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const f = e.clipboardData?.files?.[0]
      if (f && f.type.startsWith('image')) {
        void handleFile(f)
        return
      }
      const text = e.clipboardData?.getData('text')?.trim()
      if (text && /^https?:\/\//i.test(text)) void handleUrl(text)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [handleFile, handleUrl])

  const onCoverage = useCallback((c: Coverage[]) => setCoverage(c), [])

  const isDesktop = useMediaQuery('(min-width: 768px)')
  const isTouch = useMediaQuery('(pointer: coarse)')

  // Compare: hold-to-peek with a mouse, tap-to-toggle on touch (holding isn't a
  // reliable gesture on mobile — it fights scroll and the long-press callout).
  const compareDown = (e: ReactPointerEvent) =>
    e.pointerType === 'touch' ? setCompare((c) => !c) : setCompare(true)
  const compareRelease = (e: ReactPointerEvent) => {
    if (e.pointerType !== 'touch') setCompare(false)
  }
  const compareLabel = isTouch
    ? compare
      ? 'Tap to hide original'
      : 'Tap to see original'
    : compare
      ? 'Showing original…'
      : 'Hold to see original'

  const panel = (
    <div className="flex flex-col gap-5">
      <Controls settings={settings} onChange={setSettings} />

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">Values in use</p>
        <Legend coverage={coverage} />
      </div>

      <div className="flex flex-col gap-2 border-t border-slate-100 pt-4">
        <button
          type="button"
          onPointerDown={compareDown}
          onPointerUp={compareRelease}
          onPointerLeave={compareRelease}
          onPointerCancel={compareRelease}
          onContextMenu={(e) => e.preventDefault()}
          className={`touch-none select-none rounded-lg border px-4 py-2.5 text-sm font-medium ${
            compare
              ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
              : 'border-slate-300 text-slate-700 hover:bg-slate-50'
          }`}
        >
          {compareLabel}
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => source && void exportStudy(source, settings)}
            className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Download
          </button>
          <button
            type="button"
            onClick={() => setSettings(DEFAULT_SETTINGS)}
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div
      className={`flex flex-col bg-slate-100 text-slate-800 ${
        isDesktop || !source ? 'min-h-screen' : 'h-dvh overflow-hidden'
      }`}
    >
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
        <div>
          <h1 className="text-lg font-semibold">Value Study</h1>
          <p className="text-xs text-slate-400">Squint your reference into value blocks.</p>
        </div>
        {source && (
          <button
            type="button"
            onClick={() => {
              setSource(null)
              setCoverage([])
            }}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            New image
          </button>
        )}
      </header>

      {!source ? (
        <main className="flex flex-1 items-center justify-center p-4">
          <Dropzone onFile={handleFile} onUrl={handleUrl} loading={loading} error={error} />
        </main>
      ) : isDesktop ? (
        <main className="flex flex-1 gap-4 overflow-hidden p-4">
          <div className="flex min-h-[40vh] flex-1 items-center justify-center overflow-hidden rounded-xl bg-slate-200 p-4">
            <CanvasView source={source} settings={settings} compare={compare} onCoverage={onCoverage} />
          </div>
          <aside className="w-80 shrink-0 overflow-y-auto rounded-xl bg-white p-5">{panel}</aside>
        </main>
      ) : (
        <>
          <main
            className="flex flex-1 items-center justify-center overflow-hidden bg-slate-200 p-3"
            style={{ paddingBottom: SHEET_PEEK + 12 }}
          >
            <CanvasView source={source} settings={settings} compare={compare} onCoverage={onCoverage} />
          </main>
          <BottomSheet>{panel}</BottomSheet>
        </>
      )}
    </div>
  )
}
