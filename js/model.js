/* BSD STEM Slides — document model, app state and undo history */
(function (B) {
  'use strict';
  const U = B.util;
  const M = (B.model = {});

  B.app = {
    deck: null,
    assets: {}, // assetId -> dataURL (kept out of undo snapshots)
    current: 0,
    selection: [],
    editingId: null,
    editingCell: null, // [row, col] while editing a table cell
    zoom: 100,
    fit: true,
    view: 'normal',
    showGrid: false,
    showGuides: true,
    showNotes: true,
    showRuler: false,
    focus: 'canvas', // 'canvas' | 'thumbs'
    clipboard: null,
    painter: null,
    drawTool: null, // {type:'shape', shape:'rect'} | {type:'text'}
    dirty: false,
  };
  const A = B.app;

  B.theme = () => B.themeById(A.deck.theme);
  B.curSlide = () => A.deck.slides[A.current];
  B.findEl = (id, slide = B.curSlide()) => (slide ? slide.elements.find((e) => e.id === id) : null);
  B.selectedEls = () => A.selection.map((id) => B.findEl(id)).filter(Boolean);
  M.isTextual = (el) => el && (el.type === 'text' || (el.type === 'shape' && !B.shapeById(el.shape).line));

  /* ---------- factories ---------- */
  const DEFAULTS = {
    text: () => ({ html: '', font: null, size: 18, color: null, align: 'left', valign: 'top', autoHeight: true, fill: 'none', stroke: 'none', strokeWidth: 1 }),
    shape: () => ({ shape: 'rect', fill: '@accent1', stroke: '@accent1:d', strokeWidth: 1.5, html: '', size: 18, color: null, align: 'center', valign: 'middle' }),
    image: () => ({ asset: null, mask: 'none', filter: 'none', stroke: 'none', strokeWidth: 3 }),
    table: () => ({ rows: [['', '', ''], ['', '', ''], ['', '', '']], header: true, banded: true, size: 16, accent: '@accent1', colW: null }),
    chart: () => ({
      chart: {
        kind: 'column', title: 'Chart Title', legend: true, dataLabels: false,
        labels: ['Category 1', 'Category 2', 'Category 3', 'Category 4'],
        series: [
          { name: 'Series 1', values: [4.3, 2.5, 3.5, 4.5] },
          { name: 'Series 2', values: [2.4, 4.4, 1.8, 2.8] },
          { name: 'Series 3', values: [2, 2, 3, 5] },
        ],
      },
    }),
    equation: () => ({ latex: 'E = mc^2', size: 32, color: null }),
    video: () => ({ src: '', kind: 'youtube', fill: '#000000' }),
  };

  M.newElement = (type, props = {}) =>
    Object.assign({ id: U.uid(), type, x: 100, y: 100, w: 200, h: 100, rot: 0, opacity: 1 }, DEFAULTS[type] ? DEFAULTS[type]() : {}, props);

  M.newSlide = (layout = 'title-content', deck = A.deck) => ({
    id: U.uid(),
    layout,
    elements: B.layoutElements(layout, deck ? deck.w : 960, deck ? deck.h : 540).map((p) => M.newElement('text', p)),
    notes: '',
    background: null,
    transition: { type: 'none', duration: 0.7 },
    hidden: false,
  });

  M.newDeck = (themeId = 'office', title = 'Untitled Presentation', size = '16:9') => {
    const dim = B.PAGE_SIZES[size] || B.PAGE_SIZES['16:9'];
    const deck = {
      id: U.uid(), version: 1, title, theme: themeId, w: dim.w, h: dim.h, slides: [],
      slideNumbers: false, footer: '', hideFooterOnTitle: true, loop: false, created: Date.now(), updated: Date.now(),
    };
    deck.slides.push(M.newSlide('title', deck));
    return deck;
  };

  /** Fill in anything missing from older or imported decks and sanitise rich text. */
  M.normalize = (deck) => {
    deck.id = deck.id || U.uid();
    deck.w = deck.w || 960;
    deck.h = deck.h || 540;
    deck.theme = deck.theme || 'office';
    deck.title = deck.title || 'Untitled Presentation';
    deck.slides = (deck.slides || []).map((s) => {
      s.id = s.id || U.uid();
      s.elements = (s.elements || []).map((e) => {
        const n = Object.assign(M.newElement(e.type || 'text'), e);
        if (n.html) n.html = U.sanitizeHtml(n.html);
        if (n.rows) n.rows = n.rows.map((r) => r.map((c) => U.sanitizeHtml(c)));
        return n;
      });
      s.transition = s.transition || { type: 'none', duration: 0.7 };
      s.notes = s.notes || '';
      return s;
    });
    if (!deck.slides.length) deck.slides.push(M.newSlide('title', deck));
    return deck;
  };

  /** Deep copy of elements with fresh ids (keeps groups together under a new group id). */
  M.cloneElements = (els) => {
    const groupMap = {};
    return U.clone(els).map((e) => {
      e.id = U.uid();
      if (e.groupId) e.groupId = groupMap[e.groupId] = groupMap[e.groupId] || U.uid();
      return e;
    });
  };
  M.cloneSlide = (s) => Object.assign(U.clone(s), { id: U.uid(), elements: M.cloneElements(s.elements) });

  M.usedAssets = (deck) => {
    const ids = new Set();
    const scan = (o) => {
      if (!o || typeof o !== 'object') return;
      if (typeof o.asset === 'string') ids.add(o.asset);
      if (o.background && o.background.asset) ids.add(o.background.asset);
      Object.values(o).forEach(scan);
    };
    scan(deck);
    return ids;
  };

  M.addAsset = (dataUrl) => {
    for (const [k, v] of Object.entries(A.assets)) if (v === dataUrl) return k;
    const id = 'a_' + U.uid();
    A.assets[id] = dataUrl;
    return id;
  };

  /* ---------- store + undo history ---------- */
  const S = (B.store = {});
  let hist = [], hi = -1;
  const snap = () => JSON.stringify({ deck: A.deck, current: A.current });

  S.load = (deck, assets = {}) => {
    A.deck = M.normalize(deck);
    A.assets = Object.assign({}, assets);
    A.current = 0;
    A.selection = [];
    A.editingId = null;
    A.editingCell = null;
    hist = [snap()];
    hi = 0;
    A.dirty = false;
    B.emit('deck');
  };

  /** Record the current state as an undo step and schedule an autosave. */
  S.commit = () => {
    A.deck.updated = Date.now();
    const s = snap();
    if (hist[hi] === s) return;
    hist = hist.slice(0, hi + 1);
    hist.push(s);
    if (hist.length > 150) hist.shift();
    hi = hist.length - 1;
    S.markDirty();
  };
  S.markDirty = () => {
    A.dirty = true;
    B.emit('dirty');
  };
  const restore = (s) => {
    const o = JSON.parse(s);
    A.deck = o.deck;
    A.current = U.clamp(o.current, 0, A.deck.slides.length - 1);
    A.selection = A.selection.filter((id) => B.findEl(id));
    A.editingId = null;
    A.editingCell = null;
    S.markDirty();
    B.emit('deck');
  };
  S.undo = () => {
    if (B.editor) B.editor.endEdit(true);
    if (hi > 0) restore(hist[--hi]);
  };
  S.redo = () => {
    if (hi < hist.length - 1) restore(hist[++hi]);
  };
  S.canUndo = () => hi > 0;
  S.canRedo = () => hi < hist.length - 1;

  /* ---------- the welcome deck shown on first launch ---------- */
  M.sampleDeck = () => {
    const d = M.newDeck('bsd', 'Welcome to BSD STEM Slides');
    const E = M.newElement;
    const s1 = d.slides[0];
    s1.elements[0].html = '<div>Welcome to BSD STEM Slides</div>';
    s1.elements[1].html = '<div>Build, present and share STEM lessons right in your browser</div>';
    s1.notes = 'Press F5 to start the slide show. Use the arrow keys to move between slides and Esc to exit.';

    const s2 = M.newSlide('title-content', d);
    s2.elements[0].html = '<div>What you can do</div>';
    s2.elements[1].html =
      '<ul><li>Pick a theme, then add text, shapes, pictures, tables and video</li><li>Write equations with LaTeX: <span style="color:#22B8CF">x² + y² = r²</span></li><li>Graph lab data with column, line, pie and scatter charts</li><li>Bring slides to life with transitions and animations</li><li>Present with a pen, laser pointer and presenter view</li><li>Open and save PowerPoint files, or export a PDF</li></ul>';
    s2.elements[1].size = 22;
    s2.transition = { type: 'fade', duration: 0.7 };

    const s3 = M.newSlide('title-only', d);
    s3.elements[0].html = '<div>The Quadratic Formula</div>';
    s3.elements.push(
      E('equation', { x: 180, y: 150, w: 600, h: 110, latex: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}', size: 40 }),
      E('text', { x: 100, y: 296, w: 760, h: 40, align: 'center', size: 22, html: '<div>Solves any equation of the form <i>ax</i><sup>2</sup> + <i>bx</i> + <i>c</i> = 0</div>', anim: { effect: 'fade', start: 'click', duration: 0.6, delay: 0 } }),
      E('shape', { shape: 'roundRect', x: 300, y: 380, w: 360, h: 70, fill: '@accent2', stroke: 'none', size: 20, color: '#0F2747', html: '<div><b>Discriminant:</b> b² − 4ac</div>', anim: { effect: 'zoom', start: 'click', duration: 0.5, delay: 0 } })
    );
    s3.transition = { type: 'push', duration: 0.7, dir: 'left' };

    const s4 = M.newSlide('title-only', d);
    s4.elements[0].html = '<div>Lab Results: Plant Growth</div>';
    s4.elements.push(
      E('chart', {
        x: 80, y: 130, w: 800, h: 370,
        chart: {
          kind: 'column', title: 'Average height (cm) by week', legend: true, dataLabels: false,
          labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
          series: [
            { name: 'Sunlight', values: [2.1, 4.8, 8.2, 12.5] },
            { name: 'Shade', values: [1.6, 3.0, 4.9, 6.8] },
            { name: 'Grow lamp', values: [2.4, 5.5, 9.1, 13.9] },
          ],
        },
      })
    );
    s4.transition = { type: 'wipe', duration: 0.7, dir: 'left' };

    const s5 = M.newSlide('title-only', d);
    s5.elements[0].html = '<div>The Scientific Method</div>';
    const steps = ['Ask a Question', 'Form a Hypothesis', 'Experiment', 'Analyze Data', 'Conclude'];
    steps.forEach((t, i) => {
      const x = 40 + i * 182;
      s5.elements.push(
        E('shape', {
          shape: i === 0 || i === 4 ? 'flowTerminator' : i === 2 ? 'flowDecision' : 'flowProcess',
          x, y: 240, w: 150, h: 100, fill: '@accent' + (i + 1), stroke: 'none', size: 16, color: '#0F2747',
          html: `<div><b>${t}</b></div>`,
          anim: { effect: 'fly', dir: 'bottom', start: i === 0 ? 'click' : 'after', duration: 0.45, delay: 0 },
        })
      );
      if (i < 4) s5.elements.push(E('shape', { shape: 'arrowLine', x: x + 152, y: 290, w: 28, h: 0, fill: 'none', stroke: '@text', strokeWidth: 2.5, anim: { effect: 'fade', start: 'after', duration: 0.25, delay: 0 } }));
    });
    s5.transition = { type: 'zoom', duration: 0.7 };

    const s6 = M.newSlide('section', d);
    s6.elements[0].html = '<div>Your turn!</div>';
    s6.elements[1].html = '<div>Use File ▸ New to start a presentation, or edit this one.</div>';
    s6.transition = { type: 'fade', duration: 1 };

    d.slides.push(s2, s3, s4, s5, s6);
    d.slideNumbers = true;
    return d;
  };

  /** A short book-format (8.5 × 11) sample that shows off sideways page turns. */
  M.sampleBook = () => {
    const d = M.newDeck('galaxy', 'Field Guide to the Solar System', 'book');
    const E = M.newElement;
    const page = (layout) => M.newSlide(layout, d);
    const p1 = d.slides[0];
    p1.elements[0].html = '<div>Field Guide to the Solar System</div>';
    p1.elements[1].html = '<div>A BSD STEM reader</div>';
    p1.elements.push(E('shape', { shape: 'ellipse', x: 348, y: 150, w: 120, h: 120, fill: '@accent2', stroke: 'none', shadow: true, anim: { effect: 'zoom', start: 'after', duration: 0.8, delay: 0.2 } }));
    p1.notes = 'Book pages turn sideways like an e-reader. Swipe, use the arrow keys, or tap the right side of the page.';

    const p2 = page('title-content');
    p2.elements[0].html = '<div>Chapter 1 · Our Sun</div>';
    p2.elements[1].html =
      '<div>The Sun is a star — a giant ball of hot plasma held together by its own gravity. It holds about 99.8% of all the mass in the solar system.</div><div><br></div><div>Deep in its core, hydrogen nuclei fuse into helium. Each second the Sun turns about 4 million tonnes of matter into energy, following Einstein\'s famous equation.</div><div><br></div><div>Light from its surface takes about <b>8 minutes and 20 seconds</b> to reach Earth.</div>';
    p2.elements.push(E('equation', { x: 258, y: 760, w: 300, h: 90, latex: 'E = mc^2', size: 40, anim: { effect: 'fade', start: 'click', duration: 0.6, delay: 0 } }));

    const p3 = page('title-only');
    p3.elements[0].html = '<div>How far away are the planets?</div>';
    p3.elements.push(
      E('chart', {
        x: 72, y: 210, w: 672, h: 640,
        chart: {
          kind: 'bar', title: 'Average distance from the Sun (AU)', legend: false, dataLabels: true,
          labels: ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'],
          series: [{ name: 'Distance (AU)', values: [0.39, 0.72, 1, 1.52, 5.2, 9.58, 19.2, 30.05] }],
        },
        anim: { effect: 'wipe', dir: 'left', start: 'click', duration: 0.8, delay: 0 },
      }),
      E('text', { x: 72, y: 880, w: 672, size: 16, html: '<div>1 AU (astronomical unit) is the average distance from Earth to the Sun: about 150 million km.</div>' })
    );

    const p4 = page('title-only');
    p4.elements[0].html = "<div>Kepler's Third Law</div>";
    p4.elements.push(
      E('equation', { x: 208, y: 230, w: 400, h: 110, latex: 'T^2 \\propto a^3', size: 48 }),
      E('text', { x: 72, y: 380, w: 672, size: 18, html: '<div>The square of a planet\'s orbital period <i>T</i> is proportional to the cube of its average distance <i>a</i> from the Sun.</div>', anim: { effect: 'float', start: 'click', duration: 0.6, delay: 0 } }),
      E('shape', { shape: 'ellipse', x: 158, y: 560, w: 500, h: 260, fill: 'none', stroke: '@accent1', strokeWidth: 2, dash: 'dash' }),
      E('shape', { shape: 'ellipse', x: 383, y: 665, w: 50, h: 50, fill: '@accent2', stroke: 'none' }),
      E('shape', { shape: 'ellipse', x: 640, y: 676, w: 28, h: 28, fill: '@accent3', stroke: 'none', anim: { effect: 'spin', start: 'click', duration: 1.2, delay: 0 } })
    );

    const p5 = page('section');
    p5.elements[0].html = '<div>Keep exploring</div>';
    p5.elements[1].html = '<div>Make your own book with File ▸ New ▸ Book.</div>';
    d.slides.push(p2, p3, p4, p5);
    d.slideNumbers = true;
    return d;
  };
})(window.BSD);
