"""Shared fixtures.

The CAD kernel is expensive to exercise, so it is built once per session and
the fixtures that need it are marked ``kernel``. Everything else runs against
pure functions or fakes and stays fast.
"""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import numpy as np
import pytest
from pydantic import TypeAdapter

from app.application.services.model_generation_service import ModelGenerationService
from app.domain.geometry.mesh import TriangleMesh
from app.domain.geometry.tessellation import TessellationSettings
from app.domain.models.artifacts import ExportFormat
from app.domain.models.specs import ComponentSpec
from app.infrastructure.cad.cadquery_kernel import CadQueryKernel
from app.infrastructure.mesh.inspector import GeometricMeshInspector
from app.infrastructure.mesh.trimesh_exporter import TrimeshExporter
from app.infrastructure.storage.filesystem_storage import FilesystemArtifactStorage
from tests.traceability import (
    build_report,
    extract_frontend_requirement_ids,
    extract_requirement_ids,
    format_report,
)

SPEC_ADAPTER: TypeAdapter[ComponentSpec] = TypeAdapter(ComponentSpec)

REQUIREMENTS_DOC = Path(__file__).resolve().parents[2] / "docs" / "02-requirements.md"


def make_spec(**payload: object) -> ComponentSpec:
    """Validate a specification payload the same way the API would."""
    return SPEC_ADAPTER.validate_python(payload)


# --------------------------------------------------------------------------- #
# Synthetic meshes
# --------------------------------------------------------------------------- #
def unit_tetrahedron() -> TriangleMesh:
    """A closed, outward-wound tetrahedron of volume 1/6."""
    vertices = np.array(
        [[0.0, 0.0, 0.0], [1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]]
    )
    faces = np.array([[0, 2, 1], [0, 1, 3], [0, 3, 2], [1, 2, 3]])
    return TriangleMesh(vertices=vertices, faces=faces)


def axis_aligned_box(size: float = 1.0) -> TriangleMesh:
    """A closed, outward-wound cube with one corner at the origin."""
    vertices = (
        np.array(
            [
                [0, 0, 0],
                [1, 0, 0],
                [1, 1, 0],
                [0, 1, 0],
                [0, 0, 1],
                [1, 0, 1],
                [1, 1, 1],
                [0, 1, 1],
            ],
            dtype=np.float64,
        )
        * size
    )
    faces = np.array(
        [
            [0, 3, 2], [0, 2, 1],  # bottom
            [4, 5, 6], [4, 6, 7],  # top
            [0, 1, 5], [0, 5, 4],  # front
            [1, 2, 6], [1, 6, 5],  # right
            [2, 3, 7], [2, 7, 6],  # back
            [3, 0, 4], [3, 4, 7],  # left
        ]
    )
    return TriangleMesh(vertices=vertices, faces=faces)


@pytest.fixture(scope="session")
def tetrahedron() -> TriangleMesh:
    return unit_tetrahedron()


@pytest.fixture(scope="session")
def box() -> TriangleMesh:
    return axis_aligned_box()


# --------------------------------------------------------------------------- #
# Kernel-backed fixtures
# --------------------------------------------------------------------------- #
@pytest.fixture(scope="session")
def kernel() -> CadQueryKernel:
    return CadQueryKernel()


@pytest.fixture(scope="session")
def tessellation() -> TessellationSettings:
    return TessellationSettings()


@pytest.fixture
def storage(tmp_path: Path) -> FilesystemArtifactStorage:
    return FilesystemArtifactStorage(
        tmp_path / "models", url_prefix="/static/models", max_artifacts=32
    )


@pytest.fixture
def generation_service(
    kernel: CadQueryKernel,
    storage: FilesystemArtifactStorage,
    tessellation: TessellationSettings,
) -> ModelGenerationService:
    return ModelGenerationService(
        kernel=kernel,
        inspector=GeometricMeshInspector(),
        mesh_exporter=TrimeshExporter(),
        storage=storage,
        tessellation=tessellation,
        default_formats=[ExportFormat.GLB],
    )


