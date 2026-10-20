# Spec 002: Visual architecture, first slice

- **Status**: Implemented on 2026-10-20 (TSK-38); decisions D1 to D3 are mine and open to veto (T-009)
- **Date**: 2026-10-20
- **Requirements**: REQ-UBI-16, REQ-UBI-17, REQ-UBI-18. Their text lives in `docs/02-requirements.md`; this file does not repeat it.
- **Design**: `plan.md`. **Work**: `tasks.md`.

## Goal

Make the interface as legible as it is compact. Text that can be read at a glance on a phone and on a desktop, colours that meet WCAG 2.2 AA (the project's accessibility floor), and cards whose content is never cut off. The workspace layout from spec 001 stays as it is.

## Evidence

Measured on 2026-10-20 against `main` in Chromium by a DOM audit of every visible element with text: computed font size, contrast of the computed colour over the effective background, and the box of each element against the box that holds it.

| Finding | How it was measured |
|---|---|
| 85 of the 144 text elements at 1 440 x 900 are 11 px or smaller (9 px: 8, 10 px: 18, 11 px: 59); on the phone's Presets tab, 14 of 36 are under 12 px | computed `font-size` |
| `ink-faint` (`#6b7688`) reaches only 3.47:1 to 4.34:1 over the four surfaces; it carries the card subtitles, the stepper icons and the badges | WCAG ratio from the token values and from the computed colours |
| White text on the accent fill `#3d8bfd` reaches 3.33:1: the active segment (Parameters, Alloy, Persp), primary buttons and the active card badge | same |
| Showcase cards: the "Prismatic" badge pokes 26 px out of its card at 1 440 px, "Industrial" and "Toroidal" by 2 to 4 px; five subtitles are cut to one line ("Ø100mm · Genus 9 · Euler -16" ends in an ellipsis); "Brida 8 Pernos" wraps to three lines beside its badge in the 20 rem column | element box against card box; `scrollHeight` against `clientHeight` |
| The same cards cut two subtitles at 375 px ("Radio 50mm · Ø25mm ·", "120x80mm · Taladro Ø20 ·") | same |

## Decisions (mine, open to veto)

| ID | Decision |
|---|---|
| D1 | Colour. The accent stays for text, borders and focus rings, where it already passes (4.79:1 or more). Filled controls use a darker blue of the same hue, `#086bfc` (hover `#035adb`), so white text reaches 4.65:1 and 6.0:1. `ink-faint` becomes `#808b9b`, the smallest step that passes on the lightest surface (4.62:1). |
| D2 | Type floor. No text under 12 px. The three arbitrary sizes (9, 10 and 11 px) become `text-xs`; where a control stops fitting it is restructured, not shrunk. |
| D3 | Showcase cards. One column in the 17 to 21 rem input column and on phones, two columns where the panel is 28 rem or wider. The badge sits beside the title and wraps under it when the line is short. The subtitle is shown in full. Icons and copy are left as they are. |

## Scope

**In scope**

- The colour tokens and the filled-control classes (REQ-UBI-16).
- Every arbitrary text size under 12 px (REQ-UBI-17).
- The showcase cards (REQ-UBI-18).
- The guards: two unit contract tests and one browser spec.

**Out of scope, proposed for later (see `docs/03-open-questions.md`)**

- One language for the interface copy: today it mixes Spanish (card names, "Demos 1-Clic", "0s latencia") with English (tabs, panels, buttons).
- Drawn icons in place of the emoji on the cards.
- The density of the report column, a light theme, and the 3D viewer's rendering.
- The backend.

## Acceptance scenarios

1. **Contrast.** Given each of the six viewports of spec 001, every visible text in every tab, in the Description mode and in the View sheet has a contrast of at least 4.5:1 (3:1 for large text).
2. **Floor.** Given the same states, no visible text is under 12 px.
3. **Cards.** Given any width from 320 px, each showcase card shows its title, badge and subtitle in full, inside the card, and the badge does not overlap the title.
4. **No regression.** The overflow, touch-target and viewer audits of spec 001 still pass at every viewport.

## Constraints

- AGENTS.md: all repository text in English; strict TypeScript; reserved ports.
- REQ-UBI-12 and REQ-UBI-13 keep holding: raising the text must not push a control past the edge at 320 px or under 44 px on touch.
- The browser job stays under about two minutes on a hosted runner.

## Assumptions and risks

| ID | Statement | Status |
|---|---|---|
| R1 | Raising 9 to 11 px text to 12 px widens some controls (the viewer toolbars, the number fields) and may overflow them at 320 px. | The overflow and touch audits of spec 001 catch it; the fix is to restructure the control. |
| R2 | `#086bfc` is more saturated than `#3d8bfd`. | Check on screen at desktop and phone width; D1 is open to veto. |
| R3 | The contrast audit assumes the page background behind semi-transparent surfaces. | Text over the 3D canvas is not audited. |
