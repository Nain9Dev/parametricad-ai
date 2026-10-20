import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

// @req REQ-UBI-12

// jsdom computes no layout, so the workspace is pinned down as a contract on
// the two files that define it. The rendered result is checked in a real
// browser (see specs/001-installable-mobile-app/plan.md, section 7).

const CSS = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf-8')
const APP = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf-8')

describe('REQ-UBI-12: the workspace re-flows by breakpoint', () => {
  it('stacks viewer, tabs and panel in one column by default', () => {
    expect(CSS).toMatch(
      /\.workspace\s*\{[^}]*grid-template-areas:\s*'viewer'\s*'tabs'\s*'panel'/,
    )
    expect(CSS).toMatch(
      /\.workspace\s*\{[^}]*grid-template-rows:\s*minmax\(16rem,\s*46dvh\)\s+auto\s+minmax\(0,\s*1fr\)/,
    )
  })

  it('places viewer and panel side by side in landscape on short viewports', () => {
    expect(CSS).toMatch(
      /@media\s*\(orientation:\s*landscape\)\s*and\s*\(height\s*<=\s*34rem\)\s*and\s*\(width\s*<\s*64rem\)\s*\{[\s\S]*?grid-template-areas:\s*'viewer tabs'\s*'viewer panel'/,
    )
  })

  it('keeps the three-column workspace from 1024 px up', () => {
    expect(CSS).toMatch(
      /@media\s*\(min-width:\s*64rem\)\s*\{[\s\S]*?grid-template-columns:\s*17rem\s+minmax\(0,\s*1fr\)\s+17rem[\s\S]*?grid-template-areas:\s*'inputs viewer report'/,
    )
    expect(CSS).toMatch(
      /@media\s*\(min-width:\s*80rem\)\s*\{[\s\S]*?grid-template-columns:\s*20rem\s+minmax\(0,\s*1fr\)\s+21rem/,
    )
  })

  it('does not scroll the page: the shell is one dynamic viewport tall', () => {
    expect(APP).toMatch(/app-shell[^"]*\bh-dvh\b[^"]*\boverflow-hidden\b/)
  })

  it('keeps the end of each scrolling panel clear of the home indicator', () => {
    const padded = APP.match(/pb-\[calc\(0\.75rem\+env\(safe-area-inset-bottom\)\)\]/g) ?? []
    expect(padded).toHaveLength(2)
  })

  it('no longer sizes the viewer with a fixed height of its own', () => {
    expect(APP).not.toContain('h-[55vh]')
  })

  it('uses the same 1024 px threshold in script as the stylesheet', () => {
    expect(APP).toContain("const WIDE_QUERY = '(min-width: 64rem)'")
    expect(APP).toContain('useMediaQuery(WIDE_QUERY)')
  })
})
