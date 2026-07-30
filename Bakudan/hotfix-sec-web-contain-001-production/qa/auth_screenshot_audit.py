"""
Authenticated Screenshot Audit — Logs in, then captures all protected pages.
"""
import os
import sys
import json
from datetime import datetime
from playwright.sync_api import sync_playwright

BASE_URL = "https://dashboard.bakudanramen.com"
SCREENSHOT_DIR = os.path.join(os.path.dirname(__file__), "screenshots")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

EMAIL = os.environ.get("QA_EMAIL", "admin@bakudanramen.com")
PASSWORD = os.environ.get("QA_PASSWORD", "admin123")

PAGES = [
    "/dashboard", "/overview", "/overall-store",
    "/my-tasks", "/tasks", "/bills",
    "/admin/stores", "/admin/store-command", "/store-health",
    "/calendar", "/inbox", "/notifications",
    "/admin/penalties", "/ceo/penalties",
]

DEVICES = {
    "desktop": {"viewport": {"width": 1440, "height": 900}, "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"},
    "iphone15": "iPhone 15",
    "iphone15_plus": "iPhone 15 Pro Max",
    "galaxy_s23": "Galaxy S24",
    "ipad_air": "iPad (gen 11)",
}

def get_context(pw, device_name):
    browser = pw.chromium.launch(headless=True)
    dev = DEVICES[device_name]
    if isinstance(dev, dict):
        ctx = browser.new_context(viewport=dev["viewport"], user_agent=dev["user_agent"])
    else:
        ctx = browser.new_context(**pw.devices[dev])
    return browser, ctx

def login(page):
    page.goto(BASE_URL + "/login", wait_until="networkidle", timeout=30000)
    # Try to find CSRF token (might be present or might not)
    csrf = None
    try:
        csrf_input = page.locator('input[name="csrf"]').first
        if csrf_input.count() > 0:
            csrf = csrf_input.get_attribute("value")
    except Exception:
        pass
    page.fill('input[name="email"]', EMAIL)
    page.fill('input[name="password"]', PASSWORD)
    if csrf:
        page.evaluate(f'document.querySelector(\'input[name="csrf"]\').value = "{csrf}"')
    # Click submit and wait for navigation away from /login
    with page.expect_navigation(timeout=15000, wait_until="networkidle") as nav:
        page.click('button[type="submit"]')
    try:
        nav.value
    except Exception:
        pass
    page.wait_for_timeout(1000)

def audit_page(page, page_path, device_name, lang_label, results):
    url = BASE_URL + page_path
    fname = f"{device_name}_{lang_label}{page_path.replace('/', '_')}.png"
    fpath = os.path.join(SCREENSHOT_DIR, fname)
    errors = []
    page.on("console", lambda m: errors.append(f"{m.type}: {m.text}") if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    try:
        resp = page.goto(url, wait_until="networkidle", timeout=30000)
        status = resp.status if resp else 0
        page.wait_for_timeout(1500)
        page.screenshot(path=fpath, full_page=True)
        body = ""
        try: body = page.inner_text("body")
        except: pass
        has_error = "Internal error" in body or "Something went wrong" in body
        # Check for login redirect (means session lost)
        redirected = "/login" in page.url and "login" not in page_path.lower()
        r = {"page": page_path, "device": device_name, "lang": lang_label, "status": status,
             "screenshot": fname, "internal_error": has_error, "console_errors": len(errors),
             "error_msgs": errors[:3], "redirected_to_login": redirected,
             "passed": (status == 200 and not has_error and not redirected) or status == 302}
        results.append(r)
        tag = "[PASS]" if r["passed"] else "[FAIL]"
        print(f"  {tag} {page_path} [{device_name}] status={status} login_redirect={redirected}")
    except Exception as e:
        results.append({"page": page_path, "device": device_name, "lang": lang_label,
                        "status": 0, "internal_error": True, "passed": False, "error": str(e)})
        print(f"  [ERR] {page_path} [{device_name}] {e}")

def main():
    results = []
    with sync_playwright() as pw:
        for device_name in DEVICES:
            print(f"\n=== {device_name} ===")
            browser, ctx = get_context(pw, device_name)
            page = ctx.new_page()
            # Login once
            try:
                login(page)
                current = page.url
                logged_in = "/login" not in current
                print(f"  Login: {'OK' if logged_in else 'FAILED'} (url={current})")
                if not logged_in:
                    browser.close()
                    continue
            except Exception as e:
                print(f"  Login error: {e}")
                browser.close()
                continue
            # Test each page
            for pg in PAGES:
                audit_page(page, pg, device_name, "EN", results)
            browser.close()

    total = len(results)
    passed = sum(1 for r in results if r.get("passed"))
    internal = sum(1 for r in results if r.get("internal_error"))
    redirects = sum(1 for r in results if r.get("redirected_to_login"))

    print(f"\n{'='*60}")
    print(f"Total: {total}  Passed: {passed}  InternalErrors: {internal}  LoginRedirects: {redirects}")
    print(f"{'='*60}")

    report = os.path.join(os.path.dirname(__file__), "auth_audit_results.json")
    with open(report, "w") as f:
        json.dump({"timestamp": datetime.now().isoformat(), "total": total, "passed": passed,
                    "internal_errors": internal, "login_redirects": redirects, "results": results}, f, indent=2)
    print(f"Results: {report}")
    return 0 if internal == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
