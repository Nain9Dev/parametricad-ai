"""Domain error hierarchy.

Every failure that the generation pipeline can produce is expressed as a
:class:`ParametriCadError`.  Errors carry a stable, machine-readable code so the
transport layer can map them to HTTP responses without inspecting messages, and
an optional ``hint`` describing the concrete action a caller can take.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Any


class ErrorCode(StrEnum):
    """Stable, machine-readable identifiers for pipeline failures."""

    INVALID_PARAMETERS = "invalid_parameters"
    GEOMETRY_BUILD_FAILED = "geometry_build_failed"
    TESSELLATION_FAILED = "tessellation_failed"
    MESH_QUALITY_REJECTED = "mesh_quality_rejected"
    EXPORT_FAILED = "export_failed"
    UNSUPPORTED_FORMAT = "unsupported_format"
    STORAGE_FAILED = "storage_failed"
    PARAMETER_EXTRACTION_FAILED = "parameter_extraction_failed"
    PARAMETER_EXTRACTION_UNAVAILABLE = "parameter_extraction_unavailable"
    CAPACITY_EXHAUSTED = "capacity_exhausted"


class ParametriCadError(Exception):
    """Base class for every recoverable domain failure."""

    code: ErrorCode = ErrorCode.GEOMETRY_BUILD_FAILED

    def __init__(
        self,
        message: str,
        *,
        hint: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.hint = hint
        self.details = details or {}

    def to_payload(self) -> dict[str, Any]:
        """Serialise the error into the structured wire representation."""
        return {
            "code": self.code.value,
            "message": self.message,
            "hint": self.hint,
            "details": self.details,
        }

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"{type(self).__name__}(code={self.code.value!r}, message={self.message!r})"


class InvalidParametersError(ParametriCadError):
    """The requested component parameters are not a buildable combination."""

    code = ErrorCode.INVALID_PARAMETERS


class GeometryBuildError(ParametriCadError):
    """The CAD kernel could not produce a valid solid for the given spec."""

    code = ErrorCode.GEOMETRY_BUILD_FAILED


class TessellationError(ParametriCadError):
    """The kernel produced a solid that could not be discretised into a mesh."""

    code = ErrorCode.TESSELLATION_FAILED


class MeshQualityRejectedError(ParametriCadError):
    """The generated mesh failed the configured quality gate."""

    code = ErrorCode.MESH_QUALITY_REJECTED


class ExportError(ParametriCadError):
    """An artifact could not be encoded in the requested format."""

    code = ErrorCode.EXPORT_FAILED


class UnsupportedFormatError(ParametriCadError):
    """The requested export format is not served by any configured adapter."""

    code = ErrorCode.UNSUPPORTED_FORMAT


class StorageError(ParametriCadError):
    """An artifact could not be persisted or read back."""

    code = ErrorCode.STORAGE_FAILED


class ParameterExtractionError(ParametriCadError):
    """Natural-language input could not be turned into a valid component spec."""

    code = ErrorCode.PARAMETER_EXTRACTION_FAILED


class ParameterExtractionUnavailableError(ParametriCadError):
    """The configured extraction backend is not reachable or not configured."""

    code = ErrorCode.PARAMETER_EXTRACTION_UNAVAILABLE


class CapacityExhaustedError(ParametriCadError):
    """The kernel worker pool is saturated; the caller should retry later."""

    code = ErrorCode.CAPACITY_EXHAUSTED
