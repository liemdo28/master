"use client";

import { create } from "zustand";

// ─── Types ──────────────────────────────────────────────────────────────────────

export type NodeStatus = "healthy" | "degraded" | "critical" | "collapsing" | "offline";
export type ThreatLevel = "nominal" | "elevated" | "high" | "critical";
export type WarRoomMode = "war-room" | "compact" | "incident-focus";

export interface TopologyNode {
    id: string;
    label: string;
    status: NodeStatus;
    latency_ms?: number;
    failure_rate?: number;
    connections: string[];
    info: string;
}

export interface Incident {
    incident_id: string;
    title: string;
    severity: "critical" | "high" | "medium" | "low";
    state: "active" | "mitigating" | "resolved" | "investigating";
    timestamp: number;
    blast_radius: string;
    affected_subsystems: string[];
    description?: string;
    evidence?: string[];
}

export interface WarEvent {
    id: string;
    type: string;
    source: string;
    severity: "critical" | "warning" | "info" | "success";
    message: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
}

export interface RuntimeMetrics {
    cpu_percent: number;
    memory_percent: number;
    disk_percent: number;
    process_count: number;
    websocket_count: number;
    queue_depth: number;
    provider_latency_ms: number;
    retry_storms: number;
    stuck_workers: number;
    failed_executions: number;
    event_loop_lag_ms: number;
}

export interface BrowserMetrics {
    active_sessions: number;
    render_instability_score: number;
    stale_state_detections: number;
    hydration_mismatches: number;
    memory_mb: number;
    ws_disconnects: number;
}

export interface ProviderMetrics {
    name: string;
    latency_ms: number;
    timeout_rate: number;
    failure_rate: number;
    status: NodeStatus;
}

export interface ChaosScenario {
    id: string;
    label: string;
    description: string;
    danger: "low" | "medium" | "high" | "extreme";
    active: boolean;
    started_at?: number;
}

export interface WarfareScenario {
    id: string;
    label: string;
    description: string;
    danger: "low" | "medium" | "high" | "extreme";
    modules?: string;
}

export interface WarfareSession {
    id: string;
    scenario: string;
    scenarioLabel?: string;
    targetUrl: string;
    status: "queued" | "running" | "completed" | "failed";
    startedAt: number;
    modulesExecuted: string[];
    progress: number;
    memory?: Record<string, number>;
    hydration?: Record<string, number>;
    wsDisconnects?: number;
    errorCount?: number;
}

export interface WarfareResult {
    sessionId: string;
    scenario: string;
    success: boolean;
    modulesExecuted: string[];
    completedAt: string;
    memory: Record<string, number>;
    hydration: Record<string, number>;
    errors: string[];
}

// ─── Warfare Scoring Types ───────────────────────────────────────────────────────

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

// ─── Store ──────────────────────────────────────────────────────────────────────

interface WarRoomState {
    // Global mode
    mode: WarRoomMode;
    setMode: (mode: WarRoomMode) => void;

    // Connection
    wsConnected: boolean;
    setWsConnected: (v: boolean) => void;

    // Threat level
    threatLevel: ThreatLevel;
    setThreatLevel: (level: ThreatLevel) => void;

    // Topology
    topologyNodes: TopologyNode[];
    setTopologyNodes: (nodes: TopologyNode[]) => void;
    updateNode: (id: string, updates: Partial<TopologyNode>) => void;

    // Incidents
    incidents: Incident[];
    setIncidents: (incidents: Incident[]) => void;
    addIncident: (incident: Incident) => void;
    resolveIncident: (id: string) => void;

    // Events
    events: WarEvent[];
    addEvent: (event: WarEvent) => void;
    clearEvents: () => void;

    // Runtime
    runtime: RuntimeMetrics;
    setRuntime: (metrics: RuntimeMetrics) => void;

    // Browser
    browser: BrowserMetrics;
    setBrowser: (metrics: BrowserMetrics) => void;

    // Providers
    providers: ProviderMetrics[];
    setProviders: (providers: ProviderMetrics[]) => void;

    // Chaos
    chaosScenarios: ChaosScenario[];
    setChaosScenarios: (scenarios: ChaosScenario[]) => void;
    toggleChaos: (id: string) => void;

    // Global scores
    operationalScore: number;
    collapseProbability: number;
    setScores: (score: number, collapse: number) => void;

    // Chaos active
    chaosActive: boolean;
    setChaosActive: (v: boolean) => void;

    // ─── Browser Warfare ───────────────────────────────────────────────────────
    activeWarfareSessions: WarfareSession[];
    addWarfareSession: (session: WarfareSession) => void;
    updateWarfareSession: (id: string, updates: Partial<WarfareSession>) => void;
    removeWarfareSession: (id: string) => void;
    warfareScenarios: WarfareScenario[];
    setWarfareScenarios: (scenarios: WarfareScenario[]) => void;
    warfareRunning: boolean;
    setWarfareRunning: (running: boolean) => void;
    warfareHistory: WarfareResult[];
    addWarfareResult: (result: WarfareResult) => void;

    // ─── Warfare Scoring ───────────────────────────────────────────────────────
    warfareScores: WarfareScoreCard[];
    addWarfareScore: (score: WarfareScoreCard) => void;
    clearWarfareScores: () => void;
}

