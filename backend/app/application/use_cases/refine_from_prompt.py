"""Use case: refine an existing model from a natural-language description."""

from __future__ import annotations

from collections.abc import Sequence

from app.application.services.model_generation_service import ModelGenerationService
from app.application.use_cases.generate_from_prompt import PromptGenerationResult
from app.domain.models.artifacts import ExportFormat
from app.domain.models.specs import ComponentSpec
from app.domain.ports.parameter_extractor import ParameterExtractorPort

__all__ = ["RefineFromPromptUseCase"]


class RefineFromPromptUseCase:
    """Incremental refinement followed by generation."""

    def __init__(
        self,
        extractor: ParameterExtractorPort,
        service: ModelGenerationService,
    ) -> None:
        self._extractor = extractor
        self._service = service

    def execute(
        self,
        current_spec: ComponentSpec,
        prompt: str,
        formats: Sequence[ExportFormat] | None = None,
    ) -> PromptGenerationResult:
        refined_spec = self._extractor.refine(current_spec, prompt)
        model = self._service.generate(refined_spec, formats)
        return PromptGenerationResult(model=model, extractor=self._extractor.name)
