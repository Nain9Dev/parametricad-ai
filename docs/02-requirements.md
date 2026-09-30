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

## 2. Event-Driven Requirements

- **REQ-EVT-01**: When a valid `ComponentSpec` is received at `/api/v1/models`, the system shall generate the requested 3D solid, tessellate it to a triangle mesh, perform topological verification, and export the requested formats.
- **REQ-EVT-02**: When a prompt string is received at `/api/v1/generate`, the system shall extract dimensional parameters using the configured parameter extractor before initiating model generation.
- **REQ-EVT-03**: When an identical specification has previously been processed and cached, the system shall return existing artifact URLs without re-running the CAD kernel.
- **REQ-EVT-04**: When a catalog request fails with a transport-level error, the web client shall retry it up to three times with an increasing backoff before surfacing the failure. (frontend)

## 3. State-Driven Requirements

- **REQ-STA-01**: While running in offline mode or when no Groq API key is configured, the system shall execute the deterministic rule-based extractor.
- **REQ-STA-02**: While mesh quality validation is active (`reject_invalid_meshes=true`), the system shall abort artifact publication and return an error if a mesh fails non-manifold, watertightness, or normal orientation checks.
- **REQ-STA-03**: While the first catalog request has been pending for longer than 3.5 seconds, the web client shall disclose that the hosted service may be resuming from idle. (frontend)

## 4. Unwanted Behaviour Requirements

- **REQ-UNW-01**: If input parameters violate fabricability constraints (such as `wall_thickness >= outer_radius`), the system shall reject the request with HTTP 422 and an `invalid_parameters` error code before contacting the CAD kernel.
- **REQ-UNW-02**: If the CAD kernel fails to acquire an execution lock within `kernel_acquire_timeout_s`, the system shall return HTTP 503 with a `capacity_exhausted` error code.
- **REQ-UNW-03**: If natural language text lacks recognized mechanical component keywords, the system shall reject the request with HTTP 400 and a `parameter_extraction_failed` error code.

## 5. Optional Feature Requirements

- **REQ-OPT-01**: Where supported by client requests, the system may generate 2D DXF profiles alongside 3D meshes and B-Rep solids.
