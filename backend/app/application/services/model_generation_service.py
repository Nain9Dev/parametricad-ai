"""Orchestration of the build -> tessellate -> inspect -> export pipeline.

This is the only place that knows the order of the stages. It depends purely on
ports, so the same service runs against the real OpenCASCADE kernel in
production and against stubs in a unit test.
"""

from __future__ import annotations

import hashlib
import threading
import time
from collections import OrderedDict
from collections.abc import Sequence

from app import GEOMETRY_ENGINE_REVISION
from app.domain.errors import CapacityExhaustedError, MeshQualityRejectedError
from app.domain.geometry.quality import MeshQualityReport, MeshQualityStatus
from app.domain.geometry.tessellation import TessellationSettings
from app.domain.models.artifacts import (
    FORMAT_DESCRIPTORS,
    ArtifactRef,
    ArtifactSource,
    ExportFormat,
)
from app.domain.models.results import GeneratedModel, GenerationTimings, SolidProperties
from app.domain.models.specs import ComponentSpec
from app.domain.ports.artifact_storage import ArtifactStoragePort
from app.domain.ports.geometry_kernel import GeometryKernelPort
from app.domain.ports.mesh_exporter import MeshExporterPort
from app.domain.ports.mesh_inspector import MeshInspectorPort

__all__ = ["ModelGenerationService"]

_MODEL_ID_LENGTH = 32


