from __future__ import annotations

from tester_qa.memory.memory_store import MemoryRecord, MemoryStore


class MemoryIndex:
    def __init__(self, store: MemoryStore | None = None) -> None:
        self.store = store or MemoryStore()

    def search(self, query: str) -> list[MemoryRecord]:
        return self.store.search(query)
