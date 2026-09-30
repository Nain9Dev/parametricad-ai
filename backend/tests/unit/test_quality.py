"""The quality gate: which defects block publication and which only warn."""

from __future__ import annotations

import numpy as np
import pytest

from app.domain.geometry.mesh import TriangleMesh
from app.domain.geometry.quality import (
    MeshIssueCode,
    MeshQualityStatus,
    QualityThresholds,
    Severity,
    inspect_mesh,
)
from tests.conftest import axis_aligned_box, unit_tetrahedron

pytestmark = pytest.mark.req("REQ-STA-02")


def codes(report: object) -> set[MeshIssueCode]:
    return {issue.code for issue in report.issues}  # type: ignore[attr-defined]


class TestCleanMesh:
    def test_a_closed_solid_is_valid(self) -> None:
        report = inspect_mesh(axis_aligned_box())
        assert report.status is MeshQualityStatus.VALID
        assert report.issues == ()
        assert report.is_publishable

    def test_topology_of_a_simply_connected_solid(self) -> None:
        report = inspect_mesh(axis_aligned_box())
        assert (report.euler_characteristic, report.genus) == (2, 0)
        assert report.connected_component_count == 1

    def test_measurements_are_reported(self) -> None:
        report = inspect_mesh(axis_aligned_box(2.0))
        assert report.volume_mm3 == pytest.approx(8.0)
        assert report.surface_area_mm2 == pytest.approx(24.0)
        assert report.bounding_box.size == {"x": 2.0, "y": 2.0, "z": 2.0}


class TestBlockingDefects:
    def test_an_open_surface_is_invalid(self) -> None:
        box = axis_aligned_box()
        report = inspect_mesh(TriangleMesh(box.vertices, box.faces[:-1]))
        assert report.status is MeshQualityStatus.INVALID
        assert MeshIssueCode.NOT_WATERTIGHT in codes(report)
        assert not report.is_publishable

    def test_inside_out_winding_is_invalid(self) -> None:
        box = axis_aligned_box()
        report = inspect_mesh(TriangleMesh(box.vertices, box.faces[:, ::-1]))
        assert report.status is MeshQualityStatus.INVALID
        assert MeshIssueCode.INVERTED_NORMALS in codes(report)

    def test_a_second_body_is_invalid_by_default(self) -> None:
        base = unit_tetrahedron()
        mesh = TriangleMesh(
            np.vstack([base.vertices, base.vertices + 50.0]),
            np.vstack([base.faces, base.faces + base.vertex_count]),
        )
        report = inspect_mesh(mesh)
        assert report.status is MeshQualityStatus.INVALID
        assert MeshIssueCode.MULTIPLE_BODIES in codes(report)

    def test_an_empty_mesh_is_invalid(self) -> None:
        report = inspect_mesh(
            TriangleMesh(np.zeros((0, 3)), np.zeros((0, 3), dtype=np.int64))
        )
        assert report.status is MeshQualityStatus.INVALID
        assert codes(report) == {MeshIssueCode.EMPTY_MESH}


class TestThresholds:
    def test_multiple_bodies_can_be_downgraded_to_a_warning(self) -> None:
        base = unit_tetrahedron()
        mesh = TriangleMesh(
            np.vstack([base.vertices, base.vertices + 50.0]),
            np.vstack([base.faces, base.faces + base.vertex_count]),
        )
        report = inspect_mesh(mesh, thresholds=QualityThresholds(require_single_body=False))
        assert report.status is MeshQualityStatus.DEGRADED

    def test_the_triangle_budget_only_warns(self) -> None:
        report = inspect_mesh(
            axis_aligned_box(), thresholds=QualityThresholds(max_triangles=1)
        )
        assert report.status is MeshQualityStatus.DEGRADED
        assert MeshIssueCode.TRIANGLE_BUDGET_EXCEEDED in codes(report)

    def test_thresholds_reject_unknown_keys(self) -> None:
        with pytest.raises(ValueError):
            QualityThresholds(max_trianges=10)  # type: ignore[call-arg]


class TestVolumeDeviation:
    def test_a_matching_reference_reports_no_deviation(self) -> None:
        report = inspect_mesh(axis_aligned_box(2.0), reference_volume_mm3=8.0)
        assert report.volume_deviation_ratio == pytest.approx(0.0)
        assert report.status is MeshQualityStatus.VALID

    def test_a_large_gap_from_the_exact_solid_warns(self) -> None:
        report = inspect_mesh(axis_aligned_box(2.0), reference_volume_mm3=10.0)
        assert report.volume_deviation_ratio == pytest.approx(0.2)
        assert MeshIssueCode.VOLUME_DEVIATION in codes(report)
        assert report.status is MeshQualityStatus.DEGRADED

    def test_a_gap_inside_tolerance_stays_valid(self) -> None:
        report = inspect_mesh(axis_aligned_box(2.0), reference_volume_mm3=8.05)
        assert report.status is MeshQualityStatus.VALID

    def test_no_reference_means_no_comparison(self) -> None:
        report = inspect_mesh(axis_aligned_box())
        assert report.volume_deviation_ratio is None


class TestSeverityFolding:
    def test_a_single_error_outweighs_any_number_of_warnings(self) -> None:
        box = axis_aligned_box()
        report = inspect_mesh(
            TriangleMesh(box.vertices, box.faces[:-1]),
            thresholds=QualityThresholds(max_triangles=1),
        )
        assert report.status is MeshQualityStatus.INVALID
        assert any(issue.severity is Severity.ERROR for issue in report.issues)
        assert any(issue.severity is Severity.WARNING for issue in report.issues)

    def test_the_report_is_immutable(self) -> None:
        report = inspect_mesh(axis_aligned_box())
        with pytest.raises(ValueError):
            report.status = MeshQualityStatus.INVALID  # type: ignore[misc]
