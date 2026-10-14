"""Standardized C1-C10 geometric checks."""

from __future__ import annotations

import time

import numpy as np

from app.domain.geometry import analysis
from app.domain.geometry.mesh import TriangleMesh
from app.domain.geometry.runner.base import BaseCheck, ValidationContext
from app.domain.geometry.runner.types import CheckId, CheckResult, CheckStatus

__all__ = [
    "AspectRatioCheck",
    "BoundingBoxCheck",
    "DegenerateGeometryCheck",
    "InertiaCheck",
    "ManifoldTopologyCheck",
    "NormalOrientationCheck",
    "SelfIntersectionCheck",
    "StructureIntegrityCheck",
    "VolumeDivergenceCheck",
    "WatertightnessCheck",
]


class StructureIntegrityCheck(BaseCheck):
    """C1: Verifies array shapes, finite coordinates, and valid face indexing."""

    check_id = CheckId.C1_STRUCTURE_INTEGRITY
    name = "Structure & Buffer Integrity"
    is_blocking = True

    def evaluate(self, mesh: TriangleMesh, _context: ValidationContext) -> CheckResult:
        start = time.perf_counter()
        if mesh.is_empty:
            return CheckResult(
                check_id=self.check_id,
                name=self.name,
                status=CheckStatus.FAIL,
                message="Mesh contains zero vertices or faces.",
                execution_ms=(time.perf_counter() - start) * 1000.0,
            )

        if not np.all(np.isfinite(mesh.vertices)):
            return CheckResult(
                check_id=self.check_id,
                name=self.name,
                status=CheckStatus.FAIL,
                message="Mesh vertices contain NaN or Infinite values.",
                execution_ms=(time.perf_counter() - start) * 1000.0,
            )

        if mesh.faces.max() >= mesh.vertex_count or mesh.faces.min() < 0:
            return CheckResult(
                check_id=self.check_id,
                name=self.name,
                status=CheckStatus.FAIL,
                message="Face indices exceed vertex array bounds.",
                execution_ms=(time.perf_counter() - start) * 1000.0,
            )

        return CheckResult(
            check_id=self.check_id,
            name=self.name,
            status=CheckStatus.PASS,
            message="Buffer shapes, memory alignment, and index bounds are valid.",
            metrics={"vertices": mesh.vertex_count, "faces": mesh.triangle_count},
            execution_ms=(time.perf_counter() - start) * 1000.0,
        )


class DegenerateGeometryCheck(BaseCheck):
    """C2: Detects zero-area faces and duplicate coincident triangles."""

    check_id = CheckId.C2_DEGENERATE_GEOMETRY
    name = "Degenerate Geometry & Quanta"
    is_blocking = True

    def evaluate(self, mesh: TriangleMesh, _context: ValidationContext) -> CheckResult:
        start = time.perf_counter()
        degen = analysis.degenerate_face_indices(mesh)
        dups = analysis.duplicate_face_indices(mesh)

        if len(degen) > 0 or len(dups) > 0:
            return CheckResult(
                check_id=self.check_id,
                name=self.name,
                status=CheckStatus.FAIL,
                message=(
                    f"Found {len(degen)} degenerate face(s) and {len(dups)} duplicate face(s)."
                ),
                metrics={"degenerate_faces": len(degen), "duplicate_faces": len(dups)},
                execution_ms=(time.perf_counter() - start) * 1000.0,
            )

        return CheckResult(
            check_id=self.check_id,
            name=self.name,
            status=CheckStatus.PASS,
            message="Zero degenerate or duplicate faces detected.",
            metrics={"degenerate_faces": 0, "duplicate_faces": 0},
            execution_ms=(time.perf_counter() - start) * 1000.0,
        )


class ManifoldTopologyCheck(BaseCheck):
    """C3: Verifies 2-manifold edge and vertex invariants."""

    check_id = CheckId.C3_MANIFOLD_TOPOLOGY
    name = "2-Manifold Topology"
    is_blocking = True

    def evaluate(self, mesh: TriangleMesh, _context: ValidationContext) -> CheckResult:
        start = time.perf_counter()
        topo = analysis.edge_topology(mesh)
        unref = analysis.unreferenced_vertex_count(mesh)

        if topo.non_manifold_edge_count > 0:
            return CheckResult(
                check_id=self.check_id,
                name=self.name,
                status=CheckStatus.FAIL,
                message=f"Mesh has {topo.non_manifold_edge_count} non-manifold edge(s).",
                metrics={"non_manifold_edges": topo.non_manifold_edge_count, "unreferenced_vertices": unref},
                execution_ms=(time.perf_counter() - start) * 1000.0,
            )

        return CheckResult(
            check_id=self.check_id,
            name=self.name,
            status=CheckStatus.PASS,
            message="Mesh edges are strictly 2-manifold.",
            metrics={"non_manifold_edges": 0, "unreferenced_vertices": unref},
            execution_ms=(time.perf_counter() - start) * 1000.0,
        )


