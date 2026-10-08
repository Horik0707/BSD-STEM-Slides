/* BSD STEM Slides — lightweight SVG chart renderer (column, bar, line, area, pie, doughnut, scatter) */
(function (B) {
  'use strict';
  const U = B.util;

  B.CHART_KINDS = [
    { id: 'column', name: 'Column', icon: 'bar_chart' },
    { id: 'bar', name: 'Bar', icon: 'align_horizontal_left' },
    { id: 'line', name: 'Line', icon: 'show_chart' },
    { id: 'area', name: 'Area', icon: 'area_chart' },
    { id: 'pie', name: 'Pie', icon: 'pie_chart' },
    { id: 'doughnut', name: 'Doughnut', icon: 'donut_large' },
    { id: 'scatter', name: 'Scatter (XY)', icon: 'scatter_plot' },
  ];

  const nice = (range, round) => {
    const exp = Math.floor(Math.log10(range || 1));
    const f = (range || 1) / Math.pow(10, exp);
    let nf;
    if (round) nf = f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10;
    else nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
    return nf * Math.pow(10, exp);
  };
  B.niceScale = (min, max, maxTicks = 6) => {
    if (min === max) {
      max = min + 1;
      if (min > 0) min = 0;
    }
    const range = nice(max - min, false);
    const step = nice(range / (maxTicks - 1), true);
    const lo = Math.floor(min / step) * step;
    const hi = Math.ceil(max / step) * step;
    const ticks = [];
    for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(10));
    return { lo, hi, step, ticks };
  };
  const fmt = (v) => {
    const a = Math.abs(v);
    if (a >= 1e6) return +(v / 1e6).toFixed(1) + 'M';
    if (a >= 1e4) return +(v / 1e3).toFixed(1) + 'k';
    return String(+v.toFixed(3));
  };

  B.chartSvg = (c, w, h, theme) => {
    const fg = theme.text;
    const bg = theme.bgColor;
    const grid = U.mix(fg, bg, 0.78);
    const axis = U.mix(fg, bg, 0.45);
    const colors = (i) => (c.colors && c.colors[i]) || theme.accents[i % theme.accents.length];
    const fs = U.clamp(Math.min(w, h) / 26, 9, 20);
    const font = U.esc(B.fontStack(theme.body));
    const series = (c.series || []).map((s) => ({ name: s.name, values: (s.values || []).map((v) => (v === '' || v == null || isNaN(+v) ? null : +v)) }));
    const labels = c.labels || [];
    const out = [];
    const T = (x, y, s, o = {}) =>
      `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${o.fs || fs}" fill="${o.fill || fg}" text-anchor="${o.a || 'middle'}" ${o.b ? 'font-weight="bold"' : ''} ${o.r ? `transform="rotate(${o.r} ${x} ${y})"` : ''} dominant-baseline="${o.db || 'auto'}">${U.esc(s)}</text>`;

    let top = 8, bottom = h - 8;
    const left0 = 8, right = w - 12;
    if (c.title) {
      out.push(T(w / 2, top + fs * 1.25, c.title, { fs: fs * 1.25, b: true }));
      top += fs * 2;
    }
    const pie = c.kind === 'pie' || c.kind === 'doughnut';
    const legendItems = pie ? labels.map((l, i) => [l, colors(i)]) : series.map((s, i) => [s.name, colors(i)]);
    if (c.legend !== false && legendItems.length) {
      const items = legendItems.map(([name, col]) => ({ name: String(name), col, w: fs * 1.6 + String(name).length * fs * 0.55 + fs }));
      const total = items.reduce((a, b) => a + b.w, 0);
      let x = Math.max(left0, (w - total) / 2);
      const y = bottom - fs * 0.6;
      for (const it of items) {
        out.push(`<rect x="${x}" y="${y - fs * 0.8}" width="${fs * 0.9}" height="${fs * 0.9}" rx="2" fill="${it.col}"/>`);
        out.push(T(x + fs * 1.25, y, it.name, { a: 'start' }));
        x += it.w;
      }
      bottom -= fs * 2;
    }

    if (pie) {
      const vals = (series[0] ? series[0].values : []).map((v) => Math.max(0, v || 0));
      const sum = vals.reduce((a, b) => a + b, 0) || 1;
      const cx = w / 2, cy = (top + bottom) / 2;
      const r = Math.max(4, Math.min(w - 24, bottom - top) / 2 - 4);
      const ir = c.kind === 'doughnut' ? r * 0.55 : 0;
      let a0 = -Math.PI / 2;
      vals.forEach((v, i) => {
        const a1 = a0 + (v / sum) * Math.PI * 2;
        const large = a1 - a0 > Math.PI ? 1 : 0;
        const p = (rad, a) => `${(cx + rad * Math.cos(a)).toFixed(2)} ${(cy + rad * Math.sin(a)).toFixed(2)}`;
        if (v / sum >= 0.9999) {
          out.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${colors(i)}"/>` + (ir ? `<circle cx="${cx}" cy="${cy}" r="${ir}" fill="${bg}"/>` : ''));
        } else if (v > 0) {
          const d = ir
            ? `M${p(r, a0)} A${r} ${r} 0 ${large} 1 ${p(r, a1)} L${p(ir, a1)} A${ir} ${ir} 0 ${large} 0 ${p(ir, a0)} Z`
            : `M${cx} ${cy} L${p(r, a0)} A${r} ${r} 0 ${large} 1 ${p(r, a1)} Z`;
          out.push(`<path d="${d}" fill="${colors(i)}" stroke="${bg}" stroke-width="1.5"/>`);
        }
        if (c.dataLabels && v > 0) {
          const am = (a0 + a1) / 2, lr = ir ? (r + ir) / 2 : r * 0.65;
          const col = U.luminance(colors(i)) > 0.45 ? '#111' : '#fff';
          out.push(T(cx + lr * Math.cos(am), cy + lr * Math.sin(am), Math.round((v / sum) * 100) + '%', { fill: col, db: 'middle', b: true }));
        }
        a0 = a1;
      });
      return wrap(out, w, h, font);
    }

    const scatter = c.kind === 'scatter';
    const horiz = c.kind === 'bar';
    const all = series.flatMap((s) => s.values).filter((v) => v != null);
    const ys = B.niceScale(Math.min(0, ...all, 0), Math.max(...all, 1));
    if (Math.min(...all) < 0 && ys.lo > Math.min(...all)) ys.lo = Math.min(...all);
    const xsNum = labels.map((l) => parseFloat(l));
    const xs = scatter ? B.niceScale(Math.min(...xsNum.filter(isFinite), 0), Math.max(...xsNum.filter(isFinite), 1)) : null;

    const valLabelW = Math.max(...ys.ticks.map((t) => fmt(t).length)) * fs * 0.6 + 8;
    const catLabelW = horiz ? Math.min(w * 0.3, Math.max(...labels.map((l) => String(l).length), 1) * fs * 0.55 + 10) : 0;
    const left = left0 + (horiz ? catLabelW : valLabelW) + (c.yTitle ? fs * 1.4 : 0);
    if (c.xTitle) bottom -= fs * 1.4;
    const plotB = bottom - fs * 1.6;
    const pw = Math.max(10, right - left), ph = Math.max(10, plotB - top);

    if (c.yTitle) out.push(T(left0 + fs * 0.8, top + ph / 2, c.yTitle, { r: -90, b: true }));
    if (c.xTitle) out.push(T(left + pw / 2, bottom + fs * 1.1, c.xTitle, { b: true }));

    const vy = (v) => plotB - ((v - ys.lo) / (ys.hi - ys.lo)) * ph; // value → y
    const vx = (v) => left + ((v - ys.lo) / (ys.hi - ys.lo)) * pw; // value → x (bar charts)

    // grid + value axis labels
    for (const t of ys.ticks) {
      if (horiz) {
        const x = vx(t);
        out.push(`<line x1="${x}" x2="${x}" y1="${top}" y2="${plotB}" stroke="${grid}" stroke-width="1"/>`);
        out.push(T(x, plotB + fs * 1.2, fmt(t)));
      } else {
        const y = vy(t);
        out.push(`<line x1="${left}" x2="${right}" y1="${y}" y2="${y}" stroke="${grid}" stroke-width="1"/>`);
        out.push(T(left - 6, y, fmt(t), { a: 'end', db: 'middle' }));
      }
    }

    const n = Math.max(1, labels.length);
    if (scatter) {
      for (const t of xs.ticks) {
        const x = left + ((t - xs.lo) / (xs.hi - xs.lo)) * pw;
        out.push(`<line x1="${x}" x2="${x}" y1="${top}" y2="${plotB}" stroke="${grid}" stroke-width="1"/>`);
        out.push(T(x, plotB + fs * 1.2, fmt(t)));
      }
      const sx = (v) => left + ((v - xs.lo) / (xs.hi - xs.lo)) * pw;
      series.forEach((s, si) => {
        const pts = [];
        s.values.forEach((v, i) => {
          if (v == null || !isFinite(xsNum[i])) return;
          pts.push([xsNum[i], v]);
          out.push(`<circle cx="${sx(xsNum[i]).toFixed(1)}" cy="${vy(v).toFixed(1)}" r="${fs * 0.38}" fill="${colors(si)}" stroke="${bg}" stroke-width="1"/>`);
          if (c.dataLabels) out.push(T(sx(xsNum[i]), vy(v) - fs * 0.7, fmt(v), { fs: fs * 0.85 }));
        });
        if (c.trendline && pts.length > 1) {
          const m = pts.length, mx = pts.reduce((a, p) => a + p[0], 0) / m, my = pts.reduce((a, p) => a + p[1], 0) / m;
          const sxx = pts.reduce((a, p) => a + (p[0] - mx) ** 2, 0);
          const slope = sxx ? pts.reduce((a, p) => a + (p[0] - mx) * (p[1] - my), 0) / sxx : 0;
          const icpt = my - slope * mx;
          const x0 = Math.min(...pts.map((p) => p[0])), x1 = Math.max(...pts.map((p) => p[0]));
          out.push(`<line x1="${sx(x0)}" y1="${vy(slope * x0 + icpt)}" x2="${sx(x1)}" y2="${vy(slope * x1 + icpt)}" stroke="${colors(si)}" stroke-width="2" stroke-dasharray="6 4"/>`);
        }
      });
    } else if (horiz) {
      const gh = ph / n, bh = (gh * 0.72) / Math.max(1, series.length);
      labels.forEach((l, i) => out.push(T(left - 6, top + gh * (i + 0.5), String(l), { a: 'end', db: 'middle' })));
      series.forEach((s, si) =>
        s.values.forEach((v, i) => {
          if (v == null || i >= n) return;
          const y = top + gh * i + gh * 0.14 + bh * si;
          const x0 = vx(Math.max(ys.lo, 0)), x1 = vx(v);
          out.push(`<rect x="${Math.min(x0, x1).toFixed(1)}" y="${y.toFixed(1)}" width="${Math.abs(x1 - x0).toFixed(1)}" height="${(bh - 1).toFixed(1)}" fill="${colors(si)}"/>`);
          if (c.dataLabels) out.push(T(x1 + 4, y + bh / 2, fmt(v), { a: 'start', db: 'middle', fs: fs * 0.85 }));
        })
      );
    } else {
      const gw = pw / n;
      labels.forEach((l, i) => out.push(T(left + gw * (i + 0.5), plotB + fs * 1.2, String(l))));
      if (c.kind === 'column') {
        const bw = (gw * 0.72) / Math.max(1, series.length);
        series.forEach((s, si) =>
          s.values.forEach((v, i) => {
            if (v == null || i >= n) return;
            const x = left + gw * i + gw * 0.14 + bw * si;
            const y0 = vy(Math.max(ys.lo, 0)), y1 = vy(v);
            out.push(`<rect x="${x.toFixed(1)}" y="${Math.min(y0, y1).toFixed(1)}" width="${(bw - 1).toFixed(1)}" height="${Math.abs(y1 - y0).toFixed(1)}" fill="${colors(si)}"/>`);
            if (c.dataLabels) out.push(T(x + bw / 2, y1 - 4, fmt(v), { fs: fs * 0.85 }));
          })
        );
      } else {
        series.forEach((s, si) => {
          const pts = s.values.map((v, i) => (v == null || i >= n ? null : [left + gw * (i + 0.5), vy(v)])).filter(Boolean);
          if (!pts.length) return;
          const d = 'M' + pts.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L');
          if (c.kind === 'area') out.push(`<path d="${d} L${pts[pts.length - 1][0]} ${vy(Math.max(ys.lo, 0))} L${pts[0][0]} ${vy(Math.max(ys.lo, 0))} Z" fill="${colors(si)}" fill-opacity=".45"/>`);
          out.push(`<path d="${d}" fill="none" stroke="${colors(si)}" stroke-width="${Math.max(2, fs / 5)}" stroke-linejoin="round"/>`);
          if (c.kind === 'line') pts.forEach((p) => out.push(`<circle cx="${p[0]}" cy="${p[1]}" r="${fs * 0.3}" fill="${colors(si)}"/>`));
          if (c.dataLabels) s.values.forEach((v, i) => v != null && i < n && out.push(T(left + gw * (i + 0.5), vy(v) - fs * 0.6, fmt(v), { fs: fs * 0.85 })));
        });
      }
    }
    // axes
    if (horiz) out.push(`<line x1="${vx(Math.max(ys.lo, 0))}" x2="${vx(Math.max(ys.lo, 0))}" y1="${top}" y2="${plotB}" stroke="${axis}" stroke-width="1.5"/>`);
    else out.push(`<line x1="${left}" x2="${right}" y1="${vy(Math.max(ys.lo, 0))}" y2="${vy(Math.max(ys.lo, 0))}" stroke="${axis}" stroke-width="1.5"/>`);
    return wrap(out, w, h, font);
  };

  const wrap = (out, w, h, font) =>
    `<svg class="chart-svg" xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="${font}">${out.join('')}</svg>`;
})(window.BSD);
