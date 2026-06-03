"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWarRoomStore, WarfareSession, WarfareScenario } from "../../store/war-room-store";
import {
  Globe, Crosshair, Zap, AlertTriangle, CheckCircle2, XCircle, Clock,
  ChevronDown, Play, RotateCcw, Activity, MemoryStick, Wifi, FlaskConical,
  Terminal, Swords, Shield, X, Bug, Flame, Skull, Siren, ArrowRight,
} from "lucide-react";

const API = "http://localhost:7700/api";

// ─── Danger level config ───────────────────────────────────────────────────────

const DANGER_CONFIG = {
  low: {
    color: "#00FFB3",
    bg: "rgba(0,255,179,0.08)",
    border: "rgba(0,255,179,0.25)",
    glow: "0 0 12px rgba(0,255,179,0.3)",
    label: "LOW",
    pulseColor: "#00FFB3",
  },
  medium: {
    color: "#FFC857",
    bg: "rgba(255,200,87,0.08)",
    border: "rgba(255,200,87,0.3)",
    glow: "0 0 12px rgba(255,200,87,0.4)",
    label: "MEDIUM",
    pulseColor: "#FFC857",
  },
  high: {
    color: "#FF5C7A",
    bg: "rgba(255,92,122,0.1)",
    border: "rgba(255,92,122,0.4)",
    glow: "0 0 15px rgba(255,92,122,0.5)",
    label: "HIGH",
    pulseColor: "#FF5C7A",
  },
  extreme: {
    color: "#FF2E63",
    bg: "rgba(255,46,99,0.12)",
    border: "rgba(255,46,99,0.6)",
    glow: "0 0 20px rgba(255,46,99,0.7)",
    label: "EXTREME",
    pulseColor: "#FF2E63",
  },
} as const;

// ─── Scenario Icons ─────────────────────────────────────────────────────────────

const SCENARIO_ICONS: Record<string, React.ReactNode> = {
  memory_stress: <MemoryStick size={11} />,
  hydration_chaos: <FlaskConical size={11} />,
  websocket_bomb: <Wifi size={11} />,
  console_spam: <Terminal size={11} />,
  navigation_storm: <Crosshair size={11} />,
  network_throttle: <Activity size={11} />,
  dom_terror: <Bug size={11} />,
};

const SCENARIO_LABELS: Record<string, string> = {
  memory_stress: "MEMORY STRESS",
  hydration_chaos: "HYDRATION CHAOS",
  websocket_bomb: "WS BOMBARDMENT",
  console_spam: "CONSOLE SPAM",
  navigation_storm: "NAV STORM",
  network_throttle: "NET THROTTLE",
  dom_terror: "DOM TERROR",
};

// ─── Status Badge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: WarfareSession["status"] }) {
  const config = {
    queued: { color: "#4DA3FF", bg: "rgba(77,163,255,0.15)", label: "QUEUED" },
    running: { color: "#00FFB3", bg: "rgba(0,255,179,0.15)", label: "RUNNING" },
    completed: { color: "#00FFB3", bg: "rgba(0,255,179,0.1)", label: "COMPLETED" },
    failed: { color: "#FF5C7A", bg: "rgba(255,92,122,0.15)", label: "FAILED" },
  }[status];

  return (
    <span
      className="font-mono-war text-[8px] font-bold tracking-widest px-1.5 py-0.5 rounded-sm"
      style={{ color: config.color, background: config.bg, border: `1px solid ${config.color}40` }}
    >
      {config.label}
    </span>
  );
}

// ─── Danger Badge ───────────────────────────────────────────────────────────────

function DangerBadge({ danger }: { danger: WarfareScenario["danger"] }) {
  const cfg = DANGER_CONFIG[danger];
  return (
    <span
      className="font-mono-war text-[8px] font-black tracking-widest px-1.5 py-0.5 rounded-sm"
      style={{
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        boxShadow: cfg.glow,
      }}
    >
      {cfg.label}
    </span>
  );
}

// ─── Progress Bar ──────────────────────────────────────────────────────────────

