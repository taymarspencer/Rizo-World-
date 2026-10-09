/*
  RIZO DUNGEON — COMIC CUTSCENES
  ==============================
  Action moments (story spine v0.4) cut away from the game into a comic page:
  panels slam or flip in, extreme close-ups, halftone, speed lines and bold
  SFX lettering. Quiet story moments stay in-engine; this is only for hits.

    const comic = RizoDungeonComic.create({ mount, reducedMotion, petMarkup, lines, speakers })
    comic.play(sceneId) → Promise<{ id, skipped }>   one at a time; never rejects
    comic.tick(ms)    the mode's scene clock drives it, so any pause freezes it
    comic.skip()      tap, click or Primary
    comic.playing()   → sceneId | null
    comic.destroy()

  The mode pauses the simulation while a comic is up (a scene step waits for
  the promise) and commits beat `comic:<id>` before playing it, so a comic
  never plays twice. Reduced motion: panels fade in, nothing slams or shakes.
  Art is inline SVG; Rizo is the player's own pet (host.petMarkup).
*/
(function initRizoDungeonComic(root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) Object.defineProperty(root, "RizoDungeonComic", { value: api, configurable: true });
})(typeof globalThis !== "undefined" ? globalThis : this, function createRizoDungeonComic(root) {
  "use strict";

  // ===== PALETTE (comic ink over the game's own colours) =====
  const K = { ink: "#111013", paper: "#f6efdc", paperDim: "#e5d9bb", flame: "#ffaf4a", ember: "#e0702a", hot: "#ffe2a0", cold: "#eef5f9", coldMid: "#b8c9d4", coldDeep: "#5f7685", night: "#141922", rain: "#8fa6b8", maroon: "#6a2e35", mustard: "#c79f3f", track: "#2f5b40", rust: "#7d4127", red: "#b8352f", suit: "#0b0c0f", suit2: "#1b1e24", shirt: "#e9e4d8", glove: "#26221f", asphalt: "#171b22", tail: "#ff5040" };
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const MARK = (color = K.cold, light = color, width = 1.7) => `<g fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"><path d="M14 27 V19 Q14 12 20 12 Q26 12 26 19 V27"/><path d="M11.5 28 H28.5"/></g><circle cx="20" cy="10.4" r="1.3" fill="${color}"/><circle cx="20" cy="21.5" r="2.3" fill="${light}"/>`;
  // A panel's art: viewBox 0 0 160 100, sliced to fill whatever shape the panel is.
  let uid = 0;
  const art = (body, { bg = K.paper, tone = null } = {}) => {
    const id = `cdot${uid += 1}`;
    return `<svg class="comic-art" viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><pattern id="${id}" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><circle cx="2" cy="2" r="0.9" fill="${tone || "rgba(17,16,19,.22)"}"/></pattern></defs><rect width="160" height="100" fill="${bg}"/>${body.replace(/HALFTONE/g, `url(#${id})`)}</svg>`;
  };
  // Speed lines: radial (toward a point) or straight (motion).
  function burst(cx, cy, color = K.ink, count = 28, inner = 26, outer = 140, width = 1.4) {
    let out = "";
    for (let index = 0; index < count; index += 1) {
      const a = (index / count) * Math.PI * 2 + (index % 3) * 0.04;
      const r0 = inner + (index % 4) * 6;
      out += `<path d="M${(cx + Math.cos(a) * r0).toFixed(1)} ${(cy + Math.sin(a) * r0).toFixed(1)} L${(cx + Math.cos(a) * outer).toFixed(1)} ${(cy + Math.sin(a) * outer).toFixed(1)}" stroke="${color}" stroke-width="${(width * (index % 2 ? 0.6 : 1)).toFixed(2)}"/>`;
    }
    return `<g class="comic-speed">${out}</g>`;
  }
  function streaks(angle, color = K.ink, count = 18, width = 1.2) {
    let out = "";
    const dx = Math.cos(angle), dy = Math.sin(angle);
    for (let index = 0; index < count; index += 1) {
      const x = ((index * 37) % 170) - 5, y = ((index * 53) % 110) - 5, length = 18 + (index % 5) * 9;
      out += `<path d="M${x.toFixed(1)} ${y.toFixed(1)} l${(dx * length).toFixed(1)} ${(dy * length).toFixed(1)}" stroke="${color}" stroke-width="${(width * (index % 3 ? 0.7 : 1)).toFixed(2)}"/>`;
    }
    return `<g class="comic-speed">${out}</g>`;
  }
  const rain = (count = 26, color = K.rain) => streaks(1.9, color, count, 0.8);
  const glow = (cx, cy, r, color = K.flame, a = 0.85) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity="${a * 0.35}"/><circle cx="${cx}" cy="${cy}" r="${r * 0.62}" fill="${color}" opacity="${a * 0.55}"/><circle cx="${cx}" cy="${cy}" r="${r * 0.3}" fill="${K.hot}" opacity="${a}"/>`;
  // A gloved hand, fingers spread, reaching at the viewer.
  const grabHand = (x, y, s = 1, flip = 1, sleeve = K.maroon) => `<g transform="translate(${x} ${y}) scale(${s * flip} ${s})"><path d="M-46 30 L-14 4 L-4 18 L-34 44 Z" fill="${sleeve}" stroke="${K.ink}" stroke-width="2.4" stroke-linejoin="round"/><path d="M-14 4 Q-8 -6 2 -4 L10 -18 Q14 -22 17 -18 L11 -4 L22 -16 Q26 -20 29 -16 L19 0 L28 -6 Q32 -8 33 -4 L20 10 Q16 20 4 22 Q-6 22 -4 18 Z" fill="${K.glove}" stroke="${K.ink}" stroke-width="2.4" stroke-linejoin="round"/><path d="M6 -6 L14 -16 M14 -2 L24 -12" stroke="#3d3833" stroke-width="1.4"/><path d="M-10 6 Q-18 -4 -12 -12 Q-6 -16 -2 -8" fill="${K.glove}" stroke="${K.ink}" stroke-width="2.2"/></g>`;
  // Opening-only hand: a tapered wrist, palm, four staggered fingers and
  // an opposed thumb. The sleeve bends before the cuff rather than becoming
  // a broad triangular wedge. Other chapters retain their authored hands.
  const snatchHand = (x, y, s, flip, sleeve) => `<g transform="translate(${x} ${y}) scale(${s * flip} ${s})" stroke="${K.ink}" stroke-width="2" stroke-linejoin="round">
    <path d="M-46 38 Q-37 20 -29 15 L-16 4 L-7 14 L-20 29 Q-28 35 -34 47 Z" fill="${sleeve}"/>
    <path d="M-18 5 L-12 0 L-3 13 L-9 18 Z" fill="${K.suit}"/>
    <path d="M-12 1 Q-13 -5 -8 -9 L-8 -24 Q-8 -28 -5 -28 Q-2 -28 -2 -24 L-1 -12
      L2 -30 Q3 -34 6 -33 Q9 -32 8 -28 L6 -10
      L12 -26 Q14 -30 17 -28 Q20 -26 18 -22 L12 -6
      L19 -18 Q21 -21 24 -19 Q27 -17 24 -13 L17 0
      Q16 8 9 14 Q3 19 -4 16 L-12 8 Z" fill="${K.glove}"/>
    <path d="M-10 5 L-18 -4 Q-20 -8 -16 -10 Q-13 -11 -10 -8 L-3 -2 Q1 1 -1 5" fill="${K.glove}"/>
    <path d="M-4 -8 L0 -4 M4 -7 L8 -3 M11 -3 L14 0 M-4 9 Q2 6 7 7" stroke="#3d3833" stroke-width="1" fill="none"/>
  </g>`;
  const card = (x, y, s = 1, rot = -12) => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><rect x="-16" y="-10" width="32" height="20" rx="1.5" fill="${K.suit}" stroke="${K.coldMid}" stroke-width="0.8"/><g transform="translate(-10 -10) scale(0.5)">${MARK(K.cold)}</g></g>`;

  // ===== THE SCENES =====
  // Each panel: at (ms), enter (slam|slam-l|slam-r|flip|drop|zoom|fade), area
  // (CSS grid area), art(), optional rizo {x,y,w,rot,cls} in % of the panel,
  // sfx [{text,x,y,rot,size,cls}], balloons [{line:[key,index]|{speaker,text},
  // x,y,w,tail}], caption.
  const SCENES = {
    // The hands close on him. The capped one leaves a card on the empty seat.
    grab: { ms: 3900, layout: "grab", panels: [
      { at: 0, enter: "slam", area: "a", art: () => art(`${burst(110, 52, K.ink, 34, 18, 150, 1.6)}<rect x="0" y="0" width="160" height="100" fill="HALFTONE"/><path d="M0 0 H62 L40 100 H0 Z" fill="${K.night}"/>${rain(16)}<path d="M62 0 L40 100" stroke="${K.ink}" stroke-width="4"/>${snatchHand(112, 58, 1.15, 1, K.maroon)}${snatchHand(68, 76, 0.95, -1, K.track)}`),
        sfx: [{ text: "SNATCH!", x: 50, y: 22, rot: -10, size: 2.3 }] },
      { at: 950, enter: "slam-r", area: "b", art: () => art(`${burst(80, 50, K.ember, 30, 30, 130, 2)}`, { bg: K.hot }), rizo: { x: 50, y: 64, w: 230, cls: "is-eyes" },
        sfx: [{ text: "!!", x: 82, y: 18, rot: 12, size: 1.8, cls: "is-small" }] },
      { at: 1900, enter: "flip", area: "c", art: () => art(`<rect width="160" height="100" fill="#2c313d"/><path d="M14 100 Q16 40 46 30 L120 26 Q146 30 150 100 Z" fill="#434a5a" stroke="${K.ink}" stroke-width="3"/><path d="M30 100 Q34 56 56 48 L112 46 Q132 50 134 100" fill="#636c80" opacity=".5"/><rect x="0" y="0" width="160" height="100" fill="HALFTONE"/>${card(84, 70, 1.1, -14)}<path d="M120 0 L160 0 L160 44 Q140 50 128 38 L104 52 Q96 56 92 50 L118 30 Z" fill="${K.track}" stroke="${K.ink}" stroke-width="2.4"/><path d="M104 52 Q98 60 92 62 Q86 62 90 56 L98 48" fill="${K.glove}" stroke="${K.ink}" stroke-width="2"/>`),
        sfx: [{ text: "tk.", x: 30, y: 24, rot: -6, size: 1, cls: "is-small" }] }
    ] },
    // Three bursts: the cloth gives.
    sack: { ms: 3500, layout: "three", panels: [
      { at: 0, enter: "slam", area: "a", art: () => art(`<path d="M30 92 Q20 50 52 20 Q80 4 108 20 Q140 46 128 92 Z" fill="#d9d2c0" stroke="${K.ink}" stroke-width="3"/>${glow(80, 54, 40, K.flame, 0.9)}<path d="M52 20 Q60 40 46 70 M108 22 Q100 44 114 74 M80 12 Q84 34 76 50" stroke="#b9ae93" stroke-width="2" fill="none"/>${burst(80, 54, K.ink, 22, 54, 120, 1.4)}`, { bg: K.night }),
        sfx: [{ text: "THRASH!", x: 50, y: 18, rot: -8, size: 2.1 }] },
      { at: 900, enter: "slam-l", area: "b", art: () => art(`<rect width="160" height="100" fill="#d9d2c0"/><rect width="160" height="100" fill="HALFTONE"/><path d="M0 52 L22 44 L34 58 L52 42 L66 60 L84 40 L100 58 L118 42 L134 56 L160 46 L160 64 L134 74 L118 60 L100 76 L84 58 L66 78 L52 60 L34 76 L22 62 L0 70 Z" fill="${K.flame}" stroke="${K.ink}" stroke-width="2.6"/>${glow(80, 58, 30, K.hot, 1)}`),
        sfx: [{ text: "RRRIP!", x: 56, y: 22, rot: 6, size: 2.2 }] },
      { at: 1800, enter: "zoom", area: "c", art: () => art(`<rect width="160" height="100" fill="#283036"/><path d="M0 72 H160 V100 H0 Z" fill="#3f4b53"/>${Array.from({ length: 9 }, (_, i) => `<path d="M${i * 20} 74 V100" stroke="#647480" stroke-width="2"/>`).join("")}<path d="M26 40 Q50 20 76 40" stroke="${K.ink}" stroke-width="2" fill="none" stroke-dasharray="4 4"/><path d="M96 70 Q120 52 150 74" fill="#d9d2c0" stroke="${K.ink}" stroke-width="2.4"/>`), rizo: { x: 54, y: 62, w: 52, rot: -18, cls: "is-tumble" },
        sfx: [{ text: "THUD", x: 74, y: 82, rot: -4, size: 1.6 }] }
    ] },
    // Through the gap: the door, the leap, the road.
    "van-leap": { ms: 3900, layout: "three", panels: [
      { at: 0, enter: "slam", area: "a", art: () => art(`<rect width="160" height="100" fill="${K.night}"/>${rain(22)}<path d="M0 0 H52 L60 100 H0 Z" fill="#647480" stroke="${K.ink}" stroke-width="3"/><path d="M160 0 H108 L96 100 H160 Z" fill="#647480" stroke="${K.ink}" stroke-width="3"/><path d="M52 0 L36 -4 L44 100 L60 100 Z" fill="#3f4b53"/><circle cx="20" cy="50" r="4" fill="${K.ink}"/>${burst(80, 50, K.coldMid, 26, 14, 90, 1)}`),
        sfx: [{ text: "KRAK!", x: 50, y: 28, rot: -12, size: 2.4 }] },
      { at: 900, enter: "slam-r", area: "b", art: () => art(`<rect width="160" height="100" fill="${K.night}"/>${streaks(0, K.coldMid, 22, 1.1)}${rain(14)}<circle cx="146" cy="30" r="6" fill="${K.tail}" opacity=".9"/><circle cx="130" cy="30" r="6" fill="${K.tail}" opacity=".9"/><circle cx="138" cy="30" r="16" fill="${K.tail}" opacity=".18"/>`), rizo: { x: 40, y: 50, w: 46, rot: 24, cls: "is-leap" },
        sfx: [{ text: "WHOOSH", x: 58, y: 80, rot: 4, size: 1.6, cls: "is-cold" }] },
      { at: 1900, enter: "drop", area: "c", art: () => art(`<rect width="160" height="100" fill="${K.asphalt}"/><path d="M0 60 H160" stroke="#c9c2a8" stroke-width="2.4" stroke-dasharray="14 10"/>${rain(18)}<ellipse cx="78" cy="78" rx="46" ry="10" fill="#2f4255"/>${Array.from({ length: 10 }, (_, i) => { const a = Math.PI + (i / 9) * Math.PI; return `<path d="M${78 + Math.cos(a) * 30} ${76 + Math.sin(a) * 8} l${Math.cos(a) * 16} ${Math.sin(a) * 22}" stroke="#7f98ad" stroke-width="2"/>`; }).join("")}`), rizo: { x: 49, y: 70, w: 34, rot: 70, cls: "is-down" },
        sfx: [{ text: "SPLASH!", x: 50, y: 24, rot: -6, size: 2.2, cls: "is-cold" }] }
    ] },
    // Up the road the van stops. They are coming back with a light.
    taillights: { ms: 3500, layout: "three", panels: [
      { at: 0, enter: "slam", area: "a", art: () => art(`<rect width="160" height="100" fill="${K.night}"/>${rain(16)}<rect x="18" y="26" width="124" height="54" rx="6" fill="#283036" stroke="${K.ink}" stroke-width="3"/><rect x="24" y="34" width="22" height="16" rx="3" fill="${K.tail}"/><rect x="114" y="34" width="22" height="16" rx="3" fill="${K.tail}"/><circle cx="35" cy="42" r="24" fill="${K.tail}" opacity=".25"/><circle cx="125" cy="42" r="24" fill="${K.tail}" opacity=".25"/><rect x="58" y="60" width="44" height="12" fill="#c9c2a8" stroke="${K.ink}" stroke-width="1.6"/>`),
        sfx: [{ text: "SKREEEE!", x: 50, y: 16, rot: -6, size: 2.1 }] },
      { at: 900, enter: "slam-l", area: "b", art: () => art(`<rect width="160" height="100" fill="${K.asphalt}"/>${rain(12)}<ellipse cx="82" cy="86" rx="50" ry="9" fill="#2f4255"/><path d="M64 -4 L96 -4 L94 54 L66 56 Z" fill="#2f4863" stroke="${K.ink}" stroke-width="2.6"/><path d="M70 10 l4 30 M86 6 l-2 34" stroke="#55637a" stroke-width="1.4"/><path d="M58 56 Q60 46 72 46 L94 48 Q112 50 120 62 Q124 70 116 74 L60 74 Q54 70 58 56 Z" fill="${K.ink}" stroke="${K.ink}" stroke-width="2"/><path d="M60 56 Q62 50 72 50 L92 52 Q108 54 114 64 L62 66 Z" fill="#e9e4d8"/><path d="M58 70 H118" stroke="#e9e4d8" stroke-width="5" stroke-linecap="round"/><path d="M76 52 l6 6 M84 52 l6 6 M92 54 l5 5" stroke="${K.ink}" stroke-width="1.4"/>${burst(86, 80, "#7f98ad", 14, 30, 58, 1.6)}`),
        sfx: [{ text: "THUNK.", x: 50, y: 22, rot: 4, size: 1.8 }] },
      { at: 1800, enter: "flip", area: "c", art: () => art(`<rect width="160" height="100" fill="${K.night}"/><path d="M40 52 L160 10 L160 96 Z" fill="${K.cold}" opacity=".55"/><path d="M40 52 L160 26 L160 80 Z" fill="${K.cold}" opacity=".4"/><rect x="18" y="38" width="22" height="34" rx="3" fill="#15110e" stroke="${K.ink}" stroke-width="2"/><rect x="36" y="46" width="6" height="12" fill="${K.cold}"/><path d="M8 72 Q14 60 26 62 L34 74 Q24 86 10 84 Z" fill="${K.maroon}" stroke="${K.ink}" stroke-width="2"/>`),
        sfx: [{ text: "CLICK.", x: 30, y: 18, rot: -4, size: 1.6, cls: "is-cold" }] }
    ] },
    // The second slip: down, past the deep, into black.
    fall: { ms: 3400, layout: "tall", panels: [
      { at: 0, enter: "slam", area: "a", art: () => art(`<rect width="160" height="100" fill="#26282c"/><path d="M0 48 L70 48 L96 100 L0 100 Z" fill="#4b4f55" stroke="${K.ink}" stroke-width="2.6"/>${Array.from({ length: 6 }, (_, i) => `<path d="M${74 + i * 4} ${52 + i * 7} l${8 + i} ${4 + i}" stroke="#6b6f74" stroke-width="2"/>`).join("")}<rect width="160" height="100" fill="HALFTONE"/>`), rizo: { x: 58, y: 50, w: 30, rot: 30, cls: "is-slip" },
        sfx: [{ text: "SKRRT—", x: 40, y: 20, rot: -8, size: 1.6 }] },
      { at: 850, enter: "drop", area: "b", art: () => art(`<rect width="160" height="100" fill="#0a0807"/>${streaks(-Math.PI / 2, "#4b4f55", 20, 1.4)}<rect x="10" y="0" width="12" height="100" fill="#3f4b53" stroke="${K.ink}" stroke-width="2"/><rect x="130" y="20" width="22" height="80" fill="#2e251d"/><path d="M138 30 v60" stroke="#6a4630" stroke-width="1.2" stroke-dasharray="3 3"/><rect x="60" y="70" width="10" height="7" fill="${K.hot}" opacity=".85"/>`), rizo: { x: 48, y: 46, w: 34, rot: 170, cls: "is-fall" },
        sfx: [{ text: "FWOOOO", x: 76, y: 82, rot: 80, size: 1.5, cls: "is-small" }] },
      { at: 2100, enter: "fade", area: "c", art: () => art(`<rect width="160" height="100" fill="#000"/>${glow(80, 50, 4, K.flame, 0.9)}`, { bg: "#000" }) }
    ] },
    // MEANWHILE, UP THERE: hands, cufflinks, a tie. He sends the collectors.
    "boss-hands": { ms: 8600, layout: "boss", caption: "MEANWHILE, UP THERE…", panels: [
      { at: 0, enter: "fade", area: "a", art: () => art(`<rect width="160" height="100" fill="${K.suit}"/><rect x="0" y="0" width="160" height="40" fill="#1d2a33"/>${Array.from({ length: 14 }, (_, i) => `<rect x="${6 + i * 11}" y="${8 + (i * 7) % 22}" width="3" height="3" fill="${i % 3 ? K.coldMid : K.cold}" opacity=".6"/>`).join("")}<path d="M0 40 H160" stroke="${K.coldDeep}" stroke-width="1.4"/><path d="M0 52 L160 46 L160 100 L0 100 Z" fill="#1b1e24"/><rect x="58" y="60" width="44" height="24" rx="3" fill="${K.suit}" stroke="${K.coldMid}" stroke-width="1.2" transform="rotate(-6 80 72)"/><rect x="62" y="63" width="36" height="18" rx="1" fill="#1d2a33" transform="rotate(-6 80 72)"/><g transform="rotate(-6 80 72) translate(70 62) scale(.5)">${MARK(K.cold, "#fff")}</g>${burst(80, 72, K.coldMid, 12, 18, 30, 0.7)}`, { bg: K.suit }),
        balloons: [{ line: ["comicBossHands", 0], x: 36, y: 26, w: 62, tail: "radio" }] },
      { at: 1900, enter: "slam", area: "b", art: () => art(`<rect width="160" height="100" fill="${K.suit2}"/><path d="M-10 100 L30 30 L150 18 L170 100 Z" fill="${K.suit}" stroke="${K.ink}" stroke-width="2"/><path d="M40 40 L150 30 L156 64 L48 74 Z" fill="${K.shirt}" stroke="${K.ink}" stroke-width="2.4"/><path d="M48 74 L44 40" stroke="#c9c2b5" stroke-width="1.4"/><circle cx="96" cy="54" r="15" fill="${K.coldMid}" stroke="${K.ink}" stroke-width="2.4"/><circle cx="96" cy="54" r="11" fill="${K.suit}"/><g transform="translate(86 44) scale(.5)">${MARK(K.cold, "#fff", 2)}</g><path d="M86 44 l4 4" stroke="#fff" stroke-width="1.6" opacity=".8"/><path d="M150 32 L172 30 L172 70 L156 64 Z" fill="#cf9f7d" stroke="${K.ink}" stroke-width="2"/>`, { bg: K.suit2 }),
        balloons: [{ line: ["comicBossHands", 1], x: 4, y: 4, w: 92, tail: "boss" }] },
      { at: 4000, enter: "flip", area: "c", art: () => art(`<rect width="160" height="100" fill="${K.suit}"/><path d="M20 100 L44 0 L116 0 L140 100 Z" fill="${K.shirt}"/><path d="M58 0 L80 22 L102 0 Z" fill="#d6d0c2" stroke="${K.ink}" stroke-width="2"/><path d="M72 18 L80 26 L88 18 L94 92 L80 100 L66 92 Z" fill="#141922" stroke="${K.ink}" stroke-width="2.2"/><path d="M74 20 H86 L84 30 H76 Z" fill="#1d2a33" stroke="${K.ink}" stroke-width="2"/><path d="M0 0 L44 0 L20 100 L0 100 Z M160 0 L116 0 L140 100 L160 100 Z" fill="${K.suit2}" stroke="${K.ink}" stroke-width="2"/><g transform="translate(118 30) scale(.32)">${MARK(K.coldMid)}</g><path d="M90 46 Q108 40 118 52 L112 60 Q102 54 92 58 Z" fill="#cf9f7d" stroke="${K.ink}" stroke-width="2"/><rect width="160" height="100" fill="HALFTONE"/>`, { tone: "rgba(184,201,212,.18)" }),
        balloons: [{ line: ["comicBossHands", 2], x: 4, y: 4, w: 96, tail: "boss" }] },
      { at: 6400, enter: "slam-r", area: "d", art: () => art(`<rect width="160" height="100" fill="#1b1e24"/><rect x="48" y="18" width="64" height="76" rx="6" fill="${K.suit}" stroke="${K.coldMid}" stroke-width="1.6"/><rect x="54" y="28" width="52" height="52" fill="#1d2a33"/><circle cx="80" cy="66" r="9" fill="${K.red}" stroke="${K.ink}" stroke-width="2"/><path d="M76 66 h8" stroke="#fff" stroke-width="2"/><path d="M98 100 L104 72 Q108 62 114 70 L112 100 Z" fill="#cf9f7d" stroke="${K.ink}" stroke-width="2"/>`, { bg: "#1b1e24" }),
        balloons: [{ line: ["comicBossHands", 3], x: 3, y: 8, w: 38, tail: "radio" }],
        sfx: [{ text: "CLICK.", x: 70, y: 86, rot: -6, size: 1.4, cls: "is-cold" }] }
    ] },
    // MEANWHILE: a shape behind frosted glass, the mark on the door. The window will open.
    "boss-glass": { ms: 7200, layout: "three", caption: "MEANWHILE…", panels: [
      { at: 0, enter: "fade", area: "a", art: () => art(`<rect width="160" height="100" fill="#1d2a33"/><rect x="40" y="6" width="80" height="94" fill="#b8c9d4" opacity=".75"/><rect x="40" y="6" width="80" height="94" fill="HALFTONE"/><path d="M72 100 L74 50 Q74 34 80 30 Q86 34 86 50 L88 100 Z M66 100 Q66 62 80 56 Q94 62 94 100 Z" fill="#1d2a33" opacity=".85"/><circle cx="80" cy="32" r="8" fill="#1d2a33" opacity=".85"/><g transform="translate(66 12) scale(.7)">${MARK(K.suit, K.suit, 2)}</g><rect x="36" y="2" width="88" height="98" fill="none" stroke="${K.ink}" stroke-width="4"/>`, { tone: "rgba(17,16,19,.12)" }),
        balloons: [{ line: ["comicBossGlass", 0], x: 3, y: 56, w: 46, tail: "radio" }] },
      { at: 2600, enter: "slam", area: "b", art: () => art(`<rect width="160" height="100" fill="#b8c9d4"/><rect width="160" height="100" fill="HALFTONE"/><path d="M40 100 Q40 54 80 46 Q120 54 120 100 Z" fill="#1d2a33" opacity=".9"/><circle cx="80" cy="30" r="17" fill="#1d2a33" opacity=".92"/><path d="M110 70 L118 44 L124 46 L118 72 Z" fill="#1d2a33"/>`, { tone: "rgba(17,16,19,.16)" }),
        balloons: [{ line: ["comicBossGlass", 1], x: 3, y: 4, w: 60, tail: "boss" }] },
      { at: 4800, enter: "zoom", area: "c", art: () => art(`<rect width="160" height="100" fill="#2a2018"/><path d="M80 0 V22" stroke="#8f6544" stroke-width="1.4"/><rect x="52" y="22" width="56" height="52" rx="3" fill="#e3d8bf" stroke="${K.ink}" stroke-width="3" transform="rotate(-4 80 48)"/><g transform="rotate(-4 80 48)"><text x="80" y="47" text-anchor="middle" font-family="Impact, 'Arial Black', sans-serif" font-size="14" fill="${K.red}">CLOSED</text><text x="80" y="62" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="8.5" fill="#47301f">back soon</text></g><circle cx="104" cy="16" r="24" fill="${K.cold}" opacity=".3"/>`) }
    ] },
    // v0.5. He rings the bell. The window opens on a collector. Nell swings.
    "window-opens": { ms: 4600, layout: "three", panels: [
      { at: 0, enter: "slam", area: "a", art: () => art(`<rect width="160" height="100" fill="#2a2018"/><rect x="0" y="62" width="160" height="38" fill="#6a4630" stroke="${K.ink}" stroke-width="3"/><path d="M0 66 H160" stroke="#8f6544" stroke-width="2"/><rect x="34" y="6" width="92" height="44" fill="#3f4b53" stroke="${K.ink}" stroke-width="3"/>${Array.from({ length: 9 }, (_, i) => `<path d="M36 ${10 + i * 4.6} H124" stroke="#283036" stroke-width="1.6"/>`).join("")}<rect x="60" y="18" width="40" height="16" fill="#e3d8bf" stroke="${K.ink}" stroke-width="2"/><text x="80" y="30" text-anchor="middle" font-family="Impact, 'Arial Black', sans-serif" font-size="10" fill="${K.red}">CLOSED</text><ellipse cx="112" cy="64" rx="15" ry="6" fill="#ecc77d" stroke="${K.ink}" stroke-width="2.4"/><path d="M98 64 Q100 46 112 44 Q124 46 126 64 Z" fill="#c48f3e" stroke="${K.ink}" stroke-width="2.4"/><circle cx="112" cy="42" r="3" fill="#ecc77d" stroke="${K.ink}" stroke-width="1.6"/>${burst(112, 50, K.ink, 18, 20, 44, 1.2)}`), rizo: { x: 30, y: 66, w: 30, rot: -8, cls: "is-eyes" },
        sfx: [{ text: "DING!", x: 76, y: 82, rot: -8, size: 2.1 }] },
      { at: 1150, enter: "slam-r", area: "b", art: () => art(`<rect width="160" height="100" fill="${K.coldDeep}"/><rect x="18" y="0" width="124" height="70" fill="${K.cold}"/>${burst(80, 30, "#ffffff", 26, 10, 120, 1.6)}<rect x="18" y="-10" width="124" height="14" fill="#3f4b53" stroke="${K.ink}" stroke-width="3"/><path d="M48 70 Q46 34 80 30 Q114 34 112 70 Z" fill="#1b1e24" stroke="${K.ink}" stroke-width="3"/><circle cx="72" cy="46" r="6" fill="${K.coldMid}" stroke="${K.ink}" stroke-width="2"/><circle cx="90" cy="46" r="6" fill="${K.coldMid}" stroke="${K.ink}" stroke-width="2"/><circle cx="72" cy="46" r="2.4" fill="#fff"/><circle cx="90" cy="46" r="2.4" fill="#fff"/><g transform="translate(72 52) scale(.4)">${MARK(K.cold)}</g><rect x="0" y="68" width="160" height="32" fill="#6a4630" stroke="${K.ink}" stroke-width="3"/>${grabHand(118, 74, 1.05, 1, "#3f4b53")}`, { bg: K.cold }),
        sfx: [{ text: "KRRANG!", x: 46, y: 16, rot: -10, size: 1.5, cls: "is-cold" }] },
      { at: 2400, enter: "flip", area: "c", art: () => art(`<rect width="160" height="100" fill="#2a2018"/>${burst(98, 40, K.hot, 26, 10, 90, 1.6)}<path d="M150 10 L104 44" stroke="${K.ink}" stroke-width="6"/><path d="M150 10 L104 44" stroke="${K.coldMid}" stroke-width="3"/><rect x="92" y="34" width="16" height="12" rx="2" fill="#1b1e24" stroke="${K.ink}" stroke-width="2" transform="rotate(-36 100 40)"/><circle cx="92" cy="46" r="5" fill="${K.cold}"/><path d="M-6 104 L96 30 L106 42 L4 116 Z" fill="#8f6544" stroke="${K.ink}" stroke-width="3"/><path d="M8 100 L90 40" stroke="#6a4630" stroke-width="1.6"/><path d="M0 84 Q10 72 24 78 L30 92 Q16 100 4 96 Z" fill="#5a8578" stroke="${K.ink}" stroke-width="2.4"/>`),
        balloons: [{ line: ["comicWindow", 0], x: 3, y: 4, w: 64, tail: "speech" }],
        sfx: [{ text: "CLONK!", x: 74, y: 76, rot: 8, size: 1.9 }] }
    ] },
    // v0.5. Under the collector's glove, into RETURNS: the Boss's own chute.
    chute: { ms: 7600, layout: "boss", panels: [
      { at: 0, enter: "slam", area: "a", art: () => art(`<rect width="160" height="100" fill="#28313a"/><rect x="0" y="0" width="160" height="56" fill="#b8c9d4"/>${Array.from({ length: 16 }, (_, i) => `<path d="M${i * 10} 0 V56" stroke="#9aa9b3" stroke-width="1"/>`).join("")}<rect x="56" y="22" width="48" height="40" fill="#3f4b53" stroke="${K.ink}" stroke-width="3"/><path d="M60 26 L100 26 L96 58 L64 58 Z" fill="#0b0c0f"/><text x="80" y="18" text-anchor="middle" font-family="Impact, 'Arial Black', sans-serif" font-size="8" fill="${K.coldDeep}">RETURNS</text>${streaks(-0.4, K.ink, 14, 1.1)}${grabHand(150, 70, 1.1, 1, "#3f4b53")}`), rizo: { x: 52, y: 52, w: 22, rot: -30, cls: "is-leap" },
        sfx: [{ text: "FWUMP!", x: 28, y: 80, rot: -6, size: 1.8 }] },
      { at: 950, enter: "drop", area: "b", art: () => art(`<rect width="160" height="100" fill="#0b0c0f"/><path d="M20 0 L60 100 L100 100 L140 0 Z" fill="#3f4b53" stroke="${K.ink}" stroke-width="3"/><path d="M40 0 L68 100 M120 0 L92 100" stroke="#647480" stroke-width="1.4"/>${streaks(Math.PI / 2, "#9fadb5", 16, 1.2)}${Array.from({ length: 6 }, (_, i) => `<circle cx="${30 + i * 4}" cy="${10 + i * 16}" r="1.4" fill="#9fadb5"/><circle cx="${130 - i * 4}" cy="${10 + i * 16}" r="1.4" fill="#9fadb5"/>`).join("")}<ellipse cx="80" cy="98" rx="22" ry="6" fill="${K.cold}" opacity=".5"/>`), rizo: { x: 50, y: 44, w: 30, rot: 160, cls: "is-fall" },
        sfx: [{ text: "WHOOOSH", x: 74, y: 20, rot: 74, size: 1.2, cls: "is-small is-cold" }] },
      { at: 2000, enter: "slam", area: "c", art: () => art(`<rect width="160" height="100" fill="#28313a"/>${Array.from({ length: 12 }, (_, i) => `<path d="M${12 + i * 12} 0 V100" stroke="#9fadb5" stroke-width="2"/>`).join("")}${Array.from({ length: 6 }, (_, i) => `<path d="M0 ${8 + i * 18} H160" stroke="#9fadb5" stroke-width="1.6"/>`).join("")}<rect x="0" y="0" width="160" height="14" fill="#3f4b53" stroke="${K.ink}" stroke-width="3"/><rect x="108" y="14" width="26" height="18" fill="#e3d8bf" stroke="${K.ink}" stroke-width="2"/><g transform="translate(111 13) scale(.5)">${MARK(K.suit)}</g><path d="M121 0 V14" stroke="${K.ink}" stroke-width="1.4"/>${burst(80, 60, K.ink, 20, 30, 100, 1)}`), rizo: { x: 44, y: 64, w: 44, cls: "is-eyes" },
        sfx: [{ text: "CLANG!", x: 64, y: 30, rot: -8, size: 2 }] },
      { at: 3300, enter: "slam-l", area: "d", art: () => art(`<rect width="160" height="100" fill="#28313a"/><rect x="0" y="0" width="160" height="44" fill="#b8c9d4"/>${Array.from({ length: 16 }, (_, i) => `<path d="M${i * 10} 0 V44" stroke="#9aa9b3" stroke-width="1"/>`).join("")}<rect x="18" y="20" width="44" height="34" fill="#3f4b53" stroke="${K.ink}" stroke-width="3"/><path d="M22 24 H58 L54 50 H26 Z" fill="#0b0c0f"/><text x="40" y="16" text-anchor="middle" font-family="Impact, 'Arial Black', sans-serif" font-size="7" fill="${K.coldDeep}">RETURNS</text><path d="M76 100 Q74 52 104 44 Q134 52 132 100 Z" fill="#647480" stroke="${K.ink}" stroke-width="3"/><path d="M84 58 Q84 32 104 28 Q124 32 124 58 Z" fill="#1b1e24" stroke="${K.ink}" stroke-width="2.6"/><circle cx="97" cy="46" r="5" fill="${K.coldMid}" stroke="${K.ink}" stroke-width="1.8"/><circle cx="111" cy="46" r="5" fill="${K.coldMid}" stroke="${K.ink}" stroke-width="1.8"/><circle cx="97" cy="46" r="2" fill="#fff"/><circle cx="111" cy="46" r="2" fill="#fff"/><g transform="translate(96 66) scale(.4)">${MARK(K.cold)}</g><rect x="132" y="56" width="10" height="18" rx="2" fill="#1b1e24" stroke="${K.ink}" stroke-width="2"/><path d="M137 56 V46" stroke="${K.ink}" stroke-width="2"/><circle cx="137" cy="62" r="1.6" fill="${K.red}"/><path d="M62 30 L76 52" stroke="${K.coldMid}" stroke-width="1.4" stroke-dasharray="3 3"/>`, { bg: "#28313a" }),
        balloons: [{ line: ["comicChute", 0], x: 3, y: 46, w: 44, tail: "radio" }, { line: ["comicChute", 1], x: 30, y: 4, w: 62, tail: "boss" }] }
    ] }
  };

  // onPanel(sceneId, index, panel) is called as each panel lands (the mode plays its hit).
  function create({ mount, reducedMotion = false, petMarkup = () => "", lines = {}, speakers = {}, onPanel = null } = {}) {
    let state = null, destroyed = false;
    const nameOf = speaker => (speaker === "collector" ? "RADIO" : speakers[speaker]?.name || "");
    function lineText(ref) {
      if (!ref) return null;
      if (Array.isArray(ref)) { const item = lines[ref[0]]?.[ref[1]]; return item ? { speaker: item.speaker, text: item.text } : null; }
      return ref;
    }
    function panelMarkup(panel, index) {
      const rizo = panel.rizo ? `<div class="comic-rizo ${panel.rizo.cls || ""}" style="left:${panel.rizo.x}%;top:${panel.rizo.y}%;width:${panel.rizo.w}%;--rot:${panel.rizo.rot || 0}deg">${petMarkup()}</div>` : "";
      const sfx = (panel.sfx || []).map(item => `<b class="comic-sfx ${item.cls || ""}" style="left:${item.x}%;top:${item.y}%;--rot:${item.rot || 0}deg;--size:${item.size || 1.6}">${esc(item.text)}</b>`).join("");
      const balloons = (panel.balloons || []).map(item => {
        const line = lineText(item.line);
        if (!line) return "";
        const name = nameOf(line.speaker);
        return `<p class="comic-balloon is-${esc(item.tail || "speech")}" data-speaker="${esc(line.speaker || "")}" style="left:${item.x}%;top:${item.y}%;max-width:${item.w || 60}%">${name ? `<small>${esc(name)}</small>` : ""}${esc(line.text)}</p>`;
      }).join("");
      // Art, Rizo and SFX are cut to the panel; balloons may cross its border, as in a real page.
      return `<div class="comic-panel enter-${panel.enter || "slam"}" data-panel="${index}" style="grid-area:${panel.area}"><div class="comic-clip">${panel.art()}${rizo}${sfx}</div>${balloons}</div>`;
    }
    // opts.onDone is called synchronously when the page closes (before the
    // promise settles), so a fixed-step caller never loses a frame to a microtask.
    function play(id, opts = {}) {
      if (destroyed) { opts.onDone?.({ id, skipped: true }); return Promise.resolve({ id, skipped: true }); }
      if (state) return state.promise;
      const scene = SCENES[id];
      if (!scene || !mount) { opts.onDone?.({ id, skipped: true }); return Promise.resolve({ id, skipped: true }); }
      const node = root.document.createElement("div");
      node.className = `dungeon-comic layout-${scene.layout}${reducedMotion ? " is-reduced" : ""}`;
      node.dataset.comic = id;
      node.dataset.dungeonUi = "";
      node.setAttribute("role", "img");
      node.setAttribute("aria-label", "Comic cutscene. Tap to skip.");
      node.innerHTML = `<div class="comic-page">${scene.caption ? `<span class="comic-caption">${esc(scene.caption)}</span>` : ""}${scene.panels.map(panelMarkup).join("")}</div><span class="comic-skip" aria-hidden="true">TAP TO SKIP ▸</span>`;
      mount.appendChild(node);
      let resolve;
      const promise = new Promise(done => { resolve = done; });
      state = { id, scene, node, t: 0, promise, resolve, onDone: opts.onDone, shown: new Set(), started: Date.now() };
      // A touch on the game is cancelled at touchstart; pointerdown still arrives.
      node.addEventListener("pointerdown", onTap);
      tick(0);
      return promise;
    }
    function onTap(event) {
      event.preventDefault?.();
      event.stopPropagation?.();
      // The tap that was already down when the page slammed in does not count.
      if (state && Date.now() - state.started > 280) skip();
    }
    function tick(ms) {
      if (!state) return;
      state.t += Math.max(0, ms || 0);
      state.scene.panels.forEach((panel, index) => {
        if (state.t >= panel.at && !state.shown.has(index)) {
          state.shown.add(index);
          state.node.querySelector(`[data-panel="${index}"]`)?.classList.add("is-in");
          try { onPanel?.(state.id, index, panel); } catch (error) {}
          if (index > 0 && !reducedMotion && /slam|drop/.test(panel.enter || "slam")) { state.node.classList.remove("is-shake"); void state.node.offsetWidth; state.node.classList.add("is-shake"); }
        }
      });
      if (state.t >= state.scene.ms) finish(false);
    }
    function finish(skipped) {
      if (!state) return;
      const { node, resolve, id, onDone } = state;
      state = null;
      node.removeEventListener("pointerdown", onTap);
      node.classList.add("is-out");
      root.setTimeout(() => node.remove(), reducedMotion ? 60 : 220);
      try { onDone?.({ id, skipped }); } finally { resolve({ id, skipped }); }
    }
    const skip = () => finish(true);
    const playing = () => state?.id || null;
    function destroy() { destroyed = true; if (state) finish(true); }
    return { play, tick, skip, playing, destroy };
  }

  return Object.freeze({ SCENES, create, MARK });
});
