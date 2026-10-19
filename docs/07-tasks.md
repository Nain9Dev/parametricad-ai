# Active Task Registry: ParametriCAD AI

This document tracks all tasks, their ownership tags, and verification statuses.

- `[A]` Automated: Fully executed by the assistant.
- `[M]` Mixed: Requires user action/approval to complete.
- `[H]` Human: Solely owned by the user (credentials, payments, business decisions).

## Tasks

| ID | Tag | Description | Status | Verification |
|---|---|---|---|---|
| TSK-01 | `[A]` | Fix Windows OpenCASCADE DLL unload crash in `conftest.py` | Done | Verified: Pytest exits with code 0 on Windows |
| TSK-02 | `[A]` | Fix 42 strict mypy errors in `backend/tests/` | Done | Verified: `mypy app tests` passes with 0 errors |
| TSK-03 | `[A]` | Fix Vite build chunk size warning limit in `vite.config.ts` | Done | Verified: `npm run build` passes with 0 warnings |
| TSK-04 | `[A]` | Create CI workflow `.github/workflows/ci.yml` | Done | Verified: Workflow file validated |
| TSK-05 | `[A]` | Author canonical constitution `AGENTS.md` and `docs/` suite | Done | Verified: Markdown and Mermaid syntax validated |
| TSK-06 | `[A]` | Consolidate and commit local refactor on branch `main` | Done | Verified: working tree clean at `9942e35` |
| TSK-07 | `[A]` | Push `main` to `origin` and set default branch | Done | Verified: the remote default is `main`; `master` is a vestigial alias fast-forwarded onto `main` (Vercel production branch had been tracking `master`) |
| TSK-08 | `[M]` | Review and approve Proposed Architecture Decision Records (ADRs) | Done | User approved on 2026-09-30: all three moved to `Accepted` (commits `d9212f5`, docs suite) |
| TSK-09 | `[A]` | Reserve local ports 5300/5301/8130 and enforce them with `strictPort` | Done | Verified: `tests/unit/test_config.py`, `docs/10-runbook.md` section 1 |
| TSK-10 | `[A]` | Retry the catalog load and disclose a cold start in the web client | Done | Verified: four attempts then one error, notice after 3.5 s |
| TSK-11 | `[A]` | Declare response headers and asset caching in `frontend/vercel.json` | Done | Verified: built bundle served under the CSP with zero violations |
| TSK-12 | `[A]` | Add link preview metadata, `robots.txt`, and `sitemap.xml` | Done | Verified: `npm run build` emits all three into `dist/` |
| TSK-13 | `[M]` | Confirm the deployed headers after the Vercel build completes | Next | `curl -sI https://parametricad.naindev.com/` shows the CSP |
| TSK-14a | `[M]` | Decide the kernel parallelization strategy (`docs/03-open-questions.md` item 1) and approve the resulting ADR | Done | Approved 2026-10-03 in session: option C (single-flight kernel, bounded pipeline overlap, capacity observability); recorded in `docs/06-decisions/ADR-0004-kernel-concurrency-strategy.md` |
| TSK-14b | `[A]` | Implement ADR-0004: document `kernel_max_concurrency` as a pipeline budget, bounded pipeline overlap in `ModelGenerationService`, kernel capacity (`active`/`pending`/`max`) on `/health`, `Retry-After` semantics preserved | Done | Verified: TDD cycle T6–T8 passing (`test_concurrency_bounds_pipelines_not_kernel_calls`, `test_export_overlaps_next_build`, `test_capacity_gauges_track_acquired_and_released`, integration `test_health_reports_kernel_capacity`), 295/295 backend tests passing, 0 mypy/ruff errors, 14/14 vitest passing |
| TSK-15 | `[A]` | Point the Vercel production branch at `main` (it had stayed on vestigial `master`, leaving `parametricad.naindev.com` stale on the Sep 7 build) | Done | Verified: production deploys are now triggered from `main`; the production URL serves the `frontend/vercel.json` headers (TSK-13 check) |
| TSK-16 | `[M]` | Review and approve ADR-0005 (Phase 2 Industrial Fittings, Viewport Metrology, and Stateless Refinement) | Done | User approved 2026-10-14 in session; recorded in `docs/06-decisions/ADR-0005-phase-2-roadmap.md` |
| TSK-17 | `[A]` | Formulate domain models, validators, and fabricability invariants for `tee`, `reducer`, and `cap` (`TeeSpec`, `ReducerSpec`, `CapSpec`) | Done | Verified: 304 backend tests passing, 0 mypy/ruff errors, frontend types aligned |
| TSK-18 | `[A]` | Implement CadQuery B-Rep solid builders and multi-format exporters for new industrial fittings | Done | Verified: 48/48 kernel integration tests passing, watertightness and genus verified |
| TSK-19 | `[A]` | Implement stateless multi-turn conversational refinement endpoint `/api/v1/generate/refine` | Done | Verified: `test_refining_an_existing_spec` passing (REQ-EVT-05), conversational refinement wired to frontend |
| TSK-20 | `[A]` | Implement 3D viewport clipping plane with interior cavity inspection in Three.js | Done | Verified: interactive section plane with custom axis and offset slider in ViewerToolbar (REQ-OPT-02) |
| TSK-21 | `[A]` | Implement 3D viewport caliper measurement tool with vertex snapping | Done | Verified: CaliperOverlay measuring exact 3D distances with live snapping and delta coordinates (REQ-OPT-03) |
| TSK-22 | `[A]` | Update machine-checked traceability matrix (REQ-UBI-08) for Phase 2 requirements | Done | Verified: `test_traceability` passes with 0 unmatched requirements and 100% test coverage |
| TSK-23 | `[M]` | Review and approve ADR-0006 (Universal Geometric Validation Runner C1–C10 and Golden Model Regression) | Done | User approved 2026-10-14 in session; recorded in `docs/06-decisions/ADR-0006-universal-validation-runner.md` |
| TSK-24 | `[A]` | Implement modular check runner architecture (`CheckRunner`, `BaseCheck`, `CheckRegistry`) in `domain/geometry/runner/` | Done | Verified: unit tests in `test_validation_runner.py` passing |
| TSK-25 | `[A]` | Formalize C1–C10 check suite with dual-contract reporting emitting `validation_report.json` | Done | Verified: 10/10 standardized checks passing, fail-closed policy verified |
| TSK-26 | `[A]` | Implement offline Golden Model regression suite and GitHub Actions workflow (`.github/workflows/regression.yml`) | Done | Verified: 9 reference parts evaluated against C1..C10 spectrum, 0 EUR execution on GitHub Actions |
| TSK-27 | `[A]` | Clear the viewer lint warnings, test caliper and section plane geometry, and load Three.js on demand (React split into its own chunk) | Done | Verified: vitest 29/29, 0 oxlint warnings, `index.html` preloads only the runtime and React chunks (about 245 kB) while the 959 kB `three` chunk loads with the viewer |

## Session Handoff State

- **Done**: TSK-01 through TSK-12, TSK-14a, TSK-14b, TSK-15, TSK-16, TSK-17, TSK-18, TSK-19, TSK-20, TSK-21, TSK-22, TSK-23, TSK-24, TSK-25, TSK-26, and TSK-27.
- **Verified**: Backend suite passing (350/350, including the machine-checked
  traceability gate REQ-UBI-08), zero mypy errors, zero ruff errors, frontend
  vitest 29/29, zero oxlint errors, zero build warnings.
- **Next**: Deployment confirmation (TSK-13).

- **Known limitation**: the CSP names the API origin literally. Moving the API off
  `parametricad-ai.onrender.com` requires editing `frontend/vercel.json` in the same commit.

