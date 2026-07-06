# Records a REAL walkthrough of bakudanramen.com/links-admin/ as admin user
# Captures screenshots at each step, then assembles into a video with English TTS + subtitles
import os, sys, time, traceback, subprocess, asyncio, shutil, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

FFMPEG = r"C:\Users\liemdo\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.2-full_build\bin\ffmpeg.exe"
OUT = Path(r"d:\Project\Master\ai-video-guide-system\walkthrough_output")
OUT.mkdir(exist_ok=True)
SHOTS = OUT / "real_shots"
if SHOTS.exists(): shutil.rmtree(SHOTS)
SHOTS.mkdir()

EMAIL = "admin@bakudanramen.com"
PWD = "admin123"

BASE = "https://www.bakudanramen.com/links-admin/"

LOG = []
def log(m):
    LOG.append(str(m)); print(m, flush=True)

def sec(t):
    h = int(t // 3600); mi = int((t % 3600) // 60); s = int(t % 60); ms = int((t - int(t)) * 1000)
    return f"{h:02d}:{mi:02d}:{s:02d},{ms:03d}"


# Navigation steps: (filename, action_description, subtitle, nav_path_or_action)
# We navigate by clicking sidebar items (matching the real UI)
STEPS = [
    ("01_login", "Login page", "Welcome to Bakudan Ramen Links Hub Admin. Sign in with your admin credentials.", "login"),
    ("02_dashboard", "Dashboard", "Dashboard: Action Required alerts, KPI tiles, Quick Actions, and Pages Overview.", "dashboard"),
    ("03_pages", "Pages", "Pages: control center. Green badge = public Customer Link Hub. Purple = private Staff Training.", "pages"),
    ("04_page_edit_buttons", "Page Editor - Buttons", "Buttons tab: manage every button. Save as Template, drag to reorder, toggle Visible, Enabled, Featured.", "page_edit"),
    ("05_page_edit_sections", "Page Editor - Sections", "Sections tab: group buttons under headers like Order Online or Rewards.", "page_sections"),
    ("06_page_edit_settings", "Page Editor - Page Settings", "Page Settings: title, URL slug, visibility, SEO. Google preview updates live.", "page_settings"),
    ("07_templates", "Templates", "Templates: save a page as Template once, reuse for new stores in one click.", "templates"),
    ("08_campaigns", "Campaigns", "Campaigns: track marketing initiatives. Clicks roll up from all shortlinks.", "campaigns"),
    ("09_utm", "UTM Builder", "UTM Builder: track which channel drives clicks. Copy URL or create Shortlink plus QR.", "utm"),
    ("10_qr", "QR and Shortlinks", "QR and Shortlinks: library of all shortlinks with QR images and click counts.", "qr"),
    ("11_customer_service", "Customer Service", "Customer Service: post temporary Service Notices as banners on the public Link Hub.", "cs"),
    ("12_staff_training", "Staff Training", "Staff Training: private page, unlisted, no index. Internal Use Only.", "staff"),
    ("13_scheduling", "Scheduling", "Scheduling: combined calendar view of everything with start or end dates.", "scheduling"),
    ("14_blog", "Blog Composer", "Blog: write posts with ready-made templates. Rich text editor with emoji.", "blog"),
    ("15_locations", "Locations", "Locations: single source of truth for phone, address, Toast links, and hours.", "locations"),
    ("16_seo", "SEO Manager", "SEO Manager: overview of every page SEO. Red alerts for missing fields.", "seo"),
    ("17_link_health", "Link Health", "Link Health: checks links periodically for broken, redirected, or timed out URLs.", "health"),
    ("18_analytics", "Analytics", "Analytics: real page view and click numbers. Views and clicks in 24 hours.", "analytics"),
    ("19_audit_log", "Audit Log", "Audit Log: every change recorded with who did what and when.", "audit"),
    ("20_settings", "Settings", "Settings: Instagram and Facebook links, headline text, marketing copy.", "settings"),
    ("21_outro", "Outro", "That completes the tour. Core modules are live today. Thank you for watching.", "outro"),
]

# Sidebar nav selectors (text-based, robust)
NAV_CLICKS = {
    "dashboard": "Dashboard",
    "pages": "Pages",
    "templates": "Templates",
    "campaigns": "Campaigns",
    "utm": "UTM Builder",
    "qr": "QR & Shortlinks",
    "cs": "Customer Service",
    "staff": "Staff Training",
    "scheduling": "Scheduling",
    "blog": "Blog",
    "locations": "Locations",
    "seo": "SEO Manager",
    "health": "Link Health",
    "analytics": "Analytics",
    "audit": "Audit Log",
    "settings": "Settings",
}


def click_sidebar(page, nav_key):
    """Click a sidebar nav item using a.sidebar-link with exact text."""
    label = NAV_CLICKS.get(nav_key)
    if label is None:
        return True
    try:
        loc = page.locator("a.sidebar-link", has_text=label).first
        loc.click(timeout=10000)
        page.wait_for_timeout(2500)
        return True
    except Exception as e:
        log(f"  sidebar click '{label}' failed: {e}")
        return False


def record():
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True)
        ctx = b.new_context(viewport={"width":1920,"height":1080}, device_scale_factor=1)
        pg = ctx.new_page()
        shot_idx = 0
        for fname, desc, subtitle, nav_key in STEPS:
            log(f"[{shot_idx+1}/{len(STEPS)}] {fname}: {desc}")
            try:
                if nav_key == "login":
                    pg.goto(BASE, timeout=60000, wait_until="domcontentloaded")
                    pg.wait_for_timeout(2000)
                elif nav_key == "dashboard":
                    # Login first
                    pg.goto(BASE, timeout=60000, wait_until="domcontentloaded")
                    pg.wait_for_timeout(1500)
                    pg.fill("#login-email", EMAIL)
                    pg.wait_for_timeout(300)
                    pg.fill("#login-pwd", PWD)
                    pg.wait_for_timeout(300)
                    pg.get_by_role("button", name="Sign In to Dashboard").click(timeout=10000)
                    pg.wait_for_timeout(3000)
                elif nav_key == "page_edit":
                    click_sidebar(pg, "pages")
                    pg.wait_for_timeout(1500)
                    # Click Edit on first page
                    try:
                        pg.get_by_text("Edit", exact=False).first.click(timeout=8000)
                        pg.wait_for_timeout(2500)
                    except: pass
                elif nav_key == "page_sections":
                    try:
                        pg.get_by_text("Sections", exact=False).first.click(timeout=8000)
                        pg.wait_for_timeout(2000)
                    except: pass
                elif nav_key == "page_settings":
                    try:
                        pg.get_by_text("Page Settings", exact=False).first.click(timeout=8000)
                        pg.wait_for_timeout(2000)
                    except: pass
                elif nav_key == "outro":
                    # Just take a final shot of dashboard
                    click_sidebar(pg, "dashboard") if NAV_CLICKS.get("dashboard") else None
                    pg.wait_for_timeout(1500)
                else:
                    click_sidebar(pg, nav_key)
                    pg.wait_for_timeout(2000)
                # Screenshot
                pg.screenshot(path=str(SHOTS / f"{fname}.png"))
                log(f"  saved {fname}.png")
            except Exception as e:
                log(f"  ERROR on {fname}: {e}")
                # Try to screenshot anyway
                try:
                    pg.screenshot(path=str(SHOTS / f"{fname}.png"))
                except: pass
            shot_idx += 1
        b.close()
    log(f"Captured {len(list(SHOTS.glob('*.png')))} screenshots")

