# ADR-0004: Kernel Concurrency Strategy

- **Status**: Accepted (approved 2026-10-03, TSK-14a)
- **Date**: 2026-10-03
- **Resolves**: Open question 1 in `docs/03-open-questions.md` (CAD Kernel Parallelization, TSK-14)

## Context

OpenCASCADE is not reliably re-entrant: simultaneous B-Rep operations on a
shared kernel instance can corrupt internal state. The codebase already
enforces the consequence of that fact:

- `CadQueryKernel` takes a process-wide `threading.RLock` around every
  `build`, `tessellate`, and `export` call, so only one kernel operation runs
  at a time **by construction**.
- `ModelGenerationService` additionally wraps the whole
  build → tessellate → inspect → export → store pipeline in a
  `threading.BoundedSemaphore(kernel_max_concurrency)` (default `1`),
  answered with HTTP 503 `capacity_exhausted` + `Retry-After` when the
  semaphore is full (REQ-UNW-02).

The production deployment is a free-tier Render instance with **512 MB** of
RAM, and REQ-DEP-01 restricts the whole stack to zero-EUR hosts. That ceiling
constrains every available scaling lever.

The open question was whether long-running kernel jobs should move to
multi-worker process scaling or to asynchronous IPC workers.

## Options Considered

### Option A — Uvicorn multi-worker process clustering

Run N uvicorn workers, each loading its own CadQuery/OpenCASCADE instance,
and let the OS spread concurrent requests across them.

- *Rejected*: a second loaded kernel is roughly another 150–200 MB of RSS on
  top of a footprint that already fills a meaningful share of the 512 MB
  instance. Two workers make OOM plausible under normal demo traffic.
  Scaling on this host is by **instances** (spinning up more free-tier
  services behind a load balancer), not by stacking processes inside one box.

### Option B — Asynchronous IPC workers (Celery / background worker pool)

Move kernel tessellation and export to a worker pool fed by a message broker,
so long builds never occupy a request slot.

- *Rejected*: a broker (Redis/RabbitMQ) is a separate managed service tier
  that no free host provides alongside the kernel load, and self-hosting one
  on the same 512 MB instance removes the capacity the kernel needs.
  It also adds a moving part (queue durability, retry semantics) that buys
  nothing at a single-digit-requests-per-minute demo traffic level.

### Option C — Single-flight kernel with bounded pipeline overlap **(chosen)**

Accept the in-process reality: the kernel runs one operation at a time, and
everything that can run concurrently with the kernel *does* run concurrently.

1. The kernel `RLock` remains the **single authoritative guard** against
   re-entrant OpenCASCADE state. No new lock layer is introduced in front of
   it.
2. `kernel_max_concurrency` stops being misread as "kernel parallelism": it
   is the number of pipelines that may be in flight at once. Only the
   kernel-bound stages (`build`, B-Rep `export`) hold the kernel lock;
   mesh export (Trimesh), quality inspection bookkeeping, and filesystem
   `save` run **outside** the kernel critical section and overlap with the
   next request's kernel work.
3. Observability: `/health` reports the kernel semaphore state
   (`active_jobs`, `queued_jobs`, `max_concurrency`), so a 503
   `capacity_exhausted` response is explainable and the client-side
   backoff (REQ-EVT retry) can use `Retry-After` instead of guessing.
4. Scaling above one pipeline at a time, if ever required, is a
   deployment-level decision (more instances / paid tier), out of scope here.

## Decision

Adopt **Option C**. Concurrency safety comes from the kernel lock alone;
throughput comes from overlapping non-kernel work with kernel work; capacity
is made visible through the health endpoint; horizontal growth stays a
deployment decision, not a code change in this repository.

## Consequences

- *Positive*: no new runtime dependencies, no new moving parts; the change is
  a set of narrow refactors inside `ModelGenerationService` plus a health
  payload field, all testable without the real kernel.
- *Positive*: deterministic behavior under load is preserved: at most one
  kernel operation is ever in flight, so OCCT corruption scenarios remain
  impossible by construction.
- *Positive*: `Retry-After` on 503 now carries real information
  (queue length), improving the cold-start and backoff UX for the web client.
- *Trade-off*: a single pipeline cannot make progress while a kernel job is
  running; end-to-end latency of a *batch* of distinct builds is improved,
  but any individual build's time-to-start is bounded by the previous build's
  kernel stages.
- *Trade-off*: memory stays capped at one kernel instance; if future traffic
  demands real parallelism, the answer is a new deployment (ADR-level) change,
  not a configuration knob.
