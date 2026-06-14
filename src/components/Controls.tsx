import type { ReactNode } from 'react'
import type { Settings } from '../lib/image'

interface Props {
  settings: Settings
  onChange: (s: Settings) => void
}

function Field({
  label,
  hint,
  value,
  children,
}: {
  label: string
  hint?: string
  value?: string
  children: ReactNode
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        {value !== undefined && <span className="text-xs tabular-nums text-slate-400">{value}</span>}
      </div>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  )
}

const rangeCls = 'mt-2 w-full cursor-pointer accent-indigo-600'

export default function Controls({ settings, onChange }: Props) {
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => onChange({ ...settings, [k]: v })

  const balanceWord =
    settings.balance === 0 ? 'even' : settings.balance < 0 ? 'darker' : 'lighter'

  return (
    <div className="flex flex-col gap-5">
      <Field label="Tones" hint="How many shades, from black to white." value={String(settings.tones)}>
        <input
          type="range"
          min={2}
          max={6}
          step={1}
          value={settings.tones}
          onChange={(e) => set('tones', Number(e.target.value))}
          className={rangeCls}
        />
      </Field>

      <Field
        label="Squint"
        hint="Left = sharp detail · Right = squint into big shapes."
        value={String(settings.squint)}
      >
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={settings.squint}
          onChange={(e) => set('squint', Number(e.target.value))}
          className={rangeCls}
        />
      </Field>

      <Field label="Balance" hint="Push the whole image darker or lighter." value={balanceWord}>
        <input
          type="range"
          min={-100}
          max={100}
          step={1}
          value={settings.balance}
          onChange={(e) => set('balance', Number(e.target.value))}
          className={rangeCls}
        />
      </Field>

      <Field label="Tone grouping" hint="Auto finds natural value groups; Even spaces them equally.">
        <div className="mt-2 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          {(['auto', 'even'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => set('mode', m)}
              className={`rounded-md px-3 py-1 text-sm capitalize ${
                settings.mode === m
                  ? 'bg-white font-medium text-indigo-600 shadow'
                  : 'text-slate-500'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </Field>
    </div>
  )
}
