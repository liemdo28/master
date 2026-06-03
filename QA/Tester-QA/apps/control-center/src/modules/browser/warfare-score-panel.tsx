"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  Shield,
  AlertTriangle,
  Wifi,
  Droplets,
  LayoutDashboard,
  TrendingUp,
  ChevronRight,
  Zap,
  Activity,
} from "lucide-react";
import { useWarRoomStore } from "../../store/war-room-store";

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface WarfareScoreCard {
  sessionId: string;
  survivalScore: number;
  survivalGrade: string;
  grade: string;
  hydrationStability: number;
  wsReliability: number;
  domFragility: number;
  overallScore: number;
  collapseProbability: number;
  timestamp: number;
  recommendations?: string[];
  metricsBreakdown?: {
    survival_score: number;
    hydration_stability: number;
    ws_reliability: number;
    dom_score: number;
  };
}

interface WarfareScorePanelProps {
  scores?: WarfareScoreCard[];
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const GRADE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  A: { label: "EXCEPTIONAL", color: "#00FFB3", bg: "rgba(0,255,179,0.12)" },
  B: { label: "GOOD",        color: "#7ED4FF", bg: "rgba(126,212,255,0.12)" },
  C: { label: "ACCEPTABLE", color: "#FFC857", bg: "rgba(255,200,87,0.12)" },
  D: { label: "POOR",       color: "#FF9B53", bg: "rgba(255,155,83,0.12)" },
  F: { label: "FAILURE",    color: "#FF5C7A", bg: "rgba(255,92,122,0.12)" },
  N: { label: "N/A",        color: "rgba(255,255,255,0.2)", bg: "rgba(255,255,255,0.04)" },
};

const COLLAPSE_LEVELS = [
  { max: 0.1,  label: "NOMINAL",    color: "#00FFB3", bg: "rgba(0,255,179,0.1)" },
  { max: 0.25, label: "LOW",        color: "#7ED4FF", bg: "rgba(126,212,255,0.1)" },
  { max: 0.45, label: "MODERATE",   color: "#FFC857", bg: "rgba(255,200,87,0.1)" },
  { max: 0.65, label: "HIGH",       color: "#FF9B53", bg: "rgba(255,155,83,0.1)" },
  { max: 1.0,  label: "CRITICAL",    color: "#FF5C7A", bg: "rgba(255,92,122,0.1)" },
];

// ─── Sub-components ─────────────────────────────────────────────────────────────

function ScoreGauge({ value, size = 120 }: { value: number; size?: number }) {
  const radius = size / 2;
  const strokeWidth = size * 0.08;
  const r = radius - strokeWidth;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - value / 100);
  const color = value >= 80 ? "#00FFB3" : value >= 60 ? "#FFC857" : "#FF5C7A";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={radius}
          cy={radius}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={radius}
          cy={radius}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono-war text-2xl font-black" style={{ color }}>{value.toFixed(0)}</span>
        <span className="font-mono-war text-[8px] text-white/30 uppercase tracking-widest">/ 100</span>
      </div>
    </div>
  );
}

function GradeBadge({ grade }: { grade: string }) {
  const cfg = GRADE_CONFIG[grade] ?? GRADE_CONFIG["N"];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded font-mono-war text-xs font-black tracking-widest border"
      style={{ color: cfg.color, borderColor: cfg.color, background: cfg.bg }}
    >
      {grade} — {cfg.label}
    </span>
  );
}

function CollapsePredictor({ probability }: { probability: number }) {
  const level = COLLAPSE_LEVELS.find((l) => probability <= l.max) ?? COLLAPSE_LEVELS[COLLAPSE_LEVELS.length - 1];
  const pct = (probability * 100).toFixed(1);

  return (
    <div
      className="rounded border p-2 flex items-center gap-2"
      style={{ borderColor: level.color + "55", background: level.bg }}
    >
      <AlertTriangle size={12} style={{ color: level.color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="font-mono-war text-[9px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>
            Collapse Probability
          </span>
          <span className="font-mono-war text-xs font-bold ml-1" style={{ color: level.color }}>
            {pct}%
          </span>
        </div>
        <div className="mt-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: level.color }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, probability * 200)}%` }}
            transition={{ duration: 1.0 }}
          />
        </div>
        <span className="font-mono-war text-[8px] mt-0.5 block" style={{ color: level.color }}>
          {level.label}
        </span>
      </div>
    </div>
  );
}

function FactorBar({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  const pct = Math.min(100, (value / max) * 100);
  const color = pct >= 75 ? "#00FFB3" : pct >= 50 ? "#FFC857" : "#FF5C7A";
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono-war text-[8px] text-white/40 w-24 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8 }}
        />
      </div>
      <span className="font-mono-war text-[8px] text-white/30 w-8 text-right">{value.toFixed(0)}</span>
    </div>
  );
}

