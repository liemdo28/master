"""
CEO P0 Screenshot Audit — Playwright-based
Tests production URLs with real browser screenshots.
"""
import os
import sys
import json
from datetime import datetime
from playwright.sync_api import sync_playwright

BASE_URL = "https://dashboard.bakudanramen.com"
SCREENSHOT_DIR = os.path.join(os.path.dirname(__file__), "screenshots")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

# Devices to test
DEVICES = {
    "desktop": {"viewport": {"width": 1440, "height": 900}, "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"},
    "iphone15": None,  # Built-in Playwright device
    "iphone15_plus": None,
    "galaxy_s23": None,
    "ipad_air": None,
}

# Pages that require auth (will redirect to /login)
PROTECTED_PAGES = [
    "/overview",
    "/overall-store",
    "/my-tasks",
    "/tasks",
    "/bills",
    "/admin/stores",
    "/store-health",
    "/calendar",
    "/inbox",
]

PUBLIC_PAGES = ["/login"]

# Languages
LANGUAGES = [
    {"locale": "en-US", "cookie_value": "en-US", "label": "EN"},
    {"locale": "es-US", "cookie_value": "es-US", "label": "ES"},
    {"locale": "vi-VN", "cookie_value": "vi-VN", "label": "VI"},
]

def get_device_context(playwright, device_name):
    """Create a browser context for the given device."""
    browser = playwright.chromium.launch(headless=True)
    if device_name == "desktop":
        context = browser.new_context(
            viewport=DEVICES["desktop"]["viewport"],
            user_agent=DEVICES["desktop"]["user_agent"],
        )
    elif device_name == "iphone15":
        device = playwright.devices["iPhone 15"]
        context = browser.new_context(**device)
    elif device_name == "iphone15_plus":
        device = playwright.devices["iPhone 15 Pro Max"]
        context = browser.new_context(**device)
    elif device_name == "galaxy_s23":
        # Galaxy S24 is the closest available to S23 in Playwright's device list
        device = playwright.devices["Galaxy S24"]
        context = browser.new_context(**device)
    elif device_name == "ipad_air":
        device = playwright.devices["iPad (gen 11)"]
        context = browser.new_context(**device)
    else:
        context = browser.new_context()
    return browser, context


def audit_page(context, page_path, device_name, lang_label, results):
    """Take a screenshot of a page and check for errors."""
    page = context.new_page()
    
    errors = []
    page.on("console", lambda msg: errors.append(f"console.{msg.type}: {msg.text}") if msg.type == "error" else None)
    page.on("pageerror", lambda err: errors.append(f"pageerror: {err}"))
    
    url = BASE_URL + page_path
    filename = f"{device_name}_{lang_label}{page_path.replace('/', '_')}.png"
    filepath = os.path.join(SCREENSHOT_DIR, filename)
    
    try:
        response = page.goto(url, wait_until="networkidle", timeout=30000)
        status = response.status if response else 0
        page.wait_for_timeout(1000)  # Let animations settle
        page.screenshot(path=filepath, full_page=True)
        
        # Check for error indicators
        has_internal_error = False
        try:
            body_text = page.inner_text("body")
            if "Internal error" in body_text or "Something went wrong" in body_text:
                has_internal_error = True
        except:
            pass
        
        result = {
            "page": page_path,
            "device": device_name,
            "lang": lang_label,
            "status": status,
            "screenshot": filename,
            "has_internal_error": has_internal_error,
            "console_errors": len(errors),
            "console_error_messages": errors[:5],
            "passed": status == 200 and not has_internal_error,
            # 302 is acceptable for protected pages (redirect to login)
            "redirect_to_login": status == 302,
        }
        results.append(result)
        print(f"  {'[PASS]' if result['passed'] or result['redirect_to_login'] else '[FAIL]'} {page_path} [{device_name}] [{lang_label}] status={status}")
    except Exception as e:
        result = {
            "page": page_path,
            "device": device_name,
            "lang": lang_label,
            "status": 0,
            "screenshot": "",
            "has_internal_error": True,
            "console_errors": 0,
            "console_error_messages": [],
            "passed": False,
            "error": str(e),
            "redirect_to_login": False,
        }
        results.append(result)
        print(f"  [ERR] {page_path} [{device_name}] [{lang_label}] ERROR: {e}")
    
    page.close()


def main():
    results = []
    total_errors = 0
    total_internal_errors = 0
    
    print("=" * 70)
    print("CEO P0 SCREENSHOT AUDIT — Production")
    print(f"Date: {datetime.now().isoformat()}")
    print(f"Base URL: {BASE_URL}")
    print("=" * 70)
    
    with sync_playwright() as p:
        for device_name in DEVICES:
            print(f"\n--- Device: {device_name} ---")
            browser, context = get_device_context(p, device_name)
            
            # Test login page (public) with each language
            for lang in LANGUAGES:
                # Set language cookie
                context.add_cookies([{
                    "name": "preferred_locale",
                    "value": lang["cookie_value"],
                    "domain": ".bakudanramen.com",
                    "path": "/",
                }])
                
                for page_path in PUBLIC_PAGES:
                    audit_page(context, page_path, device_name, lang["label"], results)
            
            # Test protected pages (redirect to login = OK)
            for page_path in PROTECTED_PAGES:
                # No auth cookie → should redirect to /login (302)
                audit_page(context, page_path, device_name, "NOAUTH", results)
            
            browser.close()
        
        # ── Now do logged-in audit ──
        # We need credentials. Let's try to find test account info.
        # For now, just log summary
        
    # Summary
    print("\n" + "=" * 70)
    print("AUDIT SUMMARY")
    print("=" * 70)
    
    total = len(results)
    passed = sum(1 for r in results if r.get("passed") or r.get("redirect_to_login"))
    internal_errors = sum(1 for r in results if r.get("has_internal_error"))
    console_errs = sum(r.get("console_errors", 0) for r in results)
    redirect_ok = sum(1 for r in results if r.get("redirect_to_login"))
    
    print(f"Total screenshots: {total}")
    print(f"Passed (200 or 302-redirect): {passed}")
    print(f"Internal errors: {internal_errors}")
    print(f"Console errors: {console_errs}")
    print(f"Redirects to login (expected): {redirect_ok}")
    print(f"Failed: {total - passed}")
    
    # Save JSON results
    report_path = os.path.join(os.path.dirname(__file__), "audit_results.json")
    with open(report_path, "w") as f:
        json.dump({
            "timestamp": datetime.now().isoformat(),
            "base_url": BASE_URL,
            "total": total,
            "passed": passed,
            "internal_errors": internal_errors,
            "console_errors": console_errs,
            "results": results,
        }, f, indent=2)
    print(f"\nResults saved to: {report_path}")
    print(f"Screenshots saved to: {SCREENSHOT_DIR}")
    
    return 0 if internal_errors == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
