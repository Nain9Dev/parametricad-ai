"""Machine-readable description of everything the engine can build.

The frontend renders its parameter form from this document rather than from a
hardcoded list, so adding a field to a specification -- or tightening a limit --
reaches the UI without a frontend change. The descriptors are derived from the
Pydantic JSON Schema, which keeps them honest: a control can only appear if the
backend really accepts that field.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.domain.geometry.tessellation import TessellationSettings
from app.domain.models.artifacts import FORMAT_DESCRIPTORS, ExportFormat
from app.domain.models.specs import (
    MATERIAL_DENSITY_G_CM3,
    SPEC_BY_KIND,
    ComponentKind,
)

__all__ = ["Catalog", "ComponentDescriptor", "ParameterDescriptor", "build_catalog"]

ParameterType = Literal["number", "integer", "enum"]

_DISCRIMINATOR_FIELD = "kind"
_UNIT_SUFFIXES = ("_mm", "_deg", "_g", "_mm3", "_mm2")

_COMPONENT_LABELS: dict[ComponentKind, str] = {
    ComponentKind.PIPE: "Pipe",
    ComponentKind.ELBOW: "Elbow",
    ComponentKind.FLANGE: "Flange",
    ComponentKind.PLATE: "Plate",
}


class ParameterOption(BaseModel):
    """One choice of an enumerated parameter."""

    model_config = ConfigDict(frozen=True)

    value: str
    label: str


class ParameterDescriptor(BaseModel):
    """Everything a client needs to render and validate one input control."""

    model_config = ConfigDict(frozen=True)

    name: str
    label: str
    type: ParameterType
    group: str = "Geometry"
    description: str | None = None
    unit: str | None = None
    default: Any = None
    minimum: float | None = None
    maximum: float | None = None
    exclusive_minimum: bool = Field(
        default=False,
        description="True when the minimum is a strict bound, as for a positive length.",
    )
    step: float | None = None
    options: tuple[ParameterOption, ...] = ()


class ComponentDescriptor(BaseModel):
    """A buildable component family and its parameters."""

    model_config = ConfigDict(frozen=True)

    kind: ComponentKind
    label: str
    description: str
    parameters: tuple[ParameterDescriptor, ...]


class FormatDescriptorView(BaseModel):
    """An export format as presented to a client."""

    model_config = ConfigDict(frozen=True)

    format: ExportFormat
    label: str
    description: str
    extension: str
    media_type: str
    source: str


class Catalog(BaseModel):
    """The complete capability document."""

    model_config = ConfigDict(frozen=True)

    components: tuple[ComponentDescriptor, ...]
    materials: tuple[ParameterOption, ...]
    formats: tuple[FormatDescriptorView, ...]
    tessellation: TessellationSettings


def _humanise(name: str) -> str:
    """``outer_diameter_mm`` becomes ``Outer diameter``."""
    for suffix in _UNIT_SUFFIXES:
        if name.endswith(suffix):
            name = name[: -len(suffix)]
            break
    words = name.replace("_", " ").strip()
    return words[:1].upper() + words[1:]


def _humanise_enum(value: str) -> str:
    return value.replace("_", " ").title()


def _describe_parameter(
    name: str, schema: dict[str, Any], definitions: dict[str, Any]
) -> ParameterDescriptor | None:
    """Translate one JSON Schema property into a UI control descriptor."""
    reference = schema.get("$ref")
    if reference is not None:
        definition = definitions.get(reference.rsplit("/", 1)[-1], {})
        if "enum" not in definition:
            return None
        return ParameterDescriptor(
            name=name,
            label=_humanise(name),
            type="enum",
            group=schema.get("group", "Material"),
            description=schema.get("description"),
            default=schema.get("default"),
            options=tuple(
                ParameterOption(value=value, label=_humanise_enum(value))
                for value in definition["enum"]
            ),
        )

    json_type = schema.get("type")
    if json_type not in {"number", "integer"}:
        return None

    minimum = schema.get("minimum")
    exclusive = schema.get("exclusiveMinimum")
    return ParameterDescriptor(
        name=name,
        label=_humanise(name),
        type="integer" if json_type == "integer" else "number",
        group=schema.get("group", "Geometry"),
        description=schema.get("description"),
        unit=schema.get("unit"),
        default=schema.get("default"),
        minimum=exclusive if exclusive is not None else minimum,
        maximum=schema.get("maximum"),
        exclusive_minimum=exclusive is not None,
        step=schema.get("step"),
    )


def _describe_component(kind: ComponentKind) -> ComponentDescriptor:
    model = SPEC_BY_KIND[kind]
    schema = model.model_json_schema()
    definitions = schema.get("$defs", {})

    parameters = [
        descriptor
        for name, property_schema in schema.get("properties", {}).items()
        if name != _DISCRIMINATOR_FIELD
        for descriptor in (_describe_parameter(name, property_schema, definitions),)
        if descriptor is not None
    ]

    summary = (schema.get("description") or "").split("\n", 1)[0]
    return ComponentDescriptor(
        kind=kind,
        label=_COMPONENT_LABELS[kind],
        description=summary,
        parameters=tuple(parameters),
    )


def build_catalog(tessellation: TessellationSettings | None = None) -> Catalog:
    """Assemble the capability document served to clients."""
    return Catalog(
        components=tuple(_describe_component(kind) for kind in ComponentKind),
        materials=tuple(
            ParameterOption(
                value=material.value,
                label=f"{_humanise_enum(material.value)} ({density:g} g/cm3)",
            )
            for material, density in MATERIAL_DENSITY_G_CM3.items()
        ),
        formats=tuple(
            FormatDescriptorView(
                format=descriptor.format,
                label=descriptor.label,
                description=descriptor.description,
                extension=descriptor.extension,
                media_type=descriptor.media_type,
                source=descriptor.source.value,
            )
            for descriptor in FORMAT_DESCRIPTORS.values()
        ),
        tessellation=tessellation or TessellationSettings(),
    )
