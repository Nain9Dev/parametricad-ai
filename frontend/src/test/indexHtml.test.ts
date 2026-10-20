import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

// @req REQ-UBI-10
// @req REQ-UBI-13

/** The suite runs from the `frontend/` root, so `index.html` sits in the cwd. */
const HTML = readFileSync(resolve(process.cwd(), 'index.html'), 'utf-8')

function metaContent(name: string): string | undefined {
  return new RegExp(`<meta\\s+name="${name}"\\s+content="([^"]*)"`, 'i').exec(HTML)?.[1]
}

function viewportContent(): string {
  const match = /<meta\s+name="viewport"\s+content="([^"]*)"/i.exec(HTML)
  expect(match, 'index.html must declare a viewport meta tag').toBeTruthy()
  return match?.[1] ?? ''
}

describe('REQ-UBI-13: the viewport tag serves touch devices', () => {
  it('extends the page under notches so safe-area insets can be honoured', () => {
    expect(viewportContent()).toContain('viewport-fit=cover')
  })

  it('resizes the layout, not just the visual viewport, when the soft keyboard opens', () => {
    expect(viewportContent()).toContain('interactive-widget=resizes-content')
  })

  it('never disables pinch-zoom', () => {
    const content = viewportContent()
    expect(content).not.toMatch(/user-scalable\s*=\s*(no|0)/i)
    expect(content).not.toMatch(/maximum-scale/i)
    expect(content).not.toMatch(/minimum-scale/i)
  })
})

describe('REQ-UBI-10: the page links the metadata that makes it installable', () => {
  it('links the web app manifest', () => {
    expect(HTML).toMatch(/<link\s+rel="manifest"\s+href="\/manifest\.webmanifest"/i)
  })

  it('links a 180 px Apple touch icon that exists', () => {
    const href = /<link\s+rel="apple-touch-icon"\s+href="([^"]+)"/i.exec(HTML)?.[1]
    expect(href, 'index.html must link an apple-touch-icon').toBeTruthy()

    const bytes = readFileSync(resolve(process.cwd(), 'public', String(href).replace(/^\//, '')))
    expect(bytes.readUInt32BE(16)).toBe(180)
    expect(bytes.readUInt32BE(20)).toBe(180)
  })

  it('declares standalone capability for Chrome and for iOS', () => {
    expect(metaContent('mobile-web-app-capable')).toBe('yes')
    expect(metaContent('apple-mobile-web-app-capable')).toBe('yes')
  })

  it('names the home-screen icon and keeps the iOS status bar dark', () => {
    expect(metaContent('apple-mobile-web-app-title')).toBe('ParametriCAD')
    expect(metaContent('apple-mobile-web-app-status-bar-style')).toBe('black')
  })
})

describe('REQ-UBI-14: third-party ecosystem assets stay out of the phone critical path', () => {
  it('does not let the brand stylesheet block first paint on a phone', () => {
    const link = /<link[^>]*brand\.naindev\.com\/tokens\.css[^>]*>/i.exec(HTML)
    expect(link, 'the brand tokens link must stay declared').toBeTruthy()
    expect(link?.[0]).toContain('media="(min-width: 640px)"')
  })
})
