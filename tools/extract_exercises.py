"""Step 2.2 — Extract exercises, questions, and canonical answers.

Walks ch*.html for exercises (h3.h3e) and questions (p.question*), parses
answer.html + answer1.html for canonical answers, and joins them via the
chNqaM <-> chNqarM / chNexeM <-> chNexe_M anchor IDs.

Emits data/raw/exercises.json and data/raw/answers.json.

Usage:  python tools/extract_exercises.py
"""
from __future__ import annotations

import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from epub_reader import EpubReader, primary_epub  # noqa: E402

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE_DIR = os.path.join(REPO_ROOT, "source")
OUT_DIR = os.path.join(REPO_ROOT, "data", "raw")

HEADING_LEVEL = {"h3", "h4", "h5"}
SECTION_CLASSES = {"h3", "h4", "h5", "h5a", "h5i"}
QUESTION_CLASSES = {"question", "question1", "question2", "questiona"}
INSTRUCTION_CLASSES = {"noindentb", "noindentba"}
WORD_BANK_CLASS = "bq"
FREE_RESPONSE_CLASS = "dash"

# Anchor-ID patterns
PAT_EXERCISE = re.compile(r"ch(\d+)exe(\d+)$")
PAT_QUESTION = re.compile(r"ch(\d+)qa(\d+)$")
PAT_ANS_BLOCK = re.compile(r"ch(\d+)exe_(\d+)$")
PAT_ANS_ENTRY = re.compile(r"ch(\d+)qar(\d+)$")


def text_of(el) -> str:
    return re.sub(r"\s+", " ", "".join(el.itertext())).strip()


def cls(el) -> str:
    return el.get("class") or ""


def find_id(el, pattern) -> str:
    """Return the first id (in document order) matching the pattern."""
    for a in el.iter():
        i = a.get("id")
        if i and pattern.search(i):
            return i
    return ""


def load_sections(path: str) -> dict:
    with open(path, encoding="utf-8") as f:
        d = json.load(f)
    by_chapter = {}
    for s in d["sections"]:
        by_chapter.setdefault(s["chapterId"], []).append(s)
    return by_chapter


def exercise_kind(instruction: str, wordbank: list) -> str:
    ins = instruction.lower()
    if wordbank:
        return "choose-from-list"
    if "translate" in ins:
        return "translate"
    if "choose the correct" in ins or "choose either" in ins:
        return "multiple-choice"
    if "aloud" in ins:
        return "oral"
    if "answer the following questions" in ins:
        return "free-response"
    return "fill"


