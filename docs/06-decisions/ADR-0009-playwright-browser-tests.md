# ADR-0009: Browser-level tests with Playwright for the PWA and the compact layout

- **Status**: Accepted (approved 2026-10-20 by the user in session, TSK-30, as written)
- **Date**: 2026-10-20
- **Resolves**: `docs/03-open-questions.md` item 6, the follow-up that ADR-0007 left open ("automated browser-level tests (Playwright) ... need their own ADR")
- **Relates to**: REQ-UBI-10 to REQ-UBI-14, REQ-EVT-06, REQ-EVT-07, REQ-STA-04, REQ-UNW-04 (what the tests prove); REQ-DEP-01 (zero cost); REQ-UBI-05 (reserved ports); ADR-0007 (worker and offline scope); ADR-0008 (fallback)

## Context

Spec 001 shipped an installable PWA, a service worker and a compact mobile workspace. Vitest with jsdom cannot run a service worker or compute layout, so what depends on a real browser was checked once by hand on 2026-10-19 and recorded as prose (`specs/001-installable-mobile-app/tasks.md`, Handoff; the "manual:" cells of `docs/09-traceability.md`):

- offline start: the worker active and controlling, and the shell and the four presets served with the preview server stopped;
- update flow: the old worker keeps the old version until Reload is chosen;
- layout at 320, 360, 375, 812 x 375, 768 x 1 024 and 1 280 x 800: no horizontal overflow, viewer visible, compact toolbar fitting, header not covered by the ecosystem bar;
- touch targets: none under 44 px on the four tabs and in the View sheet;
- the stopped-API edit: the previous model stays and the connection notice appears.

The jsdom tests beside them check class names and CSS text (`touchTargets.test.tsx`, `ecosystemBar.test.ts`): they prove intent, not what renders. Nothing repeats the manual checks after a change, and the likely breakers are routine: Dependabot proposes npm bumps every week, and `vite-plugin-pwa`, Workbox, Tailwind and Vite are among them.

Facts that shape the decision (checked 2026-10-20):

- **The tool.** `@playwright/test` 1.64.1 (npm `latest`, published 2026-10-14), Apache-2.0, Node 20 or later (CI uses 22). The tree is `@playwright/test`, `playwright` and `playwright-core` (13.7 MB unpacked) and nothing else. None declares an install script, so `npm ci` downloads no browser and the Vercel build is unaffected.
- **The browser download.** `playwright install` fetches Chrome for Testing 156.0.8078.4 from `cdn.playwright.dev`, with no account or key. Archive sizes on Linux x64: headless shell 120 MiB, full Chromium 191 MiB, ffmpeg 2.2 MiB. `--only-shell` installs the shell alone. Everything lands in the browser cache (`PLAYWRIGHT_BROWSERS_PATH` when set, otherwise `%LOCALAPPDATA%\ms-playwright` on Windows and `~/.cache/ms-playwright` on Linux), never in the repository. The development machine already holds this revision (1248) under `PLAYWRIGHT_BROWSERS_PATH`, so only a CI run downloads it.
- **CI cost.** The repository is public, and GitHub documents standard hosted runners as free for public repositories (GitHub Docs, Actions billing); a private repository on the Free plan would get 2 000 minutes a month. Baseline, CI run 39312545405 (2026-10-19, before spec 001 added `npm test` and `verify:pwa`): Backend CI 87 s, Frontend CI 29 s (install 5 s, lint 1 s, typecheck 4 s, build 5 s). Playwright's CI guide advises against caching browser binaries (restoring takes about as long as downloading, and the OS packages cannot be cached), one worker on CI, a global timeout and uploading the report as an artifact.
- **WebGL.** The viewer needs a WebGL context, and hosted runners have no GPU, so headless Chromium must render in software with SwiftShader. Chromium deprecated the automatic SwiftShader fallback for WebGL; opting in with `--enable-unsafe-swiftshader` "will still be supported" but "is not intended for running untrusted content" (Chromium `docs/gpu/swiftshader.md`; downstream notes put the warning at Chrome 130 and opt-in-only at 139). Playwright 1.64.1 passes that flag on every Chromium launch (`chromium.ts`, citing Chromium issue 40277080). The viewer sits behind an `ErrorBoundary` that turns a failed context into a fallback message instead of crashing the page, so a missing WebGL would not fail loudly by itself. Nothing has been run on a runner yet.
- **Service workers under test.** Playwright cannot route a request that a service worker answers, nor the update check of the worker script (Playwright docs, Service Workers). The offline and update cases therefore need a real preview server and a real second build, not request interception.

