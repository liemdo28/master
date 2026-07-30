/**
 * local-agent/autonomous/ExecutionContext.js
 * Phase 21: Execution context capture and restoration
 */

export class ExecutionContext {
    constructor(workspaceRoot) {
        this.root = workspaceRoot;
        this.contexts = new Map();
        this.snapshots = new Map();
        this.current = null;
    }

    async capture(data) {
        const id = crypto.randomUUID();
        const context = {
            id,
            data,
            timestamp: Date.now(),
            labels: [],
            parent: this.current?.id || null,
        };

        this.contexts.set(id, context);
        this.current = context;

        return new ContextHandle(context, this);
    }

    get(id) {
        return this.contexts.get(id) || null;
    }

    currentContext() {
        return this.current;
    }

    async snapshot(label = 'unnamed') {
        const id = crypto.randomUUID();
        const snapshot = {
            id,
            label,
            timestamp: Date.now(),
            contexts: new Map(this.contexts),
            current: this.current ? { ...this.current } : null,
        };

        this.snapshots.set(id, snapshot);
        return id;
    }

    async restore(snapshotId) {
        const snapshot = this.snapshots.get(snapshotId);
        if (!snapshot) throw new Error(`Snapshot ${snapshotId} not found`);

        this.contexts = new Map(snapshot.contexts);
        this.current = snapshot.current
            ? this.contexts.get(snapshot.current.id) || null
            : null;

        return { restored: true, snapshot: snapshotId };
    }

    listSnapshots() {
        return [...this.snapshots.values()].map(s => ({
            id: s.id,
            label: s.label,
            timestamp: s.timestamp,
            contextCount: s.contexts.size,
        }));
    }
}

class ContextHandle {
    constructor(context, manager) {
        this._ctx = context;
        this._mgr = manager;
    }

    get id() { return this._ctx.id; }

    label(...tags) {
        this._ctx.labels.push(...tags);
        return this;
    }

    child(data) {
        return this._mgr.capture({ ...this._ctx.data, ...data });
    }

    summary() {
        const { id, timestamp, labels, parent } = this._ctx;
        return {
            id,
            timestamp,
            labels,
            parent,
            hasData: !!this._ctx.data,
        };
    }
}