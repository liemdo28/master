"""Automatic session key rotation with version history."""
from __future__ import annotations

import secrets
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from tester_qa.auth.encrypted_storage import AuthStorage, EncryptedStorageError


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

KEY_BYTES = 32  # 256-bit session keys
ROTATION_INTERVAL_SECONDS = 24 * 60 * 60  # 24 hours
ROTATION_STORAGE_KEY = "__session_rotator__"
DEFAULT_STORAGE_DIR = Path(".auth")


# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------


@dataclass
class KeyVersion:
    """A single version of a session key."""
    id: str
    created_at: str  # ISO-8601 UTC
    active: bool
    revoked: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "created_at": self.created_at,
            "active": self.active,
            "revoked": self.revoked,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> KeyVersion:
        return cls(
            id=data["id"],
            created_at=data["created_at"],
            active=data.get("active", True),
            revoked=data.get("revoked", False),
        )


@dataclass
class RotationState:
    """The complete rotation state for a profile."""
    current_key: str
    current_key_id: str
    created_at: str
    versions: list[KeyVersion] = field(default_factory=list)
    last_rotated_at: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "current_key": self.current_key,
            "current_key_id": self.current_key_id,
            "created_at": self.created_at,
            "last_rotated_at": self.last_rotated_at,
            "versions": [v.to_dict() for v in self.versions],
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> RotationState:
        return cls(
            current_key=data["current_key"],
            current_key_id=data["current_key_id"],
            created_at=data["created_at"],
            last_rotated_at=data.get("last_rotated_at"),
            versions=[KeyVersion.from_dict(v) for v in data.get("versions", [])],
        )


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class SessionRotatorError(Exception):
    """Base exception for session rotation operations."""


class ProfileNotFoundError(SessionRotatorError):
    """Raised when a profile has no rotation state."""


class KeyNotFoundError(SessionRotatorError):
    """Raised when a key version is not found."""


# ---------------------------------------------------------------------------
# SessionRotator
# ---------------------------------------------------------------------------


class SessionRotator:
    """Manage automatic session key rotation with version history.

    Each profile stores its rotation state (current key + history) in encrypted
    storage under a reserved key. Keys are rotated every 24 hours of active use
    (tracked via ``bump_activity``).

    Example
    -------
    >>> rotator = SessionRotator()
    >>> rotator.rotate("ci-agent")        # generate first key
    >>> rotator.get_active_key("ci-agent")
    >>> rotator.revoke("ci-agent", "key-abc")
    >>> rotator.get_rotation_status("ci-agent")
    """

    def __init__(
        self,
        storage: AuthStorage | None = None,
        rotation_interval: int = ROTATION_INTERVAL_SECONDS,
    ) -> None:
        self._storage = storage or AuthStorage()
        self._interval = rotation_interval
        self._active_profile: str | None = None  # track last used profile

    # ------------------------------------------------------------------
    # Core rotation API
    # ------------------------------------------------------------------

    def rotate(self, profile_name: str) -> KeyVersion:
        """Generate a new session key, invalidate the old one, and persist state.

        The old key version is moved to the history (still stored but marked inactive).
        """
        state = self._load_or_create_state(profile_name)

        # Mark current key as inactive
        for v in state.versions:
            if v.id == state.current_key_id:
                v.active = False

        # Generate new key
        new_key = secrets.token_hex(KEY_BYTES)
        new_id = f"key-{secrets.token_hex(8)}"
        now = self._now_iso()

        new_version = KeyVersion(
            id=new_id,
            created_at=now,
            active=True,
            revoked=False,
        )
        state.versions.append(new_version)
        state.current_key = new_key
        state.current_key_id = new_id
        state.last_rotated_at = now

        self._save_state(profile_name, state)
        return new_version

    def get_active_key(self, profile_name: str) -> str:
        """Return the current active key for ``profile_name``."""
        state = self._get_state(profile_name)
        return state.current_key

    def revoke(self, profile_name: str, key_id: str) -> bool:
        """Mark a specific key version as revoked.

        Returns True if the key was found and revoked.
        """
        state = self._get_state(profile_name)
        for version in state.versions:
            if version.id == key_id:
                version.revoked = True
                version.active = False
                self._save_state(profile_name, state)
                return True
        raise KeyNotFoundError(f"Key version '{key_id}' not found for profile '{profile_name}'")

    def get_rotation_status(self, profile_name: str) -> dict[str, Any]:
        """Return rotation metadata for the profile.

        Returns
        -------
        {
            "current_key_id": str,
            "versions_count": int,
            "last_rotated": str | None,   # ISO-8601
            "active_key_count": int,
            "revoked_count": int,
        }
        """
        try:
            state = self._get_state(profile_name)
        except ProfileNotFoundError:
            return {
                "current_key_id": None,
                "versions_count": 0,
                "last_rotated": None,
                "active_key_count": 0,
                "revoked_count": 0,
            }
        return {
            "current_key_id": state.current_key_id,
            "versions_count": len(state.versions),
            "last_rotated": state.last_rotated_at,
            "active_key_count": sum(1 for v in state.versions if v.active),
            "revoked_count": sum(1 for v in state.versions if v.revoked),
        }

    def should_rotate(self, profile_name: str) -> bool:
        """Return True if the active key has passed its rotation interval."""
        try:
            state = self._get_state(profile_name)
        except ProfileNotFoundError:
            return False  # No state means no rotation needed yet

        if not state.last_rotated_at:
            return False
        try:
            from datetime import datetime
            last = datetime.fromisoformat(state.last_rotated_at)
            elapsed = (datetime.now(timezone.utc) - last).total_seconds()
            return elapsed >= self._interval
        except Exception:
            return False

    def auto_rotate_if_needed(self, profile_name: str) -> KeyVersion | None:
        """Rotate only if the interval has elapsed. Returns the new KeyVersion or None."""
        if self.should_rotate(profile_name):
            return self.rotate(profile_name)
        return None

    def bump_activity(self, profile_name: str) -> None:
        """Mark the profile as recently active (used for rotation tracking)."""
        self._active_profile = profile_name

    # ------------------------------------------------------------------
    # State persistence
    # ------------------------------------------------------------------

    def _state_key(self, profile_name: str) -> str:
        """Storage key for the rotation state of a profile."""
        return f"__rotator:{profile_name}__"

    def _load_or_create_state(self, profile_name: str) -> RotationState:
        """Load existing rotation state or create a fresh one with a first key."""
        state_key = self._state_key(profile_name)
        stored = self._storage.load_or_none(state_key)
        if stored:
            return RotationState.from_dict(stored)

        # First key for this profile
        key = secrets.token_hex(KEY_BYTES)
        key_id = f"key-{secrets.token_hex(8)}"
        now = self._now_iso()
        initial_version = KeyVersion(id=key_id, created_at=now, active=True)
        return RotationState(
            current_key=key,
            current_key_id=key_id,
            created_at=now,
            versions=[initial_version],
        )

    def _get_state(self, profile_name: str) -> RotationState:
        """Load rotation state, raising if the profile has no rotation record."""
        stored = self._storage.load_or_none(self._state_key(profile_name))
        if not stored:
            raise ProfileNotFoundError(
                f"No rotation state found for profile '{profile_name}'. "
                "Call rotate() first to initialize."
            )
        return RotationState.from_dict(stored)

    def _save_state(self, profile_name: str, state: RotationState) -> None:
        """Persist rotation state to encrypted storage."""
        self._storage.save(self._state_key(profile_name), state.to_dict())

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _now_iso() -> str:
        return datetime.now(timezone.utc).isoformat()