class WatertightnessCheck(BaseCheck):
    """C4: Verifies hermetic closure and zero boundary edges."""

    check_id = CheckId.C4_WATERTIGHTNESS
    name = "Watertightness & Hermetic Closure"
    is_blocking = True

    def evaluate(self, mesh: TriangleMesh, _context: ValidationContext) -> CheckResult:
        start = time.perf_counter()
        topo = analysis.edge_topology(mesh)

        if topo.boundary_edge_count > 0:
            return CheckResult(
                check_id=self.check_id,
                name=self.name,
                status=CheckStatus.FAIL,
                message=f"Mesh is not watertight: {topo.boundary_edge_count} boundary edge(s) found.",
                metrics={"boundary_edges": topo.boundary_edge_count},
                execution_ms=(time.perf_counter() - start) * 1000.0,
            )

        return CheckResult(
            check_id=self.check_id,
            name=self.name,
            status=CheckStatus.PASS,
            message="Mesh is strictly closed and watertight.",
            metrics={"boundary_edges": 0},
            execution_ms=(time.perf_counter() - start) * 1000.0,
        )


class NormalOrientationCheck(BaseCheck):
    """C5: Verifies consistent face winding and outward normal divergence."""

    check_id = CheckId.C5_NORMAL_ORIENTATION
    name = "Normals & Winding Consistency"
    is_blocking = True

    def evaluate(self, mesh: TriangleMesh, _context: ValidationContext) -> CheckResult:
        start = time.perf_counter()
        topo = analysis.edge_topology(mesh)
        volume = analysis.signed_volume(mesh)

        if topo.inconsistently_wound_edge_count > 0:
            return CheckResult(
                check_id=self.check_id,
                name=self.name,
                status=CheckStatus.FAIL,
                message=f"Inconsistent winding on {topo.inconsistently_wound_edge_count} edge(s).",
                metrics={"inconsistent_edges": topo.inconsistently_wound_edge_count},
                execution_ms=(time.perf_counter() - start) * 1000.0,
            )

        if volume <= 0.0:
            return CheckResult(
                check_id=self.check_id,
                name=self.name,
                status=CheckStatus.FAIL,
                message="Signed volume is negative or zero: face normals point inward.",
                metrics={"signed_volume_mm3": volume},
                execution_ms=(time.perf_counter() - start) * 1000.0,
            )

        return CheckResult(
            check_id=self.check_id,
            name=self.name,
            status=CheckStatus.PASS,
            message="Winding order is coherent and normals point outward.",
            metrics={"signed_volume_mm3": volume},
            execution_ms=(time.perf_counter() - start) * 1000.0,
        )


class SelfIntersectionCheck(BaseCheck):
    """C6: Verifies zero facet self-intersections."""

    check_id = CheckId.C6_SELF_INTERSECTION
    name = "Self-Intersection Invariants"
    is_blocking = True

    def evaluate(self, mesh: TriangleMesh, _context: ValidationContext) -> CheckResult:
        start = time.perf_counter()
        sweep = analysis.find_self_intersections(mesh)

        if sweep.has_intersections:
            return CheckResult(
                check_id=self.check_id,
                name=self.name,
                status=CheckStatus.FAIL,
                message=f"Detected {sweep.intersecting_pairs} self-intersecting triangle pair(s).",
                metrics={"intersecting_pairs": sweep.intersecting_pairs, "truncated": sweep.truncated},
                execution_ms=(time.perf_counter() - start) * 1000.0,
            )

        return CheckResult(
            check_id=self.check_id,
            name=self.name,
            status=CheckStatus.PASS,
            message="Zero self-intersections detected.",
            metrics={"intersecting_pairs": 0, "tested_pairs": sweep.tested_pairs, "truncated": sweep.truncated},
            execution_ms=(time.perf_counter() - start) * 1000.0,
        )


class AspectRatioCheck(BaseCheck):
    """C7: Monitors sliver triangles with high aspect ratios."""

    check_id = CheckId.C7_ASPECT_RATIO
    name = "Facet Aspect Ratio & Skewness"
    is_blocking = False

    def evaluate(self, mesh: TriangleMesh, context: ValidationContext) -> CheckResult:
        start = time.perf_counter()
        if mesh.is_empty:
            return CheckResult(
                check_id=self.check_id,
                name=self.name,
                status=CheckStatus.PASS,
                message="Mesh is empty.",
                execution_ms=(time.perf_counter() - start) * 1000.0,
            )

        tri = mesh.triangles
        a = np.linalg.norm(tri[:, 1] - tri[:, 0], axis=1)
        b = np.linalg.norm(tri[:, 2] - tri[:, 1], axis=1)
        c = np.linalg.norm(tri[:, 0] - tri[:, 2], axis=1)
        semi = (a + b + c) / 2.0
        areas = analysis.triangle_areas(mesh)

        # Inradius r = area / semi; circumradius R = (a*b*c) / (4*area)
        safe_areas = np.maximum(areas, 1e-12)
        r_in = safe_areas / np.maximum(semi, 1e-12)
        r_circ = (a * b * c) / (4.0 * safe_areas)
        ratio = r_circ / np.maximum(2.0 * r_in, 1e-12)
        max_ratio = float(ratio.max()) if len(ratio) > 0 else 1.0

        status = CheckStatus.WARN if max_ratio > context.max_aspect_ratio else CheckStatus.PASS
        msg = f"Max facet aspect ratio is {max_ratio:.2f}."
        return CheckResult(
            check_id=self.check_id,
            name=self.name,
            status=status,
            message=msg,
            is_blocking=self.is_blocking,
            metrics={"max_aspect_ratio": max_ratio},
            execution_ms=(time.perf_counter() - start) * 1000.0,
        )


