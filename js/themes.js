/* BSD STEM Slides — themes, fonts, colours and slide layouts */
(function (B) {
  'use strict';
  const U = B.util;

  B.FONTS = [
    'Calibri', 'Aptos', 'Arial', 'Arial Black', 'Segoe UI', 'Helvetica', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Century Gothic',
    'Georgia', 'Times New Roman', 'Garamond', 'Palatino Linotype', 'Cambria', 'Cambria Math', 'Courier New', 'Consolas',
    'Lucida Console', 'Comic Sans MS', 'Impact',
  ];
  const SERIF = /Georgia|Times|Garamond|Palatino|Cambria/;
  const MONO = /Courier|Consolas|Lucida Console|Mono/;
  B.fontStack = (f) => {
    if (!f) return 'Calibri, Carlito, "Segoe UI", Arial, sans-serif';
    const generic = MONO.test(f) ? 'monospace' : SERIF.test(f) ? 'serif' : f === 'Comic Sans MS' ? 'cursive' : 'sans-serif';
    const alias = f === 'Calibri' || f === 'Aptos' ? ', Carlito, "Segoe UI", Arial' : f === 'Cambria' ? ', Caladea, Georgia' : '';
    return `"${f}"${alias}, ${generic}`;
  };
  B.FONT_SIZES = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 54, 60, 66, 72, 80, 88, 96, 120];

  const T = (o) => Object.assign({ decor: [], titleDecor: null }, o);

  B.THEMES = [
    T({
      id: 'office', name: 'Classic White', bg: '#FFFFFF', bgColor: '#FFFFFF', heading: 'Calibri', body: 'Calibri',
      title: '#1F1F1F', text: '#262626', accents: ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47'],
    }),
    T({
      id: 'bsd', name: 'BSD STEM', bg: '#0F2747', bgColor: '#0F2747', heading: 'Segoe UI', body: 'Segoe UI',
      title: '#FFFFFF', text: '#DCE6F2', accents: ['#22B8CF', '#F59F00', '#69DB7C', '#FF6B6B', '#9775FA', '#74C0FC'],
      decor: [{ x: 0, y: 0.975, w: 1, h: 0.025, color: '@accent1' }, { x: 0, y: 0, w: 0.012, h: 1, color: '@accent2' }],
      titleDecor: [{ x: 0, y: 0.92, w: 1, h: 0.08, color: '@accent1' }, { x: 0.4, y: 0.535, w: 0.2, h: 0.008, color: '@accent2', orient: 'landscape' }, { x: 0.35, y: 0.51, w: 0.3, h: 0.005, color: '@accent2', orient: 'portrait' }],
    }),
    T({
      id: 'blueprint', name: 'Blueprint', bgColor: '#1C4E8A', heading: 'Trebuchet MS', body: 'Trebuchet MS',
      bg: 'linear-gradient(rgba(255,255,255,.09) 1px, transparent 1px) 0 0 / 24px 24px, linear-gradient(90deg, rgba(255,255,255,.09) 1px, transparent 1px) 0 0 / 24px 24px, linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px) 0 0 / 6px 6px, linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px) 0 0 / 6px 6px, #1C4E8A',
      title: '#FFFFFF', text: '#E3F0FF', accents: ['#FFFFFF', '#FFD43B', '#8CE99A', '#FFA8A8', '#B197FC', '#99E9F2'],
    }),
    T({
      id: 'notebook', name: 'Lab Notebook', bgColor: '#FFFDF6', heading: 'Georgia', body: 'Segoe UI',
      bg: 'repeating-linear-gradient(#FFFDF6 0 31px, #D4E6F7 31px 32px)',
      title: '#1D3557', text: '#2B2D42', accents: ['#1D70B8', '#E63946', '#2A9D8F', '#F4A261', '#6A4C93', '#457B9D'],
      decor: [{ x: 0.07, y: 0, w: 0.003, h: 1, color: '#E57373' }],
      titleDecor: [{ x: 0.07, y: 0, w: 0.003, h: 1, color: '#E57373' }],
    }),
    T({
      id: 'chalkboard', name: 'Chalkboard', bgColor: '#2F4A3A', heading: 'Comic Sans MS', body: 'Trebuchet MS',
      bg: 'radial-gradient(ellipse at 30% 30%, #3B5C48 0%, #2F4A3A 55%, #263D30 100%)',
      title: '#FFF6C9', text: '#F1F3EE', accents: ['#FFF6C9', '#FFB4A2', '#A8DADC', '#F9F871', '#C3B1E1', '#B5E48C'],
      decor: [{ x: 0, y: 0.965, w: 1, h: 0.035, color: '#8B5A2B' }],
      titleDecor: [{ x: 0, y: 0.965, w: 1, h: 0.035, color: '#8B5A2B' }],
    }),
    T({
      id: 'circuit', name: 'Circuit', bgColor: '#0B0F14', heading: 'Consolas', body: 'Segoe UI',
      bg: 'radial-gradient(circle at 85% 15%, rgba(57,255,136,.12), transparent 40%), radial-gradient(circle at 10% 90%, rgba(0,200,255,.10), transparent 45%), #0B0F14',
      title: '#7CFFB2', text: '#C9D6DF', accents: ['#39FF88', '#00C8FF', '#FFD60A', '#FF4D6D', '#B388FF', '#FF9F1C'],
      decor: [{ x: 0.05, y: 0.2, w: 0.9, h: 0.003, color: '@accent1' }],
      titleDecor: [{ x: 0.3, y: 0.63, w: 0.4, h: 0.004, color: '@accent1', orient: 'landscape' }, { x: 0.3, y: 0.515, w: 0.4, h: 0.003, color: '@accent1', orient: 'portrait' }],
    }),
    T({
      id: 'sunrise', name: 'Sunrise', bgColor: '#FF8E6B', heading: 'Century Gothic', body: 'Segoe UI',
      bg: 'linear-gradient(135deg, #FF7E5F 0%, #FEB47B 100%)',
      title: '#FFFFFF', text: '#FFFFFF', accents: ['#5B2A86', '#FFFFFF', '#2D3047', '#FFE66D', '#1B998B', '#E84855'],
    }),
    T({
      id: 'ocean', name: 'Ocean', bgColor: '#0F4C5C', heading: 'Segoe UI', body: 'Segoe UI',
      bg: 'linear-gradient(160deg, #0B3954 0%, #0F4C5C 45%, #1B998B 100%)',
      title: '#FFFFFF', text: '#E0F7F4', accents: ['#5EEAD4', '#FDE68A', '#93C5FD', '#FCA5A5', '#C4B5FD', '#86EFAC'],
    }),
    T({
      id: 'slate', name: 'Slate', bg: '#F3F4F6', bgColor: '#F3F4F6', heading: 'Arial', body: 'Arial',
      title: '#111827', text: '#374151', accents: ['#2563EB', '#DB2777', '#059669', '#D97706', '#7C3AED', '#0891B2'],
      decor: [{ x: 0, y: 0, w: 1, h: 0.018, color: '@accent1' }],
      titleDecor: [{ x: 0, y: 0, w: 0.33, h: 1, color: '@accent1', orient: 'landscape' }, { x: 0, y: 0, w: 1, h: 0.24, color: '@accent1', orient: 'portrait' }],
    }),
    T({
      id: 'galaxy', name: 'Galaxy', bgColor: '#1A1033', heading: 'Century Gothic', body: 'Segoe UI',
      bg: 'radial-gradient(1px 1px at 20% 30%, #fff 50%, transparent 51%), radial-gradient(1px 1px at 70% 60%, #fff 50%, transparent 51%), radial-gradient(1.5px 1.5px at 40% 80%, #fff 50%, transparent 51%), radial-gradient(1px 1px at 85% 20%, #fff 50%, transparent 51%), radial-gradient(1px 1px at 10% 70%, #fff 50%, transparent 51%), radial-gradient(1.5px 1.5px at 55% 15%, #fff 50%, transparent 51%), radial-gradient(ellipse at 70% 30%, #3F2B7A 0%, #1A1033 60%)',
      title: '#FFFFFF', text: '#E5DEFF', accents: ['#B794F4', '#F6AD55', '#63B3ED', '#F687B3', '#68D391', '#FAF089'],
    }),
  ];
  B.themeById = (id) => B.THEMES.find((t) => t.id === id) || B.THEMES[0];

  /* ---------- page sizes ---------- */
  // 96 px = 1 inch, so font sizes in points print at their true size on every format.
  B.PAGE_SIZES = {
    '16:9': { w: 960, h: 540, name: 'Widescreen (16:9)' },
    '4:3': { w: 960, h: 720, name: 'Standard (4:3)' },
    book: { w: 816, h: 1056, name: 'Book · Letter (8.5 × 11 in)' },
  };
  /** Book decks are portrait pages that turn sideways like an e-reader when presented. */
  B.isBook = (deck) => !!deck && deck.h > deck.w;
  B.sizeKey = (deck) => (B.isBook(deck) ? 'book' : deck.h === 720 ? '4:3' : '16:9');

  /** Theme background graphics for a slide, respecting portrait/landscape-only pieces. */
  B.decorFor = (slide, theme, deck) => {
    if (slide.hideDecor) return [];
    const list = (slide.layout === 'title' || slide.layout === 'section') && theme.titleDecor ? theme.titleDecor : theme.decor;
    const orient = B.isBook(deck) ? 'portrait' : 'landscape';
    return (list || []).filter((d) => !d.orient || d.orient === orient);
  };

  /**
   * Theme colour tokens like '@accent1', '@text', '@title', '@bg' resolve against the deck theme,
   * so switching themes restyles content. A ':d' / ':l' / ':l2' suffix darkens or lightens.
   */
  B.resolveColor = (c, theme) => {
    if (!c || c === 'none' || c === 'transparent') return c || null;
    if (c[0] !== '@') return c;
    const [k, mod] = c.slice(1).split(':');
    const base = resolveToken(k, theme);
    if (mod === 'd') return U.mix(base, '#000000', 0.3);
    if (mod === 'l') return U.mix(base, '#FFFFFF', 0.6);
    if (mod === 'l2') return U.mix(base, '#FFFFFF', 0.82);
    return base;
  };
  const resolveToken = (k, theme) => {
    if (k.startsWith('accent')) return theme.accents[(parseInt(k.slice(6), 10) || 1) - 1] || theme.accents[0];
    if (k === 'text') return theme.text;
    if (k === 'title') return theme.title;
    if (k === 'bg') return theme.bgColor;
    if (k === 'light') return U.luminance(theme.bgColor) > 0.5 ? theme.bgColor : '#FFFFFF';
    if (k === 'dark') return U.luminance(theme.bgColor) > 0.5 ? theme.text : theme.bgColor;
    return theme.text;
  };

  B.STANDARD_COLORS = ['#C00000', '#FF0000', '#FFC000', '#FFFF00', '#92D050', '#00B050', '#00B0F0', '#0070C0', '#002060', '#7030A0'];
  B.GRAYS = ['#FFFFFF', '#F2F2F2', '#D9D9D9', '#BFBFBF', '#A6A6A6', '#808080', '#595959', '#404040', '#262626', '#000000'];

  /* ---------- Layouts ---------- */
  B.LAYOUTS = [
    { id: 'title', name: 'Title Slide' },
    { id: 'title-content', name: 'Title and Content' },
    { id: 'section', name: 'Section Header' },
    { id: 'two-content', name: 'Two Content' },
    { id: 'comparison', name: 'Comparison' },
    { id: 'title-only', name: 'Title Only' },
    { id: 'big-number', name: 'Big Fact' },
    { id: 'blank', name: 'Blank' },
  ];

  /** Returns placeholder elements for a layout, sized for a W×H slide. */
  B.layoutElements = (layoutId, W, H) => {
    if (H > W) return portraitLayout(layoutId, W, H);
    const ys = H / 540;
    const ph = (placeholder, x, y, w, h, extra) =>
      Object.assign(
        { type: 'text', placeholder, x, y: y * ys, w, h: h * ys, autoHeight: false, html: '' },
        placeholder === 'title' || placeholder === 'subtitle' ? {} : { html: '<ul><li><br></li></ul>' },
        extra || {}
      );
    const T = (x, y, w, h, extra) => ph('title', x, y, w, h, Object.assign({ size: 40, valign: 'bottom' }, extra));
    switch (layoutId) {
      case 'title':
        return [
          T(80, 130, 800, 150, { size: 54, align: 'center', valign: 'bottom' }),
          ph('subtitle', 120, 300, 720, 90, { size: 24, align: 'center', valign: 'top' }),
        ];
      case 'section':
        return [
          T(70, 170, 820, 140, { size: 48, valign: 'bottom' }),
          ph('subtitle', 70, 320, 820, 70, { size: 22, valign: 'top' }),
        ];
      case 'two-content':
        return [T(50, 28, 860, 90), ph('body', 50, 138, 420, 370, { size: 22 }), ph('body', 490, 138, 420, 370, { size: 22 })];
      case 'comparison':
        return [
          T(50, 28, 860, 90),
          ph('subtitle', 50, 128, 420, 50, { size: 24, bold: true, valign: 'bottom', hint: 'Click to add heading' }),
          ph('body', 50, 182, 420, 326, { size: 20 }),
          ph('subtitle', 490, 128, 420, 50, { size: 24, bold: true, valign: 'bottom', hint: 'Click to add heading' }),
          ph('body', 490, 182, 420, 326, { size: 20 }),
        ];
      case 'title-only':
        return [T(50, 28, 860, 90)];
      case 'big-number':
        return [
          ph('title', 80, 90, 800, 220, { size: 120, align: 'center', valign: 'bottom', color: '@accent1', hint: 'Click to add a number' }),
          ph('subtitle', 120, 320, 720, 110, { size: 24, align: 'center', valign: 'top', hint: 'Click to add the fact' }),
        ];
      case 'blank':
        return [];
      case 'title-content':
      default:
        return [T(50, 28, 860, 90), ph('body', 50, 138, 860, 370, { size: 24 })];
    }
  };

  /** Layouts for book (portrait) pages: one-inch-ish margins, content stacked top to bottom. */
  function portraitLayout(layoutId, W, H) {
    const m = Math.round(W * 0.088); // 0.75 in on a letter page
    const cw = W - 2 * m;
    const ys = H / 1056;
    const ph = (placeholder, x, y, w, h, extra) =>
      Object.assign(
        { type: 'text', placeholder, x, y: Math.round(y * ys), w, h: Math.round(h * ys), autoHeight: false, html: '' },
        placeholder === 'title' || placeholder === 'subtitle' ? {} : { html: '<ul><li><br></li></ul>' },
        extra || {}
      );
    const T = (y, h, extra) => ph('title', m, y, cw, h, Object.assign({ size: 34, valign: 'bottom' }, extra));
    switch (layoutId) {
      case 'title':
        return [T(320, 210, { size: 48, align: 'center' }), ph('subtitle', m + 40, 550, cw - 80, 120, { size: 22, align: 'center', valign: 'top' })];
      case 'section':
        return [T(400, 160, { size: 40 }), ph('subtitle', m, 575, cw, 90, { size: 20, valign: 'top' })];
      case 'two-content':
        return [T(60, 110), ph('body', m, 196, cw, 386, { size: 18 }), ph('body', m, 606, cw, 386, { size: 18 })];
      case 'comparison':
        return [
          T(60, 110),
          ph('subtitle', m, 190, cw, 48, { size: 22, bold: true, valign: 'bottom', hint: 'Click to add heading' }),
          ph('body', m, 244, cw, 320, { size: 18 }),
          ph('subtitle', m, 590, cw, 48, { size: 22, bold: true, valign: 'bottom', hint: 'Click to add heading' }),
          ph('body', m, 644, cw, 340, { size: 18 }),
        ];
      case 'title-only':
        return [T(60, 110)];
      case 'big-number':
        return [
          ph('title', m, 250, cw, 300, { size: 120, align: 'center', valign: 'bottom', color: '@accent1', hint: 'Click to add a number' }),
          ph('subtitle', m + 40, 575, cw - 80, 160, { size: 24, align: 'center', valign: 'top', hint: 'Click to add the fact' }),
        ];
      case 'blank':
        return [];
      case 'title-content':
      default:
        return [T(60, 110), ph('body', m, 196, cw, 796, { size: 18 })];
    }
  }

  B.placeholderHint = (el) =>
    el.hint ||
    ({ title: 'Click to add title', subtitle: 'Click to add subtitle', body: 'Click to add text' })[el.placeholder] ||
    'Click to add text';
})(window.BSD);
