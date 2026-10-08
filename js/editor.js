/* BSD STEM Slides — slide canvas editor: selection, move/resize/rotate, smart guides, text editing */
(function (B) {
  'use strict';
  const U = B.util, A = B.app, M = B.model, R = B.render;
  const E = (B.editor = {});

  let stage, inner, wrap, host, overlay, gridLayer;
  let scale = 1;
  let editNode = null, editApply = null, editStartHtml = null, lastRange = null;

  const DIRS = { nw: [-1, -1], n: [0, -1], ne: [1, -1], e: [1, 0], se: [1, 1], s: [0, 1], sw: [-1, 1], w: [-1, 0] };
  const CURSORS = ['ns-resize', 'nesw-resize', 'ew-resize', 'nwse-resize'];
  const HANDLE_ANGLE = { n: 0, ne: 45, e: 90, se: 135, s: 180, sw: 225, w: 270, nw: 315 };
  const r1 = (v) => Math.round(v * 10) / 10;

  E.scale = () => scale;
  E.node = (id) => host && host.querySelector(`.el[data-id="${CSS.escape(id)}"]`);
  E.isEditing = () => !!A.editingId;
  E.editingNode = () => editNode;

  E.init = () => {
    stage = U.$('#stage');
    inner = U.$('#stageInner');
    wrap = U.$('#slideWrap');
    host = U.$('#slideHost');
    overlay = U.$('#overlay');
    gridLayer = U.$('#gridLayer');
    stage.addEventListener('pointerdown', onDown);
    stage.addEventListener('dblclick', onDbl);
    stage.addEventListener('contextmenu', onContext);
    stage.addEventListener('click', onClickLink);
    stage.addEventListener(
      'wheel',
      (e) => {
        if (!U.mod(e) && !e.ctrlKey) return;
        e.preventDefault();
        E.setZoom(Math.round(scale * 100) + (e.deltaY < 0 ? 10 : -10));
      },
      { passive: false }
    );
    stage.addEventListener('dragover', (e) => {
      if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
    });
    stage.addEventListener('drop', onDrop);
    new ResizeObserver(() => E.layout()).observe(stage);
    document.addEventListener('selectionchange', onSelChange);
  };

  /* ---------------- rendering ---------------- */
  E.render = () => {
    if (!A.deck || !host) return;
    if (A.editingId) E.endEdit(true);
    const slide = B.curSlide();
    host.innerHTML = '';
    if (!slide) return;
    host.appendChild(R.slide(slide, { mode: 'edit', index: A.current }));
    E.layout();
  };

  E.refreshEl = (el) => {
    const old = E.node(el.id);
    if (!old) return E.render();
    const n = R.element(el, { deck: A.deck, theme: B.theme(), mode: 'edit', slide: B.curSlide() });
    old.replaceWith(n);
    if (el.type === 'text' && el.autoHeight) E.fitText(el);
    return n;
  };

  /** Grow/shrink an auto-sizing text box so it hugs its text. */
  E.fitText = (el) => {
    const n = E.node(el.id);
    if (!n) return;
    const tb = n.querySelector('.el-text'), inn = n.querySelector('.el-text-inner');
    if (!tb || !inn) return;
    const cs = getComputedStyle(tb);
    const need = Math.ceil(inn.offsetHeight + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom));
    if (need > 0 && Math.abs(need - el.h) > 0.5) {
      el.h = need;
      n.style.height = need + 'px';
    }
  };

  E.fitTable = (el) => {
    const n = E.node(el.id);
    const t = n && n.querySelector('table');
    if (!t) return;
    t.style.height = 'auto';
    const need = t.offsetHeight;
    t.style.height = '';
    if (need > el.h + 0.5) {
      el.h = need;
      n.style.height = need + 'px';
    }
  };

  E.layout = () => {
    if (!A.deck || !stage || A.view !== 'normal') return;
    const pad = 32;
    const sw = stage.clientWidth, sh = stage.clientHeight;
    if (!sw || !sh) return;
    const W = A.deck.w, H = A.deck.h;
    if (A.fit) scale = Math.max(0.05, Math.min((sw - pad * 2) / W, (sh - pad * 2) / H));
    else scale = A.zoom / 100;
    A.zoom = Math.round(scale * 100);
    wrap.style.width = W * scale + 'px';
    wrap.style.height = H * scale + 'px';
    host.style.transform = `scale(${scale})`;
    inner.style.width = Math.max(sw, W * scale + pad * 2) + 'px';
    inner.style.height = Math.max(sh, H * scale + pad * 2) + 'px';
    gridLayer.hidden = !A.showGrid;
    gridLayer.style.backgroundSize = `${48 * scale}px ${48 * scale}px`;
    E.drawSelection();
    B.emit('zoom');
  };

  E.setZoom = (z) => {
    A.fit = false;
    A.zoom = U.clamp(Math.round(z), 10, 400);
    E.layout();
  };
  E.fit = () => {
    A.fit = true;
    E.layout();
  };

  /* ---------------- selection ---------------- */
  E.select = (ids, opts = {}) => {
    if (A.editingId && !opts.keepEdit) E.endEdit();
    A.selection = Array.from(new Set(ids)).filter((id) => B.findEl(id));
    // selecting objects means keyboard shortcuts (Delete, Ctrl+C…) act on them, not on slides
    if (A.selection.length && A.focus !== 'canvas') {
      A.focus = 'canvas';
      B.emit('focus-area');
    }
    E.drawSelection();
    if (!opts.silent) B.emit('selection');
  };

  const groupMembers = (el) => (el && el.groupId ? B.curSlide().elements.filter((e) => e.groupId === el.groupId).map((e) => e.id) : el ? [el.id] : []);

  const aabb = (el) => {
    if (!el.rot) return { x: el.x, y: el.y, w: el.w, h: el.h };
    const cx = el.x + el.w / 2, cy = el.y + el.h / 2, a = (el.rot * Math.PI) / 180;
    const c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
    const w = el.w * c + el.h * s, h = el.w * s + el.h * c;
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  };
  const union = (boxes) => {
    const x = Math.min(...boxes.map((b) => b.x)), y = Math.min(...boxes.map((b) => b.y));
    return { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y };
  };
  E.bounds = (els) => union(els.map(aabb));

  E.drawSelection = (guides) => {
    if (!overlay) return;
    overlay.innerHTML = '';
    const s = scale;
    if (guides && guides.length) {
      for (const g of guides) {
        overlay.appendChild(
          U.h('div', {
            class: 'guide ' + (g.x != null ? 'v' : 'h'),
            style: g.x != null ? { left: g.x * s + 'px', top: '0', height: A.deck.h * s + 'px' } : { top: g.y * s + 'px', left: '0', width: A.deck.w * s + 'px' },
          })
        );
      }
    }
    const els = B.selectedEls();
    if (!els.length) return;
    if (els.length === 1) {
      const el = els[0];
      const line = el.type === 'shape' && B.shapeById(el.shape).line;
      if (line) {
        const ax = el.flipH ? el.x + el.w : el.x, ay = el.flipV ? el.y + el.h : el.y;
        const bx = el.flipH ? el.x : el.x + el.w, by = el.flipV ? el.y : el.y + el.h;
        overlay.appendChild(U.h('div', { class: 'handle end', 'data-h': 'p1', style: { left: ax * s + 'px', top: ay * s + 'px' } }));
        overlay.appendChild(U.h('div', { class: 'handle end', 'data-h': 'p2', style: { left: bx * s + 'px', top: by * s + 'px' } }));
        return;
      }
      const box = U.h('div', {
        class: 'sel-box' + (A.editingId === el.id ? ' editing' : '') + (el.locked ? ' locked' : ''),
        style: { left: el.x * s + 'px', top: el.y * s + 'px', width: el.w * s + 'px', height: el.h * s + 'px', transform: el.rot ? `rotate(${el.rot}deg)` : '' },
      });
      if (!el.locked) {
        const small = el.w * s < 28 || el.h * s < 28;
        for (const h of Object.keys(DIRS)) {
          if (small && h.length === 1) continue;
          const idx = Math.round((((HANDLE_ANGLE[h] + (el.rot || 0)) % 180) + 180) % 180 / 45) % 4;
          box.appendChild(U.h('div', { class: 'handle h-' + h, 'data-h': h, style: { cursor: CURSORS[idx] } }));
        }
        box.appendChild(U.h('div', { class: 'rot-stem' }));
        box.appendChild(U.h('div', { class: 'handle rot', 'data-h': 'rot', title: 'Rotate (Shift snaps to 15°)', html: U.icon('rotate_right') }));
      }
      overlay.appendChild(box);
      return;
    }
    for (const el of els) {
      overlay.appendChild(
        U.h('div', {
          class: 'sel-box thin',
          style: { left: el.x * s + 'px', top: el.y * s + 'px', width: el.w * s + 'px', height: el.h * s + 'px', transform: el.rot ? `rotate(${el.rot}deg)` : '' },
        })
      );
    }
    const bb = E.bounds(els);
    const grouped = els.every((e) => e.groupId && e.groupId === els[0].groupId);
    const gbox = U.h('div', { class: 'sel-box group' + (grouped ? ' grouped' : ''), style: { left: bb.x * s + 'px', top: bb.y * s + 'px', width: bb.w * s + 'px', height: bb.h * s + 'px' } });
    for (const h of Object.keys(DIRS)) gbox.appendChild(U.h('div', { class: 'handle h-' + h, 'data-h': h, style: { cursor: CURSORS[Math.round(HANDLE_ANGLE[h] % 180 / 45) % 4] } }));
    overlay.appendChild(gbox);
  };

  /* ---------------- pointer interaction ---------------- */
  const toSlide = (e) => {
    const r = wrap.getBoundingClientRect();
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
  };

  const track = (e, onMove, onUp) => {
    const pid = e.pointerId;
    try {
      stage.setPointerCapture(pid);
    } catch (err) {
      /* ignore */
    }
    const mv = (ev) => ev.pointerId === pid && onMove(ev);
    const up = (ev) => {
      if (ev.pointerId !== pid) return;
      stage.removeEventListener('pointermove', mv);
      stage.removeEventListener('pointerup', up);
      stage.removeEventListener('pointercancel', up);
      try {
        stage.releasePointerCapture(pid);
      } catch (err) {
        /* ignore */
      }
      onUp(ev);
    };
    stage.addEventListener('pointermove', mv);
    stage.addEventListener('pointerup', up);
    stage.addEventListener('pointercancel', up);
  };

  function onDown(e) {
    if (A.view !== 'normal' || !A.deck) return;
    A.focus = 'canvas';
    B.emit('focus-area');
    const handle = e.target.closest('.handle');
    const elNode = e.target.closest('#slideHost .el');
    const el = elNode ? B.findEl(elNode.dataset.id) : null;

    if (e.button === 2) {
      if (A.editingId && elNode && elNode.dataset.id === A.editingId) return;
      if (el && !A.selection.includes(el.id)) E.select(groupMembers(el));
      else if (!el && !handle) E.select([]);
      return;
    }
    if (e.button !== 0) return;

    if (A.editingId) {
      if (el && el.id === A.editingId && !handle) {
        // clicking another cell of the table being edited
        const td = e.target.closest('td');
        if (td && A.editingCell && (+td.dataset.r !== A.editingCell[0] || +td.dataset.c !== A.editingCell[1])) {
          e.preventDefault();
          E.startCellEdit(el.id, +td.dataset.r, +td.dataset.c, { x: e.clientX, y: e.clientY });
        }
        return;
      }
      E.endEdit();
    }
    const ae = document.activeElement;
    if (ae && ae !== document.body && !stage.contains(ae)) ae.blur();

    if (A.drawTool) {
      e.preventDefault();
      return startDraw(e);
    }
    if (handle) {
      e.preventDefault();
      return startHandle(e, handle.dataset.h);
    }
    if (el) {
      e.preventDefault();
      if (A.painter) return applyPainter(el);
      const ids = groupMembers(el);
      const wasSelected = A.selection.includes(el.id);
      if (e.shiftKey || U.mod(e)) {
        // Ctrl+drag on a selected shape duplicates it; Ctrl/Shift+click toggles it
        if (U.mod(e) && wasSelected) return startMove(e, { id: el.id, wasSelected, toggleIds: ids });
        E.select(wasSelected ? A.selection.filter((x) => !ids.includes(x)) : A.selection.concat(ids));
        return;
      }
      let target = el.id;
      if (wasSelected && el.groupId && A.selection.length > 1 && ids.every((i) => A.selection.includes(i)) && A.selection.length === ids.length) {
        // second click on a group drills into the single shape (like PowerPoint)
        target = null;
      }
      if (!wasSelected) E.select(ids);
      return startMove(e, { id: el.id, wasSelected, drill: target === null });
    }
    e.preventDefault();
    if (A.painter) {
      A.painter = null;
      B.emit('painter');
    }
    if (!(e.shiftKey || U.mod(e))) E.select([]);
    startMarquee(e);
  }

  function onDbl(e) {
    const elNode = e.target.closest('#slideHost .el');
    if (!elNode || A.drawTool) return;
    const el = B.findEl(elNode.dataset.id);
    if (!el || el.locked) return;
    if (el.type === 'table') {
      const td = e.target.closest('td');
      if (td && !(A.editingId === el.id && A.editingCell && A.editingCell[0] === +td.dataset.r && A.editingCell[1] === +td.dataset.c))
        E.startCellEdit(el.id, +td.dataset.r, +td.dataset.c, { x: e.clientX, y: e.clientY });
      return;
    }
    if (M.isTextual(el)) {
      if (A.editingId !== el.id) E.startEdit(el.id, { x: e.clientX, y: e.clientY });
      return;
    }
    if (el.type === 'chart') B.dialogs.chart(el);
    else if (el.type === 'equation') B.dialogs.equation(el);
    else if (el.type === 'video') B.dialogs.video(el);
    else if (el.type === 'image') B.ui.openSidePane('format');
  }

  function onClickLink(e) {
    if (!(U.mod(e) || e.ctrlKey)) return;
    const a = e.target.closest('a[href]');
    if (a && host.contains(a)) {
      e.preventDefault();
      window.open(a.href, '_blank', 'noopener');
    }
  }

  function onContext(e) {
    if (A.view !== 'normal') return;
    const elNode = e.target.closest('#slideHost .el');
    if (A.editingId && elNode && elNode.dataset.id === A.editingId) {
      e.preventDefault();
      B.ui.textContextMenu(e.clientX, e.clientY);
      return;
    }
    e.preventDefault();
    B.ui.canvasContextMenu(e.clientX, e.clientY, !!elNode);
  }

  async function onDrop(e) {
    const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
    if (!files.length) return;
    e.preventDefault();
    const p = toSlide(e);
    for (const f of files) {
      if (/^image\//.test(f.type)) await E.insertImageFile(f, p);
      else if (/^video\//.test(f.type)) await E.insertVideoFile(f, p);
      else if (/\.(pptx|bsdslides|json)$/i.test(f.name)) return B.io.openFile(f);
    }
  }

  /* ----- move ----- */
  const snapTargets = (exclude) => {
    const ids = new Set(exclude.map((e) => e.id));
    const W = A.deck.w, H = A.deck.h;
    const xs = [0, W / 2, W], ys = [0, H / 2, H];
    for (const el of B.curSlide().elements) {
      if (ids.has(el.id)) continue;
      const b = aabb(el);
      xs.push(b.x, b.x + b.w / 2, b.x + b.w);
      ys.push(b.y, b.y + b.h / 2, b.y + b.h);
    }
    return { xs, ys };
  };
  const snapAxis = (cands, targets, tol) => {
    let best = null;
    for (const c of cands) for (const t of targets) {
      const d = t - c;
      if (Math.abs(d) <= tol && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, t };
    }
    return best;
  };
  const snapBox = (b, dx, dy, t) => {
    const tol = 6 / scale, guides = [];
    const sx = snapAxis([b.x + dx, b.x + dx + b.w / 2, b.x + dx + b.w], t.xs, tol);
    const sy = snapAxis([b.y + dy, b.y + dy + b.h / 2, b.y + dy + b.h], t.ys, tol);
    if (sx) {
      dx += sx.d;
      guides.push({ x: sx.t });
    }
    if (sy) {
      dy += sy.d;
      guides.push({ y: sy.t });
    }
    return { dx, dy, guides };
  };

  function startMove(e, info) {
    const p0 = toSlide(e);
    let els = B.selectedEls().filter((x) => !x.locked);
    let orig = els.map((el) => ({ el, x: el.x, y: el.y }));
    let bb = els.length ? E.bounds(els) : null;
    let targets = snapTargets(els);
    let moved = false;
    track(
      e,
      (ev) => {
        const p = toSlide(ev);
        let dx = p.x - p0.x, dy = p.y - p0.y;
        if (!moved && Math.hypot(dx * scale, dy * scale) < 4) return;
        if (!els.length) return;
        if (!moved && (ev.ctrlKey || ev.metaKey)) {
          // Ctrl+drag duplicates
          const copies = M.cloneElements(els.map((x) => x));
          B.curSlide().elements.push(...copies);
          E.render();
          A.selection = copies.map((c) => c.id);
          els = copies;
          orig = els.map((el) => ({ el, x: el.x, y: el.y }));
          targets = snapTargets(els);
        }
        moved = true;
        if (ev.shiftKey) Math.abs(dx) > Math.abs(dy) ? (dy = 0) : (dx = 0);
        let guides = [];
        if (A.showGuides && !ev.altKey) ({ dx, dy, guides } = snapBox(bb, dx, dy, targets));
        for (const o of orig) {
          o.el.x = r1(o.x + dx);
          o.el.y = r1(o.y + dy);
          const n = E.node(o.el.id);
          if (n) {
            n.style.left = o.el.x + 'px';
            n.style.top = o.el.y + 'px';
          }
        }
        E.drawSelection(guides);
      },
      (ev) => {
        if (moved) {
          E.drawSelection();
          E.changed();
          return;
        }
        if (info.toggleIds) return E.select(A.selection.filter((x) => !info.toggleIds.includes(x)));
        if (info.drill) return E.select([info.id]);
        if (!info.wasSelected || ev.shiftKey || A.selection.length !== 1) return;
        const el = B.findEl(info.id);
        if (!el || el.locked) return;
        if (M.isTextual(el)) E.startEdit(el.id, { x: ev.clientX, y: ev.clientY });
        else if (el.type === 'table') {
          const td = document.elementFromPoint(ev.clientX, ev.clientY);
          const cell = td && td.closest('td');
          if (cell) E.startCellEdit(el.id, +cell.dataset.r, +cell.dataset.c, { x: ev.clientX, y: ev.clientY });
        }
      }
    );
  }

  /* ----- resize / rotate ----- */
  function startHandle(e, h) {
    const els = B.selectedEls();
    if (!els.length) return;
    if (h === 'rot') return startRotate(e, els[0]);
    if (h === 'p1' || h === 'p2') return startEndpoint(e, els[0], h);
    if (els.length === 1) return startResize(e, els[0], h);
    return startGroupResize(e, els, h);
  }

  function startResize(e, el, h) {
    const [hx, hy] = DIRS[h];
    const o = { x: el.x, y: el.y, w: el.w, h: el.h };
    const rad = ((el.rot || 0) * Math.PI) / 180, cos = Math.cos(rad), sin = Math.sin(rad);
    const p0 = toSlide(e);
    const keep = el.type === 'image' || el.type === 'equation' || el.type === 'video';
    const targets = snapTargets([el]);
    const min = 8;
    if (hy && el.type === 'text') el.autoHeight = false;
    track(
      e,
      (ev) => {
        const p = toSlide(ev);
        const wx = p.x - p0.x, wy = p.y - p0.y;
        let dx = wx * cos + wy * sin, dy = -wx * sin + wy * cos;
        const centered = ev.ctrlKey || ev.metaKey;
        const k = centered ? 2 : 1;
        // snap the moving edge(s) when unrotated
        let guides = [];
        if (!el.rot && A.showGuides && !ev.altKey) {
          const tol = 6 / scale;
          if (hx) {
            const edge = hx > 0 ? o.x + o.w + dx : o.x + dx;
            const s = snapAxis([edge], targets.xs, tol);
            if (s) {
              dx += s.d;
              guides.push({ x: s.t });
            }
          }
          if (hy) {
            const edge = hy > 0 ? o.y + o.h + dy : o.y + dy;
            const s = snapAxis([edge], targets.ys, tol);
            if (s) {
              dy += s.d;
              guides.push({ y: s.t });
            }
          }
        }
        let nw = o.w + hx * dx * k, nh = o.h + hy * dy * k;
        const lock = hx && hy && (ev.shiftKey !== keep);
        if (lock) {
          const sc = Math.max(nw / o.w, nh / o.h);
          nw = o.w * sc;
          nh = o.h * sc;
          guides = [];
        }
        nw = Math.max(min, nw);
        nh = Math.max(min, nh);
        const dcx = centered ? 0 : (hx * (nw - o.w)) / 2, dcy = centered ? 0 : (hy * (nh - o.h)) / 2;
        const cx = o.x + o.w / 2 + dcx * cos - dcy * sin, cy = o.y + o.h / 2 + dcx * sin + dcy * cos;
        el.w = r1(nw);
        el.h = r1(nh);
        el.x = r1(cx - nw / 2);
        el.y = r1(cy - nh / 2);
        E.refreshEl(el);
        E.drawSelection(guides);
      },
      () => {
        E.drawSelection();
        E.changed();
      }
    );
  }

  function startGroupResize(e, els, h) {
    const [hx, hy] = DIRS[h];
    const bb = E.bounds(els);
    const orig = els.map((el) => ({ el, x: el.x, y: el.y, w: el.w, h: el.h }));
    const p0 = toSlide(e);
    track(
      e,
      (ev) => {
        const p = toSlide(ev);
        let nw = Math.max(8, bb.w + hx * (p.x - p0.x)), nh = Math.max(8, bb.h + hy * (p.y - p0.y));
        if (hx && hy && ev.shiftKey) {
          const sc = Math.max(nw / bb.w, nh / bb.h);
          nw = bb.w * sc;
          nh = bb.h * sc;
        }
        const nx = hx < 0 ? bb.x + bb.w - nw : bb.x, ny = hy < 0 ? bb.y + bb.h - nh : bb.y;
        const sx = nw / bb.w, sy = nh / bb.h;
        for (const o of orig) {
          o.el.x = r1(nx + (o.x - bb.x) * sx);
          o.el.y = r1(ny + (o.y - bb.y) * sy);
          o.el.w = r1(Math.max(1, o.w * sx));
          o.el.h = r1(Math.max(0, o.h * sy));
          E.refreshEl(o.el);
        }
        E.drawSelection();
      },
      () => E.changed()
    );
  }

  function startRotate(e, el) {
    const c = { x: el.x + el.w / 2, y: el.y + el.h / 2 };
    track(
      e,
      (ev) => {
        const p = toSlide(ev);
        let a = (Math.atan2(p.y - c.y, p.x - c.x) * 180) / Math.PI + 90;
        if (ev.shiftKey) a = Math.round(a / 15) * 15;
        else {
          const near = Math.round(a / 90) * 90;
          if (Math.abs(a - near) < 4) a = near;
        }
        el.rot = Math.round(((a % 360) + 360) % 360);
        const n = E.node(el.id);
        if (n) n.style.transform = el.rot ? `rotate(${el.rot}deg)` : '';
        E.drawSelection();
        B.emit('rotate-live', el.rot);
      },
      () => E.changed()
    );
  }

  function startEndpoint(e, el, h) {
    const a0 = { x: el.flipH ? el.x + el.w : el.x, y: el.flipV ? el.y + el.h : el.y };
    const b0 = { x: el.flipH ? el.x : el.x + el.w, y: el.flipV ? el.y : el.y + el.h };
    const fixed = h === 'p1' ? b0 : a0;
    const targets = snapTargets([el]);
    track(
      e,
      (ev) => {
        let p = toSlide(ev);
        const guides = [];
        if (ev.shiftKey) {
          const ang = Math.round(Math.atan2(p.y - fixed.y, p.x - fixed.x) / (Math.PI / 4)) * (Math.PI / 4);
          const len = Math.hypot(p.x - fixed.x, p.y - fixed.y);
          p = { x: fixed.x + Math.cos(ang) * len, y: fixed.y + Math.sin(ang) * len };
        } else if (A.showGuides && !ev.altKey) {
          const tol = 6 / scale;
          const sx = snapAxis([p.x], targets.xs.concat([fixed.x]), tol), sy = snapAxis([p.y], targets.ys.concat([fixed.y]), tol);
          if (sx) {
            p.x += sx.d;
            guides.push({ x: sx.t });
          }
          if (sy) {
            p.y += sy.d;
            guides.push({ y: sy.t });
          }
        }
        E.setLine(el, h === 'p1' ? p : fixed, h === 'p1' ? fixed : p);
        E.refreshEl(el);
        E.drawSelection(guides);
      },
      () => {
        E.drawSelection();
        E.changed();
      }
    );
  }

  E.setLine = (el, a, b) => {
    el.x = r1(Math.min(a.x, b.x));
    el.y = r1(Math.min(a.y, b.y));
    el.w = r1(Math.abs(b.x - a.x));
    el.h = r1(Math.abs(b.y - a.y));
    el.flipH = a.x > b.x;
    el.flipV = a.y > b.y;
  };

  /* ----- marquee ----- */
  function startMarquee(e) {
    const p0 = toSlide(e);
    const base = e.shiftKey || U.mod(e) ? A.selection.slice() : [];
    let box = null, moved = false;
    track(
      e,
      (ev) => {
        const p = toSlide(ev);
        if (!moved && Math.hypot((p.x - p0.x) * scale, (p.y - p0.y) * scale) < 4) return;
        moved = true;
        const r = { x: Math.min(p.x, p0.x), y: Math.min(p.y, p0.y), w: Math.abs(p.x - p0.x), h: Math.abs(p.y - p0.y) };
        const hits = [];
        for (const el of B.curSlide().elements) {
          const b = aabb(el);
          if (b.x >= r.x && b.y >= r.y && b.x + b.w <= r.x + r.w && b.y + b.h <= r.y + r.h) hits.push(...groupMembers(el));
        }
        A.selection = Array.from(new Set(base.concat(hits)));
        E.drawSelection();
        box = U.h('div', { class: 'marquee', style: { left: r.x * scale + 'px', top: r.y * scale + 'px', width: r.w * scale + 'px', height: r.h * scale + 'px' } });
        overlay.appendChild(box);
      },
      () => {
        if (box) box.remove();
        B.emit('selection');
      }
    );
  }

  /* ----- drawing new shapes / text boxes ----- */
  function startDraw(e) {
    const tool = A.drawTool;
    const p0 = toSlide(e);
    const slide = B.curSlide();
    let el;
    const isLine = tool.type === 'shape' && B.shapeById(tool.shape).line;
    if (tool.type === 'text') el = M.newElement('text', { x: r1(p0.x), y: r1(p0.y), w: 1, h: 1 });
    else el = M.newElement('shape', Object.assign({ shape: tool.shape, x: r1(p0.x), y: r1(p0.y), w: 0, h: 0 }, isLine ? { fill: 'none', stroke: '@accent1', strokeWidth: 2 } : {}));
    slide.elements.push(el);
    E.render();
    A.selection = [el.id];
    let moved = false;
    track(
      e,
      (ev) => {
        let p = toSlide(ev);
        if (!moved && Math.hypot((p.x - p0.x) * scale, (p.y - p0.y) * scale) < 4) return;
        moved = true;
        if (isLine) {
          if (ev.shiftKey) {
            const ang = Math.round(Math.atan2(p.y - p0.y, p.x - p0.x) / (Math.PI / 4)) * (Math.PI / 4);
            const len = Math.hypot(p.x - p0.x, p.y - p0.y);
            p = { x: p0.x + Math.cos(ang) * len, y: p0.y + Math.sin(ang) * len };
          }
          E.setLine(el, p0, p);
        } else {
          let w = p.x - p0.x, h = p.y - p0.y;
          if (ev.shiftKey) {
            const m = Math.max(Math.abs(w), Math.abs(h));
            w = Math.sign(w || 1) * m;
            h = Math.sign(h || 1) * m;
          }
          el.x = r1(Math.min(p0.x, p0.x + w));
          el.y = r1(Math.min(p0.y, p0.y + h));
          el.w = r1(Math.abs(w));
          el.h = r1(Math.abs(h));
          if (tool.type === 'text') el.autoHeight = false;
        }
        E.refreshEl(el);
        E.drawSelection();
      },
      () => {
        if (!moved) {
          if (isLine) E.setLine(el, p0, { x: p0.x + 160, y: p0.y });
          else if (tool.type === 'text') {
            el.w = 320;
            el.autoHeight = true;
          } else {
            const sq = ['ellipse', 'star5', 'star6', 'heart', 'octagon', 'hexagon', 'pentagon', 'plus', 'cube', 'flowConnector', 'circularArrow'].includes(tool.shape);
            el.w = sq ? 120 : 160;
            el.h = sq ? 120 : 100;
            el.x = r1(p0.x - el.w / 2);
            el.y = r1(p0.y - el.h / 2);
          }
        }
        if (tool.type === 'text' && el.w < 30) el.w = 320;
        if (tool.type === 'text' && el.h < 20) el.autoHeight = true;
        if (!tool.sticky) {
          A.drawTool = null;
          B.emit('tool');
        }
        E.refreshEl(el);
        E.select([el.id]);
        if (tool.type === 'text') {
          E.startEdit(el.id);
        } else {
          E.changed();
          B.emit('inserted', el);
        }
      }
    );
  }

  E.setDrawTool = (tool) => {
    if (A.editingId) E.endEdit();
    A.drawTool = tool;
    stage.classList.toggle('drawing', !!tool);
    B.emit('tool');
  };
  B.on('tool', () => stage && stage.classList.toggle('drawing', !!A.drawTool));

  /* ---------------- text editing ---------------- */
  function onSelChange() {
    if (!editNode) return;
    const s = window.getSelection();
    if (s.rangeCount && editNode.contains(s.anchorNode)) {
      lastRange = s.getRangeAt(0).cloneRange();
      B.emit('textsel');
    }
  }

  const placeCaret = (node, opt) => {
    const sel = window.getSelection();
    let range = null;
    if (opt && opt.x != null) {
      if (document.caretRangeFromPoint) range = document.caretRangeFromPoint(opt.x, opt.y);
      else if (document.caretPositionFromPoint) {
        const cp = document.caretPositionFromPoint(opt.x, opt.y);
        if (cp) {
          range = document.createRange();
          range.setStart(cp.offsetNode, cp.offset);
        }
      }
      if (range && !node.contains(range.startContainer)) range = null;
    }
    if (!range) {
      range = document.createRange();
      if (opt && opt.selectAll) range.selectNodeContents(node);
      else {
        let n = node;
        while (n.lastChild && n.lastChild.nodeType === 1 && n.lastChild.tagName !== 'BR') n = n.lastChild;
        range.selectNodeContents(n);
        range.collapse(false);
      }
    }
    sel.removeAllRanges();
    sel.addRange(range);
    lastRange = range.cloneRange();
  };

  const beginEditing = (id, node, apply, opt) => {
    A.editingId = id;
    A.selection = [id];
    editNode = node;
    editApply = apply;
    editStartHtml = node.innerHTML;
    node.classList.remove('show-hint', 'has-list');
    node.contentEditable = 'true';
    node.spellcheck = true;
    node.addEventListener('input', onEditInput);
    node.addEventListener('keydown', onEditKey);
    node.addEventListener('paste', onEditPaste);
    node.addEventListener('drop', onEditDrop);
    const elNode = node.closest('.el');
    if (elNode) elNode.classList.add('editing');
    node.focus({ preventScroll: true });
    placeCaret(node, opt);
    E.drawSelection();
    B.emit('selection');
  };

  E.startEdit = (id, opt = {}) => {
    const el = B.findEl(id);
    if (!el) return;
    if (el.type === 'table') return E.startCellEdit(id, 0, 0, opt);
    if (!M.isTextual(el) || el.locked) return;
    if (A.editingId) E.endEdit(true);
    let n = E.node(id);
    if (!n) return;
    const inn = n.querySelector('.el-text-inner');
    if (inn.classList.contains('show-hint') && /<(ul|ol)/i.test(el.html || '') === false && !el.html) inn.innerHTML = '';
    beginEditing(id, inn, (html) => {
      el.html = html;
      if (el.type === 'text' && el.autoHeight) E.fitText(el);
    }, opt);
  };

  E.startCellEdit = (id, r, c, opt = {}) => {
    const el = B.findEl(id);
    if (!el || el.type !== 'table') return;
    if (A.editingId) E.endEdit(true);
    const n = E.node(id);
    const cell = n && n.querySelector(`td[data-r="${r}"][data-c="${c}"] .cell`);
    if (!cell) return;
    A.editingCell = [r, c];
    beginEditing(id, cell, (html) => {
      el.rows[r][c] = html;
      E.fitTable(el);
    }, opt);
  };

  const cleanHtml = (html) => {
    html = html.replace(/​/g, '');
    if (/^(<br\s*\/?>|<div><br\s*\/?><\/div>)$/i.test(html.trim())) return '';
    return html;
  };

  function onEditInput() {
    if (!editNode || !editApply) return;
    editApply(cleanHtml(editNode.innerHTML));
    E.drawSelection();
    B.store.markDirty();
    B.emit('content-live');
  }

  function onEditKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      E.endEdit();
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      if (A.editingCell) return E.moveCell(e.shiftKey ? -1 : 1);
      const s = window.getSelection();
      const inList = s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement).closest('li');
      if (inList) document.execCommand(e.shiftKey ? 'outdent' : 'indent');
      else if (!e.shiftKey) document.execCommand('insertText', false, '\t');
      onEditInput();
    }
  }

  function onEditPaste(e) {
    e.preventDefault();
    e.stopPropagation();
    const cd = e.clipboardData;
    const img = cd && Array.from(cd.items || []).find((i) => i.kind === 'file' && /^image\//.test(i.type));
    if (img) {
      E.endEdit();
      E.insertImageFile(img.getAsFile());
      return;
    }
    const text = cd ? cd.getData('text/plain') : '';
    if (text) document.execCommand('insertText', false, text.replace(/\r\n/g, '\n'));
  }
  function onEditDrop(e) {
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) return;
    e.preventDefault();
    const t = e.dataTransfer && e.dataTransfer.getData('text/plain');
    if (t) document.execCommand('insertText', false, t);
  }

  E.moveCell = (dir) => {
    const el = B.findEl(A.editingId);
    if (!el || !A.editingCell) return;
    const ncol = el.rows[0].length;
    let [r, c] = A.editingCell;
    let idx = r * ncol + c + dir;
    if (idx < 0) idx = 0;
    if (idx >= el.rows.length * ncol) {
      E.endEdit(true);
      el.rows.push(new Array(ncol).fill(''));
      E.render();
      B.store.commit();
      B.emit('content');
    }
    E.startCellEdit(el.id, Math.floor(idx / ncol), idx % ncol);
  };

  /** Finish text editing. Empty, non-placeholder text boxes are deleted (as in PowerPoint). */
  E.endEdit = (noRender) => {
    if (!A.editingId) return;
    const id = A.editingId;
    const el = B.findEl(id);
    let changed = false;
    if (editNode) {
      editNode.removeEventListener('input', onEditInput);
      editNode.removeEventListener('keydown', onEditKey);
      editNode.removeEventListener('paste', onEditPaste);
      editNode.removeEventListener('drop', onEditDrop);
      editNode.contentEditable = 'false';
      const html = cleanHtml(editNode.innerHTML);
      changed = html !== cleanHtml(editStartHtml || '');
      if (editApply) editApply(html);
      const elNode = editNode.closest('.el');
      if (elNode) elNode.classList.remove('editing');
    }
    A.editingId = null;
    A.editingCell = null;
    editNode = editApply = null;
    lastRange = null;
    const s = window.getSelection();
    if (s) s.removeAllRanges();
    if (el && el.type === 'text' && !el.placeholder && U.isHtmlEmpty(el.html)) {
      const sl = B.curSlide();
      sl.elements = sl.elements.filter((x) => x !== el);
      A.selection = A.selection.filter((x) => x !== id);
      changed = true;
    }
    if (changed) B.store.commit();
    if (!noRender) {
      E.render();
      B.emit('selection');
      if (changed) B.emit('content');
    } else if (changed) B.emit('content-live');
  };

  E.restoreRange = () => {
    if (!editNode) return;
    editNode.focus({ preventScroll: true });
    if (lastRange) {
      const s = window.getSelection();
      s.removeAllRanges();
      s.addRange(lastRange);
    }
  };

  /* ---------------- text formatting ---------------- */
  const exec = (cmd, value, root) => {
    document.execCommand('styleWithCSS', false, true);
    if (cmd === 'fontSize') {
      document.execCommand('fontSize', false, '7');
      root.querySelectorAll('font[size="7"]').forEach((f) => {
        const s = document.createElement('span');
        s.style.fontSize = value + 'pt';
        s.append(...f.childNodes);
        f.replaceWith(s);
      });
      root.querySelectorAll('span').forEach((s) => {
        if (/xxx-large/.test(s.style.fontSize)) s.style.fontSize = value + 'pt';
      });
      return;
    }
    if (cmd === 'createLink') document.execCommand('styleWithCSS', false, false);
    document.execCommand(cmd, false, value);
  };

  const withTemp = (html, fn) => {
    const tmp = U.h('div', { contenteditable: 'true', style: 'position:fixed;left:-10000px;top:0;width:800px;white-space:pre-wrap' });
    tmp.innerHTML = html || '';
    document.body.appendChild(tmp);
    tmp.focus({ preventScroll: true });
    const r = document.createRange();
    r.selectNodeContents(tmp);
    const s = window.getSelection();
    s.removeAllRanges();
    s.addRange(r);
    fn(tmp);
    const out = tmp.innerHTML;
    tmp.remove();
    s.removeAllRanges();
    return out;
  };

  const stripProp = (html, props, tags = {}) => {
    const d = document.createElement('div');
    d.innerHTML = html || '';
    d.querySelectorAll('[style]').forEach((n) => {
      props.forEach((p) => n.style.removeProperty(p));
      if (!n.getAttribute('style')) n.removeAttribute('style');
    });
    if (tags.font) d.querySelectorAll('font').forEach((f) => tags.font.forEach((a) => f.removeAttribute(a)));
    d.querySelectorAll('span:not([style]), font:not([color]):not([face]):not([size])').forEach((n) => n.replaceWith(...n.childNodes));
    return d.innerHTML;
  };

  const textTargets = () => B.selectedEls().filter((el) => (M.isTextual(el) || el.type === 'table') && !el.locked);

  /**
   * Apply a text command. While editing it acts on the text selection; otherwise on every
   * selected text-bearing element as a whole (like PowerPoint).
   */
  E.format = (cmd, value) => {
    if (editNode) {
      E.restoreRange();
      exec(cmd, value, editNode);
      onEditInput();
      const s = window.getSelection();
      if (s.rangeCount) lastRange = s.getRangeAt(0).cloneRange();
      B.emit('textsel');
      return;
    }
    const els = textTargets();
    if (!els.length) return;
    const elementLevel = { fontName: ['font', ['font-family'], ['face']], fontSize: ['size', ['font-size'], ['size']], foreColor: ['color', ['color'], ['color']] };
    for (const el of els) {
      if (elementLevel[cmd] && el.type !== 'table') {
        const [prop, css, attrs] = elementLevel[cmd];
        el[prop] = cmd === 'fontSize' ? +value : value;
        el.html = stripProp(el.html, css, { font: attrs });
      } else if (cmd === 'removeFormat') {
        const fix = (h) => stripProp(withTemp(h, () => exec('removeFormat')), ['font-family', 'font-size', 'color', 'background-color', 'font-weight', 'font-style', 'text-decoration', 'text-decoration-line'], { font: ['face', 'size', 'color'] });
        if (el.type === 'table') el.rows = el.rows.map((r) => r.map(fix));
        else {
          el.html = fix(el.html);
          el.bold = el.italic = false;
        }
      } else if (el.type === 'table') {
        if (cmd === 'fontName') el.font = value;
        else if (cmd === 'fontSize') el.size = +value;
        else el.rows = el.rows.map((r) => r.map((h) => (h ? withTemp(h, (t) => exec(cmd, value, t)) : h)));
      } else {
        let html = el.html;
        if (U.isHtmlEmpty(html) && /List$/.test(cmd) === false) {
          if (cmd === 'bold') el.bold = !el.bold;
          else if (cmd === 'italic') el.italic = !el.italic;
          continue;
        }
        if (!html) html = '<div><br></div>';
        el.html = withTemp(html, (t) => exec(cmd, value, t));
      }
    }
    E.changed(true);
  };

  E.setAlign = (align) => {
    if (editNode) return E.format({ left: 'justifyLeft', center: 'justifyCenter', right: 'justifyRight', justify: 'justifyFull' }[align]);
    for (const el of textTargets()) {
      if (el.type === 'table') continue;
      el.align = align;
      el.html = stripProp(el.html, ['text-align']);
    }
    E.changed(true);
  };

  /** Set an element-level property on all selected elements. */
  E.setProp = (prop, value, filter) => {
    const els = B.selectedEls().filter((el) => !filter || filter(el));
    if (!els.length) return;
    const keepEdit = A.editingId;
    for (const el of els) {
      el[prop] = value;
      if (keepEdit !== el.id) E.refreshEl(el);
    }
    if (keepEdit) {
      // re-render later without losing caret; only element-level styles change
      const el = B.findEl(keepEdit);
      const n = E.node(keepEdit);
      if (el && n) {
        const inn = n.querySelector('.el-text-inner');
        const fresh = R.element(el, { deck: A.deck, theme: B.theme(), mode: 'edit' });
        const fi = fresh.querySelector('.el-text-inner');
        if (inn && fi) {
          inn.style.cssText = fi.style.cssText;
          const ft = fresh.querySelector('.el-text'), tb = n.querySelector('.el-text');
          if (ft && tb) tb.style.cssText = ft.style.cssText;
        }
        const svg = n.querySelector('.el-svg'), fsvg = fresh.querySelector('.el-svg');
        if (svg && fsvg) svg.replaceWith(fsvg);
        n.style.cssText = fresh.style.cssText;
        if (el.type === 'text' && el.autoHeight) E.fitText(el);
      }
    }
    E.drawSelection();
    B.store.commit();
    B.emit('content');
  };

  /** Current text formatting state for the ribbon. */
  E.textState = () => {
    const st = {};
    let probe = null;
    if (editNode) {
      ['bold', 'italic', 'underline', 'strikeThrough', 'superscript', 'subscript', 'insertUnorderedList', 'insertOrderedList'].forEach((c) => {
        try {
          st[c] = document.queryCommandState(c);
        } catch (e) {
          st[c] = false;
        }
      });
      const s = window.getSelection();
      if (s.rangeCount) {
        probe = s.anchorNode;
        if (probe && probe.nodeType === 3) probe = probe.parentElement;
      }
      if (!probe || !editNode.contains(probe)) probe = editNode;
    } else {
      const el = textTargets()[0];
      if (!el) return null;
      const n = E.node(el.id);
      if (!n) return null;
      const inn = n.querySelector('.el-text-inner') || n.querySelector('.cell') || n;
      const walker = document.createTreeWalker(inn, NodeFilter.SHOW_TEXT);
      let t;
      while ((t = walker.nextNode()) && !t.textContent.trim());
      probe = t ? t.parentElement : inn;
      const html = el.type === 'table' ? el.rows.flat().join('') : el.html || '';
      st.insertUnorderedList = /<ul/i.test(html);
      st.insertOrderedList = /<ol/i.test(html);
    }
    if (probe) {
      const cs = getComputedStyle(probe);
      if (!editNode) {
        st.bold = parseInt(cs.fontWeight, 10) >= 600;
        st.italic = cs.fontStyle === 'italic';
        const deco = (n) => {
          for (let x = n; x && x !== host; x = x.parentElement) {
            const d = getComputedStyle(x).textDecorationLine;
            if (d && d !== 'none') return d;
          }
          return '';
        };
        const d = deco(probe);
        st.underline = /underline/.test(d);
        st.strikeThrough = /line-through/.test(d);
        st.superscript = !!probe.closest('sup');
        st.subscript = !!probe.closest('sub');
      }
      st.font = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
      st.size = Math.round(parseFloat(cs.fontSize) * 0.75 * 2) / 2;
      st.align = cs.textAlign === 'start' ? 'left' : cs.textAlign;
    }
    return st;
  };

  E.growFont = (dir) => {
    const st = E.textState();
    const cur = (st && st.size) || 18;
    const sizes = B.FONT_SIZES;
    let next = dir > 0 ? sizes.find((s) => s > cur + 0.01) || cur + 8 : [...sizes].reverse().find((s) => s < cur - 0.01) || Math.max(1, cur - 1);
    if (editNode) return E.format('fontSize', next);
    // scale inline sizes proportionally too
    for (const el of textTargets()) {
      const base = el.size || 18;
      const ratio = next / cur;
      el.size = Math.max(1, Math.round(base * ratio * 2) / 2);
      if (el.html) {
        const d = document.createElement('div');
        d.innerHTML = el.html;
        d.querySelectorAll('[style]').forEach((n) => {
          const fs = n.style.fontSize;
          if (fs && /pt$/.test(fs)) n.style.fontSize = Math.max(1, Math.round(parseFloat(fs) * ratio * 2) / 2) + 'pt';
        });
        el.html = d.innerHTML;
      }
    }
    E.changed(true);
  };

  E.insertSymbol = (sym) => {
    if (editNode) {
      E.restoreRange();
      document.execCommand('insertText', false, sym);
      onEditInput();
      return;
    }
    const el = M.newElement('text', { html: `<div>${U.esc(sym)}</div>`, size: 32 });
    E.insertElement(el, { w: 80 });
  };

  /* ---------------- format painter ---------------- */
  const PAINT_PROPS = ['fill', 'stroke', 'strokeWidth', 'dash', 'opacity', 'shadow', 'font', 'size', 'color', 'bold', 'italic', 'align', 'valign', 'lineHeight', 'mask', 'filter'];
  E.pickPainter = () => {
    const el = B.selectedEls()[0];
    if (!el) return;
    if (A.painter) {
      A.painter = null;
    } else {
      A.painter = { type: el.type, props: {} };
      PAINT_PROPS.forEach((p) => el[p] !== undefined && (A.painter.props[p] = U.clone(el[p])));
    }
    B.emit('painter');
  };
  function applyPainter(el) {
    const p = A.painter;
    A.painter = null;
    for (const [k, v] of Object.entries(p.props)) {
      if ((k === 'mask' || k === 'filter') && el.type !== 'image') continue;
      if (['fill', 'stroke', 'strokeWidth', 'dash'].includes(k) && el.type === 'image' && k !== 'stroke' && k !== 'strokeWidth') continue;
      el[k] = U.clone(v);
    }
    if (el.html) el.html = stripProp(el.html, ['font-family', 'font-size', 'color']);
    E.select([el.id], { silent: true });
    E.changed(true);
    B.emit('painter');
    B.emit('selection');
  }

  /* ---------------- element operations ---------------- */
  /** Commit the current state and notify the UI. Pass rerender=true to rebuild the canvas. */
  E.changed = (rerender) => {
    if (rerender) E.render();
    B.store.commit();
    B.emit('content');
  };

  E.insertElement = (el, opts = {}) => {
    if (A.editingId) E.endEdit(true);
    const W = A.deck.w, H = A.deck.h;
    if (opts.w) el.w = opts.w;
    if (opts.h) el.h = opts.h;
    if (opts.at) {
      el.x = r1(opts.at.x - el.w / 2);
      el.y = r1(opts.at.y - el.h / 2);
    } else if (!opts.keepPos) {
      el.x = r1((W - el.w) / 2);
      el.y = r1((H - el.h) / 2);
    }
    B.curSlide().elements.push(el);
    E.render();
    if (el.type === 'text' && el.autoHeight) E.fitText(el);
    E.select([el.id]);
    E.changed();
    B.emit('inserted', el);
    if (opts.edit) E.startEdit(el.id, { selectAll: true });
    return el;
  };

  E.insertImageFile = async (file, at) => {
    if (!file) return;
    try {
      const raw = await U.readFile(file);
      const data = await U.shrinkImage(raw);
      await E.insertImageSrc(data, at, file.name);
    } catch (err) {
      B.ui.toast('Could not insert that picture.');
    }
  };
  E.insertImageSrc = async (data, at, name) => {
    const img = await U.loadImage(data);
    const W = A.deck.w, H = A.deck.h;
    const k = Math.min(1, (W * 0.6) / img.naturalWidth, (H * 0.6) / img.naturalHeight);
    const asset = data.startsWith('data:') ? M.addAsset(data) : null;
    const el = M.newElement('image', { asset, src: asset ? undefined : data, w: r1(img.naturalWidth * k) || 300, h: r1(img.naturalHeight * k) || 200, alt: name ? name.replace(/\.[^.]+$/, '') : '' });
    return E.insertElement(el, { at });
  };
  E.insertVideoFile = async (file, at) => {
    if (file.size > 25 * 1024 * 1024) {
      B.ui.toast('That video is over 25 MB. Try a YouTube link instead.');
      return;
    }
    const data = await U.readFile(file);
    const asset = M.addAsset(data);
    return E.insertElement(M.newElement('video', { kind: 'file', asset, w: 480, h: 270 }), { at });
  };

  E.deleteSelection = () => {
    const ids = new Set(A.selection);
    if (!ids.size) return;
    const s = B.curSlide();
    s.elements = s.elements.filter((e) => !ids.has(e.id) || e.locked);
    A.selection = [];
    E.render();
    B.emit('selection');
    E.changed();
  };

  E.duplicate = () => {
    const els = B.selectedEls();
    if (!els.length) return;
    const copies = M.cloneElements(els);
    copies.forEach((c) => {
      c.x += 16;
      c.y += 16;
    });
    B.curSlide().elements.push(...copies);
    E.render();
    E.select(copies.map((c) => c.id));
    E.changed();
  };

  E.selectAll = () => {
    if (A.editingId) return;
    E.select(B.curSlide().elements.map((e) => e.id));
  };

  E.nudge = (dx, dy) => {
    const els = B.selectedEls().filter((e) => !e.locked);
    if (!els.length) return;
    els.forEach((el) => {
      el.x = r1(el.x + dx);
      el.y = r1(el.y + dy);
      const n = E.node(el.id);
      if (n) {
        n.style.left = el.x + 'px';
        n.style.top = el.y + 'px';
      }
    });
    E.drawSelection();
    nudgeCommit();
  };
  const nudgeCommit = U.debounce(() => E.changed(), 350);

  E.cycleSelection = (dir) => {
    const els = B.curSlide().elements;
    if (!els.length) return;
    const cur = A.selection.length ? els.findIndex((e) => e.id === A.selection[A.selection.length - 1]) : -1;
    const next = (cur + dir + els.length) % els.length;
    E.select([els[next].id]);
  };

  E.order = (how) => {
    const s = B.curSlide();
    const ids = new Set(A.selection);
    if (!ids.size) return;
    const sel = s.elements.filter((e) => ids.has(e.id));
    const rest = s.elements.filter((e) => !ids.has(e.id));
    if (how === 'front') s.elements = rest.concat(sel);
    else if (how === 'back') s.elements = sel.concat(rest);
    else {
      const arr = s.elements.slice();
      if (how === 'forward') {
        for (let i = arr.length - 2; i >= 0; i--) if (ids.has(arr[i].id) && !ids.has(arr[i + 1].id)) [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
      } else {
        for (let i = 1; i < arr.length; i++) if (ids.has(arr[i].id) && !ids.has(arr[i - 1].id)) [arr[i], arr[i - 1]] = [arr[i - 1], arr[i]];
      }
      s.elements = arr;
    }
    E.changed(true);
  };

  E.alignTo = (how) => {
    const els = B.selectedEls().filter((e) => !e.locked);
    if (!els.length) return;
    const ref = els.length === 1 ? { x: 0, y: 0, w: A.deck.w, h: A.deck.h } : E.bounds(els);
    if (how === 'dist-h' || how === 'dist-v') {
      if (els.length < 3) return;
      const horiz = how === 'dist-h';
      const sorted = els.slice().sort((a, b) => (horiz ? aabb(a).x - aabb(b).x : aabb(a).y - aabb(b).y));
      const total = sorted.reduce((t, e) => t + (horiz ? aabb(e).w : aabb(e).h), 0);
      const gap = ((horiz ? ref.w : ref.h) - total) / (sorted.length - 1);
      let pos = horiz ? ref.x : ref.y;
      for (const el of sorted) {
        const b = aabb(el);
        if (horiz) {
          el.x = r1(el.x + (pos - b.x));
          pos += b.w + gap;
        } else {
          el.y = r1(el.y + (pos - b.y));
          pos += b.h + gap;
        }
      }
    } else {
      for (const el of els) {
        const b = aabb(el);
        if (how === 'left') el.x = r1(el.x + ref.x - b.x);
        if (how === 'center') el.x = r1(el.x + ref.x + ref.w / 2 - (b.x + b.w / 2));
        if (how === 'right') el.x = r1(el.x + ref.x + ref.w - (b.x + b.w));
        if (how === 'top') el.y = r1(el.y + ref.y - b.y);
        if (how === 'middle') el.y = r1(el.y + ref.y + ref.h / 2 - (b.y + b.h / 2));
        if (how === 'bottom') el.y = r1(el.y + ref.y + ref.h - (b.y + b.h));
      }
    }
    E.changed(true);
  };

  E.rotateBy = (deg) => {
    for (const el of B.selectedEls()) el.rot = (((el.rot || 0) + deg) % 360 + 360) % 360;
    E.changed(true);
  };
  E.flip = (axis) => {
    for (const el of B.selectedEls()) {
      if (axis === 'h') el.flipH = !el.flipH;
      else el.flipV = !el.flipV;
    }
    E.changed(true);
  };

  E.group = () => {
    const els = B.selectedEls();
    if (els.length < 2) return;
    const gid = U.uid();
    els.forEach((e) => (e.groupId = gid));
    E.drawSelection();
    E.changed();
    B.emit('selection');
  };
  E.ungroup = () => {
    B.selectedEls().forEach((e) => delete e.groupId);
    E.drawSelection();
    E.changed();
    B.emit('selection');
  };

  /* ---------------- clipboard ---------------- */
  E.copy = () => {
    const els = B.selectedEls();
    if (!els.length) return null;
    const assets = {};
    els.forEach((e) => e.asset && A.assets[e.asset] && (assets[e.asset] = A.assets[e.asset]));
    const text = els.map((e) => (e.html ? U.htmlToText(e.html) : e.latex || '')).filter(Boolean).join('\n') || ' ';
    A.clipboard = { kind: 'elements', els: U.clone(els), assets, slideId: B.curSlide().id, pastes: 0, text };
    return text;
  };
  E.cut = () => {
    const t = E.copy();
    if (t != null) E.deleteSelection();
    return t;
  };
  E.paste = () => {
    const c = A.clipboard;
    if (!c || c.kind !== 'elements') return false;
    Object.assign(A.assets, c.assets);
    const copies = M.cloneElements(c.els);
    if (c.slideId === B.curSlide().id) {
      c.pastes++;
      copies.forEach((e) => {
        e.x += 16 * c.pastes;
        e.y += 16 * c.pastes;
      });
    }
    B.curSlide().elements.push(...copies);
    E.render();
    E.select(copies.map((e) => e.id));
    E.changed();
    return true;
  };
  E.pastePlainText = (text) => {
    text = String(text || '').trim();
    if (!text) return;
    if (R.ytId(text) && /^https?:\/\/\S+$/.test(text)) {
      return E.insertElement(M.newElement('video', { kind: 'youtube', src: text, w: 560, h: 315 }));
    }
    const el = M.newElement('text', { html: U.textToHtml(text), w: 600 });
    E.insertElement(el);
  };
})(window.BSD);
