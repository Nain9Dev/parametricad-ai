"""HTTP contract: success shapes, failure envelope and artifact delivery."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

pytestmark = pytest.mark.kernel

PIPE = {"kind": "pipe", "outer_diameter_mm": 25.0, "wall_thickness_mm": 2.0, "length_mm": 120.0}


class TestSystemEndpoints:
    def test_health_reports_the_active_adapters(self, api_client: TestClient) -> None:
        body = api_client.get("/health").json()
        assert body["status"] == "ok"
        assert body["geometry_kernel"] == "cadquery-occt"
        assert body["parameter_extractor"] == "rule_based"

    def test_the_root_redirects_to_the_documentation(self, api_client: TestClient) -> None:
        response = api_client.get("/", follow_redirects=False)
        assert response.status_code == 307
        assert response.headers["location"] == "/docs"

    def test_the_openapi_document_is_served(self, api_client: TestClient) -> None:
        assert api_client.get("/openapi.json").status_code == 200


class TestCatalog:
    def test_every_component_family_is_described(self, api_client: TestClient) -> None:
        body = api_client.get("/api/v1/catalog").json()
        assert {component["kind"] for component in body["components"]} == {
            "pipe",
            "elbow",
            "flange",
            "plate",
        }

    def test_parameters_carry_what_a_form_control_needs(
        self, api_client: TestClient
    ) -> None:
        body = api_client.get("/api/v1/catalog").json()
        pipe = next(c for c in body["components"] if c["kind"] == "pipe")
        diameter = next(p for p in pipe["parameters"] if p["name"] == "outer_diameter_mm")

        assert diameter["type"] == "number"
        assert diameter["unit"] == "mm"
        assert diameter["default"] == 25.0
        assert diameter["minimum"] == 0.0
        assert diameter["exclusive_minimum"] is True
        assert diameter["maximum"] == 5000.0
        assert diameter["step"] == 0.5

    def test_the_catalog_advertises_every_export_format(
        self, api_client: TestClient
    ) -> None:
        body = api_client.get("/api/v1/catalog").json()
        assert {entry["format"] for entry in body["formats"]} == {
            "glb",
            "gltf",
            "stl",
            "step",
            "dxf",
        }

    def test_the_catalog_is_cacheable(self, api_client: TestClient) -> None:
        assert "max-age" in api_client.get("/api/v1/catalog").headers["cache-control"]


class TestParametricGeneration:
    def test_a_valid_specification_produces_artifacts(
        self, api_client: TestClient
    ) -> None:
        response = api_client.post(
            "/api/v1/models", json={"spec": PIPE, "formats": ["glb", "step"]}
        )
        assert response.status_code == 200

        model = response.json()["model"]
        assert model["quality"]["status"] == "valid"
        assert set(model["artifacts"]) == {"glb", "step"}
        assert model["properties"]["mass_g"] > 0
        assert model["cached"] is False
        assert response.json()["extractor"] is None

    def test_the_echoed_specification_is_fully_resolved(
        self, api_client: TestClient
    ) -> None:
        """Defaults the caller omitted come back filled in."""
        response = api_client.post("/api/v1/models", json={"spec": {"kind": "flange"}})
        spec = response.json()["model"]["spec"]
        assert spec["kind"] == "flange"
        assert spec["material"] == "stainless_steel"
        assert spec["bolt_hole_count"] == 8

    def test_a_repeat_request_is_served_from_cache(self, api_client: TestClient) -> None:
        payload = {"spec": PIPE, "formats": ["glb"]}
        first = api_client.post("/api/v1/models", json=payload).json()["model"]
        second = api_client.post("/api/v1/models", json=payload).json()["model"]

        assert second["model_id"] == first["model_id"]
        assert second["cached"] is True

    def test_the_quality_report_reaches_the_client(self, api_client: TestClient) -> None:
        quality = api_client.post("/api/v1/models", json={"spec": PIPE}).json()["model"][
            "quality"
        ]
        assert quality["is_watertight"] is True
        assert quality["has_outward_normals"] is True
        assert quality["genus"] == 1
        assert quality["self_intersection_check_complete"] is True
        assert quality["bounding_box"]["size"]["z"] == pytest.approx(120.0)


class TestPromptGeneration:
    def test_a_description_is_turned_into_a_model(self, api_client: TestClient) -> None:
        response = api_client.post(
            "/api/v1/generate",
            json={
                "prompt": "brida de aluminio de 120mm de diametro exterior, "
                "paso 60mm, espesor 14mm, 8 tornillos",
                "formats": ["glb"],
            },
        )
        assert response.status_code == 200

        body = response.json()
        assert body["extractor"] == "rule_based"
        assert body["model"]["spec"]["kind"] == "flange"
        assert body["model"]["spec"]["material"] == "aluminium"
        assert body["model"]["spec"]["outer_diameter_mm"] == 120.0

    def test_the_documented_example_prompt_still_works(
        self, api_client: TestClient
    ) -> None:
        response = api_client.post(
            "/api/v1/generate",
            json={
                "prompt": "Generate a stainless steel pipe with a diameter of "
                "25.5mm and a length of 200mm"
            },
        )
        assert response.status_code == 200
        spec = response.json()["model"]["spec"]
        assert (spec["kind"], spec["outer_diameter_mm"], spec["length_mm"]) == (
            "pipe",
            25.5,
            200.0,
        )


class TestFailures:
    def test_an_unbuildable_part_is_rejected_with_a_reason(
        self, api_client: TestClient
    ) -> None:
        response = api_client.post(
            "/api/v1/models",
            json={
                "spec": {
                    "kind": "pipe",
                    "outer_diameter_mm": 10,
                    "wall_thickness_mm": 8,
                    "length_mm": 50,
                }
            },
        )
        assert response.status_code == 422

        error = response.json()["error"]
        assert error["code"] == "invalid_parameters"
        assert error["hint"]
        assert "bore would collapse" in str(error["details"])

    def test_an_unknown_field_is_rejected(self, api_client: TestClient) -> None:
        response = api_client.post(
            "/api/v1/models", json={"spec": {"kind": "pipe", "diameter": 25}}
        )
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "invalid_parameters"

    def test_an_unknown_component_is_rejected(self, api_client: TestClient) -> None:
        response = api_client.post("/api/v1/models", json={"spec": {"kind": "sprocket"}})
        assert response.status_code == 422

    def test_an_unknown_format_is_rejected(self, api_client: TestClient) -> None:
        response = api_client.post(
            "/api/v1/models", json={"spec": PIPE, "formats": ["obj"]}
        )
        assert response.status_code == 422

    def test_an_empty_prompt_is_rejected(self, api_client: TestClient) -> None:
        response = api_client.post("/api/v1/generate", json={"prompt": ""})
        assert response.status_code == 422

    def test_an_oversized_prompt_is_rejected(self, api_client: TestClient) -> None:
        response = api_client.post("/api/v1/generate", json={"prompt": "x" * 5000})
        assert response.status_code == 422

    def test_an_uninterpretable_description_reports_the_broken_rule(
        self, api_client: TestClient
    ) -> None:
        response = api_client.post(
            "/api/v1/generate", json={"prompt": "tubo de 10mm de diametro con pared de 9mm"}
        )
        assert response.status_code == 422

        error = response.json()["error"]
        assert error["code"] == "parameter_extraction_failed"
        assert error["details"]["violations"]

    def test_every_failure_uses_the_same_envelope(self, api_client: TestClient) -> None:
        responses = [
            api_client.post("/api/v1/models", json={"spec": {"kind": "sprocket"}}),
            api_client.post("/api/v1/generate", json={"prompt": ""}),
            api_client.post("/api/v1/models", json={}),
        ]
        for response in responses:
            body = response.json()
            assert set(body) == {"error"}
            assert set(body["error"]) == {"code", "message", "hint", "details"}


class TestArtifactDelivery:
    def test_a_generated_artifact_is_downloadable(self, api_client: TestClient) -> None:
        model = api_client.post(
            "/api/v1/models", json={"spec": PIPE, "formats": ["glb"]}
        ).json()["model"]
        reference = model["artifacts"]["glb"]

        response = api_client.get(reference["url"])
        assert response.status_code == 200
        assert len(response.content) == reference["size_bytes"]
        assert response.headers["content-type"] == "model/gltf-binary"

    def test_the_downloaded_bytes_match_the_published_digest(
        self, api_client: TestClient
    ) -> None:
        import hashlib

        model = api_client.post(
            "/api/v1/models", json={"spec": PIPE, "formats": ["stl"]}
        ).json()["model"]
        reference = model["artifacts"]["stl"]

        payload = api_client.get(reference["url"]).content
        assert hashlib.sha256(payload).hexdigest() == reference["sha256"]

    def test_artifacts_are_advertised_as_immutable(self, api_client: TestClient) -> None:
        model = api_client.post(
            "/api/v1/models", json={"spec": PIPE, "formats": ["glb"]}
        ).json()["model"]
        headers = api_client.get(model["artifacts"]["glb"]["url"]).headers
        assert "immutable" in headers["cache-control"]

    def test_a_step_artifact_is_exact_geometry(self, api_client: TestClient) -> None:
        model = api_client.post(
            "/api/v1/models", json={"spec": PIPE, "formats": ["step"]}
        ).json()["model"]
        reference = model["artifacts"]["step"]

        assert reference["source"] == "brep"
        assert api_client.get(reference["url"]).content.startswith(b"ISO-10303-21;")

    def test_an_unknown_artifact_is_a_clean_404(self, api_client: TestClient) -> None:
        assert api_client.get("/static/models/does-not-exist.glb").status_code == 404


class TestCors:
    def test_a_configured_origin_is_allowed(self, api_client: TestClient) -> None:
        response = api_client.options(
            "/api/v1/models",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "POST",
            },
        )
        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
