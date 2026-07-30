#!/usr/bin/env python3
"""
Phase 13.7 - Mobile + Tablet Production Bug Audit
Playwright device emulation against production URL.
Outputs: reports/MOBILE_BUG_AUDIT.md + screenshots
"""

import os, time, traceback, datetime
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE_URL = "https://dashboard.bakudanramen.com"
EMAIL = os.environ.get("TEST_EMAIL", "liem.dt0208@gmail.com")
PASSWORD = os.environ.get("TEST_PASSWORD", "123456")

REPORT_DIR = Path(__file__).resolve().parent.parent / "reports"
SS_DIR = REPORT_DIR / "screenshots"
REPORT_DIR.mkdir(exist_ok=True)
SS_DIR.mkdir(parents=True, exist_ok=True)

DEVICES = {
    "iPhone-15": {"viewport": {"width": 393, "height": 852}, "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1", "is_mobile": True, "has_touch": True},
    "iPhone-15-Plus": {"viewport": {"width": 430, "height": 932}, "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1", "is_mobile": True, "has_touch": True},
    "iPad-Air": {"viewport": {"width": 820, "height": 1180}, "user_agent": "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1", "is_mobile": False, "has_touch": True},
    "Galaxy-S23": {"viewport": {"width": 360, "height": 780}, "user_agent": "Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36", "is_mobile": True, "has_touch": True},
    "Android-412": {"viewport": {"width": 412, "height": 915}, "user_agent": "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36", "is_mobile": True, "has_touch": True},
}

bugs = []
ss_count = 0

def bug(severity, workflow, device, title, url="", screenshot="", root_cause="", recommendation="", console_log=""):
    bugs.append({"id": f"MOB-{len(bugs)+1:03d}", "severity": severity, "workflow": workflow, "device": device, "title": title, "url": url, "screenshot": screenshot, "root_cause": root_cause, "recommendation": recommendation, "console_log": (console_log or "")[:500]})

def ss(page, label, device_name):
    global ss_count
    ss_count += 1
    safe = label.replace("/", "_").replace(" ", "_").lower()[:60]
    fname = f"{ss_count:02d}_{device_name}_{safe}.png"
    page.screenshot(path=str(SS_DIR / fname), full_page=True)
    return f"screenshots/{fname}"

def check_overflow(page, dn, wf, url):
    try:
        vw = page.evaluate("document.documentElement.clientWidth")
        sw = page.evaluate("document.documentElement.scrollWidth")
        if sw > vw + 10:
            bug("P1", wf, dn, f"Horizontal overflow ({sw}px > {vw}px)", url=url, screenshot=ss(page, f"{wf}_overflow", dn), root_cause="Element wider than viewport")
            return True
    except: pass
    return False

def check_blank(page, dn, wf, url):
    try:
        bt = page.evaluate("document.body ? document.body.innerText.trim() : ''")
        bh = page.evaluate("document.body ? document.body.innerHTML.trim() : ''")
        if len(bt) < 10 and len(bh) < 100:
            bug("P0", wf, dn, "Blank screen", url=url, screenshot=ss(page, f"{wf}_blank", dn), root_cause="Empty body")
            return True
    except: pass
    return False

def check_errors(page, dn, wf, url):
    try:
        body = page.evaluate("document.body ? document.body.innerText : ''")
        for kw in ["SQLSTATE", "Fatal error", "Uncaught Exception", "PDOException", "Undefined index", "Undefined variable", "500 Internal"]:
            if kw.lower() in body.lower():
                bug("P0", wf, dn, f"Error text: '{kw}'", url=url, screenshot=ss(page, f"{wf}_err_{kw[:10]}", dn), root_cause=f"Server error: {kw}")
                return True
    except: pass
    return False

def check_deadend(page, dn, wf, url):
    try:
        body = page.evaluate("document.body ? document.body.innerText : ''")
        for de in ["Page not found", "Access denied"]:
            if de.lower() in body.lower():
                bug("P1", wf, dn, f"Dead-end: '{de}'", url=url, screenshot=ss(page, f"{wf}_deadend", dn))
                return True
    except: pass
    return False

