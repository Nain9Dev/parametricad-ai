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
