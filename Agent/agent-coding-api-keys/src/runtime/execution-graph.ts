/**
 * Antigravity Gateway — Execution Graph Engine
 *
 * Represents ALL orchestration as a directed graph of execution nodes.
 * Every session, provider call, stream, tool invocation, retry, and fallback
 * is a node in the graph with edges representing causal relationships.
 *
 * Purpose:
 *  - Debugging: trace any failure back through the execution chain
 *  - Replay: re-execute from any node
 *  - Cancellation: propagate cancel through child nodes
 *  - Observability: visualize orchestration flow
 *  - Multi-agent: coordinate parallel execution branches
 */

import { randomUUID } from 'node:crypto';

export type NodeType =
    | 'session'
    | 'request'
    | 'provider_call'
    | 'stream'
    | 'tool_use'
    | 'tool_result'
    | 'reasoning'
    | 'retry'
    | 'fallback'
    | 'checkpoint'
    | 'cancellation';

export type NodeStatus = 'pending' | 'active' | 'completed' | 'failed' | 'cancelled' | 'timeout';

export interface ExecutionNode {
    id: string;
    type: NodeType;
    parentId: string | null;
    sessionId: string;
    status: NodeStatus;
    createdAt: number;
    startedAt: number | null;
    completedAt: number | null;
    metadata: Record<string, unknown>;
    children: string[];
    error?: string;
}

export interface ExecutionEdge {
    from: string;
    to: string;
    type: 'parent' | 'triggers' | 'fallback_to' | 'retry_of' | 'cancels';
}

export interface GraphSnapshot {
    sessionId: string;
    nodes: ExecutionNode[];
    edges: ExecutionEdge[];
    rootId: string;
    depth: number;
    activeCount: number;
    completedCount: number;
    failedCount: number;
}

class ExecutionGraph {
    private nodes = new Map<string, ExecutionNode>();
    private edges: ExecutionEdge[] = [];
    private sessionRoots = new Map<string, string>(); // sessionId → root node id

    /** Create a root node for a session. */
    createRoot(sessionId: string, metadata: Record<string, unknown> = {}): ExecutionNode {
        const node = this.createNode('session', null, sessionId, metadata);
        this.sessionRoots.set(sessionId, node.id);
        return node;
    }

