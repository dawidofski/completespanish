/* js/exercises.js — render exercises + questions (Step 4.3) */
'use strict';

var Exercises = (function () {
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function promptHtml(prompt, blankIndex) {
    var n = 0;
    return prompt.replace(/_{3,}/g, function () {
      n++;
      if (blankIndex == null || n === blankIndex) {
        return '<input class="answer-input" data-blank="' + n + '" autocomplete="off" autocapitalize="none" spellcheck="false">';
      }
      return ' _____ ';
    });
  }

  function renderQuestion(q, number) {
    var wrap = el('div', 'question');
    if (number != null) {
      wrap.appendChild(el('div', 'question-number', number + '.'));
    }
    if (q.imageSrc) {
      var img = document.createElement('img');
      img.src = 'data/tables/' + q.imageSrc;
      img.alt = '';
      img.className = 'question-image';
      wrap.appendChild(img);
    }
    var p = el('div', 'question-prompt');
    p.innerHTML = promptHtml(q.prompt, q.blankIndex);
    wrap.appendChild(p);
    if (q.gloss) {
      wrap.appendChild(el('div', 'question-gloss', q.gloss));
    }
    if (q.freeResponse || (q.graded === false && q.blankCount === 0)) {
      var ta = document.createElement('textarea');
      ta.className = 'answer-textarea';
      ta.rows = 2;
      wrap.appendChild(ta);
    }
    return wrap;
  }

  function render(exerciseId) {
    var content = document.getElementById('content');
    content.innerHTML = '';
    return db.exercises.get(exerciseId).then(function (ex) {
      if (!ex) {
        content.appendChild(el('p', 'muted', 'Exercise not found.'));
        return;
      }
      content.appendChild(el('h2', 'chapter-heading',
        ex.number ? ('Exercise ' + ex.number) : 'Reading Comprehension'));
      if (ex.instruction) {
        content.appendChild(el('p', 'exercise-instruction', ex.instruction));
      }
      if (ex.wordBank && ex.wordBank.length) {
        var wb = el('div', 'word-bank');
        ex.wordBank.forEach(function (w) {
          wb.appendChild(el('span', 'word-chip', w));
        });
        content.appendChild(wb);
      }
      if (ex.freeform) {
        content.appendChild(el('p', 'muted', 'Answers will vary — self-check.'));
      }
      return DB.questions(exerciseId).then(function (qs) {
        if (!qs.length) {
          content.appendChild(el('p', 'muted', 'No questions.'));
          return;
        }
        qs.forEach(function (q) {
          content.appendChild(renderQuestion(q, q.number || null));
        });
      });
    });
  }

  return { render: render };
})();
