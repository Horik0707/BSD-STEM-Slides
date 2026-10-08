/* BSD STEM Slides — shared utilities */
window.BSD = window.BSD || {};
(function (B) {
  'use strict';
  const U = (B.util = {});

  U.uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  U.clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  U.clone = (o) => JSON.parse(JSON.stringify(o));
  U.round = (v, p = 1) => Math.round(v * p) / p;
  U.$ = (sel, root = document) => root.querySelector(sel);
  U.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  U.esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  U.icon = (name, cls = '') => `<span class="ms ${cls}" aria-hidden="true">${name}</span>`;

  /** Tiny DOM builder: h('div', {class:'x', onclick: fn}, child, 'text') */
  U.h = (tag, attrs, ...children) => {
    const n = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
        else if (k === 'html') n.innerHTML = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
        else if (k === 'dataset') Object.assign(n.dataset, v);
        else n.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return n;
  };

  U.debounce = (fn, ms) => {
    let t;
    const d = (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
    d.flush = (...a) => {
      clearTimeout(t);
      fn(...a);
    };
    return d;
  };

  U.readFile = (file, as = 'dataURL') =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(r.error);
      if (as === 'text') r.readAsText(file);
      else if (as === 'buffer') r.readAsArrayBuffer(file);
      else r.readAsDataURL(file);
    });

  U.pickFile = (accept, multiple = false) =>
    new Promise((res) => {
      const inp = U.h('input', { type: 'file', accept, style: 'display:none' });
      if (multiple) inp.multiple = true;
      inp.addEventListener('change', () => {
        res(multiple ? Array.from(inp.files) : inp.files[0] || null);
        inp.remove();
      });
      document.body.appendChild(inp);
      inp.click();
    });

  U.download = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = U.h('a', { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  U.safeFilename = (s) => (String(s || 'Presentation').replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'Presentation');

  const scriptCache = {};
  U.loadScript = (src) =>
    (scriptCache[src] =
      scriptCache[src] ||
      new Promise((res, rej) => {
        const s = U.h('script', { src });
        s.onload = res;
        s.onerror = () => {
          delete scriptCache[src];
          rej(new Error('Could not load ' + src));
        };
        document.head.appendChild(s);
      }));

  U.loadImage = (src) =>
    new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = src;
    });

  /** Downscale very large images so decks stay small enough to autosave. */
  U.shrinkImage = async (dataUrl, maxDim = 1920) => {
    if (!/^data:image\/(png|jpe?g|webp)/.test(dataUrl)) return dataUrl;
    const img = await U.loadImage(dataUrl);
    const big = Math.max(img.naturalWidth, img.naturalHeight);
    if (big <= maxDim && dataUrl.length < 1.5e6) return dataUrl;
    const k = Math.min(1, maxDim / big);
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const png = dataUrl.startsWith('data:image/png');
    const out = c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.88);
    return out.length < dataUrl.length ? out : dataUrl;
  };

  /* ---------- HTML sanitising for rich text ---------- */
  const OK_TAGS = new Set(['DIV', 'P', 'BR', 'SPAN', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'SUB', 'SUP', 'UL', 'OL', 'LI', 'A', 'FONT']);
  const OK_ATTR = new Set(['style', 'href', 'color', 'face', 'size', 'target']);
  U.sanitizeHtml = (html) => {
    const tpl = document.createElement('template');
    tpl.innerHTML = String(html || '');
    const walk = (node) => {
      for (const c of Array.from(node.childNodes)) {
        if (c.nodeType === 3) continue;
        if (c.nodeType !== 1 || !OK_TAGS.has(c.tagName)) {
          if (c.nodeType === 1 && !/^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED)$/.test(c.tagName)) {
            walk(c);
            c.replaceWith(...c.childNodes);
          } else c.remove();
          continue;
        }
        for (const a of Array.from(c.attributes)) {
          const n = a.name.toLowerCase();
          if (!OK_ATTR.has(n)) c.removeAttribute(a.name);
          else if (n === 'href' && !/^(https?:|mailto:|#)/i.test(a.value.trim())) c.removeAttribute(a.name);
          else if (n === 'style' && /expression|url\s*\(|javascript:/i.test(a.value)) c.removeAttribute(a.name);
        }
        walk(c);
      }
    };
    walk(tpl.content);
    return tpl.innerHTML;
  };

  U.htmlToText = (html) => {
    const d = document.createElement('div');
    d.innerHTML = String(html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(div|p|li)>/gi, '\n');
    return d.textContent.replace(/\n{3,}/g, '\n\n').trim();
  };

  U.textToHtml = (text) =>
    String(text || '')
      .split(/\r?\n/)
      .map((l) => `<div>${U.esc(l) || '<br>'}</div>`)
      .join('');

  U.isHtmlEmpty = (html) => {
    if (!html) return true;
    const d = document.createElement('div');
    d.innerHTML = html;
    return d.textContent.replace(/​/g, '').trim() === '' && !d.querySelector('img');
  };

  /* ---------- colours ---------- */
  U.hexToRgb = (hex) => {
    let h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    if (isNaN(n) || h.length !== 6) return null;
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  };
  U.rgbToHex = (r, g, b) => '#' + [r, g, b].map((v) => U.clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  /** Accepts '#rrggbb', 'rgb(...)', 'rgba(...)' → '#rrggbb' or null */
  U.toHex = (c) => {
    if (!c) return null;
    c = String(c).trim();
    if (c[0] === '#') {
      const rgb = U.hexToRgb(c);
      return rgb ? U.rgbToHex(rgb.r, rgb.g, rgb.b) : null;
    }
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (m) {
      const p = m[1].split(/[ ,/]+/).filter(Boolean).map(parseFloat);
      if (p.length >= 4 && p[3] === 0) return null;
      return U.rgbToHex(p[0], p[1], p[2]);
    }
    return null;
  };
  U.mix = (hex, other, t) => {
    const a = U.hexToRgb(hex), b = U.hexToRgb(other);
    if (!a || !b) return hex;
    return U.rgbToHex(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t);
  };
  U.luminance = (hex) => {
    const c = U.hexToRgb(hex);
    if (!c) return 1;
    const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };

  /* ---------- IndexedDB key/value storage ---------- */
  let dbp = null;
  const db = () =>
    (dbp =
      dbp ||
      new Promise((res, rej) => {
        if (!window.indexedDB) return rej(new Error('IndexedDB unavailable'));
        const req = indexedDB.open('bsd-stem-slides', 1);
        req.onupgradeneeded = () => {
          const d = req.result;
          if (!d.objectStoreNames.contains('decks')) d.createObjectStore('decks', { keyPath: 'id' });
          if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'id' });
        };
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      }));
  const tx = async (store, mode, fn) => {
    const d = await db();
    return new Promise((res, rej) => {
      const t = d.transaction(store, mode);
      const s = t.objectStore(store);
      let out;
      const r = fn(s);
      if (r) r.onsuccess = () => (out = r.result);
      t.oncomplete = () => res(out);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    });
  };
  U.idb = {
    get: (store, key) => tx(store, 'readonly', (s) => s.get(key)),
    put: (store, val) => tx(store, 'readwrite', (s) => s.put(val)),
    del: (store, key) => tx(store, 'readwrite', (s) => s.delete(key)),
    all: (store) => tx(store, 'readonly', (s) => s.getAll()),
  };

  U.storage = {
    get(k, d) {
      try {
        const v = localStorage.getItem('bsd-slides:' + k);
        return v == null ? d : JSON.parse(v);
      } catch (e) {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem('bsd-slides:' + k, JSON.stringify(v));
      } catch (e) {
        /* ignore */
      }
    },
  };

  U.isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  U.mod = (e) => (U.isMac ? e.metaKey : e.ctrlKey);
  U.fmtTime = (ms) => {
    const s = Math.floor(ms / 1000);
    const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
    return (hh ? hh + ':' + String(mm).padStart(2, '0') : mm) + ':' + String(ss).padStart(2, '0');
  };
  U.fmtDate = (t) => {
    const d = new Date(t);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return 'Today ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
  };

  /* ---------- tiny event bus ---------- */
  const handlers = {};
  B.on = (evt, fn) => (handlers[evt] = handlers[evt] || []).push(fn);
  B.emit = (evt, data) => (handlers[evt] || []).forEach((fn) => fn(data));
})(window.BSD);
