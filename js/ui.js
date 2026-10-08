/* BSD STEM Slides — generic UI widgets: menus, popups, colour picker, modals, toasts */
(function (B) {
  'use strict';
  const U = B.util, A = B.app;
  const ui = (B.ui = {});
  const h = U.h;

  /* ---------- toast ---------- */
  ui.toast = (msg, ms = 2600) => {
    const root = U.$('#toastRoot');
    const t = h('div', { class: 'toast', role: 'status' }, msg);
    root.appendChild(t);
    requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => {
      t.classList.remove('in');
      setTimeout(() => t.remove(), 300);
    }, ms);
  };

  /* ---------- floating layers (menus & popups) ---------- */
  let layers = [];
  ui.closeMenus = () => {
    layers.forEach((l) => l.close(true));
    layers = [];
  };
  const place = (node, x, y, anchorRect) => {
    document.body.appendChild(node);
    const r = node.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    if (anchorRect) {
      x = anchorRect.left;
      y = anchorRect.bottom + 2;
      if (y + r.height > vh - 8 && anchorRect.top - r.height - 2 > 8) y = anchorRect.top - r.height - 2;
    }
    if (x + r.width > vw - 8) x = Math.max(8, vw - r.width - 8);
    if (y + r.height > vh - 8) y = Math.max(8, vh - r.height - 8);
    node.style.left = x + 'px';
    node.style.top = y + 'px';
  };
  const addLayer = (node, onClose, parent) => {
    const layer = {
      node,
      parent,
      close(all) {
        if (!node.isConnected) return;
        node.remove();
        layers = layers.filter((l) => l !== layer);
        if (!all) layers.filter((l) => l.parent === layer).forEach((l) => l.close());
        if (onClose) onClose();
      },
    };
    layers.push(layer);
    return layer;
  };
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (!layers.length) return;
      if (layers.some((l) => l.node.contains(e.target))) return;
      if (e.target.closest && e.target.closest('[data-popup-anchor="open"]')) return;
      ui.closeMenus();
    },
    true
  );
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && layers.length) {
      e.stopPropagation();
      e.preventDefault();
      layers[layers.length - 1].close();
    }
  }, true);
  window.addEventListener('blur', () => ui.closeMenus());
  window.addEventListener('resize', () => ui.closeMenus());

  /**
   * items: [{label, icon, shortcut, action, disabled, checked, sub:[...]} | {sep:true} | {header:'..'}]
   */
  ui.menu = (items, x, y, opts = {}) => {
    if (!opts.parent) ui.closeMenus();
    const m = h('div', { class: 'menu', role: 'menu' });
    let layer;
    let subLayer = null;
    for (const it of items.filter(Boolean)) {
      if (it.sep) {
        m.appendChild(h('div', { class: 'menu-sep' }));
        continue;
      }
      if (it.header) {
        m.appendChild(h('div', { class: 'menu-header' }, it.header));
        continue;
      }
      if (it.node) {
        m.appendChild(it.node);
        continue;
      }
      const row = h(
        'button',
        { class: 'menu-item' + (it.checked ? ' checked' : '') + (it.danger ? ' danger' : ''), role: 'menuitem', disabled: it.disabled ? true : null, type: 'button' },
        h('span', { class: 'mi-icon', html: it.icon ? (it.icon.startsWith('<') ? it.icon : U.icon(it.icon)) : it.checked ? U.icon('check') : '' }),
        h('span', { class: 'mi-label' }, it.label),
        h('span', { class: 'mi-short' }, it.shortcut || ''),
        it.sub ? h('span', { class: 'mi-sub', html: U.icon('chevron_right') }) : null
      );
      row.addEventListener('mousedown', (e) => e.preventDefault());
      if (it.sub) {
        const open = () => {
          if (subLayer) subLayer.close();
          const r = row.getBoundingClientRect();
          subLayer = ui.menu(it.sub, r.right - 2, r.top - 4, { parent: layer });
        };
        row.addEventListener('mouseenter', open);
        row.addEventListener('click', open);
      } else {
        row.addEventListener('mouseenter', () => {
          if (subLayer) {
            subLayer.close();
            subLayer = null;
          }
        });
        row.addEventListener('click', () => {
          ui.closeMenus();
          if (it.action) it.action();
        });
      }
      m.appendChild(row);
    }
    layer = addLayer(m, opts.onClose, opts.parent);
    place(m, x, y, opts.anchor ? opts.anchor.getBoundingClientRect() : null);
    const first = m.querySelector('.menu-item:not([disabled])');
    if (first && opts.focus) first.focus();
    m.addEventListener('keydown', (e) => {
      const btns = U.$$('.menu-item:not([disabled])', m);
      const i = btns.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        (btns[i + 1] || btns[0]).focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        (btns[i - 1] || btns[btns.length - 1]).focus();
      }
    });
    return layer;
  };

  /** Generic dropdown panel anchored to an element. */
  ui.popup = (anchor, content, opts = {}) => {
    ui.closeMenus();
    const p = h('div', { class: 'popup ' + (opts.cls || '') }, content);
    p.addEventListener('mousedown', (e) => {
      if (!/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) e.preventDefault();
    });
    if (anchor) anchor.dataset.popupAnchor = 'open';
    const layer = addLayer(p, () => {
      if (anchor) delete anchor.dataset.popupAnchor;
      if (opts.onClose) opts.onClose();
    });
    if (anchor) place(p, 0, 0, anchor.getBoundingClientRect());
    else place(p, opts.x || 100, opts.y || 100);
    return layer;
  };

  /* ---------- colour picker ---------- */
  let recentColors = U.storage.get('recentColors', []);
  ui.colorPicker = (anchor, opts) => {
    const theme = B.theme();
    const wrap = h('div', { class: 'color-picker' });
    let layer;
    const pick = (c) => {
      if (c && c[0] === '#') {
        recentColors = [c].concat(recentColors.filter((x) => x !== c)).slice(0, 10);
        U.storage.set('recentColors', recentColors);
      }
      layer.close();
      opts.onPick(c);
    };
    const sw = (c, title) => {
      const b = h('button', { class: 'swatch' + (opts.value === c ? ' current' : ''), title: title || c, type: 'button', style: { background: B.resolveColor(c, theme) } });
      b.addEventListener('click', () => pick(c));
      return b;
    };
    if (opts.allowNone) {
      const b = h('button', { class: 'cp-none', type: 'button', html: U.icon('format_color_reset') + `<span>${U.esc(opts.noneLabel || 'No Color')}</span>` });
      b.addEventListener('click', () => pick('none'));
      wrap.appendChild(b);
    }
    if (opts.allowAuto) {
      const b = h('button', { class: 'cp-none', type: 'button', html: U.icon('auto_awesome') + '<span>Automatic</span>' });
      b.addEventListener('click', () => pick(null));
      wrap.appendChild(b);
    }
    wrap.appendChild(h('div', { class: 'cp-label' }, 'Theme Colors'));
    const tokens = ['@bg', '@text', '@accent1', '@accent2', '@accent3', '@accent4', '@accent5', '@accent6'];
    const names = { '@bg': 'Background', '@text': 'Text' };
    const grid = h('div', { class: 'cp-grid theme' });
    for (const mod of ['', ':l2', ':l', ':d']) {
      for (const t of tokens) grid.appendChild(sw(t + mod, (names[t] || 'Accent ' + t.slice(7)) + ({ ':l2': ', Lighter 80%', ':l': ', Lighter 60%', ':d': ', Darker 30%' }[mod] || '')));
    }
    wrap.appendChild(grid);
    wrap.appendChild(h('div', { class: 'cp-label' }, 'Standard Colors'));
    const std = h('div', { class: 'cp-grid' });
    B.STANDARD_COLORS.forEach((c) => std.appendChild(sw(c)));
    B.GRAYS.forEach((c) => std.appendChild(sw(c)));
    wrap.appendChild(std);
    if (recentColors.length) {
      wrap.appendChild(h('div', { class: 'cp-label' }, 'Recent Colors'));
      const rc = h('div', { class: 'cp-grid' });
      recentColors.forEach((c) => rc.appendChild(sw(c)));
      wrap.appendChild(rc);
    }
    const more = h('div', { class: 'cp-more' });
    const inp = h('input', { type: 'color', value: U.toHex(B.resolveColor(opts.value, theme)) || '#4472C4', title: 'More colors' });
    inp.addEventListener('change', () => pick(inp.value.toUpperCase()));
    more.appendChild(h('label', { class: 'cp-custom' }, inp, h('span', { html: U.icon('palette') + ' More Colors…' })));
    if (window.EyeDropper) {
      const eb = h('button', { type: 'button', class: 'cp-eye', title: 'Pick a color from the screen', html: U.icon('colorize') + ' Eyedropper' });
      eb.addEventListener('click', async () => {
        try {
          const r = await new window.EyeDropper().open();
          pick(r.sRGBHex.toUpperCase());
        } catch (e) {
          /* cancelled */
        }
      });
      more.appendChild(eb);
    }
    wrap.appendChild(more);
    layer = ui.popup(anchor, wrap, { cls: 'cp-popup' });
    return layer;
  };

  /* ---------- modal dialogs ---------- */
  ui.modal = ({ title, body, buttons = [], width = 480, onClose, cls = '' }) => {
    ui.closeMenus();
    const root = U.$('#modalRoot');
    const back = h('div', { class: 'modal-back' });
    const box = h('div', { class: 'modal ' + cls, role: 'dialog', 'aria-modal': 'true', 'aria-label': title, style: { width: width + 'px' } });
    const close = (result) => {
      back.remove();
      document.removeEventListener('keydown', onKey, true);
      if (onClose) onClose(result);
    };
    const head = h('div', { class: 'modal-head' }, h('h2', {}, title));
    const x = h('button', { class: 'icon-btn', type: 'button', title: 'Close', 'aria-label': 'Close', html: U.icon('close') });
    x.addEventListener('click', () => close(null));
    head.appendChild(x);
    const foot = h('div', { class: 'modal-foot' });
    for (const b of buttons) {
      const btn = h('button', { class: 'btn' + (b.primary ? ' primary' : ''), type: 'button' }, b.label);
      btn.addEventListener('click', () => {
        const r = b.action ? b.action() : b.value;
        if (r !== false) close(b.value !== undefined ? b.value : r);
      });
      foot.appendChild(btn);
    }
    box.append(head, h('div', { class: 'modal-body' }, body));
    if (buttons.length) box.appendChild(foot);
    back.appendChild(box);
    back.addEventListener('pointerdown', (e) => {
      if (e.target === back) close(null);
    });
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close(null);
      } else if (e.key === 'Enter' && !e.shiftKey && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') {
        const prim = buttons.find((b) => b.primary);
        if (prim) {
          e.preventDefault();
          const r = prim.action ? prim.action() : prim.value;
          if (r !== false) close(prim.value !== undefined ? prim.value : r);
        }
      }
    };
    document.addEventListener('keydown', onKey, true);
    root.appendChild(back);
    const f = box.querySelector('input:not([type=checkbox]):not([type=color]), textarea, select');
    if (f) setTimeout(() => f.focus(), 30);
    return { close, box };
  };

  ui.prompt = (title, label, value = '', opts = {}) =>
    new Promise((res) => {
      const inp = h('input', { type: opts.type || 'text', class: 'field', value, placeholder: opts.placeholder || '' });
      const body = h('div', { class: 'form' }, h('label', { class: 'field-label' }, label, inp), opts.help ? h('p', { class: 'help' }, opts.help) : null);
      ui.modal({
        title,
        body,
        width: opts.width || 440,
        buttons: [
          { label: 'Cancel', value: null },
          { label: opts.ok || 'OK', primary: true, action: () => inp.value },
        ],
        onClose: res,
      });
      setTimeout(() => inp.select(), 40);
    });

  ui.confirm = (title, message, okLabel = 'OK', danger) =>
    new Promise((res) => {
      ui.modal({
        title,
        body: h('p', { class: 'confirm-msg' }, message),
        width: 420,
        buttons: [
          { label: 'Cancel', value: false },
          { label: okLabel, primary: true, value: true },
        ],
        onClose: (r) => res(!!r),
        cls: danger ? 'danger' : '',
      });
    });

  /* ---------- context menus ---------- */
  const k = (s) => (U.isMac ? s.replace('Ctrl+', '⌘') : s);
  ui.canvasContextMenu = (x, y, onElement) => {
    const E = B.editor;
    const els = B.selectedEls();
    const one = els.length === 1 ? els[0] : null;
    const items = [];
    if (els.length) {
      items.push(
        { label: 'Cut', icon: 'content_cut', shortcut: k('Ctrl+X'), action: () => E.cut() },
        { label: 'Copy', icon: 'content_copy', shortcut: k('Ctrl+C'), action: () => E.copy() }
      );
    }
    items.push({ label: 'Paste', icon: 'content_paste', shortcut: k('Ctrl+V'), disabled: !A.clipboard || A.clipboard.kind !== 'elements', action: () => E.paste() });
    if (els.length) {
      items.push({ label: 'Duplicate', icon: 'control_point_duplicate', shortcut: k('Ctrl+D'), action: () => E.duplicate() }, { label: 'Delete', icon: 'delete', shortcut: 'Del', action: () => E.deleteSelection() }, { sep: true });
      if (one && B.model.isTextual(one)) items.push({ label: 'Edit Text', icon: 'edit', action: () => E.startEdit(one.id, { selectAll: false }) });
      if (one && one.type === 'chart') items.push({ label: 'Edit Data…', icon: 'table_chart', action: () => B.dialogs.chart(one) });
      if (one && one.type === 'equation') items.push({ label: 'Edit Equation…', icon: 'functions', action: () => B.dialogs.equation(one) });
      if (one && one.type === 'image') items.push({ label: 'Change Picture…', icon: 'image', action: () => B.actions.changePicture() }, { label: 'Edit Alt Text…', icon: 'text_snippet', action: () => B.actions.altText() });
      items.push(
        {
          label: 'Bring to Front', icon: 'flip_to_front', sub: [
            { label: 'Bring to Front', icon: 'flip_to_front', action: () => E.order('front') },
            { label: 'Bring Forward', icon: 'arrow_upward', action: () => E.order('forward') },
          ],
        },
        {
          label: 'Send to Back', icon: 'flip_to_back', sub: [
            { label: 'Send to Back', icon: 'flip_to_back', action: () => E.order('back') },
            { label: 'Send Backward', icon: 'arrow_downward', action: () => E.order('backward') },
          ],
        },
        els.length > 1 && !els.every((e) => e.groupId && e.groupId === els[0].groupId)
          ? { label: 'Group', icon: 'group_work', shortcut: k('Ctrl+G'), action: () => E.group() }
          : null,
        els.some((e) => e.groupId) ? { label: 'Ungroup', icon: 'workspaces', shortcut: k('Ctrl+Shift+G'), action: () => E.ungroup() } : null,
        { label: 'Link…', icon: 'link', shortcut: k('Ctrl+K'), action: () => B.actions.link() },
        { label: one && one.locked ? 'Unlock' : 'Lock', icon: one && one.locked ? 'lock_open' : 'lock', action: () => B.actions.toggleLock() },
        { sep: true },
        { label: 'Format…', icon: 'tune', action: () => ui.openSidePane('format') },
        { label: 'Animation…', icon: 'animation', action: () => ui.openSidePane('animation') }
      );
    } else {
      items.push(
        { sep: true },
        { label: 'Layout', icon: 'dashboard', sub: B.LAYOUTS.map((l) => ({ label: l.name, checked: B.curSlide().layout === l.id, action: () => B.slides.setLayout(l.id) })) },
        { label: 'Reset Slide', icon: 'restart_alt', action: () => B.slides.reset() },
        { label: 'Format Background…', icon: 'format_paint', action: () => ui.openSidePane('background') },
        { label: 'Hide Background Graphics', checked: !!B.curSlide().hideDecor, action: () => B.slides.toggleDecor() },
        { sep: true },
        { label: 'New Slide', icon: 'add_box', shortcut: k('Ctrl+M'), action: () => B.slides.add() },
        { label: A.showGrid ? 'Hide Gridlines' : 'Show Gridlines', icon: 'grid_on', action: () => B.actions.toggleGrid() }
      );
    }
    ui.menu(items, x, y);
  };

  ui.textContextMenu = (x, y) => {
    const E = B.editor;
    ui.menu(
      [
        { label: 'Cut', icon: 'content_cut', shortcut: k('Ctrl+X'), action: () => (E.restoreRange(), document.execCommand('cut')) },
        { label: 'Copy', icon: 'content_copy', shortcut: k('Ctrl+C'), action: () => (E.restoreRange(), document.execCommand('copy')) },
        { label: 'Paste', icon: 'content_paste', shortcut: k('Ctrl+V'), action: () => B.actions.pasteFromSystem() },
        { sep: true },
        { label: 'Bold', icon: 'format_bold', action: () => E.format('bold') },
        { label: 'Italic', icon: 'format_italic', action: () => E.format('italic') },
        { label: 'Bullets', icon: 'format_list_bulleted', action: () => E.format('insertUnorderedList') },
        { label: 'Link…', icon: 'link', shortcut: k('Ctrl+K'), action: () => B.actions.link() },
        { label: 'Insert Symbol…', icon: 'special_character', action: () => B.dialogs.symbol() },
        { sep: true },
        { label: 'Select All', icon: 'select_all', shortcut: k('Ctrl+A'), action: () => (E.restoreRange(), document.execCommand('selectAll')) },
      ],
      x,
      y
    );
  };

  /* ---------- side pane host ---------- */
  ui.openSidePane = (kind) => {
    A.sidePane = kind;
    U.$('#sidepane').hidden = false;
    B.emit('sidepane');
    requestAnimationFrame(() => B.editor.layout());
  };
  ui.closeSidePane = () => {
    A.sidePane = null;
    U.$('#sidepane').hidden = true;
    B.emit('sidepane');
    requestAnimationFrame(() => B.editor.layout());
  };
  ui.toggleSidePane = (kind) => (A.sidePane === kind ? ui.closeSidePane() : ui.openSidePane(kind));
})(window.BSD);
