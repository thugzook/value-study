import { useState } from 'react'
import type { ReactNode } from 'react'
import type { Settings } from '../lib/image'

interface Props {
  settings: Settings
  onChange: (s: Settings) => void
}

const PRESETS: { label: string; tones: number; sub: string }[] = [
  { label: 'Notan', tones: 2, sub: 'Design the big light and shadow shapes.' },
  { label: 'Block-in', tones: 3, sub: 'Add the mid-tones — the everyday default.' },
  { label: 'Planes', tones: 4, sub: 'Turn the form with more value steps.' },
]

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
  const [advanced, setAdvanced] = useState(false)
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => onChange({ ...settings, [k]: v })

  const balanceLabel =
    settings.balance === 0
      ? 'centered'
      : `${settings.balance > 0 ? '+' : ''}${settings.balance} · ${settings.balance < 0 ? 'darker' : 'lighter'}`

  const presetSub = PRESETS.find((p) => p.tones === settings.tones)?.sub ?? `${settings.tones} values`

  return (
    <div className="flex flex-col gap-5">
      {/* Exercise presets — the primary, beginner-friendly control */}
      <div>
        <span className="text-sm font-medium text-slate-700">Exercise</span>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {PRESETS.map((p) => {
            const active = settings.tones === p.tones
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => set('tones', p.tones)}
                className={`flex flex-col items-center rounded-lg border px-2 py-2 transition ${
                  active ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className={`text-sm font-medium ${active ? 'text-indigo-700' : 'text-slate-700'}`}>
                  {p.label}
                </span>
                <span className="mt-0.5 text-[10px] leading-tight text-slate-400">{p.tones} values</span>
              </button>
            )
          })}
        </div>
        <p className="mt-1 text-xs text-slate-400">{presetSub}</p>
      </div>

      {/* Squint — the app's namesake action, kept up front */}
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

      {settings.tones === 2 && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
          2 values shows only the big light and shadow masses — fine features like eyebrows merge in
          here. Switch to Block-in or Planes to keep them.
        </p>
      )}

      {/* Advanced — collapsed by default */}
      <div className="border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={() => setAdvanced((v) => !v)}
          className="flex w-full items-center justify-between text-sm font-medium text-slate-600"
        >
          <span>Advanced</span>
          <span className={`transition-transform ${advanced ? 'rotate-90' : ''}`}>›</span>
        </button>

        {advanced && (
          <div className="mt-4 flex flex-col gap-5">
            <Field label="Values" hint="Exact number of tones (2–6)." value={String(settings.tones)}>
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

            <Field label="Balance" hint="Push the whole image darker or lighter." value={balanceLabel}>
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
        )}
      </div>
    </div>
  )
}
