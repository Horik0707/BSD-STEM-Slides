# BSD STEM Slides

A PowerPoint-style presentation app that runs entirely in the web browser. It has no server, needs no sign-in and has no build step. It is built for STEM classrooms, with LaTeX equations, charts for lab data, ready-made science diagrams, and a presenter view with a pen and laser pointer.

## Getting started

Pick any of these:

- **Open it directly.** Double-click `index.html`. Everything, including the fonts and icons, is bundled, so it works offline.
- **Run a local server.** Run `npm start` (or any static file server) and open <http://localhost:8080>.
- **Host it for a school or district.** Publish the folder as-is on GitHub Pages (*Settings → Pages → Deploy from a branch*) or on any web server.

Presentations save automatically in the browser you're using. To move work to another computer or share it, use **File ▸ Save a Copy** to download a `.bsdslides` file or a PowerPoint `.pptx`.

## What it can do

**Editing (works like PowerPoint)**
- Ribbon with Home, Insert, Design, Transitions, Animations, Slide Show and View tabs. Shape Format, Picture Format, Table Design and Chart Design tabs appear when you select that kind of object.
- Slide thumbnails pane: drag to reorder, multi-select, right-click menu, hide slides. There's also a Slide Sorter view and a resizable speaker-notes pane.
- Slide layouts: Title, Title & Content, Section Header, Two Content, Comparison, Title Only, Big Fact and Blank. Placeholders show "Click to add …" prompts.
- Select, move, resize, rotate, group, align and distribute objects. Smart guides snap to edges and centers. Shift-drag keeps proportions and Ctrl-drag duplicates. Lock, Format Painter and z-order controls are included.
- Rich text: fonts, sizes, bold, italic, underline, strikethrough, superscript and subscript, colors, highlight, bullets and numbering with list levels, alignment, line spacing, columns, change case and links.
- Undo/redo, cut/copy/paste (including pasting screenshots and text from other apps), Find & Replace, and keyboard shortcuts throughout. **File ▸ Help** lists the shortcuts.

**Content**
- More than 40 shapes (basic, block arrows, lines and arrows, flowchart) with fill, outline, dash and shadow, plus quick styles.
- Pictures from your device or a URL, with crop, circle and rounded masks, filters, borders and alt text.
- Tables with header and banded rows and color styles. Press Tab to move between cells.
- Charts (column, bar, line, area, pie, doughnut and scatter with a trendline) with a spreadsheet-style data editor. You can paste cells from Excel or Google Sheets, or import a CSV.
- **Equations**: a LaTeX editor with a live preview, a template palette and common formulas (quadratic formula, Newton's laws, photosynthesis and more).
- Symbol picker (Greek, math, arrows, science, super/subscript), WordArt, and YouTube or local video.
- STEM diagrams: process, cycle, Venn, timeline, hierarchy, atom model and coordinate axes.
- Ten themes with matching colors and fonts, custom slide backgrounds (solid, gradient, picture), 16:9 or 4:3 slide size, slide numbers and footers.

**Presenting**
- 10 slide transitions and 16 entrance, emphasis and exit animations. You can set start (On Click, With Previous, After Previous), duration, delay and direction, and reorder them in an Animation Pane with preview.
- Full-screen slide show with pen, highlighter, eraser and laser pointer. Other controls: black/white screen, go-to-slide by number, a slide overview (G), auto-advance timings and looping.
- **Presenter View** shows a timer, a clock, the next slide or animation and your notes. It can open a second **Audience Window** for the projector that stays in sync.
- Reading View for presenting inside a window.

**Files**
- Open and save PowerPoint `.pptx` files. Text, shapes, pictures, tables, charts, notes, backgrounds, transitions and links carry over. Equations are exported as editable linear text, because PowerPoint can't read LaTeX.
- Export a PDF or print, as full-page slides, notes pages, or 6-per-page student handouts. You can also export a plain-text outline.
- An accessibility checker flags missing slide titles and missing alt text.

## Privacy

Everything stays on your device. Presentations are stored in the browser's IndexedDB, and nothing is uploaded anywhere. The only time it goes online is to load YouTube videos you embed and web pictures you add by URL.

## Project layout

```
index.html          App shell
css/app.css         All styles (light and dark)
js/util.js          Helpers, storage (IndexedDB), event bus
js/themes.js        Themes, fonts, colour tokens, slide layouts
js/shapes.js        Shape library (SVG paths)
js/model.js         Document model, undo history, welcome deck
js/render.js        Renders slides for the editor, thumbnails, show and print
js/chart.js         SVG chart renderer
js/editor.js        Canvas: selection, drag/resize/rotate, guides, text editing, clipboard
js/actions.js       Slide operations and shared commands
js/ribbon.js        Ribbon tabs and controls
js/thumbs.js        Thumbnails pane, slide sorter, notes, status bar
js/panes.js         Format, Animation and Background side panes
js/dialogs.js       Equation, symbol, chart data, video, find/replace and other dialogs
js/show.js          Slide show, transitions, animations, ink, presenter & audience windows
js/io.js            Autosave, .bsdslides files, PowerPoint import/export, print/PDF
js/backstage.js     File menu
js/app.js           Startup, keyboard shortcuts, clipboard
vendor/             KaTeX, PptxGenJS (with JSZip), Material Symbols (subset)
tools/              Icon-font subsetting script
tests/smoke.mjs     End-to-end smoke test
```

## Development

There is no build step: edit the files and reload the page.

```
npm install      # installs Playwright for the tests
npm test         # end-to-end smoke test in headless Chromium
```

If you use a new icon name from [Material Symbols](https://fonts.google.com/icons), regenerate the bundled icon subset by following the instructions at the top of `tools/subset-icons.py`.

## Credits

- [KaTeX](https://katex.org) (MIT) renders equations.
- [PptxGenJS](https://gitbrent.github.io/PptxGenJS/) (MIT), which bundles [JSZip](https://stuk.github.io/jszip/), handles PowerPoint export and import.
- [Material Symbols](https://fonts.google.com/icons) (Apache 2.0) provides the icons.

The license files for these libraries are in `vendor/`.
