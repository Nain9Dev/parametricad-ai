from app.domain.ports.llm_port import LlmPort
from app.domain.ports.cad_port import CadPort
from app.domain.ports.simulation_port import SimulationPort
from app.domain.models.cad_request import CadGenerationResult
import uuid
import os

class GenerateCadUseCase:
    def __init__(self, llm_adapter: LlmPort, cad_adapter: CadPort, simulation_adapter: SimulationPort, output_dir: str = "./static/outputs"):
        self.llm_adapter = llm_adapter
        self.cad_adapter = cad_adapter
        self.simulation_adapter = simulation_adapter
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)

    def execute(self, prompt: str) -> CadGenerationResult:
        try:
            # 1. Extract parameters using LLM
            params = self.llm_adapter.extract_parameters(prompt)
            
            # 2. Generate unique filename
            filename = f"{uuid.uuid4()}.glb"
            output_path = os.path.join(self.output_dir, filename)
            
            # 3. Generate CAD model
            success = self.cad_adapter.generate_glb(params, output_path)
            
            if success:
                # 4. Validate Mesh with Simulation port
                validation_metrics = self.simulation_adapter.validate_mesh(output_path)
                
                return CadGenerationResult(
                    success=True,
                    glb_url=f"/static/outputs/{filename}",
                    extracted_params=params,
                    validation_metrics=validation_metrics
                )
            else:
                return CadGenerationResult(success=False, error_message="Failed to generate CAD model")
        except Exception as e:
            return CadGenerationResult(success=False, error_message=str(e))
