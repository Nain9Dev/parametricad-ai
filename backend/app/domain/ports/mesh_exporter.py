"""Port for encoding a triangle mesh into a transport format."""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from app.domain.geometry.mesh import TriangleMesh
from app.domain.models.artifacts import ExportFormat


@runtime_checkable
class MeshExporterPort(Protocol):
    """Serialises meshes into viewer- and manufacturing-facing formats."""

    def export(
        self,
        mesh: TriangleMesh,
        export_format: ExportFormat,
        *,
        metadata: dict[str, str] | None = None,
    ) -> bytes:
        """Encode ``mesh``, attaching ``metadata`` where the format supports it.

        Raises:
            UnsupportedFormatError: the format is not a mesh format.
            ExportError: encoding failed.
        """
        ...
