"""Translation of domain failures into HTTP responses.

Routes never build error payloads themselves: they let the domain error
propagate and it is rendered here, so every failure -- validation, kernel,
storage, provider -- reaches the client in the same envelope.
"""

from __future__ import annotations

import logging
from typing import Final

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.domain.errors import ErrorCode, ParametriCadError
from app.infrastructure.api.schemas import ErrorBody, ErrorResponse

__all__ = ["register_error_handlers"]

logger = logging.getLogger(__name__)

# Spelled as literals: the 422 constant has been renamed across Starlette
# releases, and these codes are far more stable than the names for them.
HTTP_BAD_REQUEST: Final[int] = 400
HTTP_UNPROCESSABLE: Final[int] = 422
HTTP_INTERNAL_ERROR: Final[int] = 500
HTTP_UNAVAILABLE: Final[int] = 503

_STATUS_BY_CODE: Final[dict[ErrorCode, int]] = {
    # The caller asked for a part that cannot exist. Their input, their fix.
    ErrorCode.INVALID_PARAMETERS: HTTP_UNPROCESSABLE,
    ErrorCode.GEOMETRY_BUILD_FAILED: HTTP_UNPROCESSABLE,
    ErrorCode.MESH_QUALITY_REJECTED: HTTP_UNPROCESSABLE,
    ErrorCode.PARAMETER_EXTRACTION_FAILED: HTTP_UNPROCESSABLE,
    ErrorCode.UNSUPPORTED_FORMAT: HTTP_BAD_REQUEST,
    # Transient: the same request may well succeed later.
    ErrorCode.PARAMETER_EXTRACTION_UNAVAILABLE: HTTP_UNAVAILABLE,
    ErrorCode.CAPACITY_EXHAUSTED: HTTP_UNAVAILABLE,
    # Ours to fix.
    ErrorCode.TESSELLATION_FAILED: HTTP_INTERNAL_ERROR,
    ErrorCode.EXPORT_FAILED: HTTP_INTERNAL_ERROR,
    ErrorCode.STORAGE_FAILED: HTTP_INTERNAL_ERROR,
}

_RETRY_AFTER_SECONDS: Final[str] = "5"


def _render(status_code: int, body: ErrorBody, headers: dict[str, str] | None = None) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content=ErrorResponse(error=body).model_dump(mode="json"),
        headers=headers,
    )


def register_error_handlers(app: FastAPI) -> None:
    """Attach the handlers that give the API a single failure shape."""

    @app.exception_handler(ParametriCadError)
    async def _domain_error(_request: Request, exc: ParametriCadError) -> JSONResponse:
        status_code = _STATUS_BY_CODE.get(exc.code, HTTP_INTERNAL_ERROR)
        if status_code >= HTTP_INTERNAL_ERROR:
            logger.exception("Unrecoverable pipeline failure: %s", exc.code.value)

        headers = (
            {"Retry-After": _RETRY_AFTER_SECONDS}
            if status_code == HTTP_UNAVAILABLE
            else None
        )
        return _render(status_code, ErrorBody(**exc.to_payload()), headers)

    @app.exception_handler(RequestValidationError)
    async def _request_validation(
        _request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        """Report schema violations with the same code the domain would use."""
        violations = [
            {
                "field": ".".join(str(part) for part in error["loc"][1:]) or "body",
                "message": error["msg"],
                "type": error["type"],
            }
            for error in exc.errors()
        ]
        return _render(
            HTTP_UNPROCESSABLE,
            ErrorBody(
                code=ErrorCode.INVALID_PARAMETERS.value,
                message="The request does not describe a buildable component.",
                hint="Check the field names and the dimensional limits in /api/v1/catalog.",
                details={"violations": violations},
            ),
        )

    @app.exception_handler(Exception)
    async def _unexpected(_request: Request, exc: Exception) -> JSONResponse:
        """Last resort: never leak a stack trace or an internal message."""
        logger.exception("Unhandled error", exc_info=exc)
        return _render(
            HTTP_INTERNAL_ERROR,
            ErrorBody(
                code="internal_error",
                message="The request could not be completed.",
                hint="Retry, and report the incident if it persists.",
            ),
        )
