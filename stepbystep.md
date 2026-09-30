# stepbystep.md — Implementation Roadmap

Status legend: `[ ]` not started · `[~]` in progress · `[x]` complete

---

## Key inspection findings (drives everything below)

- **Two EPUBs.**
  - `Complete Spanish step-by-step _ the fastest way to achieve -- Bregstein, Barbara .epub`
    (61.5 MB) = the **official McGraw-Hill EPUB**. Despite the "image" nickname,
    it has a clean **semantic HTML text layer**:
    - Part (`part1..6.html`) → Chapter (`ch1..30.html`) → Section (`h3`,
      `id=chNlevM`) → Subsection (`h4`) → Sub-subsection (`h5`).
    - Exercises (`h3.h3e`, `id=chNexeM`, 251 numbered + 30 reading-comprehension).
    - Questions (`p.question`/`noindent`/`imagen`, `id=chNqaM`, 3,020 graded
      + 276 ungraded) with blank underscores.
    - Answer key (`answer.html` + `answer1.html`) with per-question answers
      (`id=chNqarM`, 3,019 canonical answers) and **explicit
      question↔answer↔exercise anchor links**; "Answers will vary" and " OR "
      alternatives are marked.
    - Conjugation charts, vocabulary lists, and some example tables are rendered
      as **images** (`tXXXX.jpg`).
  - `Complete Spanish Step-by-step.epub` (998 KB) = **Calibre PDF-reflow**. All
    text (including those tables, linearized) is selectable, but structure is a
    generic `calibre*` class soup with no semantic links and reflow artifacts.
- **Conclusion:** primary source = official EPUB (structure + theory + exercises
  + answers). Secondary source = PDF-reflow EPUB (recover table-like content
  that the primary stores as images).

---

## Phase 1 — Project & EPUB analysis  `[x]`

- [x] **Step 1.1 — Scaffold the repo**
  - Objective: create the project skeleton and version control.
  - Prereqs: none.
  - Files: `.gitignore`, `README.md`, directory layout (`source/`, `tools/`,
    `data/`, app at repo root).
  - Work: `git init`, `.gitignore` (EPUBs + `.inspect/` + `__pycache__`),
    move EPUBs into `source/`, initial commit.
  - Tests: `git status` clean; EPUBs untouched.
  - Acceptance: repo exists with a clean initial commit; EPUBs immutable in
    `source/` (not committed if large; documented).
  - Rollback: delete repo, restore EPUBs from backup.

- [x] **Step 1.2 — Document extraction analysis**
  - Objective: freeze the inspection conclusions as the source-of-truth for
    extraction.
  - Files: `docs/extraction-analysis.md`.
  - Work: record EPUB comparison, semantic class map, anchor-link scheme, scale
    numbers (6 parts / 30 chapters / 251 exercises / 3020 questions / 1571
    answers), and image-table inventory.
  - Acceptance: a reviewer can read this doc and implement extraction.

---

## Phase 2 — Local Python extraction  `[x]`

- [x] **Step 2.1 — Parser: structure + theory**
  - Objective: parse official EPUB → parts, chapters, sections, subsections,
    theory blocks, notes, tips, examples.
  - Files: `tools/extract_structure.py`, `tools/epub_reader.py`.
  - Work: open EPUB (zipfile), parse `contents.html` + `ch*.html` + `part*.html`,
    emit `data/raw/structure.json`.
  - Tests: unit-check heading/ID extraction; assert 6 parts, 30 chapters,
    expected section counts.
  - Acceptance: structure JSON matches `contents.html` hierarchy.

- [x] **Step 2.2 — Parser: exercises, questions, answers**
  - Objective: extract exercises (h3e), questions (p.question + blanks), word
    banks, and answer-key answers (answer.html), joining via anchor IDs.
  - Files: `tools/extract_exercises.py`.
  - Work: parse `ch*.html` + `answer.html`; join `chNqaM ↔ chNqarM`;
    emit `data/raw/exercises.json`, `data/raw/answers.json`.
  - Tests: assert 251 exercises, 3020 questions; every `qar` answer resolves to
    a question; count "Answers will vary" and " OR " occurrences.
  - Acceptance: canonical answers stored separately; freeform questions flagged.

- [x] **Step 2.3 — Table recovery (cross-EPUB)**
  - Objective: for image tables (conjugations/vocab), recover text from the
    PDF-reflow EPUB or mark for manual review.
  - Files: `tools/recover_tables.py`.
  - Work: detect `img`/`imagei` blocks; map to PDF-reflow text where possible;
    else emit `data/review/tables.md` flagged list.
  - Acceptance: every image-table has either recovered text or a review flag.

- [x] **Step 2.4 — Prepare final data + validation report**
  - Objective: produce clean `data/book.json` (or split `data/*.json`) with a
    content-version id, and a validation report.
  - Files: `tools/prepare_data.py`, `data/*.json`.
  - Tests: validate counts, integrity (no dangling refs), encoding (UTF-8,
    Spanish accents intact), and a sample spot-check against the book.
  - Acceptance: `data/book.json` is import-ready; report lists any needs-review
    items.

