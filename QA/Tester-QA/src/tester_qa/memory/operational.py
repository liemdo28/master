from __future__ import annotations

from tester_qa.memory.memory_store import MemoryRecord, MemoryStore


class OperationalMemory:
    def __init__(self, store: MemoryStore | None = None) -> None:
        self.store = store or MemoryStore()

    def capture(self, project: str, summary: str, evidence: list[str] | None = None, confidence: float = 0.9) -> MemoryRecord:
        return self.store.write("operational", project, summary, evidence, confidence)
