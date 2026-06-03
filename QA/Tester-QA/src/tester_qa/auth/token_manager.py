"""Token lifecycle management — refresh, validate, rotate."""
from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


@dataclass
class TokenEntry:
    project_id: str
    token_type: str  # bearer | api-key | jwt | session
    token_value: str
    expires_at: float | None = None  # unix timestamp
    refresh_token: str | None = None
    created_at: str | None = None

    @property
    def is_expired(self) -> bool:
        if self.expires_at is None:
            return False
        return time.time() > self.expires_at

    @property
    def expires_in_seconds(self) -> float | None:
        if self.expires_at is None:
            return None
        return max(0, self.expires_at - time.time())

    def to_dict(self) -> dict[str, Any]:
        return {
            "project_id": self.project_id,
            "token_type": self.token_type,
            "token_value": "***REDACTED***",  # Never serialize actual token
            "expires_at": self.expires_at,
            "has_refresh_token": self.refresh_token is not None,
            "created_at": self.created_at,
            "is_expired": self.is_expired,
        }


class TokenManager:
    """Manage authentication tokens across projects.

    Tokens are stored in memory only during runtime.
    Persistent storage uses the SessionStore encryption.
    """

    def __init__(self) -> None:
        self._tokens: dict[str, TokenEntry] = {}

    def store_token(
        self,
        project_id: str,
        token_value: str,
        token_type: str = "bearer",
        expires_at: float | None = None,
        refresh_token: str | None = None,
    ) -> TokenEntry:
        """Store a token for a project."""
        entry = TokenEntry(
            project_id=project_id,
            token_type=token_type,
            token_value=token_value,
            expires_at=expires_at,
            refresh_token=refresh_token,
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        self._tokens[project_id] = entry
        return entry

    def get_token(self, project_id: str) -> str | None:
        """Get the current token value for a project."""
        entry = self._tokens.get(project_id)
        if entry is None:
            return None
        if entry.is_expired:
            return None
        return entry.token_value

    def get_auth_header(self, project_id: str) -> dict[str, str]:
        """Get authorization header dict for a project."""
        entry = self._tokens.get(project_id)
        if entry is None or entry.is_expired:
            return {}

        if entry.token_type == "bearer":
            return {"Authorization": f"Bearer {entry.token_value}"}
        elif entry.token_type == "api-key":
            return {"X-API-Key": entry.token_value}
        else:
            return {"Authorization": entry.token_value}

    def is_valid(self, project_id: str) -> bool:
        """Check if a project has a valid (non-expired) token."""
        entry = self._tokens.get(project_id)
        return entry is not None and not entry.is_expired

    def needs_refresh(self, project_id: str, threshold_seconds: float = 300) -> bool:
        """Check if token needs refresh (within threshold of expiry)."""
        entry = self._tokens.get(project_id)
        if entry is None:
            return True
        if entry.expires_at is None:
            return False
        remaining = entry.expires_at - time.time()
        return remaining < threshold_seconds

    def get_refresh_token(self, project_id: str) -> str | None:
        """Get the refresh token for a project."""
        entry = self._tokens.get(project_id)
        if entry:
            return entry.refresh_token
        return None

    def invalidate(self, project_id: str) -> bool:
        """Invalidate/remove a token."""
        if project_id in self._tokens:
            del self._tokens[project_id]
            return True
        return False

    def invalidate_all(self) -> int:
        """Invalidate all tokens. Returns count of removed tokens."""
        count = len(self._tokens)
        self._tokens.clear()
        return count

    def list_tokens(self) -> list[dict[str, Any]]:
        """List all tokens (redacted). For status display only."""
        return [entry.to_dict() for entry in self._tokens.values()]

    def from_env(self, project_id: str, env_var: str | None = None) -> str | None:
        """Load token from environment variable."""
        if env_var:
            token = os.environ.get(env_var)
        else:
            # Try common patterns
            prefix = project_id.upper().replace("-", "_")
            token = (
                os.environ.get(f"{prefix}_TOKEN")
                or os.environ.get(f"{prefix}_API_KEY")
                or os.environ.get("TESTER_QA_TOKEN")
            )

        if token:
            self.store_token(project_id, token, token_type="bearer")
        return token
