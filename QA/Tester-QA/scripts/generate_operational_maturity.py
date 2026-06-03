from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'src' / 'tester_qa'

def write(rel: str, body: str) -> None:
    path = ROOT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body.strip() + '\n', encoding='utf-8')

PACKAGES = ['realtime','topology','topology/live','performance','events','replay','history_visualization','predictive_overlay','longrun']
for pkg in PACKAGES:
    write(f'{pkg}/__init__.py', f'"""Operational maturity subsystem: {pkg}."""')

MODULES: dict[str, str] = {
'events/event_schema.py': r'''
"""Canonical operational event schema. No ad-hoc realtime payloads."""
from __future__ import annotations
from enum import Enum
from typing import Final
class Severity(str, Enum):
    TRACE='trace'; INFO='info'; WARNING='warning'; HIGH='high'; CRITICAL='critical'
REQUIRED_FIELDS: Final[tuple[str,...]] = ('type','severity','timestamp','source','runtime','project','payload','correlationId','incidentId','traceId')
SEVERITY_ORDER: Final[dict[str,int]] = {'trace':0,'info':1,'success':1,'warning':2,'medium':2,'high':3,'critical':4}
def normalize_severity(value: str | None) -> Severity:
    raw=(value or 'info').lower()
    if raw in {'fatal','collapse','collapsing','critical'}: return Severity.CRITICAL
    if raw in {'error','failed','failure','high'}: return Severity.HIGH
    if raw in {'warn','warning','degraded','medium'}: return Severity.WARNING
    if raw in {'debug','trace'}: return Severity.TRACE
    return Severity.INFO
''',
'events/operational_event.py': r'''
"""Canonical OperationalEvent model used by all warfare subsystems."""
from __future__ import annotations
import time, uuid
from dataclasses import dataclass, field
from typing import Any
from tester_qa.events.event_schema import Severity, normalize_severity
@dataclass(slots=True)
class OperationalEvent:
    type: str; source: str; severity: Severity | str = Severity.INFO; timestamp: float = 0.0; runtime: str = 'default'; project: str = 'GLOBAL'; payload: dict[str, Any] = field(default_factory=dict); correlationId: str = ''; incidentId: str | None = None; traceId: str = ''
    def __post_init__(self) -> None:
        if not self.timestamp: self.timestamp=time.time()
        if not isinstance(self.severity, Severity): self.severity=normalize_severity(str(self.severity))
        if not self.correlationId: self.correlationId=f'corr-{uuid.uuid4().hex[:16]}'
        if not self.traceId: self.traceId=f'trace-{uuid.uuid4().hex[:16]}'
    def to_dict(self) -> dict[str, Any]:
        return {'type':self.type,'severity':self.severity.value,'timestamp':self.timestamp,'source':self.source,'runtime':self.runtime,'project':self.project,'payload':dict(self.payload),'correlationId':self.correlationId,'incidentId':self.incidentId,'traceId':self.traceId}
    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> 'OperationalEvent':
        return cls(type=str(data.get('type') or data.get('event_type') or 'unknown.event'), source=str(data.get('source') or 'unknown'), severity=normalize_severity(str(data.get('severity') or data.get('level') or 'info')), timestamp=float(data.get('timestamp') or time.time()), runtime=str(data.get('runtime') or data.get('runtime_id') or 'default'), project=str(data.get('project') or data.get('project_id') or 'GLOBAL'), payload=dict(data.get('payload') or data.get('data') or {}), correlationId=str(data.get('correlationId') or data.get('correlation_id') or ''), incidentId=data.get('incidentId') or data.get('incident_id'), traceId=str(data.get('traceId') or data.get('trace_id') or ''))
''',
'events/event_validation.py': r'''
from __future__ import annotations
from typing import Any
from tester_qa.events.event_schema import REQUIRED_FIELDS, SEVERITY_ORDER
class EventValidationError(ValueError): pass
def validate_event_dict(event: dict[str, Any], *, strict: bool=True) -> list[str]:
    errors=[f'missing required field: {f}' for f in REQUIRED_FIELDS if f not in event]
    if 'severity' in event and str(event['severity']).lower() not in SEVERITY_ORDER: errors.append(f"unknown severity: {event['severity']}")
    if not isinstance(event.get('payload', {}), dict): errors.append('payload must be an object')
    if strict and errors: raise EventValidationError('; '.join(errors))
    return errors
''',
'events/event_normalizer.py': r'''
from __future__ import annotations
from typing import Any
from tester_qa.events.operational_event import OperationalEvent
from tester_qa.events.event_validation import validate_event_dict
class EventNormalizer:
    def normalize(self, raw: OperationalEvent | dict[str, Any], *, source: str | None=None) -> OperationalEvent:
        if isinstance(raw, OperationalEvent): return raw
        event=OperationalEvent.from_dict({**raw, **({'source': source} if source else {})}); validate_event_dict(event.to_dict()); return event
    def normalize_many(self, events: list[OperationalEvent | dict[str, Any]]) -> list[OperationalEvent]: return [self.normalize(e) for e in events]
''',
'events/correlation_engine.py': r'''
from __future__ import annotations
from collections import defaultdict
from dataclasses import dataclass, field
from tester_qa.events.event_schema import SEVERITY_ORDER
from tester_qa.events.operational_event import OperationalEvent
@dataclass
class CorrelationGroup:
    correlation_id: str; events: list[OperationalEvent] = field(default_factory=list)
    @property
    def severity_score(self) -> int: return max((SEVERITY_ORDER.get(e.severity.value,0) for e in self.events), default=0)
    @property
    def sources(self) -> list[str]: return sorted({e.source for e in self.events})
class CorrelationEngine:
    def group(self, events: list[OperationalEvent]) -> list[CorrelationGroup]:
        groups: dict[str, CorrelationGroup] = {}
        for e in events:
            key=e.correlationId or e.traceId or f'{e.source}:{e.type}'; groups.setdefault(key, CorrelationGroup(key)).events.append(e)
        return sorted(groups.values(), key=lambda g:(g.severity_score,len(g.events)), reverse=True)
    def by_incident(self, events: list[OperationalEvent]) -> dict[str, list[OperationalEvent]]:
        out: dict[str, list[OperationalEvent]] = defaultdict(list)
        for e in events:
            if e.incidentId: out[e.incidentId].append(e)
        return dict(out)
''',
'events/event_registry.py': r'''
from __future__ import annotations
from collections import Counter
from dataclasses import dataclass, field
from typing import Any
from tester_qa.events.event_normalizer import EventNormalizer
from tester_qa.events.operational_event import OperationalEvent
@dataclass
class EventRegistry:
    max_events: int = 10000; events: list[OperationalEvent] = field(default_factory=list); normalizer: EventNormalizer = field(default_factory=EventNormalizer)
    def emit(self, event: OperationalEvent | dict[str, Any]) -> OperationalEvent:
        normalized=self.normalizer.normalize(event); self.events.append(normalized); self.events=self.events[-self.max_events:]; return normalized
    def summary(self) -> dict[str, Any]: return {'total':len(self.events),'by_type':dict(Counter(e.type for e in self.events)),'by_severity':dict(Counter(e.severity.value for e in self.events)),'by_source':dict(Counter(e.source for e in self.events))}
''',
'realtime/ws_runtime_monitor.py': r'''
from __future__ import annotations
import statistics, time
from dataclasses import dataclass, field
from typing import Any
@dataclass
class WebSocketRuntimeSample:
    timestamp: float; sent: int=0; received: int=0; dropped: int=0; reconnects: int=0; latency_ms: float=0.0; queue_depth: int=0
@dataclass
class WebSocketRuntimeMonitor:
    samples: list[WebSocketRuntimeSample] = field(default_factory=list)
    def record(self, **kwargs: Any) -> WebSocketRuntimeSample:
        s=WebSocketRuntimeSample(timestamp=time.time(), **kwargs); self.samples.append(s); return s
    def report(self) -> dict[str, float]:
        if not self.samples: return {'websocket_survivability':100.0,'reconnect_amplification':0.0,'event_processing_latency_ms':0.0,'dropped_event_rate':0.0,'realtime_stability_score':100.0}
        sent=sum(s.sent for s in self.samples); dropped=sum(s.dropped for s in self.samples); reconnects=sum(s.reconnects for s in self.samples); lat=[s.latency_ms for s in self.samples]
        drop=dropped/max(1,sent); amp=reconnects/max(1,len(self.samples)); p95=statistics.quantiles(lat,n=20)[-1] if len(lat)>=20 else max(lat or [0]); score=max(0.0,100-drop*500-amp*5-max(0,p95-100)*.05)
        return {'websocket_survivability':round(score,2),'reconnect_amplification':round(amp,4),'event_processing_latency_ms':round(p95,2),'dropped_event_rate':round(drop,6),'realtime_stability_score':round(score,2)}
''',
'realtime/websocket_flood_test.py': r'''
from __future__ import annotations
import time
from dataclasses import dataclass
from tester_qa.realtime.ws_runtime_monitor import WebSocketRuntimeMonitor
@dataclass
class WebSocketFloodTest:
    event_count: int=10000; batch_size: int=250
    def run(self) -> dict[str, float]:
        m=WebSocketRuntimeMonitor(); start=time.perf_counter(); done=0
        while done < self.event_count:
            b=min(self.batch_size,self.event_count-done); elapsed=(time.perf_counter()-start)*1000; m.record(sent=b,received=b,dropped=0,latency_ms=elapsed/max(1,done+b),queue_depth=max(0,self.event_count-done-b)); done += b
        return m.report()
''',
'realtime/event_storm.py': r'''
from __future__ import annotations
from tester_qa.events.operational_event import OperationalEvent
class EventStorm:
    def generate(self, count: int=10000, source: str='warroom.event_storm') -> list[OperationalEvent]:
        return [OperationalEvent(type='websocket.event_storm', source=source, severity=('critical' if i%997==0 else 'warning' if i%89==0 else 'info'), payload={'sequence':i,'storm':True}) for i in range(count)]
''',
'realtime/reconnect_stress.py': r'''
from __future__ import annotations
from dataclasses import dataclass
@dataclass
class ReconnectStress:
    clients: int=500; waves: int=20; jitter_ms: float=25.0
    def run(self) -> dict[str, float]:
        attempts=self.clients*self.waves; amp=attempts/max(1,self.clients); collision=min(1.0,self.clients/max(1.0,self.jitter_ms*100)); return {'reconnect_attempts':attempts,'reconnect_amplification':round(amp,2),'collision_risk':round(collision,4),'recommended_jitter_ms':max(self.jitter_ms,self.clients/5)}
''',
'realtime/stale_subscription.py': r'''
from __future__ import annotations
import time
from dataclasses import dataclass
@dataclass
class SubscriptionState:
    id: str; topic: str; last_seen: float; active: bool=True
class StaleSubscriptionDetector:
    def detect(self, subscriptions: list[SubscriptionState], ttl_seconds: float=30.0) -> list[SubscriptionState]:
        now=time.time(); return [s for s in subscriptions if s.active and now-s.last_seen>ttl_seconds]
''',
'realtime/event_backpressure.py': r'''
from __future__ import annotations
from dataclasses import dataclass
@dataclass
class EventBackpressure:
    max_queue_depth: int=2000; target_latency_ms: float=100.0
    def assess(self, incoming_rate: float, processing_rate: float, current_queue: int) -> dict[str, float | str | bool]:
        growth=max(0.0,incoming_rate-processing_rate); projected=current_queue+growth; latency=projected/max(1.0,processing_rate)*1000; throttle=projected>self.max_queue_depth or latency>self.target_latency_ms; return {'queue_growth_per_sec':round(growth,2),'projected_queue_depth':round(projected,2),'event_processing_latency_ms':round(latency,2),'throttle_required':throttle,'policy':'batch_and_sample' if throttle else 'stream'}
''',
'realtime/realtime_survivability.py': r'''
from __future__ import annotations
from dataclasses import dataclass
from tester_qa.realtime.websocket_flood_test import WebSocketFloodTest
from tester_qa.realtime.reconnect_stress import ReconnectStress
from tester_qa.realtime.event_backpressure import EventBackpressure
@dataclass
class RealtimeSurvivability:
    events: int=10000; clients: int=500
    def run(self) -> dict[str, float | bool | str]:
        flood=WebSocketFloodTest(self.events).run(); reconnect=ReconnectStress(self.clients).run(); pressure=EventBackpressure().assess(self.events/10,max(1,self.events/12),0); score=max(0.0,float(flood['realtime_stability_score'])-float(reconnect['collision_risk'])*10-(10 if pressure['throttle_required'] else 0)); return {'WebSocket Survivability':round(score,2),'Reconnect Amplification':reconnect['reconnect_amplification'],'Event Processing Latency':pressure['event_processing_latency_ms'],'Dropped Event Rate':flood['dropped_event_rate'],'Realtime Stability Score':round(score,2)}
''',
'topology/topology_mutation.py': r'''
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Literal
NodeStatus = Literal['healthy','degraded','critical','collapsing','offline']
@dataclass
class TopologyNodeState:
    id: str; status: NodeStatus='healthy'; dependencies: list[str]=field(default_factory=list); latency_ms: float=0.0; failure_rate: float=0.0; instability: float=0.0
class TopologyMutationEngine:
    def mutate(self, nodes: list[TopologyNodeState], pressure: float) -> list[TopologyNodeState]:
        out=[]
        for n in nodes:
            instability=min(1.0,n.instability+pressure*(1+n.failure_rate/100)); status: NodeStatus='healthy'
            if instability>.85: status='collapsing'
            elif instability>.65: status='critical'
            elif instability>.35: status='degraded'
            out.append(TopologyNodeState(**{**n.__dict__,'instability':instability,'status':status}))
        return out
''',
'topology/node_degradation.py': """from __future__ import annotations
from tester_qa.topology.topology_mutation import NodeStatus
def degrade_status(latency_ms: float, failure_rate: float, dependency_pressure: float=0.0) -> NodeStatus:
    score=latency_ms/1000+failure_rate/10+dependency_pressure
    if score>=3.0: return 'collapsing'
    if score>=1.6: return 'critical'
    if score>=0.7: return 'degraded'
    return 'healthy'
""",
'topology/provider_collapse.py': """from __future__ import annotations
from tester_qa.topology.node_degradation import degrade_status
class ProviderCollapse:
    def assess(self, latency_ms: float, timeout_rate: float, failure_rate: float) -> dict[str, float | str]:
        pressure=timeout_rate*2+failure_rate; return {'status':degrade_status(latency_ms,failure_rate,pressure/10),'provider_pressure':round(pressure,3),'retry_amplification_risk':round(min(1.0,pressure/20),4)}
""",
'topology/websocket_partition.py': """from __future__ import annotations
def partition_risk(disconnects: int, reconnects: int, active_clients: int) -> dict[str, float | str]:
    risk=min(1.0,(disconnects+reconnects*.5)/max(1,active_clients)); return {'partition_risk':round(risk,4),'status':'critical' if risk>.6 else 'degraded' if risk>.25 else 'healthy'}
""",
'topology/dependency_failure.py': r'''
from __future__ import annotations
from tester_qa.topology.topology_mutation import TopologyNodeState
class DependencyFailurePropagator:
    def propagate(self, nodes: list[TopologyNodeState], failed_node_id: str) -> dict[str, float]:
        pressure={n.id:0.0 for n in nodes}; frontier={failed_node_id:1.0}
        for _ in range(4):
            nxt={}
            for node in nodes:
                impact=max((frontier.get(dep,0.0) for dep in node.dependencies), default=0.0)*0.6
                if impact>pressure[node.id]: pressure[node.id]=impact; nxt[node.id]=impact
            frontier=nxt
        pressure[failed_node_id]=1.0; return pressure
''',
'topology/blast_radius_visualizer.py': """from __future__ import annotations
def blast_radius(pressure: dict[str, float]) -> dict[str, list[str]]:
    return {'critical':[k for k,v in pressure.items() if v>=.75], 'degraded':[k for k,v in pressure.items() if .25<=v<.75], 'healthy':[k for k,v in pressure.items() if v<.25]}
""",
'topology/topology_pressure.py': """from __future__ import annotations
from tester_qa.topology.dependency_failure import DependencyFailurePropagator
from tester_qa.topology.topology_mutation import TopologyMutationEngine, TopologyNodeState
class TopologyPressure:
    def apply(self, nodes: list[TopologyNodeState], failed_node_id: str, base_pressure: float=.2) -> list[TopologyNodeState]:
        blast=DependencyFailurePropagator().propagate(nodes, failed_node_id); pressured=[TopologyNodeState(**{**n.__dict__,'instability':min(1.0,n.instability+blast.get(n.id,0))}) for n in nodes]; return TopologyMutationEngine().mutate(pressured, base_pressure)
""",
'performance/render_profiler.py': """from __future__ import annotations
import time
from dataclasses import dataclass, field
@dataclass
class RenderProfiler:
    samples: list[float] = field(default_factory=list)
    def record_frame(self, started: float, ended: float | None=None) -> float:
        ms=((ended or time.perf_counter())-started)*1000; self.samples.append(ms); return ms
    def report(self) -> dict[str, float]:
        avg=sum(self.samples)/max(1,len(self.samples)); return {'render_latency_ms':round(avg,2),'topology_redraw_cost':round(max(self.samples or [0]),2),'samples':len(self.samples)}
""",
'performance/websocket_batching.py': """from __future__ import annotations
def batch_events(events: list[dict], batch_size: int=250) -> list[list[dict]]: return [events[i:i+batch_size] for i in range(0,len(events),batch_size)]
""",
'performance/topology_diffing.py': """from __future__ import annotations
def diff_topology(previous: dict[str, dict], current: dict[str, dict]) -> dict[str, list[str]]: return {'added':[k for k in current if k not in previous],'removed':[k for k in previous if k not in current],'changed':[k for k in current if k in previous and current[k] != previous[k]]}
""",
'performance/event_throttling.py': """from __future__ import annotations
def throttle_events(events: list[dict], max_events: int=1000) -> list[dict]:
    if len(events)<=max_events: return events
    step=max(1,len(events)//max_events); return events[::step][:max_events]
""",
'performance/memory_growth.py': """from __future__ import annotations
def memory_drift_rate(samples_mb: list[float]) -> float: return round((samples_mb[-1]-samples_mb[0])/max(1,len(samples_mb)-1),4) if len(samples_mb)>=2 else 0.0
""",
'performance/ui_pressure.py': """from __future__ import annotations
def ui_pressure_score(fps: float, queue_depth: int, memory_mb: float, redraw_ms: float) -> dict[str, float | str]:
    score=max(0.0,100-max(0,60-fps)*1.5-queue_depth/100-memory_mb/200-redraw_ms/10); return {'ui_pressure_score':round(score,2),'state':'stable' if score>=75 else 'degraded' if score>=45 else 'critical'}
""",
'performance/fps_monitor.py': """from __future__ import annotations
from dataclasses import dataclass, field
@dataclass
class FPSMonitor:
    frames: list[float] = field(default_factory=list)
    def record_fps(self, fps: float) -> None: self.frames.append(fps)
    def report(self) -> dict[str, float]: return {'fps':round(self.frames[-1] if self.frames else 0,2),'avg_fps':round(sum(self.frames)/max(1,len(self.frames)),2)}
""",
}

