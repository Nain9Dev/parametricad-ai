"""Property-based checks on invariants that must hold for every input.

Two kinds of property are covered:

* algebraic invariants of the pure mesh analysis, which are cheap and run at
  full breadth;
* pipeline invariants that involve the real CAD kernel, which are expensive and
  therefore run on a deliberately small number of examples.
"""

from __future__ import annotations

import math

import numpy as np
import pytest
from hypothesis import HealthCheck, assume, given, settings
from hypothesis import strategies as st
from pydantic import ValidationError

from app.domain.geometry import analysis
from app.domain.geometry.mesh import TriangleMesh
from app.domain.geometry.quality import MeshQualityStatus, inspect_mesh
from app.domain.geometry.tessellation import TessellationSettings
from app.domain.models.specs import MAX_DIMENSION_MM, ComponentSpec, PipeSpec
from app.infrastructure.cad.cadquery_kernel import CadQueryKernel
from app.infrastructure.llm.rule_based_extractor import RuleBasedParameterExtractor
from tests.conftest import axis_aligned_box, make_spec, unit_tetrahedron

KERNEL_SETTINGS = settings(
    max_examples=12,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture, HealthCheck.too_slow],
)

sizes = st.floats(min_value=0.5, max_value=250.0, allow_nan=False, allow_infinity=False)
offsets = st.floats(min_value=-500.0, max_value=500.0, allow_nan=False, allow_infinity=False)
angles = st.floats(min_value=0.0, max_value=2 * math.pi, allow_nan=False)


def rotation_matrix(yaw: float, pitch: float, roll: float) -> np.ndarray:
    """A proper rotation, built from three axis rotations."""
    cz, sz = math.cos(yaw), math.sin(yaw)
    cy, sy = math.cos(pitch), math.sin(pitch)
    cx, sx = math.cos(roll), math.sin(roll)
    return (  # type: ignore[no-any-return]
        np.array([[cz, -sz, 0.0], [sz, cz, 0.0], [0.0, 0.0, 1.0]])
        @ np.array([[cy, 0.0, sy], [0.0, 1.0, 0.0], [-sy, 0.0, cy]])
        @ np.array([[1.0, 0.0, 0.0], [0.0, cx, -sx], [0.0, sx, cx]])
    )


class TestMeshInvariants:
    pytestmark = pytest.mark.req("REQ-UBI-02")

    @given(size=sizes)
    def test_volume_scales_with_the_cube_of_size(self, size: float) -> None:
        assert analysis.signed_volume(axis_aligned_box(size)) == pytest.approx(size**3)

    @given(size=sizes)
    def test_area_scales_with_the_square_of_size(self, size: float) -> None:
        assert analysis.surface_area(axis_aligned_box(size)) == pytest.approx(6 * size**2)

    @given(yaw=angles, pitch=angles, roll=angles, dx=offsets, dy=offsets, dz=offsets)
    def test_rigid_motion_preserves_volume_and_topology(
        self, yaw: float, pitch: float, roll: float, dx: float, dy: float, dz: float
    ) -> None:
        """A part is the same part wherever it sits in space."""
        box = axis_aligned_box(10.0)
        moved = TriangleMesh(
            box.vertices @ rotation_matrix(yaw, pitch, roll).T + np.array([dx, dy, dz]),
            box.faces,
        )

        assert analysis.signed_volume(moved) == pytest.approx(1000.0, rel=1e-9)
        assert analysis.surface_area(moved) == pytest.approx(600.0, rel=1e-9)
        assert analysis.edge_topology(moved).is_watertight
        assert analysis.connected_component_count(moved) == 1

    @given(size=sizes)
    def test_reversing_the_winding_negates_the_volume(self, size: float) -> None:
        box = axis_aligned_box(size)
        flipped = TriangleMesh(box.vertices, box.faces[:, ::-1])
        assert analysis.signed_volume(flipped) == pytest.approx(
            -analysis.signed_volume(box)
        )

    @given(copies=st.integers(min_value=1, max_value=6))
    def test_disjoint_copies_add_up(self, copies: int) -> None:
        base = unit_tetrahedron()
        vertices = np.vstack([base.vertices + index * 100.0 for index in range(copies)])
        faces = np.vstack([base.faces + index * base.vertex_count for index in range(copies)])
        mesh = TriangleMesh(vertices, faces)

        assert analysis.connected_component_count(mesh) == copies
        assert analysis.signed_volume(mesh) == pytest.approx(copies / 6)
        assert analysis.edge_topology(mesh).is_watertight

    @given(size=sizes, dx=offsets, dy=offsets, dz=offsets)
    def test_a_rigidly_moved_solid_stays_free_of_self_intersections(
        self, size: float, dx: float, dy: float, dz: float
    ) -> None:
        box = axis_aligned_box(size)
        moved = TriangleMesh(box.vertices + np.array([dx, dy, dz]), box.faces)
        assert not analysis.find_self_intersections(moved).has_intersections

    @given(size=sizes, dx=offsets, dy=offsets, dz=offsets)
    def test_the_bounding_box_follows_a_translation(
        self, size: float, dx: float, dy: float, dz: float
    ) -> None:
        box = axis_aligned_box(size)
        moved = TriangleMesh(box.vertices + np.array([dx, dy, dz]), box.faces)
        assert moved.bounding_box.size == pytest.approx(box.bounding_box.size)
        assert moved.bounding_box.min_corner == pytest.approx(
            tuple(np.array(box.bounding_box.min_corner) + [dx, dy, dz])
        )


