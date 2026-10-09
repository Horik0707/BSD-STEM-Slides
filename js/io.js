/* BSD STEM Slides — saving, opening, PowerPoint import/export, PDF/print */
(function (B) {
  'use strict';
  const U = B.util, A = B.app, M = B.model, R = B.render;
  const h = U.h;
  const IO = (B.io = {});
  const PPTX_LIB = 'vendor/pptxgen.bundle.js';

  /* ======================= browser storage ======================= */
  let saving = false, again = false;
  IO.saveNow = async (quiet) => {
    if (!A.deck) return;
    if (saving) {
      again = true;
      return;
    }
    saving = true;
    B.emit('save-state', 'saving');
    try {
      const deck = A.deck;
      const used = M.usedAssets(deck);
      const assets = {};
      used.forEach((id) => A.assets[id] && (assets[id] = A.assets[id]));
      const first = deck.slides[0];
      const firstAssets = {};
      let budget = 800000;
      M.usedAssets({ slides: [first] }).forEach((id) => {
        const v = A.assets[id];
        if (v && v.length < budget) {
          firstAssets[id] = v;
          budget -= v.length;
        }
      });
      await U.idb.put('decks', { id: deck.id, deck: U.clone(deck), assets });
      await U.idb.put('meta', { id: deck.id, title: deck.title, updated: deck.updated || Date.now(), theme: deck.theme, w: deck.w, h: deck.h, slides: deck.slides.length, first: U.clone(first), firstAssets });
      U.storage.set('last', deck.id);
      A.dirty = false;
      B.emit('save-state', 'saved');
      if (!quiet) B.ui.toast('Saved to this browser.');
    } catch (e) {
      console.error(e);
      B.emit('save-state', 'error');
      if (!quiet) B.ui.toast('Could not save in this browser. Use File ▸ Save a Copy to download it.', 4500);
    } finally {
      saving = false;
      if (again) {
        again = false;
        IO.saveNow(true);
      }
    }
  };
  IO.scheduleSave = U.debounce(() => IO.saveNow(true), 900);

  IO.list = async () => {
    try {
      return (await U.idb.all('meta')).sort((a, b) => b.updated - a.updated);
    } catch (e) {
      return [];
    }
  };
  IO.openStored = async (id) => {
    if (A.dirty) await IO.saveNow(true);
    const rec = await U.idb.get('decks', id);
    if (!rec) return B.ui.toast('That presentation could not be found.');
    B.store.load(rec.deck, rec.assets || {});
    U.storage.set('last', id);
  };
  IO.deleteStored = async (id) => {
    await U.idb.del('decks', id);
    await U.idb.del('meta', id);
  };

  IO.newDeck = async (themeId, sample, size) => {
    if (A.dirty) await IO.saveNow(true);
    const book = size === 'book';
    const d = sample ? (book ? M.sampleBook() : M.sampleDeck()) : M.newDeck(themeId, book ? 'Untitled Book' : undefined, size);
    B.store.load(d, {});
    IO.saveNow(true);
  };

  IO.restore = async () => {
    const last = U.storage.get('last', null);
    if (last) {
      try {
        const rec = await U.idb.get('decks', last);
        if (rec) {
          B.store.load(rec.deck, rec.assets || {});
          return;
        }
      } catch (e) {
        /* fall through */
      }
    }
    const list = await IO.list();
    if (list.length) {
      try {
        const rec = await U.idb.get('decks', list[0].id);
        if (rec) return B.store.load(rec.deck, rec.assets || {});
      } catch (e) {
        /* fall through */
      }
    }
    B.store.load(M.sampleDeck(), {});
    IO.saveNow(true);
  };

  /* ======================= files ======================= */
  IO.download = () => {
    const assets = {};
    M.usedAssets(A.deck).forEach((id) => A.assets[id] && (assets[id] = A.assets[id]));
    const blob = new Blob([JSON.stringify({ format: 'bsd-stem-slides', version: 1, deck: A.deck, assets })], { type: 'application/json' });
    U.download(blob, U.safeFilename(A.deck.title) + '.bsdslides');
  };

  IO.openDialog = async () => {
    const f = await U.pickFile('.bsdslides,.pptx,.json,application/vnd.openxmlformats-officedocument.presentationml.presentation');
    if (f) IO.openFile(f);
  };

  IO.openFile = async (file) => {
    try {
      if (A.dirty) await IO.saveNow(true);
      if (/\.pptx$/i.test(file.name)) {
        B.ui.toast('Opening ' + file.name + '…', 1500);
        const { deck, assets } = await IO.importPptx(file);
        B.store.load(deck, assets);
      } else {
        const data = JSON.parse(await U.readFile(file, 'text'));
        if (!data || !data.deck || !Array.isArray(data.deck.slides)) throw new Error('Not a BSD STEM Slides file');
        data.deck.id = U.uid(); // opening a file always makes a separate copy in this browser
        const assets = {};
        for (const [k, v] of Object.entries(data.assets || {})) if (typeof v === 'string' && /^data:(image|video)\//.test(v)) assets[k] = v;
        B.store.load(data.deck, assets);
      }
      B.backstage.close();
      IO.saveNow(true);
      B.ui.toast('Opened ' + file.name);
    } catch (e) {
      console.error(e);
      B.ui.toast('Sorry, that file could not be opened. ' + (e.message || ''), 5000);
    }
  };

  /* ======================= print / PDF ======================= */
  IO.print = (mode = 'slides') => {
    if (A.editingId) B.editor.endEdit();
    const root = U.$('#printRoot');
    root.innerHTML = '';
    root.className = 'print-' + mode;
    const W = A.deck.w, H = A.deck.h;
    const slides = A.deck.slides;
    const style = U.$('#printPageStyle') || document.head.appendChild(h('style', { id: 'printPageStyle' }));
    if (mode === 'slides') {
      style.textContent = `@page { size: ${W / 96}in ${H / 96}in; margin: 0; }`;
      slides.forEach((s, i) => {
        const page = h('div', { class: 'print-page' });
        page.appendChild(R.slide(s, { mode: 'print', index: i }));
        root.appendChild(page);
      });
    } else if (mode === 'notes') {
      style.textContent = '@page { size: letter portrait; margin: 0.6in; }';
      slides.forEach((s, i) => {
        const page = h('div', { class: 'print-page notes' });
        page.appendChild(R.thumb(s, 624, { mode: 'print', index: i }));
        page.appendChild(h('div', { class: 'print-notes' }, s.notes || ''));
        page.appendChild(h('div', { class: 'print-foot' }, `${A.deck.title} — ${i + 1}`));
        root.appendChild(page);
      });
    } else {
      style.textContent = '@page { size: letter portrait; margin: 0.5in; }';
      for (let p = 0; p < slides.length; p += 6) {
        const page = h('div', { class: 'print-page handout' });
        page.appendChild(h('div', { class: 'print-head' }, A.deck.title));
        const grid = h('div', { class: 'handout-grid' });
        slides.slice(p, p + 6).forEach((s, j) => {
          const cell = h('div', { class: 'handout-cell' });
          cell.appendChild(R.thumb(s, 330, { mode: 'print', index: p + j }));
          cell.appendChild(h('div', { class: 'handout-lines' }));
          grid.appendChild(cell);
        });
        page.appendChild(grid);
        root.appendChild(page);
      }
    }
    document.body.classList.add('printing');
    const done = () => {
      document.body.classList.remove('printing');
      root.innerHTML = '';
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    // let images, fonts and 3D model renders settle before opening the print dialog
    Promise.race([B.model3d.idle(), new Promise((r) => setTimeout(r, 6000))]).then(() => setTimeout(() => window.print(), 350));
  };

  IO.exportOutline = () => {
    const lines = [];
    A.deck.slides.forEach((s, i) => {
      const title = s.elements.find((e) => e.placeholder === 'title');
      lines.push(`Slide ${i + 1}: ${title ? U.htmlToText(title.html) : ''}`);
      s.elements.forEach((e) => {
        if (e === title) return;
        if (e.html) U.htmlToText(e.html).split('\n').filter(Boolean).forEach((l) => lines.push('  • ' + l));
        if (e.type === 'equation') lines.push('  [Equation] ' + e.latex);
        if (e.rows) e.rows.forEach((r) => lines.push('  | ' + r.map((c) => U.htmlToText(c)).join(' | ')));
      });
      if (s.notes) lines.push('  Notes: ' + s.notes.replace(/\n/g, '\n         '));
      lines.push('');
    });
    U.download(new Blob([lines.join('\n')], { type: 'text/plain' }), U.safeFilename(A.deck.title) + ' - outline.txt');
  };

  /* ======================= PPTX export ======================= */
  const hex = (c) => {
    const v = U.toHex(c);
    return v ? v.slice(1).toUpperCase() : null;
  };
  const PX = 1 / 96; // px → inches

  /** CSS-like backgrounds can't go into PowerPoint directly, so paint them to an image. */
  IO.paintBackground = (slide, theme, W, H, scale = 2) => {
    const c = document.createElement('canvas');
    c.width = W * scale;
    c.height = H * scale;
    const ctx = c.getContext('2d');
    ctx.scale(scale, scale);
    const lin = (deg, stops) => {
      const a = (deg * Math.PI) / 180, vx = Math.sin(a), vy = -Math.cos(a);
      const len = Math.abs(W * vx) + Math.abs(H * vy);
      const g = ctx.createLinearGradient(W / 2 - (vx * len) / 2, H / 2 - (vy * len) / 2, W / 2 + (vx * len) / 2, H / 2 + (vy * len) / 2);
      stops.forEach(([o, col]) => g.addColorStop(o, col));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    };
    const rad = (x, y, r, stops) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      stops.forEach(([o, col]) => g.addColorStop(o, col));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    };
    ctx.fillStyle = theme.bgColor;
    ctx.fillRect(0, 0, W, H);
    const bg = slide.background;
    if (bg && bg.type === 'gradient') {
      lin(bg.angle == null ? 135 : bg.angle, [[0, B.resolveColor(bg.from, theme)], [1, B.resolveColor(bg.to, theme)]]);
      return c.toDataURL('image/png');
    }
    switch (theme.id) {
      case 'blueprint':
        ctx.strokeStyle = 'rgba(255,255,255,.05)';
        for (let x = 0; x < W; x += 6) ctx.strokeRect(x, -1, 0.01, H + 2);
        for (let y = 0; y < H; y += 6) ctx.strokeRect(-1, y, W + 2, 0.01);
        ctx.fillStyle = 'rgba(255,255,255,.09)';
        for (let x = 0; x < W; x += 24) ctx.fillRect(x, 0, 1, H);
        for (let y = 0; y < H; y += 24) ctx.fillRect(0, y, W, 1);
        break;
      case 'notebook':
        ctx.fillStyle = '#D4E6F7';
        for (let y = 31; y < H; y += 32) ctx.fillRect(0, y, W, 1);
        break;
      case 'chalkboard':
        rad(W * 0.3, H * 0.3, Math.hypot(W, H) * 0.8, [[0, '#3B5C48'], [0.55, '#2F4A3A'], [1, '#263D30']]);
        break;
      case 'circuit':
        rad(W * 0.85, H * 0.15, Math.max(W, H) * 0.4, [[0, 'rgba(57,255,136,.12)'], [1, 'rgba(57,255,136,0)']]);
        rad(W * 0.1, H * 0.9, Math.max(W, H) * 0.45, [[0, 'rgba(0,200,255,.10)'], [1, 'rgba(0,200,255,0)']]);
        break;
      case 'sunrise':
        lin(135, [[0, '#FF7E5F'], [1, '#FEB47B']]);
        break;
      case 'ocean':
        lin(160, [[0, '#0B3954'], [0.45, '#0F4C5C'], [1, '#1B998B']]);
        break;
      case 'galaxy': {
        rad(W * 0.7, H * 0.3, Math.hypot(W, H) * 0.7, [[0, '#3F2B7A'], [0.6, '#1A1033'], [1, '#1A1033']]);
        let seed = 7;
        const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        ctx.fillStyle = '#fff';
        for (let i = 0; i < 90; i++) ctx.fillRect(rnd() * W, rnd() * H, rnd() < 0.2 ? 1.6 : 1, rnd() < 0.2 ? 1.6 : 1);
        break;
      }
    }
    return c.toDataURL('image/png');
  };

  /** Convert our rich-text HTML into PptxGenJS text runs. */
  IO.htmlToRuns = (html, base) => {
    const root = document.createElement('div');
    root.innerHTML = html || '';
    const paras = [];
    let cur = null;
    const newPara = (p) => {
      cur = { runs: [], p: Object.assign({}, p) };
      paras.push(cur);
    };
    const styleOf = (n, s) => {
      const o = Object.assign({}, s);
      const tag = n.tagName;
      if (tag === 'B' || tag === 'STRONG') o.bold = true;
      if (tag === 'I' || tag === 'EM') o.italic = true;
      if (tag === 'U') o.underline = true;
      if (tag === 'S' || tag === 'STRIKE') o.strike = true;
      if (tag === 'SUP') o.superscript = true;
      if (tag === 'SUB') o.subscript = true;
      if (tag === 'A' && n.getAttribute('href')) o.hyperlink = { url: n.getAttribute('href') };
      if (tag === 'FONT') {
        if (n.getAttribute('color')) o.color = hex(n.getAttribute('color')) || o.color;
        if (n.getAttribute('face')) o.fontFace = n.getAttribute('face');
      }
      const st = n.style;
      if (st) {
        if (st.fontWeight) o.bold = st.fontWeight === 'bold' || parseInt(st.fontWeight, 10) >= 600;
        if (st.fontStyle) o.italic = st.fontStyle === 'italic';
        const deco = st.textDecorationLine || st.textDecoration || '';
        if (/underline/.test(deco)) o.underline = true;
        if (/line-through/.test(deco)) o.strike = true;
        if (st.color) o.color = hex(st.color) || o.color;
        if (st.backgroundColor && hex(st.backgroundColor)) o.highlight = hex(st.backgroundColor);
        if (st.fontSize) {
          const v = parseFloat(st.fontSize);
          if (/pt$/.test(st.fontSize)) o.fontSize = v;
          else if (/px$/.test(st.fontSize)) o.fontSize = v * 0.75;
        }
        if (st.fontFamily) o.fontFace = st.fontFamily.split(',')[0].replace(/["']/g, '').trim();
        if (st.verticalAlign === 'super') o.superscript = true;
        if (st.verticalAlign === 'sub') o.subscript = true;
      }
      return o;
    };
    const walk = (node, s, ctx) => {
      for (const c of node.childNodes) {
        if (c.nodeType === 3) {
          const text = c.textContent.replace(/​/g, '');
          if (!text) continue;
          if (!cur) newPara(ctx.para);
          cur.runs.push({ text, s });
          continue;
        }
        if (c.nodeType !== 1) continue;
        const tag = c.tagName;
        const align = c.style && c.style.textAlign ? c.style.textAlign : null;
        if (tag === 'BR') {
          if (!cur) newPara(ctx.para);
          newPara(cur.p);
          continue;
        }
        if (tag === 'UL' || tag === 'OL') {
          const level = ctx.list ? ctx.list.level + 1 : 0;
          walk(c, s, Object.assign({}, ctx, { list: { type: tag, level } }));
          cur = null;
          continue;
        }
        if (tag === 'LI') {
          const l = ctx.list || { type: 'UL', level: 0 };
          newPara(Object.assign({}, ctx.para, { bullet: l.type === 'OL' ? { type: 'number' } : true, indentLevel: l.level, align: align || ctx.para.align }));
          walk(c, styleOf(c, s), Object.assign({}, ctx, { para: cur.p }));
          cur = null;
          continue;
        }
        if (tag === 'DIV' || tag === 'P') {
          const p = Object.assign({}, ctx.para, align ? { align } : {});
          newPara(p);
          walk(c, styleOf(c, s), Object.assign({}, ctx, { para: p }));
          cur = null;
          continue;
        }
        walk(c, styleOf(c, s), ctx);
      }
    };
    walk(root, {}, { para: { align: base.align } });
    const out = [];
    const clean = paras.filter((p, i) => p.runs.length || i < paras.length - 1);
    clean.forEach((p, pi) => {
      const popt = { align: p.p.align === 'justify' ? 'justify' : p.p.align || base.align };
      if (p.p.bullet) {
        popt.bullet = p.p.bullet;
        if (p.p.indentLevel) popt.indentLevel = p.p.indentLevel;
      }
      const runs = p.runs.length ? p.runs : [{ text: '', s: {} }];
      runs.forEach((r, ri) => {
        const o = Object.assign({}, popt, r.s);
        if (ri === runs.length - 1 && pi < clean.length - 1) o.breakLine = true;
        out.push({ text: r.text, options: o });
      });
    });
    return out.length ? out : [{ text: '', options: {} }];
  };

  IO.latexToText = (latex) => {
    let s = String(latex || '');
    const G = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', theta: 'θ', lambda: 'λ', mu: 'μ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', phi: 'φ', omega: 'ω', Delta: 'Δ', Sigma: 'Σ', Omega: 'Ω', Pi: 'Π', pm: '±', times: '×', div: '÷', cdot: '·', neq: '≠', approx: '≈', leq: '≤', le: '≤', geq: '≥', ge: '≥', infty: '∞', partial: '∂', nabla: '∇', rightarrow: '→', to: '→', Rightarrow: '⇒', rightleftharpoons: '⇌', sum: '∑', int: '∫', propto: '∝', degree: '°', circ: '°', angle: '∠', in: '∈', forall: '∀', exists: '∃', therefore: '∴', perp: '⊥', parallel: '∥', ldots: '…', cdots: '⋯' };
    const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻', n: 'ⁿ', i: 'ⁱ' };
    const SUB = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉', '+': '₊', '-': '₋' };
    for (let i = 0; i < 4; i++) {
      s = s.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)')
        .replace(/\\sqrt\[([^\]]*)\]\{([^{}]*)\}/g, '$1√($2)')
        .replace(/\\sqrt\{([^{}]*)\}/g, '√($1)')
        .replace(/\\(?:text|mathrm|mathbf|vec|hat|overline|operatorname)\{([^{}]*)\}/g, '$1')
        .replace(/\\xrightarrow\{([^{}]*)\}/g, '→($1)')
        .replace(/\\binom\{([^{}]*)\}\{([^{}]*)\}/g, 'C($1,$2)');
    }
    s = s.replace(/\^\{([^{}]*)\}|\^(.)/g, (m, a, b) => {
      const t = a != null ? a : b;
      return [...t].every((ch) => SUP[ch]) ? [...t].map((ch) => SUP[ch]).join('') : '^(' + t + ')';
    });
    s = s.replace(/_\{([^{}]*)\}|_(.)/g, (m, a, b) => {
      const t = a != null ? a : b;
      return [...t].every((ch) => SUB[ch]) ? [...t].map((ch) => SUB[ch]).join('') : '_' + t;
    });
    s = s.replace(/\\([a-zA-Z]+)/g, (m, w) => (G[w] != null ? G[w] : w === 'left' || w === 'right' || w === 'lim' || w === 'log' ? (w === 'lim' || w === 'log' ? w + ' ' : '') : w));
    return s.replace(/\\[,;! ]/g, ' ').replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();
  };

  IO.exportPptx = async () => {
    if (A.editingId) B.editor.endEdit();
    B.ui.toast('Building PowerPoint file…', 1800);
    try {
      await U.loadScript(PPTX_LIB);
    } catch (e) {
      return B.ui.toast('The PowerPoint exporter could not be loaded.');
    }
    const deck = A.deck;
    const theme = B.themeById(deck.theme);
    const W = deck.w, H = deck.h;
    const pptx = new window.PptxGenJS();
    pptx.defineLayout({ name: 'BSD', width: W * PX, height: H * PX });
    pptx.layout = 'BSD';
    pptx.title = deck.title;
    pptx.company = 'BSD STEM Slides';
    pptx.author = 'BSD STEM Slides';
    const col = (c) => hex(B.resolveColor(c, theme));
    const box = (el) => ({ x: el.x * PX, y: el.y * PX, w: Math.max(el.w, 0.5) * PX, h: Math.max(el.h, 0.5) * PX });
    const lineOpt = (el) => {
      const c = col(el.stroke);
      if (!c || el.stroke === 'none') return { type: 'none' };
      const o = { color: c, width: el.strokeWidth == null ? 1 : el.strokeWidth };
      if (el.dash && el.dash !== 'solid') o.dashType = { dash: 'dash', dot: 'sysDot', dashdot: 'dashDot' }[el.dash];
      if (el.opacity != null && el.opacity < 1) o.transparency = Math.round((1 - el.opacity) * 100);
      return o;
    };
    const shadow = { type: 'outer', blur: 6, offset: 3, angle: 45, color: '000000', opacity: 0.35 };

    for (let si = 0; si < deck.slides.length; si++) {
      const s = deck.slides[si];
      const slide = pptx.addSlide();
      if (s.hidden) slide.hidden = true;
      const bg = s.background;
      if (bg && bg.type === 'solid') slide.background = { color: col(bg.color) };
      else if (bg && bg.type === 'image' && (A.assets[bg.asset] || bg.src)) slide.background = { data: A.assets[bg.asset] || bg.src };
      else if (!bg && theme.bg === theme.bgColor) slide.background = { color: hex(theme.bgColor) };
      else slide.background = { data: IO.paintBackground(s, theme, W, H) };

      {
        for (const d of B.decorFor(s, theme, deck)) slide.addShape('rect', { x: d.x * W * PX, y: d.y * H * PX, w: d.w * W * PX, h: d.h * H * PX, fill: { color: col(d.color) }, line: { type: 'none' } });
      }

      for (const el of s.elements) {
        try {
          const b = box(el);
          const rotate = el.rot || 0;
          const transp = el.opacity != null && el.opacity < 1 ? Math.round((1 - el.opacity) * 100) : 0;
          if (el.type === 'text' || el.type === 'shape') {
            const def = el.type === 'shape' ? B.shapeById(el.shape) : null;
            if (def && def.line) {
              slide.addShape('line', Object.assign({}, b, { w: el.w * PX, h: el.h * PX, flipH: !!el.flipH, flipV: !!el.flipV, line: Object.assign(lineOpt(el), def.head ? { endArrowType: 'triangle' } : {}, def.tail ? { beginArrowType: 'triangle' } : {}) }));
              continue;
            }
            const fillC = col(el.fill);
            const opts = Object.assign({}, b, {
              shape: def ? def.pptx : 'rect',
              rotate,
              flipH: !!el.flipH,
              flipV: !!el.flipV,
              fill: fillC && el.fill !== 'none' ? { color: fillC, transparency: transp } : { type: 'none' },
              line: lineOpt(el),
              valign: el.valign === 'middle' ? 'middle' : el.valign || 'top',
              align: el.align || (el.type === 'shape' ? 'center' : 'left'),
              fontFace: el.font || (el.placeholder === 'title' ? theme.heading : theme.body),
              fontSize: el.size || 18,
              color: hex(B.resolveColor(el.color, theme) || R.defaultTextColor(el, theme)),
              bold: !!el.bold,
              italic: !!el.italic,
              lineSpacingMultiple: (el.lineHeight || 1.2) / 1.2,
              fit: el.type === 'text' && el.autoHeight ? 'resize' : 'none',
              wrap: true,
            });
            if (el.shadow) opts.shadow = shadow;
            if (el.link) opts.hyperlink = { url: el.link };
            if (el.pad != null) opts.margin = Math.round(el.pad * 0.75);
            const runs = IO.htmlToRuns(el.html, { align: opts.align });
            slide.addText(runs, opts);
          } else if (el.type === 'image') {
            const data = A.assets[el.asset] || el.src;
            if (!data) continue;
            const o = Object.assign({}, b, { rotate, flipH: !!el.flipH, flipV: !!el.flipV, altText: el.alt || '' });
            if (/^data:/.test(data)) o.data = data;
            else o.path = data;
            if (el.mask === 'circle') o.rounding = true;
            if (el.crop) {
              const img = await U.loadImage(data).catch(() => null);
              if (img) {
                const cw = 1 - el.crop.l - el.crop.r, ch = 1 - el.crop.t - el.crop.b;
                const c = document.createElement('canvas');
                c.width = Math.max(1, Math.round(img.naturalWidth * cw));
                c.height = Math.max(1, Math.round(img.naturalHeight * ch));
                c.getContext('2d').drawImage(img, -img.naturalWidth * el.crop.l, -img.naturalHeight * el.crop.t);
                try {
                  o.data = c.toDataURL('image/png');
                  delete o.path;
                } catch (e) {
                  /* cross-origin image: keep uncropped */
                }
              }
            }
            if (el.shadow) o.shadow = shadow;
            if (el.link) o.hyperlink = { url: el.link };
            slide.addImage(o);
            if (el.stroke && el.stroke !== 'none') slide.addShape(el.mask === 'circle' ? 'ellipse' : el.mask === 'rounded' ? 'roundRect' : 'rect', Object.assign({}, b, { rotate, fill: { type: 'none' }, line: lineOpt(el) }));
          } else if (el.type === 'table') {
            const cols = R.tableColors(el, theme);
            const ncol = Math.max(...el.rows.map((r) => r.length));
            const rows = el.rows.map((row, r) => {
              const head = el.header && r === 0;
              const bi = el.header ? r - 1 : r;
              const bgc = head ? cols.head : el.banded ? (bi % 2 === 0 ? cols.band1 : cols.band2) : cols.band2;
              return Array.from({ length: ncol }, (_, c) => ({
                text: IO.htmlToRuns(row[c] || '', { align: 'left' }),
                options: { fill: { color: hex(bgc) }, color: hex(head ? cols.headText : R.contrast(bgc)), bold: head, valign: 'middle' },
              }));
            });
            slide.addTable(rows, Object.assign({}, b, { colW: (el.colW || new Array(ncol).fill(1 / ncol)).map((f) => f * el.w * PX), fontFace: el.font || theme.body, fontSize: el.size || 16, border: { type: 'solid', pt: 1, color: 'FFFFFF' }, autoPage: false }));
          } else if (el.type === 'chart') {
            const c = el.chart;
            const types = { column: 'bar', bar: 'bar', line: 'line', area: 'area', pie: 'pie', doughnut: 'doughnut', scatter: 'scatter' };
            let data;
            if (c.kind === 'scatter') data = [{ name: 'X', values: c.labels.map((l) => parseFloat(l) || 0) }].concat(c.series.map((s2) => ({ name: s2.name, values: s2.values.map((v) => (v == null ? 0 : v)) })));
            else data = (c.kind === 'pie' || c.kind === 'doughnut' ? c.series.slice(0, 1) : c.series).map((s2) => ({ name: s2.name, labels: c.labels.map(String), values: s2.values.map((v) => (v == null ? 0 : v)) }));
            const fg = hex(R.chartTheme(s, theme).text);
            const o = Object.assign({}, b, {
              barDir: c.kind === 'bar' ? 'bar' : 'col',
              showLegend: c.legend !== false,
              legendPos: 'b',
              legendColor: fg,
              showTitle: !!c.title,
              title: c.title || '',
              titleColor: fg,
              showValue: !!c.dataLabels,
              showPercent: !!c.dataLabels && (c.kind === 'pie' || c.kind === 'doughnut'),
              chartColors: (c.colors && c.colors.length ? c.colors : theme.accents).map((a) => hex(a) || a.slice(1)),
              catAxisLabelColor: fg,
              valAxisLabelColor: fg,
              dataLabelColor: fg,
              valGridLine: { color: hex(U.mix(theme.text, theme.bgColor, 0.78)), style: 'solid', size: 1 },
              lineDataSymbol: c.kind === 'scatter' || c.kind === 'line' ? 'circle' : 'none',
              lineSize: c.kind === 'scatter' ? 0 : 2,
              altText: el.alt || '',
            });
            if (c.xTitle) Object.assign(o, { showCatAxisTitle: true, catAxisTitle: c.xTitle, catAxisTitleColor: fg });
            if (c.yTitle) Object.assign(o, { showValAxisTitle: true, valAxisTitle: c.yTitle, valAxisTitleColor: fg });
            slide.addChart(types[c.kind] || 'bar', data, o);
          } else if (el.type === 'equation') {
            // PowerPoint can't read LaTeX; export a picture of the formula when possible, else linear text
            slide.addText(IO.latexToText(el.latex), Object.assign({}, b, { rotate, fontFace: 'Cambria Math', fontSize: el.size || 32, color: hex(B.resolveColor(el.color, theme) || theme.text), align: el.align || 'center', valign: 'middle', italic: false }));
          } else if (el.type === 'model3d') {
            // PowerPoint export carries a picture of the model's current view
            const png = await B.model3d.png(el, theme, el.w * 2, el.h * 2).catch(() => null);
            if (png) slide.addImage(Object.assign({}, b, { data: png, rotate, altText: el.alt || el.name || '3D model' }));
          } else if (el.type === 'audio') {
            const data = A.assets[el.asset];
            if (!data) continue;
            const aud = await B.media.toPptxAudio(data).catch(() => null);
            if (!aud) continue;
            const cover = await B.media.iconPng(B.resolveColor(el.fill, theme) || theme.accents[0]);
            slide.addMedia(Object.assign({}, b, { type: 'audio', data: aud.data, extn: aud.extn, objectName: el.name || 'Audio' }, cover ? { cover } : {}));
          } else if (el.type === 'video') {
            const yt = el.kind === 'youtube' ? R.ytId(el.src) : null;
            if (yt) slide.addMedia(Object.assign({}, b, { type: 'online', link: 'https://www.youtube.com/embed/' + yt }));
            else if (el.kind === 'file' && A.assets[el.asset]) {
              const m = A.assets[el.asset].match(/^data:video\/(\w+)/);
              slide.addMedia(Object.assign({}, b, { type: 'video', data: A.assets[el.asset], extn: m ? m[1] : 'mp4' }));
            }
          }
        } catch (err) {
          console.warn('Could not export element', el, err);
        }
      }
      if (deck.slideNumbers && !(s.layout === 'title' && deck.hideFooterOnTitle)) slide.slideNumber = { x: (W - 70) * PX, y: (H - 34) * PX, w: 0.6, h: 0.3, fontSize: 11, color: hex(theme.text), align: 'right' };
      if (deck.footer && !(s.layout === 'title' && deck.hideFooterOnTitle)) slide.addText(deck.footer, { x: W * 0.25 * PX, y: (H - 34) * PX, w: W * 0.5 * PX, h: 0.3, fontSize: 11, color: hex(theme.text), align: 'center' });
      if (s.notes) slide.addNotes(s.notes);
    }
    await pptx.writeFile({ fileName: U.safeFilename(deck.title) + '.pptx' });
    B.ui.toast('PowerPoint file downloaded.');
  };

  /* ======================= PPTX import ======================= */
  const NS = {
    a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
    p: 'http://schemas.openxmlformats.org/presentationml/2006/main',
    r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    c: 'http://schemas.openxmlformats.org/drawingml/2006/chart',
  };
  const kids = (n, ns, name) => (n ? Array.from(n.childNodes).filter((c) => c.nodeType === 1 && c.localName === name && (!ns || c.namespaceURI === NS[ns])) : []);
  const kid = (n, ns, name) => kids(n, ns, name)[0] || null;
  const path = (n, ...steps) => steps.reduce((cur, s) => (cur ? kid(cur, s.split(':')[0], s.split(':')[1]) : null), n);
  const all = (n, ns, name) => (n ? Array.from(n.getElementsByTagNameNS(NS[ns], name)) : []);
  const attr = (n, a) => (n ? n.getAttribute(a) : null);

  const resolvePath = (base, target) => {
    if (target.startsWith('/')) return target.slice(1);
    const parts = base.split('/');
    parts.pop();
    for (const seg of target.split('/')) {
      if (seg === '..') parts.pop();
      else if (seg !== '.') parts.push(seg);
    }
    return parts.join('/');
  };

  const hsl = (hexc) => {
    const c = U.hexToRgb(hexc);
    const r = c.r / 255, g = c.g / 255, b = c.b / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let hh = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      hh = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      hh /= 6;
    }
    return [hh, s, l];
  };
  const fromHsl = (hh, s, l) => {
    if (s === 0) return U.rgbToHex(l * 255, l * 255, l * 255);
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = (t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    return U.rgbToHex(f(hh + 1 / 3) * 255, f(hh) * 255, f(hh - 1 / 3) * 255);
  };

  IO.importPptx = async (file) => {
    await U.loadScript(PPTX_LIB);
    const zip = await window.JSZip.loadAsync(await U.readFile(file, 'buffer'));
    const parser = new DOMParser();
    const xml = async (p) => {
      const f = zip.file(p);
      return f ? parser.parseFromString(await f.async('string'), 'application/xml') : null;
    };
    const relsCache = {};
    const rels = async (p) => {
      if (relsCache[p]) return relsCache[p];
      const dir = p.substring(0, p.lastIndexOf('/'));
      const doc = await xml(`${dir}/_rels/${p.substring(p.lastIndexOf('/') + 1)}.rels`);
      const map = {};
      if (doc) for (const r of Array.from(doc.getElementsByTagName('Relationship'))) map[r.getAttribute('Id')] = { type: r.getAttribute('Type') || '', target: r.getAttribute('TargetMode') === 'External' ? r.getAttribute('Target') : resolvePath(p, r.getAttribute('Target')), external: r.getAttribute('TargetMode') === 'External' };
      return (relsCache[p] = map);
    };
    const relOfType = (map, t) => Object.values(map).find((r) => r.type.endsWith('/' + t));

    const pres = await xml('ppt/presentation.xml');
    if (!pres) throw new Error('This file is not a PowerPoint presentation.');
    const sz = all(pres, 'p', 'sldSz')[0];
    const cx = +attr(sz, 'cx') || 9144000, cy = +attr(sz, 'cy') || 5143500;
    // portrait files open as book decks (8.5 in wide), landscape ones as 10 in wide slides
    const portrait = cy > cx;
    const deckW = portrait ? 816 : 960;
    const k = deckW / cx; // EMU → our px
    const fontK = ((deckW / 96) * 914400) / cx; // keep text proportional to the page
    const deckH = portrait ? Math.round(cy * k) : Math.round(cy * k) > 600 ? 720 : 540;
    const ky = deckH / (cy * k);
    const presRels = await rels('ppt/presentation.xml');

    // theme colours & fonts
    const themeRel = relOfType(presRels, 'theme');
    const themeDoc = themeRel ? await xml(themeRel.target) : null;
    const scheme = {};
    if (themeDoc) {
      const cs = all(themeDoc, 'a', 'clrScheme')[0];
      if (cs)
        for (const c of Array.from(cs.childNodes).filter((n) => n.nodeType === 1)) {
          const v = kid(c, 'a', 'srgbClr') || kid(c, 'a', 'sysClr');
          if (v) scheme[c.localName] = '#' + (attr(v, 'val') && v.localName === 'srgbClr' ? attr(v, 'val') : attr(v, 'lastClr') || '000000');
        }
    }
    const majorFont = themeDoc ? attr(path(all(themeDoc, 'a', 'majorFont')[0], 'a:latin'), 'typeface') : null;
    const minorFont = themeDoc ? attr(path(all(themeDoc, 'a', 'minorFont')[0], 'a:latin'), 'typeface') : null;
    const mapScheme = { tx1: 'dk1', bg1: 'lt1', tx2: 'dk2', bg2: 'lt2' };

    const color = (n, phClr) => {
      if (!n) return null;
      const c = n.localName === 'solidFill' ? Array.from(n.childNodes).find((x) => x.nodeType === 1) : n;
      if (!c) return null;
      let v = null;
      if (c.localName === 'srgbClr') v = '#' + attr(c, 'val');
      else if (c.localName === 'schemeClr') {
        const name = attr(c, 'val');
        v = name === 'phClr' ? phClr || null : scheme[mapScheme[name] || name] || null;
      } else if (c.localName === 'sysClr') v = '#' + (attr(c, 'lastClr') || '000000');
      else if (c.localName === 'prstClr') v = { black: '#000000', white: '#FFFFFF', red: '#FF0000', blue: '#0000FF', green: '#008000' }[attr(c, 'val')] || '#000000';
      if (!v || !U.hexToRgb(v)) return null;
      let [hh, s, l] = hsl(v);
      let changed = false;
      for (const m of Array.from(c.childNodes).filter((x) => x.nodeType === 1)) {
        const val = +attr(m, 'val') / 100000;
        if (m.localName === 'lumMod') (l *= val), (changed = true);
        else if (m.localName === 'lumOff') (l += val), (changed = true);
        else if (m.localName === 'tint') {
          v = U.mix(changed ? fromHsl(hh, s, l) : v, '#FFFFFF', 1 - val);
          [hh, s, l] = hsl(v);
        } else if (m.localName === 'shade') {
          v = U.mix(changed ? fromHsl(hh, s, l) : v, '#000000', 1 - val);
          [hh, s, l] = hsl(v);
        }
      }
      return changed ? fromHsl(hh, s, U.clamp(l, 0, 1)) : v.toUpperCase();
    };

    const assets = {};
    const addMedia = async (target) => {
      const f = zip.file(target);
      if (!f) return null;
      const ext = (target.split('.').pop() || '').toLowerCase();
      const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', svg: 'image/svg+xml', webp: 'image/webp', mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', flac: 'audio/flac' }[ext];
      if (!mime) return null;
      const id = 'a_' + U.uid();
      let data = `data:${mime};base64,` + (await f.async('base64'));
      if (mime.startsWith('image/') && mime !== 'image/svg+xml' && mime !== 'image/gif') data = await U.shrinkImage(data).catch(() => data);
      assets[id] = data;
      return id;
    };

    const phOf = (sp) => path(sp, 'p:nvSpPr', 'p:nvPr', 'p:ph') || path(sp, 'p:nvPicPr', 'p:nvPr', 'p:ph') || path(sp, 'p:nvGraphicFramePr', 'p:nvPr', 'p:ph');
    const findPh = (doc, ph) => {
      if (!doc || !ph) return null;
      const type = attr(ph, 'type') || 'body', idx = attr(ph, 'idx');
      const sps = all(doc, 'p', 'sp');
      const norm = (t) => (t === 'ctrTitle' ? 'title' : t || 'body');
      return sps.find((s) => idx != null && attr(phOf(s), 'idx') === idx) || sps.find((s) => phOf(s) && norm(attr(phOf(s), 'type')) === norm(type)) || null;
    };
    const xfrmOf = (n) => path(n, 'p:spPr', 'a:xfrm') || path(n, 'p:xfrm') || path(n, 'p:grpSpPr', 'a:xfrm');
    const geom = (x) => {
      const off = kid(x, 'a', 'off'), ext = kid(x, 'a', 'ext');
      return { x: +attr(off, 'x') || 0, y: +attr(off, 'y') || 0, w: +attr(ext, 'cx') || 0, h: +attr(ext, 'cy') || 0, rot: (+attr(x, 'rot') || 0) / 60000, flipH: attr(x, 'flipH') === '1', flipV: attr(x, 'flipV') === '1' };
    };

    const ALIGN = { ctr: 'center', r: 'right', just: 'justify', l: 'left' };
    /** Defaults a placeholder inherits from its layout, then master, then the master text styles. */
    const phDefaults = (ph, kind, ldoc, mdoc) => {
      const out = { size: null, color: null, align: null, valign: null, bullets: null };
      const take = (lvl1) => {
        if (!lvl1) return;
        if (!out.align && attr(lvl1, 'algn')) out.align = ALIGN[attr(lvl1, 'algn')] || null;
        if (out.bullets == null) {
          if (kid(lvl1, 'a', 'buNone')) out.bullets = false;
          else if (kid(lvl1, 'a', 'buChar') || kid(lvl1, 'a', 'buAutoNum')) out.bullets = true;
        }
        const d = kid(lvl1, 'a', 'defRPr');
        if (d) {
          if (out.size == null && attr(d, 'sz')) out.size = +attr(d, 'sz') / 100;
          if (!out.color) out.color = color(kid(d, 'a', 'solidFill'));
        }
      };
      for (const doc of [ldoc, mdoc]) {
        const sp = findPh(doc, ph);
        const tx = sp && kid(sp, 'p', 'txBody');
        if (!tx) continue;
        take(path(tx, 'a:lstStyle', 'a:lvl1pPr'));
        const bp = kid(tx, 'a', 'bodyPr');
        if (bp && !out.valign && attr(bp, 'anchor')) out.valign = { ctr: 'middle', b: 'bottom', t: 'top' }[attr(bp, 'anchor')] || null;
      }
      const ts = mdoc && all(mdoc, 'p', 'txStyles')[0];
      const st = ts && kid(ts, 'p', kind === 'title' ? 'titleStyle' : 'bodyStyle');
      take(st && kid(st, 'a', 'lvl1pPr'));
      if (out.bullets == null) out.bullets = kind === 'body';
      return out;
    };

    const masterStyle = (master, kind) => {
      const ts = master && all(master, 'p', 'txStyles')[0];
      const st = ts && kid(ts, 'p', kind === 'title' ? 'titleStyle' : kind === 'body' ? 'bodyStyle' : 'otherStyle');
      const l1 = st && kid(st, 'a', 'lvl1pPr');
      const def = l1 && kid(l1, 'a', 'defRPr');
      return { size: def && attr(def, 'sz') ? +attr(def, 'sz') / 100 : null, color: def ? color(kid(def, 'a', 'solidFill')) : null };
    };

    const textFrom = (txBody, ctx) => {
      if (!txBody) return { html: '', size: null, color: null, align: null, valign: null, hasText: false };
      const bodyPr = kid(txBody, 'a', 'bodyPr');
      const anchor = attr(bodyPr, 'anchor');
      const valign = anchor === 'ctr' ? 'middle' : anchor === 'b' ? 'bottom' : anchor === 't' ? 'top' : null;
      const sizes = {};
      let firstAlign = null, firstColor = null, hasText = false;
      const out = [];
      let listOpen = null;
      const closeList = () => {
        if (listOpen) out.push(`</${listOpen}>`);
        listOpen = null;
      };
      for (const p of kids(txBody, 'a', 'p')) {
        const pPr = kid(p, 'a', 'pPr');
        const algn = attr(pPr, 'algn');
        const align = { ctr: 'center', r: 'right', just: 'justify', l: 'left' }[algn] || null;
        if (firstAlign == null && align) firstAlign = align;
        const lvl = +attr(pPr, 'lvl') || 0;
        const buNone = kid(pPr, 'a', 'buNone');
        const buChar = kid(pPr, 'a', 'buChar');
        const buNum = kid(pPr, 'a', 'buAutoNum');
        const bullet = buNone ? null : buNum ? 'ol' : buChar || ctx.bullets ? 'ul' : null;
        let inner = '';
        for (const r of Array.from(p.childNodes).filter((n) => n.nodeType === 1)) {
          if (r.localName === 'br') {
            inner += '<br>';
            continue;
          }
          if (r.localName !== 'r' && r.localName !== 'fld') continue;
          const t = (kid(r, 'a', 't') || {}).textContent || '';
          if (!t) continue;
          hasText = true;
          const rPr = kid(r, 'a', 'rPr');
          const css = [];
          let txt = U.esc(t);
          const sz = attr(rPr, 'sz') ? (+attr(rPr, 'sz') / 100) * fontK : null;
          if (sz) {
            sizes[sz] = (sizes[sz] || 0) + t.length;
            css.push(`font-size:${Math.round(sz * 2) / 2}pt`);
          }
          const c = color(kid(rPr, 'a', 'solidFill'));
          if (c) {
            if (!firstColor) firstColor = c;
            css.push(`color:${c}`);
          }
          const hl = kid(rPr, 'a', 'highlight');
          if (hl) {
            const hc = color(Array.from(hl.childNodes).find((x) => x.nodeType === 1));
            if (hc) css.push(`background-color:${hc}`);
          }
          const face = attr(kid(rPr, 'a', 'latin'), 'typeface');
          if (face && !face.startsWith('+')) css.push(`font-family:'${face.replace(/'/g, '')}'`);
          if (attr(rPr, 'b') === '1') txt = `<b>${txt}</b>`;
          if (attr(rPr, 'i') === '1') txt = `<i>${txt}</i>`;
          if (attr(rPr, 'u') && attr(rPr, 'u') !== 'none') txt = `<u>${txt}</u>`;
          if (attr(rPr, 'strike') && attr(rPr, 'strike') !== 'noStrike') txt = `<s>${txt}</s>`;
          const base = +attr(rPr, 'baseline') || 0;
          if (base > 0) txt = `<sup>${txt}</sup>`;
          else if (base < 0) txt = `<sub>${txt}</sub>`;
          const link = path(rPr, 'a:hlinkClick');
          if (link && ctx.rels[attr(link, 'r:id')] && ctx.rels[attr(link, 'r:id')].external) txt = `<a href="${U.esc(ctx.rels[attr(link, 'r:id')].target)}">${txt}</a>`;
          inner += css.length ? `<span style="${css.join(';')}">${txt}</span>` : txt;
        }
        const style = align ? ` style="text-align:${align}${lvl && bullet ? `;margin-left:${lvl * 1.4}em` : ''}"` : lvl && bullet ? ` style="margin-left:${lvl * 1.4}em"` : '';
        if (bullet && inner) {
          if (listOpen !== bullet) {
            closeList();
            out.push(`<${bullet}>`);
            listOpen = bullet;
          }
          out.push(`<li${style}>${inner}</li>`);
        } else {
          closeList();
          out.push(`<div${style}>${inner || '<br>'}</div>`);
        }
      }
      closeList();
      const size = Object.entries(sizes).sort((a, b) => b[1] - a[1])[0];
      return { html: U.sanitizeHtml(out.join('')), size: size ? +size[0] : null, color: firstColor, align: firstAlign, valign, hasText };
    };

    const fillOf = (spPr, style) => {
      if (!spPr) return undefined;
      if (kid(spPr, 'a', 'noFill')) return 'none';
      const sf = kid(spPr, 'a', 'solidFill');
      if (sf) return color(sf);
      const gf = kid(spPr, 'a', 'gradFill');
      if (gf) {
        const gs = all(gf, 'a', 'gs')[0];
        return gs ? color(Array.from(gs.childNodes).find((x) => x.nodeType === 1)) : undefined;
      }
      const ref = style && kid(style, 'a', 'fillRef');
      if (ref && +attr(ref, 'idx') > 0) return color(Array.from(ref.childNodes).find((x) => x.nodeType === 1));
      return undefined;
    };
    const lineOf = (spPr, style) => {
      const ln = spPr && kid(spPr, 'a', 'ln');
      let c, w = ln && attr(ln, 'w') ? +attr(ln, 'w') / 12700 : null;
      if (ln && kid(ln, 'a', 'noFill')) c = 'none';
      else if (ln && kid(ln, 'a', 'solidFill')) c = color(kid(ln, 'a', 'solidFill'));
      else {
        const ref = style && kid(style, 'a', 'lnRef');
        if (ref && +attr(ref, 'idx') > 0) c = color(Array.from(ref.childNodes).find((x) => x.nodeType === 1));
      }
      const dash = ln && attr(kid(ln, 'a', 'prstDash'), 'val');
      const head = ln && kid(ln, 'a', 'tailEnd') && attr(kid(ln, 'a', 'tailEnd'), 'type') !== 'none';
      const tail = ln && kid(ln, 'a', 'headEnd') && attr(kid(ln, 'a', 'headEnd'), 'type') !== 'none';
      return { color: c, width: w, dash: dash ? (/dot/i.test(dash) && !/dash/i.test(dash) ? 'dot' : /dashDot/i.test(dash) ? 'dashdot' : dash === 'solid' ? 'solid' : 'dash') : 'solid', head, tail };
    };

    const readChart = async (target) => {
      const doc = await xml(target);
      if (!doc) return null;
      const plot = all(doc, 'c', 'plotArea')[0];
      if (!plot) return null;
      const typeNode = Array.from(plot.childNodes).find((n) => n.nodeType === 1 && /Chart$/.test(n.localName));
      if (!typeNode) return null;
      const tn = typeNode.localName;
      let kind = { barChart: 'column', bar3DChart: 'column', lineChart: 'line', line3DChart: 'line', pieChart: 'pie', pie3DChart: 'pie', doughnutChart: 'doughnut', areaChart: 'area', scatterChart: 'scatter' }[tn] || 'column';
      if (kind === 'column' && attr(kid(typeNode, 'c', 'barDir'), 'val') === 'bar') kind = 'bar';
      const pts = (n) => {
        const cache = n && (all(n, 'c', 'strCache')[0] || all(n, 'c', 'numCache')[0]);
        const out = [];
        if (cache) all(cache, 'c', 'pt').forEach((p) => (out[+attr(p, 'idx')] = (kid(p, 'c', 'v') || {}).textContent));
        return out;
      };
      const series = [];
      const colors = [];
      let labels = [];
      for (const ser of kids(typeNode, 'c', 'ser')) {
        const sf = path(ser, 'c:spPr', 'a:solidFill');
        if (sf && color(sf)) colors[series.length] = color(sf);
        const name = (all(kid(ser, 'c', 'tx'), 'c', 'v')[0] || {}).textContent || 'Series ' + (series.length + 1);
        const cat = pts(kid(ser, 'c', 'cat') || kid(ser, 'c', 'xVal'));
        const val = pts(kid(ser, 'c', 'val') || kid(ser, 'c', 'yVal'));
        if (cat.length > labels.length) labels = cat.map((x) => (x == null ? '' : x));
        series.push({ name, values: val.map((v) => (v == null || isNaN(+v) ? null : +v)) });
      }
      if (!series.length) return null;
      const n = Math.max(labels.length, ...series.map((s) => s.values.length));
      while (labels.length < n) labels.push(String(labels.length + 1));
      const title = all(all(doc, 'c', 'title')[0], 'a', 't').map((t) => t.textContent).join('');
      const chart = { kind, title, legend: !!all(doc, 'c', 'legend')[0], dataLabels: false, labels, series };
      if (colors.filter(Boolean).length === series.length && kind !== 'pie' && kind !== 'doughnut') chart.colors = colors;
      return chart;
    };

    const slideList = all(pres, 'p', 'sldId').map((n) => presRels[n.getAttributeNS(NS.r, 'id') || attr(n, 'r:id')]).filter(Boolean);
    const deck = M.newDeck('office', file.name.replace(/\.pptx$/i, ''));
    deck.w = deckW;
    deck.h = deckH;
    deck.slides = [];
    const docTitle = await xml('docProps/core.xml');
    const t = docTitle && docTitle.getElementsByTagNameNS('http://purl.org/dc/elements/1.1/', 'title')[0];
    if (t && t.textContent.trim()) deck.title = t.textContent.trim();

    for (const rel of slideList) {
      const sp = rel.target;
      const sdoc = await xml(sp);
      if (!sdoc) continue;
      const srels = await rels(sp);
      const layRel = relOfType(srels, 'slideLayout');
      const ldoc = layRel ? await xml(layRel.target) : null;
      const lrels = layRel ? await rels(layRel.target) : {};
      const mRel = relOfType(lrels, 'slideMaster');
      const mdoc = mRel ? await xml(mRel.target) : null;
      const mrels = mRel ? await rels(mRel.target) : {};
      const slide = { id: U.uid(), layout: 'blank', elements: [], notes: '', background: null, transition: { type: 'none', duration: 0.7 }, hidden: attr(sdoc.documentElement, 'show') === '0' };

      // background
      for (const [doc, dr] of [[sdoc, srels], [ldoc, lrels], [mdoc, mrels]]) {
        const bg = doc && all(doc, 'p', 'bg')[0];
        if (!bg) continue;
        const bgPr = kid(bg, 'p', 'bgPr');
        const bgRef = kid(bg, 'p', 'bgRef');
        if (bgPr) {
          const sf = kid(bgPr, 'a', 'solidFill');
          const gf = kid(bgPr, 'a', 'gradFill');
          const bf = kid(bgPr, 'a', 'blipFill');
          if (sf) slide.background = { type: 'solid', color: color(sf) || '#FFFFFF' };
          else if (gf) {
            const gs = all(gf, 'a', 'gs');
            const c0 = color(Array.from(gs[0].childNodes).find((x) => x.nodeType === 1));
            const c1 = color(Array.from(gs[gs.length - 1].childNodes).find((x) => x.nodeType === 1));
            const lin = kid(gf, 'a', 'lin');
            slide.background = { type: 'gradient', from: c0 || '#FFFFFF', to: c1 || '#FFFFFF', angle: lin ? ((+attr(lin, 'ang') || 0) / 60000 + 90) % 360 : 180 };
          } else if (bf) {
            const emb = all(bf, 'a', 'blip')[0];
            const r = emb && dr[emb.getAttributeNS(NS.r, 'embed')];
            const id = r ? await addMedia(r.target) : null;
            if (id) slide.background = { type: 'image', asset: id };
          }
        } else if (bgRef) {
          const c = color(Array.from(bgRef.childNodes).find((x) => x.nodeType === 1));
          if (c) slide.background = { type: 'solid', color: c };
        }
        if (slide.background) break;
      }
      if (!slide.background) slide.background = { type: 'solid', color: scheme.lt1 || '#FFFFFF' };

      const walkTree = async (tree, tf, groupId) => {
        for (const n of Array.from(tree.childNodes).filter((x) => x.nodeType === 1)) {
          const name = n.localName;
          if (name === 'grpSp') {
            const x = xfrmOf(n);
            if (!x) continue;
            const off = kid(x, 'a', 'off'), ext = kid(x, 'a', 'ext'), chOff = kid(x, 'a', 'chOff'), chExt = kid(x, 'a', 'chExt');
            const sx = (+attr(ext, 'cx') || 1) / (+attr(chExt, 'cx') || +attr(ext, 'cx') || 1);
            const sy = (+attr(ext, 'cy') || 1) / (+attr(chExt, 'cy') || +attr(ext, 'cy') || 1);
            const ox = +attr(off, 'x') || 0, oy = +attr(off, 'y') || 0, cx0 = +attr(chOff, 'x') || 0, cy0 = +attr(chOff, 'y') || 0;
            const inner = (g) => tf({ x: ox + (g.x - cx0) * sx, y: oy + (g.y - cy0) * sy, w: g.w * sx, h: g.h * sy, rot: g.rot, flipH: g.flipH, flipV: g.flipV });
            await walkTree(n, inner, groupId || U.uid());
            continue;
          }
          const ph = phOf(n);
          const phType = ph ? attr(ph, 'type') || 'body' : null;
          if (phType && ['dt', 'ftr', 'sldNum', 'hdr'].includes(phType)) continue;
          let x = xfrmOf(n);
          if (!x && ph) x = xfrmOf(findPh(ldoc, ph)) || xfrmOf(findPh(mdoc, ph));
          if (!x) continue;
          const g = tf(geom(x));
          const base = { x: Math.round(g.x * k * 10) / 10, y: Math.round(g.y * k * ky * 10) / 10, w: Math.round(g.w * k * 10) / 10, h: Math.round(g.h * k * ky * 10) / 10, rot: Math.round(g.rot) % 360, flipH: g.flipH, flipV: g.flipV };
          if (groupId) base.groupId = groupId;
          if (name === 'sp' || name === 'cxnSp') {
            const spPr = kid(n, 'p', 'spPr');
            const style = kid(n, 'p', 'style');
            const prst = attr(path(spPr, 'a:prstGeom'), 'prst') || (name === 'cxnSp' ? 'line' : 'rect');
            const isLine = name === 'cxnSp' || /^(line|straightConnector1|bentConnector\d|curvedConnector\d)$/.test(prst);
            const ln = lineOf(spPr, style);
            if (isLine) {
              slide.elements.push(M.newElement('shape', Object.assign(base, { shape: ln.head && ln.tail ? 'doubleArrowLine' : ln.head || ln.tail ? 'arrowLine' : 'line', fill: 'none', stroke: ln.color || scheme.accent1 || '#4472C4', strokeWidth: ln.width || 1, dash: ln.dash, flipH: ln.tail && !ln.head ? !base.flipH : base.flipH, flipV: ln.tail && !ln.head ? !base.flipV : base.flipV, rot: 0 })));
              continue;
            }
            const txBox = attr(path(n, 'p:nvSpPr', 'p:cNvSpPr'), 'txBox') === '1';
            const kind = phType === 'title' || phType === 'ctrTitle' ? 'title' : phType === 'subTitle' ? 'subtitle' : phType ? 'body' : null;
            const pd = kind ? phDefaults(ph, kind, ldoc, mdoc) : { bullets: false };
            const tx = textFrom(kid(n, 'p', 'txBody'), { bullets: pd.bullets, rels: srels });
            const ms = masterStyle(mdoc, kind === 'title' ? 'title' : kind ? 'body' : 'other');
            let fill = fillOf(spPr, style);
            if (fill === undefined) fill = 'none';
            const def = B.shapeByPptx(prst) || null;
            const fontRef = style && kid(style, 'a', 'fontRef');
            const refColor = fontRef ? color(Array.from(fontRef.childNodes).find((x) => x.nodeType === 1)) : null;
            const textual = txBox || kind || !def || (prst === 'rect' && fill === 'none' && ln.color !== undefined && ln.color === 'none');
            const shapeText = def && !txBox && !kind;
            const props = Object.assign(base, {
              html: tx.html,
              size: Math.round((tx.size || ((pd.size || ms.size) ? (pd.size || ms.size) * fontK : kind === 'title' ? 44 * fontK : kind ? 24 * fontK : 18 * fontK)) * 2) / 2,
              color: pd.color || (kind ? ms.color : null) || refColor || (fill !== 'none' && shapeText ? null : scheme.dk1 || '#000000'),
              align: pd.align || (shapeText ? 'center' : 'left'),
              valign: tx.valign || pd.valign || (kind === 'title' ? 'middle' : shapeText ? 'middle' : 'top'),
              font: kind === 'title' ? majorFont : minorFont,
              fill: fill || 'none',
              stroke: ln.color || 'none',
              strokeWidth: ln.width || 1,
              dash: ln.dash,
            });
            if (kind) props.placeholder = kind;
            if (textual && (!def || prst === 'rect')) {
              if (!tx.hasText && !kind && (props.fill === 'none' || !props.fill) && props.stroke === 'none') continue;
              slide.elements.push(M.newElement('text', Object.assign(props, { autoHeight: false })));
            } else slide.elements.push(M.newElement('shape', Object.assign(props, { shape: def ? def.id : 'rect' })));
          } else if (name === 'pic') {
            const blip = all(n, 'a', 'blip')[0];
            const r = blip && srels[blip.getAttributeNS(NS.r, 'embed')];
            // media clips: <a:audioFile>/<a:videoFile> link plus a p14:media embed of the actual file
            const mf = all(n, 'a', 'audioFile')[0] || all(n, 'a', 'videoFile')[0];
            if (mf) {
              const lr = srels[mf.getAttributeNS(NS.r, 'link')];
              if (lr && lr.external && B.render.ytId(lr.target)) {
                slide.elements.push(M.newElement('video', Object.assign(base, { kind: 'youtube', src: lr.target })));
                continue;
              }
              const p14 = n.getElementsByTagNameNS('*', 'media')[0];
              const er = (p14 && srels[p14.getAttributeNS(NS.r, 'embed')]) || (lr && !lr.external ? lr : null);
              const isAudio = mf.localName === 'audioFile' || /\/audio$/.test((lr && lr.type) || '') || (er && /\.(mp3|wav|m4a|aac|ogg|oga|opus|flac)$/i.test(er.target));
              const mid = er && !er.external ? await addMedia(er.target) : null;
              if (mid && isAudio) {
                const nm = attr(path(n, 'p:nvPicPr', 'p:cNvPr'), 'name') || 'Audio';
                slide.elements.push(M.newElement('audio', Object.assign(base, { asset: mid, name: /^Media \d+$/.test(nm) ? 'Audio' : nm.replace(/\.[a-z0-9]+$/i, ''), rot: 0 })));
                continue;
              }
              if (mid && /^data:video\//.test(assets[mid])) {
                slide.elements.push(M.newElement('video', Object.assign(base, { kind: 'file', asset: mid })));
                continue;
              }
            }
            const id = r ? await addMedia(r.target) : null;
            if (!id) continue;
            const src = all(n, 'a', 'srcRect')[0];
            const crop = src ? { l: (+attr(src, 'l') || 0) / 100000, t: (+attr(src, 't') || 0) / 100000, r: (+attr(src, 'r') || 0) / 100000, b: (+attr(src, 'b') || 0) / 100000 } : null;
            const descr = attr(path(n, 'p:nvPicPr', 'p:cNvPr'), 'descr') || '';
            slide.elements.push(M.newElement('image', Object.assign(base, { asset: id, crop: crop && crop.l + crop.r + crop.t + crop.b > 0 ? crop : null, alt: descr })));
          } else if (name === 'graphicFrame') {
            const tbl = all(n, 'a', 'tbl')[0];
            if (tbl) {
              const cols = all(tbl, 'a', 'gridCol').map((c) => +attr(c, 'w') || 1);
              const total = cols.reduce((a, b) => a + b, 0) || 1;
              const rows = kids(tbl, 'a', 'tr').map((tr) => kids(tr, 'a', 'tc').map((tc) => textFrom(kid(tc, 'a', 'txBody'), { rels: srels }).html));
              const firstFill = all(tbl, 'a', 'tcPr').map((p) => color(kid(p, 'a', 'solidFill'))).find(Boolean);
              slide.elements.push(M.newElement('table', Object.assign(base, { rows: rows.length ? rows : [['']], colW: cols.map((c) => c / total), header: attr(kid(tbl, 'a', 'tblPr'), 'firstRow') === '1', banded: attr(kid(tbl, 'a', 'tblPr'), 'bandRow') === '1', accent: firstFill || '@accent1', size: 14 })));
              continue;
            }
            const ch = all(n, 'c', 'chart')[0];
            if (ch) {
              const r = srels[ch.getAttributeNS(NS.r, 'id')];
              const chart = r ? await readChart(r.target).catch(() => null) : null;
              if (chart) slide.elements.push(M.newElement('chart', Object.assign(base, { chart })));
            }
          }
        }
      };
      const tree = all(sdoc, 'p', 'spTree')[0];
      if (tree) await walkTree(tree, (g) => g, null);

      // notes
      const nRel = relOfType(srels, 'notesSlide');
      if (nRel) {
        const ndoc = await xml(nRel.target);
        if (ndoc) {
          const body = all(ndoc, 'p', 'sp').find((s) => attr(phOf(s), 'type') === 'body');
          if (body) slide.notes = all(body, 'a', 'p').map((p) => all(p, 'a', 't').map((t2) => t2.textContent).join('')).join('\n').trim();
        }
      }
      // transitions
      const tr = all(sdoc, 'p', 'transition')[0];
      if (tr) {
        const kind = Array.from(tr.childNodes).find((x) => x.nodeType === 1);
        const map = { fade: 'fade', push: 'push', wipe: 'wipe', split: 'split', cover: 'cover', pull: 'uncover', zoom: 'zoom', cut: 'none' };
        if (kind && map[kind.localName]) slide.transition = { type: map[kind.localName], duration: (+attr(tr, 'dur') || 700) / 1000, dir: { l: 'right', r: 'left', u: 'bottom', d: 'top' }[attr(kind, 'dir')] || 'right' };
        if (attr(tr, 'advTm')) slide.advanceAfter = +attr(tr, 'advTm') / 1000;
      }
      deck.slides.push(slide);
    }
    if (!deck.slides.length) throw new Error('No slides were found in this file.');
    return { deck, assets };
  };
})(window.BSD);
