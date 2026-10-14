"""Pipeline budget semantics: the limit bounds pipelines, not kernel calls.

Per ADR-0004 the OpenCASCADE kernel stays single-flight per process, while
``kernel_max_concurrency`` sets how many model pipelines may be in flight. The
budget is consumed at the pipeline boundary, so a denied request never reaches
the kernel itself.
"""

from __future__ import annotations

import threading
from pathlib import Path

import pytest

from app.application.services.model_generation_service import ModelGenerationService
from app.domain.errors import CapacityExhaustedError
from app.domain.geometry.mesh import TriangleMesh
from app.domain.geometry.quality import MeshQualityReport, inspect_mesh
from app.domain.geometry.tessellation import TessellationSettings
from app.domain.models.artifacts import ArtifactRef, ExportFormat
from app.domain.models.specs import ComponentSpec, PipeSpec
from app.domain.ports.geometry_kernel import BuiltSolid
from app.infrastructure.mesh.trimesh_exporter import TrimeshExporter
from app.infrastructure.storage.filesystem_storage import FilesystemArtifactStorage
from tests.conftest import axis_aligned_box, make_spec


class FakeKernel:
    """Kernel that pauses inside ``build``, counting concurrent executions."""

    def __init__(self, mesh: TriangleMesh | None = None) -> None:
        self.mesh = mesh or axis_aligned_box(10.0)
        self.build_calls = 0
        self.export_calls = 0
        self.max_concurrent_builds = 0
        self.build_entered = threading.Event()
        self.build_gate = threading.Event()
        self._in_build = 0
        self._lock = threading.Lock()

    def build(self, spec: ComponentSpec) -> BuiltSolid:
        with self._lock:
            self.build_calls += 1
            self._in_build += 1
            self.max_concurrent_builds = max(self.max_concurrent_builds, self._in_build)
        self.build_entered.set()
        try:
            self.build_gate.wait(timeout=5)
            return BuiltSolid(
                handle=object(), kernel="fake", volume_mm3=1000.0, surface_area_mm2=600.0
            )
        finally:
            with self._lock:
                self._in_build -= 1

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


def build_service(
    tmp_path: Path,
    *,
    kernel: FakeKernel | None = None,
    max_concurrency: int = 1,
    acquire_timeout_s: float = 30.0,
) -> ModelGenerationService:
    return ModelGenerationService(
        kernel=kernel or FakeKernel(),
        inspector=PassingInspector(),
        mesh_exporter=TrimeshExporter(),
        storage=FilesystemArtifactStorage(tmp_path, url_prefix="/static/models"),
        tessellation=TessellationSettings(),
        default_formats=[ExportFormat.GLB],
        max_concurrency=max_concurrency,
        acquire_timeout_s=acquire_timeout_s,
    )


class TestPipelineBudget:
    """TSK-14b (T6): kernel_max_concurrency budgets pipelines, not the kernel."""

    pytestmark = pytest.mark.req("REQ-UNW-02")

    def test_concurrency_bounds_pipelines_not_kernel_calls(self, tmp_path: Path) -> None:
        kernel = FakeKernel()
        service = build_service(
            tmp_path, kernel=kernel, max_concurrency=1, acquire_timeout_s=0.05
        )
        completed: list[object] = []

        def first_pipeline() -> None:
            completed.append(service.generate(make_spec(kind="pipe", length_mm=100)))

        worker = threading.Thread(target=first_pipeline)
        worker.start()
        try:
            assert kernel.build_entered.wait(timeout=5)  # the pipeline holds its slot

            # The only pipeline slot is taken, so the second pipeline must be
            # rejected at the boundary, before any kernel call is made.
            with pytest.raises(CapacityExhaustedError, match="busy"):
                service.generate(make_spec(kind="pipe", length_mm=200))
        finally:
            kernel.build_gate.set()
            worker.join(timeout=5)

        assert kernel.build_calls == 1  # the denied pipeline never reached the kernel
        assert kernel.max_concurrent_builds == 1
        assert len(completed) == 1

    def test_export_overlaps_next_build(self, tmp_path: Path) -> None:
        """TSK-14b (T7): mesh export and storage save run outside the kernel lock."""
        class PausingStorage(FilesystemArtifactStorage):
            def __init__(self, root: Path) -> None:
                super().__init__(root, url_prefix="/static/models")
                self.save_entered = threading.Event()
                self.save_gate = threading.Event()

            def save(
                self, model_id: str, export_format: ExportFormat, payload: bytes
            ) -> ArtifactRef:
                self.save_entered.set()
                self.save_gate.wait(timeout=5)
                return super().save(model_id, export_format, payload)

        kernel = FakeKernel()
        storage = PausingStorage(tmp_path)
        kernel.build_gate.set()  # let builds proceed without pausing
        service = ModelGenerationService(
            kernel=kernel,
            inspector=PassingInspector(),
            mesh_exporter=TrimeshExporter(),
            storage=storage,
            tessellation=TessellationSettings(),
            default_formats=[ExportFormat.GLB],
            max_concurrency=2,
            acquire_timeout_s=5.0,
        )

        completed: list[object] = []

        def first_pipeline() -> None:
            completed.append(service.generate(make_spec(kind="pipe", length_mm=100)))

        worker = threading.Thread(target=first_pipeline)
        worker.start()
        try:
            assert storage.save_entered.wait(timeout=5)
            # Pipeline 1 is now in export/storage. Pipeline 2 can execute its build.
            second_result = service.generate(make_spec(kind="pipe", length_mm=200))
            assert isinstance(second_result.spec, PipeSpec)
            assert second_result.spec.length_mm == 200
            assert kernel.build_calls == 2
        finally:
            storage.save_gate.set()
            worker.join(timeout=5)

        assert len(completed) == 1

    def test_capacity_gauges_track_acquired_and_released(self, tmp_path: Path) -> None:
        """TSK-14b (T8): capacity gauges report active, pending, and max in-flight slots."""
        kernel = FakeKernel()
        service = build_service(
            tmp_path, kernel=kernel, max_concurrency=1, acquire_timeout_s=5.0
        )

        assert service.capacity.active == 0
        assert service.capacity.pending == 0
        assert service.capacity.max == 1

        def run_pipeline(length: float) -> None:
            service.generate(make_spec(kind="pipe", length_mm=length))

        worker1 = threading.Thread(target=run_pipeline, args=(100.0,))
        worker1.start()
        try:
            assert kernel.build_entered.wait(timeout=5)
            assert service.capacity.active == 1
            assert service.capacity.pending == 0

            worker2 = threading.Thread(target=run_pipeline, args=(200.0,))
            worker2.start()
            try:
                # Wait until worker2 is queued waiting for the slot
                import time
                deadline = time.perf_counter() + 5.0
                while service.capacity.pending < 1 and time.perf_counter() < deadline:
                    time.sleep(0.01)

                assert service.capacity.active == 1
                assert service.capacity.pending == 1
                assert service.capacity.max == 1
            finally:
                kernel.build_gate.set()
                worker1.join(timeout=5)

            worker2.join(timeout=5)
        finally:
            kernel.build_gate.set()

        assert service.capacity.active == 0
        assert service.capacity.pending == 0
        assert service.capacity.max == 1

