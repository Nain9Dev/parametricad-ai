"""Specification validation, including the dimensional edge cases."""

from __future__ import annotations

import math

import pytest
from pydantic import ValidationError

from app.domain.models.specs import (
    MAX_DIMENSION_MM,
    ComponentKind,
    ElbowSpec,
    FlangeSpec,
    Material,
    PipeSpec,
    PlateSpec,
)
from tests.conftest import make_spec


class TestDiscrimination:
    def test_kind_selects_the_model(self) -> None:
        assert isinstance(make_spec(kind="pipe"), PipeSpec)
        assert isinstance(make_spec(kind="elbow"), ElbowSpec)
        assert isinstance(make_spec(kind="flange"), FlangeSpec)
        assert isinstance(make_spec(kind="plate"), PlateSpec)

    def test_unknown_kind_is_rejected(self) -> None:
        with pytest.raises(ValidationError, match="does not match any of the expected tags"):
            make_spec(kind="sprocket")

    def test_unknown_field_is_rejected(self) -> None:
        with pytest.raises(ValidationError, match="Extra inputs are not permitted"):
            make_spec(kind="pipe", diameter=25)

    def test_every_kind_has_buildable_defaults(self) -> None:
        for kind in ComponentKind:
            assert make_spec(kind=kind.value).kind is kind


class TestImmutability:
    def test_specs_are_frozen(self) -> None:
        spec = make_spec(kind="pipe")
        assert isinstance(spec, PipeSpec)
        with pytest.raises(ValidationError):
            spec.length_mm = 10.0  # type: ignore[misc]

    def test_canonical_key_ignores_field_order(self) -> None:
        first = make_spec(kind="pipe", outer_diameter_mm=25, length_mm=100, wall_thickness_mm=2)
        second = make_spec(kind="pipe", length_mm=100, wall_thickness_mm=2, outer_diameter_mm=25)
        assert first.canonical_key() == second.canonical_key()

    def test_canonical_key_ignores_numeric_formatting(self) -> None:
        assert (
            make_spec(kind="pipe", outer_diameter_mm=25).canonical_key()
            == make_spec(kind="pipe", outer_diameter_mm=25.0).canonical_key()
        )

    def test_canonical_key_separates_different_parts(self) -> None:
        assert (
            make_spec(kind="pipe", length_mm=100).canonical_key()
            != make_spec(kind="pipe", length_mm=100.5).canonical_key()
        )


class TestBoundaries:
    @pytest.mark.parametrize("value", [0, -1, -0.001])
    def test_non_positive_dimensions_are_rejected(self, value: float) -> None:
        with pytest.raises(ValidationError, match="greater than 0"):
            make_spec(kind="pipe", outer_diameter_mm=value)

    def test_dimensions_above_the_envelope_are_rejected(self) -> None:
        with pytest.raises(ValidationError, match="less than or equal to"):
            make_spec(kind="pipe", length_mm=MAX_DIMENSION_MM + 1)

    def test_the_envelope_itself_is_accepted(self) -> None:
        spec = make_spec(kind="pipe", length_mm=MAX_DIMENSION_MM)
        assert isinstance(spec, PipeSpec)
        assert spec.length_mm == MAX_DIMENSION_MM

    @pytest.mark.parametrize("value", [float("nan"), float("inf")])
    def test_non_finite_dimensions_are_rejected(self, value: float) -> None:
        with pytest.raises(ValidationError):
            make_spec(kind="pipe", length_mm=value)


class TestPipeRules:
    def test_wall_equal_to_the_radius_collapses_the_bore(self) -> None:
        with pytest.raises(ValidationError, match="bore would collapse"):
            make_spec(kind="pipe", outer_diameter_mm=10, wall_thickness_mm=5)

    def test_wall_thicker_than_the_radius_is_rejected(self) -> None:
        with pytest.raises(ValidationError, match="bore would collapse"):
            make_spec(kind="pipe", outer_diameter_mm=10, wall_thickness_mm=8)

    def test_a_wall_just_under_the_radius_is_accepted(self) -> None:
        spec = make_spec(kind="pipe", outer_diameter_mm=10, wall_thickness_mm=4.999)
        assert isinstance(spec, PipeSpec)
        assert spec.inner_diameter_mm == pytest.approx(0.002)


class TestElbowRules:
    def test_bend_radius_equal_to_the_outer_radius_is_rejected(self) -> None:
        with pytest.raises(ValidationError, match="must exceed the outer radius"):
            make_spec(kind="elbow", outer_diameter_mm=50, bend_radius_mm=25)

    def test_bend_radius_below_the_outer_radius_is_rejected(self) -> None:
        with pytest.raises(ValidationError, match="must exceed the outer radius"):
            make_spec(kind="elbow", outer_diameter_mm=50, wall_thickness_mm=2, bend_radius_mm=20)

    @pytest.mark.parametrize("angle", [0, -30, 181, 360])
    def test_angles_outside_the_half_turn_are_rejected(self, angle: float) -> None:
        with pytest.raises(ValidationError):
            make_spec(kind="elbow", bend_angle_deg=angle)

    def test_a_half_turn_is_accepted(self) -> None:
        spec = make_spec(kind="elbow", bend_angle_deg=180)
        assert isinstance(spec, ElbowSpec)
        assert spec.bend_angle_deg == 180.0

    def test_legs_are_optional(self) -> None:
        spec = make_spec(kind="elbow", leg_length_mm=0)
        assert isinstance(spec, ElbowSpec)
        assert spec.leg_length_mm == 0.0


