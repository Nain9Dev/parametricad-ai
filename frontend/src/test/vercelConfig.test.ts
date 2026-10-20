import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

// @req REQ-UBI-04
// @req REQ-DEP-06

interface HeaderEntry {
  key: string
  value: string
}

interface HeadersBlock {
  source: string
  headers: HeaderEntry[]
}

interface VercelConfig {
  headers: HeadersBlock[]
}

/**
 * The suite runs from the `frontend/` root, so the deployment config sits in
 * the working directory. It is resolved from the cwd rather than
 * `import.meta.url` because under Vitest module URLs no longer carry the
 * `file:` scheme and `fileURLToPath` refuses them.
 */
const CONFIG_PATH = resolve(process.cwd(), 'vercel.json')
const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) as VercelConfig

describe('vercel.json security headers', () => {
  it('serves a restrictive Content-Security-Policy', () => {
    const csp = config.headers
      .find((block) => block.source === '/(.*)')
      ?.headers.find((header) => header.key === 'Content-Security-Policy')

    expect(csp).toBeDefined()
    expect(csp?.value).toContain("default-src 'self'")
    expect(csp?.value).toContain("script-src 'self'")
    expect(csp?.value).toContain("object-src 'none'")
    expect(csp?.value).toContain('connect-src')
  })

  it('advertises immutable caching for built assets', () => {
    const cacheControl = config.headers
      .find((block) => block.source === '/assets/(.*)')
      ?.headers.find((header) => header.key === 'Cache-Control')

    expect(cacheControl?.value).toContain('immutable')
  })
})

function headerFor(source: string, key: string): string | undefined {
  return config.headers
    .find((block) => block.source === source)
    ?.headers.find((header) => header.key.toLowerCase() === key.toLowerCase())?.value
}

describe('REQ-DEP-06: a release reaches clients that installed the app', () => {
  // The worker and the manifest keep fixed names, so a cached copy would pin an
  // installed client to an old release. The hashed files under /assets/ are the
  // ones that are safe to cache forever.
  it('serves the service worker script without letting it be cached', () => {
    expect(headerFor('/sw.js', 'Cache-Control')).toContain('no-cache')
  })

  it('serves the manifest without letting it be cached, and as a manifest', () => {
    expect(headerFor('/manifest.webmanifest', 'Cache-Control')).toContain('no-cache')
    expect(headerFor('/manifest.webmanifest', 'Content-Type')).toBe('application/manifest+json')
  })

  it('keeps the policy open to the worker and the manifest, and to nothing wider', () => {
    const csp = headerFor('/(.*)', 'Content-Security-Policy') ?? ''

    expect(csp).toContain("worker-src 'self'")
    expect(csp).toContain("manifest-src 'self'")
    expect(csp).not.toMatch(/(worker|manifest)-src[^;]*\*/)
  })
})
