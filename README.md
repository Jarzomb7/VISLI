# Visli SaaS Licensing System

Production-ready SaaS licensing platform for a WordPress booking plugin.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  panel.visli.pl  │────▶│  api.visli.pl    │◀────│  WordPress Site  │
│  (Next.js Panel) │     │  (Next.js API)   │     │  (PHP Plugin)    │
└─────────────────┘     └──────┬───────────┘     └──────────────────┘
                               │
                        ┌──────▼───────┐
                        │  PostgreSQL   │
                        │  (Neon/Supa)  │
                        └──────────────┘
                               │
                        ┌──────▼───────┐
                        │   Stripe     │
                        │  (Webhooks)  │
                        └──────────────┘
```

## Project Structure

```
/api-app               ← api.visli.pl (Vercel project #1)
  /app/api/
    /auth/login        POST — admin JWT login
    /license/activate  POST — bind domain to license
    /license/validate  POST — heartbeat from plugin
    /license/status    POST — full status report
    /sms/track         POST — decrement SMS balance
    /plan              GET  — public plan list
    /stripe/webhook    POST — Stripe lifecycle
    /admin/users       GET  — user list (admin)
    /admin/licenses    GET  — license list (admin)
    /admin/licenses/[id] PATCH — manage license (admin)
    /admin/sms/[id]    PATCH — manage SMS (admin)
    /admin/stats       GET  — dashboard stats (admin)
  /lib/
    prisma.ts          DB client
    auth.ts            JWT sign/verify
    security.ts        HMAC, rate limit, keys, domain
    stripe.ts          Stripe client + plans
    middleware.ts      11-step security pipeline
  /prisma/
    schema.prisma      Full data model
    seed.ts            Admin user seeder

/panel-app             ← panel.visli.pl (Vercel project #2)
  /app/
    /auth/login        Login page
    /dashboard         Stats overview
    /admin/licenses    License management table
    /admin/users       User list with details
  /lib/
    api.ts             API client (fetch + JWT)
  /components/ui/
    Sidebar.tsx        Navigation
    AuthGuard.tsx      Auth protection
    StatCard.tsx       Dashboard cards

/wordpress-plugin      ← ZIP and install on WordPress
  visli-license.php    Main plugin file
  /includes/
    class-visli-api.php      Signed API communication
    class-visli-license.php  License state + cache + helpers
    class-visli-admin.php    WP settings page
    example-integration.php  Usage patterns for booking plugin
```

## Security Pipeline (every plugin→API request)

```
 1. JSON parse
 2. Timestamp validation (±5 min, anti-replay)
 3. Required fields check (licenseKey, apiKey)
 4. License lookup in DB
 5. API key match
 6. Kill switch check
 7. License status check (ACTIVE required)
 8. Expiry date check
 9. Domain match (bound domain vs request domain)
10. HMAC-SHA256 signature verification
11. Rate limiting (30 req/min per license)
12. Request logging
```

---

## Deployment Guide

### Step 1: Create PostgreSQL Database

Use **Neon** (recommended, free tier):
1. Go to https://neon.tech
2. Create project → copy `DATABASE_URL`

Or **Supabase**: https://supabase.com → Settings → Database → Connection string

### Step 2: Configure Stripe

1. Go to https://dashboard.stripe.com
2. Create 3 products with monthly prices:
   - Starter (99 PLN/mo) → copy price ID
   - Pro (199 PLN/mo) → copy price ID
   - Enterprise (499 PLN/mo) → copy price ID
3. Go to Developers → Webhooks → Add endpoint:
   - URL: `https://api.visli.pl/api/stripe/webhook`
   - Events: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`, `customer.subscription.updated`
   - Copy webhook signing secret

### Step 3: Deploy API to Vercel

```bash
# Clone / upload api-app to GitHub
cd api-app
git init
git add .
git commit -m "Initial api-app"
git remote add origin https://github.com/YOUR_USER/visli-api.git
git push -u origin main
```

In **Vercel**:
1. Import `visli-api` repo
2. Framework: Next.js
3. Root Directory: (leave empty if repo = api-app only)
4. Environment Variables — add ALL from `.env.example`:

```
DATABASE_URL=postgresql://...
JWT_SECRET=<openssl rand -hex 32>
ADMIN_EMAIL=admin@visli.pl
ADMIN_PASSWORD=<strong password>
API_HMAC_SECRET=<openssl rand -hex 32>
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_ENTERPRISE=price_...
NEXT_PUBLIC_API_URL=https://api.visli.pl
PANEL_URL=https://panel.visli.pl
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=30
```

5. Deploy
6. Go to **Settings → Domains** → Add `api.visli.pl`
7. Add DNS CNAME record: `api` → `cname.vercel-dns.com`

### Step 4: Initialize Database

```bash
# Locally (with DATABASE_URL set)
cd api-app
npm install
npx prisma db push
npm run db:seed
```

### Step 5: Deploy Panel to Vercel

```bash
cd panel-app
git init
git add .
git commit -m "Initial panel-app"
git remote add origin https://github.com/YOUR_USER/visli-panel.git
git push -u origin main
```

In **Vercel**:
1. Import `visli-panel` repo
2. Environment Variables:
```
NEXT_PUBLIC_API_URL=https://api.visli.pl
```
3. Deploy
4. Settings → Domains → Add `panel.visli.pl`
5. DNS CNAME: `panel` → `cname.vercel-dns.com`

### Step 6: Install WordPress Plugin

1. ZIP the `wordpress-plugin/` folder
2. WordPress → Plugins → Add New → Upload Plugin
3. Activate
4. Go to Settings → Visli License
5. Enter License Key and API Key
6. Click "Aktywuj licencję"

**Important:** Add to `wp-config.php`:
```php
define( 'VISLI_API_URL', 'https://api.visli.pl' );
define( 'VISLI_HMAC_SECRET', 'same-secret-as-API_HMAC_SECRET' );
```

---

## API Examples

### Validate License (from plugin)

```bash
# Generate signature: HMAC-SHA256 of sorted JSON body (without signature field)
TIMESTAMP=$(date +%s%3N)
BODY='{"apiKey":"vsk_abc123...","domain":"example.com","licenseKey":"VISLI-A1B2C-D3E4F-G5H6I-J7K8L","timestamp":'$TIMESTAMP'}'
SIGNATURE=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "your-hmac-secret" | awk '{print $2}')

curl -X POST https://api.visli.pl/api/license/validate \
  -H "Content-Type: application/json" \
  -d '{
    "licenseKey": "VISLI-A1B2C-D3E4F-G5H6I-J7K8L",
    "apiKey": "vsk_abc123def456...",
    "domain": "example.com",
    "timestamp": '$TIMESTAMP',
    "signature": "'$SIGNATURE'"
  }'
