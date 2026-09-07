"""Port for turning natural language into a component specification."""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from app.domain.models.specs import ComponentSpec


@runtime_checkable
class ParameterExtractorPort(Protocol):
    """Maps an engineering prompt onto a validated specification."""

    name: str
    """Identifier of the backing implementation, echoed back to the client."""

    def extract(self, prompt: str) -> ComponentSpec:
        """Parse ``prompt`` into a spec.

        Raises:
            ParameterExtractionError: the prompt could not be interpreted.
            ParameterExtractionUnavailableError: the backend is not reachable.
        """
        ...
