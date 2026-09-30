# Operational Runbook: ParametriCAD AI

This runbook describes local development setup, containerized builds, testing, and production deployment procedures.

## 1. Local Port Reservations

This project owns fixed local ports so that it can run alongside other projects
on the same machine without either of them moving.

| Port | Process | Fixed in |
|---|---|---|
| **5300** | Vite development server | `frontend/vite.config.ts` (`server.strictPort`) |
| **5301** | Vite preview server | `frontend/vite.config.ts` (`preview.strictPort`) |
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
npm run build
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
| Web client | Vercel (project `nain-dev/parametricad-ai`) | `frontend/` from branch `main` | `VITE_API_URL` is set in the project's environment variables |
| API | Render | `backend/Dockerfile` | Suspends when idle on the free tier; the first request after a pause pays the cold start |

The Vercel project's production branch is **`main`** as of Sept 30, 2026. It had
been left pointing at the vestigial `master` alias created when the remote's
default branch migrated to `main`, so production kept serving the Sep 7 build
while `main` pushes only produced previews. If the production URL ever goes
stale again, check the branch first.

### Response headers

`frontend/vercel.json` declares the headers served with the web client:

- A Content Security Policy whose `connect-src` lists the API origin
  explicitly. **Changing the API host requires changing that directive in the
  same commit**, otherwise the browser blocks every request to the new host.
- `Cache-Control: public, max-age=31536000, immutable` for `/assets/*`. Those
  filenames carry a content hash, so the bytes behind a URL never change and a
  returning visitor can skip revalidating the ~1.1 MB Three.js chunk.

Verify both after a deployment:

```bash
curl -sI https://parametricad.naindev.com/ | grep -i content-security-policy
curl -sI https://parametricad.naindev.com/assets/<hashed-file>.js | grep -i cache-control
```
