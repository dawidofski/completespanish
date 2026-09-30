/* js/theory.js — render theory blocks (Step 4.2) */
'use strict';

var Theory = (function () {
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function content(block) {
    return block.html || escapeHtml(block.text || '');
  }

  function blockEl(type, label, bodyHtml) {
    var d = document.createElement('div');
    d.className = 'theory-block theory-' + type;
    if (label) {
      var l = document.createElement('div');
      l.className = 'theory-block-label';
      l.textContent = label;
      d.appendChild(l);
    }
    var c = document.createElement('div');
    c.className = 'theory-block-body';
    c.innerHTML = bodyHtml;
    d.appendChild(c);
    return d;
  }

  function renderOne(b) {
    switch (b.type) {
      case 'note':
        return blockEl('note', 'Note', content(b));
      case 'tip':
        return blockEl('tip', 'Tip', content(b));
      case 'list':
        return blockEl('list', null, content(b));
      case 'table':
        var fig = document.createElement('figure');
        fig.className = 'theory-block theory-table';
        var img = document.createElement('img');
        img.src = 'data/tables/' + b.src;
        img.alt = b.text || 'table';
        fig.appendChild(img);
        return fig;
      default:
        return blockEl('paragraph', null, content(b));
    }
  }

  function render(sectionId, sectionTitle) {
    var body = document.getElementById('theory-body');
    return DB.theoryBlocks(sectionId).then(function (blocks) {
      body.innerHTML = '';
      if (sectionTitle) {
        var h = document.createElement('h3');
        h.className = 'theory-section-title';
        h.textContent = sectionTitle;
        body.appendChild(h);
      }
      if (!blocks.length) {
        var p = document.createElement('p');
        p.className = 'muted';
        p.textContent = 'No theory for this section.';
        body.appendChild(p);
        return;
      }
      blocks.forEach(function (b) {
        body.appendChild(renderOne(b));
      });
      body.scrollTop = 0;
    });
  }

  return { render: render };
})();
