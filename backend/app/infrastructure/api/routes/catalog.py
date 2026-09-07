"""Capability catalog used to drive the client parameter form."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Response

from app.application.catalog import Catalog, build_catalog
from app.config import Settings, get_settings

router = APIRouter(tags=["catalog"])

_CACHE_CONTROL = "public, max-age=300"


@router.get("/catalog", response_model=Catalog, summary="Buildable components and formats")
def catalog(response: Response, settings: Settings = Depends(get_settings)) -> Catalog:
    """Describe every component, parameter, material and export format.

    The document only changes when the service is redeployed, so it is safe for
    a client to hold on to for a few minutes.
    """
    response.headers["Cache-Control"] = _CACHE_CONTROL
    return build_catalog(settings.tessellation)
