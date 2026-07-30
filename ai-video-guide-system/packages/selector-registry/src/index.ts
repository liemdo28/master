// src/index.ts

/**
 * Priority levels for selector robustness.
 * Higher priority = more reliable across environments.
 */
export enum SelectorPriority {
  DATA_TESTID = 1,
  ACCESSIBLE_ROLE = 2,
  LABEL = 3,
  TEXT = 4,
  CSS = 5,
}

/**
 * Single selector entry stored in the registry.
 */
export interface SelectorEntry {
  key: string;
  selector: string;
  priority: SelectorPriority;
  description: string;
  verified: boolean;
  lastVerifiedAt?: string;
  fallbackSelectors?: string[];
}

/**
 * Validate basic selector format (CSS or XPath).
 */
function validateSelector(selector: string): boolean {
  if (!selector || typeof selector !== "string" || selector.trim().length === 0) return false;
  // Basic sanity checks — allow CSS, XPath, testid, role patterns
  return selector.length <= 500;
}

/**
 * Core registry for managing and resolving DOM selectors used during
 * AI-driven video recording sessions.
 */
export class SelectorRegistry {
  private entries = new Map<string, SelectorEntry>();

  /**
   * Register a new selector entry.
   * Throws if the key already exists or if the selector format is invalid.
   */
  register(key: string, entry: SelectorEntry): void {
    if (this.entries.has(key)) {
      throw new Error(`SelectorRegistry: key '${key}' is already registered.`);
    }
    if (!validateSelector(entry.selector)) {
      throw new Error(`SelectorRegistry: invalid selector format for key '${key}': '${entry.selector}'`);
    }
    this.entries.set(key, { ...entry, key });
  }

  /**
   * Resolve the primary selector for a given key.
   * Throws if the key is not found.
   */
  resolve(key: string): string {
    const entry = this.entries.get(key);
    if (!entry) {
      throw new Error(`SelectorRegistry: no selector registered for key '${key}'.`);
    }
    return entry.selector;
  }

  /**
   * Resolve all selectors for a given key, including fallbacks.
   * Returns primary selector first, then all fallbackSelectors.
   */
  resolveWithFallbacks(key: string): string[] {
    const entry = this.entries.get(key);
    if (!entry) {
      throw new Error(`SelectorRegistry: no selector registered for key '${key}'.`);
    }
    return [entry.selector, ...(entry.fallbackSelectors ?? [])];
  }

  /**
   * Get the human-readable description for a selector entry.
   */
  getDescription(key: string): string {
    const entry = this.entries.get(key);
    if (!entry) {
      throw new Error(`SelectorRegistry: no selector registered for key '${key}'.`);
    }
    return entry.description;
  }

  /**
   * Mark a selector entry as verified and record the current timestamp.
   */
  markVerified(key: string): void {
    const entry = this.entries.get(key);
    if (!entry) {
      throw new Error(`SelectorRegistry: no selector registered for key '${key}'.`);
    }
    entry.verified = true;
    entry.lastVerifiedAt = new Date().toISOString();
  }

  /**
   * List all registered selector entries.
   */
  listAll(): SelectorEntry[] {
    return Array.from(this.entries.values());
  }

  /**
   * Export a flat key→selector map suitable for workflow injection.
   */
  exportForWorkflow(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, entry] of this.entries) {
      result[key] = entry.selector;
    }
    return result;
  }
}

// Pre-built selectors for the Dashboard app (MVP)
export const dashboardSelectors = {
  sidebar: {
    submittedTasks: "[data-testid=\"submitted-tasks\"]",
    allTasks: "[data-testid=\"all-tasks\"]",
    dashboard: "[data-testid=\"nav-dashboard\"]",
    settings: "[data-testid=\"nav-settings\"]",
  },
  tasks: {
    firstSubmittedTask: "[data-testid=\"submitted-task-row\"]:first-child",
    taskRow: (id: string) => `[data-testid=\"task-row-${id}\"]`,
    taskCheckbox: "[data-testid=\"task-checkbox\"]",
  },
};
