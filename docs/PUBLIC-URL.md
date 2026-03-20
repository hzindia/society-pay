# 🌐 Making SocietyPay Publicly Accessible

Your society members need a shareable URL like `https://pay.greenvalley.in` — not `localhost:3000`.
Here are your options, from simplest to most production-grade.

---

## Option 1: Cloudflare Tunnel (FREE — Recommended)

**Best for:** Societies running on any home server, mini PC, or old laptop.
**Cost:** ₹0 forever. Free HTTPS, DDoS protection, and a custom domain.
**What you get:** `https://pay.yoursociety.com`

Cloudflare Tunnel creates a secure outbound connection from your server to Cloudflare's
network — no port forwarding, no static IP, no firewall changes needed.

### Quick Start (already included in docker-compose)

```bash
# 1. Sign up at https://dash.cloudflare.com (free)
# 2. Add your domain (e.g. greenvalley.in) — free plan works
# 3. Go to: Zero Trust → Networks → Tunnels → Create Tunnel
# 4. Name it "societypay", select Docker, copy the token

# 5. Add the token to your .env:
CLOUDFLARE_TUNNEL_TOKEN=eyJhIjoiYWNjb3VudC1pZC....

# 6. Start everything:
docker compose --profile tunnel up -d
```

That's it. Your portal is now live at `https://pay.greenvalley.in` with automatic HTTPS.

### Setting up the DNS route

In the Cloudflare Tunnel dashboard:
1. Go to **Public Hostname** tab
2. Add a route:
   - **Subdomain:** `pay` (or blank for root domain)
   - **Domain:** `greenvalley.in`
   - **Service Type:** `HTTP`
   - **URL:** `frontend:3000`
3. Save — your portal is now publicly accessible!

---

## Option 2: Quick Share (Instant, Temporary)

**Best for:** Quick testing or showing the portal to committee members before going live.
**Cost:** ₹0
**What you get:** A random URL like `https://abc-xyz-123.trycloudflare.com`

```bash
# No account needed — just run:
./scripts/share.sh
```

This creates an instant public URL. It changes every time you restart,
so it's only for demos and testing — not permanent use.

---

## Option 3: Cloud Hosting (VPS)

**Best for:** Societies that want a managed server without maintaining hardware.
**Cost:** ₹300-500/month

### DigitalOcean / Hetzner / AWS Lightsail

```bash
# 1. Create a VPS (Ubuntu 24, 1GB RAM is enough)
# 2. SSH in and install Docker:
curl -fsSL https://get.docker.com | sh

# 3. Clone and deploy:
git clone https://github.com/your-org/society-pay.git
cd society-pay
cp .env.example .env
nano .env  # Fill in your config

# 4. Point your domain to the VPS IP:
#    In your domain registrar, add an A record:
#    pay.greenvalley.in → <VPS_IP_ADDRESS>

# 5. Deploy with HTTPS:
docker compose --profile production up -d
```

The production profile includes Caddy for automatic HTTPS via Let's Encrypt.

---

## Option 4: Platform-as-a-Service (No Docker needed)

### Railway.app
```bash
# 1. Connect GitHub repo to Railway
# 2. Railway auto-detects Dockerfile and deploys
# 3. Add PostgreSQL from Railway's marketplace
# 4. Set env vars from .env.example
# 5. Railway gives you: https://society-pay-production.up.railway.app
# 6. Add custom domain in Railway settings
```

### Render.com
Similar to Railway — connect repo, add Postgres, set env vars, get a public URL.

---

## Adding a Short URL / Tiny URL

Once you have a public domain, create a memorable short link:

### Option A: Custom short subdomain
Point `pay.greenvalley.in` to your portal — this IS your short URL.

### Option B: Free URL shorteners
Use services like:
- **Bitly:** `bit.ly/greenvalley-pay`
- **TinyURL:** `tinyurl.com/gv-society-pay`
- **Short.io:** Connect your own domain for branded short links

### Option C: QR Code (Best for societies!)
Generate a QR code for the payment URL and:
- Print on notice boards
- Include in maintenance bills
- Share in WhatsApp groups
- Put on society entrance

The `share.sh` script automatically generates a QR code for you.

---

## Razorpay Webhook URL

Once public, update your Razorpay webhook URL:
1. Go to Razorpay Dashboard → Webhooks
2. Set URL to: `https://pay.greenvalley.in/api/payments/webhook`
3. Select events: `payment.captured`, `payment.failed`

---

## Summary

| Method | Cost | Setup Time | Best For |
|--------|------|------------|----------|
| Cloudflare Tunnel | ₹0 | 10 min | Home server / mini PC |
| Quick Share | ₹0 | 1 min | Testing & demos |
| VPS (DO/Hetzner) | ₹300-500/mo | 20 min | Managed hosting |
| Railway/Render | ₹0-500/mo | 5 min | No-Docker simplicity |
