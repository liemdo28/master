"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, AlertTriangle, Shield, Radio, Wifi, WifiOff } from "lucide-react";

const API = "http://localhost:7700/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WarRoomStatus {
    status: string;
    operational_score: number;
    collapse_probability: number;
    active_incidents: number;
    runtime_health: number;
    critical_signals: string[];
    weakest_subsystem: string;
    chaos_active: boolean;
    warfare_mode: boolean;
}

// ─── Status Logic ─────────────────────────────────────────────────────────────

function getThreatLevel(status: WarRoomStatus): "nominal" | "elevated" | "high" | "critical" {
    if (status.collapse_probability > 0.7 || status.status === "collapsed") return "critical";
    if (status.collapse_probability > 0.4 || status.status === "critical") return "high";
    if (status.collapse_probability > 0.15 || status.status === "degraded") return "elevated";
    return "nominal";
}

function threatColor(level: ReturnType<typeof getThreatLevel>): string {
    switch (level) {
        case "critical": return "#FF2E63";
        case "high": return "#FF5C7A";
        case "elevated": return "#FFC857";
        default: return "#00FFB3";
    }
}

function scoreColor(score: number): string {
    if (score >= 85) return "#00FFB3";
    if (score >= 70) return "#FFC857";
    if (score >= 50) return "#FF5C7A";
    return "#FF2E63";
}

// ─── Animated Indicators ───────────────────────────────────────────────────────

function PulsingDot({ color, size = 6 }: { color: string; size?: number }) {
    return (
        <motion.span
            className="inline-block rounded-full shrink-0"
            style={{ width: size, height: size, backgroundColor: color }}
            animate={{ opacity: [1, 0.3, 1], scale: [1, 1.3, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        />
    );
}

function StatusBadge({
    label, active, color, icon,
}: {
    label: string; active: boolean; color: string; icon: React.ReactNode;
}) {
    return (
        <motion.div
            className="flex items-center gap-1.5 px-3 py-1 rounded border font-mono-war text-xs font-bold tracking-wider shrink-0"
            style={{
                borderColor: active ? color : "rgba(255,255,255,0.1)",
                color: active ? color : "rgba(255,255,255,0.3)",
                background: active ? `${color}10` : "transparent",
                boxShadow: active ? `0 0 12px ${color}30` : "none",
            }}
            animate={active ? { scale: [1, 1.02, 1] } : {}}
            transition={{ duration: 2, repeat: active ? Infinity : 0 }}
        >
            <PulsingDot color={active ? color : "rgba(255,255,255,0.2)"} size={6} />
            {icon}
            <span>{label}</span>
        </motion.div>
    );
}

function MetricPill({
    label, value, unit, color, subLabel,
}: {
    label: string; value: number | string; unit?: string; color: string; subLabel?: string;
}) {
    return (
        <div className="flex flex-col items-center gap-0.5">
            <span className="font-mono-war text-[9px] tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.35)" }}>
                {label}
            </span>
            <div className="flex items-baseline gap-0.5">
                <AnimatePresence mode="wait">
                    <motion.span
                        key={String(value)}
                        className="font-mono-war text-xl font-bold tabular-nums"
                        style={{ color }}
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        transition={{ duration: 0.2 }}
                    >
                        {typeof value === "number" ? (value as number).toFixed((value as number) < 10 ? 1 : 0) : value}
                    </motion.span>
                </AnimatePresence>
                {unit && (
                    <span className="font-mono-war text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                        {unit}
                    </span>
                )}
            </div>
            {subLabel && (
                <span className="font-mono-war text-[8px] tracking-wider" style={{ color: "rgba(255,255,255,0.2)" }}>
                    {subLabel}
                </span>
            )}
        </div>
    );
}

function ThreatBar({ probability }: { probability: number }) {
    const pct = Math.min(100, probability * 100);
    const color = probability > 0.7 ? "#FF2E63" : probability > 0.4 ? "#FFC857" : "#00FFB3";
    return (
        <div className="flex flex-col gap-1 min-w-[100px]">
            <div className="flex items-center justify-between">
                <span className="font-mono-war text-[9px] tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.35)" }}>
                    COLLAPSE
                </span>
                <span className="font-mono-war text-xs font-bold" style={{ color }}>
                    {(probability * 100).toFixed(0)}%
                </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                />
            </div>
        </div>
    );
}

