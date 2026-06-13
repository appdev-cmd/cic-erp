#!/usr/bin/env python
"""
CIC ERP — ConTech Intelligence Hub: REAL Crawl4AI Deep Crawler
================================================================

Chạy Crawl4AI THẬT (headless Chromium + render JS + stealth) để cào các nguồn
`web` / `deep_crawl` trong bảng tech_sources — những site vendor (Autodesk,
Bentley, Trimble, Procore, Hexagon...) mà bản `fetch` thuần (api/tech-intel/
deep-crawl.ts) không cào được vì chúng render phía client + chặn bot.

Tôn trọng config của từng nguồn: jsEnabled, stealthMode, maxDepth, maxPages,
includePatterns, excludePatterns, contentFilter.

Ghi thẳng vào Supabase tech_articles (status='pending') để bước analyze AND
analyze.ts phân tích sau.

Cách dùng (dùng venv 3.11 đã cài):
  scripts/crawl4ai/.venv/Scripts/python.exe scripts/crawl4ai/deep_crawl.py
  ... --source-id=<uuid>     # chỉ 1 nguồn
  ... --limit=2              # chỉ N nguồn đầu (test nhanh)
  ... --dry-run              # cào & in, KHÔNG ghi DB
"""

import asyncio
import os
import sys
import json
from datetime import datetime, timezone

# Windows console hay dùng cp1252 → ép UTF-8 để in được emoji / box-drawing
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

import re
from urllib.parse import urlparse

import httpx
from dotenv import load_dotenv

from crawl4ai import (
    AsyncWebCrawler,
    BrowserConfig,
    CrawlerRunConfig,
    CacheMode,
)
from crawl4ai.deep_crawling import BFSDeepCrawlStrategy
from crawl4ai.deep_crawling.filters import FilterChain, URLPatternFilter
from crawl4ai.content_filter_strategy import PruningContentFilter
from crawl4ai.markdown_generation_strategy import DefaultMarkdownGenerator

# ─── Config ──────────────────────────────────────────────
load_dotenv(".env")
load_dotenv(".env.local")

SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL") or os.environ.get("SUPABASE_URL") or ""
SUPABASE_KEY = (
    os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    or os.environ.get("VITE_SUPABASE_SERVICE_ROLE_KEY")
    or ""
)

MAX_CONTENT_LENGTH = 15000
MIN_ARTICLE_WORDS = 150
DEFAULT_MAX_DEPTH = 2
DEFAULT_MAX_PAGES = 30

REST = f"{SUPABASE_URL}/rest/v1"
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}


# ─── CLI args ────────────────────────────────────────────
def parse_args():
    source_id = None
    limit = None
    dry_run = False
    max_pages = None
    max_depth = None
    for a in sys.argv[1:]:
        if a.startswith("--source-id="):
            source_id = a.split("=", 1)[1]
        elif a.startswith("--limit="):
            limit = int(a.split("=", 1)[1])
        elif a.startswith("--max-pages="):
            max_pages = int(a.split("=", 1)[1])
        elif a.startswith("--max-depth="):
            max_depth = int(a.split("=", 1)[1])
        elif a == "--dry-run":
            dry_run = True
    return source_id, limit, dry_run, max_pages, max_depth


# ─── Supabase REST helpers ───────────────────────────────
def fetch_sources(source_id):
    params = {"select": "*", "is_active": "eq.true"}
    if source_id:
        params["id"] = f"eq.{source_id}"
    else:
        params["type"] = "in.(web,deep_crawl)"
    r = httpx.get(f"{REST}/tech_sources", headers=HEADERS, params=params, timeout=30)
    r.raise_for_status()
    return r.json()


def upsert_articles(rows):
    """Upsert by url, bỏ qua trùng. Trả về số bài MỚI thực sự được chèn."""
    if not rows:
        return 0
    headers = {**HEADERS, "Prefer": "resolution=ignore-duplicates,return=representation"}
    r = httpx.post(
        f"{REST}/tech_articles?on_conflict=url",
        headers=headers,
        content=json.dumps(rows),
        timeout=60,
    )
    if r.status_code >= 300:
        print(f"      ❌ Upsert HTTP {r.status_code}: {r.text[:300]}")
        return 0
    try:
        return len(r.json())
    except Exception:
        return 0


def update_source_meta(source, new_count):
    now = datetime.now(timezone.utc).isoformat()
    body = {
        "last_crawled_at": now,
        "article_count": (source.get("article_count") or 0) + new_count,
        "updated_at": now,
    }
    httpx.patch(
        f"{REST}/tech_sources?id=eq.{source['id']}",
        headers={**HEADERS, "Prefer": "return=minimal"},
        content=json.dumps(body),
        timeout=30,
    )


