# Probe the logged-in admin DOM to find nav selectors
from playwright.sync_api import sync_playwright
import json

LOG = []
def log(m): LOG.append(str(m)); print(m, flush=True)

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page(viewport={"width":1920,"height":1080})
    pg.goto("https://www.bakudanramen.com/links-admin/", timeout=60000, wait_until="domcontentloaded")
    pg.wait_for_timeout(2000)
    pg.fill("#login-email", "admin@bakudanramen.com")
    pg.fill("#login-pwd", "admin")
    pg.get_by_role("button", name="Sign In to Dashboard").click(timeout=15000)
    pg.wait_for_timeout(4000)
    log("Logged in. URL: " + pg.url)
    pg.screenshot(path=r"d:\Project\Master\ai-video-guide-system\walkthrough_output\dashboard_probe.png")
    # Dump all clickable nav-like elements
    nav_html = pg.evaluate("""() => {
        const results = [];
        // Look for sidebar / nav containers
        const candidates = document.querySelectorAll('aside, nav, [class*="sidebar"], [class*="nav"], [class*="menu"], [data-nav], [data-view], [role="navigation"]');
        candidates.forEach(el => {
            results.push({
                tag: el.tagName,
                cls: el.className,
                id: el.id,
                text: (el.innerText || '').substring(0, 200),
                childCount: el.children.length
            });
        });
        return results;
    }""")
    log("Nav candidates: " + json.dumps(nav_html, indent=2)[:3000])
    # Also find all elements with onclick or data attributes
    clickables = pg.evaluate("""() => {
        const results = [];
        document.querySelectorAll('[onclick], [data-nav], [data-view], [data-route], [data-page]').forEach(el => {
            results.push({tag: el.tagName, cls: el.className, text: (el.innerText||'').substring(0,50), attrs: el.outerHTML.substring(0,200)});
        });
        return results.slice(0, 30);
    }""")
    log("Clickables: " + json.dumps(clickables, indent=2)[:3000])
    b.close()

open(r"d:\Project\Master\ai-video-guide-system\walkthrough_output\nav_probe.log","w").write("\n".join(LOG))
log("DONE")
