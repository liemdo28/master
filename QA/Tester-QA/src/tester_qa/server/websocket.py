from __future__ import annotations


class WebsocketEventBus:
    def __init__(self) -> None:
        self.events: list[dict] = []

    def publish(self, event: dict) -> None:
        self.events.append(event)

    def drain(self) -> list[dict]:
        drained = list(self.events)
        self.events.clear()
        return drained
