/* RIZO ORIGIN — pictogram renderer.
   Turns a glyph spec into an SVG string. Results are memoised: with 400+
   marks on screen this is the difference between smooth and not. */
(function(){
  const CACHE = new Map();

  function part(p){
    if (!p) return '';
    if (p.startsWith('#mark')) {
      const m = p.match(/^#mark(?:@([\d.-]+),([\d.-]+),([\d.]+))?$/);
      const M = window.RIZO_MARK;
      const inner = `<path d="${M.body}" fill-rule="evenodd"/><path d="${M.eyeL}"/><path d="${M.eyeR}"/><path d="${M.mouth}"/>`;
      if (!m || m[1] === undefined) return inner;
      return `<g transform="translate(${m[1]} ${m[2]}) scale(${m[3]})">${inner}</g>`;
    }
    let stroked = false;
    if (p[0] === '~') { stroked = true; p = p.slice(1); }
    const k = p[0];
    if (k === 'o' || k === 'O') {
      const [x,y,r] = p.slice(1).split(',');
      return k === 'o'
        ? `<circle cx="${x}" cy="${y}" r="${r}"/>`
        : `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="currentColor" stroke-width="2.2"/>`;
    }
    return stroked
      ? `<path d="${p}" fill="none" stroke="currentColor" stroke-width="2.2"/>`
      : `<path d="${p}" fill-rule="evenodd"/>`;
  }

  /* inner markup only — the caller supplies the <svg> shell */
  function glyphBody(id){
    if (CACHE.has(id)) return CACHE.get(id);
    const spec = window.RIZO_GLYPHS[id];
    const out = spec ? spec.split('|').map(part).join('') : '<circle cx="16" cy="16" r="8" fill="none" stroke="currentColor" stroke-width="2.2"/>';
    CACHE.set(id, out);
    return out;
  }

  function glyphSVG(id, cls){
    return `<svg class="${cls||'gl'}" viewBox="0 0 32 32" aria-hidden="true" fill="currentColor" stroke="none" stroke-linecap="round" stroke-linejoin="round">${glyphBody(id)}</svg>`;
  }

  window.RizoArt = { glyphSVG, glyphBody };
})();
