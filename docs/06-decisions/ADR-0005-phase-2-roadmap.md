# ADR-0005: Phase 2 Industrial Fittings, Viewport Metrology, and Stateless Refinement

- **Status**: Accepted (approved 2026-10-14, TSK-16)
- **Date**: 2026-10-14
- **Resolves**: Strategic expansion following Phase 1 completion (TSK-15) and competitive benchmark analysis (Zoo.dev, Onshape, Build123d).

## Context

ParametriCAD AI successfully established a deterministic, content-addressed B-Rep solid generation pipeline with domain-isolated mesh invariant validation. The production deployment operates under a strict zero-EUR cost policy (REQ-DEP-01) on a free-tier 512 MB RAM container.

To maximize practical engineering utility and competitive parity with state-of-the-art CAD tools, three functional dimensions were evaluated:
1. Geometric scope of standard industrial components.
2. 3D web viewport inspection and metrology capabilities.
3. Conversational multi-turn parameter refinement.

## Benchmark Analysis of Reference Systems

1. **Zoo.dev (formerly Text-to-CAD / KittyCAD)**:
   - Uses an intermediate representation (KCL) and multi-turn prompt adjustments.
   - Preserves parametric state across conversational turns without requiring full assembly solver overhead.
2. **Onshape / Fusion 360**:
   - Industry-standard parametric feature trees and section analysis (interactive clipping plane to inspect interior hollow geometry).
   - Standard hardware libraries (ANSI / ISO / DIN fittings) rather than unconstrained generic primitives.
3. **Build123d / CadQuery**:
   - Programmatic B-Rep solid generation using OpenCASCADE boolean operations, sweeps, and lofts.

## Decision

Adopt a three-pillar Phase 2 expansion that preserves the zero-cost, stateless architecture:

### 1. Catalog Expansion: Industrial Piping Fittings
Expand the pure domain models and CadQuery kernel builders with three standard piping fittings:
- `tee`: Straight run with orthogonal branch, enforcing `branch_diameter <= run_diameter` and bore intersection invariants.
- `reducer`: Concentric or eccentric cone/transition, enforcing bore continuity and slope limits.
- `cap`: Domed/elliptical end closure, enforcing wall thickness and depth constraints.

### 2. Viewport Metrology & Inspection (Frontend)
Enhance the React 19 / Three.js viewer with real-time geometric inspection tools:
- **Interactive Section Plane (Clipping Plane)**: Configurable cutting plane (X/Y/Z normal, position slider) with stencil backface rendering to display solid caps on sliced hollow walls.
- **3D Caliper Tool**: Two-point interactive distance measurement with vertex snapping to inspect physical dimensions directly on the mesh canvas.

### 3. Stateless Multi-turn Refinement (`/api/v1/generate/refine`)
Implement a stateless conversational refinement endpoint:
- **Contract**: `POST /api/v1/generate/refine` receives `{ "current_spec": ComponentSpec, "prompt": str }`.
- **Behavior**: The extractor (rule-based or Groq) interprets relative or absolute modification requests (e.g., *"increase length by 50mm"*, *"change wall to 3mm"*, *"switch material to aluminium"*), applies a typed patch onto `current_spec`, and returns the validated result.
- **Stateless Invariant**: Zero server-side session persistence. The client maintains conversational context by submitting its active specification.

## Consequences

- *Positive*: Expands the component catalog from basic geometries to realistic industrial piping hardware.
- *Positive*: Interactive section slicing solves the primary limitation of inspecting internal bores in 3D viewers.
- *Positive*: Natural-language iteration enables conversational CAD modification without server state or memory overhead.
- *Trade-off*: Complex fittings (like Tee joints) increase OpenCASCADE boolean cut execution times slightly, remaining safely bounded by the ADR-0004 concurrency semaphore.
