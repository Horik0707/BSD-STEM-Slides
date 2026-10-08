/* BSD STEM Slides — File menu ("backstage"): new, open, save a copy, export, print, about */
(function (B) {
  'use strict';
  const U = B.util, A = B.app, M = B.model, R = B.render;
  const h = U.h;
  const BS = (B.backstage = {});
  let page = 'home';

  BS.open = (p = 'home') => {
    if (A.editingId) B.editor.endEdit();
    B.ui.closeMenus();
    page = p;
    const root = U.$('#backstage');
    root.hidden = false;
    document.body.classList.add('backstage-open');
    render();
    const first = root.querySelector('.bs-nav button.on');
    if (first) first.focus();
  };
  BS.close = () => {
    U.$('#backstage').hidden = true;
    document.body.classList.remove('backstage-open');
    B.editor.layout();
  };
  BS.isOpen = () => !U.$('#backstage').hidden;

  const NAV = [
    ['home', 'Home', 'home'],
    ['new', 'New', 'note_add'],
    ['open', 'Open', 'folder_open'],
    ['save', 'Save a Copy', 'download'],
    ['export', 'Export', 'ios_share'],
    ['print', 'Print', 'print'],
    ['about', 'Help & About', 'help'],
  ];

  function render() {
    const root = U.$('#backstage');
    root.innerHTML = '';
    const nav = h('nav', { class: 'bs-nav', 'aria-label': 'File' });
    const back = h('button', { class: 'bs-back', type: 'button', html: U.icon('arrow_back') + '<span>Back</span>' });
    back.addEventListener('click', BS.close);
    nav.appendChild(back);
    for (const [id, label, icon] of NAV) {
      const b = h('button', { class: 'bs-item' + (page === id ? ' on' : ''), type: 'button', html: U.icon(icon) + `<span>${label}</span>` });
      b.addEventListener('click', () => {
        page = id;
        render();
      });
      nav.appendChild(b);
    }
    nav.appendChild(h('div', { class: 'bs-nav-foot' }, h('div', { class: 'brand-mini', html: logo() + '<span>BSD STEM Slides</span>' })));
    const main = h('main', { class: 'bs-main' });
    root.append(nav, main);
    ({ home, new: newPage, open: openPage, save: savePage, export: exportPage, print: printPage, about: aboutPage })[page](main);
  }

  const logo = () => U.$('#brandLogo') ? U.$('#brandLogo').outerHTML.replace('id="brandLogo"', '') : '';

  function themeCard(theme, label, onClick, sample) {
    const d = { theme: theme.id, w: 960, h: 540, slides: [] };
    const s = sample || { layout: 'title', elements: B.layoutElements('title', 960, 540).map((p) => M.newElement('text', p)) };
    if (!sample) {
      s.elements[0].html = `<div>${U.esc(theme.name)}</div>`;
      s.elements[1].html = '<div>Presentation</div>';
    }
    d.slides.push(s);
    const b = h('button', { class: 'bs-card', type: 'button', title: label }, R.thumb(s, 208, { deck: d, index: 0 }), h('span', {}, label));
    b.addEventListener('click', onClick);
    return b;
  }

  function newRow(limit) {
    const row = h('div', { class: 'bs-cards' });
    row.appendChild(
      themeCard(B.themeById('office'), 'Blank Presentation', () => {
        B.io.newDeck('office');
        BS.close();
      })
    );
    const sample = M.sampleDeck();
    row.appendChild(
      themeCard(B.themeById('bsd'), 'Welcome Tour', () => {
        B.io.newDeck(null, true);
        BS.close();
      }, sample.slides[0])
    );
    B.THEMES.filter((t) => t.id !== 'office').slice(0, limit || 99).forEach((t) =>
      row.appendChild(
        themeCard(t, t.name, () => {
          B.io.newDeck(t.id);
          BS.close();
        })
      )
    );
    return row;
  }

  async function recentList(container, opts = {}) {
    const list = await B.io.list();
    container.innerHTML = '';
    const filter = (opts.filter || '').toLowerCase();
    const items = list.filter((m) => !filter || (m.title || '').toLowerCase().includes(filter)).slice(0, opts.limit || 200);
    if (!items.length) {
      container.appendChild(h('p', { class: 'bs-empty' }, filter ? 'No presentations match.' : 'Presentations you create are saved in this browser and will appear here.'));
      return;
    }
    for (const m of items) {
      Object.assign(A.assets, m.firstAssets || {});
      const d = { theme: m.theme, w: m.w || 960, h: m.h || 540, slides: [m.first], slideNumbers: false };
      const row = h('div', { class: 'bs-recent' + (A.deck && m.id === A.deck.id ? ' current' : '') });
      const open = h('button', { class: 'bs-recent-open', type: 'button' }, m.first ? R.thumb(m.first, 112, { deck: d, index: 0 }) : h('span'), h('span', { class: 'bs-recent-text' }, h('b', {}, m.title || 'Untitled'), h('small', {}, `${U.fmtDate(m.updated)} · ${m.slides || 1} slide${m.slides === 1 ? '' : 's'}${A.deck && m.id === A.deck.id ? ' · open now' : ''}`)));
      open.addEventListener('click', async () => {
        if (!A.deck || m.id !== A.deck.id) await B.io.openStored(m.id);
        BS.close();
      });
      const del = h('button', { class: 'icon-btn', type: 'button', title: 'Delete from this browser', 'aria-label': 'Delete ' + (m.title || 'presentation'), html: U.icon('delete') });
      del.addEventListener('click', async () => {
        if (!(await B.ui.confirm('Delete presentation?', `“${m.title}” will be removed from this browser. This can't be undone.`, 'Delete', true))) return;
        await B.io.deleteStored(m.id);
        if (A.deck && m.id === A.deck.id) {
          const rest = await B.io.list();
          if (rest.length) await B.io.openStored(rest[0].id);
          else await B.io.newDeck('office');
        }
        recentList(container, opts);
      });
      row.append(open, del);
      container.appendChild(row);
    }
  }

  function greeting() {
    const hr = new Date().getHours();
    return hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  }

  function home(main) {
    main.append(h('h1', {}, greeting()), h('h2', {}, 'New'), newRow(5));
    const more = h('button', { class: 'link-btn', type: 'button', html: 'More themes ' + U.icon('arrow_forward') });
    more.addEventListener('click', () => {
      page = 'new';
      render();
    });
    main.appendChild(more);
    main.appendChild(h('h2', {}, 'Recent'));
    const list = h('div', { class: 'bs-recents' });
    main.appendChild(list);
    recentList(list, { limit: 12 });
  }

  function newPage(main) {
    main.append(h('h1', {}, 'New'), h('p', { class: 'bs-lead' }, 'Pick a theme to start. You can change it any time on the Design tab.'), newRow());
  }

  function openPage(main) {
    const browse = h('button', { class: 'bs-big-btn', type: 'button', html: U.icon('upload_file') + '<span><b>Browse this device</b><small>Open a PowerPoint (.pptx) or BSD STEM Slides (.bsdslides) file</small></span>' });
    browse.addEventListener('click', () => B.io.openDialog());
    const search = h('input', { class: 'field', type: 'search', placeholder: 'Search presentations saved in this browser' });
    const list = h('div', { class: 'bs-recents' });
    search.addEventListener('input', () => recentList(list, { filter: search.value }));
    main.append(h('h1', {}, 'Open'), browse, h('h2', {}, 'Saved in this browser'), search, list);
    recentList(list);
  }

  function savePage(main) {
    const title = h('input', { class: 'field', value: A.deck.title, 'aria-label': 'Presentation name' });
    title.addEventListener('change', () => B.app_setTitle(title.value));
    const card = (icon, t, d, fn) => {
      const b = h('button', { class: 'bs-big-btn', type: 'button', html: U.icon(icon) + `<span><b>${t}</b><small>${d}</small></span>` });
      b.addEventListener('click', fn);
      return b;
    };
    main.append(
      h('h1', {}, 'Save a Copy'),
      h('p', { class: 'bs-lead', html: U.icon('cloud_done') + ' Your work saves automatically in this browser as you go. Download a copy to back it up, move it to another computer, or share it.' }),
      h('label', { class: 'field-label' }, 'Name', title),
      card('save', 'BSD STEM Slides file (.bsdslides)', 'Keeps everything exactly as it is — best for backups and sharing with other BSD STEM Slides users.', () => B.io.download()),
      card('slideshow', 'PowerPoint presentation (.pptx)', 'Open in Microsoft PowerPoint, Google Slides or Keynote.', () => B.io.exportPptx())
    );
  }

  function exportPage(main) {
    const card = (icon, t, d, fn) => {
      const b = h('button', { class: 'bs-big-btn', type: 'button', html: U.icon(icon) + `<span><b>${t}</b><small>${d}</small></span>` });
      b.addEventListener('click', fn);
      return b;
    };
    main.append(
      h('h1', {}, 'Export'),
      card('slideshow', 'PowerPoint (.pptx)', 'Text, shapes, pictures, tables, charts, notes and video links carry over. Equations become editable text.', () => B.io.exportPptx()),
      card('picture_as_pdf', 'PDF', 'Opens the print dialog — choose “Save as PDF” as the printer.', () => {
        BS.close();
        B.io.print('slides');
      }),
      card('description', 'Outline (.txt)', 'All slide text and notes as a plain-text outline — handy for study guides.', () => B.io.exportOutline())
    );
  }

  function printPage(main) {
    let mode = 'slides';
    const opts = h('div', { class: 'radio-col' });
    [['slides', 'Full Page Slides', 'One slide per page'], ['notes', 'Notes Pages', 'Slide with speaker notes underneath'], ['handouts', 'Handouts (6 per page)', 'Slides with lines for student notes']].forEach(([v, t, d], i) => {
      const r = h('input', { type: 'radio', name: 'printmode', value: v });
      r.checked = i === 0;
      r.addEventListener('change', () => (mode = v));
      opts.appendChild(h('label', { class: 'bs-radio' }, r, h('span', {}, h('b', {}, t), h('small', {}, d))));
    });
    const go = h('button', { class: 'btn primary lg', type: 'button', html: U.icon('print') + ' Print' });
    go.addEventListener('click', () => {
      BS.close();
      B.io.print(mode);
    });
    main.append(h('h1', {}, 'Print'), opts, go, h('p', { class: 'help' }, 'Tip: choose “Save as PDF” in the print dialog to make a PDF.'));
  }

  function aboutPage(main) {
    const sc = h('button', { class: 'btn', type: 'button', html: U.icon('keyboard') + ' Keyboard shortcuts' });
    sc.addEventListener('click', () => B.dialogs.shortcuts());
    const tour = h('button', { class: 'btn', type: 'button', html: U.icon('school') + ' Open the welcome tour' });
    tour.addEventListener('click', () => {
      B.io.newDeck(null, true);
      BS.close();
    });
    main.append(
      h('h1', {}, 'Help & About'),
      h('div', { class: 'about' },
        h('div', { class: 'about-brand', html: logo() + '<div><b>BSD STEM Slides</b><small>A presentation app for STEM classrooms</small></div>' }),
        h('p', {}, 'Create slides with themes, shapes, pictures, tables, charts, LaTeX equations, video and animations — then present full screen with presenter view, pen and laser pointer. Opens and saves PowerPoint files.'),
        h('p', { class: 'help', html: U.icon('lock') + ' Privacy: presentations are stored only in this browser on this device. Nothing is uploaded. Download a copy to move work between computers.' }),
        h('div', { class: 'btn-row' }, sc, tour),
        h('p', { class: 'help' }, 'Equations by KaTeX · PowerPoint export by PptxGenJS · Icons by Material Symbols.')
      )
    );
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && BS.isOpen() && !U.$('#modalRoot').children.length) {
      e.preventDefault();
      BS.close();
    }
  });
})(window.BSD);
