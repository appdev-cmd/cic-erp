#!/bin/bash
# ============================================================
# Script Cài Đặt OpenClaw + Telegram Bot
# Qwen 2.5 14B Local Model
# ============================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🦞 ============================================${NC}"
echo -e "${BLUE}   CÀI ĐẶT OPENCLAW + TELEGRAM BOT            ${NC}"
echo -e "${BLUE}   Model: Qwen 2.5 14B Local (Ollama)           ${NC}"
echo -e "${BLUE}🦞 ============================================${NC}"
echo ""

# ---- Bước 1: Kiểm tra Node.js ----
echo -e "${YELLOW}📋 Bước 1: Kiểm tra Node.js...${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✅ Node.js đã cài: ${NODE_VERSION}${NC}"
    
    # Kiểm tra version >= 22.14
    MAJOR=$(echo $NODE_VERSION | sed 's/v//' | cut -d. -f1)
    if [ "$MAJOR" -lt 22 ]; then
        echo -e "${RED}❌ Node.js version quá cũ. Cần >= 22.14${NC}"
        echo -e "${YELLOW}Cài Node.js 24:${NC}"
        echo "curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -"
        echo "sudo apt-get install -y nodejs"
        exit 1
    fi
else
    echo -e "${RED}❌ Node.js chưa cài!${NC}"
    echo -e "${YELLOW}Đang cài Node.js 24...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
    sudo apt-get install -y nodejs
    echo -e "${GREEN}✅ Node.js đã cài xong${NC}"
fi
echo ""

# ---- Bước 2: Cài OpenClaw ----
echo -e "${YELLOW}📋 Bước 2: Cài đặt OpenClaw...${NC}"
if command -v openclaw &> /dev/null; then
    CLAW_VERSION=$(openclaw --version 2>/dev/null || echo "unknown")
    echo -e "${GREEN}✅ OpenClaw đã cài: ${CLAW_VERSION}${NC}"
    echo -e "${YELLOW}Đang cập nhật lên bản mới nhất...${NC}"
    npm install -g openclaw@latest
else
    echo -e "${YELLOW}Đang cài OpenClaw...${NC}"
    npm install -g openclaw@latest
    echo -e "${GREEN}✅ OpenClaw đã cài xong${NC}"
fi
echo ""

# ---- Bước 3: Kiểm tra Ollama ----
echo -e "${YELLOW}📋 Bước 3: Kiểm tra Ollama + Qwen 2.5 14B...${NC}"
if command -v ollama &> /dev/null; then
    echo -e "${GREEN}✅ Ollama đã cài${NC}"
    
    # Kiểm tra model qwen2.5:14b
    if ollama list 2>/dev/null | grep -q "qwen2.5"; then
        echo -e "${GREEN}✅ Model Qwen 2.5 đã tồn tại${NC}"
    else
        echo -e "${YELLOW}⏳ Đang pull model qwen2.5:14b (có thể mất vài phút)...${NC}"
        ollama pull qwen2.5:14b
        echo -e "${GREEN}✅ Model Qwen 2.5 14B đã sẵn sàng${NC}"
    fi
else
    echo -e "${RED}❌ Ollama chưa cài!${NC}"
    echo -e "${YELLOW}Cài Ollama:${NC}"
    echo "curl -fsSL https://ollama.com/install.sh | sh"
    echo "Sau đó chạy: ollama pull qwen2.5:14b"
    echo ""
    echo -e "${YELLOW}Bạn có muốn cài Ollama ngay không? (y/n)${NC}"
    read -r INSTALL_OLLAMA
    if [ "$INSTALL_OLLAMA" = "y" ]; then
        curl -fsSL https://ollama.com/install.sh | sh
        ollama pull qwen2.5:14b
        echo -e "${GREEN}✅ Ollama + Qwen 2.5 14B đã cài xong${NC}"
    else
        echo -e "${RED}⚠️ Cần cài Ollama trước khi tiếp tục${NC}"
        exit 1
    fi
fi
echo ""

# ---- Bước 4: Cấu hình OpenClaw ----
echo -e "${YELLOW}📋 Bước 4: Cấu hình OpenClaw...${NC}"

OPENCLAW_DIR="$HOME/.openclaw"
CONFIG_FILE="$OPENCLAW_DIR/openclaw.json"

# Tạo thư mục config
mkdir -p "$OPENCLAW_DIR"

# Lấy Ollama base URL
OLLAMA_URL="http://localhost:11434"

# Kiểm tra Ollama đang chạy
if curl -s "$OLLAMA_URL/api/tags" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Ollama đang chạy tại ${OLLAMA_URL}${NC}"
else
    echo -e "${YELLOW}⏳ Đang khởi động Ollama...${NC}"
    ollama serve &
    sleep 3
fi

# Tạo file config
cat > "$CONFIG_FILE" << 'CONFIGEOF'
{
  "providers": {
    "ollama": {
      "type": "ollama",
      "baseUrl": "http://localhost:11434"
    }
  },
  "agents": {
    "defaults": {
      "model": "ollama:qwen2.5:14b",
      "maxConcurrent": 2
    }
  },
  "channels": {
    "telegram": {
      "enabled": true,
      "botToken": "8445384440:AAEK5bduigIWmsA5cPOjzThvBlnJd-eKPtA",
      "dmPolicy": "open",
      "allowFrom": ["*"],
      "streaming": "partial",
      "groups": {
        "*": {
          "requireMention": true
        }
      }
    }
  }
}
CONFIGEOF

echo -e "${GREEN}✅ Đã tạo config tại: ${CONFIG_FILE}${NC}"
echo ""

# ---- Bước 5: Khởi động ----
echo -e "${YELLOW}📋 Bước 5: Khởi động OpenClaw Gateway...${NC}"
echo ""
echo -e "${GREEN}🎉 CÀI ĐẶT HOÀN TẤT!${NC}"
echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  HƯỚNG DẪN SỬ DỤNG:                       ${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo -e "1. Khởi động Gateway:"
echo -e "   ${GREEN}openclaw gateway --verbose${NC}"
echo ""
echo -e "2. Mở Telegram, tìm bot và gửi tin nhắn"
echo ""
echo -e "3. Mở Dashboard (tùy chọn):"
echo -e "   ${GREEN}openclaw dashboard${NC}"
echo -e "   → http://127.0.0.1:18789"
echo ""
echo -e "4. Kiểm tra trạng thái:"
echo -e "   ${GREEN}openclaw gateway status${NC}"
echo ""
echo -e "5. Xem logs:"
echo -e "   ${GREEN}openclaw logs --follow${NC}"
echo ""
echo -e "6. Cài daemon (chạy nền):"
echo -e "   ${GREEN}openclaw onboard --install-daemon${NC}"
echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${YELLOW}⚡ Chạy ngay: openclaw gateway --verbose ${NC}"
echo -e "${BLUE}============================================${NC}"
