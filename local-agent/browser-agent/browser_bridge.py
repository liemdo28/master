"""
Browser Bridge — Python side of WS8 Browser Agent.
Called by BrowserAgent.mjs via spawn.

Usage:
  python3 browser_bridge.py '{"action":"extract","url":"...","task":"..."}'
"""

import sys
import json
import asyncio


async def run_browser_task(params: dict) -> dict:
    try:
        from browser_use import Agent
        from langchain_ollama import ChatOllama
    except ImportError as e:
        return {"ok": False, "error": f"Import error: {e}. Run: pip install browser-use langchain-ollama playwright && playwright install chromium"}

    action = params.get("action", "extract")
    url = params.get("url", "")
    task = params.get("task", "")
    headless = params.get("headless", True)

    if not url or not task:
        return {"ok": False, "error": "url and task are required"}

    # Use local Ollama model for browser-use agent
    llm = ChatOllama(
        model="qwen3:8b",
        base_url="http://localhost:11434",
    )

    full_task = f"Go to {url}. {task}"

    try:
        agent = Agent(
            task=full_task,
            llm=llm,
            headless=headless,
        )
        result = await agent.run()
        return {
            "ok": True,
            "action": action,
            "url": url,
            "result": str(result),
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "No params provided"}))
        sys.exit(1)

    try:
        params = json.loads(sys.argv[1])
    except json.JSONDecodeError as e:
        print(json.dumps({"ok": False, "error": f"Invalid JSON: {e}"}))
        sys.exit(1)

    result = asyncio.run(run_browser_task(params))
    print(json.dumps(result))
