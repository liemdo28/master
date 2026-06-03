"""Process Timeline - Reconstruct process tree and death chains."""
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional


class ProcessState(Enum):
    ALIVE = "alive"
    ZOMBIE = "zombie"
    DEAD = "dead"
    ORPHANED = "orphaned"


@dataclass
class ProcessEvent:
    pid: int
    ppid: int
    timestamp: datetime
    state: ProcessState
    name: str
    exit_code: Optional[int] = None


@dataclass
class ProcessNode:
    pid: int
    name: str
    state: ProcessState
    children: list[int] = field(default_factory=list)
    events: list[ProcessEvent] = field(default_factory=list)


@dataclass
class ZombieOrigin:
    pid: int
    name: str
    parent_pid: int
    parent_name: str
    reason: str
    timestamp: datetime


@dataclass
class ProcessDeath:
    pid: int
    name: str
    timestamp: datetime
    exit_code: int
    children_killed: int


class ProcessTimeline:
    """Reconstruct process tree and track process death chains."""

    def __init__(self):
        self.processes: dict[int, ProcessNode] = {}
        self.events: list[ProcessEvent] = []

    def reconstruct_process_tree(
        self, events: list[ProcessEvent]
    ) -> dict[int, ProcessNode]:
        """Reconstruct process tree from events."""
        self.events = events
        self.processes = {}

        for event in events:
            if event.pid not in self.processes:
                self.processes[event.pid] = ProcessNode(
                    pid=event.pid,
                    name=event.name,
                    state=event.state,
                    events=[],
                )
            node = self.processes[event.pid]
            node.events.append(event)
            node.state = event.state

            if event.ppid not in self.processes and event.ppid != 0:
                self.processes[event.ppid] = ProcessNode(
                    pid=event.ppid,
                    name="unknown",
                    state=ProcessState.ALIVE,
                    events=[],
                )

            if event.ppid in self.processes:
                if event.pid not in self.processes[event.ppid].children:
                    self.processes[event.ppid].children.append(event.pid)

        return self.processes

    def find_zombie_origin(self) -> list[ZombieOrigin]:
        """Find the origin of zombie processes."""
        zombies: list[ZombieOrigin] = []

        for pid, node in self.processes.items():
            if node.state == ProcessState.ZOMBIE:
                parent = self.processes.get(node.events[0].ppid) if node.events else None
                zombies.append(
                    ZombieOrigin(
                        pid=pid,
                        name=node.name,
                        parent_pid=node.events[0].ppid if node.events else 0,
                        parent_name=parent.name if parent else "unknown",
                        reason="Parent not reaping child",
                        timestamp=node.events[-1].timestamp if node.events else datetime.now(),
                    )
                )

        return zombies

    def track_process_death(self) -> list[ProcessDeath]:
        """Track process death events and their cascade effects."""
        deaths: list[ProcessDeath] = []

        for pid, node in self.processes.items():
            death_events = [e for e in node.events if e.state == ProcessState.DEAD]
            if death_events:
                death_event = death_events[-1]
                children_killed = len(
                    [
                        c
                        for c in node.children
                        if c in self.processes
                        and self.processes[c].state == ProcessState.DEAD
                    ]
                )
                deaths.append(
                    ProcessDeath(
                        pid=pid,
                        name=node.name,
                        timestamp=death_event.timestamp,
                        exit_code=death_event.exit_code or -1,
                        children_killed=children_killed,
                    )
                )

        return deaths
