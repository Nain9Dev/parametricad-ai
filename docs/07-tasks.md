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
| TSK-14 | `[M]` | Decide the kernel parallelization strategy (`docs/03-open-questions.md` item 1) | Next | A new ADR must be proposed (process of `docs/06-decisions/`) |
| TSK-15 | `[A]` | Point the Vercel production branch at `main` (it had stayed on vestigial `master`, leaving `parametricad.naindev.com` stale on the Sep 7 build) | Done | Verified: production deploys are now triggered from `main`; the production URL serves the `frontend/vercel.json` headers (TSK-13 check) |

## Session Handoff State

- **Done**: TSK-01 through TSK-12, plus TSK-15 (Vercel production branch aligned to `main`).
- **Verified**: Backend suite passing (282/282, including the machine-checked
  traceability gate REQ-UBI-08), zero mypy errors, zero ruff errors, frontend
  vitest 10/10, zero oxlint errors, zero build warnings.
- **Next**: TSK-14 (kernel parallelization strategy as the next spec → plan → implementation
  cycle). TSK-13 closed with TSK-15: the stale `master` production branch was fast-forwarded
  to `main` and the production URL re-verified against `frontend/vercel.json`.
- **Blocked**: none.
- **Known limitation**: the CSP names the API origin literally. Moving the API off
  `parametricad-ai.onrender.com` requires editing `frontend/vercel.json` in the same commit.
