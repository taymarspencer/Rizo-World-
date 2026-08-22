/*
  Rizo Defense Canvas Renderer — v80 Strategy & Feel
  ----------------------------------
  Presentation only. Simulation remains in game-v79-defense.js.
  The renderer never owns HP, path progress, targeting, rewards, or timing.
*/
(() => {
  "use strict";

  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value) || 0));
  const TAU = Math.PI * 2;

  function roundedRect(ctx, x, y, w, h, r) {
    const radius = Math.min(Math.abs(r), Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function colorWithAlpha(color, alpha) {
    if (!color || color[0] !== "#") return color || `rgba(255,255,255,${alpha})`;
    const raw = color.slice(1);
    const hex = raw.length === 3 ? raw.split("").map(c => c + c).join("") : raw.slice(0, 6);
    const n = Number.parseInt(hex, 16);
    if (!Number.isFinite(n)) return color;
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
  }

  class DefenseCanvasRenderer {
    constructor(canvas, options = {}) {
      this.canvas = canvas;
      this.ctx = canvas?.getContext?.("2d", { alpha: true, desynchronized: true }) || canvas?.getContext?.("2d") || null;
      this.width = 0;
      this.height = 0;
      this.dpr = 1;
      this.unitScale = 1;
      this.lastTier = -1;
      this.enabled = Boolean(this.ctx);
      this.stats = { frames: 0, enemies: 0, projectiles: 0, effects: 0, resizes: 0 };
      this.options = options;
    }

    resize(cssWidth, cssHeight, tier = 0) {
      if (!this.enabled) return false;
      const width = Math.max(1, Math.round(cssWidth || this.canvas.clientWidth || 1));
      const height = Math.max(1, Math.round(cssHeight || this.canvas.clientHeight || 1));
      const device = Math.max(1, Number(globalThis.devicePixelRatio) || 1);
      // A phone does not need a 3x backing store for small cartoon balloons. Q1
      // deliberately lowers pixel density before gameplay logic is touched.
      const cap = tier >= 2 ? 1.08 : tier === 1 ? 1.5 : 2.0;
      const dpr = Math.min(device, cap);
      if (width === this.width && height === this.height && Math.abs(dpr - this.dpr) < .01 && tier === this.lastTier) return false;
      this.width = width;
      this.height = height;
      this.dpr = dpr;
      this.lastTier = tier;
      this.unitScale = Math.max(.82, Math.min(1.18, width / 390));
      this.canvas.width = Math.max(1, Math.round(width * dpr));
      this.canvas.height = Math.max(1, Math.round(height * dpr));
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.ctx.imageSmoothingEnabled = true;
      if ("imageSmoothingQuality" in this.ctx) this.ctx.imageSmoothingQuality = "high";
      this.stats.resizes += 1;
      return true;
    }

    clear() {
      if (!this.enabled) return;
      this.ctx.clearRect(0, 0, this.width, this.height);
    }

    point(entity, alpha = 1) {
      const x = Number.isFinite(entity?.prevX) ? entity.prevX + (entity.x - entity.prevX) * alpha : Number(entity?.x) || 0;
      const y = Number.isFinite(entity?.prevY) ? entity.prevY + (entity.y - entity.prevY) * alpha : Number(entity?.y) || 0;
      return { x: x * this.width, y: y * this.height };
    }

    drawProjectile(shot, alpha = 1) {
      const ctx = this.ctx;
      const p = this.point(shot, alpha);
      const r = shot.doctrineStrike ? 4.3 : 3.1;
      const color = shot.renderColor || "#fff2cf";
      const dx = (Number(shot.x) || 0) - (Number(shot.prevX) || Number(shot.x) || 0);
      const dy = (Number(shot.y) || 0) - (Number(shot.prevY) || Number(shot.y) || 0);
      const len = Math.hypot(dx, dy);
      ctx.save();
      ctx.globalAlpha = shot.doctrineStrike ? .96 : .88;
      ctx.strokeStyle = colorWithAlpha(color, .58);
      ctx.lineWidth = shot.doctrineStrike ? 3 : 2;
      ctx.lineCap = "round";
      if (len > .0001) {
        const nx = dx / len, ny = dy / len;
        const trail = shot.doctrineStrike ? 14 : 8;
        ctx.beginPath();
        ctx.moveTo(p.x - nx * trail, p.y - ny * trail);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
      ctx.fillStyle = "#fffdf7";
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "#17151b";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    drawEnemy(enemy, alpha = 1, gameTime = 0, tier = 0) {
      const ctx = this.ctx;
      const p = this.point(enemy, alpha);
      const boss = Boolean(enemy.bossId);
      const scale = this.unitScale * (boss ? 1.62 : enemy.type === "brick" ? 1.18 : enemy.type === "lead" ? 1.14 : enemy.type === "shell" ? 1.08 : enemy.type === "fleet" ? .84 : 1);
      const w = (boss ? 40 : 34) * scale;
      const h = (boss ? 52 : 43) * scale;
      const color = enemy.renderColor || "#ff5b68";
      const health = clamp(enemy.hp / Math.max(.001, enemy.maxHp), 0, 1);
      const camo = Boolean(enemy.renderCamo);
      const phase = Boolean(enemy.phaseActive);
      const revealed = Boolean(enemy.renderRevealed);
      const hit = Number(enemy.hitFlash) > 0;
      const skin = enemy.renderSkin || "clean";
      const alphaBase = phase ? .43 : camo ? .58 : 1;
      const bob = tier >= 2 ? 0 : (enemy.bossId ? Math.sin((gameTime * 4.2) + (enemy.phaseOffset || 0)) * .28 * scale : 0);
      const x = p.x, y = p.y + bob;

      ctx.save();
      ctx.globalAlpha = alphaBase;

      // Grounding shadow is intentionally cheap and communicates route contact.
      if (tier < 2) {
        ctx.fillStyle = "rgba(10,8,14,.18)";
        ctx.beginPath();
        ctx.ellipse(x, y + h * .42, w * .36, h * .09, 0, 0, TAU);
        ctx.fill();
      }

      // Balloon body.
      ctx.beginPath();
      ctx.ellipse(x, y, w * .5, h * .5, enemy.type === "fleet" ? .045 : 0, 0, TAU);
      ctx.fillStyle = hit ? "#fff7e6" : color;
      ctx.fill();
      ctx.lineWidth = boss ? 2.55 : enemy.type === "shell" ? 2.15 : 1.8;
      ctx.strokeStyle = "#111019";
      ctx.stroke();

      // Cheap identity texture for armor/split classes, no filters or gradients.
      if (enemy.type === "lead" && tier < 2) {
        ctx.save();ctx.clip();ctx.fillStyle="rgba(35,43,52,.30)";ctx.fillRect(x-w*.5,y-h*.5,w,h);ctx.strokeStyle="#d7dde4";ctx.lineWidth=2.3;for(const oy of [-.24,.06,.34]){ctx.beginPath();ctx.moveTo(x-w*.43,y+h*oy);ctx.lineTo(x+w*.43,y+h*oy);ctx.stroke();}ctx.restore();
      } else if (enemy.type === "brick" && tier < 2) {
        ctx.save();ctx.clip();ctx.strokeStyle="#6d3427";ctx.lineWidth=2.1;for(const oy of [-.25,.02,.28]){ctx.beginPath();ctx.moveTo(x-w*.48,y+h*oy);ctx.lineTo(x+w*.48,y+h*oy);ctx.stroke();}for(const ox of [-.25,.18]){ctx.beginPath();ctx.moveTo(x+w*ox,y-h*.48);ctx.lineTo(x+w*(ox+.08),y+h*.48);ctx.stroke();}ctx.restore();
      } else if (enemy.type === "shell" && tier < 2) {
        ctx.save();
        ctx.clip();
        ctx.strokeStyle = colorWithAlpha("#fff2cf", .25);
        ctx.lineWidth = 3;
        for (let ix = x - w; ix < x + w; ix += 8 * scale) {
          ctx.beginPath(); ctx.moveTo(ix, y - h); ctx.lineTo(ix + h, y + h); ctx.stroke();
        }
        ctx.restore();
      } else if (enemy.type === "split" && tier < 2) {
        ctx.fillStyle = "#ffb5e1";
        ctx.strokeStyle = "#111019";
        ctx.lineWidth = 1.65;
        ctx.beginPath();
        ctx.arc(x + w * .43, y - h * .08, w * .18, 0, TAU);
        ctx.fill(); ctx.stroke();
      }

      // Status art is clipped to the balloon, preventing the square-edge bug.
      if (skin !== "clean" && skin !== "cracked" && skin !== "shredded") {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(x, y, w * .47, h * .47, 0, 0, TAU);
        ctx.clip();
        if (skin === "burn") {
          ctx.fillStyle = "rgba(54,27,24,.52)";ctx.fillRect(x-w*.5,y+h*.06,w,h*.5);ctx.fillStyle = "#ff7a38";for (const ox of [-.28,0,.28]) {ctx.beginPath();ctx.moveTo(x+w*ox-w*.10,y+h*.42);ctx.quadraticCurveTo(x+w*ox-w*.04,y+h*.08,x+w*ox,y-h*.06);ctx.quadraticCurveTo(x+w*ox+w*.10,y+h*.18,x+w*ox+w*.11,y+h*.42);ctx.closePath();ctx.fill();}ctx.fillStyle="#ffd45a";ctx.beginPath();ctx.ellipse(x,y+h*.31,w*.13,h*.13,0,0,TAU);ctx.fill();
        } else if (skin === "poison") {
          ctx.fillStyle = "rgba(109,255,92,.35)";ctx.fillRect(x-w*.5,y-h*.5,w,h);
          ctx.fillStyle = "#8cff6a";
          for (const [ox, oy, r] of [[-.22,-.17,.10],[.20,.04,.085],[-.03,.27,.075]]) {ctx.beginPath();ctx.arc(x+w*ox,y+h*oy,w*r,0,TAU);ctx.fill();ctx.strokeStyle="#286f37";ctx.lineWidth=1;ctx.stroke();}
        } else if (skin === "frost") {
          ctx.strokeStyle = "#d9fbff";ctx.lineWidth=2.5;for(let i=0;i<7;i++){const a=i*TAU/7,ex=x+Math.cos(a)*w*.43,ey=y+Math.sin(a)*h*.43;ctx.beginPath();ctx.moveTo(ex,ey);ctx.lineTo(x+Math.cos(a)*w*.25,y+Math.sin(a)*h*.25);ctx.stroke();}
        } else if (skin === "root") {
          ctx.strokeStyle = "#79c76a"; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(x, y+h*.29, w*.33, Math.PI*.08, Math.PI*.92); ctx.stroke();
        }
        ctx.restore();
      }

      if (skin === "cracked" || skin === "shredded") {
        ctx.strokeStyle = skin === "cracked" ? "#fff2cf" : "#ffd06a";
        ctx.lineWidth = 2.2;
        for(const offset of [-.18,.08,.24]){ctx.beginPath();ctx.moveTo(x+w*offset,y-h*.43);ctx.lineTo(x+w*(offset+.07),y-h*.17);ctx.lineTo(x+w*(offset-.04),y+h*.05);ctx.lineTo(x+w*(offset+.08),y+h*.34);ctx.stroke();}
      }

      // Face — tiny, low, and unmistakably Rizo-adjacent without relying on text.
      ctx.fillStyle = "#111019";
      const faceY = y + h * .09;
      ctx.beginPath(); ctx.ellipse(x-w*.13, faceY-h*.05, Math.max(1.7,w*.035), Math.max(2.3,h*.05), 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x+w*.13, faceY-h*.05, Math.max(1.7,w*.035), Math.max(2.3,h*.05), 0, 0, TAU); ctx.fill();
      ctx.lineWidth = 1.25; ctx.strokeStyle = "#111019";
      ctx.beginPath(); ctx.moveTo(x-w*.08,faceY+h*.08);ctx.lineTo(x+w*.08,faceY+h*.16);ctx.moveTo(x+w*.08,faceY+h*.08);ctx.lineTo(x-w*.08,faceY+h*.16);ctx.stroke();

      // Shine is a single opaque mark instead of a filter/shadow stack.
      if (tier < 2) {
        ctx.fillStyle = "rgba(255,255,255,.28)";
        ctx.beginPath(); ctx.ellipse(x-w*.20,y-h*.22,w*.08,h*.12,-.45,0,TAU);ctx.fill();
      }

      // Knot/string remain tiny; body itself is centered on the route coordinate.
      ctx.fillStyle = "#111019";
      ctx.beginPath();
      ctx.moveTo(x-4*scale,y+h*.48);ctx.lineTo(x+4*scale,y+h*.48);ctx.lineTo(x,y+h*.62);ctx.closePath();ctx.fill();
      if (tier < 2) {
        ctx.strokeStyle = "#2b2930"; ctx.lineWidth = 1.3;
        ctx.beginPath();ctx.moveTo(x,y+h*.58);ctx.lineTo(x+Math.sin(gameTime*6+enemy.phaseOffset)*2,y+h*.76);ctx.stroke();
      }

      if (boss) {
        ctx.save();ctx.strokeStyle="#111019";ctx.lineWidth=2;ctx.fillStyle="#ffd45a";const cy=y-h*.28;
        if(enemy.bossId==="crown"){ctx.beginPath();ctx.moveTo(x-w*.28,cy+h*.08);ctx.lineTo(x-w*.22,cy-h*.06);ctx.lineTo(x-w*.07,cy+h*.02);ctx.lineTo(x,cy-h*.10);ctx.lineTo(x+w*.08,cy+h*.02);ctx.lineTo(x+w*.23,cy-h*.06);ctx.lineTo(x+w*.28,cy+h*.08);ctx.closePath();ctx.fill();ctx.stroke();}
        else if(enemy.bossId==="vortex"){for(let r=.08;r<.28;r+=.07){ctx.beginPath();ctx.arc(x,cy,w*r,0,Math.PI*1.55);ctx.stroke();}}
        else if(enemy.bossId==="mirror"){ctx.beginPath();ctx.moveTo(x,cy-h*.12);ctx.lineTo(x+w*.18,cy);ctx.lineTo(x,cy+h*.12);ctx.lineTo(x-w*.18,cy);ctx.closePath();ctx.fill();ctx.stroke();}
        else{ctx.beginPath();ctx.moveTo(x,cy-h*.12);ctx.lineTo(x+w*.16,cy+h*.10);ctx.lineTo(x,cy+h*.04);ctx.lineTo(x-w*.16,cy+h*.10);ctx.closePath();ctx.fill();ctx.stroke();}
        ctx.restore();
      }

      if (enemy.telegraphKind) {
        const progress = clamp(enemy.telegraphDisruption || 0);
        ctx.globalAlpha = .94;
        ctx.strokeStyle = progress >= .66 ? "#73e890" : "#ff657c";
        ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.arc(x,y,Math.max(w,h)*.62,-Math.PI/2,-Math.PI/2+TAU*(1-progress));ctx.stroke();
      }

      if (health < .995) {
        const barW = Math.max(20,w*.92), barH = boss ? 5 : 4, by = y + h*.62;
        roundedRect(ctx,x-barW/2,by,barW,barH,barH/2);ctx.fillStyle="#111019";ctx.fill();
        roundedRect(ctx,x-barW/2+1,by+1,(barW-2)*health,Math.max(2,barH-2),(barH-2)/2);ctx.fillStyle=health<.28?"#ff657c":health<.55?"#ffd45a":"#73e890";ctx.fill();
      }

      if (revealed && tier < 2) {
        ctx.globalAlpha = .75;
        ctx.strokeStyle = "#ffffff";ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,Math.max(w,h)*.56,0,TAU);ctx.stroke();
      }
      ctx.restore();
    }

    drawEffect(effect, gameTime, tier = 0) {
      const ctx = this.ctx;
      const start = Number(effect.startedAt) || 0;
      const end = Math.max(start + .001, Number(effect.expiresAt) || start + .2);
      const t = clamp((gameTime - start) / (end - start));
      if (t >= 1) return;
      const x = clamp(effect.x,0,1)*this.width, y=clamp(effect.y,0,1)*this.height;
      const kind=String(effect.kind||"classic"), color=effect.color||"#fff2cf", major=Boolean(effect.major);
      const radius=(major?20:12)*(0.55+t*.75)*this.unitScale;
      ctx.save();ctx.globalAlpha=(1-t)*(.92);
      ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=major?3:2;
      if(kind==="frost"){
        for(let i=0;i<4;i++){ctx.save();ctx.translate(x,y);ctx.rotate(Math.PI/4+i*Math.PI/2);ctx.beginPath();ctx.moveTo(-radius*.7,0);ctx.lineTo(radius*.7,0);ctx.stroke();ctx.restore();}
      }else if(kind==="moss"){
        ctx.beginPath();ctx.ellipse(x-radius*.35,y,radius*.45,radius*.22,-.55,0,TAU);ctx.fill();ctx.beginPath();ctx.ellipse(x+radius*.35,y+radius*.15,radius*.38,radius*.18,.55,0,TAU);ctx.fill();
      }else if(kind==="toxic"){
        for(const [ox,oy,s] of [[-.4,-.15,.22],[.25,.3,.18],[.25,-.3,.14]]){ctx.beginPath();ctx.arc(x+radius*ox,y+radius*oy,radius*s,0,TAU);ctx.fill();}
      }else if(kind==="armor"||kind==="power"){
        ctx.beginPath();ctx.moveTo(x-radius*.65,y-radius*.45);ctx.lineTo(x-radius*.1,y-radius*.05);ctx.lineTo(x-radius*.35,y+radius*.55);ctx.moveTo(x+radius*.12,y-radius*.55);ctx.lineTo(x+radius*.45,y);ctx.lineTo(x+radius*.05,y+radius*.52);ctx.stroke();
      }else{
        ctx.beginPath();ctx.arc(x,y,radius,0,TAU);ctx.stroke();
        if(tier<2){for(let i=0;i<(major?6:4);i++){const a=i*TAU/(major?6:4)+.3;const rr=radius*(.65+t*.55);ctx.beginPath();ctx.arc(x+Math.cos(a)*rr,y+Math.sin(a)*rr,major?2.5:1.8,0,TAU);ctx.fill();}}
      }
      ctx.restore();
    }

    render({ enemies = [], projectiles = [], effects = [], alpha = 1, gameTime = 0, tier = 0, width, height } = {}) {
      if (!this.enabled) return false;
      this.resize(width || this.canvas.clientWidth, height || this.canvas.clientHeight, tier);
      this.clear();
      this.stats.frames += 1;
      this.stats.projectiles = 0; this.stats.enemies = 0; this.stats.effects = 0;
      for (const shot of projectiles) {
        if (!shot || shot.renderVisible === false) continue;
        this.drawProjectile(shot, alpha); this.stats.projectiles += 1;
      }
      for (const enemy of enemies) {
        if (!enemy || enemy.dead || enemy.hp <= 0) continue;
        this.drawEnemy(enemy, alpha, gameTime, tier); this.stats.enemies += 1;
      }
      for (const effect of effects) {
        if (!effect || Number(effect.expiresAt) <= gameTime) continue;
        this.drawEffect(effect, gameTime, tier); this.stats.effects += 1;
      }
      return true;
    }

    snapshot() { return { enabled: this.enabled, width:this.width, height:this.height, dpr:this.dpr, ...this.stats }; }
    destroy() { this.clear(); this.enabled = false; this.ctx = null; }
  }

  function create(canvas, options) { return new DefenseCanvasRenderer(canvas, options); }
  globalThis.RizoDefenseCanvas = Object.freeze({ create, DefenseCanvasRenderer });
})();
