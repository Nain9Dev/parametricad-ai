# System Requirements: ParametriCAD AI

This document details functional and non-functional requirements formulated in Easy Approach to Requirements Syntax (EARS).

## 1. Ubiquitous Requirements

- **REQ-UBI-01**: The system shall produce a content-addressed `model_id` calculated from the SHA-256 digest of the canonical parameter specification, engine revision, and tessellation parameters.
- **REQ-UBI-02**: The system shall isolate domain geometry logic from all external I/O, database systems, and HTTP transport layers.
- **REQ-UBI-03**: The system shall expose a schema catalog endpoint at `/api/v1/catalog` containing all component parameter limits, defaults, units, and descriptions.
- **REQ-UBI-04**: The system shall serve the web client with a Content Security Policy restricting script, style, and connection sources to its own origin and the configured API origin. (frontend)
- **REQ-UBI-05**: The system shall bind its local development servers to reserved ports (5300 web client, 8130 API) and fail to start rather than fall back to a different port.
- **REQ-UBI-06**: The system shall estimate the mass of every generated solid from the resolved material density and the exact kernel-reported volume, and include it in the generation result.
- **REQ-UBI-07**: The system shall persist artifacts atomically under filesystem-safe content-addressed filenames, reject unsafe identifiers before they reach a path, and prune only the artifacts it manages when a retention cap is reached.
- **REQ-UBI-08**: The system shall maintain a machine-checked traceability matrix in which every requirement has at least one covering test, every test declares the requirement(s) it verifies, and no test references an unknown requirement.
- **REQ-UBI-09**: The system shall expose a health endpoint reporting the active adapters and serve its OpenAPI document at a stable path.
- **REQ-UBI-10**: The system shall publish a web app manifest declaring the application name and short name, `start_url`, `scope`, `display: standalone`, theme and background colours equal to the interface's base colour, a 192 px and a 512 px icon, and a separate maskable 512 px icon, so that Chrome offers to install the application. (frontend)
- **REQ-UBI-11**: The system shall register a service worker that precaches the application shell, the manifest, the icons, the preset catalogue and the four bundled preset models, and shall not cache any response from the generation API or its artifacts. (frontend)
- **REQ-UBI-12**: The system shall lay out the workspace below 1024 px with the 3D viewer pinned in the upper part of the screen and the inputs and the report in a tabbed panel that scrolls on its own, placing viewer and panel side by side in landscape on short viewports, and shall keep the three-column workspace from 1024 px up. (frontend)
- **REQ-UBI-13**: The system shall give every interactive control a touch target of at least 44 CSS px on coarse-pointer devices, keep pinch-zoom enabled, and keep its content clear of the device safe-area insets. (frontend)
- **REQ-UBI-14**: The system shall reserve the height of the naindev ecosystem bar wherever the bar is displayed so that it never covers the application header, and shall hide the bar below 640 px, on short viewports and in the installed application. (frontend)
- **REQ-UBI-15**: The system shall define each showcase preset with a specification identical to the specification of its bundled model, so that the preset card, the form and the viewer describe the same part. (frontend)

## 2. Event-Driven Requirements

- **REQ-EVT-01**: When a valid `ComponentSpec` is received at `/api/v1/models`, the system shall generate the requested 3D solid, tessellate it to a triangle mesh, perform topological verification, and export the requested formats.
- **REQ-EVT-02**: When a prompt string is received at `/api/v1/generate`, the system shall extract dimensional parameters using the configured parameter extractor before initiating model generation.
- **REQ-EVT-03**: When an identical specification has previously been processed and cached, the system shall return existing artifact URLs without re-running the CAD kernel.
- **REQ-EVT-04**: When a catalog request fails with a transport-level error, the web client shall retry it up to three times with an increasing backoff before surfacing the failure. (frontend)
- **REQ-EVT-05**: When a refinement request with `current_spec` and `prompt` is received at `/api/v1/generate/refine`, the system shall apply relative and absolute parameter adjustments onto `current_spec`, re-validate fabricability invariants, and generate the updated solid without server-side session persistence.
- **REQ-EVT-06**: When the browser reports that the application can be installed, the web client shall offer an Install control in the header that opens the browser's install prompt, and shall remove it once the application is installed or the prompt has been used; on iOS Safari, which reports nothing, the control shall explain Add to Home Screen instead. (frontend)
- **REQ-EVT-07**: When the service worker has downloaded a new version of the application, the web client shall announce it and apply it only when the user accepts, so that an automatic reload never discards edits in progress. (frontend)
- **REQ-EVT-08**: When the page loads, the user picks a showcase card or the user opens a project file, the web client shall send one generation request for that model and shall not send a second one for the same values when the parameter form settles on them, so that the cards are not locked again and the service does the work once. (frontend)

