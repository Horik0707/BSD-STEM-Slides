/* BSD STEM Slides — vector shape library (SVG paths sized to w×h) */
(function (B) {
  'use strict';
  const poly = (pts, w, h) => 'M' + pts.map(([x, y]) => `${(x * w).toFixed(2)} ${(y * h).toFixed(2)}`).join(' L') + ' Z';
  const star = (n, inner, w, h) => {
    const pts = [];
    for (let i = 0; i < n * 2; i++) {
      const r = i % 2 ? inner : 0.5;
      const a = -Math.PI / 2 + (i * Math.PI) / n;
      pts.push([0.5 + r * Math.cos(a), 0.5 + r * Math.sin(a)]);
    }
    // stretch so the star fills the box vertically like PowerPoint does
    const ys = pts.map((p) => p[1]);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    return poly(pts.map(([x, y]) => [x, (y - minY) / (maxY - minY)]), w, h);
  };
  const rr = (w, h, r) =>
    `M${r} 0 H${w - r} A${r} ${r} 0 0 1 ${w} ${r} V${h - r} A${r} ${r} 0 0 1 ${w - r} ${h} H${r} A${r} ${r} 0 0 1 0 ${h - r} V${r} A${r} ${r} 0 0 1 ${r} 0 Z`;

  /** pptx: matching PowerPoint preset geometry name (used for export/import). */
  const S = [
    { id: 'rect', name: 'Rectangle', group: 'Basic', pptx: 'rect', path: (w, h) => `M0 0 H${w} V${h} H0 Z` },
    { id: 'roundRect', name: 'Rounded Rectangle', group: 'Basic', pptx: 'roundRect', path: (w, h) => rr(w, h, Math.min(w, h) * 0.16) },
    { id: 'ellipse', name: 'Oval', group: 'Basic', pptx: 'ellipse', path: (w, h) => `M0 ${h / 2} A${w / 2} ${h / 2} 0 1 0 ${w} ${h / 2} A${w / 2} ${h / 2} 0 1 0 0 ${h / 2} Z` },
    { id: 'triangle', name: 'Triangle', group: 'Basic', pptx: 'triangle', path: (w, h) => poly([[0.5, 0], [1, 1], [0, 1]], w, h) },
    { id: 'rtTriangle', name: 'Right Triangle', group: 'Basic', pptx: 'rtTriangle', path: (w, h) => poly([[0, 0], [1, 1], [0, 1]], w, h) },
    { id: 'diamond', name: 'Diamond', group: 'Basic', pptx: 'diamond', path: (w, h) => poly([[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]], w, h) },
    { id: 'parallelogram', name: 'Parallelogram', group: 'Basic', pptx: 'parallelogram', path: (w, h) => poly([[0.25, 0], [1, 0], [0.75, 1], [0, 1]], w, h) },
    { id: 'trapezoid', name: 'Trapezoid', group: 'Basic', pptx: 'trapezoid', path: (w, h) => poly([[0.25, 0], [0.75, 0], [1, 1], [0, 1]], w, h) },
    { id: 'pentagon', name: 'Pentagon', group: 'Basic', pptx: 'pentagon', path: (w, h) => poly([[0.5, 0], [1, 0.38], [0.81, 1], [0.19, 1], [0, 0.38]], w, h) },
    { id: 'hexagon', name: 'Hexagon', group: 'Basic', pptx: 'hexagon', path: (w, h) => poly([[0.25, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0.25, 1], [0, 0.5]], w, h) },
    { id: 'octagon', name: 'Octagon', group: 'Basic', pptx: 'octagon', path: (w, h) => { const k = 0.29; return poly([[k, 0], [1 - k, 0], [1, k], [1, 1 - k], [1 - k, 1], [k, 1], [0, 1 - k], [0, k]], w, h); } },
    { id: 'plus', name: 'Plus', group: 'Basic', pptx: 'plus', path: (w, h) => { const a = 0.33, b = 0.67; return poly([[a, 0], [b, 0], [b, a], [1, a], [1, b], [b, b], [b, 1], [a, 1], [a, b], [0, b], [0, a], [a, a]], w, h); } },
    { id: 'star5', name: '5-Point Star', group: 'Basic', pptx: 'star5', path: (w, h) => star(5, 0.2, w, h) },
    { id: 'star6', name: '6-Point Star', group: 'Basic', pptx: 'star6', path: (w, h) => star(6, 0.29, w, h) },
    { id: 'heart', name: 'Heart', group: 'Basic', pptx: 'heart', path: (w, h) => `M${w / 2} ${h * 0.28} C${w * 0.5} ${h * 0.05} ${w * 0.05} ${-h * 0.05} ${w * 0.02} ${h * 0.32} C0 ${h * 0.55} ${w * 0.3} ${h * 0.75} ${w / 2} ${h} C${w * 0.7} ${h * 0.75} ${w} ${h * 0.55} ${w * 0.98} ${h * 0.32} C${w * 0.95} ${-h * 0.05} ${w * 0.5} ${h * 0.05} ${w / 2} ${h * 0.28} Z` },
    { id: 'cube', name: 'Cube', group: 'Basic', pptx: 'cube', path: (w, h) => { const d = Math.min(w, h) * 0.25; return { d: `M0 ${d} L${d} 0 H${w} V${h - d} L${w - d} ${h} H0 Z`, extra: `M0 ${d} H${w - d} V${h} M${w - d} ${d} L${w} 0`, shade: `M${w - d} ${d} L${w} 0 V${h - d} L${w - d} ${h} Z`, top: `M0 ${d} L${d} 0 H${w} L${w - d} ${d} Z` }; } },
    { id: 'can', name: 'Cylinder', group: 'Basic', pptx: 'can', path: (w, h) => { const ry = Math.min(h * 0.12, w * 0.25), rx = w / 2; return { d: `M0 ${ry} A${rx} ${ry} 0 0 1 ${w} ${ry} V${h - ry} A${rx} ${ry} 0 0 1 0 ${h - ry} Z`, extra: `M0 ${ry} A${rx} ${ry} 0 0 0 ${w} ${ry}` }; } },
    { id: 'callout', name: 'Speech Bubble', group: 'Basic', pptx: 'wedgeRoundRectCallout', path: (w, h) => { const b = h * 0.78, r = Math.min(w, b) * 0.14; return `M${r} 0 H${w - r} A${r} ${r} 0 0 1 ${w} ${r} V${b - r} A${r} ${r} 0 0 1 ${w - r} ${b} H${w * 0.42} L${w * 0.2} ${h} L${w * 0.25} ${b} H${r} A${r} ${r} 0 0 1 0 ${b - r} V${r} A${r} ${r} 0 0 1 ${r} 0 Z`; } },

    { id: 'line', name: 'Line', group: 'Lines', pptx: 'line', line: true },
    { id: 'arrowLine', name: 'Arrow', group: 'Lines', pptx: 'line', line: true, head: true },
    { id: 'doubleArrowLine', name: 'Double Arrow', group: 'Lines', pptx: 'line', line: true, head: true, tail: true },

    { id: 'rightArrow', name: 'Right Arrow', group: 'Block Arrows', pptx: 'rightArrow', path: (w, h) => poly([[0, 0.25], [0.6, 0.25], [0.6, 0], [1, 0.5], [0.6, 1], [0.6, 0.75], [0, 0.75]], w, h) },
    { id: 'leftArrow', name: 'Left Arrow', group: 'Block Arrows', pptx: 'leftArrow', path: (w, h) => poly([[1, 0.25], [0.4, 0.25], [0.4, 0], [0, 0.5], [0.4, 1], [0.4, 0.75], [1, 0.75]], w, h) },
    { id: 'upArrow', name: 'Up Arrow', group: 'Block Arrows', pptx: 'upArrow', path: (w, h) => poly([[0.25, 1], [0.25, 0.4], [0, 0.4], [0.5, 0], [1, 0.4], [0.75, 0.4], [0.75, 1]], w, h) },
    { id: 'downArrow', name: 'Down Arrow', group: 'Block Arrows', pptx: 'downArrow', path: (w, h) => poly([[0.25, 0], [0.25, 0.6], [0, 0.6], [0.5, 1], [1, 0.6], [0.75, 0.6], [0.75, 0]], w, h) },
    { id: 'leftRightArrow', name: 'Left-Right Arrow', group: 'Block Arrows', pptx: 'leftRightArrow', path: (w, h) => poly([[0, 0.5], [0.22, 0], [0.22, 0.25], [0.78, 0.25], [0.78, 0], [1, 0.5], [0.78, 1], [0.78, 0.75], [0.22, 0.75], [0.22, 1]], w, h) },
    { id: 'chevron', name: 'Chevron', group: 'Block Arrows', pptx: 'chevron', path: (w, h) => poly([[0, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0, 1], [0.25, 0.5]], w, h) },
    { id: 'homePlate', name: 'Pentagon Arrow', group: 'Block Arrows', pptx: 'homePlate', path: (w, h) => poly([[0, 0], [0.8, 0], [1, 0.5], [0.8, 1], [0, 1]], w, h) },
    { id: 'circularArrow', name: 'Cycle Arrow', group: 'Block Arrows', pptx: 'circularArrow', path: (w, h) => { const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2, r = R * 0.62; const p = (rad, a) => `${(cx + rad * Math.cos(a)).toFixed(2)} ${(cy + rad * Math.sin(a)).toFixed(2)}`; const a0 = Math.PI * 0.9, a1 = Math.PI * 2.25; const mid = (R + r) / 2; return `M${p(R, a0)} A${R} ${R} 0 1 1 ${p(R, a1)} L${p(R + (R - r) * 0.45, a1)} L${p(mid, a1 + 0.42)} L${p(r - (R - r) * 0.45, a1)} L${p(r, a1)} A${r} ${r} 0 1 0 ${p(r, a0)} Z`; } },

    { id: 'flowProcess', name: 'Process', group: 'Flowchart', pptx: 'flowChartProcess', path: (w, h) => `M0 0 H${w} V${h} H0 Z` },
    { id: 'flowDecision', name: 'Decision', group: 'Flowchart', pptx: 'flowChartDecision', path: (w, h) => poly([[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]], w, h) },
    { id: 'flowTerminator', name: 'Terminator', group: 'Flowchart', pptx: 'flowChartTerminator', path: (w, h) => rr(w, h, Math.min(h / 2, w / 2)) },
    { id: 'flowData', name: 'Data', group: 'Flowchart', pptx: 'flowChartInputOutput', path: (w, h) => poly([[0.2, 0], [1, 0], [0.8, 1], [0, 1]], w, h) },
    { id: 'flowDocument', name: 'Document', group: 'Flowchart', pptx: 'flowChartDocument', path: (w, h) => `M0 0 H${w} V${h * 0.82} C${w * 0.72} ${h * 0.66} ${w * 0.5} ${h * 1.12} 0 ${h * 0.9} Z` },
    { id: 'flowDatabase', name: 'Database', group: 'Flowchart', pptx: 'flowChartMagneticDisk', path: (w, h) => { const ry = h * 0.14, rx = w / 2; return { d: `M0 ${ry} A${rx} ${ry} 0 0 1 ${w} ${ry} V${h - ry} A${rx} ${ry} 0 0 1 0 ${h - ry} Z`, extra: `M0 ${ry} A${rx} ${ry} 0 0 0 ${w} ${ry}` }; } },
    { id: 'flowConnector', name: 'Connector', group: 'Flowchart', pptx: 'flowChartConnector', path: (w, h) => `M0 ${h / 2} A${w / 2} ${h / 2} 0 1 0 ${w} ${h / 2} A${w / 2} ${h / 2} 0 1 0 0 ${h / 2} Z` },
  ];

  B.SHAPES = S;
  B.shapeById = (id) => S.find((s) => s.id === id) || S[0];
  B.shapeByPptx = (name) => S.find((s) => s.pptx === name && !s.line);

  /** Returns {d, extra?, shade?, top?} for a closed shape */
  B.shapePath = (id, w, h) => {
    const s = B.shapeById(id);
    if (!s.path) return { d: '' };
    w = Math.max(w, 0.01);
    h = Math.max(h, 0.01);
    const p = s.path(w, h);
    return typeof p === 'string' ? { d: p } : p;
  };

  /** Small SVG icon for galleries */
  B.shapeIcon = (id) => {
    const s = B.shapeById(id);
    if (s.line) {
      const head = s.head ? '<path d="M17 3 L21 3 L21 7" fill="none"/>' : '';
      const tail = s.tail ? '<path d="M7 21 L3 21 L3 17" fill="none"/>' : '';
      return `<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 21 L21 3"/>${head}${tail}</svg>`;
    }
    const p = B.shapePath(id, 20, 16);
    return `<svg viewBox="-2 -4 24 24" width="24" height="24"><path d="${p.d}" fill="currentColor" fill-opacity=".18" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>${p.extra ? `<path d="${p.extra}" fill="none" stroke="currentColor" stroke-width="1.3"/>` : ''}</svg>`;
  };
})(window.BSD);