def extract_exercises(epub: EpubReader, sections_by_chapter: dict):
    """Return (exercises, questions) from the chapter files."""
    exercises = []
    questions = []
    chapter_files = [n for n in epub.names() if re.search(r"ch(\d+)\.html", n)]
    chapter_files.sort(key=lambda n: int(re.search(r"ch(\d+)", n).group(1)))

    for name in chapter_files:
        ch_num = int(re.search(r"ch(\d+)", name).group(1))
        ch_id = f"ch{ch_num}"
        root = epub.parse_xhtml(name)
        body = root.find("body")
        sections = sections_by_chapter.get(ch_id, [])
        sec_ptr = 0
        current_section_id = None
        current_exercise = None
        rc_counter = 0
        uq_counter = 0

        for el in body:
            tag = el.tag
            c = cls(el)

            if tag == "h3" and c == "h3e":
                ex_id = find_id(el, PAT_EXERCISE)
                if ex_id:
                    num = int(PAT_EXERCISE.search(ex_id).group(2))
                    number = f"{ch_num}.{num}"
                    kind = "unknown"
                else:
                    num = 0
                    number = ""
                    kind = "reading-comprehension"
                    rc_counter += 1
                    ex_id = f"{ch_id}_rc_{rc_counter}"
                current_exercise = {
                    "id": ex_id,
                    "chapterId": ch_id,
                    "sectionId": current_section_id,
                    "number": number,
                    "order": num,
                    "instruction": "",
                    "wordBank": [],
                    "kind": kind,
                    "freeform": False,
                }
                exercises.append(current_exercise)
                continue

            if tag in HEADING_LEVEL and c in SECTION_CLASSES:
                if sec_ptr < len(sections):
                    current_section_id = sections[sec_ptr]["id"]
                    sec_ptr += 1
                if tag == "h3":
                    current_exercise = None
                continue

            if tag != "p":
                continue

            q_ids = [a.get("id") for a in el.iter()
                     if a.get("id") and PAT_QUESTION.search(a.get("id"))]
            if q_ids:
                img = el.find("img")
                image_src = img.get("src") if img is not None else None
                prompt = text_of(el)
                glosses = [g.strip() for _, g in re.findall(r"\((\d+)\.\s*([^)]*)\)", prompt)]
                paragraph = len(q_ids) > 1
                for idx, q_id in enumerate(q_ids):
                    qm = PAT_QUESTION.search(q_id)
                    num = int(qm.group(2)) if qm else 0
                    blanks = 1 if paragraph else len(re.findall(r"_{3,}", prompt))
                    questions.append({
                        "id": q_id,
                        "exerciseId": current_exercise["id"] if current_exercise else None,
                        "chapterId": ch_id,
                        "number": num,
                        "prompt": prompt,
                        "imageSrc": image_src,
                        "blankCount": blanks,
                        "freeResponse": False,
                        "graded": True,
                        "gloss": glosses[idx] if idx < len(glosses) else None,
                        "blankIndex": idx + 1 if paragraph else None,
                    })
                continue

            if c in QUESTION_CLASSES:
                prompt = text_of(el)
                uq_counter += 1
                questions.append({
                    "id": f"{ch_id}_uq_{uq_counter}",
                    "exerciseId": current_exercise["id"] if current_exercise else None,
                    "chapterId": ch_id,
                    "number": 0,
                    "prompt": prompt,
                    "imageSrc": None,
                    "blankCount": len(re.findall(r"_{3,}", prompt)),
                    "freeResponse": False,
                    "graded": False,
                })
                continue

            if c in INSTRUCTION_CLASSES and current_exercise is not None \
                    and not current_exercise["instruction"]:
                current_exercise["instruction"] = text_of(el)
                continue

            if c == WORD_BANK_CLASS and current_exercise is not None:
                bank = [w.strip() for w in re.split(r",\s*", text_of(el)) if w.strip()]
                current_exercise["wordBank"] = bank
                continue

            if c == FREE_RESPONSE_CLASS:
                if questions and questions[-1]["chapterId"] == ch_id:
                    questions[-1]["freeResponse"] = True
                continue

    for ex in exercises:
        if ex["kind"] == "unknown":
            ex["kind"] = exercise_kind(ex["instruction"], ex["wordBank"])

    return exercises, questions


def extract_answers(epub: EpubReader):
    """Return (answers, exercise_blocks) from the answer-key files."""
    answers = []
    exercise_blocks = []
    bodies = []
    for name in ("ops/answer.html", "ops/answer1.html"):
        if name in epub.names():
            bodies.append(epub.parse_xhtml(name).find("body"))

    current_exercise = None
    for body in bodies:
        for el in body:
            tag = el.tag
            c = cls(el)
            if tag != "p":
                continue

            if c == "numlist":
                ex_id = find_id(el, PAT_ANS_BLOCK)
                ex_id = ex_id.replace("exe_", "exe") if ex_id else ""
                txt = text_of(el)
                freeform = "will vary" in txt.lower()
                num = txt.split()[0] if txt else ""
                current_exercise = {"id": ex_id, "number": num, "freeform": freeform}
                exercise_blocks.append(current_exercise)
                continue

            if c.startswith("numlistr"):
                a_id = find_id(el, PAT_ANS_ENTRY)
                am = PAT_ANS_ENTRY.search(a_id) if a_id else None
                raw = text_of(el)
                m = re.match(r"^\d+\.\s*", raw)
                body_text = raw[m.end():] if m else raw
                accepted = [a.strip() for a in re.split(r"\s+(?:OR|or)\s+", body_text)]
                explanation = None
                mm = re.search(r"\s*\(([^()]*)\)\s*$", body_text)
                if mm:
                    explanation = mm.group(1)
                question_id = f"ch{am.group(1)}qa{am.group(2)}" if am else None
                answers.append({
                    "id": a_id,
                    "questionId": question_id,
                    "exerciseId": current_exercise["id"] if current_exercise else None,
                    "number": int(am.group(2)) if am else 0,
                    "text": body_text,
                    "accepted": accepted,
                    "explanation": explanation,
                })
                continue

    return answers, exercise_blocks


