from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="ParametriCAD AI Core")

from app.infrastructure.api.routes import generate
app.include_router(generate.router, prefix="/api/v1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://parametricad.naindev.com", "https://www.naindev.com", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "ParametriCAD AI Core"}
