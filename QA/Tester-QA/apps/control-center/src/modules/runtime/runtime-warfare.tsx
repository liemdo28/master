"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useWarRoomStore } from "../../store/war-room-store";
import { Cpu, MemoryStick, HardDrive, Activity, Wifi, Server, AlertTriangle, Zap, RefreshCw } from "lucide-react";

const API = "http://localhost:7700/api";

interface MetricHistory {
    timestamp: number;
    value: number;
}

function MetricBar({ label, value, max, unit, icon: Icon, dangerThreshold = 80 }: {
    label: string; value: number; max: number; unit?: string; icon: React.ElementType; dangerThreshold?: number;
}) {
    const pct = Math.min(100, (value / max) * 100);
    const color = pct >= dangerThreshold ? "#FF2E63" : pct >= dangerThreshold * 0.7 ? "#FFC857" : "#00FFB3";
    const isDanger = pct >= dangerThreshold;

    return (
        <div className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
            <Icon size={12} style={{ color: color, opacity: 0.7, shrink: 0 }} />
            <div className="w-28 shrink-0">
                <span className="font-mono-war text-[10px] text-white/40 uppercase tracking-wider">{label}</span>
            </div>
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}60` }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                />
            </div>
            <div className="w-20 text-right shrink-0">
                <span className="font-mono-war text-xs font-bold tabular-nums" style={{ color }}>
                    {value.toFixed(value < 10 ? 1 : 0)}{unit}
                </span>
            </div>
            {isDanger && (
                <motion.span
                    className="font-mono-war text-[8px] font-bold px-1.5 py-0.5 rounded uppercase"
                    style={{ color: "#FF2E63", background: "rgba(255,46,99,0.15)" }}
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                >
                    DANGER
                </motion.span>
            )}
        </div>
    );
}

function SparklineChart({ data, color, height = 40 }: { data: MetricHistory[]; color: string; height?: number }) {
    if (data.length < 2) return <div style={{ height }} />;
    const max = Math.max(...data.map((d) => d.value), 1);
    const min = Math.min(...data.map((d) => d.value), 0);
    const range = max - min || 1;
    const width = 120;
    const points = data.map((d, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((d.value - min) / range) * height;
        return `${x},${y}`;
    }).join(" ");

    return (
        <svg width={width} height={height} className="shrink-0">
            <polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ filter: `drop-shadow(0 0 3px ${color})` }}
            />
        </svg>
    );
}

function MetricCard({ label, value, unit, icon: Icon, color, history }: {
    label: string; value: number; unit?: string; icon: React.ElementType; color: string; history: MetricHistory[];
}) {
    return (
        <div className="rounded border p-3" style={{ borderColor: `${color}25`, background: `${color}05` }}>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                    <Icon size={11} style={{ color }} />
                    <span className="font-mono-war text-[9px] text-white/50 uppercase tracking-widest">{label}</span>
                </div>
                <div className="flex items-center gap-1">
                    <span className="font-mono-war text-sm font-bold tabular-nums" style={{ color }}>
                        {value.toFixed(value < 10 ? 1 : 0)}{unit}
                    </span>
                </div>
            </div>
            <SparklineChart data={history.slice(-20)} color={color} />
        </div>
    );
}

export function RuntimeWarfare() {
    const { runtime, setRuntime } = useWarRoomStore();
    const [history, setHistory] = useState<Record<string, MetricHistory[]>>({
        cpu: [], memory: [], disk: [], ws: [], queue: [], latency: [],
    });

    const fetchRuntime = useCallback(async () => {
        try {
            const res = await fetch(`${API}/warroom/snapshot`);
            if (res.ok) {
                const data = await res.json();
                if (data.runtime) {
                    setRuntime(data.runtime);
                    const now = Math.floor(Date.now() / 1000);
                    setHistory((prev) => ({
                        cpu: [...prev.cpu, { timestamp: now, value: data.runtime.cpu_percent }].slice(-30),
                        memory: [...prev.memory, { timestamp: now, value: data.runtime.memory_percent }].slice(-30),
                        disk: [...prev.disk, { timestamp: now, value: data.runtime.disk_percent }].slice(-30),
                        ws: [...prev.ws, { timestamp: now, value: data.runtime.websocket_count }].slice(-30),
                        queue: [...prev.queue, { timestamp: now, value: data.runtime.queue_depth }].slice(-30),
                        latency: [...prev.latency, { timestamp: now, value: data.runtime.provider_latency_ms }].slice(-30),
                    }));
                }
            }
        } catch { /* silent */ }
    }, [setRuntime]);

    useEffect(() => {
        fetchRuntime();
        const id = setInterval(fetchRuntime, 3000);
        return () => clearInterval(id);
    }, [fetchRuntime]);

    return (
        <div className="rounded-lg border border-white/10 bg-card/40 backdrop-blur-sm overflow-hidden">
            {/* Header */}
            <div className="px-4 py-2.5 border-b border-white/8 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <motion.div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: runtime.cpu_percent > 80 ? "#FF2E63" : "#00FFB3" }}
                        animate={{ opacity: [1, 0.4, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                    />
                    <Activity size={12} style={{ color: "#00FFB3" }} />
                    <span className="font-mono-war text-xs font-bold tracking-widest uppercase text-white/70">
                        RUNTIME WARFARE
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <RefreshCw size={10} style={{ color: "rgba(255,255,255,0.2)" }} />
                    <span className="font-mono-war text-[9px] text-white/25">3s REFRESH</span>
                </div>
            </div>

            <div className="p-4 space-y-3">
                {/* Grid metrics */}
                <div className="grid grid-cols-2 gap-2">
                    <MetricCard label="CPU" value={runtime.cpu_percent} unit="%" icon={Cpu} color={runtime.cpu_percent > 80 ? "#FF2E63" : "#00FFB3"} history={history.cpu || []} />
                    <MetricCard label="MEMORY" value={runtime.memory_percent} unit="%" icon={MemoryStick} color={runtime.memory_percent > 80 ? "#FF2E63" : "#FFC857"} history={history.memory || []} />
                    <MetricCard label="DISK" value={runtime.disk_percent} unit="%" icon={HardDrive} color={runtime.disk_percent > 90 ? "#FF2E63" : "#4DA3FF"} history={history.disk || []} />
                    <MetricCard label="LATENCY" value={runtime.provider_latency_ms} unit="ms" icon={Zap} color={runtime.provider_latency_ms > 500 ? "#FF2E63" : runtime.provider_latency_ms > 200 ? "#FFC857" : "#00FFB3"} history={history.latency || []} />
                </div>

                {/* Detailed bars */}
                <div className="rounded border border-white/8 p-3" style={{ background: "rgba(0,0,0,0.2)" }}>
                    <span className="font-mono-war text-[9px] text-white/30 uppercase tracking-widest block mb-2">Detailed Metrics</span>
                    <MetricBar label="CPU %" value={runtime.cpu_percent} max={100} unit="%" icon={Cpu} />
                    <MetricBar label="Memory %" value={runtime.memory_percent} max={100} unit="%" icon={MemoryStick} />
                    <MetricBar label="Disk %" value={runtime.disk_percent} max={100} unit="%" icon={HardDrive} dangerThreshold={90} />
                    <MetricBar label="WebSockets" value={runtime.websocket_count} max={100} icon={Wifi} dangerThreshold={80} />
                    <MetricBar label="Queue Depth" value={runtime.queue_depth} max={100} icon={Server} dangerThreshold={70} />
                    <MetricBar label="Provider Latency" value={runtime.provider_latency_ms} max={1000} unit="ms" icon={Zap} dangerThreshold={500} />
                </div>

                {/* Warning metrics */}
                <div className="grid grid-cols-3 gap-2">
                    <div className="rounded border border-white/8 p-2 text-center" style={{ background: "rgba(0,0,0,0.15)" }}>
                        <span className="font-mono-war text-[8px] text-white/30 uppercase tracking-widest block">Retry Storms</span>
                        <span className="font-mono-war text-sm font-bold" style={{ color: runtime.retry_storms > 0 ? "#FFC857" : "#00FFB3" }}>
                            {runtime.retry_storms}
                        </span>
                    </div>
                    <div className="rounded border border-white/8 p-2 text-center" style={{ background: "rgba(0,0,0,0.15)" }}>
                        <span className="font-mono-war text-[8px] text-white/30 uppercase tracking-widest block">Stuck Workers</span>
                        <span className="font-mono-war text-sm font-bold" style={{ color: runtime.stuck_workers > 0 ? "#FF5C7A" : "#00FFB3" }}>
                            {runtime.stuck_workers}
                        </span>
                    </div>
                    <div className="rounded border border-white/8 p-2 text-center" style={{ background: "rgba(0,0,0,0.15)" }}>
                        <span className="font-mono-war text-[8px] text-white/30 uppercase tracking-widest block">Failed Execs</span>
                        <span className="font-mono-war text-sm font-bold" style={{ color: runtime.failed_executions > 0 ? "#FF5C7A" : "#00FFB3" }}>
                            {runtime.failed_executions}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
