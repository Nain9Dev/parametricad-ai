"""Discretisation settings for turning an exact solid into a triangle mesh."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

__all__ = ["TessellationSettings"]


class TessellationSettings(BaseModel):
    """Controls the fidelity of the B-Rep to mesh conversion.

    Both deflections are absolute kernel inputs, which is what makes the result
    reproducible: the same solid and the same settings always yield the same
    triangles, and therefore the same content hash.
    """

    model_config = ConfigDict(frozen=True, extra="forbid")

    linear_deflection_mm: float = Field(
        default=0.05,
        gt=0.0,
        le=10.0,
        description=(
            "Largest allowed gap between a curved face and its chordal "
            "approximation. Smaller values mean more triangles."
        ),
    )
    angular_deflection_rad: float = Field(
        default=0.15,
        gt=0.0,
        le=1.5,
        description="Largest allowed angle between adjacent facet normals.",
    )
    weld_tolerance_mm: float = Field(
        default=1e-6,
        gt=0.0,
        le=1.0,
        description=(
            "Distance under which coincident vertices from adjacent faces are "
            "merged. Without welding, a kernel tessellation is never watertight."
        ),
    )

    def cache_key(self) -> str:
        """Short, stable encoding folded into the artifact content address."""
        return (
            f"{self.linear_deflection_mm:.9g}"
            f":{self.angular_deflection_rad:.9g}"
            f":{self.weld_tolerance_mm:.9g}"
        )
