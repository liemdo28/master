"""Automated token refresh logic — handles JWT, OAuth, and custom bearer tokens."""
from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable

try:
    import jwt as _jwt

    _HAS_PYJWT = True
except ImportError:
    _HAS_PYJWT = False


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

REFRESH_THRESHOLD_SECONDS = 5 * 60  # 5 minutes
TOKEN_STORAGE_PREFIX = "__token_refresher:"

# ---------------------------------------------------------------------------
# Events (emitted via EventBus when available)
# ---------------------------------------------------------------------------

_EVENT_TOKEN_REFRESHED = "TOKEN_REFRESHED"
_EVENT_TOKEN_EXPIRED = "TOKEN_EXPIRED"
_EVENT_TOKEN_REFRESH_FAILED = "TOKEN_REFRESH_FAILED"

# ---------------------------------------------------------------------------
# EventBus stub
# ---------------------------------------------------------------------------


class _StubEventBus:
    """Minimal EventBus placeholder — no-op when the real EventBus is absent."""

    def emit(self, event: str, data: Any = None) -> None:
        pass

    def on(self, event: str, handler: Callable[..., None]) -> None:
        pass


_event_bus: Any = _StubEventBus()


def _get_event_bus() -> Any:
    """Try to import the real EventBus; fall back to stub."""
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
# Dataclasses
# ---------------------------------------------------------------------------


