"""Request and response bodies for the HTTP API.

Kept separate from the domain models so the wire contract can evolve -- adding a
convenience field, renaming a key -- without reshaping the objects the pipeline
passes around internally.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.domain.models.artifacts import ExportFormat
from app.domain.models.results import GeneratedModel
from app.domain.models.specs import ComponentSpec

__all__ = [
    "ErrorBody",
    "ErrorResponse",
    "GenerateFromPromptRequest",
    "GenerateFromSpecRequest",
    "GenerationResponse",
    "HealthResponse",
]

MAX_PROMPT_LENGTH = 2_000


class GenerateFromSpecRequest(BaseModel):
    """Direct parametric generation."""

    model_config = ConfigDict(extra="forbid")

    spec: ComponentSpec
    formats: list[ExportFormat] | None = Field(
        default=None,
        description="Artifacts to produce. Defaults to the server-configured set.",
    )


class GenerateFromPromptRequest(BaseModel):
    """Natural-language generation."""

    model_config = ConfigDict(extra="forbid")

    prompt: str = Field(min_length=1, max_length=MAX_PROMPT_LENGTH)
    formats: list[ExportFormat] | None = None


class GenerationResponse(BaseModel):
    """A generated model as returned over HTTP."""

    model_config = ConfigDict(frozen=True)

    model: GeneratedModel
    extractor: str | None = Field(
        default=None,
        description="Which backend interpreted the prompt. Null for direct parametric requests.",
    )

    @classmethod
    def of(cls, model: GeneratedModel, extractor: str | None = None) -> GenerationResponse:
        return cls(model=model, extractor=extractor)


class ErrorBody(BaseModel):
    """The structured part of every failure response."""

    model_config = ConfigDict(frozen=True)

    code: str = Field(description="Stable identifier; safe to branch on.")
    message: str = Field(description="Human-readable summary.")
    hint: str | None = Field(
        default=None, description="A concrete next step the caller can take."
    )
    details: dict[str, Any] = Field(default_factory=dict)


class ErrorResponse(BaseModel):
    """Uniform failure envelope for every 4xx and 5xx response."""

    model_config = ConfigDict(frozen=True)

    error: ErrorBody


class HealthResponse(BaseModel):
    """Liveness and configuration summary."""

    model_config = ConfigDict(frozen=True)

    status: str
    service: str
    version: str
    geometry_kernel: str
    parameter_extractor: str