## Options Considered

### Option A: Keep the manual checks

- *Not chosen, but it is the real alternative.* No dependency, no CI time, no browser download. The cost is that the viewport, offline and update checks are repeated by nobody, the evidence is prose in a Handoff, and a regression in the worker, the 44 px rule or the header stays invisible until the next manual pass. That is tolerable while the app is small and has one maintainer. If declined, item 6 closes as not pursued and the manual cells in the traceability matrix stay as they are.

### Option B: Playwright Test, Chromium only, in a dedicated CI job

- *Proposed.*

### Option C: Vitest browser mode

- *Not chosen.* It needs a browser provider (in practice Playwright, so the same dependency and download) and serves tests through the Vite dev server, where this project registers no worker (`devOptions.enabled: false`). It cannot exercise `sw.js`, the offline start or the update flow, which are the cases the manual checks exist for.

### Option D: The same Playwright suite, run by hand only

- *Not chosen as the default.* Same dependency and suite, but nothing forces anyone to run it, so it decays. It stays the fallback if the WebGL risk below cannot be closed in CI.

Puppeteer, Cypress and WebdriverIO were not evaluated further: each carries a comparable dependency and browser download, and Playwright already provides the emulation, offline mode, worker introspection and traces this suite needs.

## Decision

1. **Dependency.** Add `@playwright/test` to `frontend/package.json` `devDependencies` (caret range like the rest; the lockfile pins 1.64.1). Vitest stays the unit and component runner: `vitest.config.ts` includes only `src/**/*.test.{ts,tsx}`, and Playwright reads only `frontend/e2e/`. The specs are strict TypeScript like the app, checked by a new `npm run typecheck:e2e` against `frontend/e2e/tsconfig.json`. No production source file changes: specs find controls by role and accessible name and read the dimensions from the text the Properties panel already shows. If something cannot be reached that way, the suite reports it and the source does not gain test hooks.
2. **Browser.** Chromium only, the Playwright-managed headless shell (`playwright install --with-deps --only-shell chromium` in CI). Firefox and WebKit are out: the target is Chrome on Android (spec 001), and the worker and manifest checks are Chromium behaviour. Mobile is emulated (viewport, touch, scale); a real phone stays with TSK-33.
3. **Scope.** The suite proves what the manual checks proved and nothing new.

   | Area | Proves | Requirements |
   |---|---|---|
   | (a) Manifest and worker | the manifest is served as `application/manifest+json`; after one load the worker is active and controls the page | REQ-UBI-10, REQ-UBI-11 |
   | (b) Offline start | with the network off, a reload serves the shell and all four presets with their own sizes (flange 100 x 100 x 12, elbow 82.5 x 82.5 x 25, pipe 25 x 25 x 200, plate 120 x 80 x 10 mm) and the Offline badge shows | REQ-UBI-11, REQ-STA-04 |
   | (c) Update | build twice; the old worker keeps the old version until Reload is pressed, then the new one runs | REQ-EVT-07 |
   | (d) Layout | at 320, 360, 375, 812 x 375, 768 x 1 024 and 1 280 x 800: no horizontal overflow, viewer visible, compact toolbar fits, header not covered by the ecosystem bar | REQ-UBI-12, REQ-UBI-14 |
   | (e) Touch targets | with touch enabled, no interactive target under 44 px on the four tabs and in the View sheet; a synthetic `beforeinstallprompt` puts the Install control in the header, so it is measured too | REQ-UBI-13, REQ-EVT-06 |
   | (f) Fallback | API unreachable: editing keeps the previous model and shows the connection notice; a spec equal to a bundled preset is still answered | REQ-UNW-04 |

   Still manual (TSK-33, TSK-13): a real install prompt and Chrome's menu entry, standalone display mode and the bar hidden once installed (A1, D3), the soft keyboard (A2), iOS Add to Home Screen, and `curl -sI` on the deployment.
