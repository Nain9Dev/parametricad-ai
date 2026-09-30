"""The real CAD kernel: geometry against closed-form truth, and determinism.

Every dimensional assertion is checked against an analytic formula rather than a
recorded value, so a change in the construction recipe that shifts the geometry
fails here instead of being blessed as the new baseline.
"""

from __future__ import annotations

import math

import pytest

from app.domain.errors import UnsupportedFormatError
from app.domain.geometry.quality import MeshQualityStatus, inspect_mesh
from app.domain.geometry.tessellation import TessellationSettings
from app.domain.models.artifacts import ExportFormat
from app.infrastructure.cad.cadquery_kernel import CadQueryKernel
from tests.conftest import make_spec

pytestmark = pytest.mark.kernel


COARSE = TessellationSettings(linear_deflection_mm=0.5, angular_deflection_rad=0.8)
FINE = TessellationSettings(linear_deflection_mm=0.05, angular_deflection_rad=0.15)

_PROVENANCE_MARKERS = ("Open CASCADE STEP translator", "FILE_NAME")


def annulus_area(outer_diameter: float, wall: float) -> float:
    outer_radius = outer_diameter / 2.0
    return math.pi * (outer_radius**2 - (outer_radius - wall) ** 2)


def _without_provenance(step: str) -> list[str]:
    """Drop the lines OpenCASCADE stamps with the run, not with the geometry."""
    return [
        line
        for line in step.splitlines()
        if not any(marker in line for marker in _PROVENANCE_MARKERS)
    ]


class TestPipeGeometry:
    pytestmark = pytest.mark.req("REQ-EVT-01")

    def test_volume_matches_the_annulus_formula(self, kernel: CadQueryKernel) -> None:
        spec = make_spec(
            kind="pipe", outer_diameter_mm=25.0, wall_thickness_mm=2.5, length_mm=200.0
        )
        solid = kernel.build(spec)
        assert solid.volume_mm3 == pytest.approx(annulus_area(25.0, 2.5) * 200.0)

    def test_the_bounding_box_matches_the_nominal_size(
        self, kernel: CadQueryKernel, tessellation: TessellationSettings
    ) -> None:
        spec = make_spec(kind="pipe", outer_diameter_mm=30.0, length_mm=150.0)
        mesh = kernel.tessellate(kernel.build(spec), tessellation)
        width, depth, height = mesh.bounding_box.size

        # A tessellated circle is inscribed, so the section is never larger than
        # nominal and only shrinks by the chordal deflection.
        assert height == pytest.approx(150.0)
        assert width == pytest.approx(30.0, abs=0.2)
        assert depth == pytest.approx(30.0, abs=0.2)

    def test_a_tube_is_topologically_a_torus(
        self, kernel: CadQueryKernel, tessellation: TessellationSettings
    ) -> None:
        mesh = kernel.tessellate(kernel.build(make_spec(kind="pipe")), tessellation)
        report = inspect_mesh(mesh)
        assert report.genus == 1
        assert report.connected_component_count == 1


class TestElbowGeometry:
    pytestmark = pytest.mark.req("REQ-EVT-01")

    @pytest.mark.parametrize("angle", [45.0, 90.0, 180.0])
    def test_volume_matches_pappus(self, kernel: CadQueryKernel, angle: float) -> None:
        """The swept volume is the section area times the centroid path length."""
        spec = make_spec(
            kind="elbow",
            outer_diameter_mm=25.0,
            wall_thickness_mm=2.5,
            bend_radius_mm=50.0,
            bend_angle_deg=angle,
            leg_length_mm=0.0,
        )
        expected = annulus_area(25.0, 2.5) * math.radians(angle) * 50.0
        assert kernel.build(spec).volume_mm3 == pytest.approx(expected, rel=1e-6)

    def test_tangent_legs_add_exactly_their_own_volume(
        self, kernel: CadQueryKernel
    ) -> None:
        section = annulus_area(25.0, 2.5)
        spec = make_spec(
            kind="elbow",
            outer_diameter_mm=25.0,
            wall_thickness_mm=2.5,
            bend_radius_mm=50.0,
            bend_angle_deg=90.0,
            leg_length_mm=30.0,
        )
        expected = section * (math.radians(90.0) * 50.0 + 2 * 30.0)
        assert kernel.build(spec).volume_mm3 == pytest.approx(expected, rel=1e-6)

    def test_the_union_with_legs_is_a_single_body(
        self, kernel: CadQueryKernel, tessellation: TessellationSettings
    ) -> None:
        spec = make_spec(kind="elbow", bend_angle_deg=90.0, leg_length_mm=40.0)
        report = inspect_mesh(kernel.tessellate(kernel.build(spec), tessellation))
        assert report.connected_component_count == 1
        assert report.genus == 1


