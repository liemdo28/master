"""Collapse Dataset Engine — accumulates operational failure intelligence."""
from .failure_corpus import FailureCorpus, FailureRecord
from .collapse_dataset import CollapseDataset, CollapseEvent
from .websocket_failures import WebSocketFailureDataset, WSFailureRecord
from .provider_failures import ProviderFailureDataset, ProviderFailureRecord
from .runtime_failures import RuntimeFailureDataset, RuntimeFailureRecord
from .recovery_failures import RecoveryFailureDataset, RecoveryFailureRecord
from .architecture_failures import ArchitectureFailureDataset, ArchitectureFailureRecord
from .timeline_index import TimelineIndex

__all__ = [
    "FailureCorpus", "FailureRecord",
    "CollapseDataset", "CollapseEvent",
    "WebSocketFailureDataset", "WSFailureRecord",
    "ProviderFailureDataset", "ProviderFailureRecord",
    "RuntimeFailureDataset", "RuntimeFailureRecord",
    "RecoveryFailureDataset", "RecoveryFailureRecord",
    "ArchitectureFailureDataset", "ArchitectureFailureRecord",
    "TimelineIndex",
]
