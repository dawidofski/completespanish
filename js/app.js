/* js/app.js — app shell + navigation (Step 4.1) */
'use strict';

var App = (function () {
  var followExercise = true;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function renderBreadcrumb(items) {
    var bc = document.getElementById('breadcrumbs');
    bc.innerHTML = '';
    items.forEach(function (item, i) {
      if (i > 0) bc.appendChild(el('span', 'crumb-sep', '›'));
      if (item.action) {
        var b = el('button', 'crumb', item.label);
        b.addEventListener('click', item.action);
        bc.appendChild(b);
      } else {
        bc.appendChild(el('span', 'crumb crumb-current', item.label));
      }
    });
  }

  function home() {
    renderBreadcrumb([{ label: 'Book' }]);
    var content = document.getElementById('content');
    content.innerHTML = '';
    return Promise.all([
      DB.parts(),
      DB.chapters(),
      db.sections.count(),
      db.exercises.count(),
      db.questions.count(),
      db.answers.count()
    ]).then(function (r) {
      var parts = r[0], chapters = r[1];
      content.appendChild(el('p', 'data-status',
        'chapters=' + chapters.length + ' · sections=' + r[2] +
        ' · exercises=' + r[3] + ' · questions=' + r[4] + ' · answers=' + r[5]));
      var byPart = {};
      chapters.forEach(function (c) {
        (byPart[c.partId] = byPart[c.partId] || []).push(c);
      });
      parts.forEach(function (p) {
        content.appendChild(el('h2', 'part-heading', 'Part ' + p.number + ' — ' + p.title));
        var ul = el('ul', 'list');
        (byPart[p.id] || []).forEach(function (c) {
          var btn = el('button', 'list-item');
          btn.appendChild(el('span', 'item-title', c.number + '. ' + c.title));
          btn.addEventListener('click', function () { openChapter(c.id); });
          var li = el('li');
          li.appendChild(btn);
          ul.appendChild(li);
        });
        content.appendChild(ul);
      });
    });
  }

  function openChapter(chapterId) {
    return DB.chapter(chapterId).then(function (ch) {
      renderBreadcrumb([
        { label: 'Book', action: home },
        { label: 'Chapter ' + ch.number }
      ]);
      var content = document.getElementById('content');
      content.innerHTML = '';
      content.appendChild(el('h2', 'chapter-heading', 'Chapter ' + ch.number + ' — ' + ch.title));
      return DB.sections(chapterId).then(function (sections) {
        if (sections.length) {
          content.appendChild(el('h3', 'section-title', 'Sections'));
          var ul = el('ul', 'list');
          sections.forEach(function (s) {
            var btn = el('button', 'list-item');
            btn.style.paddingLeft = (16 + (s.level - 1) * 16) + 'px';
            btn.appendChild(el('span', 'item-title', s.title));
            btn.addEventListener('click', function () {
              Theory.render(s.id, s.title);
              setTheoryOpen(true);
            });
            var li = el('li');
            li.appendChild(btn);
            ul.appendChild(li);
          });
          content.appendChild(ul);
        }
        return DB.exercises(chapterId).then(function (exercises) {
          Nav.setExercises(chapterId, exercises);
          if (exercises.length) {
            content.appendChild(el('h3', 'section-title', 'Exercises (' + exercises.length + ')'));
            var ul2 = el('ul', 'list');
            exercises.forEach(function (ex) {
              var label = ex.number ? ('Exercise ' + ex.number) : 'Reading Comprehension';
              var btn = el('button', 'list-item');
              btn.appendChild(el('span', 'item-title', label));
              btn.appendChild(el('span', 'item-meta', ex.kind));
              btn.addEventListener('click', function () { openExercise(ex); });
              var li = el('li');
              li.appendChild(btn);
              ul2.appendChild(li);
            });
            content.appendChild(ul2);
          }
        });
      });
    }).catch(function (err) {
      console.error('openChapter error:', err);
      var content = document.getElementById('content');
      content.innerHTML = '';
      content.appendChild(el('p', 'muted', 'Error loading chapter: ' + err.message));
    });
  }

  function openExercise(ex) {
    Exercises.render(ex.id);
    Nav.setCurrent(ex.id);
    renderNavBar();
    var secPromise = ex.sectionId ? db.sections.get(ex.sectionId) : Promise.resolve(null);
    return Promise.all([DB.chapter(ex.chapterId), secPromise]).then(function (r) {
      var ch = r[0], sec = r[1];
      if (followExercise && sec) {
        Theory.render(sec.id, sec.title);
        setTheoryOpen(true);
      }
      var items = [
        { label: 'Book', action: home },
        { label: 'Chapter ' + ch.number, action: function () { openChapter(ch.id); } }
      ];
      if (sec) {
        items.push({ label: sec.title, action: function () {
          openChapter(ch.id).then(function () { Theory.render(sec.id, sec.title); setTheoryOpen(true); });
        }});
      }
      items.push({ label: ex.number ? ('Exercise ' + ex.number) : 'Reading' });
      renderBreadcrumb(items);
    });
  }

  function renderNavBar() {
    var content = document.getElementById('content');
    var bar = el('div', 'nav-bar');
    var prevBtn = el('button', 'nav-btn', '‹ Prev');
    prevBtn.disabled = !Nav.hasPrev();
    prevBtn.addEventListener('click', function () {
      if (Nav.hasPrev()) db.exercises.get(Nav.prevId()).then(openExercise);
    });
    var nextBtn = el('button', 'nav-btn', 'Next ›');
    nextBtn.addEventListener('click', function () {
      if (Nav.hasNext()) {
        db.exercises.get(Nav.nextId()).then(openExercise);
      } else {
        nextChapter();
      }
    });
    bar.appendChild(prevBtn);
    bar.appendChild(nextBtn);
    content.appendChild(bar);
  }

  function nextChapter() {
    return DB.chapters().then(function (chapters) {
      var i = chapters.findIndex(function (c) { return c.id === Nav.chapterId; });
      if (i >= 0 && i < chapters.length - 1) {
        openChapter(chapters[i + 1].id);
      }
    });
  }

  function setTheoryOpen(open) {
    var panel = document.getElementById('theory-panel');
    var layout = document.querySelector('.layout');
    var toggle = document.getElementById('theory-toggle');
    panel.classList.toggle('open', open);
    layout.classList.toggle('two-col', open);
    toggle.style.display = open ? 'none' : '';
  }

  function updateFollowToggle() {
    var btn = document.getElementById('follow-toggle');
    if (btn) {
      btn.classList.toggle('active', followExercise);
      btn.setAttribute('aria-pressed', String(followExercise));
    }
  }

  function initTheoryPanel() {
    document.getElementById('theory-toggle').addEventListener('click', function () { setTheoryOpen(true); });
    document.getElementById('theory-close').addEventListener('click', function () { setTheoryOpen(false); });
    var ft = document.getElementById('follow-toggle');
    if (ft) {
      ft.addEventListener('click', function () {
        followExercise = !followExercise;
        db.meta.put({ key: 'followExercise', value: followExercise });
        updateFollowToggle();
      });
    }
    setTheoryOpen(window.matchMedia('(min-width: 900px)').matches);
  }

  function init() {
    initTheoryPanel();
    return db.open().then(function () {
      return Importer.run().then(function (res) {
        document.getElementById('overall-progress').textContent =
          res.counts.chapters + ' chapters · ' + res.counts.exercises + ' exercises';
        return db.meta.get('followExercise').then(function (m) {
          if (m) followExercise = m.value !== false;
          updateFollowToggle();
          return home();
        });
      });
    });
  }

  return { init: init, home: home };
})();

document.addEventListener('DOMContentLoaded', function () {
  App.init().catch(function (err) {
    console.error(err);
    document.getElementById('content').textContent = 'Startup failed: ' + err.message;
  });
});
