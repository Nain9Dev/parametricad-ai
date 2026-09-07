"""The result envelope returned by the generation pipeline."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from app.domain.geometry.quality import MeshQualityReport
from app.domain.models.artifacts import ArtifactRef, ExportFormat
from app.domain.models.specs import ComponentSpec

__all__ = ["GeneratedModel", "GenerationTimings", "SolidProperties"]


class GenerationTimings(BaseModel):
    """Wall-clock cost of each pipeline stage, in milliseconds.

    Surfaced to the client so a slow request can be attributed to the kernel,
    the tessellation or the quality gate without server-side profiling.
    """

    model_config = ConfigDict(frozen=True)

    build_ms: float = Field(ge=0.0)
    tessellate_ms: float = Field(ge=0.0)
    inspect_ms: float = Field(ge=0.0)
    export_ms: float = Field(ge=0.0)
    total_ms: float = Field(ge=0.0)


class SolidProperties(BaseModel):
    """Exact mass properties taken from the B-Rep, not from the mesh."""

    model_config = ConfigDict(frozen=True)

    volume_mm3: float = Field(ge=0.0)
    surface_area_mm2: float = Field(ge=0.0)
    mass_g: float = Field(
        ge=0.0, description="Volume times the nominal density of the selected material."
    )
    density_g_cm3: float = Field(gt=0.0)


class GeneratedModel(BaseModel):
    """Everything produced for one accepted specification."""

    model_config = ConfigDict(frozen=True)

    model_id: str = Field(
        description=(
            "Content address derived from the specification and the tessellation "
            "settings. Identical inputs always yield the same id, so a client can "
            "cache on it and the server can skip regeneration entirely."
        )
    )
    spec: ComponentSpec
    properties: SolidProperties
    quality: MeshQualityReport
    artifacts: dict[ExportFormat, ArtifactRef]
    timings: GenerationTimings
    cached: bool = Field(
        default=False,
        description="True when the artifacts were served from a previous identical build.",
    )

    @property
    def primary_artifact(self) -> ArtifactRef | None:
        """The artifact the 3D viewer should load."""
        return self.artifacts.get(ExportFormat.GLB)