def do_login(page, dn):
    url = f"{BASE_URL}/login"
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
        time.sleep(2)
        ss(page, "login_page", dn)
        check_overflow(page, dn, "login", url)
        check_blank(page, dn, "login", url)
        check_errors(page, dn, "login", url)
        email_el = page.locator('input[name="email"], input[type="email"]')
        pw_el = page.locator('input[name="password"], input[type="password"]')
        btn = page.locator('button[type="submit"], input[type="submit"]')
        if email_el.count() == 0:
            bug("P0", "login", dn, "Email input not found", url=url, screenshot=ss(page, "login_no_email", dn))
            return False
        email_el.first.fill(EMAIL)
        if pw_el.count() > 0:
            pw_el.first.fill(PASSWORD)
        else:
            bug("P0", "login", dn, "Password input not found", url=url, screenshot=ss(page, "login_no_pw", dn))
            return False
        if btn.count() > 0:
            btn.first.click()
        else:
            bug("P1", "login", dn, "Submit button not found", url=url)
            return False
        time.sleep(3)
        page.wait_for_load_state("domcontentloaded", timeout=15000)
        ss(page, "after_login", dn)
        if "login" in page.url.lower():
            bug("P1", "login", dn, "Stuck on login page after submit", url=page.url, screenshot=ss(page, "login_stuck", dn))
            return False
        return True
    except Exception as e:
        bug("P0", "login", dn, f"Login exception: {str(e)[:200]}", url=url, screenshot=ss(page, "login_exc", dn))
        return False

def test_overview(page, dn):
    url = f"{BASE_URL}/overview"
    page.goto(url, wait_until="domcontentloaded", timeout=30000)
    time.sleep(2)
    ss(page, "dashboard_overview", dn)
    check_overflow(page, dn, "dashboard", url)
    check_blank(page, dn, "dashboard", url)
    check_errors(page, dn, "dashboard", url)
    check_deadend(page, dn, "dashboard", url)

def test_drilldowns(page, dn):
    routes = [
        ("/overview/drilldown/cash-risk", "cash_risk"),
        ("/overview/drilldown/overdue-bills", "overdue_bills"),
        ("/overview/drilldown/critical-tasks", "critical_tasks"),
        ("/overview/drilldown/compliance-risk", "compliance_risk"),
        ("/overview/drilldown/execution-risk", "execution_risk"),
        ("/overview/drilldown/penalty", "penalty"),
        ("/overview/drilldown/store-risk", "store_risk"),
        ("/overview/drilldown/team-load", "team_load"),
    ]
    for route, name in routes:
        url = f"{BASE_URL}{route}"
        try:
            resp = page.goto(url, wait_until="domcontentloaded", timeout=15000)
            time.sleep(1)
            status = resp.status if resp else 0
            ss(page, f"drilldown_{name}", dn)
            if status >= 500:
                bug("P0", "drilldown", dn, f"Drilldown '{name}' HTTP {status}", url=url, screenshot=ss(page, f"dd_{name}_err", dn))
            elif status == 404:
                bug("P1", "drilldown", dn, f"Drilldown '{name}' 404", url=url, screenshot=ss(page, f"dd_{name}_404", dn))
            check_overflow(page, dn, f"dd_{name}", url)
            check_errors(page, dn, f"dd_{name}", url)
            check_blank(page, dn, f"dd_{name}", url)
        except Exception as e:
            bug("P1", "drilldown", dn, f"Drilldown '{name}' error: {str(e)[:150]}", url=url)

def test_tasks(page, dn):
    url = f"{BASE_URL}/tasks"
    page.goto(url, wait_until="domcontentloaded", timeout=30000)
    time.sleep(2)
    ss(page, "tasks_list", dn)
    check_overflow(page, dn, "tasks", url)
    check_blank(page, dn, "tasks", url)
    check_errors(page, dn, "tasks", url)

