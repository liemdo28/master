"use client";

import { motion, AnimatePresence } from "framer-motion";
import React from "react";

// ─── Alert Flash ──────────────────────────────────────────────────────────────

export function AlertFlash({ active, color = "#FF2E63", children }: {
    active: boolean;
    color?: string;
    children: React.ReactNode;
}) {
    return (
        <AnimatePresence>
            {active && (
                <motion.div
                    className="absolute inset-0 rounded-lg pointer-events-none z-10"
                    style={{ border: `1px solid ${color}`, boxShadow: `0 0 30px ${color}40` }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 0.6, 0] }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6, repeat: Infinity }}
                />
            )}
        </AnimatePresence>
    );
}

// ─── Runtime Glow ──────────────────────────────────────────────────────────────

export function RuntimeGlow({ intensity, color = "#00FFB3" }: {
    intensity: number; // 0-1
    color?: string;
}) {
    return (
        <motion.div
            className="absolute inset-0 rounded-lg pointer-events-none"
            style={{
                background: `radial-gradient(ellipse at center, ${color}${Math.round(intensity * 15).toString(16).padStart(2, "0")} 0%, transparent 70%)`,
            }}
            animate={{ opacity: [intensity * 0.3, intensity * 0.8, intensity * 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
        />
    );
}

// ─── Collapse Wave ────────────────────────────────────────────────────────────

export function CollapseWave({ active }: { active: boolean }) {
    if (!active) return null;
    return (
        <motion.div
            className="absolute inset-0 rounded-lg pointer-events-none"
            style={{ boxShadow: `0 0 0 0 rgba(255,46,99,0.5)` }}
            animate={{
                boxShadow: [
                    "0 0 0 0 rgba(255,46,99,0.4)",
                    "0 0 0 30px rgba(255,46,99,0)",
                ],
            }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
        />
    );
}

// ─── Threat Escalation Bar ────────────────────────────────────────────────────

export function ThreatEscalation({ level }: { level: number }) {
    // 0 = nominal, 1 = elevated, 2 = high, 3 = critical
    const colors = ["#00FFB3", "#FFC857", "#FF5C7A", "#FF2E63"];
    const color = colors[Math.min(level, 3)];
    const width = [10, 35, 65, 100][Math.min(level, 3)];

    return (
        <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
            <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: color }}
                animate={{ width: `${width}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
            />
        </div>
    );
}

// ─── Chaos Activation Effect ──────────────────────────────────────────────────

export function ChaosActivation({ active, onComplete }: {
    active: boolean;
    onComplete?: () => void;
}) {
    return (
        <AnimatePresence>
            {active && (
                <motion.div
                    className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    {/* Full screen flash */}
                    <motion.div
                        className="absolute inset-0"
                        style={{ background: "radial-gradient(ellipse at center, rgba(255,46,99,0.3), transparent 70%)" }}
                        animate={{ opacity: [0, 1, 0] }}
                        transition={{ duration: 0.8, repeat: 2 }}
                    />
                    {/* Central burst */}
                    <motion.div
                        className="absolute w-32 h-32 rounded-full"
                        style={{
                            background: "radial-gradient(circle, rgba(255,46,99,0.6), transparent 70%)",
                            boxShadow: "0 0 60px rgba(255,46,99,0.5)",
                        }}
                        initial={{ scale: 0, opacity: 1 }}
                        animate={{ scale: [0, 3, 5], opacity: [1, 0.8, 0] }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        onAnimationComplete={onComplete}
                    />
                    {/* Text */}
                    <motion.div
                        className="relative font-mono-war text-2xl font-bold tracking-[0.3em] uppercase"
                        style={{ color: "#FF2E63", textShadow: "0 0 30px rgba(255,46,99,0.8)" }}
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: [0.5, 1.2, 1], opacity: [0, 1, 0] }}
                        transition={{ duration: 1.2, delay: 0.3 }}
                    >
                        CHAOS ACTIVATED
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

// ─── Data Stream Particle ─────────────────────────────────────────────────────

export function DataStreamParticle({ delay = 0, startY = 0, color = "#00FFB3" }: {
    delay?: number;
    startY?: number;
    color?: string;
}) {
    return (
        <motion.div
            className="absolute w-0.5 h-3 rounded-full pointer-events-none"
            style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}`, left: "50%", top: startY }}
            initial={{ y: 0, opacity: 0 }}
            animate={{
                y: [0, 200],
                opacity: [0, 1, 0],
            }}
            transition={{
                duration: 1.5,
                delay,
                repeat: Infinity,
                ease: "linear",
            }}
        />
    );
}

// ─── Pulse Ring ───────────────────────────────────────────────────────────────

export function PulseRing({ color = "#00FFB3", size = 48 }: { color?: string; size?: number }) {
    return (
        <div className="relative" style={{ width: size, height: size }}>
            <motion.div
                className="absolute inset-0 rounded-full border-2"
                style={{ borderColor: color }}
                animate={{ scale: [1, 1.6], opacity: [0.6, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
            />
            <motion.div
                className="absolute inset-0 rounded-full border"
                style={{ borderColor: color, opacity: 0.3 }}
                animate={{ scale: [1, 1.3], opacity: [0.3, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
            />
        </div>
    );
}

// ─── Stagger Fade In ──────────────────────────────────────────────────────────

export function StaggerContainer({ children, delay = 0.05, className = "" }: {
    children: React.ReactNode;
    delay?: number;
    className?: string;
}) {
    return (
        <motion.div
            className={className}
            initial="hidden"
            animate="visible"
            variants={{
                hidden: {},
                visible: {
                    transition: {
                        staggerChildren: delay,
                    },
                },
            }}
        >
            {children}
        </motion.div>
    );
}

export const staggerItem = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
};

// ─── Glow Button ─────────────────────────────────────────────────────────────

export function GlowButton({
    children, onClick, color = "#00FFB3", active = false, danger = false,
    className = "",
}: {
    children: React.ReactNode;
    onClick?: () => void;
    color?: string;
    active?: boolean;
    danger?: boolean;
    className?: string;
}) {
    return (
        <motion.button
            onClick={onClick}
            className={`relative px-4 py-2 rounded border font-mono-war text-xs font-bold uppercase tracking-wider transition-all ${className}`}
            style={{
                borderColor: active ? color : `${color}50`,
                background: active ? `${color}15` : "transparent",
                color: active ? color : "rgba(255,255,255,0.6)",
                boxShadow: active ? `0 0 15px ${color}40` : "none",
            }}
            whileHover={{ scale: 1.02, boxShadow: `0 0 15px ${color}40` }}
            whileTap={{ scale: 0.98 }}
        >
            {children}
        </motion.button>
    );
}

// ─── Node Pulse Effect ────────────────────────────────────────────────────────

export function NodePulse({ active, color = "#00FFB3" }: { active: boolean; color?: string }) {
    if (!active) return null;
    return (
        <>
            <motion.div
                className="absolute rounded-full"
                style={{ backgroundColor: `${color}20`, boxShadow: `0 0 20px ${color}30` }}
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
            />
            <motion.div
                className="absolute rounded-full"
                style={{ backgroundColor: `${color}10`, boxShadow: `0 0 30px ${color}20` }}
                animate={{ scale: [1, 2, 1], opacity: [0.3, 0, 0.3] }}
                transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
            />
        </>
    );
}
