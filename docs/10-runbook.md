# Operational Runbook: ParametriCAD AI

This runbook describes local development setup, containerized builds, testing, and production deployment procedures.

## 1. Local Development

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
3. Start the FastAPI development server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

### Frontend Setup
1. Install Node.js dependencies:
   ```bash
   cd frontend
   npm install
   ```
2. Start the Vite development server:
   ```bash
   npm run dev
   ```
3. Access the web interface at `http://localhost:5173`.

## 2. Quality Verification Suite

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

## 3. Containerized Deployment (Docker)

To build and run the production container:
```bash
cd backend
docker build -t parametricad-core:latest .
docker run -d -p 8000:8000 --name parametricad parametricad-core:latest
```

Health check verification:
```bash
curl http://127.0.0.1:8000/health
```
