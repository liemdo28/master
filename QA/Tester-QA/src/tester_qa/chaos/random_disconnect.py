"""
Random Disconnect Engine
Simulates random network disconnections, connection drops, and network partitions.
"""
import asyncio
import random
import time
from typing import Any, Callable, Optional
from dataclasses import dataclass, field
from enum import Enum


class DisconnectMode(Enum):
    RANDOM_DROP = "random_drop"
    SCHEDULED_DROP = "scheduled_drop"
    NETWORK_PARTITION = "network_partition"
    FLAPPING = "flapping"  # rapid connect/disconnect
    GRADUAL_DEGRADATION = "gradual_degradation"
    TOTAL_BLACKOUT = "total_blackout"


@dataclass
class DisconnectConfig:
    mode: DisconnectMode
    probability: float = 0.1  # 10% chance per request
    min_disconnect_ms: int = 1000
    max_disconnect_ms: int = 30000
    flap_interval_ms: int = 500
    degradation_rate: float = 0.01  # increase disconnect probability over time
    blackout_duration_ms: int = 60000


@dataclass
class DisconnectEvent:
    timestamp: float
    mode: DisconnectMode
    target: str
    duration_ms: float
    reconnected: bool
    details: dict = field(default_factory=dict)


class RandomDisconnectEngine:
    """
    Simulates random network disconnections.
    """

    def __init__(self):
        self.active_disconnects: dict[str, DisconnectConfig] = {}
        self.disconnect_log: list[DisconnectEvent] = []
        self._disconnect_count: dict[str, int] = {}
        self._current_state: dict[str, bool] = {}  # True = connected
        self._degradation_counter: dict[str, int] = {}
        self._running = False

    def configure_disconnect(self, target: str, config: DisconnectConfig):
        self.active_disconnects[target] = config
        self._disconnect_count[target] = 0
        self._current_state[target] = True
        self._degradation_counter[target] = 0

    def clear_disconnect(self, target: str):
        self.active_disconnects.pop(target, None)

    def clear_all(self):
        self.active_disconnects.clear()
        self._running = False

    def is_connected(self, target: str) -> bool:
        """Check if target is currently connected."""
        return self._current_state.get(target, True)

    async def check_connection(self, target: str) -> bool:
        """
        Check if connection should be dropped.
        Returns True if connected, False if disconnected.
        """
        if target not in self.active_disconnects:
            return True

        config = self.active_disconnects[target]
        self._disconnect_count[target] = self._disconnect_count.get(target, 0) + 1
        self._degradation_counter[target] = self._degradation_counter.get(target, 0) + 1

        mode = config.mode

        if mode == DisconnectMode.RANDOM_DROP:
            if random.random() < config.probability:
                await self._disconnect(target, config)
                return False
            return True

        elif mode == DisconnectMode.SCHEDULED_DROP:
            # Disconnect every N requests
            if self._disconnect_count[target] % 10 == 0:
                await self._disconnect(target, config)
                return False
            return True

        elif mode == DisconnectMode.NETWORK_PARTITION:
            # Simulate network partition - all connections fail
            if not self._current_state.get(target, True):
                return False
            if random.random() < config.probability:
                self._current_state[target] = False
                await self._disconnect(target, config)
                return False
            return True

        elif mode == DisconnectMode.FLAPPING:
            # Rapid connect/disconnect
            self._current_state[target] = not self._current_state.get(target, True)
            if not self._current_state[target]:
                await self._disconnect(target, config)
            return self._current_state[target]

        elif mode == DisconnectMode.GRADUAL_DEGRADATION:
            # Probability increases over time
            counter = self._degradation_counter[target]
            current_prob = min(config.probability + (counter * config.degradation_rate), 1.0)
            if random.random() < current_prob:
                await self._disconnect(target, config)
                return False
            return True

        elif mode == DisconnectMode.TOTAL_BLACKOUT:
            # Everything disconnects
            self._current_state[target] = False
            await self._disconnect(target, config)
            return False

        return True

    async def _disconnect(self, target: str, config: DisconnectConfig):
        """Perform disconnection."""
        duration_ms = random.uniform(config.min_disconnect_ms, config.max_disconnect_ms)

        self.disconnect_log.append(DisconnectEvent(
            timestamp=time.time(),
            mode=config.mode,
            target=target,
            duration_ms=duration_ms,
            reconnected=False,
            details={
                "disconnect_count": self._disconnect_count.get(target, 0),
                "degradation_counter": self._degradation_counter.get(target, 0),
            }
        ))

        self._current_state[target] = False

    async def reconnect(self, target: str):
        """Reconnect a disconnected target."""
        self._current_state[target] = True
        self.disconnect_log.append(DisconnectEvent(
            timestamp=time.time(),
            mode=DisconnectMode.RANDOM_DROP,
            target=target,
            duration_ms=0,
            reconnected=True,
            details={"action": "reconnect"}
        ))

    async def simulate_flapping(
        self,
        target: str,
        duration_ms: int = 30000,
        on_disconnect: Callable = None,
        on_reconnect: Callable = None
    ):
        """Simulate connection flapping for a duration."""
        if target not in self.active_disconnects:
            return

        config = self.active_disconnects[target]
        self._running = True
        start_time = time.time()
        duration = duration_ms / 1000

        while self._running and (time.time() - start_time) < duration:
            # Disconnect
            self._current_state[target] = False
            if on_disconnect:
                await on_disconnect()

            self.disconnect_log.append(DisconnectEvent(
                timestamp=time.time(),
                mode=DisconnectMode.FLAPPING,
                target=target,
                duration_ms=config.flap_interval_ms,
                reconnected=False,
                details={"flapping": True}
            ))

            await asyncio.sleep(config.flap_interval_ms / 1000)

            # Reconnect
            self._current_state[target] = True
            if on_reconnect:
                await on_reconnect()

            self.disconnect_log.append(DisconnectEvent(
                timestamp=time.time(),
                mode=DisconnectMode.FLAPPING,
                target=target,
                duration_ms=0,
                reconnected=True,
                details={"flapping": True}
            ))

            await asyncio.sleep(config.flap_interval_ms / 1000)

    async def simulate_network_partition(
        self,
        targets: list[str],
        duration_ms: int = 60000
    ):
        """Simulate a network partition affecting multiple targets."""
        self._running = True

        # Disconnect all targets
        for target in targets:
            self._current_state[target] = False
            self.disconnect_log.append(DisconnectEvent(
                timestamp=time.time(),
                mode=DisconnectMode.NETWORK_PARTITION,
                target=target,
                duration_ms=duration_ms,
                reconnected=False,
                details={"partition": True, "affected_targets": len(targets)}
            ))

        # Wait for partition duration
        await asyncio.sleep(duration_ms / 1000)

        # Reconnect all
        for target in targets:
            self._current_state[target] = True
            self.disconnect_log.append(DisconnectEvent(
                timestamp=time.time(),
                mode=DisconnectMode.NETWORK_PARTITION,
                target=target,
                duration_ms=0,
                reconnected=True,
                details={"partition_resolved": True}
            ))

    def get_disconnect_stats(self, target: Optional[str] = None) -> dict:
        """Get disconnect statistics."""
        logs = self.disconnect_log
        if target:
            logs = [e for e in logs if e.target == target]

        disconnects = [e for e in logs if not e.reconnected]
        reconnects = [e for e in logs if e.reconnected]

        return {
            "total_disconnects": len(disconnects),
            "total_reconnects": len(reconnects),
            "currently_connected": {
                t: state for t, state in self._current_state.items()
            },
            "disconnect_counts": dict(self._disconnect_count),
            "avg_disconnect_duration_ms": (
                sum(e.duration_ms for e in disconnects) / max(len(disconnects), 1)
            ),
        }

    def export_disconnect_log(self) -> list[dict]:
        """Export disconnect log."""
        return [
            {
                "timestamp": e.timestamp,
                "mode": e.mode.value,
                "target": e.target,
                "duration_ms": e.duration_ms,
                "reconnected": e.reconnected,
                "details": e.details,
            }
            for e in self.disconnect_log
        ]


# Global singleton
_random_disconnect_engine: Optional[RandomDisconnectEngine] = None


def get_random_disconnect_engine() -> RandomDisconnectEngine:
    global _random_disconnect_engine
    if _random_disconnect_engine is None:
        _random_disconnect_engine = RandomDisconnectEngine()
    return _random_disconnect_engine
