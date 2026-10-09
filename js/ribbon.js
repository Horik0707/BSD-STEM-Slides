/* BSD STEM Slides — the ribbon: tabs, groups and controls */
(function (B) {
  'use strict';
  const U = B.util, A = B.app, M = B.model;
  const h = U.h;
  const RB = (B.ribbon = {});
  const E = () => B.editor;
  const AC = () => B.actions;
  let updaters = [];
  let activeTab = U.storage.get('tab', 'home');
  let collapsed = U.storage.get('ribbonCollapsed', false);
  let lastCtx = '';
  const k = (s) => (U.isMac ? s.replace(/Ctrl\+/g, '⌘').replace(/Shift\+/g, '⇧').replace(/Alt\+/g, '⌥') : s);

  const noSteal = (n) => n.addEventListener('mousedown', (e) => e.preventDefault());
  const sel = () => B.selectedEls();
  const has = (fn) => () => sel().some(fn);
  const isShapeLike = (e) => e.type === 'shape' || e.type === 'text';
  const anySel = () => sel().length > 0;

  /* ---------------- control builders ---------------- */
  const tip = (title, shortcut) => (title ? title + (shortcut ? ` (${k(shortcut)})` : '') : null);

  function bigBtn(o) {
    const b = h('button', { class: 'rb-big', type: 'button', title: tip(o.title || o.label, o.shortcut), 'aria-label': o.label });
    const ico = h('span', { class: 'rb-big-icon', html: o.iconHtml || U.icon(o.icon) });
    const lab = h('span', { class: 'rb-big-label' }, o.label, o.menu ? h('span', { class: 'caret', html: U.icon('expand_more') }) : null);
    b.append(ico, lab);
    noSteal(b);
    if (o.menu && o.action) {
      b.classList.add('split');
      ico.addEventListener('click', (e) => {
        e.stopPropagation();
        o.action(b);
      });
      lab.addEventListener('click', (e) => {
        e.stopPropagation();
        openMenu(o.menu, b);
      });
    } else
      b.addEventListener('click', () => {
        if (o.menu) openMenu(o.menu, b);
        else o.action(b);
      });
    reg(b, o);
    return b;
  }

  function smallBtn(o) {
    const b = h('button', { class: 'rb-btn' + (o.label && !o.iconOnly ? ' labeled' : ''), type: 'button', title: tip(o.title || o.label, o.shortcut), 'aria-label': o.title || o.label });
    b.innerHTML = (o.iconHtml || (o.icon ? U.icon(o.icon) : '')) + (o.label && !o.iconOnly ? `<span class="rb-btn-label">${U.esc(o.label)}</span>` : '') + (o.menu ? `<span class="caret">${U.icon('expand_more')}</span>` : '');
    noSteal(b);
    b.addEventListener('click', () => (o.menu ? openMenu(o.menu, b) : o.action(b)));
    reg(b, o);
    return b;
  }

  function reg(b, o) {
    if (o.active || o.enabled) {
      updaters.push(() => {
        if (o.active) {
          const on = !!o.active();
          b.classList.toggle('on', on);
          b.setAttribute('aria-pressed', on);
        }
        if (o.enabled) b.disabled = !o.enabled();
      });
    }
  }

  function openMenu(menu, anchor) {
    const items = typeof menu === 'function' ? menu() : menu;
    if (items instanceof Node) return B.ui.popup(anchor, items);
    B.ui.menu(items, 0, 0, { anchor });
  }

  function select(o) {
    const s = h('select', { class: 'rb-select', title: o.title, 'aria-label': o.title, style: { width: (o.width || 120) + 'px' } });
    const fill = () => {
      s.innerHTML = '';
      for (const opt of typeof o.options === 'function' ? o.options() : o.options) {
        const op = h('option', { value: opt.value }, opt.label);
        if (opt.font) op.style.fontFamily = B.fontStack(opt.font);
        s.appendChild(op);
      }
    };
    fill();
    s.addEventListener('change', () => o.onChange(s.value));
    updaters.push(() => {
      if (document.activeElement === s) return;
      const v = o.value();
      if (v != null && !Array.from(s.options).some((op) => op.value === String(v))) s.appendChild(h('option', { value: v }, String(v)));
      s.value = v == null ? '' : String(v);
      if (o.enabled) s.disabled = !o.enabled();
    });
    return s;
  }

  function combo(o) {
    const id = 'dl_' + U.uid();
    const inp = h('input', { class: 'rb-combo', list: id, title: o.title, 'aria-label': o.title, style: { width: (o.width || 52) + 'px' } });
    const dl = h('datalist', { id }, ...o.values.map((v) => h('option', { value: v })));
    const apply = () => {
      const v = parseFloat(inp.value);
      if (!isNaN(v) && v > 0) o.onChange(Math.min(400, v));
    };
    inp.addEventListener('change', apply);
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        apply();
        if (A.editingId) E().restoreRange();
        else inp.blur();
      }
    });
    updaters.push(() => {
      if (document.activeElement === inp) return;
      const v = o.value();
      inp.value = v == null ? '' : v;
      if (o.enabled) inp.disabled = !o.enabled();
    });
    return h('span', { class: 'rb-combo-wrap' }, inp, dl);
  }

  function colorBtn(o) {
    let last = o.default;
    const wrap = h('span', { class: 'rb-color' + (o.label ? ' labeled' : '') });
    const main = h('button', { class: 'rb-btn rb-color-main', type: 'button', title: o.title, 'aria-label': o.title });
    const bar = h('span', { class: 'color-bar' });
    main.innerHTML = U.icon(o.icon) + (o.label ? `<span class="rb-btn-label">${U.esc(o.label)}</span>` : '');
    main.appendChild(bar);
    const drop = h('button', { class: 'rb-btn rb-color-drop', type: 'button', title: o.title + ' options', 'aria-label': o.title + ' options', html: U.icon('expand_more') });
    noSteal(main);
    noSteal(drop);
    const paint = () => {
      const c = B.resolveColor(last, B.theme());
      bar.style.background = !c || c === 'none' ? 'transparent' : c;
      bar.classList.toggle('none', !c || c === 'none');
    };
    main.addEventListener('click', () => (last === undefined ? drop.click() : o.onPick(last)));
    drop.addEventListener('click', () =>
      B.ui.colorPicker(wrap, {
        value: o.value ? o.value() : last,
        allowNone: o.allowNone,
        noneLabel: o.noneLabel,
        allowAuto: o.allowAuto,
        onPick: (c) => {
          last = c;
          paint();
          o.onPick(c);
        },
      })
    );
    wrap.append(main, drop);
    updaters.push(() => {
      paint();
      if (o.enabled) main.disabled = drop.disabled = !o.enabled();
    });
    return wrap;
  }

  function check(o) {
    const inp = h('input', { type: 'checkbox' });
    inp.addEventListener('change', () => o.onChange(inp.checked));
    updaters.push(() => {
      inp.checked = !!o.value();
      if (o.enabled) inp.disabled = !o.enabled();
    });
    return h('label', { class: 'rb-check', title: o.title || o.label }, inp, h('span', {}, o.label));
  }

  function number(o) {
    const inp = h('input', { type: 'number', class: 'rb-num', step: o.step || 1, min: o.min, max: o.max, 'aria-label': o.label, style: { width: (o.width || 64) + 'px' } });
    inp.addEventListener('change', () => {
      const v = parseFloat(inp.value);
      if (!isNaN(v)) o.onChange(v);
    });
    inp.addEventListener('keydown', (e) => e.key === 'Enter' && inp.blur());
    updaters.push(() => {
      if (document.activeElement === inp) return;
      const v = o.value();
      inp.value = v == null || v === '' ? '' : +(+v).toFixed(o.decimals == null ? 2 : o.decimals);
      inp.disabled = o.enabled ? !o.enabled() : false;
    });
    return h('label', { class: 'rb-numfield', title: o.title || o.label }, o.icon ? h('span', { html: U.icon(o.icon) }) : null, h('span', { class: 'rb-num-label' }, o.label), inp, o.suffix ? h('span', { class: 'rb-num-suffix' }, o.suffix) : null);
  }

  function gallery(o) {
    const g = h('div', { class: 'rb-gallery ' + (o.cls || '') });
    const list = h('div', { class: 'rb-gallery-list' });
    const fill = () => {
      list.innerHTML = '';
      for (const it of o.items()) {
        const b = h('button', { class: 'rb-gal-item' + (it.cls ? ' ' + it.cls : ''), type: 'button', title: it.title, 'aria-label': it.title, 'data-id': it.id });
        if (it.node) b.appendChild(it.node);
        else b.innerHTML = it.html;
        noSteal(b);
        b.addEventListener('click', () => o.onPick(it.id, b));
        list.appendChild(b);
      }
    };
    fill();
    g.appendChild(list);
    if (o.more) {
      const more = h('button', { class: 'rb-gal-more', type: 'button', title: 'More', 'aria-label': 'More', html: U.icon('expand_more') });
      noSteal(more);
      more.addEventListener('click', () => o.more(g));
      g.appendChild(more);
    }
    updaters.push(() => {
      if (o.refill) fill();
      const act = o.active ? o.active() : null;
      U.$$('.rb-gal-item', list).forEach((b) => b.classList.toggle('on', b.dataset.id === String(act)));
    });
    return g;
  }

  const row = (...c) => h('div', { class: 'rb-row' }, ...c);
  const col = (...c) => h('div', { class: 'rb-col' }, ...c);
  const sep = () => h('div', { class: 'rb-vsep' });
  function group(label, children, launcher) {
    const g = h('div', { class: 'rb-group' }, h('div', { class: 'rb-group-body' }, ...children), h('div', { class: 'rb-group-label' }, label));
    if (launcher) {
      const l = h('button', { class: 'rb-launcher', type: 'button', title: launcher.title, 'aria-label': launcher.title, html: U.icon('open_in_new') });
      noSteal(l);
      l.addEventListener('click', launcher.action);
      g.querySelector('.rb-group-label').appendChild(l);
    }
    return g;
  }

  /* ---------------- shared menus ---------------- */
  RB.shapesPanel = (onPick) => {
    const p = h('div', { class: 'shapes-panel' });
    const groups = {};
    B.SHAPES.forEach((s) => (groups[s.group] = groups[s.group] || []).push(s));
    for (const [g, list] of Object.entries(groups)) {
      p.appendChild(h('div', { class: 'cp-label' }, g));
      const grid = h('div', { class: 'shape-grid' });
      list.forEach((s) => {
        const b = h('button', { class: 'shape-btn', type: 'button', title: s.name, 'aria-label': s.name, html: B.shapeIcon(s.id) });
        b.addEventListener('click', () => {
          B.ui.closeMenus();
          onPick(s.id);
        });
        grid.appendChild(b);
      });
      p.appendChild(grid);
    }
    return p;
  };

  const arrangeMenu = () => [
    { header: 'Order Objects' },
    { label: 'Bring to Front', icon: 'flip_to_front', shortcut: k('Ctrl+Shift+]'), action: () => E().order('front') },
    { label: 'Send to Back', icon: 'flip_to_back', shortcut: k('Ctrl+Shift+['), action: () => E().order('back') },
    { label: 'Bring Forward', icon: 'arrow_upward', shortcut: k('Ctrl+]'), action: () => E().order('forward') },
    { label: 'Send Backward', icon: 'arrow_downward', shortcut: k('Ctrl+['), action: () => E().order('backward') },
    { header: 'Group Objects' },
    { label: 'Group', icon: 'group_work', shortcut: k('Ctrl+G'), action: () => E().group(), disabled: sel().length < 2 },
    { label: 'Ungroup', icon: 'workspaces', shortcut: k('Ctrl+Shift+G'), action: () => E().ungroup(), disabled: !sel().some((e) => e.groupId) },
    { header: 'Position Objects' },
    { label: 'Align', icon: 'align_horizontal_center', sub: alignMenu() },
    { label: 'Rotate', icon: 'rotate_right', sub: rotateMenu() },
    { sep: true },
    { label: sel().every((e) => e.locked) && sel().length ? 'Unlock' : 'Lock', icon: 'lock', action: () => AC().toggleLock(), disabled: !sel().length },
    { label: 'Selection & Format Pane', icon: 'tune', action: () => B.ui.openSidePane('format') },
  ];
  const alignMenu = () => [
    { label: 'Align Left', icon: 'align_horizontal_left', action: () => E().alignTo('left') },
    { label: 'Align Center', icon: 'align_horizontal_center', action: () => E().alignTo('center') },
    { label: 'Align Right', icon: 'align_horizontal_right', action: () => E().alignTo('right') },
    { label: 'Align Top', icon: 'align_vertical_top', action: () => E().alignTo('top') },
    { label: 'Align Middle', icon: 'align_vertical_center', action: () => E().alignTo('middle') },
    { label: 'Align Bottom', icon: 'align_vertical_bottom', action: () => E().alignTo('bottom') },
    { sep: true },
    { label: 'Distribute Horizontally', icon: 'horizontal_distribute', action: () => E().alignTo('dist-h'), disabled: sel().length < 3 },
    { label: 'Distribute Vertically', icon: 'vertical_distribute', action: () => E().alignTo('dist-v'), disabled: sel().length < 3 },
    { sep: true },
    { label: sel().length > 1 ? 'Aligns to the selected objects' : 'Aligns to the slide', disabled: true },
  ];
  const rotateMenu = () => [
    { label: 'Rotate Right 90°', icon: 'rotate_right', action: () => E().rotateBy(90) },
    { label: 'Rotate Left 90°', icon: 'rotate_left', action: () => E().rotateBy(-90) },
    { label: 'Flip Vertical', icon: 'flip', action: () => E().flip('v') },
    { label: 'Flip Horizontal', icon: 'flip', action: () => E().flip('h') },
  ];
  const lineSpacingMenu = () =>
    [1.0, 1.2, 1.5, 2.0, 2.5, 3.0].map((v) => ({
      label: v === 1.2 ? '1.0 (Single)' : (v / 1.2).toFixed(2).replace(/0$/, ''),
      checked: sel().length && (sel()[0].lineHeight || 1.2) === v,
      action: () => E().setProp('lineHeight', v, M.isTextual),
    }));
  const weightMenu = () =>
    [0.25, 0.5, 0.75, 1, 1.5, 2.25, 3, 4.5, 6].map((w) => ({
      label: w + ' pt',
      iconHtml: '',
      icon: `<svg width="22" height="12"><line x1="1" y1="6" x2="21" y2="6" stroke="currentColor" stroke-width="${Math.min(6, w * 1.33)}"/></svg>`,
      checked: sel().length && sel()[0].strokeWidth === w,
      action: () => {
        sel().forEach((e) => {
          if (!e.stroke || e.stroke === 'none') e.stroke = e.type === 'image' ? '@text' : '@accent1:d';
        });
        E().setProp('strokeWidth', w);
      },
    }));
  const dashMenu = () =>
    [['solid', 'Solid'], ['dash', 'Dash'], ['dot', 'Round Dot'], ['dashdot', 'Dash Dot']].map(([v, l]) => ({
      label: l,
      icon: `<svg width="22" height="12"><line x1="1" y1="6" x2="21" y2="6" stroke="currentColor" stroke-width="2" stroke-dasharray="${R_dash(v)}" stroke-linecap="${v === 'dot' ? 'round' : 'butt'}"/></svg>`,
      checked: sel().length && (sel()[0].dash || 'solid') === v,
      action: () => E().setProp('dash', v),
    }));
  const R_dash = (v) => B.render.dash(v, 2) || 'none';
  const effectsMenu = () => [
    { label: 'Shadow', icon: 'shadow', checked: sel().length && !!sel()[0].shadow, action: () => E().setProp('shadow', !(sel()[0] && sel()[0].shadow)) },
    { label: 'Transparency', icon: 'opacity', sub: [1, 0.85, 0.7, 0.5, 0.3, 0.15].map((o) => ({ label: Math.round((1 - o) * 100) + '%', checked: sel().length && (sel()[0].opacity == null ? 1 : sel()[0].opacity) === o, action: () => E().setProp('opacity', o) })) },
  ];
  const tablePicker = () => {
    const p = h('div', { class: 'table-picker' });
    const label = h('div', { class: 'tp-label' }, 'Insert Table');
    const grid = h('div', { class: 'tp-grid' });
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 10; c++) {
        const cell = h('div', { class: 'tp-cell', 'data-r': r, 'data-c': c });
        cell.addEventListener('mouseenter', () => {
          U.$$('.tp-cell', grid).forEach((x) => x.classList.toggle('on', +x.dataset.r <= r && +x.dataset.c <= c));
          label.textContent = `${c + 1}×${r + 1} Table`;
        });
        cell.addEventListener('click', () => {
          B.ui.closeMenus();
          AC().insertTable(r + 1, c + 1);
        });
        grid.appendChild(cell);
      }
    const custom = h('button', { class: 'menu-item', type: 'button', html: U.icon('table') + '<span class="mi-label">Insert Table…</span>' });
    custom.addEventListener('click', () => {
      B.ui.closeMenus();
      B.dialogs.insertTable();
    });
    p.append(label, grid, custom);
    return p;
  };
  const chartMenu = () => B.CHART_KINDS.map((c) => ({ label: c.name, icon: c.icon, action: () => AC().insertChart(c.id) }));
  const equationMenu = () =>
    [{ label: 'Insert New Equation…', icon: 'functions', action: () => B.dialogs.equation(null) }, { sep: true }, { header: 'Common equations' }].concat(
      B.dialogs.COMMON_EQUATIONS.map((q) => ({ label: q.name, icon: 'calculate', action: () => AC().insertEquation(q.latex) }))
    );
  const layoutMenu = (onPick, current) => () => {
    const p = h('div', { class: 'layout-panel' });
    p.appendChild(h('div', { class: 'cp-label' }, B.themeById(A.deck.theme).name));
    const g = h('div', { class: 'layout-grid' });
    for (const l of B.LAYOUTS) {
      const fake = M.newSlide(l.id);
      fake.elements.forEach((e) => {
        if (e.placeholder) e.html = `<div style="opacity:.55">${U.esc(B.placeholderHint(e).replace('Click to add ', ''))}</div>`;
      });
      const b = h('button', { class: 'layout-btn' + (current && current() === l.id ? ' on' : ''), type: 'button', title: l.name }, B.render.thumb(fake, 120), h('span', {}, l.name));
      b.addEventListener('click', () => {
        B.ui.closeMenus();
        onPick(l.id);
      });
      g.appendChild(b);
    }
    p.appendChild(g);
    return p;
  };
  const dirMenu = (getter, setter, kinds) => () =>
    (kinds === 'anim'
      ? [['bottom', 'From Bottom', 'south'], ['left', 'From Left', 'east'], ['right', 'From Right', 'west'], ['top', 'From Top', 'north']]
      : [['right', 'From Right', 'west'], ['left', 'From Left', 'east'], ['bottom', 'From Bottom', 'north'], ['top', 'From Top', 'south']]
    ).map(([v, l, i]) => ({ label: l, icon: i, checked: getter() === v, action: () => setter(v) }));

  /* ---------------- tabs ---------------- */
  const textEnabled = () => !!A.editingId || sel().some((e) => M.isTextual(e) || e.type === 'table');
  let tState = null;
  const ts = (k2) => (tState ? tState[k2] : null);

  const TABS = {
    home: () => [
      group('Clipboard', [
        bigBtn({ icon: 'content_paste', label: 'Paste', shortcut: 'Ctrl+V', action: () => AC().pasteFromSystem() }),
        col(
          smallBtn({ icon: 'content_cut', label: 'Cut', shortcut: 'Ctrl+X', action: () => AC().cut() }),
          smallBtn({ icon: 'content_copy', label: 'Copy', shortcut: 'Ctrl+C', action: () => AC().copy() }),
          smallBtn({ icon: 'format_paint', label: 'Format Painter', action: () => E().pickPainter(), active: () => !!A.painter, enabled: anySel })
        ),
      ]),
      group('Slides', [
        bigBtn({ icon: 'add_box', label: 'New Slide', shortcut: 'Ctrl+M', action: () => B.slides.add(), menu: layoutMenu((id) => B.slides.add(id)) }),
        col(
          smallBtn({ icon: 'dashboard', label: 'Layout', menu: layoutMenu((id) => B.slides.setLayout(id), () => B.curSlide().layout) }),
          smallBtn({ icon: 'restart_alt', label: 'Reset', title: 'Reset placeholders to their layout positions', action: () => B.slides.reset() }),
          smallBtn({ icon: 'control_point_duplicate', label: 'Duplicate', action: () => B.slides.duplicate() })
        ),
      ]),
      group('Font', [
        col(
          row(
            select({ title: 'Font', width: 138, options: () => B.FONTS.map((f) => ({ value: f, label: f, font: f })), value: () => ts('font'), onChange: (v) => E().format('fontName', v), enabled: textEnabled }),
            combo({ title: 'Font Size', values: B.FONT_SIZES, value: () => ts('size'), onChange: (v) => E().format('fontSize', v), enabled: textEnabled }),
            smallBtn({ icon: 'text_increase', title: 'Increase Font Size', shortcut: 'Ctrl+Shift+>', action: () => E().growFont(1), enabled: textEnabled }),
            smallBtn({ icon: 'text_decrease', title: 'Decrease Font Size', shortcut: 'Ctrl+Shift+<', action: () => E().growFont(-1), enabled: textEnabled }),
            smallBtn({ icon: 'format_clear', title: 'Clear All Formatting', action: () => E().format('removeFormat'), enabled: textEnabled })
          ),
          row(
            smallBtn({ icon: 'format_bold', title: 'Bold', shortcut: 'Ctrl+B', action: () => E().format('bold'), active: () => ts('bold'), enabled: textEnabled }),
            smallBtn({ icon: 'format_italic', title: 'Italic', shortcut: 'Ctrl+I', action: () => E().format('italic'), active: () => ts('italic'), enabled: textEnabled }),
            smallBtn({ icon: 'format_underlined', title: 'Underline', shortcut: 'Ctrl+U', action: () => E().format('underline'), active: () => ts('underline'), enabled: textEnabled }),
            smallBtn({ icon: 'strikethrough_s', title: 'Strikethrough', action: () => E().format('strikeThrough'), active: () => ts('strikeThrough'), enabled: textEnabled }),
            smallBtn({ icon: 'superscript', title: 'Superscript', shortcut: 'Ctrl+Shift+=', action: () => E().format('superscript'), active: () => ts('superscript'), enabled: textEnabled }),
            smallBtn({ icon: 'subscript', title: 'Subscript', shortcut: 'Ctrl+=', action: () => E().format('subscript'), active: () => ts('subscript'), enabled: textEnabled }),
            smallBtn({
              icon: 'match_case', title: 'Change Case', enabled: textEnabled,
              menu: () => [
                { label: 'Sentence case.', action: () => AC().changeCase('sentence') },
                { label: 'lowercase', action: () => AC().changeCase('lower') },
                { label: 'UPPERCASE', action: () => AC().changeCase('upper') },
                { label: 'Capitalize Each Word', action: () => AC().changeCase('title') },
              ],
            }),
            colorBtn({ icon: 'format_ink_highlighter', title: 'Text Highlight Color', default: '#FFFF00', allowNone: true, noneLabel: 'No Highlight', onPick: (c) => E().format('hiliteColor', c === 'none' ? 'transparent' : B.resolveColor(c, B.theme())), enabled: textEnabled }),
            colorBtn({ icon: 'format_color_text', title: 'Font Color', default: '#C00000', allowAuto: true, onPick: (c) => fontColor(c), enabled: textEnabled })
          )
        ),
      ], { title: 'Symbols', action: () => B.dialogs.symbol() }),
      group('Paragraph', [
        col(
          row(
            smallBtn({ icon: 'format_list_bulleted', title: 'Bullets', action: () => E().format('insertUnorderedList'), active: () => ts('insertUnorderedList'), enabled: textEnabled }),
            smallBtn({ icon: 'format_list_numbered', title: 'Numbering', action: () => E().format('insertOrderedList'), active: () => ts('insertOrderedList'), enabled: textEnabled }),
            smallBtn({ icon: 'format_indent_decrease', title: 'Decrease List Level', shortcut: 'Shift+Tab', action: () => E().format('outdent'), enabled: () => !!A.editingId }),
            smallBtn({ icon: 'format_indent_increase', title: 'Increase List Level', shortcut: 'Tab', action: () => E().format('indent'), enabled: () => !!A.editingId }),
            smallBtn({ icon: 'format_line_spacing', title: 'Line Spacing', menu: lineSpacingMenu, enabled: textEnabled })
          ),
          row(
            smallBtn({ icon: 'format_align_left', title: 'Align Left', shortcut: 'Ctrl+L', action: () => E().setAlign('left'), active: () => ts('align') === 'left', enabled: textEnabled }),
            smallBtn({ icon: 'format_align_center', title: 'Center', shortcut: 'Ctrl+E', action: () => E().setAlign('center'), active: () => ts('align') === 'center', enabled: textEnabled }),
            smallBtn({ icon: 'format_align_right', title: 'Align Right', shortcut: 'Ctrl+R', action: () => E().setAlign('right'), active: () => ts('align') === 'right', enabled: textEnabled }),
            smallBtn({ icon: 'format_align_justify', title: 'Justify', shortcut: 'Ctrl+J', action: () => E().setAlign('justify'), active: () => ts('align') === 'justify', enabled: textEnabled }),
            smallBtn({
              icon: 'vertical_align_center', title: 'Align Text (vertical)', enabled: textEnabled,
              menu: () => [['top', 'Top', 'vertical_align_top'], ['middle', 'Middle', 'vertical_align_center'], ['bottom', 'Bottom', 'vertical_align_bottom']].map(([v, l, i]) => ({ label: l, icon: i, checked: sel().length && sel()[0].valign === v, action: () => E().setProp('valign', v, M.isTextual) })),
            }),
            smallBtn({
              icon: 'view_column', title: 'Columns', enabled: textEnabled,
              menu: () => [1, 2, 3].map((n) => ({ label: n === 1 ? 'One Column' : n === 2 ? 'Two Columns' : 'Three Columns', checked: sel().length && (sel()[0].columns || 1) === n, action: () => E().setProp('columns', n, M.isTextual) })),
            })
          )
        ),
      ]),
      group('Drawing', [
        gallery({ cls: 'shapes-mini', items: () => ['rect', 'ellipse', 'triangle', 'line', 'arrowLine', 'rightArrow', 'roundRect', 'star5', 'callout'].map((id) => ({ id, html: B.shapeIcon(id), title: B.shapeById(id).name })), onPick: (id) => AC().insertShape(id), active: () => A.drawTool && A.drawTool.shape, more: (g) => B.ui.popup(g, RB.shapesPanel((id) => AC().insertShape(id))) }),
        bigBtn({ icon: 'stacks', label: 'Arrange', menu: arrangeMenu }),
        bigBtn({ icon: 'style', label: 'Quick Styles', menu: () => quickStylesPanel(), enabled: has(isShapeLike) }),
        col(
          colorBtn({ icon: 'format_color_fill', label: 'Shape Fill', title: 'Shape Fill', default: '@accent1', allowNone: true, noneLabel: 'No Fill', onPick: (c) => setFill(c), enabled: anySel }),
          colorBtn({ icon: 'border_color', label: 'Shape Outline', title: 'Shape Outline', default: '@accent1:d', allowNone: true, noneLabel: 'No Outline', onPick: (c) => setStroke(c), enabled: anySel }),
          smallBtn({ icon: 'auto_awesome', label: 'Shape Effects', menu: effectsMenu, enabled: anySel })
        ),
      ]),
      group('Editing', [
        col(
          smallBtn({ icon: 'search', label: 'Find', shortcut: 'Ctrl+F', action: () => B.dialogs.find(false) }),
          smallBtn({ icon: 'find_replace', label: 'Replace', shortcut: 'Ctrl+H', action: () => B.dialogs.find(true) }),
          smallBtn({ icon: 'select_all', label: 'Select All', shortcut: 'Ctrl+A', action: () => E().selectAll() })
        ),
      ]),
    ],

    insert: () => [
      group('Slides', [bigBtn({ icon: 'add_box', label: 'New Slide', action: () => B.slides.add(), menu: layoutMenu((id) => B.slides.add(id)) })]),
      group('Tables', [bigBtn({ icon: 'table', label: 'Table', menu: tablePicker })]),
      group('Images', [
        bigBtn({
          icon: 'image', label: 'Pictures',
          menu: () => [
            { label: 'This Device…', icon: 'upload_file', action: () => AC().insertImage() },
            { label: 'From the Web (URL)…', icon: 'language', action: () => AC().insertImageUrl() },
            { sep: true },
            { label: `Tip: paste screenshots with ${U.isMac ? '⌘' : 'Ctrl'}+V`, disabled: true },
          ],
        }),
      ]),
      group('Illustrations', [
        bigBtn({ icon: 'interests', label: 'Shapes', menu: () => RB.shapesPanel((id) => AC().insertShape(id)) }),
        bigBtn({ icon: 'bar_chart', label: 'Chart', menu: chartMenu }),
        bigBtn({
          icon: 'view_in_ar', label: '3D Models',
          menu: () => [
            { label: 'This Device… (OBJ, STL)', icon: 'upload_file', action: () => B.model3d.pickAndInsert() },
            { sep: true },
            { header: 'Sample models' },
          ].concat(B.model3d.SAMPLES.map((s) => ({ label: s.name, icon: s.icon, action: () => B.model3d.insertSample(s.id) }))),
        }),
        bigBtn({ icon: 'account_tree', label: 'Diagram', title: 'Insert a ready-made STEM diagram', menu: () => B.dialogs.DIAGRAMS.map((d) => ({ label: d.name, icon: d.icon, action: () => B.dialogs.insertDiagram(d.id) })) }),
      ]),
      group('Text', [
        bigBtn({ icon: 'text_fields', label: 'Text Box', action: () => AC().insertTextBox(), active: () => A.drawTool && A.drawTool.type === 'text' }),
        col(
          smallBtn({ icon: 'call_to_action', label: 'Header & Footer', action: () => B.dialogs.headerFooter() }),
          smallBtn({ icon: 'format_shapes', label: 'WordArt', menu: () => AC().WORDART.map((w, i) => ({ label: w.name, icon: 'format_shapes', action: () => AC().insertWordArt(i) })) }),
          smallBtn({ icon: 'tag', label: 'Slide Number', action: () => AC().insertSlideNumber(), active: () => A.deck.slideNumbers })
        ),
      ]),
      group('Symbols', [
        bigBtn({ icon: 'functions', label: 'Equation', action: () => B.dialogs.equation(null), menu: equationMenu }),
        bigBtn({ icon: 'special_character', label: 'Symbol', action: () => B.dialogs.symbol() }),
      ]),
      group('Media', [
        bigBtn({
          icon: 'volume_up', label: 'Audio',
          menu: () => [
            { label: 'Audio on My PC…', icon: 'upload_file', action: () => B.media.pickAndInsert() },
            { label: 'Record Audio…', icon: 'mic', action: () => B.media.recordDialog() },
          ],
        }),
        bigBtn({
          icon: 'smart_display', label: 'Video',
          menu: () => [
            { label: 'Online Video (YouTube)…', icon: 'smart_display', action: () => B.dialogs.video(null) },
            { label: 'This Device…', icon: 'upload_file', action: () => AC().insertVideoFile() },
          ],
        }),
      ]),
      group('Links', [bigBtn({ icon: 'link', label: 'Link', shortcut: 'Ctrl+K', action: () => AC().link() })]),
    ],

    design: () => [
      group('Themes', [
        gallery({ cls: 'themes', items: () => B.THEMES.map((t) => ({ id: t.id, title: t.name, node: themeThumb(t) })), onPick: (id) => AC().setTheme(id), active: () => A.deck.theme }),
      ]),
      group('Customize', [
        bigBtn({
          icon: 'aspect_ratio', label: 'Slide Size',
          menu: () => [
            { label: 'Widescreen (16:9)', icon: 'crop_16_9', checked: B.sizeKey(A.deck) === '16:9', action: () => AC().setSlideSize('16:9') },
            { label: 'Standard (4:3)', icon: 'crop_landscape', checked: B.sizeKey(A.deck) === '4:3', action: () => AC().setSlideSize('4:3') },
            { label: 'Book · Letter (8.5 × 11 in)', icon: 'menu_book', checked: B.isBook(A.deck), action: () => AC().setSlideSize('book') },
            { sep: true },
            { label: 'Book pages turn sideways in the slide show', disabled: true },
          ],
        }),
        bigBtn({ icon: 'format_paint', label: 'Format Background', action: () => B.ui.toggleSidePane('background'), active: () => A.sidePane === 'background' }),
      ]),
    ],

    transitions: () => [
      group('Preview', [bigBtn({ icon: 'preview', label: 'Preview', action: () => B.show.previewTransition() })]),
      group('Transition to This Slide', [
        gallery({ cls: 'effects', items: () => B.TRANSITIONS.map((t) => ({ id: t.id, title: t.name, html: `${U.icon(t.icon)}<span>${t.name}</span>` })), onPick: (id) => AC().setTransition(id), active: () => (B.curSlide().transition || {}).type || 'none' }),
        bigBtn({ icon: 'tune', label: 'Effect Options', enabled: () => !!(B.TRANSITIONS.find((t) => t.id === (B.curSlide().transition || {}).type) || {}).dirs, menu: dirMenu(() => (B.curSlide().transition || {}).dir || 'right', (v) => AC().setTransitionProp('dir', v)) }),
      ]),
      group('Timing', [
        col(
          number({ label: 'Duration', icon: 'timer', suffix: 's', step: 0.1, min: 0.1, max: 10, value: () => (B.curSlide().transition || {}).duration || 0.7, onChange: (v) => AC().setTransitionProp('duration', U.clamp(v, 0.1, 10)) }),
          smallBtn({ icon: 'done_all', label: 'Apply To All', action: () => AC().applyTransitionAll() })
        ),
        sep(),
        col(
          h('div', { class: 'rb-caption' }, 'Advance Slide'),
          check({ label: 'On Mouse Click', value: () => true, onChange: () => {}, enabled: () => false }),
          row(
            check({ label: 'After', value: () => B.curSlide().advanceAfter != null, onChange: (v) => setAdvance(v ? 5 : null) }),
            number({ label: '', suffix: 's', step: 1, min: 0, width: 54, decimals: 1, value: () => B.curSlide().advanceAfter, onChange: (v) => setAdvance(Math.max(0, v)), enabled: () => B.curSlide().advanceAfter != null })
          )
        ),
      ]),
    ],

    animations: () => [
      group('Preview', [bigBtn({ icon: 'preview', label: 'Preview', action: () => B.show.previewAnimations() })]),
      group('Animation', [
        gallery({
          cls: 'effects anims',
          items: () => [{ id: 'none', title: 'None', html: `${U.icon('block')}<span>None</span>` }].concat(B.ANIMATIONS.map((a) => ({ id: a.id, title: `${a.name} (${a.kind})`, cls: 'k-' + a.kind, html: `${U.icon(a.icon)}<span>${a.name}</span>` }))),
          onPick: (id) => AC().setAnimation(id),
          active: () => {
            const e = sel()[0];
            return e ? (e.anim && e.anim.effect) || 'none' : null;
          },
        }),
        bigBtn({ icon: 'tune', label: 'Effect Options', enabled: () => sel().some((e) => e.anim && (B.animById(e.anim.effect) || {}).dirs), menu: dirMenu(() => (sel()[0] && sel()[0].anim ? sel()[0].anim.dir : 'bottom'), (v) => AC().setAnimProp('dir', v), 'anim') }),
      ]),
      group('Advanced Animation', [bigBtn({ icon: 'view_list', label: 'Animation Pane', action: () => B.ui.toggleSidePane('animation'), active: () => A.sidePane === 'animation' })]),
      group('Timing', [
        col(
          h('label', { class: 'rb-numfield' }, h('span', { html: U.icon('play_arrow') }), h('span', { class: 'rb-num-label' }, 'Start'),
            select({ title: 'Start', width: 128, options: [{ value: 'click', label: 'On Click' }, { value: 'with', label: 'With Previous' }, { value: 'after', label: 'After Previous' }], value: () => (sel()[0] && sel()[0].anim ? sel()[0].anim.start : 'click'), onChange: (v) => AC().setAnimProp('start', v), enabled: () => sel().some((e) => e.anim) })),
          number({ label: 'Duration', icon: 'timer', suffix: 's', step: 0.1, min: 0.05, max: 20, value: () => (sel()[0] && sel()[0].anim ? sel()[0].anim.duration : ''), onChange: (v) => AC().setAnimProp('duration', U.clamp(v, 0.05, 20)), enabled: () => sel().some((e) => e.anim) }),
          number({ label: 'Delay', icon: 'hourglass_empty', suffix: 's', step: 0.25, min: 0, max: 60, value: () => (sel()[0] && sel()[0].anim ? sel()[0].anim.delay : ''), onChange: (v) => AC().setAnimProp('delay', U.clamp(v, 0, 60)), enabled: () => sel().some((e) => e.anim) })
        ),
        col(
          h('div', { class: 'rb-caption' }, 'Reorder Animation'),
          smallBtn({ icon: 'arrow_upward', label: 'Move Earlier', action: () => AC().moveAnim(-1), enabled: () => sel().some((e) => e.anim) }),
          smallBtn({ icon: 'arrow_downward', label: 'Move Later', action: () => AC().moveAnim(1), enabled: () => sel().some((e) => e.anim) })
        ),
      ]),
    ],

    show: () => [
      group('Start Slide Show', [
        bigBtn({ icon: 'slideshow', label: 'From Beginning', shortcut: 'F5', action: () => B.show.start(0) }),
        bigBtn({ icon: 'play_circle', label: 'From Current Slide', shortcut: 'Shift+F5', action: () => B.show.start(A.current) }),
        bigBtn({ icon: 'co_present', label: 'Presenter View', shortcut: 'Alt+F5', action: () => B.show.start(A.current, { presenter: true }) }),
      ]),
      group('Set Up', [
        bigBtn({ icon: 'settings', label: 'Set Up Slide Show', action: () => B.dialogs.setupShow() }),
        bigBtn({ icon: 'visibility_off', label: 'Hide Slide', action: () => B.slides.toggleHidden(), active: () => B.curSlide().hidden }),
        col(
          h('label', { class: 'rb-numfield' }, h('span', { html: U.icon('timer') }), h('span', { class: 'rb-num-label' }, 'Advance'),
            select({ title: 'Advance slides', width: 168, options: [{ value: 'manual', label: 'Manually (on click)' }, { value: 'auto', label: 'Automatically (timed)' }], value: () => A.deck.showMode || 'manual', onChange: (v) => setDeck('showMode', v) })),
          number({ label: 'Each slide', icon: 'hourglass_empty', suffix: 's', step: 1, min: 1, max: 3600, decimals: 1, value: () => A.deck.slideDuration || 5, onChange: (v) => setDeck('slideDuration', U.clamp(v, 1, 3600)), enabled: () => A.deck.showMode === 'auto' }),
          check({ label: 'Loop continuously until Esc', value: () => A.deck.loop, onChange: (v) => setDeck('loop', v) })
        ),
        col(
          check({ label: 'Play all audio automatically', value: () => A.deck.autoAudio !== false, onChange: (v) => setDeck('autoAudio', v), enabled: () => A.deck.showMode === 'auto' }),
          check({ label: 'Wait for audio to finish', value: () => A.deck.waitForAudio !== false, onChange: (v) => setDeck('waitForAudio', v), enabled: () => A.deck.showMode === 'auto' }),
          check({ label: 'Use per-slide timings', title: 'Slides with their own “After” time (Transitions tab) use it', value: () => A.deck.useTimings !== false, onChange: (v) => setDeck('useTimings', v) })
        ),
      ]),
    ],

    view: () => [
      group('Presentation Views', [
        bigBtn({ icon: 'view_sidebar', label: 'Normal', action: () => AC().setView('normal'), active: () => A.view === 'normal' }),
        bigBtn({ icon: 'grid_view', label: 'Slide Sorter', action: () => AC().setView('sorter'), active: () => A.view === 'sorter' }),
        bigBtn({ icon: 'chrome_reader_mode', label: 'Reading View', action: () => B.show.start(A.current, { reading: true }) }),
      ]),
      group('Show', [
        col(
          check({ label: 'Gridlines', value: () => A.showGrid, onChange: () => AC().toggleGrid() }),
          check({ label: 'Smart Guides', value: () => A.showGuides, onChange: () => AC().toggleGuides() }),
          check({ label: 'Notes', value: () => A.showNotes, onChange: () => AC().toggleNotes() })
        ),
      ]),
      group('Zoom', [
        bigBtn({ icon: 'zoom_in', label: 'Zoom', menu: () => [400, 200, 150, 100, 75, 50, 33].map((z) => ({ label: z + '%', checked: !A.fit && A.zoom === z, action: () => E().setZoom(z) })) }),
        bigBtn({ icon: 'fit_screen', label: 'Fit to Window', action: () => E().fit(), active: () => A.fit }),
      ]),
    ],

    shape: () => [
      group('Insert Shapes', [
        gallery({ cls: 'shapes-mini', items: () => ['rect', 'ellipse', 'triangle', 'line', 'arrowLine', 'rightArrow', 'roundRect', 'star5', 'callout'].map((id) => ({ id, html: B.shapeIcon(id), title: B.shapeById(id).name })), onPick: (id) => AC().insertShape(id), more: (g) => B.ui.popup(g, RB.shapesPanel((id) => AC().insertShape(id))) }),
        col(
          smallBtn({ icon: 'change_circle', label: 'Change Shape', enabled: has((e) => e.type === 'shape' && !B.shapeById(e.shape).line), menu: () => RB.shapesPanel((id) => changeShape(id)) }),
          smallBtn({ icon: 'text_fields', label: 'Text Box', action: () => AC().insertTextBox() }),
          smallBtn({ icon: 'edit', label: 'Edit Text', enabled: () => sel().length === 1 && M.isTextual(sel()[0]), action: () => E().startEdit(sel()[0].id) })
        ),
      ]),
      group('Shape Styles', [
        gallery({ cls: 'qstyles', items: () => AC().QUICK_STYLES.slice(0, 6).map((s, i) => ({ id: i, title: 'Quick style ' + (i + 1), node: qsNode(s) })), onPick: (i) => AC().applyQuickStyle(AC().QUICK_STYLES[i]), more: (g) => B.ui.popup(g, quickStylesPanel()) }),
        col(
          colorBtn({ icon: 'format_color_fill', label: 'Shape Fill', title: 'Shape Fill', default: '@accent1', allowNone: true, noneLabel: 'No Fill', onPick: (c) => setFill(c) }),
          colorBtn({ icon: 'border_color', label: 'Shape Outline', title: 'Shape Outline', default: '@accent1:d', allowNone: true, noneLabel: 'No Outline', onPick: (c) => setStroke(c) }),
          smallBtn({ icon: 'auto_awesome', label: 'Shape Effects', menu: effectsMenu })
        ),
        col(
          smallBtn({ icon: 'line_weight', label: 'Weight', menu: weightMenu }),
          smallBtn({ icon: 'line_style', label: 'Dashes', menu: dashMenu }),
          smallBtn({ icon: 'tune', label: 'Format Pane', action: () => B.ui.toggleSidePane('format'), active: () => A.sidePane === 'format' })
        ),
      ]),
      arrangeGroup(),
      sizeGroup(),
    ],

    picture: () => [
      group('Adjust', [
        bigBtn({
          icon: 'filter_vintage', label: 'Color & Filters',
          menu: () => [['none', 'No Filter'], ['grayscale', 'Grayscale'], ['sepia', 'Sepia'], ['bright', 'Brighten'], ['dark', 'Darken'], ['contrast', 'High Contrast'], ['blur', 'Blur'], ['invert', 'Invert (great for diagrams)']].map(([v, l]) => ({ label: l, checked: sel()[0] && (sel()[0].filter || 'none') === v, action: () => E().setProp('filter', v) })),
        }),
        col(
          smallBtn({ icon: 'image', label: 'Change Picture', action: () => AC().changePicture() }),
          smallBtn({ icon: 'restart_alt', label: 'Reset Picture', action: () => AC().resetPicture() })
        ),
      ]),
      group('Picture Styles', [
        gallery({
          cls: 'masks',
          items: () => [['none', 'Rectangle', 'crop_square'], ['rounded', 'Rounded', 'rounded_corner'], ['circle', 'Circle', 'circle']].map(([id, t, ic]) => ({ id, title: t, html: `${U.icon(ic)}<span>${t}</span>` })),
          onPick: (id) => {
            const el = sel()[0];
            if (id === 'circle' && el && Math.abs(el.w - el.h) > 2 && !el.crop) AC().cropTo(1).then(() => E().setProp('mask', id));
            else E().setProp('mask', id);
          },
          active: () => sel()[0] && (sel()[0].mask || 'none'),
        }),
        col(
          colorBtn({ icon: 'border_style', label: 'Picture Border', title: 'Picture Border', default: '@accent1', allowNone: true, noneLabel: 'No Outline', onPick: (c) => setStroke(c) }),
          smallBtn({ icon: 'line_weight', label: 'Border Weight', menu: weightMenu }),
          smallBtn({ icon: 'auto_awesome', label: 'Picture Effects', menu: effectsMenu })
        ),
      ]),
      group('Accessibility', [bigBtn({ icon: 'text_snippet', label: 'Alt Text', action: () => AC().altText() })]),
      arrangeGroup(),
      group('Size', [
        bigBtn({
          icon: 'crop', label: 'Crop',
          menu: () => [
            { label: 'Square (1:1)', action: () => AC().cropTo(1) },
            { label: 'Widescreen (16:9)', action: () => AC().cropTo(16 / 9) },
            { label: 'Standard (4:3)', action: () => AC().cropTo(4 / 3) },
            { label: 'Portrait (3:4)', action: () => AC().cropTo(3 / 4) },
            { sep: true },
            { label: 'Custom Crop…', icon: 'tune', action: () => B.ui.openSidePane('format') },
            { label: 'Remove Crop', icon: 'restart_alt', action: () => AC().cropTo(null) },
          ],
        }),
        sizeCol(),
      ]),
    ],

    table: () => [
      group('Table Style Options', [
        col(
          check({ label: 'Header Row', value: () => sel()[0] && sel()[0].header, onChange: (v) => E().setProp('header', v) }),
          check({ label: 'Banded Rows', value: () => sel()[0] && sel()[0].banded, onChange: (v) => E().setProp('banded', v) })
        ),
      ]),
      group('Table Styles', [
        gallery({
          cls: 'tstyles',
          items: () => ['@accent1', '@accent2', '@accent3', '@accent4', '@accent5', '@accent6', '#595959'].map((c) => ({ id: c, title: 'Table style', node: tableStyleNode(c) })),
          onPick: (c) => E().setProp('accent', c),
          active: () => sel()[0] && sel()[0].accent,
        }),
      ]),
      group('Rows & Columns', [
        bigBtn({
          icon: 'delete', label: 'Delete',
          menu: () => [
            { label: 'Delete Columns', icon: 'view_column', action: () => AC().tableOp('delCol') },
            { label: 'Delete Rows', icon: 'table_rows', action: () => AC().tableOp('delRow') },
            { label: 'Delete Table', icon: 'delete', action: () => AC().deleteTable() },
          ],
        }),
        col(
          smallBtn({ icon: 'keyboard_arrow_up', label: 'Insert Above', action: () => AC().tableOp('rowAbove') }),
          smallBtn({ icon: 'keyboard_arrow_down', label: 'Insert Below', action: () => AC().tableOp('rowBelow') })
        ),
        col(
          smallBtn({ icon: 'keyboard_arrow_left', label: 'Insert Left', action: () => AC().tableOp('colLeft') }),
          smallBtn({ icon: 'keyboard_arrow_right', label: 'Insert Right', action: () => AC().tableOp('colRight') })
        ),
      ]),
      group('Cell Size', [col(smallBtn({ icon: 'view_week', label: 'Distribute Columns', action: () => AC().tableOp('distribute') }))]),
      arrangeGroup(),
      sizeGroup(),
    ],

    model3d: () => {
      const m = () => sel()[0] || {};
      const set = (k, v) => E().setProp(k, v, (e) => e.type === 'model3d');
      const view = (rx, ry) => {
        sel().filter((e) => e.type === 'model3d').forEach((e) => Object.assign(e, { rotX: rx, rotY: ry, rotZ: 0 }));
        E().changed(true);
      };
      return [
        group('3D Model Views', [
          gallery({
            cls: 'effects views3d',
            items: () => B.model3d.VIEWS.map(([id, name]) => ({ id, title: name, html: `${U.icon('view_in_ar')}<span>${name.replace('Above Front ', '↗ ')}</span>` })),
            onPick: (id) => {
              const v = B.model3d.VIEWS.find((x) => x[0] === id);
              view(v[2], v[3]);
            },
            active: () => (B.model3d.VIEWS.find((v) => v[2] === (m().rotX || 0) && v[3] === (m().rotY || 0)) || [])[0],
          }),
        ]),
        group('Adjust', [
          bigBtn({ icon: 'restart_alt', label: 'Reset Model', action: () => { sel().forEach((e) => Object.assign(e, { rotX: 15, rotY: -25, rotZ: 0, zoom: 1 })); E().changed(true); } }),
          col(
            smallBtn({ icon: 'swap_horiz', label: 'Change Model…', action: () => B.model3d.replace(m()) }),
            smallBtn({ icon: 'zoom_in', label: 'Zoom In', action: () => set('zoom', U.clamp((m().zoom || 1) * 1.2, 0.3, 4)) }),
            smallBtn({ icon: 'zoom_out', label: 'Zoom Out', action: () => set('zoom', U.clamp((m().zoom || 1) / 1.2, 0.3, 4)) })
          ),
          col(
            colorBtn({ icon: 'format_color_fill', label: 'Model Color', title: 'Model Color', default: '@accent1', onPick: (c) => c !== 'none' && set('color', c) }),
            check({ label: 'Use colors from file', title: 'OBJ parts named after colors (e.g. “red”) keep them', value: () => m().useFileColors !== false, onChange: (v) => set('useFileColors', v) }),
            check({ label: 'Wireframe', value: () => !!m().wireframe, onChange: (v) => set('wireframe', v) })
          ),
        ]),
        group('Slide Show', [
          col(
            check({ label: 'Interactive (drag to rotate, scroll to zoom)', value: () => m().interactive !== false, onChange: (v) => set('interactive', v) }),
            h('label', { class: 'rb-numfield' }, h('span', { html: U.icon('autorenew') }), h('span', { class: 'rb-num-label' }, 'Spin'),
              select({ title: 'Spin speed', width: 120, options: [{ value: 'none', label: 'Off' }, { value: 'slow', label: 'Slow' }, { value: 'medium', label: 'Medium' }, { value: 'fast', label: 'Fast' }], value: () => m().spin || 'slow', onChange: (v) => set('spin', v) })),
            check({ label: 'Spin in manual shows too', title: 'Automatic (timed) shows always use the spin', value: () => !!m().spinManual, onChange: (v) => set('spinManual', v) })
          ),
        ]),
        arrangeGroup(),
        sizeGroup(),
      ];
    },

    audio: () => {
      const a = () => sel()[0] || {};
      const set = (k, v) => E().setProp(k, v, (e) => e.type === 'audio');
      return [
        group('Preview', [bigBtn({ icon: 'play_arrow', label: 'Play', title: 'Play / Pause', action: () => B.media.togglePreview(a()), active: () => B.media.isPreviewing(a().id) })]),
        group('Editing', [
          col(
            smallBtn({ icon: 'library_music', label: 'Replace Audio…', action: () => B.media.replace(a()) }),
            smallBtn({ icon: 'mic', label: 'Record New…', action: () => B.media.recordDialog() }),
            smallBtn({ icon: 'edit', label: 'Rename…', action: async () => { const n = await B.ui.prompt('Rename Audio', 'Name', a().name || ''); if (n) set('name', n.trim()); } })
          ),
        ]),
        group('Audio Options', [
          col(
            h('label', { class: 'rb-numfield' }, h('span', { html: U.icon('play_circle') }), h('span', { class: 'rb-num-label' }, 'Start'),
              select({ title: 'Start', width: 150, options: B.media.START_OPTIONS.map(([value, label]) => ({ value, label })), value: () => a().start || 'click', onChange: (v) => set('start', v) })),
            smallBtn({
              icon: 'volume_up', label: 'Volume',
              menu: () => B.media.VOLUMES.map(([v, l, i]) => ({ label: l, icon: i, checked: (a().volume == null ? 1 : a().volume) === v, action: () => set('volume', v) })),
            })
          ),
          col(
            check({ label: 'Play Across Slides', value: () => a().across, onChange: (v) => set('across', v) }),
            check({ label: 'Loop until Stopped', value: () => a().loop, onChange: (v) => set('loop', v) }),
            check({ label: 'Hide During Show', value: () => a().hide, onChange: (v) => set('hide', v) })
          ),
          col(check({ label: 'Rewind after Playing', value: () => a().rewind !== false, onChange: (v) => set('rewind', v) })),
        ]),
        group('Icon', [colorBtn({ icon: 'format_color_fill', label: 'Icon Color', title: 'Icon Color', default: '@accent1', onPick: (c) => c !== 'none' && set('fill', c) })]),
        arrangeGroup(),
        sizeGroup(),
      ];
    },

    chart: () => [
      group('Data', [bigBtn({ icon: 'table_chart', label: 'Edit Data', action: () => B.dialogs.chart(sel()[0]) })]),
      group('Type', [
        gallery({ cls: 'effects', items: () => B.CHART_KINDS.map((c) => ({ id: c.id, title: c.name, html: `${U.icon(c.icon)}<span>${c.name.replace(' (XY)', '')}</span>` })), onPick: (id) => setChart('kind', id), active: () => sel()[0] && sel()[0].chart.kind }),
      ]),
      group('Chart Elements', [
        col(
          check({ label: 'Legend', value: () => sel()[0] && sel()[0].chart.legend !== false, onChange: (v) => setChart('legend', v) }),
          check({ label: 'Data Labels', value: () => sel()[0] && sel()[0].chart.dataLabels, onChange: (v) => setChart('dataLabels', v) }),
          check({ label: 'Trendline', value: () => sel()[0] && sel()[0].chart.trendline, onChange: (v) => setChart('trendline', v), enabled: () => sel()[0] && sel()[0].chart.kind === 'scatter' })
        ),
      ]),
      arrangeGroup(),
      sizeGroup(),
    ],
  };

  function arrangeGroup() {
    return group('Arrange', [
      col(
        smallBtn({ icon: 'flip_to_front', label: 'Bring Forward', action: () => E().order('forward'), menu: null }),
        smallBtn({ icon: 'flip_to_back', label: 'Send Backward', action: () => E().order('backward') }),
        smallBtn({ icon: 'tune', label: 'Selection Pane', action: () => B.ui.toggleSidePane('format') })
      ),
      col(
        smallBtn({ icon: 'align_horizontal_center', label: 'Align', menu: alignMenu }),
        smallBtn({ icon: 'group_work', label: 'Group', menu: () => [{ label: 'Group', icon: 'group_work', action: () => E().group(), disabled: sel().length < 2 }, { label: 'Ungroup', icon: 'workspaces', action: () => E().ungroup(), disabled: !sel().some((e) => e.groupId) }] }),
        smallBtn({ icon: 'rotate_right', label: 'Rotate', menu: rotateMenu })
      ),
    ]);
  }
  function sizeCol() {
    const one = () => sel().length === 1;
    return col(
      number({ label: 'Height', icon: 'height', suffix: 'in', step: 0.1, min: 0.05, value: () => (one() ? sel()[0].h / 96 : ''), onChange: (v) => setSize('h', v * 96), enabled: one }),
      number({ label: 'Width', icon: 'width', suffix: 'in', step: 0.1, min: 0.05, value: () => (one() ? sel()[0].w / 96 : ''), onChange: (v) => setSize('w', v * 96), enabled: one })
    );
  }
  function sizeGroup() {
    return group('Size', [sizeCol()], { title: 'Size & Position', action: () => B.ui.openSidePane('format') });
  }

  /* ---------------- helpers used by controls ---------------- */
  function fontColor(c) {
    if (A.editingId) return E().format('foreColor', c ? B.resolveColor(c, B.theme()) : B.render.defaultTextColor(B.findEl(A.editingId), B.theme()));
    const els = sel().filter((e) => M.isTextual(e) || e.type === 'table');
    if (!els.length) return;
    E().format('foreColor', c);
  }
  function setFill(c) {
    const els = sel();
    if (!els.length) return B.ui.toast('Select a shape first.');
    els.forEach((el) => {
      if (el.type === 'table') el.accent = c === 'none' ? '#FFFFFF' : c;
      else if (el.type === 'shape' && B.shapeById(el.shape).line) return;
      else if (el.type !== 'image') el.fill = c;
    });
    E().changed(true);
  }
  function setStroke(c) {
    const els = sel();
    if (!els.length) return B.ui.toast('Select a shape first.');
    els.forEach((el) => {
      el.stroke = c;
      if (c !== 'none' && !el.strokeWidth) el.strokeWidth = el.type === 'image' ? 3 : 1.5;
    });
    E().changed(true);
  }
  function changeShape(id) {
    sel().forEach((el) => {
      if (el.type === 'shape' && !B.shapeById(el.shape).line && !B.shapeById(id).line) el.shape = id;
    });
    E().changed(true);
  }
  function setSize(dim, v) {
    const el = sel()[0];
    if (!el) return;
    v = Math.max(4, v);
    const keep = el.type === 'image' || el.type === 'equation';
    const ratio = el.w / el.h;
    const cx = el.x + el.w / 2, cy = el.y + el.h / 2;
    el[dim] = Math.round(v * 10) / 10;
    if (keep) dim === 'w' ? (el.h = Math.round((el.w / ratio) * 10) / 10) : (el.w = Math.round(el.h * ratio * 10) / 10);
    if (dim === 'h' && el.type === 'text') el.autoHeight = false;
    el.x = Math.round((cx - el.w / 2) * 10) / 10;
    el.y = Math.round((cy - el.h / 2) * 10) / 10;
    E().changed(true);
    E().select(A.selection);
  }
  function setChart(k2, v) {
    const el = sel()[0];
    if (!el || el.type !== 'chart') return;
    el.chart[k2] = v;
    E().changed(true);
  }
  function setDeck(k2, v) {
    A.deck[k2] = v;
    B.store.commit();
    RB.update();
  }
  function setAdvance(v) {
    B.slides.selectedIds().forEach((id) => (A.deck.slides[B.slides.indexOf(id)].advanceAfter = v));
    B.store.commit();
    RB.update();
  }
  function qsNode(s) {
    const t = B.theme();
    const fill = B.resolveColor(s.fill, t);
    return h('span', { class: 'qs', style: { background: fill === 'none' ? 'transparent' : fill, borderColor: B.resolveColor(s.stroke, t), color: B.resolveColor(s.color, t) || B.render.contrast(fill === 'none' ? t.bgColor : fill) } }, 'Abc');
  }
  function quickStylesPanel() {
    const p = h('div', { class: 'qs-panel' });
    AC().QUICK_STYLES.forEach((s) => {
      const b = h('button', { class: 'qs-btn', type: 'button', title: 'Apply style' }, qsNode(s));
      b.addEventListener('click', () => {
        B.ui.closeMenus();
        AC().applyQuickStyle(s);
      });
      p.appendChild(b);
    });
    return p;
  }
  function tableStyleNode(c) {
    const t = B.theme();
    const col2 = B.render.tableColors({ accent: c }, t);
    const n = h('span', { class: 'tsn' });
    for (let r = 0; r < 4; r++) for (let x = 0; x < 3; x++) n.appendChild(h('i', { style: { background: r === 0 ? col2.head : r % 2 ? col2.band1 : col2.band2 } }));
    return n;
  }
  const themeCache = {};
  function themeThumb(t) {
    const key = t.id + A.deck.w + 'x' + A.deck.h;
    if (!themeCache[key]) {
      const d = { theme: t.id, w: A.deck.w, h: A.deck.h, slides: [] };
      const s = { layout: 'title', elements: B.layoutElements('title', d.w, d.h).map((p) => M.newElement('text', p)) };
      s.elements[0].html = '<div>Aa</div>';
      s.elements[0].size = 96;
      s.elements[1].html = '';
      d.slides.push(s);
      themeCache[key] = B.render.thumb(s, B.isBook(d) ? 50 : 104, { deck: d, index: 0 });
    }
    const box = h('span', { class: 'theme-thumb' });
    box.appendChild(themeCache[key].cloneNode(true));
    box.appendChild(h('span', { class: 'theme-dots' }, ...t.accents.slice(0, 4).map((c) => h('i', { style: { background: c } }))));
    return box;
  }

  /* ---------------- build / update ---------------- */
  const BASE_TABS = [
    ['home', 'Home'],
    ['insert', 'Insert'],
    ['design', 'Design'],
    ['transitions', 'Transitions'],
    ['animations', 'Animations'],
    ['show', 'Slide Show'],
    ['view', 'View'],
  ];
  const contextualTabs = () => {
    const els = sel();
    const t = [];
    if (A.view !== 'normal' || !els.length) return t;
    if (els.every(isShapeLike)) t.push(['shape', 'Shape Format']);
    if (els.length === 1 && els[0].type === 'image') t.push(['picture', 'Picture Format']);
    if (els.length === 1 && els[0].type === 'table') t.push(['table', 'Table Design']);
    if (els.length === 1 && els[0].type === 'chart') t.push(['chart', 'Chart Design']);
    if (els.length === 1 && els[0].type === 'audio') t.push(['audio', 'Playback']);
    if (els.length === 1 && els[0].type === 'model3d') t.push(['model3d', '3D Model']);
    return t;
  };

  RB.init = () => {
    RB.buildTabs();
    RB.show(activeTab);
    U.$('#ribbonToggle').addEventListener('click', () => RB.setCollapsed(!collapsed));
    RB.setCollapsed(collapsed);
  };

  RB.setCollapsed = (v) => {
    collapsed = v;
    U.storage.set('ribbonCollapsed', v);
    document.body.classList.toggle('ribbon-collapsed', v);
    U.$('#ribbonToggle').innerHTML = U.icon(v ? 'expand_more' : 'expand_less');
    U.$('#ribbonToggle').title = v ? 'Show the ribbon' : 'Collapse the ribbon';
    requestAnimationFrame(() => E().layout());
  };

  RB.buildTabs = () => {
    const bar = U.$('#tabs');
    bar.innerHTML = '';
    const file = h('button', { class: 'tab file-tab', type: 'button', role: 'tab' }, 'File');
    file.addEventListener('click', () => B.backstage.open());
    bar.appendChild(file);
    const ctx = contextualTabs();
    lastCtx = ctx.map((c) => c[0]).join();
    for (const [id, label] of BASE_TABS.concat(ctx)) {
      const t = h('button', { class: 'tab' + (ctx.some((c) => c[0] === id) ? ' contextual' : '') + (id === activeTab ? ' active' : ''), type: 'button', role: 'tab', 'data-tab': id, 'aria-selected': id === activeTab }, label);
      noSteal(t);
      t.addEventListener('click', () => {
        if (collapsed && id === activeTab) document.body.classList.toggle('ribbon-peek');
        RB.show(id);
      });
      t.addEventListener('dblclick', () => RB.setCollapsed(!collapsed));
      bar.appendChild(t);
    }
  };

  RB.show = (id) => {
    if (!TABS[id]) id = 'home';
    activeTab = id;
    if (BASE_TABS.some((t) => t[0] === id)) U.storage.set('tab', id);
    U.$$('#tabs .tab').forEach((t) => {
      t.classList.toggle('active', t.dataset.tab === id);
      t.setAttribute('aria-selected', t.dataset.tab === id);
    });
    const rb = U.$('#ribbon-body');
    rb.innerHTML = '';
    updaters = [];
    TABS[id]().forEach((g) => rb.appendChild(g));
    RB.update();
  };

  RB.update = () => {
    if (!A.deck) return;
    const ctx = contextualTabs();
    const key = ctx.map((c) => c[0]).join();
    if (key !== lastCtx) {
      const wasCtx = !BASE_TABS.some((t) => t[0] === activeTab);
      RB.buildTabs();
      // a contextual tab that no longer applies falls back to the next one (or the last normal tab)
      if (wasCtx && !ctx.some((c) => c[0] === activeTab)) return RB.show(ctx.length ? ctx[0][0] : U.storage.get('tab', 'home'));
    }
    tState = E().textState ? E().textState() : null;
    updaters.forEach((u) => {
      try {
        u();
      } catch (e) {
        console.warn(e);
      }
    });
  };
  RB.updateText = U.debounce(() => {
    tState = E().textState();
    updaters.forEach((u) => {
      try {
        u();
      } catch (e) {
        /* ignore */
      }
    });
  }, 60);
  RB.active = () => activeTab;
  B.on('media', () => activeTab === 'audio' && RB.updateText());
  let lastShape = '';
  B.on('deck', () => {
    const shape = A.deck ? A.deck.w + 'x' + A.deck.h : '';
    if (lastShape && shape !== lastShape && U.$('#ribbon-body').children.length) RB.show(activeTab);
    lastShape = shape;
  });
  B.on('inserted', (el) => {
    const tab = { shape: 'shape', image: 'picture', table: 'table', chart: 'chart', audio: 'audio', model3d: 'model3d' }[el.type];
    if (!tab) return;
    RB.update();
    if (contextualTabs().some((t) => t[0] === tab)) RB.show(tab);
  });
})(window.BSD);
