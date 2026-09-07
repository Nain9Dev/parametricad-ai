"""Deterministic, offline parameter extraction.

This is the default extraction backend: it needs no API key, no network and no
budget, which keeps the whole engine runnable and testable on its own. It also
serves as the reference implementation of the extraction contract -- whatever a
language model returns has to satisfy exactly the same specification schema.

The strategy is positional rather than grammatical. Numeric quantities and
field keywords are located independently, then each keyword claims the closest
unclaimed quantity. That copes with the phrasings engineers actually write
("diameter of 25 mm", "25mm diameter", "DN25, 200 long") without pretending to
parse natural language.
"""

from __future__ import annotations

import math
import re
import unicodedata
from dataclasses import dataclass

from pydantic import TypeAdapter, ValidationError

from app.domain.errors import ParameterExtractionError
from app.domain.models.specs import ComponentKind, ComponentSpec, Material

__all__ = ["RuleBasedParameterExtractor"]

_SPEC_ADAPTER: TypeAdapter[ComponentSpec] = TypeAdapter(ComponentSpec)

_SYMBOL_REPLACEMENTS = {
    "°": " deg ",  # degree sign
    "″": ' in ',  # double prime
    "′": " ft ",  # prime
    '"': " in ",
}

_UNIT_TO_MM: dict[str, float] = {
    "mm": 1.0,
    "milimetro": 1.0,
    "milimetros": 1.0,
    "millimetre": 1.0,
    "millimetres": 1.0,
    "millimeter": 1.0,
    "millimeters": 1.0,
    "cm": 10.0,
    "centimetro": 10.0,
    "centimetros": 10.0,
    "centimetre": 10.0,
    "centimetres": 10.0,
    "m": 1_000.0,
    "metro": 1_000.0,
    "metros": 1_000.0,
    "metre": 1_000.0,
    "metres": 1_000.0,
    "meter": 1_000.0,
    "meters": 1_000.0,
    "in": 25.4,
    "inch": 25.4,
    "inches": 25.4,
    "pulgada": 25.4,
    "pulgadas": 25.4,
}

_ANGLE_UNITS = {"deg", "degree", "degrees", "grado", "grados"}

_NUMBER_PATTERN = re.compile(
    r"(?P<value>\d+(?:[.,]\d+)?)\s*(?P<unit>[a-z]+)?",
)

_KIND_KEYWORDS: tuple[tuple[ComponentKind, str], ...] = (
    (ComponentKind.ELBOW, r"\b(codo|elbow|bend|curva)\b"),
    (ComponentKind.FLANGE, r"\b(brida|flange)\b"),
    (ComponentKind.PLATE, r"\b(placa|plancha|chapa|plate|plaque)\b"),
    (ComponentKind.PIPE, r"\b(tubo|tuberia|caneria|cano|pipe|tube|conducto)\b"),
)

_MATERIAL_KEYWORDS: tuple[tuple[Material, str], ...] = (
    (Material.STAINLESS_STEEL, r"\b(acero\s+inoxidable|inox|stainless)\b"),
    (Material.CARBON_STEEL, r"\b(acero\s+al\s+carbono|acero\s+carbono|carbon\s+steel|acero)\b"),
    (Material.ALUMINIUM, r"\b(aluminio|aluminium|aluminum)\b"),
    (Material.BRASS, r"\b(laton|brass)\b"),
    (Material.COPPER, r"\b(cobre|copper)\b"),
    (Material.PVC, r"\b(pvc)\b"),
    (Material.PTFE, r"\b(ptfe|teflon)\b"),
    (Material.ABS, r"\b(abs)\b"),
    (Material.NYLON, r"\b(nylon|nailon|poliamida)\b"),
)

