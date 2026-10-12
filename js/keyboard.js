/* js/keyboard.js — Spanish special-character keyboard (tap to insert). */
'use strict';

var SpanishKeyboard = (function () {
  // Only the characters a standard English keyboard can't easily type.
  var KEYS = ['á', 'é', 'í', 'ó', 'ú', 'ü', 'ñ', '¿', '¡'];

  // Last editable element the learner focused, so tapping a key doesn't make
  // the answer field lose focus.
  var activeEl = null;

  function isEditable(n) {
    if (!n || !n.tagName) return false;
    var t = n.tagName.toLowerCase();
    return t === 'input' || t === 'textarea';
  }

  function insertText(el, text) {
    var start = el.selectionStart;
    var end = el.selectionEnd;
    if (start == null) start = (el.value || '').length;
    if (end == null) end = start;
    if (typeof el.setRangeText === 'function') {
      el.setRangeText(text, start, end, 'end');
    } else {
      var v = el.value || '';
      el.value = v.slice(0, start) + text + v.slice(end);
      var pos = start + text.length;
      try { el.selectionStart = el.selectionEnd = pos; } catch (e) {}
    }
    try { el.focus(); } catch (e) {}
  }

  function target() {
    if (isEditable(activeEl) && document.body.contains(activeEl)) return activeEl;
    var first = document.querySelector('.answer-input, .answer-textarea');
    if (first) activeEl = first;
    return first || null;
  }

  function insert(ch) {
    var el = target();
    if (el) insertText(el, ch);
  }

  function build() {
    var bar = document.createElement('div');
    bar.className = 'spanish-keyboard';
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', 'Spanish special characters');
    var downEvent = window.PointerEvent ? 'pointerdown'
      : ('ontouchstart' in window ? 'touchstart' : 'mousedown');

    KEYS.forEach(function (ch) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'sp-key';
      b.textContent = ch;
      b.setAttribute('aria-label', 'Insert ' + ch);
      b.addEventListener(downEvent, function (e) {
        e.preventDefault(); // keep focus in the answer field
        insert(ch);
      });
      // Keyboard accessibility (Enter / Space on a focused key).
      b.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          insert(ch);
        }
      });
      bar.appendChild(b);
    });

    document.body.appendChild(bar);
  }

  function init() {
    document.addEventListener('focusin', function (e) {
      if (isEditable(e.target)) activeEl = e.target;
    });
    build();
  }

  return { init: init };
})();

document.addEventListener('DOMContentLoaded', function () {
  SpanishKeyboard.init();
});
