"""Parametric component specifications.

These models are the single source of truth for what the engine can build. The
API request schema, the OpenAPI document, the LLM extraction contract and the
frontend's dynamic parameter form are all derived from them, so a new component
type or a changed limit only has to be expressed once.

Validation is deliberately strict:

* unknown fields are rejected rather than silently dropped, so a typo in a
  client payload fails loudly;
* instances are frozen, which is what lets a spec be used as a cache key;
* cross-field rules encode manufacturability, not just positivity -- a wall
  thicker than the pipe radius or a bolt circle that runs off the flange rim is
  rejected before it ever reaches the CAD kernel.
"""

from __future__ import annotations

import json
import math
from enum import StrEnum
from typing import Annotated, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

__all__ = [
    "ComponentKind",
    "ComponentSpec",
    "ElbowSpec",
    "FlangeSpec",
    "Material",
    "MATERIAL_DENSITY_G_CM3",
    "PipeSpec",
    "PlateSpec",
]

MAX_DIMENSION_MM = 5_000.0
"""Upper bound on any single linear dimension, in millimetres.

Chosen so the tessellated result stays inside the triangle budget at the
default deflection while still covering realistic piping hardware.
"""

Millimetres = Annotated[float, Field(gt=0.0, le=MAX_DIMENSION_MM)]
NonNegativeMillimetres = Annotated[float, Field(ge=0.0, le=MAX_DIMENSION_MM)]


class ComponentKind(StrEnum):
    """Buildable component families."""

    PIPE = "pipe"
    ELBOW = "elbow"
    FLANGE = "flange"
    PLATE = "plate"


class Material(StrEnum):
    """Materials the engine can cost and weigh.

    Material has no effect on geometry; it drives the mass estimate and is
    carried through to the exported metadata.
    """

    STAINLESS_STEEL = "stainless_steel"
    CARBON_STEEL = "carbon_steel"
    ALUMINIUM = "aluminium"
    BRASS = "brass"
    COPPER = "copper"
    PVC = "pvc"
    PTFE = "ptfe"
    ABS = "abs"
    NYLON = "nylon"


MATERIAL_DENSITY_G_CM3: dict[Material, float] = {
    Material.STAINLESS_STEEL: 7.90,
    Material.CARBON_STEEL: 7.85,
    Material.ALUMINIUM: 2.70,
    Material.BRASS: 8.50,
    Material.COPPER: 8.96,
    Material.PVC: 1.40,
    Material.PTFE: 2.20,
    Material.ABS: 1.04,
    Material.NYLON: 1.14,
}
"""Nominal densities used for the mass estimate, in g/cm3."""


class _BaseSpec(BaseModel):
    """Shared configuration and behaviour for every component family."""

    model_config = ConfigDict(
        extra="forbid",
        frozen=True,
        use_enum_values=False,
        validate_default=True,
    )

    material: Material = Field(
        default=Material.STAINLESS_STEEL,
        description="Material used for the mass estimate.",
        json_schema_extra={"group": "Material"},
    )

    @property
    def density_g_cm3(self) -> float:
        return MATERIAL_DENSITY_G_CM3[self.material]

    def estimate_mass_g(self, volume_mm3: float) -> float:
        """Mass in grams for a solid of ``volume_mm3`` in this material."""
        return volume_mm3 * self.density_g_cm3 / 1_000.0

    def canonical_key(self) -> str:
        """Stable JSON encoding used to content-address generated artifacts.

        Two specs that describe the same part produce the same key regardless of
        field order or numeric formatting in the original request.
        """
        payload = self.model_dump(mode="json")
        return json.dumps(payload, sort_keys=True, separators=(",", ":"))


