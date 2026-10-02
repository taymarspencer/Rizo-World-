/*
  RIZO CATALOG
  ============
  Static content shared by the hub and every game mode: the collectible Rizo
  variants (id, name, rarity, capsule weight, colour, sprite). Pure data,
  frozen, loaded before anything that reads it. Ids are save-compatible and
  must never be renamed.
*/
(function initRizoCatalog(root, factory) {
  const catalog = factory();
  if (typeof module === "object" && module.exports) module.exports = catalog;
  if (root) Object.defineProperty(root, "RizoCatalog", { value: catalog, configurable: true });
})(typeof globalThis !== "undefined" ? globalThis : this, function createRizoCatalog() {
  "use strict";
  const VARIANTS = Object.freeze([
    Object.freeze({ id: "classic", name: "CLASSIC BLUE", rarity: "COMMON", weight: 39, color: "#16c8ff", sprite: "./assets/rizo-classic.png", source: "CAPSULE" }),
    Object.freeze({ id: "ember", name: "EMBER RED", rarity: "UNCOMMON", weight: 17, color: "#ff4f3d", sprite: "./assets/rizo-ember.png", source: "CAPSULE" }),
    Object.freeze({ id: "toxic", name: "TOXIC LIME", rarity: "RARE", weight: 10, color: "#8dff45", sprite: "./assets/rizo-toxic.png", source: "CAPSULE" }),
    Object.freeze({ id: "violet", name: "VOID VIOLET", rarity: "RARE", weight: 7.5, color: "#a46cff", sprite: "./assets/rizo-violet.png", source: "CAPSULE" }),
    Object.freeze({ id: "moss", name: "MOSS RIZO", rarity: "RARE", weight: 4.5, color: "#48c46f", sprite: "./assets/rizo-moss.png", source: "FOREST + CAPSULE" }),
    Object.freeze({ id: "bubblegum", name: "BUBBLEGUM", rarity: "EPIC", weight: 5.5, color: "#ff64c8", sprite: "./assets/rizo-bubblegum.png", source: "CAPSULE" }),
    Object.freeze({ id: "frost", name: "FROSTBITE", rarity: "EPIC", weight: 4.5, color: "#b7f4ff", sprite: "./assets/rizo-frost.png", source: "CAPSULE" }),
    Object.freeze({ id: "glitch", name: "GLITCH RIZO", rarity: "MYTHIC", weight: 3.2, color: "#33ffe0", sprite: "./assets/rizo-glitch.png", source: "CAPSULE" }),
    Object.freeze({ id: "obsidian", name: "OBSIDIAN", rarity: "MYTHIC", weight: 2.1, color: "#26304b", sprite: "./assets/rizo-obsidian.png", source: "CAPSULE" }),
    Object.freeze({ id: "aurora", name: "AURORA RIZO", rarity: "MYTHIC", weight: 1.5, color: "#7df4ff", sprite: "./assets/rizo-aurora.png", source: "PRISM CAPSULE", prismOnly: true }),
    Object.freeze({ id: "golden", name: "GOLDEN RIZO", rarity: "LEGENDARY", weight: 1.25, color: "#ffd54a", sprite: "./assets/rizo-golden.png", source: "CAPSULE" }),
    Object.freeze({ id: "diamond", name: "DIAMOND RIZO", rarity: "SECRET", weight: .4, color: "#dffbff", sprite: "./assets/rizo-diamond.png", source: "CAPSULE" }),
    Object.freeze({ id: "retro", name: "RETRO RIZO", rarity: "SECRET", weight: .35, color: "#18c8ff", sprite: "./assets/rizo-retro.png", source: "ARCADE SIGNAL", pixel: true, capsule: false }),
    Object.freeze({ id: "shadow", name: "SHADOW RIZO", rarity: "FOREST SECRET", weight: 0, color: "#7954ff", sprite: "./assets/rizo-shadow.png", source: "DEEP FOREST", capsule: false })
  ]);
  const VARIANT_BY_ID = Object.freeze(Object.fromEntries(VARIANTS.map(variant => [variant.id, variant])));
  return Object.freeze({ VARIANTS, variant: id => VARIANT_BY_ID[id] || null });
});
