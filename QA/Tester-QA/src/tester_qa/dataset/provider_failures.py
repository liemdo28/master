"""Provider Failure Dataset — tracks AI/API provider failure patterns."""
from __future__ import annotations

import json
import uuid
from collections import Counter
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional


@dataclass
class ProviderFailureRecord:
    """Individual provider failure record."""
    record_id: str
    timestamp: str
    provider: str  # openai, anthropic, azure, etc.
    failure_mode: str  # timeout, rate_limit, auth_failure, server_error, network_error
    latency_ms: float = 0.0
    retry_count: int = 0
    recovery_time_seconds: float = 0.0

    @classmethod
    def create(
        cls,
        provider: str,
        failure_mode: str,
        latency_ms: float = 0.0,
        retry_count: int = 0,
        recovery_time_seconds: float = 0.0,
    ) -> ProviderFailureRecord:
        """Factory method to create a new provider failure record."""
        return cls(
            record_id=f"PF-{uuid.uuid4().hex[:12]}",
            timestamp=datetime.utcnow().isoformat() + "Z",
            provider=provider,
            failure_mode=failure_mode,
            latency_ms=latency_ms,
            retry_count=retry_count,
            recovery_time_seconds=recovery_time_seconds,
        )

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> ProviderFailureRecord:
        return cls(**data)


class ProviderFailureDataset:
    """
    Persistent provider failure dataset.
    Persists to data/dataset/provider_failures.jsonl
    """

    def __init__(self, data_dir: Optional[Path] = None):
        if data_dir is None:
            data_dir = Path(__file__).parent.parent.parent.parent / "data" / "dataset"
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.filepath = self.data_dir / "provider_failures.jsonl"
        self._cache: list[ProviderFailureRecord] = []
        self._load_cache()

    def _load_cache(self) -> None:
        """Load all records into memory cache."""
        self._cache = []
        if self.filepath.exists():
            with open(self.filepath, "r") as f:
                for line in f:
                    line = line.strip()
                    if line:
                        try:
                            data = json.loads(line)
                            self._cache.append(ProviderFailureRecord.from_dict(data))
                        except (json.JSONDecodeError, TypeError):
                            continue

    def add(self, record: ProviderFailureRecord) -> None:
        """Add a provider failure record."""
        with open(self.filepath, "a") as f:
            f.write(json.dumps(record.to_dict()) + "\n")
        self._cache.append(record)

    def get_by_provider(self, provider: str) -> list[ProviderFailureRecord]:
        """Get all failure records for a specific provider."""
        return [r for r in self._cache if r.provider == provider]

    def get_reliability_scores(self) -> dict:
        """
        Calculate reliability scores (0-100) for each provider.
        Higher score = more reliable (fewer failures, faster recovery).
        """
        provider_groups: dict[str, list[ProviderFailureRecord]] = {}
        for record in self._cache:
            if record.provider not in provider_groups:
                provider_groups[record.provider] = []
            provider_groups[record.provider].append(record)

        if not provider_groups:
            return {}

        # Find max failure count for normalization
        max_failures = max(len(records) for records in provider_groups.values())
        
        scores = {}
        for provider, records in provider_groups.items():
            # Base score starts at 100
            score = 100.0
            
            # Penalize for failure count (up to -40 points)
            failure_penalty = (len(records) / max(max_failures, 1)) * 40
            score -= failure_penalty
            
            # Penalize for high average latency (up to -20 points)
            latencies = [r.latency_ms for r in records if r.latency_ms > 0]
            if latencies:
                avg_latency = sum(latencies) / len(latencies)
                latency_penalty = min(avg_latency / 5000, 1.0) * 20  # 5000ms = max penalty
                score -= latency_penalty
            
            # Penalize for high retry counts (up to -20 points)
            retry_counts = [r.retry_count for r in records]
            if retry_counts:
                avg_retries = sum(retry_counts) / len(retry_counts)
                retry_penalty = min(avg_retries / 5, 1.0) * 20  # 5 retries = max penalty
                score -= retry_penalty
            
            # Penalize for slow recovery (up to -20 points)
            recovery_times = [r.recovery_time_seconds for r in records if r.recovery_time_seconds > 0]
            if recovery_times:
                avg_recovery = sum(recovery_times) / len(recovery_times)
                recovery_penalty = min(avg_recovery / 60, 1.0) * 20  # 60s = max penalty
                score -= recovery_penalty

            scores[provider] = max(0, round(score, 2))

        return scores

    def get_failure_patterns(self) -> list[dict]:
        """
        Get failure patterns grouped by provider and failure_mode.
        Returns list of {provider, mode, count, avg_latency, avg_retries}
        """
        pattern_groups: dict[tuple[str, str], list[ProviderFailureRecord]] = {}
        for record in self._cache:
            key = (record.provider, record.failure_mode)
            if key not in pattern_groups:
                pattern_groups[key] = []
            pattern_groups[key].append(record)

        patterns = []
        for (provider, mode), records in pattern_groups.items():
            latencies = [r.latency_ms for r in records if r.latency_ms > 0]
            avg_latency = sum(latencies) / len(latencies) if latencies else 0.0
            
            retries = [r.retry_count for r in records]
            avg_retries = sum(retries) / len(retries) if retries else 0.0

            patterns.append({
                "provider": provider,
                "mode": mode,
                "count": len(records),
                "avg_latency_ms": round(avg_latency, 2),
                "avg_retries": round(avg_retries, 2),
            })

        return sorted(patterns, key=lambda x: x["count"], reverse=True)

    def get_providers(self) -> list[str]:
        """Get list of all providers in the dataset."""
        return list(set(r.provider for r in self._cache))

    def export(self) -> dict:
        """Export the dataset."""
        return {
            "exported_at": datetime.utcnow().isoformat() + "Z",
            "total_records": len(self._cache),
            "providers": self.get_providers(),
            "reliability_scores": self.get_reliability_scores(),
            "patterns": self.get_failure_patterns(),
            "records": [r.to_dict() for r in self._cache],
        }

    def clear(self) -> None:
        """Clear all records (use with caution)."""
        if self.filepath.exists():
            self.filepath.unlink()
        self._cache = []
