"""Requirements traceability checker.

Pure helpers that map the canonical EARS requirements document to the tests
that verify them. The logic is kept free of pytest fixtures so it can itself be
unit-tested under the same discipline it enforces.

The contract is three-sided and fail-closed:

* every in-scope requirement declared in the spec has at least one covering test;
* every test is tagged with the requirement(s) it verifies;
* every tag a test declares resolves to a requirement that actually exists.

Requirements annotated ``(frontend)`` in the spec are verified by the web
client's test runner rather than the backend suite, so the backend gate skips
them; ``extract_frontend_requirement_ids`` exposes that split.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

REQUIREMENT_ID = re.compile(r"REQ-[A-Z]+-\d+")
REQUIREMENT_LINE = re.compile(r"^\s*-\s+\*\*(REQ-[A-Z]+-\d+)\*\*", re.MULTILINE)


@dataclass(frozen=True)
class TraceabilityReport:
    """The outcome of comparing the spec against the tagged tests."""

    requirements: frozenset[str]
    covered: frozenset[str]
    untagged: tuple[str, ...]
    unknown: frozenset[str]

    @property
    def uncovered(self) -> frozenset[str]:
        """Requirements declared in the spec but covered by no test."""
        return self.requirements - self.covered

    @property
    def ok(self) -> bool:
        """True when the spec and the tests agree in both directions."""
        return not self.uncovered and not self.untagged and not self.unknown


def extract_requirement_ids(text: str) -> list[str]:
    """Return every ``REQ-*`` declaration found in ``text``, in document order."""
    return REQUIREMENT_LINE.findall(text)


def extract_frontend_requirement_ids(text: str) -> list[str]:
    """Return the requirement ids declared with the ``(frontend)`` annotation."""
    return [
        match.group(1)
        for line in text.splitlines()
        if "(frontend)" in line
        for match in [REQUIREMENT_LINE.match(line)]
        if match is not None
    ]


def build_report(requirement_ids: set[str], test_tags: dict[str, set[str]]) -> TraceabilityReport:
    """Compare declared requirements against a ``nodeid -> tags`` mapping."""
    requirements = frozenset(requirement_ids)
    covered = frozenset().union(*test_tags.values()) if test_tags else frozenset()
    untagged = tuple(sorted(nodeid for nodeid, tags in test_tags.items() if not tags))
    return TraceabilityReport(
        requirements=requirements,
        covered=covered,
        untagged=untagged,
        unknown=covered - requirements,
    )


def format_report(report: TraceabilityReport) -> str:
    """Render the report as a human-readable, CI-friendly message."""
    lines = ["requirements traceability gate failed:"]
    if report.uncovered:
        lines.append("  requirements with no covering test:")
        lines.extend(f"    - {req}" for req in sorted(report.uncovered))
    if report.untagged:
        lines.append("  tests without a requirement tag:")
        lines.extend(f"    - {nodeid}" for nodeid in report.untagged)
    if report.unknown:
        lines.append("  tests referencing unknown requirements:")
        lines.extend(f"    - {req}" for req in sorted(report.unknown))
    return "\n".join(lines)
