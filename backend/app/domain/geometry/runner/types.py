"""Domain types for the modular geometric validation runner."""

from __future__ import annotations

from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

__all__ = [
    "CheckId",
    "CheckResult",
    "CheckStatus",
    "DualContractReport",
]


class CheckId(StrEnum):
    """Canonical geometric check spectrum (C1-C10)."""

    C1_STRUCTURE_INTEGRITY = "C1"
    C2_DEGENERATE_GEOMETRY = "C2"
    C3_MANIFOLD_TOPOLOGY = "C3"
    C4_WATERTIGHTNESS = "C4"
    C5_NORMAL_ORIENTATION = "C5"
    C6_SELF_INTERSECTION = "C6"
    C7_ASPECT_RATIO = "C7"
    C8_BOUNDING_BOX = "C8"
    C9_VOLUME_DIVERGENCE = "C9"
    C10_MASS_INERTIA = "C10"


class CheckStatus(StrEnum):
    """Evaluation verdict for an individual check or overall model."""

    PASS = "PASS"
    WARN = "WARN"
    FAIL = "FAIL"
    SKIP = "SKIP"


class CheckResult(BaseModel):
    """Structured outcome of evaluating one check against a mesh."""

    model_config = ConfigDict(frozen=True)

    check_id: CheckId
    name: str
    status: CheckStatus
    message: str
    is_blocking: bool = True
    metrics: dict[str, Any] = Field(default_factory=dict)
    execution_ms: float = 0.0


class DualContractReport(BaseModel):
    """Canonical machine-readable technical audit report.

    Exported alongside 3D formats as validation_report.json.
    """

    model_config = ConfigDict(frozen=True)

    model_id: str
    verdict: CheckStatus
    checks: list[CheckResult]
    summary_metrics: dict[str, Any] = Field(default_factory=dict)
    total_duration_ms: float
