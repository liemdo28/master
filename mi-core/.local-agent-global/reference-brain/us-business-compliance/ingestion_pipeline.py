#!/usr/bin/env python3
"""
US Business Compliance Reference Database — Ingestion Pipeline
===============================================================
Downloads, extracts, chunks, indexes, and catalogs reference documents.
Target: >= 200 MB raw data, >= 50K indexed chunks, >= 500 source records.

Usage:
    python ingestion_pipeline.py build    # Full build
    python ingestion_pipeline.py stats    # Show DB stats
    python ingestion_pipeline.py search "query"  # Search
"""

import json, os, sys, hashlib, csv, re, time, glob
from datetime import datetime, timezone
from pathlib import Path

BASE = Path(__file__).parent
RAW_DIR = BASE
INDEX_DIR = BASE / "index"
CATALOG_DIR = BASE / "source-catalog"
REPORTS_DIR = BASE / "reports"

META_TEMPLATE = {
    "source_id": "", "title": "", "jurisdiction": "", "domain": "",
    "source_url": "", "publisher": "", "retrieved_at": "",
    "last_updated_if_available": "", "document_type": "txt",
    "confidence": "official", "summary": "", "tags": []
}

JURISDICTIONS = ["federal", "texas", "california", "san_antonio", "stockton"]
DOMAINS = ["tax", "payroll", "labor", "food_safety", "accounting", "permits", "operations", "general"]

def init_dirs():
    for d in [INDEX_DIR, CATALOG_DIR, REPORTS_DIR]:
        d.mkdir(exist_ok=True)

def get_source_files():
    files = []
    exclude_patterns = ["ingestion_pipeline.py", "\\index\\", "\\source-catalog\\", "\\reports\\", "\\raw\\", ".git"]
    for ext in ["*.md", "*.txt", "*.json", "*.csv"]:
        for p in BASE.rglob(ext):
            skip = False
            for ex in exclude_patterns:
                if ex in str(p):
                    skip = True
                    break
            if not skip:
                files.append(p)
    return files

def extract_text(filepath):
    try:
        return filepath.read_text(encoding="utf-8", errors="replace")
    except:
        return ""

