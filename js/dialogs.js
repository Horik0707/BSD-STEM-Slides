/* BSD STEM Slides — dialogs: equation editor, symbols, chart data, video, find/replace, header & footer, diagrams */
(function (B) {
  'use strict';
  const U = B.util, A = B.app, M = B.model;
  const h = U.h;
  const D = (B.dialogs = {});
  const E = () => B.editor;

  /* ======================= equations ======================= */
  D.COMMON_EQUATIONS = [
    { name: 'Quadratic Formula', latex: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}' },
    { name: 'Pythagorean Theorem', latex: 'a^2 + b^2 = c^2' },
    { name: 'Slope-Intercept Form', latex: 'y = mx + b' },
    { name: 'Distance Formula', latex: 'd = \\sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}' },
    { name: 'Area of a Circle', latex: 'A = \\pi r^2' },
    { name: "Newton's Second Law", latex: '\\vec{F} = m\\vec{a}' },
    { name: 'Kinetic Energy', latex: 'KE = \\frac{1}{2} m v^2' },
    { name: 'Mass–Energy Equivalence', latex: 'E = mc^2' },
    { name: "Ohm's Law", latex: 'V = IR' },
    { name: 'Ideal Gas Law', latex: 'PV = nRT' },
    { name: 'Density', latex: '\\rho = \\frac{m}{V}' },
    { name: 'Photosynthesis', latex: '6\\,\\mathrm{CO_2} + 6\\,\\mathrm{H_2O} \\xrightarrow{\\text{light}} \\mathrm{C_6H_{12}O_6} + 6\\,\\mathrm{O_2}' },
    { name: 'Binomial Theorem', latex: '(x + a)^n = \\sum_{k=0}^{n} \\binom{n}{k} x^k a^{n-k}' },
    { name: 'Definition of the Derivative', latex: "f'(x) = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h}" },
    { name: 'Fundamental Theorem of Calculus', latex: '\\int_a^b f(x)\\,dx = F(b) - F(a)' },
    { name: "Euler's Identity", latex: 'e^{i\\pi} + 1 = 0' },
    { name: 'Standard Deviation', latex: '\\sigma = \\sqrt{\\frac{1}{N} \\sum_{i=1}^{N} (x_i - \\mu)^2}' },
    { name: 'Area of a Triangle', latex: 'A = \\frac{1}{2} b h' },
  ];

  const EQ_TOOLS = [
    { group: 'Structures', items: [
      ['\\frac{a}{b}', '\\frac{}{}', 'Fraction'], ['x^{n}', '^{}', 'Superscript'], ['x_{n}', '_{}', 'Subscript'], ['\\sqrt{x}', '\\sqrt{}', 'Square root'],
      ['\\sqrt[n]{x}', '\\sqrt[]{}', 'Nth root'], ['\\sum_{i=1}^{n}', '\\sum_{i=1}^{n} ', 'Summation'], ['\\int_{a}^{b}', '\\int_{a}^{b} ', 'Integral'],
      ['\\lim_{x\\to\\infty}', '\\lim_{x \\to \\infty} ', 'Limit'], ['\\left( x \\right)', '\\left(  \\right)', 'Parentheses'], ['\\vec{v}', '\\vec{}', 'Vector'],
      ['\\overline{x}', '\\overline{}', 'Bar'], ['\\hat{x}', '\\hat{}', 'Hat'], ['\\begin{bmatrix}a&b\\\\c&d\\end{bmatrix}', '\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}', 'Matrix'],
      ['\\binom{n}{k}', '\\binom{}{}', 'Binomial'], ['\\log_{b}', '\\log_{}', 'Logarithm'], ['\\text{abc}', '\\text{}', 'Plain text'],
    ] },
    { group: 'Operators', items: [
      ['\\pm', '\\pm '], ['\\times', '\\times '], ['\\div', '\\div '], ['\\cdot', '\\cdot '], ['\\neq', '\\neq '], ['\\approx', '\\approx '], ['\\leq', '\\leq '], ['\\geq', '\\geq '],
      ['\\infty', '\\infty '], ['\\partial', '\\partial '], ['\\nabla', '\\nabla '], ['\\propto', '\\propto '], ['\\in', '\\in '], ['\\forall', '\\forall '], ['\\exists', '\\exists '], ['\\degree', '^\\circ '],
      ['\\rightarrow', '\\rightarrow '], ['\\Rightarrow', '\\Rightarrow '], ['\\rightleftharpoons', '\\rightleftharpoons '], ['\\angle', '\\angle '], ['\\perp', '\\perp '], ['\\parallel', '\\parallel '], ['\\therefore', '\\therefore '], ['\\%', '\\% '],
    ] },
    { group: 'Greek', items: 'alpha beta gamma delta epsilon theta lambda mu pi rho sigma tau phi omega Delta Sigma Omega Pi'.split(' ').map((g) => ['\\' + g, '\\' + g + ' ']) },
  ];

  D.equation = (el) => {
    const editing = !!el;
    const ta = h('textarea', { class: 'field mono eq-input', rows: 3, spellcheck: 'false', 'aria-label': 'LaTeX' });
    ta.value = el ? el.latex : '';
    const preview = h('div', { class: 'eq-preview' });
    const err = h('div', { class: 'eq-error' });
    const render = () => {
      B.render.renderLatex(preview, ta.value || '\\text{Type an equation}');
      const kerr = preview.querySelector('.katex-error');
      err.textContent = kerr ? 'Check your LaTeX: ' + (kerr.title || '').replace(/^KaTeX parse error: /, '') : '';
    };
    ta.addEventListener('input', render);
    const tools = h('div', { class: 'eq-tools' });
    for (const g of EQ_TOOLS) {
      const row = h('div', { class: 'eq-tool-row' }, h('span', { class: 'eq-tool-label' }, g.group));
      for (const [show, ins, title] of g.items) {
        const b = h('button', { class: 'eq-tool', type: 'button', title: title || ins.trim() });
        B.render.renderLatex(b, show);
        b.addEventListener('click', () => {
          const s = ta.selectionStart, e = ta.selectionEnd;
          const selected = ta.value.slice(s, e);
          let text = ins, caret;
          const i = ins.indexOf('{}');
          if (i >= 0) {
            text = ins.slice(0, i + 1) + selected + ins.slice(i + 1);
            caret = s + i + 1 + selected.length;
          } else caret = s + text.length;
          ta.setRangeText(text, s, e, 'end');
          ta.focus();
          ta.setSelectionRange(caret, caret);
          render();
        });
        row.appendChild(b);
      }
      tools.appendChild(row);
    }
    const presets = h('select', { class: 'field sm' }, h('option', { value: '' }, 'Insert a common equation…'), ...D.COMMON_EQUATIONS.map((q, i) => h('option', { value: i }, q.name)));
    presets.addEventListener('change', () => {
      if (presets.value === '') return;
      ta.value = D.COMMON_EQUATIONS[+presets.value].latex;
      presets.value = '';
      render();
    });
    const size = h('input', { type: 'number', class: 'field sm', min: 8, max: 200, value: el ? el.size : 32, style: { width: '72px' } });
    const body = h(
      'div',
      { class: 'eq-dialog' },
      tools,
      h('div', { class: 'eq-row' }, presets, h('label', { class: 'inline' }, 'Size ', size, ' pt')),
      ta,
      h('p', { class: 'help' }, 'Write the equation in LaTeX. Example: ', h('code', {}, 'x^2 + \\frac{1}{2}'), ' — use the buttons above for help.'),
      h('div', { class: 'cp-label' }, 'Preview'),
      preview,
      err
    );
    render();
    B.ui.modal({
      title: editing ? 'Edit Equation' : 'Insert Equation',
      body,
      width: 720,
      buttons: [
        { label: 'Cancel', value: null },
        {
          label: editing ? 'Update' : 'Insert',
          primary: true,
          action: () => {
            const latex = ta.value.trim();
            if (!latex) return false;
            const sz = U.clamp(+size.value || 32, 8, 200);
            if (editing) {
              el.latex = latex;
              el.size = sz;
              E().refreshEl(el);
              B.actions.fitEquation(el);
            } else {
              const n = M.newElement('equation', { latex, size: sz, w: 420, h: 90 });
              E().insertElement(n);
              B.actions.fitEquation(n);
            }
          },
        },
      ],
    });
  };

  /* ======================= symbols ======================= */
  const SYMBOLS = {
    Greek: 'α β γ δ ε ζ η θ ι κ λ μ ν ξ ο π ρ σ τ υ φ χ ψ ω Α Β Γ Δ Ε Ζ Η Θ Ι Κ Λ Μ Ν Ξ Ο Π Ρ Σ Τ Υ Φ Χ Ψ Ω',
    Math: '± × ÷ · − ∓ ≠ ≈ ≡ ≤ ≥ ≪ ≫ ∝ ∞ √ ∛ ∜ ∑ ∏ ∫ ∬ ∮ ∂ ∇ ∆ ∈ ∉ ⊂ ⊃ ⊆ ⊇ ∪ ∩ ∅ ∀ ∃ ¬ ∧ ∨ ⊥ ∥ ∠ ° ′ ″ ‰ ∴ ∵ ℕ ℤ ℚ ℝ ℂ',
    Arrows: '← → ↑ ↓ ↔ ↕ ⇐ ⇒ ⇑ ⇓ ⇔ ⇌ ⇋ ↗ ↘ ↙ ↖ ↺ ↻ ⟶ ⟵ ⟷',
    Science: '° ℃ ℉ K Å µ Ω ℏ ħ λ ν ∆ ⇌ → ↑ ↓ ⊕ ⊖ ⁺ ⁻ ♂ ♀ ☢ ⚡ ☀ ⚛ 🧪 🔬 🧬 🌡 💧 🌍',
    'Super/Sub': '⁰ ¹ ² ³ ⁴ ⁵ ⁶ ⁷ ⁸ ⁹ ⁺ ⁻ ⁼ ⁽ ⁾ ⁿ ₀ ₁ ₂ ₃ ₄ ₅ ₆ ₇ ₈ ₉ ₊ ₋ ₌ ₍ ₎',
    Fractions: '½ ⅓ ⅔ ¼ ¾ ⅕ ⅖ ⅗ ⅘ ⅙ ⅚ ⅛ ⅜ ⅝ ⅞',
    Other: '• ◦ ▪ ▫ ★ ☆ ✓ ✔ ✗ ✘ © ® ™ § ¶ † ‡ … – — « » ¿ ¡ € £ ¥ ¢',
  };
  D.symbol = () => {
    const tabs = h('div', { class: 'sym-tabs' });
    const grid = h('div', { class: 'sym-grid' });
    const preview = h('div', { class: 'sym-preview' });
    let cat = U.storage.get('symCat', 'Greek');
    const show = () => {
      U.$$('.sym-tab', tabs).forEach((t) => t.classList.toggle('on', t.dataset.cat === cat));
      grid.innerHTML = '';
      for (const s of SYMBOLS[cat].split(' ')) {
        const b = h('button', { class: 'sym', type: 'button', title: s }, s);
        b.addEventListener('mouseenter', () => (preview.textContent = s));
        b.addEventListener('click', () => {
          E().insertSymbol(s);
          B.ui.toast(`Inserted ${s}`, 900);
        });
        grid.appendChild(b);
      }
    };
    for (const c of Object.keys(SYMBOLS)) {
      const t = h('button', { class: 'sym-tab', type: 'button', 'data-cat': c }, c);
      t.addEventListener('click', () => {
        cat = c;
        U.storage.set('symCat', c);
        show();
      });
      tabs.appendChild(t);
    }
    show();
    B.ui.modal({ title: 'Symbol', body: h('div', { class: 'sym-dialog' }, tabs, h('div', { class: 'sym-main' }, grid, preview)), width: 560, buttons: [{ label: 'Close', primary: true, value: null }] });
  };

  /* ======================= chart data ======================= */
  D.chart = (el) => {
    if (!el) return;
    const c = U.clone(el.chart);
    const kind = h('select', { class: 'field sm' }, ...B.CHART_KINDS.map((k) => h('option', { value: k.id }, k.name)));
    kind.value = c.kind;
    const title = h('input', { class: 'field sm', value: c.title || '', placeholder: 'Chart title' });
    const xT = h('input', { class: 'field sm', value: c.xTitle || '', placeholder: 'Horizontal axis title' });
    const yT = h('input', { class: 'field sm', value: c.yTitle || '', placeholder: 'Vertical axis title' });
    const chk = (label, key) => {
      const i = h('input', { type: 'checkbox' });
      i.checked = key === 'legend' ? c.legend !== false : !!c[key];
      i.addEventListener('change', () => {
        c[key] = i.checked;
        draw();
      });
      return h('label', { class: 'pane-check' }, i, h('span', {}, label));
    };
    const gridBox = h('div', { class: 'data-grid-wrap' });
    const preview = h('div', { class: 'chart-preview' });
    const hint = h('p', { class: 'help' });
    const draw = () => {
      c.kind = kind.value;
      c.title = title.value;
      c.xTitle = xT.value;
      c.yTitle = yT.value;
      const ct = B.render.chartTheme(B.curSlide(), B.theme());
      preview.innerHTML = B.chartSvg(c, 420, 260, ct);
      preview.style.background = ct.bgColor;
      hint.textContent =
        c.kind === 'scatter' ? 'Scatter: the first column holds X values; each other column is a set of Y values.' : c.kind === 'pie' || c.kind === 'doughnut' ? 'Pie charts use the first data column only.' : 'Tip: paste a block of cells from Excel or Google Sheets into any box.';
    };
    const buildGrid = () => {
      const t = h('table', { class: 'data-grid' });
      const head = h('tr', {}, h('th', { class: 'corner' }, c.kind === 'scatter' ? 'X' : ''));
      c.series.forEach((s, si) => {
        const inp = h('input', { value: s.name, 'aria-label': `Series ${si + 1} name` });
        inp.addEventListener('input', () => {
          s.name = inp.value;
          draw();
        });
        inp.addEventListener('paste', (e) => onPaste(e, -1, si));
        head.appendChild(h('th', {}, inp));
      });
      t.appendChild(head);
      c.labels.forEach((lab, r) => {
        const tr = h('tr');
        const li = h('input', { value: lab, 'aria-label': `Category ${r + 1}` });
        li.addEventListener('input', () => {
          c.labels[r] = li.value;
          draw();
        });
        li.addEventListener('paste', (e) => onPaste(e, r, -1));
        tr.appendChild(h('th', {}, li));
        c.series.forEach((s, si) => {
          const v = s.values[r];
          const inp = h('input', { value: v == null ? '' : v, inputmode: 'decimal', 'aria-label': `${s.name} ${lab}` });
          inp.addEventListener('input', () => {
            const n = parseFloat(inp.value);
            s.values[r] = inp.value.trim() === '' || isNaN(n) ? null : n;
            draw();
          });
          inp.addEventListener('paste', (e) => onPaste(e, r, si));
          tr.appendChild(h('td', {}, inp));
        });
        t.appendChild(tr);
      });
      gridBox.innerHTML = '';
      gridBox.appendChild(t);
    };
    const onPaste = (e, r0, c0) => {
      const text = e.clipboardData.getData('text/plain');
      if (!/[\t\n]/.test(text.trim())) return;
      e.preventDefault();
      const rows = text.replace(/\r/g, '').replace(/\n$/, '').split('\n').map((l) => l.split('\t'));
      rows.forEach((cells, dr) => {
        cells.forEach((val, dc) => {
          const r = r0 + dr, cc = c0 + dc;
          if (r === -1) {
            if (cc >= 0) {
              while (c.series.length <= cc) c.series.push({ name: 'Series ' + (c.series.length + 1), values: c.labels.map(() => null) });
              c.series[cc].name = val;
            }
            return;
          }
          while (c.labels.length <= r) {
            c.labels.push('Category ' + (c.labels.length + 1));
            c.series.forEach((s) => s.values.push(null));
          }
          if (cc === -1) c.labels[r] = val;
          else {
            while (c.series.length <= cc) c.series.push({ name: 'Series ' + (c.series.length + 1), values: c.labels.map(() => null) });
            const n = parseFloat(String(val).replace(/,/g, ''));
            c.series[cc].values[r] = isNaN(n) ? null : n;
          }
        });
      });
      buildGrid();
      draw();
    };
    const btn = (icon, label, fn) => {
      const b = h('button', { class: 'btn sm', type: 'button', html: U.icon(icon) + label });
      b.addEventListener('click', () => {
        fn();
        buildGrid();
        draw();
      });
      return b;
    };
    const ops = h(
      'div',
      { class: 'btn-row' },
      btn('add', 'Row', () => {
        c.labels.push(c.kind === 'scatter' ? String(c.labels.length) : 'Category ' + (c.labels.length + 1));
        c.series.forEach((s) => s.values.push(null));
      }),
      btn('remove', 'Row', () => {
        if (c.labels.length <= 1) return;
        c.labels.pop();
        c.series.forEach((s) => s.values.pop());
      }),
      btn('add', 'Series', () => c.series.push({ name: 'Series ' + (c.series.length + 1), values: c.labels.map(() => null) })),
      btn('remove', 'Series', () => c.series.length > 1 && c.series.pop()),
      (() => {
        const b = h('button', { class: 'btn sm', type: 'button', html: U.icon('upload_file') + 'Import CSV' });
        b.addEventListener('click', async () => {
          const f = await U.pickFile('.csv,text/csv,.tsv,text/plain');
          if (!f) return;
          const txt = await U.readFile(f, 'text');
          const rows = txt.replace(/\r/g, '').trim().split('\n').map((l) => (l.includes('\t') ? l.split('\t') : l.split(',')).map((x) => x.trim().replace(/^"|"$/g, '')));
          if (rows.length < 2) return;
          c.series = rows[0].slice(1).map((name, i) => ({ name, values: rows.slice(1).map((r) => (isNaN(parseFloat(r[i + 1])) ? null : parseFloat(r[i + 1]))) }));
          c.labels = rows.slice(1).map((r) => r[0]);
          buildGrid();
          draw();
        });
        return b;
      })()
    );
    [kind, title, xT, yT].forEach((i) => i.addEventListener('input', draw));
    kind.addEventListener('change', () => {
      buildGrid();
      draw();
    });
    buildGrid();
    draw();
    const body = h(
      'div',
      { class: 'chart-dialog' },
      h('div', { class: 'chart-left' }, h('div', { class: 'grid2' }, h('label', { class: 'field-label' }, 'Chart type', kind), h('label', { class: 'field-label' }, 'Title', title), h('label', { class: 'field-label' }, 'X axis', xT), h('label', { class: 'field-label' }, 'Y axis', yT)), h('div', { class: 'check-row' }, chk('Legend', 'legend'), chk('Data labels', 'dataLabels'), chk('Trendline (scatter)', 'trendline')), gridBox, ops, hint),
      h('div', { class: 'chart-right' }, h('div', { class: 'cp-label' }, 'Preview'), preview)
    );
    B.ui.modal({
      title: 'Edit Chart Data',
      body,
      width: 960,
      buttons: [
        { label: 'Cancel', value: null },
        {
          label: 'Done',
          primary: true,
          action: () => {
            el.chart = c;
            E().changed(true);
            E().select([el.id]);
          },
        },
      ],
    });
  };

  /* ======================= video ======================= */
  D.video = (el) => {
    const inp = h('input', { class: 'field', placeholder: 'https://www.youtube.com/watch?v=…', value: el && el.kind === 'youtube' ? el.src : '' });
    const prev = h('div', { class: 'video-preview' });
    const upd = () => {
      const id = B.render.ytId(inp.value);
      prev.innerHTML = id ? `<img alt="Video thumbnail" src="https://i.ytimg.com/vi/${id}/hqdefault.jpg">` : `<span class="help">Paste a YouTube link to preview it.</span>`;
    };
    inp.addEventListener('input', upd);
    upd();
    const up = h('button', { class: 'btn sm', type: 'button', html: U.icon('upload_file') + 'Upload a video file instead…' });
    let modal;
    up.addEventListener('click', () => {
      modal.close();
      B.actions.insertVideoFile();
    });
    modal = B.ui.modal({
      title: el ? 'Change Video' : 'Insert Online Video',
      body: h('div', { class: 'form' }, h('label', { class: 'field-label' }, 'YouTube address', inp), prev, h('p', { class: 'help' }, 'Videos play during the slide show when you are online.'), el ? null : up),
      width: 520,
      buttons: [
        { label: 'Cancel', value: null },
        {
          label: el ? 'Update' : 'Insert',
          primary: true,
          action: () => {
            if (!B.render.ytId(inp.value)) {
              B.ui.toast('That does not look like a YouTube link.');
              return false;
            }
            if (el) {
              el.kind = 'youtube';
              el.src = inp.value.trim();
              E().changed(true);
            } else E().insertElement(M.newElement('video', { kind: 'youtube', src: inp.value.trim(), w: 640, h: 360 }));
          },
        },
      ],
    });
  };

  /* ======================= insert table ======================= */
  D.insertTable = () => {
    const r = h('input', { type: 'number', class: 'field sm', min: 1, max: 40, value: 3 });
    const c = h('input', { type: 'number', class: 'field sm', min: 1, max: 20, value: 4 });
    B.ui.modal({
      title: 'Insert Table',
      body: h('div', { class: 'grid2' }, h('label', { class: 'field-label' }, 'Number of columns', c), h('label', { class: 'field-label' }, 'Number of rows', r)),
      width: 360,
      buttons: [
        { label: 'Cancel', value: null },
        { label: 'OK', primary: true, action: () => B.actions.insertTable(U.clamp(+r.value || 3, 1, 40), U.clamp(+c.value || 3, 1, 20)) },
      ],
    });
  };

  /* ======================= header & footer ======================= */
  D.headerFooter = () => {
    const num = h('input', { type: 'checkbox' });
    num.checked = !!A.deck.slideNumbers;
    const foot = h('input', { type: 'checkbox' });
    foot.checked = !!A.deck.footer;
    const text = h('input', { class: 'field', value: A.deck.footer || '', placeholder: 'e.g. Mr. Lee · Period 3 · Chemistry' });
    const title = h('input', { type: 'checkbox' });
    title.checked = A.deck.hideFooterOnTitle !== false;
    B.ui.modal({
      title: 'Header & Footer',
      body: h(
        'div',
        { class: 'form' },
        h('label', { class: 'pane-check' }, num, h('span', {}, 'Slide number')),
        h('label', { class: 'pane-check' }, foot, h('span', {}, 'Footer')),
        text,
        h('label', { class: 'pane-check' }, title, h('span', {}, "Don't show on title slide"))
      ),
      width: 440,
      buttons: [
        { label: 'Cancel', value: null },
        {
          label: 'Apply to All',
          primary: true,
          action: () => {
            A.deck.slideNumbers = num.checked;
            A.deck.footer = foot.checked ? text.value.trim() : '';
            A.deck.hideFooterOnTitle = title.checked;
            B.store.commit();
            B.emit('deck');
          },
        },
      ],
    });
  };

  /* ======================= find & replace ======================= */
  let findState = { q: '', pos: null };
  const textual = (el) => el.html != null || el.rows;
  const occurrences = (q, matchCase) => {
    const res = [];
    if (!q) return res;
    const norm = (s) => (matchCase ? s : s.toLowerCase());
    A.deck.slides.forEach((s, si) =>
      s.elements.forEach((el) => {
        if (!textual(el)) return;
        const t = el.rows ? el.rows.flat().map((c) => U.htmlToText(c)).join(' ') : U.htmlToText(el.html);
        let i = norm(t).indexOf(norm(q));
        while (i >= 0) {
          res.push({ si, id: el.id, i });
          i = norm(t).indexOf(norm(q), i + 1);
        }
      })
    );
    return res;
  };
  const replaceIn = (html, q, rep, matchCase, all) => {
    const d = document.createElement('div');
    d.innerHTML = html;
    const w = document.createTreeWalker(d, NodeFilter.SHOW_TEXT);
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), matchCase ? 'g' : 'gi');
    let n, count = 0;
    while ((n = w.nextNode())) {
      if (!all && count) break;
      n.textContent = n.textContent.replace(re, (m) => (all || !count ? (count++, rep) : m));
    }
    return { html: d.innerHTML, count };
  };
  D.find = (withReplace) => {
    if (A.editingId) E().endEdit();
    const q = h('input', { class: 'field', value: findState.q, placeholder: 'Find what' });
    const r = h('input', { class: 'field', placeholder: 'Replace with' });
    const mc = h('input', { type: 'checkbox' });
    const status = h('p', { class: 'help' });
    let idx = -1;
    const next = () => {
      findState.q = q.value;
      const occ = occurrences(q.value, mc.checked);
      if (!occ.length) {
        status.textContent = q.value ? 'No matches found.' : '';
        return;
      }
      idx = (idx + 1) % occ.length;
      const o = occ[idx];
      B.slides.go(o.si);
      E().select([o.id]);
      status.textContent = `Match ${idx + 1} of ${occ.length} (slide ${o.si + 1}).`;
    };
    const doReplace = (all) => {
      if (!q.value) return;
      let count = 0;
      const targets = all ? A.deck.slides.flatMap((s) => s.elements) : B.selectedEls();
      for (const el of targets) {
        if (!textual(el)) continue;
        if (el.rows) {
          el.rows = el.rows.map((row) => row.map((c) => {
            const x = replaceIn(c, q.value, r.value, mc.checked, all || !count);
            count += x.count;
            return x.html;
          }));
        } else {
          const x = replaceIn(el.html, q.value, r.value, mc.checked, all);
          count += x.count;
          el.html = x.html;
        }
        if (!all && count) break;
      }
      if (count) {
        B.store.commit();
        B.emit('deck');
      }
      status.textContent = all ? `Replaced ${count} occurrence${count === 1 ? '' : 's'}.` : count ? 'Replaced. ' : '';
      if (!all) next();
    };
    const btn = (label, fn, primary) => {
      const b = h('button', { class: 'btn' + (primary ? ' primary' : ''), type: 'button' }, label);
      b.addEventListener('click', fn);
      return b;
    };
    q.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        next();
      }
    });
    q.addEventListener('input', () => (idx = -1));
    const body = h(
      'div',
      { class: 'form' },
      q,
      withReplace ? r : null,
      h('label', { class: 'pane-check' }, mc, h('span', {}, 'Match case')),
      h('div', { class: 'btn-row' }, btn('Find Next', next, true), withReplace ? btn('Replace', () => doReplace(false)) : null, withReplace ? btn('Replace All', () => doReplace(true)) : null),
      status
    );
    B.ui.modal({ title: withReplace ? 'Replace' : 'Find', body, width: 420, cls: 'modeless' });
  };

  /* ======================= diagrams ======================= */
  D.DIAGRAMS = [
    { id: 'process', name: 'Process (steps)', icon: 'arrow_forward' },
    { id: 'cycle', name: 'Cycle', icon: 'autorenew' },
    { id: 'venn', name: 'Venn Diagram', icon: 'join_inner' },
    { id: 'timeline', name: 'Timeline', icon: 'timeline' },
    { id: 'hierarchy', name: 'Hierarchy', icon: 'account_tree' },
    { id: 'atom', name: 'Atom Model', icon: 'science' },
    { id: 'axes', name: 'Coordinate Axes', icon: 'stacked_line_chart' },
  ];
  D.insertDiagram = (id) => {
    const N = M.newElement;
    const W = A.deck.w, H = A.deck.h;
    const els = [];
    const txt = (t) => `<div><b>${t}</b></div>`;
    if (id === 'process') {
      const n = 4, w = 190, gap = -14, x0 = (W - (n * w + (n - 1) * gap)) / 2;
      for (let i = 0; i < n; i++) els.push(N('shape', { shape: i ? 'chevron' : 'homePlate', x: x0 + i * (w + gap), y: H / 2 - 50, w, h: 100, fill: `@accent${i + 1}`, stroke: 'none', html: txt('Step ' + (i + 1)), size: 18 }));
    } else if (id === 'cycle') {
      const cx = W / 2, cy = H / 2 + 20, R = 150, s = 120;
      const names = ['Evaporation', 'Condensation', 'Precipitation', 'Collection'];
      const centers = [[0, -R], [R * 1.6, 0], [0, R], [-R * 1.6, 0]].map(([dx, dy]) => ({ x: cx + dx, y: cy + dy }));
      names.forEach((t, i) => els.push(N('shape', { shape: 'ellipse', x: centers[i].x - s * 0.7, y: centers[i].y - s / 2, w: s * 1.4, h: s, fill: `@accent${i + 1}`, stroke: 'none', html: txt(t), size: 14 })));
      centers.forEach((c0, i) => {
        const c1 = centers[(i + 1) % 4];
        const at = (t) => ({ x: c0.x + (c1.x - c0.x) * t, y: c0.y + (c1.y - c0.y) * t });
        const ln = N('shape', { shape: 'arrowLine', fill: 'none', stroke: '@text', strokeWidth: 2.5 });
        E().setLine(ln, at(0.42), at(0.62));
        els.push(ln);
      });
    } else if (id === 'venn') {
      const r = 300;
      els.push(N('shape', { shape: 'ellipse', x: W / 2 - r + 50, y: H / 2 - r / 2, w: r, h: r, fill: '@accent1', stroke: 'none', opacity: 0.6, html: txt('Set A') + '<div><br></div>', align: 'left', pad: 40, size: 20 }));
      els.push(N('shape', { shape: 'ellipse', x: W / 2 - 50, y: H / 2 - r / 2, w: r, h: r, fill: '@accent2', stroke: 'none', opacity: 0.6, html: txt('Set B') + '<div><br></div>', align: 'right', pad: 40, size: 20 }));
      els.push(N('text', { x: W / 2 - 50, y: H / 2 - 16, w: 100, html: txt('Both'), align: 'center', size: 18 }));
    } else if (id === 'timeline') {
      const x0 = 80, x1 = W - 80, y = H / 2 + 20;
      const ln = N('shape', { shape: 'arrowLine', fill: 'none', stroke: '@text', strokeWidth: 3 });
      E().setLine(ln, { x: x0, y }, { x: x1, y });
      els.push(ln);
      const n = 5;
      for (let i = 0; i < n; i++) {
        const x = x0 + 40 + (i * (x1 - x0 - 120)) / (n - 1);
        els.push(N('shape', { shape: 'ellipse', x: x - 12, y: y - 12, w: 24, h: 24, fill: `@accent${i + 1}`, stroke: '@bg', strokeWidth: 2 }));
        els.push(N('text', { x: x - 80, y: i % 2 ? y + 22 : y - 92, w: 160, align: 'center', size: 16, html: `<div><b>${1900 + i * 25}</b></div><div>Event ${i + 1}</div>` }));
      }
    } else if (id === 'hierarchy') {
      const bw = 200, bh = 70;
      els.push(N('shape', { shape: 'roundRect', x: W / 2 - bw / 2, y: 120, w: bw, h: bh, fill: '@accent1', stroke: 'none', html: txt('Kingdom'), size: 18 }));
      ['Phylum A', 'Phylum B', 'Phylum C'].forEach((t, i) => {
        const x = W / 2 - 1.5 * bw - 40 + i * (bw + 40);
        els.push(N('shape', { shape: 'roundRect', x, y: 320, w: bw, h: bh, fill: `@accent${i + 2}`, stroke: 'none', html: txt(t), size: 18 }));
        const ln = N('shape', { shape: 'line', fill: 'none', stroke: '@text', strokeWidth: 2 });
        E().setLine(ln, { x: W / 2, y: 120 + bh }, { x: x + bw / 2, y: 320 });
        els.push(ln);
      });
    } else if (id === 'atom') {
      const cx = W / 2, cy = H / 2 + 20;
      [0, 60, 120].forEach((rot) => els.push(N('shape', { shape: 'ellipse', x: cx - 200, y: cy - 70, w: 400, h: 140, rot, fill: 'none', stroke: '@accent1', strokeWidth: 2.5 })));
      els.push(N('shape', { shape: 'ellipse', x: cx - 32, y: cy - 32, w: 64, h: 64, fill: '@accent2', stroke: 'none', html: '<div><b>+</b></div>', size: 24 }));
      [0, 60, 120].forEach((rot, i) => {
        const a = ((rot + (i % 2 ? 180 : 0)) * Math.PI) / 180;
        els.push(N('shape', { shape: 'ellipse', x: cx + 200 * Math.cos(a) - 11, y: cy + 200 * Math.sin(a) - 11, w: 22, h: 22, fill: '@accent3', stroke: 'none' }));
      });
    } else if (id === 'axes') {
      const ox = W / 2, oy = H / 2 + 20, L = 220;
      const xa = N('shape', { shape: 'doubleArrowLine', fill: 'none', stroke: '@text', strokeWidth: 2 });
      E().setLine(xa, { x: ox - L * 1.4, y: oy }, { x: ox + L * 1.4, y: oy });
      const ya = N('shape', { shape: 'doubleArrowLine', fill: 'none', stroke: '@text', strokeWidth: 2 });
      E().setLine(ya, { x: ox, y: oy + L * 0.9 }, { x: ox, y: oy - L * 0.9 });
      els.push(xa, ya);
      els.push(N('text', { x: ox + L * 1.4 + 4, y: oy - 18, w: 40, html: '<div><i>x</i></div>', size: 20 }));
      els.push(N('text', { x: ox + 8, y: oy - L * 0.9 - 30, w: 40, html: '<div><i>y</i></div>', size: 20 }));
      els.push(N('text', { x: ox - 36, y: oy + 2, w: 36, html: '<div>0</div>', size: 16, align: 'right' }));
    }
    if (!els.length) return;
    const gid = els.length > 1 ? U.uid() : null;
    els.forEach((e) => {
      if (gid) e.groupId = gid;
      e.x = Math.round(e.x);
      e.y = Math.round(e.y);
    });
    if (A.editingId) E().endEdit(true);
    B.curSlide().elements.push(...els);
    E().render();
    E().select(els.map((e) => e.id));
    E().changed();
  };

  /* ======================= accessibility ======================= */
  D.a11yIssues = () => {
    const out = [];
    if (!A.deck) return out;
    A.deck.slides.forEach((s, i) => {
      const t = s.elements.find((e) => e.placeholder === 'title');
      if (!t || U.isHtmlEmpty(t.html)) out.push({ si: i, msg: 'Missing slide title', tip: 'Give every slide a unique title so screen-reader users can navigate.' });
      s.elements.forEach((e) => {
        if (e.type === 'image' && !e.alt) out.push({ si: i, id: e.id, msg: 'Missing alt text (picture)', tip: 'Right-click the picture and choose Edit Alt Text.' });
        if (e.type === 'chart' && !e.alt) out.push({ si: i, id: e.id, msg: 'Missing alt text (chart)', tip: 'Describe the trend the chart shows in the Alt Text.' });
      });
    });
    return out;
  };
  D.accessibility = () => {
    const issues = D.a11yIssues();
    const list = h('div', { class: 'a11y-list' });
    if (!issues.length) list.appendChild(h('p', { class: 'a11y-ok', html: U.icon('check_circle') + ' No accessibility issues found. Nice work!' }));
    let m;
    issues.forEach((it) => {
      const b = h('button', { class: 'a11y-row', type: 'button' }, h('b', {}, `Slide ${it.si + 1}: ${it.msg}`), h('small', {}, it.tip));
      b.addEventListener('click', () => {
        m.close();
        B.actions.setView('normal');
        B.slides.go(it.si);
        if (it.id) {
          E().select([it.id]);
          B.actions.altText();
        }
      });
      list.appendChild(b);
    });
    m = B.ui.modal({ title: 'Accessibility Checker', body: list, width: 520, buttons: [{ label: 'Close', primary: true, value: null }] });
  };

  /* ======================= keyboard shortcuts ======================= */
  D.shortcuts = () => {
    const mod = U.isMac ? '⌘' : 'Ctrl';
    const rows = [
      ['Editing', ''], [`${mod}+Z / ${mod}+Y`, 'Undo / Redo'], [`${mod}+X / C / V`, 'Cut / Copy / Paste'], [`${mod}+D`, 'Duplicate'], ['Delete', 'Delete selection'],
      [`${mod}+A`, 'Select all'], [`${mod}+G / ${mod}+Shift+G`, 'Group / Ungroup'], ['Arrow keys', 'Nudge (hold Alt/Option for 1px)'], ['Tab', 'Select next object'],
      ['Enter / F2', 'Edit text of selected object'], ['Esc', 'Stop editing / clear selection'], ['Shift + drag', 'Keep proportions / straight lines'], [`${mod} + drag`, 'Duplicate while moving'], ['Alt + drag', 'Move without snapping'],
      ['Text', ''], [`${mod}+B / I / U`, 'Bold / Italic / Underline'], [`${mod}+Shift+> / <`, 'Bigger / smaller text'], [`${mod}+=`, 'Subscript'], [`${mod}+Shift+=`, 'Superscript'], [`${mod}+E / L / R / J`, 'Center / Left / Right / Justify'], [`${mod}+K`, 'Insert link'],
      ['Slides', ''], [`${mod}+M`, 'New slide'], [`${mod}+S`, 'Save'], [`${mod}+F / ${mod}+H`, 'Find / Replace'], [`${mod}+P`, 'Print / PDF'],
      ['Slide Show', ''], ['F5 / Shift+F5', 'From beginning / from current slide'], ['→ Space Enter', 'Next'], ['← Backspace', 'Previous'], ['Number + Enter', 'Go to slide'], ['B / W', 'Black / white screen'], [`${mod}+P / ${mod}+L / E`, 'Pen / Laser / Erase ink'], ['G', 'All slides'], ['Esc', 'End show'],
    ];
    const t = h('table', { class: 'shortcut-table' });
    for (const [a, b] of rows) t.appendChild(b ? h('tr', {}, h('td', {}, h('kbd', {}, a)), h('td', {}, b)) : h('tr', { class: 'sc-head' }, h('td', { colspan: 2 }, a)));
    B.ui.modal({ title: 'Keyboard Shortcuts', body: t, width: 560, buttons: [{ label: 'Close', primary: true, value: null }] });
  };
})(window.BSD);