class PipeSpec(_BaseSpec):
    """A straight hollow cylinder."""

    kind: Literal[ComponentKind.PIPE] = ComponentKind.PIPE

    outer_diameter_mm: Millimetres = Field(
        default=25.0,
        description="Outside diameter of the tube.",
        json_schema_extra={"unit": "mm", "step": 0.5, "group": "Section"},
    )
    wall_thickness_mm: Millimetres = Field(
        default=2.5,
        description="Wall thickness; must stay below the outer radius.",
        json_schema_extra={"unit": "mm", "step": 0.1, "group": "Section"},
    )
    length_mm: Millimetres = Field(
        default=200.0,
        description="Length along the extrusion axis.",
        json_schema_extra={"unit": "mm", "step": 1.0, "group": "Geometry"},
    )

    @property
    def inner_diameter_mm(self) -> float:
        return self.outer_diameter_mm - 2.0 * self.wall_thickness_mm

    @model_validator(mode="after")
    def _validate_wall(self) -> Self:
        if self.wall_thickness_mm >= self.outer_diameter_mm / 2.0:
            raise ValueError(
                f"wall_thickness_mm ({self.wall_thickness_mm}) must be smaller than the "
                f"outer radius ({self.outer_diameter_mm / 2.0}); the bore would collapse"
            )
        return self


class ElbowSpec(_BaseSpec):
    """A swept bend, optionally extended by straight tangent legs."""

    kind: Literal[ComponentKind.ELBOW] = ComponentKind.ELBOW

    outer_diameter_mm: Millimetres = Field(
        default=25.0,
        description="Outside diameter of the tube.",
        json_schema_extra={"unit": "mm", "step": 0.5, "group": "Section"},
    )
    wall_thickness_mm: Millimetres = Field(
        default=2.5,
        description="Wall thickness; must stay below the outer radius.",
        json_schema_extra={"unit": "mm", "step": 0.1, "group": "Section"},
    )
    bend_radius_mm: Millimetres = Field(
        default=50.0,
        description="Centreline bend radius; must exceed the outer radius.",
        json_schema_extra={"unit": "mm", "step": 1.0, "group": "Geometry"},
    )
    bend_angle_deg: Annotated[float, Field(gt=0.0, le=180.0)] = Field(
        default=90.0,
        description="Swept angle of the bend.",
        json_schema_extra={"unit": "deg", "step": 5.0, "group": "Geometry"},
    )
    leg_length_mm: NonNegativeMillimetres = Field(
        default=0.0,
        description="Straight tangent section added at each end. Zero for a bare bend.",
        json_schema_extra={"unit": "mm", "step": 1.0, "group": "Geometry"},
    )

    @property
    def inner_diameter_mm(self) -> float:
        return self.outer_diameter_mm - 2.0 * self.wall_thickness_mm

    @model_validator(mode="after")
    def _validate_bend(self) -> Self:
        outer_radius = self.outer_diameter_mm / 2.0
        if self.wall_thickness_mm >= outer_radius:
            raise ValueError(
                f"wall_thickness_mm ({self.wall_thickness_mm}) must be smaller than the "
                f"outer radius ({outer_radius}); the bore would collapse"
            )
        if self.bend_radius_mm <= outer_radius:
            raise ValueError(
                f"bend_radius_mm ({self.bend_radius_mm}) must exceed the outer radius "
                f"({outer_radius}); a tighter bend folds the tube through its own axis"
            )
        return self


