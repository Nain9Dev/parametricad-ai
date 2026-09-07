"""Export formats and references to persisted artifacts."""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field

__all__ = [
    "ArtifactRef",
    "ArtifactSource",
    "ExportFormat",
    "FORMAT_DESCRIPTORS",
    "FormatDescriptor",
]


class ExportFormat(StrEnum):
    """Artifact formats the engine can emit."""

    GLB = "glb"
    GLTF = "gltf"
    STL = "stl"
    STEP = "step"
    DXF = "dxf"


class ArtifactSource(StrEnum):
    """Which representation an export is derived from.

    Mesh formats are written from the tessellated triangle mesh and inherit its
    deflection error. B-Rep formats are written from the exact kernel solid and
    carry full analytic precision, which is why STEP is the format to hand to a
    downstream CAD system.
    """

    MESH = "mesh"
    BREP = "brep"


@dataclass(frozen=True, slots=True)
class FormatDescriptor:
    """Static metadata describing one export format."""

    format: ExportFormat
    extension: str
    media_type: str
    source: ArtifactSource
    label: str
    description: str


FORMAT_DESCRIPTORS: dict[ExportFormat, FormatDescriptor] = {
    ExportFormat.GLB: FormatDescriptor(
        format=ExportFormat.GLB,
        extension="glb",
        media_type="model/gltf-binary",
        source=ArtifactSource.MESH,
        label="glTF binary",
        description="Single-file mesh for the web viewer.",
    ),
    ExportFormat.GLTF: FormatDescriptor(
        format=ExportFormat.GLTF,
        extension="gltf",
        media_type="model/gltf+json",
        source=ArtifactSource.MESH,
        label="glTF",
        description="JSON mesh with embedded buffers.",
    ),
    ExportFormat.STL: FormatDescriptor(
        format=ExportFormat.STL,
        extension="stl",
        media_type="model/stl",
        source=ArtifactSource.MESH,
        label="STL",
        description="Binary triangle mesh for additive manufacturing.",
    ),
    ExportFormat.STEP: FormatDescriptor(
        format=ExportFormat.STEP,
        extension="step",
        media_type="model/step",
        source=ArtifactSource.BREP,
        label="STEP AP214",
        description="Exact boundary representation for downstream CAD.",
    ),
    ExportFormat.DXF: FormatDescriptor(
        format=ExportFormat.DXF,
        extension="dxf",
        media_type="image/vnd.dxf",
        source=ArtifactSource.BREP,
        label="DXF section",
        description="2D cross-section through the part, for drawings and cutting.",
    ),
}


class ArtifactRef(BaseModel):
    """A persisted artifact and everything a client needs to fetch or verify it."""

    model_config = ConfigDict(frozen=True)

    format: ExportFormat
    filename: str
    url: str = Field(description="Path relative to the API origin.")
    media_type: str
    size_bytes: int = Field(ge=0)
    sha256: str = Field(
        min_length=64,
        max_length=64,
        description="Digest of the artifact bytes, for integrity checks and caching.",
    )
    source: ArtifactSource