def build_video():
    """Assemble screenshots into video with TTS + subtitles."""
    shots = sorted(SHOTS.glob("*.png"))
    log(f"Building video from {len(shots)} screenshots")
    if not shots:
        log("No screenshots found, aborting")
        return

    # Pad each screenshot to 1920x1080 (in case viewport differs) and convert to a sequence
    # Each shot displays for 5 seconds
    DUR_PER_SHOT = 5.0
    FPS = 30
    frames_per_shot = int(DUR_PER_SHOT * FPS)

    # Build SRT subtitles (one per shot)
    srt_lines = []
    t = 0.0
    for i, (fname, desc, subtitle, nav_key) in enumerate(STEPS):
        start = t; end = t + DUR_PER_SHOT
        srt_lines.append(str(i + 1))
        srt_lines.append(f"{sec(start)} --> {sec(end)}")
        srt_lines.append(subtitle)
        srt_lines.append("")
        t = end
    srt_path = OUT / "real_subs_en.srt"
    srt_path.write_text("\n".join(srt_lines), encoding="utf-8")
    log(f"SRT saved: {srt_path}")

    # Synthesize TTS narration (concatenated subtitles)
    async def synth():
        import edge_tts
        full = " ".join([s[2] for s in STEPS])
        log(f"Synthesizing TTS: {len(full)} chars")
        communicate = edge_tts.Communicate(full, voice="en-US-AriaNeural", rate="+0%")
        await communicate.save(str(OUT / "real_narration_en.mp3"))
    asyncio.run(synth())
    raw_audio = OUT / "real_narration_en.mp3"
    log(f"TTS saved: {raw_audio} ({raw_audio.stat().st_size:,} bytes)")

    # Speed up audio to fit total video duration
    total_dur = len(shots) * DUR_PER_SHOT
    # Probe raw audio duration
    ffprobe = FFMPEG.replace("ffmpeg.exe", "ffprobe.exe")
    r = subprocess.run([ffprobe, "-v", "error", "-show_entries", "format=duration",
                        "-of", "default=noprint_wrappers=1:nokey=1", str(raw_audio)],
                       capture_output=True, text=True)
    raw_dur = float(r.stdout.strip()) if r.stdout.strip() else total_dur * 2.5
    log(f"Raw audio: {raw_dur:.1f}s, target: {total_dur:.1f}s")
    factor = raw_dur / total_dur if raw_dur > total_dur else 1.0
    # Chain atempo (max 2.0 each)
    atempos = []
    f = factor
    while f > 2.0:
        atempos.append(2.0); f /= 2.0
    if f > 1.01:
        atempos.append(round(f, 3))
    atempo_filter = ",".join([f"atempo={x}" for x in atempos]) if atempos else "anull"
    log(f"atempo filter: {atempo_filter}")
    fast_audio = OUT / "real_narration_en_fast.mp3"
    subprocess.run([FFMPEG, "-y", "-i", str(raw_audio), "-filter:a", atempo_filter, "-vn", str(fast_audio)],
                   capture_output=True, text=True)
    log(f"Fast audio: {fast_audio} ({fast_audio.stat().st_size:,} bytes)")

    # Build video from PNG sequence (each shot held for DUR_PER_SHOT seconds)
    # Create a concat-friendly input list
    list_file = OUT / "shots_list.txt"
    with open(list_file, "w") as lf:
        for s in shots:
            lf.write(f"file '{s}'\n")
            lf.write(f"duration {DUR_PER_SHOT}\n")
        # Repeat last entry (concat demuxer requirement)
        lf.write(f"file '{shots[-1]}'\n")
    base_video = OUT / "real_base.mp4"
    subprocess.run([FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", str(list_file),
                    "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=30",
                    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "medium",
                    str(base_video)], capture_output=True, text=True)
    log(f"Base video: {base_video} ({base_video.stat().st_size:,} bytes)")

    # Mux base video + fast audio + burn subtitles (run from temp dir for SRT path)
    final_video = OUT / "bakudan_admin_guide_REAL_en.mp4"
    if final_video.exists(): final_video.unlink()
    tmpd = tempfile.mkdtemp()
    shutil.copy(str(srt_path), os.path.join(tmpd, "subs.srt"))
    cmd = [FFMPEG, "-y", "-i", str(base_video), "-i", str(fast_audio),
           "-vf", "subtitles=subs.srt",
           "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20",
           "-c:a", "aac", "-b:a", "128k", "-shortest", str(final_video)]
    r = subprocess.run(cmd, capture_output=True, text=True, cwd=tmpd)
    shutil.rmtree(tmpd, ignore_errors=True)
    if final_video.exists():
        sz = final_video.stat().st_size
        log(f"\n=== REAL VIDEO READY ===")
        log(f"Path: {final_video}")
        log(f"Size: {sz:,} bytes ({sz/1024/1024:.2f} MB)")
    else:
        log("FINAL MUX FAILED:")
        log(r.stderr[-1500:])

if __name__ == "__main__":
    log("=== STEP 1: Recording real screenshots ===")
    try:
        record()
    except Exception as e:
        log(f"Record failed: {e}")
        log(traceback.format_exc()[-800:])
    log("\n=== STEP 2: Building video ===")
    try:
        build_video()
    except Exception as e:
        log(f"Build failed: {e}")
        log(traceback.format_exc()[-800:])
    open(OUT / "record.log", "w").write("\n".join(LOG))
    log("\nDONE")

