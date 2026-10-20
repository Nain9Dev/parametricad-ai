import { describe, expect, it } from 'vitest'

import { parseProjectSpec, readProjectFile } from '@/lib/projectFile'

// @req REQ-UBI-12

const SPEC = {
  kind: 'pipe',
  material: 'stainless_steel',
  outer_diameter_mm: 25,
  wall_thickness_mm: 2.5,
  length_mm: 200,
}

describe('parseProjectSpec', () => {
  it('reads the full project written by Save project', () => {
    const text = JSON.stringify({ app: 'ParametriCAD AI', model: { spec: SPEC } })
    expect(parseProjectSpec(text)).toEqual(SPEC)
  })

  it('reads a bare spec wrapper', () => {
    expect(parseProjectSpec(JSON.stringify({ spec: SPEC }))).toEqual(SPEC)
  })

  it('reads the specification itself', () => {
    expect(parseProjectSpec(JSON.stringify(SPEC))).toEqual(SPEC)
  })

  it('ignores text that is not JSON', () => {
    expect(parseProjectSpec('not json')).toBeNull()
  })

  it('ignores JSON that does not describe a component', () => {
    expect(parseProjectSpec(JSON.stringify({ hello: 'world' }))).toBeNull()
    expect(parseProjectSpec(JSON.stringify([1, 2, 3]))).toBeNull()
    expect(parseProjectSpec('42')).toBeNull()
    expect(parseProjectSpec('null')).toBeNull()
  })
})

describe('readProjectFile', () => {
  it('reads the specification out of a picked file', async () => {
    const file = new File([JSON.stringify({ model: { spec: SPEC } })], 'project.json')
    await expect(readProjectFile(file)).resolves.toEqual(SPEC)
  })

  it('resolves to null for a file that is not a project', async () => {
    await expect(readProjectFile(new File(['nope'], 'notes.json'))).resolves.toBeNull()
  })
})