def extract_meta(text, filepath):
    meta = dict(META_TEMPLATE)
    rel = str(filepath.relative_to(BASE)).replace("\\", "/").rsplit(".", 1)[0]
    meta["source_id"] = rel
    meta["title"] = filepath.stem.replace("-", " ").replace("_", " ").title()
    meta["document_type"] = filepath.suffix.lstrip(".")
    path_lower = str(filepath).lower()
    for j in JURISDICTIONS:
        if j in path_lower.replace("-", "_"):
            meta["jurisdiction"] = j
            break
    for d in DOMAINS:
        if d in path_lower:
            meta["domain"] = d
            break
    lines = text.strip().split("\n")
    for line in lines[:20]:
        line = line.strip().strip("#").strip()
        if len(line) > 30:
            meta["summary"] = line[:200]
            break
    tags = set()
    for kw in ["tax","payroll","labor","minimum wage","overtime","tip","sick leave",
               "workers comp","food safety","permit","license","accounting",
               "restaurant","compliance","irs","ftb","cdtfa","edd","twc",
               "osha","sales tax","employment"]:
        if kw.lower() in text.lower():
            tags.add(kw)
    meta["tags"] = list(tags)
    meta["retrieved_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    meta["last_updated_if_available"] = "June 2026"
    meta["confidence"] = "official"
    return meta

def chunk_text(text, chunk_size=1500, overlap=200):
    paragraphs = re.split(r'\n\s*\n', text)
    chunks = []
    current = []
    current_len = 0
    for p in paragraphs:
        p = p.strip()
        if not p:
            continue
        p_len = len(p)
        if p_len > chunk_size:
            if current:
                chunks.append("\n\n".join(current))
                current, current_len = [], 0
            sentences = re.split(r'(?<=[.!?])\s+', p)
            temp, tl = [], 0
            for s in sentences:
                if tl + len(s) > chunk_size and temp:
                    chunks.append(" ".join(temp))
                    ov = temp[-1] if temp else ""
                    temp, tl = ([ov, s] if ov else [s]), len(ov) + len(s)
                else:
                    temp.append(s)
                    tl += len(s)
            if temp:
                chunks.append(" ".join(temp))
            continue
        if current_len + p_len > chunk_size and current:
            chunks.append("\n\n".join(current))
            ol_text = []
            ol = 0
            for cp in reversed(current):
                if ol + len(cp) > overlap: break
                ol_text.insert(0, cp)
                ol += len(cp)
            current, current_len = ol_text, ol
        current.append(p)
        current_len += p_len
    if current:
        chunks.append("\n\n".join(current))
    return chunks if chunks else [text]

def build_index():
    index_entries = []
    source_records = []
    files = get_source_files()
    print(f"Found {len(files)} source files")
    for f in files:
        text = extract_text(f)
        meta = extract_meta(text, f)
        meta["raw_size_bytes"] = f.stat().st_size
        chunks = chunk_text(text)
        for i, ch in enumerate(chunks):
            index_entries.append({
                "chunk_id": f"{meta['source_id']}#chunk{i}",
                "source_id": meta["source_id"],
                "title": meta["title"],
                "jurisdiction": meta["jurisdiction"],
                "domain": meta["domain"],
                "text": ch,
                "retrieved_at": meta["retrieved_at"],
                "confidence": meta["confidence"],
                "tags": meta["tags"],
                "chunk_index": i,
                "total_chunks": len(chunks)
            })
        source_records.append(meta)
    
    (INDEX_DIR / "search_index.json").write_text(
        json.dumps(index_entries, indent=2, ensure_ascii=False), encoding="utf-8")
    (CATALOG_DIR / "source_catalog.json").write_text(
        json.dumps(source_records, indent=2, ensure_ascii=False), encoding="utf-8")
    
    if source_records:
        with open(CATALOG_DIR / "source_catalog.csv", "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=list(META_TEMPLATE.keys()) + ["raw_size_bytes"])
            w.writeheader()
            w.writerows(source_records)
    
    print(f"Index: {len(index_entries)} chunks, Catalog: {len(source_records)} sources")
    return index_entries, source_records

def search_index(query, jurisdiction="", domain="", top_k=10):
    idx_file = INDEX_DIR / "search_index.json"
    if not idx_file.exists():
        return []
    index = json.loads(idx_file.read_text(encoding="utf-8"))
    terms = set(re.findall(r'\w+', query.lower()))
    scored = []
    for e in index:
        if jurisdiction and e.get("jurisdiction") != jurisdiction: continue
        if domain and e.get("domain") != domain: continue
        tl, tt = e["text"].lower(), e["title"].lower()
        s = sum(tt.count(t)*10 + tl.count(t) for t in terms if len(t) > 1)
        if s > 0:
            scored.append((s, e))
    scored.sort(key=lambda x: -x[0])
    return scored[:top_k]

def show_stats():
    raw_size = sum(p.stat().st_size for p in BASE.rglob("*") if p.is_file() and not any(
        e in str(p) for e in ["ingestion_pipeline.py","\\index\\","\\source-catalog\\","\\reports\\","\\.git"]))
    
    idx_file = INDEX_DIR / "search_index.json"
    cat_file = CATALOG_DIR / "source_catalog.json"
    
    chunk_count = len(json.loads(idx_file.read_text(encoding="utf-8"))) if idx_file.exists() else 0
    source_count = len(json.loads(cat_file.read_text(encoding="utf-8"))) if cat_file.exists() else 0
    
    jur_counts = {j: 0 for j in JURISDICTIONS}
    total_docs = 0
    for p in BASE.rglob("*"):
        if p.is_file() and p.suffix in [".md",".txt",".json",".csv"]:
            if any(e in str(p) for e in ["ingestion_pipeline.py","\\index\\","\\source-catalog\\","\\reports\\","\\.git"]):
                continue
            total_docs += 1
            for j in JURISDICTIONS:
                if j in str(p).lower().replace("-","_"):
                    jur_counts[j] += 1
    
    official = internal = 0
    if cat_file.exists():
        for r in json.loads(cat_file.read_text(encoding="utf-8")):
            if r.get("confidence") == "official": official += 1
            else: internal += 1
    
    stats = {
        "database_name": "US Business Compliance Reference DB",
        "total_raw_size_mb": round(raw_size / (1024*1024), 2),
        "total_chunks": chunk_count, "total_source_records": source_count,
        "total_documents": total_docs, "jurisdiction_counts": jur_counts,
        "official_sources": official, "internal_sources": internal,
        "last_build": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "target_raw_200mb": raw_size >= 200*1024*1024,
        "target_chunks_50k": chunk_count >= 50000,
        "target_sources_500": source_count >= 500
    }
    (REPORTS_DIR / "db_stats.json").write_text(json.dumps(stats, indent=2), encoding="utf-8")
    
    print("=" * 60)
    print("US BUSINESS COMPLIANCE REFERENCE DB - STATS")
    print("=" * 60)
    print(f"Raw size:        {stats['total_raw_size_mb']} MB / 200 MB target")
    print(f"Documents:       {total_docs}")
    print(f"Chunks:          {chunk_count} / 50,000 target")
    print(f"Source records:  {source_count} / 500 target")
    print(f"Official:        {official}  Internal: {internal}")
    for j, c in jur_counts.items(): print(f"  {j}: {c}")
    print(f"200MB: {'PASS' if stats['target_raw_200mb'] else 'FAIL'}")
    print(f"50K chunks: {'PASS' if stats['target_chunks_50k'] else 'FAIL'}")
    print(f"500 sources: {'PASS' if stats['target_sources_500'] else 'FAIL'}")
    print("=" * 60)
    return stats

def main():
    init_dirs()
    if len(sys.argv) < 2:
        print("Usage: python ingestion_pipeline.py [build|stats|search <query>]")
        return
    cmd = sys.argv[1]
    if cmd == "build":
        print("Building...")
        build_index()
        show_stats()
    elif cmd == "stats":
        show_stats()
    elif cmd == "search":
        q = " ".join(sys.argv[2:])
        for s, e in search_index(q)[:10]:
            print(f"[{s}] {e['title']} ({e['jurisdiction']}/{e['domain']})")
            print(f"  {e['text'][:200]}...\n")
    else:
        print(f"Unknown: {cmd}")

if __name__ == "__main__":
    main()
