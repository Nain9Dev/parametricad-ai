"""Pipeline orchestration, exercised against fakes rather than the real kernel."""

from __future__ import annotations

import threading
from pathlib import Path

import numpy as np
import pytest

from app.application.services.model_generation_service import ModelGenerationService
from app.domain.errors import CapacityExhaustedError, MeshQualityRejectedError
from app.domain.geometry.mesh import TriangleMesh
from app.domain.geometry.quality import MeshQualityReport, inspect_mesh
from app.domain.geometry.tessellation import TessellationSettings
from app.domain.models.artifacts import ExportFormat
from app.domain.models.specs import ComponentSpec
from app.domain.ports.geometry_kernel import BuiltSolid
from app.domain.ports.mesh_inspector import MeshInspectorPort
from app.infrastructure.mesh.trimesh_exporter import TrimeshExporter
from app.infrastructure.storage.filesystem_storage import FilesystemArtifactStorage
from tests.conftest import axis_aligned_box, make_spec


class FakeKernel:
    """A kernel that returns a fixed box and counts how often it is asked."""

    def __init__(self, mesh: TriangleMesh | None = None) -> None:
        self.mesh = mesh or axis_aligned_box(10.0)
        self.build_calls = 0
        self.export_calls = 0

    def build(self, spec: ComponentSpec) -> BuiltSolid:
        self.build_calls += 1
        return BuiltSolid(
            handle=object(), kernel="fake", volume_mm3=1000.0, surface_area_mm2=600.0
        )

    def tessellate(self, solid: BuiltSolid, settings: TessellationSettings) -> TriangleMesh:
        return self.mesh

    def export(self, solid: BuiltSolid, export_format: ExportFormat) -> bytes:
        self.export_calls += 1
        return b"ISO-10303-21;"


class PassingInspector:
    def inspect(
        self, mesh: TriangleMesh, *, reference_volume_mm3: float | None = None
    ) -> MeshQualityReport:
        return inspect_mesh(mesh, reference_volume_mm3=reference_volume_mm3)


class FailingInspector:
    """Reports a broken mesh regardless of what it is given."""

    def inspect(
        self, mesh: TriangleMesh, *, reference_volume_mm3: float | None = None
    ) -> MeshQualityReport:
        broken = TriangleMesh(mesh.vertices, mesh.faces[:-1])
        return inspect_mesh(broken)


def build_service(
    tmp_path: Path,
    *,
    kernel: FakeKernel | None = None,
    inspector: MeshInspectorPort | None = None,
    reject_invalid: bool = True,
    max_concurrency: int = 1,
    acquire_timeout_s: float = 30.0,
    cache_size: int = 128,
    formats: list[ExportFormat] | None = None,
) -> tuple[ModelGenerationService, FakeKernel]:
    fake_kernel = kernel or FakeKernel()
    service = ModelGenerationService(
        kernel=fake_kernel,
        inspector=inspector or PassingInspector(),
        mesh_exporter=TrimeshExporter(),
        storage=FilesystemArtifactStorage(tmp_path, url_prefix="/static/models"),
        tessellation=TessellationSettings(),
        default_formats=formats or [ExportFormat.GLB],
        reject_invalid_meshes=reject_invalid,
        max_concurrency=max_concurrency,
        acquire_timeout_s=acquire_timeout_s,
        cache_size=cache_size,
    )
    return service, fake_kernel


