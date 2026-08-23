function legacyTraits(type, path, rows) {
  return rows.map(([legacyKey, name]) => ({
    id: `trait.${type}.${legacyKey}`,
    name,
    type,
    source: "legacy",
    tags: ["rizo", "trait", type],
    binding: { kind: "global-record", path: `RizoLegacyRuntime.content.${path}`, value: legacyKey }
  }));
}

export const TRAITS = [
  ...legacyTraits("skill", "skills", [
    ["speed", "Speed"], ["power", "Power"], ["instinct", "Instinct"],
    ["stamina", "Stamina"], ["luck", "Luck"]
  ]),
  ...legacyTraits("mutation", "mutations", [
    ["normal", "Normal Spark"], ["starborn", "Starborn"],
    ["stormmarked", "Storm-Marked"], ["hollow", "Hollow Flame"]
  ]),
  ...legacyTraits("evolution", "evolutionForms", [
    ["balanced", "True Path"], ["speed", "Dash Path"], ["power", "Iron Path"],
    ["instinct", "Moon Path"], ["stamina", "Root Path"], ["luck", "Fortune Path"],
    ["pixel", "Pixel Path"], ["eclipse", "Eclipse Path"], ["royal", "Royal Path"],
    ["prism", "Prism Path"]
  ])
];
