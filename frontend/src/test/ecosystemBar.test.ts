import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

// @req REQ-UBI-14

const CSS = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf-8')
const APP = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf-8')

/** The media block that applies where the bar is not shown. */
const HIDING_BLOCK =
  /@media\s*\(width\s*<\s*40rem\),\s*\(height\s*<=\s*34rem\),\s*\(display-mode:\s*standalone\),\s*\(display-mode:\s*minimal-ui\),\s*\(display-mode:\s*fullscreen\)\s*\{([\s\S]*?)\n\}/

describe('REQ-UBI-14: the ecosystem bar never covers the application header', () => {
  it('reserves the pinned bar height by default', () => {
    expect(CSS).toMatch(/:root\s*\{[^}]*--ecosystem-bar-height:\s*38px/)
  })

  it('releases the space and hides the bar on narrow and short screens and in the installed app', () => {
    const block = HIDING_BLOCK.exec(CSS)
    expect(block, 'the hiding media block must stay declared in index.css').toBeTruthy()
    expect(block?.[1]).toMatch(/--ecosystem-bar-height:\s*0px/)
    expect(block?.[1]).toMatch(/nain-ecosystem-bar\s*\{[^}]*display:\s*none/)
  })

  it('pads the application shell by the reserved height', () => {
    expect(CSS).toMatch(/\.app-shell\s*\{[^}]*padding-top:\s*var\(--ecosystem-bar-height\)/)
    expect(APP).toContain('app-shell')
  })
})