class TestSpecificationInvariants:
    pytestmark = pytest.mark.req("REQ-UNW-01")

    @given(
        outer=st.floats(min_value=1.0, max_value=MAX_DIMENSION_MM),
        ratio=st.floats(min_value=0.001, max_value=0.999),
        length=st.floats(min_value=0.1, max_value=MAX_DIMENSION_MM),
    )
    def test_any_wall_below_the_radius_is_accepted(
        self, outer: float, ratio: float, length: float
    ) -> None:
        wall = (outer / 2.0) * ratio
        assume(wall > 0.0)
        spec = make_spec(
            kind="pipe", outer_diameter_mm=outer, wall_thickness_mm=wall, length_mm=length
        )
        assert isinstance(spec, PipeSpec)
        assert spec.inner_diameter_mm > 0.0

    @given(
        outer=st.floats(min_value=1.0, max_value=1000.0),
        excess=st.floats(min_value=0.0, max_value=1000.0),
    )
    def test_any_wall_at_or_above_the_radius_is_rejected(
        self, outer: float, excess: float
    ) -> None:
        with pytest.raises(ValidationError):
            make_spec(
                kind="pipe",
                outer_diameter_mm=outer,
                wall_thickness_mm=outer / 2.0 + excess,
                length_mm=10.0,
            )

    @given(
        outer=st.floats(min_value=1.0, max_value=1000.0),
        ratio=st.floats(min_value=0.01, max_value=0.99),
        length=st.floats(min_value=0.1, max_value=1000.0),
    )
    def test_the_canonical_key_round_trips_through_json(
        self, outer: float, ratio: float, length: float
    ) -> None:
        import json

        from pydantic import TypeAdapter

        spec = make_spec(
            kind="pipe",
            outer_diameter_mm=outer,
            wall_thickness_mm=(outer / 2.0) * ratio,
            length_mm=length,
        )
        adapter: TypeAdapter[ComponentSpec] = TypeAdapter(ComponentSpec)
        restored = adapter.validate_python(json.loads(spec.canonical_key()))
        assert restored.canonical_key() == spec.canonical_key()


