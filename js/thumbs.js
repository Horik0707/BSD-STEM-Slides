/* BSD STEM Slides — slide thumbnails pane, slide sorter, notes pane and status bar */
(function (B) {
  'use strict';
  const U = B.util, A = B.app;
  const h = U.h;
  const T = (B.thumbs = {});
  let list, sorter;
  let dropIndicator;
  let W = 168;
  const fitWidth = () => Math.max(96, Math.min(168, list.clientWidth - 46));

  T.init = () => {
    list = U.$('#thumbList');
    sorter = U.$('#sorter');
    dropIndicator = h('div', { class: 'drop-indicator' });
    for (const container of [list, sorter]) {
      container.addEventListener('pointerdown', () => {
        A.focus = 'thumbs';
        if (A.editingId) B.editor.endEdit();
        B.emit('focus-area');
      });
      container.addEventListener('keydown', onKey);
      container.addEventListener('dragover', onDragOver);
      container.addEventListener('dragleave', (e) => {
        if (!container.contains(e.relatedTarget)) dropIndicator.remove();
      });
      container.addEventListener('drop', onDrop);
      container.addEventListener('contextmenu', (e) => {
        const item = e.target.closest('.thumb');
        e.preventDefault();
        if (item && !B.slides.selectedIds().includes(item.dataset.id)) B.slides.go(B.slides.indexOf(item.dataset.id));
        slideMenu(e.clientX, e.clientY, !!item);
      });
    }
    U.$('#thumbAdd').addEventListener('click', () => B.slides.add());
    // keep thumbnails sized to the pane (it narrows on small screens)
    new ResizeObserver(U.debounce(() => {
      const w = fitWidth();
      if (Math.abs(w - W) > 2 && A.deck) {
        W = w;
        T.renderAll();
      }
    }, 120)).observe(list);
    initNotes();
    initStatus();
  };

  const item = (s, i, width) => {
    const it = h('div', { class: 'thumb' + (s.hidden ? ' hidden-slide' : ''), 'data-id': s.id, draggable: 'true', tabindex: '-1', role: 'option', 'aria-label': `Slide ${i + 1}` });
    const meta = h('div', { class: 'thumb-meta' }, h('span', { class: 'thumb-num' }, String(i + 1)));
    const hasAnim = s.elements.some((e) => e.anim && e.anim.effect && e.anim.effect !== 'none');
    const hasTrans = s.transition && s.transition.type && s.transition.type !== 'none';
    if (hasAnim || hasTrans) meta.appendChild(h('span', { class: 'thumb-star', title: hasAnim ? 'Has animations' : 'Has a transition', html: U.icon('auto_awesome') }));
    if (s.hidden) meta.appendChild(h('span', { class: 'thumb-hidden', title: 'Hidden slide', html: U.icon('visibility_off') }));
    const frame = h('div', { class: 'thumb-frame' });
    frame.appendChild(B.render.thumb(s, width, { index: i }));
    it.append(meta, frame);
    it.addEventListener('click', (e) => onItemClick(e, s, i));
    it.addEventListener('dblclick', () => {
      if (A.view === 'sorter') {
        B.actions.setView('normal');
        B.slides.go(B.slides.indexOf(s.id), { force: true });
      }
    });
    it.addEventListener('dragstart', (e) => {
      const ids = B.slides.selectedIds().includes(s.id) ? B.slides.selectedIds() : [s.id];
      A.dragSlides = ids;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/x-bsd-slides', ids.join(','));
      it.classList.add('dragging');
    });
    it.addEventListener('dragend', () => {
      it.classList.remove('dragging');
      dropIndicator.remove();
      A.dragSlides = null;
    });
    return it;
  };

  function onItemClick(e, s, i) {
    if (U.mod(e)) {
      const ids = B.slides.selectedIds();
      A.slideSel = ids.includes(s.id) && ids.length > 1 ? ids.filter((x) => x !== s.id) : ids.concat(s.id);
      B.slides.go(B.slides.indexOf(A.slideSel[A.slideSel.length - 1]), { keepSel: true });
    } else if (e.shiftKey) {
      const a = A.current, b = i;
      A.slideSel = A.deck.slides.slice(Math.min(a, b), Math.max(a, b) + 1).map((x) => x.id);
      B.slides.go(i, { keepSel: true });
    } else B.slides.go(i);
    T.highlight();
  }

  T.renderAll = () => {
    if (!A.deck) return;
    if (list.clientWidth) W = fitWidth();
    list.innerHTML = '';
    A.deck.slides.forEach((s, i) => list.appendChild(item(s, i, W)));
    T.highlight();
    if (A.view === 'sorter') T.renderSorter();
  };

  T.renderSorter = () => {
    sorter.innerHTML = '';
    const size = U.storage.get('sorterSize', 240);
    A.deck.slides.forEach((s, i) => sorter.appendChild(item(s, i, size)));
    T.highlight();
  };

  T.updateCurrent = () => {
    const s = B.curSlide();
    if (!s) return;
    for (const container of A.view === 'sorter' ? [list, sorter] : [list]) {
      const old = container.querySelector(`.thumb[data-id="${CSS.escape(s.id)}"]`);
      if (!old) continue;
      const fresh = item(s, A.current, container === sorter ? U.storage.get('sorterSize', 240) : W);
      old.replaceWith(fresh);
    }
    T.highlight(false);
  };
  T.updateLive = U.debounce(() => T.updateCurrent(), 250);

  T.highlight = (scroll = true) => {
    const ids = new Set(B.slides.selectedIds());
    const cur = B.curSlide() && B.curSlide().id;
    for (const container of [list, sorter]) {
      U.$$('.thumb', container).forEach((t) => {
        t.classList.toggle('current', t.dataset.id === cur);
        t.classList.toggle('selected', ids.has(t.dataset.id));
        t.setAttribute('aria-selected', t.dataset.id === cur);
      });
    }
    if (scroll) {
      const c = (A.view === 'sorter' ? sorter : list).querySelector('.thumb.current');
      if (c) c.scrollIntoView({ block: 'nearest' });
    }
  };

  function onKey(e) {
    if (e.target.closest('input,textarea')) return;
    const grid = A.view === 'sorter' && e.currentTarget === sorter;
    const perRow = grid ? Math.max(1, Math.floor(sorter.clientWidth / (U.storage.get('sorterSize', 240) + 24))) : 1;
    const go = (d) => {
      e.preventDefault();
      if (U.mod(e)) return B.slides.moveBy(d > 0 ? 1 : -1);
      B.slides.go(U.clamp(A.current + d, 0, A.deck.slides.length - 1));
    };
    if (e.key === 'ArrowDown') go(perRow);
    else if (e.key === 'ArrowUp') go(-perRow);
    else if (e.key === 'ArrowRight' && grid) go(1);
    else if (e.key === 'ArrowLeft' && grid) go(-1);
    else if (e.key === 'Home') go(-A.current);
    else if (e.key === 'End') go(A.deck.slides.length - 1 - A.current);
    else if (e.key === 'Enter' && !grid) {
      e.preventDefault();
      B.slides.add();
    }
  }

  function dropIndex(container, e) {
    const items = U.$$('.thumb', container);
    const grid = container === sorter;
    for (let i = 0; i < items.length; i++) {
      const r = items[i].getBoundingClientRect();
      if (grid) {
        if (e.clientY < r.bottom && e.clientX < r.left + r.width / 2 && e.clientY > r.top - 12) return { i, el: items[i], before: true };
      } else if (e.clientY < r.top + r.height / 2) return { i, el: items[i], before: true };
    }
    return { i: items.length, el: items[items.length - 1], before: false };
  }

  function onDragOver(e) {
    if (!A.dragSlides) return;
    e.preventDefault();
    const container = e.currentTarget;
    const d = dropIndex(container, e);
    if (!d.el) return;
    const r = d.el.getBoundingClientRect(), cr = container.getBoundingClientRect();
    dropIndicator.classList.toggle('vertical', container === sorter);
    if (container === sorter) {
      dropIndicator.style.left = (d.before ? r.left : r.right) - cr.left + container.scrollLeft - 6 + 'px';
      dropIndicator.style.top = r.top - cr.top + container.scrollTop + 'px';
      dropIndicator.style.height = r.height + 'px';
      dropIndicator.style.width = '';
    } else {
      dropIndicator.style.top = (d.before ? r.top : r.bottom) - cr.top + container.scrollTop - 3 + 'px';
      dropIndicator.style.left = '8px';
      dropIndicator.style.width = cr.width - 16 + 'px';
      dropIndicator.style.height = '';
    }
    if (dropIndicator.parentNode !== container) container.appendChild(dropIndicator);
  }

  function onDrop(e) {
    if (!A.dragSlides) return;
    e.preventDefault();
    const d = dropIndex(e.currentTarget, e);
    dropIndicator.remove();
    const ids = A.dragSlides;
    A.dragSlides = null;
    B.slides.move(ids, d.i);
    A.slideSel = ids;
    T.highlight();
  }

  function slideMenu(x, y, onItem) {
    const S = B.slides;
    const k = (s) => (U.isMac ? s.replace('Ctrl+', '⌘') : s);
    const items = [
      onItem ? { label: 'Cut', icon: 'content_cut', shortcut: k('Ctrl+X'), action: () => S.cut() } : null,
      onItem ? { label: 'Copy', icon: 'content_copy', shortcut: k('Ctrl+C'), action: () => S.copy() } : null,
      { label: 'Paste', icon: 'content_paste', shortcut: k('Ctrl+V'), disabled: !A.clipboard || A.clipboard.kind !== 'slides', action: () => S.paste() },
      { sep: true },
      { label: 'New Slide', icon: 'add_box', shortcut: k('Ctrl+M'), action: () => S.add() },
      onItem ? { label: 'Duplicate Slide', icon: 'control_point_duplicate', shortcut: k('Ctrl+D'), action: () => S.duplicate() } : null,
      onItem ? { label: 'Delete Slide', icon: 'delete', shortcut: 'Del', action: () => S.remove() } : null,
      { sep: true },
      onItem ? { label: 'Layout', icon: 'dashboard', sub: B.LAYOUTS.map((l) => ({ label: l.name, checked: B.curSlide().layout === l.id, action: () => S.setLayout(l.id) })) } : null,
      onItem ? { label: 'Reset Slide', icon: 'restart_alt', action: () => S.reset() } : null,
      onItem ? { label: 'Format Background…', icon: 'format_paint', action: () => B.ui.openSidePane('background') } : null,
      onItem ? { label: B.curSlide().hidden ? 'Unhide Slide' : 'Hide Slide', icon: B.curSlide().hidden ? 'visibility' : 'visibility_off', action: () => S.toggleHidden() } : null,
      onItem ? { label: 'Move Up', icon: 'arrow_upward', action: () => S.moveBy(-1), disabled: A.current === 0 } : null,
      onItem ? { label: 'Move Down', icon: 'arrow_downward', action: () => S.moveBy(1), disabled: A.current === A.deck.slides.length - 1 } : null,
    ];
    B.ui.menu(items, x, y);
  }

  /* ---------------- notes ---------------- */
  function initNotes() {
    const ta = U.$('#notesInput');
    const commit = U.debounce(() => B.store.commit(), 700);
    ta.addEventListener('input', () => {
      const s = B.curSlide();
      if (!s) return;
      s.notes = ta.value;
      B.store.markDirty();
      commit();
    });
    ta.addEventListener('blur', () => commit.flush());
    ta.addEventListener('focus', () => {
      A.focus = 'notes';
      if (A.editingId) B.editor.endEdit();
    });
    const split = U.$('#notesSplit');
    const pane = U.$('#notesPane');
    const saved = U.storage.get('notesH', 96);
    pane.style.height = saved + 'px';
    split.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const y0 = e.clientY, h0 = pane.offsetHeight;
      split.setPointerCapture(e.pointerId);
      const mv = (ev) => {
        const hh = U.clamp(h0 - (ev.clientY - y0), 40, window.innerHeight * 0.5);
        pane.style.height = hh + 'px';
        B.editor.layout();
      };
      const up = () => {
        split.removeEventListener('pointermove', mv);
        split.removeEventListener('pointerup', up);
        U.storage.set('notesH', pane.offsetHeight);
      };
      split.addEventListener('pointermove', mv);
      split.addEventListener('pointerup', up);
    });
  }
  T.loadNotes = () => {
    const ta = U.$('#notesInput');
    const s = B.curSlide();
    if (document.activeElement !== ta) ta.value = (s && s.notes) || '';
  };

  /* ---------------- status bar ---------------- */
  function initStatus() {
    const sb = U.$('#statusbar');
    sb.innerHTML = '';
    const left = h('div', { class: 'sb-left' });
    const right = h('div', { class: 'sb-right' });
    const slideInfo = h('span', { class: 'sb-item', id: 'sbSlide' });
    const themeInfo = h('span', { class: 'sb-item', id: 'sbTheme' });
    const a11y = h('button', { class: 'sb-btn', id: 'sbA11y', type: 'button', title: 'Accessibility checker' });
    a11y.addEventListener('click', () => B.dialogs.accessibility());
    left.append(slideInfo, themeInfo, a11y);
    const btn = (icon, title, fn, id) => {
      const b = h('button', { class: 'sb-btn', type: 'button', title, 'aria-label': title, id, html: U.icon(icon) });
      b.addEventListener('click', fn);
      return b;
    };
    const notesBtn = h('button', { class: 'sb-btn labeled', type: 'button', id: 'sbNotes', html: U.icon('sticky_note_2') + '<span>Notes</span>' });
    notesBtn.addEventListener('click', () => B.actions.toggleNotes());
    const zoomOut = btn('remove', 'Zoom out', () => B.editor.setZoom(A.zoom - 10));
    const zoomIn = btn('add', 'Zoom in', () => B.editor.setZoom(A.zoom + 10));
    const slider = h('input', { type: 'range', min: 10, max: 400, value: 100, id: 'sbZoomSlider', 'aria-label': 'Zoom' });
    slider.addEventListener('input', () => B.editor.setZoom(+slider.value));
    const pct = h('button', { class: 'sb-btn sb-pct', type: 'button', id: 'sbZoomPct', title: 'Zoom' });
    pct.addEventListener('click', () => B.ui.menu([400, 200, 150, 100, 75, 50].map((z) => ({ label: z + '%', action: () => B.editor.setZoom(z) })).concat([{ sep: true }, { label: 'Fit to Window', icon: 'fit_screen', action: () => B.editor.fit() }]), 0, 0, { anchor: pct }));
    right.append(
      notesBtn,
      h('span', { class: 'sb-sep' }),
      btn('view_sidebar', 'Normal', () => B.actions.setView('normal'), 'sbNormal'),
      btn('grid_view', 'Slide Sorter', () => B.actions.setView('sorter'), 'sbSorter'),
      btn('chrome_reader_mode', 'Reading View', () => B.show.start(A.current, { reading: true })),
      btn('slideshow', 'Slide Show (F5)', () => B.show.start(A.current)),
      h('span', { class: 'sb-sep' }),
      zoomOut,
      slider,
      zoomIn,
      pct,
      btn('fit_screen', 'Fit slide to current window', () => B.editor.fit(), 'sbFit')
    );
    sb.append(left, right);
  }

  T.updateStatus = () => {
    if (!A.deck) return;
    const n = A.deck.slides.length;
    const s = B.curSlide();
    U.$('#sbSlide').textContent = A.view === 'sorter' && B.slides.selectedIds().length > 1 ? `${B.slides.selectedIds().length} slides selected` : `Slide ${A.current + 1} of ${n}${s && s.hidden ? ' (hidden)' : ''}`;
    U.$('#sbTheme').textContent = B.theme().name;
    const issues = B.dialogs.a11yIssues().length;
    const a = U.$('#sbA11y');
    a.innerHTML = U.icon(issues ? 'accessibility_new' : 'accessible') + `<span>Accessibility: ${issues ? 'Investigate' : 'Good to go'}</span>`;
    a.classList.toggle('warn', !!issues);
    U.$('#sbNotes').classList.toggle('on', A.showNotes);
    U.$('#sbNormal').classList.toggle('on', A.view === 'normal');
    U.$('#sbSorter').classList.toggle('on', A.view === 'sorter');
    T.updateZoom();
  };
  T.updateZoom = () => {
    const sl = U.$('#sbZoomSlider');
    if (!sl) return;
    sl.value = A.zoom;
    U.$('#sbZoomPct').textContent = A.zoom + '%';
    U.$('#sbFit').classList.toggle('on', A.fit);
  };
})(window.BSD);
