from __future__ import annotations


def detect_blank_screen(html: str) -> bool:
    body = html.lower().split("<body", 1)[-1]
    text = body.replace("&nbsp;", "").strip()
    return len(text) < 20


def detect_loading_loop(html: str) -> bool:
    lowered = html.lower()
    return any(marker in lowered for marker in ["loading", "spinner", "please wait", "skeleton"])


def detect_broken_layout(html: str) -> list[str]:
    findings = []
    lowered = html.lower()
    if "overflow: hidden" in lowered and "height: 100vh" in lowered:
        findings.append("Potential clipped viewport layout.")
    if "error boundary" in lowered:
        findings.append("React error boundary text detected.")
    return findings
