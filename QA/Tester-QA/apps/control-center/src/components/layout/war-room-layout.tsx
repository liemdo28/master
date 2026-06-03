"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { useWarRoomStore, WarRoomMode } from "../../store/war-room-store";
import { useWarRoomWS } from "../../websocket/client";
import { Monitor, Minimize2, Maximize2, Focus, LayoutGrid, Columns } from "lucide-react";

interface WarRoomLayoutProps {
    children: React.ReactNode;
}

function ModeToggle({ mode, onChange }: { mode: WarRoomMode; onChange: (m: WarRoomMode) => void }) {
    const modes: { id: WarRoomMode; label: string; icon: React.ElementType }[] = [
        { id: "war-room", label: "WAR ROOM", icon: Maximize2 },
        { id: "compact", label: "COMPACT", icon: Minimize2 },
        { id: "incident-focus", label: "FOCUS", icon: Focus },
    ];

    return (
        <div className="flex items-center gap-1 px-3 py-1.5 rounded border border-white/10 bg-black/30">
            {modes.map((m) => {
                const Icon = m.icon;
                return (
                    <button
                        key={m.id}
                        onClick={() => onChange(m.id)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded font-mono-war text-[9px] font-bold uppercase tracking-wider transition-all"
                        style={{
                            color: mode === m.id ? "#00FFB3" : "rgba(255,255,255,0.35)",
                            background: mode === m.id ? "rgba(0,255,179,0.1)" : "transparent",
                            border: mode === m.id ? "1px solid rgba(0,255,179,0.3)" : "1px solid transparent",
                        }}
                    >
                        <Icon size={10} />
                        {m.label}
                    </button>
                );
            })}
        </div>
    );
}

function StatusBar() {
    const { wsConnected, chaosActive, threatLevel } = useWarRoomStore();

    const threatColor =
        threatLevel === "critical" ? "#FF2E63"
            : threatLevel === "high" ? "#FF5C7A"
                : threatLevel === "elevated" ? "#FFC857"
                    : "#00FFB3";

    return (
        <div className="px-4 py-1.5 border-t flex items-center justify-between" style={{ borderColor: "rgba(255,255,255,0.05)", background: "rgba(0,0,0,0.3)" }}>
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                    <motion.div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: wsConnected ? "#00FFB3" : "#FFC857" }}
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                    />
                    <span className="font-mono-war text-[9px] uppercase tracking-wider" style={{ color: wsConnected ? "rgba(0,255,179,0.6)" : "rgba(255,200,87,0.6)" }}>
                        {wsConnected ? "WS CONNECTED" : "HTTP FALLBACK"}
                    </span>
                </div>

                <div className="w-px h-3" style={{ backgroundColor: "rgba(255,255,255,0.1)" }} />

                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: threatColor }} />
                    <span className="font-mono-war text-[9px] uppercase tracking-wider" style={{ color: threatColor }}>
                        THREAT: {threatLevel.toUpperCase()}
                    </span>
                </div>

                <div className="w-px h-3" style={{ backgroundColor: "rgba(255,255,255,0.1)" }} />

                {chaosActive && (
                    <motion.div
                        className="flex items-center gap-1.5 px-2 py-0.5 rounded"
                        style={{ background: "rgba(255,46,99,0.1)", border: "1px solid rgba(255,46,99,0.3)" }}
                        animate={{ opacity: [1, 0.6, 1] }}
                        transition={{ duration: 0.5, repeat: Infinity }}
                    >
                        <div className="w-1 h-1 rounded-full bg-red-500" />
                        <span className="font-mono-war text-[9px] font-bold uppercase tracking-wider" style={{ color: "#FF2E63" }}>
                            CHAOS ACTIVE
                        </span>
                    </motion.div>
                )}
            </div>

            <div className="flex items-center gap-3">
                <span className="font-mono-war text-[8px] text-white/20 uppercase tracking-wider">
                    TESTER-QA CONTROL CENTER v1.0
                </span>
                <div className="w-px h-3" style={{ backgroundColor: "rgba(255,255,255,0.1)" }} />
                <span className="font-mono-war text-[8px] text-white/20">
                    ENGINEERING WARFARE MODE
                </span>
            </div>
        </div>
    );
}

export function WarRoomLayout({ children }: WarRoomLayoutProps) {
    const { mode, setMode } = useWarRoomStore();

    // Initialize WebSocket connection
    useWarRoomWS();

    return (
        <motion.div
            className="flex flex-col h-screen overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
        >
            {/* Main content area */}
            <div className="flex-1 overflow-hidden">
                {children}
            </div>

            {/* Bottom status bar */}
            <StatusBar />

            {/* Mode indicator (bottom-right floating) */}
            <div className="fixed bottom-8 right-4 z-40">
                <ModeToggle mode={mode} onChange={setMode} />
            </div>
        </motion.div>
    );
}
