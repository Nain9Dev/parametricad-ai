"""Port for the exact-geometry (B-Rep) kernel."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol, runtime_checkable

from app.domain.geometry.mesh import TriangleMesh
from app.domain.geometry.tessellation import TessellationSettings
from app.domain.models.artifacts import ExportFormat
from app.domain.models.specs import ComponentSpec


@dataclass(frozen=True, slots=True)
class BuiltSolid:
    """A solid produced by the kernel, plus the exact properties it reported.

    ``handle`` is intentionally opaque: it holds whatever native object the
    adapter needs to keep, and nothing outside the adapter that created it may
    inspect or unwrap it. The analytic properties travel alongside so the rest
    of the pipeline can compare mesh values against ground truth without ever
    touching the kernel.
    """

    handle: Any
    kernel: str
    volume_mm3: float
    surface_area_mm2: float


@runtime_checkable
class GeometryKernelPort(Protocol):
    """Builds exact solids from specifications and discretises them."""

    def build(self, spec: ComponentSpec) -> BuiltSolid:
        """Construct the solid described by ``spec``.

        Raises:
            GeometryBuildError: the kernel could not produce a valid solid.
        """
        ...

    def tessellate(self, solid: BuiltSolid, settings: TessellationSettings) -> TriangleMesh:
        """Discretise ``solid`` into a welded, outward-oriented triangle mesh.

        Raises:
            TessellationError: the solid could not be discretised.
        """
        ...

    def export(self, solid: BuiltSolid, export_format: ExportFormat) -> bytes:
        """Encode ``solid`` in a boundary-representation format.

        Raises:
            UnsupportedFormatError: the format is not a B-Rep format.
            ExportError: the kernel refused to write the artifact.
        """
        ...