class TestContentAddressing:
    pytestmark = pytest.mark.req("REQ-UBI-01")

    def test_the_same_spec_maps_to_the_same_id(self, tmp_path: Path) -> None:
        service, _ = build_service(tmp_path)
        first = make_spec(kind="pipe", outer_diameter_mm=25, length_mm=100)
        second = make_spec(kind="pipe", length_mm=100, outer_diameter_mm=25.0)
        assert service.model_id_for(first) == service.model_id_for(second)

    def test_different_specs_map_to_different_ids(self, tmp_path: Path) -> None:
        service, _ = build_service(tmp_path)
        assert service.model_id_for(make_spec(kind="pipe")) != service.model_id_for(
            make_spec(kind="plate")
        )

    def test_tessellation_settings_are_part_of_the_address(self, tmp_path: Path) -> None:
        coarse, _ = build_service(tmp_path)
        fine = ModelGenerationService(
            kernel=FakeKernel(),
            inspector=PassingInspector(),
            mesh_exporter=TrimeshExporter(),
            storage=FilesystemArtifactStorage(tmp_path, url_prefix="/static/models"),
            tessellation=TessellationSettings(linear_deflection_mm=0.01),
            default_formats=[ExportFormat.GLB],
        )
        spec = make_spec(kind="pipe")
        assert coarse.model_id_for(spec) != fine.model_id_for(spec)

    def test_the_id_is_a_filesystem_safe_digest(self, tmp_path: Path) -> None:
        service, _ = build_service(tmp_path)
        model_id = service.model_id_for(make_spec(kind="pipe"))
        assert len(model_id) == 32
        assert model_id.isalnum() and model_id.islower()


class TestCaching:
    pytestmark = pytest.mark.req("REQ-EVT-03")

    def test_a_repeat_request_does_not_rebuild(self, tmp_path: Path) -> None:
        service, kernel = build_service(tmp_path)
        spec = make_spec(kind="pipe")

        first = service.generate(spec)
        second = service.generate(spec)

        assert kernel.build_calls == 1
        assert first.cached is False
        assert second.cached is True
        assert second.model_id == first.model_id

    def test_a_different_spec_rebuilds(self, tmp_path: Path) -> None:
        service, kernel = build_service(tmp_path)
        service.generate(make_spec(kind="pipe", length_mm=100))
        service.generate(make_spec(kind="pipe", length_mm=200))
        assert kernel.build_calls == 2

    def test_a_pruned_artifact_forces_a_rebuild(self, tmp_path: Path) -> None:
        service, kernel = build_service(tmp_path)
        spec = make_spec(kind="pipe")
        result = service.generate(spec)

        (tmp_path / result.artifacts[ExportFormat.GLB].filename).unlink()
        service.generate(spec)

        assert kernel.build_calls == 2

    def test_requesting_a_new_format_rebuilds(self, tmp_path: Path) -> None:
        service, kernel = build_service(tmp_path)
        spec = make_spec(kind="pipe")
        service.generate(spec, [ExportFormat.GLB])
        service.generate(spec, [ExportFormat.GLB, ExportFormat.STEP])
        assert kernel.build_calls == 2

    def test_caching_can_be_switched_off(self, tmp_path: Path) -> None:
        service, kernel = build_service(tmp_path, cache_size=0)
        spec = make_spec(kind="pipe")
        service.generate(spec)
        service.generate(spec)
        assert kernel.build_calls == 2


class TestQualityGate:
    pytestmark = pytest.mark.req("REQ-STA-02")

    def test_an_invalid_mesh_is_not_published(self, tmp_path: Path) -> None:
        service, _ = build_service(tmp_path, inspector=FailingInspector())
        with pytest.raises(MeshQualityRejectedError) as raised:
            service.generate(make_spec(kind="pipe"))

        assert raised.value.details["kind"] == "pipe"
        assert raised.value.details["issues"]
        assert not list(tmp_path.glob("*.glb"))

    def test_the_gate_can_be_relaxed(self, tmp_path: Path) -> None:
        service, _ = build_service(
            tmp_path, inspector=FailingInspector(), reject_invalid=False
        )
        result = service.generate(make_spec(kind="pipe"))
        assert result.quality.status.value == "invalid"
        assert ExportFormat.GLB in result.artifacts


