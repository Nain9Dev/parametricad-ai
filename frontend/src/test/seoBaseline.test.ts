import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { pwaOptions } from '../../pwa.config'

// @req REQ-UBI-20
// @req REQ-UBI-21

const HOST_ROOT = 'https://parametricad.naindev.com/'
const AUTHOR_ID = 'https://www.naindev.com/#person'

/** The suite runs from the `frontend/` root, so `index.html` and `public/` sit in the cwd. */
const HTML = readFileSync(resolve(process.cwd(), 'index.html'), 'utf-8')

function publicFile(name: string): string {
  return readFileSync(resolve(process.cwd(), 'public', name), 'utf-8')
}

function all(pattern: RegExp): string[] {
  return [...HTML.matchAll(pattern)].map((match) => match[1] ?? '')
}

function meta(attribute: 'name' | 'property', key: string): string[] {
  return all(new RegExp(`<meta\\s+${attribute}="${key}"\\s+content="([^"]*)"`, 'gi'))
}

/** Multi-line tags put each attribute on its own line, so whitespace is collapsed first. */
function metaFlat(attribute: 'name' | 'property', key: string): string[] {
  const flat = HTML.replace(/\s+/g, ' ')
  return [...flat.matchAll(new RegExp(`<meta ${attribute}="${key}" content="([^"]*)"`, 'gi'))].map(
    (match) => match[1] ?? '',
  )
}

describe('REQ-UBI-20: the static page carries the discoverability metadata', () => {
  it('declares exactly one canonical link equal to the host root', () => {
    expect(all(/<link\s+rel="canonical"\s+href="([^"]*)"/gi)).toEqual([HOST_ROOT])
  })

  it('has a descriptive title of 30 to 65 characters', () => {
    const titles = all(/<title>([^<]*)<\/title>/gi)
    expect(titles).toHaveLength(1)
    expect(titles[0]?.length).toBeGreaterThanOrEqual(30)
    expect(titles[0]?.length).toBeLessThanOrEqual(65)
  })

  it('has exactly one description of 70 to 160 characters', () => {
    const descriptions = metaFlat('name', 'description')
    expect(descriptions).toHaveLength(1)
    expect(descriptions[0]?.length).toBeGreaterThanOrEqual(70)
    expect(descriptions[0]?.length).toBeLessThanOrEqual(160)
  })

  it('exposes Open Graph tags whose url equals the canonical', () => {
    expect(meta('property', 'og:type')).toEqual(['website'])
    expect(meta('property', 'og:url')).toEqual([HOST_ROOT])
    expect(meta('property', 'og:site_name')).toHaveLength(1)
    expect(meta('property', 'og:title')).toHaveLength(1)
    expect(metaFlat('property', 'og:description')).toHaveLength(1)
    const image = meta('property', 'og:image')
    expect(image).toHaveLength(1)
    expect(image[0]).toMatch(/^https:\/\//)
  })

  it('serves the Open Graph image the page points at', () => {
    const image = meta('property', 'og:image')[0] ?? ''
    expect(image.startsWith(HOST_ROOT)).toBe(true)
    const bytes = readFileSync(resolve(process.cwd(), 'public', image.slice(HOST_ROOT.length)))
    expect(bytes.readUInt32BE(16)).toBe(1200)
    expect(bytes.readUInt32BE(20)).toBe(630)
  })

  it('declares a large-image Twitter card', () => {
    expect(meta('name', 'twitter:card')).toEqual(['summary_large_image'])
    expect(meta('name', 'twitter:title')).toHaveLength(1)
    expect(metaFlat('name', 'twitter:description')).toHaveLength(1)
    expect(meta('name', 'twitter:image')).toHaveLength(1)
  })

  it('links the author to the main site', () => {
    expect(all(/<link\s+rel="author"\s+href="([^"]*)"/gi)).toEqual(['https://www.naindev.com/'])
  })

  it('embeds one SoftwareApplication JSON-LD block that names the author', () => {
    const blocks = all(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).not.toContain('<')

    const data = JSON.parse(blocks[0] ?? '') as Record<string, unknown> & {
      author: { '@id': string }
    }
    expect(data['@type']).toBe('SoftwareApplication')
    expect(data.url).toBe(HOST_ROOT)
    expect(data.isAccessibleForFree).toBe(true)
    expect(data.author['@id']).toBe(AUTHOR_ID)
    expect(data.sameAs).toBe('https://github.com/Nain9Dev/parametricad-ai')
  })
})

describe('REQ-UBI-21: the site root serves the crawl files', () => {
  it('robots.txt allows everything and advertises the sitemap', () => {
    const robots = publicFile('robots.txt')
    expect(robots).toMatch(/^User-agent: \*$/m)
    expect(robots).toMatch(/^Allow: \/$/m)
    expect(robots).not.toMatch(/^Disallow: *\S/m)
    expect(robots).toContain(`Sitemap: ${HOST_ROOT}sitemap.xml`)
  })

  it('sitemap.xml lists the canonical root', () => {
    const locations = [...publicFile('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map(
      (match) => match[1],
    )
    expect(locations).toEqual([HOST_ROOT])
  })

  it('the service worker never answers a crawl file with the app shell', () => {
    const denied = (path: string) =>
      (pwaOptions.workbox?.navigateFallbackDenylist ?? []).some((pattern) => pattern.test(path))
    expect(denied('/robots.txt')).toBe(true)
    expect(denied('/sitemap.xml')).toBe(true)
    expect(denied('/llms.txt')).toBe(true)
    expect(denied('/')).toBe(false)
  })

  it('llms.txt starts with an H1 followed by a summary and links', () => {
    const lines = publicFile('llms.txt').split(/\r?\n/)
    expect(lines[0]).toBe('# ParametriCAD AI')
    expect(lines.some((line) => line.startsWith('> '))).toBe(true)
    expect(lines.some((line) => line.includes('https://www.naindev.com/'))).toBe(true)
  })
})
