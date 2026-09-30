// tools/_test_answer.js — unit tests for js/answer.js (dev only)
var Answer = require('../js/answer.js');
var assert = require('assert');

function t(name, fn) {
  fn();
  console.log('✓ ' + name);
}

t('exact match', function () {
  assert.strictEqual(Answer.check('el', ['el']), true);
});
t('case-insensitive', function () {
  assert.strictEqual(Answer.check('EL', ['el']), true);
});
t('surrounding whitespace', function () {
  assert.strictEqual(Answer.check('  el  ', ['el']), true);
});
t('internal whitespace collapsed', function () {
  assert.strictEqual(Answer.check('los   animales', ['los animales']), true);
});
t('accent-sensitive (el != él)', function () {
  assert.strictEqual(Answer.check('él', ['el']), false);
});
t('accent correct (SÍ == sí)', function () {
  assert.strictEqual(Answer.check('SÍ', ['sí']), true);
});
t('OR alternative accepted', function () {
  assert.strictEqual(Answer.check('flaca', ['delgada', 'flaca']), true);
});
t('OR alternative not in list', function () {
  assert.strictEqual(Answer.check('fea', ['delgada', 'flaca']), false);
});
t('normalize', function () {
  assert.strictEqual(Answer.normalize('  Los   Animales  '), 'los animales');
});
t('multi-blank correct', function () {
  assert.strictEqual(Answer.checkMulti(['cantan', 'bailan'], ['cantan, bailan']), true);
});
t('multi-blank wrong order', function () {
  assert.strictEqual(Answer.checkMulti(['bailan', 'cantan'], ['cantan, bailan']), false);
});
t('multi-blank OR alternative', function () {
  assert.strictEqual(
    Answer.checkMulti(['bailan', 'cantan'], ['cantan, bailan', 'bailan, cantan']),
    true
  );
});

console.log('\nAll answer tests passed.');
