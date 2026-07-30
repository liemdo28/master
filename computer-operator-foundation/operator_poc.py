from pathlib import Path
from playwright.sync_api import sync_playwright
import json
import time

BASE = Path(r"d:\Project\computer-operator-foundation")
HTML = BASE / "test-page.html"
SCREENSHOT = BASE / "local-proof.png"
DOWNLOAD = BASE / "operator-download.txt"
UPLOAD = BASE / "upload-source.txt"
LOG = BASE / "operator-poc-log.json"


def main():
    started = time.time()
    result = {
        "command": "python d:\\Project\\computer-operator-foundation\\operator_poc.py",
        "started_epoch": started,
        "site": HTML.resolve().as_uri(),
        "success": False,
        "errors": [],
    }
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
        page = browser.new_page()
        page.set_default_timeout(10000)
        page.goto(HTML.resolve().as_uri(), wait_until="load")
        result["title"] = page.title()
        result["initial_msg"] = page.locator("#msg").inner_text()
        page.fill("#name", "Mi PoC")
        page.click("#submit")
        result["post_submit_msg"] = page.locator("#msg").inner_text()
        page.set_input_files("#upload", str(UPLOAD))
        result["upload_file"] = UPLOAD.name
        with page.expect_download() as download_info:
            page.click("#download")
        download = download_info.value
        download.save_as(str(DOWNLOAD))
        result["download_file"] = DOWNLOAD.name
        page.screenshot(path=str(SCREENSHOT), full_page=True)
        browser.close()
    result["duration_seconds"] = round(time.time() - started, 2)
    result["success"] = True
    LOG.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
