"""Modular deterministic validation runner package."""

from __future__ import annotations

from app.domain.geometry.runner.base import BaseCheck, ValidationContext
from app.domain.geometry.runner.registry import CheckRegistry, get_default_registry
from app.domain.geometry.runner.runner import ValidationRunner
from app.domain.geometry.runner.types import (
    CheckId,
    CheckResult,
    CheckStatus,
    DualContractReport,
)

__all__ = [
    "BaseCheck",
    "CheckId",
    "CheckRegistry",
    "CheckResult",
    "CheckStatus",
    "DualContractReport",
    "ValidationContext",
    "ValidationRunner",
    "get_default_registry",
]
