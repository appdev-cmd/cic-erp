---
name: system_monitor
description: Giám sát hệ thống máy chủ — CPU, RAM, disk, services
metadata: {"openclaw":{"emoji":"🖥️","os":["linux","darwin"],"requires":{"anyBins":["top","htop"]}}}
---

# System Monitor — Giám sát hệ thống

Khi user hỏi về tình trạng máy chủ, server, hệ thống:

Sử dụng shell tool để kiểm tra:
- `df -h` — dung lượng ổ đĩa
- `free -h` — RAM (Linux) hoặc `vm_stat` (macOS)
- `uptime` — thời gian hoạt động và load
- `top -bn1 | head -20` — tiến trình đang chạy

Đưa ra báo cáo:
- Tình trạng disk: cảnh báo nếu > 80%
- RAM: cảnh báo nếu sử dụng > 85%
- CPU load: cảnh báo nếu > 4.0
- Services quan trọng đang chạy

Ví dụ trigger: "kiểm tra server", "tình trạng máy", "disk đầy chưa", "RAM còn bao nhiêu"
