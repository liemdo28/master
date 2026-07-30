"""Financial Warehouse MVP — read-only data foundation for Mi.

Stores source registry, snapshot registry, and freshness registry on disk
(JSON-backed; DuckDB/SQLite compatible). Designed for Phase 3A — does NOT
write to any production financial system.

Endpoints:
    GET  /health
    GET  /sources
    POST /sources/register
    POST /snapshots/register
    GET  /freshness
    GET  /runtime-proof
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, jsonify, request

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "warehouse.db.json"
EVIDENCE_DIR = BASE_DIR / "runtime-evidence"
EVIDENCE_DIR.mkdir(exist_ok=True)
LOG_PATH = EVIDENCE_DIR / "warehouse.jsonl"

app = Flask(__name__)


# ---------------------------- storage helpers ---------------------------- #


def _read_state() -> dict:
    if not DB_PATH.exists():
        return {"sources": {}, "snapshots": {}, "freshness": {}}
    with DB_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def _write_state(state: dict) -> None:
    with DB_PATH.open("w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)


def _append_log(entry: dict) -> None:
    with LOG_PATH.open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# --------------------------------- routes -------------------------------- #


@app.get("/health")
def health():
    payload = {"ok": True, "ts": _now(), "service": "financial-warehouse-mvp"}
    _append_log({"event": "health", "payload": payload})
    return jsonify(payload)


@app.get("/sources")
def list_sources():
    state = _read_state()
    sources = list(state.get("sources", {}).values())
    payload = {"count": len(sources), "sources": sources}
    _append_log({"event": "list_sources", "count": len(sources)})
    return jsonify(payload)


@app.post("/sources/register")
def register_source():
    body = request.get_json(force=True, silent=True) or {}
    required = ["source_id", "source_name"]
    missing = [k for k in required if k not in body]
    if missing:
        return jsonify({"error": "missing_fields", "missing": missing}), 400

    state = _read_state()
    sources = state.setdefault("sources", {})
    record = {
        "source_id": body["source_id"],
        "source_name": body["source_name"],
        "owner": body.get("owner", "unknown"),
        "classification": body.get("classification", "MISSING"),
        "health": body.get("health", "UNKNOWN"),
        "registered_at": body.get("registered_at", _now()),
        "notes": body.get("notes", ""),
    }
    sources[record["source_id"]] = record

    freshness = state.setdefault("freshness", {})
    freshness.setdefault(
        record["source_id"],
        {
            "source_id": record["source_id"],
            "source_name": record["source_name"],
            "last_seen": None,
            "age": None,
            "health": record["health"],
            "status": record["classification"],
        },
    )

    _write_state(state)
    _append_log({"event": "register_source", "payload": record})
    return jsonify(record), 201


@app.post("/snapshots/register")
def register_snapshot():
    body = request.get_json(force=True, silent=True) or {}
    required = ["source_id", "snapshot_id"]
    missing = [k for k in required if k not in body]
    if missing:
        return jsonify({"error": "missing_fields", "missing": missing}), 400

    state = _read_state()
    sources = state.get("sources", {})
    if body["source_id"] not in sources:
        return jsonify({"error": "unknown_source", "source_id": body["source_id"]}), 404

    snapshots = state.setdefault("snapshots", {})
    record = {
        "source_id": body["source_id"],
        "snapshot_id": body["snapshot_id"],
        "snapshot_at": body.get("snapshot_at", _now()),
        "record_count": body.get("record_count", 0),
        "confidence": body.get("confidence", "LOW"),
        "notes": body.get("notes", ""),
    }
    snapshots[record["snapshot_id"]] = record

    freshness = state.setdefault("freshness", {})
    freshness[record["source_id"]] = {
        "source_id": record["source_id"],
        "source_name": sources[record["source_id"]]["source_name"],
        "last_seen": record["snapshot_at"],
        "age": "PT0S",
        "health": "LIVE",
        "status": "LIVE",
    }

    _write_state(state)
    _append_log({"event": "register_snapshot", "payload": record})
    return jsonify(record), 201


@app.get("/freshness")
def freshness():
    state = _read_state()
    rows = list(state.get("freshness", {}).values())
    payload = {"count": len(rows), "freshness": rows}
    _append_log({"event": "get_freshness", "count": len(rows)})
    return jsonify(payload)


@app.get("/runtime-proof")
def runtime_proof():
    state = _read_state()
    payload = {
        "status": "FINANCIAL_WAREHOUSE_MVP_OPERATIONAL",
        "ts": _now(),
        "sources": len(state.get("sources", {})),
        "snapshots": len(state.get("snapshots", {})),
        "evidence_log": str(LOG_PATH),
    }
    _append_log({"event": "runtime_proof", "payload": payload})
    return jsonify(payload)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5177))
    app.run(host="127.0.0.1", port=port, debug=False)
