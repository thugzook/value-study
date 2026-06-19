import { useCallback, useEffect, useState } from 'react'
import Dropzone from './components/Dropzone'
import CanvasView from './components/CanvasView'
import Controls from './components/Controls'
import Legend from './components/Legend'
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

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 text-slate-800">
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

      <main className="flex flex-1 flex-col gap-4 overflow-hidden p-4 md:flex-row">
        {!source ? (
          <div className="flex flex-1 items-center justify-center">
            <Dropzone onFile={handleFile} onUrl={handleUrl} loading={loading} error={error} />
          </div>
        ) : (
          <>
            <div className="flex min-h-[40vh] flex-1 items-center justify-center overflow-hidden rounded-xl bg-slate-200 p-4">
              <CanvasView source={source} settings={settings} compare={compare} onCoverage={onCoverage} />
            </div>

            <aside className="flex w-full shrink-0 flex-col gap-5 rounded-xl bg-white p-5 md:w-80">
              <Controls settings={settings} onChange={setSettings} />

              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">Values in use</p>
                <Legend coverage={coverage} />
              </div>

              <div className="mt-auto flex flex-col gap-2">
                <button
                  type="button"
                  onPointerDown={() => setCompare(true)}
                  onPointerUp={() => setCompare(false)}
                  onPointerLeave={() => setCompare(false)}
                  className="select-none rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  {compare ? 'Showing original…' : 'Hold to see original'}
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void exportStudy(source, settings)}
                    className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    Download
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettings(DEFAULT_SETTINGS)}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </aside>
          </>
        )}
      </main>
    </div>
  )
}