# Ordered per kind: the most specific phrase must claim its number first, so
# "bolt circle diameter" is never swallowed by a bare "diameter".
_FIELD_PATTERNS: dict[ComponentKind, tuple[tuple[str, str], ...]] = {
    ComponentKind.PIPE: (
        ("wall_thickness_mm", r"\b(espesor|grosor|pared|thickness|wall)\b"),
        ("outer_diameter_mm", r"\b(diametro|diam|dia|od|calibre|diameter|bore)\b"),
        ("length_mm", r"\b(longitud|largo|length|long)\b"),
    ),
    ComponentKind.ELBOW: (
        ("wall_thickness_mm", r"\b(espesor|grosor|pared|thickness|wall)\b"),
        ("bend_radius_mm", r"\b(radio\s+de\s+curvatura|radio|curvatura|bend\s+radius|radius)\b"),
        ("bend_angle_deg", r"\b(angulo|angle|deg|grados|degrees)\b"),
        ("leg_length_mm", r"\b(tramo\s+recto|tramos\s+rectos|patas|leg|legs|straight)\b"),
        ("outer_diameter_mm", r"\b(diametro|diam|dia|od|calibre|diameter)\b"),
    ),
    ComponentKind.FLANGE: (
        ("bolt_circle_diameter_mm", r"\b(circulo\s+de\s+pernos|circunferencia\s+de\s+taladros|bolt\s+circle)\b"),
        # Also covers the "8 tornillos de 10mm" / "8 bolts of 10mm" shorthand,
        # where the size trails the count instead of being labelled.
        (
            "bolt_hole_diameter_mm",
            r"\b(diametro\s+de\s+(?:perno|pernos|tornillo|tornillos)"
            r"|bolt\s+hole\s+diameter|bolt\s+diameter"
            r"|(?:tornillos?|pernos?)\s+de|bolts?\s+of)\b",
        ),
        ("bolt_hole_count", r"\b(pernos|tornillos|taladros|bolts|holes)\b"),
        ("bore_diameter_mm", r"\b(taladro\s+central|agujero\s+central|paso|bore)\b"),
        ("thickness_mm", r"\b(espesor|grosor|thickness)\b"),
        ("outer_diameter_mm", r"\b(diametro\s+exterior|diametro|diameter|od)\b"),
    ),
    ComponentKind.PLATE: (
        ("corner_radius_mm", r"\b(radio\s+de\s+esquina|radio|corner\s+radius|fillet)\b"),
        ("center_hole_diameter_mm", r"\b(agujero\s+central|taladro\s+central|center\s+hole|centre\s+hole|hole)\b"),
        ("thickness_mm", r"\b(espesor|grosor|thickness)\b"),
        ("width_mm", r"\b(ancho|anchura|width)\b"),
        ("depth_mm", r"\b(fondo|profundidad|depth|alto|altura|height)\b"),
    ),
}

_INTEGER_FIELDS = frozenset({"bolt_hole_count"})
_ANGLE_FIELDS = frozenset({"bend_angle_deg"})

_ASSOCIATION_WINDOW = 40
"""Characters a keyword may reach to claim a quantity."""

_DEFAULT_BOLT_HOLE_COUNT = 8
_BOLT_HOLE_CLEARANCE_RATIO = 0.6
"""Fraction of the available gap a derived bolt hole is allowed to take."""
_MAX_BOLT_HOLE_MM = 24.0

_CLAUSE_BREAK = re.compile(r"[,;()]|\b(?:y|and|con|with|por)\b")
"""A keyword may not reach across a clause boundary to claim a number.

Without this, "25 mm diameter and 200 mm long" lets ``diameter`` grab the 200
that sits three characters to its right, because raw proximity says nothing
about which clause a number belongs to.
"""

_DIMENSION_PAIR = re.compile(
    r"(?P<first>\d+(?:[.,]\d+)?)\s*(?:mm|cm|m)?\s*[x*]\s*(?P<second>\d+(?:[.,]\d+)?)"
)
"""The unlabelled ``150 x 90`` shorthand engineers use for plate outlines."""


