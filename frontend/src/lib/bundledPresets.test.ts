import { describe, expect, it } from 'vitest'

import {
  bundledKindForPrompt,
  bundledKindForSpec,
  normalisePrompt,
  specsEqual,
} from '@/lib/bundledPresets'
import { SHOWCASE_PRESETS } from '@/lib/presets'
import type { ComponentSpec } from '@/types/api'

// @req REQ-UNW-04

function showcase(id: string) {
  const preset = SHOWCASE_PRESETS.find((candidate) => candidate.id === id)
  if (!preset) throw new Error(`The showcase preset "${id}" is missing.`)
  return preset
}

const FLANGE = showcase('flange').spec

describe('specsEqual', () => {
  it('is true for the same keys and values, whatever their order', () => {
    const reordered = Object.fromEntries(Object.entries(FLANGE).reverse()) as ComponentSpec
    expect(specsEqual(FLANGE, { ...FLANGE })).toBe(true)
    expect(specsEqual(FLANGE, reordered)).toBe(true)
  })

  it('is false when a value differs', () => {
    expect(specsEqual(FLANGE, { ...FLANGE, outer_diameter_mm: 150 })).toBe(false)
  })

  it('is false when a value has a different type', () => {
    expect(specsEqual(FLANGE, { ...FLANGE, outer_diameter_mm: '100' })).toBe(false)
  })

  it('is false when a key is extra or missing', () => {
    expect(specsEqual(FLANGE, { ...FLANGE, extra_mm: 1 })).toBe(false)
    const { bore_diameter_mm: _removed, ...withoutBore } = FLANGE
    expect(specsEqual(FLANGE, withoutBore as ComponentSpec)).toBe(false)
  })
})

describe('bundledKindForSpec', () => {
  it.each(['flange', 'elbow', 'pipe', 'plate'] as const)(
    'recognises the %s showcase specification',
    (id) => {
      expect(bundledKindForSpec(showcase(id).spec)).toBe(id)
    },
  )

  it('does not recognise a specification that differs by one value', () => {
    expect(bundledKindForSpec({ ...FLANGE, thickness_mm: 13 })).toBeNull()
  })

  it('does not recognise a kind that has no bundled model', () => {
    expect(bundledKindForSpec({ kind: 'tee', material: 'stainless_steel' })).toBeNull()
  })
})

describe('bundledKindForPrompt', () => {
  const promptText = showcase('prompt').promptText ?? ''

  it('recognises the showcase prompt', () => {
    expect(bundledKindForPrompt(promptText)).toBe('pipe')
  })

  it('ignores case and spacing', () => {
    expect(bundledKindForPrompt(`  ${promptText.toUpperCase().replace(/ /g, '   ')}\n`)).toBe(
      'pipe',
    )
  })

  it('does not guess for any other prompt', () => {
    expect(bundledKindForPrompt('Brida de acero con 8 pernos')).toBeNull()
    expect(bundledKindForPrompt('flange')).toBeNull()
    expect(bundledKindForPrompt('')).toBeNull()
  })
})

describe('normalisePrompt', () => {
  it('trims, collapses whitespace and lowercases', () => {
    expect(normalisePrompt('  Tubo   DE\tacero \n')).toBe('tubo de acero')
  })
})
