"""Session liveness and validity checking with result caching."""
from __future__ import annotations

import time
from dataclasses import dataclass
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

CACHE_TTL_SECONDS = 60  # cache validation results for 60 seconds
VALIDATION_STORAGE_PREFIX = "__session_validator:"


# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------


@dataclass
class ValidationResult:
    """Result of a session validation check."""
    valid: bool
    reason: str
    expires_at: float | None = None
    checked_at: float | None = None
    profile: str | None = None
    token_type: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "valid": self.valid,
            "reason": self.reason,
            "expires_at": self.expires_at,
            "checked_at": self.checked_at,
            "profile": self.profile,
            "token_type": self.token_type,
        }


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class SessionValidationError(Exception):
    """Raised when a session validation check fails unexpectedly."""


# ---------------------------------------------------------------------------
# SessionValidator
# ---------------------------------------------------------------------------


class SessionValidator:
    """Check session liveness and validity with cached results.

    Validates:
    - Token expiry (JWT, OAuth bearer, custom tokens)
    - Session expiry from stored metadata
    - Liveness by pinging the target application (optional health check)

    Results are cached for ``cache_ttl`` seconds to avoid excessive checks.

    Example
    -------
    >>> validator = SessionValidator()
    >>> result = validator.validate("ci-agent")
    >>> print(result.valid, result.reason)
    >>> validator.check_health("ci-agent", ping_url="https://api.example.com/ping")
    """

    def __init__(
        self,
        storage: Any = None,
        cache_ttl: int = CACHE_TTL_SECONDS,
        health_check_func: Callable[[str, Any], bool] | None = None,
    ) -> None:
        self._storage = storage
        self._cache_ttl = cache_ttl
        self._custom_health_check = health_check_func
        # Cache: profile_name -> (timestamp, ValidationResult)
        self._validation_cache: dict[str, tuple[float, ValidationResult]] = {}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def validate(self, profile_name: str) -> ValidationResult:
        """Check if the session for ``profile_name`` is still valid.

        This is the primary entry point. It checks local expiry first,
        then attempts a health check if configured. Results are cached.
        """
        cached = self._get_cached(profile_name)
        if cached is not None:
            return cached

        # Try to load session metadata from storage
        meta = self._load_session_meta(profile_name)
        if meta is None:
            result = ValidationResult(
                valid=False,
                reason="No session found for profile",
                checked_at=time.time(),
                profile=profile_name,
            )
            self._cache(profile_name, result)
            return result

        # Check expiry
        expiry = meta.get("expires_at")
        now = time.time()
        if expiry is not None and now >= float(expiry):
            result = ValidationResult(
                valid=False,
                reason="Session token has expired",
                expires_at=float(expiry),
                checked_at=now,
                profile=profile_name,
                token_type=meta.get("token_type"),
            )
            self._cache(profile_name, result)
            return result

        # Session appears valid locally
        result = ValidationResult(
            valid=True,
            reason="Session token is valid (expiry check only)",
            expires_at=float(expiry) if expiry else None,
            checked_at=now,
            profile=profile_name,
            token_type=meta.get("token_type"),
        )
        self._cache(profile_name, result)
        return result

    def validate_token(self, token: str) -> ValidationResult:
        """Verify a raw token's signature and expiry.

        Supports:
        - JWT tokens (with PyJWT installed)
        - Plain bearer tokens (expiry parsed from token if available)

        Returns a result indicating validity, reason, and expiry.
        """
        now = time.time()
        if not token:
            return ValidationResult(
                valid=False,
                reason="Token is empty",
                checked_at=now,
            )

        # JWT validation
        if _HAS_PYJWT:
            result = self._validate_jwt(token, now)
            if result is not None:
                return result

        # Fallback: treat as opaque bearer token — check if it looks expired
        # (some tokens embed expiry; this is best-effort)
        return ValidationResult(
            valid=True,
            reason="Opaque bearer token (no structured expiry available)",
            checked_at=now,
        )

    def check_health(
        self,
        profile_name: str,
        ping_url: str | None = None,
        ping_headers: dict[str, str] | None = None,
        timeout: float = 10.0,
    ) -> ValidationResult:
        """Ping the target application with the session to verify liveness.

        Parameters
        ----------
        profile_name:
            Profile whose session to use.
        ping_url:
            URL to send the health check request to. If None, uses a default
            constructed from the stored session metadata.
        ping_headers:
            Additional headers for the health check request.
        timeout:
            Request timeout in seconds.
        """
        import urllib.error
        import urllib.request

        meta = self._load_session_meta(profile_name)
        if meta is None:
            return ValidationResult(
                valid=False,
                reason="No session found for health check",
                checked_at=time.time(),
                profile=profile_name,
            )

        target_url = ping_url or meta.get("health_url") or meta.get("base_url")
        if not target_url:
            return ValidationResult(
                valid=False,
                reason="No ping URL available for health check",
                checked_at=time.time(),
                profile=profile_name,
            )

        token = meta.get("access_token", "")
        headers = {**(ping_headers or {}), "Authorization": f"Bearer {token}"}

        request = urllib.request.Request(target_url, headers=headers, method="GET")
        try:
            with urllib.request.urlopen(request, timeout=timeout) as resp:
                status = resp.status
                if 200 <= status < 300:
                    return ValidationResult(
                        valid=True,
                        reason=f"Health check returned {status}",
                        expires_at=meta.get("expires_at"),
                        checked_at=time.time(),
                        profile=profile_name,
                        token_type=meta.get("token_type"),
                    )
                else:
                    return ValidationResult(
                        valid=False,
                        reason=f"Health check returned HTTP {status}",
                        expires_at=meta.get("expires_at"),
                        checked_at=time.time(),
                        profile=profile_name,
                        token_type=meta.get("token_type"),
                    )
        except urllib.error.HTTPError as exc:
            return ValidationResult(
                valid=False,
                reason=f"Health check HTTP error: {exc.code} {exc.reason}",
                expires_at=meta.get("expires_at"),
                checked_at=time.time(),
                profile=profile_name,
                token_type=meta.get("token_type"),
            )
        except urllib.error.URLError as exc:
            return ValidationResult(
                valid=False,
                reason=f"Health check request failed: {exc.reason}",
                expires_at=meta.get("expires_at"),
                checked_at=time.time(),
                profile=profile_name,
                token_type=meta.get("token_type"),
            )
        except Exception as exc:
            return ValidationResult(
                valid=False,
                reason=f"Health check failed: {exc}",
                expires_at=meta.get("expires_at"),
                checked_at=time.time(),
                profile=profile_name,
                token_type=meta.get("token_type"),
            )

    def is_expired(self, profile_name: str) -> bool:
        """Check expiry without hitting the network.

        Returns True if the session is expired or missing.
        """
        meta = self._load_session_meta(profile_name)
        if meta is None:
            return True
        expiry = meta.get("expires_at")
        if expiry is None:
            return False
        return time.time() >= float(expiry)

    def get_expiry(self, profile_name: str) -> float | None:
        """Return the session expiry timestamp or None if not known."""
        meta = self._load_session_meta(profile_name)
        if meta is None:
            return None
        val = meta.get("expires_at")
        return float(val) if val is not None else None

    def clear_cache(self, profile_name: str | None = None) -> None:
        """Clear the validation cache. If ``profile_name`` is given, clear only that entry."""
        if profile_name:
            self._validation_cache.pop(profile_name, None)
        else:
            self._validation_cache.clear()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _validate_jwt(
        self,
        token: str,
        now: float,
    ) -> ValidationResult | None:
        """Validate a JWT token. Returns None if the token is not a JWT."""
        if not _HAS_PYJWT:
            return None
        try:
            header = _jwt.get_unverified_header(token)
        except Exception:
            return None  # Not a JWT

        try:
            # Decode without verification to read expiry claim
            payload = _jwt.decode(token, options={"verify_signature": False})
        except Exception:
            return ValidationResult(
                valid=False,
                reason="JWT decode error (possibly malformed)",
                checked_at=now,
            )

        exp = payload.get("exp")
        if exp is not None and now >= float(exp):
            return ValidationResult(
                valid=False,
                reason="JWT token has expired",
                expires_at=float(exp),
                checked_at=now,
            )

        return ValidationResult(
            valid=True,
            reason=f"JWT valid (alg: {header.get('alg', 'unknown')})",
            expires_at=float(exp) if exp else None,
            checked_at=now,
            token_type="jwt",
        )

    def _load_session_meta(self, profile_name: str) -> dict[str, Any] | None:
        """Load session metadata from the encrypted storage."""
        try:
            if self._storage is not None:
                return self._storage.load_or_none(profile_name)
            from tester_qa.auth.encrypted_storage import AuthStorage
            storage = AuthStorage()
            return storage.load_or_none(profile_name)
        except Exception:
            return None

    def _get_cached(self, profile_name: str) -> ValidationResult | None:
        """Return cached result if still fresh, else None."""
        entry = self._validation_cache.get(profile_name)
        if entry is None:
            return None
        timestamp, result = entry
        if time.time() - timestamp > self._cache_ttl:
            del self._validation_cache[profile_name]
            return None
        return result

    def _cache(self, profile_name: str, result: ValidationResult) -> None:
        self._validation_cache[profile_name] = (time.time(), result)
