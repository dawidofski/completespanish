/* js/review.js — review mistakes (Step 10.1) */
'use strict';

var Review = (function () {
  function add(questionId, reason) {
    return db.reviewItems.where('questionId').equals(questionId).toArray().then(function (items) {
      var active = items.filter(function (i) { return !i.resolved; })[0];
      if (active) return active;
      return db.reviewItems.add({
        questionId: questionId,
        reason: reason,
        addedAt: Date.now(),
        resolved: false
      });
    });
  }

  function count() {
    return db.reviewItems.toArray().then(function (items) {
      return items.filter(function (i) { return !i.resolved; }).length;
    });
  }

  function list() {
    return db.reviewItems.toArray().then(function (items) {
      items = items.filter(function (i) { return !i.resolved; });
      var qids = items.map(function (i) { return i.questionId; });
      if (!qids.length) return [];
      return db.questions.where('id').anyOf(qids).toArray().then(function (qs) {
        var qById = {};
        qs.forEach(function (q) { qById[q.id] = q; });
        var byChapter = {};
        items.forEach(function (i) {
          var q = qById[i.questionId];
          if (!q) return;
          (byChapter[q.chapterId] = byChapter[q.chapterId] || []).push({
            questionId: i.questionId,
            question: q,
            reason: i.reason
          });
        });
        return byChapter;
      });
    });
  }

  function resolveQuestion(questionId) {
    return db.reviewItems.where('questionId').equals(questionId).modify({ resolved: true });
  }

  function resolveExercise(exerciseId) {
    return db.questions.where('exerciseId').equals(exerciseId).toArray().then(function (qs) {
      var ids = qs.map(function (q) { return q.id; });
      if (!ids.length) return Promise.resolve();
      return db.reviewItems.where('questionId').anyOf(ids).modify({ resolved: true });
    });
  }

  return {
    add: add, count: count, list: list,
    resolveQuestion: resolveQuestion, resolveExercise: resolveExercise
  };
})();
