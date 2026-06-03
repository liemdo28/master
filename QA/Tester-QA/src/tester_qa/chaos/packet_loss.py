"""
Packet Loss Simulation Engine
Simulates network packet loss, corruption, and duplication.
"""
import asyncio
import random
import time
from typing import Any, Callable, Optional
from dataclasses import dataclass, field
from enum import Enum


class LossPattern(Enum):
    RANDOM = "random"
    BURST = "burst"
    GRADUAL = "gradual"
    SELECTIVE = "selective"  # loss specific packet types


@dataclass
class PacketLossConfig:
    loss_rate: float = 0.1  # 10% packet loss
    corruption_rate: float = 0.01  # 1% corruption
    duplication_rate: float = 0.05  # 5% duplication
    pattern: LossPattern = LossPattern.RANDOM
    burst_length: int = 5  # consecutive packets to lose
    burst_probability: float = 0.1
    target_packet_types: list[str] = field(default_factory=list)


@dataclass
class PacketLossEvent:
    timestamp: float
    target: str
    action: str  # "lost", "corrupted", "duplicated"
    packet_id: str
    details: dict = field(default_factory=dict)


class PacketLossSimulator:
    """
    Simulates network packet loss, corruption, and duplication.
    """

    def __init__(self):
        self.active_simulations: dict[str, PacketLossConfig] = {}
        self.loss_log: list[PacketLossEvent] = []
        self._packet_count: dict[str, int] = {}
        self._burst_tracker: dict[str, int] = {}
        self._corruption_patterns = [
            lambda d: d[:-1],  # truncate
            lambda d: d + b"EXTRA",  # append
            lambda d: d.replace(b"valid", b"invalid"),  # replace
            lambda d: bytes([b for b in d[:10]] + [0xFF] + [b for b in d[10:]])[:len(d)],  # corrupt byte
        ]

    def configure_loss(self, target: str, config: PacketLossConfig):
        self.active_simulations[target] = config
        self._packet_count[target] = 0
        self._burst_tracker[target] = 0

    def clear_loss(self, target: str):
        self.active_simulations.pop(target, None)

    def clear_all(self):
        self.active_simulations.clear()

    async def process_packet(
        self,
        target: str,
        packet: Any,
        packet_id: str = None
    ) -> Optional[Any]:
        """Process a packet with loss simulation."""
        if target not in self.active_simulations:
            return packet

        config = self.active_simulations[target]
        self._packet_count[target] = self._packet_count.get(target, 0) + 1
        packet_id = packet_id or f"pkt_{self._packet_count[target]}"

        # Check if we should lose this packet
        if self._should_lose(target, config):
            self.loss_log.append(PacketLossEvent(
                timestamp=time.time(),
                target=target,
                action="lost",
                packet_id=packet_id,
                details={"loss_pattern": config.pattern.value}
            ))
            return None

        # Check if we should corrupt this packet
        if random.random() < config.corruption_rate:
            corrupted = self._corrupt_packet(packet)
            self.loss_log.append(PacketLossEvent(
                timestamp=time.time(),
                target=target,
                action="corrupted",
                packet_id=packet_id,
                details={"corruption_type": "byte_corruption"}
            ))
            return corrupted

        # Check if we should duplicate this packet
        if random.random() < config.duplication_rate:
            self.loss_log.append(PacketLossEvent(
                timestamp=time.time(),
                target=target,
                action="duplicated",
                packet_id=packet_id,
                details={"duplication_count": random.randint(1, 3)}
            ))
            # Return packet and mark for duplication
            return packet, True  # Caller should duplicate

        return packet

    def _should_lose(self, target: str, config: PacketLossConfig) -> bool:
        """Determine if packet should be lost based on pattern."""
        pattern = config.pattern

        if pattern == LossPattern.RANDOM:
            return random.random() < config.loss_rate

        elif pattern == LossPattern.BURST:
            if self._burst_tracker.get(target, 0) > 0:
                self._burst_tracker[target] -= 1
                return True
            if random.random() < config.burst_probability:
                self._burst_tracker[target] = config.burst_length
                return True
            return False

        elif pattern == LossPattern.GRADUAL:
            # Loss rate increases over time
            packets_sent = self._packet_count.get(target, 0)
            progressive_loss = min(config.loss_rate + (packets_sent * 0.001), 0.5)
            return random.random() < progressive_loss

        elif pattern == LossPattern.SELECTIVE:
            # Loss specific types - would need packet type detection
            return False

        return False

    def _corrupt_packet(self, packet: Any) -> Any:
        """Corrupt packet data."""
        if isinstance(packet, bytes):
            corrupt_func = random.choice(self._corruption_patterns)
            try:
                return corrupt_func(packet)
            except Exception:
                return packet + b"CORRUPTED"
        elif isinstance(packet, str):
            corrupt_func = random.choice([
                lambda s: s[:-1],
                lambda s: s + "CORRUPTED",
                lambda s: s.replace("valid", "invalid"),
            ])
            return corrupt_func(packet)
        elif isinstance(packet, dict):
            result = packet.copy()
            result["_corrupted"] = True
            result["data"] = "CORRUPTED_DATA"
            return result
        return packet

    def get_loss_stats(self, target: Optional[str] = None) -> dict:
        """Get packet loss statistics."""
        logs = self.loss_log
        if target:
            logs = [e for e in logs if e.target == target]

        total = self._packet_count.get(target or "", 0)
        lost = len([e for e in logs if e.action == "lost"])
        corrupted = len([e for e in logs if e.action == "corrupted"])
        duplicated = len([e for e in logs if e.action == "duplicated"])

        return {
            "total_packets": total,
            "packets_lost": lost,
            "packets_corrupted": corrupted,
            "packets_duplicated": duplicated,
            "actual_loss_rate": lost / max(total, 1),
            "config_loss_rate": self.active_simulations.get(target, PacketLossConfig()).loss_rate,
        }

    def export_loss_log(self) -> list[dict]:
        """Export loss log."""
        return [
            {
                "timestamp": e.timestamp,
                "target": e.target,
                "action": e.action,
                "packet_id": e.packet_id,
                "details": e.details,
            }
            for e in self.loss_log
        ]


# Global singleton
_packet_loss_simulator: Optional[PacketLossSimulator] = None


def get_packet_loss_simulator() -> PacketLossSimulator:
    global _packet_loss_simulator
    if _packet_loss_simulator is None:
        _packet_loss_simulator = PacketLossSimulator()
    return _packet_loss_simulator