---

## Phase 3 — Data model & Dexie foundation  `[x]`

- [x] **Step 3.1 — Dexie schema + DB module**
  - Objective: implement schema v1 and DB access layer.
  - Files: `js/db.js`.
  - Work: Dexie stores (parts, chapters, sections, theoryBlocks, exercises,
    questions, answers, questionProgress, reviewItems, notes, bookmarks, meta);
    helper queries.
  - Tests: open DB in browser; CRUD smoke test.
  - Acceptance: schema matches the data model; versioned.

- [x] **Step 3.2 — One-time content import**
  - Objective: load `data/book.json` into IndexedDB idempotently.
  - Files: `js/import.js`.
  - Work: read content-version from `meta`; skip if current; else transactional
    import.
  - Tests: first run imports; second run skips; reload retains data.
  - Acceptance: no duplication across reloads.

---

## Phase 4 — Basic mobile UI  `[~]`

- [x] **Step 4.1 — App shell + mobile-first CSS**
  - Files: `index.html`, `css/app.css`, `js/app.js`.
  - Work: layout, header, breadcrumb bar, exercise area, theory panel
    (desktop sidebar / mobile bottom sheet), touch targets, no horizontal scroll.
  - Acceptance: renders on Android Chrome; usable at 360px width.

- [x] **Step 4.2 — Render theory**
  - Files: `js/theory.js`.
  - Work: render theory blocks (paragraph/note/tip/example/table) from DB.

- [ ] **Step 4.3 — Render exercises & questions**
  - Files: `js/exercises.js`.
  - Work: render exercise, instruction, word bank, questions with inputs
    (single/multiple blanks), freeform and oral variants.

---

## Phase 5 — Breadcrumb & navigation  `[ ]`

- [ ] **Step 5.1 — Breadcrumb navigation + prev/next**
  - Files: `js/nav.js`.
  - Work: hierarchical breadcrumb (Book > Chapter > Section > Exercise),
    tap-to-navigate, previous/next across exercises and sections.
  - Acceptance: breadcrumb always shows position; prev/next works.

---

## Phase 6 — Answer checking  `[ ]`

- [ ] **Step 6.1 — Answer normalization & checking**
  - Files: `js/answer.js`.
  - Work: normalize (trim/whitespace/case, never strip accents), multi-accepted
    answers, multi-blank comparison; store attempts separately from canonical.
  - Tests: unit cases (accent-sensitive, case, whitespace, " OR ").
  - Acceptance: correct/incorrect detection matches book answer key.

---

## Phase 7 — Try Again / hints / "Why?"  `[ ]`

- [ ] **Step 7.1 — Feedback + Try Again**
  - Files: `js/feedback.js`.
  - Work: ✓/✗ feedback, Try Again (reset input, refocus, keep history), Hint
    (progressive), Show theory, Show answer, "Why?" (grounded in theory).
  - Acceptance: full loop works; canonical answer never overwritten.

---

## Phase 8 — Theory ↔ exercise sync  `[ ]`

- [ ] **Step 8.1 — Automatic theory following + highlight**
  - Files: `js/theorySync.js`.
  - Work: Exercise→Section→TheoryBlocks; auto-scroll + highlight; "📌 Follow
    exercise" toggle (persisted).
  - Acceptance: theory follows the learner without fighting manual scroll.

---

## Phase 9 — Progress tracking  `[ ]`

- [ ] **Step 9.1 — Progress recording & aggregates**
  - Files: `js/progress.js`.
  - Work: record attempts/results into questionProgress; derive
    exercise/section/chapter/overall stats; "continue where you left off".
  - Tests: attempt→result→save→reload→progress remains.

---

## Phase 10 — Review mistakes  `[ ]`

- [ ] **Step 10.1 — Review list**
  - Files: `js/review.js`.
  - Work: auto-flag review items (incorrect / repeated / revealed / manual),
    review screen grouped by chapter, Start Review.
  - Acceptance: review items accumulate and can be resolved.

---

## Phase 11 — PWA / offline / Android  `[ ]`

- [ ] **Step 11.1 — Manifest + service worker + offline**
  - Files: `manifest.webmanifest`, `sw.js`, `js/sw-register.js`.
  - Work: app-shell cache, vendor Dexie.js locally, installable, offline use.
  - Acceptance: installs on Android; works offline after first load.

---

## Phase 12 — GitHub Pages deployment  `[ ]`

- [ ] **Step 12.1 — Deploy & verify**
  - Files: repo config, deployment docs.
  - Work: push to GitHub, enable Pages, verify relative paths/SW scope/manifest.
  - Acceptance: app loads from the Pages URL on Android; progress persists.

---

## Phase 13 — Final testing & polish  `[ ]`

- [ ] **Step 13.1 — Content QA, accessibility, performance**
  - Files: docs, fixes.
  - Work: content spot-checks, keyboard/focus/contrast/text-scaling, perf
    (no full-book DOM), final acceptance pass.
  - Acceptance: all required features present; no regressions.