function MetricChip({ label, value, icon: Icon, threshold = 100 }: { label: string; value: number; icon: React.FC<{ size: number; style?: React.CSSProperties }>; threshold?: number }) {
  const color = value >= threshold * 0.8 ? "#FF5C7A" : value >= threshold * 0.5 ? "#FFC857" : "#00FFB3";
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded border" style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.2)" }}>
      <Icon size={9} style={{ color }} />
      <span className="font-mono-war text-[8px] text-white/40 uppercase">{label}</span>
      <span className="font-mono-war text-xs font-bold" style={{ color }}>{value.toFixed(0)}</span>
    </div>
  );
}

function TrendChart({ scores }: { scores: WarfareScoreCard[] }) {
  const data = useMemo(() => {
    return scores.slice(-20).map((s, i) => ({
      t: i + 1,
      score: s.overallScore,
      survival: s.survivalScore,
      hydration: s.hydrationStability,
      ws: s.wsReliability,
    }));
  }, [scores]);

  if (data.length < 2) return null;

  return (
    <div className="h-24 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="t" tick={{ fontSize: 7, fill: "rgba(255,255,255,0.2)" }} tickLine={false} axisLine={false} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 7, fill: "rgba(255,255,255,0.2)" }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ background: "rgba(0,0,0,0.85)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, fontSize: 9 }}
            labelStyle={{ color: "rgba(255,255,255,0.4)" }}
          />
          <Line type="monotone" dataKey="score" stroke="#00FFB3" strokeWidth={1.5} dot={false} />
          <Line type="monotone" dataKey="survival" stroke="#7ED4FF" strokeWidth={1} dot={false} strokeDasharray="2 2" />
          <Line type="monotone" dataKey="ws" stroke="#FFC857" strokeWidth={1} dot={false} strokeDasharray="3 3" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export function WarfareScorePanel({ scores: propScores }: WarfareScorePanelProps) {
  const { warfareScores } = useWarRoomStore();
  const scores: WarfareScoreCard[] = (propScores ?? warfareScores).length > 0
    ? (propScores ?? warfareScores)
    : DEMO_SCORES;

  const latest = scores[scores.length - 1] ?? DEMO_SCORES[0];
  const gradeCfg = GRADE_CONFIG[latest.survivalGrade] ?? GRADE_CONFIG["N"];

  return (
    <div className="flex flex-col gap-3">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={13} style={{ color: "#00FFB3" }} />
          <span className="font-mono-war text-xs font-bold tracking-widest uppercase text-white/70">
            Warfare Score Card
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono-war text-[9px] text-white/20">{scores.length} sessions</span>
          <GradeBadge grade={latest.survivalGrade} />
        </div>
      </div>

      {/* ── Primary row: gauge + collapse + metrics ────────────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        {/* Overall gauge */}
        <div className="flex flex-col items-center justify-center rounded border p-2" style={{ borderColor: "rgba(255,255,255,0.07)", background: "rgba(0,0,0,0.2)" }}>
          <ScoreGauge value={latest.overallScore} size={90} />
          <span className="font-mono-war text-[8px] text-white/30 mt-1 uppercase tracking-widest">Overall</span>
          <GradeBadge grade={latest.grade} />
        </div>

        {/* Collapse + survival breakdown */}
        <div className="flex flex-col gap-2">
          <CollapsePredictor probability={latest.collapseProbability} />
          <div className="flex flex-col gap-1">
            <FactorBar label="Survival" value={latest.survivalScore} />
            <FactorBar label="Hydration" value={latest.hydrationStability} />
            <FactorBar label="WebSocket" value={latest.wsReliability} />
            <FactorBar label="DOM Stability" value={100 - latest.domFragility} />
          </div>
        </div>

        {/* Metric chips */}
        <div className="flex flex-col gap-1.5">
          <div className="grid grid-cols-2 gap-1">
            <MetricChip label="Surv" value={latest.survivalScore} icon={Shield} />
            <MetricChip label="Hydr" value={latest.hydrationStability} icon={Droplets} />
            <MetricChip label="WS" value={latest.wsReliability} icon={Wifi} />
            <MetricChip label="DOM" value={latest.domFragility} icon={LayoutDashboard} threshold={100} />
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded border text-[8px]" style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.2)" }}>
            <TrendingUp size={9} style={{ color: "#00FFB3" }} />
            <span className="font-mono-war text-white/40 uppercase">Session</span>
            <span className="font-mono-war text-white/70 font-bold ml-auto">{latest.sessionId}</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded border text-[8px]" style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.2)" }}>
            <Activity size={9} style={{ color: "#7ED4FF" }} />
            <span className="font-mono-war text-white/40 uppercase">Ts</span>
            <span className="font-mono-war text-white/70 font-bold ml-auto">
              {new Date(latest.timestamp).toLocaleTimeString()}
            </span>
          </div>
        </div>
      </div>

      {/* ── Trend chart ──────────────────────────────────────────────────────── */}
      {scores.length > 1 && (
        <div className="rounded border p-2" style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.15)" }}>
          <div className="flex items-center gap-2 mb-1">
            <Zap size={9} style={{ color: "#00FFB3" }} />
            <span className="font-mono-war text-[8px] text-white/30 uppercase tracking-widest">Score Trend</span>
            <span className="flex items-center gap-2 ml-auto">
              <span className="flex items-center gap-0.5"><span className="w-2 h-0.5 rounded-full inline-block" style={{ background: "#00FFB3" }} /><span className="font-mono-war text-[7px] text-white/20">Overall</span></span>
              <span className="flex items-center gap-0.5"><span className="w-2 h-0.5 rounded-full inline-block" style={{ background: "#7ED4FF" }} /><span className="font-mono-war text-[7px] text-white/20">Survival</span></span>
              <span className="flex items-center gap-0.5"><span className="w-2 h-0.5 rounded-full inline-block" style={{ background: "#FFC857" }} /><span className="font-mono-war text-[7px] text-white/20">WS</span></span>
            </span>
          </div>
          <TrendChart scores={scores} />
        </div>
      )}

      {/* ── Recommendations ─────────────────────────────────────────────────── */}
      {(latest.recommendations ?? []).length > 0 && (
        <div className="space-y-1">
          {latest.recommendations?.slice(0, 3).map((rec, i) => (
            <div key={i} className="flex items-start gap-1.5 px-2 py-1 rounded text-[8px]" style={{ background: "rgba(255,200,87,0.05)", border: "1px solid rgba(255,200,87,0.1)" }}>
              <ChevronRight size={9} style={{ color: "#FFC857", marginTop: 1, flexShrink: 0 }} />
              <span className="font-mono-war text-white/50">{rec}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Demo data ─────────────────────────────────────────────────────────────────

const DEMO_SCORES: WarfareScoreCard[] = [
  {
    sessionId: "total_warfare-a1b2c3",
    survivalScore: 91.2,
    survivalGrade: "A",
    grade: "A",
    hydrationStability: 84.0,
    wsReliability: 78.5,
    domFragility: 28.4,
    overallScore: 83.1,
    collapseProbability: 0.08,
    timestamp: Date.now() - 300000,
    recommendations: [
      "[WEBSOCKET 78.5] — Minor WS reliability gap. Add heartbeat + backoff reconnect.",
      "All subsystems passed warfare stress tests. Browser is resilient under attack.",
    ],
    metricsBreakdown: {
      survival_score: 91.2,
      hydration_stability: 84.0,
      ws_reliability: 78.5,
      dom_score: 71.6,
    },
  },
  {
    sessionId: "hydration_breaker-d4e5f6",
    survivalScore: 73.8,
    survivalGrade: "C",
    grade: "C",
    hydrationStability: 54.2,
    wsReliability: 88.0,
    domFragility: 42.1,
    overallScore: 68.9,
    collapseProbability: 0.31,
    timestamp: Date.now() - 180000,
    recommendations: [
      "[HYDRATION 54.2] — SSR hydration contract violated. Audit server/client state sync.",
      "[COLLAPSE 31%] — Moderate collapse probability. Investigate hydration failures.",
    ],
  },
  {
    sessionId: "memory_bomb-g7h8i9",
    survivalScore: 55.3,
    survivalGrade: "D",
    grade: "D",
    hydrationStability: 79.0,
    wsReliability: 82.1,
    domFragility: 61.5,
    overallScore: 62.4,
    collapseProbability: 0.58,
    timestamp: Date.now() - 60000,
    recommendations: [
      "[SURVIVAL 55.3] — Browser struggled under memory warfare. Increase heap headroom.",
      "[COLLAPSE 58%] — HIGH collapse probability. Stop warfare and investigate root causes.",
    ],
  },
];
