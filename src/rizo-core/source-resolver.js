import { NativeRuntimeAdapter } from "./legacy-runtime.js";

function normalizeSource(value) {
  return String(value || "native").trim().toLowerCase();
}

export class SourceResolver {
  constructor(registry) {
    if (!registry) throw new Error("SourceResolver requires a content registry.");
    this.registry = registry;
    this.adapters = new Map([["native", new NativeRuntimeAdapter()]]);
  }

  register(sourceName, adapter) {
    const source = normalizeSource(sourceName);
    if (!source) throw new Error("Source names cannot be empty.");
    if (!adapter || typeof adapter.resolve !== "function") {
      throw new TypeError(`Source adapter ${source} must implement resolve(definition).`);
    }
    this.adapters.set(source, adapter);
    return this;
  }

  adapterFor(definition) {
    const source = normalizeSource(definition?.source);
    const adapter = this.adapters.get(source);
    if (!adapter) throw new Error(`No Rizo World source adapter registered for: ${source}`);
    return { source, adapter };
  }

  describe(category, id) {
    const definition = this.registry.get(category, id);
    const canonicalId = this.registry.canonicalId(category, id);
    const { source } = this.adapterFor(definition);
    return Object.freeze({
      category: String(category).toLowerCase(),
      requestedId: String(id),
      canonicalId,
      source,
      definition
    });
  }

  resolve(category, id) {
    const definition = this.registry.get(category, id);
    const { adapter } = this.adapterFor(definition);
    return adapter.resolve(definition);
  }

  available(category, id) {
    const definition = this.registry.get(category, id);
    const { adapter } = this.adapterFor(definition);
    if (typeof adapter.available === "function") return Boolean(adapter.available(definition));
    return adapter.resolve(definition) != null;
  }

  invoke(category, id, ...args) {
    const definition = this.registry.get(category, id);
    const { source, adapter } = this.adapterFor(definition);
    if (typeof adapter.invoke !== "function") {
      throw new Error(`Rizo World source ${source} cannot invoke ${definition.id}.`);
    }
    return adapter.invoke(definition, ...args);
  }
}
