# Tasks next: the validation verdict in the first view

Tags: `[A]` the assistant alone, `[M]` mixed, `[H]` the owner alone. Each task has its test written before its code. Commands run from `frontend/` unless noted.

| ID | Tag | Task | Requirements | Done when | Status |
|---|---|---|---|---|---|
| T-001 | `[A]` | Record what the first screen shows today at desktop and phone width, and the time the default part takes | | The evidence table in `spec.md` is filled from measurements, with before captures kept for the pull request | Done |
| T-002 | `[A]` | Spec, plan, REQ-UBI-19 in `docs/02-requirements.md`, its traceability row, the task registry row and an open question for the phone's first-paint wait | REQ-UBI-19 | The documents exist and `docs/09-traceability.md` has the row | Done |
| T-003 | `[A]` | Red: `ViewerVerdict.test.tsx`, the compact and wide cases in `App.test.tsx`, the chip assertions in `e2e/layout.spec.ts` | REQ-UBI-19 | The new tests fail because the chip does not exist | Done |
| T-004 | `[A]` | Green: `ViewerVerdict.tsx` and its wiring in `App.tsx` | REQ-UBI-19 | `npm test` passes; `npm run test:e2e` passes the layout, touch and legibility specs | Done |
| T-005 | `[A]` | Look at the result at 1 280 x 800, 375 x 812 and 320 x 568, before and after, and fix what looks wrong | REQ-UBI-19 | Captures reviewed, nothing cut, the canvas centre is clear | Done |
| T-006 | `[A]` | Repository checks, `gitleaks git`, pull request with the captures and the note about the portfolio capture | | The pull request is open against `main` | Done |
| T-007 | `[M]` | The owner looks at the result and keeps or vetoes D1 to D4 | | The owner's answer | Open |
| T-008 | `[H]` | Refresh `public/assets/images/demos/parametricad-ai.webp` in `nain9dev.github.io` once this is live | | The portfolio capture shows the new first screen | Not started, separate task |

## Handoff state

- **Done**: T-001 to T-006.
- **Verified (2026-10-27)**: the new tests failed first (`ViewerVerdict.test.tsx` could not resolve the component; the compact case of `App.test.tsx` found no chip), then passed. From `frontend/`: oxlint clean, `tsc -b --noEmit` and `tsc -p e2e` clean, vitest 267 of 267 across 35 files, `npm run build` and `verify:pwa` pass (23 files precached). `npm run test:e2e`: 41 of 42, the five compact chip tests and the wide absence check among the passes; the one failure is `touch.spec.ts` on the Presets tab, where the ES and EN buttons of the locale switcher measure 26 x 20 px on a touch screen. That switcher arrived with `f777ccd` on `main`, the commit this branch starts from, and is not touched here (TSK-40). From `backend/`: pytest 356 of 356 with the traceability gate. Captures in `captures/`: before and after at 1 280 x 800 and 375 x 812, after at 320 x 568 and 812 x 375; the canvas centre is clear at every one and the chip sits in the lower left corner.
- **Not verified**: how it looks on a real phone; the hosted run of the browser tests, which the pull request's checks report and which TSK-40 will keep red until it is fixed.
- **Next**: T-007, the owner's look; then T-008 in the portfolio repository.
