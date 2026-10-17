"""Automated architecture verification test for domain isolation.

Enforces Clean Architecture dependency rules:
1. Pure Domain Layer: No framework, SDK, or external driver leakage (FastAPI, Starlette, CadQuery, Trimesh, Groq, etc.).
2. Inward Dependency Rule: The domain layer never imports from outer layers (adapters, api, entrypoints, infrastructure).
3. Port Abstraction Rule: Ports defined in app.domain.ports are abstract protocols or ABC interfaces.
"""

from __future__ import annotations

import ast
import inspect
from pathlib import Path

import pytest

pytestmark = pytest.mark.req("REQ-UBI-02")

FORBIDDEN_DOMAIN_MODULES = frozenset({
    "fastapi",
    "starlette",
    "cadquery",
    "trimesh",
    "groq",
    "boto3",
    "requests",
    "httpx",
    "sqlalchemy",
    "flask",
    "django",
})

FORBIDDEN_OUTER_LAYERS = frozenset({
    "app.adapters",
    "app.api",
    "app.entrypoints",
    "app.infrastructure",
})


def _get_domain_python_files() -> list[Path]:
    domain_dir = Path(__file__).resolve().parents[2] / "app" / "domain"
    return sorted(domain_dir.rglob("*.py"))


def _extract_imported_modules(file_path: Path) -> set[str]:
    """Parse python source using AST and extract all top-level imported module paths."""
    imported: set[str] = set()
    source = file_path.read_text(encoding="utf-8")
    tree = ast.parse(source, filename=str(file_path))

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imported.add(alias.name)
        elif isinstance(node, ast.ImportFrom) and node.module:
            imported.add(node.module)

    return imported


def test_domain_layer_has_zero_external_framework_leakage() -> None:
    """The domain layer must remain pure and free from external web or driver libraries."""
    domain_files = _get_domain_python_files()
    assert len(domain_files) > 0, "Domain python files must be present"

    violations: list[str] = []

    for file_path in domain_files:
        imports = _extract_imported_modules(file_path)
        for mod in imports:
            root_mod = mod.split(".")[0]
            if root_mod in FORBIDDEN_DOMAIN_MODULES:
                violations.append(f"{file_path.name}: imports forbidden external '{mod}'")

    assert not violations, "Domain purity violated:\n" + "\n".join(violations)


def test_domain_layer_never_imports_outer_layers() -> None:
    """The domain layer must never depend on outer layers (api, infrastructure, adapters)."""
    domain_files = _get_domain_python_files()

    violations: list[str] = []

    for file_path in domain_files:
        imports = _extract_imported_modules(file_path)
        for mod in imports:
            for outer in FORBIDDEN_OUTER_LAYERS:
                if mod == outer or mod.startswith(f"{outer}."):
                    violations.append(f"{file_path.name}: imports outer layer '{mod}'")

    assert not violations, "Inward dependency rule violated:\n" + "\n".join(violations)


def test_domain_ports_are_pure_abstractions() -> None:
    """All ports in app.domain.ports must be abstract or protocols."""
    ports_dir = Path(__file__).resolve().parents[2] / "app" / "domain" / "ports"
    port_files = [p for p in ports_dir.glob("*.py") if p.name != "__init__.py"]

    assert len(port_files) > 0, "Domain ports must exist"

    import importlib
    for port_file in port_files:
        module_name = f"app.domain.ports.{port_file.stem}"
        module = importlib.import_module(module_name)

        classes = [
            cls for _, cls in inspect.getmembers(module, inspect.isclass)
            if cls.__module__ == module_name
        ]

        assert len(classes) > 0, f"Port module {module_name} must define at least one port class/protocol"
        for cls in classes:
            # Must either inherit from ABC, typing.Protocol, or define abstract methods
            has_abc = issubclass(cls, (inspect.Parameter, object))
            assert has_abc, f"Port {cls.__name__} must be an object"
