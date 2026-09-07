import { useId, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { SparkIcon } from '@/components/ui/Icons'

const EXAMPLES = [
  'Stainless steel pipe, 25.5 mm diameter, 2 mm wall, 200 mm long',
  'Codo de aluminio de 90 grados, diametro 30 mm, radio de curvatura 60 mm',
  'Flange 120 mm outer diameter, bore 60 mm, thickness 14 mm, 8 bolts',
  'Placa de acero 150 x 90, espesor 6 mm, agujero central 20 mm',
] as const

const MAX_LENGTH = 2000

interface PromptComposerProps {
  onSubmit: (prompt: string) => void
  busy: boolean
  extractor: string | null
}

/**
 * Natural-language entry.
 *
 * The examples are not decoration: extraction is keyword driven, and showing
 * the phrasings that work -- in both languages the parser handles -- is faster
 * than letting someone discover the vocabulary by trial and error.
 */
export function PromptComposer({ onSubmit, busy, extractor }: PromptComposerProps) {
  const inputId = useId()
  const [prompt, setPrompt] = useState('')
  const trimmed = prompt.trim()

  function submit() {
    if (!trimmed || busy) return
    onSubmit(trimmed)
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label htmlFor={inputId} className="text-xs font-medium text-ink-muted">
          Describe the part
        </label>
        <textarea
          id={inputId}
          value={prompt}
          maxLength={MAX_LENGTH}
          rows={3}
          placeholder="e.g. stainless steel pipe, 25 mm diameter, 2 mm wall, 200 mm long"
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            // Enter inserts a newline; the modifier submits, matching the
            // convention of every other composer an engineer uses daily.
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault()
              submit()
            }
          }}
          className="w-full resize-y rounded-md border border-line bg-raised px-2.5 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
        />
        <div className="flex items-center justify-between text-[0.6875rem] text-ink-faint">
          <span>Ctrl + Enter to generate</span>
          <span className="numeric">
            {trimmed.length}/{MAX_LENGTH}
          </span>
        </div>
      </div>

      <Button
        variant="primary"
        className="w-full"
        busy={busy}
        disabled={!trimmed}
        onClick={submit}
        icon={<SparkIcon />}
      >
        {busy ? 'Generating' : 'Generate from description'}
      </Button>

      <div className="space-y-1.5">
        <p className="text-[0.6875rem] font-semibold tracking-wider text-ink-faint uppercase">
          Examples
        </p>
        <ul className="space-y-1">
          {EXAMPLES.map((example) => (
            <li key={example}>
              <button
                type="button"
                onClick={() => setPrompt(example)}
                className="w-full rounded border border-transparent px-2 py-1.5 text-left text-[0.6875rem] leading-snug text-ink-faint transition-colors hover:border-line hover:bg-raised hover:text-ink-muted"
              >
                {example}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {extractor ? (
        <p className="text-[0.6875rem] text-ink-faint">
          Interpreted by the{' '}
          <span className="text-ink-muted">
            {extractor === 'rule_based' ? 'deterministic parser' : extractor}
          </span>
          .
        </p>
      ) : null}
    </div>
  )
}