class TestExtractorInvariants:
    pytestmark = pytest.mark.req("REQ-EVT-02")

    @given(
        diameter=st.integers(min_value=6, max_value=400),
        length=st.integers(min_value=1, max_value=2000),
    )
    def test_stated_dimensions_survive_extraction(
        self, diameter: int, length: int
    ) -> None:
        """The wall has to be stated too.

        Leaving it out falls back to the 2.5 mm default, which correctly fails
        validation on any pipe under 5 mm across -- a property of the domain
        rules, not of the parser.
        """
        wall = max(1, diameter // 4)
        extractor = RuleBasedParameterExtractor()
        spec = extractor.extract(
            f"pipe, diameter {diameter}mm, wall {wall}mm, length {length}mm"
        )
        assert isinstance(spec, PipeSpec)
        assert spec.outer_diameter_mm == float(diameter)
        assert spec.wall_thickness_mm == float(wall)
        assert spec.length_mm == float(length)

    @given(text=st.text(max_size=200))
    def test_extraction_never_raises_an_unexpected_error(self, text: str) -> None:
        """Any input either yields a valid spec or a domain-level failure."""
        from app.domain.errors import ParameterExtractionError

        extractor = RuleBasedParameterExtractor()
        try:
            spec = extractor.extract(text)
        except ParameterExtractionError:
            return
        assert spec.canonical_key()


@pytest.mark.kernel
class TestPipelineInvariants:
    pytestmark = pytest.mark.req("REQ-STA-02")

    @given(
        outer=st.floats(min_value=6.0, max_value=300.0),
        ratio=st.floats(min_value=0.05, max_value=0.45),
        length=st.floats(min_value=5.0, max_value=1500.0),
    )
    @KERNEL_SETTINGS
    def test_every_valid_pipe_yields_a_watertight_mesh(
        self, kernel: CadQueryKernel, outer: float, ratio: float, length: float
    ) -> None:
        spec = make_spec(
            kind="pipe",
            outer_diameter_mm=outer,
            wall_thickness_mm=(outer / 2.0) * ratio,
            length_mm=length,
        )
        solid = kernel.build(spec)
        report = inspect_mesh(kernel.tessellate(solid, TessellationSettings()))

        assert report.is_watertight
        assert report.is_winding_consistent
        assert report.has_outward_normals
        assert report.connected_component_count == 1
        assert report.status is not MeshQualityStatus.INVALID

    @given(
        outer=st.floats(min_value=8.0, max_value=120.0),
        angle=st.floats(min_value=5.0, max_value=180.0),
        radius_factor=st.floats(min_value=1.2, max_value=6.0),
    )
    @KERNEL_SETTINGS
    def test_every_valid_elbow_matches_the_pappus_volume(
        self,
        kernel: CadQueryKernel,
        outer: float,
        angle: float,
        radius_factor: float,
    ) -> None:
        wall = outer / 8.0
        bend_radius = (outer / 2.0) * radius_factor
        spec = make_spec(
            kind="elbow",
            outer_diameter_mm=outer,
            wall_thickness_mm=wall,
            bend_radius_mm=bend_radius,
            bend_angle_deg=angle,
            leg_length_mm=0.0,
        )

        section = math.pi * ((outer / 2.0) ** 2 - (outer / 2.0 - wall) ** 2)
        expected = section * math.radians(angle) * bend_radius
        assert kernel.build(spec).volume_mm3 == pytest.approx(expected, rel=1e-6)

    @given(
        width=st.floats(min_value=10.0, max_value=500.0),
        depth=st.floats(min_value=10.0, max_value=500.0),
        thickness=st.floats(min_value=1.0, max_value=100.0),
    )
    @KERNEL_SETTINGS
    def test_a_plain_plate_is_exactly_its_box_volume(
        self, kernel: CadQueryKernel, width: float, depth: float, thickness: float
    ) -> None:
        spec = make_spec(
            kind="plate",
            width_mm=width,
            depth_mm=depth,
            thickness_mm=thickness,
            corner_radius_mm=0.0,
            center_hole_diameter_mm=0.0,
        )
        assert kernel.build(spec).volume_mm3 == pytest.approx(
            width * depth * thickness, rel=1e-9
        )

    @given(
        outer=st.floats(min_value=20.0, max_value=400.0),
        bore_ratio=st.floats(min_value=0.1, max_value=0.8),
        thickness=st.floats(min_value=2.0, max_value=60.0),
    )
    @KERNEL_SETTINGS
    def test_a_plain_flange_is_exactly_an_annulus(
        self,
        kernel: CadQueryKernel,
        outer: float,
        bore_ratio: float,
        thickness: float,
    ) -> None:
        bore = outer * bore_ratio
        spec = make_spec(
            kind="flange",
            outer_diameter_mm=outer,
            bore_diameter_mm=bore,
            thickness_mm=thickness,
            bolt_hole_count=0,
            bolt_hole_diameter_mm=0.0,
            bolt_circle_diameter_mm=0.0,
        )
        expected = math.pi * ((outer / 2.0) ** 2 - (bore / 2.0) ** 2) * thickness
        assert kernel.build(spec).volume_mm3 == pytest.approx(expected, rel=1e-6)
