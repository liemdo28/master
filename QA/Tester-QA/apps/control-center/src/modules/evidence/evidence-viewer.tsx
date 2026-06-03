"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Image, FileCode, Network, Terminal, X, ExternalLink, Eye } from "lucide-react";

const API = "http://localhost:7700/api";

interface EvidenceItem {
    id: string;
    type: "screenshot" | "console" | "network" | "har" | "trace" | "log";
    name: string;
    path: string;
    timestamp: number;
    size: string;
}

function evidenceIcon(type: EvidenceItem["type"]) {
    switch (type) {
        case "screenshot": return Image;
        case "console": return Terminal;
        case "network": return Network;
        case "har": return FileCode;
        case "trace": return FileText;
        default: return FileText;
    }
}

function typeColor(type: EvidenceItem["type"]): string {
    switch (type) {
        case "screenshot": return "#00FFB3";
        case "console": return "#FFC857";
        case "network": return "#4DA3FF";
        case "har": return "#FF5C7A";
        case "trace": return "#9B59B6";
        default: return "#666";
    }
}

function EvidenceRow({ item, onView }: { item: EvidenceItem; onView: () => void }) {
    const Icon = evidenceIcon(item.type);
    const color = typeColor(item.type);

    return (
        <motion.div
            className="flex items-center gap-3 px-3 py-2 rounded hover:bg-white/5 transition-colors cursor-pointer border border-transparent hover:border-white/10"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            whileHover={{ backgroundColor: "rgba(255,255,255,0.04)" }}
        >
            <Icon size={12} style={{ color, opacity: 0.8 }} />
            <div className="flex-1 min-w-0">
                <span className="font-mono-war text-[10px] text-white/70 truncate block">{item.name}</span>
            </div>
            <span className="font-mono-war text-[8px] text-white/25 shrink-0">{item.size}</span>
            <span className="font-mono-war text-[8px] text-white/25 shrink-0">
                {new Date(item.timestamp * 1000).toLocaleTimeString("en-US", { hour12: false })}
            </span>
            <button
                onClick={onView}
                className="p-1 rounded hover:bg-white/10 transition-colors"
            >
                <Eye size={10} style={{ color: "rgba(255,255,255,0.4)" }} />
            </button>
        </motion.div>
    );
}