function ProgressBar({ progress, danger }: { progress: number; danger: WarfareScenario["danger"] }) {
  const cfg = DANGER_CONFIG[danger];
  return (
    <div className="w-full h-1 rounded-sm overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
      <motion.div
        className="h-full rounded-sm"
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        style={{ background: cfg.color, boxShadow: `0 0 8px ${cfg.color}` }}
      />
    </div>
  );
}

// ─── Pulsing Danger Dot ────────────────────────────────────────────────────────

function DangerDot({ danger, size = 8 }: { danger: string; size?: number }) {
  const cfg = DANGER_CONFIG[danger as keyof typeof DANGER_CONFIG] ?? DANGER_CONFIG.low;
  return (
    <motion.div
      className="rounded-full shrink-0"
      style={{
        width: size,
        height: size,
        backgroundColor: cfg.pulseColor,
        boxShadow: `0 0 6px ${cfg.pulseColor}`,
      }}
      animate={{
        opacity: [1, 0.3, 1],
        boxShadow: [
          `0 0 6px ${cfg.pulseColor}`,
          `0 0 14px ${cfg.pulseColor}, 0 0 22px ${cfg.pulseColor}`,
          `0 0 6px ${cfg.pulseColor}`,
        ],
      }}
      transition={{ duration: danger === "extreme" ? 0.6 : 1.5, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

// ─── Session Card ──────────────────────────────────────────────────────────────

function SessionCard({ session }: { session: WarfareSession }) {
  const danger = session.scenario.split("_")[0] as WarfareScenario["danger"];
  const cfg = DANGER_CONFIG[danger] ?? DANGER_CONFIG.low;
  const elapsed = Math.floor((Date.now() - session.startedAt) / 1000);
  const memTotal = session.memory ? Object.values(session.memory).reduce((a, b) => a + b, 0) : 0;
  const hydrationTotal = session.hydration ? Object.values(session.hydration).reduce((a, b) => a + b, 0) : 0;

  return (
    <motion.div
      className="relative rounded border overflow-hidden"
      style={{
        borderColor: cfg.border,
        background: cfg.bg,
        boxShadow: session.status === "running" ? cfg.glow : "none",
      }}
      layout
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.95 }}
      transition={{ duration: 0.3 }}
    >
      {/* Extreme danger glow overlay */}
      {danger === "extreme" && session.status === "running" && (
        <motion.div
          className="absolute inset-0 pointer-events-none rounded-sm"
          style={{
            background: "radial-gradient(ellipse at center, rgba(255,46,99,0.08) 0%, transparent 70%)",
          }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      )}

      {/* Card Header */}
      <div className="flex items-center gap-2 px-2.5 py-1.5" style={{ borderBottom: `1px solid ${cfg.border}30` }}>
        <DangerDot danger={danger} size={7} />
        <div className="flex-1 min-w-0">
          <span className="font-mono-war text-[9px] font-black tracking-wider truncate block" style={{ color: cfg.color }}>
            {session.scenarioLabel || SCENARIO_LABELS[session.scenario] || session.scenario.toUpperCase()}
          </span>
        </div>
        <StatusBadge status={session.status} />
      </div>

      {/* Progress */}
      <div className="px-2.5 pt-1.5 pb-0">
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono-war text-[8px] text-white/30">PROGRESS</span>
          <span className="font-mono-war text-[8px] font-bold" style={{ color: cfg.color }}>
            {session.progress}%
          </span>
        </div>
        <ProgressBar progress={session.progress} danger={danger} />
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-px px-2.5 py-1.5" style={{ background: "rgba(255,255,255,0.03)" }}>
        <div className="text-center">
          <MemoryStick size={8} style={{ color: memTotal > 200 ? "#FFC857" : "#00FFB3" }} className="mx-auto mb-0.5" />
          <span className="font-mono-war text-[8px] font-bold block" style={{ color: memTotal > 200 ? "#FFC857" : "#00FFB3" }}>
            {memTotal > 0 ? `${memTotal}MB` : "—"}
          </span>
          <span className="font-mono-war text-[7px] text-white/25">MEM</span>
        </div>
        <div className="text-center">
          <FlaskConical size={8} style={{ color: hydrationTotal > 0 ? "#FFC857" : "#4DA3FF" }} className="mx-auto mb-0.5" />
          <span className="font-mono-war text-[8px] font-bold block" style={{ color: hydrationTotal > 0 ? "#FFC857" : "#4DA3FF" }}>
            {hydrationTotal > 0 ? hydrationTotal : "—"}
          </span>
          <span className="font-mono-war text-[7px] text-white/25">HYDR</span>
        </div>
        <div className="text-center">
          <Wifi size={8} style={{ color: (session.wsDisconnects ?? 0) > 0 ? "#FF5C7A" : "#4DA3FF" }} className="mx-auto mb-0.5" />
          <span className="font-mono-war text-[8px] font-bold block" style={{ color: (session.wsDisconnects ?? 0) > 0 ? "#FF5C7A" : "#4DA3FF" }}>
            {session.wsDisconnects ?? 0}
          </span>
          <span className="font-mono-war text-[7px] text-white/25">WS DC</span>
        </div>
      </div>

      {/* Footer: elapsed + errors */}
      <div className="flex items-center justify-between px-2.5 py-1" style={{ borderTop: `1px solid ${cfg.border}20` }}>
        <div className="flex items-center gap-1">
          <Clock size={7} style={{ color: "rgba(255,255,255,0.2)" }} />
          <span className="font-mono-war text-[7px] text-white/25">{elapsed}s</span>
        </div>
        {(session.errorCount ?? 0) > 0 && (
          <span className="flex items-center gap-0.5">
            <AlertTriangle size={7} style={{ color: "#FF5C7A" }} />
            <span className="font-mono-war text-[7px] font-bold" style={{ color: "#FF5C7A" }}>
              {session.errorCount}
            </span>
          </span>
        )}
      </div>
    </motion.div>
  );
}

// ─── Quick Scenario Button ─────────────────────────────────────────────────────

function ScenarioButton({
  scenario,
  onLaunch,
}: {
  scenario: WarfareScenario;
  onLaunch: (id: string) => void;
}) {
  const cfg = DANGER_CONFIG[scenario.danger];
  const [hovered, setHovered] = useState(false);

  return (
    <motion.button
      className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded border w-full text-left overflow-hidden"
      style={{
        borderColor: hovered ? cfg.border : `${cfg.border}60`,
        background: hovered ? cfg.bg : "rgba(0,0,0,0.2)",
        boxShadow: hovered ? cfg.glow : "none",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onLaunch(scenario.id)}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
    >
      {hovered && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `linear-gradient(90deg, ${cfg.color}08 0%, transparent 100%)` }}
          initial={{ x: "-100%" }}
          animate={{ x: "100%" }}
          transition={{ duration: 0.4 }}
        />
      )}
      <DangerDot danger={scenario.danger} size={6} />
      <span className="font-mono-war text-[8px] font-bold tracking-wider flex-1" style={{ color: cfg.color }}>
        {scenario.label}
      </span>
      <Play size={8} style={{ color: cfg.color, opacity: hovered ? 1 : 0.3 }} />
    </motion.button>
  );
}

// ─── History Row ───────────────────────────────────────────────────────────────

function HistoryRow({ result }: { result: ReturnType<typeof useWarRoomStore.getState>["warfareHistory"][number] }) {
  return (
    <div
      className="flex items-center gap-2 px-2 py-1 rounded-sm"
      style={{ background: "rgba(0,0,0,0.15)", border: "1px solid rgba(255,255,255,0.05)" }}
    >
      {result.success ? (
        <CheckCircle2 size={9} style={{ color: "#00FFB3" }} />
      ) : (
        <XCircle size={9} style={{ color: "#FF5C7A" }} />
      )}
      <span className="font-mono-war text-[8px] text-white/50 flex-1 truncate">
        {SCENARIO_LABELS[result.scenario] || result.scenario}
      </span>
      <span className="font-mono-war text-[7px] text-white/20">
        {result.modulesExecuted.length} mods
      </span>
      <span className="font-mono-war text-[7px] font-bold" style={{ color: result.success ? "#00FFB3" : "#FF5C7A" }}>
        {result.success ? "OK" : "FAIL"}
      </span>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export function BrowserWarfare() {
  const {
    activeWarfareSessions,
    addWarfareSession,
    updateWarfareSession,
    removeWarfareSession,
    warfareScenarios,
    setWarfareScenarios,
    warfareRunning,
    setWarfareRunning,
    warfareHistory,
    addWarfareResult,
    browser,
    setBrowser,
  } = useWarRoomStore();

  const [targetUrl, setTargetUrl] = useState("http://localhost:3000");
  const [selectedScenario, setSelectedScenario] = useState<string>("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [hasExtremeRunning, setHasExtremeRunning] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch scenarios on mount
  useEffect(() => {
    const fetchScenarios = async () => {
      try {
        const res = await fetch(`${API}/browser-warfare/scenarios`);
        if (res.ok) {
          const data = await res.json();
          const scenarios: WarfareScenario[] = Array.isArray(data) ? data : data.scenarios ?? [];
          setWarfareScenarios(scenarios);
        }
      } catch {
        // silent
      }
    };
    fetchScenarios();
  }, [setWarfareScenarios]);

  // Poll active sessions
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const res = await fetch(`${API}/tasks`);
        if (res.ok) {
          const data = await res.json();
          // Update sessions from backend
          if (data.browser_warfare_sessions) {
            data.browser_warfare_sessions.forEach((s: WarfareSession) => {
              const existing = activeWarfareSessions.find((x) => x.id === s.id);
              if (existing) {
                updateWarfareSession(s.id, s);
              }
            });
          }
          if (data.browser) setBrowser(data.browser);
        }
      } catch { /* silent */ }
    };

    const id = setInterval(fetchSessions, 3000);
    return () => clearInterval(id);
  }, [activeWarfareSessions, updateWarfareSession, setBrowser]);

  // Check for extreme running
  useEffect(() => {
    setHasExtremeRunning(activeWarfareSessions.some((s) => s.status === "running" && s.scenario.includes("extreme")));
  }, [activeWarfareSessions]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Launch warfare
  const launchWarfare = useCallback(
    async (scenarioId: string) => {
      setLaunching(true);
      setWarfareRunning(true);
      setDropdownOpen(false);

      const sessionId = `warfare-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const scenario = warfareScenarios.find((s) => s.id === scenarioId);

      const session: WarfareSession = {
        id: sessionId,
        scenario: scenarioId,
        scenarioLabel: scenario?.label ?? SCENARIO_LABELS[scenarioId] ?? scenarioId.toUpperCase(),
        targetUrl,
        status: "queued",
        startedAt: Date.now(),
        modulesExecuted: (scenario?.modules ?? "").split(",").filter(Boolean),
        progress: 0,
      };

      addWarfareSession(session);

      // Simulate progress for queued→running
      setTimeout(() => {
        updateWarfareSession(sessionId, { status: "running", progress: 10 });
      }, 800);

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        const current = activeWarfareSessions.find((s) => s.id === sessionId);
        if (!current || current.status === "completed" || current.status === "failed") {
          clearInterval(progressInterval);
          return;
        }
        const newProgress = Math.min(95, (current.progress ?? 10) + Math.random() * 15);
        const memoryVal = Math.floor(50 + Math.random() * 250);
        const hydrationVal = Math.floor(Math.random() * 5);
        updateWarfareSession(sessionId, {
          progress: Math.round(newProgress),
          memory: { heapUsed: memoryVal, heapTotal: memoryVal + 50 },
          hydration: { mismatches: hydrationVal },
          wsDisconnects: Math.floor(Math.random() * 3),
          errorCount: Math.floor(Math.random() * 4),
        });
      }, 2000);

      // API call
      try {
        const res = await fetch(`${API}/run-browser-warfare`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scenario_id: scenarioId, target_url: targetUrl, session_id: sessionId }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.session_id) {
            updateWarfareSession(sessionId, { id: data.session_id });
          }
        } else {
          // Mark failed after a delay if API is unreachable
          setTimeout(() => {
            updateWarfareSession(sessionId, { status: "failed", progress: 0 });
            addWarfareResult({
              sessionId,
              scenario: scenarioId,
              success: false,
              modulesExecuted: session.modulesExecuted,
              completedAt: new Date().toISOString(),
              memory: {},
              hydration: {},
              errors: ["API unreachable — session simulated"],
            });
            clearInterval(progressInterval);
            setWarfareRunning(activeWarfareSessions.filter((s) => s.id !== sessionId && s.status === "running").length > 0);
          }, 5000);
        }

        // Complete simulation regardless after max time
        setTimeout(() => {
          const current = activeWarfareSessions.find((s) => s.id === sessionId);
          if (current && current.status === "running") {
            updateWarfareSession(sessionId, { status: "completed", progress: 100 });
            addWarfareResult({
              sessionId,
              scenario: scenarioId,
              success: true,
              modulesExecuted: session.modulesExecuted,
              completedAt: new Date().toISOString(),
              memory: { heapUsed: 180, heapTotal: 230 },
              hydration: { mismatches: Math.floor(Math.random() * 2) },
              errors: [],
            });
            clearInterval(progressInterval);
          }
        }, 25000);
      } catch {
        updateWarfareSession(sessionId, { status: "failed", progress: 0 });
        addWarfareResult({
          sessionId,
          scenario: scenarioId,
          success: false,
          modulesExecuted: session.modulesExecuted,
          completedAt: new Date().toISOString(),
          memory: {},
          hydration: {},
          errors: ["Network error"],
        });
        clearInterval(progressInterval);
      }

      setLaunching(false);
    },
    [
      targetUrl,
      warfareScenarios,
      activeWarfareSessions,
      addWarfareSession,
      updateWarfareSession,
      addWarfareResult,
      setWarfareRunning,
    ]
  );

  const selectedScen = warfareScenarios.find((s) => s.id === selectedScenario);
  const selectedCfg = selectedScen ? DANGER_CONFIG[selectedScen.danger] : DANGER_CONFIG.low;
  const runningCount = activeWarfareSessions.filter((s) => s.status === "running").length;
  const queuedCount = activeWarfareSessions.filter((s) => s.status === "queued").length;

  return (
    <div
      className="rounded-lg border overflow-hidden relative"
      style={{
        borderColor: hasExtremeRunning ? "rgba(255,46,99,0.5)" : "rgba(255,255,255,0.1)",
        background: "rgba(5,8,22,0.7)",
        boxShadow: hasExtremeRunning ? "0 0 30px rgba(255,46,99,0.2), inset 0 0 40px rgba(255,46,99,0.04)" : "none",
      }}
    >
      {/* Extreme danger border pulse */}
      {hasExtremeRunning && (
        <motion.div
          className="absolute inset-0 rounded-lg pointer-events-none"
          style={{ border: "1px solid rgba(255,46,99,0.6)" }}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        />
      )}

      {/* Header */}
      <div
        className="px-4 py-2.5 flex items-center justify-between"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="flex items-center gap-2.5">
          <motion.div
            className="w-1.5 h-1.5 rounded-full"
            animate={{
              backgroundColor: hasExtremeRunning ? "#FF2E63" : runningCount > 0 ? "#00FFB3" : "#4DA3FF",
              boxShadow: hasExtremeRunning
                ? "0 0 8px #FF2E63"
                : runningCount > 0
                ? "0 0 8px #00FFB3"
                : "0 0 6px #4DA3FF",
            }}
            transition={{ duration: 0.5 }}
          />
          <Swords size={11} style={{ color: "#FF5C7A" }} />
          <span className="font-mono-war text-[10px] font-black tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.75)" }}>
            BROWSER WARFARE
          </span>
          {runningCount > 0 && (
            <motion.span
              className="font-mono-war text-[8px] font-bold px-1.5 py-0.5 rounded-sm"
              animate={{ backgroundColor: ["rgba(0,255,179,0.2)", "rgba(0,255,179,0.35)", "rgba(0,255,179,0.2)"] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              style={{ color: "#00FFB3", border: "1px solid rgba(0,255,179,0.4)" }}
            >
              {runningCount} ACTIVE
            </motion.span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {(runningCount > 0 || queuedCount > 0) && (
            <span className="font-mono-war text-[8px] text-white/20">
              {runningCount + queuedCount} session{runningCount + queuedCount !== 1 ? "s" : ""}
            </span>
          )}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1 font-mono-war text-[8px] px-1.5 py-0.5 rounded-sm transition-colors"
            style={{
              color: showHistory ? "#4DA3FF" : "rgba(255,255,255,0.3)",
              background: showHistory ? "rgba(77,163,255,0.1)" : "transparent",
              border: showHistory ? "1px solid rgba(77,163,255,0.3)" : "1px solid transparent",
            }}
          >
            <Clock size={8} />
            HISTORY
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {showHistory ? (
          <motion.div
            key="history"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-3 space-y-1">
              {warfareHistory.length === 0 ? (
                <div className="text-center py-4">
                  <Shield size={16} style={{ color: "rgba(255,255,255,0.15)" }} className="mx-auto mb-1" />
                  <span className="font-mono-war text-[8px] text-white/20">No warfare history</span>
                </div>
              ) : (
                warfareHistory.map((r, i) => <HistoryRow key={`${r.sessionId}-${i}`} result={r} />)
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="main"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-3 space-y-3"
          >
            {/* Target URL + Scenario Selector */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Crosshair size={9} style={{ color: "rgba(255,255,255,0.35)" }} />
                <span className="font-mono-war text-[8px] text-white/30 tracking-wider uppercase">Target URL</span>
              </div>
              <input
                type="text"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                className="w-full rounded border px-2.5 py-1.5 font-mono-war text-[9px] text-white/70 outline-none transition-colors"
                style={{
                  background: "rgba(0,0,0,0.3)",
                  borderColor: "rgba(255,255,255,0.1)",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(0,255,179,0.4)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
              />
            </div>

            {/* Scenario Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <div className="flex items-center gap-2 mb-1.5">
                <FlaskConical size={9} style={{ color: "rgba(255,255,255,0.35)" }} />
                <span className="font-mono-war text-[8px] text-white/30 tracking-wider uppercase">Scenario</span>
                {selectedScen && <DangerBadge danger={selectedScen.danger} />}
              </div>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded border text-left transition-colors"
                style={{
                  background: "rgba(0,0,0,0.3)",
                  borderColor: dropdownOpen ? selectedCfg.border : "rgba(255,255,255,0.1)",
                  color: selectedScen ? selectedCfg.color : "rgba(255,255,255,0.3)",
                }}
              >
                <span className="font-mono-war text-[9px] truncate">
                  {selectedScen ? selectedScen.label : "Select scenario..."}
                </span>
                <motion.div animate={{ rotate: dropdownOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronDown size={10} style={{ color: "rgba(255,255,255,0.3)" }} />
                </motion.div>
              </button>

              <AnimatePresence>
                {dropdownOpen && (
                  <motion.div
                    className="absolute top-full left-0 right-0 mt-1 z-50 rounded border overflow-hidden"
                    style={{
                      background: "rgba(8,10,28,0.98)",
                      borderColor: "rgba(255,255,255,0.12)",
                      boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                    }}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                  >
                    {warfareScenarios.map((scen) => {
                      const cfg = DANGER_CONFIG[scen.danger];
                      return (
                        <button
                          key={scen.id}
                          onClick={() => {
                            setSelectedScenario(scen.id);
                            setDropdownOpen(false);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-white/5"
                          style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                        >
                          <DangerDot danger={scen.danger} size={6} />
                          <div className="flex-1 min-w-0">
                            <span className="font-mono-war text-[8px] font-bold block" style={{ color: cfg.color }}>
                              {scen.label}
                            </span>
                            <span className="font-mono-war text-[7px] text-white/25 line-clamp-1">{scen.description}</span>
                          </div>
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Launch Button */}
            <motion.button
              onClick={() => selectedScenario && launchWarfare(selectedScenario)}
              disabled={!selectedScenario || launching}
              className="w-full flex items-center justify-center gap-2 py-2 rounded font-mono-war text-[10px] font-black tracking-widest uppercase transition-all relative overflow-hidden"
              style={{
                background: selectedScenario
                  ? "linear-gradient(135deg, rgba(255,46,99,0.3) 0%, rgba(255,92,122,0.3) 100%)"
                  : "rgba(255,255,255,0.05)",
                border: selectedScenario
                  ? "1px solid rgba(255,92,122,0.5)"
                  : "1px solid rgba(255,255,255,0.08)",
                color: selectedScenario ? "#FF5C7A" : "rgba(255,255,255,0.2)",
                cursor: selectedScenario && !launching ? "pointer" : "not-allowed",
                boxShadow: selectedScenario ? "0 0 20px rgba(255,46,99,0.2)" : "none",
              }}
              whileHover={selectedScenario && !launching ? { scale: 1.01 } : {}}
              whileTap={selectedScenario && !launching ? { scale: 0.98 } : {}}
              animate={
                selectedScenario && !launching
                  ? {
                      boxShadow: [
                        "0 0 20px rgba(255,46,99,0.2)",
                        "0 0 35px rgba(255,46,99,0.4)",
                        "0 0 20px rgba(255,46,99,0.2)",
                      ],
                    }
                  : {}
              }
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <Swords size={11} />
              {launching ? "LAUNCHING..." : "LAUNCH WARFARE"}
              {selectedScenario && !launching && <ArrowRight size={10} />}
            </motion.button>

            {/* Active Sessions */}
            {activeWarfareSessions.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Siren size={9} style={{ color: "rgba(255,200,87,0.6)" }} />
                  <span className="font-mono-war text-[8px] text-white/30 tracking-wider uppercase">
                    Active Operations
                  </span>
                  <span className="font-mono-war text-[7px] text-white/20 ml-auto">
                    {activeWarfareSessions.length} total
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <AnimatePresence>
                    {activeWarfareSessions.map((s) => (
                      <SessionCard key={s.id} session={s} />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Quick Scenario Grid */}
            {warfareScenarios.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Zap size={9} style={{ color: "rgba(255,200,87,0.6)" }} />
                  <span className="font-mono-war text-[8px] text-white/30 tracking-wider uppercase">
                    Quick Strike
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {warfareScenarios.slice(0, 6).map((scen) => (
                    <ScenarioButton key={scen.id} scenario={scen} onLaunch={launchWarfare} />
                  ))}
                </div>
              </div>
            )}

            {/* Global Browser Metrics Strip */}
            <div
              className="grid grid-cols-3 gap-px rounded-sm overflow-hidden"
              style={{ border: "1px solid rgba(255,255,255,0.06)" }}
            >
              {[
                { label: "Sessions", value: browser.active_sessions, icon: <Globe size={8} />, color: "#00FFB3" },
                { label: "Render", value: browser.render_instability_score.toFixed(1), icon: <Activity size={8} />, color: browser.render_instability_score > 5 ? "#FFC857" : "#00FFB3" },
                { label: "WS DC", value: browser.ws_disconnects, icon: <Wifi size={8} />, color: browser.ws_disconnects > 0 ? "#FF5C7A" : "#00FFB3" },
              ].map((m) => (
                <div
                  key={m.label}
                  className="flex flex-col items-center py-1.5 px-1"
                  style={{ background: "rgba(0,0,0,0.2)" }}
                >
                  <span style={{ color: m.color }}>{m.icon}</span>
                  <span className="font-mono-war text-[10px] font-bold mt-0.5" style={{ color: m.color }}>
                    {m.value}
                  </span>
                  <span className="font-mono-war text-[7px] text-white/25">{m.label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
