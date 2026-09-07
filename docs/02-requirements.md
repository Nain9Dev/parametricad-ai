# System Requirements: ParametriCAD AI

This document details functional and non-functional requirements formulated in Easy Approach to Requirements Syntax (EARS).

## 1. Ubiquitous Requirements

- **REQ-UBI-01**: The system shall produce a content-addressed `model_id` calculated from the SHA-256 digest of the canonical parameter specification, engine revision, and tessellation parameters.
- **REQ-UBI-02**: The system shall isolate domain geometry logic from all external I/O, database systems, and HTTP transport layers.
- **REQ-UBI-03**: The system shall expose a schema catalog endpoint at `/api/v1/catalog` containing all component parameter limits, defaults, units, and descriptions.

## 2. Event-Driven Requirements

- **REQ-EVT-01**: When a valid `ComponentSpec` is received at `/api/v1/models`, the system shall generate the requested 3D solid, tessellate it to a triangle mesh, perform topological verification, and export the requested formats.
- **REQ-EVT-02**: When a prompt string is received at `/api/v1/generate`, the system shall extract dimensional parameters using the configured parameter extractor before initiating model generation.
- **REQ-EVT-03**: When an identical specification has previously been processed and cached, the system shall return existing artifact URLs without re-running the CAD kernel.

## 3. State-Driven Requirements

- **REQ-STA-01**: While running in offline mode or when no Groq API key is configured, the system shall execute the deterministic rule-based extractor.
- **REQ-STA-02**: While mesh quality validation is active (`reject_invalid_meshes=true`), the system shall abort artifact publication and return an error if a mesh fails non-manifold, watertightness, or normal orientation checks.

## 4. Unwanted Behaviour Requirements

- **REQ-UNW-01**: If input parameters violate fabricability constraints (such as `wall_thickness >= outer_radius`), the system shall reject the request with HTTP 422 and an `invalid_parameters` error code before contacting the CAD kernel.
- **REQ-UNW-02**: If the CAD kernel fails to acquire an execution lock within `kernel_acquire_timeout_s`, the system shall return HTTP 503 with a `capacity_exhausted` error code.
- **REQ-UNW-03**: If natural language text lacks recognized mechanical component keywords, the system shall reject the request with HTTP 400 and a `parameter_extraction_failed` error code.

## 5. Optional Feature Requirements

- **REQ-OPT-01**: Where supported by client requests, the system may generate 2D DXF profiles alongside 3D meshes and B-Rep solids.
