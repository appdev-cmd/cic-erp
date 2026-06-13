#!/usr/bin/env python
"""
CIC ERP — ConTech Intelligence Hub: Google News content resolver (Crawl4AI)
============================================================================

Các bài từ nguồn google_news lưu URL dạng news.google.com/rss/articles/CBMi...
mà bản fetch/batchexecute server-side KHÔNG lấy được nội dung (98% bài rỗng).

Script này mở từng URL Google News bằng headless browser (Crawl4AI). Google News
tự redirect (JS) sang bài gốc của publisher → lấy được:
  - redirected_url : URL bài gốc thật (vd https://www.arc-agency.jp/magazine/11329)
  - content        : nội dung bài thật (fit_markdown đã lọc nav/boilerplate)
  - thumbnail      : og:image

Cập nhật vào tech_articles (giữ status='pending' để bước analyze AI xử lý tiếp).

Cách dùng (PowerShell, venv 3.11):
  $env:PYTHONUTF8=1
  scripts\crawl4ai\.venv\Scripts\python.exe scripts\crawl4ai\resolve_gnews.py
  ... --limit=5 --dry-run     # test nhanh, không ghi DB
  ... --batch=8               # số trang render song song mỗi đợt
"""

import asyncio
import os
import sys
import json
from urllib.parse import urlparse
from datetime import datetime, timezone

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

import httpx
from dotenv import load_dotenv

from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode
from crawl4ai.content_filter_strategy import PruningContentFilter
from crawl4ai.markdown_generation_strategy import DefaultMarkdownGenerator

load_dotenv(".env")
load_dotenv(".env.local")

SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL") or os.environ.get("SUPABASE_URL") or ""
SUPABASE_KEY = (
    os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    or os.environ.get("VITE_SUPABASE_SERVICE_ROLE_KEY")
    or ""
)
REST = f"{SUPABASE_URL}/rest/v1"
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

MAX_CONTENT_LENGTH = 15000
MIN_CONTENT_CHARS = 250


def parse_args():
    limit, dry_run, batch = None, False, 6
    for a in sys.argv[1:]:
        if a.startswith("--limit="):
            limit = int(a.split("=", 1)[1])
        elif a.startswith("--batch="):
            batch = int(a.split("=", 1)[1])
        elif a == "--dry-run":
            dry_run = True
    return limit, dry_run, batch


def fetch_pending_gnews(limit):
    """Bài url=news.google.com, status=pending, content rỗng/ngắn."""
    params = {
        "select": "id,url,title,summary,content,source_id",
        "url": "like.*news.google.com*",
        "status": "eq.pending",
        "order": "created_at.desc",
    }
    if limit:
        params["limit"] = str(limit * 3)  # lấy dư rồi lọc content client-side
    r = httpx.get(f"{REST}/tech_articles", headers=HEADERS, params=params, timeout=30)
    r.raise_for_status()
    rows = [a for a in r.json() if not a.get("content") or len(a["content"]) < 200]
    return rows[:limit] if limit else rows


def is_real_url(u: str) -> bool:
    try:
        h = urlparse(u).hostname or ""
        return bool(h) and "google.com" not in h
    except Exception:
        return False


def get_markdown(result) -> str:
    md = getattr(result, "markdown", None)
    if md is None:
        return ""
    fit = getattr(md, "fit_markdown", None)
    raw = getattr(md, "raw_markdown", None)
    if fit and len(fit) >= MIN_CONTENT_CHARS:
        return fit
    return raw or (md if isinstance(md, str) else "")


def extract_thumbnail(result):
    meta = result.metadata or {}
    for k in ("og:image", "og_image", "image", "twitter:image"):
        if meta.get(k):
            return meta[k]
    media = getattr(result, "media", None) or {}
    for img in (media.get("images") or []):
        if img.get("src") and int(img.get("width") or 0) >= 200:
            return img["src"]
    return None


