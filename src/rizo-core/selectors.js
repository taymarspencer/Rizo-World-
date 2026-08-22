function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase();
}

function readPath(object, path) {
  return String(path)
    .split(".")
    .reduce((value, key) => (value == null ? undefined : value[key]), object);
}

function compareValues(a, b, direction = "asc") {
  const multiplier = direction === "desc" ? -1 : 1;

  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;

  if (typeof a === "number" && typeof b === "number") {
    return (a - b) * multiplier;
  }

  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: "base"
  }) * multiplier;
}

export class ContentQuery {
  constructor(records = []) {
    this._records = [...records];
  }

  clone() {
    return new ContentQuery(this._records);
  }

  where(predicate) {
    this._records = this._records.filter(predicate);
    return this;
  }

  field(path, value) {
    return this.where(record => readPath(record, path) === value);
  }

  tag(tag) {
    const target = normalizeText(tag);
    return this.where(record => Array.isArray(record.tags) && record.tags.includes(target));
  }

  tags(tags = [], mode = "all") {
    const wanted = [...new Set(tags.map(normalizeText).filter(Boolean))];
    if (!wanted.length) return this;

    return this.where(record => {
      const recordTags = Array.isArray(record.tags) ? record.tags : [];
      return mode === "any"
        ? wanted.some(tag => recordTags.includes(tag))
        : wanted.every(tag => recordTags.includes(tag));
    });
  }

  search(term, fields = ["name", "title", "id"]) {
    const needle = normalizeText(term);
    if (!needle) return this;

    return this.where(record => fields.some(field => {
      const value = readPath(record, field);
      if (Array.isArray(value)) return value.some(item => normalizeText(item).includes(needle));
      return normalizeText(value).includes(needle);
    }));
  }

  sort(path, direction = "asc") {
    this._records.sort((a, b) => compareValues(readPath(a, path), readPath(b, path), direction));
    return this;
  }

  sortBy(sorters = []) {
    this._records.sort((a, b) => {
      for (const sorter of sorters) {
        const result = compareValues(
          readPath(a, sorter.field),
          readPath(b, sorter.field),
          sorter.direction || "asc"
        );
        if (result !== 0) return result;
      }
      return 0;
    });
    return this;
  }

  limit(count) {
    this._records = this._records.slice(0, Math.max(0, Number(count) || 0));
    return this;
  }

  first() {
    return this._records[0] || null;
  }

  count() {
    return this._records.length;
  }

  value() {
    return [...this._records];
  }
}

export function createSelectors(registry) {
  return Object.freeze({
    query(category) {
      return new ContentQuery(registry.all(category));
    },

    all(category) {
      return registry.all(category);
    },

    byId(category, id) {
      return registry.maybeGet(category, id);
    },

    byTag(category, tag) {
      return new ContentQuery(registry.byTag(category, tag));
    },

    byField(category, field, value) {
      return new ContentQuery(registry.byField(category, field, value));
    }
  });
}
