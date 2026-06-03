"""Secure credential vault — never stores plaintext secrets."""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Any


class CredentialVault:
    """Manage credentials for authenticated testing environments.

    Security rules:
    - NEVER print passwords in logs
    - NEVER store plaintext secrets
    - NEVER expose session tokens
    - NEVER commit auth state to git
    """

    def __init__(self, vault_path: Path | str = Path(".auth/vault.enc")) -> None:
        self.vault_path = Path(vault_path)
        self.vault_path.parent.mkdir(parents=True, exist_ok=True)
        self._ensure_gitignore()

    def store_credential(
        self,
        project_id: str,
        credential_type: str,
        data: dict[str, str],
        passphrase: str | None = None,
    ) -> None:
        """Store a credential entry for a project."""
        vault = self._load_vault(passphrase)
        vault.setdefault(project_id, {})[credential_type] = {
            "data": data,
            "stored_at": self._now_iso(),
        }
        self._save_vault(vault, passphrase)

    def get_credential(
        self,
        project_id: str,
        credential_type: str,
        passphrase: str | None = None,
    ) -> dict[str, str] | None:
        """Retrieve a credential entry."""
        vault = self._load_vault(passphrase)
        project_creds = vault.get(project_id, {})
        entry = project_creds.get(credential_type)
        if entry:
            return entry.get("data")
        return None

    def list_credentials(self, passphrase: str | None = None) -> dict[str, list[str]]:
        """List all stored credential types per project (no secrets exposed)."""
        vault = self._load_vault(passphrase)
        return {
            project_id: list(creds.keys())
            for project_id, creds in vault.items()
        }

    def delete_credential(
        self,
        project_id: str,
        credential_type: str | None = None,
        passphrase: str | None = None,
    ) -> bool:
        """Delete a credential or all credentials for a project."""
        vault = self._load_vault(passphrase)
        if project_id not in vault:
            return False
        if credential_type:
            if credential_type in vault[project_id]:
                del vault[project_id][credential_type]
                if not vault[project_id]:
                    del vault[project_id]
                self._save_vault(vault, passphrase)
                return True
            return False
        else:
            del vault[project_id]
            self._save_vault(vault, passphrase)
            return True

    def from_env(self, project_id: str) -> dict[str, str] | None:
        """Load credentials from environment variables (local dev only)."""
        username = os.environ.get("TESTER_QA_USERNAME")
        password = os.environ.get("TESTER_QA_PASSWORD")
        if username and password:
            return {"username": username, "password": password}

        # Project-specific env vars
        prefix = project_id.upper().replace("-", "_")
        username = os.environ.get(f"{prefix}_USERNAME")
        password = os.environ.get(f"{prefix}_PASSWORD")
        if username and password:
            return {"username": username, "password": password}

        return None

    def _load_vault(self, passphrase: str | None = None) -> dict[str, Any]:
        """Load and decrypt the vault."""
        if not self.vault_path.exists():
            return {}
        try:
            raw = self.vault_path.read_bytes()
            key = self._derive_key(passphrase)
            import base64
            decoded = base64.b64decode(raw)
            decrypted = bytes(b ^ key[i % len(key)] for i, b in enumerate(decoded))
            return json.loads(decrypted.decode("utf-8"))
        except Exception:
            return {}

    def _save_vault(self, vault: dict[str, Any], passphrase: str | None = None) -> None:
        """Encrypt and save the vault."""
        import base64
        payload = json.dumps(vault, ensure_ascii=False, default=str).encode("utf-8")
        key = self._derive_key(passphrase)
        encrypted = bytes(b ^ key[i % len(key)] for i, b in enumerate(payload))
        self.vault_path.write_bytes(base64.b64encode(encrypted))

    def _derive_key(self, passphrase: str | None = None) -> bytes:
        """Derive encryption key from passphrase or machine identity."""
        import platform
        base = passphrase or f"{platform.node()}-{os.getlogin()}-tester-qa-vault"
        return hashlib.sha256(base.encode()).digest()

    def _ensure_gitignore(self) -> None:
        """Ensure .auth directory is in .gitignore."""
        gitignore = Path(".gitignore")
        if gitignore.exists():
            content = gitignore.read_text(encoding="utf-8")
            if ".auth/" not in content and ".auth" not in content:
                with gitignore.open("a", encoding="utf-8") as f:
                    f.write("\n# Tester-QA auth state (never commit)\n.auth/\n")
        else:
            gitignore.write_text("# Tester-QA auth state (never commit)\n.auth/\n", encoding="utf-8")

    def _now_iso(self) -> str:
        from datetime import datetime, timezone
        return datetime.now(timezone.utc).isoformat()
