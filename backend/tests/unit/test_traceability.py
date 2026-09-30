"""Requirements traceability checker.

These tests were written before ``tests/traceability.py`` and encode the
contract the traceability gate must honour: every requirement declared in the
EARS document is covered by at least one test, every test is tagged with the
requirement it verifies, and no test references a requirement that does not
exist. Requirements annotated ``(frontend)`` are split out for the web client's
runner.
"""

from __future__ import annotations

import pytest

from tests.traceability import (
    build_report,
    extract_frontend_requirement_ids,
    extract_requirement_ids,
    format_report,
)

pytestmark = pytest.mark.req("REQ-UBI-08")

REQUIREMENTS = """
## 1. Ubiquitous Requirements

- **REQ-UBI-01**: The system shall produce a content-addressed model id.
- **REQ-EVT-01**: When a valid spec is received, the system shall generate it.
"""

REQUIREMENTS_WITH_FRONTEND = (
    REQUIREMENTS
    + "\n- **REQ-EVT-04**: When the catalog fails, the client shall retry. (frontend)\n"
)


class TestExtractRequirementIds:
    def test_collects_ids_in_document_order(self) -> None:
        assert extract_requirement_ids(REQUIREMENTS) == ["REQ-UBI-01", "REQ-EVT-01"]

    def test_returns_nothing_without_requirement_declarations(self) -> None:
        assert extract_requirement_ids("no requirements here") == []


class TestExtractFrontendRequirementIds:
    def test_separates_frontend_scoped_requirements(self) -> None:
        assert extract_frontend_requirement_ids(REQUIREMENTS_WITH_FRONTEND) == ["REQ-EVT-04"]

    def test_backend_only_document_has_no_frontend_ids(self) -> None:
        assert extract_frontend_requirement_ids(REQUIREMENTS) == []


class TestBuildReport:
    def _ids(self, text: str = REQUIREMENTS) -> set[str]:
        return set(extract_requirement_ids(text))

    def test_ok_when_every_requirement_is_covered_and_every_test_is_tagged(self) -> None:
        report = build_report(
            self._ids(),
            {
                "tests/test_a.py::test_one": {"REQ-UBI-01"},
                "tests/test_b.py::test_two": {"REQ-EVT-01"},
            },
        )
        assert report.ok
        assert report.uncovered == frozenset()
        assert report.untagged == ()
        assert report.unknown == frozenset()

    def test_flags_a_requirement_with_no_test(self) -> None:
        report = build_report(self._ids(), {"tests/test_a.py::test_one": {"REQ-UBI-01"}})
        assert not report.ok
        assert report.uncovered == frozenset({"REQ-EVT-01"})

    def test_flags_a_test_with_no_requirement(self) -> None:
        report = build_report(
            self._ids(),
            {
                "tests/test_a.py::test_one": {"REQ-UBI-01"},
                "tests/test_a.py::test_two": set(),
            },
        )
        assert report.untagged == ("tests/test_a.py::test_two",)

    def test_flags_an_unknown_requirement_reference(self) -> None:
        report = build_report(
            self._ids(),
            {"tests/test_a.py::test_one": {"REQ-UBI-01", "REQ-NOPE-99"}},
        )
        assert report.unknown == frozenset({"REQ-NOPE-99"})
        assert not report.ok

    def test_a_test_may_cover_multiple_requirements(self) -> None:
        report = build_report(
            self._ids(),
            {"tests/test_a.py::test_one": {"REQ-UBI-01", "REQ-EVT-01"}},
        )
        assert report.ok

    def test_several_tests_may_cover_one_requirement(self) -> None:
        report = build_report(
            self._ids(),
            {
                "tests/test_a.py::test_one": {"REQ-UBI-01"},
                "tests/test_b.py::test_two": {"REQ-UBI-01", "REQ-EVT-01"},
            },
        )
        assert report.covered == frozenset({"REQ-UBI-01", "REQ-EVT-01"})
        assert report.ok


class TestFormatReport:
    def test_lists_every_violation_kind(self) -> None:
        report = build_report(
            set(extract_requirement_ids(REQUIREMENTS)),
            {
                "tests/test_a.py::test_one": {"REQ-NOPE-99"},
                "tests/test_a.py::test_untagged": set(),
            },
        )
        text = format_report(report)
        assert "REQ-UBI-01" in text
        assert "REQ-EVT-01" in text
        assert "test_untagged" in text
        assert "REQ-NOPE-99" in text
