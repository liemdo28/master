"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWarRoomStore, WarEvent } from "../../store/war-room-store";
import { Terminal, Filter, Trash2, Zap, AlertTriangle, CheckCircle, Info } from "lucide-react";

const API = "http://localhost:7700/api";

// ─── Severity config ──────────────────────────────────────────────────────────────

function severityConfig(severity: WarEvent["severity"]) {
    switch (severity) {
        case "critical":
            return { color: "#FF2E63", bg: "rgba(255,46,99,0.08)", icon: Zap, prefix: "█", tag: "CRIT" };
        case "warning":
            return { color: "#FFC857", bg: "rgba(255,200,87,0.06)", icon: AlertTriangle, prefix: "▸", tag: "WARN" };
        case "success":
            return { color: "#00FFB3", bg: "rgba(0,255,179,0.05)", icon: CheckCircle, prefix: "▸", tag: "OK" };
        default:
            return { color: "#4DA3FF", bg: "rgba(77,163,255,0.05)", icon: Info, prefix: "▸", tag: "INFO" };
    }
}

// ─── Event Row ──────────────────────────────────────────────────────────────────

function EventRow({ event, index }: { event: WarEvent; index: number }) {
    const cfg = severityConfig(event.severity);
    const Icon = cfg.icon;

    return (
        <motion.div
            className="flex items-start gap-2 px-3 py-1.5 hover:bg-white/3 transition-colors group"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
        >
            {/* Timestamp */}
            <span className="font-mono-war text-[9px] text-white/25 shrink-0 tabular-nums w-16">
                {new Date(event.timestamp * 1000).toLocaleTimeString("en-US", {
                    hour12: false,
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                })}
            </span>

            {/* Severity tag */}
            <span
                className="font-mono-war text-[8px] font-bold px-1 py-0.5 rounded shrink-0 w-10 text-center uppercase"
                style={{
                    color: cfg.color,
                    background: cfg.bg,
                    border: `1px solid ${cfg.color}30`,
                }}
            >
                {cfg.tag}
            </span>

            {/* Source */}
            <span className="font-mono-war text-[9px] text-white/35 shrink-0 uppercase w-16 truncate">
                [{event.source}]
            </span>

            {/* Message */}
            <span className="font-mono-war text-[10px] flex-1 leading-snug" style={{ color: "rgba(255,255,255,0.75)" }}>
                {event.message}
            </span>

            {/* Icon */}
            <Icon size={10} style={{ color: cfg.color, opacity: 0.6 }} className="mt-0.5 shrink-0" />
        </motion.div>
    );
}

// ─── Main Component ──────────────────────────────────────────────────────────────

