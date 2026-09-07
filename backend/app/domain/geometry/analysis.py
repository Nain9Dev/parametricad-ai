"""Pure, dependency-free geometric analysis of triangle meshes.

Everything here is a deterministic function of its inputs: no I/O, no CAD
kernel, no global state. That makes the invariants directly property-testable
and keeps the meaningful part of "mesh validation" inside the domain instead of
delegating it to whichever mesh library happens to be installed.

Length-dependent tolerances are expressed relative to the bounding-box diagonal
so the same thresholds behave identically for a 5 mm bolt and a 5 m beam.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
from numpy.typing import NDArray

from app.domain.geometry.mesh import TriangleMesh

__all__ = [
    "EdgeTopology",
    "SelfIntersectionResult",
    "connected_component_count",
    "degenerate_face_indices",
    "duplicate_face_indices",
    "edge_topology",
    "find_self_intersections",
    "signed_volume",
    "surface_area",
    "triangle_areas",
    "unreferenced_vertex_count",
]

_RELATIVE_EPS = 1e-9
"""Scale-free epsilon applied to the bounding-box diagonal."""

_BARYCENTRIC_EPS = 1e-9
"""Interior margin keeping edge-on contacts from counting as crossings."""


# --------------------------------------------------------------------------- #
# Basic metrics
# --------------------------------------------------------------------------- #
def triangle_areas(mesh: TriangleMesh) -> NDArray[np.float64]:
    """Per-triangle area in square millimetres."""
    if mesh.is_empty:
        return np.zeros(0, dtype=np.float64)
    tri = mesh.triangles
    cross = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    return 0.5 * np.linalg.norm(cross, axis=1)


def surface_area(mesh: TriangleMesh) -> float:
    """Total surface area in square millimetres."""
    return float(triangle_areas(mesh).sum())


def signed_volume(mesh: TriangleMesh) -> float:
    """Signed volume in cubic millimetres, via the divergence theorem.

    A closed, outward-oriented mesh yields a positive value; a mesh whose
    normals point inward yields its negation. Only meaningful when the mesh is
    watertight, which the caller is expected to check first.
    """
    if mesh.is_empty:
        return 0.0
    tri = mesh.triangles
    products = np.einsum("ij,ij->i", tri[:, 0], np.cross(tri[:, 1], tri[:, 2]))
    return float(products.sum() / 6.0)


def _scale_epsilon(mesh: TriangleMesh) -> float:
    return max(mesh.bounding_box.diagonal, 1.0) * _RELATIVE_EPS


# --------------------------------------------------------------------------- #
# Topology
# --------------------------------------------------------------------------- #
@dataclass(frozen=True, slots=True)
class EdgeTopology:
    """Edge-incidence summary used for manifold and watertightness checks."""

    unique_edge_count: int
    boundary_edge_count: int
    """Edges incident to exactly one face: the mesh has holes."""
    non_manifold_edge_count: int
    """Edges incident to three or more faces."""
    inconsistently_wound_edge_count: int
    """Interior edges traversed in the same direction by both incident faces."""

    @property
    def is_watertight(self) -> bool:
        return self.boundary_edge_count == 0 and self.non_manifold_edge_count == 0

    @property
    def is_edge_manifold(self) -> bool:
        return self.non_manifold_edge_count == 0

    @property
    def is_winding_consistent(self) -> bool:
        return self.inconsistently_wound_edge_count == 0


def edge_topology(mesh: TriangleMesh) -> EdgeTopology:
    """Classify every edge by incidence count and winding agreement."""
    if mesh.is_empty:
        return EdgeTopology(0, 0, 0, 0)

    faces = mesh.faces
    directed = np.concatenate(
        [faces[:, [0, 1]], faces[:, [1, 2]], faces[:, [2, 0]]], axis=0
    )
    undirected = np.sort(directed, axis=1)

    unique, inverse, counts = np.unique(
        undirected, axis=0, return_inverse=True, return_counts=True
    )
    inverse = inverse.reshape(-1)

    boundary = int(np.count_nonzero(counts == 1))
    non_manifold = int(np.count_nonzero(counts > 2))

    # An edge shared by exactly two faces must be traversed once in each
    # direction; matching orientations mean the two faces disagree on normals.
    forward = directed[:, 0] < directed[:, 1]
    interior = counts[inverse] == 2
    orientation_sum = np.zeros(len(unique), dtype=np.int64)
    np.add.at(orientation_sum, inverse[interior], np.where(forward[interior], 1, -1))
    inconsistent = int(np.count_nonzero((counts == 2) & (orientation_sum != 0)))

    return EdgeTopology(
        unique_edge_count=int(len(unique)),
        boundary_edge_count=boundary,
        non_manifold_edge_count=non_manifold,
        inconsistently_wound_edge_count=inconsistent,
    )


def degenerate_face_indices(mesh: TriangleMesh) -> NDArray[np.int64]:
    """Triangles with a repeated vertex or a numerically zero area."""
    if mesh.is_empty:
        return np.zeros(0, dtype=np.int64)
    faces = mesh.faces
    repeated = (
        (faces[:, 0] == faces[:, 1])
        | (faces[:, 1] == faces[:, 2])
        | (faces[:, 0] == faces[:, 2])
    )
    area_eps = _scale_epsilon(mesh) ** 2
    return np.flatnonzero(repeated | (triangle_areas(mesh) <= area_eps)).astype(np.int64)


def duplicate_face_indices(mesh: TriangleMesh) -> NDArray[np.int64]:
    """Triangles whose vertex set is repeated elsewhere in the mesh.

    Orientation is ignored, so a face and its mirror twin both count: a pair of
    coincident triangles is a defect regardless of which way they face. This is
    also where coplanar overlaps show up, since the self-intersection sweep
    deliberately skips them.
    """
    if mesh.is_empty:
        return np.zeros(0, dtype=np.int64)
    keys = np.sort(mesh.faces, axis=1)
    _, inverse, counts = np.unique(keys, axis=0, return_inverse=True, return_counts=True)
    return np.flatnonzero(counts[inverse.reshape(-1)] > 1).astype(np.int64)


def unreferenced_vertex_count(mesh: TriangleMesh) -> int:
    """Vertices that no triangle indexes."""
    if mesh.vertex_count == 0:
        return 0
    referenced = np.zeros(mesh.vertex_count, dtype=bool)
    if not mesh.is_empty:
        referenced[mesh.faces.reshape(-1)] = True
    return int(np.count_nonzero(~referenced))


def connected_component_count(mesh: TriangleMesh) -> int:
    """Number of vertex-connected bodies, ignoring unreferenced vertices.

    Uses vectorised label propagation with pointer jumping rather than a
    per-edge union-find loop: a mesh of a few thousand triangles has tens of
    thousands of edges, and a Python-level loop over them dominates the whole
    inspection pass.
    """
    if mesh.is_empty:
        return 0

    faces = mesh.faces
    edges = np.concatenate(
        [faces[:, [0, 1]], faces[:, [1, 2]], faces[:, [2, 0]]], axis=0
    )
    left, right = edges[:, 0], edges[:, 1]

    labels = np.arange(mesh.vertex_count, dtype=np.int64)
    while True:
        merged = np.minimum(labels[left], labels[right])
        previous = labels.copy()
        np.minimum.at(labels, left, merged)
        np.minimum.at(labels, right, merged)
        labels = labels[labels]  # pointer jumping collapses chains
        if np.array_equal(labels, previous):
            break

    return int(np.unique(labels[np.unique(faces.reshape(-1))]).size)


# --------------------------------------------------------------------------- #
# Self-intersection
# --------------------------------------------------------------------------- #
@dataclass(frozen=True, slots=True)
class SelfIntersectionResult:
    """Outcome of the self-intersection sweep.

    ``truncated`` is set when the candidate budget was exhausted before every
    pair could be examined. A clean but truncated result is not proof of a clean
    mesh, and callers must surface that distinction rather than hide it.
    """

    intersecting_pairs: int
    tested_pairs: int
    truncated: bool
    sample: tuple[tuple[int, int], ...] = field(default=())

    @property
    def has_intersections(self) -> bool:
        return self.intersecting_pairs > 0


_MAX_CELLS_PER_TRIANGLE = 27
"""Cell budget above which a triangle is treated as oversized."""


def _cell_incidences(
    cell_lo: NDArray[np.int64], spans: NDArray[np.int64], members: NDArray[np.int64]
) -> tuple[NDArray[np.int64], NDArray[np.int64]]:
    """Expand each triangle into the grid cells its bounding box covers.

    Returns the triangle index and the flattened cell key for every incidence.
    The expansion is done with repeat/arange arithmetic instead of nested loops
    because the incidence count runs into the hundreds of thousands even for a
    modest part.
    """
    counts = spans[members].prod(axis=1)
    total = int(counts.sum())
    if total == 0:
        return np.zeros(0, dtype=np.int64), np.zeros(0, dtype=np.int64)

    triangle_ids = np.repeat(members, counts)
    starts = np.concatenate(([0], np.cumsum(counts)[:-1]))
    ordinal = np.arange(total, dtype=np.int64) - np.repeat(starts, counts)

    span_j = np.repeat(spans[members, 1], counts)
    span_k = np.repeat(spans[members, 2], counts)
    plane = span_j * span_k

    delta_i, remainder = np.divmod(ordinal, plane)
    delta_j, delta_k = np.divmod(remainder, span_k)

    cells = np.stack(
        [
            np.repeat(cell_lo[members, 0], counts) + delta_i,
            np.repeat(cell_lo[members, 1], counts) + delta_j,
            np.repeat(cell_lo[members, 2], counts) + delta_k,
        ],
        axis=1,
    )

    origin = cells.min(axis=0)
    extent = cells.max(axis=0) - origin + 1
    local = cells - origin
    keys = (local[:, 0] * extent[1] + local[:, 1]) * extent[2] + local[:, 2]
    return triangle_ids, keys


def _pairs_within_groups(
    triangle_ids: NDArray[np.int64], keys: NDArray[np.int64], max_pairs: int
) -> tuple[list[NDArray[np.int64]], list[NDArray[np.int64]], bool]:
    """Emit every intra-cell pair by walking one stride at a time.

    Sorting by cell key turns "all pairs sharing a cell" into "all pairs at a
    fixed offset within a run", so each stride is a single vectorised slice.
    """
    order = np.argsort(keys, kind="stable")
    sorted_keys = keys[order]
    sorted_triangles = triangle_ids[order]

    starts_mask = np.concatenate(([True], sorted_keys[1:] != sorted_keys[:-1]))
    group_index = np.cumsum(starts_mask) - 1
    group_start = np.flatnonzero(starts_mask)
    group_size = np.diff(np.concatenate((group_start, [len(sorted_keys)])))

    position = np.arange(len(sorted_keys), dtype=np.int64) - group_start[group_index]
    size_of = group_size[group_index]

    left: list[NDArray[np.int64]] = []
    right: list[NDArray[np.int64]] = []
    emitted = 0
    truncated = False

    for stride in range(1, int(group_size.max(initial=1))):
        selected = np.flatnonzero(position + stride < size_of)
        if selected.size == 0:
            break
        left.append(sorted_triangles[selected])
        right.append(sorted_triangles[selected + stride])
        emitted += int(selected.size)
        if emitted > max_pairs:
            truncated = True
            break

    return left, right, truncated


def _candidate_pairs(
    mesh: TriangleMesh, max_pairs: int
) -> tuple[NDArray[np.int64], bool]:
    """Broad phase: uniform spatial hash over per-triangle bounding boxes.

    Triangles spanning an unreasonable number of cells go into an "oversized"
    bucket tested against every other triangle, which bounds hash memory without
    silently dropping pairs.
    """
    tri = mesh.triangles
    lo = tri.min(axis=1)
    hi = tri.max(axis=1)

    diagonal = mesh.bounding_box.diagonal
    if diagonal <= 0.0:
        return np.zeros((0, 2), dtype=np.int64), False

    cell = max(float(np.mean(hi - lo)), diagonal / 256.0)
    cell_lo = np.floor(lo / cell).astype(np.int64)
    cell_hi = np.floor(hi / cell).astype(np.int64)
    spans = cell_hi - cell_lo + 1
    cell_counts = spans.prod(axis=1)

    oversized = np.flatnonzero(cell_counts > _MAX_CELLS_PER_TRIANGLE)
    normal = np.flatnonzero(cell_counts <= _MAX_CELLS_PER_TRIANGLE)

    left: list[NDArray[np.int64]] = []
    right: list[NDArray[np.int64]] = []
    truncated = False

    if normal.size:
        triangle_ids, keys = _cell_incidences(cell_lo, spans, normal)
        if triangle_ids.size:
            left, right, truncated = _pairs_within_groups(triangle_ids, keys, max_pairs)

    if oversized.size and not truncated:
        everything = np.arange(mesh.triangle_count, dtype=np.int64)
        if oversized.size * mesh.triangle_count > max_pairs:
            truncated = True
        else:
            for index in oversized:
                others = everything[everything != index]
                left.append(np.full(others.size, index, dtype=np.int64))
                right.append(others)

    if not left:
        return np.zeros((0, 2), dtype=np.int64), truncated

    first = np.concatenate(left)
    second = np.concatenate(right)
    low = np.minimum(first, second)
    high = np.maximum(first, second)

    # Deduplicate on a single packed key: a triangle pair reachable from several
    # shared cells must only be tested once.
    packed = np.unique(low * mesh.triangle_count + high)
    candidates = np.stack(
        np.divmod(packed, mesh.triangle_count), axis=1
    ).astype(np.int64)

    if len(candidates) > max_pairs:
        candidates = candidates[:max_pairs]
        truncated = True

    # Narrow the broad phase with an exact axis-aligned overlap test.
    first, second = candidates[:, 0], candidates[:, 1]
    overlap = np.all((lo[first] <= hi[second]) & (lo[second] <= hi[first]), axis=1)
    candidates = candidates[overlap]

    # Triangles sharing a vertex are entitled to touch by construction.
    shared = np.zeros(len(candidates), dtype=bool)
    faces = mesh.faces
    for column_a in range(3):
        for column_b in range(3):
            shared |= faces[candidates[:, 0], column_a] == faces[candidates[:, 1], column_b]

    return candidates[~shared], truncated


def _segments_cross_triangles(
    origins: NDArray[np.float64],
    directions: NDArray[np.float64],
    triangles: NDArray[np.float64],
    epsilon: float,
) -> NDArray[np.bool_]:
    """Vectorised Moller-Trumbore segment/triangle crossing test.

    ``directions`` are full segment vectors, so a hit requires the parametric
    distance to land strictly inside ``(0, 1)``.
    """
    edge1 = triangles[:, 1] - triangles[:, 0]
    edge2 = triangles[:, 2] - triangles[:, 0]

    pvec = np.cross(directions, edge2)
    determinant = np.einsum("ij,ij->i", edge1, pvec)

    parallel = np.abs(determinant) < epsilon
    inverse_determinant = 1.0 / np.where(parallel, 1.0, determinant)

    tvec = origins - triangles[:, 0]
    u = np.einsum("ij,ij->i", tvec, pvec) * inverse_determinant

    qvec = np.cross(tvec, edge1)
    v = np.einsum("ij,ij->i", directions, qvec) * inverse_determinant
    t = np.einsum("ij,ij->i", edge2, qvec) * inverse_determinant

    inside = (
        ~parallel
        & (u >= _BARYCENTRIC_EPS)
        & (v >= _BARYCENTRIC_EPS)
        & (u + v <= 1.0 - _BARYCENTRIC_EPS)
        & (t >= _BARYCENTRIC_EPS)
        & (t <= 1.0 - _BARYCENTRIC_EPS)
    )
    return np.asarray(inside, dtype=np.bool_)


def find_self_intersections(
    mesh: TriangleMesh,
    *,
    max_candidate_pairs: int = 4_000_000,
    sample_size: int = 8,
) -> SelfIntersectionResult:
    """Detect triangle pairs that pass through one another.

    The test is edge-driven: two non-coplanar triangles that properly intersect
    always have an edge of one crossing the interior of the other.

    Two families of contact are deliberately excluded, because treating them as
    defects would flag correct geometry on every part:

    * coplanar overlaps, which surface as duplicate faces in
      :func:`duplicate_face_indices` instead;
    * contacts landing exactly on a triangle edge or vertex, which is how every
      adjacent pair in a well-formed mesh touches. The cost is that a crossing
      falling precisely on a triangulation diagonal is missed; any offset off
      that measure-zero alignment is caught.
    """
    if mesh.triangle_count < 2:
        return SelfIntersectionResult(0, 0, False)

    candidates, truncated = _candidate_pairs(mesh, max_candidate_pairs)
    if len(candidates) == 0:
        return SelfIntersectionResult(0, 0, truncated)

    tri = mesh.triangles
    left = tri[candidates[:, 0]]
    right = tri[candidates[:, 1]]
    epsilon = _scale_epsilon(mesh)

    hit = np.zeros(len(candidates), dtype=bool)
    for source, target in ((left, right), (right, left)):
        for corner in range(3):
            origins = source[:, corner]
            directions = source[:, (corner + 1) % 3] - origins
            hit |= _segments_cross_triangles(origins, directions, target, epsilon)

    hit_indices = np.flatnonzero(hit)
    sample = tuple(
        (int(candidates[index, 0]), int(candidates[index, 1]))
        for index in hit_indices[:sample_size]
    )
    return SelfIntersectionResult(
        intersecting_pairs=int(hit_indices.size),
        tested_pairs=int(len(candidates)),
        truncated=truncated,
        sample=sample,
    )
