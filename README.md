# ParametriCAD AI - Autonomous CAD Engine

This is a functional MVP (TRL 3-4) for the **AI-BOOST Challenge 2 (Agentic AI for Automated CAD Generation and Autonomous Simulation)**.

## Architecture

The project uses a Clean/Hexagonal Architecture to separate concerns:

- **Frontend**: React + Vite + Three.js (`@react-three/fiber`) for the 3D Viewer.
- **Backend**: FastAPI with Ports and Adapters.
  - **LLM Adapter**: Extracts parameters from Natural Language (Mock / Groq).
  - **CAD Adapter**: Generates parametric CAD geometry and exports to `.glb` using `CadQuery`.
  - **Simulation Adapter**: Validates meshes and calculates metrics using `trimesh`.

## Requirements

- Node.js
- Python 3.10+
- Docker (Recommended for Backend due to C++ OpenCASCADE dependencies in CadQuery).

## Running Locally

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

*Or using Docker:*
```bash
docker build -t ai-boost-backend .
docker run -p 8000:8000 ai-boost-backend
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## KPIs

- Parameter extraction via LLM from engineering NLP input.
- <10s response time leveraging asynchronous API processing.
- 30fps 3D web rendering.
