"""Port for persisting generated artifacts."""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from app.domain.models.artifacts import ArtifactRef, ExportFormat


@runtime_checkable
class ArtifactStoragePort(Protocol):
    """Stores artifact bytes and hands back a reference clients can fetch."""

    def save(self, model_id: str, export_format: ExportFormat, payload: bytes) -> ArtifactRef:
        """Persist ``payload`` under ``model_id``.

        Raises:
            StorageError: the artifact could not be written.
        """
        ...

    def find(self, model_id: str, export_format: ExportFormat) -> ArtifactRef | None:
        """Return an existing artifact reference, or ``None`` if absent.

        Building the reference means digesting the payload, so prefer
        :meth:`exists` when only presence matters.
        """
        ...

    def exists(self, model_id: str, export_format: ExportFormat) -> bool:
        """Report whether an artifact is still stored, without reading it."""
        ...
