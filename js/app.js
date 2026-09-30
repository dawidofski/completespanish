/* js/app.js — app shell + navigation (Step 4.1) */
'use strict';

var App = (function () {
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
    return DB.parts().then(function (parts) {
      return DB.chapters().then(function (chapters) {
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
            var div = el('div', 'list-item item-plain');
            div.style.paddingLeft = (16 + (s.level - 1) * 16) + 'px';
            div.appendChild(el('span', 'item-title', s.title));
            var li = el('li');
            li.appendChild(div);
            ul.appendChild(li);
          });
          content.appendChild(ul);
        }
        return DB.exercises(chapterId).then(function (exercises) {
          if (exercises.length) {
            content.appendChild(el('h3', 'section-title', 'Exercises (' + exercises.length + ')'));
            var ul2 = el('ul', 'list');
            exercises.forEach(function (ex) {
              var label = ex.number ? ('Exercise ' + ex.number) : 'Reading Comprehension';
              var div = el('div', 'list-item item-plain');
              div.appendChild(el('span', 'item-title', label));
              div.appendChild(el('span', 'item-meta', ex.kind));
              var li = el('li');
              li.appendChild(div);
              ul2.appendChild(li);
            });
            content.appendChild(ul2);
          }
        });
      });
    });
  }

  function initTheoryPanel() {
    var panel = document.getElementById('theory-panel');
    document.getElementById('theory-toggle').addEventListener('click', function () {
      panel.classList.add('open');
    });
    document.getElementById('theory-close').addEventListener('click', function () {
      panel.classList.remove('open');
    });
  }

  function init() {
    initTheoryPanel();
    return db.open().then(function () {
      return Importer.run().then(function (res) {
        document.getElementById('overall-progress').textContent =
          res.counts.chapters + ' chapters';
        return home();
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
