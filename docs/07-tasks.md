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
| TSK-06 | `[A]` | Consolidate and commit local refactor on branch `main` | Next | Pending execution |
| TSK-07 | `[A]` | Push `main` to `origin` and set default branch | Next | Pending execution |
| TSK-08 | `[M]` | Review and approve Proposed Architecture Decision Records (ADRs) | Blocked | Awaiting user review of ADR-0001, ADR-0002, ADR-0003 |

## Session Handoff State

- **Done**: TSK-01, TSK-02, TSK-03, TSK-04, TSK-05.
- **Verified**: Full backend test suite passing (261/261), zero mypy errors, zero ruff errors, zero frontend build warnings.
- **Next**: TSK-06 (commit all changes to main), TSK-07 (push to GitHub).
- **Blocked**: TSK-08 (ADR approval requires user action).
