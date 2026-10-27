# Spec next: the validation verdict in the first view

- **Status**: Implemented, waiting for the owner's review
- **Date**: 2026-10-27
- **Requirements**: REQ-UBI-19. Its text lives in `docs/02-requirements.md`; this file does not repeat it.
- **Design**: `plan.md`. **Work**: `tasks.md`.
- **Number**: assigned by the merge train; `next` until then.

## Goal

A visitor who opens the public demo, on a desktop or on a phone, sees in the first screen both things the project is about: a part that reads as parametric CAD, and the verdict of the deterministic validation that was run on it. No tap, no scroll.

## Evidence

Measured on 2026-10-27 against `main` (`f777ccd`) served by the Vite dev server with the API on port 8130, and against production (`https://parametricad.naindev.com`, built from `master` at `8df5997`), in Chromium.

| Finding | How it was measured |
|---|---|
| Desktop, 1 280 x 800: the first screen shows the 8-bolt flange (Ø100 mm, bore Ø50 mm, 8 holes Ø10 mm on a Ø80 mm circle) and the Mesh validation card reads **Valid**, 3 392 triangles, with the six checks and the Euler-Poincaré invariant. The same on production. | screenshot after load; `main p[aria-live="polite"]` reads "Model ready." |
| Phone, 375 x 812: the same flange is on the canvas, but the verdict is a 6 px green dot beside the Report tab, with "mesh valid" for screen readers only. No visible text on the first screen says the part was validated. | DOM search for a visible leaf element reading "Valid" inside the viewport: none |
| The portfolio audit of 2026-10-27 described the first screen as "a plain flat tube". A fresh visit does not show one: the pipe has not been the opening part since `91b7157` (2026-10-16), and production has carried that commit since 2026-10-20. The audit most likely looked at the Sep 7 build that production served until then, or at a tab that had it cached. | `git log -S 'SHOWCASE_PRESETS[0]'`; `docs/07-tasks.md` TSK-15 |
| Time to the first part on the phone layout: "Model ready." 1.6 s after navigation on the dev server (the bundled model answers before the API; the Three.js chunk is the wait). | `performance.now()` polled against the viewer status |
| Default part generation: 0.49 s uncached on this machine (CadQuery kernel plus validation), then 0.00 s from the content-addressed cache; 3.62 s for the first call to the production API and 0.14 s cached. | `POST /api/v1/models` with the flange specification, three runs each |

## Decisions (mine, open to veto)

| ID | Decision |
|---|---|
| D1 | The opening part stays the 8-bolt flange. It already reads as parametric CAD (a bored disc with a bolt circle, genus 9), it is bundled so it is on screen before the API answers, and every other candidate (a bracket with fillets, a richer flange) would need a new component kind in the backend, a new golden model and a new bundle: not the smallest change, and not what the evidence asks for. |
| D2 | On the compact layout (below 1 024 px), the verdict is drawn over the viewer as a small chip in its lower left corner: the status (Valid, Degraded or Invalid) in its colour, the triangle count, and a tap that opens the Report tab. It uses the same tones as the Mesh validation card, so the two agree. The lower left corner is the one place the viewer leaves free: the progress pill ("Generating geometry") sits top centre and would overlap a chip at the top on a 320 px screen, the error strip takes the top, and the gizmo takes the lower right. |
| D3 | The wide layout is unchanged: the Mesh validation card already sits beside the viewer. The chip is not drawn there. |
| D4 | While a generation fails, the existing error strip takes the chip's place; the chip is only drawn for a model with no pending error, so the viewer never says Valid about a part that the last request could not produce. |

## Scope

**In scope**

- The verdict chip on the compact layout (REQ-UBI-19).
- The guards: a component test, a workspace test in `App.test.tsx`, and the compact cases of `e2e/layout.spec.ts`.
- The requirement, its traceability row, this spec and the task registry.

**Out of scope**

- The opening part, the showcase cards, the backend and the bundled models.
- The time the Three.js chunk takes on a phone before the first part is drawn (see `docs/03-open-questions.md`).
- The portfolio capture `public/assets/images/demos/parametricad-ai.webp` in `nain9dev.github.io`: a separate task, after this one is live.

## Acceptance scenarios

1. **Phone.** Given a viewport of 375 x 812, when the app has loaded its first part, then a visible control over the viewer reads the verdict of that part and its triangle count, and tapping it opens the Report tab.
2. **Every compact viewport.** Given each of the five compact viewports of spec 001, the chip is visible, fits inside the viewer, is at least 44 px tall on a touch screen, and does not cover the centre of the canvas.
3. **Desktop.** Given a viewport of 1 280 x 800, the chip is not drawn and the Mesh validation card is visible beside the viewer, as today.
4. **Failure.** Given a generation error on the compact layout, the error strip is shown and the chip is not.
5. **No regression.** The overflow, touch-target, legibility and viewer audits of specs 001 and 002 still pass at every viewport.

## Constraints

- AGENTS.md: all repository text in English; strict TypeScript; reserved ports.
- REQ-UBI-12, REQ-UBI-13, REQ-UBI-16 and REQ-UBI-17 keep holding: the chip is at least 44 px on a coarse pointer, its text is at least 12 px and reaches AA contrast.
- The default generation time and the bundled models are untouched.

## Assumptions and risks

| ID | Statement | Status |
|---|---|---|
| R1 | A chip over the canvas takes space from a 16 rem viewer on the smallest phones. | It is one line in a corner the part does not reach once fitted; checked at 320 x 568 and 812 x 375. |
| R2 | The chip repeats what the Report tab's dot already says. | The dot stays for the tab; the chip is the readable version where the eye is, and it leads to the same place. |
