from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.application.use_cases.generate_cad_use_case import GenerateCadUseCase
from app.infrastructure.adapters.mock_llm_adapter import MockLlmAdapter
from app.infrastructure.adapters.cadquery_adapter import CadqueryAdapter
from app.infrastructure.adapters.trimesh_adapter import TrimeshAdapter
from app.domain.models.cad_request import CadGenerationResult

router = APIRouter()

class GenerateRequest(BaseModel):
    prompt: str

def get_generate_use_case() -> GenerateCadUseCase:
    llm_adapter = MockLlmAdapter()
    cad_adapter = CadqueryAdapter()
    simulation_adapter = TrimeshAdapter()
    return GenerateCadUseCase(llm_adapter=llm_adapter, cad_adapter=cad_adapter, simulation_adapter=simulation_adapter)

@router.post("/generate", response_model=CadGenerationResult)
def generate_cad(request: GenerateRequest, use_case: GenerateCadUseCase = Depends(get_generate_use_case)):
    result = use_case.execute(request.prompt)
    return result
