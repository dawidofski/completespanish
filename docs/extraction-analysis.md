# Extraction Analysis — Complete Spanish Step-by-Step

Authoritative spec for the Python extraction (Phase 2) and the data model
(Phase 3). Anyone can build the parser from this document alone.

## 1. Purpose

Document the two source EPUBs, the chosen strategy, the semantic markup to
parse, the anchor-link scheme that joins questions to answers, the scale of
content, and every special case the parser must handle.

## 2. Source EPUBs

| File | Size | Nature | Role |
|---|---|---|---|
| `Complete Spanish step-by-step _ the fastest way to achieve -- Bregstein, Barbara .epub` | 61.5 MB | **Official McGraw-Hill EPUB** (Adept). Semantic HTML text layer + page images. | **Primary** |
| `Complete Spanish Step-by-step.epub` | 998 KB | Calibre PDF-reflow. All text selectable, generic `calibre*` classes, reflow artifacts. | **Secondary** |

Why the "image" EPUB is primary: it has real heading hierarchy (`h2/h3/h4/h5`),
named CSS classes for every element, and **explicit question↔answer↔exercise
anchor links** — everything a learning app needs. Its only gap is that
conjugation charts / vocabulary lists / example tables are rendered as images.

The PDF-reflow EPUB is secondary: it contains those same tables as (linearized)
text, so it is used to recover table content without OCR.

## 3. Strategy

1. Parse the **official EPUB** for structure, theory, exercises, questions, and
   answers (all text + links).
2. Use the **PDF-reflow EPUB** to recover text for table-like content that the
   official EPUB stores as images; flag anything unrecoverable for review.
3. Emit one import-ready `data/book.json` with a content-version id.

## 4. Book hierarchy

```
Book
 └── Part (6)            part1..6.html       h2.h2p (numeral) + h2.h2pp (title)
      └── Chapter (30)   ch1..30.html        h2.h2c (number) + h2.h2-chap (title)
           └── Section           h3.h3   id=chNlevM
                └── Subsection    h4.h4   id=chNlevM
                     └── Sub-subsection  h5.h5 / h5.h5a / h5.h5i
```

Parts (exact titles):

- **I** — Elements of a Sentence
- **II** — Objects, Reflexive Verbs, and the Present Subjunctive
- **III** — Preterit Tense, Imperfect Tense, and Double Object Pronouns
- **IV** — *Ser* and *Estar*; Present, Preterit, and Imperfect Tenses; Progressive Tenses; Present Subjunctive; Commands
- **V** — Nouns, Articles, Adjectives, Pronouns; Present and Past Perfect Tenses
- **VI** — Future and Conditional Tenses; Past Subjunctive; Idioms

Other files: `contents.html` (TOC), `preface.html`, `app.html` (List of Verbs),
`answer.html` + `answer1.html` (Answer Key — split; `answer.html` ≈ ch1–14,
`answer1.html` = ch15–30), `index.html`, `copyright.html`, `title.html`,
`cover.html`.

## 5. Semantic class map (parser targets)

### Structure
| Class | Meaning | ID pattern |
|---|---|---|
| `h2.h2p` | Part numeral (`span.chap1` = Roman) | `partN` |
| `h2.h2pp` | Part title | — |
| `h2.h2c` | Chapter number (`span.chap1`) | `chN` |
| `h2.h2-chap` | Chapter title | — |
| `h3.h3` | Section heading | `chNlevM` |
| `h4.h4` | Subsection heading | `chNlevM` |
| `h5.h5`, `h5.h5a`, `h5.h5i` | Sub-subsection / minor heading | — |

### Theory blocks
| Class | Meaning |
|---|---|
| `p.noindent`, `p.indent`, `p.indentb`, `p.noindentt`, `p.noindenth` | body paragraph |
| `p.noindentba` | note text (with `small` NOTE: label) |
| `p.bq` | word bank (verb list for choose-from-list) |
| `p.imagei`, `p.imagen`, `p.imageiab`, `p.imageiat` | content image (table/chart) → `t*.jpg` |
| `p.image-t` | tip box (`tip.jpg`) |
| `span.underline` | underlined emphasis (stress marking) |

### Exercises & questions
| Class | Meaning | ID pattern |
|---|---|---|
| `h3.h3e` | Exercise heading ("Exercise N.M") | `chNexeM` |
| `p.noindentb`, `p.noindentba` | exercise instruction (italic) | — |
| `p.question`, `p.question1`, `p.question2` | question (with `_____________` blanks) | `chNqaM` |
| `p.dash` | free-response blank line (no graded answer) | — |

