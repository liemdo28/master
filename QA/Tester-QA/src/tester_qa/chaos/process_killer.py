"""
Process Killer Engine
Simulates killing processes, zombie processes, and orphan workers.
"""
import asyncio
import os
import signal
import random
import time
import psutil
from typing import Any, Optional
from dataclasses import dataclass, field
from enum import Enum


class KillMode(Enum):
    RANDOM_PROCESS = "random_process"
    CHILD_PROCESS = "child_process"
    PARENT_PROCESS = "parent_process"
    GRACEFUL_KILL = "graceful_kill"
    FORCE_KILL = "force_kill"
    ZOMBIE_CREATION = "zombie_creation"


@dataclass
class KillEvent:
    timestamp: float
    mode: KillMode
    target_pid: int
    target_name: str
    success: bool
    details: dict = field(default_factory=dict)


class ProcessKillerEngine:
    """
    Simulates process killing to test system resilience.
    """

    def __init__(self):
        self.kill_log: list[KillEvent] = []
        self._target_pids: list[int] = []
        self._created_processes: list = []
        self._safe_mode = True  # Won't kill critical processes by default

    def configure_targets(self, pids: list[int]):
        """Configure target PIDs to potentially kill."""
        self._target_pids = pids

    def add_target(self, pid: int):
        """Add a process to kill targets."""
        if pid not in self._target_pids:
            self._target_pids.append(pid)

    def clear_targets(self):
        """Clear all targets."""
        self._target_pids.clear()

    def _is_safe_to_kill(self, pid: int) -> bool:
        """Check if process is safe to kill (not system critical)."""
        try:
            proc = psutil.Process(pid)
            name = proc.name().lower()
            # List of protected process names
            protected = [
                'system', 'kernel', 'init', 'launchd', 'spawn', 'bash', 'zsh',
                'sshd', 'systemd', 'docker', 'containerd'
            ]
            for p in protected:
                if p in name:
                    return False
            return True
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            return False

    async def kill_random_process(self, safe_only: bool = True) -> KillEvent:
        """Kill a random process."""
        if not self._target_pids:
            # Get all processes
            pids = psutil.pids()
        else:
            pids = self._target_pids.copy()

        if safe_only:
            pids = [p for p in pids if self._is_safe_to_kill(p)]

        if not pids:
            event = KillEvent(
                timestamp=time.time(),
                mode=KillMode.RANDOM_PROCESS,
                target_pid=0,
                target_name="none",
                success=False,
                details={"error": "No safe processes to kill"}
            )
            self.kill_log.append(event)
            return event

        target_pid = random.choice(pids)
        return await self._kill_process(target_pid, KillMode.RANDOM_PROCESS)

    async def kill_child_processes(self, parent_pid: int = None) -> list[KillEvent]:
        """Kill child processes of a parent."""
        if parent_pid is None:
            parent_pid = os.getpid()

        try:
            parent = psutil.Process(parent_pid)
            children = parent.children(recursive=True)
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            return []

        events = []
        for child in children:
            event = await self._kill_process(child.pid, KillMode.CHILD_PROCESS)
            events.append(event)

        return events

    async def force_kill_process(self, pid: int) -> KillEvent:
        """Force kill a process immediately."""
        return await self._kill_process(pid, KillMode.FORCE_KILL, force=True)

    async def graceful_kill_process(self, pid: int) -> KillEvent:
        """Gracefully terminate a process."""
        return await self._kill_process(pid, KillMode.GRACEFUL_KILL, graceful=True)

    async def _kill_process(
        self,
        pid: int,
        mode: KillMode,
        force: bool = False,
        graceful: bool = False
    ) -> KillEvent:
        """Internal method to kill a process."""
        try:
            proc = psutil.Process(pid)
            name = proc.name()
            pid_exists = True
        except (psutil.NoSuchProcess, psutil.AccessDenied) as e:
            event = KillEvent(
                timestamp=time.time(),
                mode=mode,
                target_pid=pid,
                target_name="unknown",
                success=False,
                details={"error": str(e)}
            )
            self.kill_log.append(event)
            return event

        success = False
        try:
            if force:
                proc.kill()
                success = True
            elif graceful:
                proc.terminate()
                proc.wait(timeout=5)
                success = True
            else:
                # Random between SIGTERM and SIGKILL
                sig = signal.SIGKILL if random.random() > 0.5 else signal.SIGTERM
                os.kill(pid, sig)
                success = True

        except (psutil.NoSuchProcess, psutil.AccessDenied, ProcessLookupError) as e:
            success = False

        event = KillEvent(
            timestamp=time.time(),
            mode=mode,
            target_pid=pid,
            target_name=name,
            success=success,
            details={"force": force, "graceful": graceful}
        )
        self.kill_log.append(event)
        return event

    async def create_zombie_process(self) -> int:
        """Create a zombie process for testing."""
        pid = os.fork()
        if pid == 0:
            # Child - exit immediately
            os._exit(0)

        # Parent - don't wait for child, let it become zombie
        self._created_processes.append(pid)
        self.kill_log.append(KillEvent(
            timestamp=time.time(),
            mode=KillMode.ZOMBIE_CREATION,
            target_pid=pid,
            target_name="zombie",
            success=True,
            details={"note": "Process will become zombie"}
        ))
        await asyncio.sleep(0.1)  # Let child exit
        return pid

    async def orphan_process(self) -> int:
        """Create an orphan process (child whose parent died)."""
        pid = os.fork()
        if pid == 0:
            # Child - fork again so original parent can exit
            inner_pid = os.fork()
            if inner_pid == 0:
                # Grandchild - this becomes orphan
                await asyncio.sleep(60)  # Wait to be adopted
                os._exit(0)
            else:
                # Child - exit immediately
                os._exit(0)
        else:
            # Parent - wait for child
            os.waitpid(pid, 0)

        self._created_processes.append(pid)
        return pid

    def get_zombie_processes(self) -> list[dict]:
        """Get list of zombie processes."""
        zombies = []
        for proc in psutil.process_iter(['pid', 'name', 'status']):
            try:
                if proc.info['status'] == psutil.STATUS_ZOMBIE:
                    zombies.append({
                        'pid': proc.info['pid'],
                        'name': proc.info['name'],
                    })
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
        return zombies

    def get_process_stats(self) -> dict:
        """Get process statistics."""
        return {
            "total_kills": len(self.kill_log),
            "successful_kills": len([e for e in self.kill_log if e.success]),
            "failed_kills": len([e for e in self.kill_log if not e.success]),
            "zombie_count": len(self.get_zombie_processes()),
            "tracked_processes": len(self._created_processes),
            "recent_events": [
                {
                    "timestamp": e.timestamp,
                    "mode": e.mode.value,
                    "target_pid": e.target_pid,
                    "success": e.success,
                }
                for e in self.kill_log[-10:]
            ],
        }

    def export_kill_log(self) -> list[dict]:
        """Export kill log."""
        return [
            {
                "timestamp": e.timestamp,
                "mode": e.mode.value,
                "target_pid": e.target_pid,
                "target_name": e.target_name,
                "success": e.success,
                "details": e.details,
            }
            for e in self.kill_log
        ]


# Global singleton
_process_killer_engine: Optional[ProcessKillerEngine] = None


def get_process_killer_engine() -> ProcessKillerEngine:
    global _process_killer_engine
    if _process_killer_engine is None:
        _process_killer_engine = ProcessKillerEngine()
    return _process_killer_engine