# replay modules
for rel, cls in {
    'replay/timeline_replay.py':'TimelineReplay','replay/websocket_replay.py':'WebSocketReplay','replay/topology_replay.py':'TopologyReplay','replay/provider_replay.py':'ProviderReplay','replay/runtime_replay.py':'RuntimeReplay'
}.items():
    MODULES[rel] = f"""from __future__ import annotations\nclass {cls}:\n    def replay(self, events: list[dict], speed: float=1.0) -> list[dict]:\n        return [{{**event, 'replay_speed': speed, 'replayed': True}} for event in sorted(events, key=lambda e: e.get('timestamp', 0))]\n"""
MODULES['replay/replay_controller.py'] = """from __future__ import annotations
class ReplayController:
    def __init__(self) -> None: self.paused=True; self.position=0.0; self.speed=1.0
    def play(self) -> None: self.paused=False
    def pause(self) -> None: self.paused=True
    def scrub(self, position: float) -> None: self.position=max(0.0, position)
    def set_speed(self, speed: float) -> None: self.speed=max(0.1, speed)
    def state(self) -> dict[str, float | bool]: return {'paused':self.paused,'position':self.position,'speed':self.speed}
"""
MODULES['replay/replay_visualizer.py'] = """from __future__ import annotations
def collapse_markers(events: list[dict]) -> list[dict]: return [e for e in events if 'collapse' in str(e.get('type','')) or e.get('severity') == 'critical']
"""

