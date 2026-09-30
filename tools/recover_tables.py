"""Step 2.3 — Recover image-based theory tables.

1. Extract the table images (t*.jpg) referenced by theory blocks into
   data/tables/ (faithful fallback for display).
2. Build data/raw/tables.json inventory (tableImage -> chapter/section/src).
3. Emit data/review/tables.md flagging tables for manual text transcription.
4. Dump the PDF-reflow EPUB's chapter text as a transcription reference.

Usage:  python tools/recover_tables.py
"""
from __future__ import annotations

import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from epub_reader import EpubReader, find_epubs, primary_epub  # noqa: E402

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE_DIR = os.path.join(REPO_ROOT, "source")
RAW_DIR = os.path.join(REPO_ROOT, "data", "raw")
TABLES_DIR = os.path.join(REPO_ROOT, "data", "tables")
REVIEW_DIR = os.path.join(REPO_ROOT, "data", "review")


def text_of(el) -> str:
    return re.sub(r"\s+", " ", "".join(el.itertext())).strip()


def main() -> None:
    primary = primary_epub(SOURCE_DIR)
    secondary = None
    for p in find_epubs(SOURCE_DIR):
        if p != primary:
            secondary = p
            break

    with open(os.path.join(RAW_DIR, "structure.json"), encoding="utf-8") as f:
        structure = json.load(f)

    sections = {s["id"]: s for s in structure["sections"]}
    chapters = {c["id"]: c for c in structure["chapters"]}
    table_blocks = [b for b in structure["theoryBlocks"] if b["type"] == "tableImage"]

    # 1) Extract images (faithful fallback)
    os.makedirs(TABLES_DIR, exist_ok=True)
    srcs = sorted({b["src"] for b in table_blocks if b.get("src")})
    with EpubReader(primary) as epub:
        names = set(epub.names())
        for src in srcs:
            entry = f"ops/{src}"
            if entry in names:
                data = epub.read_bytes(entry)
                with open(os.path.join(TABLES_DIR, src), "wb") as f:
                    f.write(data)

    # 2) Inventory (only blocks that actually have an image)
    tables = []
    no_src_blocks = []
    for b in table_blocks:
        if not b.get("src"):
            no_src_blocks.append(b)
            continue
        sec = sections.get(b.get("sectionId")) or {}
        tables.append({
            "id": b["id"],
            "chapterId": b["chapterId"],
            "sectionId": b.get("sectionId"),
            "sectionTitle": sec.get("title"),
            "order": b["order"],
            "src": b.get("src"),
            "imageFile": b.get("src"),
            "recoveredText": None,
            "confidence": None,
        })

    os.makedirs(RAW_DIR, exist_ok=True)
    with open(os.path.join(RAW_DIR, "tables.json"), "w", encoding="utf-8") as f:
        json.dump({
            "meta": {"contentVersion": structure["meta"]["contentVersion"]},
            "tables": tables,
            "summary": {"tables": len(tables), "images": len(srcs)},
        }, f, ensure_ascii=False, indent=2)

    # 3) Review list (grouped by chapter)
    os.makedirs(REVIEW_DIR, exist_ok=True)
    by_chapter = {}
    for t in tables:
        by_chapter.setdefault(t["chapterId"], []).append(t)
    lines = [
        "# Tables needing text transcription (review)",
        "",
        f"Total: {len(tables)} tables. Displayed as images until transcribed.",
        "Each entry: image file, section, and (where available) a best-effort",
        "text reference is in data/raw/reflow_text.json.",
        "",
    ]
    for ch_id in sorted(by_chapter, key=lambda x: int(re.search(r"\d+", x).group())):
        ch = chapters.get(ch_id) or {}
        lines.append(f"## {ch.get('number', '?')} — {ch.get('title', ch_id)}")
        for t in by_chapter[ch_id]:
            sec = t.get("sectionTitle") or "(no section)"
            lines.append(f"- `{t['src']}` — {sec}")
        lines.append("")
    if no_src_blocks:
        lines.append("## Note-like blocks misclassified as tableImage (reclassify in 2.4)")
        for b in no_src_blocks:
            lines.append(f"- `{b['id']}` — {(b.get('text') or '')[:80]}")
        lines.append("")
    with open(os.path.join(REVIEW_DIR, "tables.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    # 4) PDF-reflow text dump (transcription reference)
    reflow = {}
    if secondary:
        with EpubReader(secondary) as epub:
            names = [n for n in epub.names() if re.search(r"index_split_\d+\.html", n)]
            names.sort(key=lambda n: int(re.search(r"(\d+)", n).group(1)))
            for n in names:
                raw = epub.read(n)
                if len(raw) < 2000:
                    continue  # blank/front pages
                root = epub.parse_xhtml(n)
                body = root.find("body")
                reflow[n] = text_of(body) if body is not None else ""
        with open(os.path.join(RAW_DIR, "reflow_text.json"), "w", encoding="utf-8") as f:
            json.dump(reflow, f, ensure_ascii=False, indent=2)

    print(f"images={len(srcs)} tables={len(tables)} "
          f"noSrcBlocks={len(no_src_blocks)} reflowFiles={len(reflow)}")
    assert len(srcs) == 1148, f"expected 1148 images, got {len(srcs)}"
    assert len(tables) == 1148, f"expected 1148 tables, got {len(tables)}"
    print("OK: 1148 table images extracted; "
          f"{len(no_src_blocks)} note-like blocks flagged for reclassification")


if __name__ == "__main__":
    main()