def main() -> None:
    path = primary_epub(SOURCE_DIR)
    structure_path = os.path.join(OUT_DIR, "structure.json")
    sections_by_chapter = load_sections(structure_path)

    with EpubReader(path) as epub:
        exercises, questions = extract_exercises(epub, sections_by_chapter)
        answers, exercise_blocks = extract_answers(epub)

    freeform_by_ex = {b["id"]: b["freeform"] for b in exercise_blocks if b["id"]}
    for ex in exercises:
        ex["freeform"] = freeform_by_ex.get(ex["id"], False)

    q_ids = {q["id"] for q in questions if q["id"]}
    unmatched = [a for a in answers if a["questionId"] not in q_ids]
    answered_ids = {a["questionId"] for a in answers}
    unanswered = [q["id"] for q in questions if q["graded"] and q["id"] not in answered_ids]

    n_or = sum(1 for a in answers if len(a["accepted"]) > 1)
    n_expl = sum(1 for a in answers if a["explanation"])
    n_multiblank = sum(1 for q in questions if q["blankCount"] > 1)
    n_freeform = sum(1 for e in exercises if e["freeform"])
    n_graded = sum(1 for q in questions if q["graded"])
    n_ungraded = sum(1 for q in questions if not q["graded"])
    n_numbered = sum(1 for e in exercises if e["kind"] != "reading-comprehension")
    n_reading = sum(1 for e in exercises if e["kind"] == "reading-comprehension")

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(os.path.join(OUT_DIR, "exercises.json"), "w", encoding="utf-8") as f:
        json.dump({
            "meta": {"contentVersion": _cv(path)},
            "exercises": exercises,
            "questions": questions,
            "summary": {
                "exercises": len(exercises),
                "numbered": n_numbered,
                "readingComprehension": n_reading,
                "questions": len(questions),
                "gradedQuestions": n_graded,
                "ungradedQuestions": n_ungraded,
                "freeformExercises": n_freeform,
                "multiBlankQuestions": n_multiblank,
            },
        }, f, ensure_ascii=False, indent=2)

    with open(os.path.join(OUT_DIR, "answers.json"), "w", encoding="utf-8") as f:
        json.dump({
            "meta": {"contentVersion": _cv(path)},
            "answers": answers,
            "summary": {
                "answers": len(answers),
                "orAlternatives": n_or,
                "explanations": n_expl,
            },
        }, f, ensure_ascii=False, indent=2)

    print(f"exercises={len(exercises)} (numbered={n_numbered} "
          f"readingComprehension={n_reading})")
    print(f"questions={len(questions)} (graded={n_graded} "
          f"ungraded={n_ungraded})")
    print(f"answers={len(answers)}")
    print(f"freeformExercises={n_freeform} orAlternatives={n_or} "
          f"explanations={n_expl} multiBlank={n_multiblank}")
    print(f"unmatchedAnswers={len(unmatched)} unansweredGraded={len(unanswered)}")

    assert len(exercises) == 281, f"expected 281 exercises, got {len(exercises)}"
    assert n_numbered == 251, f"expected 251 numbered, got {n_numbered}"
    assert n_reading == 30, f"expected 30 reading-comprehension, got {n_reading}"
    assert n_graded == 3020, f"expected 3020 graded questions, got {n_graded}"
    assert n_ungraded == 276, f"expected 276 ungraded questions, got {n_ungraded}"
    assert len(answers) == 3019, f"expected 3019 answers, got {len(answers)}"
    assert len(unmatched) == 0, f"{len(unmatched)} unmatched answers"
    print("OK: 281 exercises (251+30), 3020 graded + 276 ungraded questions, "
          "3019 answers, 0 unmatched")


def _cv(path: str) -> str:
    import hashlib
    return hashlib.md5(open(path, "rb").read()).hexdigest()[:12]


if __name__ == "__main__":
    main()


