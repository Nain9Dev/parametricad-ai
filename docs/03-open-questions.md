# Open Questions & Future Considerations

This document tracks unresolved engineering questions, investigation items, and future design enhancements for ParametriCAD AI.

## Technical Considerations

1. **CAD Kernel Parallelization**:
   - *Status*: Open.
   - *Context*: OpenCASCADE is not universally thread-safe across simultaneous compound operations. The current implementation serializes kernel jobs per worker process (`kernel_max_concurrency=1`).
   - *Question*: Should multi-worker scaling be managed solely via Uvicorn process clustering, or should asynchronous IPC workers (e.g. Celery / background worker pool) handle long-running kernel tessellations?

2. **Hierarchical Multi-Part Assemblies**:
   - *Status*: Deferred.
   - *Context*: Current scope validates individual mechanical components (pipes, elbows, flanges, plates).
   - *Question*: How should multi-body mated assemblies (e.g. flange bolted to pipe) be represented deterministically in the canonical JSON schema?

3. **Client-Side WASM Kernel Alternative**:
   - *Status*: Under exploration.
   - *Context*: Running OpenCASCADE / CadQuery in the backend requires dedicated server resources.
   - *Question*: Could a WebAssembly-compiled OpenCASCADE engine (e.g. opencascade.js) be integrated for zero-backend client-side preview generation, using the backend purely for official STEP/DXF export?

4. **Store Distribution of the Installed App**:
   - *Status*: Deferred.
   - *Context*: Spec 001 makes the web client installable from Chrome. A Trusted Web Activity could list the same PWA on Google Play, but needs a Play Console account and fee (`[H]`).
   - *Question*: Is store presence worth the account, review cycle and signing-key custody for a portfolio demo?

5. **Mobile-Native Capabilities**:
   - *Status*: Deferred.
   - *Context*: Out of scope for spec 001. Candidates: file handling so a saved project JSON opens the installed app, Web Share Target, app shortcuts to the four bundled parts, and manifest `screenshots` for Chrome's richer install dialog (spec 001 T-018).
   - *Question*: Which of these are useful enough on a phone to justify the extra surface?

6. **Browser-Level Verification of the PWA and the Compact Layout**:
   - *Status*: Resolved. ADR-0009 (accepted 2026-10-20) adopted Chromium-only Playwright specs in a dedicated CI job; they live in `frontend/e2e/` (TSK-31). The first run of the job on a hosted runner is still to come.
   - *Context*: Vitest with jsdom cannot exercise a service worker or real layout. Spec 001 verifies those by hand in a real browser and on a device.
   - *Question*: Should a Playwright smoke suite (offline reload, manifest, 375 px layout, touch-target audit) join CI? It adds a development dependency and CI minutes, so it needs its own ADR.
