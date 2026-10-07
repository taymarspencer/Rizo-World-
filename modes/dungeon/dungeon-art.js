/*
  RIZO DUNGEON — ART
  ==================
  The visual constitution of Rizo Dungeon, in code. Rooms, characters,
  enemies, props, light and portraits are all drawn from these rules, so a
  new piece belongs to the world before anyone tunes it. Read this before
  adding anything visible; extend the families here instead of inventing a
  look in a painter.

  THE SIGNATURE
    Simple far away, obsessive up close. Cute shapes in uncomfortable places.
    One small warm flame against a cold dark that still reads on a phone.
    Things people made and mended: tape, stitches, rivets, worn spots, a seat
    kept dry. Cutout characters with one ink line, hand-drawn but never
    random: the same object always wobbles the same way.

  1. PALETTE   Families of 3–5 flat values, dark → light (P below). A painter
               picks from them and never invents a colour. Outside is cold
               blue-grey; below is brown-black; warmth is the ember family
               only. Accents are spent once per object, not everywhere.
  2. INK       One outline colour, P.ink (a warm black, never #000).
               Characters RULES.ink.character, props RULES.ink.prop,
               architecture only where a face turns. Far background: no ink.
  3. VALUES    Shade with 2–3 flat bands. No smooth gradients on objects.
               Key light is from above (home is up): top faces take the
               light band, the far side takes the dark band.
  4. SHADOW    Anything standing drops a flat contact shadow (drop()), offset
               down-right. Walls cast one darker band onto the floor below.
  5. LIGHT     Each room has an ambient darkness. Lights (the Rizo's flame, a
               hearth, a lamp, a window, a phone) cut stepped pools in it:
               three bands (RULES.light), never a glowing orange disc. Warm
               light also tints what it reaches; cold light only reveals.
               Hazard telegraphs are drawn after the dark, so they always read.
  6. WOBBLE    Imperfection is seeded by an id or position (trace()); lines
               never boil from frame to frame. Only fire moves on its own.
  7. SCALE     1 unit = 1 world px (RULES.scale). Rizo ~28u. Latch 38u. People
               66–98u. Doors 40u. Nothing that matters is under 1.5u.
  8. EVIDENCE  One to three signs of people per room (a repair, a worn spot,
               something left for someone). Never decoration for its own sake.
  9. DANGER    Telegraphs are pale bone lines (P.danger): dashed = coming,
               solid = now, plus a change in the body's shape. Never red alone.
  10. TEXT     Signs are short, mundane, hand-lettered (label()).

  Portraits follow the same rules at 64×64 (see PORTRAITS): a stepped light
  disc behind the head, one ink weight, two value bands, one detail that is
  only theirs. A portrait may later be replaced by { src } without touching
  story code.
*/
(function initRizoDungeonArt(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) Object.defineProperty(root, "RizoDungeonArt", { value: api, configurable: true });
})(typeof globalThis !== "undefined" ? globalThis : this, function createRizoDungeonArt() {
  "use strict";
  const TAU = Math.PI * 2;

  // ===== 1. PALETTE =====
  const P = Object.freeze({
    ink: "#15110e", inkSoft: "#2b221c", void: "#060508",
    night: ["#0b0e14", "#141922", "#1e2530", "#2b3440"],
    below: ["#0a0807", "#15110e", "#211a15", "#2e251d"],
    concrete: ["#26282c", "#36393e", "#4b4f55", "#6b6f74"],
    asphalt: ["#0f1217", "#171b22", "#232831"],
    metal: ["#283036", "#3f4b53", "#647480", "#9fadb5"],
    wet: ["#0e141b", "#1a2532", "#2f4255", "#7f98ad"],
    paper: ["#8f8167", "#bfb190", "#e3d8bf", "#f5eedb"],
    cloth: ["#1c1f27", "#2c313d", "#434a5a", "#636c80"],
    wood: ["#2a1a11", "#47301f", "#6a4630", "#8f6544"],
    plaster: ["#29221c", "#3a3028", "#504336", "#6c5d4b"],
    service: ["#1d322e", "#2a463f", "#3d6157", "#5a8578"],
    grass: ["#0f1611", "#162019", "#1f2c22", "#2c3e30"],
    ember: ["#4a1a0c", "#9a3b17", "#e0702a", "#ffaf4a", "#ffe2a0"],
    fluoro: ["#8e9c86", "#c9d6b5", "#eef3dc"],
    sodium: ["#6e4219", "#d38a3a", "#f4c27c"],
    skin: ["#6f4a38", "#a3735a", "#cf9f7d"],
    danger: ["rgba(242,232,206,.5)", "#f2e8ce", "#fff8e6"],
    rain: "rgba(176,196,222,.42)",
    a: Object.freeze({
      brass: "#c48f3e", brassLight: "#ecc77d", tape: "rgba(226,204,124,.82)", stamp: "#b0443a", umbrella: "#2f6fa5", umbrellaLight: "#4f8fc4",
      maroon: "#6a2e35", maroonLight: "#8c3f47", mustard: "#c79f3f", track: "#2f5b40", trackLight: "#447a58", rust: "#7d4127",
      neon: "#ff5a6c", denim: "#2f4863", postal: "#3b4656", postalLight: "#55637a", sock: "#e9e4d6", red: "#b8352f", white: "#e9e4d8"
    })
  });

  // ===== RULES (the numbers the prose above refers to) =====
  const RULES = Object.freeze({
    ink: Object.freeze({ character: 1.6, prop: 1.1, fine: 0.7 }),
    shadow: Object.freeze({ dx: 1.5, dy: 1, alpha: 0.42 }),
    wobble: Object.freeze({ character: 0.45, prop: 0.8, architecture: 0.5 }),
    // Light pools: [radius fraction, darkness removed], outer → inner. `flat`
    // squashes pools into the floor plane.
    light: Object.freeze({ bands: [[1, 0.34], [0.68, 0.42], [0.4, 0.55]], flat: 0.78 }),
    scale: Object.freeze({ rizo: 28, latch: 38, keeper: 94, "hood-tall": 98, "hood-small": 66, "hood-cap": 84, porter: 84, draftling: 20, needle: 30, door: 40 }),
    minDetail: 1.5
  });
  // How far above its feet an actor's head is (speech bubbles, prompts).
  const HEIGHT = Object.freeze({ keeper: 100, "hood-tall": 100, "hood-small": 76, "hood-cap": 88, latch: 42, van: 84, porter: 90, nell: 86, orr: 82 });

  // ===== 6. WOBBLE: seeded, never per frame =====
  function seedOf(value) {
    let hash = 2166136261 >>> 0;
    const text = String(value);
    for (let index = 0; index < text.length; index += 1) { hash ^= text.charCodeAt(index); hash = Math.imul(hash, 16777619); }
    return hash >>> 0;
  }
  function rng(seed) {
    let state = seedOf(seed) || 1;
    return () => {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // A hand-drawn outline through flat [x0,y0,x1,y1,…] points: every vertex is
  // nudged and every long edge bends once, all from the seed.
  function trace(ctx, pts, seed = 0, amp = RULES.wobble.prop, closed = true) {
    const random = rng(seed);
    const jitter = () => (random() - 0.5) * 2 * amp;
    const count = pts.length / 2;
    const xs = [], ys = [];
    for (let index = 0; index < count; index += 1) { xs.push(pts[index * 2] + jitter()); ys.push(pts[index * 2 + 1] + jitter()); }
    ctx.beginPath();
    ctx.moveTo(xs[0], ys[0]);
    const edges = closed ? count : count - 1;
    for (let index = 0; index < edges; index += 1) {
      const a = index, b = (index + 1) % count;
      const dx = xs[b] - xs[a], dy = ys[b] - ys[a], length = Math.hypot(dx, dy) || 1;
      const bend = length > 6 ? jitter() * Math.min(1.4, length / 24) : 0;
      ctx.quadraticCurveTo((xs[a] + xs[b]) / 2 - (dy / length) * bend, (ys[a] + ys[b]) / 2 + (dx / length) * bend, xs[b], ys[b]);
    }
    if (closed) ctx.closePath();
  }
  function inkStroke(ctx, width = RULES.ink.prop, color = P.ink) {
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  }
  // A filled cutout. o: { ink: width|false, seed, amp, inkColor }
  function shape(ctx, pts, fill, o = {}) {
    trace(ctx, pts, o.seed ?? pts[0] * 31 + pts[1], o.amp ?? RULES.wobble.prop, true);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (o.ink !== false) inkStroke(ctx, o.ink ?? RULES.ink.prop, o.inkColor);
  }
  const box = (ctx, x, y, w, h, fill, o = {}) => shape(ctx, [x, y, x + w, y, x + w, y + h, x, y + h], fill, { seed: x * 7 + y * 13 + w, ...o });
  function oval(ctx, x, y, rx, ry, fill, ink = false, width = RULES.ink.prop) {
    ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (ink) inkStroke(ctx, width);
  }
  function line(ctx, x1, y1, x2, y2, color = P.ink, width = RULES.ink.prop, seed = x1 + y2 * 3, amp = 0.35) {
    trace(ctx, [x1, y1, x2, y2], seed, amp, false);
    inkStroke(ctx, width, color);
  }
  function rect(ctx, color, x, y, w, h) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }
  // 4. A flat contact shadow, offset down-right from the feet.
  function drop(ctx, x, y, rx, ry = rx * 0.32, alpha = RULES.shadow.alpha) {
    ctx.save(); ctx.globalAlpha = alpha;
    oval(ctx, x + RULES.shadow.dx, y + RULES.shadow.dy, rx, ry, P.ink);
    ctx.restore();
  }

  // ===== DETAILS (human evidence) =====
  // A strip of tape with torn ends: the Rizo world's favourite repair.
  function tape(ctx, x, y, length, angle = 0, seed = x + y) {
    const random = rng(`tape${seed}`);
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    const h = 3.2, half = length / 2;
    ctx.beginPath(); ctx.moveTo(-half, -h / 2);
    ctx.lineTo(half, -h / 2);
    for (let step = 0; step <= 3; step += 1) ctx.lineTo(half + (step % 2 ? 1.2 : 0) + random() * 0.6, -h / 2 + (h * step) / 3);
    ctx.lineTo(-half, h / 2);
    for (let step = 3; step >= 0; step -= 1) ctx.lineTo(-half - (step % 2 ? 1.2 : 0) - random() * 0.6, -h / 2 + (h * step) / 3);
    ctx.closePath();
    ctx.fillStyle = P.a.tape; ctx.fill();
    ctx.globalAlpha = 0.35; rect(ctx, "#fff6d0", -half, -h / 2, length, 0.8);
    ctx.restore();
  }
  // Cross-stitches along a seam.
  function stitches(ctx, x1, y1, x2, y2, color = P.ink, gap = 3.2, size = 1.6, width = 0.8) {
    const length = Math.hypot(x2 - x1, y2 - y1); if (!length) return;
    const ux = (x2 - x1) / length, uy = (y2 - y1) / length, px = -uy * size, py = ux * size;
    ctx.beginPath();
    for (let d = gap / 2; d < length; d += gap) { const cx = x1 + ux * d, cy = y1 + uy * d; ctx.moveTo(cx - px, cy - py); ctx.lineTo(cx + px, cy + py); }
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = "round"; ctx.stroke();
  }
  function rivet(ctx, x, y, r = 1.1) { oval(ctx, x, y, r, r, P.metal[3]); oval(ctx, x + 0.35, y + 0.35, r * 0.45, r * 0.45, P.ink); }
  // Where somebody stood, or walked, for years: a polished patch of the floor's light band.
  function worn(ctx, x, y, rx, ry, color, alpha = 0.5) { ctx.save(); ctx.globalAlpha = alpha; oval(ctx, x, y, rx, ry, color); ctx.globalAlpha = alpha * 0.6; oval(ctx, x - rx * 0.15, y - ry * 0.1, rx * 0.6, ry * 0.55, color); ctx.restore(); }
  // Hand-lettered sign text: each letter seated a little differently.
  function label(ctx, text, x, y, o = {}) {
    const size = o.size || 7, random = rng(`label${text}${x}`);
    ctx.save(); ctx.translate(x, y); ctx.rotate(o.angle || 0);
    ctx.font = `${o.weight || 800} ${size}px ${o.font || "Inter, system-ui, sans-serif"}`;
    ctx.textBaseline = "alphabetic";
    const chars = [...String(text)];
    const widths = chars.map(char => ctx.measureText(char).width + (o.spacing ?? size * 0.08));
    const total = widths.reduce((sum, w) => sum + w, 0);
    let cx = o.align === "left" ? 0 : -total / 2;
    for (let index = 0; index < chars.length; index += 1) {
      const dy = (random() - 0.5) * (o.jitter ?? size * 0.12);
      if (o.shadow) { ctx.fillStyle = o.shadow; ctx.fillText(chars[index], cx + 0.6, dy + 0.6); }
      ctx.fillStyle = o.color || P.paper[3]; ctx.fillText(chars[index], cx, dy);
      cx += widths[index];
    }
    ctx.restore();
  }

  // ===== MATERIALS (for cached static layers; they may afford detail) =====
  function clip(ctx, x, y, w, h, fn) { ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); fn(); ctx.restore(); }
  // Concrete slabs: joints, one stained slab, one newer replaced slab, sparse aggregate.
  function concrete(ctx, x, y, w, h, seed, o = {}) {
    const tone = o.tone || P.concrete, joint = o.joint || 40, random = rng(`concrete${seed}`);
    clip(ctx, x, y, w, h, () => {
      rect(ctx, tone[1], x, y, w, h);
      for (let sy = y; sy < y + h; sy += joint) for (let sx = x; sx < x + w; sx += joint) {
        const roll = random();
        if (roll < 0.14) rect(ctx, tone[0], sx + 1, sy + 1, joint - 1, joint - 1);
        else if (roll > 0.95) { ctx.globalAlpha = 0.45; rect(ctx, tone[2], sx + 1, sy + 1, joint - 1, joint - 1); ctx.globalAlpha = 1; }
        if (random() < 0.35) { ctx.save(); ctx.globalAlpha = 0.5; line(ctx, sx + random() * joint, sy + random() * joint, sx + random() * joint, sy + random() * joint, tone[0], 0.6, sx + sy, 1.2); ctx.restore(); }
      }
      ctx.globalAlpha = 0.55;
      for (let sy = y; sy <= y + h; sy += joint) line(ctx, x, sy, x + w, sy, P.inkSoft, 0.9, sy, 0.5);
      for (let sx = x; sx <= x + w; sx += joint) line(ctx, sx, y, sx, y + h, P.inkSoft, 0.9, sx * 3, 0.5);
      ctx.globalAlpha = 1;
      const flecks = Math.round((w * h) / 260);
      for (let index = 0; index < flecks; index += 1) rect(ctx, random() < 0.5 ? tone[2] : tone[0], x + random() * w, y + random() * h, 1, 1);
      if (o.wet) {
        for (let index = 0; index < Math.round((w * h) / 2600); index += 1) {
          const px = x + random() * w, py = y + random() * h, rx = 8 + random() * 16;
          ctx.globalAlpha = 0.55; oval(ctx, px, py, rx, rx * 0.3, P.wet[1]);
          ctx.globalAlpha = 0.35; oval(ctx, px - rx * 0.2, py - 0.6, rx * 0.5, 0.8, P.wet[2]);
          ctx.globalAlpha = 1;
        }
      }
    });
  }
  // Asphalt: old tar-snake crack seals and patches, a few flecks, wet sheen.
  function asphalt(ctx, x, y, w, h, seed, o = {}) {
    const random = rng(`asphalt${seed}`);
    clip(ctx, x, y, w, h, () => {
      rect(ctx, P.asphalt[1], x, y, w, h);
      for (let index = 0; index < Math.max(1, Math.round((w * h) / 9000)); index += 1) {
        const px = x + random() * w, py = y + random() * h, pw = 18 + random() * 40, ph = 10 + random() * 26;
        box(ctx, px, py, pw, ph, P.asphalt[0], { ink: false, amp: 2 });
      }
      ctx.globalAlpha = 0.9;
      for (let index = 0; index < Math.round((w * h) / 5000); index += 1) {
        let px = x + random() * w, py = y + random() * h; const pts = [px, py];
        for (let step = 0; step < 4; step += 1) { px += (random() - 0.5) * 22; py += (random() - 0.2) * 18; pts.push(px, py); }
        trace(ctx, pts, px, 1.2, false); inkStroke(ctx, 1.4, "#0a0c10");
      }
      ctx.globalAlpha = 1;
      for (let index = 0; index < Math.round((w * h) / 140); index += 1) rect(ctx, P.asphalt[2], x + random() * w, y + random() * h, 1, 1);
      if (o.wet !== false) for (let index = 0; index < Math.round((w * h) / 3000); index += 1) {
        const px = x + random() * w, py = y + random() * h, rx = 10 + random() * 24;
        ctx.globalAlpha = 0.5; oval(ctx, px, py, rx, rx * 0.25, P.wet[1]); ctx.globalAlpha = 1;
      }
    });
  }
  // Worn tiles: two close values (simple far away), thin grout, a rare crack
  // or missing tile (obsessive up close). Never a loud checkerboard.
  function tiles(ctx, x, y, w, h, seed, o = {}) {
    const size = o.size || 16, colors = o.colors || [P.below[2], P.below[3]], random = rng(`tiles${seed}`);
    clip(ctx, x, y, w, h, () => {
      rect(ctx, o.grout || P.below[1], x, y, w, h);
      for (let ty = y, row = 0; ty < y + h; ty += size, row += 1) for (let tx = x, col = 0; tx < x + w; tx += size, col += 1) {
        const roll = random();
        if (roll < 0.015) continue; // missing
        rect(ctx, o.check ? colors[(row + col) % 2] : colors[roll < 0.82 ? 0 : 1], tx + 0.6, ty + 0.6, size - 1.2, size - 1.2);
        if (roll > 0.975) line(ctx, tx + 2, ty + 2 + random() * 6, tx + size - 2, ty + size - 3, o.grout || P.below[1], 0.7, tx + ty, 1.2);
      }
    });
  }
  // Floor planks, staggered, with nail heads and one darker replaced board.
  function planks(ctx, x, y, w, h, seed, o = {}) {
    const tone = o.tone || P.wood, height = o.board || 12, random = rng(`planks${seed}`);
    clip(ctx, x, y, w, h, () => {
      rect(ctx, tone[0], x, y, w, h);
      for (let py = y, row = 0; py < y + h; py += height, row += 1) {
        let px = x - random() * 40;
        while (px < x + w) {
          const length = 40 + random() * 50, roll = random();
          rect(ctx, roll < 0.6 ? tone[1] : roll > 0.96 ? tone[3] : tone[2], px + 0.6, py + 0.6, length - 1.2, height - 1.2);
          rect(ctx, tone[0], px + 0.6, py + height - 2, length - 1.2, 1.4);
          ctx.globalAlpha = 0.3; rect(ctx, tone[3], px + 0.6, py + 0.6, length - 1.2, 0.8); ctx.globalAlpha = 1;
          rect(ctx, P.ink, px + 2.5, py + height / 2 - 0.6, 1.2, 1.2); rect(ctx, P.ink, px + length - 3.7, py + height / 2 - 0.6, 1.2, 1.2);
          px += length;
        }
      }
    });
  }
  // A wall seen from the front: plaster above an old painted dado, a
  // baseboard, and chipped paint where hands and carts have rubbed it.
  function wallFace(ctx, x, y, w, h, seed, o = {}) {
    const upper = o.upper || P.plaster, lower = o.lower || P.service, random = rng(`wall${seed}`);
    clip(ctx, x, y, w, h, () => {
      const dado = y + h * (o.dado ?? 0.45);
      rect(ctx, upper[1], x, y, w, dado - y);
      rect(ctx, upper[2], x, y, w, 1.6);
      rect(ctx, lower[1], x, dado, w, y + h - dado);
      rect(ctx, lower[2], x, dado, w, 1.4);
      rect(ctx, P.ink, x, dado + 1.4, w, 0.8);
      rect(ctx, lower[0], x, y + h - 2.6, w, 2.6);
      for (let index = 0; index < Math.max(1, Math.round(w / 34)); index += 1) {
        const cx = x + random() * w, cy = dado + 2 + random() * Math.max(1, y + h - dado - 6);
        box(ctx, cx, cy, 2 + random() * 5, 1.5 + random() * 2.5, upper[3], { ink: false, amp: 0.6 });
      }
      if (o.brick) for (let by = y + 2, row = 0; by < dado - 2; by += 5, row += 1) for (let bx = x + (row % 2) * 5; bx < x + w; bx += 10) if (random() < 0.12) box(ctx, bx, by, 9, 4, upper[0], { ink: false, amp: 0.3 });
    });
  }
  // An architectural block in 3/4: a dark cap, a lit front face if its south
  // side meets the floor, and the shadow band it casts below.
  function block(ctx, x, y, w, h, o = {}) {
    const face = o.face ?? Math.min(h, 13);
    rect(ctx, o.cap || P.below[0], x, y, w, h);
    if (o.showFace) {
      const fy = y + h - face;
      if (o.paint) o.paint(x, fy, w, face); else wallFace(ctx, x, fy, w, face, x * 3 + y, o);
      ctx.globalAlpha = 0.7; rect(ctx, P.ink, x, fy - 0.8, w, 1); ctx.globalAlpha = 1;
      if (o.castShadow !== false) { ctx.globalAlpha = 0.32; rect(ctx, P.ink, x, y + h, w, 4); ctx.globalAlpha = 0.18; rect(ctx, P.ink, x, y + h + 4, w, 4); ctx.globalAlpha = 1; }
    }
    if (o.edge) { ctx.globalAlpha = 0.5; rect(ctx, o.edge, x, y, w, 1); ctx.globalAlpha = 1; }
  }
  function metalPanel(ctx, x, y, w, h, seed, tone = P.metal) {
    const random = rng(`metal${seed}`);
    box(ctx, x, y, w, h, tone[1], { seed, amp: 0.3 });
    rect(ctx, tone[2], x + 1.2, y + 1.2, w - 2.4, 1.2);
    rect(ctx, tone[0], x + 1.2, y + h - 2.4, w - 2.4, 1.2);
    rivet(ctx, x + 2.6, y + 2.6); rivet(ctx, x + w - 2.6, y + 2.6); rivet(ctx, x + 2.6, y + h - 2.6); rivet(ctx, x + w - 2.6, y + h - 2.6);
    if (random() < 0.6) { ctx.globalAlpha = 0.6; rect(ctx, P.a.rust, x + 3 + random() * (w - 8), y + h * 0.4, 1.4, h * 0.5); ctx.globalAlpha = 1; }
  }

  // ===== 5. LIGHT =====
  // A low-resolution darkness buffer with stepped holes, scaled over the frame.
  function createLighting(doc) {
    const RES = 0.5, PAD = 24;
    let canvas = null, lc = null;
    function apply(ctx, view, ambient, lights) {
      if (!doc?.createElement) return;
      const w = Math.max(2, Math.ceil((view.w + PAD * 2) * RES)), h = Math.max(2, Math.ceil((view.h + PAD * 2) * RES));
      if (!canvas) { canvas = doc.createElement("canvas"); lc = canvas.getContext("2d"); }
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      lc.setTransform(1, 0, 0, 1, 0, 0);
      lc.globalCompositeOperation = "source-over";
      lc.clearRect(0, 0, w, h);
      lc.fillStyle = `rgba(${ambient.color.join(",")},${ambient.alpha})`;
      lc.fillRect(0, 0, w, h);
      lc.globalCompositeOperation = "destination-out";
      for (const light of lights) {
        const cx = (light.x - view.x + PAD) * RES, cy = (light.y - view.y + PAD) * RES, flat = light.flat ?? RULES.light.flat;
        for (const [k, a] of RULES.light.bands) {
          lc.fillStyle = `rgba(0,0,0,${Math.min(1, a * (light.strength ?? 1))})`;
          lc.beginPath();
          // A cone (a flashlight): a wedge from its source instead of a pool.
          if (light.cone) { lc.moveTo(cx, cy); lc.arc(cx, cy, light.r * Math.min(1, k + 0.25) * RES, light.cone.angle - light.cone.half * (0.4 + 0.6 * k), light.cone.angle + light.cone.half * (0.4 + 0.6 * k)); lc.closePath(); }
          else lc.ellipse(cx, cy, light.r * k * RES, light.r * k * RES * flat, 0, 0, TAU);
          lc.fill();
        }
      }
      lc.globalCompositeOperation = "source-over";
      // Shadow that light does not fully reach (the ditch, behind a post).
      for (const shade of ambient.shades || []) {
        lc.fillStyle = `rgba(${ambient.color.join(",")},${shade.alpha ?? 0.3})`;
        lc.fillRect((shade.x - view.x + PAD) * RES, (shade.y - view.y + PAD) * RES, shade.w * RES, shade.h * RES);
      }
      ctx.drawImage(canvas, view.x - PAD, view.y - PAD, view.w + PAD * 2, view.h + PAD * 2);
      // Warm light tints what it reaches, in the same three bands.
      ctx.save();
      ctx.globalCompositeOperation = "soft-light";
      for (const light of lights) {
        if (!light.warm) continue;
        const flat = light.flat ?? RULES.light.flat;
        for (const [k, a] of RULES.light.bands) {
          ctx.fillStyle = `rgba(255,140,56,${a * 0.42 * light.warm})`;
          ctx.beginPath(); ctx.ellipse(light.x, light.y, light.r * k * 0.86, light.r * k * 0.86 * flat, 0, 0, TAU); ctx.fill();
        }
      }
      ctx.restore();
    }
    return { apply };
  }

  // ===== FIRE (the only thing that moves on its own) =====
  // One authored flame: three nested tongues (ember bands), flicker by time.
  function flame(ctx, x, y, size, t, o = {}) {
    const flick = o.still ? 0 : Math.sin(t / 90) * 0.7 + Math.sin(t / 37 + 1.3) * 0.45;
    const sway = o.still ? 0 : Math.sin(t / 140) * 0.18;
    const tongue = (s, color, lean) => {
      const h = s * (1.55 + flick * 0.06), w = s * 0.62;
      ctx.beginPath();
      ctx.moveTo(x - w, y);
      ctx.quadraticCurveTo(x - w * 1.05, y - h * 0.45, x - w * 0.2 + lean * s, y - h * 0.7);
      ctx.quadraticCurveTo(x + lean * s * 1.6, y - h * 0.85, x + lean * s * 2.2, y - h);
      ctx.quadraticCurveTo(x + w * 0.5 + lean * s, y - h * 0.55, x + w * 0.95, y - h * 0.3);
      ctx.quadraticCurveTo(x + w * 1.08, y - h * 0.08, x + w * 0.8, y);
      ctx.closePath(); ctx.fillStyle = color; ctx.fill();
    };
    tongue(size, P.ember[2], sway);
    tongue(size * 0.72, P.ember[3], sway * 1.3);
    tongue(size * 0.4, P.ember[4], sway * 1.6);
    if (o.ink) { ctx.globalAlpha = 0.85; inkStroke(ctx, 0.8); ctx.globalAlpha = 1; }
  }
  // The hearth: a stone ring on a slab, split logs, a kettle kept beside it.
  function hearth(ctx, x, y, r, t, lit, o = {}) {
    drop(ctx, x, y + r * 0.7 + 2, r + 8, (r + 8) * 0.38, 0.5);
    oval(ctx, x, y + 3, r + 7, (r + 7) * 0.62, P.concrete[0], true, 1);
    const random = rng("hearth-stones");
    for (let index = 0; index < 11; index += 1) {
      const a = (index / 11) * TAU + random() * 0.2, sx = x + Math.cos(a) * (r + 3.5), sy = y + 3 + Math.sin(a) * (r + 3.5) * 0.62;
      shape(ctx, [sx - 3, sy, sx - 1, sy - 2.6, sx + 2.4, sy - 2.2, sx + 3, sy + 1.2, sx - 1, sy + 2.2], random() < 0.5 ? P.concrete[2] : P.concrete[3], { ink: 0.9, seed: index + 3, amp: 0.4 });
    }
    oval(ctx, x, y + 3, r, r * 0.55, lit ? P.ember[0] : P.below[1]);
    // Two split logs, crossed.
    ctx.save(); ctx.translate(x, y + 3);
    for (const [angle, len] of [[-0.35, r * 1.5], [0.4, r * 1.3]]) {
      ctx.save(); ctx.rotate(angle);
      box(ctx, -len / 2, -2.2, len, 4.4, P.wood[2], { ink: 1, seed: angle * 10, amp: 0.3 });
      rect(ctx, P.wood[3], -len / 2 + 1, -2, len - 2, 1); oval(ctx, len / 2 - 0.4, 0, 1.4, 2.2, lit ? P.ember[3] : P.wood[3]);
      ctx.restore();
    }
    ctx.restore();
    if (lit) {
      const size = r * (o.size || 0.95);
      flame(ctx, x - r * 0.25, y + 2, size * 0.72, t + 400);
      flame(ctx, x + r * 0.2, y + 3, size, t);
      // Embers: two stepped dots rising (deterministic per time).
      for (let index = 0; index < 3; index += 1) {
        const k = ((t / 1400) + index / 3) % 1;
        ctx.globalAlpha = 1 - k; rect(ctx, P.ember[3], x + Math.sin(index * 2.1 + k * 4) * 6, y - r - k * 26, 1.2, 1.2); ctx.globalAlpha = 1;
      }
    } else {
      // Cold: grey ash and one stubborn coal.
      ctx.globalAlpha = 0.8; oval(ctx, x, y + 3, r * 0.7, r * 0.3, P.concrete[2]); ctx.globalAlpha = 1;
      oval(ctx, x + 1, y + 3, 1.4, 1, P.ember[1 + (Math.sin(t / 700) > 0.6 ? 1 : 0)]);
    }
  }

  // ===== CHARACTERS (feet at x,y; face 1 = facing right) =====
  // Every character: a drop shadow, ink at RULES.ink.character, 2–3 value
  // bands, one asymmetry, one detail that is only theirs.
  const CH = RULES.ink.character, CA = RULES.wobble.character;
  const legs = (ctx, x, y, top, spread, width, color, bob, shoe, sock) => {
    for (const side of [-1, 1]) {
      const lift = side === -1 ? bob : -bob;
      box(ctx, x + side * spread - width / 2, top - lift * 0.4, width, y - top - 2, color, { ink: 1.1, amp: 0.2, seed: side + top });
      if (sock) rect(ctx, sock, x + side * spread - width / 2 + 0.4, y - 5 - lift * 0.4, width - 0.8, 2.2);
      oval(ctx, x + side * spread + 1.2, y - 1.4 - Math.max(0, lift) * 0.6, width * 0.75 + 0.6, 2, shoe, true, 1);
    }
  };

  // YOU: the person who said "Be good." Never a face: a long coat and the blue umbrella.
  function keeper(ctx, x, y, o = {}) {
    const bob = o.bob || 0, t = o.t || 0, state = o.state || "idle";
    drop(ctx, x, y, 14, 3.6);
    ctx.save(); ctx.translate(x, y); ctx.scale(o.face || 1, 1);
    if (state === "look-back") ctx.rotate(-0.055);
    legs(ctx, 0, 0, -34, 3.2, 5, P.a.denim, bob, P.ink);
    // Coat: long, camel, one pocket flap; the back half falls into the dark band.
    shape(ctx, [-11, -76, 10, -76, 14, -30, -14, -29], P.wood[2], { ink: CH, seed: 11, amp: CA });
    shape(ctx, [-11, -74, -3, -74, -6, -30, -14, -30], P.wood[1], { ink: false, seed: 12, amp: CA });
    line(ctx, 2, -72, 4, -31, P.inkSoft, 0.9);
    box(ctx, 5, -50, 6, 2.4, P.wood[1], { ink: 0.8, amp: 0.2 });
    rect(ctx, P.wood[3], -8, -76, 16, 1.6);
    // Scarf and chin, the umbrella's shadow over everything above it.
    shape(ctx, [-6, -80, 6, -80, 7, -74, -7, -74], P.a.maroon, { ink: 1.1, seed: 13, amp: 0.3 });
    oval(ctx, 1, -83, 5.5, 4.5, P.skin[1], true, 1.1);
    ctx.globalAlpha = 0.55; oval(ctx, 1, -85, 6, 3, P.ink); ctx.globalAlpha = 1;
    // Arm up to the shaft. The free arm carries the tiny acting beats: a
    // glance back toward the car, then a hand toward the store door.
    shape(ctx, [5, -74, 10, -72, 9, -60, 4, -61], P.wood[2], { ink: 1.2, seed: 14, amp: 0.3 });
    oval(ctx, 7, -60, 2.2, 2, P.skin[1], true, 0.9);
    line(ctx, 7, -60, 4, -96, P.ink, 1.3, 15, 0.1);
    if (state === "look-back") {
      shape(ctx, [-7, -72, -11, -69, -19, -61, -16, -58], P.wood[2], { ink: 1.1, seed: 141, amp: 0.25 });
      oval(ctx, -19, -60, 2.2, 2, P.skin[1], true, 0.8);
    } else if (state === "door") {
      shape(ctx, [-6, -73, -10, -70, -15, -79, -11, -81], P.wood[2], { ink: 1.1, seed: 142, amp: 0.25 });
      oval(ctx, -14, -80, 2.2, 2, P.skin[1], true, 0.8);
    }
    // The umbrella: eight panels, a lit top band, a bent rib (it has been through weather before).
    const canopy = [-24, -90, -18, -97, -9, -102, 4, -104, 16, -101, 26, -95, 30, -89];
    const rim = [30, -89, 25, -91, 20, -88, 14, -91, 8, -88, 2, -91, -4, -88, -10, -91, -16, -88, -21, -91, -24, -90];
    shape(ctx, [...canopy, ...rim.slice(2)], P.a.umbrella, { ink: CH, seed: 16, amp: 0.3 });
    shape(ctx, [-18, -97, -9, -102, 4, -104, 16, -101, 12, -98, 2, -100, -8, -98], P.a.umbrellaLight, { ink: false, seed: 17, amp: 0.3 });
    for (const rx of [-10, 2, 14]) line(ctx, 4, -104, rx, -89, P.ink, 0.7, rx, 0.3);
    line(ctx, 4, -104, 24, -93, P.ink, 0.7, 99, 0.9);
    line(ctx, 4, -104, 4, -108, P.ink, 1.4);
    // Drops rolling off the rim (time-based, not random).
    for (let index = 0; index < 3; index += 1) {
      const k = ((t / 700) + index * 0.37) % 1, dx = [-22, 28, 9][index];
      ctx.globalAlpha = 0.8 * (1 - k); rect(ctx, P.wet[3], dx, -88 + k * 14, 0.9, 2.2); ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  // The van: a dented people-carrier with a primer-grey door somebody swapped in.
  function van(ctx, x, y, o = {}) {
    drop(ctx, x, y + 2, 78, 7, 0.55);
    ctx.save(); ctx.translate(x, y);
    // Drawn nose-left; face 1 turns it to drive right.
    if (o.face === 1) ctx.scale(-1, 1);
    const body = [-76, -8, -76, -40, -64, -46, -42, -70, 62, -72, 72, -66, 74, -8];
    shape(ctx, body, P.paper[1], { ink: CH, seed: 21, amp: 0.4 });
    shape(ctx, [-72, -22, 72, -22, 73, -8, -75, -8], P.paper[0], { ink: false, seed: 22, amp: 0.3 });
    rect(ctx, P.paper[2], -40, -69, 100, 2);
    // The swapped door, in primer, with tape on its handle.
    box(ctx, -4, -62, 34, 52, P.concrete[2], { ink: 1.2, seed: 23, amp: 0.3 });
    tape(ctx, 22, -38, 7, 0.1, 5);
    // Windows: tinted, wet, a streak of the store's light.
    shape(ctx, [-60, -44, -44, -64, -10, -64, -10, -44], P.wet[1], { ink: 1.2, seed: 24, amp: 0.3 });
    shape(ctx, [-4, -60, 28, -60, 28, -46, -4, -46], P.wet[1], { ink: 1.1, seed: 25, amp: 0.3 });
    shape(ctx, [34, -64, 64, -64, 66, -46, 34, -46], P.wet[1], { ink: 1.1, seed: 26, amp: 0.3 });
    ctx.globalAlpha = 0.5; line(ctx, -40, -62, -50, -46, P.fluoro[1], 1.2); line(ctx, 40, -62, 36, -48, P.fluoro[1], 1); ctx.globalAlpha = 1;
    // Rust, a sticker, lights.
    ctx.globalAlpha = 0.85; box(ctx, -70, -20, 8, 5, P.a.rust, { ink: false, amp: 1 }); box(ctx, 58, -16, 6, 6, P.a.rust, { ink: false, amp: 1 }); ctx.globalAlpha = 1;
    box(ctx, 44, -34, 10, 6, P.a.mustard, { ink: 0.8, amp: 0.3 });
    box(ctx, -77, -34, 4, 8, o.lights ? P.fluoro[2] : P.paper[2], { ink: 1, amp: 0.2 });
    box(ctx, 71, -36, 3.5, 9, P.a.red, { ink: 1, amp: 0.2 });
    // Wheels (one hubcap missing).
    for (const [wx, cap] of [[-50, true], [48, false]]) {
      oval(ctx, wx, -7, 10, 10, P.ink);
      oval(ctx, wx, -7, 5.5, 5.5, cap ? P.metal[2] : P.metal[0], true, 1);
      if (!cap) for (let index = 0; index < 4; index += 1) rivet(ctx, wx + Math.cos(index * 1.57) * 3, -7 + Math.sin(index * 1.57) * 3, 0.8);
    }
    ctx.restore();
  }

  // The three. Not ninjas: a tall one in slides and socks, a small one filming
  // on his phone, a wide one with a pillowcase. You know them by shape.
  function hood(ctx, kind, x, y, o = {}) {
    const bob = o.bob || 0, t = o.t || 0, grab = o.state === "grab";
    ctx.save(); ctx.translate(x, y);
    if (o.flinch) ctx.rotate(-0.14 * (o.face || 1));
    ctx.scale(o.face || 1, 1);
    if (kind === "hood-tall") {
      drop(ctx, 0, 0, 12, 3.4);
      // Slides and socks; sweatpants a size too short.
      legs(ctx, 0, 0, -44, 3.4, 5.2, P.cloth[1], bob, P.ink, P.a.sock);
      ctx.save(); ctx.rotate(0.07);
      shape(ctx, [-12, -88, 9, -88, 12, -42, -13, -42], P.cloth[2], { ink: CH, seed: 31, amp: CA });
      shape(ctx, [-12, -86, -4, -87, -7, -42, -13, -42], P.cloth[1], { ink: false, seed: 32, amp: CA });
      // Kangaroo pocket with both hands in it; a faded print.
      box(ctx, -7, -58, 15, 9, P.cloth[1], { ink: 1, amp: 0.3 });
      ctx.globalAlpha = 0.55; oval(ctx, 1, -72, 5, 4, P.cloth[3]); ctx.globalAlpha = 1;
      if (grab) shape(ctx, [8, -80, 14, -78, 22, -62, 18, -60], P.cloth[2], { ink: 1.3, seed: 33, amp: 0.3 });
      // Hood up, peak drooping forward over a ski mask; uneven drawstrings.
      shape(ctx, [-11, -88, -12, -100, -4, -108, 6, -107, 13, -100, 12, -88], P.cloth[2], { ink: CH, seed: 34, amp: CA });
      oval(ctx, 4, -96, 6.5, 6, P.ink);
      rect(ctx, P.cloth[0], -1, -99, 10, 3.6);
      line(ctx, 1, -97.4, 3.4, -97.6, P.paper[2], 1.1); line(ctx, 5.4, -97.6, 7.8, -97.2, P.paper[2], 1.1);
      line(ctx, 0, -88, -1, -78, P.paper[2], 0.8); line(ctx, 5, -88, 6, -82, P.paper[2], 0.8);
      ctx.restore();
    } else if (kind === "hood-small") {
      drop(ctx, 0, 0, 11, 3.4);
      legs(ctx, 0, 0, -26, 3.6, 5.4, P.cloth[1], bob, P.a.white);
      // Puffer jacket: three quilted bands, the top one lit.
      shape(ctx, [-13, -56, 12, -56, 14, -26, -14, -26], P.a.maroon, { ink: CH, seed: 41, amp: CA });
      rect(ctx, P.a.maroonLight, -11, -55, 22, 3);
      for (const qy of [-46, -36]) line(ctx, -13, qy, 13, qy + 0.6, P.ink, 0.9, qy);
      // Arm up, holding the phone out, filming. The screen is a light.
      shape(ctx, [6, -50, 12, -52, 18, -44, 14, -41], P.a.maroon, { ink: 1.2, seed: 42, amp: 0.3 });
      box(ctx, 15, -54, 5, 8, P.ink, { ink: 1, amp: 0.1 });
      rect(ctx, o.phoneOff ? P.cloth[2] : P.fluoro[2], 16, -53, 3, 6);
      // Beanie with a fold and a pom; the mask's eye slot is on crooked.
      oval(ctx, 0, -63, 9.5, 8, P.ink);
      ctx.save(); ctx.rotate(-0.12); rect(ctx, P.cloth[0], -6, -65, 13, 4); ctx.restore();
      oval(ctx, -2.5, -64.6, 1.4, 1.4, P.paper[3]); oval(ctx, 3, -65.4, 1.4, 1.4, P.paper[3]);
      shape(ctx, [-9.5, -66, -8, -74, 0, -77, 8, -74, 9.5, -66], P.a.mustard, { ink: 1.3, seed: 43, amp: 0.3 });
      rect(ctx, P.ink, -9, -68, 18, 0.8);
      oval(ctx, 1, -78.5, 2.6, 2.4, P.a.mustard, true, 1);
    } else {
      // The wide one: track jacket with a stripe, backwards cap over the hood,
      // a pillowcase over one shoulder for what they came to take.
      drop(ctx, 0, 0, 14, 3.8);
      legs(ctx, 0, 0, -36, 4.6, 6.4, P.cloth[0], bob, P.ink);
      shape(ctx, [-16, -74, 15, -74, 15, -35, -16, -35], P.a.track, { ink: CH, seed: 51, amp: CA });
      shape(ctx, [-16, -72, -8, -73, -9, -35, -16, -35], "#24472f", { ink: false, seed: 52, amp: CA });
      rect(ctx, P.a.white, 12, -72, 2, 30);
      line(ctx, 0, -74, 0, -36, P.ink, 0.9);
      // The pillowcase.
      if (!grab) {
        shape(ctx, [-14, -76, -24, -70, -28, -52, -22, -44, -14, -50], P.a.white, { ink: 1.3, seed: 53, amp: 0.6 });
        rect(ctx, P.a.denim, -26, -60, 10, 2);
      } else {
        shape(ctx, [10, -66, 26, -58, 30, -40, 18, -38], P.a.white, { ink: 1.3, seed: 54, amp: 0.6 });
      }
      // Head: hood under a backwards cap, bandana over the face.
      oval(ctx, 0, -83, 9, 8.5, P.cloth[1], true, CH);
      shape(ctx, [-8, -82, 8, -82, 6, -75, -6, -75], P.a.red, { ink: 1, seed: 55, amp: 0.3 });
      oval(ctx, -2.6, -85, 1.3, 1, P.paper[3]); oval(ctx, 2.8, -85, 1.3, 1, P.paper[3]);
      shape(ctx, [-8, -88, -6, -94, 6, -94, 8, -88], P.cloth[0], { ink: 1.2, seed: 56, amp: 0.3 });
      box(ctx, -15, -90, 8, 3, P.cloth[0], { ink: 1, amp: 0.2 });
    }
    ctx.restore();
  }
  // YOU in the driver's seat, seen from above with the roof cut away: the
  // back of a head, the camel coat's shoulders, hands at the wheel. Never a face.
  // States: reach (a hand toward him), keys / pocket, turn / look (head toward
  // him or the rain), look-back (over the shoulder), reach-up (the dome light).
  function youSeated(ctx, x, y, o = {}) {
    const state = o.state || "idle", t = o.t || 0;
    const breathe = Math.sin(t / 900) * 0.35;
    drop(ctx, x, y + 12, 16, 5, 0.3);
    // "turn" (to him: "Off the dash, please." / "Okay, show-off."): the whole
    // body turns toward the passenger seat, one hand up off the wheel.
    // "look" ("It's just rain."): the body stays put; the head lifts to the
    // glass and one hand opens toward the rain on it.
    const twist = state === "turn" ? 0.34 : 0;
    const cos = Math.cos(twist), sin = Math.sin(twist);
    const at = (dx, dy) => [x + dx * cos - dy * sin, y + 2 + dx * sin + dy * cos];
    // Arms forward to the wheel, or reaching: drawn first, under the shoulders.
    const handR = state === "reach" ? [x + 27, y - 2] : state === "keys" ? [x + 15, y - 16] : state === "pocket" ? [x + 12, y + 5] : state === "reach-up" ? [x + 19, y + 13] : state === "turn" ? [x + 23, y - 19] : state === "look" ? [x + 6, y - 37] : [x + 8, y - 27];
    const handL = state === "look-back" ? [x - 13, y - 6] : [x - 8, y - 27];
    const [lsx, lsy] = at(-11, -3), [rsx, rsy] = at(11, -3);
    for (const [hx, hy, sx, sy] of [[handL[0], handL[1], lsx, lsy], [handR[0], handR[1], rsx, rsy]]) {
      line(ctx, sx, sy, hx, hy, P.ink, 6.4, hx, 0.1); line(ctx, sx, sy, hx, hy, P.wood[2], 4.4, hx, 0.1);
      oval(ctx, hx, hy, 2.6, 2.4, P.skin[1], true, 1);
    }
    if (state === "keys") { rect(ctx, P.metal[3], handR[0] + 1, handR[1] - 4, 2, 4); rect(ctx, P.a.brass, handR[0] - 2, handR[1] - 5, 2.4, 2.4); }
    if (state === "pocket") { rect(ctx, P.metal[3], x + 13, y + 1, 1.4, 3); oval(ctx, x + 12.4, y + 0.5, 1.5, 1.5, P.a.brass, true, 0.6); }
    // An open palm (the rain) or one raised finger (the dash): fingers out of the hand.
    if (state === "look") for (let f = -2; f <= 2; f += 2) line(ctx, handR[0] + f, handR[1] - 1, handR[0] + f * 1.4, handR[1] - 5, P.skin[1], 1.3, f, 0);
    if (state === "turn") { line(ctx, handR[0], handR[1] - 1, handR[0] + 1, handR[1] - 7, P.ink, 2.6, 3, 0); line(ctx, handR[0], handR[1] - 1, handR[0] + 1, handR[1] - 7, P.skin[1], 1.3, 3, 0); }
    // The camel coat's shoulders from above, the scarf ring, the back of the head.
    ctx.save(); ctx.translate(x, y + 2); ctx.rotate(twist); ctx.translate(-x, -y - 2);
    shape(ctx, [x - 15, y + 2, x - 12, y - 6, x - 5, y - 9, x + 5, y - 9, x + 12, y - 6, x + 15, y + 2, x + 12, y + 12, x - 12, y + 12], P.wood[2], { ink: CH, seed: 61, amp: CA });
    shape(ctx, [x - 15, y + 2, x - 12, y - 6, x - 5, y - 9, x - 3, y + 12, x - 12, y + 12], P.wood[1], { ink: false, seed: 62, amp: CA });
    rect(ctx, P.wood[3], x - 9, y - 8, 18, 1.4);
    oval(ctx, x, y - 6 + breathe * 0.2, 7.4, 4.6, P.a.maroon, true, 1.2);
    oval(ctx, x - 2, y - 7, 3, 1.6, P.a.maroonLight);
    // The head turns where YOU looks. Never a face: hair, and an ear when turned.
    const turn = state === "reach" || state === "turn" ? 3.2 : state === "look" ? 1.4 : state === "look-back" ? -3.2 : 0;
    const hy = y - 10 - (state === "look" ? 3 : 0);
    oval(ctx, x + turn, hy, 7.6, 8, P.inkSoft, true, CH);
    oval(ctx, x + turn - 1.8, hy - 2.4, 3.4, 2.8, P.wood[1]);
    if (turn) oval(ctx, x + turn * 2.3, hy + 1, 1.7, 2.6, P.skin[1], true, 0.8);
    ctx.restore();
  }
  // A shopping cart rattling past on its own; one wheel wants to go somewhere else.
  function cart(ctx, x, y, o = {}) {
    const jig = o.rolling && o.t ? Math.sin(o.t / 60) * 0.6 : 0;
    drop(ctx, x, y, 12, 3);
    ctx.save(); ctx.translate(x, y + jig);
    shape(ctx, [-12, -22, 12, -22, 9, -8, -9, -8], null, { ink: 1.2, amp: 0.2 });
    for (let gx = -10; gx <= 10; gx += 4) line(ctx, gx, -22, gx * 0.78, -8, P.metal[2], 0.6, gx, 0);
    line(ctx, -11, -15, 11, -15, P.metal[2], 0.6, 1, 0);
    line(ctx, 12, -22, 16, -26, P.metal[2], 1.2, 2, 0); rect(ctx, P.a.red, 14, -28, 4, 2);
    line(ctx, -8, -8, -8, -2, P.metal[1], 1); line(ctx, 8, -8, 8, -2, P.metal[1], 1);
    for (const wx of [-8, 8]) oval(ctx, wx, -1.5, 1.8, 1.8, P.ink);
    ctx.restore();
  }
  // ===== THE RIDE: the van moving under everyone =====
  // One road for the scenery, the crew and Rizo, so everything in the van
  // moves together. surge: + speeding up (bodies sway back, toward the rear
  // doors), − braking. bend: the road curving (lane lines drift, the tree on
  // the mirror swings). shiver: the engine in every seat. Still when reduced.
  function vanRide(t, reduced) {
    if (reduced || !t) return { surge: 0, bend: 0, drift: 0, shiver: 0 };
    const surge = Math.sin(t / 3700) * 0.6 + Math.sin(t / 8300 + 2.1) * 0.4;
    const bend = Math.sin(t / 5100 + 0.7) * 0.7 + Math.sin(t / 12900) * 0.3;
    return { surge, bend, drift: bend * 8, shiver: Math.sin(t / 29) * 0.22 + Math.sin(t / 47) * 0.16 };
  }

  // THE CREW IN THE VAN. The four people from outside, sitting where people
  // sit in a work van with the roof cut away: the DRIVER at the wheel on the
  // near side, facing the road; the TALL one twisted round in the passenger
  // seat with his slides on the dash, an arm over the seatback, watching; the
  // SMALL one on a milk crate and the CAPPED one on the wheel arch, both with
  // their backs to the far wall, facing the floor where Rizo is. Seat or feet
  // at x,y. Each keeps the shape that named them outside: hood peak, beanie
  // and pom, flat backwards cap, and the driver's sunglasses at night.
  //   o.look     world point the head turns to (speaker, Rizo, the phone)
  //   o.talking  head and one hand move;  o.quiet  head down, hunched
  //   o.state    "freeze": nothing moves but the road; "stare": every face on o.look, eyes lit
  //   o.point    the capped one's arm out at o.look;  o.phone  "film" | "call" (the small one)
  //   o.ride     vanRide();  o.bump  0..1 just after a pothole
  const CREW_HEIGHT = Object.freeze({ driver: 62, "hood-tall": 68, "hood-small": 62, "hood-cap": 64 });
  const CREW_HEAD = Object.freeze({ driver: [-1, -57], "hood-tall": [3, -59], "hood-small": [0, -47], "hood-cap": [0, -47] });
  function seated(ctx, kind, x, y, o = {}) {
    const who = CREW_HEAD[o.who] ? o.who : kind === "driver-seat" ? "driver" : "hood-tall";
    const t = o.t || 0, state = o.state || "idle";
    const still = state === "freeze" || state === "stare";
    const ride = o.ride || { surge: 0, shiver: 0 };
    const k = {
      t, state, still, quiet: Boolean(o.quiet) && !still, phone: o.phone || null, point: Boolean(o.point),
      // Bodies sway with the van; frozen, they hold themselves rigid against it.
      lean: ride.surge * (still ? 0.6 : 1.8) + (still ? 0 : ride.shiver * 0.3),
      hop: -(o.bump || 0) * 3.4,
      talk: o.talking && !still && t ? Math.sin(t / 95) * 0.8 + Math.sin(t / 37) * 0.3 : 0,
      talking: Boolean(o.talking) && !still,
      idle: still || !t ? 0 : Math.sin(t / 1100 + x * 0.1) * 0.4
    };
    const [hx, hy] = CREW_HEAD[who];
    const dx = o.look ? o.look.x - (x + hx) : 0, dy = o.look ? o.look.y - (y + hy) : 1, d = Math.hypot(dx, dy) || 1;
    k.look = { x: dx / d, y: dy / d };
    ctx.save(); ctx.translate(x, y);
    if (who === "driver") crewDriver(ctx, k);
    else if (who === "hood-tall") crewTall(ctx, k);
    else if (who === "hood-small") crewSmall(ctx, k);
    else crewCap(ctx, k);
    ctx.restore();
  }
  // Eyes in a mask: whites that read at phone size, pupils toward the look.
  function crewEyes(ctx, ex, ey, gap, k, o = {}) {
    const wide = k.state === "stare" || o.wide, r = wide ? 1.9 : 1.55;
    const px = k.look.x * (wide ? 0.5 : 0.75), py = k.look.y * 0.45;
    if (k.quiet) { line(ctx, ex - gap - 1.4, ey + 0.4, ex - gap + 1.4, ey + 0.8, P.paper[2], 1); line(ctx, ex + gap - 1.4, ey + 0.8, ex + gap + 1.4, ey + 0.4, P.paper[2], 1); return; }
    for (const side of [-1, 1]) {
      oval(ctx, ex + side * gap, ey + (o.crooked ? side * 0.5 : 0), r, r * 0.9, P.paper[3]);
      oval(ctx, ex + side * gap + px, ey + (o.crooked ? side * 0.5 : 0) + py, wide ? 0.6 : 0.8, wide ? 0.6 : 0.8, P.ink);
    }
    if (k.state === "stare") { rect(ctx, "#ffffff", ex - gap - 1, ey - 1.2, 0.9, 0.9); rect(ctx, "#ffffff", ex + gap - 1, ey - 1.2, 0.9, 0.9); }
  }
  // The small one: puffer jacket, mustard beanie and pom, on a milk crate,
  // the phone in his hand. Facing the floor (and us).
  function crewSmall(ctx, k) {
    // The crate he sits on: faded blue, slotted.
    box(ctx, -11, -21, 22, 17, P.a.denim, { ink: 1.2, amp: 0.2, seed: 141 });
    rect(ctx, P.a.umbrellaLight, -10.4, -20.6, 20.8, 1.6);
    for (const gx of [-6, -1, 4]) rect(ctx, P.ink, gx, -15, 2, 8);
    // Knees forward, shins down, white trainers.
    box(ctx, -9.5, -24, 19, 7, P.cloth[1], { ink: 1.1, amp: 0.2, seed: 142 });
    for (const side of [-1, 1]) {
      box(ctx, side * 4.6 - 2.7, -16, 5.4, 15, P.cloth[1], { ink: 1.1, amp: 0.2, seed: 143 + side });
      oval(ctx, side * 4.6, -17, 3.4, 2.6, P.cloth[2], true, 1);
      oval(ctx, side * 5.2, -1.4, 3.6, 2, P.a.white, true, 1);
    }
    const sx = k.lean * 0.5, sy = k.hop * 0.5 + (k.quiet ? 1.6 : 0);
    ctx.save(); ctx.translate(sx, sy);
    // Off arm: on his knee, or up and open while he talks.
    if (k.talking && k.phone !== "call") limb(ctx, [-11, -37, -16, -31, -17, -38 + k.talk * 2], P.a.maroon, 4.4, P.skin[1]);
    else if (k.phone !== "call") limb(ctx, [-11, -37, -12, -28, -6, -22], P.a.maroon, 4.4, P.skin[1]);
    // Puffer: three quilted bands, the top one lit, a zip.
    shape(ctx, [-13, -42, 12, -42, 14, -23, -14, -23], P.a.maroon, { ink: CH, seed: 144, amp: CA });
    ctx.globalAlpha = 0.28; shape(ctx, [-13, -42, -6, -42, -7, -23, -14, -23], P.ink, { ink: false, seed: 145, amp: CA }); ctx.globalAlpha = 1;
    rect(ctx, P.a.maroonLight, -11, -41, 22, 3);
    for (const qy of [-35, -29]) line(ctx, -13.5, qy, 13.5, qy + 0.5, P.ink, 0.9, qy);
    line(ctx, 0.4, -41, 0.4, -24, P.inkSoft, 0.8, 146, 0.1);
    // The phone: held out at what he films, held close when it rings, or in his lap.
    if (k.phone === "film") {
      const ax = 12 + Math.max(-2, k.look.x * 13), ay = -35 + k.look.y * 6;
      limb(ctx, [10, -38, ax - 2, ay + 2, ax, ay - 1], P.a.maroon, 4.4, null);
      box(ctx, ax - 2, ay - 8, 6, 9, P.ink, { ink: 1, amp: 0.1 });
      rect(ctx, P.metal[3], ax + 1.6, ay - 6.6, 1.4, 1.4);
      rect(ctx, P.fluoro[2], ax - 2.8, ay - 7.4, 1, 8);
      oval(ctx, ax, ay - 0.5, 2.3, 2.1, P.skin[1], true, 0.9);
    } else if (k.phone === "call") {
      if (k.state === "phone-stopped") {
        // He starts to answer; Tall's hand forces the phone back toward his lap.
        limb(ctx, [-11, -37, -10, -29, -5, -25], P.a.maroon, 4.4, P.skin[1]);
        limb(ctx, [11, -37, 8, -29, 1, -25], P.a.maroon, 4.4, P.skin[1]);
        box(ctx, -5, -30, 8, 11, P.ink, { ink: 1, amp: 0.1 });
        rect(ctx, P.fluoro[2], -4.5, -30.6, 7, 1);
      } else {
        limb(ctx, [-11, -37, -9, -28, -3, -29], P.a.maroon, 4.4, P.skin[1]);
        limb(ctx, [11, -37, 9, -28, 4, -29], P.a.maroon, 4.4, P.skin[1]);
        box(ctx, -3.5, -38, 8, 11, P.ink, { ink: 1, amp: 0.1 });
        rect(ctx, P.fluoro[2], -3, -38.6, 7, 1);
      }
    } else {
      limb(ctx, [11, -37, 12, -28, 7, -22], P.a.maroon, 4.4, P.skin[1]);
      box(ctx, 3, -25, 7, 4, P.ink, { ink: 0.8, amp: 0.1 });
    }
    // Head: ski mask under the beanie; the eye slot on crooked.
    const hx = k.lean + k.look.x * 1.3 + k.talk * 0.2, hy = -47 + k.hop + k.idle + (k.quiet ? 2.6 : 0) - sy;
    oval(ctx, hx, hy, 8.4, 8, P.ink, true, CH);
    ctx.save(); ctx.translate(hx, hy - 0.4); ctx.rotate(-0.12); rect(ctx, P.cloth[0], -6.8, -2.8, 13.6, 4.6); ctx.restore();
    crewEyes(ctx, hx + k.look.x * 0.8, hy - 0.6, 2.8, k, { crooked: true, wide: k.phone === "call" });
    if (k.talking) oval(ctx, hx + k.look.x, hy + 4.4, 1.5, 0.8 + Math.abs(k.talk) * 0.6, P.cloth[1]);
    // The screen's cold light on the mask when the phone is up.
    if (k.phone) { ctx.globalAlpha = k.phone === "call" ? 0.5 : 0.3; oval(ctx, hx + (k.phone === "film" ? 3 : 0), hy + 3, 6, 3.6, P.fluoro[1]); ctx.globalAlpha = 1; }
    shape(ctx, [hx - 8.7, hy - 2.6, hx - 7.8, hy - 9.4, hx, hy - 12.6, hx + 7.8, hy - 9.4, hx + 8.7, hy - 2.6], P.a.mustard, { ink: 1.3, seed: 147, amp: 0.25 });
    rect(ctx, P.ink, hx - 8.4, hy - 5, 16.8, 0.8);
    oval(ctx, hx + 1, hy - 13.8, 2.8, 2.6, P.a.mustard, true, 1);
    ctx.restore();
  }
  // The capped one: wide, track jacket with the white stripe, cap on
  // backwards (a flat top nobody else has), red bandana; elbows on his knees
  // on the wheel arch, the empty pillowcase in his hands. He points once.
  function crewCap(ctx, k) {
    for (const side of [-1, 1]) {
      box(ctx, side * 8.4 - 3.2, -18, 6.4, 17, P.cloth[0], { ink: 1.1, amp: 0.2, seed: 151 + side });
      oval(ctx, side * 8.4, -19, 4.2, 3, P.cloth[1], true, 1);
      oval(ctx, side * 9, -1.6, 4.4, 2.3, P.ink, true, 1);
      line(ctx, side * 9 - 2, -1.4, side * 9 + 1.6, -2.2, P.a.white, 0.8);
    }
    box(ctx, -13, -26, 26, 8, P.cloth[0], { ink: 1.1, amp: 0.2, seed: 153 });
    const sx = k.lean * 0.5, sy = k.hop * 0.5;
    ctx.save(); ctx.translate(sx, sy);
    // Hunched: shoulders forward and down.
    shape(ctx, [-16, -42, 15, -43, 14, -24, -14, -24], P.a.track, { ink: CH, seed: 154, amp: CA });
    shape(ctx, [-16, -42, -8, -43, -9, -24, -14, -24], "#24472f", { ink: false, seed: 155, amp: CA });
    line(ctx, 0, -42, 0, -25, P.ink, 0.9);
    // Pointing: the arm on Rizo's side goes straight out at him, one finger;
    // the pillowcase drops at his feet. Otherwise elbows on knees, the cloth in his hands.
    const side = k.look.x < 0 ? -1 : 1;
    const ax = side * 14 + k.look.x * 13 + side * 8, ay = -38 + k.look.y * 13;
    if (!k.point) {
      limb(ctx, [-14, -39, -9, -26, -2, -27], P.a.track, 4.8, P.skin[0]);
      shape(ctx, [-6, -31, 5, -32, 7, -24, 1, -21, -6, -23], P.a.white, { ink: 1.1, seed: 156, amp: 0.7 });
      limb(ctx, [14, -39, 9, -26, 3, -27], P.a.track, 4.8, P.skin[0]);
    } else {
      shape(ctx, [-4, -6, 8, -7, 10, -1, -3, 0], P.a.white, { ink: 1.1, seed: 157, amp: 0.7 });
      limb(ctx, [-side * 14, -39, -side * 9, -26, -side * 2, -27], P.a.track, 4.8, P.skin[0]);
      limb(ctx, [side * 14, -39, (side * 14 + ax) / 2, (-39 + ay) / 2 - 1, ax, ay], P.a.track, 4.8, P.skin[0]);
      line(ctx, ax, ay, ax + k.look.x * 5.5, ay + k.look.y * 5.5, P.ink, 2.8);
      line(ctx, ax, ay, ax + k.look.x * 5.5, ay + k.look.y * 5.5, P.skin[0], 1.3);
    }
    rect(ctx, P.a.white, -15, -38, 1.6, 9); rect(ctx, P.a.white, 13, -38, 1.6, 9);
    // Head: hood, the backwards cap's flat brim standing up behind, bandana.
    const hx = k.lean + k.look.x * 1.3, hy = -47 + k.hop + k.idle - sy;
    oval(ctx, hx, hy, 9.4, 8.8, P.cloth[1], true, CH);
    shape(ctx, [hx - 6.4, hy - 7.6, hx + 6.4, hy - 7.6, hx + 5.6, hy - 12.4, hx - 5.6, hy - 12.4], P.ink, { ink: 1, seed: 158, amp: 0.15 });
    oval(ctx, hx, hy - 4.6, 8.4, 4.6, P.ink, true, 1);
    oval(ctx, hx, hy - 3.6, 2.4, 1.2, P.cloth[1]);
    shape(ctx, [hx - 8.2, hy + 0.4, hx + 8.2, hy + 0.4, hx + 6.4, hy + 6.8, hx, hy + 9, hx - 6.4, hy + 6.8], P.a.red, { ink: 1.1, seed: 159, amp: 0.25 });
    line(ctx, hx - 5, hy + 3.4, hx + 5, hy + 3.2, P.a.stamp, 0.8);
    crewEyes(ctx, hx + k.look.x * 0.8, hy - 1.2, 3, k);
    ctx.restore();
  }
  // The tall one, in the passenger seat: long legs out to the dash in socks
  // and slides, twisted round with an arm over the seatback (the seatback is
  // the van's, at x+6..x+15), hood peak drooping toward whatever he watches.
  function crewTall(ctx, k) {
    const sx = k.lean * 0.6, sy = k.hop * 0.5;
    // Legs to the dash; socks and slides.
    limb(ctx, [-1, -21, -12, -33, -21, -30], P.cloth[2], 5, null);
    box(ctx, -25.5, -33, 5.4, 5.6, P.a.sock, { ink: 0.9, amp: 0.1 });
    shape(ctx, [-30, -31, -24, -32.4, -23.4, -27.4, -30.4, -26.8], P.ink, { ink: false, seed: 161, amp: 0.1 });
    ctx.save(); ctx.translate(sx, sy);
    // Far arm on his knee.
    limb(ctx, [-4, -47, -8, -38, -11, -33], P.cloth[1], 4.4, P.skin[1]);
    shape(ctx, [-8, -51, 6, -53, 8, -21, -8, -19], P.cloth[3], { ink: CH, seed: 162, amp: CA });
    shape(ctx, [1, -52, 6, -53, 8, -21, 2, -20], P.cloth[2], { ink: false, seed: 163, amp: CA });
    box(ctx, -5, -34, 11, 7, P.cloth[1], { ink: 1, amp: 0.3, seed: 164 });
    ctx.globalAlpha = 0.5; oval(ctx, 0, -43, 4, 3.4, P.cloth[3]); ctx.globalAlpha = 1;
    // Near arm over the seatback; lifted off it while he talks. When Small
    // starts to answer the Boss call, Tall reaches across and pushes the phone
    // back down instead of merely saying not to pick up.
    if (k.state === "stop-phone") limb(ctx, [4, -48, 22, -50, 43, -40], P.cloth[3], 4.6, P.skin[1]);
    else if (k.talking) limb(ctx, [4, -48, 12, -53, 17, -58 + k.talk * 2], P.cloth[3], 4.6, P.skin[1]);
    else limb(ctx, [4, -48, 12, -53, 18, -49], P.cloth[3], 4.6, P.skin[1]);
    // Head: the peak droops toward where he looks; a slot of mask, lazy eyes.
    const f = k.look.x < -0.3 ? -1 : 1;
    const hx = 3 + k.lean + k.talk * 0.3, hy = -59 + k.hop + k.idle - sy + (k.quiet ? 1.5 : 0);
    ctx.save(); ctx.translate(hx, hy); ctx.scale(f, 1);
    shape(ctx, [-9, 7, -10, -4, -4, -11, 5, -11, 10, -5, 12, 1, 7, -1, 6, 8], P.cloth[3], { ink: CH, seed: 165, amp: CA });
    line(ctx, -6, -6, 4, -10, P.paper[0], 1, 166, 0.2);
    oval(ctx, 3, 1, 5.8, 5.6, P.ink);
    rect(ctx, P.cloth[0], 0, -1.4, 8.6, 3.6);
    if (k.state === "stare") { oval(ctx, 5.6, 0.4, 1.6, 1.3, P.paper[3]); oval(ctx, 6.2, 0.4, 0.6, 0.6, P.ink); rect(ctx, "#ffffff", 4.6, -0.5, 0.8, 0.8); }
    else if (k.quiet) line(ctx, 3.6, 0.8, 7.4, 1.2, P.paper[2], 1.1);
    else { line(ctx, 3.4, 0.2, 7.6, 0.4, P.paper[2], 1.3); rect(ctx, P.ink, 5.6 + Math.max(0, k.look.x) * 0.8, -0.1, 1.1, 1); }
    line(ctx, 4, 7, 3.4, 15, P.paper[2], 0.8); line(ctx, 6.4, 6.4, 7, 11, P.paper[2], 0.8);
    ctx.restore();
    ctx.restore();
  }
  // The driver: heavy shoulders over the wheel in a rust chore coat with a
  // cream fleece collar, gloves, a black ski mask and wraparound sunglasses at
  // night. Faces the road; turns half round to talk, further to look at Rizo.
  function crewDriver(ctx, k) {
    const turn = k.state === "stare" ? 0.85 : k.talking ? 0.5 : k.quiet ? 0.2 : 0;
    const sx = k.lean * 0.5, sy = k.hop * 0.4;
    // Legs down to the pedals; work boots.
    limb(ctx, [2, -21, -9, -25, -14, -6], P.cloth[0], 5.4, null);
    oval(ctx, -16, -4, 4, 2.2, P.ink, true, 1);
    ctx.save(); ctx.translate(sx, sy);
    // The wheel, edge-on: a tilted ring and its column to the dash.
    line(ctx, -21, -31, -31, -27, P.ink, 2.2);
    ctx.save(); ctx.translate(-21, -38); ctx.rotate(-0.28);
    ctx.strokeStyle = P.ink; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.ellipse(0, 0, 2.8, 10.5, 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = P.cloth[2]; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.restore();
    // Far arm to the top of the wheel.
    limb(ctx, [2, -46, -8, -40, -19, -47], P.a.rust, 4.8, null);
    oval(ctx, -19.5, -47.5, 2.6, 2.4, P.ink, true, 0.9);
    // The coat: rust canvas, a dark side, a chest pocket, the fleece collar.
    shape(ctx, [-9, -50, 8, -52, 10, -20, -9, -19], P.a.rust, { ink: CH, seed: 171, amp: CA });
    shape(ctx, [3, -51, 8, -52, 10, -20, 4, -20], P.wood[1], { ink: false, seed: 172, amp: CA });
    box(ctx, -6, -40, 7, 6, P.wood[1], { ink: 0.8, amp: 0.2, seed: 173 });
    shape(ctx, [-7, -50, 8, -53, 9, -47, -6, -45], P.paper[2], { ink: 1.1, seed: 174, amp: 0.5 });
    // Near arm: on the wheel, or off it to make a point.
    if (k.talking) { limb(ctx, [-3, -46, -9, -37, -11, -48 + k.talk * 2.4], P.a.rust, 4.8, null); oval(ctx, -11, -48.4 + k.talk * 2.4, 2.6, 2.4, P.ink, true, 0.9); }
    else { limb(ctx, [-3, -46, -11, -35, -21, -31], P.a.rust, 4.8, null); oval(ctx, -21, -31, 2.6, 2.4, P.ink, true, 0.9); }
    // Head: black knit mask with a rolled cuff, the glasses' band moving round as he turns.
    const hx = -1 + k.lean * 0.8, hy = -57 + k.hop + k.idle - sy + (k.quiet ? 1.2 : 0);
    oval(ctx, hx, hy, 7.6, 7.8, P.ink, true, CH);
    rect(ctx, P.cloth[1], hx - 7.2, hy - 6.8, 14.4, 2.8);
    oval(ctx, hx + 5.4 - turn * 6, hy + 0.6, 1.5, 2.3, P.cloth[0]);
    const lx = hx - 4.8 + turn * 7.2;
    box(ctx, lx - 3.4, hy - 2.4, 6.8 - turn * 1.2, 3.2, P.metal[3], { ink: 0.9, amp: 0.1 });
    rect(ctx, "#ffffff", lx - 2.4, hy - 1.8, 2, 0.9);
    oval(ctx, hx - 5.6 + turn * 6.6, hy + 4, 1.3, k.talking ? 0.8 + Math.abs(k.talk) * 0.5 : 0.5, P.cloth[1]);
    ctx.restore();
  }

  // LATCH. A stranded courier: a folded-paper coat with the collar turned
  // all the way up, a postal cap, his face only a strip of eyes between
  // them, a brass clasp at the throat and a satchel that drags one shoulder
  // down. Recognisable from across a room by that collar.
  function latch(ctx, x, y, o = {}) {
    const bob = o.bob || 0, expr = o.expr || "procedural", t = o.t || 0;
    drop(ctx, x, y, 10, 3);
    ctx.save(); ctx.translate(x, y); ctx.scale(o.face || 1, 1);
    if (o.seated) {
      // Sitting: knees up, coat pooled on the bench.
      box(ctx, -2, -10, 10, 4, P.cloth[1], { ink: 1, amp: 0.2 });
      oval(ctx, 9, -4, 2.6, 1.8, P.ink);
      ctx.translate(0, 3);
    } else {
      legs(ctx, 0, 0, -9, 2.2, 3, P.cloth[1], bob, P.wood[1]);
      rect(ctx, P.a.mustard, -3.4, -4.6, 2.8, 1.6); // one odd sock
    }
    const lift = expr === "startled" ? -2 : 0, low = expr === "soft" ? 2 : 0;
    // The pinned coat tail, caught in the gate's frozen latch.
    if (o.pinned) {
      shape(ctx, [-8, -12, -30, -14, -31, -10, -9, -7], P.paper[2], { ink: 1.1, seed: 61, amp: 0.4 });
      stitches(ctx, -28, -12, -12, -10, P.paper[0], 3, 1, 0.7);
    }
    // Coat: an A-line of folded paper. Folds show; a taped tear at the hem.
    const lean = o.pinned ? 0.12 : o.pulling ? -0.1 : 0;
    ctx.rotate(lean);
    shape(ctx, [-6, -27, 7, -27, 10, -6, 4, -5, 1, -7, -10, -5], P.paper[2], { ink: CH, seed: 62, amp: CA });
    shape(ctx, [-6, -27, -1, -27, -3, -7, -10, -5], P.paper[1], { ink: false, seed: 63, amp: CA });
    line(ctx, 1.5, -26, 2.5, -7, P.paper[0], 0.7, 64, 0.2);
    line(ctx, -4, -18, 6, -13, P.paper[0], 0.6, 65, 0.2);
    tape(ctx, 6.2, -8, 4.5, -0.5, 66);
    // The satchel strap drags the far shoulder down; brass clasp on the flap.
    // Unloaded (the packet is out), the strap sits higher and the bag hangs flat.
    const light = o.state === "unloaded" ? 3 : 0;
    line(ctx, 6, -26, -6, -12 - light, P.wood[1], 1.8, 67, 0.2);
    box(ctx, -11, -15 - light, 8, 6.5 - light * 0.8, P.wood[2], { ink: 1.1, seed: 68, amp: 0.3 });
    rect(ctx, P.wood[1], -11, -15 - light, 8, 2.4);
    rect(ctx, P.a.brass, -7.8, -13.6 - light, 1.8, 1.8);
    // A postage stamp sewn on the shoulder.
    rect(ctx, P.paper[3], 3.2, -24.6, 3.6, 4); rect(ctx, P.a.stamp, 3.8, -24, 2.4, 2.8);
    // Hands: sleeve cuffs; pulling holds a chain.
    if (o.pulling) {
      shape(ctx, [6, -22, 13, -27, 14, -24, 8, -19], P.paper[2], { ink: 1.1, seed: 69, amp: 0.2 });
      line(ctx, 14, -26, 15 + Math.sin(t / 60), -38, P.metal[2], 1.3, 70, 0.2);
    }
    // Face strip: skin between collar and brim; the eyes carry the expression.
    oval(ctx, 1, -31 + lift, 5.4, 4.4, P.skin[2], true, 1.1);
    const ey = -31.6 + lift;
    ctx.strokeStyle = P.ink; ctx.fillStyle = P.ink; ctx.lineWidth = 1; ctx.lineCap = "round";
    if (expr === "startled") { oval(ctx, -0.8, ey, 1.4, 1.5, P.paper[3], true, 0.7); oval(ctx, 3.4, ey, 1.4, 1.5, P.paper[3], true, 0.7); oval(ctx, -0.6, ey, 0.6, 0.6, P.ink); oval(ctx, 3.6, ey, 0.6, 0.6, P.ink); }
    else if (expr === "soft") { ctx.beginPath(); ctx.arc(-0.8, ey - 0.4, 1.1, 0.2, Math.PI - 0.2); ctx.moveTo(4.5, ey - 0.4); ctx.arc(3.4, ey - 0.4, 1.1, 0.2, Math.PI - 0.2); ctx.stroke(); }
    else if (expr === "dry") { line(ctx, -2, ey, 0.4, ey, P.ink, 1); ctx.beginPath(); ctx.arc(3.4, ey + 0.6, 1.2, Math.PI + 0.3, -0.3); ctx.stroke(); }
    else if (expr === "urgent") { line(ctx, -2.2, ey - 1.4, 0.4, ey - 0.4, P.ink, 1); line(ctx, 5, ey - 1.4, 2.4, ey - 0.4, P.ink, 1); oval(ctx, -0.8, ey + 0.6, 0.7, 0.7, P.ink); oval(ctx, 3.6, ey + 0.6, 0.7, 0.7, P.ink); }
    else { line(ctx, -2, ey, 0.4, ey, P.ink, 1.1); line(ctx, 2.4, ey, 4.8, ey, P.ink, 1.1); }
    // The collar: two stiff paper flaps up past the chin, a brass clasp at the throat.
    shape(ctx, [-6, -26 + low, -7, -35 + low, -1, -29.5 + low, 0.5, -25 + low], P.paper[3], { ink: 1.2, seed: 71, amp: 0.25 });
    shape(ctx, [8, -26 + low, 8.6, -35.5 + low, 2.6, -29.5 + low, 1, -25 + low], P.paper[2], { ink: 1.2, seed: 72, amp: 0.25 });
    oval(ctx, 0.8, -27 + low, 1.5, 1.3, P.a.brass, true, 0.7);
    // The cap: postal slate, short brim forward, a brass badge.
    ctx.save(); ctx.translate(1, -35 + lift); ctx.rotate(expr === "dry" ? 0.08 : expr === "startled" ? -0.12 : 0);
    shape(ctx, [-6, 0, -5.4, -5, 0, -6.4, 5.4, -5, 6, 0], P.a.postal, { ink: 1.3, seed: 73, amp: 0.2 });
    rect(ctx, P.a.postalLight, -4.5, -5.4, 8, 1.2);
    shape(ctx, [1, -0.6, 10, -0.2, 9.4, 1.6, 1, 1.4], P.cloth[0], { ink: 1, seed: 74, amp: 0.15 });
    oval(ctx, 1.4, -2.8, 0.9, 0.9, P.a.brass);
    ctx.restore();
    ctx.restore();
  }

  // An arm as one inked stroke from shoulder to hand (elbow optional).
  function limb(ctx, pts, color, width, hand) {
    ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
    for (const [stroke, w] of [[P.ink, width + 2.2], [color, width]]) {
      ctx.strokeStyle = stroke; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
      for (let index = 2; index < pts.length; index += 2) ctx.lineTo(pts[index], pts[index + 1]);
      ctx.stroke();
    }
    ctx.restore();
    if (hand) oval(ctx, pts[pts.length - 2], pts[pts.length - 1], 2.3, 2.1, hand, true, 0.9);
  }
  // NELL: the Mending Rows mender. Her silhouette is deliberately wider than
  // the other service workers: layered work coat, long apron panel, one pale
  // shoulder strap, tool pocket and a large tied head wrap. Those five shapes
  // survive phone scale before any small detail does. Feet at x,y; ~88u.
  const NELL_ARMS = {
    // [near arm points], [far arm points] relative to the shoulder line.
    work: [[7, -61, 14, -49, 19, -44], [-6, -60, 2, -49, 10, -45]],
    support: [[7, -61, 15, -51, 24, -45], [-6, -60, 6, -51, 17, -46]],
    lift: [[7, -61, 10, -75, 7, -91], [-6, -60, -4, -76, -1, -91]],
    clear: [[7, -61, 15, -47, 23, -37], [-6, -60, 2, -49, 7, -41]],
    point: [[7, -61, 17, -64, 27, -70], [-6, -60, -7, -49, -5, -38]],
    listen: [[7, -61, 18, -52, 11, -41], [-6, -60, -13, -52, -8, -41]],
    fix: [[7, -61, 16, -52, 24, -47], [-6, -60, 6, -52, 17, -48]],
    walk: [[7, -61, 10, -50, 10, -39], [-6, -60, -9, -50, -9, -39]],
    eat: [[7, -61, 13, -52, 7, -70], [-6, -60, 2, -50, 9, -46]],
    brace: [[7, -61, 17, -60, 25, -62], [-6, -60, 8, -58, 22, -56]],
    tired: [[7, -61, 13, -72, 3, -76], [-6, -60, -9, -50, -9, -41]],
    fit: [[7, -61, 15, -46, 19, -34], [-6, -60, 6, -46, 12, -34]],
    sit: [[7, -61, 13, -50, 17, -44], [-6, -60, 3, -50, 10, -45]]
  };
  function nell(ctx, x, y, o = {}) {
    const bob = o.bob || 0, t = o.t || 0, state = NELL_ARMS[o.state] ? o.state : "work";
    const seated = state === "sit", walking = Boolean(o.bob);
    const quiet = !walking && !["support", "lift", "brace"].includes(state);
    const breath = quiet ? Math.sin(t / 920) * 0.45 : 0;
    drop(ctx, x, y, 15, 3.8);
    ctx.save(); ctx.translate(x, y); ctx.scale(o.face || 1, 1);
    if (seated) {
      // She sits like somebody who has been on her feet all shift: one knee
      // forward, boots planted, apron folded out of the way.
      box(ctx, -13, -18, 24, 18, P.wood[1], { ink: 1.1, amp: 0.3, seed: 81 });
      rect(ctx, P.wood[2], -13, -18, 24, 3);
      box(ctx, -3, -27, 19, 7, P.cloth[1], { ink: 1.1, amp: 0.2, seed: 82 });
      box(ctx, 12, -27, 5, 25, P.cloth[1], { ink: 1.1, amp: 0.2, seed: 83 });
      oval(ctx, 16, -2, 4.6, 2.3, P.wood[0], true, 1);
      ctx.translate(-2, 18);
    } else {
      legs(ctx, 0, 0, -31, 3.7, 5.5, P.cloth[1], bob, P.wood[0]);
      // One repaired knee is readable even when the upper-body detail is lost.
      box(ctx, -7.4, -18, 5.5, 5.2, P.service[1], { ink: 0.7, amp: 0.2, seed: 78 });
      stitches(ctx, -6.8, -15.4, -2.5, -15.4, P.paper[1], 2.2, 0.7, 0.55);
    }
    ctx.translate(0, breath);
    const lean = state === "brace" ? 0.16 : state === "clear" || state === "fit" || state === "fix" ? 0.2 : state === "support" ? 0.1 : state === "tired" ? -0.05 : state === "listen" ? -0.06 : 0;
    ctx.rotate(lean);
    const slump = state === "tired" ? 3 : 0;
    ctx.translate(0, slump);
    const arms = NELL_ARMS[state];
    const swing = walking ? Math.sin(t / 110) * 3 : 0;
    const far = arms[1].map((value, index) => (index >= 2 && index % 2 === 0 && state === "walk" ? value + swing : value));
    limb(ctx, far, P.service[0], 4.4, P.skin[0]);

    // Work always has weight or material. Nell never pantomimes a job.
    if (state === "lift") {
      const by = -93;
      box(ctx, -11, by - 2, 32, 4, P.wood[2], { ink: 1.1, amp: 0.1, seed: 80 });
      rect(ctx, P.wood[3], -10, by - 1.6, 30, 1);
      stitches(ctx, -8, by, 17, by, P.paper[0], 4, 0.8, 0.55);
    }
    if (state === "work" || state === "fix") {
      const cy = state === "fix" ? -50 : -49;
      const lift = state === "work" ? Math.sin(t / 410) * 1.15 : 0;
      // A folded repair in her hands: patched corner, seam, needle and loose
      // thread. At small scale this becomes one pale rectangle plus red seam.
      shape(ctx, [7, cy - 2, 24, cy - 1, 23, cy + 11, 8, cy + 10], P.paper[1], { ink: 0.9, amp: 0.3, seed: 79 });
      shape(ctx, [16, cy - 1, 24, cy - 1, 23, cy + 5, 17, cy + 4], P.service[2], { ink: 0.6, amp: 0.2, seed: 179 });
      stitches(ctx, 9, cy + 5, 22, cy + 6, P.a.maroonLight, 2.5, 1.05, 0.75);
      line(ctx, 17, cy + 3 + lift, 22, cy - 3 + lift, P.metal[3], 0.9);
      ctx.save(); ctx.strokeStyle = P.a.maroon; ctx.lineWidth = 0.65; ctx.beginPath();
      ctx.moveTo(18, cy + 4 + lift); ctx.quadraticCurveTo(13, cy + 10, 9, cy + 7); ctx.stroke(); ctx.restore();
    }

    // Broad service coat: squared shoulders, softened hem, one darker side.
    shape(ctx, [-12, -63, 10, -63, 14, -39, 12, -29, 8, -24, -12, -25, -16, -38], P.service[2], { ink: CH, seed: 84, amp: CA });
    shape(ctx, [-12, -61, -3, -62, -5, -27, -12, -25, -16, -38], P.service[1], { ink: false, seed: 85, amp: CA });
    rect(ctx, P.service[3], -8, -63, 16, 1.8);
    line(ctx, 1, -61, 2, -29, P.inkSoft, 0.8, 86, 0.2);

    // The apron panel is her strongest body-language cue: useful, repaired,
    // a little heavy. It makes her unmistakable beside Latch and Orr.
    shape(ctx, [-8, -43, 10, -42, 11, -19, 4, -16, -7, -18, -10, -31], P.service[0], { ink: 1.15, seed: 184, amp: 0.35 });
    line(ctx, -7, -40, 9, -39, P.a.maroon, 1.4, 185, 0.15);
    box(ctx, 2, -34, 9, 8, P.service[3], { ink: 0.8, amp: 0.25, seed: 87 });
    stitches(ctx, 2, -34, 11, -34, P.paper[1], 2.5, 0.9, 0.65);
    line(ctx, 5.5, -35, 5.5, -41, P.paper[2], 1.2, 186, 0.05);
    line(ctx, 8.5, -35, 10.5, -40, P.metal[3], 1, 187, 0.05);
    // A pale measuring/repair strap crosses the green mass and stays readable
    // against BELOW without making her decorative.
    line(ctx, -9.5, -58.5, 8.5, -36.5, P.ink, 5, 188, 0.1);
    line(ctx, -9.5, -58.5, 8.5, -36.5, P.paper[0], 2.7, 188, 0.1);
    for (let k = 0; k < 3; k += 1) line(ctx, -5 + k * 4, -53 + k * 5, -3.5 + k * 4, -54.2 + k * 5, P.inkSoft, 0.65, 190 + k, 0.02);
    // Belt, rag and repaired hip patch.
    rect(ctx, P.wood[1], -13, -41, 26, 2.5);
    shape(ctx, [-10, -41, -5, -41, -4, -27, -10, -30], P.paper[2], { ink: 0.8, seed: 88, amp: 0.4 });
    box(ctx, -8, -30, 7, 6, P.paper[0], { ink: 0.8, amp: 0.25, seed: 189 });
    stitches(ctx, -8, -27, -1, -27, P.a.maroon, 2.2, 0.8, 0.6);

    // Holding a board steady for him: out in front at her hands, where it
    // meets whatever she is holding (the table's support, the grille, the press).
    if (state === "support") {
      ctx.save(); ctx.translate(14, -46); ctx.rotate(0.08);
      box(ctx, -4, -2.6, 34, 5.2, P.wood[2], { ink: 1.2, amp: 0.1, seed: 80 });
      rect(ctx, P.wood[3], -3, -2.2, 32, 1.2);
      stitches(ctx, 0, 0.6, 27, 0.6, P.paper[0], 4, 0.8, 0.55);
      ctx.restore();
    }
    // Fixing: bent to the job with a scraper.
    if (state === "fix") { line(ctx, 22, -48, 31, -41, P.ink, 2.6, 196, 0); line(ctx, 22, -48, 31, -41, P.metal[3], 1.3, 196, 0); }
    // Near arm: one sleeve always rolled higher; the wood tool cuff and skin
    // break the coat silhouette into a useful-worker read rather than a blob.
    const near = arms[0].map((value, index) => (index >= 2 && index % 2 === 0 && state === "walk" ? value - swing : value));
    limb(ctx, near.slice(0, 4), P.service[2], 4.8, null);
    limb(ctx, near.slice(2), P.skin[1], 3.3, P.skin[1]);
    const cx = (near[2] + near[4]) / 2, cy = (near[3] + near[5]) / 2;
    oval(ctx, cx, cy, 2.5, 1.7, P.wood[2], true, 0.8);
    oval(ctx, near[2], near[3], 2.9, 2.3, P.service[3], true, 0.8);

    // Head: tied wrap first, then tired hairline, chalk and a small face. The
    // wrap knot/tail is intentionally oversized because it is her phone-scale
    // head silhouette.
    const tilt = state === "listen" ? -0.14 : state === "tired" ? 0.12 : 0;
    ctx.save(); ctx.translate(1, -69); ctx.rotate(tilt);
    oval(ctx, 0, 0, 6.5, 6.8, P.skin[1], true, 1.2);
    shape(ctx, [-6.7, -1, -5.7, -7.2, 1, -9, 6.2, -6.4, 4.2, -4, -1, -4.2, -3.6, 1], P.wood[0], { ink: 1.1, seed: 89, amp: 0.2 });
    shape(ctx, [-8.8, -6, -5.4, -11.2, 1.8, -11.8, 5.2, -8.5, 1.8, -6.8, -5.8, -3.6], P.a.maroon, { ink: 1.2, seed: 90, amp: 0.25 });
    line(ctx, -5.4, -8.3, 3.8, -9.2, P.a.maroonLight, 1.1, 193, 0.08);
    oval(ctx, -8, -8.2, 2.8, 3, P.a.maroon, true, 0.95);
    shape(ctx, [-9.5, -6.3, -7.1, -5.8, -9.2, 1.3, -11.1, 0.2], P.a.maroon, { ink: 0.8, seed: 194, amp: 0.2 });
    // Chalk behind the ear, pale enough to pop once without becoming jewelry.
    rect(ctx, P.paper[3], -4.8, -2.8, 3.8, 1.3);
    const eyeY = -0.6;
    if (state === "tired") {
      line(ctx, 1.3, eyeY + 0.4, 3.5, eyeY + 0.5, P.ink, 0.9);
      line(ctx, 4.6, eyeY + 0.5, 6.5, eyeY + 0.2, P.ink, 0.9);
      line(ctx, 1.5, 1.2, 3.2, 1.4, P.skin[0], 0.55);
    } else {
      oval(ctx, 2.5, eyeY, state === "listen" ? 0.85 : 0.75, 0.9, P.ink);
      oval(ctx, 5.4, eyeY, state === "listen" ? 0.82 : 0.7, 0.85, P.ink);
      if (state === "listen") line(ctx, 1.5, -2.3, 3.3, -2.6, P.inkSoft, 0.55);
    }
    line(ctx, 4.1, 0.2, 3.7, 1.7, P.skin[0], 0.55, 195, 0.04);
    if (state === "eat") oval(ctx, 5.1, 3.3, 1, 0.8, P.ink);
    else if (state === "listen") { ctx.save(); ctx.strokeStyle = P.inkSoft; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(3.1, 3.1); ctx.quadraticCurveTo(4.3, 3.9, 5.6, 3); ctx.stroke(); ctx.restore(); }
    else line(ctx, 3.1, 3.4, 5.5, 3.2, P.inkSoft, 0.7);
    ctx.restore();
    ctx.restore();
  }

  // ORR: the kitchen runner. Compact and work-worn: low patched cap,
  // dropped towel shoulder, reinforced apron, and a clipped serving spoon.
  // He leans into the job instead of posing; the oversized tray stays the read. ~82u.
  function orr(ctx, x, y, o = {}) {
    const bob = o.bob || 0, state = o.state || "tray";
    drop(ctx, x, y, 14, 3.6);
    ctx.save(); ctx.translate(x, y); ctx.scale(o.face || 1, 1);

    // Short, planted service legs. One wrapped shin breaks the symmetry.
    legs(ctx, 0, 0, -27, 4.4, 5.4, P.cloth[0], bob, P.wood[0]);
    rect(ctx, P.paper[0], -8.2, -14.5, 5.2, 3.2);
    line(ctx, -7.7, -13.1, -3.5, -13.1, P.wood[1], 0.7, 201, 0.1);

    // Weight forward, towel shoulder low: useful rather than heroic.
    ctx.save();
    ctx.translate(0, -27);
    ctx.rotate(state === "carry" ? -0.035 : 0.045);
    ctx.translate(0, 27);

    limb(ctx, state === "carry" ? [-7, -57, -11, -45, -9, -34] : [-7, -57, 0, -48, 10, -46], P.a.mustard, 4.4, P.skin[0]);

    // Rolled service shirt with an uneven shoulder instead of a round blob.
    shape(ctx, [-14, -58, 7, -61, 14, -54, 15, -39, 10, -28, -12, -27, -16, -39], P.a.mustard, { ink: CH, seed: 91, amp: CA });
    shape(ctx, [-14, -56, -6, -59, -7, -29, -12, -27, -16, -39], P.wood[2], { ink: false, seed: 92, amp: 0.35 });
    rect(ctx, P.paper[0], -11, -56.8, 8, 2.2);

    // Off-center apron: repaired, stained by use, heavier at one corner.
    shape(ctx, [-8, -51, 7, -50, 10, -17, 2, -13, -11, -17, -10, -46], P.paper[1], { ink: 1.2, seed: 93, amp: 0.4 });
    shape(ctx, [-8, -51, -2, -50, -3, -17, -11, -17, -10, -46], P.paper[0], { ink: false, seed: 94, amp: 0.25 });
    line(ctx, -7, -49, -2, -58, P.paper[3], 1, 95, 0.1);
    line(ctx, 7, -49, 3, -59, P.paper[3], 1, 96, 0.1);
    box(ctx, 2, -28, 7, 7, P.wood[1], { ink: 0.8, amp: 0.25, seed: 97 });
    stitches(ctx, 2, -28, 9, -28, P.paper[0], 2.3, 0.9, 0.5);

    // Belt and one practical service signature: a spoon clipped at the hip.
    rect(ctx, P.wood[0], -12, -31, 24, 2.6);
    oval(ctx, -12.5, -28.5, 2.4, 2.4, null, true, 1);
    line(ctx, -12.5, -26, -13.6, -18.5, P.metal[2], 1.2, 98, 0.1);
    oval(ctx, -14, -16.8, 2.1, 3, P.metal[2], true, 0.8);

    // Long striped towel is the identifying cloth shape, always on one shoulder.
    shape(ctx, [3, -63, 10, -61, 9, -38, 4, -35, 1, -44], P.paper[3], { ink: 1, seed: 99, amp: 0.3 });
    for (const sy of [-56, -50, -44]) line(ctx, 3.4, sy, 8.8, sy + 0.5, P.a.red, 0.9, sy + 200, 0.1);

    // Near arm and the object he is responsible for.
    if (state === "tray") {
      limb(ctx, [6, -56, 13, -48, 20, -47], P.a.mustard, 4.5, P.skin[0]);
      box(ctx, 0, -51, 37, 3.4, P.metal[2], { ink: 1.1, amp: 0.2, seed: 100 });
      rect(ctx, P.metal[3], 1, -50.6, 35, 0.8);
      oval(ctx, 11, -53.3, 5, 2.2, P.paper[3], true, 0.9);
      oval(ctx, 26, -53.3, 5, 2.2, P.paper[3], true, 0.9);
      oval(ctx, 11, -54.2, 3, 1.2, P.ember[1]);
      oval(ctx, 26, -54.2, 3, 1.2, P.ember[1]);
      shape(ctx, [18, -56, 25, -56, 28, -52, 20, -51], P.paper[1], { ink: 0.7, seed: 101, amp: 0.25 });
    } else if (state === "carry") {
      limb(ctx, [6, -56, 10, -45, 8, -35], P.a.mustard, 4.5, P.skin[0]);
      box(ctx, 4, -43, 5, 27, P.metal[1], { ink: 1.1, amp: 0.2, seed: 102 });
      rect(ctx, P.metal[3], 5, -41, 1, 23);
      oval(ctx, 6.5, -38, 0.8, 0.8, P.a.brass);
    } else {
      limb(ctx, [6, -56, 14, -50, 21, -52], P.a.mustard, 4.5, P.skin[0]);
    }

    // Narrow asymmetric face: long nose, tired lids, short beard edge.
    const headTilt = state === "carry" ? 0.08 : -0.025;
    ctx.save(); ctx.translate(1, -67); ctx.rotate(headTilt);
    shape(ctx, [-6.2, -1, -5.2, -7.2, -1.2, -10, 4.8, -8.8, 7, -4.2, 6.2, 2.2, 2.4, 6.2, -2.8, 5.2, -5.8, 2.2], P.skin[0], { ink: 1.2, seed: 103, amp: 0.22 });
    oval(ctx, -5.9, -1, 1.8, 2.2, P.skin[0], true, 0.8);

    // Low patched cap with a long forward brim.
    shape(ctx, [-6.4, -6.2, -4.7, -11.2, 1.6, -12.2, 6.4, -9.4, 7.2, -6.3], P.cloth[2], { ink: 1.2, seed: 104, amp: 0.2 });
    rect(ctx, P.cloth[3], -3.8, -11.2, 5.4, 1.4);
    shape(ctx, [1.8, -7, 11.4, -6.1, 10.2, -4.2, 1.6, -5.2], P.cloth[1], { ink: 1, seed: 105, amp: 0.15 });
    box(ctx, -2.8, -10.8, 3.3, 2.5, P.paper[0], { ink: 0.6, amp: 0.15, seed: 106 });

    line(ctx, -1.4, -1.8, 1.2, -1.5, P.ink, 1.1);
    oval(ctx, 0.1, -0.7, 0.7, 0.75, P.ink);
    line(ctx, 3, -1.2, 5.3, -1.5, P.ink, 0.9);
    oval(ctx, 4.2, -0.5, 0.65, 0.75, P.ink);
    line(ctx, 2.3, 0.1, 3.4, 2.5, P.inkSoft, 0.7, 107, 0.1);
    line(ctx, 0.4, 4.1, 4.6, 3.6, P.ink, 0.9, 108, 0.1);
    line(ctx, -1.8, 4.8, 1.2, 5.6, P.wood[0], 0.8, 109, 0.15);
    line(ctx, 2.1, 5.5, 4.4, 4.8, P.wood[0], 0.8, 110, 0.15);
    ctx.restore();

    ctx.restore();
    ctx.restore();
  }
  // THE NIGHT PORTER. A tall greatcoat with nobody visible inside, a brass
  // hall lantern for a head (one pane cracked and taped), keys at the hip, a
  // blank luggage tag on a button. Closed, it wraps itself shut and the seam
  // is sewn tight. Open, the seam splits from the hem: the coat is hollow, and
  // the hollow is where it can be reached.
  function porter(ctx, x, y, o = {}) {
    const t = o.t || 0, open = o.open || 0, settled = o.settled, flash = o.flash;
    if (settled) {
      // Defeated: the coat folded on the floor, the lantern set down beside it, still lit, low.
      drop(ctx, x, y + 14, 30, 7, 0.5);
      ctx.save(); ctx.translate(x, y + 14);
      shape(ctx, [-28, 0, -22, -12, -6, -16, 14, -14, 26, -6, 28, 2], P.cloth[1], { ink: CH, seed: 81, amp: 0.6 });
      shape(ctx, [-20, -8, 0, -13, 18, -10, 8, -4, -12, -3], P.cloth[2], { ink: 1, seed: 82, amp: 0.5 });
      for (const bx of [-8, 0, 8]) oval(ctx, bx, -8, 1.3, 1.3, P.a.brass, true, 0.6);
      ctx.restore();
      lantern(ctx, x + 32, y + 12, t, 0.35, 0.1);
      return;
    }
    const sway = Math.sin(t / 900) * 1.2, lean = o.lean || 0;
    drop(ctx, x, y + 20, 26, 7, 0.5);
    ctx.save(); ctx.translate(x, y + 20);
    ctx.rotate(lean * 0.12 + sway * 0.01);
    const coat = flash ? P.cloth[3] : P.cloth[1], coatLight = flash ? P.paper[2] : P.cloth[2];
    // The hem: a heavy bell, frayed; it never shows feet.
    shape(ctx, [-24, 0, -19, -4, -14, 0, -8, -3, -2, 0, 4, -3, 10, 0, 16, -4, 23, 0, 17, -44, 13, -58, -13, -58, -17, -44], coat, { ink: 2, seed: 83, amp: 0.6 });
    shape(ctx, [-24, 0, -19, -4, -14, 0, -10, -2, -9, -44, -13, -58, -17, -44], P.cloth[0], { ink: false, seed: 84, amp: 0.5 });
    // Shoulders hunched up around the lantern; frayed epaulettes.
    shape(ctx, [-17, -50, -20, -60, -12, -66, 12, -66, 20, -60, 17, -50], coatLight, { ink: 1.8, seed: 85, amp: 0.5 });
    for (const side of [-1, 1]) { rect(ctx, P.a.brass, side * 15 - 3, -63, 6, 2); for (let f = 0; f < 3; f += 1) rect(ctx, P.a.brass, side * 15 - 2.5 + f * 2, -61, 0.8, 2.2); }
    // A darned elbow patch.
    box(ctx, -18, -36, 6, 8, P.paper[1], { ink: 0.9, amp: 0.3 });
    stitches(ctx, -18, -36, -12, -36, P.ink, 2, 0.9, 0.6);
    if (open > 0) {
      // The seam splits: flaps pulled back, a hollow, the worn lining.
      const k = Math.min(1, open);
      const top = -6 - 40 * k, half = 4 + 11 * k;
      shape(ctx, [-half, 0, 0, top, half, 0], P.ink, { ink: 1.6, seed: 86, amp: 0.4 });
      shape(ctx, [-half + 2, 0, 0, top + 7, half - 2, 0], flash ? P.ember[4] : P.ember[1], { ink: false, seed: 87, amp: 0.4 });
      shape(ctx, [-half * 0.5, 0, 0, top + 16, half * 0.5, 0], flash ? "#fff" : P.ember[2], { ink: false, seed: 88, amp: 0.3 });
      // Quilted lining along the flaps.
      line(ctx, -half, 0, 0, top, P.a.maroonLight, 2.2, 89, 0.3);
      line(ctx, half, 0, 0, top, P.a.maroonLight, 2.2, 90, 0.3);
    } else {
      // Closed: wrapped over itself, buttoned, the seam sewn shut.
      line(ctx, 2, -64, -2, 0, P.ink, 1.6, 91, 0.4);
      stitches(ctx, 2, -60, -2, -2, P.paper[0], 4, 1.3, 0.8);
      for (const by of [-54, -44, -34, -24]) { oval(ctx, -5, by, 1.6, 1.6, P.a.brass, true, 0.7); oval(ctx, 7, by + 1, 1.6, 1.6, P.a.brass, true, 0.7); }
    }
    // Keys at the hip; a blank tag on a string.
    ctx.save(); ctx.translate(13, -30); ctx.rotate(Math.sin(t / 500) * 0.12);
    oval(ctx, 0, 0, 3, 3, null, true, 1); line(ctx, 0, 3, -1, 8, P.a.brass, 1.2); line(ctx, 1.5, 3, 3, 7, P.a.brass, 1.2);
    ctx.restore();
    line(ctx, -5, -44, -9, -38, P.paper[1], 0.6);
    ctx.save(); ctx.translate(-10, -36); ctx.rotate(0.3 + Math.sin(t / 650) * 0.08); box(ctx, -2.5, 0, 5, 7, P.paper[2], { ink: 0.8, amp: 0.2 }); oval(ctx, 0, 1.4, 0.7, 0.7, P.ink); ctx.restore();
    ctx.restore();
    // The lantern head, tilted (it hangs its head a little), dimmed when open.
    // Sweeping, it hoists the lamp high on a stretched collar and swings it
    // toward the side the light will travel: the outline changes, not just a tilt.
    const aim = o.lampAim || 0, hoist = aim ? 14 : 0;
    const hx = x + Math.sin(t / 900) * 1.2 + lean * 6 + aim * 9, hy = y - 52 + (open ? 4 : 0) - hoist;
    if (hoist) {
      shape(ctx, [x - 7, y - 44, x + 7, y - 44, hx + 5, hy + 4, hx - 5, hy + 4], P.cloth[1], { ink: 1.6, seed: 95, amp: 0.3 });
      for (const k of [0.35, 0.7]) line(ctx, x - 6 + (hx - x) * k, y - 44 + (hy + 4 - y + 44) * k, x + 6 + (hx - x) * k, y - 44 + (hy + 4 - y + 44) * k, P.cloth[0], 1, k * 10, 0.2);
    }
    lantern(ctx, hx, hy, t, open ? 0.45 : 1, open ? 0.3 : 0.12 + aim * 0.42, 0);
  }
  function lantern(ctx, x, y, t, glow = 1, tilt = 0.12, aim = 0) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(tilt + aim * 0.2);
    line(ctx, 0, -17, 0, -20, P.ink, 1.2); oval(ctx, 0, -21, 2, 2, null, true, 1);
    shape(ctx, [-8, -12, 0, -17, 8, -12], P.a.brass, { ink: 1.4, seed: 92, amp: 0.2 });
    box(ctx, -7, -12, 14, 15, P.ink, { ink: 1.4, amp: 0.2 });
    const lit = glow > 0.6 ? P.ember[4] : glow > 0.3 ? P.ember[3] : P.ember[1];
    rect(ctx, lit, -5.4, -10.4, 4.6, 11.8);
    rect(ctx, lit, 0.8, -10.4, 4.6, 11.8);
    rect(ctx, P.a.brass, -0.8, -12, 1.6, 15);
    // The cracked pane, taped.
    line(ctx, 1.2, -9, 4.6, -3, P.ink, 0.6); tape(ctx, 3, -6, 5, 0.9, 93);
    if (glow > 0.2) flame(ctx, -2.8, 0.2, 2.2 * glow, t + 200);
    shape(ctx, [-8, 3, 8, 3, 6, 6, -6, 6], P.a.brass, { ink: 1.3, seed: 94, amp: 0.2 });
    ctx.restore();
  }

  // ===== ENEMIES =====
  // DRAFTLING: a torn paper dart with a ragged tail. Its nose always points
  // where it will go: the silhouette is the attack before the tell begins.
  function draftling(ctx, x, y, o = {}) {
    const r = o.r || 8, t = o.t || 0, state = o.state || "idle", k = o.k || 0;
    ctx.save(); ctx.translate(x, y);
    drop(ctx, 0, r + 3, r * 0.9, 2.4, 0.35);
    if (state === "recover") {
      // Crumpled flat on the floor: open, and it looks it.
      ctx.translate(0, 4);
      shape(ctx, [-r * 1.2, 1, -r * 0.6, -3.5, 0, -1.5, r * 0.7, -4, r * 1.2, 1, r * 0.3, 3.6, -r * 0.5, 3], o.flash ? "#fff" : P.paper[2], { ink: CH, seed: 101, amp: 0.6 });
      line(ctx, -r * 0.6, -3, r * 0.3, 3, P.paper[0], 0.7);
      line(ctx, -4.5, -0.4, -1.5, 0.2, P.ink, 1.1); line(ctx, 1.5, 0.2, 4.5, -0.4, P.ink, 1.1);
      ctx.restore(); return;
    }
    ctx.rotate(o.angle || 0);
    const stretch = state === "lunge" ? 1.5 : state === "windup" ? 1 - 0.25 * k : 1;
    const pull = state === "windup" ? -3 * k : 0;
    const wing = state === "lunge" ? 0.55 : state === "windup" ? 1 - 0.35 * k : 1;
    const flutter = state === "idle" ? Math.sin(t / 110 + x) * 1.3 : 0;
    ctx.translate(pull, 0);
    // Tail streamers, trailing opposite the nose.
    ctx.strokeStyle = P.paper[1]; ctx.lineWidth = 1.6; ctx.lineCap = "round";
    for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(-r * 0.7, side * 2);
      ctx.quadraticCurveTo(-r * 1.4, side * (4 + flutter), -r * (2 + (state === "lunge" ? 0.8 : 0)), side * (2 + flutter * 0.6));
      ctx.stroke();
    }
    const body = [r * 1.25 * stretch, 0, -r * 0.4, -r * 0.95 * wing + flutter * 0.3, -r * 0.85, -r * 0.35 * wing, -r * 0.55, 0, -r * 0.85, r * 0.35 * wing, -r * 0.4, r * 0.95 * wing - flutter * 0.3];
    shape(ctx, body, o.flash ? "#fff" : P.paper[2], { ink: CH, seed: 102, amp: 0.35 });
    shape(ctx, [r * 1.25 * stretch, 0, -r * 0.4, r * 0.95 * wing - flutter * 0.3, -r * 0.55, 0], o.flash ? "#fff" : P.paper[1], { ink: false, seed: 103, amp: 0.3 });
    line(ctx, r * 1.1 * stretch, 0, -r * 0.5, 0, P.paper[0], 0.8, 104, 0.1);
    // Two slit eyes near the nose; narrower as it commits.
    const eh = state === "windup" ? 0.7 : 1.3;
    ctx.save(); ctx.translate(r * 0.3, 0); ctx.rotate(-(o.angle || 0));
    rect(ctx, P.ink, -3.6, -2.4 - eh / 2, 2.6, eh); rect(ctx, P.ink, 1, -2.4 - eh / 2, 2.6, eh);
    ctx.restore();
    ctx.restore();
  }
  // NEEDLE: a sewing needle driven into a sagging pincushion with one button
  // eye. Its thread is its telegraph: drawn out along the lane, then pulled tight.
  function needle(ctx, x, y, o = {}) {
    const t = o.t || 0, state = o.state || "idle", aimX = o.aimX || 0, aimY = o.aimY ?? 1;
    drop(ctx, x, y + 4, 9, 2.8, 0.4);
    // The cushion.
    shape(ctx, [x - 9, y + 3, x - 8, y - 4, x - 2, y - 7, x + 5, y - 6, x + 9, y - 1, x + 8, y + 4], o.flash ? "#fff" : P.a.maroon, { ink: CH, seed: 111, amp: 0.4 });
    for (const sx of [-4, 2]) line(ctx, x + sx, y - 6, x + sx + 1, y + 3, P.a.maroonLight, 0.8, sx, 0.2);
    oval(ctx, x - 3.5, y - 1, 1.8, 1.8, P.paper[3], true, 0.8); oval(ctx, x - 3.5, y - 1, 0.6, 0.6, P.ink);
    // The needle leans toward its lane; it bends when spent.
    const lean = state === "recover" ? 0.5 * Math.sin(t / 90) : state === "indicate" ? 0.25 : 0.12;
    const tilt = Math.atan2(aimX, 1) * 0.5 + lean * (aimX >= 0 ? 1 : -1);
    ctx.save(); ctx.translate(x + 1, y - 5); ctx.rotate(tilt);
    shape(ctx, [-1.6, 0, 1.6, 0, 0.9, -22, 0, -25, -0.9, -22], o.flash ? "#fff" : P.metal[3], { ink: 1.2, seed: 112, amp: 0.1 });
    rect(ctx, P.metal[2], 0.2, -21, 0.8, 20);
    // The eye of the needle, and the thread through it.
    oval(ctx, 0, -19.5, 0.6, 2, P.ink);
    if (state !== "indicate" && state !== "pulse") {
      ctx.strokeStyle = P.danger[1]; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(0, -19.5);
      ctx.quadraticCurveTo(5, -12, 4, -2); ctx.quadraticCurveTo(3, 6, -3, 7); ctx.stroke();
    }
    ctx.restore();
  }
  // The van's loose cooler: white lid, red tub, a dent, a sticker.
  function cooler(ctx, x, y, o = {}) {
    drop(ctx, x, y + 7, 12, 3);
    const w = o.wobble || 0;
    box(ctx, x - 11 + w, y - 8, 22, 15, P.a.red, { ink: CH, seed: 121, amp: 0.3 });
    box(ctx, x - 11 + w, y - 10, 22, 5, P.a.white, { ink: 1.2, seed: 122, amp: 0.3 });
    rect(ctx, P.paper[3], x - 9 + w, y - 9.6, 18, 1);
    box(ctx, x - 3 + w, y - 13, 6, 3, P.metal[2], { ink: 1, amp: 0.2 });
    box(ctx, x + 2 + w, y - 3, 6, 5, P.a.mustard, { ink: 0.7, amp: 0.2 });
    ctx.globalAlpha = 0.5; oval(ctx, x - 5 + w, y, 3, 2, "#7e2420"); ctx.globalAlpha = 1;
  }
  // A dog bowl. Steel, dented, with water in it or frost.
  function bowl(ctx, x, y, o = {}) {
    drop(ctx, x, y + 3, 9, 2.6);
    oval(ctx, x, y, 8.4, 3.8, P.metal[2], true, 1.1);
    ctx.beginPath(); ctx.ellipse(x, y, 8.4, 4.6, 0, 0, Math.PI); ctx.fillStyle = P.metal[1]; ctx.fill(); inkStroke(ctx, 1.1);
    oval(ctx, x, y - 0.4, 6.4, 2.4, o.water ? P.wet[2] : o.frost ? "#c9d6e0" : P.metal[0]);
    rect(ctx, P.metal[3], x - 6.5, y - 2.6, 4, 0.8);
    if (o.water && o.t != null) { const k = (o.t / 900) % 1; ctx.globalAlpha = 1 - k; ctx.strokeStyle = P.wet[3]; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.ellipse(x + 1, y - 0.4, 1 + k * 4, (1 + k * 4) * 0.36, 0, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
    if (o.frost) { ctx.globalAlpha = 0.8; for (let index = 0; index < 5; index += 1) rect(ctx, "#eef4f8", x - 5 + index * 2.4, y - 1.2 + (index % 2) * 0.8, 1, 0.6); ctx.globalAlpha = 1; }
    line(ctx, x + 3, y + 2.2, x + 5.4, y + 1.2, P.metal[0], 0.8);
  }

  // ===== PORTRAITS (64×64, the same rules in SVG) =====
  // A stepped light disc behind the head (the light they stand in), one ink
  // weight, two value bands, one detail that is only theirs.
  const INK_W = 2.4;
  const svg = body => `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" stroke-linejoin="round" stroke-linecap="round">${body}</svg>`;
  const disc = (ground, mid, near, cx = 28, cy = 28) => `<rect width="64" height="64" fill="${ground}"/><circle cx="${cx}" cy="${cy}" r="30" fill="${mid}"/><circle cx="${cx}" cy="${cy}" r="20" fill="${near}"/>`;
  const rainLines = '<path d="M50 4 l-3 8 M58 14 l-3 8 M8 6 l-3 8 M44 22 l-3 8" stroke="#8fa6b8" stroke-width="1.2" opacity=".55"/>';
  const ink = `stroke="${P.ink}" stroke-width="${INK_W}"`;
  // Latch's bust: collar, face strip, cap. Expressions move the eyes, the
  // brim and how high the collar stands.
  function latchPortrait(expr) {
    const lift = expr === "startled" ? -3 : 0;
    const low = expr === "soft" ? 4 : expr === "startled" ? 2 : 0;
    const tilt = expr === "dry" ? 6 : expr === "urgent" ? 4 : expr === "startled" ? -7 : expr === "soft" ? -3 : 0;
    const ground = expr === "urgent" ? ["#1a100c", "#2c1810", "#3c2214"] : expr === "soft" ? ["#1a120d", "#2c1f15", "#3d2a1b"] : ["#14110f", "#1f1a15", "#29221b"];
    const eyes = {
      procedural: `<path d="M24 32 h6 M35 32 h6" stroke="${P.ink}" stroke-width="2.6"/>`,
      startled: `<circle cx="27" cy="32" r="3.4" fill="${P.paper[3]}" ${ink} stroke-width="1.8"/><circle cx="38" cy="32" r="3.4" fill="${P.paper[3]}" ${ink} stroke-width="1.8"/><circle cx="27.6" cy="32.4" r="1.3" fill="${P.ink}"/><circle cx="38.6" cy="32.4" r="1.3" fill="${P.ink}"/>`,
      dry: `<path d="M23.5 32.5 h6.5" stroke="${P.ink}" stroke-width="2.6"/><path d="M35 33 q3 -2.6 6.4 0" stroke="${P.ink}" stroke-width="2.4" fill="none"/>`,
      soft: `<path d="M24 31 q3 3 6 0 M35 31 q3 3 6 0" stroke="${P.ink}" stroke-width="2.3" fill="none"/>`,
      urgent: `<path d="M23 28.5 l7 2.6 M42 28.5 l-7 2.6" stroke="${P.ink}" stroke-width="2.4"/><circle cx="27" cy="33" r="1.7" fill="${P.ink}"/><circle cx="38.5" cy="33" r="1.7" fill="${P.ink}"/>`
    }[expr] || "";
    const mouth = expr === "soft" ? `<path d="M30 40.5 q3 2.2 6 0" stroke="${P.ink}" stroke-width="2" fill="none"/>` : expr === "startled" ? `<ellipse cx="33" cy="41.5" rx="2" ry="2.3" fill="${P.ink}"/>` : "";
    const urgentMarks = expr === "urgent" ? `<path d="M54 30 l6 -3 M55 37 l7 0 M53 44 l6 3" stroke="${P.ember[3]}" stroke-width="2.2"/>` : "";
    return svg(`${disc(...ground)}
<path d="M2 64 L5 52 Q8 47 18 45 L46 45 Q57 47 60 53 L62 64 Z" fill="${P.paper[2]}" ${ink}/>
<path d="M33 46 L31 64 L62 64 L60 53 Q57 47 46 45 Z" fill="${P.paper[1]}"/>
<path d="M33 46 L31 64" stroke="${P.paper[0]}" stroke-width="1.4"/><path d="M14 50 L22 58" stroke="${P.paper[0]}" stroke-width="1.2"/>
<path d="M50 46 L24 64" stroke="${P.wood[1]}" stroke-width="5"/><path d="M50 46 L24 64" stroke="${P.ink}" stroke-width="1" opacity=".5"/>
<rect x="8" y="52" width="7" height="8" fill="${P.paper[3]}" ${ink} stroke-width="1.4"/><rect x="9.6" y="53.6" width="3.8" height="4.8" fill="${P.a.stamp}"/>
<path d="M21 ${27 + lift} Q20 ${40 + lift} 33 ${44} Q45 ${40 + lift} 44 ${27 + lift} Z" fill="${P.skin[2]}" ${ink}/>
<path d="M21 ${30 + lift} Q24 ${36 + lift} 21 ${40 + lift}" stroke="${P.skin[1]}" stroke-width="3" fill="none"/>
<g transform="translate(0 ${lift})">${eyes}</g>${mouth}
<path d="M18 ${46 + low} L17 ${29 + low} L30 ${40 + low} L32 ${47 + low} Z" fill="${P.paper[3]}" ${ink}/>
<path d="M47 ${46 + low} L49 ${28 + low} L36 ${40 + low} L34 ${47 + low} Z" fill="${P.paper[2]}" ${ink}/>
<path d="M19 ${44 + low} L19 ${33 + low} L27 ${40 + low}" stroke="${P.paper[0]}" stroke-width="1.2" fill="none"/>
<rect x="40" y="${36 + low}" width="9" height="3.6" fill="${P.a.tape}" transform="rotate(-32 44 ${38 + low})"/>
<circle cx="33" cy="${43 + low}" r="2.8" fill="${P.a.brass}" ${ink} stroke-width="1.6"/><path d="M33 ${43 + low} q2 3 0 5" stroke="${P.ink}" stroke-width="1.4" fill="none"/>
<g transform="rotate(${tilt} 33 ${22 + lift}) translate(0 ${lift})">
<path d="M18 26 Q18 11 33 10 Q47 11 48 24 Z" fill="${P.a.postal}" ${ink}/>
<path d="M22 15 Q33 9 44 15" stroke="${P.a.postalLight}" stroke-width="2.4" fill="none"/>
<path d="M30 23.5 L57 22 Q60 25 55 28 L30 28 Z" fill="${P.cloth[0]}" ${ink}/>
<circle cx="38" cy="17" r="2.6" fill="${P.a.brass}" ${ink} stroke-width="1.4"/>
<path d="M18 26 L16 31" stroke="${P.ink}" stroke-width="3"/>
</g>${urgentMarks}`);
  }
  // Nell is warmer and more human up close than her world sprite can afford:
  // asymmetrical wrap, tired eyes, chalk behind the ear, repaired workwear and
  // a measuring strap. Expressions stay restrained; capability is the default.
  function nellPortrait(expr) {
    // Each expression changes a large shape so it reads at 46 px (as Latch's
    // eye strip does): measuring holds a ruler to one squinting eye; listening
    // is the only one with open eye-whites, glancing aside, head tipped;
    // amused laughs with an open mouth; irritated has a brow bar and a huff;
    // tired droops. Work is her ordinary face.
    const tilt = expr === "listening" ? -10 : expr === "tired" ? 6 : expr === "measuring" ? 4 : expr === "irritated" ? -2 : 0;
    const ground = expr === "irritated"
      ? ["#121814", "#1b2721", "#26382f"]
      : expr === "amused" || expr === "listening"
        ? ["#17120e", "#2a2016", "#3c2d1e"]
        : expr === "tired"
          ? ["#121512", "#20261f", "#30382d"]
          : ["#101713", "#1b2722", "#2b3c34"];
    const eyes = {
      work: `<circle cx="27" cy="32.8" r="1.8" fill="${P.ink}"/><circle cx="39" cy="32.5" r="1.8" fill="${P.ink}"/><path d="M23.5 28.2 q3.2 -1 6.4 .2 M35.6 28 q3.2 -1.4 6.6 -.2" stroke="${P.ink}" stroke-width="1.9" fill="none"/>`,
      measuring: `<path d="M23.6 33 h6.2" stroke="${P.ink}" stroke-width="2.8"/><circle cx="39" cy="32.7" r="2" fill="${P.ink}"/><path d="M23 30 h7 M35.4 27.3 l7 -1.4" stroke="${P.ink}" stroke-width="2"/>`,
      listening: `<ellipse cx="27" cy="32.4" rx="3.3" ry="2.7" fill="${P.paper[3]}" ${ink} stroke-width="1.2"/><ellipse cx="39" cy="32.2" rx="3.3" ry="2.7" fill="${P.paper[3]}" ${ink} stroke-width="1.2"/><circle cx="25" cy="32.6" r="1.6" fill="${P.ink}"/><circle cx="37" cy="32.4" r="1.6" fill="${P.ink}"/><path d="M22.6 26.6 q3.6 -2.6 7.4 -.4 M35.2 26.2 q3.8 -2.6 7.4 .1" stroke="${P.ink}" stroke-width="1.9" fill="none"/>`,
      amused: `<path d="M23.5 33.4 q3.2 -3.6 6.5 0 M35.5 33.4 q3.2 -3.6 6.5 0" stroke="${P.ink}" stroke-width="2.4" fill="none"/><path d="M23.2 28 q3.2 -1.4 6.5 0 M35.5 27.8 q3.2 -1.4 6.5 0" stroke="${P.ink}" stroke-width="1.8" fill="none"/>`,
      irritated: `<path d="M21.5 27.6 L30.5 30.6 L30.5 28.4 L22 25.4 Z M44.5 27.6 L35.5 30.6 L35.5 28.4 L44 25.4 Z" fill="${P.ink}" ${ink} stroke-width="1"/><circle cx="27" cy="33.3" r="1.8" fill="${P.ink}"/><circle cx="39" cy="33.2" r="1.8" fill="${P.ink}"/>`,
      tired: `<path d="M24 33.5 q3 1.5 6 0 M36 33.5 q3 1.5 6 0" stroke="${P.ink}" stroke-width="2.1" fill="none"/><path d="M23 29.8 h7 M35.5 29.8 h7" stroke="${P.ink}" stroke-width="1.7"/><path d="M24 36 q3 1 6 0 M36 36 q3 1 6 0" stroke="${P.skin[0]}" stroke-width="1" fill="none"/>`
    }[expr] || "";
    const mouth = expr === "amused"
      ? `<path d="M27.5 39.6 q5.5 6.6 11 0 Z" fill="${P.wood[0]}" stroke="${P.ink}" stroke-width="1.8"/><path d="M28.6 40.3 h8.8" stroke="${P.paper[3]}" stroke-width="1.6"/>`
      : expr === "irritated"
        ? `<path d="M29 42 h7" stroke="${P.ink}" stroke-width="2.4"/>`
        : expr === "tired"
          ? `<path d="M30 42.5 q3 -1.2 6 -.1" stroke="${P.ink}" stroke-width="1.8" fill="none"/>`
          : expr === "listening"
            ? `<path d="M29.5 41.2 q3.5 1.7 7 0" stroke="${P.ink}" stroke-width="1.8" fill="none"/>`
            : `<path d="M29.5 41.5 q3.5 1.1 7 0" stroke="${P.ink}" stroke-width="1.8" fill="none"/>`;
    const cheek = expr === "tired" ? `<path d="M23 38 q2 1 4 .4" stroke="${P.skin[0]}" stroke-width="1" fill="none"/>` : "";
    // Big props outside the face: the ruler at her eye; a huff of breath.
    const extra = expr === "measuring"
      ? `<g transform="rotate(-24 20 40)"><rect x="2" y="36" width="34" height="6.5" fill="${P.paper[2]}" ${ink} stroke-width="1.6"/><path d="M7 36 v3 M12 36 v2 M17 36 v3 M22 36 v2 M27 36 v3 M32 36 v2" stroke="${P.ink}" stroke-width="1.1"/></g><circle cx="12" cy="47" r="3.2" fill="${P.skin[1]}" ${ink} stroke-width="1.4"/>`
      : expr === "irritated"
        ? `<path d="M41 44 q6 -1 7 2 q4 -1 5 3 q-3 3 -7 1 q-4 2 -6 -1 Z" fill="${P.paper[3]}" opacity=".8"/>`
        : "";
    return svg(`${disc(...ground)}
<path d="M1 64 L4 53 Q8 46 18 44 L47 44 Q58 46 61 53 L63 64 Z" fill="${P.service[2]}" ${ink}/>
<path d="M34 45 L32 64 L63 64 L61 53 Q58 46 47 44 Z" fill="${P.service[1]}"/>
<!-- apron bib and one repaired pocket: broad, practical shapes -->
<path d="M21 47 L31 52 L42 47 L45 64 L18 64 Z" fill="${P.service[0]}" ${ink} stroke-width="1.8"/>
<rect x="44" y="52" width="11" height="8" fill="${P.paper[1]}" ${ink} stroke-width="1.5"/><path d="M45 52.8 h9" stroke="${P.a.maroon}" stroke-width="1.1" stroke-dasharray="2 1.5"/>
<!-- measuring/repair strap creates the same diagonal read as the world sprite -->
<path d="M15 48 L29 64" stroke="${P.ink}" stroke-width="5"/><path d="M15 48 L29 64" stroke="${P.paper[0]}" stroke-width="2.6"/>
<path d="M18 51 l2 -1 M21 55 l2 -1 M24 59 l2 -1" stroke="${P.inkSoft}" stroke-width="1"/>
<path d="M28 43 L28 47 L38 47 L38 43" fill="${P.skin[1]}" ${ink} stroke-width="1.5"/>
<g transform="rotate(${tilt} 33 30)">
<!-- slightly long, grounded face; one shadow plane keeps it lived-in -->
<path d="M20 29 Q20 17 33 17 Q46 17 46 29 Q46 43 33 45 Q20 43 20 29 Z" fill="${P.skin[1]}" ${ink}/>
<path d="M20 30 Q21 38 25 42" stroke="${P.skin[0]}" stroke-width="3.2" fill="none"/>
<path d="M33 31 q-1.2 4 .7 6" stroke="${P.skin[0]}" stroke-width="1.2" fill="none"/>
${eyes}${mouth}${cheek}
<!-- hair mass stays quiet; the tied wrap owns the silhouette -->
<path d="M19 27 Q18 13 33 11 Q47 12 48 25 Q41 20 33 21 Q25 20 19 27 Z" fill="${P.wood[0]}" ${ink} stroke-width="2"/>
<path d="M16 20 Q16 8 29 5 Q44 4 50 14 Q43 12 34 13 Q24 13 16 20 Z" fill="${P.a.maroon}" ${ink} stroke-width="2"/>
<path d="M20 12 Q31 7 43 9" stroke="${P.a.maroonLight}" stroke-width="2.2" fill="none"/>
<path d="M20 16 Q31 12 45 14" stroke="${P.inkSoft}" stroke-width="1" stroke-dasharray="2 2" fill="none"/>
<circle cx="14.5" cy="14.5" r="5" fill="${P.a.maroon}" ${ink} stroke-width="1.8"/>
<path d="M12 18 L17 18 L14 29 L10 26 Z" fill="${P.a.maroon}" ${ink} stroke-width="1.3"/>
<!-- chalk behind the ear: Nell can lose it later because it is visibly hers now -->
<rect x="44" y="21" width="10" height="3.2" fill="${P.paper[3]}" ${ink} stroke-width="1.1" transform="rotate(-18 49 22.6)"/>
</g>${extra}`);
  }

  // Orr portrait: low patched cap, long nose, dropped towel shoulder.
  // Three reads: matter-of-fact service, irritation, and dry humor.
  function orrPortrait(expr) {
    // Each expression moves a big shape, not a 1 px brow, so it survives 46 px:
    // serving: level cap, open face, steam off the food he's carrying;
    // irritated: cap yanked low, head down, a heavy brow bar;
    // dry: head tipped, cap pushed back, one brow up, a lopsided mouth.
    const irritated = expr === "irritated", dry = expr === "dry";
    const ground = irritated
      ? ["#1d100b", "#341a10", "#4a2414"]
      : dry ? ["#15130f", "#252019", "#342a20"]
      : ["#1a140c", "#2e2214", "#46331c"];
    const head = irritated ? 'transform="translate(0 2.5) rotate(3 32 40)"' : dry ? 'transform="rotate(-9 32 42)"' : "";
    const capShift = irritated ? 4.5 : dry ? -3.5 : 0;
    const eyes = irritated
      ? `<path d="M19 30.5 L30 34 L30 31 L20 27.5 Z M45 29.5 L35 33.5 L35 30.5 L44 26.5 Z" fill="${P.ink}" ${ink} stroke-width="1.2"/><circle cx="26.5" cy="36" r="1.6" fill="${P.ink}"/><circle cx="39" cy="35.5" r="1.6" fill="${P.ink}"/><path d="M32 30 v4" stroke="${P.wood[0]}" stroke-width="1.4"/>`
      : dry
        ? `<path d="M20 27 q5 -6 10 -1" stroke="${P.ink}" stroke-width="2.6" fill="none"/><circle cx="25.5" cy="33" r="1.8" fill="${P.ink}"/><path d="M35 33.5 h8" stroke="${P.ink}" stroke-width="3"/><path d="M35 31 h8" stroke="${P.ink}" stroke-width="1.4"/>`
        : `<path d="M21 32 q3.5 -2.6 7 0 M36 31.6 q3.5 -2.6 7 0" stroke="${P.ink}" stroke-width="2.2" fill="none"/><circle cx="24.6" cy="34" r="1.6" fill="${P.ink}"/><circle cx="39.4" cy="33.6" r="1.6" fill="${P.ink}"/><circle cx="22" cy="39" r="2.4" fill="${P.skin[1]}" opacity=".7"/><circle cx="42" cy="38.6" r="2.4" fill="${P.skin[1]}" opacity=".7"/>`;
    const mouth = irritated
      ? `<path d="M27 45.5 q5 -3.4 10 0" stroke="${P.ink}" stroke-width="2.4" fill="none"/>`
      : dry
        ? `<path d="M27 43.5 q6 1.6 10 -2.6" stroke="${P.ink}" stroke-width="2.2" fill="none"/><path d="M37.5 40 l1.5 -1" stroke="${P.ink}" stroke-width="1.6"/>`
        : `<path d="M27 42.4 q5 4.4 10 0" stroke="${P.ink}" stroke-width="2.2" fill="${P.wood[0]}"/>`;
    const steam = expr === "serving" || (!irritated && !dry)
      ? `<path d="M8 50 q-3 -6 1 -11 q4 -5 0 -11 M13 52 q-3 -5 1 -9 q3 -4 0 -9" stroke="${P.paper[3]}" stroke-width="2" fill="none" opacity=".75"/>`
      : "";
    return svg(`${disc(...ground)}
<path d="M2 64 L5 53 Q10 47 20 45 L43 45 Q55 46 60 53 L62 64 Z" fill="${P.a.mustard}" ${ink}/>
<path d="M8 64 L11 49 L22 46 L20 64 Z" fill="${P.wood[2]}" opacity=".9"/>
<path d="M18 64 L20 49 L45 49 L48 64 Z" fill="${P.paper[1]}" ${ink} stroke-width="1.8"/>
<path d="M23 54 L42 54" stroke="${P.wood[0]}" stroke-width="2.2"/>
<path d="M45 44 L57 47 L56 64 L48 64 Z" fill="${P.paper[3]}" ${ink} stroke-width="1.8"/>
<path d="M48 51 l8 .8 M48.5 56 l7.5 .8 M49 61 l7 .7" stroke="${P.a.red}" stroke-width="1.8"/>
${steam}
<g ${head}>
<path d="M20 30 Q20 20 25 16 Q32 11 41 15 Q47 20 46 31 L44 39 Q40 46 31 47 Q23 45 20 39 Z" fill="${P.skin[0]}" ${ink}/>
<path d="M20 35 Q17 35 18 31 Q19 28 22 30" fill="${P.skin[0]}" ${ink} stroke-width="1.6"/>
${eyes}
<path d="M32 35 l2 4 l-2 1" stroke="${P.inkSoft}" stroke-width="1.6" fill="none"/>
${mouth}
<path d="M23 41 q4 5 11 5 q6 0 10 -5" stroke="${P.wood[0]}" stroke-width="1.5" fill="none"/>
<g transform="translate(0 ${capShift})">
<path d="M18 27 Q18 15 30 12 Q40 10 47 17 L48 25 Z" fill="${P.cloth[2]}" ${ink}/>
<path d="M22 16 Q31 13 42 17" stroke="${P.cloth[3]}" stroke-width="2" fill="none"/>
<rect x="25" y="13" width="7" height="4" fill="${P.paper[0]}" ${ink} stroke-width="1"/>
<path d="M35 24 L58 23 Q61 26 56 29 L35 29 Z" fill="${P.cloth[1]}" ${ink} stroke-width="1.8"/>
</g>
</g>
<path d="M12 57 q-1 5 1 7 M15 56 q-1 5 1 8" stroke="${P.metal[2]}" stroke-width="1.4"/>`);
  }

  const PORTRAITS = Object.freeze({
    // YOU: the person who left. Never a face: the umbrella, a scarf, the night.
    you: Object.freeze({
      neutral: svg(`${disc(P.night[0], P.night[1], P.night[2], 34, 20)}${rainLines}
<path d="M10 64 L14 50 Q20 44 32 44 Q44 44 50 50 L54 64 Z" fill="${P.wood[2]}" ${ink}/>
<path d="M32 44 Q44 44 50 50 L54 64 L36 64 Z" fill="${P.wood[1]}"/>
<path d="M22 46 Q32 52 42 46 L41 41 Q32 45 23 41 Z" fill="${P.a.maroon}" ${ink} stroke-width="1.8"/>
<path d="M24 41 Q24 32 33 32 Q41 32 41 41 Q33 44 24 41 Z" fill="${P.skin[1]}" ${ink} stroke-width="1.8"/>
<path d="M22 37 Q33 30 43 37 L43 33 Q33 26 22 33 Z" fill="${P.ink}" opacity=".7"/>
<path d="M2 30 Q10 8 33 5 Q56 8 63 30 L57 28 L51 31 L45 28 L39 31 L33 28 L27 31 L21 28 L15 31 L9 28 Z" fill="${P.a.umbrella}" ${ink}/>
<path d="M12 18 Q22 9 33 8 Q45 9 54 18 Q44 13 33 13 Q22 13 12 18 Z" fill="${P.a.umbrellaLight}"/>
<path d="M33 5 L21 28 M33 5 L33 28 M33 5 L45 28" stroke="${P.ink}" stroke-width="1.2"/><path d="M33 5 L33 1" ${ink}/>
<path d="M33 28 L33 52" stroke="${P.ink}" stroke-width="2.6"/><circle cx="35" cy="52" r="3" fill="${P.skin[1]}" ${ink} stroke-width="1.6"/>
<path d="M9 31 v3 M57 31 v4" stroke="#8fa6b8" stroke-width="1.4"/>`)
    }),
    nell: Object.freeze({ work: nellPortrait("work"), measuring: nellPortrait("measuring"), listening: nellPortrait("listening"), amused: nellPortrait("amused"), irritated: nellPortrait("irritated"), tired: nellPortrait("tired") }),
    orr: Object.freeze({ serving: orrPortrait("serving"), irritated: orrPortrait("irritated"), dry: orrPortrait("dry") }),
    latch: Object.freeze({ procedural: latchPortrait("procedural"), startled: latchPortrait("startled"), dry: latchPortrait("dry"), soft: latchPortrait("soft"), urgent: latchPortrait("urgent") }),
    // TALL HOOD: droopy hood, lazy eyes in the mask's slot, strings uneven.
    "hood-tall": Object.freeze({
      neutral: svg(`${disc("#120f0d", "#2a1c10", P.sodium[0], 46, 14)}${rainLines}
<path d="M4 64 L8 50 Q14 44 24 43 L42 43 Q52 45 56 52 L60 64 Z" fill="${P.cloth[2]}" ${ink}/>
<path d="M36 43 L42 43 Q52 45 56 52 L60 64 L40 64 Z" fill="${P.cloth[1]}"/>
<path d="M14 48 Q8 26 20 12 Q30 4 42 8 Q52 14 50 30 Q49 40 46 46 L16 47 Z" fill="${P.cloth[2]}" ${ink}/>
<path d="M18 46 Q16 30 24 22 Q34 16 44 22 Q48 32 44 46 Z" fill="${P.ink}"/>
<path d="M22 31 H44 V36 H22 Z" fill="${P.cloth[0]}"/>
<path d="M25 34 q3 -2 6 0 M34 34 q3 -2 6 0" stroke="${P.paper[2]}" stroke-width="2.2" fill="none"/>
<path d="M24 33 h7 M34 33 h7" stroke="${P.cloth[1]}" stroke-width="1.6"/>
<path d="M26 47 L25 60 M36 47 L37 52" stroke="${P.paper[2]}" stroke-width="1.6"/>
<path d="M40 8 Q48 12 52 22" stroke="${P.cloth[3]}" stroke-width="2" fill="none"/>`)
    }),
    // SMALL HOOD: beanie and pom, crooked slot, wide eyes lit by his own phone.
    "hood-small": Object.freeze({
      neutral: svg(`${disc("#120f0d", "#2a1c10", P.sodium[0], 46, 14)}${rainLines}
<path d="M6 64 L9 50 Q16 44 32 44 Q48 44 55 50 L58 64 Z" fill="${P.a.maroon}" ${ink}/>
<path d="M9 52 H56 M8 60 H58" stroke="${P.ink}" stroke-width="1.4"/><path d="M14 47 Q32 43 50 47" stroke="${P.a.maroonLight}" stroke-width="2.4" fill="none"/>
<circle cx="31" cy="31" r="14" fill="${P.ink}" ${ink}/>
<path d="M19 28 L44 25 L45 31 L20 34 Z" fill="${P.cloth[0]}"/>
<circle cx="26" cy="30.5" r="3" fill="${P.paper[3]}"/><circle cx="37.5" cy="29.5" r="3" fill="${P.paper[3]}"/>
<circle cx="26.4" cy="31" r="1.2" fill="${P.ink}"/><circle cx="37.9" cy="30" r="1.2" fill="${P.ink}"/>
<path d="M16 24 Q16 9 31 8 Q46 9 46 24 Z" fill="${P.a.mustard}" ${ink}/>
<path d="M15 24 H47 V20 H15 Z" fill="${P.a.mustard}" ${ink} stroke-width="1.8"/><circle cx="31" cy="6" r="4" fill="${P.a.mustard}" ${ink} stroke-width="1.8"/>
<path d="M45 64 L48 44 L58 45 L56 64 Z" fill="${P.ink}" ${ink} stroke-width="1.6"/><path d="M48.5 47 L56.5 47.6 L55 62 L47 62 Z" fill="${P.fluoro[2]}"/>
<path d="M22 37 Q31 41 40 36" stroke="${P.fluoro[1]}" stroke-width="1.6" opacity=".55" fill="none"/>`)
    }),
    // DRIVER: as he sits in the van: rust chore coat, cream fleece collar,
    // black ski mask with a rolled cuff, sunglasses at night, a gloved hand on the wheel.
    driver: Object.freeze({
      neutral: svg(`${disc(P.night[0], P.service[0], P.service[1], 32, 28)}
<path d="M4 64 L8 50 Q16 43 32 43 Q48 43 56 50 L60 64 Z" fill="${P.a.rust}" ${ink}/>
<path d="M40 44 Q50 46 56 50 L60 64 L44 64 Z" fill="${P.wood[1]}"/>
<path d="M11 53 L21 43 L31 46 L25 61 Z" fill="${P.paper[2]}" ${ink} stroke-width="1.8"/><path d="M53 53 L43 43 L33 46 L39 61 Z" fill="${P.paper[2]}" ${ink} stroke-width="1.8"/>
<path d="M17 51 h.1 M22 48 h.1 M21 54 h.1 M46 51 h.1 M41 48 h.1 M42 54 h.1" stroke="${P.paper[0]}" stroke-width="2" stroke-linecap="round"/>
<circle cx="32" cy="28" r="15" fill="${P.ink}" ${ink}/>
<path d="M17 21 Q32 10 47 21 L46 16 Q32 6 18 16 Z" fill="${P.cloth[1]}" ${ink} stroke-width="1.6"/>
<path d="M15 26 H49 L48 33 Q41 35 36 32 L28 32 Q23 35 16 33 Z" fill="${P.metal[3]}" ${ink} stroke-width="1.8"/>
<path d="M20 28 h6 M38 28 h6" stroke="#ffffff" stroke-width="1.6"/>
<ellipse cx="32" cy="38.5" rx="3.4" ry="1.8" fill="${P.cloth[1]}"/>
<path d="M2 64 Q14 52 30 54 Q46 56 58 64" stroke="${P.ink}" stroke-width="5" fill="none"/><path d="M2 64 Q14 52 30 54 Q46 56 58 64" stroke="${P.cloth[2]}" stroke-width="2.4" fill="none"/>
<circle cx="47" cy="58" r="3.8" fill="${P.ink}" ${ink} stroke-width="1.6"/><path d="M45 56.5 h4" stroke="${P.cloth[2]}" stroke-width="1.2"/>
<path d="M20 50 Q32 46 44 50" stroke="${P.service[3]}" stroke-width="1.4" opacity=".5" fill="none"/>`)
    })
  });

  return Object.freeze({
    P, RULES, HEIGHT, rng, seedOf, trace, inkStroke, shape, box, oval, line, rect, drop,
    tape, stitches, rivet, worn, label,
    concrete, asphalt, tiles, planks, wallFace, block, metalPanel, clip,
    createLighting, flame, hearth,
    keeper, van, hood, seated, vanRide, CREW_HEIGHT, youSeated, cart, latch, nell, orr, porter, lantern, draftling, needle, cooler, bowl,
    PORTRAITS
  });
});
