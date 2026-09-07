# Requirements Traceability Matrix

This matrix maps system requirements to their implementing domain models, use cases, and verification suites.

| Requirement ID | Specification | Implemented In | Verified By |
|---|---|---|---|
| REQ-UBI-01 | Content addressing via SHA-256 | `domain/models/specs.py` (`canonical_key`) | `tests/unit/test_specs.py`, `tests/property/test_geometry_invariants.py` |
| REQ-UBI-02 | Domain layer isolation | `domain/geometry/`, `domain/models/` | `backend/pyproject.toml` (mypy strict), `tests/unit/test_mesh_analysis.py` |
| REQ-UBI-03 | Component catalog endpoint | `application/catalog.py`, `api/routes/catalog.py` | `tests/integration/test_api.py` (`test_catalog_returns_all_components`) |
| REQ-EVT-01 | Solid build & tessellation from spec | `application/use_cases/generate_from_spec.py` | `tests/integration/test_cadquery_kernel.py`, `tests/unit/test_generation_service.py` |
| REQ-EVT-02 | Parameter extraction from prompt | `application/use_cases/generate_from_prompt.py` | `tests/unit/test_rule_based_extractor.py` |
| REQ-EVT-03 | Content-addressed artifact caching | `application/services/model_generation_service.py` | `tests/unit/test_generation_service.py` (`TestContentAddressing`) |
| REQ-STA-01 | Offline rule-based extraction fallback | `infrastructure/llm/rule_based_extractor.py` | `tests/unit/test_rule_based_extractor.py`, `tests/integration/test_api.py` |
| REQ-STA-02 | Rejection of non-manifold/invalid meshes | `application/services/model_generation_service.py` | `tests/unit/test_generation_service.py` (`TestQualityGateRejection`) |
| REQ-UNW-01 | Fabricability validation rejection | `domain/models/specs.py` | `tests/unit/test_specs.py` (`TestPipeRules`, `TestElbowRules`, etc.) |
| REQ-UNW-02 | Concurrency limit timeout handling | `application/services/model_generation_service.py` | `tests/unit/test_generation_service.py` (`TestConcurrencyLimit`) |
| REQ-UNW-03 | Unrecognized prompt rejection | `infrastructure/llm/rule_based_extractor.py` | `tests/integration/test_api.py` (`test_unparseable_prompt_fails_cleanly`) |
| REQ-OPT-01 | Multi-format exports (STEP, STL, DXF) | `infrastructure/mesh/trimesh_exporter.py` | `tests/integration/test_cadquery_kernel.py` (`TestExporters`) |
