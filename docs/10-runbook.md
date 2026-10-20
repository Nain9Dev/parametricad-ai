# Operational Runbook: ParametriCAD AI

This runbook describes local development setup, containerized builds, testing, and production deployment procedures.

## 1. Local Port Reservations

This project owns fixed local ports so that it can run alongside other projects
on the same machine without either of them moving.

| Port | Process | Fixed in |
|---|---|---|
| **5300** | Vite development server | `frontend/vite.config.ts` (`server.strictPort`) |
| **5301** | Vite preview server, and the browser tests (section 7) | `frontend/vite.config.ts` (`preview.strictPort`), `frontend/e2e/support/env.ts` |
| **8130** | Uvicorn API server | `docs/10-runbook.md`, `frontend/.env.example` |

Two rules make the reservation hold:

1. **Never fall back to another port.** `strictPort` makes Vite fail to start
   when 5300 is taken instead of quietly serving on 5301. That failure is the
   only cheap signal that something else already owns the port; a dev server
   that silently moves produces a URL that no longer matches the bookmark, the
   README, or the backend's CORS list.
2. **Never share an origin between projects.** The browser scopes
   `localStorage`, cookies, and service workers to the origin, not to the
   project. Two apps taking turns on `http://localhost:5173` inherit each
   other's stored state, which surfaces as a session appearing in the wrong
   application. Note that `localhost` and `127.0.0.1` are *different* origins:
   switching between them hides the symptom by handing out empty storage, it
   does not resolve the collision.

The default ports of both toolchains are deliberately avoided. Vite's 5173 and
FastAPI's 8000 are the first thing every other project claims, and on a machine
running Docker Desktop both are frequently held by the Docker backend before any
project starts.

Finding the current owner of a port on Windows:

```powershell
Get-NetTCPConnection -State Listen -LocalPort 5300 |
  Select-Object LocalPort, OwningProcess,
    @{n='Process';e={(Get-Process -Id $_.OwningProcess -EA SilentlyContinue).ProcessName}}
```

## 2. Local Development

### Backend Setup
1. Create and activate a Python 3.12 virtual environment:
   ```bash
   cd backend
   python -m venv venv
   # On Windows:
   .\venv\Scripts\Activate.ps1
   # On Linux/macOS:
   source venv/bin/activate
   ```
2. Install development dependencies:
   ```bash
   pip install -r requirements-dev.txt
   ```
3. Start the FastAPI development server on the reserved port:
   ```bash
   uvicorn app.main:app --reload --port 8130
   ```
4. Verify the service is up:
   ```bash
   curl http://localhost:8130/health
   ```

### Frontend Setup
1. Install Node.js dependencies:
   ```bash
   cd frontend
   npm install
   ```
2. Point the client at the backend by copying the environment template:
   ```bash
   cp .env.example .env.local
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Access the web interface at `http://localhost:5300`.

`http://localhost:5300` is in the backend's default `cors_allow_origins`. Serving
the frontend from any other origin requires adding it explicitly:

```bash
PARAMETRICAD_CORS_ALLOW_ORIGINS=http://localhost:5300,http://localhost:4000 \
  uvicorn app.main:app --reload --port 8130
```

## 3. Quality Verification Suite

Always run the full suite before committing changes:
```bash
# Backend
cd backend
ruff check .
mypy app tests
pytest

# Frontend
cd ../frontend
npm run lint
npm run typecheck
npm run typecheck:e2e
npm test
npm run build
npm run verify:pwa
npm run test:e2e   # headless Chromium; install it once and keep port 5301 free (section 7)
```

## 4. Containerized Deployment (Docker)

To build and run the production container:
```bash
cd backend
docker build -t parametricad-core:latest .
docker run -d -p 8130:8000 --name parametricad parametricad-core:latest
```

The container always listens on 8000 internally; the host side of the mapping
uses the reserved port so the container does not collide with anything else
running locally.

Health check verification:
```bash
curl http://127.0.0.1:8130/health
```

## 5. Production Deployment

| Surface | Host | Source | Notes |
|---|---|---|---|
| Web client | Vercel (project `nain-dev/parametricad-ai`) | `frontend/`; production builds from branch `master`, every other branch gets a preview | `VITE_API_URL` is set in the project's environment variables |
| API | Render | `backend/Dockerfile` | Suspends when idle on the free tier; the first request after a pause pays the cold start |

Production builds from **`master`**, not `main`. Observed on Oct 20, 2026 through
the GitHub Deployments API: a push of `main` produced a `Preview` deployment of
`74fe8c4`, and fast-forwarding `master` to that same commit produced the
`Production` one. A note dated Sept 30 had recorded the production branch as
`main`; the behaviour contradicts it, so read Settings, Git, Production Branch in
the Vercel project before relying on either. Preview deployments sit behind a
Vercel login, so a phone cannot install from them (section 6).

To release the web client, publish `main`, then fast-forward `master` to it:

```bash
git push origin main
git push origin main:master    # no force: refused unless it fast-forwards
```

