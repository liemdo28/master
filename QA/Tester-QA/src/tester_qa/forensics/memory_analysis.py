"""Memory Analysis Module - Analyzes memory patterns for forensics."""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple


class LeakPattern(Enum):
    """Types of memory leak patterns."""
    LINEAR_GROWTH = "linear_growth"
    EXPONENTIAL_GROWTH = "exponential_growth"
    STEP_FUNCTION = "step_function"
    BOUNDED_LEAK = "bounded_leak"
    CYCLIC_LEAK = "cyclic_leak"
    NONE = "none"


@dataclass
class MemorySample:
    """A single memory measurement sample."""
    timestamp: datetime
    used_mb: float
    available_mb: float
    percent_used: float
    rss_mb: float = 0.0
    vms_mb: float = 0.0
    custom_metrics: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Export sample as dictionary."""
        return {
            "timestamp": self.timestamp.isoformat(),
            "used_mb": self.used_mb,
            "available_mb": self.available_mb,
            "percent_used": self.percent_used,
            "rss_mb": self.rss_mb,
            "vms_mb": self.vms_mb,
            "custom_metrics": self.custom_metrics,
        }


@dataclass
class MemoryLeak:
    """Detected memory leak."""
    leak_id: str
    pattern: LeakPattern
    start_time: datetime
    detection_time: datetime
    severity: str
    growth_rate_mb_per_min: float
    estimated_leak_size_mb: float
    affected_component: Optional[str] = None
    description: Optional[str] = None
    confidence: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        """Export leak as dictionary."""
        return {
            "leak_id": self.leak_id,
            "pattern": self.pattern.value,
            "start_time": self.start_time.isoformat(),
            "detection_time": self.detection_time.isoformat(),
            "severity": self.severity,
            "growth_rate_mb_per_min": self.growth_rate_mb_per_min,
            "estimated_leak_size_mb": self.estimated_leak_size_mb,
            "affected_component": self.affected_component,
            "description": self.description,
            "confidence": self.confidence,
        }


@dataclass
class AllocationHotspot:
    """Identified memory allocation hotspot."""
    location: str
    total_allocations: int
    total_bytes: float
    allocation_count: int
    avg_allocation_size: float
    peak_allocation_size: float
    timestamp: datetime

    def to_dict(self) -> Dict[str, Any]:
        """Export hotspot as dictionary."""
        return {
            "location": self.location,
            "total_allocations": self.total_allocations,
            "total_bytes": self.total_bytes,
            "allocation_count": self.allocation_count,
            "avg_allocation_size": self.avg_allocation_size,
            "peak_allocation_size": self.peak_allocation_size,
            "timestamp": self.timestamp.isoformat(),
        }


@dataclass
class MemoryAnalysisResult:
    """Complete memory analysis result."""
    analysis_id: str
    timestamp: datetime
    samples: List[MemorySample]
    leaks: List[MemoryLeak]
    hotspots: List[AllocationHotspot]
    summary: Dict[str, Any]
    recommendations: List[str]

    def to_dict(self) -> Dict[str, Any]:
        """Export analysis result as dictionary."""
        return {
            "analysis_id": self.analysis_id,
            "timestamp": self.timestamp.isoformat(),
            "samples": [s.to_dict() for s in self.samples],
            "leaks": [l.to_dict() for l in self.leaks],
            "hotspots": [h.to_dict() for h in self.hotspots],
            "summary": self.summary,
            "recommendations": self.recommendations,
        }


class MemoryAnalyzer:
    """Analyzes memory patterns for leak detection and forensics."""

    def __init__(self) -> None:
        self._samples: List[MemorySample] = []
        self._sample_counter: int = 0
        self._leak_detection_threshold_mb_per_min: float = 5.0
        self._min_samples_for_analysis: int = 5

    def add_sample(
        self,
        used_mb: float,
        available_mb: float,
        percent_used: float,
        rss_mb: Optional[float] = None,
        vms_mb: Optional[float] = None,
        custom_metrics: Optional[Dict[str, Any]] = None,
    ) -> MemorySample:
        """Add a memory sample to the analysis.

        Args:
            used_mb: Currently used memory in MB.
            available_mb: Available memory in MB.
            percent_used: Percentage of memory used.
            rss_mb: Resident Set Size in MB (optional).
            vms_mb: Virtual Memory Size in MB (optional).
            custom_metrics: Optional custom metrics.

        Returns:
            The created MemorySample.
        """
        self._sample_counter += 1
        sample = MemorySample(
            timestamp=datetime.utcnow(),
            used_mb=used_mb,
            available_mb=available_mb,
            percent_used=percent_used,
            rss_mb=rss_mb or 0.0,
            vms_mb=vms_mb or 0.0,
            custom_metrics=custom_metrics or {},
        )
        self._samples.append(sample)
        return sample

    def detect_leaks(self) -> List[MemoryLeak]:
        """Detect memory leaks from collected samples.

        Returns:
            List of detected MemoryLeak objects.
        """
        if len(self._samples) < self._min_samples_for_analysis:
            return []

        leaks: List[MemoryLeak] = []

        if len(self._samples) < 2:
            return []

        first_sample = self._samples[0]
        last_sample = self._samples[-1]
        time_span_min = (last_sample.timestamp - first_sample.timestamp).total_seconds() / 60.0

        if time_span_min <= 0:
            time_span_min = 1.0

        memory_growth = last_sample.used_mb - first_sample.used_mb
        growth_rate = memory_growth / time_span_min

        if growth_rate > self._leak_detection_threshold_mb_per_min:
            pattern = self._detect_leak_pattern()
            severity = self._assess_leak_severity(growth_rate)

            leak = MemoryLeak(
                leak_id=f"leak-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
                pattern=pattern,
                start_time=first_sample.timestamp,
                detection_time=datetime.utcnow(),
                severity=severity,
                growth_rate_mb_per_min=growth_rate,
                estimated_leak_size_mb=memory_growth,
                affected_component=None,
                description=f"Memory growing at {growth_rate:.2f} MB/min over {time_span_min:.1f} minutes",
                confidence=min(1.0, abs(growth_rate) / (self._leak_detection_threshold_mb_per_min * 2)),
            )
            leaks.append(leak)

        return leaks

    def analyze_growth(self) -> Dict[str, Any]:
        """Analyze memory growth patterns.

        Returns:
            Dictionary with growth analysis results.
        """
        if len(self._samples) < 2:
            return {"error": "Insufficient samples for growth analysis"}

        first_sample = self._samples[0]
        last_sample = self._samples[-1]
        time_span_min = (last_sample.timestamp - first_sample.timestamp).total_seconds() / 60.0

        if time_span_min <= 0:
            time_span_min = 1.0

        memory_growth = last_sample.used_mb - first_sample.used_mb
        growth_rate = memory_growth / time_span_min

        used_values = [s.used_mb for s in self._samples]
        avg_used = sum(used_values) / len(used_values)
        min_used = min(used_values)
        max_used = max(used_values)

        variance = sum((v - avg_used) ** 2 for v in used_values) / len(used_values)
        std_dev = variance ** 0.5

        growth_trend = "stable"
        if growth_rate > 1.0:
            growth_trend = "increasing"
        elif growth_rate < -1.0:
            growth_trend = "decreasing"

        return {
            "total_growth_mb": round(memory_growth, 2),
            "growth_rate_mb_per_min": round(growth_rate, 2),
            "time_span_minutes": round(time_span_min, 2),
            "growth_trend": growth_trend,
            "avg_used_mb": round(avg_used, 2),
            "min_used_mb": round(min_used, 2),
            "max_used_mb": round(max_used, 2),
            "std_deviation_mb": round(std_dev, 2),
            "sample_count": len(self._samples),
            "start_time": first_sample.timestamp.isoformat(),
            "end_time": last_sample.timestamp.isoformat(),
        }

    def find_allocation_hotspots(
        self,
        allocation_data: Optional[List[Dict[str, Any]]] = None,
    ) -> List[AllocationHotspot]:
        """Find memory allocation hotspots.

        Args:
            allocation_data: Optional list of allocation records.
                Each record should have: location, bytes, count.

        Returns:
            List of identified AllocationHotspot objects.
        """
        if not allocation_data:
            allocation_data = []

        location_stats: Dict[str, Dict[str, float]] = {}

        for record in allocation_data:
            location = record.get("location", "unknown")
            bytes_val = float(record.get("bytes", 0))
            count = int(record.get("count", 1))

            if location not in location_stats:
                location_stats[location] = {"total_bytes": 0.0, "total_count": 0, "peak_bytes": 0.0}

            location_stats[location]["total_bytes"] += bytes_val
            location_stats[location]["total_count"] += count
            if bytes_val > location_stats[location]["peak_bytes"]:
                location_stats[location]["peak_bytes"] = bytes_val

        hotspots: List[AllocationHotspot] = []
        for location, stats in location_stats.items():
            total_bytes = stats["total_bytes"] / (1024 * 1024)
            avg_size = total_bytes / stats["total_count"] if stats["total_count"] > 0 else 0
            peak_mb = stats["peak_bytes"] / (1024 * 1024)

            hotspots.append(AllocationHotspot(
                location=location,
                total_allocations=stats["total_count"],
                total_bytes=total_bytes,
                allocation_count=stats["total_count"],
                avg_allocation_size=avg_size,
                peak_allocation_size=peak_mb,
                timestamp=datetime.utcnow(),
            ))

        hotspots.sort(key=lambda h: h.total_bytes, reverse=True)
        return hotspots[:20]

    def run_full_analysis(
        self,
        allocation_data: Optional[List[Dict[str, Any]]] = None,
    ) -> MemoryAnalysisResult:
        """Run a complete memory analysis.

        Args:
            allocation_data: Optional allocation data for hotspot analysis.

        Returns:
            Complete MemoryAnalysisResult.
        """
        leaks = self.detect_leaks()
        growth = self.analyze_growth()
        hotspots = self.find_allocation_hotspots(allocation_data)

        recommendations: List[str] = []
        if leaks:
            recommendations.append(
                f"Memory leak detected with pattern: {leaks[0].pattern.value}. "
                f"Investigate components with growing memory usage."
            )
        if growth.get("growth_trend") == "increasing":
            recommendations.append("Memory is consistently increasing. Review recent code changes.")
        if hotspots:
            top = hotspots[0]
            recommendations.append(
                f"Highest allocation hotspot: {top.location} at {top.total_bytes:.2f} MB. "
                f"Consider optimizing or caching this allocation site."
            )
        if not recommendations:
            recommendations.append("No significant memory issues detected.")

        return MemoryAnalysisResult(
            analysis_id=f"mem-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            timestamp=datetime.utcnow(),
            samples=self._samples.copy(),
            leaks=leaks,
            hotspots=hotspots,
            summary=growth,
            recommendations=recommendations,
        )

    def get_samples(self) -> List[MemorySample]:
        """Return all collected memory samples."""
        return self._samples.copy()

    def clear_samples(self) -> None:
        """Clear all collected samples."""
        self._samples = []
        self._sample_counter = 0

    def export_analysis(self, result: MemoryAnalysisResult, format: str = "dict") -> Any:
        """Export analysis result in the specified format.

        Args:
            result: The MemoryAnalysisResult to export.
            format: Output format - 'dict', 'text', or 'json'.

        Returns:
            Formatted analysis data.
        """
        if format == "text":
            return self._format_analysis_text(result)
        elif format == "json":
            import json
            return json.dumps(result.to_dict(), indent=2, default=str)
        return result.to_dict()

    def _detect_leak_pattern(self) -> LeakPattern:
        """Detect the pattern of memory growth."""
        if len(self._samples) < 3:
            return LeakPattern.LINEAR_GROWTH

        used_values = [s.used_mb for s in self._samples]
        n = len(used_values)

        x_mean = (n - 1) / 2.0
        y_mean = sum(used_values) / n

        numerator = sum((i - x_mean) * (used_values[i] - y_mean) for i in range(n))
        denominator = sum((i - x_mean) ** 2 for i in range(n))

        if denominator == 0:
            return LeakPattern.LINEAR_GROWTH

        slope = numerator / denominator

        squared_residuals = sum(
            (used_values[i] - (y_mean + slope * (i - x_mean))) ** 2 for i in range(n)
        )
        y_total = sum((v - y_mean) ** 2 for v in used_values)
        r_squared = 1 - (squared_residuals / y_total) if y_total > 0 else 0

        if r_squared > 0.95:
            return LeakPattern.LINEAR_GROWTH

        if n >= 4:
            early_avg = sum(used_values[:n//2]) / (n//2)
            late_avg = sum(used_values[n//2:]) / (n - n//2)
            if late_avg > early_avg * 1.5:
                return LeakPattern.EXPONENTIAL_GROWTH

        return LeakPattern.LINEAR_GROWTH

    def _assess_leak_severity(self, growth_rate: float) -> str:
        """Assess the severity of a detected leak."""
        if growth_rate > 50:
            return "critical"
        elif growth_rate > 20:
            return "high"
        elif growth_rate > 5:
            return "medium"
        return "low"

    def _format_analysis_text(self, result: MemoryAnalysisResult) -> str:
        """Format analysis result as human-readable text."""
        lines = [
            "=" * 60,
            "MEMORY ANALYSIS REPORT",
            "=" * 60,
            f"Analysis ID: {result.analysis_id}",
            f"Timestamp:   {result.timestamp.isoformat()}",
            f"Samples:     {len(result.samples)}",
            "",
            "GROWTH ANALYSIS:",
        ]

        summary = result.summary
        if "error" in summary:
            lines.append(f"  {summary['error']}")
        else:
            for key, value in summary.items():
                lines.append(f"  {key}: {value}")

        if result.leaks:
            lines.extend(["", "DETECTED LEAKS:"])
            for leak in result.leaks:
                lines.extend([
                    f"  [{leak.severity.upper()}] {leak.leak_id}",
                    f"    Pattern:    {leak.pattern.value}",
                    f"    Start:      {leak.start_time.isoformat()}",
                    f"    Rate:       {leak.growth_rate_mb_per_min:.2f} MB/min",
                    f"    Est. Size:  {leak.estimated_leak_size_mb:.2f} MB",
                    f"    Confidence: {leak.confidence:.0%}",
                ])

        if result.hotspots:
            lines.extend(["", "ALLOCATION HOTSPOTS:"])
            for i, spot in enumerate(result.hotspots[:5], 1):
                lines.extend([
                    f"  {i}. {spot.location}",
                    f"     Total:   {spot.total_bytes:.2f} MB",
                    f"     Count:   {spot.allocation_count}",
                    f"     Avg:     {spot.avg_allocation_size:.4f} MB",
                ])

        if result.recommendations:
            lines.extend(["", "RECOMMENDATIONS:"])
            for i, rec in enumerate(result.recommendations, 1):
                lines.append(f"  {i}. {rec}")

        lines.append("=" * 60)
        return "\n".join(lines)
