# Agent Guidelines for ParametriCAD AI

This document defines the canonical project constitution and operational rules for working in this repository.

## Architecture & Boundary Principles

1. **Hexagonal Architecture**:
   - `backend/app/domain`: Pure geometry algorithms, Pydantic specifications, domain models, and port protocols. No I/O, no database or disk operations, no HTTP concepts, no direct CAD kernel dependencies.
   - `backend/app/application`: Pipeline orchestration and use cases (`GenerateFromSpecUseCase`, `GenerateFromPromptUseCase`, `ModelGenerationService`, catalog).
   - `backend/app/infrastructure`: Frameworks, drivers, and external libraries (FastAPI routes/middleware, CadQuery / OpenCASCADE kernel adapter, Trimesh exporter, Groq / Rule-based parameter extractors, Filesystem artifact storage).
2. **Deterministic Mesh Validation**:
   - Mesh topological checks (closedness, 2-manifoldness, outward normal consistency, zero self-intersections, quality metrics) live in `domain/geometry/`.
   - Never delegate geometric invariant enforcement to interchangeable third-party mesh libraries.
3. **Content Addressing**:
   - Models are identified by the SHA-256 digest of canonical parameter specifications and tessellation settings (`model_id`), guaranteeing immutable artifact reuse.

## Verification & Commands

### Backend

- **Virtual Environment**: Use the Python interpreter in `backend/venv/Scripts/python.exe`.
- **Run Tests**:
  ```bash
  pytest
  ```
- **Linting**:
  ```bash
  ruff check .
  ```
- **Type Checking** (strict mode enabled):
  ```bash
  mypy app tests
  ```

### Frontend

- **Install Dependencies**:
  ```bash
  npm install
  ```
- **Development Server**:
  ```bash
  npm run dev
  ```
- **Type Checking**:
  ```bash
  npm run typecheck
  ```
- **Linting**:
  ```bash
  npm run lint
  ```
- **Production Build**:
  ```bash
  npm run build
  ```

## Repository Standards

- **Language**: All repository contents (code, comments, documentation, commits, identifiers, tests) must be written in English.
- **Documentation**: All architectural documentation lives in `docs/` ordered by lifecycle phase. Architecture diagrams use Mermaid flowcharts; data model documentation uses Mermaid erDiagrams.
- **Commit Style**: Conventional Commits in English without dates or AI-generated markers.
