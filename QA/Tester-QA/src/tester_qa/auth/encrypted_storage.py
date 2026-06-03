"""AES-256-GCM encryption layer for auth state — dedicated storage module."""
from __future__ import annotations

import base64
import hashlib
import json
import os
import platform
import secrets
from pathlib import Path
from typing import Any

try:
    from cryptography.hazmat.backends import default_backend
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    _HAS_CRYPTOGRAPHY = True
except ImportError:
    _HAS_CRYPTOGRAPHY = False

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

AUTH_DIR = Path(".auth")
GITIGNORE_ENTRIES = {".auth/", ".auth/*.enc", ".auth/*.json"}
DEFAULT_ITERATIONS = 100_000
NONCE_SIZE = 12  # bytes — standard for AES-GCM
SALT_SIZE = 16   # bytes — used for PBKDF2

# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class EncryptedStorageError(Exception):
    """Base exception for encrypted storage operations."""


class DecryptionError(EncryptedStorageError):
    """Raised when decryption fails (wrong passphrase or corrupted data)."""


class ProfileNotFoundError(EncryptedStorageError):
    """Raised when a requested profile does not exist."""


# ---------------------------------------------------------------------------
# Helper — master key derivation
# ---------------------------------------------------------------------------

def _get_master_key() -> bytes:
    """Derive the master encryption key.

    Prefers AUTH_MASTER_PASSPHRASE env var. Falls back to a machine-specific
    derived key when the env var is not set (development convenience).
    """
    passphrase = os.environ.get("AUTH_MASTER_PASSPHRASE")
    if passphrase:
        return passphrase.encode("utf-8")

    # Deterministic fallback using machine identity.
    # This is NOT cryptographically secure for production use without the env var.
    machine_id = f"{platform.node()}-{os.getlogin()}-tester-qa-auth"
    return hashlib.sha256(machine_id.encode()).digest()


# ---------------------------------------------------------------------------
# Encryption helpers
# ---------------------------------------------------------------------------

if _HAS_CRYPTOGRAPHY:

    def _encrypt_payload(plaintext: bytes, key: bytes) -> tuple[bytes, bytes, bytes]:
        """Encrypt plaintext using AES-256-GCM.

        Returns (nonce, salt, ciphertext) packed as:
        base64(salt || nonce || ciphertext)
        """
        salt = secrets.token_bytes(SALT_SIZE)
        derived = hashlib.pbkdf2_hmac(
            "sha256",
            key,
            salt,
            DEFAULT_ITERATIONS,
            dklen=32,
        )
        aesgcm = AESGCM(derived)
        nonce = secrets.token_bytes(NONCE_SIZE)
        ciphertext = aesgcm.encrypt(nonce, plaintext, None)
        packed = salt + nonce + ciphertext
        return (base64.b64encode(packed), salt, nonce)

    def _decrypt_payload(data: bytes, key: bytes) -> bytes:
        """Decrypt AES-256-GCM ciphertext."""
        try:
            decoded = base64.b64decode(data)
            salt = decoded[:SALT_SIZE]
            nonce = decoded[SALT_SIZE : SALT_SIZE + NONCE_SIZE]
            ciphertext = decoded[SALT_SIZE + NONCE_SIZE :]
            derived = hashlib.pbkdf2_hmac(
                "sha256",
                key,
                salt,
                DEFAULT_ITERATIONS,
                dklen=32,
            )
            aesgcm = AESGCM(derived)
            return aesgcm.decrypt(nonce, ciphertext, None)
        except Exception as exc:  # broad: covers b64 decode, tag mismatch, padding
            raise DecryptionError(f"Decryption failed: {exc}") from exc

else:

    # -------------------------------------------------------------------------
    # Fallback: XOR with PBKDF2-derived key.
    # Not AES-256-GCM, but provides some obfuscation when cryptography is absent.
    # Logs a warning so operators know to `pip install cryptography`.
    # -------------------------------------------------------------------------
    import logging

    _logger = logging.getLogger(__name__)
    _logger.warning(
        "cryptography library not available — using XOR fallback for AES storage. "
        "Install with: pip install cryptography"
    )

    def _encrypt_payload(plaintext: bytes, key: bytes) -> tuple[bytes, bytes, bytes]:
        """Encrypt using XOR + PBKDF2 (fallback, not AES-GCM)."""
        salt = secrets.token_bytes(SALT_SIZE)
        derived = hashlib.pbkdf2_hmac(
            "sha256",
            key,
            salt,
            DEFAULT_ITERATIONS,
            dklen=32,
        )
        ciphertext = bytes(b ^ derived[i % len(derived)] for i, b in enumerate(plaintext))
        packed = salt + ciphertext
        return (base64.b64encode(packed), salt, b"")

    def _decrypt_payload(data: bytes, key: bytes) -> bytes:
        """Decrypt XOR+PBKDF2 ciphertext (fallback)."""
        try:
            decoded = base64.b64decode(data)
            salt = decoded[:SALT_SIZE]
            ciphertext = decoded[SALT_SIZE:]
            derived = hashlib.pbkdf2_hmac(
                "sha256",
                key,
                salt,
                DEFAULT_ITERATIONS,
                dklen=32,
            )
            plaintext = bytes(b ^ derived[i % len(derived)] for i, b in enumerate(ciphertext))
            return plaintext
        except Exception as exc:
            raise DecryptionError(f"Decryption failed: {exc}") from exc