class TestFlangeRules:
    def test_bore_wider_than_the_disc_is_rejected(self) -> None:
        with pytest.raises(ValidationError, match="must be smaller than"):
            make_spec(kind="flange", outer_diameter_mm=50, bore_diameter_mm=60)

    def test_bolt_holes_may_not_break_into_the_bore(self) -> None:
        with pytest.raises(ValidationError, match="overlap the central bore"):
            make_spec(
                kind="flange",
                outer_diameter_mm=100,
                bore_diameter_mm=70,
                bolt_circle_diameter_mm=75,
                bolt_hole_diameter_mm=10,
                bolt_hole_count=4,
            )

    def test_bolt_holes_may_not_break_through_the_rim(self) -> None:
        with pytest.raises(ValidationError, match="break through the outer rim"):
            make_spec(
                kind="flange",
                outer_diameter_mm=100,
                bore_diameter_mm=40,
                bolt_circle_diameter_mm=98,
                bolt_hole_diameter_mm=10,
                bolt_hole_count=4,
            )

    def test_bolt_holes_may_not_overlap_each_other(self) -> None:
        with pytest.raises(ValidationError, match="do not fit on a"):
            make_spec(
                kind="flange",
                outer_diameter_mm=200,
                bore_diameter_mm=40,
                bolt_circle_diameter_mm=80,
                bolt_hole_diameter_mm=10,
                bolt_hole_count=40,
            )

    def test_spacing_is_checked_against_the_chord_not_the_arc(self) -> None:
        """Centre spacing is the straight-line chord, which is the shorter one.

        Four holes on a 40 mm circle sit 28.3 mm apart in a straight line, not
        the 31.4 mm the arc length would suggest; measuring along the arc would
        wave through holes that actually overlap.
        """
        circle, count = 40.0, 4
        chord = 2 * (circle / 2) * math.sin(math.pi / count)
        arc = math.pi * circle / count
        assert chord == pytest.approx(28.284, abs=1e-3)
        assert arc == pytest.approx(31.416, abs=1e-3)

        with pytest.raises(ValidationError, match="do not fit on a"):
            make_spec(
                kind="flange",
                outer_diameter_mm=200,
                bore_diameter_mm=8,
                bolt_circle_diameter_mm=circle,
                bolt_hole_diameter_mm=30.0,
                bolt_hole_count=count,
            )

    def test_a_plain_flange_skips_the_bolt_checks(self) -> None:
        spec = make_spec(
            kind="flange",
            outer_diameter_mm=50,
            bore_diameter_mm=40,
            bolt_hole_count=0,
            bolt_circle_diameter_mm=0,
            bolt_hole_diameter_mm=0,
        )
        assert isinstance(spec, FlangeSpec)
        assert spec.has_bolt_pattern is False

    def test_a_single_bolt_hole_needs_no_spacing_check(self) -> None:
        spec = make_spec(kind="flange", bolt_hole_count=1)
        assert isinstance(spec, FlangeSpec)
        assert spec.bolt_hole_count == 1


class TestPlateRules:
    def test_fillet_larger_than_half_the_short_side_is_rejected(self) -> None:
        with pytest.raises(ValidationError, match="half the shortest side"):
            make_spec(kind="plate", width_mm=100, depth_mm=50, corner_radius_mm=25)

    def test_hole_wider_than_the_short_side_is_rejected(self) -> None:
        with pytest.raises(ValidationError, match="does not fit inside"):
            make_spec(
                kind="plate",
                width_mm=100,
                depth_mm=50,
                corner_radius_mm=0,
                center_hole_diameter_mm=60,
            )

    def test_features_are_optional(self) -> None:
        spec = make_spec(kind="plate", corner_radius_mm=0, center_hole_diameter_mm=0)
        assert isinstance(spec, PlateSpec)
        assert (spec.corner_radius_mm, spec.center_hole_diameter_mm) == (0.0, 0.0)


class TestMaterial:
    def test_mass_follows_density(self) -> None:
        steel = make_spec(kind="pipe", material="stainless_steel")
        plastic = make_spec(kind="pipe", material="pvc")
        assert steel.estimate_mass_g(1_000.0) > plastic.estimate_mass_g(1_000.0)

    def test_a_cubic_centimetre_of_water_like_plastic_weighs_about_a_gram(self) -> None:
        spec = make_spec(kind="pipe", material="abs")
        assert spec.estimate_mass_g(1_000.0) == pytest.approx(1.04)

    def test_unknown_material_is_rejected(self) -> None:
        with pytest.raises(ValidationError):
            make_spec(kind="pipe", material="unobtainium")

    def test_every_material_has_a_density(self) -> None:
        from app.domain.models.specs import MATERIAL_DENSITY_G_CM3

        assert set(MATERIAL_DENSITY_G_CM3) == set(Material)
