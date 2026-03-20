#!/bin/bash
# ============================================================================
#  SocietyPay — Instant Public Share
#
#  Creates an instant public URL for your local SocietyPay portal.
#  Perfect for demos, committee meetings, or testing before going live.
#
#  Usage:  ./scripts/share.sh
#  Stop:   Ctrl+C
#
#  Requires: cloudflared (auto-installed if missing)
# ============================================================================

set -e

PORT=${1:-3000}

echo ""
echo "🏘️  SocietyPay — Quick Share"
echo "================================="
echo ""

# Check if SocietyPay is running
if ! curl -s "http://localhost:$PORT" > /dev/null 2>&1; then
    echo "⚠️  SocietyPay doesn't seem to be running on port $PORT"
    echo "   Start it first:  docker compose up -d"
    echo ""
    exit 1
fi

echo "✅ SocietyPay detected on port $PORT"
echo ""

# ── Install cloudflared if needed ──────────────────────────────────────────
if ! command -v cloudflared &> /dev/null; then
    echo "📦 Installing cloudflared..."
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install cloudflared
        else
            echo "   Please install cloudflared: brew install cloudflared"
            echo "   Or download from: https://github.com/cloudflare/cloudflared/releases"
            exit 1
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        ARCH=$(uname -m)
        if [ "$ARCH" = "x86_64" ]; then
            curl -Lo /tmp/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
        elif [ "$ARCH" = "aarch64" ]; then
            curl -Lo /tmp/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64
        else
            echo "   Unsupported architecture: $ARCH"
            echo "   Download from: https://github.com/cloudflare/cloudflared/releases"
            exit 1
        fi
        chmod +x /tmp/cloudflared
        sudo mv /tmp/cloudflared /usr/local/bin/cloudflared
    else
        echo "   Please install cloudflared manually:"
        echo "   https://github.com/cloudflare/cloudflared/releases"
        exit 1
    fi
    
    echo "✅ cloudflared installed"
    echo ""
fi

# ── Generate QR code function ──────────────────────────────────────────────
generate_qr() {
    local url="$1"
    
    # Try qrencode (best quality)
    if command -v qrencode &> /dev/null; then
        echo ""
        echo "📱 Scan this QR code to open the portal:"
        echo ""
        qrencode -t ANSIUTF8 "$url"
        return
    fi
    
    # Try Python
    if command -v python3 &> /dev/null; then
        python3 -c "
import urllib.request, sys
try:
    url = sys.argv[1]
    api = f'https://qrcode.show/{url}'
    print()
    print('📱 Share this URL with your society members:')
    print()
    print(f'   🔗  {url}')
    print()
except:
    print(f'   🔗  {url}')
" "$url" 2>/dev/null
        return
    fi
    
    # Fallback: just print the URL
    echo ""
    echo "📱 Share this URL with your society members:"
    echo ""
    echo "   🔗  $url"
}

# ── Create short URL ──────────────────────────────────────────────────────
create_short_url() {
    local url="$1"
    
    # Try TinyURL API (free, no auth needed)
    SHORT=$(curl -s "https://tinyurl.com/api-create.php?url=$url" 2>/dev/null)
    
    if [ -n "$SHORT" ] && [[ "$SHORT" == http* ]]; then
        echo "   🔗  Short URL:  $SHORT"
        echo ""
        echo "   Share this short link in your society WhatsApp group!"
        return 0
    fi
    
    return 1
}

# ── Start tunnel ──────────────────────────────────────────────────────────
echo "🚀 Creating public tunnel..."
echo "   (No Cloudflare account needed — this is instant)"
echo ""

# Start cloudflared and capture the URL
TUNNEL_LOG=$(mktemp)
cloudflared tunnel --url "http://localhost:$PORT" 2>&1 | tee "$TUNNEL_LOG" &
TUNNEL_PID=$!

# Wait for URL to appear in logs
echo "   Waiting for tunnel..."
PUBLIC_URL=""
for i in $(seq 1 30); do
    sleep 1
    PUBLIC_URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$TUNNEL_LOG" 2>/dev/null | head -1)
    if [ -n "$PUBLIC_URL" ]; then
        break
    fi
done

if [ -z "$PUBLIC_URL" ]; then
    echo "❌ Failed to create tunnel. Check if port $PORT is accessible."
    kill $TUNNEL_PID 2>/dev/null
    rm -f "$TUNNEL_LOG"
    exit 1
fi

echo ""
echo "================================="
echo "✅ Your portal is LIVE!"
echo "================================="
echo ""
echo "   🌐 Public URL:  $PUBLIC_URL"
echo ""

# Try to create a short URL
create_short_url "$PUBLIC_URL"

# Generate QR code
generate_qr "$PUBLIC_URL"

echo ""
echo "================================="
echo ""
echo "   ⚠️  This URL is temporary (for testing/demos)"
echo "   For permanent URL: see docs/PUBLIC-URL.md"
echo ""
echo "   Press Ctrl+C to stop sharing"
echo "================================="
echo ""

# Cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping tunnel..."
    kill $TUNNEL_PID 2>/dev/null
    rm -f "$TUNNEL_LOG"
    echo "   Tunnel closed. Portal is only available locally now."
    echo ""
}
trap cleanup EXIT

# Keep running
wait $TUNNEL_PID
