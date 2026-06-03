"""Browser warfare forensics module.

Provides timeline reconstruction and collapse chain analysis for browser warfare events:
- WarfareTimeline: chronological event builder
- BrowserCollapseChain: memory collapse propagation analysis
- RenderFailureChain: render pipeline failure analysis
- WebSocketFailureChain: WebSocket failure propagation analysis
- WarfareReconstructor: complete forensic report builder
"""
from .warfare_timeline import WarfareTimeline, TimelineEvent
from .browser_collapse_chain import BrowserCollapseChain
from .render_failure_chain import RenderFailureChain
from .websocket_failure_chain import WebSocketFailureChain
from .warfare_reconstruction import WarfareReconstructor

__all__ = [
    "WarfareTimeline",
    "TimelineEvent",
    "BrowserCollapseChain",
    "RenderFailureChain",
    "WebSocketFailureChain",
    "WarfareReconstructor",
]