```

**Response (200 OK):**
```json
{
  "valid": true,
  "license": {
    "status": "ACTIVE",
    "plan": "PRO",
    "domain": "example.com",
    "expiresAt": "2025-12-31T23:59:59.000Z"
  },
  "sms": {
    "used": 42,
    "limit": 500,
    "remaining": 458
  },
  "nextValidationMs": 21600000
}
```

### Track SMS Usage

```bash
curl -X POST https://api.visli.pl/api/sms/track \
  -H "Content-Type: application/json" \
  -d '{
    "licenseKey": "VISLI-A1B2C-D3E4F-G5H6I-J7K8L",
    "apiKey": "vsk_abc123def456...",
    "domain": "example.com",
    "timestamp": 1700000000000,
    "count": 1,
    "signature": "computed-hmac-hex..."
  }'
```

**Response (200 OK):**
```json
{
  "success": true,
  "sms": {
    "used": 43,
    "limit": 500,
    "remaining": 457,
    "resetDate": "2025-02-01T00:00:00.000Z"
  }
}
```

**Response (429 — limit exceeded):**
```json
{
  "error": "SMS limit exceeded",
  "used": 500,
  "limit": 500,
  "remaining": 0
}
```

### Admin Login (from panel)

```bash
curl -X POST https://api.visli.pl/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@visli.pl",
    "password": "your-admin-password"
  }'
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "clx1abc...",
    "email": "admin@visli.pl",
    "role": "ADMIN"
  }
}
```

### Admin: List Licenses

```bash
curl https://api.visli.pl/api/admin/licenses?page=1&limit=20 \
  -H "Authorization: Bearer eyJhbGciOi..."
```

### Admin: Kill Switch

```bash
curl -X PATCH https://api.visli.pl/api/admin/licenses/LICENSE_ID \
  -H "Authorization: Bearer eyJhbGciOi..." \
  -H "Content-Type: application/json" \
  -d '{"action":"kill"}'
```

### Admin: Top-up SMS

```bash
curl -X PATCH https://api.visli.pl/api/admin/sms/USER_ID \
  -H "Authorization: Bearer eyJhbGciOi..." \
  -H "Content-Type: application/json" \
  -d '{"action":"topup","amount":200}'
```

### Get Plans (public)

```bash
curl https://api.visli.pl/api/plan
```

**Response:**
```json
{
  "plans": [
    { "id": "STARTER", "name": "Starter", "pricePLN": 99, "smsLimit": 100, "features": ["1 domena", "100 SMS/mies.", "Wsparcie e-mail"] },
    { "id": "PRO", "name": "Pro", "pricePLN": 199, "smsLimit": 500, "features": ["3 domeny", "500 SMS/mies.", "Priorytetowe wsparcie", "Analityka"] },
    { "id": "ENTERPRISE", "name": "Enterprise", "pricePLN": 499, "smsLimit": 5000, "features": ["Bez limitu domen", "5000 SMS/mies.", "Dedykowane wsparcie", "SLA"] }
  ]
}
```

---

## DNS Configuration (visli.pl)

| Type  | Name    | Value                    |
|-------|---------|--------------------------|
| CNAME | panel   | cname.vercel-dns.com     |
| CNAME | api     | cname.vercel-dns.com     |

Wait for DNS propagation (~5 min), then verify domains in Vercel dashboard.

---

## Error Codes Reference

| Code | Meaning                    |
|------|----------------------------|
| 400  | Bad request / missing data |
| 401  | Not authenticated          |
| 403  | Invalid key / domain / sig |
| 404  | License not found          |
| 409  | Domain conflict            |
| 429  | Rate limit or SMS exceeded |
| 500  | Server error               |
