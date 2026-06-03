"""Target isolation guard for browser warfare operations."""
from __future__ import annotations

from urllib.parse import urlparse


class WarfareIsolationGuard:
    """Ensure destructive browser-warfare activity stays isolated from production."""

    _LOOPBACK_HOSTS = {"localhost", "127.0.0.1", "::1", "0.0.0.0"}
    _PRODUCTION_MARKERS = ("prod", "production", "live")

    def validate_target(self, url: str) -> tuple[bool, list[str]]:
        """Validate a target URL for isolation safety."""
        violations: list[str] = []
        if not url:
            violations.append("target url is required")
        if not self.ensure_loopback_only(url):
            violations.append("target must be loopback/local only")
        if not self.block_production_domains(url):
            violations.append("production domain markers are blocked")
        return not violations, violations

    def ensure_loopback_only(self, url: str) -> bool:
        """Return True only for loopback/local targets."""
        parsed = urlparse(url if "://" in url else f"http://{url}")
        hostname = (parsed.hostname or "").lower()
        return hostname in self._LOOPBACK_HOSTS or hostname.endswith(".localhost")

    def block_production_domains(self, url: str) -> bool:
        """Return False when a target appears to be production/live."""
        parsed = urlparse(url if "://" in url else f"http://{url}")
        hostname = (parsed.hostname or "").lower()
        return not any(marker in hostname for marker in self._PRODUCTION_MARKERS)
