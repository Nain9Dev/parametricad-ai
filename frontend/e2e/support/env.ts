import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Where the browser tests run and what they build (ADR-0009).
 *
 * The port is the one this project reserves for `vite preview`
 * (`docs/10-runbook.md`, section 1): never 5173 or 8000, and never reused. A
 * preview someone left running has to fail the run, not be tested by mistake.
 * The host is pinned so Windows and Linux agree on the address.
 */
export const PREVIEW_HOST = '127.0.0.1'
export const PREVIEW_PORT = 5301
export const BASE_URL = `http://${PREVIEW_HOST}:${PREVIEW_PORT}`

export const FRONTEND_DIR = fileURLToPath(new URL('../../', import.meta.url))

/** Everything the suite generates lives here, inside the ignored `node_modules`. */
const CACHE_DIR = join(FRONTEND_DIR, 'node_modules', '.cache', 'parametricad-e2e')

/** What `vite preview` serves, and the two builds it is filled from. */
export const SERVED_DIR = join(CACHE_DIR, 'served')
export const BUNDLE_A_DIR = join(CACHE_DIR, 'bundle-a')
export const BUNDLE_B_DIR = join(CACHE_DIR, 'bundle-b')
export const REPORT_DIR = join(CACHE_DIR, 'report')
export const RESULTS_DIR = join(CACHE_DIR, 'results')

/**
 * The generation service as the two builds know it.
 *
 * `.invalid` never resolves (RFC 2606), and every request to these origins is
 * aborted by the fixtures before it leaves the browser, so no test can reach a
 * real service. The origins differ between the builds so that two bundles of the
 * same sources differ in content, which is what a new release looks like to the
 * service worker, and so a test can tell which build is running.
 */
export const API_ORIGIN_A = 'http://api-a.e2e.invalid'
export const API_ORIGIN_B = 'http://api-b.e2e.invalid'
export const API_ORIGIN_PATTERN = /^http:\/\/api-[ab]\.e2e\.invalid\//
