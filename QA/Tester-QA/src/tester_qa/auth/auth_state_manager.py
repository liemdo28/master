"""Unified auth state orchestration — integrates all auth hardening modules."""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from tester_qa.auth.encrypted_storage import AuthStorage
from tester_qa.auth.session_rotator import SessionRotator
from tester_qa.auth.token_refresh import TokenMetadata, TokenRefresher
from tester_qa.auth.session_validator import SessionValidator, ValidationResult


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

STATE_STORAGE_KEY = "__auth_state_manager:profiles__"
SESSION_META_PREFIX = "__asm_session:"

# ---------------------------------------------------------------------------
# Events
# ---------------------------------------------------------------------------

_EVENT_AUTH_LOGIN = "AUTH_LOGIN"
_EVENT_AUTH_LOGOUT = "AUTH_LOGOUT"
_EVENT_AUTH_REFRESHED = "AUTH_REFRESHED"
_EVENT_AUTH_EXPIRED = "AUTH_EXPIRED"
_EVENT_AUTH_INVALID = "AUTH_INVALID"
_EVENT_AUTH_ROTATED = "AUTH_ROTATED"

# ---------------------------------------------------------------------------
# EventBus stub
# ---------------------------------------------------------------------------


class _StubEventBus:
    """No-op EventBus placeholder."""

    def emit(self, event: str, data: Any = None) -> None:
        pass

    def on(self, event: str, handler: Callable[..., None]) -> None:
        pass


_event_bus: Any = _StubEventBus()


def _get_event_bus() -> Any:
    global _event_bus
    if not isinstance(_event_bus, _StubEventBus):
        return _event_bus
    try:
        from tester_qa.core.events import EventBus
        _event_bus = EventBus()
    except ImportError:
        pass
    return _event_bus


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class AuthStateError(Exception):
    """Base exception for auth state management."""


class LoginError(AuthStateError):
    """Raised when login fails."""


class RestoreError(AuthStateError):
    """Raised when session restoration fails."""


class SessionExpiredError(AuthStateError):
    """Raised when a session has expired."""


# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------


@dataclass
class SessionInfo:
    """In-memory session information for a profile."""
    profile_name: str
    authenticated_at: str  # ISO-8601 UTC
    expires_at: float | None = None
    last_validated_at: float | None = None
    session_key: str | None = None
    token_metadata: dict[str, Any] | None = None
    valid: bool = True
    status: str = "active"  # active | expired | invalid | refreshing
    extra: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "profile_name": self.profile_name,
            "authenticated_at": self.authenticated_at,
            "expires_at": self.expires_at,
            "last_validated_at": self.last_validated_at,
            "session_key": self.session_key,
            "token_metadata": self.token_metadata,
            "valid": self.valid,
            "status": self.status,
            "extra": self.extra,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> SessionInfo:
        return cls(
            profile_name=data["profile_name"],
            authenticated_at=data["authenticated_at"],
            expires_at=data.get("expires_at"),
            last_validated_at=data.get("last_validated_at"),
            session_key=data.get("session_key"),
            token_metadata=data.get("token_metadata"),
            valid=data.get("valid", True),
            status=data.get("status", "active"),
            extra=data.get("extra", {}),
        )


# ---------------------------------------------------------------------------
# AuthStateManager
# ---------------------------------------------------------------------------


