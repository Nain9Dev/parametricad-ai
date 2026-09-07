"""Mesh inspector adapter.

The algorithms live in the domain; this adapter only binds the configured
thresholds to them so the pipeline can depend on a port instead of a module.
"""

from __future__ import annotations

from app.domain.geometry.mesh import TriangleMesh
from app.domain.geometry.quality import (
    MeshQualityReport,
    QualityThresholds,
    inspect_mesh,
)

__all__ = ["GeometricMeshInspector"]


class GeometricMeshInspector:
    """Applies a fixed quality gate to every mesh it is given."""

    def __init__(self, thresholds: QualityThresholds | None = None) -> None:
        self._thresholds = thresholds or QualityThresholds()

    @property
    def thresholds(self) -> QualityThresholds:
        return self._thresholds

    def inspect(
        self,
        mesh: TriangleMesh,
        *,
        reference_volume_mm3: float | None = None,
    ) -> MeshQualityReport:
        return inspect_mesh(
            mesh,
            reference_volume_mm3=reference_volume_mm3,
            thresholds=self._thresholds,
        )
