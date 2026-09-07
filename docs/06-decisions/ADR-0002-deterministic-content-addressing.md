# ADR-0002: Deterministic Content Addressing via Parameter Digest

- **Status**: Proposed
- **Date**: 2026-09-07
- **Context**: Re-running the CAD kernel and OpenCASCADE tessellation for previously generated components introduces avoidable latency and CPU load.
- **Decision**: Generate an immutable `model_id` using the SHA-256 digest of the sorted canonical JSON representation of component parameters, tessellation settings, and engine revision.
- **Consequences**:
  - *Positive*: Instant artifact re-serving when requests carry identical parameters.
  - *Positive*: Artifact URLs (`/static/models/<model_id>/model.glb`) can be safely cached with immutable cache-control headers.
  - *Trade-off*: Any change to the tessellation algorithm or solid builder alters the digest, requiring regeneration.
