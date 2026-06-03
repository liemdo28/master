"use client";

import { useEffect, useRef, useCallback } from "react";
import { useWarRoomStore } from "../store/war-room-store";
import { WarEvent } from "../store/war-room-store";

const WS_API = "ws://localhost:7700/ws";

// ─── Connection state ─────────────────────────────────────────────────────────────

export function useWarRoomWS() {
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const heartbeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);
    const isConnecting = useRef(false);

    const {
        setWsConnected, addEvent, setRuntime, setBrowser, setProviders,
        setIncidents, setScores, addIncident, setChaosActive,
    } = useWarRoomStore();

    // ─── Message handlers ─────────────────────────────────────────────────────────

    const handleMessage = useCallback((msg: Record<string, unknown>) => {
        const channel = msg.channel as string;

        switch (channel) {
            case "warroom": {
                const data = msg.data as Record<string, unknown>;
                if (data.operational_score !== undefined) {
                    setScores(data.operational_score as number, data.collapse_probability as number);
                }
                if (data.runtime) setRuntime(data.runtime as never);
                if (data.browser) setBrowser(data.browser as never);
                if (data.providers) setProviders(data.providers as never);
                if (data.incidents) {
                    setIncidents(data.incidents as never[]);
                }
                break;
            }
            case "event": {
                const ev = msg.data as Record<string, unknown>;
                const warEvent: WarEvent = {
                    id: (ev.id as string) || `ws-${Date.now()}-${Math.random()}`,
                    type: (ev.type as string) || "unknown",
                    source: (ev.source as string) || "ws",
                    severity: ((ev.type as string) || "").includes("critical") || ((ev.type as string) || "").includes("failure")
                        ? "critical"
                        : ((ev.type as string) || "").includes("warning") || ((ev.type as string) || "").includes("degraded")
                            ? "warning"
                            : ((ev.type as string) || "").includes("recovered") || ((ev.type as string) || "").includes("success")
                                ? "success"
                                : "info",
                    message: (ev.message as string) || (ev.type as string) || "",
                    timestamp: (ev.timestamp as number) || Math.floor(Date.now() / 1000),
                    metadata: ev,
                };
                addEvent(warEvent);
                break;
            }
            case "incident": {
                const inc = msg.data as Record<string, unknown>;
                addIncident({
                    incident_id: (inc.incident_id as string) || `ws-inc-${Date.now()}`,
                    title: (inc.title as string) || "WS Incident",
                    severity: ((inc.severity as string) || "medium") as WarEvent["severity"] extends "critical" | "high" | "medium" | "low" ? never : never,
                    state: "active",
                    timestamp: (inc.timestamp as number) || Math.floor(Date.now() / 1000),
                    blast_radius: (inc.blast_radius as string) || "Unknown",
                    affected_subsystems: (inc.affected_subsystems as string[]) || [],
                } as never);
                break;
            }
            case "chaos": {
                const chaosData = msg.data as Record<string, unknown>;
                setChaosActive((chaosData.active as boolean) || false);
                break;
            }
            case "heartbeat": {
                // Heartbeat ack — connection alive
                break;
            }
        }
    }, [setScores, setRuntime, setBrowser, setProviders, setIncidents, addEvent, addIncident, setChaosActive]);

    // ─── Connect ─────────────────────────────────────────────────────────────────

    const connect = useCallback(() => {
        if (isConnecting.current || (wsRef.current && wsRef.current.readyState === WebSocket.OPEN)) return;
        isConnecting.current = true;

        try {
            const ws = new WebSocket(WS_API);
            wsRef.current = ws;

            ws.onopen = () => {
                isConnecting.current = false;
                setWsConnected(true);

                // Subscribe to all channels
                ws.send(JSON.stringify({ action: "subscribe", channels: ["/ws/warroom", "/ws/events", "/ws/incidents", "/ws/chaos"] }));

                // Start heartbeat
                heartbeatTimer.current = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ channel: "heartbeat", timestamp: Date.now() }));
                    }
                }, 15000);
            };

            ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data as string) as Record<string, unknown>;
                    handleMessage(msg);
                } catch { /* ignore parse errors */ }
            };

            ws.onerror = () => {
                isConnecting.current = false;
                setWsConnected(false);
            };

            ws.onclose = () => {
                isConnecting.current = false;
                setWsConnected(false);

                // Clear heartbeat
                if (heartbeatTimer.current) {
                    clearInterval(heartbeatTimer.current);
                    heartbeatTimer.current = null;
                }

                // Auto-reconnect after 3s
                reconnectTimer.current = setTimeout(() => {
                    connect();
                }, 3000);
            };
        } catch {
            isConnecting.current = false;
            setWsConnected(false);
            reconnectTimer.current = setTimeout(() => connect(), 5000);
        }
    }, [handleMessage, setWsConnected]);

    // ─── Disconnect ──────────────────────────────────────────────────────────────

    const disconnect = useCallback(() => {
        if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
        if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        setWsConnected(false);
    }, [setWsConnected]);

    // ─── Send ───────────────────────────────────────────────────────────────────

    const send = useCallback((channel: string, data: unknown) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ channel, data, timestamp: Date.now() }));
        }
    }, []);

    // ─── Lifecycle ──────────────────────────────────────────────────────────────

    useEffect(() => {
        connect();
        return () => disconnect();
    }, [connect, disconnect]);

    return { send, disconnect, reconnect: connect };
}
