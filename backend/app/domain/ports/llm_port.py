from abc import ABC, abstractmethod
from app.domain.models.cad_request import ComponentParams

class LlmPort(ABC):
    @abstractmethod
    def extract_parameters(self, prompt: str) -> ComponentParams:
        """Extracts structured CAD parameters from a natural language prompt."""
        pass
