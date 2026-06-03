"""Instability Map - Maps system instability across components and routes."""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Set, Tuple


@dataclass
class InstabilityPoint:
    """Represents a point of instability in the system."""
    component_id: str
    instability_score: float
    instability_type: str
    contributing_factors: List[str] = field(default_factory=list)
    neighbors: List[str] = field(default_factory=list)


@dataclass
class InstabilityRoute:
    """A route through the system with instability data."""
    route_id: str
    path: List[str]
    total_instability: float
    bottleneck_components: List[str] = field(default_factory=list)
    estimated_failure_probability: float = 0.0


@dataclass
class SubsystemAnalysis:
    """Analysis of a subsystem's fragility."""
    subsystem_id: str
    fragility_score: float
    weak_points: List[str] = field(default_factory=list)
    resilience_factors: List[str] = field(default_factory=list)
    failure_cascade_risk: float = 0.0


class InstabilityMap:
    """Maps and analyzes system instability across components and routes."""

    def __init__(self):
        self.instability_points: Dict[str, InstabilityPoint] = {}
        self.route_graph: Dict[str, List[str]] = {}
        self.subsystem_boundaries: Dict[str, List[str]] = {}
        self.stability_history: List[Dict[str, float]] = []
        self._instability_thresholds = {
            'low': 0.3,
            'medium': 0.6,
            'high': 0.8,
            'critical': 0.95
        }

    def map_instability(
        self,
        components: List[Dict[str, Any]],
        relationships: Optional[List[Tuple[str, str]]] = None
    ) -> Dict[str, InstabilityPoint]:
        """
        Map instability across all system components.
        
        Args:
            components: List of component dictionaries with metrics
            relationships: Optional list of component relationships
            
        Returns:
            Dictionary mapping component IDs to InstabilityPoint
        """
        self.instability_points.clear()
        
        for component in components:
            comp_id = component.get('id', 'unknown')
            
            metrics = component.get('metrics', {})
            instability_score = self._calculate_instability_score(metrics)
            instability_type = self._classify_instability(instability_score, metrics)
            factors = self._identify_contributing_factors(metrics)
            
            point = InstabilityPoint(
                component_id=comp_id,
                instability_score=instability_score,
                instability_type=instability_type,
                contributing_factors=factors,
                neighbors=[]
            )
            
            self.instability_points[comp_id] = point
        
        if relationships:
            self._update_neighbors(relationships)
            self.route_graph = self._build_route_graph(relationships)
        
        self._propagate_instability()
        
        return self.instability_points

    def find_unstable_routes(
        self,
        start_component: Optional[str] = None,
        end_component: Optional[str] = None
    ) -> List[InstabilityRoute]:
        """
        Find routes through the system that are likely to be unstable.
        
        Args:
            start_component: Optional starting component
            end_component: Optional ending component
            
        Returns:
            List of InstabilityRoute objects sorted by total instability
        """
        unstable_routes: List[InstabilityRoute] = []
        
        if not self.route_graph:
            return unstable_routes
        
        all_routes = self._find_all_routes(start_component, end_component)
        
        for route in all_routes:
            route_instability = self._calculate_route_instability(route)
            
            if route_instability > self._instability_thresholds['medium']:
                bottleneck = self._find_route_bottlenecks(route)
                failure_prob = self._estimate_route_failure_probability(route)
                
                route_obj = InstabilityRoute(
                    route_id=f"route_{'_'.join(route)}",
                    path=route,
                    total_instability=route_instability,
                    bottleneck_components=bottleneck,
                    estimated_failure_probability=failure_prob
                )
                
                unstable_routes.append(route_obj)
        
        unstable_routes.sort(key=lambda r: r.total_instability, reverse=True)
        
        return unstable_routes

    def identify_fragile_subsystems(
        self,
        subsystem_definitions: Dict[str, List[str]]
    ) -> List[SubsystemAnalysis]:
        """
        Identify which subsystems are most fragile.
        
        Args:
            subsystem_definitions: Dictionary mapping subsystem IDs to component lists
            
        Returns:
            List of SubsystemAnalysis sorted by fragility score
        """
        analyses: List[SubsystemAnalysis] = []
        
        self.subsystem_boundaries = subsystem_definitions
        
        for subsys_id, components in subsystem_definitions.items():
            weak_points: List[str] = []
            resilience_factors: List[str] = []
            total_instability = 0.0
            component_count = 0
            
            for comp_id in components:
                if comp_id in self.instability_points:
                    point = self.instability_points[comp_id]
                    total_instability += point.instability_score
                    component_count += 1
                    
                    if point.instability_score > self._instability_thresholds['high']:
                        weak_points.append(comp_id)
                    
                    if point.instability_score < self._instability_thresholds['low']:
                        resilience_factors.append(comp_id)
            
            if component_count == 0:
                continue
            
            avg_instability = total_instability / component_count
            fragility_score = self._calculate_fragility_score(
                avg_instability, weak_points, components
            )
            
            cascade_risk = self._calculate_cascade_risk(components)
            
            analysis = SubsystemAnalysis(
                subsystem_id=subsys_id,
                fragility_score=fragility_score,
                weak_points=weak_points,
                resilience_factors=resilience_factors,
                failure_cascade_risk=cascade_risk
            )
            
            analyses.append(analysis)
        
        analyses.sort(key=lambda a: a.fragility_score, reverse=True)
        
        return analyses

    def _calculate_instability_score(
        self,
        metrics: Dict[str, float]
    ) -> float:
        """Calculate overall instability score from metrics."""
        if not metrics:
            return 0.0
        
        score_components = []
        
        if 'error_rate' in metrics:
            score_components.append(min(1.0, metrics['error_rate'] * 10))
        
        if 'latency_ms' in metrics:
            normalized_latency = min(1.0, metrics['latency_ms'] / 5000)
            score_components.append(normalized_latency)
        
        if 'cpu_percent' in metrics:
            score_components.append(metrics['cpu_percent'] / 100)
        
        if 'memory_percent' in metrics:
            score_components.append(metrics['memory_percent'] / 100)
        
        if 'pending_requests' in metrics:
            normalized_pending = min(1.0, metrics['pending_requests'] / 1000)
            score_components.append(normalized_pending)
        
        if 'connection_errors' in metrics:
            score_components.append(min(1.0, metrics['connection_errors'] / 100))
        
        if not score_components:
            return 0.0
        
        base_score = sum(score_components) / len(score_components)
        
        critical_count = len([s for s in score_components if s > 0.8])
        penalty = critical_count * 0.1
        
        return min(1.0, base_score + penalty)

    def _classify_instability(
        self,
        score: float,
        metrics: Dict[str, float]
    ) -> str:
        """Classify the type of instability."""
        if score >= self._instability_thresholds['critical']:
            return "CRITICAL"
        elif score >= self._instability_thresholds['high']:
            return "HIGH"
        elif score >= self._instability_thresholds['medium']:
            return "MODERATE"
        elif score >= self._instability_thresholds['low']:
            return "LOW"
        else:
            return "STABLE"

    def _identify_contributing_factors(
        self,
        metrics: Dict[str, float]
    ) -> List[str]:
        """Identify factors contributing to instability."""
        factors: List[str] = []
        
        if metrics.get('error_rate', 0) > 0.05:
            factors.append("elevated_error_rate")
        
        if metrics.get('latency_ms', 0) > 1000:
            factors.append("high_latency")
        
        if metrics.get('cpu_percent', 0) > 85:
            factors.append("cpu_pressure")
        
        if metrics.get('memory_percent', 0) > 90:
            factors.append("memory_pressure")
        
        if metrics.get('pending_requests', 0) > 500:
            factors.append("backlog_growth")
        
        if metrics.get('connection_errors', 0) > 10:
            factors.append("connection_instability")
        
        return factors

    def _update_neighbors(
        self,
        relationships: List[Tuple[str, str]]
    ) -> None:
        """Update neighbor relationships between components."""
        for source, target in relationships:
            if source in self.instability_points:
                if target not in self.instability_points[source].neighbors:
                    self.instability_points[source].neighbors.append(target)
            
            if target in self.instability_points:
                if source not in self.instability_points[target].neighbors:
                    self.instability_points[target].neighbors.append(source)

    def _build_route_graph(
        self,
        relationships: List[Tuple[str, str]]
    ) -> Dict[str, List[str]]:
        """Build adjacency list representation of the route graph."""
        graph: Dict[str, List[str]] = {}
        
        for source, target in relationships:
            if source not in graph:
                graph[source] = []
            if target not in graph:
                graph[target] = []
            
            graph[source].append(target)
        
        return graph

    def _propagate_instability(self) -> None:
        """Propagate instability through connected components."""
        propagation_rounds = 3
        
        for _ in range(propagation_rounds):
            new_instabilities: Dict[str, float] = {}
            
            for comp_id, point in self.instability_points.items():
                if not point.neighbors:
                    continue
                
                neighbor_instabilities = [
                    self.instability_points[n].instability_score
                    for n in point.neighbors
                    if n in self.instability_points
                ]
                
                if neighbor_instabilities:
                    avg_neighbor = sum(neighbor_instabilities) / len(neighbor_instabilities)
                    propagated = point.instability_score + avg_neighbor * 0.1
                    new_instabilities[comp_id] = min(1.0, propagated)
            
            for comp_id, new_inst in new_instabilities.items():
                self.instability_points[comp_id].instability_score = new_inst

    def _find_all_routes(
        self,
        start: Optional[str],
        end: Optional[str],
        max_depth: int = 10
    ) -> List[List[str]]:
        """Find all routes between start and end components."""
        routes: List[List[str]] = []
        
        if not self.route_graph:
            return routes
        
        start_nodes = [start] if start else list(self.route_graph.keys())
        
        for start_node in start_nodes:
            visited: Set[str] = set()
            current_path: List[str] = [start_node]
            
            self._dfs_routes(
                start_node, end, visited, current_path, routes, max_depth
            )
        
        return routes

    def _dfs_routes(
        self,
        current: str,
        end: Optional[str],
        visited: Set[str],
        path: List[str],
        routes: List[List[str]],
        max_depth: int
    ) -> None:
        """Depth-first search to find routes."""
        if len(path) > max_depth:
            return
        
        if end and current == end:
            routes.append(path.copy())
            return
        
        if current not in self.route_graph:
            if not end:
                routes.append(path.copy())
            return
        
        for neighbor in self.route_graph[current]:
            if neighbor not in visited:
                visited.add(neighbor)
                path.append(neighbor)
                
                self._dfs_routes(neighbor, end, visited, path, routes, max_depth)
                
                path.pop()
                visited.remove(neighbor)

    def _calculate_route_instability(
        self,
        route: List[str]
    ) -> float:
        """Calculate total instability for a route."""
        if not route:
            return 0.0
        
        total_instability = 0.0
        
        for comp_id in route:
            if comp_id in self.instability_points:
                total_instability += self.instability_points[comp_id].instability_score
        
        avg_instability = total_instability / len(route)
        
        bottleneck_penalty = 0.0
        for comp_id in route:
            if comp_id in self.instability_points:
                if self.instability_points[comp_id].instability_score > 0.8:
                    bottleneck_penalty += 0.1
        
        return min(1.0, avg_instability + bottleneck_penalty)

    def _find_route_bottlenecks(
        self,
        route: List[str]
    ) -> List[str]:
        """Find bottleneck components in a route."""
        bottlenecks: List[str] = []
        
        for comp_id in route:
            if comp_id in self.instability_points:
                if self.instability_points[comp_id].instability_score > 0.7:
                    bottlenecks.append(comp_id)
        
        return bottlenecks

    def _estimate_route_failure_probability(
        self,
        route: List[str]
    ) -> float:
        """Estimate probability of route failure."""
        if not route:
            return 0.0
        
        failure_probs: List[float] = []
        
        for comp_id in route:
            if comp_id in self.instability_points:
                prob = self.instability_points[comp_id].instability_score
                failure_probs.append(prob)
        
        if not failure_probs:
            return 0.0
        
        max_prob = max(failure_probs)
        
        cascade_factor = len([p for p in failure_probs if p > 0.5]) / len(failure_probs)
        
        return min(1.0, max_prob + cascade_factor * 0.2)

    def _calculate_fragility_score(
        self,
        avg_instability: float,
        weak_points: List[str],
        all_components: List[str]
    ) -> float:
        """Calculate overall fragility score for a subsystem."""
        base_fragility = avg_instability
        
        weak_ratio = len(weak_points) / max(len(all_components), 1)
        
        weak_penalty = weak_ratio * 0.3
        
        isolation_risk = 0.0
        for wp in weak_points:
            if wp in self.instability_points:
                if not self.instability_points[wp].neighbors:
                    isolation_risk += 0.1
        
        return min(1.0, base_fragility + weak_penalty + isolation_risk)

    def _calculate_cascade_risk(
        self,
        components: List[str]
    ) -> float:
        """Calculate risk of failure cascade within subsystem."""
        cascade_connections = 0
        total_possible = 0
        
        for comp_id in components:
            if comp_id in self.instability_points:
                neighbors_in_subsystem = [
                    n for n in self.instability_points[comp_id].neighbors
                    if n in components
                ]
                cascade_connections += len(neighbors_in_subsystem)
                total_possible += 1
        
        if total_possible == 0:
            return 0.0
        
        connectivity = cascade_connections / total_possible
        
        high_instability_ratio = len([
            c for c in components
            if c in self.instability_points and 
            self.instability_points[c].instability_score > 0.6
        ]) / total_possible
        
        return min(1.0, connectivity * 0.5 + high_instability_ratio * 0.5)
