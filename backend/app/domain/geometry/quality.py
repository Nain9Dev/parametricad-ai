"""Mesh quality model and the inspection routine that produces it.

The report is part of the public API contract: the frontend renders it directly,
so every field is a plain, serialisable value with an explicit unit in its name
or description.
"""

from __future__ import annotations

from enum import StrEnum

import numpy as np
from pydantic import BaseModel, ConfigDict, Field

from app.domain.geometry import analysis
from app.domain.geometry.mesh import TriangleMesh

__all__ = [
    "MeshIssue",
    "MeshIssueCode",
    "MeshQualityReport",
    "MeshQualityStatus",
    "QualityThresholds",
    "Severity",
    "inspect_mesh",
]


class MeshQualityStatus(StrEnum):
    """Overall verdict for a generated mesh."""

    VALID = "valid"
    """No defects found; safe for downstream manufacturing or simulation."""
    DEGRADED = "degraded"
    """Usable for visualisation, but at least one check raised a warning."""
    INVALID = "invalid"
    """A blocking defect was found; the mesh must not be published."""


class Severity(StrEnum):
    ERROR = "error"
    WARNING = "warning"


class MeshIssueCode(StrEnum):
    """Stable identifiers so clients can localise or filter without parsing text."""

    NOT_WATERTIGHT = "not_watertight"
    NON_MANIFOLD_EDGES = "non_manifold_edges"
    INCONSISTENT_WINDING = "inconsistent_winding"
    INVERTED_NORMALS = "inverted_normals"
    SELF_INTERSECTIONS = "self_intersections"
    SELF_INTERSECTION_CHECK_TRUNCATED = "self_intersection_check_truncated"
    DEGENERATE_FACES = "degenerate_faces"
    DUPLICATE_FACES = "duplicate_faces"
    UNREFERENCED_VERTICES = "unreferenced_vertices"
    MULTIPLE_BODIES = "multiple_bodies"
    VOLUME_DEVIATION = "volume_deviation"
    TRIANGLE_BUDGET_EXCEEDED = "triangle_budget_exceeded"
    EMPTY_MESH = "empty_mesh"


class MeshIssue(BaseModel):
    """A single finding, with the affected element count when one applies."""

    model_config = ConfigDict(frozen=True)

    code: MeshIssueCode
    severity: Severity
    message: str
    count: int | None = Field(
        default=None, description="Number of affected elements, when countable."
    )


