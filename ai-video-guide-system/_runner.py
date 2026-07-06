import base64, sys, pathlib  
p = pathlib.Path(r'd:\\Project\\Master\\ai-video-guide-system\\BILINGUAL_TTS_BENCHMARK.md')  
d = sys.stdin.buffer.read()  
p.write_bytes(base64.b64decode(d))  