Setting the production branch to `main` in the Vercel project (TSK-15) removes the
second push, and this paragraph with it. If the production URL ever goes stale,
check the branch first.

### Response headers

`frontend/vercel.json` declares the headers served with the web client:

- A Content Security Policy whose `connect-src` lists the API origin
  explicitly. **Changing the API host requires changing that directive in the
  same commit**, otherwise the browser blocks every request to the new host.
- `Cache-Control: public, max-age=31536000, immutable` for `/assets/*`. Those
  filenames carry a content hash, so the bytes behind a URL never change and a
  returning visitor can skip revalidating the ~1.1 MB Three.js chunk.
- `Cache-Control: no-cache` for `/sw.js` and `/manifest.webmanifest`, and
  `Content-Type: application/manifest+json` for the manifest. Those two keep fixed
  names, so a cached copy would pin an installed client to an old release
  (section 6).

Verify them after a deployment:

```bash
curl -sI https://parametricad.naindev.com/ | grep -i content-security-policy
curl -sI https://parametricad.naindev.com/assets/<hashed-file>.js | grep -i cache-control
curl -sI https://parametricad.naindev.com/sw.js | grep -i cache-control
curl -sI https://parametricad.naindev.com/manifest.webmanifest | grep -iE 'cache-control|content-type'
```

## 6. Progressive Web App

The web client installs from Chrome (three-dot menu, Install app) and from the
Install button in its header. [ADR-0007](06-decisions/ADR-0007-installable-pwa.md)
records the design; this section is how to run, test and recover it.

### What ships

| File | Role |
|---|---|
| `frontend/public/manifest.webmanifest` | Name, colours, display mode and icons that Chrome reads before it offers installation |
| `frontend/public/icons/` | 192 px and 512 px icons, a maskable 512 px icon, and the 180 px Apple touch icon |
| `dist/sw.js`, `dist/workbox-*.js` | The service worker, generated at build time from `frontend/pwa.config.ts` |

The worker precaches the application shell and the four bundled presets, so the
installed app opens with no connection and shows those four parts. It caches
nothing at runtime: no API response, no artifact, nothing from another origin.

### Build and check

```bash
cd frontend
npm run build
npm run verify:pwa     # reads dist/sw.js: expected files precached, no runtime routes, under 3 MB
npm run preview        # http://localhost:5301
```

`npm run dev` registers no worker, by design. Installation and offline behaviour
exist only in the built bundle.

### Testing installation

**Desktop Chrome.** Open `http://localhost:5301` after `npm run preview`.
`localhost` counts as a secure origin, so Chrome shows an Install icon in the
address bar.

**An Android phone, before a release.** Chrome installs only from HTTPS or
`localhost`, and a phone cannot reach this machine's `localhost`, so forward the
port over USB:

1. Enable USB debugging on the phone and connect it.
2. Open `chrome://inspect/#devices` on this machine, choose Port forwarding, and
   map `5301` to `localhost:5301`.
3. Run `npm run preview` and open `http://localhost:5301` in Chrome on the phone.

**An Android phone, after a release.** Open `https://parametricad.naindev.com`
and use the three-dot menu. The device checklist is in
`specs/001-installable-mobile-app/plan.md`, section 7. Vercel preview deployments
sit behind a Vercel login (confirmed on Oct 20, 2026), so Chrome cannot install
from them: use production or the USB route above.

### Offline start without a phone

Load the preview once, stop `npm run preview`, and reload the tab. The service
worker answers, and the four presets still open. Editing a part that is not one
of them then reports that a connection is needed. `npm run test:e2e` runs this
check, and the update check below, without anyone stopping a server (section 7).

### Updates

A new release downloads in the background and waits. The client shows "A new
version is available" with Reload and Later, and the page reloads only on Reload,
so an edit in progress is never discarded. Choosing Later leaves the new version
to take over the next time the app is opened. `e2e/update.spec.ts` stages this
with two builds (section 7).

**Known limitation.** If the tab was opened before any worker controlled it (the
very first visit), choosing Reload activates the new worker but does not reload
the page: the banner stays and the tab keeps running the old code until it is
reloaded by hand. `workbox-window` marks such a page as not being an update, and
the PWA plugin reloads only for an update. Observed on 2026-10-20 with a scratch
experiment (no reload, one controller change, banner still shown); not fixed yet,
and the update spec starts from a returning visit for that reason.

### Recovering from a bad worker

If a worker that reached users misbehaves, set `selfDestroying: true` in
`frontend/pwa.config.ts` and deploy. The generated worker unregisters itself and
deletes every cache the next time a client checks for updates. Set it back to
`false` once clients have recovered. A client that never reconnects keeps the old
worker until it does.

### Icons

The PNGs in `frontend/public/icons/` are committed. Regenerate them only when the
mark changes, from the repository root, with Pillow installed (`pip install pillow`):

```bash
py -3 frontend/scripts/generate-pwa-icons.py
```

## 7. Browser Tests

[ADR-0009](06-decisions/ADR-0009-playwright-browser-tests.md) adds Playwright
specs in `frontend/e2e/` for what jsdom cannot run: the service worker, the
offline start, the update prompt, the layout at phone widths and the touch
targets. Vitest stays the runner for everything under `frontend/src/`.