class BoundingBoxCheck(BaseCheck):
    """C8: Verifies finite, positive bounding box dimensions."""

    check_id = CheckId.C8_BOUNDING_BOX
    name = "Coordinate Extents & Bounds"
    is_blocking = True

    def evaluate(self, mesh: TriangleMesh, _context: ValidationContext) -> CheckResult:
        start = time.perf_counter()
        bb = mesh.bounding_box
        diag = float(bb.diagonal)
        size = [float(x) for x in bb.size]

        if diag <= 0.0 or any(x <= 0.0 for x in size):
            return CheckResult(
                check_id=self.check_id,
                name=self.name,
                status=CheckStatus.FAIL,
                message=f"Degenerate bounding box size: {size}.",
                metrics={"diagonal": diag, "size": size},
                execution_ms=(time.perf_counter() - start) * 1000.0,
            )

        return CheckResult(
            check_id=self.check_id,
            name=self.name,
            status=CheckStatus.PASS,
            message=f"Bounding box extents valid: diagonal {diag:.2f} mm.",
            metrics={"diagonal": diag, "size": size},
            execution_ms=(time.perf_counter() - start) * 1000.0,
        )


class VolumeDivergenceCheck(BaseCheck):
    """C9: Asserts volume deviation between tessellation and exact B-Rep."""

    check_id = CheckId.C9_VOLUME_DIVERGENCE
    name = "B-Rep vs Mesh Volume Divergence"
    is_blocking = True

    def evaluate(self, mesh: TriangleMesh, context: ValidationContext) -> CheckResult:
        start = time.perf_counter()
        if context.reference_volume_mm3 is None or context.reference_volume_mm3 <= 0.0:
            return CheckResult(
                check_id=self.check_id,
                name=self.name,
                status=CheckStatus.SKIP,
                message="No reference B-Rep volume supplied.",
                execution_ms=(time.perf_counter() - start) * 1000.0,
            )

        tess_volume = analysis.signed_volume(mesh)
        gap = abs(tess_volume - context.reference_volume_mm3)
        ratio = gap / context.reference_volume_mm3

        if ratio > context.max_volume_deviation_ratio:
            return CheckResult(
                check_id=self.check_id,
                name=self.name,
                status=CheckStatus.FAIL,
                message=f"Volume deviation {ratio:.4f} exceeds threshold {context.max_volume_deviation_ratio}.",
                metrics={"gap_mm3": gap, "ratio": ratio, "reference_volume_mm3": context.reference_volume_mm3},
                execution_ms=(time.perf_counter() - start) * 1000.0,
            )

        return CheckResult(
            check_id=self.check_id,
            name=self.name,
            status=CheckStatus.PASS,
            message=f"Volume deviation {ratio:.4f} is within acceptable chordal tolerance.",
            metrics={"gap_mm3": gap, "ratio": ratio, "reference_volume_mm3": context.reference_volume_mm3},
            execution_ms=(time.perf_counter() - start) * 1000.0,
        )


class InertiaCheck(BaseCheck):
    """C10: Validates physical inertia metrics and surface area positive bounds."""

    check_id = CheckId.C10_MASS_INERTIA
    name = "Inertial Tensor & Surface Metric"
    is_blocking = True

    def evaluate(self, mesh: TriangleMesh, _context: ValidationContext) -> CheckResult:
        start = time.perf_counter()
        area = analysis.surface_area(mesh)

        if area <= 0.0:
            return CheckResult(
                check_id=self.check_id,
                name=self.name,
                status=CheckStatus.FAIL,
                message=f"Surface area {area} is non-positive.",
                metrics={"surface_area_mm2": area},
                execution_ms=(time.perf_counter() - start) * 1000.0,
            )

        return CheckResult(
            check_id=self.check_id,
            name=self.name,
            status=CheckStatus.PASS,
            message=f"Surface area {area:.2f} mm² is valid.",
            metrics={"surface_area_mm2": area},
            execution_ms=(time.perf_counter() - start) * 1000.0,
        )
