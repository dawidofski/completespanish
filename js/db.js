/* js/db.js — Dexie schema + DB access layer (Step 3.1) */
'use strict';

var db = new Dexie('SpanishApp');

// Version 1: content (imported from data/book.json) + learner tables.
db.version(1).stores({
  parts: 'id, order',
  chapters: 'id, partId, number, order',
  sections: 'id, chapterId, parentId, level, order',
  theoryBlocks: 'id, chapterId, sectionId, type, order',
  exercises: 'id, chapterId, sectionId, number, order',
  questions: 'id, exerciseId, chapterId, number, order',
  answers: 'id, questionId, exerciseId, number',
  questionProgress: 'questionId, exerciseId, chapterId, status, lastAt',
  reviewItems: '++id, questionId, resolved, addedAt',
  notes: '++id, targetType, targetId, createdAt',
  bookmarks: '++id, targetType, targetId, createdAt',
  meta: 'key'
});

// Thin data-access helpers shared by the rest of the app.
var DB = {
  // content
  parts: function () { return db.parts.orderBy('order').toArray(); },
  chapters: function () { return db.chapters.orderBy('order').toArray(); },
  chapter: function (id) { return db.chapters.get(id); },
  sections: function (chapterId) {
    return db.sections.where('chapterId').equals(chapterId).sortBy('order');
  },
  theoryBlocks: function (sectionId) {
    return db.theoryBlocks.where('sectionId').equals(sectionId).sortBy('order');
  },
  exercises: function (chapterId) {
    return db.exercises.where('chapterId').equals(chapterId).sortBy('order');
  },
  questions: function (exerciseId) {
    return db.questions.where('exerciseId').equals(exerciseId).sortBy('number');
  },
  answer: function (questionId) {
    return db.answers.where('questionId').equals(questionId).first();
  },
  // learner
  progress: function (questionId) { return db.questionProgress.get(questionId); },
  saveProgress: function (p) { return db.questionProgress.put(p); },
  reviewItems: function (resolved) {
    return db.reviewItems.where('resolved').equals(resolved).toArray();
  },
  addReview: function (item) { return db.reviewItems.add(item); },
  // meta
  meta: function (key) { return db.meta.get(key); },
  setMeta: function (key, value) { return db.meta.put({ key: key, value: value }); }
};
