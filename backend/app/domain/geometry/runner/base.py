"""Abstract base classes for validation checks."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass

from app.domain.geometry.mesh import TriangleMesh
from app.domain.geometry.runner.types import CheckId, CheckResult

__all__ = ["BaseCheck", "ValidationContext"]


@dataclass(frozen=True)
class ValidationContext:
    """Optional environmental data supplied alongside the mesh."""

    reference_volume_mm3: float | None = None
    expected_bounding_box_diagonal_mm: float | None = None
    max_volume_deviation_ratio: float = 0.02
    max_aspect_ratio: float = 100.0


class BaseCheck(ABC):
    """Protocol implemented by every geometric validator."""

    check_id: CheckId
    name: str
    is_blocking: bool = True

    @abstractmethod
    def evaluate(self, mesh: TriangleMesh, context: ValidationContext) -> CheckResult:
        """Execute the mathematical check against the provided mesh."""
