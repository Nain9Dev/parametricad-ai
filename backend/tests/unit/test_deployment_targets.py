"""Guards for the zero-euro 24/7 deployment contract.

REQ-DEP-01 pins every production target to a free tier costing 0 EUR, REQ-DEP-02
requires a scheduled pinger for every target that sleeps, and REQ-DEP-05 keeps
advertised functionality reachable without paid infrastructure. The tests read
only the same artifact the deploy scripts and the keepalive workflow read
(``deploy/hosts.json``), so any drift between the manifest, the workflow and the
client-side cold-start budget fails the suite.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
HOSTS_PATH = REPO_ROOT / "deploy" / "hosts.json"
WORKFLOW_PATH = REPO_ROOT / ".github" / "workflows" / "keepalive.yml"
CLIENT_HOOK = REPO_ROOT / "frontend" / "src" / "lib" / "hooks" / "useCatalog.ts"
CLIENT_API = REPO_ROOT / "frontend" / "src" / "lib" / "apiClient.ts"
COLD_START_BUDGET_MS = 30_000
"""A returning visitor's first catalogue response must complete within this."""


@dataclass(frozen=True)
class DeploymentTarget:
    """One entry of ``deploy/hosts.json``."""

    target_id: str
    layer: str
    provider: str
    plan: str
    origin: str
    health_path: str
    free: bool
    cost_eur: float
    sleeps: bool


def _load_manifest() -> list[DeploymentTarget]:
    raw = json.loads(HOSTS_PATH.read_text(encoding="utf-8"))
    return [
        DeploymentTarget(
            target_id=entry["id"],
            layer=entry["layer"],
            provider=entry["provider"],
            plan=entry["plan"],
            origin=entry["origin"],
            health_path=entry["health_path"],
            free=entry["free"],
            cost_eur=entry["cost_eur"],
            sleeps=entry["sleeps"],
        )
        for entry in raw["targets"]
    ]


class TestDeploymentTargets:
    """REQ-DEP-01: the whole stack sits on free tiers costing zero euro."""

    pytestmark = pytest.mark.req("REQ-DEP-01")

    def test_every_manifest_target_costs_zero_euro(self) -> None:
        targets = _load_manifest()
        assert targets, "deploy/hosts.json declares no targets"
        for target in targets:
            assert target.free is True, f"{target.target_id} declares a paying tier"
            assert target.cost_eur == 0, f"{target.target_id} costs more than 0 EUR"

    def test_the_manifest_covers_every_production_layer(self) -> None:
        targets = _load_manifest()
        layers = {target.layer for target in targets}
        assert "web" in layers, "no static web layer declared"
        assert "compute" in layers, "no API compute layer declared"
        for target in targets:
            assert re.fullmatch(r"https://[a-z0-9.-]+\.[a-z]{2,}", target.origin), (
                f"{target.target_id} origin is not a public https origin"
            )

    def test_every_sleeping_target_costs_zero_and_is_free_tier(self) -> None:
        sleeping = [t for t in _load_manifest() if t.sleeps]
        assert sleeping, "an always-answering demo has at least one sleeping target"
        for target in sleeping:
            assert target.free and target.cost_eur == 0, (
                f"{target.target_id} sleeps but is not declared free"
            )


class TestKeepaliveContract:
    """REQ-DEP-02: every sleeping target is covered by a scheduled pinger."""

    pytestmark = pytest.mark.req("REQ-DEP-02")

    @staticmethod
    def _workflow_text() -> str:
        return WORKFLOW_PATH.read_text(encoding="utf-8")

    @staticmethod
    def _cron_expression() -> str:
        match = re.search(r'"?on"?:\s*\n\s+schedule:\s*\n\s+-\s+cron:\s*"([^"]+)"',
                          TestKeepaliveContract._workflow_text())
        assert match, "keepalive.yml has no scheduled cron trigger"
        return match.group(1)

    def test_the_workflow_reads_the_same_host_manifest(self) -> None:
        text = self._workflow_text()
        assert "deploy/hosts.json" in text, "pinger must consume deploy/hosts.json"
        assert "sleeps" in text, "pinger must filter targets by their 'sleeps' flag"

    def test_the_ping_is_an_http_get(self) -> None:
        text = self._workflow_text()
        assert re.search(r"GET|urlopen|curl", text), "pinger does not send an HTTP GET"
        assert "/api/v1" not in text, "keepalive traffic must not hit the generation API"

    def test_the_cron_interval_is_within_one_to_ten_minutes(self) -> None:
        interval = self._cron_minute_interval(self._cron_expression())
        assert 1 <= interval <= 10, (
            f"cron runs every {interval:g} minutes; the requirement allows 1 to 10"
        )

    @staticmethod
    def _cron_minute_interval(expression: str) -> float:
        minute_field = expression.split()[0]
        if minute_field.startswith("*/"):
            return float(minute_field[2:])
        values = sorted(int(value) for value in minute_field.split(","))
        gaps = [b - a for a, b in zip(values, values[1:], strict=True)]
        return float(min(gaps)) if gaps else float("inf")


class TestPublicAvailability:
    """REQ-DEP-05: the demo answers every hour without paid infrastructure.

    The budget is enforced at the client: the cold-start notice must appear
    well before the 30 second budget and the retry backoff must fit inside it.
    The keepalive itself is a plain GET of a health path, never of a
    generation endpoint, so a pinger can never burn compute on model building.
    """

    pytestmark = pytest.mark.req("REQ-DEP-05")

    def test_cold_start_notice_comes_before_the_budget_expires(self) -> None:
        source = CLIENT_HOOK.read_text(encoding="utf-8")
        match = re.search(r"export const SLOW_LOAD_MS = (\d[\d_]*)", source)
        assert match, "the cold-start threshold is not a named constant"
        slow_load_ms = int(match.group(1).replace("_", ""))
        assert 0 < slow_load_ms < COLD_START_BUDGET_MS // 3, (
            f"notice appears after {slow_load_ms} ms; keep it well inside the 30 s budget"
        )

    def test_the_retry_backoff_fits_inside_the_cold_start_budget(self) -> None:
        source = CLIENT_API.read_text(encoding="utf-8")
        match = re.search(r"backoffMs: readonly number\[\] = \[([^\]]+)\]", source)
        assert match, "the retry backoff is not a named literal"
        backoff = [int(part.replace("_", "")) for part in match.group(1).split(",")]
        assert backoff, "the retry backoff list is empty"
        assert all(value > 0 for value in backoff)
        assert sum(backoff) <= COLD_START_BUDGET_MS // 2, (
            f"worst-case retry wait is {sum(backoff)} ms; the budget is {COLD_START_BUDGET_MS} ms"
        )

    def test_the_pinger_never_hits_a_generation_endpoint(self) -> None:
        for target in _load_manifest():
            assert target.health_path in {"", "/", "/health"}, (
                f"{target.target_id} keepalive path {target.health_path!r} is not a health route"
            )
            assert not target.health_path.startswith("/api/v1"), (
                f"keepalive would trigger kernel work via {target.target_id}"
            )
