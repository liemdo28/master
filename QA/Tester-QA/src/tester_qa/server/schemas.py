from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ApiRoute:
    method: str
    path: str
    action: str

    def to_dict(self) -> dict:
        return self.__dict__.copy()
