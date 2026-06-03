"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWarRoomStore, TopologyNode } from "../../store/war-room-store";

const API = "http://localhost:7700/api";

// ─── Default nodes ──────────────────────────────────────────────────────────────

const DEFAULT_TOPOLOGY: TopologyNode[] = [
    { id: "dashboard", label: "DASHBOARD", status: "healthy", connections: ["gateway"], info: "Primary control surface" },
    { id: "gateway", label: "API GATEWAY", status: "healthy", connections: ["providers", "websocket"], info: "Request routing layer" },
    { id: "providers", label: "PROVIDERS", status: "healthy", connections: ["gateway"], info: "External service integrations" },
    { id: "websocket", label: "WEBSOCKET", status: "healthy", connections: ["gateway", "queues"], info: "Realtime event transport" },
    { id: "queues", label: "MESSAGE QUEUES", status: "healthy", connections: ["websocket"], info: "Async task processing" },
    { id: "browsers", label: "BROWSER CLIENTS", status: "healthy", connections: ["websocket"], info: "Active user sessions" },
];

// ─── Node colors ────────────────────────────────────────────────────────────────

function nodeColor(status: TopologyNode["status"]): { fill: string; stroke: string; glow: string } {
    switch (status) {
        case "healthy": return { fill: "#00FFB3", stroke: "#00FFB3", glow: "rgba(0,255,179,0.4)" };
        case "degraded": return { fill: "#FFC857", stroke: "#FFC857", glow: "rgba(255,200,87,0.4)" };
        case "critical": return { fill: "#FF5C7A", stroke: "#FF5C7A", glow: "rgba(255,92,122,0.5)" };
        case "collapsing": return { fill: "#FF2E63", stroke: "#FF2E63", glow: "rgba(255,46,99,0.6)" };
        case "offline": return { fill: "#666", stroke: "#444", glow: "transparent" };
    }
}

// ─── Animated Node ─────────────────────────────────────────────────────────────

function TopologyNodeComp({
    node, index, onSelect, selected,
}: {
    node: TopologyNode;
    index: number;
    onSelect: (n: TopologyNode) => void;
    selected: string | null;
}) {
    const colors = nodeColor(node.status);
    const isSelected = selected === node.id;
    const isCollapsing = node.status === "collapsing";

    return (
        <motion.div
            className="absolute flex flex-col items-center gap-1 cursor-pointer group"
            style={{
                left: "50%",
                top: `${index * 130 + 60}px`,
                transform: "translateX(-50%)",
            }}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.12, duration: 0.4, ease: "easeOut" }}
            onClick={() => onSelect(node)}
        >
            {/* Glow ring */}
            {node.status !== "offline" && (
                <motion.div
                    className="absolute rounded-full"
                    style={{
                        width: 72, height: 72,
                        background: "transparent",
                        boxShadow: `0 0 20px ${colors.glow}`,
                        top: -8,
                    }}
                    animate={
                        isCollapsing
                            ? { scale: [1, 1.3, 1], opacity: [0.8, 0.2, 0.8] }
                            : node.status === "critical"
                                ? { scale: [1, 1.15, 1], opacity: [0.6, 0.3, 0.6] }
                                : {}
                    }
                    transition={{ duration: isCollapsing ? 0.5 : 1.5, repeat: Infinity }}
                />
            )}

            {/* Node circle */}
            <motion.div
                className="relative w-14 h-14 rounded-full flex items-center justify-center border-2"
                style={{
                    borderColor: colors.stroke,
                    background: `${colors.fill}12`,
                    boxShadow: isSelected ? `0 0 0 3px ${colors.glow}, 0 0 20px ${colors.glow}` : `inset 0 0 15px ${colors.glow}30`,
                }}
                whileHover={{ scale: 1.1 }}
                animate={
                    isCollapsing
                        ? { boxShadow: [`0 0 20px ${colors.glow}`, `0 0 40px ${colors.glow}`, `0 0 20px ${colors.glow}`] }
                        : {}
                }
            >
                {/* Pulse ring */}
                {node.status !== "offline" && (
                    <motion.div
                        className="absolute inset-0 rounded-full"
                        style={{ border: `1px solid ${colors.stroke}` }}
                        animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                    />
                )}

                {/* Icon dot */}
                <motion.div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: colors.fill, boxShadow: `0 0 8px ${colors.glow}` }}
                    animate={
                        isCollapsing
                            ? { scale: [1, 1.4, 1] }
                            : node.status === "critical"
                                ? { scale: [1, 1.2, 1] }
                                : { opacity: [1, 0.7, 1] }
                    }
                    transition={{ duration: isCollapsing ? 0.4 : 1.5, repeat: Infinity }}
                />
            </motion.div>

            {/* Label */}
            <div className="text-center">
                <span
                    className="font-mono-war text-[9px] font-bold tracking-widest uppercase block"
                    style={{
                        color: colors.fill,
                        textShadow: `0 0 8px ${colors.glow}`,
                    }}
                >
                    {node.label}
                </span>
                {node.latency_ms !== undefined && (
                    <span className="font-mono-war text-[8px] text-white/40 mt-0.5 block">
                        {node.latency_ms}ms
                    </span>
                )}
            </div>
        </motion.div>
    );
}

