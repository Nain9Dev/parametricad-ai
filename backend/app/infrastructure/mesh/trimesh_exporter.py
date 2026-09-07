"""Trimesh implementation of :class:`MeshExporterPort`.

The mesh handed in has already been welded, oriented and validated by the
kernel adapter, so ``process=False`` is used throughout: letting trimesh
re-process would silently re-weld with its own tolerance and desynchronise the
exported artifact from the mesh that was actually inspected.
"""

from __future__ import annotations

import trimesh
from trimesh.exchange import gltf

from app.domain.errors import ExportError, UnsupportedFormatError
from app.domain.geometry.mesh import TriangleMesh
from app.domain.models.artifacts import FORMAT_DESCRIPTORS, ArtifactSource, ExportFormat

__all__ = ["TrimeshExporter"]

_SCENE_NODE_NAME = "model"


def _to_bytes(payload: object, export_format: ExportFormat) -> bytes:
    """Normalise a trimesh export result into bytes.

    The encoders are declared as returning a union that also covers text and,
    for multi-file formats, a mapping. Every call here asks for one binary
    document, so anything else means the library changed under us.
    """
    if isinstance(payload, bytes):
        return payload
    if isinstance(payload, bytearray | memoryview):
        return bytes(payload)
    if isinstance(payload, str):
        return payload.encode("utf-8")
    raise ExportError(
        f"The {export_format.value.upper()} encoder returned an unexpected payload.",
        details={"format": export_format.value, "payload_type": type(payload).__name__},
    )


class TrimeshExporter:
    """Serialises triangle meshes into viewer- and print-facing formats."""

    def export(
        self,
        mesh: TriangleMesh,
        export_format: ExportFormat,
        *,
        metadata: dict[str, str] | None = None,
    ) -> bytes:
        descriptor = FORMAT_DESCRIPTORS.get(export_format)
        if descriptor is None or descriptor.source is not ArtifactSource.MESH:
            raise UnsupportedFormatError(
                f"{export_format.value} is not a mesh format.",
                details={"format": export_format.value},
            )
        if mesh.is_empty:
            raise ExportError(
                "Refusing to export an empty mesh.",
                details={"format": export_format.value},
            )

        try:
            return self._encode(mesh, export_format, metadata or {})
        except ExportError:
            raise
        except Exception as exc:  # noqa: BLE001 - third-party encoders raise broadly
            raise ExportError(
                f"Writing the {export_format.value.upper()} artifact failed.",
                details={"format": export_format.value, "encoder_error": str(exc)},
            ) from exc

    def _encode(
        self, mesh: TriangleMesh, export_format: ExportFormat, metadata: dict[str, str]
    ) -> bytes:
        native = trimesh.Trimesh(
            vertices=mesh.vertices, faces=mesh.faces, process=False, validate=False
        )

        if export_format is ExportFormat.STL:
            return _to_bytes(native.export(file_type="stl"), export_format)

        # glTF carries provenance in ``scene.extras``, which viewers ignore and
        # downstream tooling can read back.
        scene = trimesh.Scene(
            geometry={_SCENE_NODE_NAME: native},  # type: ignore[arg-type]
            metadata=dict(metadata) if metadata else None,
        )

        if export_format is ExportFormat.GLB:
            return _to_bytes(scene.export(file_type="glb"), export_format)  # type: ignore[no-untyped-call]

        files = gltf.export_gltf(scene, embed_buffers=True)  # type: ignore[no-untyped-call]
        try:
            return _to_bytes(next(iter(files.values())), export_format)
        except StopIteration as exc:  # pragma: no cover - encoder always emits one file
            raise ExportError(
                "The glTF encoder produced no output.",
                details={"format": export_format.value},
            ) from exc
