export class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(eventName, listener) {
    if (typeof listener !== "function") throw new TypeError("Event listener must be a function.");
    const name = String(eventName);
    const listeners = this.listeners.get(name) || new Set();
    listeners.add(listener);
    this.listeners.set(name, listeners);
    return () => this.off(name, listener);
  }

  once(eventName, listener) {
    const unsubscribe = this.on(eventName, payload => {
      unsubscribe();
      listener(payload);
    });
    return unsubscribe;
  }

  off(eventName, listener) {
    const listeners = this.listeners.get(String(eventName));
    if (!listeners) return false;
    const removed = listeners.delete(listener);
    if (!listeners.size) this.listeners.delete(String(eventName));
    return removed;
  }

  emit(eventName, payload) {
    const listeners = [...(this.listeners.get(String(eventName)) || [])];
    for (const listener of listeners) listener(payload);
    return listeners.length;
  }

  clear(eventName) {
    if (eventName === undefined) this.listeners.clear();
    else this.listeners.delete(String(eventName));
  }
}
