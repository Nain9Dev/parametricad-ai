import type { ShowcasePreset } from '@/lib/presets'
import { SHOWCASE_PRESETS } from '@/lib/presets'

interface ShowcaseBarProps {
  activePresetId: string | null
  onSelectPreset: (preset: ShowcasePreset) => void
  busy?: boolean
}

export function ShowcaseBar({ activePresetId, onSelectPreset, busy }: ShowcaseBarProps) {
  return (
    <div className="rounded-panel border border-line bg-surface p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-valid animate-pulse" aria-hidden="true" />
          <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink">
            Demos 1-Clic · 24/7 Activo
          </span>
        </div>
        <span className="rounded bg-raised px-1.5 py-0.5 text-[0.625rem] font-mono text-valid">
          0s latencia
        </span>
      </div>

      <p className="text-[0.6875rem] leading-snug text-ink-muted">
        Carga instantánea de sólidos B-Rep teselados con OpenCASCADE y validados determinísticamente:
      </p>

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-2">
        {SHOWCASE_PRESETS.map((preset) => {
          const isActive = activePresetId === preset.id
          return (
            <button
              key={preset.id}
              type="button"
              disabled={busy}
              onClick={() => onSelectPreset(preset)}
              className={`flex flex-col items-start rounded-md border p-2 text-left transition-all cursor-pointer ${
                isActive
                  ? 'border-accent bg-accent/10 shadow-[0_0_12px_rgba(61,139,253,0.25)] ring-1 ring-accent'
                  : 'border-line bg-raised hover:border-line-strong hover:bg-overlay'
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <div className="flex w-full items-center justify-between gap-1">
                <span className="text-xs font-medium text-ink flex items-center gap-1">
                  {preset.id === 'flange' && '🔩'}
                  {preset.id === 'elbow' && '↩️'}
                  {preset.id === 'pipe' && '📏'}
                  {preset.id === 'plate' && '🔲'}
                  {preset.id === 'prompt' && '✨'}
                  <span>{preset.label}</span>
                </span>
                {preset.badge ? (
                  <span
                    className={`rounded px-1 py-0.2 text-[0.5625rem] font-mono uppercase ${
                      isActive
                        ? 'bg-accent text-white font-semibold'
                        : 'bg-void text-ink-faint'
                    }`}
                  >
                    {preset.badge}
                  </span>
                ) : null}
              </div>
              <span className="mt-0.5 text-[0.625rem] leading-tight text-ink-faint line-clamp-1">
                {preset.subtitle}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
