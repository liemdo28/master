"""Warehouse Client — reads from Financial Warehouse (Phase 3A).

All intelligence flows through this client. No direct data fabrication.
"""
from __future__ import annotations

import json
import os
import urllib.request
from datetime import datetime, timezone
from typing import Any, Optional

WAREHOUSE_BASE = os.environ.get("FINANCIAL_WAREHOUSE_URL", "http://127.0.0.1:5177")


def _get(path: str) -> Optional[dict]:
    """GET a warehouse endpoint. Returns None on failure."""
    try:
        url = f"{WAREHOUSE_BASE}{path}"
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=5) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception:
        return None


def _post(path: str, body: dict) -> Optional[dict]:
    """POST to a warehouse endpoint. Returns None on failure."""
    try:
        url = f"{WAREHOUSE_BASE}{path}"
        data = json.dumps(body).encode("utf-8")
        req = urllib.request.Request(url, data=data, method="POST",
                                     headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception:
        return None


def health() -> Optional[dict]:
    """Warehouse health check."""
    return _get("/health")


def sources() -> list[dict]:
    """List all registered sources."""
    resp = _get("/sources")
    return resp.get("sources", []) if resp else []


def freshness() -> list[dict]:
    """Get freshness registry rows."""
    resp = _get("/freshness")
    return resp.get("freshness", []) if resp else []


def runtime_proof() -> Optional[dict]:
    """Get warehouse runtime proof."""
    return _get("/runtime-proof")


def warehouse_available() -> bool:
    """Check if the warehouse is reachable."""
    h = health()
    return h is not None and h.get("ok", False)
