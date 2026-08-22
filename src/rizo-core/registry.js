const ID_PATTERN = /^[a-z0-9][a-z0-9._:-]*$/;

function normalizeCategory(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeId(value, label = "id") {
  const id = String(value || "").trim().toLowerCase();
  if (!ID_PATTERN.test(id)) throw new Error(`Invalid Rizo Core ${label}: ${id || "<empty>"}`);
  return id;
}

function deepFreeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  if (seen.has(value)) return value;
  seen.add(value);

  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return value;
}

function normalizeDefinition(definition) {
  if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
    throw new TypeError("Rizo Core definitions must be plain objects.");
  }

  // Canonical content is data, not live object identity. Clone before freezing so the
  // registry never freezes nested arrays/objects owned by the caller's source pack.
  let source;
  try {
    source = structuredClone(definition);
  } catch (error) {
    throw new TypeError(`Rizo Core definition must be structured-cloneable data: ${error.message}`);
  }

  const id = normalizeId(source.id);
  const tags = Array.isArray(source.tags)
    ? [...new Set(source.tags.map(tag => String(tag).trim().toLowerCase()).filter(Boolean))]
    : [];
  const aliases = Array.isArray(source.aliases)
    ? [...new Set(source.aliases.map(alias => normalizeId(alias, "alias")).filter(alias => alias !== id))]
    : [];

  return deepFreeze({ ...source, id, tags, aliases });
}

function readPath(object, path) {
  return String(path)
    .split(".")
    .reduce((value, key) => (value == null ? undefined : value[key]), object);
}

export class ContentRegistry {
  constructor() {
    this._categories = new Map();
    this._aliases = new Map();
  }

  registerCategory(categoryName, definitions = []) {
    const category = normalizeCategory(categoryName);
    if (!category) throw new Error("Content category names cannot be empty.");
    if (!Array.isArray(definitions)) throw new TypeError(`${category} must be an array.`);
    if (this._categories.has(category)) throw new Error(`Category already registered: ${category}`);

    const records = new Map();
    const aliases = new Map();

    for (const rawDefinition of definitions) {
      const definition = normalizeDefinition(rawDefinition);
      if (records.has(definition.id)) throw new Error(`Duplicate id in ${category}: ${definition.id}`);
      records.set(definition.id, definition);
    }

    for (const definition of records.values()) {
      for (const alias of definition.aliases) {
        if (records.has(alias)) {
          throw new Error(`Alias collides with canonical ${category} id: ${alias}`);
        }
        if (aliases.has(alias)) {
          throw new Error(`Duplicate alias in ${category}: ${alias}`);
        }
        aliases.set(alias, definition.id);
      }
    }

    this._categories.set(category, records);
    this._aliases.set(category, aliases);
    return this;
  }

  categories() {
    return [...this._categories.keys()];
  }

  canonicalId(category, id) {
    const normalizedCategory = normalizeCategory(category);
    const normalizedId = String(id || "").trim().toLowerCase();
    const records = this._categories.get(normalizedCategory);
    if (!records || !normalizedId) return null;
    if (records.has(normalizedId)) return normalizedId;
    return this._aliases.get(normalizedCategory)?.get(normalizedId) || null;
  }

  has(category, id) {
    return this.canonicalId(category, id) !== null;
  }

  get(category, id) {
    const normalizedCategory = normalizeCategory(category);
    const records = this._categories.get(normalizedCategory);
    if (!records) throw new Error(`Unknown content category: ${category}`);
    const canonical = this.canonicalId(normalizedCategory, id);
    if (!canonical) throw new Error(`Unknown ${normalizedCategory} id: ${id}`);
    return records.get(canonical);
  }

  maybeGet(category, id) {
    const normalizedCategory = normalizeCategory(category);
    const records = this._categories.get(normalizedCategory);
    if (!records) return null;
    const canonical = this.canonicalId(normalizedCategory, id);
    return canonical ? records.get(canonical) : null;
  }

  all(category) {
    const normalizedCategory = normalizeCategory(category);
    const records = this._categories.get(normalizedCategory);
    if (!records) throw new Error(`Unknown content category: ${category}`);
    return [...records.values()];
  }

  ids(category, { includeAliases = false } = {}) {
    const normalizedCategory = normalizeCategory(category);
    const records = this._categories.get(normalizedCategory);
    if (!records) throw new Error(`Unknown content category: ${category}`);
    const canonical = [...records.keys()];
    if (!includeAliases) return canonical;
    return [...canonical, ...(this._aliases.get(normalizedCategory)?.keys() || [])];
  }

  aliases(category, id = null) {
    const normalizedCategory = normalizeCategory(category);
    const aliases = this._aliases.get(normalizedCategory);
    if (!aliases) throw new Error(`Unknown content category: ${category}`);
    if (id == null) return Object.fromEntries(aliases);
    const canonical = this.canonicalId(normalizedCategory, id);
    if (!canonical) return [];
    return [...aliases.entries()].filter(([, target]) => target === canonical).map(([alias]) => alias);
  }

  where(category, predicate) {
    return this.all(category).filter(predicate);
  }

  byTag(category, tag) {
    const normalized = String(tag || "").trim().toLowerCase();
    return this.where(category, definition => definition.tags.includes(normalized));
  }

  byField(category, field, value) {
    return this.where(category, definition => readPath(definition, field) === value);
  }

  validateReferences(referenceRules = []) {
    const issues = [];

    for (const rule of referenceRules) {
      const from = normalizeCategory(rule.from);
      const to = normalizeCategory(rule.to);
      const { field, many = false, optional = false } = rule;

      if (!this._categories.has(from)) {
        issues.push(`Reference rule uses missing source category: ${rule.from}`);
        continue;
      }
      if (!this._categories.has(to)) {
        issues.push(`Reference rule uses missing target category: ${rule.to}`);
        continue;
      }

      for (const definition of this.all(from)) {
        const raw = readPath(definition, field);
        if (raw == null || raw === "") {
          if (!optional) issues.push(`${from}:${definition.id}.${field} is required`);
          continue;
        }

        const ids = many ? raw : [raw];
        if (many && !Array.isArray(raw)) {
          issues.push(`${from}:${definition.id}.${field} must be an array`);
          continue;
        }

        for (const id of ids) {
          if (!this.has(to, id)) issues.push(`${from}:${definition.id}.${field} -> missing ${to}:${id}`);
        }
      }
    }

    return issues;
  }

  assertHealthy(referenceRules = []) {
    const issues = this.validateReferences(referenceRules);
    if (issues.length) {
      const error = new Error(`Rizo Core registry validation failed:\n- ${issues.join("\n- ")}`);
      error.issues = issues;
      throw error;
    }
    return true;
  }

  snapshot() {
    const output = {};
    for (const category of this.categories()) output[category] = this.all(category);
    return deepFreeze(output);
  }
}