    /** Create a child node under a parent. */
    createNode(type: NodeType, parentId: string | null, sessionId: string, metadata: Record<string, unknown> = {}): ExecutionNode {
        const node: ExecutionNode = {
            id: `node_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
            type,
            parentId,
            sessionId,
            status: 'pending',
            createdAt: Date.now(),
            startedAt: null,
            completedAt: null,
            metadata,
            children: [],
        };

        this.nodes.set(node.id, node);

        if (parentId) {
            const parent = this.nodes.get(parentId);
            if (parent) parent.children.push(node.id);
            this.edges.push({ from: parentId, to: node.id, type: 'parent' });
        }

        return node;
    }

    /** Mark a node as started. */
    start(nodeId: string): void {
        const node = this.nodes.get(nodeId);
        if (!node) return;
        node.status = 'active';
        node.startedAt = Date.now();
    }

    /** Mark a node as completed. */
    complete(nodeId: string, metadata?: Record<string, unknown>): void {
        const node = this.nodes.get(nodeId);
        if (!node) return;
        node.status = 'completed';
        node.completedAt = Date.now();
        if (metadata) Object.assign(node.metadata, metadata);
    }

    /** Mark a node as failed. */
    fail(nodeId: string, error: string): void {
        const node = this.nodes.get(nodeId);
        if (!node) return;
        node.status = 'failed';
        node.completedAt = Date.now();
        node.error = error;
    }

    /** Cancel a node and all its descendants. */
    cancel(nodeId: string): string[] {
        const cancelled: string[] = [];
        const queue = [nodeId];

        while (queue.length > 0) {
            const id = queue.shift()!;
            const node = this.nodes.get(id);
            if (!node || node.status === 'completed' || node.status === 'cancelled') continue;

            node.status = 'cancelled';
            node.completedAt = Date.now();
            cancelled.push(id);

            // Cancel all children
            for (const childId of node.children) {
                queue.push(childId);
            }
        }

        return cancelled;
    }

    /** Add a typed edge between nodes. */
    addEdge(from: string, to: string, type: ExecutionEdge['type']): void {
        this.edges.push({ from, to, type });
    }

    /** Get a node by ID. */
    get(nodeId: string): ExecutionNode | undefined {
        return this.nodes.get(nodeId);
    }

    /** Get all children of a node. */
    getChildren(nodeId: string): ExecutionNode[] {
        const node = this.nodes.get(nodeId);
        if (!node) return [];
        return node.children.map((id) => this.nodes.get(id)).filter((n): n is ExecutionNode => !!n);
    }

    /** Get the full ancestor chain for a node. */
    getAncestors(nodeId: string): ExecutionNode[] {
        const ancestors: ExecutionNode[] = [];
        let current = this.nodes.get(nodeId);
        while (current?.parentId) {
            const parent = this.nodes.get(current.parentId);
            if (!parent) break;
            ancestors.push(parent);
            current = parent;
        }
        return ancestors;
    }

    /** Get a snapshot of the execution graph for a session. */
    getSnapshot(sessionId: string): GraphSnapshot | null {
        const rootId = this.sessionRoots.get(sessionId);
        if (!rootId) return null;

        const sessionNodes = [...this.nodes.values()].filter((n) => n.sessionId === sessionId);
        const sessionEdges = this.edges.filter((e) =>
            sessionNodes.some((n) => n.id === e.from) || sessionNodes.some((n) => n.id === e.to),
        );

        let maxDepth = 0;
        const computeDepth = (nodeId: string, depth: number): void => {
            maxDepth = Math.max(maxDepth, depth);
            const node = this.nodes.get(nodeId);
            if (!node) return;
            for (const childId of node.children) {
                computeDepth(childId, depth + 1);
            }
        };
        computeDepth(rootId, 0);

        return {
            sessionId,
            nodes: sessionNodes,
            edges: sessionEdges,
            rootId,
            depth: maxDepth,
            activeCount: sessionNodes.filter((n) => n.status === 'active').length,
            completedCount: sessionNodes.filter((n) => n.status === 'completed').length,
            failedCount: sessionNodes.filter((n) => n.status === 'failed').length,
        };
    }

    /** Get active nodes for a session. */
    getActiveNodes(sessionId: string): ExecutionNode[] {
        return [...this.nodes.values()].filter((n) => n.sessionId === sessionId && n.status === 'active');
    }

    /** Prune completed session graphs older than maxAge. */
    prune(maxAgeMs: number): number {
        const cutoff = Date.now() - maxAgeMs;
        let pruned = 0;

        for (const [sessionId, rootId] of this.sessionRoots) {
            const root = this.nodes.get(rootId);
            if (!root) continue;
            if (root.status === 'completed' || root.status === 'cancelled' || root.status === 'failed') {
                if ((root.completedAt ?? root.createdAt) < cutoff) {
                    // Remove all nodes for this session
                    const sessionNodes = [...this.nodes.values()].filter((n) => n.sessionId === sessionId);
                    for (const node of sessionNodes) {
                        this.nodes.delete(node.id);
                        pruned++;
                    }
                    this.sessionRoots.delete(sessionId);
                    this.edges = this.edges.filter((e) =>
                        !sessionNodes.some((n) => n.id === e.from || n.id === e.to),
                    );
                }
            }
        }

        return pruned;
    }

    /** Get total node count. */
    get size(): number {
        return this.nodes.size;
    }
}

/** Singleton execution graph. */
export const executionGraph = new ExecutionGraph();