class ModelGenerationService:
    """Turns a validated specification into stored, inspected artifacts."""

    def __init__(
        self,
        *,
        kernel: GeometryKernelPort,
        inspector: MeshInspectorPort,
        mesh_exporter: MeshExporterPort,
        storage: ArtifactStoragePort,
        tessellation: TessellationSettings,
        default_formats: Sequence[ExportFormat],
        reject_invalid_meshes: bool = True,
        max_concurrency: int = 1,
        acquire_timeout_s: float = 30.0,
        cache_size: int = 128,
    ) -> None:
        self._kernel = kernel
        self._inspector = inspector
        self._mesh_exporter = mesh_exporter
        self._storage = storage
        self._tessellation = tessellation
        self._default_formats = tuple(default_formats)
        self._reject_invalid_meshes = reject_invalid_meshes
        self._acquire_timeout_s = acquire_timeout_s

        self._slots = threading.BoundedSemaphore(max_concurrency)
        self._cache: OrderedDict[str, GeneratedModel] = OrderedDict()
        self._cache_size = cache_size
        self._cache_lock = threading.Lock()

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #
    def model_id_for(self, spec: ComponentSpec) -> str:
        """Content address of the artifacts this spec would produce.

        The tessellation settings and the engine revision are part of the digest
        because both change the bytes on disk without changing the specification.
        """
        digest = hashlib.sha256()
        for part in (
            GEOMETRY_ENGINE_REVISION,
            self._tessellation.cache_key(),
            spec.canonical_key(),
        ):
            digest.update(part.encode("utf-8"))
            digest.update(b"\x00")
        return digest.hexdigest()[:_MODEL_ID_LENGTH]

    def generate(
        self, spec: ComponentSpec, formats: Sequence[ExportFormat] | None = None
    ) -> GeneratedModel:
        """Build ``spec`` and return its artifacts, reusing a previous build when possible."""
        requested = tuple(dict.fromkeys(formats or self._default_formats))
        model_id = self.model_id_for(spec)

        cached = self._reuse(model_id, requested)
        if cached is not None:
            return cached

        return self._build(model_id, spec, requested)

    # ------------------------------------------------------------------ #
    # Pipeline
    # ------------------------------------------------------------------ #
    def _build(
        self, model_id: str, spec: ComponentSpec, formats: tuple[ExportFormat, ...]
    ) -> GeneratedModel:
        started = time.perf_counter()

        if not self._slots.acquire(timeout=self._acquire_timeout_s):
            raise CapacityExhaustedError(
                "The geometry engine is busy and could not start a new job in time.",
                hint="Retry in a few seconds.",
            )
        try:
            checkpoint = time.perf_counter()
            solid = self._kernel.build(spec)
            build_ms = _elapsed_ms(checkpoint)

            checkpoint = time.perf_counter()
            mesh = self._kernel.tessellate(solid, self._tessellation)
            tessellate_ms = _elapsed_ms(checkpoint)

            checkpoint = time.perf_counter()
            quality = self._inspector.inspect(
                mesh, reference_volume_mm3=solid.volume_mm3
            )
            inspect_ms = _elapsed_ms(checkpoint)

            self._enforce_quality(quality, spec)

            checkpoint = time.perf_counter()
            metadata = _artifact_metadata(model_id, spec)
            artifacts: dict[ExportFormat, ArtifactRef] = {}
            for export_format in formats:
                descriptor = FORMAT_DESCRIPTORS[export_format]
                payload = (
                    self._kernel.export(solid, export_format)
                    if descriptor.source is ArtifactSource.BREP
                    else self._mesh_exporter.export(mesh, export_format, metadata=metadata)
                )
                artifacts[export_format] = self._storage.save(
                    model_id, export_format, payload
                )
            export_ms = _elapsed_ms(checkpoint)
        finally:
            self._slots.release()

        result = GeneratedModel(
            model_id=model_id,
            spec=spec,
            properties=SolidProperties(
                volume_mm3=solid.volume_mm3,
                surface_area_mm2=solid.surface_area_mm2,
                mass_g=spec.estimate_mass_g(solid.volume_mm3),
                density_g_cm3=spec.density_g_cm3,
            ),
            quality=quality,
            artifacts=artifacts,
            timings=GenerationTimings(
                build_ms=build_ms,
                tessellate_ms=tessellate_ms,
                inspect_ms=inspect_ms,
                export_ms=export_ms,
                total_ms=_elapsed_ms(started),
            ),
            cached=False,
        )
        self._remember(result)
        return result

    def _enforce_quality(self, quality: MeshQualityReport, spec: ComponentSpec) -> None:
        if not self._reject_invalid_meshes:
            return
        if quality.status is not MeshQualityStatus.INVALID:
            return
        raise MeshQualityRejectedError(
            "The generated mesh failed validation and was not published.",
            hint="Adjust the proportions of the part, or relax the quality gate.",
            details={
                "kind": spec.kind.value,
                "issues": [issue.model_dump(mode="json") for issue in quality.issues],
            },
        )

    # ------------------------------------------------------------------ #
    # Reuse
    # ------------------------------------------------------------------ #
    def _reuse(
        self, model_id: str, formats: tuple[ExportFormat, ...]
    ) -> GeneratedModel | None:
        """Serve a previous identical build, if its artifacts are still on disk.

        The in-memory entry holds the quality report and mass properties, which
        are not recoverable from the stored bytes; the presence check guards
        against an entry whose artifacts have since been pruned. Presence is
        tested without reading the payloads, because a live preview hits this
        path on every keystroke and the meshes run to megabytes.
        """
        with self._cache_lock:
            previous = self._cache.get(model_id)
            if previous is not None:
                self._cache.move_to_end(model_id)

        if previous is None:
            return None
        if any(export_format not in previous.artifacts for export_format in formats):
            return None

        if not all(
            self._storage.exists(model_id, export_format)
            for export_format in previous.artifacts
        ):
            return None

        return previous.model_copy(update={"cached": True})

    def _remember(self, result: GeneratedModel) -> None:
        if self._cache_size <= 0:
            return
        with self._cache_lock:
            self._cache[result.model_id] = result
            self._cache.move_to_end(result.model_id)
            while len(self._cache) > self._cache_size:
                self._cache.popitem(last=False)


def _elapsed_ms(since: float) -> float:
    return (time.perf_counter() - since) * 1000.0


def _artifact_metadata(model_id: str, spec: ComponentSpec) -> dict[str, str]:
    """Provenance embedded in the formats that can carry it."""
    return {
        "generator": "parametricad-ai",
        "engine_revision": GEOMETRY_ENGINE_REVISION,
        "model_id": model_id,
        "component_kind": spec.kind.value,
        "material": spec.material.value,
        "units": "mm",
    }
