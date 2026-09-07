"""Offline parameter extraction from Spanish and English prompts."""

from __future__ import annotations

import pytest

from app.domain.errors import ParameterExtractionError
from app.domain.models.specs import ComponentKind, ElbowSpec, FlangeSpec, PipeSpec, PlateSpec
from app.infrastructure.llm.rule_based_extractor import RuleBasedParameterExtractor


@pytest.fixture(scope="module")
def extractor() -> RuleBasedParameterExtractor:
    return RuleBasedParameterExtractor()


class TestKindDetection:
    @pytest.mark.parametrize(
        ("prompt", "expected"),
        [
            ("a stainless steel pipe", ComponentKind.PIPE),
            ("tubo de acero", ComponentKind.PIPE),
            ("una tuberia de PVC", ComponentKind.PIPE),
            ("a 90 degree elbow", ComponentKind.ELBOW),
            ("un codo de 45 grados", ComponentKind.ELBOW),
            ("a flange", ComponentKind.FLANGE),
            ("una brida", ComponentKind.FLANGE),
            ("an aluminium plate", ComponentKind.PLATE),
            ("una placa de acero", ComponentKind.PLATE),
            ("una chapa", ComponentKind.PLATE),
        ],
    )
    def test_component_family(
        self, extractor: RuleBasedParameterExtractor, prompt: str, expected: ComponentKind
    ) -> None:
        assert extractor.extract(prompt).kind is expected

    def test_an_undescribed_part_defaults_to_a_pipe(
        self, extractor: RuleBasedParameterExtractor
    ) -> None:
        assert extractor.extract("something 30mm long").kind is ComponentKind.PIPE


class TestWordOrder:
    def test_english_puts_the_number_after_the_keyword(
        self, extractor: RuleBasedParameterExtractor
    ) -> None:
        spec = extractor.extract("pipe with a diameter of 25.5mm and a length of 200mm")
        assert isinstance(spec, PipeSpec)
        assert (spec.outer_diameter_mm, spec.length_mm) == (25.5, 200.0)

    def test_spanish_puts_the_number_before_the_keyword(
        self, extractor: RuleBasedParameterExtractor
    ) -> None:
        spec = extractor.extract("tubo de 25,5 mm de diametro y 200 mm de longitud")
        assert isinstance(spec, PipeSpec)
        assert (spec.outer_diameter_mm, spec.length_mm) == (25.5, 200.0)

    def test_a_keyword_does_not_reach_across_a_conjunction(
        self, extractor: RuleBasedParameterExtractor
    ) -> None:
        """Without a clause boundary, ``diameter`` would grab the nearer 200."""
        spec = extractor.extract("pipe, diameter 25mm and 200mm length")
        assert isinstance(spec, PipeSpec)
        assert spec.outer_diameter_mm == 25.0

    def test_a_keyword_does_not_reach_across_a_comma(
        self, extractor: RuleBasedParameterExtractor
    ) -> None:
        spec = extractor.extract("placa de 200mm de ancho, 100mm de fondo, espesor 8mm")
        assert isinstance(spec, PlateSpec)
        assert (spec.width_mm, spec.depth_mm, spec.thickness_mm) == (200.0, 100.0, 8.0)


class TestUnits:
    @pytest.mark.parametrize(
        ("written", "millimetres"),
        [
            ("500mm", 500.0),
            ("50 cm", 500.0),
            ("0.5 m", 500.0),
            ("0,5 metros", 500.0),
        ],
    )
    def test_lengths_are_normalised_to_millimetres(
        self, extractor: RuleBasedParameterExtractor, written: str, millimetres: float
    ) -> None:
        spec = extractor.extract(f"pipe with a length of {written}")
        assert isinstance(spec, PipeSpec)
        assert spec.length_mm == pytest.approx(millimetres)

    def test_inches_are_converted(self, extractor: RuleBasedParameterExtractor) -> None:
        spec = extractor.extract("pipe with a 2 inch diameter")
        assert isinstance(spec, PipeSpec)
        assert spec.outer_diameter_mm == pytest.approx(50.8)

    def test_a_comma_before_three_digits_is_a_thousands_separator(
        self, extractor: RuleBasedParameterExtractor
    ) -> None:
        spec = extractor.extract("pipe with a length of 1,000 mm")
        assert isinstance(spec, PipeSpec)
        assert spec.length_mm == pytest.approx(1000.0)

    def test_a_comma_before_two_digits_is_a_decimal_separator(
        self, extractor: RuleBasedParameterExtractor
    ) -> None:
        spec = extractor.extract("tubo de 1,5 mm de espesor")
        assert isinstance(spec, PipeSpec)
        assert spec.wall_thickness_mm == pytest.approx(1.5)

    def test_angles_are_read_as_degrees_not_millimetres(
        self, extractor: RuleBasedParameterExtractor
    ) -> None:
        spec = extractor.extract("codo de 45 grados")
        assert isinstance(spec, ElbowSpec)
        assert spec.bend_angle_deg == 45.0


