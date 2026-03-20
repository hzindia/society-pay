# Deployment Guide

## Option 1: Docker (Recommended)

### Requirements
- Docker Engine 20+ & Docker Compose v2
- A domain name (for HTTPS / Razorpay production)
- Razorpay account with API keys

### Steps

```bash
# 1. Clone
git clone https://github.com/your-org/society-pay.git
cd society-pay

# 2. Configure
cp .env.example .env
nano .env   # Fill in all values

# 3. Deploy
docker compose up -d --build

# 4. Create admin
docker compose exec backend node scripts/create-admin.js

# 5. Verify
curl http://localhost:4000/api/health
# Should return: {"status":"ok","society":"Your Society",...}
```

Your portal is now live at **http://localhost:3000**

### Setting up Razorpay

1. Go to [Razorpay Dashboard](https://dashboard.razorpay.com)
2. Navigate to **Settings → API Keys → Generate Key**
3. Copy `Key ID` → `RAZORPAY_KEY_ID` in `.env`
4. Copy `Key Secret` → `RAZORPAY_KEY_SECRET` in `.env`
5. Navigate to **Settings → Webhooks → Add New Webhook**
6. Set URL: `https://yourdomain.com/api/payments/webhook`
7. Select events: `payment.authorized`, `payment.captured`, `payment.failed`
8. Copy webhook secret → `RAZORPAY_WEBHOOK_SECRET` in `.env`

**Important:** For production, use Razorpay Live keys (not Test keys).

### Adding HTTPS (Production)

For production, add an Nginx reverse proxy with Let's Encrypt SSL. 
Create `nginx-proxy/docker-compose.override.yml`:

```yaml
version: "3.8"
services:
  nginx-proxy:
    image: nginxproxy/nginx-proxy
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/tmp/docker.sock:ro
      - certs:/etc/nginx/certs
      - html:/usr/share/nginx/html
    
  acme-companion:
    image: nginxproxy/acme-companion
    environment:
      - DEFAULT_EMAIL=admin@yourdomain.com
    volumes_from:
      - nginx-proxy
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - acme:/etc/acme.sh

  frontend:
    environment:
      - VIRTUAL_HOST=pay.yoursociety.com
      - LETSENCRYPT_HOST=pay.yoursociety.com

volumes:
  certs:
  html:
  acme:
```

---

## Option 2: Manual Deployment (VPS / Cloud)

### Requirements
- Node.js 20+
- PostgreSQL 14+
- npm or yarn

### Steps

```bash
# 1. Clone & configure
git clone https://github.com/your-org/society-pay.git
cd society-pay
cp .env.example .env
nano .env

# 2. Setup database
# Update DATABASE_URL in .env to point to your PostgreSQL instance
# Example: postgresql://user:pass@localhost:5432/societypay

# 3. Setup backend
cd backend
npm install
npx prisma migrate deploy
npx prisma generate
node scripts/create-admin.js
npm start

# 4. Setup frontend (in new terminal)
cd frontend
npm install
npm run build

# Serve with any static server:
npx serve -s dist -l 3000
```

### Running with PM2 (recommended for VPS)

```bash
npm install -g pm2

# Backend
cd backend
pm2 start src/server.js --name societypay-api

# Frontend (use nginx to serve static files)
cd frontend && npm run build
# Copy dist/ to your nginx web root
```

---

## Option 3: Cloud Platforms

### Railway / Render

Both support monorepo deployments:

1. Connect your GitHub repo
2. Set up PostgreSQL as an add-on
3. Set environment variables from `.env.example`
4. Deploy backend with: `cd backend && npm install && npx prisma migrate deploy && npm start`
5. Deploy frontend with: `cd frontend && npm install && npm run build`

### DigitalOcean App Platform

1. Create app from GitHub repo
2. Add PostgreSQL database component
3. Add backend service: source `./backend`, run `npm start`
4. Add static site: source `./frontend`, build `npm run build`, output `dist`
5. Set env vars in App settings

---

## Updating

```bash
cd society-pay
git pull origin main
docker compose up -d --build
```

Database migrations run automatically on container start.

---

## Backup

### Database backup
```bash
# Via Docker
docker compose exec db pg_dump -U societypay societypay > backup-$(date +%Y%m%d).sql

# Restore
docker compose exec -i db psql -U societypay societypay < backup-20240101.sql
```

### Automated daily backups
```bash
# Add to crontab: crontab -e
0 2 * * * cd /path/to/society-pay && docker compose exec -T db pg_dump -U societypay societypay | gzip > /backups/societypay-$(date +\%Y\%m\%d).sql.gz
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Backend won't start | Check `.env` values, especially `DATABASE_URL` and Razorpay keys |
| Database connection refused | Ensure PostgreSQL is running: `docker compose ps db` |
| Payment fails | Verify Razorpay keys (test vs live), check webhook URL |
| Webhook not working | Ensure your server is publicly accessible and the webhook URL matches |
| CORS errors | Check `FRONTEND_URL` matches your actual frontend URL |
| Email not sending | Verify SMTP credentials, use Gmail App Password if using Gmail |
