import type { Coverage } from '../lib/image'

export default function Legend({ coverage }: { coverage: Coverage[] }) {
  if (!coverage.length) return null
  return (
    <div className="flex flex-wrap gap-2">
      {coverage.map((c, i) => (
        <div key={i} className="flex flex-col items-center">
          <div
            className="h-9 w-9 rounded border border-black/10"
            style={{ background: `rgb(${c.level},${c.level},${c.level})` }}
          />
          <span className="mt-1 text-xs tabular-nums text-slate-500">{Math.round(c.pct * 100)}%</span>
        </div>
      ))}
    </div>
  )
}