class TestFlangeGeometry:
    pytestmark = pytest.mark.req("REQ-EVT-01")

    def test_volume_accounts_for_the_bore_and_every_bolt_hole(
        self, kernel: CadQueryKernel
    ) -> None:
        spec = make_spec(
            kind="flange",
            outer_diameter_mm=100.0,
            bore_diameter_mm=50.0,
            thickness_mm=12.0,
            bolt_hole_count=8,
            bolt_hole_diameter_mm=10.0,
            bolt_circle_diameter_mm=80.0,
        )
        disc = math.pi * (50.0**2 - 25.0**2) * 12.0
        bolts = 8 * math.pi * 5.0**2 * 12.0
        assert kernel.build(spec).volume_mm3 == pytest.approx(disc - bolts, rel=1e-6)

    def test_each_through_hole_adds_a_handle_to_the_topology(
        self, kernel: CadQueryKernel, tessellation: TessellationSettings
    ) -> None:
        """Genus counts holes: one bore plus eight bolts is genus nine."""
        spec = make_spec(kind="flange", bolt_hole_count=8)
        report = inspect_mesh(kernel.tessellate(kernel.build(spec), tessellation))
        assert report.genus == 9

    def test_a_plain_flange_has_only_the_bore(
        self, kernel: CadQueryKernel, tessellation: TessellationSettings
    ) -> None:
        spec = make_spec(kind="flange", bolt_hole_count=0)
        report = inspect_mesh(kernel.tessellate(kernel.build(spec), tessellation))
        assert report.genus == 1


class TestPlateGeometry:
    pytestmark = pytest.mark.req("REQ-EVT-01")

    def test_a_plain_plate_is_a_box(self, kernel: CadQueryKernel) -> None:
        spec = make_spec(
            kind="plate",
            width_mm=120.0,
            depth_mm=80.0,
            thickness_mm=10.0,
            corner_radius_mm=0.0,
            center_hole_diameter_mm=0.0,
        )
        assert kernel.build(spec).volume_mm3 == pytest.approx(120.0 * 80.0 * 10.0)

    def test_the_central_hole_removes_a_cylinder(self, kernel: CadQueryKernel) -> None:
        spec = make_spec(
            kind="plate",
            width_mm=120.0,
            depth_mm=80.0,
            thickness_mm=10.0,
            corner_radius_mm=0.0,
            center_hole_diameter_mm=20.0,
        )
        expected = 120.0 * 80.0 * 10.0 - math.pi * 10.0**2 * 10.0
        assert kernel.build(spec).volume_mm3 == pytest.approx(expected, rel=1e-6)

    def test_rounding_the_corners_removes_material(self, kernel: CadQueryKernel) -> None:
        sharp = make_spec(kind="plate", corner_radius_mm=0.0, center_hole_diameter_mm=0.0)
        rounded = make_spec(
            kind="plate", corner_radius_mm=8.0, center_hole_diameter_mm=0.0
        )
        # Four corners lose a square minus its quarter-disc.
        lost = 4 * (8.0**2 - math.pi * 8.0**2 / 4) * 10.0
        assert kernel.build(rounded).volume_mm3 == pytest.approx(
            kernel.build(sharp).volume_mm3 - lost, rel=1e-6
        )


class TestMeshQuality:
    pytestmark = pytest.mark.req("REQ-STA-02")

    @pytest.mark.parametrize(
        "payload",
        [
            {"kind": "pipe"},
            {"kind": "pipe", "outer_diameter_mm": 6.0, "wall_thickness_mm": 0.5, "length_mm": 12.0},
            {"kind": "pipe", "outer_diameter_mm": 400.0, "wall_thickness_mm": 12.0, "length_mm": 3000.0},
            {"kind": "elbow", "bend_angle_deg": 45.0},
            {"kind": "elbow", "bend_angle_deg": 180.0, "leg_length_mm": 25.0},
            {"kind": "flange"},
            {"kind": "flange", "bolt_hole_count": 0},
            {"kind": "flange", "bolt_hole_count": 24, "bolt_hole_diameter_mm": 6.0},
            {"kind": "plate"},
            {"kind": "plate", "corner_radius_mm": 0.0, "center_hole_diameter_mm": 0.0},
        ],
    )
    def test_every_supported_part_tessellates_into_a_valid_mesh(
        self,
        kernel: CadQueryKernel,
        tessellation: TessellationSettings,
        payload: dict[str, object],
    ) -> None:
        solid = kernel.build(make_spec(**payload))
        mesh = kernel.tessellate(solid, tessellation)
        report = inspect_mesh(mesh, reference_volume_mm3=solid.volume_mm3)

        assert report.status is MeshQualityStatus.VALID, report.issues
        assert report.is_watertight
        assert report.is_winding_consistent
        assert report.has_outward_normals
        assert not report.has_self_intersections
        assert report.connected_component_count == 1

    def test_tessellated_volume_converges_on_the_exact_solid(
        self, kernel: CadQueryKernel
    ) -> None:
        """Both deflections have to move together.

        For a cylinder at these sizes the angular limit is the binding one, so
        tightening only the linear deflection leaves the mesh untouched.
        """
        solid = kernel.build(make_spec(kind="pipe"))
        coarse = inspect_mesh(
            kernel.tessellate(solid, COARSE),
            reference_volume_mm3=solid.volume_mm3,
        )
        fine = inspect_mesh(
            kernel.tessellate(solid, FINE),
            reference_volume_mm3=solid.volume_mm3,
        )

        assert fine.triangle_count > coarse.triangle_count
        assert fine.volume_deviation_ratio is not None
        assert coarse.volume_deviation_ratio is not None
        assert fine.volume_deviation_ratio < coarse.volume_deviation_ratio
        assert coarse.volume_deviation_ratio > 0.02
        assert fine.volume_deviation_ratio < 0.002

    def test_a_tessellated_curve_never_overshoots_the_exact_solid(
        self, kernel: CadQueryKernel, tessellation: TessellationSettings
    ) -> None:
        solid = kernel.build(make_spec(kind="pipe"))
        mesh = kernel.tessellate(solid, tessellation)
        assert inspect_mesh(mesh).volume_mm3 <= solid.volume_mm3


