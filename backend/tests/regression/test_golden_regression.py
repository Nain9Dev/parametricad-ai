"""Golden model regression testing against reference specification matrix."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from app.domain.geometry.runner.base import ValidationContext
from app.domain.geometry.runner.registry import get_default_registry
from app.domain.geometry.runner.runner import ValidationRunner
from app.domain.geometry.runner.types import CheckStatus
from app.domain.geometry.tessellation import TessellationSettings
from app.infrastructure.cad.cadquery_kernel import CadQueryKernel
from tests.conftest import make_spec

pytestmark = [pytest.mark.req("REQ-EVT-01"), pytest.mark.kernel]

_GOLDEN_SPECS_PATH = Path(__file__).parent / "golden_specs.json"


def load_golden_specs() -> list[dict[str, Any]]:
    with _GOLDEN_SPECS_PATH.open(encoding="utf-8") as f:
        data: list[dict[str, Any]] = json.load(f)
        return data


class TestGoldenModelRegression:
    @pytest.mark.parametrize(
        "entry",
        load_golden_specs(),
        ids=lambda e: str(e["name"]),
    )
    def test_golden_model_passes_c1_c10_validation(
        self,
        kernel: CadQueryKernel,
        tessellation: TessellationSettings,
        entry: dict[str, Any],
    ) -> None:
        spec = make_spec(**entry["spec"])
        solid = kernel.build(spec)
        assert solid.volume_mm3 > 0.0
        assert solid.surface_area_mm2 > 0.0

        mesh = kernel.tessellate(solid, tessellation)
        assert mesh.vertex_count > 0
        assert mesh.triangle_count > 0

        runner = ValidationRunner(registry=get_default_registry())
        context = ValidationContext(reference_volume_mm3=solid.volume_mm3)
        report = runner.run(
            mesh,
            context=context,
            model_id=f"golden-{spec.kind}",
        )

        assert report.verdict in (CheckStatus.PASS, CheckStatus.WARN)
        for check in report.checks:
            if check.is_blocking:
                assert check.status is CheckStatus.PASS, (
                    f"Check {check.check_id} failed: {check.message}"
                )
