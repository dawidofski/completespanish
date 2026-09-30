"""Step 2.4 — Assemble clean, import-ready data/book.json + validation.

Loads the raw outputs, applies the reclassification fixes (note-like `imagen`
blocks -> note; `tableImage` -> `table`; drops image-based questions from
theory), assembles one content file, and validates referential integrity.

Usage:  python tools/prepare_data.py
"""
from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime, timezone

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DIR = os.path.join(REPO_ROOT, "data", "raw")
OUT_PATH = os.path.join(REPO_ROOT, "data", "book.json")
REVIEW_DIR = os.path.join(REPO_ROOT, "data", "review")


def load(name: str):
    with open(os.path.join(RAW_DIR, name), encoding="utf-8") as f:
        return json.load(f)


def main() -> None:
    structure = load("structure.json")
    exercises = load("exercises.json")
    answers = load("answers.json")

    parts = structure["parts"]
    chapters = structure["chapters"]
    sections = structure["sections"]

    # --- clean theory blocks ---
    theory_blocks = []
    reclassified = 0
    removed_image_q = 0
    for b in structure["theoryBlocks"]:
        if b["type"] == "tableImage":
            if not b.get("src"):
                b = dict(b, type="note")  # note-like block misusing imagen class
                reclassified += 1
            elif re.fullmatch(r"\d+[.)]?", (b.get("text") or "").strip()):
                removed_image_q += 1  # image-based question -> already in questions
                continue
            else:
                b = dict(b, type="table")
        theory_blocks.append(b)

    exercises_list = exercises["exercises"]
    questions = exercises["questions"]
    answers_list = answers["answers"]

    book = {
        "meta": {
            "title": structure["meta"]["title"],
            "contentVersion": structure["meta"]["contentVersion"],
            "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        },
        "parts": parts,
        "chapters": chapters,
        "sections": sections,
        "theoryBlocks": theory_blocks,
        "exercises": exercises_list,
        "questions": questions,
        "answers": answers_list,
    }

    # --- validation ---
    section_ids = {s["id"] for s in sections}
    chapter_ids = {c["id"] for c in chapters}
    ex_ids = {e["id"] for e in exercises_list if e["id"]}
    q_ids = {q["id"] for q in questions if q["id"]}
    dangling = []
    for tb in theory_blocks:
        if tb.get("sectionId") and tb["sectionId"] not in section_ids:
            dangling.append(f"theoryBlock {tb['id']} -> sectionId {tb['sectionId']}")
        if tb["chapterId"] not in chapter_ids:
            dangling.append(f"theoryBlock {tb['id']} -> chapterId {tb['chapterId']}")
    for ex in exercises_list:
        if ex["chapterId"] not in chapter_ids:
            dangling.append(f"exercise {ex['id']} -> chapterId {ex['chapterId']}")
        if ex.get("sectionId") and ex["sectionId"] not in section_ids:
            dangling.append(f"exercise {ex['id']} -> sectionId {ex['sectionId']}")
    for q in questions:
        if q.get("exerciseId") and q["exerciseId"] not in ex_ids:
            dangling.append(f"question {q['id']} -> exerciseId {q.get('exerciseId')}")
    for a in answers_list:
        if a["questionId"] not in q_ids:
            dangling.append(f"answer {a['id']} -> questionId {a['questionId']}")

    sample = " ".join((tb.get("text") or "") for tb in theory_blocks[:800])
    sample += " ".join((q.get("prompt") or "") for q in questions[:800])
    accent_counts = {c: sample.count(c) for c in "áéíóúñ¿¡ÁÉÍÓÚÑ"}
    accents_present = any(v > 0 for v in accent_counts.values())

    n_tables = sum(1 for tb in theory_blocks if tb["type"] == "table")
    n_notes = sum(1 for tb in theory_blocks if tb["type"] == "note")
    n_freeform = sum(1 for e in exercises_list if e.get("freeform"))
    n_graded = sum(1 for q in questions if q.get("graded"))
    n_q_images = sum(1 for q in questions if q.get("imageSrc"))

    summary = {
        "parts": len(parts),
        "chapters": len(chapters),
        "sections": len(sections),
        "theoryBlocks": len(theory_blocks),
        "tables": n_tables,
        "notes": n_notes,
        "questionImages": n_q_images,
        "exercises": len(exercises_list),
        "questions": len(questions),
        "gradedQuestions": n_graded,
        "answers": len(answers_list),
        "freeformExercises": n_freeform,
        "reclassifiedNotes": reclassified,
        "removedImageQuestions": removed_image_q,
        "danglingRefs": len(dangling),
        "accentsPresent": accents_present,
    }
    book["summary"] = summary

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(book, f, ensure_ascii=False, indent=2)

    # --- validation report ---
    os.makedirs(REVIEW_DIR, exist_ok=True)
    lines = [
        "# Validation report — data/book.json",
        "",
        f"- Content version: `{book['meta']['contentVersion']}`",
        f"- Generated: {book['meta']['generatedAt']}",
        "",
        "## Counts",
        "",
    ]
    for k, v in summary.items():
        lines.append(f"- {k}: {v}")
    lines += [
        "",
        "## Accent sample counts",
        "",
        "`" + " ".join(f"{c}={n}" for c, n in accent_counts.items()) + "`",
        "",
        "## Dangling references",
        "",
    ]
    if dangling:
        lines += [f"- {d}" for d in dangling[:50]]
        if len(dangling) > 50:
            lines.append(f"- ... and {len(dangling) - 50} more")
    else:
        lines.append("- none")
    lines.append("")
    with open(os.path.join(REVIEW_DIR, "validation.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print("counts:", json.dumps(summary, ensure_ascii=False))
    print(f"dangling={len(dangling)} accentsPresent={accents_present}")
    print(f"wrote {OUT_PATH}")

    assert len(dangling) == 0, f"{len(dangling)} dangling references"
    assert accents_present, "Spanish accents missing"
    assert len(exercises_list) == 281
    assert len(questions) == 3296
    assert len(answers_list) == 3019
    assert n_tables == 1140
    print("OK: 0 dangling references, accents intact, counts verified")


if __name__ == "__main__":
    main()