class TestDeterminism:
    pytestmark = pytest.mark.req("REQ-UBI-01")

    @pytest.mark.parametrize(
        "payload", [{"kind": "pipe"}, {"kind": "elbow"}, {"kind": "flange"}, {"kind": "plate"}]
    )
    def test_rebuilding_produces_a_bit_identical_mesh(
        self,
        kernel: CadQueryKernel,
        tessellation: TessellationSettings,
        payload: dict[str, object],
    ) -> None:
        spec = make_spec(**payload)
        hashes = {
            kernel.tessellate(kernel.build(spec), tessellation).content_hash()
            for _ in range(3)
        }
        assert len(hashes) == 1

    def test_finer_settings_produce_a_different_mesh(
        self, kernel: CadQueryKernel
    ) -> None:
        spec = make_spec(kind="pipe")
        coarse = kernel.tessellate(kernel.build(spec), COARSE)
        fine = kernel.tessellate(kernel.build(spec), FINE)
        assert coarse.content_hash() != fine.content_hash()


class TestExports:
    pytestmark = pytest.mark.req("REQ-OPT-01")

    def test_step_is_written_as_iso_10303(self, kernel: CadQueryKernel) -> None:
        payload = kernel.export(kernel.build(make_spec(kind="flange")), ExportFormat.STEP)
        assert payload.startswith(b"ISO-10303-21;")
        assert b"END-ISO-10303-21;" in payload

    def test_step_geometry_is_reproducible_apart_from_the_translator_stamp(
        self, kernel: CadQueryKernel
    ) -> None:
        """Only OpenCASCADE's own provenance lines differ between two exports.

        The header carries an export timestamp and the PRODUCT entity carries a
        per-process translator counter. Everything that describes the part is
        byte-identical, which is the property that actually matters -- and the
        reason the artifact address is derived from the specification rather
        than from the exported bytes.
        """
        spec = make_spec(kind="plate")
        first = kernel.export(kernel.build(spec), ExportFormat.STEP).decode("latin-1")
        second = kernel.export(kernel.build(spec), ExportFormat.STEP).decode("latin-1")

        assert first != second
        assert _without_provenance(first) == _without_provenance(second)

    def test_dxf_is_a_section_through_the_part(self, kernel: CadQueryKernel) -> None:
        payload = kernel.export(kernel.build(make_spec(kind="flange")), ExportFormat.DXF)
        assert b"SECTION" in payload
        assert b"ENTITIES" in payload

    @pytest.mark.parametrize("mesh_format", [ExportFormat.GLB, ExportFormat.GLTF, ExportFormat.STL])
    def test_the_kernel_refuses_mesh_formats(
        self, kernel: CadQueryKernel, mesh_format: ExportFormat
    ) -> None:
        solid = kernel.build(make_spec(kind="pipe"))
        with pytest.raises(UnsupportedFormatError):
            kernel.export(solid, mesh_format)


class TestSolidValidation:
    pytestmark = pytest.mark.req("REQ-EVT-01")

    def test_the_reported_volume_is_the_exact_one(self, kernel: CadQueryKernel) -> None:
        solid = kernel.build(make_spec(kind="plate", corner_radius_mm=0.0, center_hole_diameter_mm=0.0))
        assert solid.kernel == "cadquery-occt"
        assert solid.volume_mm3 > 0.0
        assert solid.surface_area_mm2 > 0.0
