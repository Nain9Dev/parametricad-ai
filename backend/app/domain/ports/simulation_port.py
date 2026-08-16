from abc import ABC, abstractmethod

class SimulationPort(ABC):
    @abstractmethod
    def validate_mesh(self, file_path: str) -> dict:
        """Validates a 3D mesh (e.g. for self-intersections or general metrics) and returns the result."""
        pass
