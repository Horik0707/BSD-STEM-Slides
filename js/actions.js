/* BSD STEM Slides — slide operations and shared commands used by ribbon, menus and shortcuts */
(function (B) {
  'use strict';
  const U = B.util, A = B.app, M = B.model;
  const E = () => B.editor;

  /* ======================= slides ======================= */
  const SL = (B.slides = {});
  A.slideSel = [];

  SL.selectedIds = () => {
    const ids = A.slideSel.filter((id) => A.deck.slides.some((s) => s.id === id));
    return ids.length ? ids : [B.curSlide().id];
  };
  SL.indexOf = (id) => A.deck.slides.findIndex((s) => s.id === id);

  SL.go = (i, opts = {}) => {
    if (!A.deck) return;
    if (A.editingId) E().endEdit(true);
    i = U.clamp(i, 0, A.deck.slides.length - 1);
    const changed = i !== A.current;
    A.current = i;
    if (!opts.keepSel) A.slideSel = [A.deck.slides[i].id];
    A.selection = [];
    if (changed || opts.force) B.emit('current');
    else B.emit('slidesel');
  };

  SL.add = (layout) => {
    const cur = B.curSlide();
    if (!layout) {
      layout = !cur || cur.layout === 'title' ? 'title-content' : cur.layout;
      // imported slides use the 'blank' layout but still have a title: give new slides one too
      if (layout === 'blank' && cur && cur.elements.some((e) => e.placeholder)) layout = 'title-content';
    }
    const s = M.newSlide(layout);
    const idxs = SL.selectedIds().map(SL.indexOf);
    const at = Math.max(...idxs, A.current) + 1;
    A.deck.slides.splice(at, 0, s);
    B.store.commit();
    B.emit('slides');
    SL.go(at, { force: true });
  };

  SL.duplicate = () => {
    const ids = SL.selectedIds();
    const idxs = ids.map(SL.indexOf).sort((a, b) => a - b);
    const copies = idxs.map((i) => M.cloneSlide(A.deck.slides[i]));
    const at = idxs[idxs.length - 1] + 1;
    A.deck.slides.splice(at, 0, ...copies);
    B.store.commit();
    B.emit('slides');
    A.slideSel = copies.map((c) => c.id);
    SL.go(at, { force: true, keepSel: true });
  };

  SL.remove = () => {
    const ids = new Set(SL.selectedIds());
    if (ids.size >= A.deck.slides.length) {
      // keep one blank slide like PowerPoint's minimum
      A.deck.slides = [M.newSlide('title')];
      A.current = 0;
    } else {
      const first = Math.min(...[...ids].map(SL.indexOf));
      A.deck.slides = A.deck.slides.filter((s) => !ids.has(s.id));
      A.current = U.clamp(first, 0, A.deck.slides.length - 1);
    }
    A.slideSel = [B.curSlide().id];
    A.selection = [];
    B.store.commit();
    B.emit('deck');
  };

  /** Move slides (by id) so that they start at `to` (index in the original list, insertion point). */
  SL.move = (ids, to) => {
    const set = new Set(ids);
    const moving = A.deck.slides.filter((s) => set.has(s.id));
    if (!moving.length) return;
    const curId = B.curSlide().id;
    const before = A.deck.slides.slice(0, to).filter((s) => !set.has(s.id));
    const after = A.deck.slides.slice(to).filter((s) => !set.has(s.id));
    const next = before.concat(moving, after);
    if (next.every((s, i) => s === A.deck.slides[i])) return;
    A.deck.slides = next;
    A.current = next.findIndex((s) => s.id === curId);
    B.store.commit();
    B.emit('deck');
  };
  SL.moveBy = (dir) => {
    const ids = SL.selectedIds();
    const idxs = ids.map(SL.indexOf).sort((a, b) => a - b);
    const to = dir < 0 ? Math.max(0, idxs[0] - 1) : Math.min(A.deck.slides.length, idxs[idxs.length - 1] + 2);
    SL.move(ids, to);
  };

  /** Switch layout, carrying text from old placeholders into the new ones. */
  SL.setLayout = (layoutId, slide = B.curSlide()) => {
    if (A.editingId) E().endEdit(true);
    const fresh = B.layoutElements(layoutId, A.deck.w, A.deck.h).map((p) => M.newElement('text', p));
    const old = slide.elements;
    const used = new Set();
    for (const ph of fresh) {
      const match = old.find((o) => !used.has(o) && o.placeholder === ph.placeholder && !U.isHtmlEmpty(o.html));
      if (match) {
        used.add(match);
        ph.html = match.html;
        ph.id = match.id;
        if (match.anim) ph.anim = match.anim;
      }
    }
    const keep = old.filter((o) => !o.placeholder || (!used.has(o) && !U.isHtmlEmpty(o.html)));
    keep.forEach((o) => {
      if (o.placeholder) delete o.placeholder;
    });
    slide.elements = fresh.concat(keep);
    slide.layout = layoutId;
    A.selection = [];
    B.store.commit();
    B.emit('current');
    B.emit('content');
  };

  SL.reset = () => {
    const slide = B.curSlide();
    const fresh = B.layoutElements(slide.layout, A.deck.w, A.deck.h);
    const counts = {};
    slide.elements.forEach((el) => {
      if (!el.placeholder) return;
      const n = (counts[el.placeholder] = (counts[el.placeholder] || 0) + 1);
      const tpl = fresh.filter((f) => f.placeholder === el.placeholder)[n - 1];
      if (!tpl) return;
      ['x', 'y', 'w', 'h', 'size', 'align', 'valign', 'color', 'bold'].forEach((k) => (el[k] = tpl[k]));
      el.rot = 0;
      el.font = null;
      el.lineHeight = null;
      el.fill = 'none';
      el.stroke = 'none';
      el.html = U.sanitizeHtml(el.html);
    });
    E().changed(true);
  };

  SL.toggleHidden = () => {
    const ids = SL.selectedIds();
    const hide = !A.deck.slides[SL.indexOf(ids[0])].hidden;
    ids.forEach((id) => (A.deck.slides[SL.indexOf(id)].hidden = hide));
    B.store.commit();
    B.emit('slides');
    B.emit('content');
  };
  SL.toggleDecor = () => {
    const s = B.curSlide();
    s.hideDecor = !s.hideDecor;
    E().changed(true);
    B.emit('slides');
  };

  SL.copy = () => {
    const ids = SL.selectedIds();
    const slides = ids.map((id) => U.clone(A.deck.slides[SL.indexOf(id)]));
    const assets = {};
    M.usedAssets({ slides }).forEach((a) => A.assets[a] && (assets[a] = A.assets[a]));
    A.clipboard = { kind: 'slides', slides, assets, text: slides.map((s) => s.elements.map((e) => U.htmlToText(e.html || '')).join('\n')).join('\n\n') || ' ' };
    return A.clipboard.text;
  };
  SL.cut = () => {
    const t = SL.copy();
    SL.remove();
    return t;
  };
  SL.paste = () => {
    const c = A.clipboard;
    if (!c || c.kind !== 'slides') return false;
    Object.assign(A.assets, c.assets);
    const copies = c.slides.map((s) => M.cloneSlide(s));
    const at = A.current + 1;
    A.deck.slides.splice(at, 0, ...copies);
    B.store.commit();
    B.emit('slides');
    A.slideSel = copies.map((s) => s.id);
    SL.go(at, { force: true, keepSel: true });
    return true;
  };

  /* ======================= shared actions ======================= */
  const AC = (B.actions = {});

  AC.toggleGrid = () => {
    A.showGrid = !A.showGrid;
    U.storage.set('grid', A.showGrid);
    E().layout();
    B.emit('view');
  };
  AC.toggleGuides = () => {
    A.showGuides = !A.showGuides;
    U.storage.set('guides', A.showGuides);
    B.emit('view');
  };
  AC.toggleNotes = () => {
    A.showNotes = !A.showNotes;
    U.storage.set('notes', A.showNotes);
    U.$('#notesPane').hidden = !A.showNotes;
    U.$('#notesSplit').hidden = !A.showNotes;
    E().layout();
    B.emit('view');
  };

  AC.setView = (view) => {
    if (A.editingId) E().endEdit(true);
    A.view = view;
    document.body.dataset.view = view;
    if (view === 'sorter') B.thumbs.renderSorter();
    else {
      E().render();
      B.thumbs.renderAll();
    }
    B.emit('view');
  };

  AC.pasteFromSystem = async () => {
    if (A.editingId) {
      try {
        const t = await navigator.clipboard.readText();
        E().restoreRange();
        document.execCommand('insertText', false, t);
      } catch (e) {
        B.ui.toast(`Use ${U.isMac ? '⌘' : 'Ctrl'}+V to paste text.`);
      }
      return;
    }
    if (A.clipboard) {
      if (A.clipboard.kind === 'slides' && A.focus === 'thumbs') return SL.paste();
      if (A.clipboard.kind === 'elements') return E().paste();
      if (A.clipboard.kind === 'slides') return SL.paste();
    }
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        for (const it of items) {
          const type = it.types.find((t) => t.startsWith('image/'));
          if (type) {
            const blob = await it.getType(type);
            return E().insertImageFile(new File([blob], 'pasted.png', { type }));
          }
        }
      }
      const t = await navigator.clipboard.readText();
      if (t) E().pastePlainText(t);
    } catch (e) {
      B.ui.toast(`Use ${U.isMac ? '⌘' : 'Ctrl'}+V to paste from other apps.`);
    }
  };

  AC.cut = () => (A.focus === 'thumbs' ? SL.cut() : E().cut());
  AC.copy = () => (A.focus === 'thumbs' ? SL.copy() : E().copy());

  AC.insertTextBox = () => E().setDrawTool({ type: 'text' });
  AC.insertShape = (shape) => E().setDrawTool({ type: 'shape', shape });

  AC.insertImage = async () => {
    const files = await U.pickFile('image/*', true);
    for (const f of files || []) await E().insertImageFile(f);
  };
  AC.insertImageUrl = async () => {
    const url = await B.ui.prompt('Picture from the web', 'Image address (URL)', '', { placeholder: 'https://…', help: 'The picture must allow other sites to show it. Downloading it and using “This Device” is more reliable.' });
    if (!url) return;
    try {
      await E().insertImageSrc(url.trim());
    } catch (e) {
      B.ui.toast('That address did not load as a picture.');
    }
  };

  AC.insertTable = (rows, cols) => {
    const W = A.deck.w;
    const el = M.newElement('table', {
      rows: Array.from({ length: rows }, () => new Array(cols).fill('')),
      w: Math.min(W - 120, cols * 160),
      h: rows * 40,
    });
    E().insertElement(el);
    E().startCellEdit(el.id, 0, 0);
  };

  AC.insertChart = (kind = 'column') => {
    const el = M.newElement('chart', { w: 640, h: 380 });
    el.chart.kind = kind;
    if (kind === 'pie' || kind === 'doughnut') {
      el.chart.series = [{ name: 'Sales', values: [8.2, 3.2, 1.4, 1.2] }];
      el.chart.labels = ['1st Qtr', '2nd Qtr', '3rd Qtr', '4th Qtr'];
      el.chart.dataLabels = true;
    } else if (kind === 'scatter') {
      el.chart.title = 'Distance vs. Time';
      el.chart.labels = ['0', '1', '2', '3', '4', '5'];
      el.chart.series = [{ name: 'Trial 1', values: [0, 2.1, 3.9, 6.2, 7.8, 10.1] }];
      el.chart.xTitle = 'Time (s)';
      el.chart.yTitle = 'Distance (m)';
      el.chart.trendline = true;
      el.chart.legend = false;
    }
    E().insertElement(el);
    B.dialogs.chart(el);
  };

  AC.insertEquation = (latex) => {
    if (!latex) return B.dialogs.equation(null);
    const el = M.newElement('equation', { latex, w: 420, h: 90 });
    E().insertElement(el);
    AC.fitEquation(el);
  };
  /** Size an equation element to its rendered formula. */
  AC.fitEquation = (el) => {
    const n = E().node(el.id);
    const k = n && n.querySelector('.katex-display, .katex, .el-eq');
    if (!k) return;
    const eq = n.querySelector('.el-eq');
    eq.style.width = 'max-content';
    eq.style.height = 'auto';
    const w = Math.ceil(eq.offsetWidth) + 24, h = Math.ceil(eq.offsetHeight) + 12;
    eq.style.width = eq.style.height = '';
    const cx = el.x + el.w / 2, cy = el.y + el.h / 2;
    el.w = Math.max(60, w);
    el.h = Math.max(30, h);
    el.x = Math.round(cx - el.w / 2);
    el.y = Math.round(cy - el.h / 2);
    E().refreshEl(el);
    E().drawSelection();
    B.store.commit();
    B.emit('content');
  };

  AC.insertVideo = () => B.dialogs.video(null);
  AC.insertVideoFile = async () => {
    const f = await U.pickFile('video/mp4,video/webm,video/ogg');
    if (f) E().insertVideoFile(f);
  };

  AC.WORDART = [
    { name: 'Bold Accent', css: { color: '@accent1', bold: true, size: 60 } },
    { name: 'Outlined', css: { color: '@accent2', bold: true, size: 60, html: (t) => `<div><span style="-webkit-text-stroke: 2px currentColor; color: transparent;">${t}</span></div>` } },
    { name: 'Shadowed', css: { color: '@text', bold: true, size: 60, shadow: true } },
    { name: 'Highlight Band', css: { color: '#FFFFFF', bold: true, size: 54, fill: '@accent1', align: 'center' } },
  ];
  AC.insertWordArt = (i) => {
    const s = AC.WORDART[i];
    const text = 'Your text here';
    const el = M.newElement('text', Object.assign({ w: 640, align: 'center' }, s.css, { html: s.css.html ? s.css.html(text) : `<div>${text}</div>` }));
    E().insertElement(el, { edit: true });
  };

  AC.insertSlideNumber = () => {
    A.deck.slideNumbers = !A.deck.slideNumbers;
    B.store.commit();
    B.emit('deck');
  };

  AC.link = async () => {
    const E_ = E();
    if (A.editingId) {
      const s = window.getSelection();
      const hasText = s.rangeCount && !s.getRangeAt(0).collapsed;
      const url = await B.ui.prompt('Insert Link', 'Address', 'https://', { placeholder: 'https://example.com' });
      if (!url) return;
      const clean = /^(https?:|mailto:)/i.test(url) ? url : 'https://' + url;
      E_.restoreRange();
      if (hasText) E_.format('createLink', clean);
      else document.execCommand('insertHTML', false, `<a href="${U.esc(clean)}">${U.esc(url)}</a>`);
      return;
    }
    const el = B.selectedEls()[0];
    if (!el) return B.ui.toast('Select a shape or some text first.');
    const url = await B.ui.prompt('Link', 'Open this address when the object is clicked during a slide show', el.link || 'https://', { help: 'Leave empty to remove the link.' });
    if (url == null) return;
    const v = url.trim() && url.trim() !== 'https://' ? (/^(https?:|mailto:)/i.test(url) ? url.trim() : 'https://' + url.trim()) : null;
    E_.setProp('link', v);
  };

  AC.altText = async () => {
    const el = B.selectedEls()[0];
    if (!el) return;
    const t = await B.ui.prompt('Alt Text', 'How would you describe this object to someone who is blind or has low vision?', el.alt || '', { width: 520 });
    if (t != null) E().setProp('alt', t);
  };

  AC.changePicture = async () => {
    const el = B.selectedEls().find((e) => e.type === 'image');
    if (!el) return;
    const f = await U.pickFile('image/*');
    if (!f) return;
    const data = await U.shrinkImage(await U.readFile(f));
    const img = await U.loadImage(data);
    el.asset = M.addAsset(data);
    delete el.src;
    delete el.crop;
    el.h = Math.round(el.w * (img.naturalHeight / img.naturalWidth));
    E().changed(true);
  };
  AC.resetPicture = async () => {
    const el = B.selectedEls().find((e) => e.type === 'image');
    if (!el) return;
    const img = await U.loadImage(A.assets[el.asset] || el.src);
    Object.assign(el, { filter: 'none', mask: 'none', crop: null, rot: 0, flipH: false, flipV: false, stroke: 'none', shadow: false });
    el.h = Math.round(el.w * (img.naturalHeight / img.naturalWidth));
    E().changed(true);
  };
  AC.cropTo = async (ratio) => {
    const el = B.selectedEls().find((e) => e.type === 'image');
    if (!el) return;
    const img = await U.loadImage(A.assets[el.asset] || el.src);
    const ir = img.naturalWidth / img.naturalHeight;
    if (!ratio) {
      el.crop = null;
      el.h = Math.round(el.w / ir);
    } else if (ir > ratio) {
      const keep = ratio / ir;
      el.crop = { l: (1 - keep) / 2, r: (1 - keep) / 2, t: 0, b: 0 };
      el.h = Math.round(el.w / ratio);
    } else {
      const keep = ir / ratio;
      el.crop = { l: 0, r: 0, t: (1 - keep) / 2, b: (1 - keep) / 2 };
      el.h = Math.round(el.w / ratio);
    }
    E().changed(true);
  };

  AC.toggleLock = () => {
    const els = B.selectedEls();
    const lock = !els.every((e) => e.locked);
    els.forEach((e) => (e.locked = lock));
    E().drawSelection();
    B.store.commit();
    B.emit('selection');
  };

  AC.changeCase = (mode) => {
    const conv = (t) =>
      mode === 'upper' ? t.toUpperCase() : mode === 'lower' ? t.toLowerCase() : mode === 'title' ? t.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()) : t.toLowerCase().replace(/(^\s*|[.!?]\s+)([a-z])/g, (m, a, b) => a + b.toUpperCase());
    const mapText = (html) => {
      const d = document.createElement('div');
      d.innerHTML = html;
      const w = document.createTreeWalker(d, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = w.nextNode())) n.textContent = conv(n.textContent);
      return d.innerHTML;
    };
    if (A.editingId) {
      const s = window.getSelection();
      E().restoreRange();
      const t = s.toString();
      if (t) document.execCommand('insertText', false, conv(t));
      return;
    }
    B.selectedEls().forEach((el) => {
      if (el.html) el.html = mapText(el.html);
      if (el.rows) el.rows = el.rows.map((r) => r.map(mapText));
    });
    E().changed(true);
  };

  AC.QUICK_STYLES = (() => {
    const out = [];
    for (let i = 1; i <= 6; i++) out.push({ fill: `@accent${i}`, stroke: `@accent${i}:d`, color: null });
    for (let i = 1; i <= 6; i++) out.push({ fill: `@accent${i}:l2`, stroke: `@accent${i}`, color: `@accent${i}:d` });
    for (let i = 1; i <= 6; i++) out.push({ fill: 'none', stroke: `@accent${i}`, color: `@accent${i}` });
    return out;
  })();
  AC.applyQuickStyle = (st) => {
    const els = B.selectedEls().filter((e) => e.type === 'shape' || e.type === 'text');
    els.forEach((el) => {
      el.fill = B.shapeById(el.shape).line ? 'none' : st.fill;
      el.stroke = st.stroke;
      if (!el.strokeWidth) el.strokeWidth = 1.5;
      el.color = st.color;
    });
    E().changed(true);
  };

  AC.setTheme = (id) => {
    A.deck.theme = id;
    B.store.commit();
    B.emit('deck');
  };

  /** Change page size: '16:9', '4:3' or 'book' (8.5 × 11 portrait). */
  AC.setSlideSize = (key) => {
    const dim = B.PAGE_SIZES[key];
    const deck = A.deck;
    if (!dim || (deck.w === dim.w && deck.h === dim.h)) return;
    if (A.editingId) E().endEdit(true);
    const W0 = deck.w, H0 = deck.h;
    const flip = B.isBook(deck) !== dim.h > dim.w;
    deck.w = dim.w;
    deck.h = dim.h;
    const s = Math.min(dim.w / W0, dim.h / H0);
    deck.slides.forEach((slide) => {
      const fresh = B.layoutElements(slide.layout, dim.w, dim.h);
      const count = {};
      slide.elements.forEach((el) => {
        if (!flip) {
          // same orientation: keep things centred vertically in the new space
          el.y = Math.round((el.y + el.h / 2) * (dim.h / H0) - el.h / 2);
          return;
        }
        const n = el.placeholder ? (count[el.placeholder] = (count[el.placeholder] || 0) + 1) : 0;
        const tpl = el.placeholder && fresh.filter((f) => f.placeholder === el.placeholder)[n - 1];
        if (tpl) {
          // placeholders flow into the matching spot of the new layout
          ['x', 'y', 'w', 'h', 'size', 'align', 'valign'].forEach((k) => (el[k] = tpl[k]));
          return;
        }
        // everything else is scaled to fit and centred ("ensure fit")
        el.x = Math.round(el.x * s + (dim.w - W0 * s) / 2);
        el.y = Math.round(el.y * s + (dim.h - H0 * s) / 2);
        el.w = Math.round(el.w * s);
        el.h = Math.round(el.h * s);
        if (el.size) el.size = Math.max(6, Math.round(el.size * s * 2) / 2);
      });
    });
    B.store.commit();
    B.emit('deck');
    requestAnimationFrame(() => E().fit());
    B.ui.toast(dim.name);
  };

  /* ---------- transitions ---------- */
  B.TRANSITIONS = [
    { id: 'none', name: 'None', icon: 'block' },
    { id: 'fade', name: 'Fade', icon: 'gradient' },
    { id: 'push', name: 'Push', icon: 'arrow_back', dirs: true },
    { id: 'wipe', name: 'Wipe', icon: 'swipe_left', dirs: true },
    { id: 'split', name: 'Split', icon: 'vertical_split' },
    { id: 'cover', name: 'Cover', icon: 'move_to_inbox', dirs: true },
    { id: 'uncover', name: 'Uncover', icon: 'outbox', dirs: true },
    { id: 'zoom', name: 'Zoom', icon: 'zoom_in_map' },
    { id: 'flip', name: 'Flip', icon: 'flip' },
    { id: 'cube', name: 'Cube', icon: 'view_in_ar', dirs: true },
    { id: 'page', name: 'Page Turn', icon: 'auto_stories' },
  ];
  AC.setTransition = (type) => {
    SL.selectedIds().forEach((id) => {
      const s = A.deck.slides[SL.indexOf(id)];
      s.transition = Object.assign({ duration: 0.7 }, s.transition, { type });
    });
    B.store.commit();
    B.emit('slides');
    B.emit('content');
    if (type !== 'none') B.show.previewTransition();
  };
  AC.setTransitionProp = (k, v) => {
    SL.selectedIds().forEach((id) => {
      const s = A.deck.slides[SL.indexOf(id)];
      s.transition = Object.assign({ type: 'none', duration: 0.7 }, s.transition, { [k]: v });
    });
    B.store.commit();
    B.emit('content');
  };
  AC.applyTransitionAll = () => {
    const t = U.clone(B.curSlide().transition || { type: 'none', duration: 0.7 });
    A.deck.slides.forEach((s) => (s.transition = U.clone(t)));
    B.store.commit();
    B.emit('slides');
    B.ui.toast('Transition applied to all slides.');
  };

  /* ---------- animations ---------- */
  B.ANIMATIONS = [
    { id: 'appear', name: 'Appear', kind: 'entrance', icon: 'visibility' },
    { id: 'fade', name: 'Fade', kind: 'entrance', icon: 'gradient' },
    { id: 'fly', name: 'Fly In', kind: 'entrance', icon: 'flight_land', dirs: true },
    { id: 'float', name: 'Float In', kind: 'entrance', icon: 'north' },
    { id: 'zoom', name: 'Zoom', kind: 'entrance', icon: 'zoom_in' },
    { id: 'wipe', name: 'Wipe', kind: 'entrance', icon: 'swipe_right', dirs: true },
    { id: 'bounce', name: 'Bounce', kind: 'entrance', icon: 'sports_basketball' },
    { id: 'grow-turn', name: 'Grow & Turn', kind: 'entrance', icon: 'rotate_90_degrees_cw' },
    { id: 'pulse', name: 'Pulse', kind: 'emphasis', icon: 'favorite' },
    { id: 'spin', name: 'Spin', kind: 'emphasis', icon: 'autorenew' },
    { id: 'teeter', name: 'Teeter', kind: 'emphasis', icon: 'vibration' },
    { id: 'flash', name: 'Flash', kind: 'emphasis', icon: 'flare' },
    { id: 'disappear', name: 'Disappear', kind: 'exit', icon: 'visibility_off' },
    { id: 'fade-out', name: 'Fade Out', kind: 'exit', icon: 'blur_on' },
    { id: 'fly-out', name: 'Fly Out', kind: 'exit', icon: 'flight_takeoff', dirs: true },
    { id: 'zoom-out', name: 'Zoom Out', kind: 'exit', icon: 'zoom_out' },
  ];
  B.animById = (id) => B.ANIMATIONS.find((a) => a.id === id);
  B.animOrder = (slide) =>
    slide.elements
      .map((e, i) => ({ e, i }))
      .filter((x) => x.e.anim && x.e.anim.effect && x.e.anim.effect !== 'none')
      .sort((a, b) => (a.e.anim.order != null ? a.e.anim.order : a.i + 1000) - (b.e.anim.order != null ? b.e.anim.order : b.i + 1000))
      .map((x) => x.e);
  const renumber = (slide) => B.animOrder(slide).forEach((e, i) => (e.anim.order = i));

  AC.setAnimation = (effect) => {
    const els = B.selectedEls();
    if (!els.length) return B.ui.toast('Select an object on the slide to animate it.');
    const slide = B.curSlide();
    renumber(slide);
    let next = B.animOrder(slide).length;
    els.forEach((el) => {
      if (effect === 'none') delete el.anim;
      else {
        const had = el.anim && el.anim.effect && el.anim.effect !== 'none';
        el.anim = Object.assign({ start: 'click', duration: 0.5, delay: 0, dir: 'bottom' }, el.anim || {}, { effect });
        if (!had) el.anim.order = next++;
      }
    });
    renumber(slide);
    B.store.commit();
    B.emit('content');
    B.emit('selection');
    if (effect !== 'none') B.show.previewAnimations(els.map((e) => e.id));
  };
  AC.setAnimProp = (k, v) => {
    B.selectedEls().forEach((el) => el.anim && (el.anim[k] = v));
    B.store.commit();
    B.emit('content');
    B.emit('selection');
  };
  AC.moveAnim = (dir) => {
    const slide = B.curSlide();
    renumber(slide);
    const order = B.animOrder(slide);
    const sel = B.selectedEls().filter((e) => e.anim);
    if (!sel.length) return;
    const el = sel[0];
    const i = order.indexOf(el), j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i].anim.order, order[j].anim.order] = [order[j].anim.order, order[i].anim.order];
    B.store.commit();
    B.emit('content');
    B.emit('selection');
  };

  /* ---------- tables ---------- */
  const curTable = () => B.selectedEls().find((e) => e.type === 'table');
  const curCell = (t) => {
    if (A.editingId === t.id && A.editingCell) return A.editingCell.slice();
    return [t.rows.length - 1, t.rows[0].length - 1];
  };
  AC.tableOp = (op) => {
    const t = curTable();
    if (!t) return;
    const [r, c] = curCell(t);
    if (A.editingId) E().endEdit(true);
    const ncol = t.rows[0].length;
    const normCols = () => {
      if (t.colW) {
        const s = t.colW.reduce((a, b) => a + b, 0);
        t.colW = t.colW.map((x) => x / s);
      }
    };
    switch (op) {
      case 'rowAbove': t.rows.splice(r, 0, new Array(ncol).fill('')); t.h += 40; break;
      case 'rowBelow': t.rows.splice(r + 1, 0, new Array(ncol).fill('')); t.h += 40; break;
      case 'colLeft': t.rows.forEach((row) => row.splice(c, 0, '')); if (t.colW) t.colW.splice(c, 0, 1 / ncol); normCols(); break;
      case 'colRight': t.rows.forEach((row) => row.splice(c + 1, 0, '')); if (t.colW) t.colW.splice(c + 1, 0, 1 / ncol); normCols(); break;
      case 'delRow':
        if (t.rows.length <= 1) return AC.deleteTable();
        t.rows.splice(r, 1);
        t.h = Math.max(30, t.h - t.h / (t.rows.length + 1));
        break;
      case 'delCol':
        if (ncol <= 1) return AC.deleteTable();
        t.rows.forEach((row) => row.splice(c, 1));
        if (t.colW) t.colW.splice(c, 1);
        normCols();
        break;
      case 'distribute': t.colW = null; break;
    }
    E().changed(true);
  };
  AC.deleteTable = () => E().deleteSelection();
})(window.BSD);
