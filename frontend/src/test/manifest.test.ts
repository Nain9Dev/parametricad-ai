import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

// @req REQ-UBI-10

// What Chrome checks before it offers Install app: a manifest with a name, a
// start URL inside its scope, a display mode of its own, and a 192 px and a
// 512 px icon. The manifest is static and hand-written (ADR-0007), so the whole
// contract can be read straight off the files.

interface ManifestIcon {
  src: string
  sizes: string
  type: string
  purpose?: string
}

interface Manifest {
  id: string
  name: string
  short_name: string
  lang: string
  start_url: string
  scope: string
  display: string
  orientation?: string
  theme_color: string
  background_color: string
  prefer_related_applications?: boolean
  icons: ManifestIcon[]
}

const ROOT = process.cwd()
const manifest = JSON.parse(
  readFileSync(resolve(ROOT, 'public/manifest.webmanifest'), 'utf-8'),
) as Manifest
const html = readFileSync(resolve(ROOT, 'index.html'), 'utf-8')
const css = readFileSync(resolve(ROOT, 'src/index.css'), 'utf-8')

const PNG_SIGNATURE = '89504e470d0a1a0a'
const COLOUR_TYPE_RGB = 2

/** Width, height and colour type of a PNG, read from its header without decoding it. */
function pngHeader(path: string) {
  const bytes = readFileSync(path)
  expect(bytes.subarray(0, 8).toString('hex'), `${path} must be a PNG`).toBe(PNG_SIGNATURE)
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), colourType: bytes[25] }
}

/** A manifest icon `src` such as `/icons/icon-192.png` lives under `public/`. */
function iconPath(icon: ManifestIcon): string {
  return resolve(ROOT, 'public', icon.src.replace(/^\//, ''))
}

describe('REQ-UBI-10: the manifest lets Chrome offer to install the app', () => {
  it('names the application', () => {
    expect(manifest.name).toBe('ParametriCAD AI')
    expect(manifest.short_name).toBe('ParametriCAD')
    // Android truncates a launcher label at about twelve characters.
    expect(manifest.short_name.length).toBeLessThanOrEqual(12)
    expect(manifest.lang).toBe('en')
  })

  it('opens inside its own scope as a standalone app, in any orientation', () => {
    expect(manifest.id).toBe('/')
    expect(manifest.scope).toBe('/')
    expect(manifest.start_url.startsWith(manifest.scope)).toBe(true)
    expect(manifest.display).toBe('standalone')
    expect(manifest.orientation ?? 'any').toBe('any')
  })

  it('does not send the user to a store instead', () => {
    expect(manifest.prefer_related_applications ?? false).toBe(false)
  })

  it("uses the interface's base colour for the splash and the system bar", () => {
    const base = /--color-void:\s*(#[0-9a-f]{6})/i.exec(css)?.[1]
    const meta = /<meta\s+name="theme-color"\s+content="([^"]+)"/i.exec(html)?.[1]

    expect(base, 'index.css must declare --color-void').toBeTruthy()
    expect(manifest.theme_color.toLowerCase()).toBe(base?.toLowerCase())
    expect(manifest.background_color.toLowerCase()).toBe(base?.toLowerCase())
    expect(meta?.toLowerCase()).toBe(base?.toLowerCase())
  })

  it('declares a 192 px and a 512 px icon, and a separate maskable 512 px icon', () => {
    const plain = manifest.icons.filter((icon) => (icon.purpose ?? 'any') === 'any')
    const maskable = manifest.icons.filter((icon) => icon.purpose === 'maskable')

    expect(plain.map((icon) => icon.sizes).sort()).toEqual(['192x192', '512x512'])
    expect(maskable.map((icon) => icon.sizes)).toEqual(['512x512'])
  })

  it('never combines purposes in one icon, which makes Android crop the plain one', () => {
    for (const icon of manifest.icons) {
      expect(icon.purpose ?? 'any').not.toContain(' ')
    }
  })

  it('points every icon at a PNG of exactly the size it declares', () => {
    for (const icon of manifest.icons) {
      expect(icon.type).toBe('image/png')
      const [width, height] = icon.sizes.split('x').map(Number)
      expect(pngHeader(iconPath(icon)), icon.src).toMatchObject({ width, height })
    }
  })

  it('draws the maskable icon edge to edge, with no transparent corners to be cropped', () => {
    const maskable = manifest.icons.find((icon) => icon.purpose === 'maskable')
    expect(maskable).toBeDefined()
    if (maskable) expect(pngHeader(iconPath(maskable)).colourType).toBe(COLOUR_TYPE_RGB)
  })
})