function ViewerModal({ item, onClose }: { item: EvidenceItem; onClose: () => void }) {
    return (
        <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
            <motion.div
                className="relative rounded-lg border overflow-hidden max-w-4xl w-full max-h-[80vh] flex flex-col"
                style={{ borderColor: `${typeColor(item.type)}50`, background: "rgba(5,8,22,0.98)", boxShadow: `0 0 40px ${typeColor(item.type)}20` }}
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
            >
                {/* Header */}
                <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: `${typeColor(item.type)}25` }}>
                    <div className="flex items-center gap-2">
                        {(() => { const Icon = evidenceIcon(item.type); return <Icon size={14} style={{ color: typeColor(item.type) }} />; })()}
                        <span className="font-mono-war text-xs font-bold" style={{ color: typeColor(item.type) }}>{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <ExternalLink size={12} style={{ color: "rgba(255,255,255,0.3)" }} className="cursor-pointer hover:text-white/60" />
                        <X size={14} style={{ color: "rgba(255,255,255,0.4)" }} className="cursor-pointer hover:text-white/80" onClick={onClose} />
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-4">
                    {item.type === "screenshot" ? (
                        <div className="text-center">
                            <div className="rounded border border-white/10 inline-block p-2" style={{ background: "rgba(0,0,0,0.3)" }}>
                                <img src={`/api/evidence/${item.id}/file`} alt={item.name} className="max-w-full max-h-[60vh] rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            </div>
                        </div>
                    ) : item.type === "console" || item.type === "log" || item.type === "trace" ? (
                        <pre className="font-mono-war text-[10px] text-white/60 whitespace-pre-wrap leading-relaxed">
                            [Evidence content loading...]\n{item.path}\n[File: {item.name}]
                        </pre>
                    ) : item.type === "har" ? (
                        <pre className="font-mono-war text-[9px] text-white/50 whitespace-pre-wrap leading-relaxed overflow-x-auto">
                            HAR capture: {item.name}\nPath: {item.path}
                        </pre>
                    ) : (
                        <div className="text-center py-8">
                            <span className="font-mono-war text-xs text-white/30">{item.type.toUpperCase()} evidence viewer</span>
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}

export function EvidenceViewer() {
    const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
    const [selectedItem, setSelectedItem] = useState<EvidenceItem | null>(null);
    const [filter, setFilter] = useState<EvidenceItem["type"] | "all">("all");

    const fetchEvidence = useCallback(async () => {
        try {
            const res = await fetch(`${API}/evidence`);
            if (res.ok) {
                const data = await res.json();
                const items: EvidenceItem[] = Object.entries(data.evidence || {}).flatMap(([category, files]: [string, unknown]) =>
                    (files as string[]).map((f, i) => ({
                        id: `${category}-${i}`,
                        type: category as EvidenceItem["type"],
                        name: f as string,
                        path: `${category}/${f}`,
                        timestamp: Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 3600),
                        size: `${(Math.random() * 500 + 10).toFixed(0)}KB`,
                    }))
                );
                setEvidence(items);
            }
        } catch { /* silent */ }
    }, []);

    useEffect(() => {
        fetchEvidence();
        const id = setInterval(fetchEvidence, 10000);
        return () => clearInterval(id);
    }, [fetchEvidence]);

    const filtered = filter === "all" ? evidence : evidence.filter((e) => e.type === filter);
    const counts = evidence.reduce((acc, e) => { acc[e.type] = (acc[e.type] || 0) + 1; return acc; }, {} as Record<string, number>);

    return (
        <div className="rounded-lg border border-white/10 bg-card/40 backdrop-blur-sm overflow-hidden h-full flex flex-col">
            {/* Header */}
            <div className="px-4 py-2.5 border-b border-white/8 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <motion.div className="w-1.5 h-1.5 rounded-full bg-yellow-400" animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 2, repeat: Infinity }} />
                    <FileText size={12} style={{ color: "#FFC857" }} />
                    <span className="font-mono-war text-xs font-bold tracking-widest uppercase text-white/70">
                        EVIDENCE VAULT
                    </span>
                </div>
                <span className="font-mono-war text-[9px] text-white/25">{evidence.length} FILES</span>
            </div>

            {/* Filters */}
            <div className="px-4 py-2 border-b border-white/5 flex items-center gap-1 flex-wrap shrink-0">
                {(["all", "screenshot", "console", "network", "har", "trace", "log"] as const).map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className="font-mono-war text-[8px] px-2 py-1 rounded uppercase tracking-wider transition-colors"
                        style={{
                            color: filter === f ? "#FFC857" : "rgba(255,255,255,0.3)",
                            background: filter === f ? "rgba(255,200,87,0.1)" : "transparent",
                            border: filter === f ? "1px solid rgba(255,200,87,0.3)" : "1px solid transparent",
                        }}
                    >
                        {f} {counts[f] !== undefined ? `(${counts[f]})` : ""}
                    </button>
                ))}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto py-1">
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-2 py-8">
                        <FileText size={24} style={{ color: "rgba(255,255,255,0.1)" }} />
                        <span className="font-mono-war text-[10px] text-white/20 uppercase tracking-wider">No evidence captured</span>
                    </div>
                ) : (
                    filtered.map((item) => (
                        <EvidenceRow key={item.id} item={item} onView={() => setSelectedItem(item)} />
                    ))
                )}
            </div>

            <AnimatePresence>
                {selectedItem && <ViewerModal item={selectedItem} onClose={() => setSelectedItem(null)} />}
            </AnimatePresence>
        </div>
    );
}