# ---------------------------------------------------------------------------
# AuthStorage
# ---------------------------------------------------------------------------

class AuthStorage:
    """AES-256-GCM encrypted auth state storage.

    Each profile is stored in its own ``.auth/{profile_name}.enc`` file with a
    random salt per file.  The master passphrase comes from
    ``AUTH_MASTER_PASSPHRASE`` or falls back to a machine-derived key.

    Example
    -------
    >>> storage = AuthStorage()
    >>> storage.save("ci-agent", {"session_token": "s3cr3t", "cookies": []})
    >>> data = storage.load("ci-agent")
    >>> storage.list_profiles()
    ['ci-agent']
    >>> storage.delete("ci-agent")
    """

    def __init__(
        self,
        auth_dir: Path | str = AUTH_DIR,
        master_passphrase: str | None = None,
    ) -> None:
        self.auth_dir = Path(auth_dir)
        self.auth_dir.mkdir(parents=True, exist_ok=True)
        self._key_source = master_passphrase or os.environ.get(
            "AUTH_MASTER_PASSPHRASE"
        ) or ""
        self._key: bytes | None = None
        self._ensure_gitignore()

    # ------------------------------------------------------------------
    # Key management
    # ------------------------------------------------------------------

    @property
    def _master_key(self) -> bytes:
        """Lazily derive the master key on first access."""
        if self._key is None:
            self._key = _get_master_key() if not self._key_source else self._key_source.encode("utf-8")
        return self._key

    def rotate_master_key(self, new_passphrase: str) -> None:
        """Re-encrypt all profiles under a new passphrase."""
        profiles = self.list_profiles()
        # Decrypt all under old key, swap key, re-encrypt
        old_key = self._key
        self._key_source = new_passphrase
        self._key = new_passphrase.encode("utf-8")
        for profile in profiles:
            data = _decrypt_payload(self._read_file(profile), old_key)
            self.save(profile, json.loads(data.decode("utf-8")))
        self._key = new_passphrase.encode("utf-8")

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def save(self, profile_name: str, data: dict[str, Any]) -> Path:
        """Encrypt ``data`` and write to ``.auth/{profile_name}.enc``."""
        self._validate_profile_name(profile_name)
        payload = json.dumps(data, ensure_ascii=False, default=str).encode("utf-8")
        encrypted, _, _ = _encrypt_payload(payload, self._master_key)
        file_path = self._file_path(profile_name)
        file_path.write_bytes(encrypted)
        return file_path

    def load(self, profile_name: str) -> dict[str, Any]:
        """Decrypt and return the stored data for ``profile_name``."""
        file_path = self._file_path(profile_name)
        if not file_path.exists():
            raise ProfileNotFoundError(
                f"No encrypted profile found: '{profile_name}' at {file_path}"
            )
        try:
            encrypted = file_path.read_bytes()
            plaintext = _decrypt_payload(encrypted, self._master_key)
            return json.loads(plaintext.decode("utf-8"))
        except DecryptionError:
            raise
        except Exception as exc:
            raise EncryptedStorageError(
                f"Failed to load profile '{profile_name}': {exc}"
            ) from exc

    def load_or_none(self, profile_name: str) -> dict[str, Any] | None:
        """Return stored data or ``None`` if the profile does not exist."""
        try:
            return self.load(profile_name)
        except ProfileNotFoundError:
            return None

    def delete(self, profile_name: str) -> bool:
        """Remove the encrypted file for ``profile_name``. Returns True if deleted."""
        file_path = self._file_path(profile_name)
        if file_path.exists():
            file_path.unlink()
            return True
        return False

    def list_profiles(self) -> list[str]:
        """Return all profile names that have an encrypted storage file."""
        return [
            f.stem
            for f in self.auth_dir.iterdir()
            if f.suffix == ".enc" and f.name != "vault.enc"
        ]

    def exists(self, profile_name: str) -> bool:
        """Return True if a profile has an encrypted storage file."""
        return self._file_path(profile_name).exists()

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _file_path(self, profile_name: str) -> Path:
        return self.auth_dir / f"{profile_name}.enc"

    @staticmethod
    def _validate_profile_name(profile_name: str) -> None:
        if not profile_name or "/" in profile_name or "\\" in profile_name or profile_name == "..":
            raise ValueError(
                f"Invalid profile name '{profile_name}': must not be empty or contain path separators."
            )

    def _read_file(self, profile_name: str) -> bytes:
        return self._file_path(profile_name).read_bytes()

    def _ensure_gitignore(self) -> None:
        """Append .auth entries to .gitignore if not already present."""
        gitignore = Path(".gitignore")
        existing = gitignore.read_text(encoding="utf-8") if gitignore.exists() else ""
        missing = [entry for entry in GITIGNORE_ENTRIES if entry not in existing]
        if missing:
            with gitignore.open("a", encoding="utf-8") as fh:
                fh.write("\n# Tester-QA auth state — never commit\n")
                fh.write("\n".join(missing) + "\n")

    # ------------------------------------------------------------------
    # Gitignore helper (for callers that just want the entries)
    # ------------------------------------------------------------------

    @staticmethod
    def gitignore_entries() -> list[str]:
        """Return the list of entries that should be in .gitignore."""
        return sorted(GITIGNORE_ENTRIES)


# ---------------------------------------------------------------------------
# Module-level convenience instances
# ---------------------------------------------------------------------------

#: Default storage instance — shared across the module for convenience.
default_storage: AuthStorage = AuthStorage()
