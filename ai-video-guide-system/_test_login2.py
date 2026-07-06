import sys, traceback
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")
log = open(r"d:\Project\Master\ai-video-guide-system\walkthrough_output\test_login2.log", "w", encoding="utf-8")
def L(m):
    print(m, flush=True)
    log.write(str(m) + "\n"); log.flush()
try:
    from playwright.sync_api import sync_playwright
    L("starting")
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True)
        pg = b.new_page(viewport={"width":1920,"height":1080})
        pg.goto("https://www.bakudanramen.com/links-admin/", timeout=60000, wait_until="domcontentloaded")
        pg.wait_for_timeout(2000)
        L("page loaded")
        pg.fill("#login-email", "admin@bakudanramen.com")
        pg.fill("#login-pwd", "admin123")
        L("filled creds, clicking")
        pg.click("#login-btn")
        pg.wait_for_timeout(6000)
        has = pg.evaluate("() => document.body.innerText.includes('Dashboard') || document.body.innerText.includes('Total Buttons')")
        L("has_dashboard: " + str(has))
        pg.screenshot(path=r"d:\Project\Master\ai-video-guide-system\walkthrough_output\login_test2.png")
        L("screenshot saved")
        # If dashboard, probe nav structure
        if has:
            navs = pg.evaluate("""() => {
                const out = [];
                document.querySelectorAll('a, button, [role=tab], [role=menuitem], li').forEach(el => {
                    const t = (el.innerText||'').trim();
                    if (t && t.length < 40 && ['Pages','Templates','Campaigns','SEO','UTM','Blog','Locations','Settings','Dashboard','Scheduling','Analytics','Staff','Customer','QR','Audit','Link Health'].some(k => t.includes(k))) {
                        out.push({tag: el.tagName, cls: el.className.substring(0,60), text: t, id: el.id});
                    }
                });
                return out.slice(0, 25);
            }""")
            L("NAV ITEMS: " + str(navs))
        b.close()
    L("DONE")
except Exception as e:
    L("ERROR: " + str(e))
    L(traceback.format_exc()[-1000:])
log.close()