def update_article(article_id, payload, allow_url=True):
    """PATCH 1 bài. Nếu đổi url bị trùng (409) → thử lại không đổi url."""
    body = dict(payload)
    if not allow_url:
        body.pop("url", None)
    r = httpx.patch(
        f"{REST}/tech_articles?id=eq.{article_id}",
        headers={**HEADERS, "Prefer": "return=minimal"},
        content=json.dumps(body),
        timeout=30,
    )
    if r.status_code == 409 and "url" in body:
        return update_article(article_id, payload, allow_url=False)
    return r.status_code < 300


async def resolve_batch(crawler, run_cfg, articles, dry_run):
    url_map = {a["url"]: a for a in articles}
    results = await crawler.arun_many(list(url_map.keys()), config=run_cfg)
    if not isinstance(results, list):
        results = [results]

    ok = 0
    for res in results:
        art = url_map.get(res.url)
        if not art:
            continue
        if not getattr(res, "success", False):
            err = (getattr(res, "error_message", "") or "")[:80]
            print(f"   ✗ fail [{getattr(res,'status_code',None)}] {art['title'][:38]} | {err}")
            continue

        real_url = getattr(res, "redirected_url", None) or res.url
        content = get_markdown(res).strip()
        if len(content) < MIN_CONTENT_CHARS:
            print(f"   ✗ thiếu content ({len(content)}): {art['title'][:50]}")
            continue

        meta = res.metadata or {}
        payload = {
            "content": content[:MAX_CONTENT_LENGTH],
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if is_real_url(real_url):
            payload["url"] = real_url
        thumb = extract_thumbnail(res)
        if thumb:
            payload["thumbnail_url"] = thumb
        if (not art.get("summary")) and meta.get("description"):
            payload["summary"] = meta["description"][:300]

        host = urlparse(real_url).hostname or "?"
        print(f"   ✓ {art['title'][:46]} → {host} ({len(content)} ký tự)")
        if not dry_run:
            if update_article(art["id"], payload):
                ok += 1
            else:
                print(f"      ❌ update DB lỗi cho {art['id']}")
        else:
            ok += 1
    return ok


async def main():
    limit, dry_run, batch = parse_args()
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ Thiếu VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY")
        sys.exit(1)

    print("═" * 60)
    print("📰 Crawl4AI — Resolve nội dung bài Google News")
    print(f"   {datetime.now(timezone.utc).isoformat()}")
    if dry_run:
        print("   MODE: DRY RUN (không ghi DB)")
    print("═" * 60)

    articles = fetch_pending_gnews(limit)
    print(f"\n📋 {len(articles)} bài Google News thiếu content cần resolve\n")
    if not articles:
        return

    bc = BrowserConfig(headless=True, java_script_enabled=True,
                       enable_stealth=True, verbose=False)
    bc.chrome_channel = None
    bc.channel = None

    run_cfg = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        wait_until="domcontentloaded",
        delay_before_return_html=5.0,   # chờ Google News redirect + publisher render
        page_timeout=50000,
        markdown_generator=DefaultMarkdownGenerator(
            content_filter=PruningContentFilter(threshold=0.5, threshold_type="fixed")
        ),
        exclude_external_links=True,
        stream=False,
        verbose=False,
    )

    total_ok = 0
    async with AsyncWebCrawler(config=bc) as crawler:
        for i in range(0, len(articles), batch):
            chunk = articles[i:i + batch]
            print(f"── Đợt {i // batch + 1}: {len(chunk)} bài ──")
            total_ok += await resolve_batch(crawler, run_cfg, chunk, dry_run)

    print("\n" + "═" * 60)
    print(f"📊 Resolve xong: {total_ok}/{len(articles)} bài có content thật")
    print("═" * 60)
    if not dry_run:
        print("→ Tiếp: analyze AI sẽ phân tích các bài pending (đã có content).")


if __name__ == "__main__":
    asyncio.run(main())
