"""Resource Locking Module"""

import fcntl
import os
import socket
import threading
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class LockInfo:
    """Information about an active lock."""
    resource_type: str  # "file", "port"
    resource_id: str
    acquired_at: float
    owner: str


@dataclass
class DeadlockScenario:
    """A deadlock scenario for testing."""
    locks_involved: List[str]
    threads_involved: int
    resolved: bool = False
    duration: float = 0.0


class ResourceLocker:
    """Tests resource locking behavior and deadlock scenarios."""

    def __init__(self):
        self._file_locks: Dict[str, int] = {}  # path -> fd
        self._port_locks: Dict[int, socket.socket] = {}
        self._lock_info: Dict[str, LockInfo] = {}

    def lock_file(
        self, path: str, exclusive: bool = True, timeout: Optional[float] = None
    ) -> bool:
        """Lock a file for testing resource contention."""
        if path in self._file_locks:
            return True  # Already locked

        try:
            # Create the file if it doesn't exist
            os.makedirs(os.path.dirname(path) if os.path.dirname(path) else ".", exist_ok=True)
            fd = os.open(path, os.O_RDWR | os.O_CREAT)

            lock_type = fcntl.LOCK_EX if exclusive else fcntl.LOCK_SH
            if timeout is not None:
                lock_type |= fcntl.LOCK_NB
                start = time.time()
                while True:
                    try:
                        fcntl.flock(fd, lock_type)
                        break
                    except BlockingIOError:
                        if time.time() - start >= timeout:
                            os.close(fd)
                            return False
                        time.sleep(0.1)
            else:
                fcntl.flock(fd, lock_type | fcntl.LOCK_NB)

            self._file_locks[path] = fd
            self._lock_info[f"file:{path}"] = LockInfo(
                resource_type="file",
                resource_id=path,
                acquired_at=time.time(),
                owner=f"pid:{os.getpid()}",
            )
            return True
        except (OSError, BlockingIOError):
            return False

    def unlock_file(self, path: str) -> bool:
        """Unlock a previously locked file."""
        if path not in self._file_locks:
            return False

        try:
            fd = self._file_locks[path]
            fcntl.flock(fd, fcntl.LOCK_UN)
            os.close(fd)
            del self._file_locks[path]
            self._lock_info.pop(f"file:{path}", None)
            return True
        except OSError:
            return False

    def lock_port(self, port: int, host: str = "127.0.0.1") -> bool:
        """Lock a port by binding to it."""
        if port in self._port_locks:
            return True  # Already locked

        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.bind((host, port))
            sock.listen(1)
            self._port_locks[port] = sock
            self._lock_info[f"port:{port}"] = LockInfo(
                resource_type="port",
                resource_id=str(port),
                acquired_at=time.time(),
                owner=f"pid:{os.getpid()}",
            )
            return True
        except OSError:
            return False

    def unlock_port(self, port: int) -> bool:
        """Release a locked port."""
        if port not in self._port_locks:
            return False

        try:
            self._port_locks[port].close()
            del self._port_locks[port]
            self._lock_info.pop(f"port:{port}", None)
            return True
        except OSError:
            return False

    def create_deadlock_scenario(
        self, num_resources: int = 2, timeout: float = 5.0
    ) -> DeadlockScenario:
        """Create a controlled deadlock scenario for testing detection capabilities."""
        resources = [f"/tmp/tester_qa_deadlock_{i}.lock" for i in range(num_resources)]
        locks: List[threading.Lock] = [threading.Lock() for _ in range(num_resources)]
        deadlock_detected = threading.Event()
        threads_started = threading.Event()
        start_time = time.time()

        def worker_a() -> None:
            locks[0].acquire()
            threads_started.set()
            time.sleep(0.1)  # Give worker_b time to acquire lock 1
            acquired = locks[1].acquire(timeout=timeout / 2)
            if not acquired:
                deadlock_detected.set()
            locks[0].release()
            if acquired:
                locks[1].release()

        def worker_b() -> None:
            threads_started.wait()
            locks[1].acquire()
            time.sleep(0.1)  # Give worker_a time to try lock 1
            acquired = locks[0].acquire(timeout=timeout / 2)
            if not acquired:
                deadlock_detected.set()
            locks[1].release()
            if acquired:
                locks[0].release()

        thread_a = threading.Thread(target=worker_a, daemon=True)
        thread_b = threading.Thread(target=worker_b, daemon=True)

        thread_a.start()
        thread_b.start()

        thread_a.join(timeout=timeout)
        thread_b.join(timeout=timeout)

        duration = time.time() - start_time

        return DeadlockScenario(
            locks_involved=resources,
            threads_involved=2,
            resolved=not deadlock_detected.is_set(),
            duration=duration,
        )

    def get_active_locks(self) -> List[LockInfo]:
        """Get all currently active locks."""
        return list(self._lock_info.values())

    def release_all(self) -> None:
        """Release all held locks."""
        for path in list(self._file_locks.keys()):
            self.unlock_file(path)
        for port in list(self._port_locks.keys()):
            self.unlock_port(port)

    def __del__(self) -> None:
        """Cleanup on destruction."""
        self.release_all()
