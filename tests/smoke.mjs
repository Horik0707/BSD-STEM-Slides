// End-to-end smoke test: serves the app, drives it in Chromium and fails on any console error.
// Run with `npm test` (needs the `playwright` package and a Chromium it can launch).
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const file = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const url = `http://localhost:${server.address().port}/index.html`;

const failures = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures.push(name);
};

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })).newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));
const ev = (f, a) => page.evaluate(f, a);

try {
  await page.goto(url);
  await page.waitForFunction(() => document.body.classList.contains('ready'));
  check('boots with the welcome deck', (await ev(() => BSD.app.deck.slides.length)) === 6);

  // edit a title in place
  await page.click('#thumbList .thumb:nth-child(2)');
  const title = page.locator('#slideHost .el').first();
  await title.click();
  await title.click();
  await page.keyboard.press('End');
  await page.keyboard.type('!');
  await page.keyboard.press('Escape');
  check('edits text in place', (await ev(() => BSD.util.htmlToText(BSD.curSlide().elements[0].html))) === 'What you can do!');

  // draw a shape, then undo it
  await page.click('#tabs .tab[data-tab="insert"]');
  await page.click('#ribbon-body .rb-big[aria-label="Shapes"]');
  await page.click('.shapes-panel .shape-btn[aria-label="Oval"]');
  const box = await page.locator('#slideWrap').boundingBox();
  await page.mouse.move(box.x + 200, box.y + 300);
  await page.mouse.down();
  await page.mouse.move(box.x + 320, box.y + 400, { steps: 5 });
  await page.mouse.up();
  const count = () => ev(() => BSD.curSlide().elements.length);
  const drawn = await count();
  check('draws a shape and opens Shape Format', drawn === 3 && (await ev(() => BSD.ribbon.active())) === 'shape');
  await page.keyboard.press('Control+z');
  check('undo removes it', (await count()) === 2);

  // slide show with animations
  await page.click('#thumbList .thumb:nth-child(3)');
  await page.keyboard.press('Shift+F5');
  await page.waitForTimeout(300);
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(700);
  }
  await page.waitForTimeout(800); // let the wipe transition finish
  check('slide show advances through builds to the next slide', /Lab Results/.test(await page.textContent('#show .show-layer')));
  await page.keyboard.press('Escape');

  // PowerPoint round trip
  const dl = page.waitForEvent('download');
  await ev(() => BSD.io.exportPptx());
  const file = await (await dl).path();
  const b64 = fs.readFileSync(file).toString('base64');
  await ev(async (b) => BSD.io.openFile(new File([Uint8Array.from(atob(b), (c) => c.charCodeAt(0))], 'roundtrip.pptx')), b64);
  const kinds = await ev(() => BSD.app.deck.slides.flatMap((s) => s.elements.map((e) => e.type)));
  check('PowerPoint export → import keeps slides, charts and tables', (await ev(() => BSD.app.deck.slides.length)) === 6 && kinds.includes('chart') && kinds.includes('shape'));

  // audio: insert a clip (a generated half-second WAV) and get the Playback tab
  await ev(() => BSD.io.newDeck(null, true, '16:9'));
  await page.waitForTimeout(300);
  await ev(() => {
    const n = 11025, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 22050, true); v.setUint32(28, 44100, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.sin(i / 8) * 8000, true);
    const b = new Uint8Array(buf); let s = ''; b.forEach((x) => (s += String.fromCharCode(x)));
    BSD.slides.go(1);
    BSD.media.insertData('data:audio/wav;base64,' + btoa(s), 'Beep');
  });
  check('inserts an audio clip with a speaker icon and Playback tab', (await ev(() => BSD.selectedEls()[0].type)) === 'audio' && (await ev(() => BSD.ribbon.active())) === 'audio' && (await page.locator('#overlay .audio-bar').count()) === 1);

  // automatic (timed) slide show advances on its own
  await ev(() => { BSD.app.deck.showMode = 'auto'; BSD.app.deck.slideDuration = 1; BSD.show.start(0); });
  await page.waitForTimeout(2200);
  check('timed slide show advances by itself', /What you can do/.test(await page.textContent('#show .show-stage')));
  await page.keyboard.press('Escape');

  // book format: portrait pages that turn sideways
  await ev(() => BSD.io.newDeck(null, true, 'book'));
  await page.waitForTimeout(300);
  check('creates an 8.5 × 11 book', (await ev(() => [BSD.app.deck.w, BSD.app.deck.h].join('x'))) === '816x1056');
  await ev(() => BSD.show.start(1));
  await page.waitForTimeout(400);
  await page.keyboard.press('ArrowRight'); // page 2 has one click animation
  await page.waitForTimeout(700);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(150);
  const xs = await ev(() => Array.from(document.querySelectorAll('#show .show-layer')).map((l) => new DOMMatrix(getComputedStyle(l).transform).m41));
  check('book pages slide sideways', xs.length === 2 && xs[0] < 0 && xs[1] > 0, xs.join(', '));
  await page.waitForTimeout(700);
  check('book footer shows progress', /Page 3 of 5/.test(await page.textContent('#show .book-footer')));
  await page.keyboard.press('Escape');

  // autosave survives a reload
  await page.waitForTimeout(1500);
  const id = await ev(() => BSD.app.deck.id);
  await page.reload();
  await page.waitForFunction(() => document.body.classList.contains('ready'));
  check('autosaves to the browser', (await ev(() => BSD.app.deck.id)) === id);
} catch (e) {
  failures.push('exception');
  console.error(e);
} finally {
  check('no console errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  server.close();
}
process.exit(failures.length ? 1 : 0);
