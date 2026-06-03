"""Auth profiles for multi-project, multi-account testing."""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


@dataclass
class AuthProfile:
    """Authentication profile for a project/account combination."""
    project_id: str
    profile_name: str
    login_url: str | None = None
    strategy: str = "manual"  # manual | env | storage-state | token
    base_url: str | None = None
    storage_state_path: str | None = None
    token_env_var: str | None = None
    headers: dict[str, str] = field(default_factory=dict)
    cookies_captured: bool = False
    last_used: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "project_id": self.project_id,
            "profile_name": self.profile_name,
            "login_url": self.login_url,
            "strategy": self.strategy,
            "base_url": self.base_url,
            "storage_state_path": self.storage_state_path,
            "token_env_var": self.token_env_var,
            "headers": self.headers,
            "cookies_captured": self.cookies_captured,
            "last_used": self.last_used,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> AuthProfile:
        return cls(
            project_id=data["project_id"],
            profile_name=data["profile_name"],
            login_url=data.get("login_url"),
            strategy=data.get("strategy", "manual"),
            base_url=data.get("base_url"),
            storage_state_path=data.get("storage_state_path"),
            token_env_var=data.get("token_env_var"),
            headers=data.get("headers", {}),
            cookies_captured=data.get("cookies_captured", False),
            last_used=data.get("last_used"),
        )


class AuthProfileManager:
    """Manage authentication profiles across projects."""

    def __init__(self, config_path: Path | str = Path("config/auth-profiles.json")) -> None:
        self.config_path = Path(config_path)

    def create_profile(self, profile: AuthProfile) -> AuthProfile:
        """Create or update an auth profile."""
        profiles = self._load_profiles()
        key = f"{profile.project_id}:{profile.profile_name}"
        profiles[key] = profile.to_dict()
        self._save_profiles(profiles)
        return profile

    def get_profile(self, project_id: str, profile_name: str = "default") -> AuthProfile | None:
        """Get an auth profile by project and name."""
        profiles = self._load_profiles()
        key = f"{project_id}:{profile_name}"
        data = profiles.get(key)
        if data:
            return AuthProfile.from_dict(data)
        return None

    def list_profiles(self, project_id: str | None = None) -> list[AuthProfile]:
        """List all profiles, optionally filtered by project."""
        profiles = self._load_profiles()
        result: list[AuthProfile] = []
        for _key, data in profiles.items():
            if project_id is None or data.get("project_id") == project_id:
                result.append(AuthProfile.from_dict(data))
        return result

    def delete_profile(self, project_id: str, profile_name: str) -> bool:
        """Delete an auth profile."""
        profiles = self._load_profiles()
        key = f"{project_id}:{profile_name}"
        if key in profiles:
            del profiles[key]
            self._save_profiles(profiles)
            return True
        return False

    def mark_used(self, project_id: str, profile_name: str = "default") -> None:
        """Mark a profile as recently used."""
        profiles = self._load_profiles()
        key = f"{project_id}:{profile_name}"
        if key in profiles:
            profiles[key]["last_used"] = datetime.now(timezone.utc).isoformat()
            self._save_profiles(profiles)

    def _load_profiles(self) -> dict[str, Any]:
        if not self.config_path.exists():
            return {}
        try:
            return json.loads(self.config_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return {}

    def _save_profiles(self, profiles: dict[str, Any]) -> None:
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        self.config_path.write_text(
            json.dumps(profiles, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
