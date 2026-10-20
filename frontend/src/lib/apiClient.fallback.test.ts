import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  ApiError,
  GENERATION_TIMEOUT_MS,
  PRESET_RACE_TIMEOUT_MS,
  generateFromPrompt,
  generateFromSpec,
  isAbortError,
  refineModel,
} from '@/lib/apiClient'
import { SHOWCASE_PRESETS } from '@/lib/presets'
import type { ComponentSpec, ExportFormat } from '@/types/api'

// @req REQ-UNW-04
// @req REQ-UNW-05

const GLB: ExportFormat[] = ['glb']

function showcase(id: string) {
  const found = SHOWCASE_PRESETS.find((candidate) => candidate.id === id)
  if (!found) throw new Error(`The showcase preset "${id}" is missing.`)
  return found
}

const FLANGE = showcase('flange').spec
const CUSTOM_FLANGE: ComponentSpec = { ...FLANGE, outer_diameter_mm: 150 }
const SHOWCASE_PROMPT = showcase('prompt').promptText ?? ''

const REJECTION = {
  error: {
    code: 'invalid_parameters',
    message: 'The wall is thicker than the radius.',
    hint: 'Reduce the wall thickness.',
    details: { violations: [{ field: 'spec.pipe', message: 'wall >= radius' }] },
  },
}

/** What the generation service does when the client calls it. */
type Service = 'live' | 'down' | 'hang' | { status: number; body: unknown }

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function liveAnswer(spec: ComponentSpec) {
  return {
    model: {
      model_id: 'live',
      spec,
      properties: { volume_mm3: 1, surface_area_mm2: 1, mass_g: 1, density_g_cm3: 1 },
      quality: {
        status: 'valid',
        is_watertight: true,
        euler_characteristic: 0,
        triangle_count: 12,
      },
      artifacts: { glb: { format: 'glb', url: '/static/models/live.glb' } },
      timings: { total_ms: 5 },
      cached: false,
    },
    extractor: null,
  }
}

/**
 * Replace `fetch`. The generation service behaves as `service` says; the bundled
 * presets are served from `public/` unless `presets` is `missing`.
 */
function installFetch(service: Service, presets: 'ok' | 'missing' = 'ok') {
  const urls: string[] = []
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input)
    urls.push(url)

    if (url.startsWith('/presets/')) {
      if (presets === 'missing') return Promise.reject(new TypeError('network down'))
      const body = readFileSync(resolve(process.cwd(), `public${url}`), 'utf-8')
      return Promise.resolve(new Response(body, { status: 200 }))
    }

    if (service === 'down') return Promise.reject(new TypeError('network down'))
    if (service === 'hang') {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')),
        )
      })
    }
    if (service === 'live') {
      const sent = JSON.parse(String(init?.body ?? '{}')) as { spec?: ComponentSpec }
      return Promise.resolve(json(200, liveAnswer(sent.spec ?? FLANGE)))
    }
    return Promise.resolve(json(service.status, service.body))
  })
  vi.stubGlobal('fetch', fetchMock)
  return { presetFetches: () => urls.filter((url) => url.startsWith('/presets/')) }
}

