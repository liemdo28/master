"""
Demo 1: Public Read — navigate example.com, read title, extract links, screenshot.
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
    target = "https://example.com"
    out_dir = HERE / "evidence"
    out_dir.mkdir(exist_ok=True)
    screenshot_path = out_dir / "demo1_public_read.png"
    html_path = out_dir / "demo1_public_read.html"
    log_path = out_dir / "demo1_public_read_log.json"

    demo = DemoRun(
        demo_name="Demo1-PublicRead-example.com",
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
            context = browser.new_context()
            page = context.new_page()
            page.set_default_timeout(15000)

            demo.action("navigate", f"goto {target}")
            log["actions"].append({"type": "navigate", "url": target})
            page.goto(target, wait_until="domcontentloaded")

            demo.action("read_title", "read document.title")
            title = page.title()
            log["title"] = title
            log["actions"].append({"type": "read_title", "value": title})

            demo.action("extract_links", "query all <a> elements")
            links = page.eval_on_selector_all(
                "a",
                "els => els.map(e => ({href: e.href, text: e.innerText}))",
            )
            log["links"] = links
            log["link_count"] = len(links)
            log["actions"].append({"type": "extract_links", "count": len(links)})

            demo.action("screenshot", f"save {screenshot_path.name}")
            page.screenshot(path=str(screenshot_path), full_page=True)

            html = page.content()
            html_path.write_text(html, encoding="utf-8")

            browser.close()

        demo.screenshot(str(screenshot_path), "example.com full-page screenshot")
        demo.register_html(str(html_path), "example.com HTML snapshot")

        duration = round(time.time() - started, 3)
        log["duration_seconds"] = duration
        log_path.write_text(json.dumps(log, indent=2), encoding="utf-8")
        demo.register_log(log, "Demo1 execution log")

        demo.action("done", "demo1 completed")
        demo.finish(success=True)

        result = {
            "success": True,
            "title": title,
            "link_count": len(links),
            "screenshot": str(screenshot_path),
            "html_snapshot": str(html_path),
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