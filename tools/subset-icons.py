"""Rebuild vendor/material-symbols/outlined.css with only the icons BSD STEM Slides uses.

The full Material Symbols font is ~3.3 MB. This script scans js/, index.html and css/ for icon
names, keeps just those glyphs, pins the variable axes to the default outlined style and
inlines the result as a data URI (so icons also work when index.html is opened from disk).

Usage (needs Python 3 and fonttools + brotli):
    pip install fonttools brotli
    npm pack material-symbols@0.27.0 && tar xzf material-symbols-0.27.0.tgz
    python tools/subset-icons.py package/material-symbols-outlined.woff2 /tmp/icons.woff2 .
    python tools/subset-icons.py --write-css /tmp/icons.woff2

Run it whenever you add a new icon name to the code.
"""
import base64
import re, sys, glob
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset

if sys.argv[1] == '--write-css':
    data = base64.b64encode(open(sys.argv[2], 'rb').read()).decode()
    css = open('vendor/material-symbols/outlined.css').read()
    css = re.sub(r'url\(data:font/woff2;base64,[^)]*\)', 'url(data:font/woff2;base64,%s)' % data, css)
    open('vendor/material-symbols/outlined.css', 'w').write(css)
    sys.exit(0)

src, out, root = sys.argv[1], sys.argv[2], sys.argv[3]
cands = set()
for f in glob.glob(root + '/js/*.js') + [root + '/index.html', root + '/css/app.css']:
    t = open(f, encoding='utf8').read()
    cands |= set(re.findall(r"['\">`]([a-z0-9][a-z0-9_]{1,40})['\"<`]", t))
font = TTFont(src)
cmap = font.getBestCmap()
g2c = {v: chr(k) for k, v in cmap.items()}
# collect ligatures: component glyph sequence -> ligature glyph
ligs = {}
for lookup in font['GSUB'].table.LookupList.Lookup:
    for st in lookup.SubTable:
        if st.LookupType == 7:
            st = st.ExtSubTable
        if getattr(st, 'LookupType', None) != 4 and not hasattr(st, 'ligatures'):
            continue
        for first, ls in st.ligatures.items():
            for l in ls:
                seq = [first] + list(l.Component)
                try:
                    s = ''.join(g2c[g] for g in seq)
                except KeyError:
                    continue
                ligs[s] = l.LigGlyph
used = sorted(c for c in cands if c in ligs)
missing = sorted(c for c in cands if c not in ligs)
print('icons used:', len(used))
open(out + '.txt', 'w').write('\n'.join(used))
# pin variation axes to the default outlined style
font = instancer.instantiateVariableFont(font, {'FILL': 0, 'wght': 400, 'GRAD': 0, 'opsz': 24})
opts = subset.Options()
opts.layout_features = ['liga', 'rlig', 'calt', 'ccmp']
opts.flavor = 'woff2'
opts.glyph_names = True
opts.notdef_outline = True
sub = subset.Subsetter(opts)
chars = set('abcdefghijklmnopqrstuvwxyz0123456789_')
sub.populate(glyphs=[ligs[u] for u in used], unicodes=[ord(c) for c in chars])
sub.subset(font)
font.flavor = 'woff2'
font.save(out)
