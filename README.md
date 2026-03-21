# 🏘️ SocietyPay — Open Source Housing Society Payment Portal

A self-hosted, production-ready payment portal for housing societies. Residents can pay maintenance, parking, water charges and more via UPI, cards, net banking, and wallets — with automatic surcharge handling, receipt generation, and an admin dashboard for treasurers.

**One config file. One command to deploy.**

---

## ✨ Features

- **Multi-payment support** — UPI, Credit/Debit Card, Net Banking, Wallets via Razorpay
- **Auto surcharge handling** — Credit card and other surcharges calculated transparently
- **Resident portal** — Login, pay dues, view history, download receipts
- **Admin dashboard** — View all transactions, manage residents, export reports
- **Receipt generation** — PDF receipts with unique transaction IDs
- **Email notifications** — Payment confirmations via email
- **Webhook verified** — Razorpay webhook signature verification for tamper-proof payments
- **Docker ready** — Single `docker compose up` to deploy
- **Fully configurable** — Society name, charges, surcharges, payment types — all from `.env`

---

## 🏗️ Tech Stack

| Layer      | Technology                        |
|------------|-----------------------------------|
| Frontend   | React 18 + Vite + Tailwind CSS   |
| Backend    | Node.js + Express                 |
| Database   | PostgreSQL (via Prisma ORM)       |
| Payments   | Razorpay Payment Gateway          |
| Auth       | JWT + bcrypt                      |
| Email      | Nodemailer (SMTP)                 |
| Deploy     | Docker + Docker Compose           |