class FlangeSpec(_BaseSpec):
    """A bored disc with an optional bolt circle."""

    kind: Literal[ComponentKind.FLANGE] = ComponentKind.FLANGE

    outer_diameter_mm: Millimetres = Field(
        default=100.0,
        description="Outside diameter of the disc.",
        json_schema_extra={"unit": "mm", "step": 1.0, "group": "Geometry"},
    )
    bore_diameter_mm: Millimetres = Field(
        default=50.0,
        description="Central through bore.",
        json_schema_extra={"unit": "mm", "step": 0.5, "group": "Geometry"},
    )
    thickness_mm: Millimetres = Field(
        default=12.0,
        description="Disc thickness.",
        json_schema_extra={"unit": "mm", "step": 0.5, "group": "Geometry"},
    )
    bolt_hole_count: Annotated[int, Field(ge=0, le=64)] = Field(
        default=8,
        description="Number of bolt holes on the bolt circle. Zero for a plain flange.",
        json_schema_extra={"step": 1, "group": "Bolt pattern"},
    )
    bolt_hole_diameter_mm: NonNegativeMillimetres = Field(
        default=10.0,
        description="Diameter of each bolt hole.",
        json_schema_extra={"unit": "mm", "step": 0.5, "group": "Bolt pattern"},
    )
    bolt_circle_diameter_mm: NonNegativeMillimetres = Field(
        default=80.0,
        description="Diameter of the circle the bolt holes sit on.",
        json_schema_extra={"unit": "mm", "step": 1.0, "group": "Bolt pattern"},
    )

    @property
    def has_bolt_pattern(self) -> bool:
        return self.bolt_hole_count > 0 and self.bolt_hole_diameter_mm > 0.0

    @model_validator(mode="after")
    def _validate_flange(self) -> Self:
        outer_radius = self.outer_diameter_mm / 2.0
        bore_radius = self.bore_diameter_mm / 2.0
        if bore_radius >= outer_radius:
            raise ValueError(
                f"bore_diameter_mm ({self.bore_diameter_mm}) must be smaller than "
                f"outer_diameter_mm ({self.outer_diameter_mm})"
            )
        if not self.has_bolt_pattern:
            return self

        bolt_radius = self.bolt_hole_diameter_mm / 2.0
        circle_radius = self.bolt_circle_diameter_mm / 2.0
        if circle_radius - bolt_radius <= bore_radius:
            raise ValueError(
                "bolt holes overlap the central bore; increase "
                "bolt_circle_diameter_mm or reduce bolt_hole_diameter_mm"
            )
        if circle_radius + bolt_radius >= outer_radius:
            raise ValueError(
                "bolt holes break through the outer rim; reduce "
                "bolt_circle_diameter_mm or bolt_hole_diameter_mm"
            )
        if self.bolt_hole_count > 1:
            pitch = 2.0 * circle_radius * math.sin(math.pi / self.bolt_hole_count)
            if pitch <= self.bolt_hole_diameter_mm:
                raise ValueError(
                    f"{self.bolt_hole_count} holes of {self.bolt_hole_diameter_mm} mm do "
                    f"not fit on a {self.bolt_circle_diameter_mm} mm bolt circle "
                    f"(centre spacing {pitch:.2f} mm); reduce the count or the diameter"
                )
        return self


class PlateSpec(_BaseSpec):
    """A rectangular plate with optional rounded corners and a central hole."""

    kind: Literal[ComponentKind.PLATE] = ComponentKind.PLATE

    width_mm: Millimetres = Field(
        default=120.0,
        description="Extent along X.",
        json_schema_extra={"unit": "mm", "step": 1.0, "group": "Geometry"},
    )
    depth_mm: Millimetres = Field(
        default=80.0,
        description="Extent along Y.",
        json_schema_extra={"unit": "mm", "step": 1.0, "group": "Geometry"},
    )
    thickness_mm: Millimetres = Field(
        default=10.0,
        description="Extent along Z.",
        json_schema_extra={"unit": "mm", "step": 0.5, "group": "Geometry"},
    )
    corner_radius_mm: NonNegativeMillimetres = Field(
        default=8.0,
        description="Fillet radius on the four vertical edges. Zero for sharp corners.",
        json_schema_extra={"unit": "mm", "step": 0.5, "group": "Features"},
    )
    center_hole_diameter_mm: NonNegativeMillimetres = Field(
        default=20.0,
        description="Central through hole. Zero for a solid plate.",
        json_schema_extra={"unit": "mm", "step": 0.5, "group": "Features"},
    )

    @model_validator(mode="after")
    def _validate_plate(self) -> Self:
        shortest_side = min(self.width_mm, self.depth_mm)
        if self.corner_radius_mm > 0.0 and self.corner_radius_mm >= shortest_side / 2.0:
            raise ValueError(
                f"corner_radius_mm ({self.corner_radius_mm}) must stay below half the "
                f"shortest side ({shortest_side / 2.0})"
            )
        if 0.0 < shortest_side <= self.center_hole_diameter_mm:
            raise ValueError(
                f"center_hole_diameter_mm ({self.center_hole_diameter_mm}) does not "
                f"fit inside the {shortest_side} mm side"
            )
        return self


ComponentSpec = Annotated[
    PipeSpec | ElbowSpec | FlangeSpec | PlateSpec,
    Field(discriminator="kind"),
]
"""Tagged union of every buildable component, discriminated on ``kind``."""

SPEC_BY_KIND: dict[ComponentKind, type[_BaseSpec]] = {
    ComponentKind.PIPE: PipeSpec,
    ComponentKind.ELBOW: ElbowSpec,
    ComponentKind.FLANGE: FlangeSpec,
    ComponentKind.PLATE: PlateSpec,
}
