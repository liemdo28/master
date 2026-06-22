#!/usr/bin/env python3
"""
VieNeu-TTS Synthesis Script — Vietnamese Text-to-Speech for Mi-Core
Engine: Microsoft Edge TTS (edge-tts)
Voices: vi-VN-HoaiMyNeural (Female), vi-VN-NamMinhNeural (Male)

Usage:
  python vietts_synthesize.py --text "Xin chào" --output /path/to/output.mp3 --voice vi-VN-HoaiMyNeural
  python vietts_synthesize.py --file input.txt --output /path/to/output.mp3
  echo "Xin chào" | python vietts_synthesize.py --stdin --output /path/to/output.mp3

Env vars:
  VIETTS_VOICE — default voice (vi-VN-HoaiMyNeural)
  VIETTS_RATE  — speech rate adjustment (e.g. "+0%", "-10%", "+20%")
"""

import argparse
import asyncio
import json
import os
import sys
import time

import edge_tts


DEFAULT_VOICE = os.environ.get("VIETTS_VOICE", "vi-VN-HoaiMyNeural")
DEFAULT_RATE = os.environ.get("VIETTS_RATE", "+0%")


async def synthesize(text: str, output: str, voice: str, rate: str) -> dict:
    """Synthesize text to MP3 file."""
    t0 = time.time()
    try:
        communicate = edge_tts.Communicate(text, voice, rate=rate)
        await communicate.save(output)
        duration_ms = int((time.time() - t0) * 1000)
        # Get file size
        file_size = os.path.getsize(output) if os.path.exists(output) else 0
        return {
            "ok": True,
            "output": output,
            "voice": voice,
            "rate": rate,
            "text_length": len(text),
            "file_size_bytes": file_size,
            "duration_ms": duration_ms,
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}


def main():
    parser = argparse.ArgumentParser(description="VieNeu-TTS Vietnamese speech synthesis")
    parser.add_argument("--text", type=str, help="Text to synthesize")
    parser.add_argument("--file", type=str, help="File containing text to synthesize")
    parser.add_argument("--stdin", action="store_true", help="Read text from stdin")
    parser.add_argument("--output", type=str, required=True, help="Output MP3 file path")
    parser.add_argument("--voice", type=str, default=DEFAULT_VOICE, help=f"Voice name (default: {DEFAULT_VOICE})")
    parser.add_argument("--rate", type=str, default=DEFAULT_RATE, help=f"Speech rate (default: {DEFAULT_RATE})")
    parser.add_argument("--list-voices", action="store_true", help="List available Vietnamese voices")
    args = parser.parse_args()

    if args.list_voices:
        async def _list():
            voices = await edge_tts.list_voices()
            vi_voices = [v for v in voices if v["Locale"].startswith("vi-")]
            for v in vi_voices:
                print(json.dumps({
                    "short_name": v["ShortName"],
                    "gender": v["Gender"],
                    "locale": v["Locale"],
                    "friendly_name": v.get("FriendlyName", ""),
                }))
        asyncio.run(_list())
        return

    # Get text
    if args.stdin:
        text = sys.stdin.read().strip()
    elif args.file:
        with open(args.file, "r", encoding="utf-8") as f:
            text = f.read().strip()
    elif args.text:
        text = args.text
    else:
        print(json.dumps({"ok": False, "error": "Provide --text, --file, or --stdin"}))
        sys.exit(1)

    if not text:
        print(json.dumps({"ok": False, "error": "Empty text"}))
        sys.exit(1)

    # Ensure output directory exists
    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)

    result = asyncio.run(synthesize(text, args.output, args.voice, args.rate))
    print(json.dumps(result))
    sys.exit(0 if result["ok"] else 1)


if __name__ == "__main__":
    main()
