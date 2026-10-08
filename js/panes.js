/* BSD STEM Slides — side panes: Format (selection, size, fill, text, picture), Animation pane, Background */
(function (B) {
  'use strict';
  const U = B.util, A = B.app, M = B.model;
  const h = U.h;
  const P = (B.panes = {});
  const E = () => B.editor;

  P.init = () => {
    B.on('sidepane', P.render);
    U.$('#sidepane').addEventListener('keydown', (e) => e.stopPropagation());
  };
  P.update = U.debounce(() => A.sidePane && P.render(), 40);

  P.elName = (el, slide = B.curSlide()) => {
    const same = slide.elements.filter((e) => e.type === el.type && (e.type !== 'shape' || e.shape === el.shape));
    const n = same.indexOf(el) + 1;
    const base =
      el.placeholder === 'title' ? 'Title' : el.placeholder === 'subtitle' ? 'Subtitle' : el.placeholder ? 'Content Placeholder'
        : el.type === 'text' ? 'TextBox' : el.type === 'shape' ? B.shapeById(el.shape).name : el.type === 'image' ? 'Picture'
          : el.type[0].toUpperCase() + el.type.slice(1);
    const txt = el.html ? U.htmlToText(el.html).slice(0, 28) : el.latex ? el.latex.slice(0, 24) : '';
    return { name: `${base} ${n}`, text: txt };
  };

  const section = (title, body, open = true) => {
    const d = h('details', { class: 'pane-sec' });
    d.open = open;
    d.append(h('summary', {}, title), h('div', { class: 'pane-sec-body' }, ...[].concat(body)));
    return d;
  };
  const field = (label, input) => h('label', { class: 'pane-field' }, h('span', {}, label), input);
  const num = (value, onChange, o = {}) => {
    const i = h('input', { type: 'number', class: 'field sm', step: o.step || 1, min: o.min, max: o.max, value: value == null ? '' : +(+value).toFixed(o.dec == null ? 2 : o.dec) });
    i.addEventListener('change', () => {
      const v = parseFloat(i.value);
      if (!isNaN(v)) onChange(v);
    });
    return i;
  };
  const colorField = (value, onPick, o = {}) => {
    const b = h('button', { class: 'color-field', type: 'button' });
    const paint = (v) => {
      const c = B.resolveColor(v, B.theme());
      b.innerHTML = `<span class="cf-sw ${!c || c === 'none' ? 'none' : ''}" style="background:${!c || c === 'none' ? 'transparent' : c}"></span><span>${!v || v === 'none' ? o.noneLabel || 'None' : v[0] === '@' ? 'Theme color' : U.esc(v)}</span>${U.icon('expand_more')}`;
    };
    paint(value);
    b.addEventListener('click', () =>
      B.ui.colorPicker(b, {
        value,
        allowNone: o.allowNone !== false,
        noneLabel: o.noneLabel,
        allowAuto: o.allowAuto,
        onPick: (c) => {
          paint(c);
          onPick(c);
        },
      })
    );
    return b;
  };
  const range = (value, onInput, onChange, o = {}) => {
    const r = h('input', { type: 'range', min: o.min || 0, max: o.max || 100, step: o.step || 1, value });
    const out = h('span', { class: 'range-out' }, String(value) + (o.suffix || ''));
    r.addEventListener('input', () => {
      out.textContent = r.value + (o.suffix || '');
      onInput(+r.value);
    });
    r.addEventListener('change', () => onChange(+r.value));
    return h('div', { class: 'range-row' }, r, out);
  };
  const selectEl = (options, value, onChange) => {
    const s = h('select', { class: 'field sm' }, ...options.map(([v, l]) => h('option', { value: v }, l)));
    s.value = value;
    s.addEventListener('change', () => onChange(s.value));
    return s;
  };

  P.render = () => {
    const pane = U.$('#sidepane');
    if (!A.sidePane) {
      pane.hidden = true;
      return;
    }
    pane.hidden = false;
    // don't rebuild while the user is typing in the pane
    if (pane.contains(document.activeElement) && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) && pane.dataset.kind === A.sidePane) return;
    pane.dataset.kind = A.sidePane;
    const scroll = pane.querySelector('.pane-body') ? pane.querySelector('.pane-body').scrollTop : 0;
    pane.innerHTML = '';
    const titles = { format: 'Format', animation: 'Animation Pane', background: 'Format Background' };
    const close = h('button', { class: 'icon-btn', type: 'button', title: 'Close pane', 'aria-label': 'Close pane', html: U.icon('close') });
    close.addEventListener('click', () => B.ui.closeSidePane());
    pane.appendChild(h('div', { class: 'pane-head' }, h('h3', {}, titles[A.sidePane]), close));
    const body = h('div', { class: 'pane-body' });
    pane.appendChild(body);
    if (!A.deck) return;
    if (A.sidePane === 'format') formatPane(body);
    else if (A.sidePane === 'animation') animPane(body);
    else if (A.sidePane === 'background') bgPane(body);
    body.scrollTop = scroll;
  };

  /* ---------------- format pane ---------------- */
  function formatPane(body) {
    const slide = B.curSlide();
    // selection list (like PowerPoint's Selection Pane)
    const listBox = h('div', { class: 'sel-list' });
    slide.elements
      .slice()
      .reverse()
      .forEach((el) => {
        const nm = P.elName(el, slide);
        const row = h('div', { class: 'sel-row' + (A.selection.includes(el.id) ? ' on' : ''), title: nm.text || nm.name });
        row.append(h('span', { class: 'sel-name' }, nm.name), h('span', { class: 'sel-text' }, nm.text));
        const lock = h('button', { class: 'icon-btn xs', type: 'button', title: el.locked ? 'Unlock' : 'Lock', html: U.icon(el.locked ? 'lock' : 'lock_open') });
        lock.addEventListener('click', (e) => {
          e.stopPropagation();
          el.locked = !el.locked;
          B.store.commit();
          E().drawSelection();
          P.render();
        });
        row.appendChild(lock);
        row.addEventListener('click', (e) => {
          if (e.shiftKey || U.mod(e)) E().select(A.selection.includes(el.id) ? A.selection.filter((x) => x !== el.id) : A.selection.concat(el.id));
          else E().select([el.id]);
        });
        listBox.appendChild(row);
      });
    if (!slide.elements.length) listBox.appendChild(h('div', { class: 'pane-empty' }, 'This slide has no objects.'));
    const orderBtns = h('div', { class: 'btn-row' });
    [['flip_to_front', 'Bring Forward', 'forward'], ['flip_to_back', 'Send Backward', 'backward']].forEach(([i, t, o]) => {
      const b = h('button', { class: 'btn sm', type: 'button', html: U.icon(i) + t });
      b.addEventListener('click', () => E().order(o));
      orderBtns.appendChild(b);
    });
    body.appendChild(section('Selection', [listBox, orderBtns], true));

    const els = B.selectedEls();
    if (!els.length) {
      body.appendChild(h('p', { class: 'pane-empty' }, 'Select an object on the slide to format it.'));
      return;
    }
    const el = els[0];
    const set = (k, v, rerender = true) => {
      els.forEach((x) => (x[k] = v));
      if (rerender) E().changed(true);
      else {
        els.forEach((x) => E().refreshEl(x));
        E().drawSelection();
      }
    };
    const live = (k, v) => {
      els.forEach((x) => {
        x[k] = v;
        E().refreshEl(x);
      });
      E().drawSelection();
    };
    const commitLive = () => {
      B.store.commit();
      B.emit('content');
    };

    // size & position
    if (els.length === 1) {
      const pos = h('div', { class: 'grid2' });
      const geo = (k, label, scale = 96, o = {}) =>
        field(label, num(el[k] / scale, (v) => {
          el[k] = Math.round(v * scale * 10) / 10;
          if (k === 'h' && el.type === 'text') el.autoHeight = false;
          E().changed(true);
          E().select([el.id]);
        }, o));
      pos.append(geo('x', 'Left (in)'), geo('y', 'Top (in)'), geo('w', 'Width (in)'), geo('h', 'Height (in)'), field('Rotation (°)', num(el.rot || 0, (v) => set('rot', ((v % 360) + 360) % 360), { dec: 0 })));
      body.appendChild(section('Size & Position', pos));
    }

    // fill & line
    if (el.type === 'shape' || el.type === 'text' || el.type === 'image') {
      const parts = [];
      const line = el.type === 'shape' && B.shapeById(el.shape).line;
      if (el.type !== 'image' && !line) parts.push(field('Fill', colorField(el.fill, (c) => set('fill', c), { noneLabel: 'No fill' })));
      parts.push(field(el.type === 'image' ? 'Border' : 'Line', colorField(el.stroke, (c) => {
        els.forEach((x) => c !== 'none' && !x.strokeWidth && (x.strokeWidth = 1.5));
        set('stroke', c);
      }, { noneLabel: 'No line' })));
      parts.push(field('Width (pt)', num(el.strokeWidth || 0, (v) => set('strokeWidth', Math.max(0, v)), { step: 0.25, min: 0 })));
      parts.push(field('Dash', selectEl([['solid', 'Solid'], ['dash', 'Dash'], ['dot', 'Round dot'], ['dashdot', 'Dash dot']], el.dash || 'solid', (v) => set('dash', v))));
      body.appendChild(section(el.type === 'image' ? 'Border' : 'Fill & Line', parts));
    }

    // effects
    const op = Math.round((1 - (el.opacity == null ? 1 : el.opacity)) * 100);
    const shadow = h('input', { type: 'checkbox' });
    shadow.checked = !!el.shadow;
    shadow.addEventListener('change', () => set('shadow', shadow.checked));
    body.appendChild(
      section('Effects', [
        field('Transparency', range(op, (v) => live('opacity', 1 - v / 100), commitLive, { suffix: '%' })),
        h('label', { class: 'pane-check' }, shadow, h('span', {}, 'Shadow')),
      ])
    );

    // text options
    if (M.isTextual(el)) {
      const auto = h('input', { type: 'checkbox' });
      auto.checked = !!el.autoHeight;
      auto.disabled = el.type !== 'text';
      auto.addEventListener('change', () => {
        set('autoHeight', auto.checked);
        if (auto.checked) els.forEach((x) => E().fitText(x));
        E().drawSelection();
      });
      body.appendChild(
        section('Text Box', [
          field('Vertical alignment', selectEl([['top', 'Top'], ['middle', 'Middle'], ['bottom', 'Bottom']], el.valign || 'top', (v) => set('valign', v))),
          field('Line spacing', selectEl([['1', '0.83'], ['1.2', '1.0 (Single)'], ['1.5', '1.25'], ['1.8', '1.5'], ['2.4', '2.0']], String(el.lineHeight || 1.2), (v) => set('lineHeight', +v))),
          field('Columns', selectEl([['1', '1'], ['2', '2'], ['3', '3']], String(el.columns || 1), (v) => set('columns', +v))),
          field('Inner margin (px)', num(el.pad == null ? '' : el.pad, (v) => set('pad', Math.max(0, v)), { dec: 0, min: 0 })),
          h('label', { class: 'pane-check' }, auto, h('span', {}, 'Resize shape to fit text')),
        ])
      );
    }

    // picture
    if (el.type === 'image' && els.length === 1) {
      const c = el.crop || { l: 0, t: 0, r: 0, b: 0 };
      const cropRow = (k, label) =>
        field(label, range(Math.round(c[k] * 100), (v) => {
          const nc = Object.assign({}, el.crop || { l: 0, t: 0, r: 0, b: 0 }, { [k]: Math.min(v / 100, 0.9 - (c[{ l: 'r', r: 'l', t: 'b', b: 't' }[k]] || 0)) });
          el.crop = nc;
          E().refreshEl(el);
        }, commitLive, { max: 80, suffix: '%' }));
      body.appendChild(
        section('Picture', [
          field('Filter', selectEl([['none', 'None'], ['grayscale', 'Grayscale'], ['sepia', 'Sepia'], ['bright', 'Brighten'], ['dark', 'Darken'], ['contrast', 'High contrast'], ['blur', 'Blur'], ['invert', 'Invert']], el.filter || 'none', (v) => set('filter', v))),
          field('Shape', selectEl([['none', 'Rectangle'], ['rounded', 'Rounded'], ['circle', 'Circle / Oval']], el.mask || 'none', (v) => set('mask', v))),
          h('div', { class: 'pane-sub' }, 'Crop'),
          cropRow('l', 'Left'),
          cropRow('r', 'Right'),
          cropRow('t', 'Top'),
          cropRow('b', 'Bottom'),
          field('Alt text', (() => {
            const t = h('textarea', { class: 'field', rows: 2, placeholder: 'Describe this picture…' });
            t.value = el.alt || '';
            t.addEventListener('change', () => {
              el.alt = t.value;
              B.store.commit();
              B.emit('content');
            });
            return t;
          })()),
        ])
      );
    }

    if (el.type === 'equation') {
      const ta = h('textarea', { class: 'field mono', rows: 3 });
      ta.value = el.latex;
      ta.addEventListener('change', () => {
        el.latex = ta.value;
        E().changed(true);
      });
      const edit = h('button', { class: 'btn sm', type: 'button', html: U.icon('functions') + 'Equation Editor…' });
      edit.addEventListener('click', () => B.dialogs.equation(el));
      body.appendChild(
        section('Equation', [
          field('LaTeX', ta),
          field('Size (pt)', num(el.size, (v) => set('size', U.clamp(v, 6, 200)), { dec: 0 })),
          field('Color', colorField(el.color, (c) => set('color', c), { allowNone: false, allowAuto: true })),
          edit,
        ])
      );
    }

    if (el.type === 'table') {
      body.appendChild(
        section('Table', [
          field('Font size (pt)', num(el.size || 16, (v) => set('size', U.clamp(v, 6, 96)), { dec: 0 })),
          field('Style color', colorField(el.accent, (c) => set('accent', c), { allowNone: false })),
        ])
      );
    }

    const linkI = h('input', { class: 'field', type: 'url', placeholder: 'https://', value: el.link || '' });
    linkI.addEventListener('change', () => set('link', linkI.value.trim() || null, false));
    body.appendChild(section('Link', [field('Open when clicked in a slide show', linkI)], !!el.link));
  }

  /* ---------------- animation pane ---------------- */
  function animPane(body) {
    const slide = B.curSlide();
    const order = B.animOrder(slide);
    const play = h('button', { class: 'btn primary sm', type: 'button', html: U.icon('play_arrow') + (A.selection.length ? 'Play Selected' : 'Play All') });
    play.addEventListener('click', () => B.show.previewAnimations(A.selection.length ? A.selection : null));
    const up = h('button', { class: 'icon-btn', type: 'button', title: 'Move earlier', html: U.icon('arrow_upward') });
    const dn = h('button', { class: 'icon-btn', type: 'button', title: 'Move later', html: U.icon('arrow_downward') });
    up.addEventListener('click', () => B.actions.moveAnim(-1));
    dn.addEventListener('click', () => B.actions.moveAnim(1));
    body.appendChild(h('div', { class: 'btn-row' }, play, h('span', { class: 'spacer' }), up, dn));
    if (!order.length) {
      body.appendChild(h('p', { class: 'pane-empty' }, 'No animations on this slide yet. Select an object, then pick an effect on the Animations tab.'));
      return;
    }
    let step = 0;
    const list = h('div', { class: 'anim-list' });
    order.forEach((el, i) => {
      if (el.anim.start === 'click' || i === 0) step += el.anim.start === 'click' ? 1 : 0;
      const def = B.animById(el.anim.effect) || { name: el.anim.effect, kind: 'entrance', icon: 'auto_awesome' };
      const nm = P.elName(el, slide);
      const row = h('div', { class: 'anim-row k-' + def.kind + (A.selection.includes(el.id) ? ' on' : '') });
      row.append(
        h('span', { class: 'anim-step' }, el.anim.start === 'click' ? String(step) : ''),
        h('span', { class: 'anim-start', title: { click: 'On Click', with: 'With Previous', after: 'After Previous' }[el.anim.start], html: U.icon({ click: 'mouse', with: 'link', after: 'schedule' }[el.anim.start] || 'mouse') }),
        h('span', { class: 'anim-ico', html: U.icon(def.icon) }),
        h('span', { class: 'anim-name' }, h('b', {}, nm.name), h('small', {}, `${def.name} · ${el.anim.duration}s${el.anim.delay ? ` · +${el.anim.delay}s` : ''}`))
      );
      const del = h('button', { class: 'icon-btn xs', type: 'button', title: 'Remove animation', html: U.icon('close') });
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        delete el.anim;
        B.store.commit();
        B.emit('content');
        P.render();
      });
      row.appendChild(del);
      row.addEventListener('click', () => E().select([el.id]));
      list.appendChild(row);
    });
    body.appendChild(list);
    const one = B.selectedEls().find((e) => e.anim);
    if (one) {
      const a = one.anim;
      body.appendChild(
        section('Timing', [
          field('Start', selectEl([['click', 'On Click'], ['with', 'With Previous'], ['after', 'After Previous']], a.start, (v) => B.actions.setAnimProp('start', v))),
          field('Duration (s)', num(a.duration, (v) => B.actions.setAnimProp('duration', U.clamp(v, 0.05, 20)), { step: 0.1 })),
          field('Delay (s)', num(a.delay || 0, (v) => B.actions.setAnimProp('delay', U.clamp(v, 0, 60)), { step: 0.25 })),
          (B.animById(a.effect) || {}).dirs ? field('Direction', selectEl([['bottom', 'From Bottom'], ['left', 'From Left'], ['right', 'From Right'], ['top', 'From Top']], a.dir || 'bottom', (v) => B.actions.setAnimProp('dir', v))) : null,
        ].filter(Boolean))
      );
    }
  }

  /* ---------------- background pane ---------------- */
  function bgPane(body) {
    const slide = B.curSlide();
    const bg = slide.background || null;
    const type = bg ? bg.type : 'theme';
    const setBg = (b, render = true) => {
      slide.background = b;
      if (render) E().changed(true);
      B.emit('slides');
    };
    const radios = h('div', { class: 'radio-col' });
    [['theme', 'Theme background'], ['solid', 'Solid fill'], ['gradient', 'Gradient fill'], ['image', 'Picture fill']].forEach(([v, l]) => {
      const r = h('input', { type: 'radio', name: 'bgtype', value: v });
      r.checked = type === v;
      r.addEventListener('change', async () => {
        if (v === 'theme') setBg(null);
        else if (v === 'solid') setBg({ type: 'solid', color: '@accent1:l2' });
        else if (v === 'gradient') setBg({ type: 'gradient', from: '@accent1', to: '@accent2', angle: 135 });
        else if (v === 'image') {
          const f = await U.pickFile('image/*');
          if (!f) return P.render();
          const data = await U.shrinkImage(await U.readFile(f));
          setBg({ type: 'image', asset: M.addAsset(data) });
        }
        P.render();
      });
      radios.appendChild(h('label', { class: 'pane-check' }, r, h('span', {}, l)));
    });
    body.appendChild(section('Fill', radios));
    if (type === 'solid') body.appendChild(section('Color', [field('Color', colorField(bg.color, (c) => setBg({ type: 'solid', color: c }), { allowNone: false }))]));
    if (type === 'gradient') {
      body.appendChild(
        section('Gradient', [
          field('From', colorField(bg.from, (c) => setBg(Object.assign({}, bg, { from: c })), { allowNone: false })),
          field('To', colorField(bg.to, (c) => setBg(Object.assign({}, bg, { to: c })), { allowNone: false })),
          field('Angle', range(bg.angle == null ? 135 : bg.angle, (v) => {
            slide.background = Object.assign({}, slide.background, { angle: v });
            E().render();
          }, () => {
            B.store.commit();
            B.emit('content');
          }, { max: 360, suffix: '°' })),
        ])
      );
    }
    if (type === 'image') {
      const ch = h('button', { class: 'btn sm', type: 'button', html: U.icon('image') + 'Choose picture…' });
      ch.addEventListener('click', async () => {
        const f = await U.pickFile('image/*');
        if (!f) return;
        setBg({ type: 'image', asset: M.addAsset(await U.shrinkImage(await U.readFile(f))) });
        P.render();
      });
      body.appendChild(section('Picture', [ch]));
    }
    const hide = h('input', { type: 'checkbox' });
    hide.checked = !!slide.hideDecor;
    hide.addEventListener('change', () => B.slides.toggleDecor());
    body.appendChild(h('label', { class: 'pane-check pad' }, hide, h('span', {}, 'Hide background graphics')));
    const all = h('button', { class: 'btn sm', type: 'button', html: U.icon('done_all') + 'Apply to All' });
    all.addEventListener('click', () => {
      A.deck.slides.forEach((s) => {
        s.background = slide.background ? U.clone(slide.background) : null;
        s.hideDecor = slide.hideDecor;
      });
      B.store.commit();
      B.emit('deck');
      B.ui.toast('Background applied to all slides.');
    });
    const reset = h('button', { class: 'btn sm', type: 'button', html: U.icon('restart_alt') + 'Reset Background' });
    reset.addEventListener('click', () => {
      setBg(null);
      P.render();
    });
    body.appendChild(h('div', { class: 'btn-row pad' }, all, reset));
  }
})(window.BSD);
