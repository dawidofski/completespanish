/* js/import.js — one-time content import from data/book.json (Step 3.2) */
'use strict';

var Importer = {
  run: function () {
    return fetch('data/book.json', { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('Failed to fetch book.json: HTTP ' + r.status);
        return r.json();
      })
      .then(function (book) {
        var prepared = prepareContent(book);
        var expected = {
          chapters: book.chapters.length,
          sections: book.sections.length,
          exercises: book.exercises.length,
          questions: prepared.questions.length,
          answers: prepared.answers.length
        };
        return db.meta.get('contentVersion').then(function (stored) {
          if (stored && stored.value === book.meta.contentVersion) {
            return counts().then(function (c) {
              var complete =
                c.chapters === expected.chapters &&
                c.sections === expected.sections &&
                c.exercises === expected.exercises &&
                c.questions === expected.questions &&
                c.answers === expected.answers;
              return complete
                ? { imported: false, version: book.meta.contentVersion }
                : doImport(book, prepared);
            });
          }
          return doImport(book, prepared);
        });
      })
      .then(function (res) {
        return counts().then(function (c) {
          res.counts = c;
          return res;
        });
      });
  }
};

function counts() {
  return Promise.all([
    db.chapters.count(), db.sections.count(), db.exercises.count(),
    db.questions.count(), db.answers.count(), db.theoryBlocks.count()
  ]).then(function (c) {
    return {
      chapters: c[0], sections: c[1], exercises: c[2],
      questions: c[3], answers: c[4], theoryBlocks: c[5]
    };
  });
}

function clone(o) {
  var c = {};
  for (var k in o) c[k] = o[k];
  return c;
}

function cartesian(lists) {
  var acc = [[]];
  lists.forEach(function (list) {
    var next = [];
    acc.forEach(function (combo) {
      list.forEach(function (item) { next.push(combo.concat([item])); });
    });
    acc = next;
  });
  return acc;
}

function prepareContent(book) {
  var freeformExIds = {};
  (book.exercises || []).forEach(function (ex) { if (ex.freeform) freeformExIds[ex.id] = true; });

  var groups = {};
  var groupOrder = [];
  (book.questions || []).forEach(function (q) {
    if (q.blankIndex == null) return;
    var key = q.exerciseId + '||' + q.prompt;
    if (!groups[key]) { groups[key] = []; groupOrder.push(key); }
    groups[key].push(q);
  });
  groupOrder.forEach(function (key) {
    groups[key].sort(function (a, b) { return a.blankIndex - b.blankIndex; });
  });

  var ansByQ = {};
  (book.answers || []).forEach(function (a) {
    (ansByQ[a.questionId] = ansByQ[a.questionId] || []).push(a);
  });

  var mergedByFirstId = {};
  var dropQIds = {};
  var handledAnsIds = {};
  var mergedAnswers = [];

  groupOrder.forEach(function (key) {
    var g = groups[key];
    if (g.length < 2) return;
    var blankAccepted = g.map(function (q) {
      var a = (ansByQ[q.id] || [])[0];
      return (a && a.accepted && a.accepted.length) ? a.accepted : null;
    });
    if (blankAccepted.some(function (a) { return !a; })) return;

    var first = g[0];
    var merged = clone(first);
    merged.blankCount = g.length;
    merged.blankIndex = null;
    merged.gloss = null;
    mergedByFirstId[first.id] = merged;

    g.forEach(function (q) {
      if (q.id !== first.id) dropQIds[q.id] = true;
      handledAnsIds[q.id] = true;
    });

    var combos = cartesian(blankAccepted);
    mergedAnswers.push({
      id: 'm-' + first.id,
      questionId: first.id,
      exerciseId: first.exerciseId,
      number: first.number,
      text: combos.map(function (p) { return p.join(', '); }).join(' / '),
      accepted: combos.map(function (p) { return p.join(', '); }),
      explanation: null
    });
  });

  var questions = [];
  var selfCheckQIds = {};
  (book.questions || []).forEach(function (q) {
    if (dropQIds[q.id]) return;
    var out = mergedByFirstId[q.id] || q;
    var normalize = !!freeformExIds[out.exerciseId];
    if (normalize && out === q) out = clone(q);
    if (normalize) {
      out.freeResponse = true;
      out.graded = false;
    }
    if (out.freeResponse === true || out.graded === false) selfCheckQIds[out.id] = true;
    questions.push(out);
  });

  var answers = mergedAnswers.slice();
  (book.answers || []).forEach(function (a) {
    if (handledAnsIds[a.questionId]) return;
    if (selfCheckQIds[a.questionId]) return;
    answers.push(a);
  });

  return { questions: questions, answers: answers, selfCheckQIds: selfCheckQIds };
}

function doImport(book, prepared) {
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
          db.questions.bulkAdd(prepared.questions),
          db.answers.bulkAdd(prepared.answers)
        ]);
      }).then(function () {
        return db.meta.put({ key: 'contentVersion', value: book.meta.contentVersion });
      });
    })
    .then(function () {
      var ids = Object.keys(prepared.selfCheckQIds);
      if (!ids.length) return { imported: true, version: book.meta.contentVersion };
      return db.reviewItems.where('questionId').anyOf(ids)
        .modify({ resolved: true })
        .then(function () { return { imported: true, version: book.meta.contentVersion }; });
    });
}
