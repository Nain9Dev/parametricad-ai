import type { VitePWAOptions } from 'vite-plugin-pwa'

/**
 * Service worker settings (ADR-0007).
 *
 * Kept in a module of its own so a test can read the contract these options
 * state: what is precached, that nothing is cached at runtime, and that a new
 * version waits for the user. `src/test/pwaConfig.test.ts` holds it, and
 * `npm run verify:pwa` checks what the built worker really lists.
 *
 * To retire a worker that already reached users, set `selfDestroying` to `true`
 * and deploy: the generated worker unregisters itself and deletes every cache
 * (`docs/10-runbook.md`, section 6).
 */
export const pwaOptions: Partial<VitePWAOptions> = {
  strategies: 'generateSW',
  // A new worker waits until the user accepts, so a reload never discards an
  // edit in progress. `usePwaUpdate` carries out the registration.
  registerType: 'prompt',
  injectRegister: false,
  // The manifest is a static, hand-written file (`public/manifest.webmanifest`).
  manifest: false,
  selfDestroying: false,
  devOptions: { enabled: false },
  workbox: {
    // The build output and the four bundled presets. The presets are what make
    // the installed app useful with no connection.
    globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}', 'presets/*.{json,glb}'],
    // The link-preview image is for crawlers, not for an installed client.
    globIgnores: ['og-image.png'],
    navigateFallback: '/index.html',
    // The generation API is cross-origin today. Keeping these paths out of the
    // fallback means a future same-origin API is never answered with the shell.
    navigateFallbackDenylist: [/^\/api\//, /^\/static\//, /^\/health/],
    cleanupOutdatedCaches: true,
    clientsClaim: true,
    // Nothing is cached at runtime: no API response, no artifact, no third-party
    // asset. An installed client never holds geometry the user generated.
    runtimeCaching: [],
    // Workbox's own default, stated so a growing chunk fails the build check
    // instead of silently dropping out of the precache.
    maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
  },
}