// ─── Connection Lines ──────────────────────────────────────────────────────────

function ConnectionLines({ nodes }: { nodes: TopologyNode[] }) {
    const nodePositions: Record<string, { x: number; y: number }> = {};
    nodes.forEach((n, i) => {
        nodePositions[n.id] = { x: 0, y: i * 130 + 60 };
    });

    return (
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
            <defs>
                <linearGradient id="lineHealthy" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#00FFB3" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#00FFB3" stopOpacity="0.2" />
                </linearGradient>
                <linearGradient id="lineDegraded" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#FFC857" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#FFC857" stopOpacity="0.2" />
                </linearGradient>
                <linearGradient id="lineCritical" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#FF5C7A" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#FF2E63" stopOpacity="0.4" />
                </linearGradient>
            </defs>

            {nodes.map((node) => {
                const fromIdx = nodes.indexOf(node);
                const fromY = fromIdx * 130 + 60;
                const toNode = nodes.find((n) => n.id === node.connections[0]);
                if (!toNode) return null;
                const toIdx = nodes.indexOf(toNode);
                const toY = toIdx * 130 + 60;
                const color =
                    node.status === "collapsing" ? "#FF2E63"
                        : node.status === "critical" ? "#FF5C7A"
                            : node.status === "degraded" ? "#FFC857"
                                : "#00FFB3";
                const gradId =
                    node.status === "collapsing" || node.status === "critical" ? "lineCritical"
                        : node.status === "degraded" ? "lineDegraded"
                            : "lineHealthy";

                return (
                    <g key={`${node.id}-${toNode.id}`}>
                        {/* Shadow/glow line */}
                        <line
                            x1="50%" y1={fromY + 30}
                            x2="50%" y2={toY - 30}
                            stroke={color} strokeWidth="1"
                            strokeOpacity="0.2"
                        />
                        {/* Animated data packet */}
                        <motion.line
                            x1="50%" y1={fromY + 30}
                            x2="50%" y2={toY - 30}
                            stroke={color}
                            strokeWidth="1.5"
                            strokeOpacity="0.7"
                            strokeDasharray="4 6"
                            animate={{ strokeDashoffset: [0, -20] }}
                            transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                        />
                    </g>
                );
            })}
        </svg>
    );
}

// ─── Node Detail Panel ─────────────────────────────────────────────────────────

