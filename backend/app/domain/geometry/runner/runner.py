"""Validation runner orchestrating check execution and dual-contract reporting."""

from __future__ import annotations

import time

from app.domain.geometry.mesh import TriangleMesh
from app.domain.geometry.runner.base import ValidationContext
from app.domain.geometry.runner.registry import CheckRegistry, get_default_registry
from app.domain.geometry.runner.types import (
    CheckResult,
    CheckStatus,
    DualContractReport,
)

__all__ = ["ValidationContext", "ValidationRunner"]


class ValidationRunner:
    """Orchestrates deterministic execution of registered validation checks."""

    def __init__(self, registry: CheckRegistry | None = None) -> None:
        self._registry = registry or get_default_registry()

    def run(
        self,
        mesh: TriangleMesh,
        context: ValidationContext | None = None,
        model_id: str = "unassigned",
        fail_closed: bool = True,
    ) -> DualContractReport:
        """Run all registered checks and return a dual-contract report.

        In fail_closed mode, any failing blocking check sets the overall verdict to FAIL.
        """
        ctx = context or ValidationContext()
        start_total = time.perf_counter()
        results: list[CheckResult] = []
        overall_status = CheckStatus.PASS

        for check in self._registry.all_checks():
            result = check.evaluate(mesh, ctx)
            results.append(result)

            if result.status is CheckStatus.FAIL:
                if check.is_blocking or fail_closed:
                    overall_status = CheckStatus.FAIL
            elif result.status is CheckStatus.WARN and overall_status is not CheckStatus.FAIL:
                overall_status = CheckStatus.WARN

        duration = (time.perf_counter() - start_total) * 1000.0

        summary_metrics = {
            "vertices": mesh.vertex_count,
            "faces": mesh.triangle_count,
            "status": overall_status,
        }
        if ctx.reference_volume_mm3 is not None:
            summary_metrics["reference_volume_mm3"] = ctx.reference_volume_mm3

        return DualContractReport(
            model_id=model_id,
            verdict=overall_status,
            checks=results,
            summary_metrics=summary_metrics,
            total_duration_ms=duration,
        )
