# Tasks 001: Installable mobile app

One task at a time, test first. Tags: `[A]` done by the assistant alone, `[M]` needs an action from the user to close, `[H]` only the user. Commands run from `frontend/` unless noted.

## Tasks

| ID | Tag | Task | Requirements | Done when | Status |
|---|---|---|---|---|---|
| T-001 | `[M]` | The user reviews ADR-0007 and ADR-0008 (including decision D6, the two corrected demo cards) and approves or amends them | | Both ADRs read `Accepted`, this repository's word for approved | Done (2026-10-19, approved as written) |
| T-002 | `[A]` | Red: tests for `specsEqual`, `bundledKindForSpec`, `bundledKindForPrompt`, the fallback matrix of `generateFromSpec`, `generateFromPrompt` and `refineModel` (match or no match, transport failure, timeout, 5xx, 422), and showcase specs against `public/presets/*.json` | REQ-UNW-04, REQ-UNW-05, REQ-UBI-15 | The new tests fail for the right reason | Done |
| T-003 | `[A]` | Green: `bundledPresets.ts`, rework `apiClient.ts`, correct elbow and plate in `presets.ts` | REQ-UNW-04, REQ-UNW-05, REQ-UBI-15 | `npm test` passes; with the API stopped, a flange at 150 mm keeps the previous model and shows the connection notice | Done |
| T-004 | `[A]` | Manifest, icons, head tags: tests first, then `manifest.webmanifest`, `generate-pwa-icons.py` and its outputs, the manifest and icon tags in `index.html` | REQ-UBI-10 | `manifest` and `indexHtml` tests pass; all four PNGs have the declared sizes; `npm run build` copies them to `dist/` | Done |
| T-005 | `[A]` | Add `vite-plugin-pwa` and `workbox-window` as dev dependencies; `pwa.config.ts`; wire `vite.config.ts` and the Vitest alias; `verify-pwa-build.mjs`; `npm test` and `verify:pwa` in CI | REQ-UBI-11 | `pwaConfig` test passes; `npm run build && npm run verify:pwa` passes; `npm audit` shows no new high or critical finding; `zizmor .github/` and `actionlint` clean | Done, see Handoff for the audit and zizmor notes |
| T-006 | `[A]` | `useOnlineStatus` and `OfflineBadge` in the header | REQ-STA-04 | Hook and component tests pass | Done |
| T-007 | `[A]` | `useInstallPrompt`, `InstallButton`, iOS hint | REQ-EVT-06 | Hook and component tests pass (event captured, prompt used once, hidden after install, iOS hint) | Done, a real prompt waits for the phone |
| T-008 | `[A]` | `usePwaUpdate` and `PwaStatus` (Update banner, offline-ready notice) | REQ-EVT-07 | Component test passes; accepting calls the update, declining does not reload | Done |
| T-009 | `[A]` | `vercel.json` headers for `/sw.js` and the manifest | REQ-DEP-06 | Extended `vercelConfig` test passes; CSP unchanged | Done |
| T-010 | `[A]` | Viewport tag, safe areas, overscroll, ecosystem bar variable and hiding, `tokens.css` media condition | REQ-UBI-13, REQ-UBI-14 | `ecosystemBar` and `indexHtml` tests pass; header uncovered at 1 280 px, bar hidden at 375 px | Done |
| T-011 | `[A]` | `useMediaQuery`, `WorkspaceTabs`, grid areas and tab state in `App.tsx` | REQ-UBI-12 | Tab tests pass; at 375 x 812 the viewer is visible without scrolling and the page does not scroll | Done |
| T-012 | `[A]` | Split `ViewerToolbar` into shared controls; `ViewerToolbarCompact`, `BottomSheet`, `ViewOptionsSheet` | REQ-UBI-12 | Existing `ViewerToolbar` tests still pass; the sheet opens, traps focus and closes on Escape | Done |
| T-013 | `[A]` | Touch targets and 16 px text on coarse pointers across the `ui/` primitives, `ShowcaseBar` and `ComponentPicker`; `NumberField` becomes `[-] [value] [+]` | REQ-UBI-13 | `touchTargets` test passes; DOM audit at 375 x 812 reports zero targets under 44 px | Done |
| T-014 | `[A]` | Compact header (`HeaderMenu`, hidden tagline, health dot) and `ViewerNotice` | REQ-UBI-12, REQ-UNW-04 | At 375 px Save project and Open project are reachable; the notice appears when a generation error is set and Retry works | Done |
| T-015 | `[A]` | Run the viewport matrix and the offline start check; fix what they show | all | Matrix and offline results recorded under Handoff; no console errors | Done |
| T-016 | `[A]` | Docs in the same change as the code: architecture flowchart, runbook (build, preview, install testing, USB forwarding, kill switch, icon regeneration), traceability rows, README and frontend README, `npm test` in the runbook suite; `gitleaks git` before proposing a commit | | Documents match the code; the backend traceability gate is still green | Done |
| T-017 | `[M]` | The user runs the device checklist in `plan.md` section 7 on an Android phone against production (TSK-33) | all | Every item passes, or failures are reported back | Open: needs a deployment and the user's phone |
| T-018 | `[A]` | Optional: manifest `screenshots` so Chrome shows its richer install dialog, captured from the finished interface | REQ-UBI-10 | Chrome's manifest check lists no warnings | Not started |

