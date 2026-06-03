"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { WarRoomHeader } from "../components/layout/warroom-header";
import { WarRoomLayout } from "../components/layout/war-room-layout";
import { EcosystemTopology } from "../modules/topology/ecosystem-topology";
import { IncidentTimeline } from "../modules/incidents/incident-timeline";
import { LiveEventStream } from "../components/events/live-event-stream";
import { RuntimeWarfare } from "../modules/runtime/runtime-warfare";
import { BrowserWarfare } from "../modules/browser/browser-warfare";
import { ChaosControl } from "../modules/chaos/chaos-control";
import { OperationalScoring } from "../modules/scoring/operational-scoring";
import { useWarRoomStore } from "../store/war-room-store";
import { useWarRoomWS } from "../websocket/client";
import { Radio, Zap, ChevronLeft, ChevronRight } from "lucide-react";

const API = "http://localhost:7700/api";

// ─── Left Panel ───────────────────────────────────────────────────────────────

function LeftPanel({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
    const { providers, setProviders, runtime, setRuntime } = useWarRoomStore();

    return (
        <motion.div
            className="flex flex-col h-full border-r border-white/10"
            style={{ background: "rgba(5,8,22,0.6)", width: collapsed ? "48px" : "280px" }}
            animate={{ width: collapsed ? 48 : 280 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
        >
            {/* Collapse toggle */}
            <button
                onClick={onToggle}
                className="flex items-center justify-center py-2 border-b border-white/8 hover:bg-white/5 transition-colors"
            >
                {collapsed ? (
                    <ChevronRight size={14} style={{ color: "rgba(255,255,255,0.3)" }} />
                ) : (
                    <ChevronLeft size={14} style={{ color: "rgba(255,255,255,0.3)" }} />
                )}
            </button>

            {!collapsed && (
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {/* Providers */}
                    <div className="rounded border border-white/10 bg-black/20 p-3">
                        <div className="flex items-center gap-2 mb-2">
                            <Radio size={11} style={{ color: "#00FFB3" }} />
                            <span className="font-mono-war text-[9px] font-bold tracking-widest uppercase text-white/60">
                                PROVIDERS
                            </span>
                        </div>
                        <div className="space-y-1.5">
                            {(providers.length > 0 ? providers : [
                                { name: "openai", latency_ms: 120, timeout_rate: 0.2, failure_rate: 0.5, status: "healthy" },
                                { name: "anthropic", latency_ms: 180, timeout_rate: 0.1, failure_rate: 0.3, status: "healthy" },
                                { name: "database", latency_ms: 15, timeout_rate: 0.0, failure_rate: 0.1, status: "healthy" },
                            ]).map((p, i) => (
                                <div key={i} className="flex items-center justify-between py-1">
                                    <span className="font-mono-war text-[10px] text-white/50 uppercase">{p.name}</span>
                                    <div className="flex items-center gap-1.5">
                                        <span className="font-mono-war text-[9px] font-bold" style={{ color: p.failure_rate > 2 ? "#FF5C7A" : "#00FFB3" }}>
                                            {p.latency_ms}ms
                                        </span>
                                        <div
                                            className="w-1.5 h-1.5 rounded-full"
                                            style={{
                                                backgroundColor: p.failure_rate > 2 ? "#FF5C7A" : "#00FFB3",
                                                boxShadow: `0 0 4px ${p.failure_rate > 2 ? "#FF5C7A" : "#00FFB3"}`,
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Runtime snapshot */}
                    <div className="rounded border border-white/10 bg-black/20 p-3">
                        <div className="flex items-center gap-2 mb-2">
                            <Zap size={11} style={{ color: "#4DA3FF" }} />
                            <span className="font-mono-war text-[9px] font-bold tracking-widest uppercase text-white/60">
                                RUNTIME SNAP
                            </span>
                        </div>
                        <div className="space-y-1">
                            {[
                                { label: "CPU", value: `${runtime.cpu_percent.toFixed(0)}%`, color: runtime.cpu_percent > 80 ? "#FF2E63" : "#00FFB3" },
                                { label: "MEM", value: `${runtime.memory_percent.toFixed(0)}%`, color: runtime.memory_percent > 80 ? "#FFC857" : "#00FFB3" },
                                { label: "WS", value: String(runtime.websocket_count), color: "#4DA3FF" },
                                { label: "QUEUE", value: String(runtime.queue_depth), color: runtime.queue_depth > 50 ? "#FFC857" : "#00FFB3" },
                            ].map((m) => (
                                <div key={m.label} className="flex items-center justify-between">
                                    <span className="font-mono-war text-[9px] text-white/40 uppercase">{m.label}</span>
                                    <span className="font-mono-war text-[10px] font-bold" style={{ color: m.color }}>{m.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </motion.div>
    );
}

// ─── Provider Panel ───────────────────────────────────────────────────────────

function ProviderPanel() {
    const { providers } = useWarRoomStore();
    const defaultProviders = [
        { name: "OpenAI", latency_ms: 120, timeout_rate: 0.2, failure_rate: 0.5, status: "healthy" },
        { name: "Anthropic", latency_ms: 180, timeout_rate: 0.1, failure_rate: 0.3, status: "healthy" },
        { name: "PostgreSQL", latency_ms: 15, timeout_rate: 0.0, failure_rate: 0.1, status: "healthy" },
        { name: "Redis", latency_ms: 3, timeout_rate: 0.0, failure_rate: 0.05, status: "healthy" },
    ];
    const provs = providers.length > 0 ? providers : defaultProviders;

    return (
        <div className="rounded-lg border border-white/10 bg-card/40 backdrop-blur-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-white/8 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span className="font-mono-war text-xs font-bold tracking-widest uppercase text-white/70">
                    PROVIDER MATRIX
                </span>
            </div>
            <div className="p-3 space-y-2">
                {provs.map((p, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded border" style={{
                        borderColor: p.failure_rate > 2 ? "rgba(255,92,122,0.3)" : "rgba(0,255,179,0.15)",
                        background: p.failure_rate > 2 ? "rgba(255,92,122,0.05)" : "rgba(0,255,179,0.02)",
                    }}>
                        <div className="w-2 h-2 rounded-full" style={{
                            backgroundColor: p.failure_rate > 2 ? "#FF5C7A" : "#00FFB3",
                            boxShadow: `0 0 6px ${p.failure_rate > 2 ? "#FF5C7A" : "#00FFB3"}`,
                        }} />
                        <div className="flex-1">
                            <span className="font-mono-war text-[10px] font-bold text-white/70 uppercase">{p.name}</span>
                        </div>
                        <div className="text-right">
                            <span className="font-mono-war text-[10px] font-bold" style={{ color: p.latency_ms > 500 ? "#FF5C7A" : "#00FFB3" }}>
                                {p.latency_ms}ms
                            </span>
                        </div>
                        <div className="text-right w-16">
                            <span className="font-mono-war text-[9px]" style={{ color: p.failure_rate > 2 ? "#FF5C7A" : "#00FFB3" }}>
                                F: {p.failure_rate.toFixed(1)}%
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function WarRoomPage() {
    const { mode, setScores } = useWarRoomStore();
    const [leftCollapsed, setLeftCollapsed] = useState(false);
    const [mounted, setMounted] = useState(false);

    // WebSocket connection
    useWarRoomWS();

    // Initial data load
    const fetchInitial = useCallback(async () => {
        try {
            const res = await fetch(`${API}/warroom`);
            if (res.ok) {
                const data = await res.json();
                setScores(data.operational_score ?? 87, data.collapse_probability ?? 0.12);
            }
        } catch { /* silent */ }
    }, [setScores]);

    useEffect(() => {
        setMounted(true);
        fetchInitial();
        const id = setInterval(fetchInitial, 5000);
        return () => clearInterval(id);
    }, [fetchInitial]);

    if (!mounted) return null;

    // ─── Full War Room Layout ─────────────────────────────────────────────────

    if (mode === "war-room") {
        return (
            <WarRoomLayout>
                <div className="flex h-full">
                    {/* Left sidebar */}
                    <LeftPanel collapsed={leftCollapsed} onToggle={() => setLeftCollapsed(!leftCollapsed)} />

                    {/* Main center */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <WarRoomHeader />

                        <div className="flex-1 overflow-hidden p-3 flex gap-3">
                            {/* Left column: Topology + Event Stream */}
                            <div className="flex flex-col gap-3 w-[380px] shrink-0">
                                <div className="flex-1 min-h-0">
                                    <EcosystemTopology />
                                </div>
                                <div className="h-[280px] shrink-0">
                                    <LiveEventStream />
                                </div>
                            </div>

                            {/* Center column: Incidents + Providers */}
                            <div className="flex flex-col gap-3 flex-1 min-w-0">
                                <div className="flex-1 min-h-0">
                                    <IncidentTimeline />
                                </div>
                                <div className="h-[220px] shrink-0">
                                    <ProviderPanel />
                                </div>
                            </div>

                            {/* Right column: Scoring + Runtime + Browser + Chaos */}
                            <div className="flex flex-col gap-3 w-[320px] shrink-0">
                                <OperationalScoring />
                                <RuntimeWarfare />
                                <BrowserWarfare />
                                <ChaosControl />
                            </div>
                        </div>
                    </div>
                </div>
            </WarRoomLayout>
        );
    }

    // ─── Compact Mode ─────────────────────────────────────────────────────────

    if (mode === "compact") {
        return (
            <WarRoomLayout>
                <div className="flex h-full">
                    <LeftPanel collapsed={leftCollapsed} onToggle={() => setLeftCollapsed(!leftCollapsed)} />
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <WarRoomHeader />
                        <div className="flex-1 overflow-hidden p-3">
                            <div className="grid grid-cols-4 gap-3 h-full">
                                <div className="flex flex-col gap-3">
                                    <EcosystemTopology />
                                    <LiveEventStream />
                                </div>
                                <div className="flex flex-col gap-3">
                                    <IncidentTimeline />
                                    <LiveEventStream />
                                </div>
                                <div className="flex flex-col gap-3">
                                    <RuntimeWarfare />
                                    <BrowserWarfare />
                                </div>
                                <div className="flex flex-col gap-3">
                                    <ChaosControl />
                                    <ProviderPanel />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </WarRoomLayout>
        );
    }

    // ─── Incident Focus Mode ─────────────────────────────────────────────────

    return (
        <WarRoomLayout>
            <div className="flex h-full">
                <LeftPanel collapsed={leftCollapsed} onToggle={() => setLeftCollapsed(!leftCollapsed)} />
                <div className="flex-1 flex flex-col overflow-hidden">
                    <WarRoomHeader />
                    <div className="flex-1 overflow-hidden p-3 flex gap-3">
                        {/* Left: Full incident timeline */}
                        <div className="flex-1 min-w-0">
                            <IncidentTimeline />
                        </div>
                        {/* Right: Context panels */}
                        <div className="flex flex-col gap-3 w-[380px] shrink-0">
                            <EcosystemTopology />
                            <LiveEventStream />
                            <RuntimeWarfare />
                            <LiveEventStream />
                        </div>
                    </div>
                </div>
            </div>
        </WarRoomLayout>
    );
}
