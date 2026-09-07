"""ParametriCAD AI backend package."""

__version__ = "1.0.0"

GEOMETRY_ENGINE_REVISION = "1"
"""Bumped whenever a change alters generated geometry.

It is folded into every artifact's content address, so a recipe fix invalidates
previously cached models instead of silently serving stale ones.
"""
