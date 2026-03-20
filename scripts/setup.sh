#!/bin/bash
# ============================================================================
#  SocietyPay — Quick Setup Script
#  Run: chmod +x scripts/setup.sh && ./scripts/setup.sh
# ============================================================================

set -e

echo ""
echo "🏘️  SocietyPay — Quick Setup"
echo "================================="
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "   https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command -v docker compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not available."
    exit 1
fi

echo "✅ Docker found"

# Create .env if not exists
if [ ! -f .env ]; then
    echo ""
    echo "📝 Creating .env from template..."
    cp .env.example .env

    # Generate JWT secret
    JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 64)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/CHANGE_ME_to_a_random_64_char_string/$JWT_SECRET/" .env
    else
        sed -i "s/CHANGE_ME_to_a_random_64_char_string/$JWT_SECRET/" .env
    fi

    echo "✅ .env created with auto-generated JWT secret"
    echo ""
    echo "⚠️  IMPORTANT: Please edit .env and fill in:"
    echo "   1. Your society details (name, address, etc.)"
    echo "   2. Razorpay API keys (from https://dashboard.razorpay.com)"
    echo "   3. SMTP email credentials (for sending receipts)"
    echo ""
    read -p "   Press Enter after editing .env to continue (or Ctrl+C to exit)..."
else
    echo "✅ .env already exists"
fi

echo ""
echo "🚀 Starting SocietyPay..."
echo ""

# Build and start
docker compose up -d --build

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 8

# Health check
if curl -s http://localhost:4000/api/health | grep -q '"status":"ok"'; then
    echo "✅ Backend is healthy"
else
    echo "⚠️  Backend may still be starting. Check: docker compose logs backend"
fi

echo ""
echo "================================="
echo "✅ SocietyPay is running!"
echo ""
echo "   🌐 Portal:  http://localhost:3000"
echo "   🔧 API:     http://localhost:4000/api/health"
echo ""
echo "   Next step: Create admin account:"
echo "   docker compose exec backend node scripts/create-admin.js"
echo ""
echo "   Logs:  docker compose logs -f"
echo "   Stop:  docker compose down"
echo "================================="
echo ""
