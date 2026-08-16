from app.domain.ports.cad_port import CadPort
from app.domain.models.cad_request import ComponentParams

class MockCadAdapter(CadPort):
    def generate_glb(self, params: ComponentParams, output_path: str) -> bool:
        # Para W2, simplemente simulamos éxito y creamos un archivo vacío o no hacemos nada.
        # Esto se reemplazará en W3 con CadQuery real.
        with open(output_path, "w") as f:
            f.write("mock_glb_content")
        return True
