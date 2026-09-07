# ADR-0001: Hexagonal Architecture for Geometric Domain Isolation

- **Status**: Proposed
- **Date**: 2026-09-07
- **Context**: The original MVP tightly coupled CadQuery, Groq, and FastAPI routes, making testing slow and domain invariants hard to protect.
- **Decision**: Adopt Hexagonal Architecture (Ports and Adapters) separating domain models and algorithms from external frameworks and geometry kernels.
- **Consequences**:
  - *Positive*: Domain algorithms and validation rules test in milliseconds with zero dependencies.
  - *Positive*: Swapping geometry kernels or AI providers requires changing only the adapter.
  - *Trade-off*: Requires explicit port interfaces and dependency injection wiring in `app/infrastructure/api/dependencies.py`.
