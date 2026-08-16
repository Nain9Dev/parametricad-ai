from app.domain.ports.llm_port import LlmPort
from app.domain.models.cad_request import ComponentParams
import re

class MockLlmAdapter(LlmPort):
    def extract_parameters(self, prompt: str) -> ComponentParams:
        # Un mock muy sencillo basado en regex para la demo sin API KEY
        prompt_lower = prompt.lower()
        
        comp_type = "pipe"
        if "codo" in prompt_lower or "elbow" in prompt_lower:
            comp_type = "elbow"
        elif "brida" in prompt_lower or "flange" in prompt_lower:
            comp_type = "flange"
            
        # Extracción simulada de números
        numbers = [float(s) for s in re.findall(r'-?\d+\.?\d*', prompt)]
        
        diameter = numbers[0] if len(numbers) > 0 else 10.0
        angle = numbers[1] if len(numbers) > 1 and comp_type == "elbow" else 90.0
        length = numbers[1] if len(numbers) > 1 and comp_type == "pipe" else 100.0

        return ComponentParams(
            type=comp_type,
            material="stainless steel" if "acero" in prompt_lower or "steel" in prompt_lower else "plastic",
            diameter=diameter,
            angle=angle if comp_type == "elbow" else None,
            length=length if comp_type == "pipe" else None
        )
