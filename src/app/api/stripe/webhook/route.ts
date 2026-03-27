import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { generateLicenseKey } from "@/lib/license";
import Stripe from "stripe";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET || ""
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerEmail = session.customer_email || session.customer_details?.email;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;
        const metadata = session.metadata || {};

        if (!customerEmail) break;

        const client = await prisma.client.upsert({
          where: { email: customerEmail },
          update: { stripeCustomerId: customerId },
          create: { email: customerEmail, stripeCustomerId: customerId },
        });

        const plan = (metadata.plan as "basic" | "pro") || "basic";
        const domain = metadata.domain || "";
        const months = parseInt(metadata.months || "1");

        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + months);

        await prisma.license.create({
          data: {
            licenseKey: generateLicenseKey(),
            domain: domain.toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, ""),
            plan,
            status: "active",
            expiresAt,
            subscriptionId,
            clientId: client.id,
          },
        });
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;

        if (!subscriptionId) break;

        const license = await prisma.license.findFirst({
          where: { subscriptionId },
        });

        if (license) {
          const newExpiry = new Date(license.expiresAt);
          newExpiry.setMonth(newExpiry.getMonth() + 1);

          await prisma.license.update({
            where: { id: license.id },
            data: { status: "active", expiresAt: newExpiry },
          });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;

        if (!subscriptionId) break;

        await prisma.license.updateMany({
          where: { subscriptionId },
          data: { status: "expired" },
        });
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;

        await prisma.license.updateMany({
          where: { subscriptionId: subscription.id },
          data: { status: "expired" },
        });
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
