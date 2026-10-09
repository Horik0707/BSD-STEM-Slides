/* BSD STEM Slides — 3D models (OBJ / STL): still renders for editing, live interactive viewers in the show */
(function (B) {
  'use strict';
  const U = B.util, A = B.app, M = B.model;
  const h = U.h;
  const T = (B.model3d = {});

  T.MAX_BYTES = 40 * 1024 * 1024;
  T.SPIN = { none: 0, slow: 15, medium: 35, fast: 70 }; // degrees per second
  T.VIEWS = [
    ['front', 'Front', 0, 0],
    ['back', 'Back', 0, 180],
    ['left', 'Left', 0, 90],
    ['right', 'Right', 0, -90],
    ['top', 'Top', 90, 0],
    ['bottom', 'Bottom', -90, 0],
    ['iso', 'Above Front Left', 25, 35],
    ['iso2', 'Above Front Right', 25, -35],
  ];
  const RAD = Math.PI / 180;

  /* ---------------- loading three.js on demand ---------------- */
  let readyP = null;
  T.ready = () =>
    (readyP =
      readyP ||
      U.loadScript('vendor/three/three.min.js')
        .then(() => Promise.all([U.loadScript('vendor/three/OBJLoader.js'), U.loadScript('vendor/three/STLLoader.js')]))
        .catch((e) => {
          readyP = null;
          throw e;
        }));

  const decode = (dataUrl) => {
    const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  };

  /** "red", "#3366ff", "steelblue"… → hex, so OBJ material names can colour parts. */
  const colorFromName = (name) => {
    if (!name) return null;
    const n = String(name).trim();
    const s = new Option().style;
    s.color = n.replace(/_/g, '');
    if (!s.color) return null;
    const c = document.createElement('canvas').getContext('2d');
    c.fillStyle = s.color;
    return c.fillStyle;
  };

  /* ---------------- parsing (cached per file) ---------------- */
  const parsed = new Map(); // asset id -> Promise<{ object }>
  T.load = (el) => {
    const key = el.asset;
    if (!parsed.has(key)) {
      parsed.set(
        key,
        T.ready().then(() => {
          const THREE = window.THREE;
          const data = A.assets[el.asset];
          if (!data) throw new Error('Model data is missing');
          const bytes = decode(data);
          let object;
          if (el.format === 'stl') {
            const geo = new THREE.STLLoader().parse(bytes.buffer);
            geo.computeVertexNormals(); // many STL exporters write zero normals, which renders black
            object = new THREE.Group();
            object.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial()));
          } else {
            object = new THREE.OBJLoader().parse(new TextDecoder().decode(bytes));
          }
          let meshes = 0;
          object.traverse((o) => {
            if (!o.isMesh) return;
            meshes++;
            if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            o.userData.partColors = mats.map((m) => colorFromName(m && m.name));
          });
          if (!meshes) throw new Error('No 3D shapes were found in that file');
          // centre the model and scale it to fit a unit sphere
          const box = new THREE.Box3().setFromObject(object);
          const sphere = box.getBoundingSphere(new THREE.Sphere());
          const s = sphere.radius > 0 ? 1 / sphere.radius : 1;
          object.position.copy(sphere.center).multiplyScalar(-s);
          object.scale.setScalar(s);
          const pivot = new THREE.Group();
          pivot.add(object);
          return { object: pivot };
        })
      );
      parsed.get(key).catch(() => parsed.delete(key));
    }
    return parsed.get(key);
  };

  /** A posed, coloured copy of the model for one scene. */
  const instance = (base, el, theme) => {
    const THREE = window.THREE;
    const color = B.resolveColor(el.color || '@accent1', theme) || '#4472C4';
    const copy = base.object.clone(true);
    copy.traverse((o) => {
      if (!o.isMesh) return;
      const cols = o.userData.partColors || [];
      const make = (i) => new THREE.MeshStandardMaterial({ color: (el.useFileColors !== false && cols[i]) || color, roughness: 0.5, metalness: 0.08, wireframe: !!el.wireframe, side: THREE.DoubleSide });
      o.material = Array.isArray(o.material) ? o.material.map((m, i) => make(i)) : make(0);
    });
    return copy;
  };

  const buildScene = () => {
    const THREE = window.THREE;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 0.65));
    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const key = new THREE.DirectionalLight(0xffffff, 0.85);
    key.position.set(2.5, 3.5, 5);
    camera.add(key); // light follows the camera so the front is always lit
    const rim = new THREE.DirectionalLight(0xffffff, 0.3);
    rim.position.set(-4, -1, -3);
    camera.add(rim);
    scene.add(camera);
    return { scene, camera };
  };

  /** Point the camera so the whole model fits, then apply the element's pose plus any live yaw/pitch/zoom. */
  const frame = (camera, obj, el, w, hgt, live = {}) => {
    const aspect = Math.max(0.05, w / Math.max(1, hgt));
    camera.aspect = aspect;
    const vfov = camera.fov * RAD;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
    const dist = (1.08 / Math.sin(Math.min(vfov, hfov) / 2)) / ((el.zoom || 1) * (live.zoom || 1));
    camera.position.set(0, 0, dist);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    obj.rotation.order = 'YXZ';
    obj.rotation.set(((el.rotX || 0) + (live.pitch || 0)) * RAD, ((el.rotY || 0) + (live.yaw || 0)) * RAD, (el.rotZ || 0) * RAD);
  };

  /* ---------------- still renders (editor, thumbnails, print, export) ---------------- */
  let snap = null;
  const snapRenderer = () => {
    if (!snap) {
      const THREE = window.THREE;
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      renderer.setClearColor(0x000000, 0);
      snap = Object.assign({ renderer, models: new Map() }, buildScene());
    }
    return snap;
  };
  const poseKey = (el, theme, w, hgt) => [el.asset, el.rotX || 0, el.rotY || 0, el.rotZ || 0, el.zoom || 1, B.resolveColor(el.color || '@accent1', theme), !!el.wireframe, el.useFileColors !== false, w, hgt].join('|');
  const stills = new Map(); // pose key -> canvas (small LRU)
  let pending = 0;
  let idleWaiters = [];
  const settle = () => {
    if (pending === 0) {
      idleWaiters.forEach((r) => r());
      idleWaiters = [];
    }
  };
  /** Resolves once every queued still render has been drawn (used before printing). */
  T.idle = () => (pending === 0 ? Promise.resolve() : new Promise((r) => idleWaiters.push(r)));

  const drawStill = (base, canvas, el, theme) => {
    const w = canvas.width, hgt = canvas.height;
    const key = poseKey(el, theme, w, hgt);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, w, hgt);
    let img = stills.get(key);
    if (!img) {
      const s = snapRenderer();
      let inst = s.models.get(el.id);
      if (!inst || inst.key !== key) {
        if (inst) s.scene.remove(inst.obj);
        inst = { obj: instance(base, el, theme), key };
        s.models.set(el.id, inst);
      }
      s.scene.children.filter((c) => c.userData.isModel && c !== inst.obj).forEach((c) => s.scene.remove(c));
      inst.obj.userData.isModel = true;
      if (inst.obj.parent !== s.scene) s.scene.add(inst.obj);
      s.renderer.setSize(w, hgt, false);
      frame(s.camera, inst.obj, el, w, hgt);
      s.renderer.render(s.scene, s.camera);
      img = document.createElement('canvas');
      img.width = w;
      img.height = hgt;
      img.getContext('2d').drawImage(s.renderer.domElement, 0, 0);
      stills.set(key, img);
      if (stills.size > 60) stills.delete(stills.keys().next().value);
    }
    ctx.drawImage(img, 0, 0);
  };

  /** Draw a still of the model into `canvas` (asynchronously the first time three.js or the file loads). */
  T.paint = (canvas, el, theme) => {
    pending++;
    const node = canvas.parentNode;
    T.load(el)
      .then((base) => {
        drawStill(base, canvas, el, theme);
        if (node) node.classList.remove('m3d-loading');
      })
      .catch((err) => {
        if (node) {
          node.classList.remove('m3d-loading');
          node.classList.add('m3d-error');
          node.dataset.error = err && err.message ? err.message : 'This 3D model could not be shown.';
        }
      })
      .finally(() => {
        pending--;
        settle();
      });
  };

  /** Redraw an element already on the canvas right away (used while dragging the 3D-rotate handle). */
  T.repaintNode = (node, el, theme) => {
    const canvas = node && node.querySelector('canvas.m3d-still');
    if (!canvas || !parsed.has(el.asset)) return;
    parsed.get(el.asset).then((base) => drawStill(base, canvas, el, theme)).catch(() => {});
  };

  /** PNG of the current view, e.g. for PowerPoint export. */
  T.png = async (el, theme, w, hgt) => {
    const base = await T.load(el);
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(hgt));
    drawStill(base, c, el, theme);
    return c.toDataURL('image/png');
  };

  /* ---------------- element rendering ---------------- */
  T.render = (n, el, ctx) => {
    n.classList.add('m3d-loading');
    n.setAttribute('role', 'img');
    n.setAttribute('aria-label', '3D model: ' + (el.alt || el.name || 'model'));
    if (ctx.mode === 'show') {
      const canvas = h('canvas', { class: 'm3d-live' });
      n.appendChild(canvas);
      if (el.interactive !== false) n.classList.add('m3d-interactive');
      T.mountLive(canvas, el, ctx.theme, ctx.deck);
      return;
    }
    // thumbnails are tiny; the editor and print want crisp pixels
    const res = ctx.mode === 'thumb' ? 0.4 : ctx.mode === 'print' ? 2 : Math.min(2, (window.devicePixelRatio || 1) * 1.25);
    const canvas = h('canvas', { class: 'm3d-still', width: Math.max(2, Math.round(el.w * res)), height: Math.max(2, Math.round(el.h * res)) });
    n.appendChild(canvas);
    T.paint(canvas, el, ctx.theme);
  };

  /* ---------------- live viewers in the slide show ---------------- */
  const live = new Set();
  T.onPose = null; // set by the slide show to mirror poses to the audience window
  const audience = () => document.body.classList.contains('audience-mode');

  T.mountLive = (canvas, el, theme, deck) => {
    const THREE_ready = T.load(el);
    const auto = deck && deck.showMode === 'auto';
    const v = {
      el, canvas, yaw: 0, pitch: 0, zoom: 1, dragging: false, lastInput: 0, born: performance.now(), seen: false,
      spin: audience() ? 0 : T.SPIN[auto || el.spinManual ? el.spin || 'slow' : 'none'] || 0,
      interactive: el.interactive !== false && !audience(),
      pointers: new Map(), dirty: true,
    };
    const node = canvas.parentNode;
    THREE_ready.then((base) => {
      const THREE = window.THREE;
      v.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      v.renderer.setClearColor(0x000000, 0);
      Object.assign(v, buildScene());
      v.obj = instance(base, el, theme);
      v.scene.add(v.obj);
      if (node) node.classList.remove('m3d-loading');
      live.add(v);
      if (v.interactive) wire(v);
      v.last = performance.now();
      requestAnimationFrame((t) => tick(v, t));
    }).catch((err) => {
      if (node) {
        node.classList.remove('m3d-loading');
        node.classList.add('m3d-error');
        node.dataset.error = err && err.message ? err.message : 'This 3D model could not be shown.';
      }
    });
    return v;
  };

  const sendPose = (v) => {
    if (!T.onPose) return;
    const now = performance.now();
    if (now - (v.sent || 0) < 33) return;
    v.sent = now;
    T.onPose(v.el.id, { yaw: v.yaw, pitch: v.pitch, zoom: v.zoom });
  };

  function tick(v, t) {
    if (v.disposed) return;
    if (!v.canvas.isConnected) {
      // layers are built before they're attached; once a shown layer is gone, free the GPU context
      if (v.seen || t - v.born > 8000) return dispose(v);
      requestAnimationFrame((tt) => tick(v, tt));
      return;
    }
    v.seen = true;
    const dt = Math.min(0.1, (t - v.last) / 1000);
    v.last = t;
    if (v.spin && !v.dragging && t - v.lastInput > 2500) {
      v.yaw += v.spin * dt;
      v.dirty = true;
      sendPose(v);
    }
    const r = v.canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(2, Math.round(r.width * dpr)), hgt = Math.max(2, Math.round(r.height * dpr));
    if (v.w !== w || v.h !== hgt) {
      v.renderer.setSize(w, hgt, false);
      v.w = w;
      v.h = hgt;
      v.dirty = true;
    }
    if (v.dirty) {
      frame(v.camera, v.obj, v.el, w, hgt, v);
      v.renderer.render(v.scene, v.camera);
      v.dirty = false;
    }
    requestAnimationFrame((tt) => tick(v, tt));
  }

  function dispose(v) {
    v.disposed = true;
    live.delete(v);
    try {
      v.renderer.dispose();
      v.renderer.forceContextLoss && v.renderer.forceContextLoss();
    } catch (e) {
      /* ignore */
    }
  }

  /** Drag to rotate, wheel / pinch to zoom, double-click to reset. */
  function wire(v) {
    const c = v.canvas;
    const stop = (e) => e.stopPropagation();
    c.addEventListener('click', stop);
    c.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      c.setPointerCapture(e.pointerId);
      v.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      v.dragging = true;
      v.lastInput = performance.now();
    });
    c.addEventListener('pointermove', (e) => {
      const p = v.pointers.get(e.pointerId);
      if (!p) return;
      e.stopPropagation();
      if (v.pointers.size === 2) {
        const [a, b] = [...v.pointers.values()];
        const before = Math.hypot(a.x - b.x, a.y - b.y);
        p.x = e.clientX;
        p.y = e.clientY;
        const [a2, b2] = [...v.pointers.values()];
        const after = Math.hypot(a2.x - b2.x, a2.y - b2.y);
        if (before > 0) v.zoom = U.clamp(v.zoom * (after / before), 0.4, 5);
      } else {
        v.yaw += (e.clientX - p.x) * 0.5;
        v.pitch = U.clamp(v.pitch + (e.clientY - p.y) * 0.5, -89, 89);
        p.x = e.clientX;
        p.y = e.clientY;
      }
      v.lastInput = performance.now();
      v.dirty = true;
      sendPose(v);
    });
    const up = (e) => {
      v.pointers.delete(e.pointerId);
      if (!v.pointers.size) v.dragging = false;
      v.lastInput = performance.now();
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      e.stopPropagation();
      v.zoom = U.clamp(v.zoom * Math.exp(-e.deltaY * 0.0015), 0.4, 5);
      v.lastInput = performance.now();
      v.dirty = true;
      sendPose(v);
    }, { passive: false });
    c.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      v.yaw = v.pitch = 0;
      v.zoom = 1;
      v.dirty = true;
      sendPose(v);
    });
  }

  /** Audience window: follow the presenter's view of a model. */
  T.setPose = (id, pose) => {
    live.forEach((v) => {
      if (v.el.id !== id) return;
      Object.assign(v, { yaw: pose.yaw, pitch: pose.pitch, zoom: pose.zoom, dirty: true });
    });
  };
  T.disposeAll = () => live.forEach(dispose);

  /* ---------------- inserting ---------------- */
  T.insertFile = async (file, at) => {
    if (!file) return;
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (ext !== 'obj' && ext !== 'stl') return B.ui.toast('Choose an .obj or .stl 3D model file.');
    if (file.size > T.MAX_BYTES) return B.ui.toast('That 3D model is over 40 MB. Try simplifying it first.');
    if (file.size > 15 * 1024 * 1024) B.ui.toast('Large model — it may take a moment to appear.', 2500);
    const data = await U.readFile(file);
    return T.insertData(data.replace(/^data:[^;,]*/, 'data:application/octet-stream'), ext, file.name.replace(/\.[^.]+$/, ''), at);
  };

  T.insertData = async (data, format, name, at) => {
    const el = M.newElement('model3d', { asset: M.addAsset(data), format, name: name || '3D Model', alt: name || '3D model' });
    try {
      await T.load(el); // fail early on unreadable files instead of leaving a broken object
    } catch (err) {
      B.ui.toast('That file could not be read as a 3D model. ' + (err && err.message ? err.message : ''), 4500);
      return null;
    }
    B.editor.insertElement(el, { at });
    return el;
  };

  T.pickAndInsert = async () => {
    const f = await U.pickFile('.obj,.stl,model/stl,model/obj');
    if (f) T.insertFile(f);
  };

  T.replace = async (el) => {
    const f = await U.pickFile('.obj,.stl,model/stl,model/obj');
    if (!f) return;
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    if (ext !== 'obj' && ext !== 'stl') return B.ui.toast('Choose an .obj or .stl 3D model file.');
    const data = (await U.readFile(f)).replace(/^data:[^;,]*/, 'data:application/octet-stream');
    const trial = { asset: M.addAsset(data), format: ext };
    try {
      await T.load(trial);
    } catch (err) {
      return B.ui.toast('That file could not be read as a 3D model.');
    }
    Object.assign(el, trial, { name: f.name.replace(/\.[^.]+$/, '') });
    B.editor.changed(true);
  };

  /* ---------------- built-in sample models (generated as OBJ text) ---------------- */
  const objWriter = () => {
    const lines = [];
    let base = 1;
    return {
      mesh(name, color, verts, faces, normals) {
        lines.push(`o ${name}`, `usemtl ${color}`);
        verts.forEach(([x, y, z]) => lines.push(`v ${x.toFixed(5)} ${y.toFixed(5)} ${z.toFixed(5)}`));
        if (normals) normals.forEach(([x, y, z]) => lines.push(`vn ${x.toFixed(4)} ${y.toFixed(4)} ${z.toFixed(4)}`));
        faces.forEach((f) => lines.push('f ' + f.map((i) => (normals ? `${i + base}//${i + base}` : i + base)).join(' ')));
        base += verts.length;
      },
      text: () => lines.join('\n'),
    };
  };
  const sphere = (cx, cy, cz, r, seg = 28, rings = 18) => {
    const v = [], f = [], nm = [];
    for (let i = 0; i <= rings; i++) {
      const th = (i / rings) * Math.PI;
      for (let j = 0; j <= seg; j++) {
        const ph = (j / seg) * Math.PI * 2;
        const n = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
        nm.push(n);
        v.push([cx + r * n[0], cy + r * n[1], cz + r * n[2]]);
      }
    }
    for (let i = 0; i < rings; i++)
      for (let j = 0; j < seg; j++) {
        const a = i * (seg + 1) + j, b = a + seg + 1;
        f.push([a, b, b + 1, a + 1]);
      }
    return [v, f, nm];
  };
  /** Tube of radius r along a list of 3D points. */
  const tube = (pts, r, seg = 12, closed = false) => {
    const v = [], f = [], nm = [];
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n], o = pts[(i - 1 + n) % n];
      const next = closed || i < n - 1 ? q : p, prev = closed || i > 0 ? o : p;
      let t = [next[0] - prev[0], next[1] - prev[1], next[2] - prev[2]];
      const tl = Math.hypot(...t) || 1;
      t = t.map((x) => x / tl);
      const up = Math.abs(t[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
      let nx = [t[1] * up[2] - t[2] * up[1], t[2] * up[0] - t[0] * up[2], t[0] * up[1] - t[1] * up[0]];
      const nl = Math.hypot(...nx) || 1;
      nx = nx.map((x) => x / nl);
      const bx = [t[1] * nx[2] - t[2] * nx[1], t[2] * nx[0] - t[0] * nx[2], t[0] * nx[1] - t[1] * nx[0]];
      for (let j = 0; j < seg; j++) {
        const a = (j / seg) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
        nm.push([nx[0] * c + bx[0] * s, nx[1] * c + bx[1] * s, nx[2] * c + bx[2] * s]);
        v.push([p[0] + (nx[0] * c + bx[0] * s) * r, p[1] + (nx[1] * c + bx[1] * s) * r, p[2] + (nx[2] * c + bx[2] * s) * r]);
      }
    }
    const rings = closed ? n : n - 1;
    for (let i = 0; i < rings; i++)
      for (let j = 0; j < seg; j++) {
        const a = i * seg + j, b = i * seg + ((j + 1) % seg), c = ((i + 1) % n) * seg + ((j + 1) % seg), d = ((i + 1) % n) * seg + j;
        f.push([a, b, c, d]);
      }
    return [v, f, nm];
  };
  const toData = (text) => 'data:application/octet-stream;base64,' + btoa(unescape(encodeURIComponent(text)));

  T.SAMPLES = [
    {
      id: 'water', name: 'Water Molecule (H₂O)', icon: 'water_drop',
      make() {
        const w = objWriter();
        const ang = (104.5 / 2) * RAD, d = 1.15;
        const H1 = [Math.sin(ang) * d, -Math.cos(ang) * d, 0], H2 = [-Math.sin(ang) * d, -Math.cos(ang) * d, 0];
        w.mesh('Oxygen', 'red', ...sphere(0, 0, 0, 0.62));
        w.mesh('Hydrogen1', 'white', ...sphere(...H1, 0.4));
        w.mesh('Hydrogen2', 'white', ...sphere(...H2, 0.4));
        w.mesh('Bond1', 'gray', ...tube([[0, 0, 0], H1], 0.1, 14));
        w.mesh('Bond2', 'gray', ...tube([[0, 0, 0], H2], 0.1, 14));
        return w.text();
      },
    },
    {
      id: 'methane', name: 'Methane (CH₄)', icon: 'bubble_chart',
      make() {
        const w = objWriter();
        const d = 1.1, k = d / Math.sqrt(3);
        const Hs = [[k, k, k], [k, -k, -k], [-k, k, -k], [-k, -k, k]];
        w.mesh('Carbon', 'dimgray', ...sphere(0, 0, 0, 0.55));
        Hs.forEach((p, i) => {
          w.mesh('Hydrogen' + (i + 1), 'white', ...sphere(...p, 0.36));
          w.mesh('Bond' + (i + 1), 'silver', ...tube([[0, 0, 0], p], 0.09, 14));
        });
        return w.text();
      },
    },
    {
      id: 'dna', name: 'DNA Double Helix', icon: 'genetics',
      make() {
        const w = objWriter();
        const turns = 2.2, n = 160, R = 0.55, H = 3.4;
        const strand = (off) => Array.from({ length: n }, (_, i) => {
          const t = i / (n - 1), a = t * turns * Math.PI * 2 + off;
          return [Math.cos(a) * R, (t - 0.5) * H, Math.sin(a) * R];
        });
        const s1 = strand(0), s2 = strand(Math.PI);
        w.mesh('Strand1', 'royalblue', ...tube(s1, 0.07, 10));
        w.mesh('Strand2', 'tomato', ...tube(s2, 0.07, 10));
        const pairs = ['gold', 'mediumseagreen'];
        for (let i = 4; i < n - 4; i += 8) w.mesh('Base' + i, pairs[(i / 8) % 2 | 0], ...tube([s1[i], s2[i]], 0.035, 8));
        return w.text();
      },
    },
    {
      id: 'knot', name: 'Torus Knot', icon: 'all_inclusive',
      make() {
        const w = objWriter();
        const pts = Array.from({ length: 240 }, (_, i) => {
          const t = (i / 240) * Math.PI * 2, p = 2, q = 3, r = 0.6 + 0.25 * Math.cos(q * t);
          return [r * Math.cos(p * t), 0.25 * Math.sin(q * t), r * Math.sin(p * t)];
        });
        w.mesh('Knot', 'model', ...tube(pts, 0.12, 16, true));
        return w.text();
      },
    },
    {
      id: 'ico', name: 'Icosahedron', icon: 'hexagon',
      make() {
        const w = objWriter();
        const p = (1 + Math.sqrt(5)) / 2;
        const v = [[-1, p, 0], [1, p, 0], [-1, -p, 0], [1, -p, 0], [0, -1, p], [0, 1, p], [0, -1, -p], [0, 1, -p], [p, 0, -1], [p, 0, 1], [-p, 0, -1], [-p, 0, 1]];
        const f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
        w.mesh('Icosahedron', 'model', v, f);
        return w.text();
      },
    },
  ];
  T.insertSample = (id) => {
    const s = T.SAMPLES.find((x) => x.id === id);
    if (s) T.insertData(toData(s.make()), 'obj', s.name);
  };
})(window.BSD);
