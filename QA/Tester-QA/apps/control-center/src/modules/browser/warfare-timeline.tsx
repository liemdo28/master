"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWarRoomStore, WarfareSession } from "../../store/war-room-store";
import {
  Clock, ChevronDown, ChevronRight, Bug, Wifi, FlaskConical,
  Terminal, MemoryStick, Activity, CheckCircle2, XCircle,
  AlertTriangle, ArrowRight, Zap, Cpu, Globe, RefreshCw,
} from "lucide-react";

const API = "http://localhost:7700/api";

// ─── Event Types ────────────────────────────────────────────────────────────────

type EventType =
  | "module_start"
  | "module_complete"
  | "module_error"
  | "hydration_detected"
  | "ws_disconnect"
  | "memory_spike"
  | "render_burst"
  | "session_queued"
  | "session_start"
  | "session_complete"
  | "session_fail";

interface TimelineEvent {
  id: string;
  type: EventType;
  sessionId: string;
  timestamp: number;
  label: string;
  detail?: string;
  severity: "info" | "warning" | "critical" | "success";
  phase: "before" | "during" | "after";
}

const EVENT_CONFIG: Record<
  EventType,
  { icon: React.ReactNode; color: string; label: string }
> = {
  module_start: { icon: <Zap size={9} />, color: "#4DA3FF", label: "Module Start" },
  module_complete: { icon: <CheckCircle2 size={9} />, color: "#00FFB3", label: "Module Done" },
  module_error: { icon: <XCircle size={9} />, color: "#FF5C7A", label: "Module Error" },
  hydration_detected: { icon: <FlaskConical size={9} />, color: "#FFC857", label: "Hydration Fault" },
  ws_disconnect: { icon: <Wifi size={9} />, color: "#FF5C7A", label: "WS Disconnect" },
  memory_spike: { icon: <MemoryStick size={9} />, color: "#FFC857", label: "Memory Spike" },
  render_burst: { icon: <Activity size={9} />, color: "#FFC857", label: "Render Burst" },
  session_queued: { icon: <Clock size={9} />, color: "#4DA3FF", label: "Session Queued" },
  session_start: { icon: <Globe size={9} />, color: "#00FFB3", label: "Session Start" },
  session_complete: { icon: <CheckCircle2 size={9} />, color: "#00FFB3", label: "Session Complete" },
  session_fail: { icon: <XCircle size={9} />, color: "#FF2E63", label: "Session Failed" },
};

const PHASE_COLORS = {
  before: "#4DA3FF",
  during: "#FF5C7A",
  after: "#00FFB3",
};

const PHASE_LABELS = {
  before: "BEFORE",
  during: "DURING",
  after: "AFTER",
};

// ─── Generate mock timeline events from session ─────────────────────────────────

