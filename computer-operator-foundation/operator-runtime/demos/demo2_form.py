"""
Demo 2: Local Test Form — fill name, email, message, submit, capture before/after screenshots.
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
    form_path = HERE / "static" / "test-form.html"
    target = form_path.resolve().as_uri()

    out_dir = HERE / "evidence"
    out_dir.mkdir(exist_ok=True)
    before_png = out_dir / "demo2_form_before.png"
    after_png = out_dir / "demo2_form_after.png"
    log_path = out_dir / "demo2_form_log.json"

    demo = DemoRun(
        demo_name="Demo2-LocalForm-FillSubmit",
        target=target,
        adapter="playwright-chromium",
        mode="sandbox",
        approval_level="SAFE_WRITE",
    )

    started = time.time()
    log = {"target": target, "actions": [], "errors": []}

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
            page = browser.new_page()
            page.set_default_timeout(10000)

            demo.action("open_local_form", f"goto {target}")
            log["actions"].append({"type": "open_local_form", "url": target})
            page.goto(target, wait_until="load")

            # BEFORE
            demo.action("capture_before_screenshot", f"save {before_png.name}")
            page.screenshot(path=str(before_png), full_page=True)
            log["actions"].append({"type": "capture_before_screenshot"})

            demo.action("fill_name", "fill #name = 'Operator Demo User'")
            page.fill("#name", "Operator Demo User")
            log["name_value"] = page.input_value("#name")

            demo.action("fill_email", "fill #email = 'demo@operator-runtime.local'")
            page.fill("#email", "demo@operator-runtime.local")
            log["email_value"] = page.input_value("#email")

            demo.action("fill_message", "fill #message")
            page.fill("#message", "This is a safe local test submission. No real email involved.")
            log["message_value"] = page.input_value("#message")

            demo.action("submit_test_form", "click #submitBtn")
            page.click("#submitBtn")
            page.wait_for_selector("#status", state="visible", timeout=5000)
            status_text = page.inner_text("#status")
            log["status_text"] = status_text

            # AFTER
            demo.action("capture_after_screenshot", f"save {after_png.name}")
            page.screenshot(path=str(after_png), full_page=True)
            log["actions"].append({"type": "capture_after_screenshot"})

            browser.close()

        demo.screenshot(str(before_png), "Form before fill")
        demo.screenshot(str(after_png), "Form after submit")

        duration = round(time.time() - started, 3)
        log["duration_seconds"] = duration
        log_path.write_text(json.dumps(log, indent=2), encoding="utf-8")
        demo.register_log(log, "Demo2 execution log")

        demo.action("done", "demo2 completed")
        demo.finish(success=True)

        result = {
            "success": True,
            "target": target,
            "name_value": log["name_value"],
            "email_value": log["email_value"],
            "message_value": log["message_value"],
            "status_text": status_text,
            "before_screenshot": str(before_png),
            "after_screenshot": str(after_png),
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