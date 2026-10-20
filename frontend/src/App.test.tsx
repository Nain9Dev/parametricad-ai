import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from '@/App'
import { SHOWCASE_PRESETS } from '@/lib/presets'
import { restoreMatchMedia, stubMatchMedia } from '@/test/media'
import type { GeneratedModel } from '@/types/api'

// @req REQ-EVT-08

const { generateFromSpec } = vi.hoisted(() => ({ generateFromSpec: vi.fn() }))

vi.mock('@/lib/apiClient', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/apiClient')>()),
  // The service never answers the catalog request, so the bundled catalog is the
  // one in use, as it is on a first offline start.
  fetchCatalogWithRetry: () => new Promise<never>(() => undefined),
  generateFromSpec,
}))

// Three.js and WebGL are not what these tests are about.
vi.mock('@/components/viewer/ModelViewer', () => ({ ModelViewer: () => null }))

/** The suite runs from the `frontend/` root, so the bundled models sit under `public/`. */
function bundledText(path: string): string {
  return readFileSync(resolve(process.cwd(), `public${path}`), 'utf-8')
}

function bundledModel(kind: string): GeneratedModel {
  return (JSON.parse(bundledText(`/presets/${kind}.json`)) as { model: GeneratedModel }).model
}

/**
 * Past the live preview's debounce, with every promise it started settled.
 *
 * React applies the state a promise sets only when the surrounding `act` ends,
 * and the debounce timer is created by an effect after that. One long advance
 * would therefore finish before the timer exists, so the clock moves in rounds.
 */
async function settle(): Promise<void> {
  for (let round = 0; round < 3; round += 1) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })
  }
}

function requestedKinds(): unknown[] {
  return generateFromSpec.mock.calls.map(([spec]) => (spec as { kind: string }).kind)
}

beforeEach(() => {
  vi.useFakeTimers()
  // The wide layout shows every pane at once, so each control can be reached.
  stubMatchMedia(['(min-width: 64rem)'])
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input)
      if (!path.startsWith('/presets/')) throw new TypeError('Failed to fetch')
      return { ok: true, json: async () => JSON.parse(bundledText(path)) as unknown }
    }),
  )
  generateFromSpec.mockReset()
  generateFromSpec.mockImplementation(async (spec: { kind: string }) => ({
    model: bundledModel(spec.kind),
    extractor: null,
  }))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  restoreMatchMedia()
})

describe('REQ-EVT-08: one generation request per load and per showcase card', () => {
  it('asks for the first model once, not again when the form settles on it', async () => {
    render(<App />)
    await settle()

    expect(requestedKinds()).toEqual(['flange'])
  })

  it.each(['elbow', 'pipe', 'plate'])('asks for the %s card once', async (id) => {
    const card = SHOWCASE_PRESETS.find((preset) => preset.id === id)
    if (!card) throw new Error(`The showcase preset "${id}" is missing.`)

    render(<App />)
    await settle()
    generateFromSpec.mockClear()

    const button = screen.getAllByRole('button').find((candidate) =>
      candidate.textContent?.includes(card.label),
    )
    if (!button) throw new Error(`No card is labelled "${card.label}".`)
    fireEvent.click(button)
    await settle()

    expect(requestedKinds()).toEqual([id])
  })

  it('asks for an opened project once', async () => {
    const { container } = render(<App />)
    await settle()
    generateFromSpec.mockClear()

    const input = container.querySelector<HTMLInputElement>('input[type="file"]')
    if (!input) throw new Error('The header has no Open Project field.')
    const project = JSON.stringify({ model: bundledModel('plate') })
    fireEvent.change(input, {
      target: { files: [new File([project], 'plate.json', { type: 'application/json' })] },
    })
    await settle()

    expect(requestedKinds()).toEqual(['plate'])
  })

  it('still regenerates once when a value is edited', async () => {
    render(<App />)
    await settle()
    generateFromSpec.mockClear()

    const [diameter] = screen.getAllByRole('spinbutton')
    if (!diameter) throw new Error('The form has no numeric field.')
    fireEvent.change(diameter, { target: { value: '120' } })
    await settle()

    expect(generateFromSpec).toHaveBeenCalledTimes(1)
  })
})
