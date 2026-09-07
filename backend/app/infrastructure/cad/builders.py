"""CadQuery construction recipes, one per component family.

Each builder is a pure function of its specification: same input, same solid.
Nothing here reads configuration or touches the filesystem, which keeps the
recipes directly testable against closed-form volume formulas.

Orientation conventions shared by every recipe:

* the part is modelled in millimetres;
* prismatic parts extrude along +Z;
* the elbow bends in the XY plane about the Z axis, with its inlet face at
  ``(bend_radius, 0, 0)`` looking down -Y.
"""

from __future__ import annotations

from collections.abc import Callable

import cadquery as cq

from app.domain.models.specs import (
    ComponentKind,
    ComponentSpec,
    ElbowSpec,
    FlangeSpec,
    PipeSpec,
    PlateSpec,
)

__all__ = ["BUILDERS", "build_shape"]


def _build_pipe(spec: PipeSpec) -> cq.Shape:
    outer_radius = spec.outer_diameter_mm / 2.0
    inner_radius = outer_radius - spec.wall_thickness_mm
    return (
        cq.Workplane("XY")
        .circle(outer_radius)
        .circle(inner_radius)
        .extrude(spec.length_mm)
        .val()
    )


def _elbow_profile(spec: ElbowSpec) -> cq.Workplane:
    """Annular cross-section positioned on the bend radius, in the XZ plane."""
    outer_radius = spec.outer_diameter_mm / 2.0
    inner_radius = outer_radius - spec.wall_thickness_mm
    return (
        cq.Workplane("XZ")
        .moveTo(spec.bend_radius_mm, 0)
        .circle(outer_radius)
        .circle(inner_radius)
    )


def _build_elbow(spec: ElbowSpec) -> cq.Shape:
    # The revolve axis is expressed in workplane-local coordinates; on the XZ
    # plane the local +Y direction is the global +Z axis.
    bend = _elbow_profile(spec).revolve(spec.bend_angle_deg, (0, 0, 0), (0, 1, 0)).val()

    if spec.leg_length_mm <= 0.0:
        return bend

    # A positive extrusion leaves the bend at the inlet; the outlet leg is the
    # mirror extrusion rotated onto the far end of the sweep.
    inlet = _elbow_profile(spec).extrude(spec.leg_length_mm).val()
    outlet = (
        _elbow_profile(spec)
        .extrude(-spec.leg_length_mm)
        .val()
        .rotate(cq.Vector(0, 0, 0), cq.Vector(0, 0, 1), spec.bend_angle_deg)
    )
    return bend.fuse(inlet).fuse(outlet).clean()


def _build_flange(spec: FlangeSpec) -> cq.Shape:
    result = (
        cq.Workplane("XY")
        .circle(spec.outer_diameter_mm / 2.0)
        .extrude(spec.thickness_mm)
        .faces(">Z")
        .workplane()
        .circle(spec.bore_diameter_mm / 2.0)
        .cutThruAll()
    )

    if spec.has_bolt_pattern:
        result = (
            result.faces(">Z")
            .workplane()
            .polarArray(
                radius=spec.bolt_circle_diameter_mm / 2.0,
                startAngle=0,
                angle=360,
                count=spec.bolt_hole_count,
            )
            .circle(spec.bolt_hole_diameter_mm / 2.0)
            .cutThruAll()
        )
    return result.val()


def _build_plate(spec: PlateSpec) -> cq.Shape:
    result = cq.Workplane("XY").box(spec.width_mm, spec.depth_mm, spec.thickness_mm)

    if spec.corner_radius_mm > 0.0:
        result = result.edges("|Z").fillet(spec.corner_radius_mm)
    if spec.center_hole_diameter_mm > 0.0:
        result = result.faces(">Z").workplane().hole(spec.center_hole_diameter_mm)
    return result.val()


BUILDERS: dict[ComponentKind, Callable[..., cq.Shape]] = {
    ComponentKind.PIPE: _build_pipe,
    ComponentKind.ELBOW: _build_elbow,
    ComponentKind.FLANGE: _build_flange,
    ComponentKind.PLATE: _build_plate,
}


def build_shape(spec: ComponentSpec) -> cq.Shape:
    """Dispatch ``spec`` to its construction recipe.

    A missing entry is a programming error rather than a user error: the spec
    union and this registry are meant to stay in lockstep.
    """
    try:
        builder = BUILDERS[spec.kind]
    except KeyError as exc:  # pragma: no cover - guarded by the discriminated union
        raise NotImplementedError(f"no builder registered for {spec.kind}") from exc
    return builder(spec)
