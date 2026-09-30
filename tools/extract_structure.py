"""Step 2.1 — Extract the book skeleton + theory from the publisher EPUB.

Emits data/raw/structure.json (parts, chapters, sections, theory blocks).
Usage:  python tools/extract_structure.py
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import sys
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from epub_reader import EpubReader, primary_epub  # noqa: E402

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE_DIR = os.path.join(REPO_ROOT, "source")
OUT_DIR = os.path.join(REPO_ROOT, "data", "raw")

HEADING_LEVEL = {"h3": 1, "h4": 2, "h5": 3}

PARA_CLASSES = {
    "noindent", "indent", "indentb", "noindentt", "noindenth",
    "centera", "center", "noindentba", "noindentb",
    "bull-list", "bull-lista", "bull-listb", "bull-listtb",
    "bull-listn", "bull-listnb", "bull-listnn", "bullsn", "bullsni",
}
TABLE_IMAGE_CLASSES = {
    "imagec", "imagei", "imageia", "imageiaa", "imageiab", "imageiat",
    "imageit", "imagen",
}
TIP_CLASS = "image-t"


def text_of(el) -> str:
    return re.sub(r"\s+", " ", "".join(el.itertext())).strip()


def inner_html(el) -> str:
    s = ET.tostring(el, encoding="unicode")
    m = re.match(r"^<[^>]+>(.*)</[^>]+>$", s, re.DOTALL)
    return m.group(1) if m else "".join(el.itertext())


def cls(el) -> str:
    return el.get("class") or ""


def part_ranges(epub: EpubReader) -> dict:
    """Map chapter number -> part id, derived from contents.html."""
    root = epub.parse_xhtml("ops/contents.html")
    mapping = {}
    current = None
    for el in root.iter("p"):
        c = el.get("class") or ""
        href = ""
        for a in el.findall("a"):
            h = a.get("href")
            if h:
                href = h
                break
        if not href:
            continue
        if c.startswith("toc-part"):
            m = re.search(r"part(\d+)\.html", href)
            if m:
                current = f"part{m.group(1)}"
        elif c in ("toc-chap", "toc-chapa"):
            m = re.search(r"ch(\d+)\.html", href)
            if m and current:
                mapping[int(m.group(1))] = current
    return mapping


def main() -> None:
    path = primary_epub(SOURCE_DIR)
    print(f"Primary EPUB: {os.path.basename(path)}")

    with EpubReader(path) as epub:
        cv = hashlib.md5(open(path, "rb").read()).hexdigest()[:12]

        parts = []
        part_files = [n for n in epub.names() if re.search(r"part(\d+)\.html", n)]
        part_files.sort(key=lambda n: int(re.search(r"part(\d+)", n).group(1)))
        for order, name in enumerate(part_files, 1):
            root = epub.parse_xhtml(name)
            number = text_of(root.find(".//h2[@class='h2p']")) or ""
            title = text_of(root.find(".//h2[@class='h2pp']")) or ""
            pid = re.search(r"part(\d+)", name).group(0)
            parts.append({"id": pid, "number": number, "title": title, "order": order})

        part_by_ch = part_ranges(epub)

        chapters = []
        sections = []
        theory_blocks = []
        chapter_files = [n for n in epub.names() if re.search(r"ch(\d+)\.html", n)]
        chapter_files.sort(key=lambda n: int(re.search(r"ch(\d+)", n).group(1)))

        tb_id = 0
        for ch_order, name in enumerate(chapter_files, 1):
            ch_num = int(re.search(r"ch(\d+)", name).group(1))
            root = epub.parse_xhtml(name)
            title_el = root.find(".//h2[@class='h2-chap']")
            if title_el is None:
                # Chapter 15 uses h2.h2pp instead of h2.h2-chap (publisher quirk)
                title_el = root.find(".//h2[@class='h2pp']")
            title = text_of(title_el) if title_el is not None else ""
            ch_id = f"ch{ch_num}"
            chapters.append({
                "id": ch_id,
                "partId": part_by_ch.get(ch_num),
                "number": ch_num,
                "title": title,
                "order": ch_order,
            })

            body = root.find("body")
            stack = []
            sec_order = 0
            for el in body:
                tag = el.tag
                c = cls(el)
                if tag == "h3" and c == "h3e":
                    continue  # exercise heading -> Step 2.2
                if tag in HEADING_LEVEL and c in ("h3", "h4", "h5", "h5a", "h5i"):
                    level = HEADING_LEVEL[tag]
                    while stack and stack[-1]["level"] >= level:
                        stack.pop()
                    parent = stack[-1] if stack else None
                    sec_order += 1
                    sid = el.get("id") or f"{ch_id}_sec_{sec_order}"
                    sections.append({
                        "id": sid,
                        "chapterId": ch_id,
                        "parentId": parent["id"] if parent else None,
                        "level": level,
                        "title": text_of(el),
                        "order": sec_order,
                    })
                    stack.append({"level": level, "id": sid})
                    continue
                if tag != "p":
                    continue
                if c in PARA_CLASSES:
                    ttype = "note" if text_of(el).upper().startswith("NOTE") else "paragraph"
                    if c.startswith(("bull", "bulls")):
                        ttype = "list"
                elif c in TABLE_IMAGE_CLASSES:
                    ttype = "tableImage"
                elif c == TIP_CLASS:
                    ttype = "tip"
                else:
                    continue  # question/dash/instruction -> Step 2.2
                tb_id += 1
                src = None
                if ttype == "tableImage":
                    img = el.find("img")
                    src = img.get("src") if img is not None else None
                theory_blocks.append({
                    "id": f"{ch_id}_tb_{tb_id}",
                    "chapterId": ch_id,
                    "sectionId": stack[-1]["id"] if stack else None,
                    "type": ttype,
                    "order": tb_id,
                    "text": text_of(el),
                    "html": inner_html(el),
                    "src": src,
                })

    summary = {
        "parts": len(parts),
        "chapters": len(chapters),
        "sections": len(sections),
        "theoryBlocks": len(theory_blocks),
    }
    data = {
        "meta": {
            "title": "Complete Spanish Step-by-Step",
            "contentVersion": cv,
            "source": os.path.basename(path),
        },
        "parts": parts,
        "chapters": chapters,
        "sections": sections,
        "theoryBlocks": theory_blocks,
        "summary": summary,
    }
    os.makedirs(OUT_DIR, exist_ok=True)
    out_path = os.path.join(OUT_DIR, "structure.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print("Summary:", json.dumps(summary, ensure_ascii=False))
    print(f"Wrote {out_path}")

    assert len(parts) == 6, f"expected 6 parts, got {len(parts)}"
    assert len(chapters) == 30, f"expected 30 chapters, got {len(chapters)}"
    print("OK: 6 parts, 30 chapters")

    from collections import Counter
    dist = Counter(tb["type"] for tb in theory_blocks)
    print("Theory block types:", dict(dist))

    ch5 = next((c for c in chapters if c["number"] == 5), None)
    if ch5:
        print(f"\nSample — Chapter 5: {ch5['title']}")
        for s in [x for x in sections if x["chapterId"] == "ch5"][:12]:
            print(f"  {'  ' * (s['level'] - 1)}[L{s['level']}] {s['id']}  {s['title']}")


if __name__ == "__main__":
    main()