function reportOffline() {
  vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false)
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('generateFromSpec', () => {
  it('returns the service answer when the service answers', async () => {
    const { presetFetches } = installFetch('live')
    const result = await generateFromSpec(FLANGE, GLB)

    expect(result.model.model_id).toBe('live')
    expect(presetFetches()).toHaveLength(0)
  })

  describe('a specification equal to a bundled preset', () => {
    it('is answered from the bundle when the service is unreachable', async () => {
      installFetch('down')
      const result = await generateFromSpec(FLANGE, GLB)

      expect(result.model.spec['outer_diameter_mm']).toBe(100)
      expect(result.model.artifacts.glb?.url).toBe('/presets/flange.glb')
    })

    it.each([500, 503])('is answered from the bundle on a %i', async (status) => {
      installFetch({ status, body: {} })
      const result = await generateFromSpec(FLANGE, GLB)

      expect(result.model.artifacts.glb?.url).toBe('/presets/flange.glb')
    })

    it('is answered from the bundle when the service stays silent for 4 s', async () => {
      vi.useFakeTimers()
      installFetch('hang')

      const pending = generateFromSpec(FLANGE, GLB)
      await vi.advanceTimersByTimeAsync(PRESET_RACE_TIMEOUT_MS)

      await expect(pending).resolves.toMatchObject({
        model: { spec: { outer_diameter_mm: 100 } },
      })
    })

    it('reports the service failure when the bundled model cannot be loaded either', async () => {
      installFetch('down', 'missing')

      await expect(generateFromSpec(FLANGE, GLB)).rejects.toMatchObject({
        code: 'network_unreachable',
      })
    })
  })

  describe('a specification that differs from every bundled preset', () => {
    it('fails with network_unreachable and shows no preset when the service is down', async () => {
      const { presetFetches } = installFetch('down')

      await expect(generateFromSpec(CUSTOM_FLANGE, GLB)).rejects.toMatchObject({
        name: 'ApiError',
        code: 'network_unreachable',
        status: 0,
      })
      expect(presetFetches()).toHaveLength(0)
    })

    it('says offline when the device reports no connection', async () => {
      installFetch('down')
      reportOffline()

      await expect(generateFromSpec(CUSTOM_FLANGE, GLB)).rejects.toMatchObject({
        code: 'offline',
        status: 0,
      })
    })

    it('waits past 4 s and gives up with generation_timeout at 20 s', async () => {
      vi.useFakeTimers()
      installFetch('hang')

      const settled = generateFromSpec(CUSTOM_FLANGE, GLB).catch((error: unknown) => error)
      const state = { done: false }
      void settled.then(() => {
        state.done = true
      })

      await vi.advanceTimersByTimeAsync(PRESET_RACE_TIMEOUT_MS)
      expect(state.done).toBe(false)

      await vi.advanceTimersByTimeAsync(GENERATION_TIMEOUT_MS - PRESET_RACE_TIMEOUT_MS)
      const error = await settled

      expect(error).toBeInstanceOf(ApiError)
      expect(error).toMatchObject({ code: 'generation_timeout', status: 0 })
      expect((error as ApiError).isRetryable).toBe(true)
      expect(isAbortError(error)).toBe(false)
    })

    it('surfaces a server error instead of a preset', async () => {
      const { presetFetches } = installFetch({ status: 500, body: {} })

      await expect(generateFromSpec(CUSTOM_FLANGE, GLB)).rejects.toMatchObject({ status: 500 })
      expect(presetFetches()).toHaveLength(0)
    })
  })

  describe('a failure the service described', () => {
    it('is shown for a custom specification, violations included', async () => {
      installFetch({ status: 422, body: REJECTION })

      await expect(generateFromSpec(CUSTOM_FLANGE, GLB)).rejects.toMatchObject({
        code: 'invalid_parameters',
        status: 422,
        hint: 'Reduce the wall thickness.',
        details: { violations: [{ field: 'spec.pipe', message: 'wall >= radius' }] },
      })
    })

    it('is never replaced by a bundled preset, even for a matching specification', async () => {
      const { presetFetches } = installFetch({ status: 422, body: REJECTION })

      await expect(generateFromSpec(FLANGE, GLB)).rejects.toMatchObject({
        code: 'invalid_parameters',
      })
      expect(presetFetches()).toHaveLength(0)
    })
  })

  describe('when the caller gives up', () => {
    it('rethrows the abort untouched for a custom specification', async () => {
      installFetch('hang')
      const controller = new AbortController()

      const settled = generateFromSpec(CUSTOM_FLANGE, GLB, controller.signal).catch(
        (error: unknown) => error,
      )
      controller.abort()

      expect(isAbortError(await settled)).toBe(true)
    })

    it('does not fall back to a bundled preset either', async () => {
      const { presetFetches } = installFetch('hang')
      const controller = new AbortController()

      const settled = generateFromSpec(FLANGE, GLB, controller.signal).catch(
        (error: unknown) => error,
      )
      controller.abort()

      expect(isAbortError(await settled)).toBe(true)
      expect(presetFetches()).toHaveLength(0)
    })
  })
})

describe('generateFromPrompt', () => {
  it('answers the showcase prompt from the bundle when the service is unreachable', async () => {
    installFetch('down')
    const result = await generateFromPrompt(SHOWCASE_PROMPT, GLB)

    expect(result.model.spec.kind).toBe('pipe')
    expect(result.extractor).toContain('Bundled demo')
  })

  it('recognises the showcase prompt whatever its case and spacing', async () => {
    installFetch('down')
    const result = await generateFromPrompt(`  ${SHOWCASE_PROMPT.toUpperCase()}  `, GLB)

    expect(result.model.spec.kind).toBe('pipe')
  })

  it('fails instead of guessing for any other prompt', async () => {
    const { presetFetches } = installFetch('down')

    await expect(
      generateFromPrompt('Brida de acero con ocho pernos', GLB),
    ).rejects.toMatchObject({ code: 'network_unreachable' })
    expect(presetFetches()).toHaveLength(0)
  })

  it('shows a rejection the service described, for the showcase prompt too', async () => {
    const { presetFetches } = installFetch({
      status: 400,
      body: {
        error: {
          code: 'parameter_extraction_failed',
          message: 'No component recognised.',
          hint: null,
          details: {},
        },
      },
    })

    await expect(generateFromPrompt(SHOWCASE_PROMPT, GLB)).rejects.toMatchObject({
      code: 'parameter_extraction_failed',
      status: 400,
    })
    expect(presetFetches()).toHaveLength(0)
  })
})

describe('refineModel', () => {
  it('has no bundled answer, so an unreachable service is reported', async () => {
    const { presetFetches } = installFetch('down')

    await expect(refineModel(FLANGE, 'make it thicker', GLB)).rejects.toMatchObject({
      code: 'network_unreachable',
    })
    expect(presetFetches()).toHaveLength(0)
  })

  it('says offline when the device reports no connection', async () => {
    installFetch('down')
    reportOffline()

    await expect(refineModel(FLANGE, 'make it thicker', GLB)).rejects.toMatchObject({
      code: 'offline',
    })
  })
})
