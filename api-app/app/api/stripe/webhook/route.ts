import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe, planByPriceId, PLANS } from "@/lib/stripe";
import prisma from "@/lib/prisma";
import { generateLicenseKey, generateApiKey } from "@/lib/security";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

// Disable body parsing — Stripe needs raw body
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature or secret" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook sig verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "invoice.paid":
        await onInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case "invoice.payment_failed":
        await onPaymentFailed(event.data.object as Stripe.Invoice);
        break;
      case "customer.subscription.deleted":
        await onSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.updated":
        await onSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      default:
        console.log(`Unhandled Stripe event: ${event.type}`);
    }
  } catch (err) {
    console.error(`Webhook handler error [${event.type}]:`, err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// ═══════════════════════════════════════════════════════════
//  checkout.session.completed
// ═══════════════════════════════════════════════════════════

async function onCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== "subscription") return;

  const email = session.customer_email;
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;
  if (!email || !customerId || !subscriptionId) return;

  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = sub.items.data[0]?.price.id || "";
  const plan = planByPriceId(priceId) || "STARTER";
  const smsLimit = PLANS[plan].smsLimit;
  const periodEnd = new Date(sub.current_period_end * 1000);

  // Find or create user
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const tempPass = randomBytes(16).toString("hex");
    const hashed = await bcrypt.hash(tempPass, 12);
    user = await prisma.user.create({ data: { email, password: hashed } });
  }

  // Upsert subscription
  await prisma.subscription.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      status: "ACTIVE",
      plan,
      currentPeriodEnd: periodEnd,
    },
    update: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      status: "ACTIVE",
      plan,
      currentPeriodEnd: periodEnd,
    },
  });

  // Create or reactivate license
  const existing = await prisma.license.findFirst({ where: { userId: user.id } });
  if (!existing) {
    await prisma.license.create({
      data: {
        userId: user.id,
        licenseKey: generateLicenseKey(),
        apiKey: generateApiKey(),
        status: "ACTIVE",
        plan,
        expiresAt: periodEnd,
      },
    });
  } else {
    await prisma.license.update({
      where: { id: existing.id },
      data: { status: "ACTIVE", plan, expiresAt: periodEnd },
    });
  }

  // SMS usage
  const nextReset = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
  await prisma.sMSUsage.upsert({
    where: { userId: user.id },
    create: { userId: user.id, used: 0, limit: smsLimit, resetDate: nextReset },
    update: { limit: smsLimit },
  });
}

// ═══════════════════════════════════════════════════════════
//  invoice.paid — renew
// ═══════════════════════════════════════════════════════════

async function onInvoicePaid(invoice: Stripe.Invoice) {
  const subId = invoice.subscription as string;
  if (!subId) return;

  const dbSub = await prisma.subscription.findUnique({ where: { stripeSubscriptionId: subId } });
  if (!dbSub) return;

  const sub = await stripe.subscriptions.retrieve(subId);
  const periodEnd = new Date(sub.current_period_end * 1000);

  await prisma.subscription.update({
    where: { id: dbSub.id },
    data: { status: "ACTIVE", currentPeriodEnd: periodEnd },
  });

  await prisma.license.updateMany({
    where: { userId: dbSub.userId },
    data: { status: "ACTIVE", expiresAt: periodEnd },
  });
}

// ═══════════════════════════════════════════════════════════
//  invoice.payment_failed — suspend
// ═══════════════════════════════════════════════════════════

async function onPaymentFailed(invoice: Stripe.Invoice) {
  const subId = invoice.subscription as string;
  if (!subId) return;

  const dbSub = await prisma.subscription.findUnique({ where: { stripeSubscriptionId: subId } });
  if (!dbSub) return;

  await prisma.subscription.update({ where: { id: dbSub.id }, data: { status: "PAST_DUE" } });
  await prisma.license.updateMany({ where: { userId: dbSub.userId }, data: { status: "SUSPENDED" } });
}

// ═══════════════════════════════════════════════════════════
//  customer.subscription.deleted — deactivate
// ═══════════════════════════════════════════════════════════

async function onSubscriptionDeleted(sub: Stripe.Subscription) {
  const dbSub = await prisma.subscription.findUnique({ where: { stripeSubscriptionId: sub.id } });
  if (!dbSub) return;

  await prisma.subscription.update({ where: { id: dbSub.id }, data: { status: "CANCELED" } });
  await prisma.license.updateMany({ where: { userId: dbSub.userId }, data: { status: "INACTIVE" } });
}

// ═══════════════════════════════════════════════════════════
//  customer.subscription.updated — plan change
// ═══════════════════════════════════════════════════════════

async function onSubscriptionUpdated(sub: Stripe.Subscription) {
  const dbSub = await prisma.subscription.findUnique({ where: { stripeSubscriptionId: sub.id } });
  if (!dbSub) return;

  const priceId = sub.items.data[0]?.price.id || "";
  const plan = planByPriceId(priceId) || dbSub.plan;
  const smsLimit = PLANS[plan as keyof typeof PLANS]?.smsLimit || 100;

  await prisma.subscription.update({
    where: { id: dbSub.id },
    data: { plan, currentPeriodEnd: new Date(sub.current_period_end * 1000) },
  });

  await prisma.license.updateMany({ where: { userId: dbSub.userId }, data: { plan } });
  await prisma.sMSUsage.updateMany({ where: { userId: dbSub.userId }, data: { limit: smsLimit } });
}
