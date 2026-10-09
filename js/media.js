/* BSD STEM Slides — audio: speaker icon element, preview player, slide-show playback, recorder */
(function (B) {
  'use strict';
  const U = B.util, A = B.app, M = B.model;
  const h = U.h;
  const MD = (B.media = {});

  MD.MAX_BYTES = 25 * 1024 * 1024;
  MD.VOLUMES = [
    [0, 'Mute', 'volume_off'],
    [0.35, 'Low', 'volume_mute'],
    [0.7, 'Medium', 'volume_down'],
    [1, 'High', 'volume_up'],
  ];

  MD.fmt = (s) => {
    if (!isFinite(s) || s < 0) s = 0;
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  /** The speaker graphic PowerPoint-style decks use for audio clips. */
  MD.iconSvg = (color, w = '100%', hgt = '100%') =>
    `<svg class="audio-icon" viewBox="0 0 100 100" width="${w}" height="${hgt}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">` +
    `<circle cx="50" cy="50" r="47" fill="${color}"/>` +
    '<path d="M27 41 H39 L54 28 V72 L39 59 H27 Z" fill="#fff"/>' +
    '<path d="M62 39 Q69 50 62 61 M69 32 Q81 50 69 68" fill="none" stroke="#fff" stroke-width="5.5" stroke-linecap="round"/></svg>';

  const src = (el) => A.assets[el.asset] || el.src || '';

  /* ---------------- element rendering ---------------- */
  MD.render = (n, el, ctx) => {
    const color = B.resolveColor(el.fill, ctx.theme) || B.resolveColor('@accent1', ctx.theme);
    n.innerHTML = MD.iconSvg(color);
    n.setAttribute('role', 'img');
    n.setAttribute('aria-label', 'Audio: ' + (el.name || 'clip'));
    if (ctx.mode !== 'show') return;
    if (el.hide) n.classList.add('audio-hidden');
    const ctl = h('div', { class: 'audio-ctl', 'data-id': el.id },
      h('button', { class: 'ac-play', type: 'button', 'aria-label': 'Play', html: U.icon('play_arrow') }),
      h('span', { class: 'ac-track' }, h('i', {})),
      h('span', { class: 'ac-time' }, '0:00'));
    n.appendChild(ctl);
  };

  /* ---------------- inserting ---------------- */
  /** Strip codec details ("audio/webm;codecs=opus") so the clip is a plain data URL. */
  const cleanDataUrl = (d) => d.replace(/^data:([^;,]+)(;[^,]*?)?;base64,/, 'data:$1;base64,');

  MD.insertFile = async (file, at) => {
    if (!file) return;
    if (!/^audio\//.test(file.type) && !/\.(mp3|wav|m4a|aac|ogg|oga|opus|webm|flac)$/i.test(file.name)) return B.ui.toast('That file is not an audio file.');
    if (file.size > MD.MAX_BYTES) return B.ui.toast('That audio file is over 25 MB. Try a shorter clip or an MP3.');
    const data = cleanDataUrl(await U.readFile(file));
    MD.insertData(data, file.name.replace(/\.[^.]+$/, ''), at);
  };

  MD.insertData = (data, name, at) => {
    const asset = M.addAsset(data);
    const el = M.newElement('audio', { asset, name: name || 'Audio' });
    if (!at) {
      // PowerPoint drops the speaker icon in the middle of the slide
      at = { x: A.deck.w / 2, y: A.deck.h / 2 };
    }
    B.editor.insertElement(el, { at });
    return el;
  };

  MD.pickAndInsert = async () => {
    const f = await U.pickFile('audio/*,.mp3,.wav,.m4a,.aac,.ogg,.opus,.webm,.flac');
    if (f) MD.insertFile(f);
  };

  MD.replace = async (el) => {
    const f = await U.pickFile('audio/*,.mp3,.wav,.m4a,.aac,.ogg,.opus,.webm,.flac');
    if (!f) return;
    if (f.size > MD.MAX_BYTES) return B.ui.toast('That audio file is over 25 MB.');
    MD.stopPreview();
    el.asset = M.addAsset(cleanDataUrl(await U.readFile(f)));
    el.name = f.name.replace(/\.[^.]+$/, '');
    B.editor.changed(true);
  };

  /* ---------------- preview while editing ---------------- */
  let pv = null; // { id, audio }
  MD.previewState = (id) => (pv && pv.id === id ? { playing: !pv.audio.paused, t: pv.audio.currentTime, d: pv.audio.duration } : { playing: false, t: 0, d: NaN });
  MD.isPreviewing = (id) => !!pv && pv.id === id && !pv.audio.paused;

  MD.togglePreview = (el) => {
    if (!el || !src(el)) return;
    if (pv && pv.id === el.id) {
      if (pv.audio.paused) pv.audio.play().catch(() => B.ui.toast('This audio could not be played.'));
      else pv.audio.pause();
      return;
    }
    MD.stopPreview();
    const audio = new Audio(src(el));
    audio.volume = el.volume == null ? 1 : el.volume;
    pv = { id: el.id, audio };
    const tick = () => {
      updateBars(el.id, audio);
      B.emit('media');
    };
    ['play', 'pause', 'timeupdate', 'loadedmetadata', 'ended'].forEach((ev) => audio.addEventListener(ev, tick));
    audio.addEventListener('ended', () => (audio.currentTime = 0));
    audio.play().catch(() => B.ui.toast('This audio could not be played.'));
  };
  MD.seekPreview = (el, frac) => {
    if (!pv || pv.id !== el.id) {
      MD.togglePreview(el);
      if (!pv) return;
    }
    const go = () => (pv.audio.currentTime = frac * (pv.audio.duration || 0));
    if (isFinite(pv.audio.duration)) go();
    else pv.audio.addEventListener('loadedmetadata', go, { once: true });
  };
  MD.stopPreview = () => {
    if (!pv) return;
    const id = pv.id;
    pv.audio.pause();
    pv.audio.src = '';
    pv = null;
    updateBars(id, null);
    B.emit('media');
  };

  /** Play bar shown under a selected audio icon in the editor (drawn on the selection overlay). */
  MD.editorBar = (el, left, top, width) => {
    const st = MD.previewState(el.id);
    const bar = h('div', { class: 'audio-bar', 'data-id': el.id, style: { left: left + 'px', top: top + 'px', width: Math.max(190, width) + 'px' } });
    const play = h('button', { class: 'ab-play', type: 'button', title: st.playing ? 'Pause' : 'Play', 'aria-label': st.playing ? 'Pause' : 'Play', html: U.icon(st.playing ? 'pause' : 'play_arrow') });
    const track = h('span', { class: 'ab-track', title: 'Seek' }, h('i', { style: { width: (isFinite(st.d) && st.d ? (st.t / st.d) * 100 : 0) + '%' } }));
    const time = h('span', { class: 'ab-time' }, MD.fmt(st.t));
    bar.append(play, track, time);
    bar.addEventListener('pointerdown', (e) => e.stopPropagation());
    play.addEventListener('click', (e) => {
      e.stopPropagation();
      MD.togglePreview(el);
    });
    track.addEventListener('click', (e) => {
      e.stopPropagation();
      const r = track.getBoundingClientRect();
      MD.seekPreview(el, U.clamp((e.clientX - r.left) / r.width, 0, 1));
    });
    return bar;
  };

  const paintCtl = (node, audio) => {
    if (!node) return;
    const playing = audio && !audio.paused;
    const btn = node.querySelector('.ab-play, .ac-play');
    if (btn) {
      btn.innerHTML = U.icon(playing ? 'pause' : 'play_arrow');
      btn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    }
    const fill = node.querySelector('.ab-track i, .ac-track i');
    const d = audio ? audio.duration : NaN;
    if (fill) fill.style.width = (audio && isFinite(d) && d ? (audio.currentTime / d) * 100 : 0) + '%';
    const t = node.querySelector('.ab-time, .ac-time');
    if (t) t.textContent = audio ? (playing || audio.currentTime ? MD.fmt(audio.currentTime) : MD.fmt(d)) : '0:00';
    node.classList.toggle('playing', !!playing);
  };
  const updateBars = (id, audio) => U.$$(`#overlay .audio-bar[data-id="${CSS.escape(id)}"]`).forEach((n) => paintCtl(n, audio));

  /* ---------------- playback during a slide show ---------------- */
  let sh = null; // { muted, players: Map(id -> {audio, el}), root }

  MD.showStart = (opts = {}) => {
    MD.stopPreview();
    MD.showStop();
    sh = { muted: !!opts.muted, players: new Map() };
  };
  MD.showStop = () => {
    if (!sh) return;
    sh.players.forEach((p) => {
      p.audio.pause();
      p.audio.src = '';
    });
    sh = null;
  };

  const player = (el) => {
    let p = sh.players.get(el.id);
    if (!p) {
      const audio = new Audio(src(el));
      audio.preload = 'auto';
      p = { audio, el };
      const paint = () => U.$$(`#show .audio-ctl[data-id="${CSS.escape(el.id)}"]`).forEach((n) => paintCtl(n, audio));
      ['play', 'pause', 'timeupdate', 'loadedmetadata'].forEach((ev) => audio.addEventListener(ev, paint));
      audio.addEventListener('ended', () => {
        if (p.el.rewind !== false) audio.currentTime = 0;
        paint();
      });
      sh.players.set(el.id, p);
    }
    p.el = el;
    p.audio.loop = !!el.loop;
    p.audio.volume = el.volume == null ? 1 : el.volume;
    p.audio.muted = sh.muted;
    return p;
  };

  /** Draw the current state of every clip's controls on a freshly rendered slide layer. */
  MD.bindLayer = (layer, slide) => {
    if (!sh) return;
    slide.elements.filter((e) => e.type === 'audio').forEach((el) => {
      const p = sh.players.get(el.id);
      U.$$(`.audio-ctl[data-id="${CSS.escape(el.id)}"]`, layer).forEach((n) => paintCtl(n, p ? p.audio : null));
    });
  };

  MD.START_OPTIONS = [
    ['click', 'When Clicked On'],
    ['next', 'On Next Click'],
    ['auto', 'Automatically'],
  ];

  /**
   * A slide came on screen: stop clips that don't play across slides and start automatic ones.
   * opts.all (automatic slide shows) starts every clip on the slide.
   */
  MD.enterSlide = (slide, opts = {}) => {
    if (!sh) return;
    const here = new Set(slide.elements.filter((e) => e.type === 'audio').map((e) => e.id));
    sh.players.forEach((p, id) => {
      if (!here.has(id) && !p.el.across) {
        p.audio.pause();
        if (p.el.rewind !== false) p.audio.currentTime = 0;
      }
    });
    const clips = slide.elements.filter((e) => e.type === 'audio' && src(e));
    sh.pendingNext = opts.all ? [] : clips.filter((e) => e.start === 'next').map((e) => e.id);
    clips.filter((e) => opts.all || e.start === 'auto').forEach((el) => {
      const p = player(el);
      if (p.audio.paused) p.audio.play().catch(() => {});
    });
  };

  /** Manual shows: the next click on the slide starts clips set to "On Next Click". */
  MD.playNext = (slide) => {
    if (!sh || !sh.pendingNext || !sh.pendingNext.length) return false;
    const ids = sh.pendingNext;
    sh.pendingNext = [];
    slide.elements.filter((e) => ids.includes(e.id)).forEach((el) => player(el).audio.play().catch(() => {}));
    return true;
  };

  /** Resolves once every non-looping clip from this slide that is playing has finished. */
  MD.waitForSlide = (slide, isCurrent) =>
    new Promise((res) => {
      const ids = slide.elements.filter((e) => e.type === 'audio').map((e) => e.id);
      const t0 = Date.now();
      const check = () => {
        if (!sh || !isCurrent() || Date.now() - t0 > 15 * 60 * 1000) return res();
        const busy = ids.some((id) => {
          const p = sh.players.get(id);
          return p && !p.audio.paused && !p.audio.loop && !p.audio.ended;
        });
        if (!busy) return res();
        setTimeout(check, 250);
      };
      check();
    });

  /** Handle a click inside the show. Returns true when it was meant for an audio clip. */
  MD.showClick = (e, slide) => {
    if (!sh) return false;
    const node = e.target.closest('.el-audio');
    if (!node) return false;
    const el = slide.elements.find((x) => x.id === node.dataset.id);
    if (!el || !src(el)) return true;
    const p = player(el);
    const track = e.target.closest('.ac-track');
    if (track) {
      const r = track.getBoundingClientRect();
      const frac = U.clamp((e.clientX - r.left) / r.width, 0, 1);
      const go = () => (p.audio.currentTime = frac * (p.audio.duration || 0));
      if (isFinite(p.audio.duration)) go();
      else p.audio.addEventListener('loadedmetadata', go, { once: true });
      if (p.audio.paused) p.audio.play().catch(() => {});
      return true;
    }
    if (p.audio.paused) p.audio.play().catch(() => B.ui.toast('This audio could not be played.'));
    else p.audio.pause();
    return true;
  };

  /* ---------------- recorder ---------------- */
  const pickMime = () => {
    if (!window.MediaRecorder) return null;
    for (const t of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/ogg']) if (MediaRecorder.isTypeSupported(t)) return t;
    return '';
  };

  MD.recordDialog = () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || pickMime() === null) {
      B.ui.toast('This browser cannot record audio. Try Chrome, Edge or Firefox.', 4000);
      return;
    }
    let stream = null, rec = null, chunks = [], blob = null, dataUrl = null, t0 = 0, timer = null, raf = null, actx = null, closed = false;
    const n = (A.deck.slides.flatMap((s) => s.elements).filter((e) => e.type === 'audio' && /^Recording \d+$/.test(e.name || '')).length || 0) + 1;
    const name = h('input', { class: 'field', value: 'Recording ' + n, 'aria-label': 'Recording name' });
    const time = h('div', { class: 'rec-time' }, '0:00');
    const meter = h('canvas', { class: 'rec-meter', width: 360, height: 56 });
    const status = h('div', { class: 'rec-status' }, 'Press the red button to start recording.');
    const recBtn = h('button', { class: 'rec-btn', type: 'button', title: 'Record', 'aria-label': 'Record', html: U.icon('fiber_manual_record') });
    const preview = h('audio', { controls: true, class: 'rec-preview', hidden: true });
    const body = h('div', { class: 'rec-dialog' }, h('div', { class: 'rec-stage' }, recBtn, h('div', { class: 'rec-side' }, time, meter)), status, preview, h('label', { class: 'field-label' }, 'Name', name));

    const stopMeter = () => {
      cancelAnimationFrame(raf);
      if (actx) actx.close().catch(() => {});
      actx = null;
    };
    const releaseMic = () => {
      if (stream) stream.getTracks().forEach((tr) => tr.stop());
      stream = null;
    };
    const drawMeter = (analyser) => {
      const ctx = meter.getContext('2d');
      const buf = new Uint8Array(analyser.fftSize);
      const loop = () => {
        analyser.getByteTimeDomainData(buf);
        ctx.clearRect(0, 0, meter.width, meter.height);
        ctx.strokeStyle = '#e03131';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < buf.length; i++) {
          const x = (i / (buf.length - 1)) * meter.width, y = (buf[i] / 255) * meter.height;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
        raf = requestAnimationFrame(loop);
      };
      loop();
    };

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      } catch (err) {
        status.textContent = err && err.name === 'NotAllowedError' ? 'Microphone access was blocked. Allow the microphone for this site in your browser and try again.' : 'No microphone was found.';
        status.classList.add('error');
        return;
      }
      if (closed) return releaseMic();
      const mime = pickMime();
      rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks = [];
      rec.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);
      rec.onstop = async () => {
        stopMeter();
        releaseMic();
        clearInterval(timer);
        blob = new Blob(chunks, { type: (rec.mimeType || mime || 'audio/webm').split(';')[0] });
        dataUrl = cleanDataUrl(await U.readFile(blob));
        preview.src = dataUrl;
        preview.hidden = false;
        recBtn.classList.remove('on');
        recBtn.innerHTML = U.icon('replay');
        recBtn.title = recBtn.ariaLabel = 'Record again';
        status.textContent = `Recorded ${time.textContent}. Listen back, then choose Insert — or record again.`;
        insertBtn.disabled = false;
      };
      try {
        actx = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = actx.createAnalyser();
        analyser.fftSize = 1024;
        actx.createMediaStreamSource(stream).connect(analyser);
        drawMeter(analyser);
      } catch (e) {
        /* level meter is optional */
      }
      rec.start(250);
      t0 = Date.now();
      timer = setInterval(() => {
        const s = (Date.now() - t0) / 1000;
        time.textContent = MD.fmt(s);
        if (s >= 600) stop(); // 10 minute safety limit
      }, 200);
      recBtn.classList.add('on');
      recBtn.innerHTML = U.icon('stop');
      recBtn.title = recBtn.ariaLabel = 'Stop';
      status.classList.remove('error');
      status.textContent = 'Recording… press stop when you are done.';
      preview.hidden = true;
      insertBtn.disabled = true;
    };
    const stop = () => {
      if (rec && rec.state !== 'inactive') rec.stop();
    };
    recBtn.addEventListener('click', () => (rec && rec.state === 'recording' ? stop() : start()));

    const cleanup = () => {
      closed = true;
      if (rec && rec.state !== 'inactive') {
        rec.onstop = null;
        rec.stop();
      }
      clearInterval(timer);
      stopMeter();
      releaseMic();
    };
    const m = B.ui.modal({
      title: 'Record Audio',
      body,
      width: 460,
      buttons: [
        { label: 'Cancel', value: null },
        {
          label: 'Insert',
          primary: true,
          action: () => {
            if (!dataUrl) return false;
            MD.insertData(dataUrl, name.value.trim() || 'Recording ' + n);
          },
        },
      ],
      onClose: cleanup,
    });
    const insertBtn = m.box.querySelector('.modal-foot .btn.primary');
    insertBtn.disabled = true;
  };

  /* ---------------- PowerPoint export helpers ---------------- */
  /** PowerPoint plays MP3/WAV/M4A everywhere; convert anything else (e.g. browser WebM recordings) to WAV. */
  MD.toPptxAudio = async (dataUrl) => {
    const mime = (dataUrl.match(/^data:([^;,]+)/) || [])[1] || '';
    const ok = { 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/wave': 'wav', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'm4a' }[mime];
    if (ok) return { data: dataUrl, extn: ok };
    const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), (c) => c.charCodeAt(0));
    const decoded = await new (window.AudioContext || window.webkitAudioContext)().decodeAudioData(bytes.buffer);
    const rate = 22050;
    const off = new Ctx(1, Math.max(1, Math.ceil(decoded.duration * rate)), rate);
    const node = off.createBufferSource();
    node.buffer = decoded;
    node.connect(off.destination);
    node.start();
    const pcm = (await off.startRendering()).getChannelData(0);
    const buf = new ArrayBuffer(44 + pcm.length * 2);
    const v = new DataView(buf);
    const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    str(0, 'RIFF'); v.setUint32(4, 36 + pcm.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true);
    v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, pcm.length * 2, true);
    for (let i = 0; i < pcm.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 0x7fff, true);
    let bin = '';
    const u8 = new Uint8Array(buf);
    for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return { data: 'data:audio/wav;base64,' + btoa(bin), extn: 'wav' };
  };

  /** PNG of the speaker icon, used as the clip's picture inside PowerPoint. */
  MD.iconPng = (color, size = 192) =>
    new Promise((res) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = c.height = size;
        c.getContext('2d').drawImage(img, 0, 0, size, size);
        res(c.toDataURL('image/png'));
      };
      img.onerror = () => res(null);
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(MD.iconSvg(color, size, size).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));
    });

  // stop any preview when the slide changes or a new deck loads
  B.on('current', () => MD.stopPreview());
  B.on('deck', () => MD.stopPreview());
})(window.BSD);
