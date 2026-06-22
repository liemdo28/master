/**
 * ActionRegistry.mjs
 * Centralized registry of all supported actions.
 * Maps action types to service handlers.
 */

const registry = new Map();

export class ActionRegistry {
  static register(type, handler) {
    registry.set(type, handler);
  }

  static get(type) {
    return registry.get(type) || null;
  }

  static list() {
    return Array.from(registry.keys());
  }

  static has(type) {
    return registry.has(type);
  }
}

// Lazy registration — services register themselves when imported
export function registerActions(services) {
  for (const [type, handler] of Object.entries(services)) {
    ActionRegistry.register(type, handler);
  }
}
