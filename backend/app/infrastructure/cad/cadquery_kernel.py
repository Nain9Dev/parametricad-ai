"""CadQuery/OpenCASCADE implementation of :class:`GeometryKernelPort`.

Two concerns are handled here that the naive "export STL then convert" approach
gets wrong:

* **Welding.** OpenCASCADE tessellates each face independently, so the raw
  triangle soup duplicates every vertex along shared edges and is never
  watertight. Vertices are welded on a quantised lattice before the mesh leaves
  the adapter, which is what makes the topology checks meaningful.
* **Serialisation.** OCCT is not reliably re-entrant. Every kernel call is taken
  under a lock so concurrent requests cannot corrupt shared kernel state.
"""

from __future__ import annotations

import math
import tempfile
import threading
from pathlib import Path

import cadquery as cq
import numpy as np
from cadquery import exporters

from app.domain.errors import (
    ExportError,
    GeometryBuildError,
    TessellationError,
    UnsupportedFormatError,
)
from app.domain.geometry.mesh import TriangleMesh
from app.domain.geometry.tessellation import TessellationSettings
from app.domain.models.artifacts import FORMAT_DESCRIPTORS, ArtifactSource, ExportFormat
from app.domain.models.specs import ComponentSpec
from app.domain.ports.geometry_kernel import BuiltSolid
from app.infrastructure.cad.builders import build_shape

__all__ = ["CadQueryKernel"]

_KERNEL_NAME = "cadquery-occt"

_MIN_VOLUME_MM3 = 1e-9
"""Below this the kernel produced a shell or a sliver, not a solid."""


class CadQueryKernel:
    """Exact-geometry adapter backed by CadQuery."""

    def __init__(self) -> None:
        self._lock = threading.RLock()

    # ------------------------------------------------------------------ #
    # Build
    # ------------------------------------------------------------------ #
    def build(self, spec: ComponentSpec) -> BuiltSolid:
        with self._lock:
            try:
                shape = build_shape(spec)
            except Exception as exc:  # noqa: BLE001 - OCCT raises bare C++ wrappers
                raise GeometryBuildError(
                    f"The CAD kernel could not build the requested {spec.kind.value}.",
                    hint="Try less extreme proportions, or a smaller feature relative to the body.",
                    details={"kind": spec.kind.value, "kernel_error": str(exc)},
                ) from exc

            self._assert_usable_solid(shape, spec)
            return BuiltSolid(
                handle=shape,
                kernel=_KERNEL_NAME,
                volume_mm3=float(shape.Volume()),
                surface_area_mm2=float(shape.Area()),
            )

    @staticmethod
    def _assert_usable_solid(shape: cq.Shape, spec: ComponentSpec) -> None:
        """Reject shells, empty results and multi-body outputs before they spread."""
        if shape is None:
            raise GeometryBuildError(
                f"The CAD kernel returned no geometry for the requested {spec.kind.value}.",
                details={"kind": spec.kind.value},
            )
        if not shape.isValid():
            raise GeometryBuildError(
                "The CAD kernel produced an invalid solid.",
                hint="Reduce fillet radii or feature sizes relative to the body.",
                details={"kind": spec.kind.value},
            )

        solids = shape.Solids()
        if len(solids) != 1:
            raise GeometryBuildError(
                f"Expected a single solid body but the kernel produced {len(solids)}.",
                hint="Check that every feature overlaps the main body.",
                details={"kind": spec.kind.value, "solid_count": len(solids)},
            )

        volume = float(shape.Volume())
        if not math.isfinite(volume) or volume <= _MIN_VOLUME_MM3:
            raise GeometryBuildError(
                "The resulting solid encloses no volume.",
                hint="Increase the wall thickness or the overall dimensions.",
                details={"kind": spec.kind.value, "volume_mm3": volume},
            )

    # ------------------------------------------------------------------ #
    # Tessellation
    # ------------------------------------------------------------------ #
    def tessellate(self, solid: BuiltSolid, settings: TessellationSettings) -> TriangleMesh:
        shape: cq.Shape = solid.handle
        with self._lock:
            try:
                raw_vertices, raw_faces = shape.tessellate(
                    settings.linear_deflection_mm, settings.angular_deflection_rad
                )
            except Exception as exc:  # noqa: BLE001 - OCCT raises bare C++ wrappers
                raise TessellationError(
                    "The solid could not be discretised into a triangle mesh.",
                    hint="Increase the linear deflection and retry.",
                    details={"kernel_error": str(exc)},
                ) from exc

        if not raw_faces:
            raise TessellationError(
                "Tessellation produced no triangles.",
                hint="Increase the linear deflection and retry.",
            )

        vertices = np.array([(v.x, v.y, v.z) for v in raw_vertices], dtype=np.float64)
        faces = np.array(raw_faces, dtype=np.int64)
        mesh = _weld(vertices, faces, settings.weld_tolerance_mm)
        return _orient_outward(mesh)

    # ------------------------------------------------------------------ #
    # Export
    # ------------------------------------------------------------------ #
    def export(self, solid: BuiltSolid, export_format: ExportFormat) -> bytes:
        descriptor = FORMAT_DESCRIPTORS.get(export_format)
        if descriptor is None or descriptor.source is not ArtifactSource.BREP:
            raise UnsupportedFormatError(
                f"{export_format.value} is not a boundary-representation format.",
                details={"format": export_format.value},
            )

        shape: cq.Shape = solid.handle
        with tempfile.TemporaryDirectory(prefix="parametricad-") as workdir:
            target = Path(workdir) / f"model.{descriptor.extension}"
            with self._lock:
                try:
                    if export_format is ExportFormat.STEP:
                        exporters.export(
                            cq.Workplane(obj=shape), str(target), exporters.ExportTypes.STEP
                        )
                    else:
                        _export_section_dxf(shape, target)
                except ExportError:
                    raise
                except Exception as exc:  # noqa: BLE001 - OCCT raises bare C++ wrappers
                    raise ExportError(
                        f"Writing the {export_format.value.upper()} artifact failed.",
                        details={"format": export_format.value, "kernel_error": str(exc)},
                    ) from exc

            if not target.exists() or target.stat().st_size == 0:
                raise ExportError(
                    f"The {export_format.value.upper()} export produced an empty file.",
                    details={"format": export_format.value},
                )
            return target.read_bytes()


