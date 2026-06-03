"""Encrypted session storage for authenticated browser states."""
from __future__ import annotations

import base64
import hashlib
import json
import os
from pathlib import Path
from typing import Any


AUTH_DIR = Path(".auth")


class SessionStore:
    """Store and retrieve encrypted browser session states per project."""

    def __init__(self, base_dir: Path | str = AUTH_DIR) -> None:
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def save_session(
        self,
        project_id: str,
        session_data: dict[str, Any],
        passphrase: str | None = None,
    ) -> Path:
        """Save session data (cookies, localStorage, etc.) encrypted."""
        payload = json.dumps(session_data, ensure_ascii=False, default=str)

        if passphrase:
            encrypted = self._encrypt(payload, passphrase)
            file_path = self.base_dir / f"{project_id}.json.enc"
            file_path.write_bytes(encrypted)
        else:
            # XOR with machine-derived key for basic obfuscation
            encrypted = self._obfuscate(payload)
            file_path = self.base_dir / f"{project_id}.json.enc"
            file_path.write_bytes(encrypted)

        return file_path

    def load_session(
        self,
        project_id: str,
        passphrase: str | None = None,
    ) -> dict[str, Any] | None:
        """Load and decrypt session data for a project."""
        file_path = self.base_dir / f"{project_id}.json.enc"
        if not file_path.exists():
            return None

        raw = file_path.read_bytes()

        if passphrase:
            payload = self._decrypt(raw, passphrase)
        else:
            payload = self._deobfuscate(raw)

        if payload is None:
            return None

        try:
            return json.loads(payload)
        except json.JSONDecodeError:
            return None

    def save_playwright_state(self, project_id: str, state: dict[str, Any]) -> Path:
        """Save Playwright storage state (cookies + origins)."""
        state_path = self.base_dir / f"{project_id}-storage-state.json"
        state_path.write_text(
            json.dumps(state, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        return state_path

    def load_playwright_state(self, project_id: str) -> dict[str, Any] | None:
        """Load Playwright storage state."""
        state_path = self.base_dir / f"{project_id}-storage-state.json"
        if not state_path.exists():
            return None
        try:
            return json.loads(state_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return None

    def list_sessions(self) -> list[str]:
        """List all stored session project IDs."""
        sessions: list[str] = []
        for f in self.base_dir.iterdir():
            if f.suffix == ".enc" and f.stem.endswith(".json"):
                sessions.append(f.stem.replace(".json", ""))
        return sessions

    def delete_session(self, project_id: str) -> bool:
        """Delete stored session for a project."""
        deleted = False
        for pattern in [f"{project_id}.json.enc", f"{project_id}-storage-state.json"]:
            path = self.base_dir / pattern
            if path.exists():
                path.unlink()
                deleted = True
        return deleted

    def _encrypt(self, plaintext: str, passphrase: str) -> bytes:
        """Simple XOR encryption with passphrase-derived key + salt."""
        salt = os.urandom(16)
        key = hashlib.pbkdf2_hmac("sha256", passphrase.encode(), salt, 100_000)
        data = plaintext.encode("utf-8")
        encrypted = bytes(b ^ key[i % len(key)] for i, b in enumerate(data))
        # Format: salt + encrypted
        return base64.b64encode(salt + encrypted)

    def _decrypt(self, raw: bytes, passphrase: str) -> str | None:
        """Decrypt XOR-encrypted data."""
        try:
            decoded = base64.b64decode(raw)
            salt = decoded[:16]
            encrypted = decoded[16:]
            key = hashlib.pbkdf2_hmac("sha256", passphrase.encode(), salt, 100_000)
            decrypted = bytes(b ^ key[i % len(key)] for i, b in enumerate(encrypted))
            return decrypted.decode("utf-8")
        except Exception:
            return None

    def _obfuscate(self, plaintext: str) -> bytes:
        """Basic obfuscation using machine ID as key."""
        key = self._machine_key()
        data = plaintext.encode("utf-8")
        obfuscated = bytes(b ^ key[i % len(key)] for i, b in enumerate(data))
        return base64.b64encode(obfuscated)

    def _deobfuscate(self, raw: bytes) -> str | None:
        """Reverse basic obfuscation."""
        try:
            decoded = base64.b64decode(raw)
            key = self._machine_key()
            deobfuscated = bytes(b ^ key[i % len(key)] for i, b in enumerate(decoded))
            return deobfuscated.decode("utf-8")
        except Exception:
            return None

    def _machine_key(self) -> bytes:
        """Derive a key from machine-specific data."""
        import platform
        machine_id = f"{platform.node()}-{os.getlogin()}-tester-qa"
        return hashlib.sha256(machine_id.encode()).digest()
