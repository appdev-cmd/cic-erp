#!/bin/bash

echo "🚀 Bắt đầu cấu hình CORS cho Ollama Server..."

# 1. Kiểm tra xem thư mục cấu hình systemd cho OLLAMA có tồn tại không
SERVICE_DIR="/etc/systemd/system/ollama.service.d"

if [ ! -d "$SERVICE_DIR" ]; then
    echo "📁 Đang tạo thư mục override cho Ollama Systemd..."
    sudo mkdir -p "$SERVICE_DIR"
fi

# 2. Tạo file override.conf để set environment variable
CONF_FILE="$SERVICE_DIR/override.conf"
echo "📝 Đang ghi cấu hình OLLAMA_ORIGINS=\"*\" vào $CONF_FILE"

sudo bash -c "cat > $CONF_FILE" << EOF
[Service]
Environment="OLLAMA_ORIGINS=*"
Environment="OLLAMA_HOST=0.0.0.0" 
# Đặt Host là 0.0.0.0 nếu bạn muốn các máy tính khác trong hệ thống mạng (LAN) truy cập được máy chủ này.
EOF

# 3. Reload systemd và khởi động lại Ollama
echo "🔄 Đang tải lại cấu hình Systemd..."
sudo systemctl daemon-reload

echo "⚡ Đang khởi động lại dịch vụ Ollama..."
sudo systemctl restart ollama

# 4. Kiểm tra trạng thái
if systemctl is-active --quiet ollama; then
    echo "✅ Tuyệt vời! Máy chủ Ollama đã chạy lại thành công với cấu hình CORS mới."
    echo "🌐 Frontend (React/Vite) của CIC-ERP giờ đây có thể gọi trực tiếp API mà không bị chặn."
else
    echo "❌ Có lỗi xảy ra khi khởi động lại Ollama. Hãy kiểm tra bằng lệnh: sudo journalctl -u ollama"
fi
