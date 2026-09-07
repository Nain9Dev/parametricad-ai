"""Port for mesh quality inspection."""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from app.domain.geometry.mesh import TriangleMesh
from app.domain.geometry.quality import MeshQualityReport


@runtime_checkable
class MeshInspectorPort(Protocol):
    """Produces the quality verdict for a tessellated solid.

    Kept behind a port so a heavier checker can be swapped in later without the
    pipeline changing, even though the default implementation is the pure
    in-domain analysis.
    """

    def inspect(
        self,
        mesh: TriangleMesh,
        *,
        reference_volume_mm3: float | None = None,
    ) -> MeshQualityReport:
        ...
