/* BSD STEM Slides — renders slides and elements to DOM (editor, thumbnails, show and print) */
(function (B) {
  'use strict';
  const U = B.util;
  const R = (B.render = {});
  const A = B.app;

  const VALIGN = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };
  const PT = 4 / 3; // px per pt

  R.ytId = (url) => {
    const m = String(url || '').match(/(?:youtu\.be\/|[?&]v=|embed\/|shorts\/|live\/)([\w-]{11})/);
    return m ? m[1] : null;
  };

  R.contrast = (hex) => (U.luminance(hex || '#ffffff') > 0.45 ? '#1F1F1F' : '#FFFFFF');

  R.backgroundCss = (slide, deck, theme) => {
    const bg = slide && slide.background;
    if (!bg) return theme.bg;
    if (bg.type === 'solid') return B.resolveColor(bg.color, theme) || theme.bgColor;
    if (bg.type === 'gradient')
      return `linear-gradient(${bg.angle == null ? 135 : bg.angle}deg, ${B.resolveColor(bg.from, theme)}, ${B.resolveColor(bg.to, theme)})`;
    if (bg.type === 'image') {
      const src = A.assets[bg.asset] || bg.src || '';
      return `center / cover no-repeat url("${src}"), ${theme.bgColor}`;
    }
    return theme.bg;
  };

  /** Solid colour that best represents the background (for contrast decisions and PPTX). */
  R.backgroundColor = (slide, theme) => {
    const bg = slide && slide.background;
    if (bg && bg.type === 'solid') return B.resolveColor(bg.color, theme);
    if (bg && bg.type === 'gradient') return U.mix(B.resolveColor(bg.from, theme), B.resolveColor(bg.to, theme), 0.5);
    return theme.bgColor;
  };

  /** Theme adjusted so chart text stays readable on this slide's real background. */
  R.chartTheme = (slide, theme) => {
    const bg = R.backgroundColor(slide, theme) || theme.bgColor;
    const ok = Math.abs(U.luminance(bg) - U.luminance(theme.text)) > 0.35;
    return Object.assign({}, theme, { bgColor: bg, text: ok ? theme.text : R.contrast(bg) });
  };

  R.defaultTextColor = (el, theme) => {
    if (el.type === 'shape') {
      const f = B.resolveColor(el.fill, theme);
      if (f && f !== 'none') return R.contrast(f);
    }
    return el.placeholder === 'title' ? theme.title : theme.text;
  };

  R.slide = (slide, opts = {}) => {
    const deck = opts.deck || A.deck;
    const theme = B.themeById(deck.theme);
    const mode = opts.mode || 'thumb';
    const ctx = { deck, theme, mode, slide, index: opts.index };
    const s = U.h('div', { class: 'slide mode-' + mode });
    s.style.width = deck.w + 'px';
    s.style.height = deck.h + 'px';
    s.style.background = R.backgroundCss(slide, deck, theme);
    s.style.fontFamily = B.fontStack(theme.body);
    s.style.color = theme.text;

    for (const d of B.decorFor(slide, theme, deck)) {
      s.appendChild(
        U.h('div', {
          class: 'decor',
          style: { left: d.x * deck.w + 'px', top: d.y * deck.h + 'px', width: d.w * deck.w + 'px', height: d.h * deck.h + 'px', background: B.resolveColor(d.color, theme) },
        })
      );
    }
    for (const el of slide.elements) {
      try {
        s.appendChild(R.element(el, ctx));
      } catch (err) {
        console.error('Failed to render element', el, err);
      }
    }
    const num = opts.index != null ? opts.index + 1 : deck.slides.indexOf(slide) + 1;
    const onTitle = slide.layout === 'title' && deck.hideFooterOnTitle;
    if (!onTitle && (deck.slideNumbers || deck.footer)) {
      const fcol = U.mix(R.contrast(R.backgroundColor(slide, theme)), R.backgroundColor(slide, theme), 0.25);
      if (deck.footer) s.appendChild(U.h('div', { class: 'slide-footer', style: { color: fcol } }, deck.footer));
      if (deck.slideNumbers) s.appendChild(U.h('div', { class: 'slide-num', style: { color: fcol } }, String(num)));
    }
    return s;
  };

  R.element = (el, ctx) => {
    const theme = ctx.theme;
    const n = U.h('div', { class: 'el el-' + el.type, 'data-id': el.id });
    const st = n.style;
    st.left = el.x + 'px';
    st.top = el.y + 'px';
    st.width = Math.max(el.w, 0) + 'px';
    st.height = Math.max(el.h, 0) + 'px';
    if (el.rot) st.transform = `rotate(${el.rot}deg)`;
    if (el.opacity != null && el.opacity < 1) st.opacity = el.opacity;
    if (el.shadow) n.classList.add('has-shadow');
    if (ctx.mode === 'edit' && el.placeholder && U.isHtmlEmpty(el.html)) n.classList.add('ph-empty');
    if (el.link && ctx.mode === 'show') {
      n.classList.add('has-link');
      n.dataset.link = el.link;
    }

    switch (el.type) {
      case 'shape':
        n.innerHTML = R.shapeSvg(el, theme);
        if (!B.shapeById(el.shape).line) n.appendChild(R.textBlock(el, ctx));
        break;
      case 'text': {
        const fill = B.resolveColor(el.fill, theme);
        if (fill && fill !== 'none') st.background = fill;
        const stroke = B.resolveColor(el.stroke, theme);
        if (stroke && stroke !== 'none') st.boxShadow = `inset 0 0 0 ${(el.strokeWidth || 1) * PT}px ${stroke}`;
        n.appendChild(R.textBlock(el, ctx));
        break;
      }
      case 'image':
        R.image(n, el, theme);
        break;
      case 'table':
        n.appendChild(R.table(el, ctx));
        break;
      case 'chart':
        n.innerHTML = B.chartSvg(el.chart, Math.max(el.w, 20), Math.max(el.h, 20), R.chartTheme(ctx.slide, theme));
        break;
      case 'equation': {
        const eq = U.h('div', { class: 'el-eq' });
        eq.style.fontSize = (el.size || 32) + 'pt';
        eq.style.color = B.resolveColor(el.color, theme) || theme.text;
        eq.style.justifyContent = { left: 'flex-start', right: 'flex-end' }[el.align] || 'center';
        R.renderLatex(eq, el.latex);
        n.appendChild(eq);
        break;
      }
      case 'video':
        R.video(n, el, ctx);
        break;
      case 'audio':
        B.media.render(n, el, ctx);
        break;
    }
    return n;
  };

  R.renderLatex = (node, latex) => {
    if (window.katex) {
      try {
        node.innerHTML = window.katex.renderToString(latex || '\\square', { throwOnError: false, displayMode: true, output: 'html', trust: false, strict: 'ignore' });
        return;
      } catch (e) {
        /* fall through */
      }
    }
    node.textContent = latex;
    node.classList.add('raw');
  };

  R.textBlock = (el, ctx) => {
    const theme = ctx.theme;
    const tb = U.h('div', { class: 'el-text' });
    tb.style.justifyContent = VALIGN[el.valign] || 'flex-start';
    if (el.pad != null) tb.style.padding = el.pad + 'px';
    const inner = U.h('div', { class: 'el-text-inner' });
    // empty placeholders only show their prompt while editing; elsewhere they are invisible
    inner.innerHTML = el.placeholder && ctx.mode !== 'edit' && U.isHtmlEmpty(el.html) ? '' : el.html || '';
    const is = inner.style;
    is.fontFamily = B.fontStack(el.font || (el.placeholder === 'title' ? theme.heading : theme.body));
    is.fontSize = (el.size || 18) + 'pt';
    is.color = B.resolveColor(el.color, theme) || R.defaultTextColor(el, theme);
    is.textAlign = el.align || 'left';
    is.lineHeight = el.lineHeight || 1.2;
    if (el.bold) is.fontWeight = 'bold';
    if (el.italic) is.fontStyle = 'italic';
    if (el.columns > 1) is.columnCount = el.columns;
    if (ctx.mode === 'edit' && el.placeholder && U.isHtmlEmpty(el.html)) {
      inner.classList.add('show-hint');
      if (/<(ul|ol)/i.test(el.html || '')) inner.classList.add('has-list');
      inner.dataset.hint = B.placeholderHint(el);
    }
    tb.appendChild(inner);
    return tb;
  };

  R.dash = (style, sw) =>
    style === 'dash' ? `${sw * 4} ${sw * 3}` : style === 'dot' ? `${sw * 0.01} ${sw * 2}` : style === 'dashdot' ? `${sw * 4} ${sw * 2} ${sw * 0.01} ${sw * 2}` : '';

  R.shapeSvg = (el, theme) => {
    const def = B.shapeById(el.shape);
    const w = Math.max(el.w, 0), h = Math.max(el.h, 0);
    const fill = B.resolveColor(el.fill, theme) || 'none';
    const stroke = B.resolveColor(el.stroke, theme) || 'none';
    const sw = stroke === 'none' ? 0 : (el.strokeWidth == null ? 1 : el.strokeWidth) * PT;
    const dash = R.dash(el.dash, sw);
    const cap = el.dash === 'dot' ? 'round' : 'butt';
    const strokeAttrs = `stroke="${stroke}" stroke-width="${sw}" ${dash ? `stroke-dasharray="${dash}"` : ''} stroke-linecap="${cap}"`;
    let body = '';
    if (def.line) {
      const ax = el.flipH ? w : 0, ay = el.flipV ? h : 0, bx = el.flipH ? 0 : w, by = el.flipV ? 0 : h;
      const len = Math.hypot(bx - ax, by - ay) || 1;
      const ux = (bx - ax) / len, uy = (by - ay) / len;
      const hl = Math.max(8, sw * 3.2), hw = hl * 0.55;
      const head = (px, py, dx, dy) =>
        `<path d="M${px} ${py} L${px - dx * hl - dy * hw} ${py - dy * hl + dx * hw} L${px - dx * hl + dy * hw} ${py - dy * hl - dx * hw} Z" fill="${stroke}"/>`;
      let x1 = ax, y1 = ay, x2 = bx, y2 = by, heads = '';
      if (def.head && len > hl) {
        x2 -= ux * hl * 0.8;
        y2 -= uy * hl * 0.8;
        heads += head(bx, by, ux, uy);
      }
      if (def.tail && len > hl * 2) {
        x1 += ux * hl * 0.8;
        y1 += uy * hl * 0.8;
        heads += head(ax, ay, -ux, -uy);
      }
      body = `<path d="M${x1} ${y1} L${x2} ${y2}" fill="none" ${strokeAttrs}/>${heads}<path class="hit" d="M${ax} ${ay} L${bx} ${by}" stroke="transparent" stroke-width="${Math.max(12, sw + 8)}" fill="none"/>`;
    } else {
      const p = B.shapePath(el.shape, w, h);
      body = `<path d="${p.d}" fill="${fill}" ${strokeAttrs} stroke-linejoin="round"/>`;
      if (p.shade) body += `<path d="${p.shade}" fill="#000" fill-opacity=".18"/>`;
      if (p.top) body += `<path d="${p.top}" fill="#fff" fill-opacity=".18"/>`;
      if (p.extra) body += `<path d="${p.extra}" fill="none" ${strokeAttrs}/>`;
      const flip = el.flipH || el.flipV;
      if (flip) body = `<g transform="translate(${el.flipH ? w : 0} ${el.flipV ? h : 0}) scale(${el.flipH ? -1 : 1} ${el.flipV ? -1 : 1})">${body}</g>`;
    }
    return `<svg class="el-svg" width="${w}" height="${h}" viewBox="0 0 ${w || 1} ${h || 1}" overflow="visible">${body}</svg>`;
  };

  R.image = (n, el, theme) => {
    const src = A.assets[el.asset] || el.src || '';
    const box = U.h('div', { class: 'img-box' });
    const img = U.h('img', { src, alt: el.alt || '', draggable: 'false' });
    const t = [];
    if (el.flipH) t.push('scaleX(-1)');
    if (el.flipV) t.push('scaleY(-1)');
    if (t.length) img.style.transform = t.join(' ');
    const filters = { grayscale: 'grayscale(1)', sepia: 'sepia(.85)', bright: 'brightness(1.25) contrast(1.05)', dark: 'brightness(.7)', contrast: 'contrast(1.4)', blur: 'blur(3px)', invert: 'invert(1)' };
    if (filters[el.filter]) img.style.filter = filters[el.filter];
    if (el.crop) {
      // crop is stored as fractions {l,t,r,b} removed from each edge
      const c = el.crop, cw = 1 - c.l - c.r, ch = 1 - c.t - c.b;
      img.style.position = 'absolute';
      img.style.width = 100 / cw + '%';
      img.style.height = 100 / ch + '%';
      img.style.left = (-c.l / cw) * 100 + '%';
      img.style.top = (-c.t / ch) * 100 + '%';
    }
    const radius = el.mask === 'circle' ? '50%' : el.mask === 'rounded' ? Math.min(el.w, el.h) * 0.12 + 'px' : '';
    box.style.borderRadius = radius;
    box.appendChild(img);
    n.appendChild(box);
    const stroke = B.resolveColor(el.stroke, theme);
    if (stroke && stroke !== 'none') {
      n.appendChild(U.h('div', { class: 'img-border', style: { borderRadius: radius, boxShadow: `inset 0 0 0 ${(el.strokeWidth || 3) * PT}px ${stroke}` } }));
    }
  };

  R.tableColors = (el, theme) => {
    const accent = B.resolveColor(el.accent || '@accent1', theme);
    return {
      head: accent,
      headText: R.contrast(accent),
      band1: U.mix(accent, '#FFFFFF', 0.72),
      band2: U.mix(accent, '#FFFFFF', 0.86),
      line: '#FFFFFF',
    };
  };

  R.table = (el, ctx) => {
    const theme = ctx.theme;
    const col = R.tableColors(el, theme);
    const t = U.h('table', { class: 'el-table' });
    t.style.fontFamily = B.fontStack(el.font || theme.body);
    t.style.fontSize = (el.size || 16) + 'pt';
    const ncol = Math.max(...el.rows.map((r) => r.length));
    const cg = U.h('colgroup');
    for (let c = 0; c < ncol; c++) cg.appendChild(U.h('col', { style: { width: ((el.colW && el.colW[c]) || 1 / ncol) * 100 + '%' } }));
    t.appendChild(cg);
    el.rows.forEach((row, r) => {
      const tr = U.h('tr');
      const isHead = el.header && r === 0;
      const bodyIdx = el.header ? r - 1 : r;
      const bg = isHead ? col.head : el.banded ? (bodyIdx % 2 === 0 ? col.band1 : col.band2) : col.band2;
      for (let c = 0; c < ncol; c++) {
        const td = U.h('td', { 'data-r': r, 'data-c': c });
        td.style.background = bg;
        td.style.borderColor = col.line;
        td.style.color = isHead ? col.headText : R.contrast(bg);
        if (isHead) td.style.fontWeight = 'bold';
        const cell = U.h('div', { class: 'cell' });
        cell.innerHTML = row[c] || '';
        td.appendChild(cell);
        tr.appendChild(td);
      }
      t.appendChild(tr);
    });
    return t;
  };

  R.video = (n, el, ctx) => {
    const yt = el.kind === 'youtube' ? R.ytId(el.src) : null;
    const src = el.kind === 'file' ? A.assets[el.asset] || '' : el.src;
    if (ctx.mode === 'show') {
      if (yt) {
        n.appendChild(U.h('iframe', { src: `https://www.youtube-nocookie.com/embed/${yt}?rel=0`, allow: 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen', allowfullscreen: true, frameborder: '0' }));
      } else if (src) {
        n.appendChild(U.h('video', { src, controls: true, preload: 'metadata' }));
      }
      return;
    }
    const box = U.h('div', { class: 'video-ph' });
    if (yt) box.style.backgroundImage = `url("https://i.ytimg.com/vi/${yt}/hqdefault.jpg")`;
    else if (src && el.kind === 'file') box.appendChild(U.h('video', { src, preload: 'metadata', muted: true }));
    box.appendChild(U.h('div', { class: 'video-play', html: U.icon('play_arrow') }));
    n.appendChild(box);
  };

  /** Render a slide into `host` scaled to `width` px (used for thumbnails, galleries, previews). */
  R.thumb = (slide, width, opts = {}) => {
    const deck = opts.deck || A.deck;
    const k = width / deck.w;
    const box = U.h('div', { class: 'thumb-box', style: { width: width + 'px', height: deck.h * k + 'px' } });
    const s = R.slide(slide, Object.assign({ mode: 'thumb' }, opts));
    s.style.transform = `scale(${k})`;
    s.style.transformOrigin = '0 0';
    box.appendChild(s);
    return box;
  };
})(window.BSD);
