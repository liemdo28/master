"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWarRoomStore, ChaosScenario } from "../../store/war-room-store";
import { Zap, AlertTriangle, Shield, Server, Globe, Activity, X } from "lucide-react";

const API = "http://localhost:7700/api";

function dangerColor(danger: ChaosScenario["danger"]): string {
    switch (danger) {
        case "extreme": return "#FF2E63";
        case "high": return "#FF5C7A";
        case "medium": return "#FFC857";
        default: return "#00FFB3";
    }
}

function DangerPill({ danger }: { danger: ChaosScenario["danger"] }) {
    const color = dangerColor(danger);
    return (
        <span
            className="font-mono-war text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
            style={{ color, background: `${color}15`, border: `1px solid ${color}30` }}
        >
            {danger}
        </span>
    );
}

function ChaosButton({ scenario, onActivate }: {
    scenario: ChaosScenario;
    onActivate: (id: string) => void;
}) {
    const color = dangerColor(scenario.danger);
    const isActive = scenario.active;

    return (
        <motion.button
            className="w-full text-left rounded border p-3 transition-all relative overflow-hidden"
            style={{
                borderColor: isActive ? color : `${color}25`,
                background: isActive ? `${color}10` : "rgba(0,0,0,0.3)",
                boxShadow: isActive ? `0 0 15px ${color}30` : "none",
            }}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => onActivate(scenario.id)}
        >
            {/* Active glow overlay */}
            {isActive && (
                <motion.div
                    className="absolute inset-0 pointer-events-none"
                    style={{ background: `radial-gradient(ellipse at center, ${color}15, transparent 70%)` }}
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                />
            )}

            <div className="flex items-start justify-between gap-2 relative">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <Zap size={11} style={{ color, opacity: 0.8 }} />
                        <span className="font-mono-war text-xs font-bold tracking-wide" style={{ color: isActive ? color : "rgba(255,255,255,0.8)" }}>
                            {scenario.label}
                        </span>
                    </div>
                    <p className="font-mono-war text-[9px] text-white/40 leading-snug">{scenario.description}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                    <DangerPill danger={scenario.danger} />
                    {isActive && (
                        <motion.span
                            className="font-mono-war text-[8px] font-bold uppercase"
                            style={{ color }}
                            animate={{ opacity: [1, 0.4, 1] }}
                            transition={{ duration: 0.5, repeat: Infinity }}
                        >
                            ACTIVE
                        </motion.span>
                    )}
                </div>
            </div>

            {/* Progress bar for active */}
            {isActive && (
                <div className="mt-2 relative">
                    <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: `${color}20` }}>
                        <motion.div
                            className="h-full rounded-full"
                            style={{ backgroundColor: color }}
                            initial={{ width: "0%" }}
                            animate={{ width: ["0%", "70%"] }}
                            transition={{ duration: 10, ease: "linear" }}
                        />
                    </div>
                    <span className="font-mono-war text-[8px] text-white/25 mt-0.5 block">MAX RUNTIME: 60s</span>
                </div>
            )}
        </motion.button>
    );
}

