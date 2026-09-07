"""ASGI entry point.

``app`` is built by a factory so tests can construct an isolated instance with
their own settings instead of importing whatever the module-level singleton
happened to pick up from the environment.
"""

from __future__ import annotations

import logging
import mimetypes
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from starlette.responses import Response

from app.config import Settings, get_settings
from app.domain.models.artifacts import FORMAT_DESCRIPTORS
from app.infrastructure.api.error_handlers import register_error_handlers
from app.infrastructure.api.routes import catalog, generation, health

__all__ = ["app", "create_app"]

API_PREFIX = "/api/v1"

_IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable"

logger = logging.getLogger(__name__)


class ContentAddressedStaticFiles(StaticFiles):
    """Static files whose names are content addresses.

    An artifact's filename is a digest of its inputs, so its bytes can never
    change under the same URL. Saying so lets browsers and CDNs keep it
    indefinitely instead of revalidating on every camera move.
    """

    def file_response(self, *args: Any, **kwargs: Any) -> Response:
        response: Response = super().file_response(*args, **kwargs)
        response.headers.setdefault("Cache-Control", _IMMUTABLE_CACHE_CONTROL)
        return response


def _register_media_types() -> None:
    """Teach the static handler the CAD media types Python does not ship with."""
    for descriptor in FORMAT_DESCRIPTORS.values():
        mimetypes.add_type(descriptor.media_type, f".{descriptor.extension}")


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build the application and wire every cross-cutting concern."""
    settings = settings or get_settings()
    settings.models_dir.mkdir(parents=True, exist_ok=True)
    _register_media_types()

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        logger.info(
            "ParametriCAD AI %s starting: extractor=%s, artifacts=%s",
            settings.api_version,
            settings.resolved_extractor,
            settings.models_dir,
        )
        yield

    application = FastAPI(
        title=settings.api_title,
        version=settings.api_version,
        summary="Parametric CAD generation with deterministic mesh validation.",
        lifespan=lifespan,
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["Retry-After"],
    )

    register_error_handlers(application)

    application.include_router(health.router)
    application.include_router(catalog.router, prefix=API_PREFIX)
    application.include_router(generation.router, prefix=API_PREFIX)

    # Generated artifacts are served straight off disk; they are immutable
    # because their filename is a content address.
    application.mount(
        settings.static_url_prefix,
        ContentAddressedStaticFiles(directory=settings.static_dir),
        name="static",
    )

    @application.get("/", include_in_schema=False)
    def root() -> RedirectResponse:
        return RedirectResponse(url="/docs")

    return application


app = create_app()
