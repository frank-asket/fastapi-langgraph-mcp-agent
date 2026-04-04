"""Shared paths and message delimiter constants."""

from pathlib import Path

PACKAGE_ROOT = Path(__file__).resolve().parent
STATIC_DIR = PACKAGE_ROOT / "static"

PROFILE_MARK_END = "---end-learner-profile---"
ATTACH_MARK_END = "---end-attached-document---"
