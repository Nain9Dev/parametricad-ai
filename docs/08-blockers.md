# Blockers & External Dependencies

This document registers external dependencies, blocking risks, and required credentials.

## Current Blockers

None currently blocking automated local testing or compilation.

Spec 001 (installable mobile app): ADR-0007 and ADR-0008 were accepted on 2026-10-19 (TSK-29), so nothing waits on a decision. Verifying the install on a real phone (TSK-33) waits only on the user's device: production has served the build since 2026-10-20. No account, key or paid service is needed.

ADR-0009 (browser-level tests with Playwright) was accepted on 2026-10-20 (TSK-30), so nothing waits on a decision. TSK-31 (the dependency, the specs, the `ci.yml` job) is done and green on Windows and on Linux under WSL. The first run of the `e2e` job on a GitHub-hosted runner (2026-10-20) proved WebGL there and failed once on a race in the application, which TSK-34 fixed; the run after the fix is green. No account, key or paid service is needed.

## External Dependencies Required

1. **Groq API Key (Optional)**:
   - *Env var*: `PARAMETRICAD_GROQ_API_KEY`
   - *Impact*: When omitted, the engine automatically falls back to `RuleBasedParameterExtractor`, operating completely offline without external network dependencies.
2. **CAD System Graphics Stack (Linux Docker / CI)**:
   - *Packages*: `libgl1`, `libglx-mesa0`, `libegl1`, `libxrender1`, `libxext6`, `libsm6`, `libice6`.
   - *Status*: Configured in `backend/Dockerfile` and `.github/workflows/ci.yml`.
3. **Android phone with Chrome 108 or later** (`[H]`, spec 001 T-017):
   - *What*: the user's own device, to verify installation, standalone launch, touch gestures, the soft keyboard and offline start.
   - *Env var*: none.
   - *Unblocks*: the device checklist in `specs/001-installable-mobile-app/plan.md` section 7 (TSK-33).
   - *Ready when*: Chrome's three-dot menu offers Install app on the production URL.
4. **Secure origin serving the build** (`[M]`, spec 001 T-017):
   - *What*: Chrome installs only from a secure origin (`localhost` counts), and a phone cannot reach the development machine's `localhost` directly.
   - *Where*: production at `https://parametricad.naindev.com` (Vercel project `nain-dev/parametricad-ai`; it builds from `master`, so a release is `git push origin main` then `git push origin main:master`, `docs/10-runbook.md` section 5), or USB debugging with port forwarding of 5301 (`chrome://inspect/#devices`) after `npm run build && npm run preview`.
   - *Env var*: none; the production client already has `VITE_API_URL` in Vercel.
   - *Verify ready*: `curl -sI https://parametricad.naindev.com/manifest.webmanifest` answers 200 with `Cache-Control: no-cache`. Ready as of 2026-10-20.
   - *Caveat, confirmed on 2026-10-20*: Vercel preview deployments sit behind a Vercel login, so they cannot be used to test installation.
5. **Pillow** (`[A]`, only when the brand mark changes):
   - *What*: `pip install pillow` for `frontend/scripts/generate-pwa-icons.py`. The generated PNGs are committed, so CI does not need it.
6. **Playwright Chromium** (`[A]`, TSK-31, ADR-0009):
   - *What*: `npx playwright install --only-shell chromium`, about 120 MiB from `cdn.playwright.dev`, into the browser cache (`PLAYWRIGHT_BROWSERS_PATH` when set, otherwise `%LOCALAPPDATA%\ms-playwright` or `~/.cache/ms-playwright`), never into the repository. The CI job adds `--with-deps`, which installs OS packages with `apt-get`. No account, key or paid service; GitHub-hosted runners are free for this public repository.
   - *Env var*: none required; `PLAYWRIGHT_BROWSERS_PATH` is optional.
   - *Unblocks*: `npm run test:e2e` locally and the `e2e` CI job.
   - *Ready when*: the WebGL probe spec passes. It does locally (2026-10-20: headless shell 156.0.8078.4, software WebGL2 through SwiftShader) and on the first hosted run (2026-10-20, 1.4 s).
   - *Caveat, confirmed on 2026-10-20*: WebGL through SwiftShader works on the hosted runner (ADR-0009, decision 7).