# ─── Config readers (camelCase + snake_case) ─────────────
def cfg(config, *keys, default=None):
    for k in keys:
        if k in config and config[k] is not None:
            return config[k]
    return default


def to_glob(p: str) -> str:
    """'/blog/' -> '*/blog/*' cho URLPatternFilter."""
    p = p.strip()
    if not p:
        return "*"
    if not p.startswith("*"):
        p = "*" + p
    if not p.endswith("*"):
        p = p + "*"
    return p


def extract_thumbnail(result):
    md_meta = result.metadata or {}
    for k in ("og:image", "og_image", "image", "twitter:image"):
        v = md_meta.get(k)
        if v:
            return v
    media = getattr(result, "media", None) or {}
    for img in (media.get("images") or []):
        src = img.get("src")
        if src and (img.get("width") or 0) and int(img.get("width") or 0) >= 200:
            return src
    return None


# Đoạn path cuối là trang danh sách/index, KHÔNG phải bài viết riêng
INDEX_SEGMENTS = {
    "blog", "news", "newsroom", "resources", "press", "press-releases",
    "articles", "insights", "media", "company", "category", "tag", "page",
    "en", "de", "fr", "es", "it", "pl", "hu", "hr", "ru", "au", "sg", "uk",
}


# Tiêu đề của trang listing tác giả / lưu trữ — không phải bài viết
JUNK_TITLE = re.compile(
    r"(articles by |author at |, author at|\barchives\b|helpful .*articles|"
    r"\bblog author\b|^the .* blog\b|^blog )",
    re.I,
)


def is_junk_title(title: str) -> bool:
    return bool(JUNK_TITLE.search(title.strip()))


def is_index_page(url: str) -> bool:
    """True nếu URL trỏ tới trang danh mục/landing (không có slug bài viết)."""
    try:
        path = urlparse(url).path.rstrip("/")
    except Exception:
        return True
    if not path:
        return True
    last = path.split("/")[-1].lower()
    if not last or last in INDEX_SEGMENTS:
        return True
    if len(last) == 2 and last.isalpha():  # mã ngôn ngữ /de /fr
        return True
    # slug bài viết thật thường dài & có dấu gạch nối
    if "-" not in last and len(last) < 12:
        return True
    return False


def get_markdown(result) -> str:
    md = getattr(result, "markdown", None)
    if md is None:
        return ""
    fit = getattr(md, "fit_markdown", None)
    raw = getattr(md, "raw_markdown", None)
    if fit and len(fit.split()) >= 50:
        return fit
    if raw:
        return raw
    return md if isinstance(md, str) else ""


