# ADR-0008: Bundled presets answer only the requests they actually match

- **Status**: Accepted (approved 2026-10-19 by the user in session, TSK-29, including the corrected elbow and plate cards)
- **Date**: 2026-10-19
- **Resolves**: The 24/7 demo fallback introduced in commit `91b7157`, which substitutes a bundled model for a failed request without saying so
- **Relates to**: REQ-UNW-04, REQ-UNW-05, REQ-UBI-15; REQ-UNW-01 (the backend rejects invalid parameters with HTTP 422); REQ-DEP-05 (all advertised functionality stays available); ADR-0007 (offline scope)

## Context

`generateFromSpec` and `generateFromPrompt` in `frontend/src/lib/apiClient.ts` abort the API call after 4 seconds. On **any** failure, including a 422 the backend described, they return the bundled model of the requested kind (`loadPresetModel`). The prompt path guesses the kind from keywords. Nothing tells the user a substitution happened, and `useGeneration` treats the result as a success.

Measured on 2026-10-19 against the running client with the backend down:

- Setting the flange outer diameter to 150 mm leaves the form at 150 mm while the Properties panel keeps reporting 100 x 100 x 12 mm, 63.15 cm3 and 498.85 g, with no notice.
- Validating the four showcase specs in `frontend/src/lib/presets.ts` against `backend/app/domain/models/specs.py` accepts flange and pipe and **rejects elbow and plate** (`extra_forbidden`: `diameter_mm`, `tangent_length_mm`, `length_mm`, `hole_diameter_mm`, `corner_fillet_radius_mm`). Those two cards only appear to work because the fallback hides the 422.
- The elbow and plate cards advertise parameters (elbow 40 mm diameter, 80 mm radius, 3 mm wall; plate 100 x 60 mm) that differ from the bundled models they display (elbow 25 mm, 50 mm, 2.5 mm wall, 20 mm legs; plate 120 x 80 x 10 mm).
- The bundled pipe, flange and plate equal the catalogue defaults; the bundled elbow equals them except `leg_length_mm` (20 against 0).

Two consequences make this urgent now. An installed app with no connection would substitute on every edit. And a described backend rejection, which REQ-UNW-01 promises the user will see, never reaches the user for the four known kinds.

## Options Considered

### Option A: Serve a bundled preset only when it matches (chosen by the user)

If the service is unreachable, slow or failing with a server error, serve the bundled model only for a specification (or showcase prompt) identical to it. Otherwise keep the last model and say a connection is needed.

### Option B: Keep substituting, with a banner

- *Rejected by the user*: the viewer would still show geometry that contradicts the form.

### Option C: Leave the behaviour alone

- *Rejected by the user*: offline use would make the silent substitution constant.

## Decision

1. **When the bundled model may answer.** Only after a transport failure, a client timeout or a 5xx response, and only when the requested specification deep-equals the bundled specification of that kind (same keys, same values, order ignored), or the normalised prompt equals the showcase prompt text. Otherwise the call fails with an `ApiError` that the existing error UI renders, and the previous model stays in the viewer (already how `useGeneration` behaves).
2. **Described failures always propagate.** A 4xx with the backend's error envelope (`invalid_parameters`, `parameter_extraction_failed` and the rest) is never replaced by a preset (REQ-UNW-05).
3. **No guessing.** The keyword heuristic that picked a kind for an arbitrary prompt is removed. It fabricated a specification the user never gave.
4. **Error codes.** `offline` when `navigator.onLine` is false, `generation_timeout` when the client budget expires, `network_unreachable` otherwise. All have status 0, so they are retryable. A timeout surfaces as an `ApiError`, never as a bare `AbortError`, because `useGeneration` ignores aborts and the spinner would never stop.
5. **Timeouts.** A request that can fall back to a bundled model keeps the 4 second race, so the one-click demos stay instant. Any other request gets 20 seconds. The 4 second budget only made sense while expiry silently produced a preset; with honest errors it would report a slow but healthy backend as unreachable. The catalogue request that wakes a sleeping instance already runs first (REQ-DEP-03).
6. **Showcase content matches the bundles (REQ-UBI-15).** The elbow and plate showcase specs become the specs of their bundled models, and their card subtitles describe those models. This is a visible content change to two demo cards and is part of what is being approved here.

## Consequences

- *Positive*: The viewer never shows geometry that contradicts the form, and a backend rejection reaches the user as REQ-UNW-01 intends.
- *Positive*: The four one-click demos keep working offline and under a cold backend, because their specs equal the bundled ones.
- *Positive*: The showcase cards state what the viewer shows.
- *Trade-off*: A custom specification sent while the backend is cold now ends in an error with a Retry after at most 20 seconds, where it used to end in a wrong model after 4.
- *Trade-off*: Choosing Elbow in the component picker uses catalogue defaults (`leg_length_mm` 0), which differ from the bundled elbow (20). Offline, that one case needs a connection while the Elbow card still works. Regenerating the bundled elbow with default legs needs a backend run and is left as a follow-up.
- *Trade-off*: The bundled model carries the original artifact list (the STL entry points at the API origin). Offline, that link does not resolve. Trimming it is out of scope here.