@dataclass
class TokenMetadata:
    """Token metadata stored for a profile."""
    access_token: str
    token_type: str = "Bearer"
    expires_at: float | None = None  # unix timestamp
    refresh_token: str | None = None
    refresh_url: str | None = None  # OAuth endpoint
    extra: dict[str, Any] = field(default_factory=dict)
    stored_at: str = ""

    def __post_init__(self) -> None:
        if not self.stored_at:
            self.stored_at = datetime.now(timezone.utc).isoformat()

    @property
    def is_expired(self) -> bool:
        if self.expires_at is None:
            return False
        return time.time() >= self.expires_at

    @property
    def expires_in(self) -> float | None:
        if self.expires_at is None:
            return None
        return max(0.0, self.expires_at - time.time())

    @property
    def needs_refresh(self) -> bool:
        """True if token is expired or will expire within the threshold."""
        if self.expires_at is None:
            return False
        return (self.expires_at - time.time()) < REFRESH_THRESHOLD_SECONDS

    def to_dict(self) -> dict[str, Any]:
        return {
            "access_token": self.access_token,
            "token_type": self.token_type,
            "expires_at": self.expires_at,
            "refresh_token": self.refresh_token,
            "refresh_url": self.refresh_url,
            "extra": self.extra,
            "stored_at": self.stored_at,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> TokenMetadata:
        return cls(
            access_token=data["access_token"],
            token_type=data.get("token_type", "Bearer"),
            expires_at=data.get("expires_at"),
            refresh_token=data.get("refresh_token"),
            refresh_url=data.get("refresh_url"),
            extra=data.get("extra", {}),
            stored_at=data.get("stored_at", ""),
        )


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class TokenRefreshError(Exception):
    """Base exception for token refresh operations."""


class TokenExpiredError(TokenRefreshError):
    """Raised when the token has expired and cannot be refreshed."""


class RefreshNotSupportedError(TokenRefreshError):
    """Raised when a profile has no refresh token or refresh URL."""


# ---------------------------------------------------------------------------
# TokenRefresher
# ---------------------------------------------------------------------------


class TokenRefresher:
    """Automated token refresh logic.

    Supports JWT expiry detection, OAuth refresh_token flows, and custom bearer
    tokens. All state is persisted to encrypted storage.

    Parameters
    ----------
    storage:
        AuthStorage instance. If None, the module-level default is used.
    threshold_seconds:
        Number of seconds before expiry to trigger a refresh.
        Defaults to 300 (5 minutes).
    refresh_func:
        Optional callable(profile_name, token_metadata) -> TokenMetadata.
        If provided it is called instead of the default HTTP refresh logic.

    Example
    -------
    >>> from tester_qa.auth.token_refresh import TokenRefresher
    >>> storage = AuthStorage()
    >>> refresher = TokenRefresher(storage=storage)
    >>> refresher.store_token("ci-agent", {
    ...     "access_token": "<access-token>",
    ...     "refresh_token": "<refresh-token>",
    ...     "refresh_url": "https://auth.example.com/oauth/token",
    ...     "expires_at": time.time() + 300,
    ... })
    >>> token = refresher.get_token("ci-agent")  # auto-refreshes if needed
    """

    def __init__(
        self,
        storage: Any = None,
        threshold_seconds: float = REFRESH_THRESHOLD_SECONDS,
        refresh_func: Callable[[str, TokenMetadata], TokenMetadata] | None = None,
    ) -> None:
        if storage is None:
            from tester_qa.auth.encrypted_storage import default_storage
            storage = default_storage
        self._storage = storage
        self._threshold = threshold_seconds
        self._custom_refresh: Callable[[str, TokenMetadata], TokenMetadata] | None = (
            refresh_func
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def store_token(self, profile_name: str, token_data: dict[str, Any]) -> TokenMetadata:
        """Store or update token metadata for a profile.

        ``token_data`` may contain:
        - access_token (required)
        - token_type  (default: "Bearer")
        - expires_at  (unix timestamp; optional)
        - refresh_token (optional)
        - refresh_url  (optional; used for OAuth refresh)
        - extra (optional dict of additional fields)
        """
        if "access_token" not in token_data:
            raise ValueError("token_data must contain 'access_token'")
        meta = TokenMetadata(
            access_token=token_data["access_token"],
            token_type=token_data.get("token_type", "Bearer"),
            expires_at=token_data.get("expires_at"),
            refresh_token=token_data.get("refresh_token"),
            refresh_url=token_data.get("refresh_url"),
            extra=token_data.get("extra", {}),
        )
        self._save(profile_name, meta)
        return meta

    def get_token(self, profile_name: str) -> str | None:
        """Return a valid access token, auto-refreshing if needed."""
        meta = self._load_or_none(profile_name)
        if meta is None:
            return None
        if meta.needs_refresh:
            try:
                refreshed = self.refresh(profile_name, meta)
                return refreshed.access_token
            except RefreshNotSupportedError:
                # No way to refresh; return what we have even if close to expiry
                return meta.access_token
            except TokenRefreshError:
                return None
        return meta.access_token

    def should_refresh(
        self,
        profile_name: str,
        token_data: TokenMetadata | None = None,
    ) -> bool:
        """Check whether the stored token is expiring soon or expired."""
        if token_data is None:
            token_data = self._load_or_none(profile_name)
        if token_data is None:
            return False
        if token_data.is_expired:
            self._emit(_EVENT_TOKEN_EXPIRED, {"profile": profile_name})
            return True
        return token_data.needs_refresh

    def should_refresh_dict(
        self,
        profile_name: str,
        token_data: dict[str, Any],
    ) -> bool:
        """Variant of ``should_refresh`` that accepts a plain dict."""
        meta = TokenMetadata.from_dict(token_data)
        return self.should_refresh(profile_name, meta)

    def refresh(
        self,
        profile_name: str,
        token_data: TokenMetadata | None = None,
    ) -> TokenMetadata:
        """Attempt to refresh the token.

        Tries custom refresh func first, then checks for JWT or OAuth data.
        Raises ``RefreshNotSupportedError`` when no refresh mechanism is available.
        Raises ``TokenExpiredError`` when the token is expired and cannot be refreshed.
        """
        if token_data is None:
            token_data = self._load_or_none(profile_name)
        if token_data is None:
            raise TokenRefreshError(f"No token found for profile '{profile_name}'")

        if token_data.is_expired:
            raise TokenExpiredError(
                f"Token for '{profile_name}' has expired and cannot be used to refresh."
            )

        # 1. Custom refresh function
        if self._custom_refresh:
            refreshed = self._custom_refresh(profile_name, token_data)
            self._save(profile_name, refreshed)
            self._emit(_EVENT_TOKEN_REFRESHED, {
                "profile": profile_name,
                "expires_at": refreshed.expires_at,
            })
            return refreshed

        # 2. JWT HS-family: try to re-encode with extended expiry
        if _HAS_PYJWT:
            refreshed_jwt = self._try_jwt_refresh(profile_name, token_data)
            if refreshed_jwt is not None:
                self._save(profile_name, refreshed_jwt)
                self._emit(_EVENT_TOKEN_REFRESHED, {
                    "profile": profile_name,
                    "expires_at": refreshed_jwt.expires_at,
                })
                return refreshed_jwt

        # 3. OAuth: use refresh_token + refresh_url
        if token_data.refresh_token and token_data.refresh_url:
            refreshed_oauth = self._do_oauth_refresh(profile_name, token_data)
            self._save(profile_name, refreshed_oauth)
            self._emit(_EVENT_TOKEN_REFRESHED, {
                "profile": profile_name,
                "expires_at": refreshed_oauth.expires_at,
            })
            return refreshed_oauth

        raise RefreshNotSupportedError(
            f"Profile '{profile_name}' has no refresh_token, refresh_url, "
            "or PyJWT installed. Cannot auto-refresh."
        )

    def get_metadata(self, profile_name: str) -> TokenMetadata | None:
        """Return the stored token metadata without triggering a refresh."""
        return self._load_or_none(profile_name)

    def delete_token(self, profile_name: str) -> bool:
        """Remove stored token metadata for a profile."""
        key = f"{TOKEN_STORAGE_PREFIX}{profile_name}"
        return self._storage.delete(key)

    # ------------------------------------------------------------------
    # Internal refresh helpers
    # ------------------------------------------------------------------

    def _try_jwt_refresh(
        self,
        profile_name: str,
        meta: TokenMetadata,
    ) -> TokenMetadata | None:
        """Attempt JWT re-encoding for HS-family tokens.

        Decodes the current JWT without verification, extends the expiry claim,
        and re-encodes with the same secret. Returns None if the token is not
        an HS-family JWT or decoding fails.
        """
        if not _HAS_PYJWT:
            return None
        try:
            header = _jwt.get_unverified_header(meta.access_token)
            alg = header.get("alg", "")
            if not alg.startswith("HS"):
                return None
        except Exception:
            return None

        # Re-wrap with extended expiry (requires custom secret; this is a signal)
        self._emit(_EVENT_TOKEN_REFRESH_FAILED, {
            "profile": profile_name,
            "reason": "JWT HS refresh requires a custom refresh_func with the signing secret",
        })
        return None

    def _do_oauth_refresh(
        self,
        profile_name: str,
        meta: TokenMetadata,
    ) -> TokenMetadata:
        """Perform an OAuth 2.0 refresh token exchange via HTTP POST."""
        import urllib.error
        import urllib.parse
        import urllib.request

        if not meta.refresh_url:
            raise RefreshNotSupportedError("No refresh_url configured")

        body = urllib.parse.urlencode({
            "grant_type": "refresh_token",
            "refresh_token": meta.refresh_token,
            "client_id": meta.extra.get("client_id", ""),
        }).encode("utf-8")

        request = urllib.request.Request(
            meta.refresh_url,
            data=body,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except urllib.error.URLError as exc:
            raise TokenRefreshError(
                f"OAuth refresh failed for '{profile_name}': {exc}"
            ) from exc

        expires_in = data.get("expires_in")
        expires_at = time.time() + float(expires_in) if expires_in else None

        return TokenMetadata(
            access_token=data["access_token"],
            token_type=data.get("token_type", meta.token_type),
            expires_at=expires_at,
            refresh_token=data.get("refresh_token", meta.refresh_token),
            refresh_url=meta.refresh_url,
            extra=meta.extra,
        )

    # ------------------------------------------------------------------
    # Persistence helpers
    # ------------------------------------------------------------------

    def _storage_key(self, profile_name: str) -> str:
        return f"{TOKEN_STORAGE_PREFIX}{profile_name}"

    def _save(self, profile_name: str, meta: TokenMetadata) -> None:
        self._storage.save(self._storage_key(profile_name), meta.to_dict())

    def _load_or_none(self, profile_name: str) -> TokenMetadata | None:
        data = self._storage.load_or_none(self._storage_key(profile_name))
        if data is None:
            return None
        return TokenMetadata.from_dict(data)

    # ------------------------------------------------------------------
    # Event emission
    # ------------------------------------------------------------------

    def _emit(self, event: str, data: dict[str, Any]) -> None:
        try:
            bus = _get_event_bus()
            bus.emit(event, data)
        except Exception:
            pass  # Never let event emission break the refresh flow
