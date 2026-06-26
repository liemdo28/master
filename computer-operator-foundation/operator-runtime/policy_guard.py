"""
Policy Guard — blocks unsafe targets and enforces approval rules.
"""
import re
from typing import Optional

BLOCKED_TARGETS = [
    "doordash",
    "toast",
    "quickbooks",
    "gbp",          # Google Business Profile
    "dreamhost",
    "cloudflare",
    "banking",
    "payroll",
    "chase",
    "wellsfargo",
    "wells fargo",
    "boa",
    "bank of america",
    "citi",
    "citi.com",
    "intuit.com",
    "turbotax",
    "mint.com",
    "business.google.com",
]

BLOCKED_PATTERNS = [
    r"door\s*dash",
    r"toast\s*(tab|pos|crm)",
    r"quick\s*books",
    r"google\s*business\s*profile",
    r"dream\s*host",
    r"cloud\s*flare",
    r".*bank(ing)?.*",
    r"pay\s*roll",
    r"paychex",
    r"adp\.com",
    r"google\.com/business",
    r"business\.google\.com",
]

APPROVAL_LEVELS = {
    "READ_ONLY",
    "SAFE_WRITE",
    "PRODUCTION_WRITE",
    "FINANCIAL_ACTION",
    "SECURITY_ACTION",
}


def classify_target(target: str) -> str:
    """Classify a target URL/string as SAFE or BLOCKED."""
    t = target.lower().strip()
    for blocked in BLOCKED_TARGETS:
        if blocked in t:
            return "BLOCKED"
    for pattern in BLOCKED_PATTERNS:
        if re.search(pattern, t):
            return "BLOCKED"
    return "SAFE"


def check_target(target: str) -> dict:
    """Check if a target is allowed. Returns policy decision dict."""
    classification = classify_target(target)
    decision = {
        "ok": classification == "SAFE",
        "target": target,
        "classification": classification,
        "status": "APPROVED" if classification == "SAFE" else "BLOCKED_BY_POLICY",
    }
    return decision


def check_approval_level(level: str) -> dict:
    """Validate an approval level."""
    return {
        "valid": level in APPROVAL_LEVELS,
        "level": level,
    }


def is_production_target(target: str) -> bool:
    """Check if a target looks like a production system."""
    t = target.lower()
    production_indicators = ["prod", "production", "live", "real", ".com", ".io", ".net"]
    safe_indicators = ["localhost", "127.0.0.1", "file://", "test", "demo", "example"]
    for s in safe_indicators:
        if s in t:
            return False
    for p in production_indicators:
        if p in t:
            return True
    return False
