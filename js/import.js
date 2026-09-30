/* js/import.js — one-time content import from data/book.json (Step 3.2) */
'use strict';

var Importer = {
  // Import content idempotently; returns { imported, version, counts }.
  run: function () {
    return fetch('data/book.json')
      .then(function (r) {
        if (!r.ok) throw new Error('Failed to fetch book.json: HTTP ' + r.status);
        return r.json();
      })
      .then(function (book) {
        return db.meta.get('contentVersion').then(function (stored) {
          if (stored && stored.value === book.meta.contentVersion) {
            return { imported: false, version: book.meta.contentVersion };
          }
          return db.transaction('rw',
            [db.parts, db.chapters, db.sections, db.theoryBlocks,
             db.exercises, db.questions, db.answers, db.meta],
            function () {
              return Promise.all([
                db.parts.clear(),
                db.chapters.clear(),
                db.sections.clear(),
                db.theoryBlocks.clear(),
                db.exercises.clear(),
                db.questions.clear(),
                db.answers.clear()
              ]).then(function () {
                return Promise.all([
                  db.parts.bulkAdd(book.parts),
                  db.chapters.bulkAdd(book.chapters),
                  db.sections.bulkAdd(book.sections),
                  db.theoryBlocks.bulkAdd(book.theoryBlocks),
                  db.exercises.bulkAdd(book.exercises),
                  db.questions.bulkAdd(book.questions),
                  db.answers.bulkAdd(book.answers)
                ]);
              }).then(function () {
                return db.meta.put({ key: 'contentVersion', value: book.meta.contentVersion });
              });
            })
            .then(function () {
              return { imported: true, version: book.meta.contentVersion };
            });
        });
      })
      .then(function (res) {
        return Promise.all([
          db.chapters.count(),
          db.questions.count(),
          db.answers.count()
        ]).then(function (c) {
          res.counts = { chapters: c[0], questions: c[1], answers: c[2] };
          return res;
        });
      });
  }
};
