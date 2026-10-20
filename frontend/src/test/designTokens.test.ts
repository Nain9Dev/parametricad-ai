import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

// @req REQ-UBI-16

/** The suite runs from the `frontend/` root. */
const SOURCE = resolve(process.cwd(), 'src')

const STYLESHEET = readFileSync(join(SOURCE, 'index.css'), 'utf-8')

/** The `--color-*` tokens declared in the `@theme` block, as hex values. */
function tokens(): Record<string, string> {
  const found: Record<string, string> = {}
  for (const match of STYLESHEET.matchAll(/--color-([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    const [, name, value] = match
    if (name && value) found[name] = value
  }
  return found
}

function channels(hex: string): [number, number, number] {
  return [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16)) as [number, number, number]
}

function luminance(hex: string): number {
  const [red, green, blue] = channels(hex).map((value) => {
    const scaled = value / 255
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

/** The WCAG 2 contrast ratio of two colours. */
function contrast(first: string, second: string): number {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a) as [number, number]
  return (lighter + 0.05) / (darker + 0.05)
}

/** WCAG 2.2 level AA for text below 24 px. */
const AA = 4.5

const SURFACES = ['void', 'surface', 'raised', 'overlay'] as const
const TEXT = ['ink', 'ink-muted', 'ink-faint', 'accent', 'valid', 'warn', 'invalid'] as const

function token(name: string): string {
  const value = tokens()[name]
  if (!value) throw new Error(`The token --color-${name} is not declared in index.css.`)
  return value
}

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

describe('REQ-UBI-16: the colour tokens reach AA contrast', () => {
  describe.each(TEXT)('the %s text colour', (name) => {
    it.each(SURFACES)(`over the %s surface`, (surface) => {
      expect(contrast(token(name), token(surface))).toBeGreaterThanOrEqual(AA)
    })
  })

  it('reads white ink over the accent fill and over its hover colour', () => {
    expect(contrast(token('accent-ink'), token('accent-fill'))).toBeGreaterThanOrEqual(AA)
    expect(contrast(token('accent-ink'), token('accent-fill-hover'))).toBeGreaterThanOrEqual(AA)
  })

  it('never puts white text on the plain accent, which is a text and border colour', () => {
    const offenders = sources().filter((file) =>
      /bg-accent(?![-/\w])[^'"`]*text-(accent-ink|white)|text-(accent-ink|white)[^'"`]*bg-accent(?![-/\w])/.test(
        readFileSync(file, 'utf-8'),
      ),
    )
    expect(offenders.map((file) => file.slice(SOURCE.length + 1))).toEqual([])
  })
})
