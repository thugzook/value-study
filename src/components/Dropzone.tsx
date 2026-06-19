import { useRef, useState } from 'react'

interface Props {
  onFile: (f: File) => void
  onUrl: (url: string) => void
  loading?: boolean
  error?: string | null
}

export default function Dropzone({ onFile, onUrl, loading, error }: Props) {
  const [drag, setDrag] = useState(false)
  const [url, setUrl] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const camRef = useRef<HTMLInputElement>(null)

  const pick = (files: FileList | null) => {
    if (files && files[0]) onFile(files[0])
  }

  const submitUrl = () => {
    const trimmed = url.trim()
    if (trimmed) onUrl(trimmed)
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDrag(true)
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDrag(false)
        if (e.dataTransfer.files.length) {
          pick(e.dataTransfer.files)
          return
        }
        // Dragging an image from another tab (e.g. Pinterest) gives a URL, not a File.
        const link = (e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain'))
          .split('\n')[0]
          ?.trim()
        if (link) onUrl(link)
      }}
      className={`mx-auto flex w-full max-w-xl flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-10 text-center transition ${
        drag ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300 bg-white'
      }`}
    >
      <div className="text-5xl">🎨</div>
      <h2 className="text-xl font-semibold text-slate-800">Add a reference photo</h2>
      <p className="max-w-sm text-sm text-slate-500">
        Drag an image here (works from Pinterest too), paste from your clipboard, or pick a file. On
        your phone you can snap a photo.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Choose a photo
        </button>
        <button
          type="button"
          onClick={() => camRef.current?.click()}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Use camera
        </button>
      </div>
      <div className="flex w-full max-w-sm items-center gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitUrl()
          }}
          placeholder="...or paste an image link"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={submitUrl}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Load
        </button>
      </div>
      {loading && <p className="text-sm text-indigo-600">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <input
        ref={fileRef}
        type="file"
        accept="image/*,.heic,.heif"
        className="hidden"
        onChange={(e) => pick(e.target.files)}
      />
      <input
        ref={camRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => pick(e.target.files)}
      />
    </div>
  )
}