function ScoreGauge({ score }: { score: number }) {
    const color = scoreColor(score);
    const circumference = 2 * Math.PI * 20;
    const dashOffset = circumference - (score / 100) * circumference;
    return (
        <div className="relative w-12 h-12">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 44 44">
                <circle cx="22" cy="22" r="20" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" />
                <motion.circle
                    cx="22" cy="22" r="20"
                    fill="none"
                    stroke={color}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    animate={{ strokeDashoffset: dashOffset }}
                    style={{ filter: `drop-shadow(0 0 4px ${color})` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-mono-war text-sm font-bold tabular-nums" style={{ color }}>
                    {score.toFixed(0)}
                </span>
            </div>
        </div>
    );
}

function WarClock() {
    const [time, setTime] = useState("");
    useEffect(() => {
        const update = () => {
            const now = new Date();
            setTime(now.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }));
        };
        update();
        const id = setInterval(update, 1000);
        return () => clearInterval(id);
    }, []);
    return (
        <div className="flex flex-col items-end">
            <span className="font-mono-war text-base font-bold tabular-nums tracking-wider" style={{ color: "#4DA3FF" }}>
                {time}
            </span>
            <span className="font-mono-war text-[8px] tracking-widest uppercase" style={{ color: "rgba(77,163,255,0.35)" }}>
                UTC+7 / OPS
            </span>
        </div>
    );
}

// ─── Main Header ──────────────────────────────────────────────────────────────

