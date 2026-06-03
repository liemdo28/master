"""Authentication management for multi-project testing."""
from __future__ import annotations

from tester_qa.auth.session_store import SessionStore
from tester_qa.auth.credential_vault import CredentialVault
from tester_qa.auth.auth_profiles import AuthProfile, AuthProfileManager
from tester_qa.auth.token_manager import TokenManager

# Auth hardening modules
from tester_qa.auth.encrypted_storage import (
    AuthStorage,
    EncryptedStorageError,
    DecryptionError,
    ProfileNotFoundError as EncryptedProfileNotFoundError,
    default_storage,
)
from tester_qa.auth.session_rotator import (
    SessionRotator,
    KeyVersion,
    RotationState,
    SessionRotatorError,
    ProfileNotFoundError as RotatorProfileNotFoundError,
    KeyNotFoundError,
)
from tester_qa.auth.token_refresh import (
    TokenRefresher,
    TokenMetadata,
    TokenRefreshError,
    TokenExpiredError,
    RefreshNotSupportedError,
    REFRESH_THRESHOLD_SECONDS,
    _EVENT_TOKEN_REFRESHED,
    _EVENT_TOKEN_EXPIRED,
)
from tester_qa.auth.session_validator import (
    SessionValidator,
    ValidationResult,
    SessionValidationError,
    CACHE_TTL_SECONDS,
)
from tester_qa.auth.auth_state_manager import (
    AuthStateManager,
    SessionInfo,
    AuthStateError,
    LoginError,
    RestoreError,
    SessionExpiredError as ASMExpiredError,
    _EVENT_AUTH_LOGIN,
    _EVENT_AUTH_LOGOUT,
    _EVENT_AUTH_REFRESHED,
    _EVENT_AUTH_EXPIRED,
    _EVENT_AUTH_INVALID,
    _EVENT_AUTH_ROTATED,
)

__all__ = [
    # Original
    "SessionStore",
    "CredentialVault",
    "AuthProfile",
    "AuthProfileManager",
    "TokenManager",
    # encrypted_storage
    "AuthStorage",
    "EncryptedStorageError",
    "DecryptionError",
    "EncryptedProfileNotFoundError",
    "default_storage",
    # session_rotator
    "SessionRotator",
    "KeyVersion",
    "RotationState",
    "SessionRotatorError",
    "RotatorProfileNotFoundError",
    "KeyNotFoundError",
    # token_refresh
    "TokenRefresher",
    "TokenMetadata",
    "TokenRefreshError",
    "TokenExpiredError",
    "RefreshNotSupportedError",
    "REFRESH_THRESHOLD_SECONDS",
    # token_refresh events
    "_EVENT_TOKEN_REFRESHED",
    "_EVENT_TOKEN_EXPIRED",
    # session_validator
    "SessionValidator",
    "ValidationResult",
    "SessionValidationError",
    "CACHE_TTL_SECONDS",
    # auth_state_manager
    "AuthStateManager",
    "SessionInfo",
    "AuthStateError",
    "LoginError",
    "RestoreError",
    "ASMExpiredError",
    # auth_state_manager events
    "_EVENT_AUTH_LOGIN",
    "_EVENT_AUTH_LOGOUT",
    "_EVENT_AUTH_REFRESHED",
    "_EVENT_AUTH_EXPIRED",
    "_EVENT_AUTH_INVALID",
    "_EVENT_AUTH_ROTATED",
]
