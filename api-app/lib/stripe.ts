import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("⚠ STRIPE_SECRET_KEY not set");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-09-30.acacia" as Stripe.LatestApiVersion,
  typescript: true,
});

export const PLANS = {
  STARTER: {
    name: "Starter",
    pricePLN: 99,
    priceId: process.env.STRIPE_PRICE_STARTER || "",
    smsLimit: 100,
    features: ["1 domena", "100 SMS/mies.", "Wsparcie e-mail"],
  },
  PRO: {
    name: "Pro",
    pricePLN: 199,
    priceId: process.env.STRIPE_PRICE_PRO || "",
    smsLimit: 500,
    features: ["3 domeny", "500 SMS/mies.", "Priorytetowe wsparcie", "Analityka"],
  },
  ENTERPRISE: {
    name: "Enterprise",
    pricePLN: 499,
    priceId: process.env.STRIPE_PRICE_ENTERPRISE || "",
    smsLimit: 5000,
    features: ["Bez limitu domen", "5000 SMS/mies.", "Dedykowane wsparcie", "SLA"],
  },
} as const;

export type PlanKey = keyof typeof PLANS;

export function planByPriceId(priceId: string): PlanKey | null {
  for (const [k, v] of Object.entries(PLANS)) {
    if (v.priceId === priceId) return k as PlanKey;
  }
  return null;
}

export async function createCheckoutSession(p: {
  email: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}) {
  return stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer_email: p.email,
    line_items: [{ price: p.priceId, quantity: 1 }],
    success_url: p.successUrl,
    cancel_url: p.cancelUrl,
    metadata: p.metadata,
    subscription_data: { metadata: p.metadata },
  });
}