# ─── Crawl 1 source ──────────────────────────────────────
async def crawl_source(crawler, source, dry_run, ov_pages=None, ov_depth=None):
    name = source["name"]
    url = source["url"]
    config = source.get("config") or {}
    if isinstance(config, str):
        try:
            config = json.loads(config)
        except Exception:
            config = {}

    max_depth = ov_depth or int(cfg(config, "maxDepth", "max_depth", default=DEFAULT_MAX_DEPTH))
    max_pages = ov_pages or int(cfg(config, "maxPages", "max_pages", default=DEFAULT_MAX_PAGES))
    include = cfg(config, "includePatterns", "include_patterns", default=[]) or []
    exclude = cfg(config, "excludePatterns", "exclude_patterns", default=[]) or []
    stealth = bool(cfg(config, "stealthMode", "stealth_mode", default=False))

    print("\n" + "═" * 60)
    print(f"🔍 Crawl4AI: {name}")
    print(f"   URL: {url}")
    print(f"   depth={max_depth} pages={max_pages} stealth={stealth} include={include}")

    filters = []
    if include:
        filters.append(URLPatternFilter(patterns=[to_glob(p) for p in include]))
    filter_chain = FilterChain(filters) if filters else FilterChain([])

    strategy = BFSDeepCrawlStrategy(
        max_depth=max_depth,
        max_pages=max_pages,
        include_external=False,
        filter_chain=filter_chain,
    )

    run_cfg = CrawlerRunConfig(
        deep_crawl_strategy=strategy,
        markdown_generator=DefaultMarkdownGenerator(
            content_filter=PruningContentFilter(threshold=0.48, threshold_type="fixed")
        ),
        cache_mode=CacheMode.BYPASS,
        exclude_external_links=True,
        word_count_threshold=50,
        magic=stealth,
        simulate_user=stealth,
        scan_full_page=True,  # cuộn trang để nạp article-cards lazy-load (SPA)
        page_timeout=35000,
        stream=False,
        verbose=False,
    )

    try:
        results = await crawler.arun(url, config=run_cfg)
    except Exception as e:
        print(f"   ❌ Crawl error: {e}")
        return {"source": name, "pages": 0, "new": 0, "error": str(e)}

    # arun với deep_crawl trả về list CrawlResult
    if not isinstance(results, list):
        results = [results]

    pages = len(results)
    discovered = []
    seen_titles = set()
    skipped_index = 0
    for res in results:
        if not getattr(res, "success", False):
            continue
        page_url = res.url
        # exclude patterns thủ công
        if exclude and any(ex.strip("*/").lower() in page_url.lower() for ex in exclude):
            continue
        # Bỏ trang danh mục / landing (không phải bài viết)
        if is_index_page(page_url):
            skipped_index += 1
            continue

        meta = res.metadata or {}
        title = (meta.get("title") or "").strip()
        content = get_markdown(res).strip()
        wc = len(content.split())

        if wc < MIN_ARTICLE_WORDS:
            continue
        if len(title) < 10:
            continue
        if is_junk_title(title):
            skipped_index += 1
            continue
        # Chống trùng tiêu đề trong cùng nguồn (landing đa ngôn ngữ trùng tên)
        norm_title = " ".join(title.lower().split())
        if norm_title in seen_titles:
            continue
        seen_titles.add(norm_title)

        summary = (meta.get("description") or "")[:300] or None
        discovered.append(
            {
                "title": title,
                "url": page_url,
                "source_id": source["id"],
                "summary": summary,
                "content": content[:MAX_CONTENT_LENGTH],
                "thumbnail_url": extract_thumbnail(res),
                "published_at": None,
                "language": source.get("language") or "en",
                "status": "pending",
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        print(f"      📄 {title[:60]}... ({wc} words)")

    print(f"   📋 {pages} trang render → {len(discovered)} bài đạt chuẩn "
          f"(bỏ {skipped_index} trang index)")

    if dry_run:
        return {"source": name, "pages": pages, "new": len(discovered), "dry": True}

    new_count = upsert_articles(discovered)
    update_source_meta(source, new_count)
    print(f"   💾 +{new_count} bài mới ghi vào DB")
    return {"source": name, "pages": pages, "new": new_count}


# ─── Main ────────────────────────────────────────────────
async def main():
    source_id, limit, dry_run, ov_pages, ov_depth = parse_args()

    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ Thiếu VITE_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong .env")
        sys.exit(1)

    print("═" * 60)
    print("🔍 ConTech Hub — REAL Crawl4AI Deep Crawler")
    print(f"   {datetime.now(timezone.utc).isoformat()}")
    if dry_run:
        print("   MODE: DRY RUN (không ghi DB)")
    print("═" * 60)

    sources = fetch_sources(source_id)
    if limit:
        sources = sources[:limit]
    if not sources:
        print("⚠ Không có nguồn web/deep_crawl active nào.")
        return

    print(f"\n📋 {len(sources)} nguồn sẽ được cào\n")

    browser_cfg = BrowserConfig(
        headless=True,
        java_script_enabled=True,
        enable_stealth=True,
        viewport_width=1280,
        viewport_height=900,
        verbose=False,
    )
    # FIX Windows: channel="chromium" gây "spawn UNKNOWN" trên máy này.
    # Ép dùng bundled chromium (không truyền channel) thì launch OK.
    browser_cfg.chrome_channel = None
    browser_cfg.channel = None

    results = []
    async with AsyncWebCrawler(config=browser_cfg) as crawler:
        for s in sources:
            results.append(await crawl_source(crawler, s, dry_run, ov_pages, ov_depth))

    print("\n" + "═" * 60)
    print("📊 TỔNG KẾT")
    total_new = sum(r["new"] for r in results)
    total_pages = sum(r["pages"] for r in results)
    print(f"   Nguồn: {len(results)} | Trang render: {total_pages} | Bài mới: {total_new}")
    for r in results:
        flag = "✗" if r.get("error") else "✓"
        err = f" — ERROR: {r['error']}" if r.get("error") else ""
        print(f"   {flag} {r['source']:<32} {r['pages']} trang → {r['new']} bài{err}")
    print("═" * 60)
    if not dry_run:
        print("\n→ Tiếp: gọi /api/tech-intel/analyze để AI phân tích các bài pending.")


if __name__ == "__main__":
    asyncio.run(main())
