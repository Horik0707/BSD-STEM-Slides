/* BSD STEM Slides — slide show: transitions, animations, pen & laser, presenter view, audience window */
(function (B) {
  'use strict';
  const U = B.util, A = B.app, R = B.render;
  const h = U.h;
  const S = (B.show = {});
  let st = null;
  const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- animation building ---------------- */
  const buildSteps = (slide) => {
    const order = B.animOrder(slide);
    const steps = [];
    let cur = null, prevStart = 0, prevEnd = 0;
    order.forEach((el, i) => {
      const a = el.anim;
      const start = a.start || 'click';
      if (start === 'click' || !cur) {
        cur = { items: [], auto: i === 0 && start !== 'click' };
        steps.push(cur);
        prevStart = prevEnd = 0;
      }
      let t0 = start === 'with' ? prevStart : start === 'after' ? prevEnd : 0;
      t0 += a.delay || 0;
      const dur = B.animById(a.effect) && a.effect === 'appear' ? 0.001 : a.duration || 0.5;
      cur.items.push({ el, start: t0, dur });
      prevStart = t0;
      prevEnd = Math.max(prevEnd, t0 + dur);
    });
    steps.forEach((s, i) => s.items.forEach((it) => (it.step = i)));
    return steps;
  };
  const stepOf = (steps, id) => {
    for (let i = 0; i < steps.length; i++) if (steps[i].items.some((it) => it.el.id === id)) return i;
    return -1;
  };

  const keyframes = (el, W, H) => {
    const a = el.anim;
    const def = B.animById(a.effect) || { kind: 'entrance' };
    const rot = el.rot || 0;
    const base = rot ? `rotate(${rot}deg)` : 'none';
    const withBase = (t) => (rot ? `${t} rotate(${rot}deg)` : t);
    const o = el.opacity == null ? 1 : el.opacity;
    const dir = a.dir || 'bottom';
    const off = {
      bottom: `translate(0px, ${H - el.y + 20}px)`,
      top: `translate(0px, ${-(el.y + el.h + 20)}px)`,
      left: `translate(${-(el.x + el.w + 20)}px, 0px)`,
      right: `translate(${W - el.x + 20}px, 0px)`,
    }[dir];
    const clip = { left: 'inset(0 100% 0 0)', right: 'inset(0 0 0 100%)', top: 'inset(0 0 100% 0)', bottom: 'inset(100% 0 0 0)' }[dir];
    const ease = 'cubic-bezier(.2,.75,.25,1)';
    switch (a.effect) {
      case 'appear': return { kind: 'entrance', frames: [{ visibility: 'hidden' }, { visibility: 'visible' }] };
      case 'fade': return { kind: 'entrance', frames: [{ opacity: 0 }, { opacity: o }] };
      case 'fly': return { kind: 'entrance', frames: [{ transform: withBase(off) }, { transform: base }], easing: ease };
      case 'float': return { kind: 'entrance', frames: [{ opacity: 0, transform: withBase('translate(0px, 60px)') }, { opacity: o, transform: base }], easing: ease };
      case 'zoom': return { kind: 'entrance', frames: [{ opacity: 0, transform: withBase('scale(.3)') }, { opacity: o, transform: base }], easing: ease };
      case 'wipe': return { kind: 'entrance', frames: [{ clipPath: clip }, { clipPath: 'inset(0 0 0 0)' }] };
      case 'bounce': {
        const t = (y) => withBase(`translate(0px, ${y}px)`);
        return { kind: 'entrance', frames: [{ opacity: 0, transform: t(-260), offset: 0 }, { opacity: o, transform: t(0), offset: 0.45, easing: 'ease-in' }, { transform: t(-60), offset: 0.65, easing: 'ease-out' }, { transform: t(0), offset: 0.8, easing: 'ease-in' }, { transform: t(-16), offset: 0.9 }, { transform: t(0), offset: 1 }] };
      }
      case 'grow-turn': return { kind: 'entrance', frames: [{ opacity: 0, transform: `rotate(${rot - 90}deg) scale(0)` }, { opacity: o, transform: base }], easing: ease };
      case 'pulse': return { kind: 'emphasis', frames: [{ transform: base }, { transform: withBase('scale(1.14)') }, { transform: base }] };
      case 'spin': return { kind: 'emphasis', frames: [{ transform: `rotate(${rot}deg)` }, { transform: `rotate(${rot + 360}deg)` }], easing: 'ease-in-out' };
      case 'teeter': return { kind: 'emphasis', frames: [0, 7, -7, 7, -7, 0].map((d) => ({ transform: `rotate(${rot + d}deg)` })) };
      case 'flash': return { kind: 'emphasis', frames: [{ opacity: o }, { opacity: 0.15 }, { opacity: o }, { opacity: 0.15 }, { opacity: o }] };
      case 'disappear': return { kind: 'exit', frames: [{ visibility: 'visible' }, { visibility: 'hidden' }] };
      case 'fade-out': return { kind: 'exit', frames: [{ opacity: o }, { opacity: 0 }] };
      case 'fly-out': return { kind: 'exit', frames: [{ transform: base }, { transform: withBase(off) }], easing: 'cubic-bezier(.7,0,.8,.3)' };
      case 'zoom-out': return { kind: 'exit', frames: [{ opacity: o, transform: base }, { opacity: 0, transform: withBase('scale(.3)') }] };
      default: return { kind: def.kind, frames: [{ opacity: 0 }, { opacity: o }] };
    }
  };

  /** Set every animated element on a layer to its state after `k` steps. */
  const applyState = (layer, steps, k) => {
    steps.forEach((s, si) =>
      s.items.forEach((it) => {
        const n = layer.querySelector(`.el[data-id="${CSS.escape(it.el.id)}"]`);
        if (!n) return;
        n.getAnimations().forEach((a) => a.cancel());
        const kind = (B.animById(it.el.anim.effect) || { kind: 'entrance' }).kind;
        const done = si < k;
        n.style.visibility = kind === 'entrance' ? (done ? '' : 'hidden') : kind === 'exit' ? (done ? 'hidden' : '') : '';
      })
    );
  };

  /** Play one build step on a layer. Resolves when finished. */
  const playStep = (layer, step, W, H, running) => {
    const anims = [];
    for (const it of step.items) {
      const n = layer.querySelector(`.el[data-id="${CSS.escape(it.el.id)}"]`);
      if (!n) continue;
      const kf = keyframes(it.el, W, H);
      if (kf.kind === 'entrance') n.style.visibility = '';
      const an = n.animate(kf.frames, { duration: Math.max(1, it.dur * 1000), delay: it.start * 1000, fill: 'both', easing: kf.easing || 'ease-out' });
      an.onfinish = () => {
        an.cancel();
        if (kf.kind === 'exit') n.style.visibility = 'hidden';
      };
      anims.push(an);
      if (running) running.push(an);
    }
    return Promise.all(anims.map((a) => a.finished.catch(() => null)));
  };

  /* ---------------- transitions ---------------- */
  const doTransition = (box, oldL, newL, t) => {
    const type = reduced() && t.type !== 'none' ? 'fade' : t.type;
    const dur = Math.max(50, (t.duration || 0.7) * 1000);
    const dir = t.dir || 'right';
    const from = { right: 'translateX(100%)', left: 'translateX(-100%)', bottom: 'translateY(100%)', top: 'translateY(-100%)' }[dir];
    const to = { right: 'translateX(-100%)', left: 'translateX(100%)', bottom: 'translateY(-100%)', top: 'translateY(100%)' }[dir];
    const opts = { duration: dur, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both' };
    box.appendChild(newL);
    const anims = [];
    const an = (node, frames, o = {}) => anims.push(node.animate(frames, Object.assign({}, opts, o)));
    switch (type) {
      case 'fade': an(newL, [{ opacity: 0 }, { opacity: 1 }], { easing: 'linear' }); break;
      case 'push': an(newL, [{ transform: from }, { transform: 'none' }]); an(oldL, [{ transform: 'none' }, { transform: to }]); break;
      case 'wipe': an(newL, [{ clipPath: { right: 'inset(0 0 0 100%)', left: 'inset(0 100% 0 0)', bottom: 'inset(100% 0 0 0)', top: 'inset(0 0 100% 0)' }[dir] }, { clipPath: 'inset(0 0 0 0)' }]); break;
      case 'split': an(newL, [{ clipPath: 'inset(0 50% 0 50%)' }, { clipPath: 'inset(0 0% 0 0%)' }]); break;
      case 'cover': an(newL, [{ transform: from }, { transform: 'none' }]); break;
      case 'uncover': oldL.style.zIndex = 2; an(oldL, [{ transform: 'none' }, { transform: to }]); break;
      case 'zoom': an(newL, [{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'none' }]); break;
      case 'flip':
        box.classList.add('persp');
        an(oldL, [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(-90deg)' }], { duration: dur / 2, easing: 'ease-in' });
        an(newL, [{ transform: 'rotateY(90deg)' }, { transform: 'rotateY(0deg)' }], { duration: dur / 2, delay: dur / 2, easing: 'ease-out' });
        break;
      case 'cube': {
        box.classList.add('persp');
        const horiz = dir === 'right' || dir === 'left';
        const s = dir === 'right' || dir === 'bottom' ? 1 : -1;
        const ax = horiz ? 'Y' : 'X';
        const tr = horiz ? 'X' : 'Y';
        oldL.style.transformOrigin = horiz ? (s > 0 ? '100% 50%' : '0% 50%') : s > 0 ? '50% 100%' : '50% 0%';
        newL.style.transformOrigin = horiz ? (s > 0 ? '0% 50%' : '100% 50%') : s > 0 ? '50% 0%' : '50% 100%';
        const sg = horiz ? s : -s;
        an(oldL, [{ transform: `translate${tr}(0) rotate${ax}(0deg)` }, { transform: `translate${tr}(${-s * 100}%) rotate${ax}(${-sg * 90}deg)` }]);
        an(newL, [{ transform: `translate${tr}(${s * 100}%) rotate${ax}(${sg * 90}deg)` }, { transform: `translate${tr}(0) rotate${ax}(0deg)` }]);
        break;
      }
      case 'kindle': {
        // e-reader page turn: pages slide sideways, continuing from wherever a swipe let go
        const w = box.clientWidth || 1;
        const off = t.offset || 0;
        const d = t.dir === 'prev' ? 1 : -1;
        const ms = reduced() ? 1 : Math.max(140, 420 * (1 - Math.min(1, Math.abs(off) / w)));
        const o = { duration: ms, easing: 'cubic-bezier(.22,.8,.3,1)' };
        newL.classList.add('page-edge');
        an(oldL, [{ transform: `translateX(${off}px)` }, { transform: `translateX(${d * w}px)` }], o);
        an(newL, [{ transform: `translateX(${off - d * w}px)` }, { transform: 'translateX(0px)' }], o);
        break;
      }
      case 'page': {
        // a paper page turning over its left edge to reveal the next one
        box.classList.add('persp');
        oldL.style.zIndex = 2;
        oldL.style.transformOrigin = '0% 50%';
        an(oldL, [{ transform: 'rotateY(0deg)', filter: 'brightness(1)' }, { transform: 'rotateY(-95deg)', filter: 'brightness(.55)' }], { easing: 'cubic-bezier(.45,.05,.55,.95)' });
        an(newL, [{ filter: 'brightness(.6)' }, { filter: 'brightness(1)' }], { easing: 'ease-out' });
        break;
      }
      default: break;
    }
    return Promise.all(anims.map((a) => a.finished.catch(() => null))).then(() => {
      anims.forEach((a) => a.cancel());
      if (oldL && oldL.parentNode) oldL.remove();
      newL.style.transformOrigin = '';
      newL.style.transform = '';
      newL.classList.remove('page-edge');
      box.classList.remove('persp');
    });
  };

  /* ---------------- layers ---------------- */
  const makeLayer = (deck, index, k) => {
    const layer = h('div', { class: 'show-layer' });
    const s = R.slide(deck.slides[index], { mode: 'show', index, deck });
    s.style.transform = `scale(${k})`;
    s.style.transformOrigin = '0 0';
    layer.appendChild(s);
    return layer;
  };

  /* ---------------- public: start ---------------- */
  S.isRunning = () => !!st;

  S.start = (index = 0, opts = {}) => {
    if (st) return;
    if (B.editor && A.editingId) B.editor.endEdit();
    B.ui.closeMenus();
    const deck = opts.deck || A.deck;
    const root = U.$('#show');
    root.innerHTML = '';
    root.hidden = false;
    root.className = (opts.presenter ? 'presenter' : opts.reading ? 'reading' : opts.audience ? 'audience' : 'fullshow') + (B.isBook(deck) ? ' book' : '');
    st = {
      deck, index: -1, step: 0, steps: [], layer: null, running: [], ink: {}, tool: 'pointer', pen: { color: '#E03131', width: 3, alpha: 1 },
      presenter: !!opts.presenter, reading: !!opts.reading, audienceMode: !!opts.audience, black: null, ended: false,
      t0: Date.now(), elapsed: 0, paused: false, typed: '', audience: null, timers: [], advanceTimer: null, wheelAt: 0, k: 1, lastShown: index,
      // automatic (timed) shows advance by themselves; the projector window just mirrors the presenter
      auto: deck.showMode === 'auto' && !opts.audience, autoPaused: false, autoToken: 0, slideStart: Date.now(),
    };
    buildDom(root);
    B.media.showStart({ muted: st.audienceMode }); // the projector window stays silent; sound comes from the presenter
    B.model3d.onPose = (id, pose) => {
      // mirror the presenter's view of a 3D model on the projector
      if (st && st.audience && !st.audience.closed) st.audience.postMessage({ t: 'pose', id, pose }, location.origin);
    };
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onResize);
    if (!st.reading && !st.audienceMode && !st.presenter) {
      const de = document.documentElement;
      if (de.requestFullscreen && !document.fullscreenElement) de.requestFullscreen().then(() => (st && (st.fs = true))).catch(() => {});
    }
    document.addEventListener('fullscreenchange', onFsChange);
    if (st.presenter) st.clock = setInterval(updatePresenterClock, 500);
    onResize();
    // start on the requested slide even if hidden (PowerPoint does the same)
    go(U.clamp(index, 0, deck.slides.length - 1), { transition: false });
  };

  function buildDom(root) {
    const stage = h('div', { class: 'show-stage' });
    const box = h('div', { class: 'show-box' });
    const ink = h('canvas', { class: 'show-ink' });
    const laser = h('div', { class: 'show-laser', hidden: true });
    const curtain = h('div', { class: 'show-curtain', hidden: true });
    const end = h('div', { class: 'show-end', hidden: true }, 'End of slide show. Click to exit.');
    const typed = h('div', { class: 'show-typed', hidden: true });
    box.append(ink, laser);
    stage.append(box, curtain, end, typed);
    st.dom = { root, stage, box, ink, laser, curtain, end, typed };
    stage.addEventListener('click', onClick);
    stage.addEventListener('contextmenu', onContext);
    stage.addEventListener('wheel', onWheel, { passive: false });
    stage.addEventListener('pointermove', onMove);
    if (B.isBook(st.deck)) {
      // e-reader style footer: page count, percent read and a progress line
      const pg = h('span', { class: 'bf-page' });
      const pct = h('span', { class: 'bf-pct' });
      const bar = h('i', {});
      stage.appendChild(h('div', { class: 'book-footer' }, pg, h('span', { class: 'bf-track' }, bar), pct));
      Object.assign(st.dom, { bfPage: pg, bfPct: pct, bfBar: bar });
    }
    if (st.auto) {
      const bar = h('div', { class: 'auto-bar', title: 'Time until the next slide' }, h('i', {}));
      stage.appendChild(bar);
      st.dom.autoBar = bar.firstChild;
    }
    initSwipe(stage);
    initInk();
    const toolbar = buildToolbar();
    if (st.presenter) {
      const top = h('div', { class: 'pv-top' });
      const timer = h('span', { class: 'pv-timer' }, '0:00');
      const pause = h('button', { class: 'pv-btn', type: 'button', title: 'Pause timer', html: U.icon('pause') });
      const reset = h('button', { class: 'pv-btn', type: 'button', title: 'Restart timer', html: U.icon('restart_alt') });
      pause.addEventListener('click', () => {
        st.paused = !st.paused;
        if (st.paused) st.elapsed += Date.now() - st.t0;
        else st.t0 = Date.now();
        pause.innerHTML = U.icon(st.paused ? 'play_arrow' : 'pause');
      });
      reset.addEventListener('click', () => {
        st.elapsed = 0;
        st.t0 = Date.now();
      });
      const clock = h('span', { class: 'pv-clock' });
      const count = h('span', { class: 'pv-count' });
      const aud = h('button', { class: 'pv-btn labeled', type: 'button', title: 'Open a second window for the projector', html: U.icon('cast') + '<span>Audience Window</span>' });
      aud.addEventListener('click', openAudience);
      const endB = h('button', { class: 'pv-btn labeled danger', type: 'button', html: U.icon('close') + '<span>End Show</span>' });
      endB.addEventListener('click', S.exit);
      top.append(h('div', { class: 'pv-group' }, timer, pause, reset), clock, count, h('div', { class: 'pv-group' }, aud, endB));
      const side = h('div', { class: 'pv-side' });
      const nextBox = h('div', { class: 'pv-next' });
      const notes = h('div', { class: 'pv-notes', tabindex: '0' });
      const nsize = U.storage.get('pvNotesSize', 20);
      notes.style.fontSize = nsize + 'px';
      const zoomN = (d) => {
        const v = U.clamp(parseInt(notes.style.fontSize, 10) + d, 12, 48);
        notes.style.fontSize = v + 'px';
        U.storage.set('pvNotesSize', v);
      };
      const nb = (i, t, fn) => {
        const b = h('button', { class: 'pv-btn', type: 'button', title: t, html: U.icon(i) });
        b.addEventListener('click', fn);
        return b;
      };
      side.append(h('div', { class: 'pv-label' }, 'Next'), nextBox, h('div', { class: 'pv-label row' }, h('span', {}, 'Notes'), h('span', {}, nb('text_decrease', 'Smaller notes', () => zoomN(-2)), nb('text_increase', 'Larger notes', () => zoomN(2)))), notes);
      const main = h('div', { class: 'pv-main' }, h('div', { class: 'pv-current' }, stage, toolbar), side);
      root.append(top, main);
      Object.assign(st.dom, { timer, clock, count, nextBox, notes });
    } else {
      root.append(stage, toolbar);
      if (st.reading) {
        const bar = h('div', { class: 'reading-bar' });
        const title = h('span', { class: 'rb-title' }, st.deck.title);
        const count = h('span', { class: 'rb-count' });
        const b = (i, t, fn) => {
          const x = h('button', { class: 'pv-btn', type: 'button', title: t, html: U.icon(i) });
          x.addEventListener('click', fn);
          return x;
        };
        bar.append(title, h('span', { class: 'spacer' }), b('chevron_left', 'Previous', prev), count, b('chevron_right', 'Next', next), b('menu', 'Menu', (e) => onContext(e)), b('close', 'Exit reading view', S.exit));
        root.appendChild(bar);
        st.dom.count = count;
      }
    }
    if (st.audienceMode) {
      const fsHint = h('button', { class: 'aud-fs', type: 'button', html: U.icon('fullscreen') + ' Click for full screen (or press F11)' });
      fsHint.addEventListener('click', (e) => {
        e.stopPropagation();
        document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {});
        fsHint.remove();
      });
      root.appendChild(fsHint);
    }
  }

  function buildToolbar() {
    const tb = h('div', { class: 'show-toolbar' });
    const b = (icon, title, fn) => {
      const x = h('button', { class: 'st-btn', type: 'button', title, 'aria-label': title, html: U.icon(icon) });
      x.addEventListener('click', (e) => {
        e.stopPropagation();
        fn(x, e);
      });
      return x;
    };
    tb.append(
      ...[
      b('arrow_back', 'Previous', prev),
      b('arrow_forward', 'Next', next),
      b('edit', 'Pen & laser', (x) => B.ui.menu(penMenu(), 0, 0, { anchor: x })),
      b('apps', 'See all slides (G)', overview),
      st.auto ? b('pause', 'Pause automatic show (S)', (x) => toggleAuto(x)) : null,
      b('more_horiz', 'More', (x) => B.ui.menu(moreMenu(), 0, 0, { anchor: x })),
      ].filter(Boolean)
    );
    if (st.presenter) tb.classList.add('always');
    st.dom = st.dom || {};
    return tb;
  }

  const PENS = [['#E03131', 'Red'], ['#1971C2', 'Blue'], ['#2F9E44', 'Green'], ['#000000', 'Black'], ['#FFFFFF', 'White']];
  function penMenu() {
    return [
      { label: 'Laser Pointer', icon: 'flare', shortcut: 'Ctrl+L', checked: st.tool === 'laser', action: () => setTool('laser') },
      { label: 'Pen', icon: 'edit', shortcut: 'Ctrl+P', checked: st.tool === 'pen', action: () => setTool('pen') },
      { label: 'Highlighter', icon: 'ink_highlighter', shortcut: 'Ctrl+I', checked: st.tool === 'highlighter', action: () => setTool('highlighter') },
      { label: 'Eraser', icon: 'ink_eraser', shortcut: 'Ctrl+E', checked: st.tool === 'eraser', action: () => setTool('eraser') },
      { label: 'Ink Color', icon: 'palette', sub: PENS.map(([c, n]) => ({ label: n, icon: `<span class="dot" style="background:${c}"></span>`, checked: st.pen.color === c, action: () => { st.pen.color = c; if (st.tool !== 'pen' && st.tool !== 'highlighter') setTool('pen'); } })) },
      { label: 'Erase All Ink on Slide', icon: 'delete_sweep', shortcut: 'E', action: clearInk },
      { sep: true },
      { label: 'Arrow (pointer)', icon: 'arrow_selector_tool', shortcut: 'Ctrl+A', checked: st.tool === 'pointer', action: () => setTool('pointer') },
    ];
  }
  function moreMenu() {
    return [
      { label: 'Next', icon: 'arrow_forward', action: next },
      { label: 'Previous', icon: 'arrow_back', action: prev },
      { label: B.isBook(st.deck) ? 'Go to Page' : 'Go to Slide', icon: 'list', sub: st.deck.slides.map((s, i) => ({ label: `${i + 1}. ${slideTitle(s) || (B.isBook(st.deck) ? 'Page ' : 'Slide ') + (i + 1)}${s.hidden ? ' (hidden)' : ''}`, checked: i === st.index, action: () => go(i, { transition: true }) })) },
      { label: 'See All Slides', icon: 'apps', shortcut: 'G', action: overview },
      st.auto ? { label: st.autoPaused ? 'Resume Automatic Show' : 'Pause Automatic Show', icon: st.autoPaused ? 'play_arrow' : 'pause', shortcut: 'S', action: () => toggleAuto() } : null,
      { sep: true },
      { label: 'Black Screen', icon: 'brightness_1', shortcut: 'B', action: () => curtain('black') },
      { label: 'White Screen', icon: 'radio_button_unchecked', shortcut: 'W', action: () => curtain('white') },
      st.presenter || st.audienceMode ? null : { label: 'Show Presenter View', icon: 'co_present', action: () => { const i = st.index; S.exit(); S.start(i, { presenter: true }); } },
      { sep: true },
      { label: 'End Show', icon: 'close', shortcut: 'Esc', action: S.exit },
    ];
  }
  const slideTitle = (s) => {
    const t = s.elements.find((e) => e.placeholder === 'title');
    return t ? U.htmlToText(t.html).split('\n')[0] : '';
  };

  /* ---------------- layout ---------------- */
  function onResize() {
    if (!st) return;
    const { stage, box, ink } = st.dom;
    const W = st.deck.w, H = st.deck.h;
    const r = stage.getBoundingClientRect();
    const reserve = B.isBook(st.deck) ? 44 : 0; // room for the page footer
    const k = Math.max(0.05, Math.min(r.width / W, (r.height - reserve) / H));
    st.k = k;
    box.style.width = W * k + 'px';
    box.style.height = H * k + 'px';
    U.$$('.show-layer > .slide', box).forEach((s) => (s.style.transform = `scale(${k})`));
    const dpr = window.devicePixelRatio || 1;
    ink.width = Math.round(W * k * dpr);
    ink.height = Math.round(H * k * dpr);
    ink.style.width = W * k + 'px';
    ink.style.height = H * k + 'px';
    redrawInk();
    if (st.presenter) renderNext();
  }
  function onFsChange() {
    if (!st) return;
    if (!document.fullscreenElement && st.fs && !st.presenter && !st.audienceMode) S.exit();
    setTimeout(onResize, 50);
  }

  /* ---------------- navigation ---------------- */
  const N = () => st.deck.slides.length;
  const nextVisible = (i) => {
    let j = i + 1;
    while (j < N() && st.deck.slides[j].hidden) j++;
    return j;
  };
  const prevVisible = (i) => {
    let j = i - 1;
    while (j >= 0 && st.deck.slides[j].hidden) j--;
    return j;
  };

  async function go(i, o = {}) {
    if (!st) return;
    clearTimeout(st.advanceTimer);
    st.autoToken++; // stop the previous slide's timer
    resetAutoBar();
    finishRunning();
    if (i >= N()) {
      if (st.deck.loop) i = nextVisible(-1) < N() ? nextVisible(-1) : 0;
      else return showEnd();
    }
    if (i < 0) return;
    st.ended = false;
    st.dom.end.hidden = true;
    const slide = st.deck.slides[i];
    const prevIndex = st.index;
    st.index = i;
    st.lastShown = i;
    st.steps = buildSteps(slide);
    st.step = o.step === 'end' ? st.steps.length : o.step || 0;
    const layer = makeLayer(st.deck, i, st.k);
    applyState(layer, st.steps, st.step);
    B.media.bindLayer(layer, slide);
    const old = st.layer;
    st.layer = layer;
    let t = slide.transition || { type: 'none' };
    const back = o.back != null ? o.back : prevIndex > i;
    if (B.isBook(st.deck) && prevIndex !== i) {
      // books always turn sideways: forward pages arrive from the right, going back from the left.
      // A slide's own transition still plays when moving forward without a swipe.
      if (back || st.pendingOffset != null || !t.type || t.type === 'none') t = { type: 'kindle', dir: back ? 'prev' : 'next', offset: st.pendingOffset || 0 };
    }
    st.pendingOffset = null;
    redrawInk();
    updateChrome();
    sync();
    if (old && o.transition !== false && t.type && t.type !== 'none' && prevIndex !== i) {
      st.transitioning = true;
      await doTransition(st.dom.box, old, layer, t);
      if (!st) return;
      st.transitioning = false;
    } else {
      if (old) old.remove();
      st.dom.box.insertBefore(layer, st.dom.ink);
    }
    if (st.layer !== layer) return;
    st.dom.box.insertBefore(layer, st.dom.ink); // keep the ink canvas on top
    st.slideStart = Date.now();
    B.media.enterSlide(slide, { all: st.auto && st.deck.autoAudio !== false });
    if (st.auto) return startAuto();
    if (st.step === 0 && st.steps[0] && st.steps[0].auto) await runStep();
    scheduleAdvance();
  }

  /* ---------------- automatic (timed) shows ---------------- */
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const slideSeconds = (slide) => (st.deck.useTimings !== false && slide.advanceAfter != null ? slide.advanceAfter : st.deck.slideDuration || 5);

  /** Play the rest of this slide's builds, hold it for its time (and its audio), then move on. */
  async function startAuto() {
    if (!st || !st.auto || st.autoPaused || st.ended || st.audienceMode) return;
    const token = ++st.autoToken;
    const idx = st.index;
    const alive = () => st && st.autoToken === token && !st.autoPaused && st.index === idx;
    const slide = st.deck.slides[idx];
    while (alive() && st.step < st.steps.length) {
      if (!(st.step === 0 && st.steps[0].auto)) await sleep(700); // a beat between automatic builds
      if (!alive()) return;
      await runStep();
    }
    if (!alive()) return;
    const wait = Math.max(0, slideSeconds(slide) * 1000 - (Date.now() - st.slideStart));
    runAutoBar(wait);
    await sleep(wait);
    if (!alive()) return;
    if (st.deck.waitForAudio !== false) {
      await B.media.waitForSlide(slide, alive);
      if (!alive()) return;
    }
    go(nextVisible(st.index), { transition: true });
  }
  function runAutoBar(ms) {
    const i = st && st.dom.autoBar;
    if (!i) return;
    i.style.transition = 'none';
    i.style.width = '0%';
    void i.offsetWidth;
    i.style.transition = `width ${ms}ms linear`;
    i.style.width = '100%';
  }
  function resetAutoBar() {
    const i = st && st.dom.autoBar;
    if (!i) return;
    i.style.transition = 'none';
    i.style.width = '0%';
  }
  function toggleAuto(btn) {
    if (!st || !st.auto) return;
    st.autoPaused = !st.autoPaused;
    st.autoToken++;
    resetAutoBar();
    st.dom.root.classList.toggle('auto-paused', st.autoPaused);
    U.$$('.st-btn[title^="Pause"], .st-btn[title^="Resume"]', st.dom.root).concat(btn ? [btn] : []).forEach((b) => {
      b.innerHTML = U.icon(st.autoPaused ? 'play_arrow' : 'pause');
      b.title = st.autoPaused ? 'Resume automatic show (S)' : 'Pause automatic show (S)';
    });
    B.ui.toast(st.autoPaused ? 'Automatic show paused — press S to resume' : 'Automatic show resumed', 1600);
    if (!st.autoPaused) {
      st.slideStart = Date.now();
      startAuto();
    }
  }
  /** After a manual click/key in an automatic show, keep the timer going from here. */
  const resumeAutoAfter = (p) => {
    if (!st || !st.auto) return;
    Promise.resolve(p).then(() => {
      if (!st || st.autoPaused) return;
      st.slideStart = Date.now();
      startAuto();
    });
  };

  function finishRunning() {
    if (!st) return false;
    const live = st.running.filter((a) => a.playState === 'running' || a.playState === 'pending');
    live.forEach((a) => {
      try {
        a.finish();
      } catch (e) {
        /* ignore */
      }
    });
    st.running = [];
    return live.length > 0;
  }

  async function runStep() {
    if (!st || st.step >= st.steps.length) return;
    const step = st.steps[st.step];
    st.step++;
    sync();
    updateChrome();
    await playStep(st.layer, step, st.deck.w, st.deck.h, st.running);
    scheduleAdvance();
  }

  function scheduleAdvance() {
    if (!st || st.audienceMode || st.auto) return;
    clearTimeout(st.advanceTimer);
    const s = st.deck.slides[st.index];
    if (!s || s.advanceAfter == null || st.deck.useTimings === false) return;
    st.advanceTimer = setTimeout(() => st && next(), s.advanceAfter * 1000);
  }

  function next() {
    if (!st) return;
    if (st.audienceMode) return sendNav(1);
    if (st.black) return curtain(null);
    if (st.ended) return S.exit();
    if (finishRunning() || st.transitioning) return;
    // a click first starts any audio set to play "On Next Click"
    if (!st.auto && B.media.playNext(st.deck.slides[st.index])) return;
    if (st.step < st.steps.length) {
      if (st.auto) st.autoToken++;
      const p = runStep();
      resumeAutoAfter(p);
      return p;
    }
    go(nextVisible(st.index), { transition: true });
  }
  function prev() {
    if (!st) return;
    if (st.audienceMode) return sendNav(-1);
    if (st.black) return curtain(null);
    if (st.ended) {
      st.ended = false;
      st.dom.end.hidden = true;
      return go(st.index, { transition: false, step: 'end' });
    }
    if (st.transitioning) return;
    finishRunning();
    if (st.step > 0) {
      st.step--;
      applyState(st.layer, st.steps, st.step);
      sync();
      updateChrome();
      if (st.auto) {
        st.autoToken++;
        resetAutoBar();
        resumeAutoAfter();
      }
      return;
    }
    const j = prevVisible(st.index);
    if (j >= 0) go(j, { transition: B.isBook(st.deck), back: true, step: 'end' });
  }
  S.next = next;
  S.prev = prev;

  function showEnd() {
    st.autoToken++;
    resetAutoBar();
    st.ended = true;
    st.dom.end.hidden = false;
    updateChrome();
    sync();
  }

  function curtain(color) {
    if (!st) return;
    st.black = st.black === color ? null : color;
    st.dom.curtain.hidden = !st.black;
    st.dom.curtain.style.background = st.black || '';
    sync();
  }

  function overview() {
    if (!st) return;
    const ov = h('div', { class: 'show-overview' });
    const grid = h('div', { class: 'ov-grid' });
    st.deck.slides.forEach((s, i) => {
      const b = h('button', { class: 'ov-item' + (i === st.index ? ' current' : '') + (s.hidden ? ' hidden-slide' : ''), type: 'button' }, R.thumb(s, 220, { deck: st.deck, index: i }), h('span', {}, String(i + 1)));
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        ov.remove();
        st.overview = null;
        if (st.audienceMode) return;
        go(i, { transition: true });
      });
      grid.appendChild(b);
    });
    ov.appendChild(grid);
    ov.addEventListener('click', () => {
      ov.remove();
      st.overview = null;
    });
    st.dom.stage.appendChild(ov);
    st.overview = ov;
    const cur = grid.querySelector('.current');
    if (cur) cur.scrollIntoView({ block: 'center' });
  }

  function updateChrome() {
    if (!st) return;
    const n = N();
    const unit = B.isBook(st.deck) ? 'Page' : 'Slide';
    if (st.dom.count) st.dom.count.textContent = st.ended ? 'End' : `${unit} ${st.index + 1} of ${n}`;
    if (st.dom.bfPage) {
      const pct = st.ended ? 100 : Math.round(((st.index + 1) / n) * 100);
      st.dom.bfPage.textContent = st.ended ? 'The end' : `Page ${st.index + 1} of ${n}`;
      st.dom.bfPct.textContent = pct + '%';
      st.dom.bfBar.style.width = pct + '%';
    }
    if (st.presenter) {
      const s = st.deck.slides[st.index];
      st.dom.notes.textContent = s && s.notes ? s.notes : 'No notes for this slide.';
      st.dom.notes.classList.toggle('empty', !(s && s.notes));
      renderNext();
    }
  }
  function renderNext() {
    if (!st || !st.presenter) return;
    const box = st.dom.nextBox;
    box.innerHTML = '';
    const w = box.clientWidth || 320;
    let idx = st.index, state = st.step + 1;
    if (st.ended || st.step >= st.steps.length) {
      idx = nextVisible(st.index);
      state = 0;
    }
    if (st.ended || idx >= N()) {
      box.appendChild(h('div', { class: 'pv-end' }, 'End of slide show'));
      return;
    }
    const thumb = R.thumb(st.deck.slides[idx], w, { deck: st.deck, index: idx });
    const steps = buildSteps(st.deck.slides[idx]);
    applyState(thumb, steps, state);
    box.appendChild(thumb);
    if (state > 0 && idx === st.index) box.appendChild(h('div', { class: 'pv-next-note' }, 'Next animation'));
  }
  function updatePresenterClock() {
    if (!st || !st.presenter) return;
    const ms = st.elapsed + (st.paused ? 0 : Date.now() - st.t0);
    st.dom.timer.textContent = U.fmtTime(ms);
    st.dom.clock.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  /* ---------------- input ---------------- */
  function onKey(e) {
    if (!st) return;
    if (U.$('#modalRoot').children.length) return;
    const key = e.key;
    const mod = e.ctrlKey || e.metaKey;
    let handled = true;
    if (/^[0-9]$/.test(key) && !mod) {
      st.typed += key;
      st.dom.typed.hidden = false;
      st.dom.typed.textContent = 'Go to slide ' + st.typed;
    } else if (key === 'Enter' && st.typed) {
      const n = parseInt(st.typed, 10);
      st.typed = '';
      st.dom.typed.hidden = true;
      if (st.audienceMode) sendNav('goto:' + (n - 1));
      else if (n >= 1 && n <= N()) go(n - 1, { transition: true });
    } else if (key === 'Escape' || key === '-') {
      if (st.overview) {
        st.overview.remove();
        st.overview = null;
      } else if (st.typed) {
        st.typed = '';
        st.dom.typed.hidden = true;
      } else if (st.tool !== 'pointer') setTool('pointer');
      else if (st.audienceMode) sendNav('end');
      else S.exit();
    } else if (mod && (key === 'p' || key === 'P')) setTool('pen');
    else if (mod && (key === 'l' || key === 'L')) setTool('laser');
    else if (mod && (key === 'i' || key === 'I')) setTool('highlighter');
    else if (mod && (key === 'e' || key === 'E')) setTool('eraser');
    else if (mod && (key === 'a' || key === 'A')) setTool('pointer');
    else if (mod) handled = false;
    else if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter', 'n', 'N'].includes(key)) next();
    else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace', 'p', 'P'].includes(key)) prev();
    else if (key === 'Home') st.audienceMode ? sendNav('goto:0') : go(nextVisible(-1), { transition: true });
    else if (key === 'End') st.audienceMode ? sendNav('goto:' + (N() - 1)) : go(prevVisible(N()), { transition: true });
    else if (key === 'b' || key === 'B' || key === '.') st.audienceMode ? sendNav('black') : curtain('black');
    else if (key === 'w' || key === 'W' || key === ',') st.audienceMode ? sendNav('white') : curtain('white');
    else if (key === 'e' || key === 'E') clearInk();
    else if (key === 'g' || key === 'G') overview();
    else if ((key === 's' || key === 'S') && st.auto) toggleAuto();
    else if (key === 'F5') handled = true;
    else handled = false;
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  }
  function onClick(e) {
    if (!st) return;
    if (e.target.closest('.show-toolbar, .show-overview, .aud-fs')) return;
    if (st.ended) return S.exit();
    if (st.tool !== 'pointer' && st.tool !== 'laser') return;
    const link = e.target.closest('a[href], .has-link');
    if (link) {
      window.open(link.getAttribute('href') || link.dataset.link, '_blank', 'noopener');
      return;
    }
    if (e.target.closest('iframe, video')) return;
    if (st.suppressClick) return;
    if (B.media.showClick(e, st.deck.slides[st.index])) return; // speaker icons play/pause instead of advancing
    if (B.isBook(st.deck)) {
      // like an e-reader: tap the left side to go back, anywhere else to go forward
      const r = st.dom.stage.getBoundingClientRect();
      if (e.clientX < r.left + r.width * 0.3) return prev();
    }
    next();
  }

  /* ---------------- swipe / drag to turn ---------------- */
  function initSwipe(stage) {
    let s = null;
    let peek = null; // the neighbouring page that slides in next to the one being dragged
    const canTurn = (dir) => (dir > 0 ? !(st.step < st.steps.length) && (nextVisible(st.index) < N() || st.deck.loop) : st.step === 0 && prevVisible(st.index) >= 0);
    const target = (dir) => {
      if (dir < 0) return prevVisible(st.index);
      const j = nextVisible(st.index);
      return j < N() ? j : nextVisible(-1);
    };
    const dropPeek = () => {
      if (peek) peek.layer.remove();
      peek = null;
    };
    const showPeek = (dir, dx) => {
      if (!peek || peek.dir !== dir) {
        dropPeek();
        const i = target(dir);
        if (i < 0 || i >= N()) return;
        const layer = makeLayer(st.deck, i, st.k);
        const steps = buildSteps(st.deck.slides[i]);
        applyState(layer, steps, dir > 0 ? 0 : steps.length);
        layer.classList.add('page-edge');
        st.dom.box.insertBefore(layer, st.dom.ink);
        peek = { dir, layer };
      }
      const w = st.dom.box.clientWidth;
      peek.layer.style.transform = `translateX(${dx + (dir > 0 ? w : -w)}px)`;
    };
    stage.addEventListener('pointerdown', (e) => {
      if (!st || e.button !== 0 || st.transitioning || st.overview) return;
      if (st.tool !== 'pointer' && st.tool !== 'laser') return;
      if (e.target.closest('.show-toolbar, .show-overview, .aud-fs, iframe, video, a, .has-link, .el-audio, .m3d-interactive')) return;
      const book = B.isBook(st.deck);
      if (!book && e.pointerType !== 'touch') return; // slides: swipe on touch screens only
      s = { x: e.clientX, y: e.clientY, t: Date.now(), id: e.pointerId, dx: 0, dragging: false, book };
    });
    stage.addEventListener('pointermove', (e) => {
      if (!s || e.pointerId !== s.id || !st) return;
      const dx = e.clientX - s.x;
      if (!s.dragging) {
        if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(e.clientY - s.y)) return;
        s.dragging = true;
        try {
          stage.setPointerCapture(e.pointerId);
        } catch (err) {
          /* ignore */
        }
      }
      s.dx = dx;
      if (s.book && st.layer) {
        // the page follows the finger; resist where there's nothing to turn to
        const dir = dx < 0 ? 1 : -1;
        const free = canTurn(dir);
        st.layer.style.transform = `translateX(${free ? dx : dx * 0.25}px)`;
        if (free) showPeek(dir, dx);
        else dropPeek();
      }
    });
    const end = (e) => {
      if (!s || e.pointerId !== s.id || !st) return;
      const cur = s;
      s = null;
      if (!cur.dragging) return;
      st.suppressClick = true;
      setTimeout(() => st && (st.suppressClick = false), 60);
      const w = st.dom.box.clientWidth || 1;
      const speed = Math.abs(cur.dx) / Math.max(1, Date.now() - cur.t);
      const commit = Math.abs(cur.dx) > w * 0.18 || (speed > 0.45 && Math.abs(cur.dx) > 30);
      const dir = cur.dx < 0 ? 1 : -1;
      const layer = st.layer;
      dropPeek(); // a committed turn builds the same page in the same spot, so this is seamless
      if (commit && cur.book && canTurn(dir) && !st.audienceMode) st.pendingOffset = parseFloat((layer.style.transform.match(/-?[\d.]+/) || [0])[0]);
      if (commit) dir > 0 ? next() : prev();
      if (st && st.pendingOffset != null) st.pendingOffset = null;
      if (cur.book && layer && st && st.layer === layer && layer.style.transform) {
        // no page turn happened (e.g. an animation step played): spring back
        const from = layer.style.transform;
        layer.style.transform = '';
        layer.animate([{ transform: from }, { transform: 'translateX(0px)' }], { duration: 220, easing: 'cubic-bezier(.2,.8,.3,1)' });
      }
    };
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);
  }
  function onContext(e) {
    if (!st) return;
    e.preventDefault && e.preventDefault();
    B.ui.menu(moreMenu().concat([{ sep: true }], penMenu()), e.clientX || 100, e.clientY || 100);
  }
  function onWheel(e) {
    if (!st || st.overview) return;
    e.preventDefault();
    const now = Date.now();
    if (now - st.wheelAt < 350) return;
    st.wheelAt = now;
    if (e.deltaY > 0) next();
    else if (e.deltaY < 0) prev();
  }
  let idleTimer;
  function onMove(e) {
    if (!st) return;
    st.dom.root.classList.add('pointer-active');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => st && st.dom.root.classList.remove('pointer-active'), 2500);
    if (st.tool === 'laser') {
      const r = st.dom.box.getBoundingClientRect();
      st.dom.laser.hidden = false;
      st.dom.laser.style.left = e.clientX - r.left + 'px';
      st.dom.laser.style.top = e.clientY - r.top + 'px';
    }
  }

  function setTool(t) {
    st.tool = t;
    st.dom.root.dataset.tool = t;
    st.dom.laser.hidden = t !== 'laser';
    st.dom.ink.style.pointerEvents = t === 'pen' || t === 'highlighter' || t === 'eraser' ? 'auto' : 'none';
  }

  /* ---------------- ink ---------------- */
  function initInk() {
    const c = st.dom.ink;
    let cur = null;
    const pt = (e) => {
      const r = c.getBoundingClientRect();
      return [((e.clientX - r.left) / r.width) * st.deck.w, ((e.clientY - r.top) / r.height) * st.deck.h];
    };
    c.addEventListener('pointerdown', (e) => {
      if (st.tool === 'pointer' || st.tool === 'laser') return;
      e.preventDefault();
      e.stopPropagation();
      c.setPointerCapture(e.pointerId);
      if (st.tool === 'eraser') {
        eraseAt(pt(e));
        cur = { erasing: true };
        return;
      }
      const hl = st.tool === 'highlighter';
      cur = { color: hl ? '#FFE066' : st.pen.color, width: hl ? 18 : st.pen.width, alpha: hl ? 0.45 : 1, pts: [pt(e)] };
      (st.ink[st.index] = st.ink[st.index] || []).push(cur);
    });
    c.addEventListener('pointermove', (e) => {
      if (!cur) return;
      if (cur.erasing) return eraseAt(pt(e));
      cur.pts.push(pt(e));
      redrawInk();
    });
    const up = () => {
      if (cur) sync();
      cur = null;
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('click', (e) => e.stopPropagation());
  }
  function eraseAt([x, y]) {
    const list = st.ink[st.index];
    if (!list) return;
    const before = list.length;
    st.ink[st.index] = list.filter((s) => !s.pts.some(([a, b]) => Math.hypot(a - x, b - y) < 14 + s.width));
    if (st.ink[st.index].length !== before) {
      redrawInk();
      sync();
    }
  }
  function clearInk() {
    if (!st) return;
    st.ink[st.index] = [];
    redrawInk();
    sync();
  }
  function redrawInk() {
    if (!st) return;
    const c = st.dom.ink;
    const ctx = c.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    const sc = c.width / st.deck.w;
    ctx.setTransform(sc, 0, 0, sc, 0, 0);
    for (const s of st.ink[st.index] || []) {
      ctx.globalAlpha = s.alpha;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.lineCap = s.alpha < 1 ? 'butt' : 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      s.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      if (s.pts.length === 1) ctx.lineTo(s.pts[0][0] + 0.1, s.pts[0][1]);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------------- exit ---------------- */
  S.exit = () => {
    if (!st) return;
    const last = st.lastShown;
    const wasAudience = st.audienceMode;
    finishRunning();
    clearTimeout(st.advanceTimer);
    clearInterval(st.clock);
    st.autoToken++;
    B.media.showStop();
    B.model3d.onPose = null;
    B.model3d.disposeAll();
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', onResize);
    document.removeEventListener('fullscreenchange', onFsChange);
    if (st.audience && !st.audience.closed) {
      try {
        st.audience.postMessage({ t: 'end' }, location.origin);
      } catch (e) {
        /* ignore */
      }
    }
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    const root = U.$('#show');
    root.hidden = true;
    root.innerHTML = '';
    st = null;
    B.ui.closeMenus();
    if (wasAudience) {
      window.close();
      return;
    }
    if (A.deck && last != null && last >= 0) B.slides.go(Math.min(last, A.deck.slides.length - 1));
  };

  /* ---------------- audience window (second screen) ---------------- */
  function openAudience() {
    if (st.audience && !st.audience.closed) {
      st.audience.focus();
      return;
    }
    const url = location.href.split('#')[0] + '#audience';
    const w = window.open(url, 'bsd-audience', 'popup,width=1280,height=760');
    if (!w) return B.ui.toast('Your browser blocked the window. Allow pop-ups for this site and try again.', 4000);
    st.audience = w;
    B.ui.toast('Drag the new window to the projector, then click it for full screen.', 5000);
  }
  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin || !e.data || typeof e.data !== 'object') return;
    const m = e.data;
    if (m.t === 'ready' && st && st.audience && e.source === st.audience) {
      st.audience.postMessage({ t: 'deck', deck: st.deck, assets: A.assets }, location.origin);
      sync();
    } else if (m.t === 'nav' && st && st.presenter && e.source === st.audience) {
      if (m.dir === 1) next();
      else if (m.dir === -1) prev();
      else if (m.dir === 'end') S.exit();
      else if (m.dir === 'black') curtain('black');
      else if (m.dir === 'white') curtain('white');
      else if (typeof m.dir === 'string' && m.dir.startsWith('goto:')) go(+m.dir.slice(5), { transition: true });
    }
  });
  function sync() {
    if (!st || !st.audience || st.audience.closed) return;
    try {
      st.audience.postMessage({ t: 'state', index: st.index, step: st.step, black: st.black, ended: st.ended, ink: st.ink[st.index] || [] }, location.origin);
    } catch (e) {
      /* ignore */
    }
  }
  function sendNav(dir) {
    if (window.opener) window.opener.postMessage({ t: 'nav', dir }, location.origin);
  }

  /** Entry point for the projector window opened by Presenter View. */
  S.audienceMode = () => {
    document.body.classList.add('audience-mode');
    const wait = h('div', { class: 'aud-wait' }, 'Waiting for the presenter…');
    document.body.appendChild(wait);
    window.addEventListener('message', (e) => {
      if (e.origin !== location.origin || !e.data) return;
      const m = e.data;
      if (m.t === 'deck') {
        wait.remove();
        A.assets = m.assets || {};
        A.deck = m.deck;
        if (st) S.exit();
        S.start(0, { audience: true, deck: m.deck });
      } else if (m.t === 'state' && st) {
        st.ink[m.index] = m.ink || [];
        if (m.index !== st.index) go(m.index, { transition: true, step: m.step });
        else if (m.step === st.step + 1) runStep();
        else if (m.step !== st.step) {
          finishRunning();
          st.step = m.step;
          applyState(st.layer, st.steps, st.step);
        }
        redrawInk();
        st.black = m.black;
        st.dom.curtain.hidden = !m.black;
        st.dom.curtain.style.background = m.black || '';
        st.ended = m.ended;
        st.dom.end.hidden = !m.ended;
      } else if (m.t === 'pose') B.model3d.setPose(m.id, m.pose);
      else if (m.t === 'end') window.close();
    });
    if (window.opener) window.opener.postMessage({ t: 'ready' }, location.origin);
    else wait.textContent = 'Open this window from Presenter View in BSD STEM Slides.';
  };

  /* ---------------- previews inside the editor ---------------- */
  const previewHost = () => {
    const wrap = U.$('#slideWrap');
    const old = wrap.querySelector('.preview-layer');
    if (old) old.remove();
    const box = h('div', { class: 'preview-layer' });
    wrap.appendChild(box);
    return box;
  };
  S.previewTransition = async () => {
    if (st || A.view !== 'normal') return;
    if (A.editingId) B.editor.endEdit();
    const slide = B.curSlide();
    const t = slide.transition || { type: 'none' };
    if (!t.type || t.type === 'none') return B.ui.toast('This slide has no transition. Pick one first.');
    const k = B.editor.scale();
    const box = previewHost();
    const prevIdx = A.current - 1;
    const oldL = prevIdx >= 0 ? makeLayer(A.deck, prevIdx, k) : h('div', { class: 'show-layer', style: { background: '#000' } });
    box.appendChild(oldL);
    const newL = makeLayer(A.deck, A.current, k);
    await doTransition(box, oldL, newL, t);
    setTimeout(() => box.remove(), 250);
  };
  S.previewAnimations = async (ids) => {
    if (st || A.view !== 'normal') return;
    if (A.editingId) B.editor.endEdit();
    const slide = B.curSlide();
    let steps = buildSteps(slide);
    if (!steps.length) return B.ui.toast('No animations on this slide yet.');
    const k = B.editor.scale();
    const box = previewHost();
    const layer = makeLayer(A.deck, A.current, k);
    box.appendChild(layer);
    let from = 0;
    if (ids && ids.length) {
      const idx = Math.min(...ids.map((id) => stepOf(steps, id)).filter((i) => i >= 0));
      if (isFinite(idx)) {
        from = idx;
        steps = steps.slice(0, idx + 1);
      }
    }
    applyState(layer, buildSteps(slide), from);
    for (let i = from; i < steps.length; i++) {
      if (!box.isConnected) return;
      await playStep(layer, steps[i], A.deck.w, A.deck.h);
      await new Promise((r) => setTimeout(r, 250));
    }
    setTimeout(() => box.remove(), 500);
  };
  S.buildSteps = buildSteps;
})(window.BSD);
