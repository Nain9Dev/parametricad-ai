"""Groq-backed parameter extraction.

The model is asked for a specification, not for geometry: whatever it returns is
validated against the same discriminated union as a hand-written request, so an
implausible part is rejected by the domain rules rather than reaching the kernel.

Determinism is pursued as far as the provider allows -- zero temperature and a
fixed seed -- but a hosted model is never a reproducible component, which is the
reason the rule-based extractor exists alongside it.
"""

from __future__ import annotations

import json
from typing import Any

import groq
from pydantic import TypeAdapter, ValidationError

from app.domain.errors import (
    ParameterExtractionError,
    ParameterExtractionUnavailableError,
)
from app.domain.models.specs import ComponentSpec

__all__ = ["GroqParameterExtractor"]

_SPEC_ADAPTER: TypeAdapter[ComponentSpec] = TypeAdapter(ComponentSpec)

_SYSTEM_PROMPT = """\
You extract mechanical component parameters from engineering descriptions.

Reply with a single JSON object and nothing else. It must validate against this
JSON Schema:

{schema}

Rules:
- Every length is in millimetres and every angle is in degrees. Convert any
  other unit the user writes before answering.
- Only include fields you can justify from the description. Omitted fields fall
  back to sensible defaults, so guessing is worse than omitting.
- "kind" is mandatory and must be one of the values allowed by the schema.
- Never invent a field that is not in the schema.
"""


class GroqParameterExtractor:
    """Extraction backed by a hosted language model."""

    name = "groq"

    def __init__(
        self,
        *,
        api_key: str,
        model: str = "llama-3.3-70b-versatile",
        timeout_seconds: float = 20.0,
        seed: int = 7,
    ) -> None:
        if not api_key:
            raise ParameterExtractionUnavailableError(
                "The Groq extractor was selected but no API key is configured.",
                hint="Set PARAMETRICAD_GROQ_API_KEY, or switch the extractor to 'rule_based'.",
            )
        self._client = groq.Groq(api_key=api_key, timeout=timeout_seconds, max_retries=1)
        self._model = model
        self._seed = seed
        self._system_prompt = _SYSTEM_PROMPT.format(
            schema=json.dumps(_SPEC_ADAPTER.json_schema(), separators=(",", ":"))
        )

    def extract(self, prompt: str) -> ComponentSpec:
        if not prompt.strip():
            raise ParameterExtractionError("The prompt is empty.")

        content = self._complete(prompt)

        try:
            payload: Any = json.loads(content)
        except json.JSONDecodeError as exc:
            raise ParameterExtractionError(
                "The language model did not return valid JSON.",
                hint="Retry, or rephrase the description in plainer terms.",
                details={"raw_response": content[:500]},
            ) from exc

        try:
            return _SPEC_ADAPTER.validate_python(payload)
        except ValidationError as exc:
            raise ParameterExtractionError(
                "The extracted parameters do not describe a buildable part.",
                hint="State the diameter, wall thickness and length explicitly.",
                details={
                    "extracted": payload,
                    "violations": [
                        {
                            "field": ".".join(str(part) for part in error["loc"]),
                            "message": error["msg"],
                        }
                        for error in exc.errors()
                    ],
                },
            ) from exc

    def _complete(self, prompt: str) -> str:
        try:
            response = self._client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": self._system_prompt},
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
                temperature=0.0,
                seed=self._seed,
            )
        except (groq.APIConnectionError, groq.APITimeoutError) as exc:
            raise ParameterExtractionUnavailableError(
                "The language model provider could not be reached.",
                hint="Retry shortly, or switch the extractor to 'rule_based'.",
                details={"provider_error": str(exc)},
            ) from exc
        except groq.AuthenticationError as exc:
            raise ParameterExtractionUnavailableError(
                "The configured Groq credentials were rejected.",
                hint="Check PARAMETRICAD_GROQ_API_KEY.",
            ) from exc
        except groq.RateLimitError as exc:
            raise ParameterExtractionUnavailableError(
                "The language model provider is rate limiting this deployment.",
                hint="Retry in a few seconds.",
            ) from exc
        except groq.APIError as exc:
            raise ParameterExtractionError(
                "The language model provider returned an error.",
                details={"provider_error": str(exc)},
            ) from exc

        content = response.choices[0].message.content if response.choices else None
        if not content:
            raise ParameterExtractionError(
                "The language model returned an empty response.",
                hint="Retry, or rephrase the description.",
            )
        return content
