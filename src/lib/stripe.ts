import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-04-10",
  typescript: true,
});

export const PLANS = {
  basic: {
    name: "Basic",
    monthlyPriceId: process.env.STRIPE_PRICE_BASIC_MONTHLY || "",
    yearlyPriceId: process.env.STRIPE_PRICE_BASIC_YEARLY || "",
  },
  pro: {
    name: "Pro",
    monthlyPriceId: process.env.STRIPE_PRICE_PRO_MONTHLY || "",
    yearlyPriceId: process.env.STRIPE_PRICE_PRO_YEARLY || "",
  },
} as const;