def test_bills(page, dn):
    for path, label in [("/bills", "bills"), ("/bills?filter=overdue", "bills_overdue")]:
        url = f"{BASE_URL}{path}"
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=20000)
            time.sleep(2)
            ss(page, f"bills_{label}", dn)
            check_overflow(page, dn, f"bills_{label}", url)
            check_blank(page, dn, f"bills_{label}", url)
            check_errors(page, dn, f"bills_{label}", url)
        except Exception as e:
            bug("P1", "bills", dn, f"Bills page '{label}' error: {str(e)[:150]}", url=url)

def test_calendar(page, dn):
    url = f"{BASE_URL}/company/calendar"
    page.goto(url, wait_until="domcontentloaded", timeout=30000)
    time.sleep(2)
    ss(page, "calendar", dn)
    check_overflow(page, dn, "calendar", url)
    check_blank(page, dn, "calendar", url)
    check_errors(page, dn, "calendar", url)

def test_inbox(page, dn):
    url = f"{BASE_URL}/inbox"
    page.goto(url, wait_until="domcontentloaded", timeout=20000)
    time.sleep(2)
    ss(page, "inbox", dn)
    check_overflow(page, dn, "inbox", url)
    check_blank(page, dn, "inbox", url)
    check_errors(page, dn, "inbox", url)
    url2 = f"{BASE_URL}/notifications"
    page.goto(url2, wait_until="domcontentloaded", timeout=20000)
    time.sleep(2)
    ss(page, "notifications", dn)
    check_overflow(page, dn, "notifications", url2)
    check_blank(page, dn, "notifications", url2)
    check_errors(page, dn, "notifications", url2)

def test_responsive(page, dn, info):
    """Test a few pages for responsive issues."""
    routes = ["/overview", "/tasks", "/bills", "/company/calendar", "/inbox"]
    for r in routes:
        url = f"{BASE_URL}{r}"
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=20000)
            time.sleep(1)
            check_overflow(page, dn, f"resp_{r.replace('/','_')}", url)
        except:
            pass

def generate_report(start_time):
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    elapsed = (datetime.datetime.now() - start_time).total_seconds()
    p0 = [b for b in bugs if b["severity"] == "P0"]
    p1 = [b for b in bugs if b["severity"] == "P1"]
    p2 = [b for b in bugs if b["severity"] == "P2"]
    p3 = [b for b in bugs if b["severity"] == "P3"]

    lines = [
        "# MOBILE + TABLET PRODUCTION BUG AUDIT",
        f"**Date:** {now}",
        f"**Duration:** {elapsed:.0f}s",
        f"**Target:** {BASE_URL}",
        f"**Devices tested:** {', '.join(DEVICES.keys())}",
        f"**Screenshots captured:** {ss_count}",
        "",
        "## SUMMARY",
        "",
        f"| Severity | Count |",
        f"|----------|-------|",
        f"| **P0** (Critical — ship-blocker) | {len(p0)} |",
        f"| **P1** (High — must fix) | {len(p1)} |",
        f"| **P2** (Medium — should fix) | {len(p2)} |",
        f"| **P3** (Low — nice to have) | {len(p3)} |",
        f"| **TOTAL** | {len(bugs)} |",
        "",
        f"**CERTIFICATION STATUS: {'FAIL' if p0 or p1 else 'CONDITIONAL PASS (P2/P3 only)'}**",
        "",
        "## P0 BUGS (Ship Blockers)",
        "",
    ]
    if not p0:
        lines.append("_No P0 bugs found._")
    else:
        for b in p0:
            lines.extend([
                f"### {b['id']}: {b['title']}",
                f"- **Device:** {b['device']}",
                f"- **Workflow:** {b['workflow']}",
                f"- **URL:** `{b['url']}`",
                f"- **Screenshot:** [{b['screenshot']}]({b['screenshot']})" if b['screenshot'] else "",
                f"- **Root Cause:** {b['root_cause']}" if b['root_cause'] else "",
                f"- **Recommendation:** {b['recommendation']}" if b['recommendation'] else "",
                f"- **Console:** `{b['console_log'][:200]}`" if b['console_log'] else "",
                "",
            ])

    lines.extend(["", "## P1 BUGS (Must Fix)", ""])
    if not p1:
        lines.append("_No P1 bugs found._")
    else:
        for b in p1:
            lines.extend([
                f"### {b['id']}: {b['title']}",
                f"- **Device:** {b['device']}",
                f"- **Workflow:** {b['workflow']}",
                f"- **URL:** `{b['url']}`",
                f"- **Screenshot:** [{b['screenshot']}]({b['screenshot']})" if b['screenshot'] else "",
                f"- **Root Cause:** {b['root_cause']}" if b['root_cause'] else "",
                f"- **Recommendation:** {b['recommendation']}" if b['recommendation'] else "",
                "",
            ])

    lines.extend(["", "## P2 BUGS", ""])
    if not p2:
        lines.append("_No P2 bugs found._")
    else:
        for b in p2:
            lines.extend([f"- **{b['id']}** [{b['device']}] {b['title']}" + (f" ({b['url']})" if b['url'] else ""), ""])

    lines.extend(["", "## P3 BUGS", ""])
    if not p3:
        lines.append("_No P3 bugs found._")
    else:
        for b in p3:
            lines.extend([f"- **{b['id']}** [{b['device']}] {b['title']}", ""])

    lines.extend([
        "",
        "## SCREENSHOT EVIDENCE",
        "",
        f"All {ss_count} screenshots saved to `reports/screenshots/`.",
        "",
        "## DEPLOY GATE",
        "",
        f"- [x] P0 bugs: **{len(p0)}**",
        f"- [x] P1 bugs: **{len(p1)}**",
        f"- [ ] All P0 and P1 fixed: **{'NO' if p0 or p1 else 'YES'}**",
        "",
        f"**CERTIFICATION = {'FAIL' if p0 or p1 else 'CONDITIONAL PASS'}**",
        "",
        f"_Only after all P0 and P1 are fixed may Phase 13.7 certification continue._",
    ])

    report = "\n".join(lines)
    report_path = REPORT_DIR / "MOBILE_BUG_AUDIT.md"
    report_path.write_text(report, encoding="utf-8")
    print(f"Report written to {report_path}")
    print(f"Bugs: P0={len(p0)} P1={len(p1)} P2={len(p2)} P3={len(p3)} Total={len(bugs)}")