def _export_section_dxf(shape: cq.Shape, target: Path) -> None:
    """Write a DXF of the horizontal cross-section through the middle of the part.

    DXF is a 2D format, so a solid has to be reduced to a profile first. The
    mid-height plane is used because a section taken at a face boundary
    degenerates to an empty or ambiguous result.
    """
    bounds = shape.BoundingBox()
    height = bounds.zmin + bounds.zlen / 2.0
    section = cq.Workplane(obj=shape).section(height)

    if not section.faces().vals():
        raise ExportError(
            "The part has no closed cross-section at mid height.",
            hint="Export STEP instead for this geometry.",
        )
    exporters.exportDXF(section, str(target))


def _weld(
    vertices: np.ndarray, faces: np.ndarray, tolerance_mm: float
) -> TriangleMesh:
    """Merge coincident vertices and drop the faces that collapse as a result.

    Quantising onto a lattice of ``tolerance_mm`` makes the merge deterministic
    and independent of vertex ordering, which is what keeps the resulting
    content hash stable across runs.
    """
    lattice = np.round(vertices / tolerance_mm).astype(np.int64)
    _, first_occurrence, inverse = np.unique(
        lattice, axis=0, return_index=True, return_inverse=True
    )

    welded_vertices = vertices[first_occurrence]
    welded_faces = inverse.reshape(-1)[faces]

    collapsed = (
        (welded_faces[:, 0] == welded_faces[:, 1])
        | (welded_faces[:, 1] == welded_faces[:, 2])
        | (welded_faces[:, 0] == welded_faces[:, 2])
    )
    return TriangleMesh(vertices=welded_vertices, faces=welded_faces[~collapsed])


def _orient_outward(mesh: TriangleMesh) -> TriangleMesh:
    """Flip the winding if the closed mesh came back inside-out.

    OCCT normally emits outward-facing triangles, but face orientation can be
    inverted by boolean history. Normalising here means every downstream export
    and every viewer sees the same convention.
    """
    from app.domain.geometry.analysis import edge_topology, signed_volume

    topology = edge_topology(mesh)
    if not (topology.is_watertight and topology.is_winding_consistent):
        return mesh
    if signed_volume(mesh) >= 0.0:
        return mesh
    return TriangleMesh(vertices=mesh.vertices, faces=mesh.faces[:, ::-1])
