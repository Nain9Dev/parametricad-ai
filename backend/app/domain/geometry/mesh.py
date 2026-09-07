"""Immutable triangle-mesh value objects.

These types are the interchange currency between the CAD kernel, the quality
inspector and the export adapters.  They are deliberately backed by NumPy
arrays: mesh analysis is numeric work and list-of-tuples representations make
the pure algorithms in :mod:`app.domain.geometry.analysis` an order of
magnitude slower for no modelling benefit.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Final

import numpy as np
from numpy.typing import NDArray

VertexArray = NDArray[np.float64]
"""``(vertex_count, 3)`` array of vertex positions, in millimetres."""

FaceArray = NDArray[np.int64]
"""``(triangle_count, 3)`` array of vertex indices, counter-clockwise wound."""

_AXES: Final[tuple[str, str, str]] = ("x", "y", "z")


@dataclass(frozen=True, slots=True)
class BoundingBox:
    """Axis-aligned bounding box in millimetres."""

    min_corner: tuple[float, float, float]
    max_corner: tuple[float, float, float]

    @classmethod
    def from_points(cls, points: VertexArray) -> BoundingBox:
        if points.size == 0:
            zero = (0.0, 0.0, 0.0)
            return cls(min_corner=zero, max_corner=zero)
        lo = np.min(points, axis=0)
        hi = np.max(points, axis=0)
        return cls(
            min_corner=(float(lo[0]), float(lo[1]), float(lo[2])),
            max_corner=(float(hi[0]), float(hi[1]), float(hi[2])),
        )

    @property
    def size(self) -> tuple[float, float, float]:
        return tuple(hi - lo for lo, hi in zip(self.min_corner, self.max_corner, strict=True))  # type: ignore[return-value]

    @property
    def center(self) -> tuple[float, float, float]:
        return tuple((hi + lo) / 2.0 for lo, hi in zip(self.min_corner, self.max_corner, strict=True))  # type: ignore[return-value]

    @property
    def diagonal(self) -> float:
        return float(np.linalg.norm(np.asarray(self.size, dtype=np.float64)))

    def as_dict(self) -> dict[str, dict[str, float]]:
        return {
            "min": dict(zip(_AXES, self.min_corner, strict=True)),
            "max": dict(zip(_AXES, self.max_corner, strict=True)),
            "size": dict(zip(_AXES, self.size, strict=True)),
            "center": dict(zip(_AXES, self.center, strict=True)),
        }


@dataclass(frozen=True, slots=True)
class TriangleMesh:
    """An immutable indexed triangle soup.

    The arrays are marked read-only on construction so that a mesh handed to an
    inspector or an exporter can never be mutated behind the caller's back.
    """

    vertices: VertexArray
    faces: FaceArray

    def __post_init__(self) -> None:
        vertices = np.ascontiguousarray(self.vertices, dtype=np.float64)
        faces = np.ascontiguousarray(self.faces, dtype=np.int64)

        if vertices.ndim != 2 or vertices.shape[1] != 3:
            raise ValueError(f"vertices must have shape (n, 3), got {vertices.shape}")
        if faces.ndim != 2 or faces.shape[1] != 3:
            raise ValueError(f"faces must have shape (m, 3), got {faces.shape}")
        if not np.isfinite(vertices).all():
            raise ValueError("vertices contain non-finite values")
        if faces.size and (faces.min() < 0 or faces.max() >= len(vertices)):
            raise ValueError("faces reference vertex indices outside the vertex array")

        vertices.setflags(write=False)
        faces.setflags(write=False)
        object.__setattr__(self, "vertices", vertices)
        object.__setattr__(self, "faces", faces)

    @property
    def vertex_count(self) -> int:
        return int(self.vertices.shape[0])

    @property
    def triangle_count(self) -> int:
        return int(self.faces.shape[0])

    @property
    def is_empty(self) -> bool:
        return self.triangle_count == 0

    @property
    def bounding_box(self) -> BoundingBox:
        return BoundingBox.from_points(self.vertices)

    @property
    def triangles(self) -> NDArray[np.float64]:
        """``(triangle_count, 3, 3)`` array of expanded triangle corners."""
        return self.vertices[self.faces]

    def content_hash(self) -> str:
        """Stable digest of the mesh topology and geometry.

        Two structurally identical meshes produced by separate runs hash to the
        same value, which is what makes generated artifacts content-addressable.
        """
        digest = hashlib.sha256()
        digest.update(np.ascontiguousarray(self.vertices).tobytes())
        digest.update(np.ascontiguousarray(self.faces).tobytes())
        return digest.hexdigest()