class TestExportRouting:
    pytestmark = pytest.mark.req("REQ-EVT-01")

    def test_brep_formats_go_to_the_kernel_and_mesh_formats_do_not(
        self, tmp_path: Path
    ) -> None:
        service, kernel = build_service(
            tmp_path, formats=[ExportFormat.GLB, ExportFormat.STL, ExportFormat.STEP]
        )
        result = service.generate(make_spec(kind="pipe"))

        assert kernel.export_calls == 1
        assert set(result.artifacts) == {
            ExportFormat.GLB,
            ExportFormat.STL,
            ExportFormat.STEP,
        }

    def test_duplicate_requested_formats_are_collapsed(self, tmp_path: Path) -> None:
        service, _ = build_service(tmp_path)
        result = service.generate(
            make_spec(kind="pipe"), [ExportFormat.GLB, ExportFormat.GLB]
        )
        assert list(result.artifacts) == [ExportFormat.GLB]


class TestReportedProperties:
    pytestmark = pytest.mark.req("REQ-UBI-06")

    def test_mass_uses_the_exact_kernel_volume(self, tmp_path: Path) -> None:
        service, _ = build_service(tmp_path)
        spec = make_spec(kind="pipe", material="aluminium")
        result = service.generate(spec)

        assert result.properties.volume_mm3 == 1000.0
        assert result.properties.density_g_cm3 == pytest.approx(2.70)
        assert result.properties.mass_g == pytest.approx(2.70)

    def test_every_stage_is_timed(self, tmp_path: Path) -> None:
        service, _ = build_service(tmp_path)
        timings = service.generate(make_spec(kind="pipe")).timings
        for stage in (
            timings.build_ms,
            timings.tessellate_ms,
            timings.inspect_ms,
            timings.export_ms,
        ):
            assert stage >= 0.0
        assert timings.total_ms >= 0.0


class TestCapacity:
    pytestmark = pytest.mark.req("REQ-UNW-02")

    def test_a_saturated_engine_reports_a_retryable_failure(self, tmp_path: Path) -> None:
        service, _ = build_service(tmp_path, max_concurrency=1, acquire_timeout_s=0.05)
        released = threading.Event()

        def hold() -> None:
            service._slots.acquire()  # noqa: SLF001 - deliberately simulating saturation
            released.wait(timeout=5)
            service._slots.release()  # noqa: SLF001

        worker = threading.Thread(target=hold)
        worker.start()
        try:
            with pytest.raises(CapacityExhaustedError, match="busy"):
                service.generate(make_spec(kind="pipe"))
        finally:
            released.set()
            worker.join()


class TestArtifactIntegrity:
    pytestmark = pytest.mark.req("REQ-UBI-07")

    def test_the_digest_matches_the_stored_bytes(self, tmp_path: Path) -> None:
        import hashlib

        service, _ = build_service(tmp_path)
        result = service.generate(make_spec(kind="pipe"))
        reference = result.artifacts[ExportFormat.GLB]

        payload = (tmp_path / reference.filename).read_bytes()
        assert hashlib.sha256(payload).hexdigest() == reference.sha256
        assert len(payload) == reference.size_bytes

    def test_identical_meshes_export_to_identical_bytes(self, tmp_path: Path) -> None:
        """Mesh artifacts are reproducible, which is what makes the digest useful."""
        exporter = TrimeshExporter()
        mesh = axis_aligned_box(3.0)
        first = exporter.export(mesh, ExportFormat.GLB, metadata={"model_id": "x"})
        second = exporter.export(mesh, ExportFormat.GLB, metadata={"model_id": "x"})
        assert first == second

    def test_the_mesh_is_not_reprocessed_on_export(self, tmp_path: Path) -> None:
        """A mesh with a stray vertex must survive export exactly as inspected."""
        base = axis_aligned_box(2.0)
        padded = TriangleMesh(np.vstack([base.vertices, [[9.0, 9.0, 9.0]]]), base.faces)
        payload = TrimeshExporter().export(padded, ExportFormat.STL)
        assert len(payload) == 84 + 50 * padded.triangle_count