@dataclass(frozen=True, slots=True)
class _Quantity:
    """A number found in the prompt, with its span and resolved units."""

    raw_value: float
    millimetres: float
    is_angle: bool
    start: int
    end: int


def _normalise(prompt: str) -> str:
    """Lowercase, expand symbols and strip accents so patterns stay ASCII."""
    text = prompt.lower()
    for symbol, replacement in _SYMBOL_REPLACEMENTS.items():
        text = text.replace(symbol, replacement)
    decomposed = unicodedata.normalize("NFKD", text)
    stripped = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    return "".join(ch if ch.isascii() else " " for ch in stripped)


def _parse_number(raw: str) -> float:
    """Read a number written with either decimal separator.

    A comma followed by exactly three digits is read as a thousands separator,
    which is how ``1,000 mm`` is meant and how ``1,5 mm`` is not.
    """
    if "," in raw:
        _, _, fraction = raw.partition(",")
        raw = raw.replace(",", "" if len(fraction) == 3 else ".")
    return float(raw)


def _find_quantities(text: str) -> list[_Quantity]:
    quantities: list[_Quantity] = []
    for match in _NUMBER_PATTERN.finditer(text):
        value = _parse_number(match.group("value"))
        unit = match.group("unit") or ""
        is_angle = unit in _ANGLE_UNITS
        scale = _UNIT_TO_MM.get(unit, 1.0)
        quantities.append(
            _Quantity(
                raw_value=value,
                millimetres=value * scale,
                is_angle=is_angle,
                start=match.start("value"),
                end=match.end("value"),
            )
        )
    return quantities


def _detect_kind(text: str) -> ComponentKind:
    for kind, pattern in _KIND_KEYWORDS:
        if re.search(pattern, text):
            return kind
    return ComponentKind.PIPE


def _detect_material(text: str) -> Material | None:
    for material, pattern in _MATERIAL_KEYWORDS:
        if re.search(pattern, text):
            return material
    return None


def _claim_nearest(
    text: str,
    keyword_start: int,
    keyword_end: int,
    quantities: list[_Quantity],
    claimed: set[int],
) -> int | None:
    """Pick the closest unclaimed quantity in the keyword's own clause.

    Both orders occur in practice -- "diameter of 25 mm" and "25 mm de
    diametro" -- so either side is eligible, with a one-character penalty that
    breaks ties in favour of the number that follows the keyword.
    """
    best_index: int | None = None
    best_cost = _ASSOCIATION_WINDOW + 1

    for index, quantity in enumerate(quantities):
        if index in claimed:
            continue
        if quantity.start >= keyword_end:
            gap = text[keyword_end : quantity.start]
            distance, cost = quantity.start - keyword_end, quantity.start - keyword_end
        else:
            gap = text[quantity.end : keyword_start]
            distance = keyword_start - quantity.end
            cost = distance + 1
        if distance < 0 or distance > _ASSOCIATION_WINDOW:
            continue
        if _CLAUSE_BREAK.search(gap):
            continue
        if cost < best_cost:
            best_index, best_cost = index, cost

    return best_index


def _claim_dimension_pair(
    text: str, quantities: list[_Quantity], claimed: set[int]
) -> dict[str, float] | None:
    """Resolve the ``150 x 90`` outline shorthand into width and depth."""
    match = _DIMENSION_PAIR.search(text)
    if match is None:
        return None

    spans = {"width_mm": match.span("first"), "depth_mm": match.span("second")}
    resolved: dict[str, float] = {}
    for field, (start, _end) in spans.items():
        for index, quantity in enumerate(quantities):
            if index not in claimed and quantity.start == start:
                claimed.add(index)
                resolved[field] = quantity.millimetres
                break
    return resolved or None


