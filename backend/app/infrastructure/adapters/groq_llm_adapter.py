import os
import json
from groq import Groq
from app.domain.ports.llm_port import LlmPort
from app.domain.models.cad_request import ComponentParams

class GroqLlmAdapter(LlmPort):
    def __init__(self):
        # Initialize the Groq client (requires GROQ_API_KEY env var)
        self.client = Groq()
        self.model = "llama-3.3-70b-versatile"

    def extract_parameters(self, prompt: str) -> ComponentParams:
        system_prompt = """
        You are an engineering CAD parameter extractor. 
        Extract the parameters from the user's natural language prompt.
        Respond ONLY with a valid JSON object matching this schema, nothing else:
        {
          "type": "pipe" | "elbow" | "flange",
          "material": "string",
          "diameter": float,
          "angle": float,
          "length": float
        }
        If a parameter is not mentioned, omit it or set to null.
        """
        
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0
        )
        
        content = response.choices[0].message.content
        parsed_json = json.loads(content)
        return ComponentParams(**parsed_json)
