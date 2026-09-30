"""Settings contract: defaults that other parts of the system depend on.

These are not tests of pydantic. They pin the few defaults that something
outside this file would silently break: the origins the browser is allowed to
call from, and the rule that decides which extraction backend gets built.
"""

from __future__ import annotations

import os

import pytest
from pydantic import SecretStr

from app.config import Settings


@pytest.fixture
def settings(monkeypatch: pytest.MonkeyPatch) -> Settings:
    """Settings built from the declared defaults alone.

    The environment of the machine running the suite must not decide the
    answer, so every ``PARAMETRICAD_`` variable and the dotenv file are removed
    from the sources first.
    """
    for name in list(os.environ):
        if name.startswith("PARAMETRICAD_"):
            monkeypatch.delenv(name, raising=False)
    return Settings(_env_file=None)


class TestCorsDefaults:
    pytestmark = pytest.mark.req("REQ-UBI-05")

    def test_the_reserved_local_origin_is_allowed(self, settings: Settings) -> None:
        # 5300 is this project's reserved development port; see docs/10-runbook.md.
        assert "http://localhost:5300" in settings.cors_allow_origins
        assert "http://127.0.0.1:5300" in settings.cors_allow_origins

    def test_no_default_port_is_allowed(self, settings: Settings) -> None:
        # Vite's 5173 is claimed by every project on the machine at once, so an
        # allowance for it would hand the API to whichever one won the race.
        assert not any("5173" in origin for origin in settings.cors_allow_origins)

    def test_the_deployed_client_is_allowed(self, settings: Settings) -> None:
        assert "https://parametricad.naindev.com" in settings.cors_allow_origins

    def test_a_comma_separated_list_is_accepted(self) -> None:
        # How the value arrives from a shell or a container environment.
        settings = Settings(cors_allow_origins="http://a.test, http://b.test")
        assert settings.cors_allow_origins == ["http://a.test", "http://b.test"]

    def test_a_json_list_is_accepted(self) -> None:
        settings = Settings(cors_allow_origins='["http://a.test"]')
        assert settings.cors_allow_origins == ["http://a.test"]


class TestExtractorSelection:
    pytestmark = pytest.mark.req("REQ-STA-01")

    def test_auto_falls_back_to_the_offline_extractor(self, settings: Settings) -> None:
        assert settings.groq_api_key is None
        assert settings.resolved_extractor == "rule_based"

    def test_auto_prefers_the_hosted_model_when_credentialed(self) -> None:
        settings = Settings(extractor="auto", groq_api_key=SecretStr("test-key"))
        assert settings.resolved_extractor == "groq"

    def test_an_explicit_choice_is_never_overridden(self) -> None:
        settings = Settings(extractor="rule_based", groq_api_key=SecretStr("test-key"))
        assert settings.resolved_extractor == "rule_based"


class TestArtifactLocations:
    pytestmark = pytest.mark.req("REQ-UBI-07")

    def test_the_models_directory_sits_under_the_static_root(
        self, settings: Settings
    ) -> None:
        assert settings.models_dir == settings.static_dir / settings.models_subdir

    def test_the_url_prefix_has_exactly_one_separator(self) -> None:
        settings = Settings(static_url_prefix="/static/", models_subdir="models")
        assert settings.models_url_prefix == "/static/models"
