"""Model generation endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from starlette.concurrency import run_in_threadpool

from app.application.use_cases.generate_from_prompt import GenerateFromPromptUseCase
from app.application.use_cases.generate_from_spec import GenerateFromSpecUseCase
from app.infrastructure.api.dependencies import (
    get_generate_from_prompt_use_case,
    get_generate_from_spec_use_case,
)
from app.infrastructure.api.schemas import (
    ErrorResponse,
    GenerateFromPromptRequest,
    GenerateFromSpecRequest,
    GenerationResponse,
)

router = APIRouter(tags=["generation"])

_ERROR_RESPONSES: dict[int | str, dict[str, object]] = {
    400: {"model": ErrorResponse, "description": "Unsupported export format"},
    422: {"model": ErrorResponse, "description": "The part cannot be built as specified"},
    503: {"model": ErrorResponse, "description": "Engine busy or extractor unavailable"},
}


@router.post(
    "/models",
    response_model=GenerationResponse,
    responses=_ERROR_RESPONSES,
    summary="Generate a model from explicit parameters",
)
async def generate_from_spec(
    request: GenerateFromSpecRequest,
    use_case: GenerateFromSpecUseCase = Depends(get_generate_from_spec_use_case),
) -> GenerationResponse:
    """Build a component from a validated specification.

    The CAD kernel is blocking C++ work, so it runs on a worker thread rather
    than stalling the event loop for every other in-flight request.
    """
    model = await run_in_threadpool(use_case.execute, request.spec, request.formats)
    return GenerationResponse.of(model)


@router.post(
    "/generate",
    response_model=GenerationResponse,
    responses=_ERROR_RESPONSES,
    summary="Generate a model from a natural-language description",
)
async def generate_from_prompt(
    request: GenerateFromPromptRequest,
    use_case: GenerateFromPromptUseCase = Depends(get_generate_from_prompt_use_case),
) -> GenerationResponse:
    """Extract parameters from ``prompt`` and build the resulting component."""
    result = await run_in_threadpool(use_case.execute, request.prompt, request.formats)
    return GenerationResponse.of(result.model, extractor=result.extractor)
