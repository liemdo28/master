# Probe bakudanramen.com/links-admin/ to find login form selectors
import sys, traceback
LOG = []
def log(m): LOG.append(str(m)); print(m, flush=True)

try:
    from playwright.sync_api import sync_playwright
    log("Playwright imported OK")
    p = sync_playwright().start()
    log("Playwright started")
    b = p.chromium.launch(headless=True)
    log("Browser launched")
    pg = b.new_page(viewport={"width":1920,"height":1080})
    log("Page created")
    resp = pg.goto("https://bakudanramen.com/links-admin/", timeout=60000, wait_until="domcontentloaded")
    log(f"Response status: {resp.status if resp else 'None'}")
    log(f"Title: {pg.title()}")
    log(f"URL: {pg.url}")
    pg.wait_for_timeout(3000)
    pg.screenshot(path=r"d:\Project\Master\ai-video-guide-system\walkthrough_output\login_test.png")
    log("Screenshot saved")
    inputs = pg.query_selector_all("input")
    log(f"Inputs: {len(inputs)}")
    for i, inp in enumerate(inputs):
        t = inp.get_attribute("type") or "text"
        n = inp.get_attribute("name") or ""
        iid = inp.get_attribute("id") or ""
        ph = inp.get_attribute("placeholder") or ""
        log(f"  input[{i}] type={t} name={n} id={iid} placeholder={ph}")
    btns = pg.query_selector_all("button")
    log(f"Buttons: {len(btns)}")
    for i, btn in enumerate(btns[:8]):
        txt = (btn.inner_text() or "").strip()[:50]
        log(f"  button[{i}]: {txt}")
    # Check for links or forms
    forms = pg.query_selector_all("form")
    log(f"Forms: {len(forms)}")
    b.close()
    p.stop()
except Exception as e:
    log("EXCEPTION: " + str(e))
    log(traceback.format_exc()[-800:])

open(r"d:\Project\Master\ai-video-guide-system\walkthrough_output\probe.log","w").write("\n".join(LOG))
log("DONE")
