import { cpSync, rmSync } from 'node:fs'

import { BUNDLE_A_DIR, BUNDLE_B_DIR, SERVED_DIR } from './env.ts'

/**
 * Choose which of the two builds `vite preview` serves.
 *
 * The preview reads its directory on every request, so replacing the files is
 * enough to "deploy" a release while the browser still holds the old one. This is
 * the only way to stage an update: Playwright cannot route the browser's check of
 * the service worker script (docs, Service Workers).
 */
export function serveBundle(release: 'a' | 'b'): void {
  rmSync(SERVED_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  cpSync(release === 'a' ? BUNDLE_A_DIR : BUNDLE_B_DIR, SERVED_DIR, { recursive: true })
}
