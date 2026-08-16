from abc import ABC, abstractmethod
from app.domain.models.cad_request import ComponentParams

class CadPort(ABC):
    @abstractmethod
    def generate_glb(self, params: ComponentParams, output_path: str) -> bool:
        """Generates a 3D model based on parameters and saves it to output_path. Returns True on success."""
        pass
