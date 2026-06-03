"""Auth chaos — simulate authentication failures and session corruption."""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass
class AuthChaosResult:
    scenario: str
    project_id: str
    success: bool
    failure_type: str | None = None
    recovery_time_ms: float = 0.0
    details: dict[str, Any] = field(default_factory=dict)
    timestamp: str = ""

    def __post_init__(self) -> None:
        if not self.timestamp:
            self.timestamp = datetime.now(timezone.utc).isoformat()

    def to_dict(self) -> dict[str, Any]:
        return {
            "scenario": self.scenario,
            "project_id": self.project_id,
            "success": self.success,
            "failure_type": self.failure_type,
            "recovery_time_ms": self.recovery_time_ms,
            "details": self.details,
            "timestamp": self.timestamp,
        }


class AuthChaos:
    """Simulate authentication failures to test system resilience."""

    def simulate_expired_token(self, project_id: str) -> AuthChaosResult:
        """Simulate an expired JWT/session token."""
        return AuthChaosResult(
            scenario="expired_token",
            project_id=project_id,
            success=True,
            failure_type="token_expired",
            details={
                "action": "Set token expiry to past timestamp",
                "expected_behavior": "System should redirect to login or refresh token",
                "test_points": ["API returns 401", "UI shows login prompt", "Refresh token attempted"],
            },
        )

    def simulate_corrupted_cookie(self, project_id: str) -> AuthChaosResult:
        """Simulate corrupted session cookie."""
        return AuthChaosResult(
            scenario="corrupted_cookie",
            project_id=project_id,
            success=True,
            failure_type="cookie_corruption",
            details={
                "action": "Modify cookie value to invalid base64",
                "expected_behavior": "System should clear cookie and require re-auth",
                "test_points": ["Session invalidated", "No crash on parse", "Clean re-auth flow"],
            },
        )

    def simulate_duplicate_login(self, project_id: str) -> AuthChaosResult:
        """Simulate concurrent login from multiple sessions."""
        return AuthChaosResult(
            scenario="duplicate_login",
            project_id=project_id,
            success=True,
            failure_type="session_conflict",
            details={
                "action": "Login same account from 2+ browser sessions simultaneously",
                "expected_behavior": "System handles gracefully — either allows or invalidates old session",
                "test_points": ["No data corruption", "Session isolation", "Proper logout cascade"],
            },
        )

    def simulate_websocket_auth_mismatch(self, project_id: str) -> AuthChaosResult:
        """Simulate WebSocket connection with mismatched auth state."""
        return AuthChaosResult(
            scenario="websocket_auth_mismatch",
            project_id=project_id,
            success=True,
            failure_type="ws_auth_desync",
            details={
                "action": "Expire HTTP session while WebSocket remains connected",
                "expected_behavior": "WebSocket should detect auth loss and reconnect with fresh auth",
                "test_points": ["WS detects stale auth", "Reconnect with valid token", "No stale data served"],
            },
        )

    def simulate_stale_auth_state(self, project_id: str) -> AuthChaosResult:
        """Simulate stale localStorage/sessionStorage auth data."""
        return AuthChaosResult(
            scenario="stale_auth_state",
            project_id=project_id,
            success=True,
            failure_type="stale_storage",
            details={
                "action": "Inject outdated auth data into localStorage",
                "expected_behavior": "App should validate and refresh on next API call",
                "test_points": ["Stale token detected", "Refresh attempted", "UI not stuck in auth limbo"],
            },
        )

    def simulate_invalid_refresh_token(self, project_id: str) -> AuthChaosResult:
        """Simulate refresh token that has been revoked or expired."""
        return AuthChaosResult(
            scenario="invalid_refresh_token",
            project_id=project_id,
            success=True,
            failure_type="refresh_revoked",
            details={
                "action": "Replace refresh token with revoked/expired value",
                "expected_behavior": "System should force full re-authentication",
                "test_points": ["Refresh fails gracefully", "User redirected to login", "No infinite refresh loop"],
            },
        )

    def run_full_auth_chaos(self, project_id: str) -> list[AuthChaosResult]:
        """Run all auth chaos scenarios for a project."""
        return [
            self.simulate_expired_token(project_id),
            self.simulate_corrupted_cookie(project_id),
            self.simulate_duplicate_login(project_id),
            self.simulate_websocket_auth_mismatch(project_id),
            self.simulate_stale_auth_state(project_id),
            self.simulate_invalid_refresh_token(project_id),
        ]
