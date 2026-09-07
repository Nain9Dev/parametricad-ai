"""Use case: build a model from an explicit specification."""

from __future__ import annotations

from collections.abc import Sequence

from app.application.services.model_generation_service import ModelGenerationService
from app.domain.models.artifacts import ExportFormat
from app.domain.models.results import GeneratedModel
from app.domain.models.specs import ComponentSpec

__all__ = ["GenerateFromSpecUseCase"]


class GenerateFromSpecUseCase:
    """Direct parametric generation, with no language model in the path."""

    def __init__(self, service: ModelGenerationService) -> None:
        self._service = service

    def execute(
        self, spec: ComponentSpec, formats: Sequence[ExportFormat] | None = None
    ) -> GeneratedModel:
        return self._service.generate(spec, formats)