class QualityThresholds(BaseModel):
    """Tunable gate applied to every generated mesh."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    require_watertight: bool = True
    require_single_body: bool = True
    require_outward_normals: bool = True
    reject_self_intersections: bool = True
    max_volume_deviation_ratio: float = Field(
        default=0.02,
        gt=0.0,
        le=1.0,
        description=(
            "Largest tolerated relative gap between the tessellated volume and "
            "the exact kernel volume. Tessellation always under-fills curved "
            "solids, so this doubles as a check that the deflection settings "
            "are fine enough for the part."
        ),
    )
    max_triangles: int = Field(
        default=400_000,
        gt=0,
        description="Triangle budget above which a mesh is too heavy to stream to a browser.",
    )
    self_intersection_pair_budget: int = Field(
        default=4_000_000,
        gt=0,
        description="Upper bound on broad-phase candidate pairs before the sweep truncates.",
    )


class BoundingBoxReport(BaseModel):
    """Axis-aligned extents, in millimetres."""

    model_config = ConfigDict(frozen=True)

    min: dict[str, float]
    max: dict[str, float]
    size: dict[str, float]
    center: dict[str, float]


class MeshQualityReport(BaseModel):
    """Complete, serialisable verdict for one tessellated solid."""

    model_config = ConfigDict(frozen=True)

    status: MeshQualityStatus
    issues: tuple[MeshIssue, ...] = ()

    triangle_count: int
    vertex_count: int

    is_watertight: bool
    is_edge_manifold: bool
    is_winding_consistent: bool
    has_outward_normals: bool
    has_self_intersections: bool

    volume_mm3: float
    surface_area_mm2: float
    bounding_box: BoundingBoxReport

    euler_characteristic: int
    genus: int | None = Field(
        default=None,
        description="Topological genus; only defined for a closed orientable surface.",
    )
    connected_component_count: int

    degenerate_face_count: int
    duplicate_face_count: int
    unreferenced_vertex_count: int
    boundary_edge_count: int
    non_manifold_edge_count: int
    self_intersecting_pair_count: int
    self_intersection_check_complete: bool

    reference_volume_mm3: float | None = Field(
        default=None, description="Exact solid volume reported by the CAD kernel."
    )
    volume_deviation_ratio: float | None = Field(
        default=None,
        description="Relative gap between the mesh volume and the kernel volume.",
    )

    @property
    def is_publishable(self) -> bool:
        return self.status is not MeshQualityStatus.INVALID


def _empty_report() -> MeshQualityReport:
    zero = {"x": 0.0, "y": 0.0, "z": 0.0}
    return MeshQualityReport(
        status=MeshQualityStatus.INVALID,
        issues=(
            MeshIssue(
                code=MeshIssueCode.EMPTY_MESH,
                severity=Severity.ERROR,
                message="Tessellation produced no triangles.",
            ),
        ),
        triangle_count=0,
        vertex_count=0,
        is_watertight=False,
        is_edge_manifold=True,
        is_winding_consistent=True,
        has_outward_normals=False,
        has_self_intersections=False,
        volume_mm3=0.0,
        surface_area_mm2=0.0,
        bounding_box=BoundingBoxReport(min=zero, max=zero, size=zero, center=zero),
        euler_characteristic=0,
        genus=None,
        connected_component_count=0,
        degenerate_face_count=0,
        duplicate_face_count=0,
        unreferenced_vertex_count=0,
        boundary_edge_count=0,
        non_manifold_edge_count=0,
        self_intersecting_pair_count=0,
        self_intersection_check_complete=True,
    )


def inspect_mesh(
    mesh: TriangleMesh,
    *,
    reference_volume_mm3: float | None = None,
    thresholds: QualityThresholds | None = None,
) -> MeshQualityReport:
    """Run every quality check and fold the findings into a single verdict.

    ``reference_volume_mm3`` is the exact volume computed by the CAD kernel on
    the B-Rep solid. When supplied, the tessellated volume is compared against
    it, which catches both an under-refined tessellation and a boolean that
    silently produced the wrong solid.
    """
    if mesh.is_empty:
        return _empty_report()

    limits = thresholds or QualityThresholds()
    issues: list[MeshIssue] = []

    topology = analysis.edge_topology(mesh)
    volume = analysis.signed_volume(mesh)
    area = analysis.surface_area(mesh)
    degenerate = analysis.degenerate_face_indices(mesh)
    duplicates = analysis.duplicate_face_indices(mesh)
    unreferenced = analysis.unreferenced_vertex_count(mesh)
    components = analysis.connected_component_count(mesh)
    intersections = analysis.find_self_intersections(
        mesh, max_candidate_pairs=limits.self_intersection_pair_budget
    )

    referenced_vertices = int(np.unique(mesh.faces.reshape(-1)).size)
    euler = referenced_vertices - topology.unique_edge_count + mesh.triangle_count
    closed_orientable = topology.is_watertight and topology.is_winding_consistent
    genus = (2 * components - euler) // 2 if closed_orientable else None

    outward = closed_orientable and volume > 0.0

    if not topology.is_watertight:
        issues.append(
            MeshIssue(
                code=MeshIssueCode.NOT_WATERTIGHT,
                severity=Severity.ERROR if limits.require_watertight else Severity.WARNING,
                message="Mesh has open boundary edges and does not enclose a volume.",
                count=topology.boundary_edge_count,
            )
        )
    if not topology.is_edge_manifold:
        issues.append(
            MeshIssue(
                code=MeshIssueCode.NON_MANIFOLD_EDGES,
                severity=Severity.ERROR,
                message="Some edges are shared by more than two triangles.",
                count=topology.non_manifold_edge_count,
            )
        )
    if not topology.is_winding_consistent:
        issues.append(
            MeshIssue(
                code=MeshIssueCode.INCONSISTENT_WINDING,
                severity=Severity.ERROR,
                message="Adjacent triangles disagree on orientation; normals are not consistent.",
                count=topology.inconsistently_wound_edge_count,
            )
        )
    if closed_orientable and not outward and limits.require_outward_normals:
        issues.append(
            MeshIssue(
                code=MeshIssueCode.INVERTED_NORMALS,
                severity=Severity.ERROR,
                message="Mesh is closed but wound inside-out; the enclosed volume is negative.",
            )
        )
    if intersections.has_intersections:
        issues.append(
            MeshIssue(
                code=MeshIssueCode.SELF_INTERSECTIONS,
                severity=(
                    Severity.ERROR if limits.reject_self_intersections else Severity.WARNING
                ),
                message="Triangle pairs pass through one another.",
                count=intersections.intersecting_pairs,
            )
        )
    if intersections.truncated:
        issues.append(
            MeshIssue(
                code=MeshIssueCode.SELF_INTERSECTION_CHECK_TRUNCATED,
                severity=Severity.WARNING,
                message=(
                    "Self-intersection sweep hit its candidate budget; the result "
                    "is a lower bound, not a clean bill of health."
                ),
                count=intersections.tested_pairs,
            )
        )
    if degenerate.size:
        issues.append(
            MeshIssue(
                code=MeshIssueCode.DEGENERATE_FACES,
                severity=Severity.WARNING,
                message="Triangles with zero area or a repeated vertex were found.",
                count=int(degenerate.size),
            )
        )
    if duplicates.size:
        issues.append(
            MeshIssue(
                code=MeshIssueCode.DUPLICATE_FACES,
                severity=Severity.WARNING,
                message="Coincident triangles were found.",
                count=int(duplicates.size),
            )
        )
    if unreferenced:
        issues.append(
            MeshIssue(
                code=MeshIssueCode.UNREFERENCED_VERTICES,
                severity=Severity.WARNING,
                message="Vertices are present that no triangle references.",
                count=unreferenced,
            )
        )
    if components != 1:
        issues.append(
            MeshIssue(
                code=MeshIssueCode.MULTIPLE_BODIES,
                severity=(
                    Severity.ERROR if limits.require_single_body else Severity.WARNING
                ),
                message="Mesh contains more than one disconnected body.",
                count=components,
            )
        )
    if mesh.triangle_count > limits.max_triangles:
        issues.append(
            MeshIssue(
                code=MeshIssueCode.TRIANGLE_BUDGET_EXCEEDED,
                severity=Severity.WARNING,
                message="Mesh exceeds the triangle budget for interactive rendering.",
                count=mesh.triangle_count,
            )
        )

    deviation: float | None = None
    if reference_volume_mm3 is not None and reference_volume_mm3 > 0.0:
        deviation = abs(abs(volume) - reference_volume_mm3) / reference_volume_mm3
        if deviation > limits.max_volume_deviation_ratio:
            issues.append(
                MeshIssue(
                    code=MeshIssueCode.VOLUME_DEVIATION,
                    severity=Severity.WARNING,
                    message=(
                        f"Tessellated volume deviates {deviation:.2%} from the exact "
                        "solid; consider a finer linear deflection."
                    ),
                )
            )

    if any(issue.severity is Severity.ERROR for issue in issues):
        status = MeshQualityStatus.INVALID
    elif issues:
        status = MeshQualityStatus.DEGRADED
    else:
        status = MeshQualityStatus.VALID

    return MeshQualityReport(
        status=status,
        issues=tuple(issues),
        triangle_count=mesh.triangle_count,
        vertex_count=mesh.vertex_count,
        is_watertight=topology.is_watertight,
        is_edge_manifold=topology.is_edge_manifold,
        is_winding_consistent=topology.is_winding_consistent,
        has_outward_normals=outward,
        has_self_intersections=intersections.has_intersections,
        volume_mm3=abs(volume),
        surface_area_mm2=area,
        bounding_box=BoundingBoxReport(**mesh.bounding_box.as_dict()),
        euler_characteristic=int(euler),
        genus=int(genus) if genus is not None else None,
        connected_component_count=components,
        degenerate_face_count=int(degenerate.size),
        duplicate_face_count=int(duplicates.size),
        unreferenced_vertex_count=unreferenced,
        boundary_edge_count=topology.boundary_edge_count,
        non_manifold_edge_count=topology.non_manifold_edge_count,
        self_intersecting_pair_count=intersections.intersecting_pairs,
        self_intersection_check_complete=not intersections.truncated,
        reference_volume_mm3=reference_volume_mm3,
        volume_deviation_ratio=deviation,
    )
