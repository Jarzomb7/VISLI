# VISLI — License Server & Admin Panel

A production-ready SaaS application for managing software licenses for the VISLI WordPress booking plugin. Built with Next.js 14, TypeScript, Tailwind CSS, Prisma, PostgreSQL, and Stripe.

![Stack](https://img.shields.io/badge/Next.js-14-black?style=flat-square) ![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue?style=flat-square) ![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?style=flat-square) ![Stripe](https://img.shields.io/badge/Stripe-Integrated-635BFF?style=flat-square)

---

## Features

- **Admin Dashboard** — Stats overview with total clients, active/expired licenses
- **License Management** — Create, edit, delete licenses with auto-generated keys
- **Client Management** — View clients and their associated licenses
- **License Verification API** — `POST /api/check-license` for WordPress plugin validation
- **Stripe Integration** — Subscriptions, webhooks, automatic license provisioning
- **HMAC Signature Verification** — Secure API requests with shared secret
- **Domain Locking** — Each license is bound to a single domain
- **JWT Authentication** — Secure admin panel with cookie-based sessions
- **Modern UI** — Dark glassmorphism design, fully responsive

---

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL database (or Supabase)
- Stripe account

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd visli-license-server
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and fill in your values:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `STRIPE_SECRET_KEY` | Stripe secret key (sk_test_... or sk_live_...) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (whsec_...) |
| `STRIPE_PRICE_BASIC_MONTHLY` | Stripe Price ID for Basic monthly plan |
| `STRIPE_PRICE_BASIC_YEARLY` | Stripe Price ID for Basic yearly plan |
| `STRIPE_PRICE_PRO_MONTHLY` | Stripe Price ID for Pro monthly plan |
| `STRIPE_PRICE_PRO_YEARLY` | Stripe Price ID for Pro yearly plan |
| `NEXT_PUBLIC_APP_URL` | Your app URL (e.g. https://license.visli.io) |
| `LICENSE_SECRET` | Random 32+ char string for HMAC signature validation |
| `JWT_SECRET` | Random 32+ char string for admin session tokens |

### 3. Setup Database

```bash
npx prisma db push
```

### 4. Seed Admin User

```bash
npm run db:seed
```

Default credentials: `admin@visli.io` / `admin123`

> ⚠️ Change the password immediately after first login.

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Deploy on Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-github-repo-url>
git push -u origin main
```

### 2. Import in Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Add all environment variables from `.env.example`
4. Deploy

### 3. Setup Database

Use **Supabase** (free tier available):

1. Create a project at [supabase.com](https://supabase.com)
2. Go to Settings → Database → Connection string
3. Copy the URI and set as `DATABASE_URL`
4. Vercel will run `prisma generate` automatically via the `postinstall` script
5. Run `npx prisma db push` once against your production database

### 4. Setup Stripe Webhook

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-domain.vercel.app/api/stripe/webhook`
3. Listen for events:
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.deleted`
4. Copy the signing secret → set as `STRIPE_WEBHOOK_SECRET`

---

## API Reference

### `POST /api/check-license`

Validates a license from the WordPress plugin.

**Request:**
```json
{
  "license_key": "VISLI-A1B2-C3D4-E5F6-G7H8",
  "domain": "example.com"
}
```

**Headers (optional):**
```
x-license-signature: <hmac-sha256-hex>
```

The signature is computed as `HMAC-SHA256(JSON.stringify({license_key, domain}), LICENSE_SECRET)`.

**Response:**
```json
{
  "status": "active",
  "plan": "pro",
  "expires_at": "2025-12-31T00:00:00.000Z"
}
```

Possible `status` values: `active`, `expired`, `invalid`

### `POST /api/create-license`

Creates a license (requires admin authentication cookie).

**Request:**
```json
{
  "domain": "example.com",
  "plan": "basic",
  "duration": "12m",
  "clientEmail": "client@example.com"
}
```

### `POST /api/stripe/checkout`

Creates a Stripe Checkout session.

**Request:**
```json
{
  "plan": "pro",
  "interval": "monthly",
  "domain": "example.com",
  "email": "client@example.com"
}
```

### `POST /api/stripe/webhook`

Stripe webhook endpoint. Handles subscription lifecycle events automatically.

---

## WordPress Plugin Integration

Example PHP snippet for your WordPress plugin:

```php
function visli_check_license($license_key) {
    $domain = parse_url(home_url(), PHP_URL_HOST);
    $payload = json_encode([
        'license_key' => $license_key,
        'domain' => $domain,
    ]);

    $signature = hash_hmac('sha256', $payload, VISLI_LICENSE_SECRET);

    $response = wp_remote_post('https://your-domain.vercel.app/api/check-license', [
        'headers' => [
            'Content-Type' => 'application/json',
            'x-license-signature' => $signature,
        ],
        'body' => $payload,
    ]);

    if (is_wp_error($response)) {
        return ['status' => 'error'];
    }

    return json_decode(wp_remote_retrieve_body($response), true);
}
```

---

## Project Structure

```
visli-license-server/
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── seed.ts                # Seed admin user
├── src/
│   ├── app/
│   │   ├── (dashboard)/       # Protected dashboard pages
│   │   │   ├── dashboard/
│   │   │   ├── licenses/
│   │   │   └── clients/
│   │   ├── api/               # API routes
│   │   │   ├── auth/
│   │   │   ├── check-license/
│   │   │   ├── create-license/
│   │   │   ├── clients/
│   │   │   ├── dashboard/
│   │   │   ├── licenses/
│   │   │   └── stripe/
│   │   ├── checkout/
│   │   └── login/
│   ├── components/
│   │   └── layout/
│   │       └── Sidebar.tsx
│   ├── lib/
│   │   ├── auth.ts            # JWT session management
│   │   ├── license.ts         # Key generation & HMAC
│   │   ├── prisma.ts          # Prisma client singleton
│   │   └── stripe.ts          # Stripe client & plans
│   └── middleware.ts          # Auth route protection
├── .env.example
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

---

## License

Proprietary — VISLI. All rights reserved.