function generateEvents(session: WarfareSession): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const start = session.startedAt;

  events.push({
    id: `${session.id}-queued`,
    type: "session_queued",
    sessionId: session.id,
    timestamp: start,
    label: `Session queued: ${session.scenarioLabel}`,
    detail: `Target: ${session.targetUrl}`,
    severity: "info",
    phase: "before",
  });

  if (session.status === "queued") return events;

  events.push({
    id: `${session.id}-start`,
    type: "session_start",
    sessionId: session.id,
    timestamp: start + 500,
    label: `Warfare initiated: ${session.scenarioLabel}`,
    detail: `${session.modulesExecuted.length} modules loaded`,
    severity: "success",
    phase: "before",
  });

  session.modulesExecuted.forEach((mod, i) => {
    const modStart = start + 1000 + i * 2000;
    events.push({
      id: `${session.id}-mod-${i}-start`,
      type: "module_start",
      sessionId: session.id,
      timestamp: modStart,
      label: `Executing: ${mod}`,
      severity: "info",
      phase: "during",
    });

    if (Math.random() > 0.6) {
      events.push({
        id: `${session.id}-mod-${i}-err`,
        type: "module_error",
        sessionId: session.id,
        timestamp: modStart + 800,
        label: `Error in ${mod}`,
        detail: `Non-fatal: module recovered`,
        severity: "warning",
        phase: "during",
      });
    }

    if (Math.random() > 0.7) {
      events.push({
        id: `${session.id}-mod-${i}-hydr`,
        type: "hydration_detected",
        sessionId: session.id,
        timestamp: modStart + 400,
        label: `Hydration mismatch`,
        detail: `Component re-rendered with stale state`,
        severity: "warning",
        phase: "during",
      });
    }

    if (Math.random() > 0.75) {
      events.push({
        id: `${session.id}-mod-${i}-ws`,
        type: "ws_disconnect",
        sessionId: session.id,
        timestamp: modStart + 1200,
        label: `WebSocket disconnect`,
        detail: `Reconnecting...`,
        severity: session.status === "failed" ? "critical" : "warning",
        phase: "during",
      });
    }

    if (Math.random() > 0.8) {
      events.push({
        id: `${session.id}-mod-${i}-mem`,
        type: "memory_spike",
        sessionId: session.id,
        timestamp: modStart + 600,
        label: `Memory spike detected`,
        detail: `Heap usage elevated`,
        severity: "warning",
        phase: "during",
      });
    }

    events.push({
      id: `${session.id}-mod-${i}-done`,
      type: "module_complete",
      sessionId: session.id,
      timestamp: modStart + 1500,
      label: `Module complete: ${mod}`,
      severity: "success",
      phase: "during",
    });
  });

  const endTime = start + 20000;
  events.push({
    id: `${session.id}-${session.status === "completed" ? "complete" : "fail"}`,
    type: session.status === "completed" ? "session_complete" : "session_fail",
    sessionId: session.id,
    timestamp: endTime,
    label: `Warfare ${session.status}: ${session.scenarioLabel}`,
    detail: session.status === "completed"
      ? `All ${session.modulesExecuted.length} modules executed successfully`
      : `Warfare simulation failed`,
    severity: session.status === "completed" ? "success" : "critical",
    phase: "after",
  });

  return events;
}

// ─── Single Timeline Entry ──────────────────────────────────────────────────────

