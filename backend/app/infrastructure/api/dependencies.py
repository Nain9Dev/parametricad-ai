"""Composition root.

Adapters are chosen and wired here and nowhere else; every layer above depends
only on ports. The singletons are process-wide on purpose -- the kernel holds a
lock, the storage holds a prune lock and the service holds a result cache, all
of which have to be shared across requests to do their job.
"""

from __future__ import annotations

from functools import lru_cache

from app.application.services.model_generation_service import ModelGenerationService
from app.application.use_cases.generate_from_prompt import GenerateFromPromptUseCase
from app.application.use_cases.generate_from_spec import GenerateFromSpecUseCase
from app.config import Settings, get_settings
from app.domain.ports.artifact_storage import ArtifactStoragePort
from app.domain.ports.geometry_kernel import GeometryKernelPort
from app.domain.ports.mesh_exporter import MeshExporterPort
from app.domain.ports.mesh_inspector import MeshInspectorPort
from app.domain.ports.parameter_extractor import ParameterExtractorPort
from app.infrastructure.cad.cadquery_kernel import CadQueryKernel
from app.infrastructure.llm.rule_based_extractor import RuleBasedParameterExtractor
from app.infrastructure.mesh.inspector import GeometricMeshInspector
from app.infrastructure.mesh.trimesh_exporter import TrimeshExporter
from app.infrastructure.storage.filesystem_storage import FilesystemArtifactStorage

__all__ = [
    "get_generate_from_prompt_use_case",
    "get_generate_from_spec_use_case",
    "get_generation_service",
    "get_parameter_extractor",
]


@lru_cache(maxsize=1)
def get_geometry_kernel() -> GeometryKernelPort:
    return CadQueryKernel()


@lru_cache(maxsize=1)
def get_mesh_inspector() -> MeshInspectorPort:
    return GeometricMeshInspector(get_settings().quality)


@lru_cache(maxsize=1)
def get_mesh_exporter() -> MeshExporterPort:
    return TrimeshExporter()


@lru_cache(maxsize=1)
def get_artifact_storage() -> ArtifactStoragePort:
    settings = get_settings()
    return FilesystemArtifactStorage(
        settings.models_dir,
        url_prefix=settings.models_url_prefix,
        max_artifacts=settings.max_stored_artifacts,
    )


@lru_cache(maxsize=1)
def get_parameter_extractor() -> ParameterExtractorPort:
    """Select the extraction backend declared by configuration.

    Resolved once at startup rather than per request, so the active backend is a
    stable, reportable property of the deployment instead of something that can
    silently change between two calls.
    """
    settings: Settings = get_settings()
    if settings.resolved_extractor == "groq":
        from app.infrastructure.llm.groq_extractor import GroqParameterExtractor

        return GroqParameterExtractor(
            api_key=settings.groq_api_key.get_secret_value() if settings.groq_api_key else "",
            model=settings.groq_model,
            timeout_seconds=settings.groq_timeout_s,
        )
    return RuleBasedParameterExtractor()


@lru_cache(maxsize=1)
def get_generation_service() -> ModelGenerationService:
    settings = get_settings()
    return ModelGenerationService(
        kernel=get_geometry_kernel(),
        inspector=get_mesh_inspector(),
        mesh_exporter=get_mesh_exporter(),
        storage=get_artifact_storage(),
        tessellation=settings.tessellation,
        default_formats=settings.default_export_formats,
        reject_invalid_meshes=settings.reject_invalid_meshes,
        max_concurrency=settings.kernel_max_concurrency,
        acquire_timeout_s=settings.kernel_acquire_timeout_s,
        cache_size=settings.result_cache_size,
    )


@lru_cache(maxsize=1)
def get_generate_from_spec_use_case() -> GenerateFromSpecUseCase:
    return GenerateFromSpecUseCase(get_generation_service())


@lru_cache(maxsize=1)
def get_generate_from_prompt_use_case() -> GenerateFromPromptUseCase:
    return GenerateFromPromptUseCase(get_parameter_extractor(), get_generation_service())
