/* BSD STEM Slides — app bootstrap, event wiring, keyboard shortcuts and clipboard */
(function (B) {
  'use strict';
  const U = B.util, A = B.app;
  const E = () => B.editor;

  const setSaveState = (s) => {
    const el = U.$('#saveState');
    if (!el) return;
    const map = { saving: ['sync', 'Saving…'], saved: ['cloud_done', 'Saved'], unsaved: ['edit_note', 'Editing'], error: ['error', 'Not saved'] };
    const [i, t] = map[s] || map.saved;
    el.innerHTML = U.icon(i) + `<span>${t}</span>`;
    el.dataset.state = s;
    el.title = s === 'error' ? 'Could not save in this browser — use File ▸ Save a Copy' : 'Saved in this browser';
  };

  B.app_setTitle = (t) => {
    t = String(t || '').trim() || 'Untitled Presentation';
    if (A.deck.title === t) return;
    A.deck.title = t;
    U.$('#deckTitle').value = t;
    document.title = t + ' — BSD STEM Slides';
    B.store.commit();
  };

  function wire() {
    const R = B.ribbon, T = B.thumbs, P = B.panes;
    B.on('deck', () => {
      T.renderAll();
      E().render();
      T.loadNotes();
      R.update();
      T.updateStatus();
      P.update();
      U.$('#deckTitle').value = A.deck.title;
      document.title = A.deck.title + ' — BSD STEM Slides';
      if (!A.slideSel.length) A.slideSel = [B.curSlide().id];
    });
    B.on('slides', () => {
      T.renderAll();
      R.update();
      T.updateStatus();
    });
    B.on('current', () => {
      E().render();
      T.highlight();
      T.loadNotes();
      R.update();
      T.updateStatus();
      P.update();
      if (A.view === 'sorter') T.highlight();
    });
    B.on('slidesel', () => {
      T.highlight();
      R.update();
      T.updateStatus();
    });
    B.on('content', () => {
      T.updateCurrent();
      R.update();
      T.updateStatus();
      P.update();
    });
    B.on('content-live', () => T.updateLive());
    B.on('selection', () => {
      R.update();
      P.update();
    });
    B.on('textsel', () => R.updateText());
    B.on('dirty', () => {
      setSaveState('unsaved');
      B.io.scheduleSave();
    });
    B.on('save-state', setSaveState);
    B.on('zoom', () => T.updateZoom());
    B.on('tool', () => R.update());
    B.on('painter', () => {
      U.$('#stage').classList.toggle('painting', !!A.painter);
      R.update();
    });
    B.on('view', () => {
      R.update();
      T.updateStatus();
    });
    B.on('focus-area', () => document.body.dataset.focus = A.focus);
  }

  function titlebar() {
    const t = U.$('#deckTitle');
    t.addEventListener('change', () => B.app_setTitle(t.value));
    t.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        if (e.key === 'Escape') t.value = A.deck.title;
        t.blur();
      }
      e.stopPropagation();
    });
    const qa = (id, fn) => {
      const b = U.$(id);
      b.addEventListener('mousedown', (e) => e.preventDefault());
      b.addEventListener('click', fn);
    };
    qa('#qaSave', () => B.io.saveNow());
    qa('#qaUndo', () => B.store.undo());
    qa('#qaRedo', () => B.store.redo());
    qa('#qaPresent', () => B.show.start(0));
    qa('#qaShare', () => B.backstage.open('save'));
    qa('#qaHelp', () => B.dialogs.shortcuts());
    const presentBtn = U.$('#presentBtn');
    presentBtn.addEventListener('click', () => B.show.start(A.current));
    U.$('#presentMenu').addEventListener('click', (e) =>
      B.ui.menu(
        [
          { label: 'From Beginning', icon: 'slideshow', shortcut: 'F5', action: () => B.show.start(0) },
          { label: 'From Current Slide', icon: 'play_circle', shortcut: 'Shift+F5', action: () => B.show.start(A.current) },
          { label: 'Presenter View', icon: 'co_present', shortcut: 'Alt+F5', action: () => B.show.start(A.current, { presenter: true }) },
          { label: 'Reading View', icon: 'chrome_reader_mode', action: () => B.show.start(A.current, { reading: true }) },
        ],
        0,
        0,
        { anchor: e.currentTarget }
      )
    );
  }

  const isField = (t) => t && t.closest && t.closest('input, textarea, select');
  const nativeClipboard = (t) => isField(t) || !!A.editingId;

  function keyboard() {
    document.addEventListener('keydown', (e) => {
      if (B.show.isRunning() || document.body.classList.contains('audience-mode')) return;
      if (U.$('#modalRoot').children.length) return;
      if (B.backstage.isOpen()) return;
      const key = e.key;
      const mod = U.mod(e);
      const lower = key.length === 1 ? key.toLowerCase() : key;
      const stop = () => {
        e.preventDefault();
        e.stopPropagation();
      };

      // works everywhere
      if (key === 'F5') {
        stop();
        return e.altKey ? B.show.start(A.current, { presenter: true }) : B.show.start(e.shiftKey ? A.current : 0);
      }
      if (mod && lower === 's') return stop(), B.io.saveNow();
      if (mod && lower === 'p') return stop(), B.io.print('slides');
      if (mod && lower === 'o') return stop(), B.io.openDialog();
      if (mod && lower === 'f' && !isField(e.target)) return stop(), B.dialogs.find(false);
      if (mod && lower === 'h' && !isField(e.target)) return stop(), B.dialogs.find(true);
      if (isField(e.target)) return;
      if (A.view === 'sorter' && !mod && (key === 'Delete' || key === 'Backspace')) return stop(), B.slides.remove();

      const editing = !!A.editingId;
      if (mod && lower === 'z' && !e.shiftKey) {
        if (editing) return; // native undo inside the text box
        return stop(), B.store.undo();
      }
      if ((mod && lower === 'y') || (mod && e.shiftKey && lower === 'z')) {
        if (editing) return;
        return stop(), B.store.redo();
      }

      // text formatting (editing or with text objects selected)
      if (mod) {
        if (lower === 'b') return stop(), E().format('bold');
        if (lower === 'i') return stop(), E().format('italic');
        if (lower === 'u') return stop(), E().format('underline');
        if (lower === 'e') return stop(), E().setAlign('center');
        if (lower === 'l') return stop(), E().setAlign('left');
        if (lower === 'r') return stop(), E().setAlign('right');
        if (lower === 'j') return stop(), E().setAlign('justify');
        if (lower === 'k') return stop(), B.actions.link();
        if (key === '>' || (e.shiftKey && key === '.')) return stop(), E().growFont(1);
        if (key === '<' || (e.shiftKey && key === ',')) return stop(), E().growFont(-1);
        if (key === '=' || key === '+') return stop(), E().format(e.shiftKey || key === '+' ? 'superscript' : 'subscript');
      }
      if (editing) return;

      const thumbs = A.focus === 'thumbs' || A.view === 'sorter';
      if (key === 'Delete' || key === 'Backspace') {
        stop();
        if (thumbs) return B.slides.remove();
        return E().deleteSelection();
      }
      if (mod && lower === 'a') {
        stop();
        if (thumbs) {
          A.slideSel = A.deck.slides.map((s) => s.id);
          return B.thumbs.highlight();
        }
        return E().selectAll();
      }
      if (mod && lower === 'd') return stop(), thumbs ? B.slides.duplicate() : E().duplicate();
      if (mod && lower === 'm') return stop(), B.slides.add();
      if (mod && lower === 'g') return stop(), e.shiftKey ? E().ungroup() : E().group();
      if (mod && (key === ']' || key === '}')) return stop(), E().order(e.shiftKey ? 'front' : 'forward');
      if (mod && (key === '[' || key === '{')) return stop(), E().order(e.shiftKey ? 'back' : 'backward');
      if (key === 'PageDown') return stop(), B.slides.go(A.current + 1);
      if (key === 'PageUp') return stop(), B.slides.go(A.current - 1);
      if (thumbs) return; // thumbnail pane handles its own arrows/Enter

      const sel = B.selectedEls();
      if (key.startsWith('Arrow')) {
        stop();
        if (!sel.length) {
          if (key === 'ArrowDown' || key === 'ArrowRight') B.slides.go(A.current + 1);
          else B.slides.go(A.current - 1);
          return;
        }
        const d = e.altKey || mod ? 1 : e.shiftKey ? 24 : 6;
        const [dx, dy] = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }[key];
        return E().nudge(dx, dy);
      }
      if (key === 'Tab') return stop(), E().cycleSelection(e.shiftKey ? -1 : 1);
      if (key === 'Escape') {
        if (A.drawTool) return stop(), E().setDrawTool(null);
        if (A.painter) {
          A.painter = null;
          return stop(), B.emit('painter');
        }
        return E().select([]);
      }
      if ((key === 'Enter' || key === 'F2') && sel.length === 1) {
        stop();
        if (sel[0].type === 'table') return E().startCellEdit(sel[0].id, 0, 0);
        if (sel[0].type === 'chart') return B.dialogs.chart(sel[0]);
        if (sel[0].type === 'equation') return B.dialogs.equation(sel[0]);
        return E().startEdit(sel[0].id, { selectAll: key === 'F2' });
      }
      if (key === 'Home' && !sel.length) return stop(), B.slides.go(0);
      if (key === 'End' && !sel.length) return stop(), B.slides.go(A.deck.slides.length - 1);
      // typing on a selected text object starts editing it (like PowerPoint)
      if (key.length === 1 && !mod && !e.altKey && sel.length === 1 && B.model.isTextual(sel[0]) && !sel[0].locked) {
        stop();
        E().startEdit(sel[0].id);
        document.execCommand('insertText', false, key);
      }
    });
  }

  function clipboard() {
    const onCopy = (cut) => (e) => {
      if (B.show.isRunning() || nativeClipboard(e.target) || U.$('#modalRoot').children.length) return;
      const thumbs = A.focus === 'thumbs' || A.view === 'sorter';
      const text = thumbs ? (cut ? B.slides.cut() : B.slides.copy()) : cut ? E().cut() : E().copy();
      if (text == null) return;
      e.clipboardData.setData('text/plain', text);
      e.preventDefault();
    };
    document.addEventListener('copy', onCopy(false));
    document.addEventListener('cut', onCopy(true));
    document.addEventListener('paste', (e) => {
      if (B.show.isRunning() || nativeClipboard(e.target) || U.$('#modalRoot').children.length) return;
      if (B.backstage.isOpen()) return;
      const cd = e.clipboardData;
      e.preventDefault();
      const file = cd && Array.from(cd.items || []).find((i) => i.kind === 'file' && /^image\//.test(i.type));
      const text = cd ? cd.getData('text/plain') : '';
      if (A.clipboard && (text === A.clipboard.text || (!text && !file))) {
        if (A.clipboard.kind === 'slides') return B.slides.paste();
        return E().paste();
      }
      if (file) return E().insertImageFile(file.getAsFile());
      if (text) return E().pastePlainText(text);
    });
  }

  function prefs() {
    A.showGrid = U.storage.get('grid', false);
    A.showGuides = U.storage.get('guides', true);
    A.showNotes = U.storage.get('notes', true);
    U.$('#notesPane').hidden = !A.showNotes;
    U.$('#notesSplit').hidden = !A.showNotes;
  }

  async function boot() {
    if (location.hash === '#audience') {
      B.show.audienceMode();
      return;
    }
    document.body.dataset.view = 'normal';
    prefs();
    B.ui.toast = B.ui.toast || (() => {});
    E().init();
    B.thumbs.init();
    B.panes.init();
    wire();
    titlebar();
    keyboard();
    clipboard();
    await B.io.restore();
    B.ribbon.init();
    setSaveState('saved');
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && A.dirty) B.io.saveNow(true);
    });
    window.addEventListener('beforeunload', () => {
      if (A.dirty) B.io.saveNow(true);
    });
    // file drops anywhere outside the canvas open the file
    window.addEventListener('dragover', (e) => {
      if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) e.preventDefault();
    });
    window.addEventListener('drop', (e) => {
      if (e.defaultPrevented) return;
      const f = e.dataTransfer && e.dataTransfer.files[0];
      if (!f) return;
      e.preventDefault();
      if (/\.(pptx|bsdslides|json)$/i.test(f.name)) B.io.openFile(f);
      else if (/^image\//.test(f.type)) E().insertImageFile(f);
    });
    // re-render equations once KaTeX finishes loading (it is deferred)
    if (!window.katex) {
      const iv = setInterval(() => {
        if (window.katex) {
          clearInterval(iv);
          B.emit('deck');
        }
      }, 150);
      setTimeout(() => clearInterval(iv), 10000);
    }
    document.body.classList.add('ready');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.BSD);
