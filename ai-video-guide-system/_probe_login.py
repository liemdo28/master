# Debug login flow - capture network and console
from playwright.sync_api import sync_playwright

LOG = []
def log(m): LOG.append(str(m)); print(m, flush=True)

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page(viewport={"width":1920,"height":1080})
    # Capture console
    pg.on("console", lambda msg: log(f"CONSOLE[{msg.type}]: {msg.text}"))
    pg.on("pageerror", lambda err: log(f"PAGEERROR: {err}"))
    # Capture network requests
    pg.on("request", lambda req: log(f"REQ: {req.method} {req.url[:100]}") if "bakudan" in req.url else None)
    pg.on("response", lambda resp: log(f"RESP: {resp.status} {resp.url[:100]}") if "bakudan" in resp.url and "static" not in resp.url else None)

    pg.goto("https://www.bakudanramen.com/links-admin/", timeout=60000, wait_until="domcontentloaded")
    pg.wait_for_timeout(3000)
    log("Page loaded. Filling login...")
    pg.fill("#login-email", "admin@bakudanramen.com")
    pg.fill("#login-pwd", "admin")
    log("Clicking Sign In...")
    pg.click("#login-btn")
    pg.wait_for_timeout(8000)
    log("After login URL: " + pg.url)
    # Check what's visible
    body_text = pg.evaluate("() => document.body.innerText.substring(0, 500)")
    log("Body text: " + body_text[:500])
    pg.screenshot(path=r"d:\Project\Master\ai-video-guide-system\walkthrough_output\login_debug.png")
    b.close()

open(r"d:\Project\Master\ai-video-guide-system\walkthrough_output\login_debug.log","w").write("\n".join(LOG))
log("DONE")
