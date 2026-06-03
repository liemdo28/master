"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWarRoomStore } from "../../store/war-room-store";
import { AlertTriangle, ChevronDown, ChevronUp, X, Zap } from "lucide-react";

const API = "http://localhost:7700/api";

// ─── Types ──────────────────────────────────────────────────────────────────────

interface Incident {
    incident_id: string;
    title: string;
    severity: "critical" | "high" | "medium" | "low";
    state: "active" | "mitigating" | "resolved" | "investigating";
    timestamp: number;
    blast_radius: string;
    affected_subsystems: string[];
    description?: string;
    evidence?: string[];
    timeline?: { time: number; event: string }[];
}

// ─── Severity config ────────────────────────────────────────────────────────────

function severityConfig(severity: string) {
    switch (severity) {
        case "critical": return { color: "#FF2E63", bg: "rgba(255,46,99,0.12)", border: "rgba(255,46,99,0.4)", label: "CRITICAL" };
        case "high": return { color: "#FF5C7A", bg: "rgba(255,92,122,0.1)", border: "rgba(255,92,122,0.35)", label: "HIGH" };
        case "medium": return { color: "#FFC857", bg: "rgba(255,200,87,0.08)", border: "rgba(255,200,87,0.3)", label: "MEDIUM" };
        default: return { color: "#4DA3FF", bg: "rgba(77,163,255,0.08)", border: "rgba(77,163,255,0.25)", label: "LOW" };
    }
}

function stateColor(state: string) {
    switch (state) {
        case "active": return "#FF2E63";
        case "investigating": return "#FFC857";
        case "mitigating": return "#4DA3FF";
        case "resolved": return "#00FFB3";
        default: return "#666";
    }
}

// ─── Collapsed Timeline Card ───────────────────────────────────────────────────