export function LiveEventStream() {
    const { events, addEvent, clearEvents } = useWarRoomStore();
    const [filter, setFilter] = useState<WarEvent["severity"] | "all">("all");
    const [search, setSearch] = useState("");
    const logRef = useRef<HTMLDivElement>(null);
    const [autoScroll, setAutoScroll] = useState(true);
    const [eventCount, setEventCount] = useState(0);

    // Fetch events from API
    const fetchEvents = useCallback(async () => {
        try {
            const res = await fetch(`${API}/events?limit=20&seconds=300`);
            if (res.ok) {
                const data = await res.json();
                const raw = data.recent || [];
                raw.forEach((e: Record<string, unknown>) => {
                    const warEvent: WarEvent = {
                        id: (e.id as string) || `evt-${Date.now()}-${Math.random()}`,
                        type: (e.type as string) || "unknown",
                        source: (e.source as string) || "system",
                        severity: ((e.type as string) || "").includes("critical") || ((e.type as string) || "").includes("failure")
                            ? "critical"
                            : ((e.type as string) || "").includes("warning") || ((e.type as string) || "").includes("degraded")
                                ? "warning"
                                : ((e.type as string) || "").includes("recovered") || ((e.type as string) || "").includes("completed")
                                    ? "success"
                                    : "info",
                        message: (e.type as string) || JSON.stringify(e.data || {}),
                        timestamp: (e.timestamp as number) || Math.floor(Date.now() / 1000),
                        metadata: (e.data as Record<string, unknown>) || {},
                    };
                    addEvent(warEvent);
                });
                setEventCount((prev) => prev + raw.length);
            }
        } catch { /* silent */ }
    }, [addEvent]);

    // Simulated events when API is not available
    useEffect(() => {
        const sources = ["dashboard", "gateway", "providers", "websocket", "queues", "browser", "runtime"];
        const messages = [
            { sev: "info" as const, msg: "Health check passed" },
            { sev: "info" as const, msg: "WebSocket heartbeat OK" },
            { sev: "info" as const, msg: "Provider latency nominal" },
            { sev: "warning" as const, msg: "Queue depth increased: 42 → 67" },
            { sev: "info" as const, msg: "New browser session connected" },
            { sev: "warning" as const, msg: "Retry storm detected: 3 providers" },
            { sev: "success" as const, msg: "Incident mitigated: provider_timeout" },
            { sev: "info" as const, msg: "Memory usage: 67% (stable)" },
            { sev: "critical" as const, msg: "Provider openai timeout: 5000ms" },
            { sev: "warning" as const, msg: "CPU spike: 45% → 78%" },
            { sev: "info" as const, msg: "Event loop lag: 12ms (healthy)" },
            { sev: "success" as const, msg: "WebSocket reconnect successful" },
            { sev: "info" as const, msg: "Audit cycle completed" },
            { sev: "warning" as const, msg: "Hydration mismatch in /dashboard" },
        ];

        const interval = setInterval(() => {
            const msg = messages[Math.floor(Math.random() * messages.length)];
            const src = sources[Math.floor(Math.random() * sources.length)];
            const newEvent: WarEvent = {
                id: `sim-${Date.now()}-${Math.random()}`,
                type: msg.msg.toLowerCase().replace(/\s+/g, "."),
                source: src,
                severity: msg.sev,
                message: msg.msg,
                timestamp: Math.floor(Date.now() / 1000),
            };
            addEvent(newEvent);
            setEventCount((c) => c + 1);
        }, 1500);

        return () => clearInterval(interval);
    }, [addEvent]);

    // Poll API periodically
    useEffect(() => {
        const id = setInterval(fetchEvents, 8000);
        return () => clearInterval(id);
    }, [fetchEvents]);

    // Auto-scroll
    useEffect(() => {
        if (autoScroll && logRef.current) {
            logRef.current.scrollTop = 0;
        }
    }, [events, autoScroll]);

    const filtered = events.filter((e) => {
        if (filter !== "all" && e.severity !== filter) return false;
        if (search && !e.message.toLowerCase().includes(search.toLowerCase()) && !e.source.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    const criticalCount = events.filter((e) => e.severity === "critical").length;
    const warningCount = events.filter((e) => e.severity === "warning").length;

    return (
        <div className="rounded-lg border border-white/10 bg-card/40 backdrop-blur-sm overflow-hidden h-full flex flex-col">
            {/* Header */}
            <div className="px-4 py-2.5 border-b border-white/8 shrink-0">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <motion.div
                            className="w-1.5 h-1.5 rounded-full bg-cyan-400"
                            animate={{ opacity: [1, 0.3, 1] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                        />
                        <Terminal size={12} style={{ color: "rgba(0,255,179,0.6)" }} />
                        <span className="font-mono-war text-xs font-bold tracking-widest uppercase text-white/70">
                            LIVE EVENT STREAM
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        {criticalCount > 0 && (
                            <motion.span
                                className="font-mono-war text-[9px] font-bold px-1.5 py-0.5 rounded"
                                style={{ color: "#FF2E63", background: "rgba(255,46,99,0.15)" }}
                                animate={{ opacity: [1, 0.5, 1] }}
                                transition={{ duration: 0.4, repeat: Infinity }}
                            >
                                {criticalCount} CRIT
                            </motion.span>
                        )}
                        {warningCount > 0 && (
                            <span className="font-mono-war text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ color: "#FFC857", background: "rgba(255,200,87,0.1)" }}>
                                {warningCount} WARN
                            </span>
                        )}
                        <span className="font-mono-war text-[9px] text-white/30">
                            {filtered.length} events
                        </span>
                        <button
                            onClick={() => clearEvents()}
                            className="p-1 rounded hover:bg-white/10 transition-colors"
                            title="Clear events"
                        >
                            <Trash2 size={11} style={{ color: "rgba(255,255,255,0.3)" }} />
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                        {(["all", "critical", "warning", "success", "info"] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className="font-mono-war text-[8px] px-2 py-1 rounded uppercase tracking-wider transition-colors"
                                style={{
                                    color: filter === f ? severityConfig(f as WarEvent["severity"]).color : "rgba(255,255,255,0.3)",
                                    background: filter === f ? `${severityConfig(f as WarEvent["severity"]).color}12` : "transparent",
                                    border: filter === f ? `1px solid ${severityConfig(f as WarEvent["severity"]).color}30` : "1px solid transparent",
                                }}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                    <div className="flex-1" />
                    <div className="flex items-center gap-1.5">
                        <span className="font-mono-war text-[8px] text-white/25 uppercase tracking-wider">FIND</span>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="filter events..."
                            className="bg-transparent border border-white/10 rounded px-2 py-0.5 font-mono-war text-[9px] text-white/70 placeholder:text-white/20 focus:outline-none focus:border-cyan-400/40 w-36"
                        />
                    </div>
                    <button
                        onClick={() => setAutoScroll(!autoScroll)}
                        className="font-mono-war text-[8px] px-2 py-1 rounded uppercase tracking-wider transition-colors"
                        style={{
                            color: autoScroll ? "#00FFB3" : "rgba(255,255,255,0.3)",
                            background: autoScroll ? "rgba(0,255,179,0.08)" : "transparent",
                            border: `1px solid ${autoScroll ? "rgba(0,255,179,0.3)" : "transparent"}`,
                        }}
                    >
                        AUTO
                    </button>
                </div>
            </div>

            {/* Event log */}
            <div
                ref={logRef}
                className="flex-1 overflow-y-auto font-mono-war"
                style={{ maxHeight: "280px" }}
            >
                {filtered.length === 0 ? (
                    <div className="flex items-center justify-center h-full py-8">
                        <span className="font-mono-war text-[10px] text-white/20 uppercase tracking-wider">
                            No events match filter
                        </span>
                    </div>
                ) : (
                    <AnimatePresence initial={false}>
                        {filtered.map((event, i) => (
                            <EventRow key={event.id} event={event} index={i} />
                        ))}
                    </AnimatePresence>
                )}
            </div>

            {/* Bottom status bar */}
            <div className="px-4 py-1.5 border-t border-white/8 flex items-center justify-between shrink-0" style={{ background: "rgba(0,0,0,0.2)" }}>
                <div className="flex items-center gap-2">
                    <span className="font-mono-war text-[8px] text-white/20 uppercase tracking-widest">
                        STREAM
                    </span>
                    <motion.div
                        className="w-1 h-1 rounded-full bg-cyan-400"
                        animate={{ opacity: [1, 0.2, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                    />
                    <span className="font-mono-war text-[8px] text-cyan-400/60">
                        LIVE
                    </span>
                </div>
                <span className="font-mono-war text-[8px] text-white/20">
                    TOTAL: {eventCount} | BUFFER: {events.length}/200
                </span>
            </div>
        </div>
    );
}
