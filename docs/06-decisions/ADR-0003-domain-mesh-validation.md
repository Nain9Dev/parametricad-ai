# ADR-0003: Pure Domain Topological Mesh Validation

- **Status**: Accepted (approved 2026-09-30, TSK-08)
- **Date**: 2026-09-07
- **Context**: Relying directly on external mesh libraries (such as Trimesh or Open3D) for quality checks couples core validation invariants to third-party releases and obscures deterministic edge cases.
- **Decision**: Implement core topological verification algorithms (watertightness, edge manifolds, normal consistency, signed volume) directly within `app/domain/geometry/`.
- **Consequences**:
  - *Positive*: Complete determinism and full testability using property-based hypothesis tests without heavy dependencies.
  - *Positive*: Invariants are provably enforced before any artifact is exported or published.
  - *Trade-off*: Self-intersection checks require custom ray/triangle intersection math or bounding volume hierarchies in Python/NumPy.
