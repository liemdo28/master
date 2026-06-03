"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useWarRoomStore } from "../../store/war-room-store";
import { Shield, Zap, Activity, Wifi, Server, TrendingUp } from "lucide-react";

const API = "http://localhost:7700/api";

interface ScoreCard {
    label: string;
    value: number;
    max: number;
    icon: React.ElementType;
    color: string;
    trend: "up" | "down" | "stable";
}

function CircularScore({ value, max, color, label, size = 80 }: {
    value: number; max: number; color: string; label: string; size?: number;
}) {
    const pct = (value / max) * 100;
    const circumference = 2 * Math.PI * ((size / 2) - 6);
    const dashOffset = circumference - (pct / 100) * circumference;

    return (
        <div className="flex flex-col items-center gap-1">
            <div className="relative" style={{ width: size, height: size }}>
                <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${size} ${size}`}>
                    <circle
                        cx={size / 2} cy={size / 2} r={(size / 2) - 6}
                        fill="none"
                        stroke="rgba(255,255,255,0.05)"
                        strokeWidth="3"
                    />
                    <motion.circle
                        cx={size / 2} cy={size / 2} r={(size / 2) - 6}
                        fill="none"
                        stroke={color}
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        animate={{ strokeDashoffset: dashOffset }}
                        style={{ filter: `drop-shadow(0 0 4px ${color})` }}
                        transition={{ duration: 1.2, ease: "easeOut" }}
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <span className="font-mono-war text-lg font-bold tabular-nums" style={{ color }}>
                        {value.toFixed(0)}
                    </span>
                    <span className="font-mono-war text-[8px] text-white/30">/ {max}</span>
                </div>
            </div>
            <span className="font-mono-war text-[8px] text-white/40 uppercase tracking-widest text-center">{label}</span>
        </div>
    );
}

function ScoreBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
    const pct = Math.min(100, (value / max) * 100);
    return (
        <div className="flex items-center gap-2 py-1.5">
            <span className="font-mono-war text-[9px] text-white/40 uppercase w-20 shrink-0 tracking-wider">{label}</span>
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}60` }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                />
            </div>
            <span className="font-mono-war text-[10px] font-bold tabular-nums w-10 text-right" style={{ color }}>
                {value.toFixed(0)}
            </span>
        </div>
    );
}

export function OperationalScoring() {
    const { operationalScore, collapseProbability, setScores } = useWarRoomStore();
    const [scores, setScoresLocal] = useState({
        survival: 87, collapse: 12, fragility: 23,
        recovery: 91, ws_stability: 94, provider_stability: 88,
    });

    const fetchScores = useCallback(async () => {
        try {
            const res = await fetch(`${API}/warroom`);
            if (res.ok) {
                const data = await res.json();
                setScores(data.operational_score ?? 0, data.collapse_probability ?? 0);
            }
        } catch { /* silent */ }
    }, [setScores]);

    useEffect(() => {
        fetchScores();
        const id = setInterval(fetchScores, 5000);
        return () => clearInterval(id);
    }, [fetchScores]);

    const survivalColor = scores.survival > 80 ? "#00FFB3" : scores.survival > 60 ? "#FFC857" : "#FF5C7A";
    const collapseColor = scores.collapse > 70 ? "#FF2E63" : scores.collapse > 40 ? "#FFC857" : "#00FFB3";
    const fragilityColor = scores.fragility > 60 ? "#FF5C7A" : scores.fragility > 30 ? "#FFC857" : "#00FFB3";
    const recoveryColor = scores.recovery > 80 ? "#00FFB3" : scores.recovery > 60 ? "#FFC857" : "#FF5C7A";

    return (
        <div className="rounded-lg border border-white/10 bg-card/40 backdrop-blur-sm overflow-hidden">
            {/* Header */}
            <div className="px-4 py-2.5 border-b border-white/8 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <motion.div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: "#4DA3FF" }}
                        animate={{ opacity: [1, 0.4, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                    />
                    <TrendingUp size={12} style={{ color: "#4DA3FF" }} />
                    <span className="font-mono-war text-xs font-bold tracking-widest uppercase text-white/70">
                        OPERATIONAL SCORING
                    </span>
                </div>
            </div>

            <div className="p-4">
                {/* Main scores */}
                <div className="flex items-center justify-around mb-4">
                    <CircularScore value={scores.survival} max={100} color={survivalColor} label="SURVIVAL" size={90} />
                    <CircularScore value={100 - scores.collapse} max={100} color={collapseColor} label="RESILIENCE" size={90} />
                    <CircularScore value={100 - scores.fragility} max={100} color={fragilityColor} label="STABILITY" size={90} />
                    <CircularScore value={scores.recovery} max={100} color={recoveryColor} label="RECOVERY" size={90} />
                </div>

                {/* Detailed breakdown */}
                <div className="rounded border border-white/8 p-3 space-y-1" style={{ background: "rgba(0,0,0,0.2)" }}>
                    <span className="font-mono-war text-[8px] text-white/25 uppercase tracking-widest block mb-2">Score Breakdown</span>
                    <ScoreBar label="Operational Survival" value={scores.survival} max={100} color={survivalColor} />
                    <ScoreBar label="Collapse Probability" value={100 - scores.collapse} max={100} color={collapseColor} />
                    <ScoreBar label="Runtime Fragility" value={100 - scores.fragility} max={100} color={fragilityColor} />
                    <ScoreBar label="Recovery Confidence" value={scores.recovery} max={100} color={recoveryColor} />
                    <ScoreBar label="WebSocket Stability" value={scores.ws_stability} max={100} color={scores.ws_stability > 80 ? "#00FFB3" : "#FFC857"} />
                    <ScoreBar label="Provider Stability" value={scores.provider_stability} max={100} color={scores.provider_stability > 80 ? "#00FFB3" : "#FFC857"} />
                </div>
            </div>
        </div>
    );
}
