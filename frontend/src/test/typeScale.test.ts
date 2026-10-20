import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

// @req REQ-UBI-17

/** The suite runs from the `frontend/` root. */
const SOURCE = resolve(process.cwd(), 'src')

/** The smallest text the interface may draw, in CSS pixels. */
const FLOOR_PX = 12

/** Every source file the interface is made of, tests excluded. */
function sources(directory: string = SOURCE): string[] {
  const files: string[] = []
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) files.push(...sources(path))
    else if (/\.(tsx?|css)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) files.push(path)
  }
  return files
}

/** A size written out in a class (`text-[0.625rem]`, `text-[10px]`) or a declaration, in CSS pixels. */
function sizesBelowTheFloor(text: string): string[] {
  const found: string[] = []
  for (const match of text.matchAll(/text-\[(\d*\.?\d+)(rem|px)\]/g)) {
    const [whole, amount, unit] = match
    if (!whole || !amount) continue
    const px = unit === 'rem' ? Number(amount) * 16 : Number(amount)
    if (px < FLOOR_PX) found.push(whole)
  }
  for (const match of text.matchAll(/font-size:\s*(\d*\.?\d+)(rem|px)/g)) {
    const [whole, amount, unit] = match
    if (!whole || !amount) continue
    const px = unit === 'rem' ? Number(amount) * 16 : Number(amount)
    if (px < FLOOR_PX) found.push(whole)
  }
  return found
}

describe('REQ-UBI-17: no text under 12 px', () => {
  it('writes no text size under the floor in any class or declaration', () => {
    const offenders = sources().flatMap((file) =>
      sizesBelowTheFloor(readFileSync(file, 'utf-8')).map(
        (size) => `${file.slice(SOURCE.length + 1)}: ${size}`,
      ),
    )
    expect(offenders).toEqual([])
  })
})
