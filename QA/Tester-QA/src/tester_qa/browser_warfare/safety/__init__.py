"""Safety layer for browser warfare — limits, shutdowns, timeouts, cleanup, and guardrails."""

from tester_qa.browser_warfare.safety.browser_limits import (
    BrowserWarfareLimits,
    BrowserSafetyGuard,
)
from tester_qa.browser_warfare.safety.emergency_shutdown import EmergencyShutdown
from tester_qa.browser_warfare.safety.warfare_timeout import WarfareTimeout
from tester_qa.browser_warfare.safety.browser_cleanup import BrowserCleanup
from tester_qa.browser_warfare.safety.chaos_guardrails import (
    ChaosGuardrailPolicy,
    ChaosGuardrails,
)
from tester_qa.browser_warfare.safety.runtime_kill_switch import RuntimeKillSwitch
from tester_qa.browser_warfare.safety.queue_protection import QueueProtection
from tester_qa.browser_warfare.safety.isolation_guard import WarfareIsolationGuard

__all__ = [
    "BrowserWarfareLimits",
    "BrowserSafetyGuard",
    "EmergencyShutdown",
    "WarfareTimeout",
    "BrowserCleanup",
    "ChaosGuardrailPolicy",
    "ChaosGuardrails",
    "RuntimeKillSwitch",
    "QueueProtection",
    "WarfareIsolationGuard",
]