### Running them

```bash
cd frontend
npx playwright install --only-shell chromium   # once per machine; a revision already there is skipped
npm run test:e2e
```

`npm run test:e2e` builds two production bundles, serves one of them with
`vite preview` on `127.0.0.1:5301` and drives headless Chromium against it. It
needs no backend and no internet: the ecosystem bar and its stylesheet are
replaced by stubs, and every request to the generation service is aborted.

- **Port 5301 must be free** (section 1). The run fails instead of adopting a
  preview that is already running, because the update spec rewrites what is served.
- **The browser** lives in `PLAYWRIGHT_BROWSERS_PATH` when that variable is set,
  and otherwise in `%LOCALAPPDATA%\ms-playwright` (Windows) or
  `~/.cache/ms-playwright` (Linux). On Linux add `--with-deps` to install the
  system packages too. `--headed` needs the full Chromium: `npx playwright install chromium`.
- **Everything the run generates** (bundles, report, traces) is under
  `frontend/node_modules/.cache/parametricad-e2e/`, which git ignores.

### What each spec proves

| Spec | Proves | Requirements |
|---|---|---|
| `webgl-probe.spec.ts` | WebGL2 works and the viewer draws the first part; every other spec waits for it | precondition |
| `worker.spec.ts` | the manifest is served as `application/manifest+json` and Chrome accepts it; the worker controls the page after one load; Cache Storage holds the shell and the presets and nothing from another origin | REQ-UBI-10, REQ-UBI-11, REQ-EVT-07 |
| `offline.spec.ts` | with the network off, a reload is answered by the worker and all four presets open with their own bounding boxes; the Offline badge follows the connection | REQ-UBI-11, REQ-STA-04 |
| `update.spec.ts` | a second release is announced and waits; the old version, and an edit in progress, stay until Reload; Later leaves them | REQ-EVT-07 |
| `layout.spec.ts` | at 320, 360, 375, 812 x 375, 768 x 1 024 and 1 280 x 800: no overflow, the viewer visible, tabs and toolbar fit, the header not covered by the bar | REQ-UBI-12, REQ-UBI-14, REQ-EVT-06 |
| `touch.spec.ts` | with touch on, no control under 44 px on the four tabs or in the View sheet | REQ-UBI-13, REQ-EVT-06 |
| `fallback.spec.ts` | with the service unreachable, an edit keeps the previous model and shows the connection notice; a bundled specification is still answered | REQ-UNW-04 |

Still manual, on the phone (section 6): a real install prompt and Chrome's menu
entry, standalone display and the bar hidden once installed, the soft keyboard,
and iOS Add to Home Screen. Headless Chromium never fires `beforeinstallprompt`,
so the specs send the event by hand; that only proves the Install control reacts
to it.

### How the update spec stages a release

`serve.mjs` builds the application twice. The two bundles differ only in the
address of the generation service baked into them (`http://api-a.e2e.invalid` and
`http://api-b.e2e.invalid`, hosts that never resolve), which is enough for the
service worker to see a new release. `e2e/support/bundles.ts` copies one bundle
over the directory `vite preview` serves, which it reads again on every request.
Playwright cannot route the browser's check of `sw.js`, so replacing the files is
the only way to stage an update. The spec opens the first release twice, so the
page starts under the worker the way a returning visitor's does, and puts the
second release behind it.

### Reading a failure

```bash
npx playwright show-report node_modules/.cache/parametricad-e2e/report
npx playwright show-trace node_modules/.cache/parametricad-e2e/results/<test>/trace.zip
```

A failing test keeps its trace and a screenshot. In CI the `e2e` job uploads the
HTML report as the `playwright-report` artifact for seven days, but only when the
job fails. On CI a test that passes only on its retry fails the run
(`failOnFlakyTests`): treat it as a defect, not as noise. Every run replaces the
report and clears the traces, so copy `report/` somewhere else before running the
suite again; a failure that is gone from the next run cannot be diagnosed.

### When something else fails first

- **The probe fails.** The machine has no WebGL2 in headless Chromium. Playwright
  already passes `--enable-unsafe-swiftshader`, so software rendering should be
  available. Try the full Chromium instead of the shell (`channel: 'chromium'` in
  `playwright.config.ts`), and record what the probe's attached renderer string says.
- **`EADDRINUSE` or "already used" on 5301.** Something owns the port (section 1).
  Stop it; do not move the suite to another port.
- **Under WSL with `networkingMode=mirrored`** a connection to a closed loopback
  port hangs until the TCP timeout instead of being refused, so Playwright's check
  that 5301 is free costs about two minutes before the server starts (seen on
  2026-10-20). The suite then runs as usual; Windows and the hosted runner are not affected.
- **A Playwright bump.** The release brings a new Chromium revision. Install it
  (`npx playwright install --only-shell chromium`), run the suite, and read a
  failure as a browser change before assuming a bug. Old revisions can be deleted
  from the browser cache.