def _scale_flange_bolt_pattern(payload: dict[str, object]) -> None:
    """Size an unstated bolt pattern to the flange the prompt describes.

    The schema defaults describe a 100 mm flange. A description that gives a
    larger outer diameter and bore but says nothing about the bolt circle would
    otherwise inherit a circle that no longer fits between them, and be rejected
    for a detail the user never mentioned. The derived values follow the usual
    rule of thumb -- the circle halfway between bore and rim, holes sized to
    clear both and each other -- and an explicitly stated value is never
    touched.
    """
    outer = payload.get("outer_diameter_mm")
    if not isinstance(outer, (int, float)):
        return

    bore = payload.get("bore_diameter_mm")
    bore_diameter = float(bore) if isinstance(bore, (int, float)) else float(outer) / 2.0

    if "bolt_circle_diameter_mm" not in payload:
        payload["bolt_circle_diameter_mm"] = (float(outer) + bore_diameter) / 2.0

    circle = payload["bolt_circle_diameter_mm"]
    if not isinstance(circle, (int, float)) or circle <= 0.0:
        return

    count = payload.get("bolt_hole_count", _DEFAULT_BOLT_HOLE_COUNT)
    if not isinstance(count, int) or count <= 0 or "bolt_hole_diameter_mm" in payload:
        return

    radial_clearance = min(float(circle) - bore_diameter, float(outer) - float(circle)) / 2.0
    neighbour_spacing = (
        2.0 * (float(circle) / 2.0) * math.sin(math.pi / count)
        if count > 1
        else radial_clearance
    )
    diameter = min(radial_clearance, neighbour_spacing) * _BOLT_HOLE_CLEARANCE_RATIO
    if diameter > 0.0:
        payload["bolt_hole_diameter_mm"] = round(min(diameter, _MAX_BOLT_HOLE_MM), 1)


class RuleBasedParameterExtractor:
    """Keyword and unit driven extraction; no model, no network."""

    name = "rule_based"

    def extract(self, prompt: str) -> ComponentSpec:
        if not prompt.strip():
            raise ParameterExtractionError(
                "The prompt is empty.",
                hint="Describe the part, for example: stainless steel pipe, 25 mm diameter, 200 mm long.",
            )

        text = _normalise(prompt)
        kind = _detect_kind(text)
        quantities = _find_quantities(text)
        claimed: set[int] = set()

        payload: dict[str, object] = {"kind": kind.value}

        # The outline shorthand is resolved first so its numbers are off the
        # table before any keyword starts looking for one nearby.
        if kind is ComponentKind.PLATE:
            outline = _claim_dimension_pair(text, quantities, claimed)
            if outline:
                payload.update(outline)

        for field, pattern in _FIELD_PATTERNS[kind]:
            if field in payload:
                continue
            match = re.search(pattern, text)
            if match is None:
                continue
            index = _claim_nearest(text, match.start(), match.end(), quantities, claimed)
            if index is None:
                continue
            claimed.add(index)
            payload[field] = _value_for(field, quantities[index])

        if kind is ComponentKind.FLANGE:
            _scale_flange_bolt_pattern(payload)

        material = _detect_material(text)
        if material is not None:
            payload["material"] = material.value

        try:
            return _SPEC_ADAPTER.validate_python(payload)
        except ValidationError as exc:
            raise ParameterExtractionError(
                "The prompt describes a part that cannot be built as specified.",
                hint="Check that the wall fits inside the diameter and that every dimension is positive.",
                details={
                    "kind": kind.value,
                    "extracted": payload,
                    "violations": [
                        {"field": ".".join(str(p) for p in error["loc"]), "message": error["msg"]}
                        for error in exc.errors()
                    ],
                },
            ) from exc


def _value_for(field: str, quantity: _Quantity) -> float | int:
    """Convert a claimed quantity into the unit the target field expects."""
    if field in _INTEGER_FIELDS:
        return int(round(quantity.raw_value))
    if field in _ANGLE_FIELDS:
        return quantity.raw_value
    return quantity.millimetres
