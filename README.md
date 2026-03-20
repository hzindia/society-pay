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
- **Razorpay** API keys (from Razorpay Dashboard → Settings → API Keys)
- **Razorpay Webhook Secret** (from Dashboard → Webhooks → Create, use endpoint: `https://yourdomain.com/api/payments/webhook`)
- **SMTP email** credentials (Gmail, SendGrid, etc.)
- **JWT secret** (any random long string)

### 3. Deploy

```bash
docker compose up -d
```

That's it. Your portal is live at `http://localhost:3000`

### 4. Create Admin Account

```bash
docker compose exec backend node scripts/create-admin.js
```

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

- Razorpay webhook signature verification (HMAC SHA256)
- JWT tokens with expiry for authentication
- bcrypt password hashing
- Rate limiting on auth and payment endpoints
- CORS restricted to your domain
- Helmet.js security headers
- SQL injection prevention via Prisma ORM
- Input validation with express-validator

---

## 📄 License

MIT — Free to use, modify, and distribute. Built for the community.

---

## 🤝 Contributing

PRs welcome! Please open an issue first to discuss changes.
