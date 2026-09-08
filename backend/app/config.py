"""Application settings.

Every value is overridable through the environment with the ``PARAMETRICAD_``
prefix; nested groups use a double underscore, for example
``PARAMETRICAD_TESSELLATION__LINEAR_DEFLECTION_MM=0.02``.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

from app import __version__
from app.domain.geometry.quality import QualityThresholds
from app.domain.geometry.tessellation import TessellationSettings
from app.domain.models.artifacts import ExportFormat

__all__ = ["Settings", "get_settings"]

ExtractorBackend = Literal["auto", "rule_based", "groq"]


class Settings(BaseSettings):
    """Runtime configuration for the whole service."""

    model_config = SettingsConfigDict(
        env_prefix="PARAMETRICAD_",
        env_nested_delimiter="__",
        env_file=".env",
        extra="ignore",
    )

    environment: Literal["development", "production"] = "development"
    api_title: str = "ParametriCAD AI Core"
    api_version: str = __version__

    cors_allow_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: [
            "https://parametricad.naindev.com",
            "https://www.naindev.com",
            "http://localhost:5300",
            "http://127.0.0.1:5300",
        ]
    )

    static_dir: Path = Path("static")
    models_subdir: str = "models"
    static_url_prefix: str = "/static"
    max_stored_artifacts: int = Field(default=512, ge=0)

    tessellation: TessellationSettings = Field(default_factory=TessellationSettings)
    quality: QualityThresholds = Field(default_factory=QualityThresholds)

    default_export_formats: Annotated[list[ExportFormat], NoDecode] = Field(
        default_factory=lambda: [ExportFormat.GLB, ExportFormat.STEP, ExportFormat.STL]
    )
    reject_invalid_meshes: bool = Field(
        default=True,
        description=(
            "Refuse to publish a model whose mesh failed a blocking check. "
            "Turn off only to debug geometry that is known to be broken."
        ),
    )

    kernel_max_concurrency: int = Field(
        default=1,
        ge=1,
        le=16,
        description=(
            "Concurrent CAD kernel jobs. OpenCASCADE is not reliably re-entrant, "
            "so the default serialises kernel work and scales out by process."
        ),
    )
    kernel_acquire_timeout_s: float = Field(default=30.0, gt=0.0)

    result_cache_size: int = Field(
        default=128,
        ge=0,
        description="Recently generated models kept in memory for instant re-serving.",
    )

    extractor: ExtractorBackend = "auto"
    groq_api_key: SecretStr | None = None
    groq_model: str = "llama-3.3-70b-versatile"
    groq_timeout_s: float = Field(default=20.0, gt=0.0)

    @field_validator("cors_allow_origins", "default_export_formats", mode="before")
    @classmethod
    def _split_csv(cls, value: object) -> object:
        """Accept comma-separated lists, which is how these arrive from a shell.

        ``NoDecode`` keeps pydantic-settings from insisting on JSON for these
        two fields, so ``A,B`` and ``["A","B"]`` are both accepted.
        """
        if not isinstance(value, str):
            return value
        text = value.strip()
        if text.startswith("["):
            return json.loads(text)
        return [item.strip() for item in text.split(",") if item.strip()]

    @property
    def models_dir(self) -> Path:
        return self.static_dir / self.models_subdir

    @property
    def models_url_prefix(self) -> str:
        return f"{self.static_url_prefix.rstrip('/')}/{self.models_subdir}"

    @property
    def resolved_extractor(self) -> Literal["rule_based", "groq"]:
        """Which extraction backend the wiring should build.

        ``auto`` prefers the hosted model when credentials are present and falls
        back to the offline extractor otherwise, so the service starts and works
        with no configuration at all.
        """
        if self.extractor == "auto":
            return "groq" if self.groq_api_key else "rule_based"
        return self.extractor


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Process-wide settings singleton."""
    return Settings()
