"""Best-effort text extraction from common document uploads (no OCR for scanned PDFs)."""

from __future__ import annotations

import io
import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

# Extensions we accept (lowercase, with dot).
ALLOWED_DOCUMENT_SUFFIXES: frozenset[str] = frozenset(
    {
        ".txt",
        ".text",
        ".md",
        ".markdown",
        ".csv",
        ".pdf",
        ".docx",
        ".doc",
        ".rtf",
        ".odt",
        ".html",
        ".htm",
    }
)


def normalize_upload_filename(name: str | None) -> str:
    if not name or not str(name).strip():
        return "upload.bin"
    base = Path(str(name).strip()).name
    return base[:200] if len(base) > 200 else base


def extract_document_text(filename: str, data: bytes, *, max_chars: int) -> str:
    """
    Return UTF-8 text from supported formats. Result may be truncated by caller.
    Raises ValueError with a short user-facing reason if unsupported or empty.
    """
    if not data:
        raise ValueError("Empty file.")

    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_DOCUMENT_SUFFIXES:
        raise ValueError(
            f"Unsupported file type {suffix or '(none)'}. "
            f"Try: {', '.join(sorted(ALLOWED_DOCUMENT_SUFFIXES))}."
        )

    text: str
    if suffix in (".txt", ".text", ".md", ".markdown", ".csv"):
        text = data.decode("utf-8", errors="replace")
    elif suffix in (".html", ".htm"):
        text = _extract_html(data)
    elif suffix == ".pdf":
        text = _extract_pdf(data)
    elif suffix == ".docx":
        text = _extract_docx(data)
    elif suffix == ".doc":
        text = _extract_doc_or_docx(data)
    elif suffix == ".rtf":
        text = _extract_rtf(data)
    elif suffix == ".odt":
        text = _extract_odt(data)
    else:
        raise ValueError(f"Unsupported type {suffix}.")

    text = text.strip()
    if not text:
        raise ValueError(
            "No extractable text found (e.g. scanned PDF with no text layer, or empty document)."
        )

    if len(text) > max_chars:
        text = text[:max_chars].rstrip() + "\n\n[…extract truncated by server limit…]"
    return text


def _extract_html(data: bytes) -> str:
    raw = data.decode("utf-8", errors="replace")
    raw = re.sub(r"(?is)<script[^>]*>.*?</script>", " ", raw)
    raw = re.sub(r"(?is)<style[^>]*>.*?</style>", " ", raw)
    raw = re.sub(r"<[^>]+>", " ", raw)
    raw = re.sub(r"\s+", " ", raw)
    return raw.strip()


def _extract_pdf(data: bytes) -> str:
    try:
        from pypdf import PdfReader
    except ImportError as e:  # pragma: no cover
        raise ValueError("PDF support unavailable (pypdf not installed).") from e

    reader = PdfReader(io.BytesIO(data))
    parts: list[str] = []
    for page in reader.pages:
        try:
            parts.append(page.extract_text() or "")
        except Exception:  # noqa: BLE001
            parts.append("")
    return "\n".join(parts)


_W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"


def _extract_docx(data: bytes) -> str:
    """DOCX is a ZIP of XML; extract w:t text runs without python-docx/lxml."""
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            xml_bytes = zf.read("word/document.xml")
    except (zipfile.BadZipFile, KeyError) as e:
        raise ValueError("Invalid or empty DOCX file.") from e

    root = ET.fromstring(xml_bytes)
    tag_t = f"{{{_W_NS}}}t"
    parts: list[str] = []
    for el in root.iter(tag_t):
        if el.text:
            parts.append(el.text)
        if el.tail:
            parts.append(el.tail)
    return "\n".join(parts)


def _extract_doc_or_docx(data: bytes) -> str:
    """Legacy .doc is not supported; try DOCX in case of misnamed file."""
    try:
        return _extract_docx(data)
    except Exception:
        raise ValueError(
            "Old Word .doc files are not supported. Please save or export as **DOCX** or **PDF**, then upload again."
        ) from None


def _extract_rtf(data: bytes) -> str:
    try:
        from striprtf.striprtf import rtf_to_text
    except ImportError as e:  # pragma: no cover
        raise ValueError("RTF support unavailable (striprtf not installed).") from e

    return rtf_to_text(data.decode("utf-8", errors="replace"))


def _extract_odt(data: bytes) -> str:
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            xml_bytes = zf.read("content.xml")
    except (zipfile.BadZipFile, KeyError) as e:
        raise ValueError("Could not read ODT (OpenDocument) content.") from e

    root = ET.fromstring(xml_bytes)
    chunks: list[str] = []

    def collect(el: ET.Element) -> None:
        if el.text and el.text.strip():
            chunks.append(el.text.strip())
        for child in el:
            collect(child)
        if el.tail and el.tail.strip():
            chunks.append(el.tail.strip())

    collect(root)
    return "\n".join(chunks)
