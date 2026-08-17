# ParametriCAD AI - Autonomous CAD Engine

This is a functional MVP (TRL 3-4) **ParametriCAD AI (Agentic AI for Automated CAD Generation and Autonomous Simulation)**.

## Live Demo & Evaluator Quick Start

- **Frontend Interface:** [https://parametricad.naindev.com](https://parametricad.naindev.com)
- **Backend API:** `https://api.parametricad.naindev.com`

### Functional Prompt Example
Copy and paste this into the UI to test the LLM extraction and CAD generation pipeline:
> *"Generate a stainless steel pipe with a diameter of 25.5mm and a length of 200mm"*

## Architecture

The project uses a Clean/Hexagonal Architecture to separate concerns:

- **Frontend**: React + Vite + Three.js (`@react-three/fiber`) for the 3D Viewer.
- **Backend**: FastAPI with Ports and Adapters.
  - **LLM Adapter**: Extracts parameters from Natural Language using **Groq (Llama-3.1-70b)** for <10s inference.
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