class AuthStateManager:
    """Unified auth state orchestration.

    Combines ``AuthStorage``, ``SessionRotator``, ``TokenRefresher``, and
    ``SessionValidator`` into a single interface.  This is the recommended
    entry point for most use-cases.

    The manager is a **singleton** — all instances share the same underlying
    modules and storage.

    Parameters
    ----------
    auth_dir:
        Path to the ``.auth`` directory. Defaults to ``.auth``.
    auto_rotate:
        Automatically rotate session keys when the rotation interval elapses.
        Defaults to True.
    login_func:
        Optional async/sync callable(profile_name, credentials) -> dict.
        If provided it is called during ``login()`` to perform the actual
        authentication (e.g., HTTP login call). The dict should contain
        ``access_token`` and optionally ``expires_at``, ``refresh_token``, etc.

    Example
    -------
    >>> from tester_qa.auth.auth_state_manager import AuthStateManager
    >>> manager = AuthStateManager()
    >>> manager.login("ci-agent", {"username": "<username>", "password": "<password>"})
    >>> session = manager.get_session("ci-agent")
    >>> manager.health_check("ci-agent")
    >>> manager.logout("ci-agent")
    """

    _instance: "AuthStateManager | None" = None

    def __init__(
        self,
        auth_dir: Path | str = Path(".auth"),
        auto_rotate: bool = True,
        login_func: Callable[[str, dict[str, str]], dict[str, Any]] | None = None,
    ) -> None:
        if AuthStateManager._instance is not None:
            # Re-use the singleton
            self.__dict__.update(AuthStateManager._instance.__dict__)
            return
        AuthStateManager._instance = self

        self._storage = AuthStorage(auth_dir=auth_dir)
        self._rotator = SessionRotator(storage=self._storage)
        self._refresher = TokenRefresher(storage=self._storage)
        self._validator = SessionValidator(storage=self._storage)
        self._auto_rotate = auto_rotate
        self._login_func = login_func
        # In-memory session cache (complements encrypted storage)
        self._sessions: dict[str, SessionInfo] = {}

    # ==================================================================
    # Login / Logout / Restore
    # ==================================================================

    def login(
        self,
        profile_name: str,
        credentials: dict[str, str],
    ) -> SessionInfo:
        """Perform a full login flow for a profile.

        Steps:
        1. Authenticate (via ``login_func`` or env credentials)
        2. Encrypt and persist session state
        3. Initialize session key rotation
        4. Store token metadata
        5. Emit ``AUTH_LOGIN`` event
        """
        # Step 1: authenticate
        auth_data = self._authenticate(profile_name, credentials)

        # Step 2: build session info — initialize rotation if needed
        now_iso = datetime.now(timezone.utc).isoformat()
        self._rotator.rotate(profile_name)
        session_key = self._rotator.get_active_key(profile_name)

        session = SessionInfo(
            profile_name=profile_name,
            authenticated_at=now_iso,
            expires_at=auth_data.get("expires_at"),
            session_key=session_key,
            token_metadata={
                "access_token": auth_data.get("access_token", ""),
                "refresh_token": auth_data.get("refresh_token"),
                "expires_at": auth_data.get("expires_at"),
                "token_type": auth_data.get("token_type", "Bearer"),
                "refresh_url": auth_data.get("refresh_url"),
            },
            valid=True,
            status="active",
            extra=auth_data.get("extra", {}),
        )

        # Step 3: persist to encrypted storage
        self._storage.save(profile_name, session.to_dict())

        # Step 4: store token metadata for auto-refresh
        self._refresher.store_token(profile_name, session.token_metadata or {})

        # Step 5: cache in-memory
        self._sessions[profile_name] = session

        self._emit(_EVENT_AUTH_LOGIN, {
            "profile": profile_name,
            "expires_at": session.expires_at,
        })
        return session

    def restore(self, profile_name: str) -> SessionInfo:
        """Restore a session from encrypted storage, validate it, and refresh if needed.

        Returns the restored ``SessionInfo``. Raises ``RestoreError`` if the
        profile does not exist or is invalid.
        """
        data = self._storage.load_or_none(profile_name)
        if data is None:
            raise RestoreError(
                f"No auth state found for profile '{profile_name}'. "
                "Call login() first."
            )

        session = SessionInfo.from_dict(data)
        session.last_validated_at = time.time()

        # Validate expiry
        if session.expires_at is not None and time.time() >= session.expires_at:
            session.valid = False
            session.status = "expired"
            self._emit(_EVENT_AUTH_EXPIRED, {"profile": profile_name})
            raise SessionExpiredError(
                f"Session for '{profile_name}' has expired. Re-login required."
            )

        # Auto-refresh token if needed
        refreshed = False
        if session.token_metadata:
            meta = TokenMetadata.from_dict(session.token_metadata)
            if self._refresher.should_refresh(profile_name, meta):
                try:
                    new_meta = self._refresher.refresh(profile_name, meta)
                    session.token_metadata = new_meta.to_dict()
                    session.expires_at = new_meta.expires_at
                    refreshed = True
                except Exception:
                    pass  # Non-fatal; return session as-is

        # Refresh session key if rotation is due
        if self._auto_rotate:
            new_version = self._rotator.auto_rotate_if_needed(profile_name)
            if new_version:
                session.session_key = self._rotator.get_active_key(profile_name)
                self._emit(_EVENT_AUTH_ROTATED, {
                    "profile": profile_name,
                    "key_id": new_version.id,
                })

        # Re-persist updated state
        self._storage.save(profile_name, session.to_dict())
        session.valid = True
        session.status = "refreshing" if refreshed else "active"
        self._sessions[profile_name] = session

        if refreshed:
            self._emit(_EVENT_AUTH_REFRESHED, {
                "profile": profile_name,
                "expires_at": session.expires_at,
            })

        return session

    def logout(self, profile_name: str) -> bool:
        """Clear all stored auth state for a profile.

        Removes: encrypted storage, rotation state, token metadata, and
        in-memory session. Emits ``AUTH_LOGOUT``.
        """
        # Revoke all key versions
        try:
            status = self._rotator.get_rotation_status(profile_name)
            for _ in range(status.get("versions_count", 0)):
                pass  # keys are encrypted with profile; delete is sufficient
        except Exception:
            pass

        # Delete from storage (profile key + rotation key)
        self._storage.delete(profile_name)
        self._rotator._storage.delete(f"__rotator:{profile_name}__")  # noqa: SLF001
        self._refresher.delete_token(profile_name)
        self._sessions.pop(profile_name, None)

        self._emit(_EVENT_AUTH_LOGOUT, {"profile": profile_name})
        return True

    # ==================================================================
    # Session accessors
    # ==================================================================

    def get_session(self, profile_name: str) -> SessionInfo | None:
        """Return the current session for a profile, or None if not authenticated.

        If the session is expired or missing from memory, this attempts to restore
        it from storage first.
        """
        # Check in-memory cache first
        cached = self._sessions.get(profile_name)
        if cached is not None:
            if cached.expires_at is not None and time.time() >= cached.expires_at:
                cached.valid = False
                cached.status = "expired"
                self._emit(_EVENT_AUTH_EXPIRED, {"profile": profile_name})
                return None
            return cached

        # Try to restore from encrypted storage
        try:
            return self.restore(profile_name)
        except (RestoreError, SessionExpiredError):
            return None

    def get_token(self, profile_name: str) -> str | None:
        """Return a valid access token for the profile, auto-refreshing if needed."""
        session = self.get_session(profile_name)
        if session is None:
            return None
        if session.token_metadata:
            meta = TokenMetadata.from_dict(session.token_metadata)
            return self._refresher.get_token(profile_name) or meta.access_token
        return None

    def get_auth_header(self, profile_name: str) -> dict[str, str]:
        """Return an Authorization header dict for the profile."""
        token = self.get_token(profile_name)
        if not token:
            return {}
        session = self._sessions.get(profile_name)
        token_type = session.token_metadata.get("token_type", "Bearer") if session else "Bearer"
        return {"Authorization": f"{token_type} {token}"}

    # ==================================================================
    # Health check
    # ==================================================================

    def health_check(
        self,
        profile_name: str,
        ping_url: str | None = None,
        timeout: float = 10.0,
    ) -> dict[str, Any]:
        """Validate the session, attempt refresh if needed, and report status.

        Returns a detailed status dict:
        {
            "profile": str,
            "valid": bool,
            "status": str,
            "expires_at": float | None,
            "rotation_status": dict,
            "validation": ValidationResult,
        }
        """
        result: dict[str, Any] = {
            "profile": profile_name,
            "valid": False,
            "status": "unknown",
            "expires_at": None,
            "rotation_status": {},
            "validation": {},
        }

        # Try to restore / get session
        try:
            session = self.restore(profile_name)
            result["valid"] = session.valid
            result["status"] = session.status
            result["expires_at"] = session.expires_at
        except SessionExpiredError:
            result["status"] = "expired"
            self._emit(_EVENT_AUTH_EXPIRED, {"profile": profile_name})
            return result
        except RestoreError:
            result["status"] = "not_found"
            return result

        # Validate session (local + optional network check)
        validation = self._validator.validate(profile_name)
        result["validation"] = validation.to_dict()
        if not validation.valid:
            result["valid"] = False
            result["status"] = "invalid"
            self._emit(_EVENT_AUTH_INVALID, {"profile": profile_name})
            return result

        # Rotation status
        result["rotation_status"] = self._rotator.get_rotation_status(profile_name)

        return result

    # ==================================================================
    # Active profiles
    # ==================================================================

    def list_active_profiles(self) -> list[str]:
        """Return profiles that have an encrypted storage file."""
        return self._storage.list_profiles()

    # ==================================================================
    # Event helpers
    # ==================================================================

    def _emit(self, event: str, data: dict[str, Any]) -> None:
        try:
            bus = _get_event_bus()
            bus.emit(event, data)
        except Exception:
            pass  # Never let event failures break the auth flow

    def _authenticate(
        self,
        profile_name: str,
        credentials: dict[str, str],
    ) -> dict[str, Any]:
        """Run the authentication step.

        Uses ``login_func`` if provided. Otherwise, tries to load credentials
        from environment variables (``TESTER_QA_USERNAME``, ``TESTER_QA_PASSWORD``).
        """
        if self._login_func:
            result = self._login_func(profile_name, credentials)
            if not isinstance(result, dict):
                raise LoginError(
                    f"login_func returned {type(result).__name__}, expected dict"
                )
            return result

        # Env-based fallback
        import os
        username = credentials.get("username") or os.environ.get("TESTER_QA_USERNAME")
        password = credentials.get("password") or os.environ.get("TESTER_QA_PASSWORD")
        if not username or not password:
            raise LoginError(
                "No credentials available. Set TESTER_QA_USERNAME and "
                "TESTER_QA_PASSWORD, or provide a login_func."
            )
        # Return a minimal auth result — callers should provide login_func for real auth
        return {
            "access_token": f"env-token-{username}",
            "expires_at": time.time() + 3600,
            "token_type": "Bearer",
        }