class TestComponentFields:
    def test_elbow_parameters(self, extractor: RuleBasedParameterExtractor) -> None:
        spec = extractor.extract(
            "codo de 90 grados, diametro 25mm, radio de curvatura 50mm, "
            "espesor 2mm, tramo recto 30mm"
        )
        assert isinstance(spec, ElbowSpec)
        assert (spec.bend_angle_deg, spec.outer_diameter_mm) == (90.0, 25.0)
        assert (spec.bend_radius_mm, spec.wall_thickness_mm, spec.leg_length_mm) == (
            50.0,
            2.0,
            30.0,
        )

    def test_flange_bolt_pattern(self, extractor: RuleBasedParameterExtractor) -> None:
        spec = extractor.extract(
            "brida de 100mm de diametro exterior, paso 50mm, espesor 12mm, "
            "8 tornillos en circulo de pernos 80mm"
        )
        assert isinstance(spec, FlangeSpec)
        assert (spec.outer_diameter_mm, spec.bore_diameter_mm) == (100.0, 50.0)
        assert (spec.bolt_hole_count, spec.bolt_circle_diameter_mm) == (8, 80.0)

    def test_a_count_is_read_as_an_integer(
        self, extractor: RuleBasedParameterExtractor
    ) -> None:
        spec = extractor.extract("flange with 12 bolts")
        assert isinstance(spec, FlangeSpec)
        assert isinstance(spec.bolt_hole_count, int)
        assert spec.bolt_hole_count == 12

    def test_a_size_trailing_the_count_is_the_hole_diameter(
        self, extractor: RuleBasedParameterExtractor
    ) -> None:
        spec = extractor.extract(
            "brida de 100mm de diametro exterior, paso 50mm, "
            "8 tornillos de 10mm en circulo de pernos 80mm"
        )
        assert isinstance(spec, FlangeSpec)
        assert (spec.bolt_hole_count, spec.bolt_hole_diameter_mm) == (8, 10.0)
        assert spec.bolt_circle_diameter_mm == 80.0

    @pytest.mark.parametrize(
        "prompt",
        [
            "brida de 140mm de diametro exterior, paso 70mm, espesor 16mm, 12 tornillos",
            "brida de 300mm de diametro exterior, paso 200mm, 24 tornillos",
            "brida de 40mm de diametro exterior, paso 20mm, 4 tornillos",
            "flange 120mm outer diameter, bore 60mm, 12 bolts",
        ],
    )
    def test_an_unstated_bolt_pattern_is_scaled_to_the_flange(
        self, extractor: RuleBasedParameterExtractor, prompt: str
    ) -> None:
        """A described flange must be buildable without naming the bolt circle.

        The schema defaults describe a 100 mm flange; inheriting them for a 300 mm
        one would put the bolt circle inside the bore and fail validation for a
        detail the description never mentioned.
        """
        spec = extractor.extract(prompt)
        assert isinstance(spec, FlangeSpec)
        assert spec.bore_diameter_mm < spec.bolt_circle_diameter_mm < spec.outer_diameter_mm

    def test_an_explicit_bolt_circle_is_never_overridden(
        self, extractor: RuleBasedParameterExtractor
    ) -> None:
        spec = extractor.extract(
            "brida de 200mm de diametro exterior, paso 80mm, circulo de pernos 150mm"
        )
        assert isinstance(spec, FlangeSpec)
        assert spec.bolt_circle_diameter_mm == 150.0

    def test_the_outline_shorthand_is_understood(
        self, extractor: RuleBasedParameterExtractor
    ) -> None:
        spec = extractor.extract("steel plate 150 x 90, thickness 6mm")
        assert isinstance(spec, PlateSpec)
        assert (spec.width_mm, spec.depth_mm, spec.thickness_mm) == (150.0, 90.0, 6.0)


class TestMaterial:
    @pytest.mark.parametrize(
        ("prompt", "material"),
        [
            ("stainless steel pipe", "stainless_steel"),
            ("tubo de acero inoxidable", "stainless_steel"),
            ("tubo de acero al carbono", "carbon_steel"),
            ("aluminium pipe", "aluminium"),
            ("tubo de aluminio", "aluminium"),
            ("tubo de PVC", "pvc"),
            ("tubo de laton", "brass"),
        ],
    )
    def test_material_detection(
        self, extractor: RuleBasedParameterExtractor, prompt: str, material: str
    ) -> None:
        assert extractor.extract(prompt).material.value == material

    def test_an_unstated_material_falls_back_to_the_default(
        self, extractor: RuleBasedParameterExtractor
    ) -> None:
        assert extractor.extract("a pipe").material.value == "stainless_steel"


class TestFailures:
    @pytest.mark.parametrize("prompt", ["", "   ", "\n\t"])
    def test_an_empty_prompt_is_rejected(
        self, extractor: RuleBasedParameterExtractor, prompt: str
    ) -> None:
        with pytest.raises(ParameterExtractionError, match="empty"):
            extractor.extract(prompt)

    def test_an_unbuildable_description_reports_the_violated_rule(
        self, extractor: RuleBasedParameterExtractor
    ) -> None:
        with pytest.raises(ParameterExtractionError) as raised:
            extractor.extract("tubo de 10mm de diametro con pared de 9mm")

        details = raised.value.details
        assert details["kind"] == "pipe"
        assert "bore would collapse" in details["violations"][0]["message"]
        assert raised.value.hint is not None


class TestDeterminism:
    def test_the_same_prompt_always_yields_the_same_spec(
        self, extractor: RuleBasedParameterExtractor
    ) -> None:
        prompt = "codo de aluminio de 45 grados, diametro 30mm, radio 60mm"
        keys = {extractor.extract(prompt).canonical_key() for _ in range(5)}
        assert len(keys) == 1

    def test_the_backend_names_itself(self, extractor: RuleBasedParameterExtractor) -> None:
        assert extractor.name == "rule_based"
