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
- **Development Server** (port 8130):
  ```bash
  uvicorn app.main:app --reload --port 8130
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
- **Development Server** (port 5300, fixed with `strictPort`):
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
- **Local Ports**: 5300 (web client), 5301 (Vite preview), 8130 (API). They are reserved,
  pinned with `strictPort`, and documented in `docs/10-runbook.md`. Never fall back to
  the toolchain defaults 5173 and 8000: other projects on the same machine claim them,
  and a shared origin means shared browser storage.

## Agent Operational Economy (Token Preservation)

When operated via local models (e.g., DeepSeek Harness / Ollama):
- **Surgical Edits Only**: Never regenerate complete files exceeding 150 lines. Use narrow unified diffs or targeted block replacements to prevent triggering token generation ceilings (`Output token limit reached`).
- **Atomic Tasks**: Break execution into small RED-GREEN cycles. Never accumulate multi-step refactorings in a single turn.
- **Concise Reporting**: Omit echoing unmodified code blocks or speculative prose. State exact files edited, verification command executed, and immediate pass/fail verdict.