def _reset_composition_root() -> None:
    """Drop every memoised adapter and the settings singleton.

    The composition root caches its adapters for the life of the process, which
    is right in production and wrong in a test: without this reset the second
    client would keep writing into the first one's temporary directory.
    """
    from app.config import get_settings
    from app.infrastructure.api import dependencies

    get_settings.cache_clear()
    for factory in (
        dependencies.get_geometry_kernel,
        dependencies.get_mesh_inspector,
        dependencies.get_mesh_exporter,
        dependencies.get_artifact_storage,
        dependencies.get_parameter_extractor,
        dependencies.get_generation_service,
        dependencies.get_generate_from_spec_use_case,
        dependencies.get_generate_from_prompt_use_case,
    ):
        factory.cache_clear()


@pytest.fixture
def api_client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[object]:
    """A test client bound to an isolated artifact directory.

    Configuration goes through the environment rather than a constructed
    ``Settings`` object so the composition root -- which calls ``get_settings``
    directly -- sees the same values the app was built with.
    """
    from fastapi.testclient import TestClient

    from app.main import create_app

    monkeypatch.setenv("PARAMETRICAD_STATIC_DIR", str(tmp_path / "static"))
    monkeypatch.setenv("PARAMETRICAD_EXTRACTOR", "rule_based")
    monkeypatch.delenv("PARAMETRICAD_GROQ_API_KEY", raising=False)
    _reset_composition_root()

    with TestClient(create_app()) as client:
        yield client

    _reset_composition_root()


# --------------------------------------------------------------------------- #
# Requirements traceability gate
# --------------------------------------------------------------------------- #
def pytest_addoption(parser: pytest.Parser) -> None:
    parser.addoption(
        "--no-traceability-check",
        action="store_true",
        default=False,
        help="skip the requirements-to-test traceability gate",
    )


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    """Fail closed unless every requirement is covered and every test is tagged.

    The check runs after collection so it sees the whole suite, but before any
    test executes. Each test declares the requirement(s) it verifies with
    ``@pytest.mark.req("REQ-...")``; a test that carries no ``req`` marker, a
    requirement that no test claims, or a marker that references an unknown
    requirement id aborts the run with a descriptive message.
    """
    if config.getoption("--no-traceability-check") or not REQUIREMENTS_DOC.exists():
        return
    text = REQUIREMENTS_DOC.read_text(encoding="utf-8")
    backend_requirements = set(extract_requirement_ids(text)) - set(
        extract_frontend_requirement_ids(text)
    )
    test_tags: dict[str, set[str]] = {}
    for item in items:
        tags = {
            marker.args[0]
            for marker in item.iter_markers("req")
            if marker.args and isinstance(marker.args[0], str)
        }
        test_tags[item.nodeid] = tags
    report = build_report(backend_requirements, test_tags)
    if not report.ok:
        pytest.exit(format_report(report), returncode=1)


_SESSION_EXITSTATUS = 0
"""Exit status of the finished session, captured for the Windows teardown below."""


def pytest_sessionfinish(session: pytest.Session, exitstatus: int) -> None:
    """Record the authoritative exit status before the Windows teardown runs."""
    global _SESSION_EXITSTATUS
    _SESSION_EXITSTATUS = int(exitstatus)


@pytest.hookimpl(trylast=True)
def pytest_unconfigure(config: pytest.Config) -> None:
    """Terminate the process cleanly on Windows.

    OpenCASCADE and CadQuery register C++ static destructors that trigger an
    access violation (0xC0000005) or heap corruption (0xC0000374) during
    Python's Py_FinalizeEx DLL teardown on Windows. Exiting directly after
    pytest finishes summary reporting avoids the teardown crash while
    faithfully preserving the test session's exit code.
    """
    import os
    import sys

    if sys.platform == "win32":
        sys.stdout.flush()
        sys.stderr.flush()
        os._exit(_SESSION_EXITSTATUS)

