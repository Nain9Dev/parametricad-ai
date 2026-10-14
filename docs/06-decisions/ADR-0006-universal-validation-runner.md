# ADR-0006: Universal Geometric Validation Runner (C1-C10) and Golden Model Regression

- **Status**: Accepted (approved 2026-10-14, TSK-23)
- **Date**: 2026-10-14
- **Resolves**: Integration of enterprise-grade deterministic 3D validation runners adapted into clean-room NainDev architecture, preserving repository publicity and zero-cost constraints.

## Context

ParametriCAD AI currently runs topological and quality checks directly inside `app/domain/geometry/quality.py`. To establish institutional engineering authority and ensure long-term stability without regressions as the component catalog scales, the system requires:
1. A formal, extensible check-runner architecture (`BaseCheck`, `CheckRegistry`, `ValidationRunner`).
2. Standardization of geometric checks into the canonical C1–C10 validation spectrum.
3. A Dual-Contract reporting mechanism: publishing an immutable, machine-readable `validation_report.json` alongside 3D artifacts.
4. An offline Golden Model Regression suite running on GitHub Actions to guarantee zero geometric regressions at 0 EUR infrastructure cost.

To respect isolation and intellectual property, this subsystem is implemented clean-room: pure mathematical algorithms and Pydantic models with zero coupling to external private business logic.

## Decision

### 1. Check Spectrum Formalization (C1–C10)

Formalize mesh and B-Rep validation into ten standardized check codes:
- **C1 (Structure & Buffer Integrity)**: Validates vertex/index array shapes, buffer byte alignments, and triangle index bounds.
- **C2 (Degenerate Geometry & Quanta)**: Detects zero-area facets, collinear triangles, and coordinate deviations below quantum threshold ($10^{-12}\text{ mm}^2$).
- **C3 (2-Manifold Topology)**: Enforces Euler characteristic $\chi = 2 - 2g$, zero non-manifold edges (facet fan $> 2$), and zero non-manifold pinch vertices.
- **C4 (Watertightness & Hermetic Closure)**: Enforces zero boundary edges and divergence-free signed boundary closure.
- **C5 (Normal Vector & Winding Consistency)**: Verifies consistent right-hand vertex winding and outward-pointing face normals.
- **C6 (Self-Intersection Invariants)**: Bounding-volume hierarchy (BVH) facet collision detection, ensuring disjoint boundary surfaces.
- **C7 (Facet Aspect Ratio & Skewness)**: Enforces maximum triangle aspect ratio ($< 100$) to prevent sliver geometry in finite element simulation.
- **C8 (Coordinate Extents & Bounds)**: Validates mesh bounding box against parametric input limits.
- **C9 (B-Rep vs Mesh Volume Divergence)**: Enforces that tessellation under-fill does not exceed relative chordal threshold ($< 2\%$).
- **C10 (Discrete vs Continuous Inertial Tensor)**: Asserts consistency between solid mass matrix and surface integral mass estimates.

### 2. Dual-Contract Reporting

When artifact generation succeeds, the engine produces an immutable, content-addressed `validation_report.json` containing:
- Engine revision and deterministic execution digest.
- Individual check status (`PASS`, `WARN`, `FAIL`).
- Exact measured quantitative metrics (Euler characteristic, boundary edge count, volume gap, maximum aspect ratio).

### 3. Golden Model Regression Harness (CI)

A dedicated GitHub Actions workflow (`.github/workflows/regression.yml`) executes offline across an immutable matrix of reference specifications (`tests/regression/golden_specs.json`). It verifies:
- Bit-for-bit mesh reproducibility where applicable.
- Invariant compliance across OpenCASCADE / CadQuery versions.
- Strict 0-EUR public runner execution with zero cloud billing.

## Consequences

- *Positive*: Upgrades ParametriCAD AI to enterprise-grade deterministic verification.
- *Positive*: Dual-contract JSON reports allow clients and downstream automation to audit asset quality programmatically.
- *Positive*: Public GitHub Actions execution costs 0 EUR and demonstrates senior architecture on public portfolio.
- *Positive*: Clean-room implementation completely insulates proprietary logic from public repositories.
- *Trade-off*: Running full BVH self-intersection on high-density meshes adds ~50–150 ms in backend generation, bounded by the ADR-0004 pipeline semaphore.