export function WarRoomHeader() {
    const [status, setStatus] = useState<WarRoomStatus>({
        status: "unknown", operational_score: 0, collapse_probability: 0,
        active_incidents: 0, runtime_health: 0, critical_signals: [],
        weakest_subsystem: "", chaos_active: false, warfare_mode: true,
    });
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        async function fetchStatus() {
            try {
                const res = await fetch(`${API}/warroom`);
                if (res.ok) {
                    const data = await res.json();
                    setStatus((prev) => ({ ...prev, ...data }));
                    setConnected(true);
                } else {
                    setConnected(false);
                }
            } catch {
                setConnected(false);
            }
        }
        fetchStatus();
        const id = setInterval(fetchStatus, 2500);
        return () => clearInterval(id);
    }, []);

    const level = getThreatLevel(status);
    const tColor = threatColor(level);

    return (
        <motion.header
            className="sticky top-0 z-50 border-b"
            style={{
                background: "linear-gradient(180deg, rgba(5,8,22,0.99) 0%, rgba(5,8,22,0.93) 100%)",
                borderColor: `${tColor}22`,
                boxShadow: `0 0 40px ${tColor}12, 0 1px 0 ${tColor}18`,
            }}
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
        >
            {/* Top row */}
            <div className="px-6 py-2.5 flex items-center justify-between">
                {/* Left: Branding */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2.5">
                        {/* Animated logo */}
                        <div className="relative w-7 h-7">
                            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                                <circle cx="14" cy="14" r="12" stroke="#00FFB3" strokeWidth="1" opacity="0.2" />
                                <motion.circle
                                    cx="14" cy="14" r="12" stroke="#00FFB3" strokeWidth="1.5"
                                    animate={{ r: [12, 13, 12], opacity: [0.5, 0.1, 0.5] }}
                                    transition={{ duration: 3, repeat: Infinity }}
                                />
                                <circle cx="14" cy="14" r="6" stroke="#00FFB3" strokeWidth="1.5" opacity="0.6" />
                                <circle cx="14" cy="14" r="2.5" fill="#00FFB3" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="font-mono-war text-sm font-bold tracking-[0.25em] uppercase" style={{ color: "#00FFB3", textShadow: "0 0 14px rgba(0,255,179,0.5)" }}>
                                TESTER-QA
                            </h1>
                            <span className="font-mono-war text-[8px] tracking-[0.2em] uppercase block" style={{ color: "rgba(0,255,179,0.35)" }}>
                                Engineering Validation Blacksite
                            </span>
                        </div>
                    </div>

                    <div className="w-px h-8" style={{ backgroundColor: "rgba(255,255,255,0.08)" }} />

                    {/* Connection */}
                    <div className="flex items-center gap-1.5">
                        {connected ? (
                            <>
                                <Wifi size={11} style={{ color: "#00FFB3" }} />
                                <span className="font-mono-war text-[10px] tracking-wider uppercase" style={{ color: "rgba(0,255,179,0.6)" }}>
                                    LIVE FEED
                                </span>
                            </>
                        ) : (
                            <>
                                <WifiOff size={11} style={{ color: "#FFC857" }} />
                                <span className="font-mono-war text-[10px] tracking-wider uppercase" style={{ color: "#FFC857" }}>
                                    SIMULATION
                                </span>
                            </>
                        )}
                    </div>
                </div>

                {/* Center: Threat + Metrics */}
                <div className="flex items-center gap-5">
                    {/* Threat level badge */}
                    <motion.div
                        className="flex items-center gap-2 px-3 py-1.5 rounded border"
                        style={{
                            borderColor: `${tColor}50`,
                            background: `${tColor}08`,
                            boxShadow: `0 0 12px ${tColor}15`,
                        }}
                        animate={level === "critical" || level === "high" ? {
                            boxShadow: [`0 0 12px ${tColor}15`, `0 0 24px ${tColor}30`, `0 0 12px ${tColor}15`],
                        } : {}}
                        transition={{ duration: 1.5, repeat: level === "critical" || level === "high" ? Infinity : 0 }}
                    >
                        <PulsingDot color={tColor} size={7} />
                        <span className="font-mono-war text-xs font-bold tracking-[0.2em] uppercase" style={{ color: tColor }}>
                            {level === "nominal" ? "NOMINAL" : level === "elevated" ? "ELEVATED" : level === "high" ? "HIGH ALERT" : "CRITICAL"}
                        </span>
                    </motion.div>

                    <div className="w-px h-8" style={{ backgroundColor: "rgba(255,255,255,0.08)" }} />

                    <ScoreGauge score={status.operational_score} />

                    <div className="flex items-center gap-5">
                        <MetricPill label="OP SCORE" value={status.operational_score} color={scoreColor(status.operational_score)} />
                        <div className="w-px h-8" style={{ backgroundColor: "rgba(255,255,255,0.08)" }} />
                        <ThreatBar probability={status.collapse_probability} />
                        <div className="w-px h-8" style={{ backgroundColor: "rgba(255,255,255,0.08)" }} />
                        <MetricPill label="INCIDENTS" value={status.active_incidents} color={status.active_incidents > 0 ? "#FF5C7A" : "#00FFB3"} />
                        <div className="w-px h-8" style={{ backgroundColor: "rgba(255,255,255,0.08)" }} />
                        <MetricPill
                            label="RUNTIME" value={status.runtime_health} unit="%"
                            color={status.runtime_health > 80 ? "#00FFB3" : status.runtime_health > 50 ? "#FFC857" : "#FF5C7A"}
                        />
                    </div>
                </div>

                {/* Right: Badges + Clock */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <StatusBadge label="LIVE" active={connected} color="#00FFB3" icon={<Radio size={10} />} />
                        <StatusBadge label="WARFARE" active={status.warfare_mode} color="#4DA3FF" icon={<Shield size={10} />} />
                        <StatusBadge label="CHAOS" active={status.chaos_active} color="#FF2E63" icon={<Zap size={10} />} />
                        {status.active_incidents > 0 && (
                            <StatusBadge label="INCIDENT" active={true} color="#FFC857" icon={<AlertTriangle size={10} />} />
                        )}
                    </div>
                    <div className="w-px h-8" style={{ backgroundColor: "rgba(255,255,255,0.08)" }} />
                    <WarClock />
                </div>
            </div>

            {/* Critical signals strip */}
            {status.critical_signals.length > 0 && (
                <motion.div
                    className="px-6 py-1.5 flex items-center gap-3 overflow-hidden"
                    style={{
                        backgroundColor: "rgba(255,46,99,0.07)",
                        borderTop: "1px solid rgba(255,46,99,0.18)",
                    }}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    transition={{ duration: 0.3 }}
                >
                    <div className="flex items-center gap-1.5 shrink-0">
                        <AlertTriangle size={10} style={{ color: "#FF2E63" }} />
                        <span className="font-mono-war text-[10px] font-bold tracking-widest uppercase" style={{ color: "#FF2E63" }}>
                            CRITICAL SIGNALS
                        </span>
                    </div>
                    <div className="w-px h-3.5" style={{ backgroundColor: "rgba(255,46,99,0.3)" }} />
                    <div className="flex items-center gap-4 overflow-x-auto">
                        {status.critical_signals.map((signal, i) => (
                            <span key={i} className="font-mono-war text-[10px] shrink-0 whitespace-nowrap" style={{ color: "rgba(255,92,122,0.9)" }}>
                                ▸ {signal}
                            </span>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* Weakest subsystem */}
            {status.weakest_subsystem && (
                <div
                    className="px-6 py-1 flex items-center gap-2"
                    style={{ borderTop: "1px solid rgba(255,200,87,0.1)", backgroundColor: "rgba(255,200,87,0.03)" }}
                >
                    <span className="font-mono-war text-[9px] tracking-widest uppercase" style={{ color: "rgba(255,200,87,0.5)" }}>
                        WEAKEST LINK
                    </span>
                    <span className="font-mono-war text-[10px] font-bold uppercase" style={{ color: "#FFC857" }}>
                        {status.weakest_subsystem}
                    </span>
                </div>
            )}
        </motion.header>
    );
}
