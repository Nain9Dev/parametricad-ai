import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

// @req REQ-DEP-03
// @req REQ-DEP-04

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

interface HostTarget {
  id: string
  layer: string
  origin: string
  health_path: string
  free: boolean
  cold_start: boolean
  cost_eur: number
  sleeps: boolean
}

interface HostManifest {
  targets: HostTarget[]
}

// The deployment contract is a cross-file one: the cold-start budget lives in
// the web client, the API origin in `vercel.json` and the host list in
// `deploy/hosts.json`. This suite asserts the three still agree.

const ROOT = process.cwd()
const HOOK_SOURCE = readFileSync(resolve(ROOT, 'src/lib/hooks/useCatalog.ts'), 'utf-8')
const CLIENT_SOURCE = readFileSync(resolve(ROOT, 'src/lib/apiClient.ts'), 'utf-8')
const VERCEL_CONFIG = JSON.parse(
  readFileSync(resolve(ROOT, 'vercel.json'), 'utf-8'),
) as VercelConfig
const HOSTS = JSON.parse(
  readFileSync(resolve(ROOT, '../deploy/hosts.json'), 'utf-8'),
) as unknown as HostManifest

const CONNECT_ORIGIN_RE = /https:\/\/[a-z0-9.-]+\.[a-z]{2,}/i

function slowLoadMs(): number {
  const match = /export const SLOW_LOAD_MS = (\d+\w*)/.exec(HOOK_SOURCE)
  expect(match, 'the cold-start threshold must stay a named export in useCatalog.ts').toBeTruthy()
  return Number(match?.[1]?.replaceAll('_', ''))
}

function retryBackoffMs(): number[] {
  const match = /backoffMs: readonly number\[\] = \[([^\]]+)\]/.exec(CLIENT_SOURCE)
  expect(match, 'the retry backoff must stay a named literal in apiClient.ts').toBeTruthy()
  return (match?.[1] ?? '')
    .split(',')
    .map((item) => Number(item.trim().replace(/_/g, '')))
}

function cspConnectHttpsOrigins(): string[] {
  const csp = VERCEL_CONFIG.headers
    .find((block) => block.source === '/(.*)')
    ?.headers.find((header) => header.key === 'Content-Security-Policy')
  const connectMatch = /connect-src\s+([^;]+);/.exec(csp?.value ?? '')
  expect(connectMatch, 'the CSP must keep a single connect-src directive').toBeTruthy()
  return connectMatch?.[1]?.match(CONNECT_ORIGIN_RE) ?? []
}

describe('REQ-DEP-03: the first catalogue response settles inside 30 seconds', () => {
  it('discloses a slow first load well before the budget expires', () => {
    const slowLoad = slowLoadMs()
    expect(Number.isFinite(slowLoad)).toBe(true)
    expect(slowLoad).toBeGreaterThan(0)
    expect(slowLoad).toBeLessThanOrEqual(10_000)
  })

  it('exhausts the retry backoff before the budget expires', () => {
    const backoff = retryBackoffMs()
    expect(backoff.length).toBeGreaterThan(0)
    expect(backoff.every((ms) => ms > 0)).toBe(true)
    // Four attempts (initial + three retries) plus the backoff waits must
    // settle inside the 30 s catalogue budget.
    expect(backoff.reduce((total, ms) => total + ms, 0)).toBeLessThanOrEqual(20_000)
  })
})

describe('REQ-DEP-04: exactly one external API origin, declared in every required place', () => {
  it('names exactly one https API origin in the CSP connect-src', () => {
    expect(cspConnectHttpsOrigins()).toHaveLength(1)
  })

  it('points the CSP origin at the manifest compute host', () => {
    const [cspOrigin] = cspConnectHttpsOrigins()
    const compute = HOSTS.targets.find((target) => target.layer === 'compute')
    expect(compute, 'deploy/hosts.json must declare a compute layer').toBeDefined()
    expect(compute?.origin).toBe(cspOrigin)
    expect(compute?.free).toBe(true)
    expect(compute?.cost_eur).toBe(0)
  })
})
