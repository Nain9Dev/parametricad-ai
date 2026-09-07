"""Artifact persistence: naming, safety, integrity and retention."""

from __future__ import annotations

import hashlib
from pathlib import Path

import pytest

from app.domain.errors import StorageError
from app.domain.models.artifacts import ExportFormat
from app.infrastructure.storage.filesystem_storage import FilesystemArtifactStorage

MODEL_ID = "0123456789abcdef0123456789abcdef"


@pytest.fixture
def store(tmp_path: Path) -> FilesystemArtifactStorage:
    return FilesystemArtifactStorage(
        tmp_path / "models", url_prefix="/static/models", max_artifacts=4
    )


class TestSaveAndFind:
    def test_a_saved_artifact_is_described_completely(
        self, store: FilesystemArtifactStorage
    ) -> None:
        payload = b"binary glb payload"
        reference = store.save(MODEL_ID, ExportFormat.GLB, payload)

        assert reference.filename == f"{MODEL_ID}.glb"
        assert reference.url == f"/static/models/{MODEL_ID}.glb"
        assert reference.media_type == "model/gltf-binary"
        assert reference.size_bytes == len(payload)
        assert reference.sha256 == hashlib.sha256(payload).hexdigest()

    def test_the_bytes_land_on_disk_unchanged(
        self, store: FilesystemArtifactStorage
    ) -> None:
        payload = bytes(range(256))
        store.save(MODEL_ID, ExportFormat.STL, payload)
        assert (store.root / f"{MODEL_ID}.stl").read_bytes() == payload

    def test_finding_a_missing_artifact_returns_nothing(
        self, store: FilesystemArtifactStorage
    ) -> None:
        assert store.find(MODEL_ID, ExportFormat.GLB) is None
        assert store.exists(MODEL_ID, ExportFormat.GLB) is False

    def test_saving_twice_overwrites_rather_than_duplicating(
        self, store: FilesystemArtifactStorage
    ) -> None:
        store.save(MODEL_ID, ExportFormat.GLB, b"first")
        store.save(MODEL_ID, ExportFormat.GLB, b"second")

        assert len(list(store.root.iterdir())) == 1
        found = store.find(MODEL_ID, ExportFormat.GLB)
        assert found is not None
        assert found.size_bytes == len(b"second")

    def test_formats_are_stored_side_by_side(
        self, store: FilesystemArtifactStorage
    ) -> None:
        store.save(MODEL_ID, ExportFormat.GLB, b"a")
        store.save(MODEL_ID, ExportFormat.STEP, b"b")
        assert {path.suffix for path in store.root.iterdir()} == {".glb", ".step"}

    def test_no_partial_files_survive_a_save(
        self, store: FilesystemArtifactStorage
    ) -> None:
        store.save(MODEL_ID, ExportFormat.GLB, b"payload")
        assert not list(store.root.glob("*.partial"))


class TestIdentifierSafety:
    @pytest.mark.parametrize(
        "unsafe",
        [
            "../../etc/passwd",
            "..",
            "model id",
            "MODEL",
            "model/id",
            "model\\id",
            "a" * 65,
            "short",
            "",
        ],
    )
    def test_unsafe_identifiers_never_reach_a_path(
        self, store: FilesystemArtifactStorage, unsafe: str
    ) -> None:
        with pytest.raises(StorageError, match="unsafe artifact identifier"):
            store.save(unsafe, ExportFormat.GLB, b"payload")

    def test_a_traversal_attempt_writes_nothing(
        self, store: FilesystemArtifactStorage
    ) -> None:
        with pytest.raises(StorageError):
            store.save("../escape", ExportFormat.GLB, b"payload")
        assert not list(store.root.iterdir())


class TestRetention:
    def test_the_oldest_artifacts_are_dropped_past_the_cap(
        self, store: FilesystemArtifactStorage
    ) -> None:
        for index in range(8):
            store.save(f"{index:032x}", ExportFormat.GLB, b"payload")
        assert len(list(store.root.glob("*.glb"))) == 4

    def test_unrelated_files_are_never_deleted(
        self, store: FilesystemArtifactStorage
    ) -> None:
        keeper = store.root / "README.md"
        keeper.write_text("not an artifact", encoding="utf-8")
        foreign = store.root / "notes.glb"
        foreign.write_bytes(b"someone else's file")

        for index in range(8):
            store.save(f"{index:032x}", ExportFormat.GLB, b"payload")

        assert keeper.exists()
        assert foreign.exists()

    def test_retention_can_be_switched_off(self, tmp_path: Path) -> None:
        unlimited = FilesystemArtifactStorage(
            tmp_path / "keep", url_prefix="/static/models", max_artifacts=0
        )
        for index in range(6):
            unlimited.save(f"{index:032x}", ExportFormat.GLB, b"payload")
        assert len(list(unlimited.root.glob("*.glb"))) == 6
