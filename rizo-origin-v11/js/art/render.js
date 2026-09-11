/* RIZO ORIGIN — pictogram renderer.
   Astra introduced 64-unit hand-drawn plates. This renderer keeps those as the
   highest-authority art, then turns legacy 32-unit glyphs into field-guide
   specimens instead of exposing them as naked icon-library marks. */
(function(){
  'use strict';
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

  function hash(s){
    let h = 2166136261;
    for (let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h,16777619); }
    return h >>> 0;
  }
  const line=(d,w=.9,c='currentColor',op=.55)=>`<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" opacity="${op}"/>`;
  const dot=(x,y,r=1,c='var(--art-accent)',op=.55)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity="${op}"/>`;

  function motif(id, group, h){
    const v = h % 4;
    const organic = ['life','beast','human','world','element'].includes(group);
    const built   = ['society','craft','machine','money'].includes(group);
    const signal  = ['network','culture','style'].includes(group);
    const dark    = ['vice','abyss','chaos'].includes(group);
    const cosmic  = ['cosmos','faith','myth'].includes(group);
    const meta    = ['rizo','relic','meta'].includes(group);
    let out = '';
    if (organic){
      out += `<path d="M10 39C6 24 17 10 33 9C49 8 58 22 54 38C50 54 31 59 18 52C13 49 11 44 10 39Z" fill="var(--art-accent)" opacity=".12"/>`;
      out += line(v%2 ? 'M8 49C20 55 42 58 55 47' : 'M9 17C21 7 43 5 55 18',.8,'var(--art-accent)',.48);
      out += line('M12 56l7-5m-2 8 7-5m25-42 6-4',.7,'currentColor',.34);
    } else if (built){
      out += `<path d="M8 12L52 8L57 48L13 57L7 28Z" fill="none" stroke="var(--art-accent)" stroke-width="1" opacity=".36"/>`;
      out += line('M11 16l9-2m29-2 5 7M10 50l8 4m31-5 6-5',.8,'currentColor',.34);
      if (v&1) out += line('M18 8v6M43 52v7M6 35h7',.7,'var(--art-accent)',.55);
    } else if (signal){
      out += `<path d="M8 15L48 9L57 43L20 58L7 39Z" fill="var(--art-accent)" opacity=".08"/>`;
      out += line('M7 18l18-7M39 8l16 9M8 47l12 9M48 48l8-4',.9,'var(--art-accent)',.55);
      out += dot(10+(h%7),29,1.1)+dot(51-(h%5),34,.8,'currentColor',.42);
    } else if (dark){
      out += `<path d="M7 47L13 14L25 20L34 7L42 20L57 14L52 46L39 57L21 54Z" fill="var(--art-accent)" opacity=".10"/>`;
      out += line('M8 12l10 7m-8 2 7 4M55 10l-9 9m11 1-8 5M9 54l11-5m35 7-9-7',1,'var(--art-accent)',.62);
      out += line(v%2?'M5 34h10m34 1h11':'M17 6l3 10m25-9-4 10',.7,'currentColor',.4);
    } else if (cosmic){
      out += `<ellipse cx="32" cy="32" rx="24" ry="18" fill="none" stroke="var(--art-accent)" stroke-width=".9" opacity=".32"/>`;
      out += `<ellipse cx="32" cy="32" rx="12" ry="26" fill="none" stroke="var(--art-accent)" stroke-width=".65" opacity=".18" transform="rotate(${v*19-28} 32 32)"/>`;
      out += dot(9,17,.8)+dot(54,14,1,'currentColor',.4)+dot(50,52,.7);
    } else if (meta){
      out += line('M8 15L18 8M46 8l9 8M7 47l10 8M47 55l9-9',1.15,'var(--art-accent)',.72);
      out += line(v%2?'M5 29h10m34 0h10M31 4v9m0 38v9':'M11 9l7 7m29-7-7 7M10 55l8-8m29 8-8-8',.7,'currentColor',.38);
      out += `<path d="M13 18L47 12L53 46L20 55L9 39Z" fill="var(--art-accent)" opacity=".06"/>`;
    } else {
      out += line('M9 13l8-4m29 1 7 5M7 49l9 6m32-1 7-7',.8,'var(--art-accent)',.45);
    }
    return out;
  }

  function legacyPlate(id, raw){
    const e = window.Rizo && window.Rizo.EL[id];
    const group = e ? e.group : 'element';
    const h = hash(id);
    const rot = ((h % 9) - 4) * .38;
    const dx = 8 + (h % 3);
    const dy = 8 + ((h >>> 3) % 3);
    const scale = 1.46 + ((h >>> 7) % 3) * .025;
    const ghostX = dx + ((h&1)?1.1:-1.1);
    const ghostY = dy + ((h&2)?.7:-.7);
    return motif(id,group,h) +
      `<g transform="translate(${ghostX} ${ghostY}) rotate(${rot+1.3} 16 16) scale(${scale})" style="color:var(--art-accent)" opacity=".16">${raw}</g>`+
      `<g transform="translate(${dx} ${dy}) rotate(${rot} 16 16) scale(${scale})" style="color:var(--art-ink)">${raw}</g>`+
      line(`M${8+h%6} ${56-(h%4)}l${8+(h%7)} ${-2-(h%4)}`,.65,'var(--art-accent)',.52);
  }

  /* inner markup only — the caller supplies the <svg> shell */
  function glyphBody(id){
    if (CACHE.has(id)) return CACHE.get(id);
    const plate = window.RIZO_PLATES && window.RIZO_PLATES[id];
    if (plate) { CACHE.set(id, plate); return plate; }
    const spec = window.RIZO_GLYPHS[id];
    const raw = spec ? spec.split('|').map(part).join('') : '<circle cx="16" cy="16" r="8" fill="none" stroke="currentColor" stroke-width="2.2"/>';
    const out = legacyPlate(id, raw);
    CACHE.set(id, out);
    return out;
  }

  function glyphSVG(id, cls){
    const e = window.Rizo && window.Rizo.EL[id];
    const group = e ? window.Rizo.GROUPS[e.group] : null;
    const starterInk = { fire:'#e06932', water:'#59a3bd', earth:'#a78449', air:'#93a79d' };
    const accent = starterInk[id] || (group && group.ink) || '#9a784a';
    const authored = !!(window.RIZO_PLATES && window.RIZO_PLATES[id]);
    return `<svg class="${cls||'gl'} illustration ${authored?'art-authored':'art-derived'}" data-art="${id}" viewBox="0 0 64 64" aria-hidden="true" style="--art-accent:${accent};--art-paper:var(--art-paper-local,var(--bg2,#0f0f11));--art-ink:var(--ink,#ece8e0);color:var(--art-ink)" fill="currentColor" stroke="none" stroke-linecap="round" stroke-linejoin="round">${glyphBody(id)}</svg>`;
  }

  window.RizoArt = { glyphSVG, glyphBody, hasAuthoredPlate:id => !!(window.RIZO_PLATES && window.RIZO_PLATES[id]) };
})();
