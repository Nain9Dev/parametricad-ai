# Spec 001: Installable mobile app

- **Status**: Approved decisions (ADR-0007 and ADR-0008 accepted 2026-10-19, TSK-29); implementation in progress
- **Date**: 2026-10-19
- **Requirements**: REQ-UBI-10 to REQ-UBI-15, REQ-EVT-06, REQ-EVT-07, REQ-STA-04, REQ-UNW-04, REQ-UNW-05, REQ-DEP-06. Their text lives in `docs/02-requirements.md`; this file does not repeat it.
- **Decisions**: `docs/06-decisions/ADR-0007-installable-pwa.md`, `docs/06-decisions/ADR-0008-bundled-presets-match-only.md`
- **Design**: `plan.md`. **Work**: `tasks.md`.

## Goal

Install ParametriCAD on an Android phone from Chrome (three-dot menu, Install app) and use it there as comfortably as on a PC, from the one codebase. Offline use is limited to opening the app and viewing the four bundled parts.

## Evidence

Measured on 2026-10-19 against `main` in Chromium, 375 x 812 at device pixel ratio 2, unless noted.

| Finding | How it was measured |
|---|---|
| The page is 2 958 px tall and the 3D viewer starts 1 580 px from the top, below the whole input form | `canvas.getBoundingClientRect().top + scrollY` |
| 56 interactive elements are smaller than 44 px: number steppers 28 x 16, toolbar toggles 32 x 32, camera presets 24 px high, shading segments 28 px high | DOM audit of buttons, inputs, selects and labels |
| The fixed 38 px ecosystem bar covers the application header, at 375 px and at 1 024 px | `document.elementFromPoint` on the header `h1` returns `NAIN-ECOSYSTEM-BAR` |
| The ecosystem bar runs past the right edge at 375 px | screenshot |
| With the API unreachable, a flange set to 150 mm still reports 100 x 100 x 12 mm and 63.15 cm3, with no notice | edited the field in the running client; cause in ADR-0008 |
| The elbow and plate showcase specs are rejected by the backend schema | `TypeAdapter(ComponentSpec)` against `backend/app/domain/models/specs.py` |
| There is no manifest, service worker, install tag or safe-area handling | `frontend/index.html`, `frontend/public/` |
| Project save and open are hidden below 640 px, so a phone cannot use them | `AppHeader.tsx` (`hidden sm:inline-flex`) |

## Decisions from the interview (2026-10-19)

| ID | Question | Decision |
|---|---|---|
| D1 | Mobile structure | The viewer stays pinned at the top (about 46 % of the height) and the inputs and report sit in a tabbed panel below that scrolls on its own. In landscape on short screens, viewer and panel sit side by side. |
| D2 | Offline scope | The installed app opens and shows the four bundled parts without a connection. Generating a custom part, refining and exporting say a connection is needed. No API response is cached. |
| D3 | naindev ecosystem bar | Keep it on desktop browsers and reserve its height so it stops covering the header. Hide it below 640 px and in the installed app, and also on short viewports (34 rem or less), where 38 px is a tenth of a phone held sideways. The short-viewport case is my reading of "hide on mobile". |
| D4 | Install affordance | An Install control in the header besides Chrome's own menu; on iOS it explains Add to Home Screen. |
| D5 | The 24/7 demo fallback | Serve a bundled part only when the request matches it exactly; otherwise keep the previous model and ask for a connection. See ADR-0008. |
| D6 | Consequence of D5 | The elbow and plate showcase specs and card subtitles are corrected to describe the bundled models. Confirmed by the user on 2026-10-19 with the approval of ADR-0008. |

Assumed defaults, open to veto: the update banner asks before reloading; the installed icon is the existing cube mark; the app name is "ParametriCAD AI" with "ParametriCAD" as the short name; orientation is not locked; the tabs are Presets, Parameters, Describe and Report, in English like the rest of the interface chrome.

## Scope

**In scope**

- Manifest, icons, head tags, service worker, update and offline notices, Install control (REQ-UBI-10, REQ-UBI-11, REQ-EVT-06, REQ-EVT-07, REQ-STA-04).
- Compact workspace, touch targets, safe areas, ecosystem bar behaviour (REQ-UBI-12, REQ-UBI-13, REQ-UBI-14).
- The fallback correction and the showcase fix (REQ-UNW-04, REQ-UNW-05, REQ-UBI-15).
- Deployment headers (REQ-DEP-06) and the documentation that goes with the code.

