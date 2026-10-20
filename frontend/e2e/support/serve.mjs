// Builds the two bundles the browser tests need, then serves one of them with
// `vite preview` (ADR-0009). Playwright starts this through `webServer` and waits
// for the port, so `npx playwright test` is the only command anyone runs.
//
// Plain JavaScript on purpose: Playwright runs it as a separate process, outside
// its own TypeScript loader. Every path, port and origin comes from the
// environment that `playwright.config.ts` sets from `e2e/support/env.ts`, which
// stays the one place they are written down.
import { cpSync, rmSync } from 'node:fs'

import { build, preview } from 'vite'

function required(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is not set. Run the suite through Playwright (npm run test:e2e).`)
  }
  return value
}

const host = required('E2E_HOST')
const port = Number(required('E2E_PORT'))
const served = required('E2E_SERVED_DIR')
const bundleA = required('E2E_BUNDLE_A_DIR')
const bundleB = required('E2E_BUNDLE_B_DIR')
const apiOriginA = required('E2E_API_ORIGIN_A')
const apiOriginB = required('E2E_API_ORIGIN_B')

/**
 * One production build, with the service pointed at `apiOrigin`.
 *
 * A value already in the environment outranks `.env.local`, so a developer's own
 * API address can never end up in the bundle under test.
 */
async function buildBundle(outDir, apiOrigin) {
  process.env.VITE_API_URL = apiOrigin
  await build({ logLevel: 'warn', build: { outDir, emptyOutDir: true } })
}

await buildBundle(bundleA, apiOriginA)
await buildBundle(bundleB, apiOriginB)

rmSync(served, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
cpSync(bundleA, served, { recursive: true })

const server = await preview({
  logLevel: 'info',
  build: { outDir: served },
  preview: { host, port, strictPort: true },
})
server.printUrls()

async function shutdown() {
  await server.close()
  process.exit(0)
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