def main():
    start = datetime.datetime.now()
    print(f"Phase 13.7 Mobile Bug Audit — {start.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Target: {BASE_URL}")
    print(f"Devices: {list(DEVICES.keys())}")
    print()

    with sync_playwright() as p:
        for device_name, device_info in DEVICES.items():
            print(f"\n{'='*60}")
            print(f"DEVICE: {device_name} ({device_info['viewport']['width']}x{device_info['viewport']['height']})")
            print(f"{'='*60}")

            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                viewport=device_info["viewport"],
                user_agent=device_info["user_agent"],
                is_mobile=device_info["is_mobile"],
                has_touch=device_info["has_touch"],
            )
            page = context.new_page()

            try:
                logged_in = do_login(page, device_name)
                if not logged_in:
                    print(f"  [SKIP] Login failed for {device_name}")
                    continue

                print(f"  [OK] Login successful")
                test_overview(page, device_name)
                print(f"  [OK] Dashboard tested")
                test_drilldowns(page, device_name)
                print(f"  [OK] Drilldowns tested")
                test_tasks(page, device_name)
                print(f"  [OK] Tasks tested")
                test_bills(page, device_name)
                print(f"  [OK] Bills tested")
                test_calendar(page, device_name)
                print(f"  [OK] Calendar tested")
                test_inbox(page, device_name)
                print(f"  [OK] Inbox/Notifications tested")

            except Exception as e:
                print(f"  [ERROR] {device_name}: {str(e)[:200]}")
                bug("P0", "exception", device_name, f"Uncaught exception: {str(e)[:200]}",
                    screenshot=ss(page, "uncaught_exception", device_name),
                    console_log=traceback.format_exc()[:500])
            finally:
                context.close()
                browser.close()

    generate_report(start)
    print(f"\nAudit complete. {len(bugs)} bugs found, {ss_count} screenshots captured.")

if __name__ == "__main__":
    main()