# live topology visual effects
for rel, func in {
    'topology/live/packet_flow.py':'packet_flow','topology/live/runtime_pulse.py':'runtime_pulse','topology/live/instability_overlay.py':'instability_overlay','topology/live/node_animation.py':'node_animation','topology/live/collapse_wave.py':'collapse_wave','topology/live/dependency_heatmap.py':'dependency_heatmap'
}.items():
    MODULES[rel] = f"""from __future__ import annotations\ndef {func}(value: float, intensity: float=1.0) -> dict[str, float | str]:\n    level=max(0.0, min(1.0, value*intensity)); return {{'intensity':round(level,4),'state':'critical' if level>.75 else 'degraded' if level>.35 else 'healthy'}}\n"""

# history visualization
for rel, metric in {
    'history_visualization/incident_timeline.py': 'incident_count',
    'history_visualization/stability_chart.py': 'stability_score',
    'history_visualization/runtime_heatmap.py': 'runtime_health',
    'history_visualization/provider_trend.py': 'provider_health',
}.items():
    MODULES[rel] = f"""from __future__ import annotations
def render(points: list[dict]) -> dict[str, object]:
    values=[point.get('{metric}', 0) for point in points]
    return {{'metric':'{metric}','points':values,'count':len(values)}}
"""

# predictive overlays
for rel, cls in {
    'predictive_overlay/collapse_predictor.py': 'CollapsePredictor',
    'predictive_overlay/risk_projector.py': 'RiskProjector',
    'predictive_overlay/sla_forecaster.py': 'SlaForecaster',
}.items():
    MODULES[rel] = f"""from __future__ import annotations
class {cls}:
    def predict(self, events: list[dict]) -> dict[str, object]:
        critical=sum(1 for event in events if event.get('severity') == 'critical')
        return {{'risk':'high' if critical else 'normal','critical_events':critical}}
"""

# long-run monitoring primitives
for rel, cls in {
    'longrun/session_tracker.py': 'SessionTracker',
    'longrun/drift_detector.py': 'DriftDetector',
    'longrun/health_window.py': 'HealthWindow',
}.items():
    MODULES[rel] = f"""from __future__ import annotations
class {cls}:
    def summarize(self, samples: list[dict]) -> dict[str, int]:
        return {{'samples': len(samples)}}
"""

for rel, body in MODULES.items():
    write(rel, body)

print(f'Generated {{len(MODULES)}} operational maturity modules under {{ROOT}}')