function TimelineEntry({ event, expanded, onToggle }: {
  event: TimelineEvent;
  expanded: boolean;
  onToggle: () => void;
}) {
  const cfg = EVENT_CONFIG[event.type];
  const elapsed = Math.floor((Date.now() - event.timestamp) / 1000);
  const timeStr = new Date(event.timestamp).toLocaleTimeString("en-US", {
    hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

  return (
    <motion.div
      className="relative"
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay: 0.02 }}
    >
      {/* Connector line */}
      <div
        className="absolute left-[11px] top-8 bottom-0 w-px"
        style={{ background: `linear-gradient(to bottom, ${cfg.color}40, rgba(255,255,255,0.05))` }}
      />

      <div className="flex gap-2.5 pl-0.5 pr-1 py-1">
        {/* Icon dot */}
        <div
          className="w-[22px] h-[22px] rounded-full flex items-center justify-center shrink-0 mt-0.5 relative z-10"
          style={{
            background: `${cfg.color}20`,
            border: `1px solid ${cfg.color}50`,
            boxShadow: `0 0 8px ${cfg.color}30`,
          }}
        >
          <span style={{ color: cfg.color }}>{cfg.icon}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <button
            onClick={onToggle}
            className="w-full flex items-start gap-2 text-left py-0.5 rounded hover:bg-white/3 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="font-mono-war text-[8px] font-black tracking-wider" style={{ color: cfg.color }}>
                  {cfg.label}
                </span>
                {event.severity === "critical" && (
                  <AlertTriangle size={7} style={{ color: "#FF2E63" }} />
                )}
                {event.severity === "success" && (
                  <CheckCircle2 size={7} style={{ color: "#00FFB3" }} />
                )}
              </div>
              <span className="font-mono-war text-[8px] text-white/60 line-clamp-1">{event.label}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="font-mono-war text-[7px] text-white/20">{timeStr}</span>
              {event.detail && (
                <motion.div animate={{ rotate: expanded ? 90 : 0 }}>
                  <ChevronRight size={8} style={{ color: "rgba(255,255,255,0.2)" }} />
                </motion.div>
              )}
            </div>
          </button>

          <AnimatePresence>
            {expanded && event.detail && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div
                  className="mt-1 ml-8 px-2 py-1 rounded-sm text-left"
                  style={{
                    background: `${cfg.color}0D`,
                    border: `1px solid ${cfg.color}25`,
                  }}
                >
                  <span className="font-mono-war text-[7px] text-white/40">{event.detail}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Phase Section ──────────────────────────────────────────────────────────────

function PhaseSection({
  phase,
  events,
  sessionId,
}: {
  phase: "before" | "during" | "after";
  events: TimelineEvent[];
  sessionId: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const phaseEvents = events.filter((e) => e.phase === phase && e.sessionId === sessionId);
  if (phaseEvents.length === 0) return null;

  return (
    <div>
      {/* Phase header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-2 px-2 py-1.5 mb-1 rounded-sm transition-colors hover:bg-white/4"
      >
        <motion.div animate={{ rotate: collapsed ? 0 : 90 }}>
          <ChevronRight size={9} style={{ color: PHASE_COLORS[phase] }} />
        </motion.div>
        <span
          className="font-mono-war text-[8px] font-black tracking-widest"
          style={{ color: PHASE_COLORS[phase] }}
        >
          {PHASE_LABELS[phase]}
        </span>
        <span className="font-mono-war text-[7px] text-white/20 ml-1">
          {phaseEvents.length} event{phaseEvents.length !== 1 ? "s" : ""}
        </span>
        <div className="ml-auto flex gap-px">
          {phaseEvents.map((e) => {
            const cfg = EVENT_CONFIG[e.type];
            return (
              <div
                key={e.id}
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: cfg.color, boxShadow: `0 0 4px ${cfg.color}` }}
              />
            );
          })}
        </div>
      </button>

      {/* Phase events */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pl-2 pb-1">
              {phaseEvents.map((e) => (
                <TimelineEntryWithExpand key={e.id} event={e} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Wrapper to manage expanded state per event
function TimelineEntryWithExpand({ event }: { event: TimelineEvent }) {
  const [expanded, setExpanded] = useState(false);
  return <TimelineEntry event={event} expanded={expanded} onToggle={() => setExpanded(!expanded)} />;
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export function WarfareTimeline() {
  const { activeWarfareSessions } = useWarRoomStore();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [allEvents, setAllEvents] = useState<TimelineEvent[]>([]);
  const [showOnlyRunning, setShowOnlyRunning] = useState(true);

  const runningSessions = activeWarfareSessions.filter(
    (s) => s.status === "running" || s.status === "queued"
  );
  const displaySessions = showOnlyRunning && runningSessions.length > 0
    ? runningSessions
    : activeWarfareSessions;
  const selectedSession = activeWarfareSessions.find((s) => s.id === selectedSessionId)
    ?? displaySessions[0];

  // Generate events for all active sessions
  useEffect(() => {
    const events: TimelineEvent[] = [];
    activeWarfareSessions.forEach((session) => {
      events.push(...generateEvents(session));
    });
    setAllEvents(events.sort((a, b) => a.timestamp - b.timestamp));
  }, [activeWarfareSessions]);

  const selectedEvents = selectedSession
    ? allEvents.filter((e) => e.sessionId === selectedSession.id)
    : [];

  const phaseCounts = {
    before: selectedEvents.filter((e) => e.phase === "before").length,
    during: selectedEvents.filter((e) => e.phase === "during").length,
    after: selectedEvents.filter((e) => e.phase === "after").length,
  };

  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{
        borderColor: "rgba(255,255,255,0.1)",
        background: "rgba(5,8,22,0.7)",
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-2.5 flex items-center justify-between"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="flex items-center gap-2.5">
          <motion.div
            className="w-1.5 h-1.5 rounded-full"
            animate={{
              backgroundColor: runningSessions.length > 0 ? "#FF5C7A" : "#00FFB3",
              boxShadow: runningSessions.length > 0 ? "0 0 8px #FF5C7A" : "0 0 6px #00FFB3",
            }}
            transition={{ duration: 0.5 }}
          />
          <Clock size={11} style={{ color: "#FFC857" }} />
          <span className="font-mono-war text-[10px] font-black tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.75)" }}>
            WARFARE TIMELINE
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowOnlyRunning(!showOnlyRunning)}
            className="font-mono-war text-[8px] px-1.5 py-0.5 rounded-sm transition-colors"
            style={{
              color: showOnlyRunning ? "#FF5C7A" : "rgba(255,255,255,0.3)",
              background: showOnlyRunning ? "rgba(255,92,122,0.1)" : "transparent",
              border: showOnlyRunning ? "1px solid rgba(255,92,122,0.3)" : "1px solid transparent",
            }}
          >
            <RefreshCw size={7} className="inline mr-1" />
            {showOnlyRunning ? "ACTIVE" : "ALL"}
          </button>
        </div>
      </div>

      {/* Session Selector */}
      {displaySessions.length > 0 && (
        <div className="px-3 py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Globe size={8} style={{ color: "rgba(255,255,255,0.25)" }} />
            <span className="font-mono-war text-[7px] text-white/25 uppercase tracking-wider">Session</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {displaySessions.slice(0, 4).map((session) => {
              const isSelected = session.id === selectedSession?.id;
              const isRunning = session.status === "running";
              return (
                <button
                  key={session.id}
                  onClick={() => setSelectedSessionId(session.id)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-sm font-mono-war text-[7px] font-bold transition-colors"
                  style={{
                    color: isSelected ? "#FF5C7A" : "rgba(255,255,255,0.3)",
                    background: isSelected ? "rgba(255,92,122,0.12)" : "rgba(0,0,0,0.2)",
                    border: isSelected ? "1px solid rgba(255,92,122,0.35)" : "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {isRunning && (
                    <motion.div
                      className="w-1 h-1 rounded-full"
                      animate={{ backgroundColor: ["#00FFB3", "#FF5C7A"] }}
                      transition={{ duration: 0.5, repeat: Infinity }}
                    />
                  )}
                  {session.scenarioLabel || session.scenario}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Phase progress strip */}
      {selectedSession && (
        <div
          className="flex items-center gap-px px-3 py-2"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          {(["before", "during", "after"] as const).map((phase) => (
            <div key={phase} className="flex-1 flex items-center gap-1">
              <span className="font-mono-war text-[7px] font-black" style={{ color: PHASE_COLORS[phase] }}>
                {PHASE_LABELS[phase]}
              </span>
              <div className="flex-1 h-0.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: PHASE_COLORS[phase] }}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (phaseCounts[phase] / Math.max(1, selectedEvents.length)) * 100)}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <span className="font-mono-war text-[7px] text-white/25">{phaseCounts[phase]}</span>
            </div>
          ))}
        </div>
      )}

      {/* Timeline content */}
      <div className="overflow-y-auto" style={{ maxHeight: "320px" }}>
        {!selectedSession ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Cpu size={18} style={{ color: "rgba(255,255,255,0.1)" }} />
            <span className="font-mono-war text-[8px] text-white/20 mt-2">
              No active warfare sessions
            </span>
          </div>
        ) : selectedEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Activity size={18} style={{ color: "rgba(255,255,255,0.1)" }} />
            <span className="font-mono-war text-[8px] text-white/20 mt-2">
              Awaiting session data...
            </span>
          </div>
        ) : (
          <div className="px-3 py-2">
            <PhaseSection phase="before" events={selectedEvents} sessionId={selectedSession.id} />
            <PhaseSection phase="during" events={selectedEvents} sessionId={selectedSession.id} />
            <PhaseSection phase="after" events={selectedEvents} sessionId={selectedSession.id} />
          </div>
        )}
      </div>

      {/* Footer */}
      {selectedSession && (
        <div
          className="flex items-center justify-between px-3 py-1.5"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center gap-2">
            <span
              className="font-mono-war text-[7px] text-white/25 uppercase"
            >
              {selectedSession.scenarioLabel}
            </span>
          </div>
          <span className="font-mono-war text-[7px] text-white/20">
            {selectedEvents.length} events
          </span>
        </div>
      )}
    </div>
  );
}