## Handoff state

- **Done**: T-001 to T-016. The client has the compact workspace, the honest fallback, the manifest and icons, a service worker that precaches the shell and the four presets, the Install control, the Offline badge, the update prompt, and the deployment headers. Documentation and traceability rows match.
- **Verified (2026-10-19)**:
  - `npm test` 200 of 200 across 29 files; `tsc -b --noEmit` clean; `oxlint` reports only the two warnings that were already there (`CameraRig.tsx`, `ModelObject.tsx`); `npm run build` and `npm run verify:pwa` pass (21 files, 1 561 KiB precached); the backend traceability gate still collects 350 tests and passes; `actionlint` is clean.
  - Layout in the browser pane with touch emulation: no horizontal overflow and no page scroll at 320, 360, 375 and 812 x 375; the viewer is visible at 375 x 812; a DOM audit finds zero targets under 44 px on the four tabs and in the View sheet; the toolbar fits at 320, 360 and 375 px; at 1 280 x 800 the three columns are unchanged and the header is no longer covered by the bar; at 768 x 1 024 the bar is shown and the header is not covered.
  - Fallback with the API stopped: a flange at 150 mm keeps the previous model and shows "Could not reach the generation service" with Retry, and the Report tab reads "Report, error"; setting it back to 100 mm (a bundled spec) clears the notice.
  - Service worker against `npm run preview`: registered, activated and controlling, 21 precache entries, manifest served as `application/manifest+json`. With the preview server stopped and the tab reloaded, the app opens from the worker and all four presets show their own models (82.5 x 82.5 x 25, 25 x 25 x 200, 120 x 80 x 10 and 100 x 100 x 12 mm).
  - The update flow for real: after serving a new build, the old worker kept the old version on screen, a banner offered Reload, and choosing Reload loaded the new version with no worker left waiting.
  - The Offline badge replaces the service badge when the device reports no connection, and returns when it does.
  - Install control with a synthetic `beforeinstallprompt`: it appears as a 44 px icon, the event is cancelled, `prompt()` runs once, and the control disappears; the header fits at 320, 375 px.
- **Re-verified after merging PR #8 (2026-10-20)**: the pull request had loaded Three.js on demand, split React into its own chunk and moved the view directions to `viewDirections.ts`. On the merged tree `npm test` passes 208 of 208 across 30 files, `tsc -b --noEmit` and `oxlint` are clean (the two older warnings went with that PR), and `npm run build` and `npm run verify:pwa` pass with 23 files precached (1 561 KiB), the lazily loaded `ModelViewer` chunk included, so the viewer still works offline. That PR had already used TSK-27 and TSK-28, so this work's tasks are TSK-29, TSK-32 and TSK-33 in `docs/07-tasks.md` (TSK-30 and TSK-31 belong to the Playwright work, ADR-0009).
- **Not verified**:
  - A real install prompt and the Chrome menu entry on Android: the pane's browser never fires `beforeinstallprompt`. This is T-017.
  - Standalone display mode, and the bar being hidden once installed (A1 and D3): the rule is in CSS and pinned by a contract test, but the app was never run installed.
  - The soft keyboard keeping the viewer in sight (A2), and the iOS Add to Home Screen sheet on an iOS device.
  - The deployment headers (`curl -sI` after a release), and whether Vercel preview deployments sit behind a login (A3).
- **Changed from the spec**: REQ-UBI-14 and decision D3 also hide the ecosystem bar on short viewports (34 rem or less). The bundled prompt answer is labelled "Bundled demo (24/7 availability fallback)" now that nothing is guessed. Below 360 px the compact toolbar's View button keeps its icon and gives up its word. CI now runs `npm test` and `npm run verify:pwa`, which it did not before.
- **Pre-existing, not touched**: `npm audit` reports one high finding, `source-map-js` 1.2.1 (event-loop denial of service), which was already in the lockfile through `postcss`, Tailwind and `jsdom`; `npm audit fix` would take 1.2.2. `zizmor .github/` reports 19 findings in the workflows (unpinned actions, default permissions), none on the lines added here. `gitleaks` finds nothing in the repository history or in any changed path; a scan of the whole working tree also reads git-ignored local files (`scratch_*`, `frontend/.env.local`).
- **Next**: the user pushes `main` so Vercel deploys, then runs the device checklist (T-017, TSK-33). Optional T-018 once the interface is final. The work is one commit on `main`, `feat(frontend): installable PWA, mobile workspace, honest fallback`.
- **Blocked**: T-017 on a deployment and the user's phone.
