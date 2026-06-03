from __future__ import annotations

from tester_qa.memory.memory_store import MemoryRecord, MemoryStore


class EpisodicMemory:
    def __init__(self, store: MemoryStore | None = None) -> None:
        self.store = store or MemoryStore()

    def capture(self, project: str, summary: str, evidence: list[str] | None = None, confidence: float = 0.85) -> MemoryRecord:
        return self.store.write("episodic", project, summary, evidence, confidence)
