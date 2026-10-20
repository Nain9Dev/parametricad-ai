import type { ShowcasePreset } from '@/lib/presets'
import { SHOWCASE_PRESETS } from '@/lib/presets'

interface ShowcaseBarProps {
  activePresetId: string | null
  onSelectPreset: (preset: ShowcasePreset) => void
  busy?: boolean
}

const ICONS: Record<string, string> = {
  flange: '🔩',
  elbow: '↩️',
  pipe: '📏',
  plate: '🔲',
  prompt: '✨',
}

/**
 * The one-click demo parts (REQ-UBI-18: a card shows its content in full).
 *
 * One column in a narrow container and two in a container of 28 rem or more, so
 * the 20 rem desktop column and a phone show a list and a tablet panel shows a
 * grid. The badge follows the title and drops under it when the line is short;
 * the subtitle wraps instead of being clipped.
 */
export function ShowcaseBar({ activePresetId, onSelectPreset, busy }: ShowcaseBarProps) {
  return (
    <div className="@container space-y-2.5 rounded-panel border border-line bg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-valid animate-pulse" aria-hidden="true" />
          <span className="text-xs font-semibold uppercase tracking-wider text-ink">
            Demos 1-Clic · 24/7 Activo
          </span>
        </div>
        <span className="rounded bg-raised px-1.5 py-0.5 font-mono text-xs text-valid">
          0s latencia
        </span>
      </div>

      <p className="text-xs leading-snug text-ink-muted">
        Carga instantánea de sólidos B-Rep teselados con OpenCASCADE y validados determinísticamente:
      </p>

      <ul role="list" aria-label="Demo parts" className="grid gap-1.5 @md:grid-cols-2">
        {SHOWCASE_PRESETS.map((preset) => {
          const isActive = activePresetId === preset.id
          return (
            <li key={preset.id} className="flex">
              <button
                type="button"
                disabled={busy}
                onClick={() => onSelectPreset(preset)}
                className={`flex w-full cursor-pointer items-start gap-2.5 rounded-md border p-2.5 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                  isActive
                    ? 'border-accent bg-accent/10 shadow-[0_0_12px_rgba(61,139,253,0.25)] ring-1 ring-accent'
                    : 'border-line bg-raised hover:border-line-strong hover:bg-overlay'
                }`}
              >
                <span aria-hidden="true" className="mt-0.5 text-base leading-none">
                  {ICONS[preset.id]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-medium text-ink">{preset.label}</span>
                    {preset.badge ? (
                      <span
                        className={`rounded px-1.5 py-0.5 font-mono text-xs uppercase ${
                          isActive
                            ? 'bg-accent-fill font-semibold text-white'
                            : 'bg-void text-ink-faint'
                        }`}
                      >
                        {preset.badge}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-ink-faint">
                    {preset.subtitle}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