function NodeDetail({ node }: { node: TopologyNode }) {
    const colors = nodeColor(node.status);
    return (
        <motion.div
            className="absolute right-0 top-0 w-64 rounded-lg border p-4"
            style={{
                background: "rgba(5,8,22,0.95)",
                borderColor: `${colors.stroke}50`,
                boxShadow: `0 0 20px ${colors.glow}30`,
            }}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
        >
            <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.fill, boxShadow: `0 0 8px ${colors.glow}` }} />
                <span className="font-mono-war text-xs font-bold tracking-widest uppercase" style={{ color: colors.fill }}>
                    {node.label}
                </span>
            </div>

            <div className="space-y-2">
                <div className="flex justify-between">
                    <span className="font-mono-war text-[10px] text-white/40 uppercase">Status</span>
                    <span className="font-mono-war text-[10px] font-bold uppercase" style={{ color: colors.fill }}>{node.status}</span>
                </div>
                {node.latency_ms !== undefined && (
                    <div className="flex justify-between">
                        <span className="font-mono-war text-[10px] text-white/40 uppercase">Latency</span>
                        <span className="font-mono-war text-[10px] font-bold" style={{ color: node.latency_ms > 500 ? "#FF5C7A" : "#00FFB3" }}>
                            {node.latency_ms}ms
                        </span>
                    </div>
                )}
                {node.failure_rate !== undefined && (
                    <div className="flex justify-between">
                        <span className="font-mono-war text-[10px] text-white/40 uppercase">Failure Rate</span>
                        <span className="font-mono-war text-[10px] font-bold" style={{ color: node.failure_rate > 5 ? "#FF5C7A" : "#00FFB3" }}>
                            {node.failure_rate.toFixed(2)}%
                        </span>
                    </div>
                )}
                <div className="pt-2 border-t border-white/10">
                    <p className="font-mono-war text-[9px] text-white/30 leading-relaxed">{node.info}</p>
                </div>
                <div className="pt-2">
                    <span className="font-mono-war text-[9px] text-white/30 uppercase tracking-wider">Connections</span>
                    <div className="flex gap-1 mt-1 flex-wrap">
                        {node.connections.map((c) => (
                            <span key={c} className="font-mono-war text-[8px] px-1.5 py-0.5 rounded border border-white/20 text-white/50 uppercase">
                                {c}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

// ─── Legend ────────────────────────────────────────────────────────────────────

function Legend() {
    const items = [
        { color: "#00FFB3", label: "Healthy" },
        { color: "#FFC857", label: "Degraded" },
        { color: "#FF5C7A", label: "Critical" },
        { color: "#FF2E63", label: "Collapsing" },
        { color: "#666", label: "Offline" },
    ];
    return (
        <div className="absolute bottom-3 left-3 flex items-center gap-3 px-3 py-1.5 rounded border border-white/10 bg-black/40">
            {items.map((item) => (
                <div key={item.label} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="font-mono-war text-[8px] text-white/50 uppercase tracking-wider">{item.label}</span>
                </div>
            ))}
        </div>
    );
}

// ─── Main Topology Component ───────────────────────────────────────────────────

export function EcosystemTopology() {
    const { topologyNodes, setTopologyNodes } = useWarRoomStore();
    const [selectedNode, setSelectedNode] = useState<TopologyNode | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const nodes = topologyNodes.length > 0 ? topologyNodes : DEFAULT_TOPOLOGY;

    const fetchTopology = useCallback(async () => {
        try {
            const res = await fetch(`${API}/warroom/snapshot`);
            if (res.ok) {
                const data = await res.json();
                if (data.providers) {
                    const newNodes: TopologyNode[] = DEFAULT_TOPOLOGY.map((n) => {
                        if (n.id === "providers") {
                            const p = data.providers[0];
                            if (!p) return n;

                            const status: TopologyNode["status"] =
                                p.failure_rate > 10 ? "critical"
                                    : p.failure_rate > 5 ? "degraded"
                                        : "healthy";

                            return {
                                ...n,
                                latency_ms: p.latency_ms,
                                failure_rate: p.failure_rate,
                                status,
                            };
                        }
                        return n;
                    });
                    setTopologyNodes(newNodes);
                }
            }
        } catch { /* silent */ }
    }, [setTopologyNodes]);

    useEffect(() => {
        fetchTopology();
        const id = setInterval(fetchTopology, 4000);
        return () => clearInterval(id);
    }, [fetchTopology]);

    // Auto-collapse visualization: pick a node to show as degrading
    const displayNodes = nodes.map((n, i) => {
        // Subtle random status changes for visual interest when no real data
        if (topologyNodes.length === 0 && i === 2) {
            const sec = Math.floor(Date.now() / 1000);
            if (sec % 20 < 3) return { ...n, status: "degraded" as const };
            if (sec % 30 < 2) return { ...n, status: "critical" as const };
        }
        return n;
    });

    return (
        <div className="rounded-lg border border-white/10 bg-card/40 backdrop-blur-sm overflow-hidden">
            {/* Header */}
            <div className="px-4 py-2.5 border-b border-white/8 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <motion.div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: "#00FFB3" }}
                        animate={{ opacity: [1, 0.4, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                    />
                    <span className="font-mono-war text-xs font-bold tracking-widest uppercase text-white/70">
                        ECOSYSTEM TOPOLOGY
                    </span>
                </div>
                <span className="font-mono-war text-[9px] text-white/30 tracking-wider">
                    {nodes.length} NODES ACTIVE
                </span>
            </div>

            {/* Graph area */}
            <div
                ref={containerRef}
                className="relative h-[480px] overflow-hidden"
                style={{ background: "radial-gradient(ellipse at center, rgba(0,255,179,0.02) 0%, transparent 70%)" }}
            >
                <ConnectionLines nodes={displayNodes} />

                {displayNodes.map((node, i) => (
                    <TopologyNodeComp
                        key={node.id}
                        node={node}
                        index={i}
                        onSelect={setSelectedNode}
                        selected={selectedNode?.id ?? null}
                    />
                ))}

                <AnimatePresence>
                    {selectedNode && (
                        <NodeDetail node={selectedNode} />
                    )}
                </AnimatePresence>

                <Legend />

                {/* Grid overlay */}
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        backgroundImage: "linear-gradient(rgba(0,255,179,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,179,0.02) 1px, transparent 1px)",
                        backgroundSize: "40px 40px",
                    }}
                />
            </div>
        </div>
    );
}
