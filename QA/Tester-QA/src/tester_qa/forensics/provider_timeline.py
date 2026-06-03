"""Provider Timeline - Reconstruct provider call chains and failures."""
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional


class ProviderType(Enum):
    HTTP = "http"
    DATABASE = "database"
    CACHE = "cache"
    QUEUE = "queue"
    STREAM = "stream"


class FailureType(Enum):
    TIMEOUT = "timeout"
    CONNECTION_ERROR = "connection_error"
    RATE_LIMIT = "rate_limit"
    RETRY_EXHAUSTED = "retry_exhausted"
    UNKNOWN = "unknown"


@dataclass
class ProviderCall:
    call_id: str
    provider_name: str
    provider_type: ProviderType
    timestamp: datetime
    duration_ms: float
    success: bool
    error: Optional[str] = None
    retry_count: int = 0


@dataclass
class TimeoutChain:
    chain_id: str
    calls: list[ProviderCall]
    total_timeout_ms: float
    root_cause: Optional[str] = None


@dataclass
class ProviderFailure:
    provider_name: str
    failure_type: FailureType
    timestamp: datetime
    error_message: str
    affected_calls: int
    duration_ms: float


class ProviderTimeline:
    """Reconstruct provider call timelines and timeout chains."""

    def __init__(self):
        self.calls: list[ProviderCall] = []
        self.timeout_chains: list[TimeoutChain] = []
        self.failures: list[ProviderFailure] = []

    def reconstruct_provider_calls(
        self, raw_calls: list[dict[str, Any]]
    ) -> list[ProviderCall]:
        """Reconstruct provider calls from raw data."""
        self.calls = []
        for raw in raw_calls:
            call = ProviderCall(
                call_id=raw.get("call_id", ""),
                provider_name=raw.get("provider_name", ""),
                provider_type=ProviderType(raw.get("provider_type", "http")),
                timestamp=datetime.fromisoformat(raw.get("timestamp", datetime.now().isoformat())),
                duration_ms=raw.get("duration_ms", 0.0),
                success=raw.get("success", True),
                error=raw.get("error"),
                retry_count=raw.get("retry_count", 0),
            )
            self.calls.append(call)

            if not call.success:
                self.failures.append(
                    ProviderFailure(
                        provider_name=call.provider_name,
                        failure_type=FailureType(call.data.get("failure_type", "unknown")) if hasattr(call, "data") else FailureType.UNKNOWN,
                        timestamp=call.timestamp,
                        error_message=call.error or "",
                        affected_calls=1,
                        duration_ms=call.duration_ms,
                    )
                )

        return self.calls

    def find_timeout_chain(
        self, timeout_threshold_ms: float = 30000.0
    ) -> list[TimeoutChain]:
        """Find chains of timeout propagation."""
        self.timeout_chains = []

        sorted_calls = sorted(self.calls, key=lambda c: c.timestamp)
        current_chain: list[ProviderCall] = []
        chain_id_counter = 0

        for call in sorted_calls:
            if call.duration_ms >= timeout_threshold_ms:
                current_chain.append(call)
            else:
                if current_chain:
                    total = sum(c.duration_ms for c in current_chain)
                    self.timeout_chains.append(
                        TimeoutChain(
                            chain_id=f"timeout_chain_{chain_id_counter}",
                            calls=list(current_chain),
                            total_timeout_ms=total,
                            root_cause=current_chain[0].provider_name,
                        )
                    )
                    chain_id_counter += 1
                    current_chain = []

        if current_chain:
            total = sum(c.duration_ms for c in current_chain)
            self.timeout_chains.append(
                TimeoutChain(
                    chain_id=f"timeout_chain_{chain_id_counter}",
                    calls=list(current_chain),
                    total_timeout_ms=total,
                    root_cause=current_chain[0].provider_name,
                )
            )

        return self.timeout_chains

    def map_provider_failure(self) -> dict[str, list[ProviderFailure]]:
        """Map provider failures by provider name."""
        result: dict[str, list[ProviderFailure]] = {}
        for failure in self.failures:
            if failure.provider_name not in result:
                result[failure.provider_name] = []
            result[failure.provider_name].append(failure)
        return result
