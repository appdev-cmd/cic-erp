# =============================================================================
# ConTech Intelligence Hub — Pipeline cào + phân tích TỰ ĐỘNG (chạy local)
# =============================================================================
# Chạy toàn bộ chuỗi, dùng cho Windows Task Scheduler quét định kỳ:
#   1. RSS + Google News listings      (scripts/tech-intel-crawl.ts)
#   2. Deep crawl web sources (browser)(scripts/crawl4ai/deep_crawl.py)
#   3. Resolve content Google News     (scripts/crawl4ai/resolve_gnews.py)
#   4. AI phân tích bài pending        (scripts/process-pending.ts)
#
# Mỗi bước độc lập: một bước lỗi KHÔNG chặn các bước sau. Log gộp + có timestamp.
#
# Chạy tay:   powershell -ExecutionPolicy Bypass -File scripts\crawl4ai\run_pipeline.ps1
# =============================================================================

$ErrorActionPreference = "Continue"
$env:PYTHONUTF8 = "1"

# Gốc project = thư mục cha của scripts\crawl4ai
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $Root

$Py  = Join-Path $Root "scripts\crawl4ai\.venv\Scripts\python.exe"
$Log = Join-Path $Root "scripts\crawl4ai\pipeline.log"

function Log($msg) {
    $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg
    Write-Host $line
    Add-Content -Path $Log -Value $line -Encoding utf8
}

function Step($name, $block) {
    Log "▶ BẮT ĐẦU: $name"
    $sw = [Diagnostics.Stopwatch]::StartNew()
    try {
        & $block 2>&1 | ForEach-Object { Add-Content -Path $Log -Value $_ -Encoding utf8 }
        Log "✓ XONG: $name ($([int]$sw.Elapsed.TotalSeconds)s)"
    } catch {
        Log "✗ LỖI: $name — $($_.Exception.Message)"
    }
}

Log "════════════════════════════════════════════════════════"
Log "PIPELINE BẮT ĐẦU"

# 1) RSS + Google News listings (lấy bài mới)
Step "1/4 RSS+GNews crawl" { npx tsx scripts/tech-intel-crawl.ts }

# 2) Deep crawl web sources bằng Crawl4AI (render JS)
Step "2/4 Deep crawl (Crawl4AI)" { & $Py scripts/crawl4ai/deep_crawl.py --max-pages=40 }

# 3) Resolve nội dung bài Google News bằng browser
Step "3/4 Resolve Google News" { & $Py scripts/crawl4ai/resolve_gnews.py --batch=6 }

# 4) AI phân tích toàn bộ bài pending → analyzed
Step "4/4 AI analyze (Gemini)" { npx tsx scripts/process-pending.ts }

Log "PIPELINE KẾT THÚC"
Log "════════════════════════════════════════════════════════"
