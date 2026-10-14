"""Liveness and configuration reporting."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.application.services.model_generation_service import ModelGenerationService
from app.config import Settings, get_settings
from app.infrastructure.api.dependencies import get_generation_service
from app.infrastructure.api.schemas import HealthResponse

router = APIRouter(tags=["system"])


@router.get("/health", response_model=HealthResponse, summary="Service health")
def health(
    settings: Settings = Depends(get_settings),
    service: ModelGenerationService = Depends(get_generation_service),
) -> HealthResponse:
    """Report liveness together with the adapters this deployment is running.

    Naming the extractor here means a client can tell whether parameters are
    parsed deterministically or by a hosted model without making a request.
    """
    return HealthResponse(
        status="ok",
        service=settings.api_title,
        version=settings.api_version,
        geometry_kernel="cadquery-occt",
        parameter_extractor=settings.resolved_extractor,
        kernel_capacity=service.capacity,
    )

