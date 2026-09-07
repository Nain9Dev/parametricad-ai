"""Use case: build a model from a natural-language description."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

from app.application.services.model_generation_service import ModelGenerationService
from app.domain.models.artifacts import ExportFormat
from app.domain.models.results import GeneratedModel
from app.domain.ports.parameter_extractor import ParameterExtractorPort

__all__ = ["GenerateFromPromptUseCase", "PromptGenerationResult"]


@dataclass(frozen=True, slots=True)
class PromptGenerationResult:
    """The generated model plus which backend interpreted the prompt.

    Naming the extractor matters for trust: a client should be able to tell that
    a part came from the deterministic parser rather than a hosted model.
    """

    model: GeneratedModel
    extractor: str


class GenerateFromPromptUseCase:
    """Extraction followed by generation, as two separately reportable failures."""

    def __init__(
        self,
        extractor: ParameterExtractorPort,
        service: ModelGenerationService,
    ) -> None:
        self._extractor = extractor
        self._service = service

    def execute(
        self, prompt: str, formats: Sequence[ExportFormat] | None = None
    ) -> PromptGenerationResult:
        spec = self._extractor.extract(prompt)
        model = self._service.generate(spec, formats)
        return PromptGenerationResult(model=model, extractor=self._extractor.name)
