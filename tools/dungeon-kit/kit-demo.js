/* Greybox driver for modes/dungeon/kit/dungeon-kit.js. Dev only (?dev=1).
   Draws plain shapes: the kit's rules are what is being proven here. */
(function () {
  "use strict";
  const Kit = window.RizoDungeonKit, Core = window.RizoDungeonCore;
  if (!new URLSearchParams(location.search).has("dev")) { document.getElementById("gate").hidden = false; return; }
  const canvas = document.getElementById("kit"), hud = document.getElementById("hud"), ctx = canvas.getContext("2d");
  canvas.hidden = false;
  const keys = new Set();
  addEventListener("keydown", e => { keys.add(e.key.toLowerCase()); if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(e.key.toLowerCase())) e.preventDefault(); });
  addEventListener("keyup", e => keys.delete(e.key.toLowerCase()));
  const axis = () => ({ x: (keys.has("arrowright") || keys.has("d") ? 1 : 0) - (keys.has("arrowleft") || keys.has("a") ? 1 : 0), y: (keys.has("arrowdown") || keys.has("s") ? 1 : 0) - (keys.has("arrowup") || keys.has("w") ? 1 : 0) });
  let pressed = new Set();
  const once = key => { if (keys.has(key) && !pressed.has(key)) { pressed.add(key); return true; } if (!keys.has(key)) pressed.delete(key); return false; };
  const F = Kit.FACTORY;
  let stage = "cage", t = 0, me = null, cage = null, vents = null, watchers = [], chase = null, note = "";
  const say = text => { note = text; };
  function moveIn(room, speed = 80) {
    const a = axis(), l = Math.hypot(a.x, a.y) || 1;
    const before = { x: me.x, y: me.y };
    [me.x, me.y] = Core.moveCircle({ w: room.w, h: room.h, solids: room.solids }, me.x, me.y, 7, (a.x / l) * speed * Kit.STEP_MS / 1000, (a.y / l) * speed * Kit.STEP_MS / 1000);
    me.moving = Math.hypot(me.x - before.x, me.y - before.y) > 0.05;
    me.flaring = keys.has(" ");
  }
  function start(name) {
    stage = name; t = 0;
    if (name === "cage") { cage = Kit.createCage(); say("Caged. The guard looks at you, then away. Rattle (Z) only while he looks away."); }
    if (name === "vents") { vents = Kit.createVents(F.vents); say("The vents. Stay still on a grate to look down."); }
    if (name === "floor") { me = { ...F.floor.start }; watchers = F.floor.watchers.map(w => Kit.createWatcher(w)); say("The factory floor. Lockers hide you. Shadow hides you only if you keep still."); }
    if (name === "run") { me = { ...F.run.start }; chase = Kit.createChase({ from: { x: 8, y: 80 }, goal: F.run.goal }); say("RUN."); }
  }
  function step() {
    t += Kit.STEP_MS;
    if (stage === "cage") {
      for (const e of Kit.stepCage(cage, { rattle: once("z") }, t)) {
        if (e === "noticed") say("He saw that. The door tightens.");
        if (e === "loosened") say(`The door gives a little (${cage.loose}/${cage.def.notches}).`);
        if (e === "open") { say("Open. Into the vent."); setTimeout(() => start("vents"), 600); }
      }
    } else if (stage === "vents") {
      const a = axis();
      for (const e of Kit.stepVents(vents, { moveX: a.x, moveY: a.y }, t)) {
        if (e.startsWith("view:")) say(F.vents.views[e.slice(5)]);
        if (e === "out") start("floor");
      }
    } else if (stage === "floor") {
      moveIn(F.floor);
      for (const w of watchers) for (const e of Kit.stepWatcher(w, me, F.floor, t)) {
        if (e === "spotted") say("A lamp finds you. Break its line!");
        if (e === "caught") { say("Caught. Again from the vent hatch."); start("floor"); return; }
      }
      const x = F.floor.exit;
      if (me.x > x.x && me.y > x.y) start("run");
    } else if (stage === "run") {
      moveIn(F.run, 82);
      for (const e of Kit.stepChase(chase, me, t)) {
        if (e === "caught") { say("It had you. Again."); start("run"); return; }
        if (e === "escaped") say("Out. (End of the greybox slice.)");
      }
    }
  }
  function draw() {
    const room = stage === "floor" ? F.floor : stage === "run" ? F.run : stage === "cage" ? F.cage : null;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = "#0b0d12"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (stage === "vents") {
      const cell = 52;
      vents.rows.forEach((row, y) => row.forEach((c, x) => { ctx.fillStyle = c === "#" ? "#1b1e24" : c === "G" ? "#5f7685" : c === "E" ? "#2f5b40" : "#2c313d"; ctx.fillRect(40 + x * cell, 20 + y * cell, cell - 2, cell - 2); }));
      ctx.fillStyle = "#ffaf4a"; ctx.beginPath(); ctx.arc(40 + vents.x * cell + 25, 20 + vents.y * cell + 25, 12, 0, Math.PI * 2); ctx.fill();
    } else if (room) {
      const s = Math.min(canvas.width / room.w, canvas.height / room.h);
      ctx.setTransform(s, 0, 0, s, 0, 0);
      for (const r of room.solids) { ctx.fillStyle = r.kind === "machine" ? "#3f4b53" : r.kind === "crate" ? "#47301f" : "#1b1e24"; ctx.fillRect(r.x, r.y, r.w, r.h); }
      for (const h of room.hides || []) { ctx.fillStyle = h.still ? "rgba(0,0,0,.6)" : "#262a31"; ctx.fillRect(h.x, h.y, h.w, h.h); }
      if (stage === "cage") {
        const c = room.cage; ctx.strokeStyle = cage.open ? "#2f5b40" : "#9fadb5"; ctx.lineWidth = 2;
        for (let x = c.x; x <= c.x + c.w; x += 8) { ctx.beginPath(); ctx.moveTo(x, c.y); ctx.lineTo(x, c.y + c.h); ctx.stroke(); }
        ctx.fillStyle = "#ffaf4a"; ctx.beginPath(); ctx.arc(c.x + c.w / 2, c.y + c.h / 2, 8, 0, Math.PI * 2); ctx.fill();
        const g = room.guard, looking = cage.phase === "watch", tell = Kit.cageTell(cage, t);
        ctx.fillStyle = "#5f7685"; ctx.fillRect(g.x - 8, g.y - 20, 16, 30);
        ctx.fillStyle = looking ? "rgba(238,245,249,.35)" : tell ? "rgba(224,112,42,.3)" : "rgba(238,245,249,.06)";
        ctx.beginPath(); ctx.moveTo(g.x, g.y - 12); ctx.lineTo(c.x + c.w, c.y - 10); ctx.lineTo(c.x + c.w, c.y + c.h + 10); ctx.closePath(); ctx.fill();
      }
      for (const w of watchers) if (stage === "floor") {
        const pts = Kit.Stealth.cone(w, F.floor, w.def);
        ctx.fillStyle = w.state === "spot" ? "rgba(238,245,249,.4)" : "rgba(184,201,212,.18)";
        ctx.beginPath(); ctx.moveTo(w.x, w.y); for (const p of pts) ctx.lineTo(p.x, p.y); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#9fadb5"; ctx.fillRect(w.x - 6, w.y - 6, 12, 12);
      }
      if (stage === "floor") { const x = F.floor.exit; ctx.fillStyle = "#2f5b40"; ctx.fillRect(x.x, x.y, x.w, x.h); }
      if (stage === "run") { const gl = F.run.goal; ctx.fillStyle = "#2f5b40"; ctx.fillRect(gl.x, gl.y, gl.w, gl.h); ctx.fillStyle = "#b8352f"; ctx.beginPath(); ctx.arc(chase.x, chase.y, 9, 0, Math.PI * 2); ctx.fill(); }
      if (me && stage !== "cage") { ctx.fillStyle = me.flaring ? "#ffe2a0" : "#ffaf4a"; ctx.beginPath(); ctx.arc(me.x, me.y, 7, 0, Math.PI * 2); ctx.fill(); }
    }
    hud.innerHTML = `<b>${stage.toUpperCase()}</b> — ${note}`;
  }
  let last = performance.now(), acc = 0;
  function frame(now) {
    acc += Math.min(100, now - last); last = now;
    while (acc >= Kit.STEP_MS) { step(); acc -= Kit.STEP_MS; }
    draw(); requestAnimationFrame(frame);
  }
  window.RizoDungeonKitDemo = { start, state: () => ({ stage, note, me, cage: cage && { loose: cage.loose, phase: cage.phase, open: cage.open }, vents: vents && { x: vents.x, y: vents.y, view: vents.view } }) };
  start("cage"); requestAnimationFrame(frame);
})();
