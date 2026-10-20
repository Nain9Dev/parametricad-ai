# Tasks: Visual architecture, first slice

Tags: `[A]` the assistant alone, `[M]` mixed, `[H]` the user alone. Each task has its test written before its code.

| ID | Tag | Task | Done when |
|---|---|---|---|
| T-001 | `[A]` | Spec, plan, requirements REQ-UBI-16 to REQ-UBI-18, traceability rows, open question for the interface language | the documents exist and `docs/09-traceability.md` has a row per requirement |
| T-002 | `[A]` | `designTokens.test.ts` and `typeScale.test.ts`, failing | both fail on `main` for the reasons in the spec's evidence |
| T-003 | `[A]` | `e2e/legibility.spec.ts` with the three audits, failing | it fails at the six viewports for the same reasons |
| T-004 | `[A]` | Tokens and filled controls (D1) | `designTokens.test.ts` passes |
| T-005 | `[A]` | Type floor (D2) | `typeScale.test.ts` passes and the overflow and touch audits of spec 001 still pass |
| T-006 | `[A]` | Showcase cards (D3) | the card audit passes at the six viewports |
| T-007 | `[A]` | Look at the result at 1 440, 1 024, 768, 375 and 320 px and fix what looks wrong | screenshots reviewed, nothing cut, nothing crowded |
| T-008 | `[A]` | Documentation and handoff | `docs/07-tasks.md`, the runbook's browser test table and this file are current |
| T-009 | `[M]` | The user looks at the result and keeps or vetoes D1 to D3 | the user's answer |

## Handoff state

- **Done**: T-001 to T-008.
- **Verified (2026-10-20)**: the three guards failed on `main` for the reasons in the spec's evidence (7 unit failures; the browser spec failed at all six viewports, with 134 findings at 320 px) and pass now. vitest 250 of 250 across 33 files; `tsc`, `tsc -p e2e` and oxlint clean; `npm run build` and `verify:pwa` pass (23 files precached); `npm run test:e2e` 34 of 34 in two runs with `CI=true`. Screenshots reviewed at 1 440, 1 280, 1 024, 768, 375, 320 and 812 x 375 px. At 1 024 px the 17 rem columns crowded the mesh validation card, which now wraps instead of breaking or clipping.
- **Verified on GitHub (`2549519`)**: Frontend CI, Backend CI and Browser tests are green; the browser job took 1 min 37 s with 34 of 34 passing in 59 s, inside the two minutes the spec asks for.
- **Not verified**: how it looks on a real phone.
- **Next**: T-009, the user's look at the result; D1 to D3 stand unless vetoed. Then the open questions on language and icons in `docs/03-open-questions.md`.
