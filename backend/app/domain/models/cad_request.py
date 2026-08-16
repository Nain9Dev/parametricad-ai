from pydantic import BaseModel, Field
from typing import Optional

class ComponentParams(BaseModel):
    type: str = Field(description="Type of the component, e.g., 'pipe', 'elbow', 'flange'")
    material: Optional[str] = Field(None, description="Material of the component, e.g., 'stainless steel'")
    diameter: Optional[float] = Field(None, description="Nominal diameter of the component")
    angle: Optional[float] = Field(None, description="Angle in degrees, used for elbows")
    length: Optional[float] = Field(None, description="Length of the component, used for pipes")

class CadGenerationResult(BaseModel):
    success: bool
    glb_url: Optional[str] = None
    error_message: Optional[str] = None
    extracted_params: Optional[ComponentParams] = None
    validation_metrics: Optional[dict] = None
