# ADR-0007: Installable Progressive Web App (manifest, service worker, offline scope)

- **Status**: Accepted (approved 2026-10-19 by the user in session, TSK-29)
- **Date**: 2026-10-19
- **Resolves**: Request to install ParametriCAD on an Android phone from Chrome and use it there as comfortably as on a desktop, from one codebase (`specs/001-installable-mobile-app/`)
- **Relates to**: REQ-UBI-10, REQ-UBI-11, REQ-EVT-06, REQ-EVT-07, REQ-STA-04, REQ-DEP-06; constrained by REQ-UBI-04 (CSP), REQ-DEP-01 (zero cost), REQ-DEP-03 (cold start), REQ-DEP-05 (anonymous, no user-specific state)

## Context

The web client is a static Vite build served by Vercel; the API runs on a free-tier Render instance that sleeps when idle and answers cross-origin. Today there is no manifest, no service worker and no install metadata, so Chrome offers nothing under the three-dot menu.

Facts that shape the decision (sources and dates matter, Chrome changes these rules):

- **Menu install** ("Install app") needs a valid manifest over HTTPS. A service worker with a `fetch` handler stopped being required in Chrome 108 on Android and 112 on desktop (Chrome for Developers, "Revisiting Chrome's install criteria", last updated 2023-12-05).
- **The install prompt** (`beforeinstallprompt`, the only way to offer an in-app Install button) still required a `fetch` handler in that same article ("for now"). No later source found that says otherwise. Both points are verified on the target phone in the device checklist, not assumed.
- Chrome's manifest requirements: `name` or `short_name`, `start_url`, `display` of `standalone`, `fullscreen`, `minimal-ui` or `window-controls-overlay`, a 192 px and a 512 px icon, and no `prefer_related_applications: true`. The prompt additionally waits for a tap and 30 seconds of engagement (web.dev, "Installation criteria", 2024-09-19).
- `frontend/vercel.json` already allows `worker-src 'self' blob:` and `manifest-src 'self'`; no CSP loosening is needed.
- The bundle that must run offline is small: four preset models (234 KB of GLB), their metadata and the catalogue (about 27 KB), and a build of about 1.25 MB of JavaScript and CSS, 1.15 MB of it the Three.js chunk (measured on the 2026-10-17 build).
- `vite-plugin-pwa` 2.0.0 (MIT, last published 2026-10-03) declares support for Vite 8, the version this project uses. Its dependencies are `workbox-build` and `workbox-window` 7.4.1 (MIT) plus three small utilities.

## Options Considered

### Option A: Manifest only, no service worker

- *Rejected*: Chrome's menu install works, but the in-app Install button would silently never appear (no `fetch` handler), nothing works offline, and a cold Render instance still blocks first paint of a useful screen.

### Option B: Hand-written service worker

A short worker plus a small Vite plugin that injects the list of hashed build files.

- *Rejected for now*: it removes a dependency but moves cache versioning, cleanup of old caches and the update handshake into code this project would have to get right and maintain. Those are exactly the parts Workbox exists for. Revisit if the Workbox tree becomes a maintenance burden.

### Option C: Generated service worker with `vite-plugin-pwa` (Workbox `generateSW`) and a static manifest

- *Chosen*.

### Option D: Wrap the PWA in a Trusted Web Activity or Capacitor app

- *Deferred*: it needs the PWA first, plus a Play Console account and fee ([H]). Recorded in `docs/03-open-questions.md`.

## Decision

1. **Static manifest.** `frontend/public/manifest.webmanifest` is authored by hand and linked from `index.html`, so it is visible in development, diffable, and covered by a plain test. The plugin's manifest generation is turned off.
2. **Generated service worker.** `vite-plugin-pwa` and `workbox-window` are added as development dependencies (both are bundled at build time; nothing is fetched from a CDN). The worker is generated at build time, registered in production builds only, and configured in `frontend/pwa.config.ts` so a test can read the options.
3. **Cache policy.** The worker precaches same-origin build output, the manifest, the icons, `presets/catalog.json` and the four preset models. Navigations fall back to `index.html`. **There are no runtime caching routes**: the generation API, its artifacts and every cross-origin request (the naindev bar script and tokens) are never intercepted. An installed client therefore never holds user-generated geometry, which keeps REQ-DEP-05 intact.
4. **Update policy.** `registerType: 'prompt'`. A new worker waits, the client shows an Update banner, and the page reloads only when the user accepts. Without acceptance the new version applies on the next launch, after all windows close. Outdated caches are cleaned up.
5. **Install affordance.** The client captures `beforeinstallprompt`, shows an Install control in the header while the event is available, and hides it after installation or after the prompt is used. iOS Safari reports nothing, so there the control explains Add to Home Screen.
6. **Offline scope.** Offline, the shell and the four bundled presets work. Generating a custom part, refining and exporting need a connection and say so. The fallback that makes the presets answer is corrected in ADR-0008.
7. **Headers.** `/sw.js` and `/manifest.webmanifest` are served with `Cache-Control: no-cache` so a release reaches installed clients on their next launch. The CSP is unchanged.
8. **Kill switch.** If a bad worker ships, the recovery is a release whose `sw.js` unregisters itself and deletes every cache, documented in `docs/10-runbook.md`.

## Consequences

- *Positive*: Installable from Chrome's menu and from an in-app button, starts instantly from cache even while Render is asleep or the phone is offline, and updates under the user's control.
- *Positive*: No credential, account or paid service is involved; hosting stays on Vercel's free tier (REQ-DEP-01).
- *Positive*: A static manifest and a worker configuration kept in a module make the contract testable without a browser.
- *Trade-off*: A new development dependency tree (`workbox-build`) enters the lockfile. It runs at build time only; `npm audit` and `trivy` cover it, and the lockfile pins it.
- *Trade-off*: Service worker lifecycles can leave a stale shell. The prompt-based update, outdated-cache cleanup, `no-cache` on `sw.js` and the kill switch bound that risk.
- *Trade-off*: The naindev ecosystem bar and its tokens are cross-origin and not available offline. The bar is hidden on phones and in the installed app anyway (spec 001, decision D3).
- *Trade-off*: Jsdom cannot exercise a service worker. Offline start is verified in a real browser against the preview build and on the device; automated browser-level tests (Playwright) are a recorded follow-up that needs its own ADR.

## Verification

Manifest and head-tag tests, a worker-configuration test (no runtime caching, presets precached, API denied), a build check that `dist/sw.js` lists the expected entries, header tests on `vercel.json`, hook and component tests for install, update and offline state, then the offline-start and device checklists in `specs/001-installable-mobile-app/plan.md`.
