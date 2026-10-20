import { defineConfig, devices, type ReporterDescription } from '@playwright/test'

import {
  API_ORIGIN_A,
  API_ORIGIN_B,
  BASE_URL,
  BUNDLE_A_DIR,
  BUNDLE_B_DIR,
  PREVIEW_HOST,
  PREVIEW_PORT,
  REPORT_DIR,
  RESULTS_DIR,
  SERVED_DIR,
} from './e2e/support/env.ts'

const onCi = Boolean(process.env['CI'])

const reporter: ReporterDescription[] = [
  ['list'],
  ['html', { outputFolder: REPORT_DIR, open: 'never' }],
]
// Annotations on the failing lines, where GitHub is the one reading them.
if (onCi) reporter.push(['github'])

/**
 * Browser-level tests (ADR-0009).
 *
 * Chromium only, against the production build served by `vite preview` on the
 * reserved port. The first project is a WebGL probe; the rest wait for it, so a
 * runner without WebGL fails once and clearly instead of in every spec.
 */
export default defineConfig({
  testDir: './e2e',
  outputDir: RESULTS_DIR,

  // One worker: the update spec swaps the bundle that every other spec is served.
  workers: 1,
  fullyParallel: false,
  forbidOnly: onCi,
  // A pass on retry is reported as flaky, and on CI a flaky test fails the run.
  retries: onCi ? 1 : 0,
  failOnFlakyTests: onCi,
  timeout: 30_000,
  globalTimeout: 10 * 60_000,
  expect: { timeout: 10_000 },

  reporter,

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'en-US',
    timezoneId: 'UTC',
  },

  projects: [
    {
      name: 'probe',
      testMatch: /webgl-probe\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium',
      testIgnore: /webgl-probe\.spec\.ts$/,
      dependencies: ['probe'],
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'node e2e/support/serve.mjs',
    url: BASE_URL,
    // Never adopt a server that is already there: the update spec rewrites what
    // is served, and a stale preview would be tested as if it were this build.
    reuseExistingServer: false,
    // Two production builds happen before the port opens.
    timeout: 240_000,
    stdout: 'pipe',
    stderr: 'pipe',
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
    env: {
      E2E_HOST: PREVIEW_HOST,
      E2E_PORT: String(PREVIEW_PORT),
      E2E_SERVED_DIR: SERVED_DIR,
      E2E_BUNDLE_A_DIR: BUNDLE_A_DIR,
      E2E_BUNDLE_B_DIR: BUNDLE_B_DIR,
      E2E_API_ORIGIN_A: API_ORIGIN_A,
      E2E_API_ORIGIN_B: API_ORIGIN_B,
    },
  },
})
