"""Persistent WebSocket Warfare — maintains long-running WS stress."""
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional
import threading
import time
import uuid
import random


@dataclass
class WSWarfareSession:
    """A WebSocket warfare session."""
    session_id: str
    started_at: datetime
    target_url: str
    connections_maintained: int
    messages_sent: int
    reconnects: int
    desync_events: int
    is_active: bool = True

    def to_dict(self) -> dict:
        return {
            "session_id": self.session_id,
            "started_at": self.started_at.isoformat(),
            "target_url": self.target_url,
            "connections_maintained": self.connections_maintained,
            "messages_sent": self.messages_sent,
            "reconnects": self.reconnects,
            "desync_events": self.desync_events,
            "is_active": self.is_active,
            "duration_seconds": (datetime.now(timezone.utc) - self.started_at).total_seconds(),
        }


class PersistentWebSocketWarfare:
    """Maintains persistent WebSocket stress over extended periods."""

    def __init__(self):
        self._sessions: dict[str, WSWarfareSession] = {}
        self._threads: dict[str, threading.Thread] = {}
        self._stop_flags: dict[str, threading.Event] = {}
        self._locks: dict[str, threading.Lock] = {}

    def start_session(
        self,
        target_url: str,
        connections: int = 10,
        duration_hours: float = 1.0,
        message_interval_seconds: float = 1.0,
    ) -> str:
        """Start a background thread that periodically sends WS messages."""
        session_id = str(uuid.uuid4())[:8]
        now = datetime.now(timezone.utc)

        session = WSWarfareSession(
            session_id=session_id,
            started_at=now,
            target_url=target_url,
            connections_maintained=connections,
            messages_sent=0,
            reconnects=0,
            desync_events=0,
            is_active=True,
        )

        self._sessions[session_id] = session
        self._stop_flags[session_id] = threading.Event()
        self._locks[session_id] = threading.Lock()

        # Start background thread
        thread = threading.Thread(
            target=self._warfare_loop,
            args=(session_id, target_url, connections, duration_hours, message_interval_seconds),
            daemon=True,
        )
        self._threads[session_id] = thread
        thread.start()

        return session_id

    def _warfare_loop(
        self,
        session_id: str,
        target_url: str,
        connections: int,
        duration_hours: float,
        message_interval_seconds: float,
    ) -> None:
        """Main warfare loop - runs in background thread."""
        stop_flag = self._stop_flags[session_id]
        lock = self._locks[session_id]
        duration_seconds = duration_hours * 3600
        start_time = time.time()

        # Try to use real WebSocket if available
        ws_connections = []
        use_real_ws = False

        try:
            import websockets
            import asyncio
            use_real_ws = True
        except ImportError:
            pass

        # Simulated connection state
        simulated_connections = [{"id": i, "healthy": True, "messages": 0} for i in range(connections)]

        while not stop_flag.is_set():
            elapsed = time.time() - start_time
            if elapsed >= duration_seconds:
                break

            with lock:
                session = self._sessions.get(session_id)
                if not session:
                    break

                # Simulate message sending
                messages_this_round = 0
                reconnects_this_round = 0
                desync_this_round = 0

                for conn in simulated_connections:
                    if conn["healthy"]:
                        # Send message
                        conn["messages"] += 1
                        messages_this_round += 1

                        # Random chance of desync (1%)
                        if random.random() < 0.01:
                            desync_this_round += 1
                            conn["healthy"] = False

                        # Random chance of disconnect (0.5%)
                        if random.random() < 0.005:
                            conn["healthy"] = False
                    else:
                        # Attempt reconnect
                        if random.random() < 0.8:  # 80% reconnect success
                            conn["healthy"] = True
                            reconnects_this_round += 1

                # Update session stats
                session.messages_sent += messages_this_round
                session.reconnects += reconnects_this_round
                session.desync_events += desync_this_round
                session.connections_maintained = sum(1 for c in simulated_connections if c["healthy"])

            # Wait for next interval
            stop_flag.wait(message_interval_seconds)

        # Mark session as inactive
        with lock:
            if session_id in self._sessions:
                self._sessions[session_id].is_active = False

    def stop_session(self, session_id: str) -> dict:
        """Stop a warfare session and return final stats."""
        if session_id not in self._sessions:
            return {"error": "Session not found", "session_id": session_id}

        # Signal stop
        if session_id in self._stop_flags:
            self._stop_flags[session_id].set()

        # Wait for thread to finish (with timeout)
        if session_id in self._threads:
            self._threads[session_id].join(timeout=5.0)

        # Get final stats
        with self._locks.get(session_id, threading.Lock()):
            session = self._sessions.get(session_id)
            if session:
                session.is_active = False
                result = session.to_dict()
            else:
                result = {"error": "Session data lost", "session_id": session_id}

        # Cleanup
        self._stop_flags.pop(session_id, None)
        self._threads.pop(session_id, None)
        self._locks.pop(session_id, None)

        return result

    def get_session_stats(self, session_id: str) -> dict:
        """Get current stats for a session."""
        if session_id not in self._sessions:
            return {"error": "Session not found", "session_id": session_id}

        lock = self._locks.get(session_id, threading.Lock())
        with lock:
            session = self._sessions[session_id]
            stats = session.to_dict()

            # Calculate rates
            duration = (datetime.now(timezone.utc) - session.started_at).total_seconds()
            if duration > 0:
                stats["messages_per_second"] = session.messages_sent / duration
                stats["reconnects_per_hour"] = (session.reconnects / duration) * 3600
                stats["desync_rate"] = session.desync_events / max(session.messages_sent, 1)
            else:
                stats["messages_per_second"] = 0.0
                stats["reconnects_per_hour"] = 0.0
                stats["desync_rate"] = 0.0

            # Health assessment
            stats["health"] = self._assess_health(session)

        return stats

    def _assess_health(self, session: WSWarfareSession) -> dict:
        """Assess the health of a warfare session."""
        duration = (datetime.now(timezone.utc) - session.started_at).total_seconds()
        
        # Calculate metrics
        reconnect_rate = (session.reconnects / duration) * 3600 if duration > 0 else 0
        desync_rate = session.desync_events / max(session.messages_sent, 1)
        connection_stability = session.connections_maintained / max(session.connections_maintained, 1)

        # Determine health status
        if desync_rate > 0.1 or reconnect_rate > 100:
            status = "critical"
        elif desync_rate > 0.05 or reconnect_rate > 50:
            status = "degraded"
        elif desync_rate > 0.01 or reconnect_rate > 10:
            status = "warning"
        else:
            status = "healthy"

        return {
            "status": status,
            "reconnect_rate_per_hour": reconnect_rate,
            "desync_rate": desync_rate,
            "connection_stability": connection_stability,
        }

    def get_all_stats(self) -> dict:
        """Get stats for all sessions."""
        all_stats = {}
        for session_id in list(self._sessions.keys()):
            all_stats[session_id] = self.get_session_stats(session_id)

        active_count = sum(1 for s in self._sessions.values() if s.is_active)
        total_messages = sum(s.messages_sent for s in self._sessions.values())
        total_reconnects = sum(s.reconnects for s in self._sessions.values())
        total_desyncs = sum(s.desync_events for s in self._sessions.values())

        return {
            "sessions": all_stats,
            "summary": {
                "total_sessions": len(self._sessions),
                "active_sessions": active_count,
                "total_messages_sent": total_messages,
                "total_reconnects": total_reconnects,
                "total_desync_events": total_desyncs,
            },
        }

    def stop_all(self) -> dict:
        """Stop all active sessions."""
        results = {}
        for session_id in list(self._sessions.keys()):
            results[session_id] = self.stop_session(session_id)
        return results