function ConfirmDialog({
    scenario, onConfirm, onCancel,
}: {
    scenario: ChaosScenario;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    const color = dangerColor(scenario.danger);
    return (
        <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
            <motion.div
                className="relative rounded-lg border p-5 max-w-sm w-full"
                style={{ borderColor: `${color}50`, background: "rgba(5,8,22,0.98)", boxShadow: `0 0 40px ${color}30` }}
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
            >
                <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle size={16} style={{ color }} />
                    <span className="font-mono-war text-sm font-bold" style={{ color }}>
                        CONFIRM CHAOS LAUNCH
                    </span>
                </div>
                <p className="font-mono-war text-[11px] text-white/60 mb-4 leading-relaxed">
                    You are about to deploy <strong style={{ color }}>{scenario.label}</strong>.
                    This is a <strong style={{ color }}>{scenario.danger.toUpperCase()}</strong> severity operation.
                </p>
                <div className="mb-4 p-2 rounded border" style={{ borderColor: `${color}25`, background: `${color}05` }}>
                    <p className="font-mono-war text-[9px] text-white/40">{scenario.description}</p>
                </div>
                <div className="flex items-center gap-2 text-[9px] font-mono-war text-white/30 mb-4">
                    <Shield size={10} />
                    <span>Auto-stop after 60s • Max 3 concurrent • Safety mode enabled</span>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-2 rounded border border-white/20 font-mono-war text-xs text-white/60 hover:bg-white/5 transition-colors"
                    >
                        ABORT
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 py-2 rounded font-mono-war text-xs font-bold"
                        style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}
                    >
                        LAUNCH CHAOS
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}

export function ChaosControl() {
    const { chaosScenarios, toggleChaos, chaosActive, setChaosActive } = useWarRoomStore();
    const [confirmingId, setConfirmingId] = useState<string | null>(null);

    async function handleActivate(id: string) {
        const scenario = chaosScenarios.find((s) => s.id === id);
        if (!scenario) return;

        if (!scenario.active) {
            // Show confirmation for dangerous scenarios
            if (scenario.danger === "extreme" || scenario.danger === "high") {
                setConfirmingId(id);
                return;
            }
        }

        // Toggle chaos state
        toggleChaos(id);
        setChaosActive(!chaosActive);

        // Send to backend
        try {
            await fetch(`${API}/run-chaos`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    project_id: "dashboard",
                    scenario: id,
                    action: scenario.active ? "stop" : "start",
                }),
            });
        } catch { /* silent */ }
    }

    const activeCount = chaosScenarios.filter((s) => s.active).length;
    const confirmedScenario = chaosScenarios.find((s) => s.id === confirmingId);

    return (
        <div className="rounded-lg border border-white/10 bg-card/40 backdrop-blur-sm overflow-hidden">
            {/* Header */}
            <div className="px-4 py-2.5 border-b border-white/8 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <motion.div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                            backgroundColor: activeCount > 0 ? "#FF2E63" : "#FFC857",
                            boxShadow: activeCount > 0 ? "0 0 8px #FF2E63" : "0 0 8px #FFC857",
                        }}
                        animate={activeCount > 0 ? { opacity: [1, 0.3, 1] } : {}}
                        transition={{ duration: 0.5, repeat: activeCount > 0 ? Infinity : 0 }}
                    />
                    <Zap size={12} style={{ color: "#FF2E63" }} />
                    <span className="font-mono-war text-xs font-bold tracking-widest uppercase" style={{ color: activeCount > 0 ? "#FF2E63" : "rgba(255,255,255,0.7)" }}>
                        CHAOS CONTROL
                    </span>
                </div>
                {activeCount > 0 && (
                    <motion.span
                        className="font-mono-war text-[9px] font-bold px-2 py-0.5 rounded"
                        style={{ color: "#FF2E63", background: "rgba(255,46,99,0.15)" }}
                        animate={{ opacity: [1, 0.6, 1] }}
                        transition={{ duration: 0.5, repeat: Infinity }}
                    >
                        {activeCount} ACTIVE
                    </motion.span>
                )}
            </div>

            {/* Chaos buttons */}
            <div className="p-3 space-y-2 max-h-[300px] overflow-y-auto">
                {chaosScenarios.map((scenario) => (
                    <ChaosButton
                        key={scenario.id}
                        scenario={scenario}
                        onActivate={handleActivate}
                    />
                ))}
            </div>

            {/* Footer warning */}
            <div className="px-4 py-2 border-t border-white/8 flex items-center gap-2" style={{ background: "rgba(0,0,0,0.2)" }}>
                <Shield size={10} style={{ color: "rgba(255,200,87,0.5)" }} />
                <span className="font-mono-war text-[8px] text-white/25 leading-relaxed">
                    Safety: Auto-stop 60s • Scope limit • Chaos budget tracking active
                </span>
            </div>

            {/* Confirmation dialog */}
            <AnimatePresence>
                {confirmingId && confirmedScenario && (
                    <ConfirmDialog
                        scenario={confirmedScenario}
                        onConfirm={() => {
                            toggleChaos(confirmingId);
                            setChaosActive(true);
                            setConfirmingId(null);
                        }}
                        onCancel={() => setConfirmingId(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