function IncidentCard({
    incident, expanded, onToggle,
}: {
    incident: Incident;
    expanded: boolean;
    onToggle: () => void;
}) {
    const cfg = severityConfig(incident.severity);
    const isActive = incident.state === "active";
    const isCollapsing = incident.severity === "critical" && isActive;

    return (
        <motion.div
            className="rounded-lg border overflow-hidden"
            style={{
                borderColor: isActive ? cfg.border : "rgba(255,255,255,0.08)",
                background: cfg.bg,
                boxShadow: isActive ? `0 0 15px ${cfg.color}20` : "none",
            }}
            layout
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
        >
            {/* Main row */}
            <button
                className="w-full px-4 py-3 flex items-start gap-3 text-left"
                onClick={onToggle}
            >
                {/* Severity indicator */}
                <motion.div
                    className="mt-0.5 shrink-0 w-2 h-2 rounded-full"
                    style={{
                        backgroundColor: cfg.color,
                        boxShadow: isActive ? `0 0 8px ${cfg.color}` : "none",
                    }}
                    animate={isCollapsing ? { opacity: [1, 0.2, 1], scale: [1, 1.5, 1] } : isActive ? { opacity: [1, 0.5, 1] } : {}}
                    transition={{ duration: isCollapsing ? 0.4 : 1, repeat: Infinity }}
                />

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span
                            className="font-mono-war text-[9px] font-bold tracking-widest uppercase"
                            style={{ color: cfg.color }}
                        >
                            {cfg.label}
                        </span>
                        <span
                            className="font-mono-war text-[8px] px-1.5 py-0.5 rounded uppercase tracking-wider"
                            style={{
                                color: stateColor(incident.state),
                                background: `${stateColor(incident.state)}15`,
                                border: `1px solid ${stateColor(incident.state)}30`,
                            }}
                        >
                            {incident.state}
                        </span>
                        {isCollapsing && (
                            <motion.span
                                className="font-mono-war text-[8px] font-bold px-1.5 py-0.5 rounded uppercase"
                                style={{ color: "#FF2E63", background: "rgba(255,46,99,0.2)" }}
                                animate={{ opacity: [1, 0.5, 1] }}
                                transition={{ duration: 0.3, repeat: Infinity }}
                            >
                                COLLAPSE
                            </motion.span>
                        )}
                    </div>

                    <h4 className="font-mono-war text-sm font-bold mt-1 text-white/90 leading-tight">
                        {incident.title}
                    </h4>

                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <span className="font-mono-war text-[9px] text-white/35">
                            {new Date(incident.timestamp * 1000).toLocaleTimeString("en-US", { hour12: false })}
                        </span>
                        <span className="font-mono-war text-[9px] text-white/35">
                            ▸ {incident.blast_radius}
                        </span>
                    </div>

                    {/* Subsystem tags */}
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                        {incident.affected_subsystems.slice(0, 4).map((s) => (
                            <span
                                key={s}
                                className="font-mono-war text-[8px] px-1.5 py-0.5 rounded uppercase tracking-wider"
                                style={{
                                    color: "rgba(255,255,255,0.5)",
                                    background: "rgba(255,255,255,0.06)",
                                    border: "1px solid rgba(255,255,255,0.1)",
                                }}
                            >
                                {s}
                            </span>
                        ))}
                        {incident.affected_subsystems.length > 4 && (
                            <span className="font-mono-war text-[8px] text-white/30 px-1">
                                +{incident.affected_subsystems.length - 4}
                            </span>
                        )}
                    </div>
                </div>

                {/* Expand icon */}
                <div className="shrink-0 mt-1">
                    {expanded ? (
                        <ChevronUp size={14} style={{ color: "rgba(255,255,255,0.4)" }} />
                    ) : (
                        <ChevronDown size={14} style={{ color: "rgba(255,255,255,0.4)" }} />
                    )}
                </div>
            </button>

            {/* Expanded detail */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        className="px-4 pb-4 border-t"
                        style={{ borderColor: `${cfg.color}20` }}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <div className="pt-3 space-y-3">
                            {incident.description && (
                                <p className="font-mono-war text-[10px] text-white/50 leading-relaxed">
                                    {incident.description}
                                </p>
                            )}

                            {/* Mini timeline */}
                            {incident.timeline && incident.timeline.length > 0 && (
                                <div className="space-y-1.5">
                                    <span className="font-mono-war text-[8px] text-white/30 uppercase tracking-widest block mb-1">
                                        Incident Timeline
                                    </span>
                                    {incident.timeline.map((entry, i) => (
                                        <div key={i} className="flex items-start gap-2">
                                            <div className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: `${cfg.color}60` }} />
                                            <div className="flex-1">
                                                <span className="font-mono-war text-[9px] text-white/40">
                                                    {new Date(entry.time * 1000).toLocaleTimeString("en-US", { hour12: false })}
                                                </span>
                                                <p className="font-mono-war text-[10px] text-white/70 leading-snug">{entry.event}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Evidence links */}
                            {incident.evidence && incident.evidence.length > 0 && (
                                <div>
                                    <span className="font-mono-war text-[8px] text-white/30 uppercase tracking-widest block mb-1">
                                        Evidence
                                    </span>
                                    <div className="flex gap-1 flex-wrap">
                                        {incident.evidence.map((ev, i) => (
                                            <span
                                                key={i}
                                                className="font-mono-war text-[8px] px-1.5 py-0.5 rounded border text-white/50 uppercase"
                                                style={{ borderColor: "rgba(255,255,255,0.1)" }}
                                            >
                                                {ev}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// ─── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
            <motion.div
                className="w-12 h-12 rounded-full border-2 flex items-center justify-center"
                style={{ borderColor: "rgba(0,255,179,0.2)" }}
                animate={{ borderColor: ["rgba(0,255,179,0.2)", "rgba(0,255,179,0.4)", "rgba(0,255,179,0.2)"] }}
                transition={{ duration: 3, repeat: Infinity }}
            >
                <AlertTriangle size={20} style={{ color: "rgba(0,255,179,0.3)" }} />
            </motion.div>
            <div className="text-center">
                <p className="font-mono-war text-xs text-white/40 tracking-wider uppercase">
                    No Active Incidents
                </p>
                <p className="font-mono-war text-[9px] text-white/20 mt-1">
                    System operating within normal parameters
                </p>
            </div>
        </div>
    );
}

// ─── Main Timeline ─────────────────────────────────────────────────────────────

export function IncidentTimeline() {
    const { incidents, setIncidents } = useWarRoomStore();
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [filter, setFilter] = useState<"all" | "active" | "resolved">("all");

    const fetchIncidents = useCallback(async () => {
        try {
            const res = await fetch(`${API}/incidents`);
            if (res.ok) {
                const data = await res.json();
                const raw = data.incidents || [];
                const mapped: Incident[] = raw.map((i: Record<string, unknown>) => ({
                    incident_id: i.incident_id as string || `inc-${Date.now()}`,
                    title: i.title as string || "Unknown Incident",
                    severity: (i.severity as string || "medium") as Incident["severity"],
                    state: (i.state as string || "active") as Incident["state"],
                    timestamp: (i.timestamp as number) || Math.floor(Date.now() / 1000),
                    blast_radius: i.blast_radius as string || "Unknown",
                    affected_subsystems: (i.affected_subsystems as string[]) || [],
                    description: i.description as string,
                    evidence: (i.evidence as string[]) || [],
                    timeline: (i.timeline as { time: number; event: string }[]) || [],
                }));
                setIncidents(mapped as never[]);
            }
        } catch { /* silent */ }
    }, [setIncidents]);

    useEffect(() => {
        fetchIncidents();
        const id = setInterval(fetchIncidents, 5000);
        return () => clearInterval(id);
    }, [fetchIncidents]);

    const filtered = incidents.filter((i) => {
        if (filter === "active") return i.state === "active" || i.state === "investigating";
        if (filter === "resolved") return i.state === "resolved";
        return true;
    });

    const activeCount = incidents.filter((i) => i.state === "active").length;
    const criticalCount = incidents.filter((i) => i.severity === "critical" && i.state === "active").length;

    return (
        <div className="rounded-lg border border-white/10 bg-card/40 backdrop-blur-sm overflow-hidden h-full flex flex-col">
            {/* Header */}
            <div className="px-4 py-2.5 border-b border-white/8 shrink-0">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <motion.div
                            className="w-1.5 h-1.5 rounded-full"
                            style={{
                                backgroundColor: criticalCount > 0 ? "#FF2E63" : activeCount > 0 ? "#FFC857" : "#00FFB3",
                                boxShadow: criticalCount > 0 ? "0 0 8px #FF2E63" : activeCount > 0 ? "0 0 8px #FFC857" : "0 0 8px #00FFB3",
                            }}
                            animate={criticalCount > 0 ? { opacity: [1, 0.3, 1] } : {}}
                            transition={{ duration: 0.5, repeat: Infinity }}
                        />
                        <span className="font-mono-war text-xs font-bold tracking-widest uppercase text-white/70">
                            INCIDENT TIMELINE
                        </span>
                    </div>

                    {/* Counts */}
                    <div className="flex items-center gap-3">
                        {criticalCount > 0 && (
                            <motion.span
                                className="font-mono-war text-[9px] font-bold px-1.5 py-0.5 rounded"
                                style={{ color: "#FF2E63", background: "rgba(255,46,99,0.15)" }}
                                animate={{ opacity: [1, 0.6, 1] }}
                                transition={{ duration: 0.4, repeat: Infinity }}
                            >
                                {criticalCount} CRITICAL
                            </motion.span>
                        )}
                        {activeCount > 0 && (
                            <span className="font-mono-war text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ color: "#FFC857", background: "rgba(255,200,87,0.1)" }}>
                                {activeCount} ACTIVE
                            </span>
                        )}
                    </div>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-1">
                    {(["all", "active", "resolved"] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className="font-mono-war text-[9px] px-2 py-1 rounded uppercase tracking-wider transition-colors"
                            style={{
                                color: filter === f ? "#00FFB3" : "rgba(255,255,255,0.3)",
                                background: filter === f ? "rgba(0,255,179,0.1)" : "transparent",
                                border: filter === f ? "1px solid rgba(0,255,179,0.3)" : "1px solid transparent",
                            }}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {/* Timeline body */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {filtered.length === 0 ? (
                    <EmptyState />
                ) : (
                    <AnimatePresence mode="popLayout">
                        {filtered.map((incident) => (
                            <IncidentCard
                                key={incident.incident_id}
                                incident={incident}
                                expanded={expandedId === incident.incident_id}
                                onToggle={() =>
                                    setExpandedId(
                                        expandedId === incident.incident_id ? null : incident.incident_id
                                    )
                                }
                            />
                        ))}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
}