4. **Serving.** The suite tests the production build: `vite build`, then `vite preview` on the reserved port **5301** (`strictPort`), started by Playwright's `webServer` with `reuseExistingServer: false`. A preview someone left running fails the run instead of testing a stale bundle, the same reasoning as `strictPort` in `docs/10-runbook.md` section 1. Ports 5173 and 8000 are never used, and the dev server (5300) is not involved. The host is pinned to `127.0.0.1` so Windows and Linux agree on the address. `npm run test:e2e` builds, then runs the suite.
5. **Determinism.** No test reaches a network beyond the preview server. `https://www.naindev.com/**` is fulfilled with a stub for the ecosystem bar: a custom element `nain-ecosystem-bar` fixed to the top and 38 px high, the height of the pinned script (`?v=2.1.0`), so REQ-UBI-14 is measured against a real obstruction. `https://brand.naindev.com/**` gets an empty stylesheet. The generation API origin is stubbed or aborted per test. No backend, no database, no secret.
6. **CI.** One new job `e2e` ("Browser tests") in `.github/workflows/ci.yml`, parallel to the existing two so the 30 s frontend feedback does not wait on a browser install: checkout, Node 22, `npm ci`, `npm run typecheck:e2e`, `npx playwright install --with-deps --only-shell chromium`, `npm run test:e2e`. No browser cache. One worker, a global timeout, `timeout-minutes: 15`, one retry whose pass is reported as flaky and treated as a defect. The HTML report and traces upload only on failure, for 7 days. The job is written to add no `zizmor` finding on its own lines: job-level `permissions: contents: read`, `persist-credentials: false` on checkout, actions pinned by commit SHA with the tag in a comment. The 19 existing findings are out of scope. `actionlint` and `zizmor` run after the edit. No path filter, as in the current workflow.
7. **WebGL.** Software rendering through SwiftShader, opted in by Playwright's own default flag, so no browser arguments are added. The first spec is a probe: a fresh canvas yields a WebGL2 context (the renderer string goes to the report) and the viewer shows a canvas rather than the `ErrorBoundary` fallback. If it fails, the run stops with that single failure instead of many confusing ones. No spec compares pixels; assertions read DOM geometry and text, which software and hardware rasterizers agree on. If the probe is unreliable on the runner, the ladder is: full Chromium instead of the shell (+71 MiB), then ANGLE and SwiftShader switches, then a new decision to run the viewer specs by hand only (Option D).
8. **Documentation.** The same change updates `docs/09-traceability.md` (the manual cells that these specs replace now name the spec files; the remainder in 3 stays manual), `docs/10-runbook.md` (install the browser once, port 5301 must be free, run, read the report and trace, Playwright bumps), `docs/08-blockers.md` (the browser download) and `docs/03-open-questions.md` item 6 (closed). Each spec starts with `// @req REQ-...` lines like the Vitest files.

## Consequences

