"""Check registry for discovery and management of validation checks."""

from __future__ import annotations

from app.domain.geometry.runner.base import BaseCheck
from app.domain.geometry.runner.checks import (
    AspectRatioCheck,
    BoundingBoxCheck,
    DegenerateGeometryCheck,
    InertiaCheck,
    ManifoldTopologyCheck,
    NormalOrientationCheck,
    SelfIntersectionCheck,
    StructureIntegrityCheck,
    VolumeDivergenceCheck,
    WatertightnessCheck,
)
from app.domain.geometry.runner.types import CheckId

__all__ = ["CheckRegistry", "get_default_registry"]


class CheckRegistry:
    """Registry maintaining available geometric checks."""

    def __init__(self) -> None:
        self._checks: dict[CheckId, BaseCheck] = {}

    def register(self, check: BaseCheck) -> None:
        """Register a check instance. Overwrites existing registration for the same ID."""
        self._checks[check.check_id] = check

    def get(self, check_id: CheckId) -> BaseCheck:
        """Retrieve a check by its CheckId."""
        return self._checks[check_id]

    def all_checks(self) -> list[BaseCheck]:
        """Return all registered checks in canonical order."""
        order = list(CheckId)
        return [self._checks[cid] for cid in order if cid in self._checks]


def get_default_registry() -> CheckRegistry:
    """Construct the standard C1-C10 check registry."""
    registry = CheckRegistry()
    registry.register(StructureIntegrityCheck())
    registry.register(DegenerateGeometryCheck())
    registry.register(ManifoldTopologyCheck())
    registry.register(WatertightnessCheck())
    registry.register(NormalOrientationCheck())
    registry.register(SelfIntersectionCheck())
    registry.register(AspectRatioCheck())
    registry.register(BoundingBoxCheck())
    registry.register(VolumeDivergenceCheck())
    registry.register(InertiaCheck())
    return registry
