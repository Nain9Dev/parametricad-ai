# Blockers & External Dependencies

This document registers external dependencies, blocking risks, and required credentials.

## Current Blockers

None currently blocking automated local testing or compilation.

Spec 001 (installable mobile app): ADR-0007 and ADR-0008 were accepted on 2026-10-19 (TSK-29), so nothing waits on a decision. Verifying the install on a real phone (TSK-33) waits on a deployment and the user's device. No account, key or paid service is needed.

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
   - *Where*: production at `https://parametricad.naindev.com` once the change is merged to `main` (Vercel project `nain-dev/parametricad-ai`), or USB debugging with port forwarding of 5301 (`chrome://inspect/#devices`) after `npm run build && npm run preview`.
   - *Env var*: none; the production client already has `VITE_API_URL` in Vercel.
   - *Verify ready*: `curl -sI https://parametricad.naindev.com/manifest.webmanifest` answers 200 with `Cache-Control: no-cache`.
   - *Caveat, unverified*: Vercel preview deployments may require a Vercel login (Deployment Protection), in which case they cannot be used to test installation.
5. **Pillow** (`[A]`, only when the brand mark changes):
   - *What*: `pip install pillow` for `frontend/scripts/generate-pwa-icons.py`. The generated PNGs are committed, so CI does not need it.
