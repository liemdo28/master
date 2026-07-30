"""
Demo 3: Safe Download — open local test page, click download link, verify file.
"""
import json
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent.parent
import sys
sys.path.insert(0, str(HERE))

from demo_runner import DemoRun


def main():
    page_path = HERE / "static" / "download-test.html"
    target = page_path.resolve().as_uri()

    downloads_dir = HERE / "downloads"
    downloads_dir.mkdir(exist_ok=True)
    download_path = downloads_dir / "operator-runtime-download.txt"

    out_dir = HERE / "evidence"
    out_dir.mkdir(exist_ok=True)
    screenshot_path = out_dir / "demo3_download.png"
    log_path = out_dir / "demo3_download_log.json"

    # Start clean
    if download_path.exists():
        download_path.unlink()

    demo = DemoRun(
        demo_name="Demo3-SafeDownload",
        target=target,
        adapter="playwright-chromium",
        mode="sandbox",
        approval_level="READ_ONLY",
    )

    started = time.time()
    log = {"target": target, "actions": [], "errors": []}

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
            context = browser.new_context(accept_downloads=True)
            page = context.new_page()
            page.set_default_timeout(10000)

            demo.action("open_test_page", f"goto {target}")
            log["actions"].append({"type": "open_test_page", "url": target})
            page.goto(target, wait_until="load")

            demo.action("capture_screenshot", f"save {screenshot_path.name}")
            page.screenshot(path=str(screenshot_path), full_page=True)

            demo.action("click_download_link", "click #downloadLink")
            log["actions"].append({"type": "click_download_link"})

            with page.expect_download(timeout=10000) as dl_info:
                page.click("#downloadLink")
            download = dl_info.value
            download.save_as(str(download_path))

            log["suggested_filename"] = download.suggested_filename
            log["saved_to"] = str(download_path)

            browser.close()

        # Verify file
        exists = download_path.exists()
        size = download_path.stat().st_size if exists else 0
        content = download_path.read_text(encoding="utf-8") if exists else ""

        log["file_exists"] = exists
        log["file_size_bytes"] = size
        log["file_content_preview"] = content[:200]

        demo.screenshot(str(screenshot_path), "Download test page screenshot")
        demo.register_download(str(download_path), "Safe test file download")

        duration = round(time.time() - started, 3)
        log["duration_seconds"] = duration
        log_path.write_text(json.dumps(log, indent=2), encoding="utf-8")
        demo.register_log(log, "Demo3 execution log")

        demo.action("done", "demo3 completed")
        demo.finish(success=True)

        result = {
            "success": exists and size > 0,
            "file_exists": exists,
            "file_size_bytes": size,
            "saved_to": str(download_path),
            "screenshot": str(screenshot_path),
            "log": str(log_path),
            "duration_seconds": duration,
            "run_id": demo.run["run_id"],
            "coord_task_id": demo.coord_task["coord_task_id"],
            "evidence_ids": demo.run["evidence_ids"],
        }
        print(json.dumps(result, indent=2))
        return result

    except Exception as e:
        log["errors"].append(str(e))
        log_path.write_text(json.dumps(log, indent=2), encoding="utf-8")
        demo.action("error", str(e), success=False, error=str(e))
        demo.finish(success=False, error=str(e))
        print(json.dumps({"success": False, "error": str(e)}, indent=2))
        raise


if __name__ == "__main__":
    main()