### Answer key
| Class | Meaning | ID pattern |
|---|---|---|
| `h2.h2a` | "Answer Key" | `answer` |
| `p.akcn` | chapter number | — |
| `p.akct` | chapter title | — |
| `p.numlist` | exercise number (e.g. "1.1") | `chNexe_M` |
| `p.numlistr1/r2/r3` | answer entry | `chNqarM` |
| `p.numlistrr1/rr2/rr3` | answer entry **with explanation** | `chNqarM` |
| `<small>OR</small>` | alternative accepted answer | — |

## 6. Anchor-link scheme (joins questions ↔ answers ↔ exercises)

- **Question → Answer:** question `id="chNqaM"` links to `answer.html#chNqarM`; the answer `id="chNqarM"` links back to `chN.html#chNqaM`. `N` = chapter, `M` = 1-based question number.
- **Exercise → Answer block:** exercise `id="chNexeM"` links to `answer.html#chNexe_M`; the block `id="chNexe_M"` links back.
- **Section:** `id="chNlevM"` (M = 1-based section order within the chapter).

The parser joins by parsing these IDs, never by position or heuristics.

## 7. Scale inventory (measured)

| Item | Count |
|---|---|
| Parts | 6 |
| Chapters | 30 |
| Exercises (`chNexeM`, = pencil icons) | 251 |
| Questions (`chNqaM`) | 3,020 |
| Canonical answers (`chNqarM`) | 1,571 |
| Answer-key exercise blocks (`chNexe_M`) | 120 |
| Content images (`t*.jpg` in chapters) | 1,206 |
| Tip boxes (`tip.jpg`) | 84 |
| Free-response blanks (`p.dash`) | 819 |
| "Answers will vary" | 12 |
| "OR" alternatives (`<small>OR</small>`) | 10 |

Interpretation: 3,020 questions − 1,571 graded = ~1,449 ungraded (free-response
reading comprehension, oral practice, "Answers will vary"). Only 120 of 251
exercises have answer-key blocks (the rest are open-ended/oral).

## 8. Answer-key structure & special cases

1. **Multiple accepted answers:** `delgada <small>OR</small> flaca` → store as an
   array of accepted answers.
2. **Explanations:** many answers carry a parenthetical reason, e.g.
   `comía (repeated action)`, `era (description)`, `tenía (age)`,
   `Eran, brillaba (time, situation)`. These are the raw material for the
   "Why?" feature. Store as an `explanation` field (book's own wording).
3. **Multiple blanks:** one question can have several blanks; the answer is
   comma-separated, e.g. `cantan, bailan` and per-blank explanations
   `(continuous action, continuous action)`. Parser must split on `, ` but flag
   ambiguous cases (commas can be legitimate inside an answer).
4. **Freeform:** `Answers will vary` → mark `freeform` (self-checked), never
   fabricate an answer.
5. **Free response:** `p.dash` questions (reading comprehension "Preguntas",
   oral practice) → mark `noAnswer`, self-checked.

## 9. Image-table inventory & recovery

- 1,206 content images in chapters are the **conjugation charts, vocabulary
  lists, and example-sentence tables** — the only theory not in text form.
- Recovery strategy (Step 2.3): for each `t*.jpg` referenced under a theory
  block, locate the corresponding text in the PDF-reflow EPUB (it is linearized
  there) and attach it as a `table` theory block; if the mapping is ambiguous,
  emit the item into `data/review/tables.md` and keep the image as a fallback.
- Icons (`pencil.jpg`, `tip.jpg`) are decorative and must be ignored.

## 10. Extraction rules (non-negotiable)

- Preserve ordering and hierarchy exactly (Part → Chapter → Section → Exercise
  → Question → Answer).
- Preserve Spanish accents and UTF-8 encoding intact.
- Store canonical answers separately from anything user-facing/mutable.
- **Never invent answers**; mark `freeform`/`noAnswer` explicitly.
- Where a relationship (exercise→section, answer→question, image→table text) is
  uncertain, **flag for review** rather than guessing.

## 11. Flagged-for-review / risks

- **Multi-blank comma-splitting** is ambiguous; needs manual spot-check.
- **Image→text mapping** (1,206 images) may be incomplete; unresolved items go
  to `data/review/`.
- **`answer.html`/`answer1.html` split** must be concatenated by chapter order.
- **Metadata mismatch:** EPUB metadata declares `dc:language = zh` and
  `xml:lang = zho` (a Calibre/ADE quirk) — the actual content is English +
  Spanish; ignore the bogus language metadata.
- Some `h4`/`h5` headings have no `id` (unnumbered); parser must handle
  missing IDs gracefully.

