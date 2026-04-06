"""Sandbox tests for agent workspace file tool."""

from pathlib import Path

import pytest

from app.workflows.builtin_tools import _safe_workspace_file


def test_safe_workspace_reads_allowed(tmp_path: Path) -> None:
    root = tmp_path / "ws"
    root.mkdir()
    f = root / "note.txt"
    f.write_text("hello", encoding="utf-8")
    got = _safe_workspace_file(root, "note.txt")
    assert got == f.resolve()


def test_safe_workspace_rejects_parent_parts(tmp_path: Path) -> None:
    root = tmp_path / "ws"
    root.mkdir()
    with pytest.raises(ValueError, match=r"\.\."):
        _safe_workspace_file(root, "a/../../etc/passwd")


def test_safe_workspace_rejects_symlink_outside(tmp_path: Path) -> None:
    root = tmp_path / "ws"
    root.mkdir()
    outside = tmp_path / "secret.txt"
    outside.write_text("x", encoding="utf-8")
    try:
        (root / "alias.txt").symlink_to(outside)
    except OSError:
        pytest.skip("symlinks not supported")
    with pytest.raises(PermissionError):
        _safe_workspace_file(root, "alias.txt")