- *Positive*: a regression in the worker, offline start, update prompt, compact layout, 44 px rule or header coverage fails a pull request, including the weekly Dependabot bumps of the packages that produce them. The manual checklist shrinks to what only a device can show: install, standalone, soft keyboard, iOS.
- *Positive*: zero cost. Public repository, standard runners, no account, key or paid service (REQ-DEP-01).
- *Trade-off*: a new development dependency (three packages, Apache-2.0, Microsoft) and a 120 MiB browser per machine and per CI run, outside the repository. Playwright publishes often; the weekly npm group will propose each release, and each bump changes the Chromium the suite runs on. That is useful (a browser regression shows early) and noisy (a bump can fail for a browser reason). The lockfile pins it; a failing bump is reviewed, not merged blind.
- *Trade-off*: CI wall time. The pipeline takes about 90 s today, set by the backend job. The new job will be the longest; the estimate is 3 to 4 minutes (install, build, browser install, suite, second build). Step 2 replaces the estimate with a measurement.
- *Trade-off*: browser tests flake more than unit tests (worker timing, software rendering). Mitigations: wait on observable states (the worker's controller, an active registration), never on sleeps; one worker; a retry that surfaces as flaky.
- *Trade-off*: the specs pin user-visible names (tab names, Reload, the connection notice), so a copy change needs a test change. That is intended: those names are the contract of REQ-EVT-07 and REQ-UNW-04.
- *Trade-off*: Chromium only, with emulated touch. Firefox and WebKit regressions and real-device behaviour are not seen. TSK-33 stays.
- *Open risk*: WebGL on the hosted runner is unproven. The probe closes it in step 2; this ADR does not.

## Verification

Once accepted: the probe passes on the runner and locally; each spec first runs against a deliberately broken build prepared in a scratch copy (never in the repository) and fails for the right reason, then passes on the real build; `npm run test:e2e` passes twice in a row on Windows and in CI; `npm audit` shows nothing new beyond the existing `source-map-js` finding; `trivy fs`, `gitleaks git`, `actionlint` and `zizmor` are clean on the lines added; measured CI times and download sizes replace the estimates above.

## Result (2026-10-20)

- **Suite.** 27 tests: the probe and 26 specs in `frontend/e2e/`. All 27 passed on Windows twice in a row (33.8 s and 33.5 s, both production builds included) and on Linux (Ubuntu 26.04 under WSL2, Node 24.20, `CI=true`, the same `playwright install --with-deps --only-shell chromium` as the job). Both ran the headless shell 156.0.8078.4 with software WebGL2 through SwiftShader.
- **Broken on purpose.** Ten deliberate breaks in a scratch copy, one at a time: presets missing from the precache, a manifest that is not standalone, a worker that no longer waits, a worker that does not claim the first page, a shell that no longer clears the bar, a toolbar wider than a phone, 32 px steppers on touch, a bundled model that answers any request of its kind, no Offline badge, a viewer collapsed to nothing. Each failed the specs it should (from one to six tests); the unbroken copy passed.
- **Gates.** `npm audit` unchanged (one existing high finding, `source-map-js`); `trivy` finds nothing high or critical in the lockfile; `gitleaks` finds nothing in the new and changed files; `actionlint` is clean; `zizmor` reports 9 findings in `ci.yml` before and after, none on the new job; `tsc` (strict), `oxlint` and Vitest (208 of 208) pass.
- **Found on the way.** On a first visit, the page starts with no worker controlling it, and choosing Reload on the update banner activated the new worker without reloading the page. The update spec started from a returning visit; fixing the first-visit case was a separate change in `usePwaUpdate`, made on the same day: it reloads on the next change of controller once the user accepts, and `update.spec.ts` now runs both visits.
- **First hosted run (2026-10-20, commit `089c3b7`).** The job took 1 min 39 s in all, the suite itself 1.1 min, inside the 3 to 4 minute estimate. WebGL works on the hosted runner: the probe passed in 1.4 s through SwiftShader, which closes the one risk this ADR left open. 26 of 27 tests passed at once; `offline.spec.ts` passed only on its retry, and `failOnFlakyTests` turns that into a red job. The trace put the cause in the application, not in the test: after every load and every showcase card the form sent the same request a second time 350 ms later, which locked the cards again just as the slow runner delivered the click (REQ-EVT-08, TSK-34).
- **After TSK-34 (`1a63f58`).** The job is green on the hosted runner: 27 of 27 in 50 s with no retry, beside green Frontend and Backend jobs.
- **Seen once, not explained.** In the first local run after the TSK-34 change, the first test of `update.spec.ts` timed out waiting for the `load` event after Reload was pressed: the page did not reload. The next run replaced its trace, so the cause is unknown. That test then passed in 20 further runs (four full runs with `CI=true`, and 16 repeats of the spec, ten of them with 24 busy processes competing for the CPU), and it passed on the hosted run. If it comes back on CI, the job uploads the report with the trace. The spec now also asserts whether a worker controlled the page when it started, so a recurrence says at once if the page started without one; the first-visit change to `usePwaUpdate` reloads such a page too.
