"""Unit tests for the modular deterministic validation runner (C1-C10)."""

from __future__ import annotations

import numpy as np
import pytest

from app.domain.geometry.mesh import TriangleMesh
from app.domain.geometry.runner.registry import get_default_registry
from app.domain.geometry.runner.runner import ValidationContext, ValidationRunner
from app.domain.geometry.runner.types import CheckId, CheckStatus
from tests.conftest import axis_aligned_box, unit_tetrahedron

pytestmark = pytest.mark.req("REQ-STA-02")


class TestCheckRegistry:
    def test_default_registry_contains_core_checks(self) -> None:
        registry = get_default_registry()
        checks = registry.all_checks()
        ids = {check.check_id for check in checks}
        assert CheckId.C1_STRUCTURE_INTEGRITY in ids
        assert CheckId.C2_DEGENERATE_GEOMETRY in ids
        assert CheckId.C3_MANIFOLD_TOPOLOGY in ids
        assert CheckId.C4_WATERTIGHTNESS in ids
        assert CheckId.C5_NORMAL_ORIENTATION in ids
        assert CheckId.C6_SELF_INTERSECTION in ids
        assert CheckId.C7_ASPECT_RATIO in ids

    def test_lookup_by_id(self) -> None:
        registry = get_default_registry()
        check = registry.get(CheckId.C4_WATERTIGHTNESS)
        assert check.check_id is CheckId.C4_WATERTIGHTNESS


class TestRunnerExecution:
    def test_runner_produces_pass_on_valid_mesh(self) -> None:
        mesh = axis_aligned_box(10.0)
        runner = ValidationRunner(registry=get_default_registry())
        context = ValidationContext(reference_volume_mm3=1000.0)
        report = runner.run(mesh, context=context, model_id="test-box-id")

        assert report.verdict is CheckStatus.PASS
        assert report.model_id == "test-box-id"
        assert len(report.checks) >= 7
        assert report.total_duration_ms >= 0.0

    def test_runner_catches_open_mesh_on_c4(self) -> None:
        # Remove top and bottom face of a cube to create an open tube
        box = axis_aligned_box(10.0)
        open_mesh = TriangleMesh(box.vertices, box.faces[:8])
        runner = ValidationRunner(registry=get_default_registry())
        report = runner.run(open_mesh, model_id="test-open-id")

        assert report.verdict is CheckStatus.FAIL
        c4_result = next(r for r in report.checks if r.check_id is CheckId.C4_WATERTIGHTNESS)
        assert c4_result.status is CheckStatus.FAIL
        assert c4_result.metrics["boundary_edges"] > 0

    def test_runner_catches_inverted_normals_on_c5(self) -> None:
        box = axis_aligned_box(10.0)
        inverted = TriangleMesh(box.vertices, box.faces[:, ::-1])
        runner = ValidationRunner(registry=get_default_registry())
        report = runner.run(inverted, model_id="test-inverted-id")

        assert report.verdict is CheckStatus.FAIL
        c5_result = next(r for r in report.checks if r.check_id is CheckId.C5_NORMAL_ORIENTATION)
        assert c5_result.status is CheckStatus.FAIL

    def test_dual_contract_json_serialization(self) -> None:
        mesh = unit_tetrahedron()
        runner = ValidationRunner(registry=get_default_registry())
        report = runner.run(mesh, model_id="test-tetra-id")

        json_payload = report.model_dump_json()
        assert "test-tetra-id" in json_payload
        assert "C1" in json_payload
        assert "C4" in json_payload

    def test_c9_flags_volume_divergence_when_threshold_exceeded(self) -> None:
        mesh = axis_aligned_box(10.0)  # volume = 1000.0
        runner = ValidationRunner(registry=get_default_registry())
        # Reference volume 2000.0 (deviation 50%)
        context = ValidationContext(reference_volume_mm3=2000.0, max_volume_deviation_ratio=0.02)
        report = runner.run(mesh, context=context, model_id="test-vol-diverge")

        c9_result = next(r for r in report.checks if r.check_id is CheckId.C9_VOLUME_DIVERGENCE)
        assert c9_result.status is CheckStatus.FAIL
        assert c9_result.metrics["ratio"] == pytest.approx(0.5)

    def test_c8_bounding_box_metrics(self) -> None:
        mesh = axis_aligned_box(10.0)
        runner = ValidationRunner(registry=get_default_registry())
        report = runner.run(mesh, model_id="test-bb")

        c8_result = next(r for r in report.checks if r.check_id is CheckId.C8_BOUNDING_BOX)
        assert c8_result.status is CheckStatus.PASS
        assert c8_result.metrics["diagonal"] == pytest.approx(np.sqrt(300.0))

    def test_c10_inertia_and_surface_area(self) -> None:
        mesh = axis_aligned_box(10.0)
        runner = ValidationRunner(registry=get_default_registry())
        report = runner.run(mesh, model_id="test-c10")

        c10_result = next(r for r in report.checks if r.check_id is CheckId.C10_MASS_INERTIA)
        assert c10_result.status is CheckStatus.PASS
        assert c10_result.metrics["surface_area_mm2"] == pytest.approx(600.0)