**Out of scope**

- Push notifications, background sync, Web Share Target, file handlers for project JSON, app shortcuts, and Play Store distribution. They are recorded in `docs/03-open-questions.md`.
- Changes to the three-column desktop workspace, to the backend, or to interface copy other than the two card subtitles in D6.
- Caching generated models on the device.

## Acceptance scenarios

1. **Install from the menu.** Given the production site over HTTPS on Chrome for Android, when the user opens the three-dot menu, then Install app is offered. After installing, the home-screen icon is not clipped, the app opens without browser chrome, and the splash background is the interface's base colour.
2. **Install from the header.** Given Chrome has fired its install event, when the user taps Install in the header, then Chrome's prompt opens, and after acceptance the control disappears.
3. **iOS.** Given Safari on iOS and the app not installed, then the Install control opens a short explanation of Share, then Add to Home Screen.
4. **Offline launch.** Given the app was opened once online, when it is launched with no connection, then the shell loads, the flange appears in the viewer, and the header shows an Offline indicator.
5. **Offline preset.** Given no connection, when the user taps any of the four preset cards, then the matching bundled part appears and the form shows its parameters.
6. **Offline custom edit.** Given no connection, when the user changes a parameter so the specification no longer equals a bundled one, then the previous model stays, the form keeps the new value, and a notice says a connection is needed with a Retry control.
7. **Backend rejection.** Given the API is reachable, when the specification breaks a fabricability rule, then the backend's message and violations are shown and no bundled part replaces the model.
8. **Portrait phone.** Given 375 x 812, then the viewer is fully visible without scrolling, the page itself does not scroll, and a tab bar switches between Presets, Parameters, Describe and Report. Editing a parameter keeps the viewer visible.
9. **Landscape phone.** Given 812 x 375, then the viewer fills the left side and the tabbed panel the right.
10. **Desktop.** Given 1 280 x 800 in a browser tab, then the three-column workspace is as before, the ecosystem bar is visible, and it does not cover the header.
11. **Touch.** Given a coarse pointer, then every interactive control is at least 44 px in both directions, and pinch-zoom of the page remains possible.
12. **Update.** Given a newer release is deployed, when the installed app is opened, then a banner offers Reload and the current edits are untouched until the user accepts.

## Constraints

- REQ-UBI-04 and REQ-DEP-04: the CSP keeps one external API origin and gains nothing. `worker-src 'self'` and `manifest-src 'self'` already exist and must stay.
- REQ-DEP-01: no paid service, account or key.
- REQ-DEP-05: the public site stays anonymous and stateless; nothing user-generated is stored on the device.
- AGENTS.md: all repository text in English, strict TypeScript (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`), reserved ports 5300 and 5301.
- Precache payload at most 3 MB (about 1.6 MB today).
- No horizontal overflow from 320 px to 1 440 px.

## Assumptions and risks

| ID | Statement | Status |
|---|---|---|
| A1 | Chrome's install prompt still needs a service worker `fetch` handler, and the menu install does not (Chrome 108 and later). | Per Chrome documentation updated 2023-12-05; confirm on the device. |
| A2 | `interactive-widget=resizes-content` keeps the viewer visible above the soft keyboard while a field is edited. | Unverified; confirm on the device. |
| A3 | Vercel preview deployments may sit behind Vercel Authentication, which would block installing from a preview URL. | Confirmed on 2026-10-20: a preview deployment answers behind a Vercel login. The device check uses production or USB port forwarding. |
| A4 | `vite-plugin-pwa` 2.0.0 supports Vite 8. | Verified: the package declares `vite ^8.0.0` as a peer. |
| R1 | A stale service worker can pin an old shell. | Mitigated by the prompt-based update, `no-cache` on `sw.js`, cache cleanup and the kill switch in the runbook. |
| R2 | Rotating the phone resizes the canvas. | Check that the canvas redraws without a blank frame or a camera reset. |
| R3 | Offline, the component picker's default elbow (legs 0) differs from the bundled elbow (legs 20). | Accepted in ADR-0008. |
| R4 | `brand.naindev.com/tokens.css` is render-blocking and third-party. | Mitigated by a `media` condition so it does not block rendering on phones. |
