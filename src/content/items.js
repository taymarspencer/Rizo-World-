function legacyItems(type, path, rows, tags = []) {
  return rows.map(([legacyKey, name]) => ({
    id: `item.${type}.${legacyKey}`,
    name,
    type,
    source: "legacy",
    tags: [type, ...tags],
    binding: { kind: "global-record", path: `RizoLegacyRuntime.content.${path}`, value: legacyKey }
  }));
}

const foods = [
  ["crumbs", "Pocket Crumbs"], ["bites", "Rizo Bites"], ["cereal", "Ember Cereal"],
  ["moonfruit", "Moon Fruit"], ["pixelpizza", "Pixel Pizza"], ["wings", "Forest Wings"],
  ["ghostmallow", "Ghost Mallow"], ["soup", "Emergency Soup"], ["diamond", "Diamond Donut"],
  ["feast", "Legend Feast"], ["meds", "Suspicious Medicine"], ["calm", "Calming Fizz"]
];

const wearables = [
  ["none", "No Wearable"], ["bandana", "Red Bandana"], ["beanie", "Rizo Beanie"],
  ["shades", "Block Shades"], ["flower", "Moon Flower"], ["eyepatch", "Forest Eyepatch"],
  ["headphones", "Bass Headphones"], ["chain", "Rizo Chain"], ["scarf", "Rain Scarf"],
  ["horns", "Little Horns"], ["halo", "Fake Halo"], ["wings", "Night Wings"],
  ["crown", "Tiny Crown"], ["cap", "Rizo Snapback"], ["bow", "Big Bow"],
  ["goggles", "Forest Goggles"], ["antenna", "Signal Antenna"], ["leafcrown", "Leaf Crown"],
  ["visor", "Cyan Visor"], ["cape", "Tiny Cape"], ["backpack", "Walk Pack"],
  ["starclip", "Star Clip"], ["mask", "Night Mask"], ["earmuffs", "Frost Muffs"],
  ["bucket", "Rain Bucket Hat"]
];

const treasures = [
  ["blue-button", "Blue Button"], ["smooth-rock", "Suspiciously Smooth Rock"],
  ["lost-tag", "Lost Rizo Tag"], ["moon-leaf", "Moon Leaf"], ["tiny-key", "Tiny Key"],
  ["storm-bottle", "Bottled Storm"], ["gold-thread", "Gold Thread"], ["diamond-seed", "Diamond Seed"]
];

const rooms = [
  ["rain", "Rain Den"], ["forest", "Root House"], ["midnight", "Midnight Den"],
  ["arcade", "Pixel Arcade"], ["neon", "Neon Cave"], ["cloud", "Cloud Loft"],
  ["golden", "Gold Room"], ["void", "Void Chamber"], ["sunset", "Sunset Roof"],
  ["snow", "Frost Cabin"], ["space", "Orbit Den"], ["studio", "Rizo Studio"]
];

const boosts = [
  ["phoenix", "Phoenix Thread"], ["growth", "Growth Juice"],
  ["care", "Care Package"], ["ad-snack", "Sponsor Snack"]
];

export const ITEMS = [
  ...legacyItems("food", "foods", foods, ["consumable", "care"]),
  ...legacyItems("wearable", "wearables", wearables, ["cosmetic"]),
  ...legacyItems("treasure", "treasures", treasures, ["collectible", "walk"]),
  ...legacyItems("room", "rooms", rooms, ["cosmetic", "habitat"]),
  ...legacyItems("boost", "boosts", boosts, ["consumable", "shop"])
];
