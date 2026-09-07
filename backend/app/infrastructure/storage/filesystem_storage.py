"""Filesystem implementation of :class:`ArtifactStoragePort`.

Artifacts are content-addressed: the filename is the model id, which is derived
from the specification and the tessellation settings. Regenerating the same part
therefore overwrites itself rather than accumulating duplicates, and a repeat
request can be answered straight from disk.
"""

from __future__ import annotations

import hashlib
import os
import re
import threading
from pathlib import Path

from app.domain.errors import StorageError
from app.domain.models.artifacts import FORMAT_DESCRIPTORS, ArtifactRef, ExportFormat

__all__ = ["FilesystemArtifactStorage"]

_MODEL_ID_PATTERN = re.compile(r"^[a-z0-9]{8,64}$")
"""Model ids are hex digests. Anything else is rejected before it reaches a path."""


class FilesystemArtifactStorage:
    """Stores artifacts under a single directory served as static files."""

    def __init__(
        self,
        root: Path,
        *,
        url_prefix: str,
        max_artifacts: int = 512,
    ) -> None:
        self._root = root.resolve()
        self._url_prefix = url_prefix.rstrip("/")
        self._max_artifacts = max_artifacts
        self._lock = threading.Lock()
        self._root.mkdir(parents=True, exist_ok=True)

    @property
    def root(self) -> Path:
        return self._root

    # ------------------------------------------------------------------ #
    # Port implementation
    # ------------------------------------------------------------------ #
    def save(self, model_id: str, export_format: ExportFormat, payload: bytes) -> ArtifactRef:
        target = self._path_for(model_id, export_format)
        temporary = target.with_name(f"{target.name}.{os.getpid()}.partial")

        try:
            temporary.write_bytes(payload)
            # Replace is atomic on both POSIX and Windows, so a concurrent
            # reader never observes a half-written artifact.
            temporary.replace(target)
        except OSError as exc:
            temporary.unlink(missing_ok=True)
            raise StorageError(
                "The generated artifact could not be written to disk.",
                details={"format": export_format.value, "os_error": str(exc)},
            ) from exc

        self._prune()
        return self._reference(export_format, target, payload)

    def find(self, model_id: str, export_format: ExportFormat) -> ArtifactRef | None:
        target = self._path_for(model_id, export_format)
        if not target.is_file():
            return None
        try:
            payload = target.read_bytes()
        except OSError:
            return None
        return self._reference(export_format, target, payload)

    def exists(self, model_id: str, export_format: ExportFormat) -> bool:
        return self._path_for(model_id, export_format).is_file()

    # ------------------------------------------------------------------ #
    # Internals
    # ------------------------------------------------------------------ #
    def _path_for(self, model_id: str, export_format: ExportFormat) -> Path:
        if not _MODEL_ID_PATTERN.fullmatch(model_id):
            raise StorageError(
                "Refusing to use an unsafe artifact identifier.",
                details={"model_id": model_id},
            )
        descriptor = FORMAT_DESCRIPTORS[export_format]
        return self._root / f"{model_id}.{descriptor.extension}"

    def _reference(
        self, export_format: ExportFormat, path: Path, payload: bytes
    ) -> ArtifactRef:
        descriptor = FORMAT_DESCRIPTORS[export_format]
        return ArtifactRef(
            format=export_format,
            filename=path.name,
            url=f"{self._url_prefix}/{path.name}",
            media_type=descriptor.media_type,
            size_bytes=len(payload),
            sha256=hashlib.sha256(payload).hexdigest(),
            source=descriptor.source,
        )

    def _prune(self) -> None:
        """Drop the least recently modified artifacts once the cap is exceeded.

        Only files whose name matches the artifact convention are ever removed,
        so pointing the store at a populated directory cannot delete unrelated
        content.
        """
        if self._max_artifacts <= 0:
            return

        extensions = {f".{d.extension}" for d in FORMAT_DESCRIPTORS.values()}
        with self._lock:
            artifacts = [
                path
                for path in self._root.iterdir()
                if path.is_file()
                and path.suffix.lower() in extensions
                and _MODEL_ID_PATTERN.fullmatch(path.stem)
            ]
            if len(artifacts) <= self._max_artifacts:
                return

            artifacts.sort(key=lambda path: path.stat().st_mtime)
            for path in artifacts[: len(artifacts) - self._max_artifacts]:
                path.unlink(missing_ok=True)
