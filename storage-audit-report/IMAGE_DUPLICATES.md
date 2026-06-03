# IMAGE AUDIT
**Generated:** 2026-06-01 | **Phase 0: SCAN ONLY**

---

## Image Count by Drive

| Drive | JPG/JPEG | PNG | WebP | HEIC | Total |
|-------|---------|-----|------|------|-------|
| D:\ | ~1 | — | — | — | ~1 |
| E:\ | ~1,200 | ~1,200 | ~45 | — | ~2,445 |
| F:\ | ~1,500+ | ~1,500+ | — | — | (scanning) |
| G:\My Drive | ~100+ | ~50 | — | — | ~150+ |

> Note: E:\ count includes QA screenshots in project folders

---

## Image Locations

### E:\ — Project QA Screenshots (~2,000 files)

| Location | Count | Description |
|----------|-------|-------------|
| `E:\Project\Master\Bakudan\bakudanramen.com-current\qa\artifacts\` | ~50+ | QA screenshots for bakudanramen.com |
| `E:\Project\Master\Bakudan\bakudanramen.com-current\` (Bakudan Photos) | ~300+ | Restaurant photos |
| `E:\Project\Master\Bakudan\dashboard.bakudanramen.com\` | ~100+ | Dashboard screenshots |
| All other projects (embedded images) | ~2,000+ | Website images, UI assets |

### G:\My Drive — Personal/Business Photos

| Folder | Count | Description |
|--------|-------|-------------|
| `G:\My Drive\Hinh\` | ~101 | DSC photos (camera) |
| `G:\My Drive\Personal\Image\` | — | Personal photos |
| `G:\My Drive\Personal\Pic Nhung's wedding\` | — | Wedding photos |
| `G:\My Drive\Personal\40 edited dalat pic\` | ~40 | Đà Lạt trip |

### E:\ Root Loose Image

| File | Path | Action |
|------|------|--------|
| `Screenshot 2026-03-24 160416.png` | `E:\` root | Move to Personal folder |

---

## Potential Duplicates (Manual Verification Needed)

### 1. Restaurant Photos — Multiple Copies

| Location | Notes |
|----------|-------|
| `E:\Project\Master\Bakudan\bakudanramen.com-current\images\` | Website images |
| `E:\Project\Master\Bakudan\bakudanramen.com-current\Bakudan Photo\` | Raw photos |
| `E:\Project\Master\Bakudan\bakudanramen.com-current\Bakudan Photos 2026\` | 2026 photos |
| `F:\Projects\bakudanramen.com\images\` | F copy |
| `F:\Projects\bakudan-sync\bakudanwebsite_sub\images\` | Another copy |

> **Estimated duplicates:** 300–500 restaurant photos likely duplicated across 3–4 locations.

### 2. QA Screenshots — Redundant Sets

| Location | Notes |
|----------|-------|
| `...\qa\artifacts\bkdn_qa_shots\` | Production QA |
| `...\qa\artifacts\bkdn_sub_qa_shots\` | Local QA |
| `...\qa\artifacts\bkdn_temp_shots\` | Temp page QA |
| `...\qa\artifacts\bkdn_qa_video\` | Video recordings |

> QA artifacts are **not duplicates** — they are evidence files. Keep all.

### 3. Dashboard Screenshots

| Location | Notes |
|----------|-------|
| `F:\Projects\guidline-record\` | Dashboard walkthrough screenshots |
| `F:\Projects\Archive\dashboard-archive\` | Old dashboard images |
| `E:\Project\Bakudan\Dashboard\` | Old copies |

---

## Full SHA256 Deduplication

> Phase 0 constraint: Full SHA256 scan across all drives would require hours.  
> Run the following PowerShell after CEO approval to get exact duplicates:

```powershell
# Find exact image duplicates by hash
$images = Get-ChildItem -Path "E:\","F:\Projects" -Recurse -Include "*.jpg","*.jpeg","*.png","*.webp" `
  -Exclude "node_modules","$RECYCLE.BIN" -ErrorAction SilentlyContinue

$hashes = @{}
foreach ($img in $images) {
    $hash = (Get-FileHash $img.FullName -Algorithm SHA256).Hash
    if ($hashes[$hash]) { 
        Write-Host "DUPLICATE: $($img.FullName)"
        Write-Host "  Original: $($hashes[$hash])"
    } else { $hashes[$hash] = $img.FullName }
}
```

---

## Recommendations (Pending CEO Approval)

| Action | Impact | Priority |
|--------|--------|----------|
| Consolidate restaurant photos to single canonical folder | Save ~500MB+ | Medium |
| Archive old QA screenshots (>90 days) | Save ~200MB | Low |
| Remove `F:\Projects\bakudan-sync\` image copies | Save ~400MB | Medium |