---

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose installed ([Get Docker](https://docs.docker.com/get-docker/))
- A Razorpay account ([Sign up](https://razorpay.com)) — free to create, you pay only per transaction

### 1. Clone & Configure

```bash
git clone https://github.com/your-org/society-pay.git
cd society-pay
cp .env.example .env
```

### 2. Edit `.env` with your details

Open `.env` and fill in:
- Your **society name and details**
- **Razorpay API keys** → [dashboard.razorpay.com/app/keys](https://dashboard.razorpay.com/app/keys) *(see [Razorpay Integration Guide](#-razorpay-integration-guide) below)*
- **Razorpay Webhook Secret** → [dashboard.razorpay.com/app/webhooks](https://dashboard.razorpay.com/app/webhooks), webhook URL: `https://yourdomain.com/api/payments/webhook`
- **SMTP email** credentials (Gmail App Password → [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords))
- **JWT secret** — generate one with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### 3. Deploy

```bash
docker compose up -d
```

That's it. Your portal is live at `http://localhost:3000`

### 4. Create Admin Account

```bash
docker compose exec backend node scripts/create-admin.js
```

### 5. Make it Public (so members can access it)

**Option A: Free Cloudflare Tunnel (recommended — ₹0/forever)**
```bash
# 1. Get a free tunnel token from Cloudflare Dashboard → Zero Trust → Tunnels
# 2. Add to .env:
CLOUDFLARE_TUNNEL_TOKEN=your_token_here

# 3. Restart with tunnel:
docker compose --profile tunnel up -d
# → Your portal is now at https://pay.yoursociety.com
```

**Option B: Instant temporary share (for demos)**
```bash
./scripts/share.sh
# → Gives you a public URL + QR code instantly (no account needed)
```

**Option C: VPS with auto HTTPS**
```bash
# Set your domain in .env:
PUBLIC_DOMAIN=pay.yoursociety.com

docker compose --profile production up -d
# → Auto HTTPS via Let's Encrypt
```

### 6. Print QR Poster for Notice Board
```bash
./scripts/generate-poster.sh https://pay.yoursociety.com
# → Opens a printable A4 poster with QR code
```

See [docs/PUBLIC-URL.md](docs/PUBLIC-URL.md) for detailed setup guides.

---

## 🔧 Configuration Reference

All configuration lives in a single `.env` file. See `.env.example` for all options.

### Society Settings
| Variable | Description | Example |
|----------|-------------|---------|
| `SOCIETY_NAME` | Display name | `Green Valley CHS` |
| `SOCIETY_ADDRESS` | Full address | `Pune, Maharashtra` |
| `SOCIETY_EMAIL` | Contact email | `greenvalley@email.com` |
| `SOCIETY_PHONE` | Contact phone | `+91-20-12345678` |
| `SOCIETY_REG_NO` | Registration number | `MH/HSG/12345` |

### Payment Configuration
| Variable | Description | Example |
|----------|-------------|---------|
| `SURCHARGE_CREDIT_CARD` | Credit card surcharge % | `2.0` |
| `SURCHARGE_DEBIT_CARD` | Debit card surcharge % | `0` |
| `SURCHARGE_UPI` | UPI surcharge % | `0` |
| `SURCHARGE_NET_BANKING` | Net banking surcharge % | `0.5` |
| `SURCHARGE_WALLET` | Wallet surcharge % | `1.0` |
| `CURRENCY` | Payment currency | `INR` |
| `PAYMENT_TYPES` | Comma-separated charge types | `Maintenance,Parking,Water,Sinking Fund,Penalty` |

### Razorpay
| Variable | Description |
|----------|-------------|
| `RAZORPAY_KEY_ID` | API Key ID from Razorpay Dashboard |
| `RAZORPAY_KEY_SECRET` | API Key Secret |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook secret for signature verification |

---

## 💳 Razorpay Integration Guide

SocietyPay uses [Razorpay](https://razorpay.com) as the payment gateway. Setup takes about 10 minutes.

### Step 1 — Create a Razorpay Account

1. Sign up at **[dashboard.razorpay.com](https://dashboard.razorpay.com/register)**
2. Complete KYC (PAN + bank account of the society/treasurer)
3. You can test with **Test Mode** keys before going live — no KYC needed for testing

> **Charges:** Razorpay charges ~2% per transaction (UPI is free). No monthly fee.

---

### Step 2 — Get Your API Keys

1. Log in → **Settings** → **API Keys** → **[Generate API Key](https://dashboard.razorpay.com/app/keys)**
2. Copy both values into your `.env`:

```env
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxxx    # starts with rzp_test_ (test) or rzp_live_ (production)
RAZORPAY_KEY_SECRET=CHANGE_ME_your_razorpay_key_secret
```

> Keep `rzp_test_` keys during development. Switch to `rzp_live_` keys when going live.
> **Never commit the secret key to Git.**

---

### Step 3 — Create a Webhook

Webhooks allow Razorpay to notify your server when a payment is captured, even if the user closes the browser mid-payment. This is critical for payment reliability.

1. Go to **Settings** → **Webhooks** → **[Create New Webhook](https://dashboard.razorpay.com/app/webhooks)**
2. Set the **Webhook URL** to:
   ```
   https://yourdomain.com/api/payments/webhook
   ```
   *(Use your Cloudflare Tunnel or VPS domain — must be publicly accessible)*
3. Under **Active Events**, enable:
   - `payment.authorized`
   - `payment.captured`
   - `payment.failed`
4. Copy the **Webhook Secret** into your `.env`:
   ```env
   RAZORPAY_WEBHOOK_SECRET=CHANGE_ME_your_webhook_secret
   ```

> **Local testing:** Use [ngrok](https://ngrok.com) or the Cloudflare Tunnel (`--profile tunnel`) to expose your local server, then set the tunnel URL as the webhook URL.

---

### Step 4 — Go Live Checklist

Before switching from test to live keys:

- [ ] KYC completed on Razorpay dashboard
- [ ] Bank account verified and settlement configured
- [ ] Switched `.env` to `rzp_live_` keys
- [ ] Webhook URL updated to your production domain
- [ ] Test a real ₹1 payment end-to-end
- [ ] Confirm email receipt is delivered

---

### How Payments Work (Flow)

```
Resident clicks Pay
       │
       ▼
Backend creates Razorpay Order ──► Razorpay API
       │                                │
       │ orderId returned               │
       ▼                                │
Frontend opens Razorpay Checkout        │
       │                                │
       │ User pays (UPI / Card / etc.)  │
       ▼                                ▼
Backend /verify endpoint       Razorpay Webhook
  (signature check)            (server-to-server)
       │                                │
       └──────────────┬─────────────────┘
                      ▼
              DB: status → CAPTURED
              Email receipt sent
```

Both `/verify` (client-side callback) and the webhook independently mark a payment as captured — whichever fires first wins, the second is a safe no-op. This ensures no payment is lost even if the user's browser crashes.

---

### Surcharge Configuration

You can pass on Razorpay's transaction fees to residents by configuring surcharges in `.env`:

```env
SURCHARGE_CREDIT_CARD=2.0    # 2% surcharge on credit card payments
SURCHARGE_DEBIT_CARD=0       # No surcharge
SURCHARGE_UPI=0              # UPI is free — no surcharge
SURCHARGE_NET_BANKING=0.5    # 0.5% surcharge
SURCHARGE_WALLET=1.0         # 1% surcharge
```

The surcharge is shown transparently to the resident before they pay. If GST applies to surcharges:

```env
GST_ENABLED=true
GST_RATE=18              # 18% GST on the surcharge amount (not the total)
SOCIETY_GSTIN=27XXXXX    # Your society's GSTIN
```

---

## 📁 Project Structure

```
society-pay/
├── .env.example          # ← All config here
├── docker-compose.yml    # One-command deploy
├── backend/
│   ├── src/
│   │   ├── server.js           # Express app entry
│   │   ├── routes/
│   │   │   ├── auth.js         # Login, register
│   │   │   ├── payments.js     # Create order, verify, webhook
│   │   │   ├── residents.js    # Resident CRUD (admin)
│   │   │   └── admin.js        # Dashboard, reports, export
│   │   ├── middleware/
│   │   │   └── auth.js         # JWT verification
│   │   ├── services/
│   │   │   ├── razorpay.js     # Razorpay integration
│   │   │   ├── receipt.js      # PDF receipt generation
│   │   │   └── email.js        # Email notifications
│   │   └── utils/
│   │       └── config.js       # Reads .env into structured config
│   ├── prisma/
│   │   └── schema.prisma       # Database schema
│   ├── scripts/
│   │   └── create-admin.js     # Admin setup script
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── PaymentPortal.jsx
│   │   │   ├── PaymentHistory.jsx
│   │   │   └── AdminDashboard.jsx
│   │   ├── components/
│   │   │   ├── PaymentForm.jsx
│   │   │   ├── ReceiptView.jsx
│   │   │   └── SurchargeBreakdown.jsx
│   │   ├── hooks/
│   │   │   └── useApi.js
│   │   └── utils/
│   │       └── config.js
│   ├── Dockerfile
│   └── package.json
├── docs/
│   └── DEPLOYMENT.md
└── scripts/
    └── setup.sh
```

---

## 🔒 Security

- Razorpay webhook signature verification (HMAC SHA256 with **timing-safe comparison**)
- Payment signature verified on both client callback and server webhook independently
- JWT tokens with expiry for all authenticated routes
- bcrypt password hashing (configurable rounds)
- Rate limiting on auth (10 req/15min) and all API endpoints (100 req/15min)
- CORS restricted to your configured frontend domain
- Helmet.js security headers (CSP, HSTS, X-Frame-Options, etc.)
- SQL injection prevention via Prisma ORM parameterized queries
- Input validation with express-validator on all mutation endpoints
- Atomic DB writes via Prisma transactions — no partial payment state on server crash
- All admin actions (resident update/deactivate) recorded in audit log

---

## 📄 License

MIT — Free to use, modify, and distribute. Built for the community.

---

## 🤝 Contributing

PRs welcome! Please open an issue first to discuss changes.
