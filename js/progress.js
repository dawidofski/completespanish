/* js/progress.js — record + aggregate learner progress (Step 9.1) */
'use strict';

var Progress = (function () {
  function isCompletable(q) {
    return !!q.graded && !q.freeResponse;
  }

  function isSelfCheck(q) {
    return q.freeResponse === true || q.graded === false;
  }

  function isQuestionDone(q, row) {
    if (isCompletable(q)) return !!(row && row.bestCorrect);
    if (isSelfCheck(q)) return !!(row && row.selfChecked);
    return true;
  }

  function record(questionId, correct, userAnswer) {
    return db.questionProgress.get(questionId).then(function (existing) {
      var now = Date.now();
      var row = existing || {
        questionId: questionId,
        attempts: 0,
        bestCorrect: false,
        hintsUsed: 0,
        answerRevealed: false,
        lastAt: now
      };
      row.attempts += 1;
      row.lastAt = now;
      row.bestCorrect = row.bestCorrect || correct;
      if (userAnswer !== undefined) row.lastAnswer = userAnswer;
      row.status = correct ? 'correct' : (row.attempts >= 2 ? 'needs-review' : 'attempted');
      return db.questionProgress.put(row);
    });
  }

  function overall() {
    return Promise.all([
      db.questions.toArray(),
      db.questionProgress.toArray()
    ]).then(function (r) {
      var completable = r[0].filter(isCompletable);
      var ids = {};
      completable.forEach(function (q) { ids[q.id] = true; });
      var rows = r[1].filter(function (x) { return ids[x.questionId]; });
      return {
        total: completable.length,
        attempted: rows.length,
        correct: rows.filter(function (x) { return x.bestCorrect; }).length
      };
    });
  }

  function exerciseMap(exercises) {
    var ids = exercises.map(function (e) { return e.id; });
    var map = {};
    exercises.forEach(function (e) {
      map[e.id] = { total: 0, done: 0, completed: false, correct: 0, attempted: 0, gradedTotal: 0 };
    });
    if (!ids.length) return Promise.resolve(map);
    return db.questions.where('exerciseId').anyOf(ids).toArray().then(function (qs) {
      var qByEx = {};
      qs.forEach(function (q) {
        (qByEx[q.exerciseId] = qByEx[q.exerciseId] || []).push(q);
        map[q.exerciseId].total++;
        if (isCompletable(q)) map[q.exerciseId].gradedTotal++;
      });
      var qids = qs.map(function (q) { return q.id; });
      if (!qids.length) return map;
      return db.questionProgress.where('questionId').anyOf(qids).toArray().then(function (rows) {
        var byId = {};
        rows.forEach(function (r) { byId[r.questionId] = r; });
        exercises.forEach(function (ex) {
          (qByEx[ex.id] || []).forEach(function (q) {
            var row = byId[q.id];
            if (isCompletable(q)) {
              if (row) {
                map[ex.id].attempted++;
                if (row.bestCorrect) map[ex.id].correct++;
              }
            }
            if (isQuestionDone(q, row)) map[ex.id].done++;
          });
          map[ex.id].completed = map[ex.id].total > 0 && map[ex.id].done === map[ex.id].total;
        });
        return map;
      });
    });
  }

  function exerciseCompletion(exerciseId) {
    return db.questions.where('exerciseId').equals(exerciseId).toArray().then(function (qs) {
      if (!qs.length) return { total: 0, done: 0, completed: false };
      var ids = qs.map(function (q) { return q.id; });
      return db.questionProgress.where('questionId').anyOf(ids).toArray().then(function (rows) {
        var byId = {};
        rows.forEach(function (r) { byId[r.questionId] = r; });
        var done = qs.filter(function (q) { return isQuestionDone(q, byId[q.id]); }).length;
        return { total: qs.length, done: done, completed: done === qs.length };
      });
    });
  }

  function chaptersMap() {
    return Promise.all([
      db.exercises.toArray(),
      db.questions.toArray(),
      db.questionProgress.toArray()
    ]).then(function (r) {
      var exercises = r[0], questions = r[1], rows = r[2];
      var qByEx = {};
      questions.forEach(function (q) { (qByEx[q.exerciseId] = qByEx[q.exerciseId] || []).push(q); });
      var byId = {};
      rows.forEach(function (row) { byId[row.questionId] = row; });
      var byChapter = {};
      exercises.forEach(function (ex) {
        var eqs = qByEx[ex.id] || [];
        if (!eqs.length) return;
        var allDone = eqs.every(function (q) { return isQuestionDone(q, byId[q.id]); });
        var ch = byChapter[ex.chapterId] || (byChapter[ex.chapterId] = { total: 0, done: 0, completed: false });
        ch.total++;
        if (allDone) ch.done++;
      });
      Object.keys(byChapter).forEach(function (cid) {
        byChapter[cid].completed = byChapter[cid].total > 0 && byChapter[cid].done === byChapter[cid].total;
      });
      return byChapter;
    });
  }

  function summary() {
    return Promise.all([overall(), chaptersMap()]).then(function (r) {
      var s = r[0], cm = r[1];
      var chaptersDone = 0, chaptersTotal = 0;
      Object.keys(cm).forEach(function (k) { chaptersTotal++; if (cm[k].completed) chaptersDone++; });
      return {
        correct: s.correct, total: s.total,
        chaptersDone: chaptersDone, chaptersTotal: chaptersTotal
      };
    });
  }

  function markExerciseSelfChecked(exerciseId) {
    return db.questions.where('exerciseId').equals(exerciseId).toArray().then(function (qs) {
      var self = qs.filter(isSelfCheck);
      return Promise.all(self.map(function (q) {
        return db.questionProgress.get(q.id).then(function (existing) {
          var row = existing || {
            questionId: q.id, attempts: 0, bestCorrect: false,
            hintsUsed: 0, answerRevealed: false, lastAt: Date.now()
          };
          row.selfChecked = true;
          row.lastAt = Date.now();
          return db.questionProgress.put(row);
        });
      }));
    });
  }

  function get(questionId) {
    return db.questionProgress.get(questionId);
  }

  function resetExercise(exerciseId) {
    return db.questions.where('exerciseId').equals(exerciseId).toArray().then(function (qs) {
      var ids = qs.map(function (q) { return q.id; });
      if (!ids.length) return Promise.resolve();
      return db.questionProgress.where('questionId').anyOf(ids).delete();
    });
  }

  function resetAll() {
    return Promise.all([
      db.questionProgress.clear(),
      db.reviewItems.clear(),
      db.meta.delete('lastPosition')
    ]);
  }

  return {
    record: record, get: get, overall: overall, exerciseMap: exerciseMap,
    exerciseCompletion: exerciseCompletion, chaptersMap: chaptersMap, summary: summary,
    markExerciseSelfChecked: markExerciseSelfChecked,
    resetExercise: resetExercise, resetAll: resetAll
  };
})();