export const useWarRoomStore = create<WarRoomState>((set) => ({
    mode: "war-room",
    setMode: (mode) => set({ mode }),

    wsConnected: false,
    setWsConnected: (wsConnected) => set({ wsConnected }),

    threatLevel: "nominal",
    setThreatLevel: (threatLevel) => set({ threatLevel }),

    topologyNodes: [],
    setTopologyNodes: (topologyNodes) => set({ topologyNodes }),
    updateNode: (id, updates) =>
        set((state) => ({
            topologyNodes: state.topologyNodes.map((n) =>
                n.id === id ? { ...n, ...updates } : n
            ),
        })),

    incidents: [],
    setIncidents: (incidents) => set({ incidents }),
    addIncident: (incident) =>
        set((state) => ({
            incidents: [incident, ...state.incidents].slice(0, 50),
        })),
    resolveIncident: (id) =>
        set((state) => ({
            incidents: state.incidents.map((i) =>
                i.incident_id === id ? { ...i, state: "resolved" as const } : i
            ),
        })),

    events: [],
    addEvent: (event) =>
        set((state) => ({
            events: [event, ...state.events].slice(0, 200),
        })),
    clearEvents: () => set({ events: [] }),

    runtime: {
        cpu_percent: 0, memory_percent: 0, disk_percent: 0,
        process_count: 0, websocket_count: 0, queue_depth: 0,
        provider_latency_ms: 0, retry_storms: 0, stuck_workers: 0,
        failed_executions: 0, event_loop_lag_ms: 0,
    },
    setRuntime: (runtime) => set({ runtime }),

    browser: {
        active_sessions: 0, render_instability_score: 0,
        stale_state_detections: 0, hydration_mismatches: 0,
        memory_mb: 0, ws_disconnects: 0,
    },
    setBrowser: (browser) => set({ browser }),

    providers: [],
    setProviders: (providers) => set({ providers }),

    chaosScenarios: [
        { id: "provider_meltdown", label: "Provider Meltdown", description: "Provider failure + retry storms", danger: "high", active: false },
        { id: "websocket_apocalypse", label: "WebSocket Apocalypse", description: "Total WS infrastructure collapse", danger: "extreme", active: false },
        { id: "queue_starvation", label: "Queue Starvation", description: "Message queue saturation + backlog", danger: "high", active: false },
        { id: "runtime_pressure", label: "Runtime Pressure", description: "Memory + CPU + Event Loop pressure", danger: "high", active: false },
        { id: "browser_swarm", label: "Browser Swarm", description: "Simultaneous browser failures", danger: "medium", active: false },
        { id: "total_chaos", label: "TOTAL CHAOS", description: "All chaos engines simultaneously", danger: "extreme", active: false },
    ],
    setChaosScenarios: (chaosScenarios) => set({ chaosScenarios }),
    toggleChaos: (id) =>
        set((state) => ({
            chaosScenarios: state.chaosScenarios.map((s) =>
                s.id === id ? { ...s, active: !s.active } : s
            ),
        })),

    operationalScore: 0,
    collapseProbability: 0,
    setScores: (operationalScore, collapseProbability) =>
        set({ operationalScore, collapseProbability }),

    chaosActive: false,
    setChaosActive: (chaosActive) => set({ chaosActive }),

    // ─── Browser Warfare ──────────────────────────────────────────────────────
    activeWarfareSessions: [],
    addWarfareSession: (session) =>
        set((state) => ({
            activeWarfareSessions: [session, ...state.activeWarfareSessions].slice(0, 24),
        })),
    updateWarfareSession: (id, updates) =>
        set((state) => ({
            activeWarfareSessions: state.activeWarfareSessions.map((session) =>
                session.id === id ? { ...session, ...updates } : session
            ),
        })),
    removeWarfareSession: (id) =>
        set((state) => ({
            activeWarfareSessions: state.activeWarfareSessions.filter((session) => session.id !== id),
        })),
    warfareScenarios: [
        { id: "memory_stress", label: "MEMORY STRESS", description: "Heap pressure and render instability probe", danger: "medium", modules: "memory,render" },
        { id: "hydration_chaos", label: "HYDRATION CHAOS", description: "SSR/client mismatch and stale UI assault", danger: "high", modules: "hydration,dom" },
        { id: "websocket_bomb", label: "WS BOMBARDMENT", description: "Connection churn and websocket reconnection storm", danger: "high", modules: "websocket,network" },
        { id: "console_spam", label: "CONSOLE SPAM", description: "Browser console noise and error saturation", danger: "low", modules: "console" },
        { id: "navigation_storm", label: "NAV STORM", description: "Rapid route transitions and history pressure", danger: "medium", modules: "navigation" },
        { id: "network_throttle", label: "NET THROTTLE", description: "Latency and packet loss under browser load", danger: "medium", modules: "network" },
    ],
    setWarfareScenarios: (warfareScenarios) => set({ warfareScenarios }),
    warfareRunning: false,
    setWarfareRunning: (warfareRunning) => set({ warfareRunning }),
    warfareHistory: [],
    addWarfareResult: (result) =>
        set((state) => ({
            warfareHistory: [result, ...state.warfareHistory].slice(0, 100),
        })),

    // ─── Warfare Scoring ──────────────────────────────────────────────────────
    warfareScores: [],
    addWarfareScore: (score) =>
        set((state) => ({
            warfareScores: [...state.warfareScores, score].slice(-100),
        })),
    clearWarfareScores: () => set({ warfareScores: [] }),
}));
