"""SQLite database — persistent operational memory for Tester-QA."""
from __future__ import annotations

import json
import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DB_PATH = Path("data/tester_qa.db")


class Database:
    """SQLite-backed persistent storage for incidents, metrics, evidence, and history."""

    def __init__(self, path: Path | str = DB_PATH) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._conn: sqlite3.Connection | None = None
        self._init_schema()

    def _get_conn(self) -> sqlite3.Connection:
        if self._conn is None:
            self._conn = sqlite3.connect(str(self.path), check_same_thread=False)
            self._conn.row_factory = sqlite3.Row
            self._conn.execute("PRAGMA journal_mode=WAL")
            self._conn.execute("PRAGMA foreign_keys=ON")
        return self._conn

    def _init_schema(self) -> None:
        conn = self._get_conn()
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS incidents (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                title TEXT NOT NULL,
                severity TEXT NOT NULL DEFAULT 'medium',
                status TEXT NOT NULL DEFAULT 'open',
                summary TEXT,
                evidence_ids TEXT DEFAULT '[]',
                created_at TEXT NOT NULL,
                updated_at TEXT,
                resolved_at TEXT
            );

            CREATE TABLE IF NOT EXISTS evidence (
                id TEXT PRIMARY KEY,
                project_id TEXT,
                incident_id TEXT,
                evidence_type TEXT NOT NULL,
                file_path TEXT,
                description TEXT,
                metadata TEXT DEFAULT '{}',
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS runtime_metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id TEXT NOT NULL,
                cpu_percent REAL,
                memory_percent REAL,
                websocket_count INTEGER DEFAULT 0,
                queue_depth INTEGER DEFAULT 0,
                provider_latency_ms REAL DEFAULT 0,
                retry_count INTEGER DEFAULT 0,
                timestamp TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type TEXT NOT NULL,
                source TEXT NOT NULL,
                project_id TEXT,
                data TEXT DEFAULT '{}',
                timestamp REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS reports (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                report_type TEXT NOT NULL,
                file_path TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS collapse_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id TEXT,
                collapse_type TEXT NOT NULL,
                origin TEXT,
                affected_count INTEGER DEFAULT 0,
                recovery_time_ms REAL,
                severity TEXT DEFAULT 'high',
                details TEXT DEFAULT '{}',
                timestamp TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS project_registry (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                path TEXT NOT NULL,
                type TEXT DEFAULT 'standalone',
                enabled INTEGER DEFAULT 1,
                risk_level TEXT DEFAULT 'medium',
                metadata TEXT DEFAULT '{}',
                indexed_at TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_incidents_project ON incidents(project_id);
            CREATE INDEX IF NOT EXISTS idx_metrics_project ON runtime_metrics(project_id);
            CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON runtime_metrics(timestamp);
            CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
            CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
        """)
        conn.commit()

    # === Incidents ===

    def create_incident(self, project_id: str, title: str, severity: str = "medium", summary: str = "") -> str:
        import uuid
        incident_id = f"INC-{datetime.now(timezone.utc).strftime('%Y')}-{uuid.uuid4().hex[:6].upper()}"
        now = datetime.now(timezone.utc).isoformat()
        self._get_conn().execute(
            "INSERT INTO incidents (id, project_id, title, severity, summary, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (incident_id, project_id, title, severity, summary, now),
        )
        self._get_conn().commit()
        return incident_id

    def get_incidents(self, project_id: str | None = None, status: str | None = None, limit: int = 50) -> list[dict[str, Any]]:
        query = "SELECT * FROM incidents WHERE 1=1"
        params: list[Any] = []
        if project_id:
            query += " AND project_id = ?"
            params.append(project_id)
        if status:
            query += " AND status = ?"
            params.append(status)
        query += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)
        rows = self._get_conn().execute(query, params).fetchall()
        return [dict(row) for row in rows]

    # === Runtime Metrics ===

    def record_metrics(self, project_id: str, cpu: float, memory: float, ws_count: int = 0, queue_depth: int = 0, provider_latency: float = 0, retry_count: int = 0) -> None:
        now = datetime.now(timezone.utc).isoformat()
        self._get_conn().execute(
            "INSERT INTO runtime_metrics (project_id, cpu_percent, memory_percent, websocket_count, queue_depth, provider_latency_ms, retry_count, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (project_id, cpu, memory, ws_count, queue_depth, provider_latency, retry_count, now),
        )
        self._get_conn().commit()

    def get_metrics(self, project_id: str, limit: int = 100) -> list[dict[str, Any]]:
        rows = self._get_conn().execute(
            "SELECT * FROM runtime_metrics WHERE project_id = ? ORDER BY timestamp DESC LIMIT ?",
            (project_id, limit),
        ).fetchall()
        return [dict(row) for row in rows]

    # === Events ===

    def record_event(self, event_type: str, source: str, project_id: str | None = None, data: dict | None = None) -> None:
        self._get_conn().execute(
            "INSERT INTO events (event_type, source, project_id, data, timestamp) VALUES (?, ?, ?, ?, ?)",
            (event_type, source, project_id, json.dumps(data or {}), time.time()),
        )
        self._get_conn().commit()

    def get_events(self, event_type: str | None = None, project_id: str | None = None, limit: int = 100) -> list[dict[str, Any]]:
        query = "SELECT * FROM events WHERE 1=1"
        params: list[Any] = []
        if event_type:
            query += " AND event_type = ?"
            params.append(event_type)
        if project_id:
            query += " AND project_id = ?"
            params.append(project_id)
        query += " ORDER BY timestamp DESC LIMIT ?"
        params.append(limit)
        rows = self._get_conn().execute(query, params).fetchall()
        results = []
        for row in rows:
            d = dict(row)
            d["data"] = json.loads(d.get("data", "{}"))
            results.append(d)
        return results

    # === Evidence ===

    def record_evidence(self, evidence_id: str, project_id: str, evidence_type: str, file_path: str, description: str = "", incident_id: str | None = None) -> None:
        now = datetime.now(timezone.utc).isoformat()
        self._get_conn().execute(
            "INSERT INTO evidence (id, project_id, incident_id, evidence_type, file_path, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (evidence_id, project_id, incident_id, evidence_type, file_path, description, now),
        )
        self._get_conn().commit()

    def get_evidence(self, project_id: str | None = None, incident_id: str | None = None) -> list[dict[str, Any]]:
        query = "SELECT * FROM evidence WHERE 1=1"
        params: list[Any] = []
        if project_id:
            query += " AND project_id = ?"
            params.append(project_id)
        if incident_id:
            query += " AND incident_id = ?"
            params.append(incident_id)
        query += " ORDER BY created_at DESC"
        rows = self._get_conn().execute(query, params).fetchall()
        return [dict(row) for row in rows]

    # === Collapse History ===

    def record_collapse(self, project_id: str, collapse_type: str, origin: str, affected_count: int, recovery_time_ms: float = 0, severity: str = "high", details: dict | None = None) -> None:
        now = datetime.now(timezone.utc).isoformat()
        self._get_conn().execute(
            "INSERT INTO collapse_history (project_id, collapse_type, origin, affected_count, recovery_time_ms, severity, details, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (project_id, collapse_type, origin, affected_count, recovery_time_ms, severity, json.dumps(details or {}), now),
        )
        self._get_conn().commit()

    def get_collapse_history(self, project_id: str | None = None, limit: int = 50) -> list[dict[str, Any]]:
        query = "SELECT * FROM collapse_history"
        params: list[Any] = []
        if project_id:
            query += " WHERE project_id = ?"
            params.append(project_id)
        query += " ORDER BY timestamp DESC LIMIT ?"
        params.append(limit)
        rows = self._get_conn().execute(query, params).fetchall()
        results = []
        for row in rows:
            d = dict(row)
            d["details"] = json.loads(d.get("details", "{}"))
            results.append(d)
        return results

    # === Stats ===

    def get_stats(self) -> dict[str, Any]:
        conn = self._get_conn()
        incidents = conn.execute("SELECT COUNT(*) as c FROM incidents").fetchone()["c"]
        open_incidents = conn.execute("SELECT COUNT(*) as c FROM incidents WHERE status = 'open'").fetchone()["c"]
        evidence_count = conn.execute("SELECT COUNT(*) as c FROM evidence").fetchone()["c"]
        events_count = conn.execute("SELECT COUNT(*) as c FROM events").fetchone()["c"]
        collapses = conn.execute("SELECT COUNT(*) as c FROM collapse_history").fetchone()["c"]
        return {
            "total_incidents": incidents,
            "open_incidents": open_incidents,
            "total_evidence": evidence_count,
            "total_events": events_count,
            "total_collapses": collapses,
            "db_path": str(self.path),
            "db_size_bytes": self.path.stat().st_size if self.path.exists() else 0,
        }

    def close(self) -> None:
        if self._conn:
            self._conn.close()
            self._conn = None