## 3. State-Driven Requirements

- **REQ-STA-01**: While running in offline mode or when no Groq API key is configured, the system shall execute the deterministic rule-based extractor.
- **REQ-STA-02**: While mesh quality validation is active (`reject_invalid_meshes=true`), the system shall abort artifact publication and return an error if a mesh fails non-manifold, watertightness, or normal orientation checks.
- **REQ-STA-03**: While the first catalog request has been pending for longer than 3.5 seconds, the web client shall disclose that the hosted service may be resuming from idle. (frontend)
- **REQ-STA-04**: While the device reports no network connection, the web client shall show an offline indicator in the header and keep the application and the four bundled presets usable. (frontend)

## 4. Unwanted Behaviour Requirements

- **REQ-UNW-01**: If input parameters violate fabricability constraints (such as `wall_thickness >= outer_radius`), the system shall reject the request with HTTP 422 and an `invalid_parameters` error code before contacting the CAD kernel.
- **REQ-UNW-02**: If the CAD kernel fails to acquire an execution lock within `kernel_acquire_timeout_s`, the system shall return HTTP 503 with a `capacity_exhausted` error code.
- **REQ-UNW-03**: If natural language text lacks recognized mechanical component keywords, the system shall reject the request with HTTP 400 and a `parameter_extraction_failed` error code.
- **REQ-UNW-04**: If the generation service is unreachable, does not answer within the client timeout or fails with a server error, then the web client shall serve a bundled preset only when the requested specification, or showcase prompt, is identical to it; otherwise it shall keep the previous model, report that a connection is needed and offer a retry. (frontend)
- **REQ-UNW-05**: If the generation service rejects a request with a described failure such as `invalid_parameters`, then the web client shall show that failure and shall not substitute a bundled preset for it. (frontend)

## 5. Optional Feature Requirements

- **REQ-OPT-01**: Where supported by client requests, the system may generate 2D DXF profiles alongside 3D meshes and B-Rep solids.
- **REQ-OPT-02**: The web client shall provide interactive 3D section plane slicing with interior stencil cap rendering to inspect internal hollow features. (frontend)
- **REQ-OPT-03**: The web client shall provide an interactive 3D caliper measurement tool with vertex snapping to inspect physical dimensions on the viewport canvas. (frontend)

## 6. Deployment Requirements

- **REQ-DEP-01**: The system shall deploy its entire production stack exclusively to zero-euro-cost (free-tier) hosts, with the canonical deployment target list maintained in `deploy/hosts.json`, and every declared target must have `"free": true` and `"cost_eur": 0`.
- **REQ-DEP-02**: Where a deployed target uses auto-sleeping free-tier compute, the system shall maintain a scheduled keepalive pinger (a GitHub Actions workflow that `GET`s every sleeping target's health path) with an interval of 1 to 10 minutes, so that the portfolio service answers interactive traffic within seconds at any hour of the day.
- **REQ-DEP-03**: The system shall disclose a bounded cold-start budget in the client: after a service sleep, a returning visitor's first catalogue response must typically complete within 30 seconds (backend-only sleep), so the web user interface degrades to a notice instead of a broken page. (frontend)
- **REQ-DEP-04**: The web client shall name exactly one external API origin in its Content Security Policy `connect-src` directives, and that origin shall appear in the service's CORS defaults, so that a deployment host change requires touching every declaration in the same commit. (frontend)
- **REQ-DEP-05**: The production deployment shall keep all advertised functionality available to anonymous visitors at any time, without authentication, uploads, or user-specific state, because the service is a public portfolio artifact.
- **REQ-DEP-06**: The system shall serve the service worker script and the manifest with `Cache-Control: no-cache` so that an installed client picks up a new release on its next launch, and shall keep `worker-src 'self'` and `manifest-src 'self'` in its Content Security Policy. (frontend)
