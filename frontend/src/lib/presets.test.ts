import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { SHOWCASE_PRESETS } from '@/lib/presets'
import type { ComponentSpec } from '@/types/api'

// @req REQ-UBI-15

/** The suite runs from the `frontend/` root, so the bundled models sit under `public/`. */
function bundledSpec(id: string): ComponentSpec {
  const text = readFileSync(resolve(process.cwd(), `public/presets/${id}.json`), 'utf-8')
  return (JSON.parse(text) as { model: { spec: ComponentSpec } }).model.spec
}

function preset(id: string) {
  const found = SHOWCASE_PRESETS.find((candidate) => candidate.id === id)
  if (!found) throw new Error(`The showcase preset "${id}" is missing.`)
  return found
}

describe('REQ-UBI-15: a showcase card describes the model it shows', () => {
  it.each(['flange', 'elbow', 'pipe', 'plate'])(
    'the %s card carries the specification of its bundled model',
    (id) => {
      expect(preset(id).spec).toEqual(bundledSpec(id))
    },
  )

  it('the prompt card leads to the bundled pipe', () => {
    expect(preset('prompt').spec).toEqual(bundledSpec('pipe'))
  })

  it('the subtitles state the values of the bundled models', () => {
    const flange = bundledSpec('flange')
    expect(preset('flange').subtitle).toContain(`Ø${flange['outer_diameter_mm']}mm`)

    const elbow = bundledSpec('elbow')
    expect(preset('elbow').subtitle).toContain(`Radio ${elbow['bend_radius_mm']}mm`)
    expect(preset('elbow').subtitle).toContain(`Ø${elbow['outer_diameter_mm']}mm`)
    expect(preset('elbow').subtitle).toContain(`e=${elbow['wall_thickness_mm']}mm`)

    const pipe = bundledSpec('pipe')
    expect(preset('pipe').subtitle).toContain(`Ø${pipe['outer_diameter_mm']}mm`)
    expect(preset('pipe').subtitle).toContain(`L=${pipe['length_mm']}mm`)
    expect(preset('pipe').subtitle).toContain(`e=${pipe['wall_thickness_mm']}mm`)

    const plate = bundledSpec('plate')
    expect(preset('plate').subtitle).toContain(`${plate['width_mm']}x${plate['depth_mm']}mm`)
    expect(preset('plate').subtitle).toContain(`Taladro Ø${plate['center_hole_diameter_mm']}`)
  })
})
