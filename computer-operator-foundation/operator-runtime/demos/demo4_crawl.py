"""
Demo 4: Local Static Site Crawl — crawl a 3-page local site, extract titles, screenshots.
"""
import json
import time
from pathlib import Path
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent.parent
import sys
sys.path.insert(0, str(HERE))

from demo_runner import DemoRun


def main():
    site_root = HERE / "static" / "multi-page" / "index.html"
    target = site_root.resolve().as_uri()
    base = site_root.parent.resolve().as_uri() + "/"

    out_dir = HERE / "evidence"
    out_dir.mkdir(exist_ok=True)
    log_path = out_dir / "demo4_crawl_log.json"

    demo = DemoRun(
        demo_name="Demo4-LocalSiteCrawl-3pages",
        target=target,
        adapter="playwright-chromium",
        mode="sandbox",
        approval_level="READ_ONLY",
    )

    started = time.time()
    log = {"base": base, "pages": [], "errors": []}

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
            page = browser.new_page()
            page.set_default_timeout(10000)

            demo.action("open_homepage", f"goto {target}")
            page.goto(target, wait_until="load")
            home_title = page.title()
            home_shot = out_dir / "demo4_page1_home.png"
            page.screenshot(path=str(home_shot), full_page=True)
            demo.screenshot(str(home_shot), "Page 1: Home")

            demo.action("extract_internal_links", "query nav a[href]")
            home_links = page.eval_on_selector_all(
                "nav a",
                "els => els.map(e => ({href: e.getAttribute('href'), text: e.innerText}))",
            )
            internal_links = []
            for l in home_links:
                href = l["href"]
                if href and not href.startswith("http"):
                    resolved = urljoin(base, href)
                    internal_links.append(resolved)

            log["pages"].append({
                "seq": 1,
                "name": "home",
                "url": target,
                "title": home_title,
                "screenshot": str(home_shot),
                "extracted_links": internal_links,
            })

            # Visit each of the other two pages
            for seq, link in enumerate(internal_links[:2], start=2):
                demo.action(f"visit_page_{seq}", f"goto {link}")
                page.goto(link, wait_until="load")
                title = page.title()
                shot = out_dir / f"demo4_page{seq}_{Path(link).stem}.png"
                page.screenshot(path=str(shot), full_page=True)
                demo.screenshot(str(shot), f"Page {seq}: {Path(link).stem}")
                log["pages"].append({
                    "seq": seq,
                    "name": Path(link).stem,
                    "url": link,
                    "title": title,
                    "screenshot": str(shot),
                })

            browser.close()

        log["pages_visited"] = len(log["pages"])
        log["titles"] = [p["title"] for p in log["pages"]]
        crawl_summary = {
            "base": base,
            "page_count": len(log["pages"]),
            "pages": [
                {"seq": p["seq"], "name": p["name"], "title": p["title"], "url": p["url"]}
                for p in log["pages"]
            ],
        }

        duration = round(time.time() - started, 3)
        log["duration_seconds"] = duration
        log_path.write_text(json.dumps(log, indent=2), encoding="utf-8")
        demo.register_log(log, "Demo4 execution log")
        demo.register_crawl_summary(crawl_summary, "Local 3-page crawl summary")

        demo.action("done", "demo4 completed")
        demo.finish(success=True)

        result = {
            "success": True,
            "base": base,
            "pages_visited": len(log["pages"]),
            "titles": log["titles"],
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