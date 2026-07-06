# BILINGUAL TTS BENCHMARK REPORT

> Benchmark comparing candidate TTS engines for English and Vietnamese voiceover quality.
> Hardware: Windows 11 (CPU-only, no GPU), Python 3.13, torch 2.12.1+cpu, Node.js v24.14.1

Date: 2026-07-06
Engine versions tested: edge-tts 6.0.0+

---

## 1. ENGINE CANDIDATES

| Engine | Source | GPU required | Install | Status |
|--------|--------|-------------|---------|--------|
| Edge TTS | pip install edge-tts | No | Available | BASELINE |
| Coqui XTTS | pip install TTS | Yes | Unavailable | Excluded |
| VITS (fairseq) | pip install fairseq | Yes | Unavailable | Excluded |
| Piper TTS | pip install piper-tts | No | Unavailable | Excluded |
| SAM (sam-hqq) | pip install sam-hqq | Yes | Unavailable | Excluded |
| Bark (Suno) | pip install bark | Yes | Unavailable | Excluded |
| Speecht5 (HuggingFace) | pip install transformers | No | Pending | Testing |
| Vosk | pip install vosk | No | Pending | Testing |

---

## 2. TEST SCRIPT

File: scripts/tts_benchmark.py

```python
import asyncio
import edge_tts
import wave
import json
import time
from pathlib import Path

OUTPUT_DIR = Path("benchmark_output")
OUTPUT_DIR.mkdir(exist_ok=True)

# Test sentences covering phoneme variety and language switching
ENGLISH_SENTENCES = [
    "The quick brown fox jumps over the lazy dog.",
    "Artificial intelligence is transforming how we create video content.",
    "Machine learning models can now generate human-like speech.",
]

VIETNAMESE_SENTENCES = [
    "Xin chao cac ban, hom nay chung ta se hoc ve AI.",
    "He thong tao video tu dong ngay cang tro nen pho bien.",
    "Cong nghe sinh tieu sac dang phat trien rat nhanh.",
]

# Voice presets
VOICE_MAP = {
    "en-US": "en-US-JennyNeural",
    "vi-VN": "vi-VN-NamMinhNeural",
}

async def synthesize(voice: str, text: str, filename: str):
    output_path = OUTPUT_DIR / filename
    try:
        start = time.time()
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(str(output_path))
        duration = time.time() - start
        file_size = output_path.stat().st_size
        print(f"[OK] {filename}: {duration:.2f}.XXf s, {file_size} bytes")
        print(f"[OK] {filename}: {duration:.2f}s, {file_size} bytes")
        return {"file": filename, "time": duration, "size": file_size, "error": None}
    except Exception as e:
        print(f"[FAIL] {filename}: {e}")
        return {"file": filename, "time": None, "size": None, "error": str(e)}

async def main():
    results = []
    tasks = []

    for voice, sentences in [("en-US", ENGLISH_SENTENCES), ("vi-VN", VIETNAMESE_SENTENCES)]:
        for i, sentence in enumerate(sentences):
            filename = f"{voice}_{i+1}.wav"
            tasks.append(synthesize(VOICE_MAP[voice], sentence, filename))

    results = await asyncio.gather(*tasks)

    report = {
        "date": "2026-07-06",
        "engine": "edge-tts 6.0.0+",
        "results": results,
    }

    with open(OUTPUT_DIR / "benchmark_results.json", "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"
Benchmark complete. Results saved to {OUTPUT_DIR / 'benchmark_results.json'}")

if __name__ == "__main__":
    asyncio.run(main())
```

Run with: python scripts/tts_benchmark.py

---

## 3. QUALITY EVALUATION CRITERIA

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Naturalness | 30% | Does it sound like a real human voice? |
| Prosody | 20% | Correct intonation, stress, and rhythm |
| Fluency | 20% | Smooth transitions, no stuttering or glitches |
| Language accuracy | 20% | Correct pronunciation, especially for Vietnamese diacritics |
| Latency | 10% | Time from text input to audio output |

---

## 4. RESULTS SUMMARY

### Edge TTS (Baseline)

| Language | Sentence | Duration (s) | File Size (bytes) | Status |
|----------|----------|--------------|-------------------|--------|
| en-US | Sentence 1 | pending | pending | waiting |
| en-US | Sentence 2 | pending | pending | waiting |
| en-US | Sentence 3 | pending | pending | waiting |
| vi-VN | Sentence 1 | pending | pending | waiting |
| vi-VN | Sentence 2 | pending | pending | waiting |
| vi-VN | Sentence 3 | pending | pending | waiting |

---

## 5. RECOMMENDATIONS

Based on current availability and hardware constraints:

1. **Edge TTS** is the primary recommendation for this project. It is already installed, requires no GPU, and supports both English and Vietnamese with high-quality neural voices.
2. **Speecht5** (HuggingFace) is a secondary option for offline use, but setup requires downloading model weights.
3. **Vosk** is best suited for speech recognition rather than synthesis; not recommended as a primary TTS engine.
4. GPU-dependent engines (Coqui XTTS, VITS, Bark, SAM) are excluded due to hardware limitations.

---

## 6. NEXT STEPS

- [ ] Run python scripts/tts_benchmark.py and record actual timing results.
- [ ] Manually evaluate output audio quality for both languages.
- [ ] Test prosody with longer sentences and technical terminology.
- [ ] Evaluate Speecht5 as a fallback offline engine.
- [ ] Compare file sizes and compression ratios if post-processing is needed.
- [ ] Consider adding rate/pitch control for more natural delivery.

---

*Report generated: 2026-07-06*
*Hardware: Windows 11, CPU-only*
